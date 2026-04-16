// CHROMATIC DECAY — Upgrade System

import { CONFIG } from './config.js';
import { drawRoundedRect } from './utils.js';

// ── Class colors ──────────────────────────────────────────────
export const CLASS_COLORS = {
  warden:  '#eafae4',
  breaker: '#fff5c2',
  ghost:   '#ffe0f0',
  weaver:  '#d6faf7',
  herald:  '#fddede',
};

// ── Helpers ───────────────────────────────────────────────────

// Tag each trait with its class for UI coloring + tracking
function tagClass(cls, traits) {
  return traits.map(t => ({ ...t, class: cls }));
}

// Weighted random pick from array of objects with .currentWeight property
function weightedRandom(items) {
  const total = items.reduce((s, item) => s + (item.currentWeight ?? item.baseWeight ?? 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.currentWeight ?? item.baseWeight ?? 1;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// Check if a skill's prerequisites are met given the set of taken ids
function prereqMet(skill, takenIds) {
  if (skill.tier === 1 || !skill.tier) return true;   // T1 and generics always available
  if (skill.requiresAny) return skill.requiresAny.some(r => takenIds.includes(r));
  if (skill.requires)    return takenIds.includes(skill.requires);
  return true;
}

// ── Generic upgrade pool ──────────────────────────────────────
// All % upgrades are additive off base stat only — never compounding.
// baseWeight drives weighted random selection; decays 50% per take.
// cap removes the upgrade from pool once reached.

export const GENERIC_UPGRADES = [
  {
    id: 'pulse_amplifier', name: 'Pulse Amplifier',
    desc: '+15% damage.',
    baseWeight: 8, cap: 5,
    apply: p => { p.damageMultiplier += 0.15; },
  },
  {
    id: 'rapid_cycle', name: 'Rapid Cycle',
    desc: '+10% fire rate.',
    baseWeight: 7, cap: 4,
    apply: p => { p.fireRateMultiplier += 0.10; },
  },
  {
    id: 'signal_boost', name: 'Signal Boost',
    desc: '+12% move speed.',
    baseWeight: 6, cap: 3,
    apply: p => { p.speedMultiplier += 0.12; },
  },
  {
    id: 'frequency_shield', name: 'Frequency Shield',
    desc: '+20 max HP.',
    baseWeight: 7, cap: 5,
    apply: p => { p.maxHp += 20; p.hp = Math.min(p.hp + 20, p.maxHp); },
  },
  {
    id: 'multicast', name: 'Multicast',
    desc: '+1 projectile.',
    baseWeight: 3, cap: 3,
    apply: p => { p.projCount += 1; },
  },
  {
    id: 'extended_range', name: 'Extended Range',
    desc: '+25% proj range.',
    baseWeight: 5, cap: 3,
    apply: p => { p.projRange += Math.round(CONFIG.player_projectile_range * 0.25); },
  },
  {
    id: 'overcharge_cell', name: 'Overcharge Cell',
    desc: '+20% proj speed.',
    baseWeight: 5, cap: 3,
    apply: p => { p.projSpeed += Math.round(CONFIG.player_projectile_speed * 0.20); },
  },
  {
    id: 'piercing_round', name: 'Piercing Round',
    desc: 'Shots pierce +1 enemy.',
    baseWeight: 3, cap: 2,
    apply: p => { p.piercingShots = (p.piercingShots || 0) + 1; },
  },
  {
    id: 'emergency_cache', name: 'Emergency Cache',
    desc: '+15 HP now.',
    baseWeight: 4, cap: 2,
    apply: p => { p.heal(15); },
  },
  {
    id: 'cooldown_reduction', name: 'Cooldown Reduction',
    desc: '-15% ability cooldown.',
    baseWeight: 4, cap: 3,
    apply: p => { p.abilityCooldownMultiplier = Math.max(0.3, (p.abilityCooldownMultiplier || 1.0) - 0.15); },
  },
];

// ── Class trait pools ─────────────────────────────────────────
// Each trait: { id, name, desc, lore, class, tier, requires?, requiresAny?, apply(player, companions, traps) }
// Tier 1 — always available once class is unlocked
// Tier 2 — requires a specific Tier 1
// Tier 3 — requires a specific Tier 2 (or one of two)
// Class skills don't decay — they enter/exit pool based on prerequisites.

export const CLASS_TRAITS = {

  // ── WARDEN — Sustain, protection, resilience ─────────────────
  warden: tagClass('warden', [
    {
      id: 'warden_iron_frame', name: 'Iron Frame',
      desc: '+40 max HP. Heal 5 on pickup.',
      tier: 1, requires: null,
      apply: p => { p.maxHp += 40; p.hp = Math.min(p.hp + 5, p.maxHp); },
    },
    {
      id: 'warden_signal_barrier', name: 'Signal Barrier',
      desc: '+20 shield HP (absorbs damage first).',
      tier: 1, requires: null,
      apply: p => { p.shield = Math.min((p.shield || 0) + 20, 80); },
    },
    {
      id: 'warden_frequency_skin', name: 'Frequency Skin',
      desc: '-15% all damage taken.',
      tier: 1, requires: null,
      apply: p => { p.damageReduction = Math.min(0.60, (p.damageReduction || 0) + 0.15); },
    },
    {
      id: 'warden_echo_anchor', name: 'Echo Anchor',
      desc: 'Echo rescue → +10 HP.',
      tier: 1, requires: null,
      apply: p => { p.echoHealBonus = (p.echoHealBonus || 0) + 10; },
    },
    {
      id: 'warden_static_shell', name: 'Static Shell',
      desc: '+0.4s invincibility on hit.',
      tier: 2, requires: 'warden_frequency_skin',
      apply: p => { p.invincibilityBonus = (p.invincibilityBonus || 0) + 0.4; },
    },
    {
      id: 'warden_loadbearing', name: 'Load-Bearing',
      desc: '20% chance: heal 5 on kill.',
      tier: 2, requires: 'warden_iron_frame',
      apply: p => { p.killHealChance = Math.min(1.0, (p.killHealChance || 0) + 0.2); },
    },
    {
      id: 'warden_fault_tolerance', name: 'Fault Tolerance',
      desc: 'Survive one lethal hit at 1 HP.',
      tier: 2, requires: 'warden_signal_barrier',
      apply: p => { p.lastStand = true; },
    },
    {
      id: 'warden_redundant_cycle', name: 'Redundant Cycle',
      desc: '+1 shot before slow penalty.',
      tier: 2, requires: 'warden_echo_anchor',
      apply: p => { p.burstBuffer = (p.burstBuffer || 0) + 1; },
    },
    {
      id: 'warden_hardened_signal', name: 'Hardened Signal',
      desc: '+10% dmg. No slow while firing.',
      tier: 3, requires: 'warden_loadbearing',
      apply: p => { p.damageMultiplier += 0.10; p.fireSlowImmune = true; },
    },
    {
      id: 'warden_uptime', name: '100% Uptime',
      desc: '+60 max HP. Shield regens 1/sec.',
      tier: 3, requires: 'warden_fault_tolerance',
      apply: p => { p.maxHp += 60; p.shieldRegen = (p.shieldRegen || 0) + 1; },
    },
  ]),

  // ── BREAKER — Burst offense, kill-chaining, explosive reactions ─
  breaker: tagClass('breaker', [
    // T1 — always available when Breaker is unlocked
    {
      id: 'b_volatile_signal', name: 'Volatile Signal',
      desc: 'Dmg +5% per 100px traveled, max +50%.',
      lore: '"Momentum-based pricing. Classic Raze."',
      tier: 1, requires: null,
      apply: p => { p.volatileSignal = true; },
    },
    {
      id: 'b_overclock', name: 'Overclock',
      desc: 'Hit → 2× fire rate for 4s.',
      lore: '"High risk tolerance. It\'s a feature."',
      tier: 1, requires: null,
      apply: p => { p.overclock = true; p.overclockCooldown = 0; },
    },
    {
      id: 'b_short_squeeze', name: 'Short Squeeze',
      desc: 'Hits slow enemies 30% for 3s.',
      lore: '"Trap set. Exit blocked. Classic play."',
      tier: 1, requires: null,
      apply: p => { p.shortSqueeze = true; },
    },
    // T2 — requires specific T1
    {
      id: 'b_cascade_protocol', name: 'Cascade Protocol',
      desc: 'Chain kill → AoE pulse (50% dmg).',
      lore: '"Raze called these \'acceptable market corrections.\'"',
      tier: 2, requires: 'b_volatile_signal',
      apply: p => { p.cascadeProtocol = true; p._lastKillTime = -99; },
    },
    {
      id: 'b_margin_call', name: 'Margin Call',
      desc: '5 kills in 6s → 3s invincible.',
      lore: '"Raze always knew when to go all in."',
      tier: 2, requires: 'b_overclock',
      apply: p => { p.marginCall = true; p._marginKillTimes = []; },
    },
    {
      id: 'b_leveraged_position', name: 'Leveraged Position',
      desc: 'Low HP → up to +60% dmg.',
      lore: '"Raze operated best under pressure. Familiar?"',
      tier: 2, requires: 'b_short_squeeze',
      apply: p => { p.leveragedPosition = true; },
    },
    {
      id: 'b_algorithmic_aggression', name: 'Algorithmic Aggression',
      desc: 'Kill streak: +5% dmg each, max +50%.',
      lore: '"Compounding returns. Raze\'s favorite thing."',
      tier: 2, requiresAny: ['b_volatile_signal', 'b_overclock', 'b_short_squeeze'],
      apply: p => { p.algorithmicAggression = true; p.algoKillStreak = 0; p.algoBonus = 0; },
    },
    // T3 — requires specific T2
    {
      id: 'b_frequency_shatter', name: 'Frequency Shatter',
      desc: '<25% HP enemies explode on death.',
      lore: '"Liquidation event. Everything must go."',
      tier: 3, requires: 'b_cascade_protocol',
      apply: p => { p.frequencyShatter = true; },
    },
    {
      id: 'b_flash_crash', name: 'Flash Crash',
      desc: 'Every 10th shot → 400% dmg.',
      lore: '"Once a decade. Completely unpredictable. Catastrophic."',
      tier: 3, requiresAny: ['b_margin_call', 'b_algorithmic_aggression'],
      apply: p => { p.flashCrash = true; p.flashCrashCounter = p.flashCrashCounter || 0; },
    },
    {
      id: 'b_circuit_breaker', name: 'Circuit Breaker',
      desc: 'Ability: stun all enemies 3s (once per run).',
      lore: '"The regulators always hated this one."',
      tier: 3, requires: 'b_leveraged_position',
      apply: p => { p.circuitBreaker = true; },
    },
  ]),

  // ── GHOST — Mobility, evasion, movement-linked damage ────────
  ghost: tagClass('ghost', [
    {
      id: 'ghost_phase_step', name: 'Phase Step',
      desc: 'Move speed +30%.',
      tier: 1, requires: null,
      apply: p => { p.speedMultiplier += 0.30; },
    },
    {
      id: 'ghost_drift_damage', name: 'Drift Damage',
      desc: 'Dmg +1% per 10px/s above base speed.',
      tier: 1, requires: null,
      apply: p => { p.driftDamage = true; },
    },
    {
      id: 'ghost_signal_fade', name: 'Signal Fade',
      desc: 'Moving → enemy proj -20% speed.',
      tier: 1, requires: null,
      apply: p => { p.signalFade = true; },
    },
    {
      id: 'ghost_evasion_echo', name: 'Evasion Echo',
      desc: 'Hit → +60% speed for 1.2s.',
      tier: 1, requires: null,
      apply: p => { p.evasionEcho = true; },
    },
    {
      id: 'ghost_null_trace', name: 'Null Trace',
      desc: 'Invincibility frames +0.5s.',
      tier: 2, requires: 'ghost_signal_fade',
      apply: p => { p.invincibilityBonus = (p.invincibilityBonus || 0) + 0.5; },
    },
    {
      id: 'ghost_silent_approach', name: 'Silent Approach',
      desc: 'Enemy aggro range -25%.',
      tier: 2, requires: 'ghost_phase_step',
      apply: p => { p.stealthRange = (p.stealthRange || 0) + 0.25; },
    },
    {
      id: 'ghost_refraction', name: 'Refraction',
      desc: 'Shots bounce off walls once.',
      tier: 2, requires: 'ghost_drift_damage',
      apply: p => { p.projectileBounce = true; },
    },
    {
      id: 'ghost_momentum_feed', name: 'Momentum Feed',
      desc: 'Pickup radius scales with speed.',
      tier: 2, requires: 'ghost_evasion_echo',
      apply: p => { p.momentumPickup = true; },
    },
    {
      id: 'ghost_afterimage', name: 'Afterimage',
      desc: 'Ability spawns a decoy (absorbs 1 hit).',
      tier: 3, requires: 'ghost_null_trace',
      apply: p => { p.afterimage = true; },
    },
    {
      id: 'ghost_zero_signature', name: 'Zero Signature',
      desc: '+40% speed. -50% contact dmg.',
      tier: 3, requires: 'ghost_silent_approach',
      apply: p => { p.speedMultiplier += 0.40; p.contactDamageReduction = (p.contactDamageReduction || 0) + 0.5; },
    },
  ]),

  // ── WEAVER — Map control, traps, area denial ────────────────
  weaver: tagClass('weaver', [
    {
      id: 'weaver_mesh_layer', name: 'Mesh Layer',
      desc: '+1 max trap.',
      tier: 1, requires: null,
      apply: (p, _c, traps) => { if (traps) traps.maxTraps = (traps.maxTraps || 2) + 1; },
    },
    {
      id: 'weaver_slow_weave', name: 'Slow Weave',
      desc: 'Traps slow +10%.',
      tier: 1, requires: null,
      apply: (p, _c, traps) => { if (traps) traps.slowStrength = Math.min(0.9, (traps.slowStrength || 0.5) + 0.10); },
    },
    {
      id: 'weaver_signal_grid', name: 'Signal Grid',
      desc: 'Trap duration +4s.',
      tier: 1, requires: null,
      apply: (p, _c, traps) => { if (traps) traps.trapDuration = (traps.trapDuration || 8) + 4; },
    },
    {
      id: 'weaver_tripwire', name: 'Tripwire',
      desc: 'Traps deal 8 dmg/sec.',
      tier: 1, requires: null,
      apply: (p, _c, traps) => { if (traps) traps.trapDamage = (traps.trapDamage || 0) + 8; },
    },
    {
      id: 'weaver_overwatch', name: 'Overwatch',
      desc: '+20% dmg to trapped enemies.',
      tier: 2, requires: 'weaver_tripwire',
      apply: p => { p.overwatchBonus = (p.overwatchBonus || 0) + 0.20; },
    },
    {
      id: 'weaver_node_burst', name: 'Node Burst',
      desc: 'Trap expiry → 25 AoE dmg.',
      tier: 2, requires: 'weaver_signal_grid',
      apply: (p, _c, traps) => { if (traps) traps.expiryBurst = true; },
    },
    {
      id: 'weaver_rewire', name: 'Rewire',
      desc: '-30% ability cooldown.',
      tier: 2, requires: 'weaver_slow_weave',
      apply: p => { p.abilityCooldownMultiplier = Math.max(0.3, (p.abilityCooldownMultiplier || 1.0) - 0.30); },
    },
    {
      id: 'weaver_anchor_field', name: 'Anchor Field',
      desc: 'Trapped enemies can\'t shoot.',
      tier: 2, requires: 'weaver_mesh_layer',
      apply: (p, _c, traps) => { if (traps) traps.suppressFire = true; },
    },
    {
      id: 'weaver_deep_pattern', name: 'Deep Pattern',
      desc: 'Traps invisible until triggered.',
      tier: 3, requires: 'weaver_anchor_field',
      apply: (p, _c, traps) => { if (traps) traps.stealth = true; },
    },
    {
      id: 'weaver_total_control', name: 'Total Control',
      desc: '+2 max traps. Slow +20%.',
      tier: 3, requires: 'weaver_overwatch',
      apply: (p, _c, traps) => { if (traps) { traps.maxTraps = (traps.maxTraps || 2) + 2; traps.slowStrength = Math.min(0.9, (traps.slowStrength || 0.5) + 0.20); } },
    },
  ]),

  // ── HERALD — Companions, indirect damage, Echo weaponization ─
  herald: tagClass('herald', [
    {
      id: 'herald_summon_orb', name: 'Summon Orb',
      desc: '+1 orb (absorbs hits, AoE on expiry).',
      tier: 1, requires: null,
      apply: (p, companions) => { if (companions) companions.addOrb(p); },
    },
    {
      id: 'herald_overcharge_orb', name: 'Overcharge Orb',
      desc: 'Orb expiry +50% dmg.',
      tier: 1, requires: null,
      apply: (p, companions) => { if (companions) companions.expiryDamageMultiplier = (companions.expiryDamageMultiplier || 1) + 0.5; },
    },
    {
      id: 'herald_resonant_link', name: 'Resonant Link',
      desc: 'Orb expiry → +4 HP.',
      tier: 1, requires: null,
      apply: (p, companions) => { if (companions) companions.expiryHeal = (companions.expiryHeal || 0) + 4; },
    },
    {
      id: 'herald_signal_relay', name: 'Signal Relay',
      desc: '+30% orb HP. Faster orbit.',
      tier: 1, requires: null,
      apply: (p, companions) => { if (companions) { companions.orbitSpeed *= 1.3; companions.orbHpMultiplier = (companions.orbHpMultiplier || 1) + 0.3; } },
    },
    {
      id: 'herald_echo_network', name: 'Echo Network',
      desc: 'Echo rescue → spawn orb.',
      tier: 2, requires: 'herald_resonant_link',
      apply: p => { p.echoSpawnOrb = true; },
    },
    {
      id: 'herald_viral_spread', name: 'Viral Spread',
      desc: 'Kill near orb → +2s orb life.',
      tier: 2, requires: 'herald_overcharge_orb',
      apply: (p, companions) => { if (companions) companions.killExtend = (companions.killExtend || 0) + 2; },
    },
    {
      id: 'herald_broadcast', name: 'Broadcast',
      desc: '+50% orb expiry AoE.',
      tier: 2, requires: 'herald_overcharge_orb',
      apply: (p, companions) => { if (companions) companions.expiryRadiusMultiplier = (companions.expiryRadiusMultiplier || 1) + 0.5; },
    },
    {
      id: 'herald_feed_loop', name: 'Feed Loop',
      desc: 'Ability spawns 2 orbs.',
      tier: 2, requires: 'herald_summon_orb',
      apply: p => { p.abilityOrbCount = (p.abilityOrbCount || 1) + 1; },
    },
    {
      id: 'herald_persistence', name: 'Persistence',
      desc: '+4s orb duration.',
      tier: 3, requires: 'herald_echo_network',
      apply: (p, companions) => { if (companions) companions.orbDuration = (companions.orbDuration || 8) + 4; },
    },
    {
      id: 'herald_viral_hub', name: 'Viral Hub',
      desc: '+2 max orbs.',
      tier: 3, requires: 'herald_viral_spread',
      apply: (p, companions) => { if (companions) companions.maxOrbs = (companions.maxOrbs || 3) + 2; },
    },
  ]),
};

// ── Upgrade UI ────────────────────────────────────────────────

export class UpgradeScreen {
  constructor() {
    this.active      = false;
    this.cards       = [];
    this.hovered     = -1;
    this.takenIds    = [];     // ids of all upgrades taken (generics + traits)
    this.takenCounts = {};     // id → times taken (generics only — for decay)
    this._companions = null;
    this._traps      = null;
    this.waveContext = null;   // { type: 'early'|'timeout', bonusPts, secondsRemaining }
  }

  setSystems(companions, traps) {
    this._companions = companions;
    this._traps      = traps;
  }

  // unlockedClasses: array of class id strings that have fragments collected
  present(player, unlockedClasses = []) {
    const archiveState = this._archiveState(unlockedClasses);
    const classSkills  = this._buildClassPool(unlockedClasses);
    this.cards = this._generateOffer(classSkills, archiveState);
    // No cards available — skip the screen entirely
    this.active  = this.cards.length > 0;
    this.hovered = -1;
  }

  // Build archive state object (fragment id → found bool) from unlocked class list
  // For offer generation logic (classRatio depends on how many fragments found)
  _archiveState(unlockedClasses) {
    const classToFrag = { warden: 'sable', breaker: 'raze', ghost: 'lumen', weaver: 'cord', herald: 'voss' };
    const state = {};
    for (const cls of unlockedClasses) {
      const fragId = classToFrag[cls];
      if (fragId) state[fragId] = true;
    }
    return state;
  }

  // Build available class skills respecting prerequisites
  _buildClassPool(unlockedClasses) {
    const pool = [];
    for (const cls of unlockedClasses) {
      const traits = CLASS_TRAITS[cls];
      if (!traits) continue;
      for (const t of traits) {
        if (this.takenIds.includes(t.id)) continue;       // already taken
        if (!prereqMet(t, this.takenIds))  continue;       // prerequisite not met
        pool.push({ ...t, currentWeight: 5 });             // class skills: fixed weight 5
      }
    }
    return pool;
  }

  // Weighted offer generation (per dev doc)
  _generateOffer(classSkills, archiveState) {
    // Build weighted generic pool (filter capped, apply decay)
    const available = GENERIC_UPGRADES.filter(u => (this.takenCounts[u.id] || 0) < u.cap);
    const weighted  = available.map(u => ({
      ...u,
      currentWeight: u.baseWeight * Math.pow(0.5, this.takenCounts[u.id] || 0),
    }));

    const unlocked  = Object.values(archiveState).filter(Boolean).length;
    const classRatio = unlocked <= 2 ? 0.33 : 0.66;

    const offer = [];
    let  guard  = 0;

    while (offer.length < 3 && guard++ < 100) {
      const useClass = classSkills.length > 0 && Math.random() < classRatio;
      const source   = useClass ? classSkills : weighted;
      if (source.length === 0) continue;
      const pick = weightedRandom(source);
      if (!offer.find(o => o.id === pick.id)) offer.push(pick);
    }

    // Fallback: pad with random generics if pool runs dry
    if (offer.length < 3 && weighted.length > 0) {
      for (const u of weighted) {
        if (offer.length >= 3) break;
        if (!offer.find(o => o.id === u.id)) offer.push(u);
      }
    }

    return offer;
  }

  handleInput(input, player, canvas) {
    if (!this.active) return false;

    const { mouseX: mx, mouseY: my } = input;
    const layout = this._cardLayouts(canvas.width, canvas.height);

    this.hovered = -1;
    for (let i = 0; i < layout.length; i++) {
      const { x, y, w, h } = layout[i];
      if (mx >= x && mx <= x + w && my >= y && my <= y + h) {
        this.hovered = i;
      }
    }

    if (input.mouseJustClicked && this.hovered >= 0) {
      this._applyCard(this.cards[this.hovered], player);
      this.active = false;
      return true;
    }

    // Keyboard: 1/2/3
    for (let i = 0; i < 3; i++) {
      if (input.justPressed?.[`digit${i + 1}`]) {
        this._applyCard(this.cards[i], player);
        this.active = false;
        return true;
      }
    }

    return false;
  }

  _applyCard(card, player) {
    card.apply(player, this._companions, this._traps);
    player.upgradesTaken++;

    // Track class
    player.classTakenCounts = player.classTakenCounts || {};
    if (card.class) {
      player.classTakenCounts[card.class] = (player.classTakenCounts[card.class] || 0) + 1;
    }

    // Track taken id (always) and count (generics only, for decay)
    player.classTraits[card.id] = true;
    this.takenIds.push(card.id);

    // Decay count only for generic upgrades (class skills don't decay)
    if (!card.class) {
      this.takenCounts[card.id] = (this.takenCounts[card.id] || 0) + 1;
    }
  }

  _cardLayouts(W, H) {
    const landscape = H < 500;   // phone in landscape — lay cards side by side
    const narrow    = W < 600;   // phone in portrait

    if (landscape) {
      // 3 cards side by side — cap height so they don't fill the whole screen
      const headerH = 36;
      const gap     = 8;
      const cardW   = Math.floor((W - gap * 4) / 3);
      const cardH   = Math.min(H - headerH - gap * 2, 130);
      const startY  = headerH + gap;
      return [0, 1, 2].map(i => ({
        x: gap + i * (cardW + gap),
        y: startY,
        w: cardW,
        h: cardH,
      }));
    }

    const cardW  = Math.min(500, W * 0.92);
    let cardH, gap;
    if (narrow) {
      gap = 10; cardH = 90;
    } else {
      gap = 18; cardH = 120;
    }
    const totalH = cardH * 3 + gap * 2;
    const startX = (W - cardW) / 2;
    const startY = (H - totalH) / 2;
    return [0, 1, 2].map(i => ({
      x: startX,
      y: startY + i * (cardH + gap),
      w: cardW,
      h: cardH,
    }));
  }

  draw(ctx, canvas) {
    if (!this.active) return;

    const W = canvas.width, H = canvas.height;
    const landscape = H < 500;
    const narrow    = W < 600;
    const compact   = landscape || narrow;

    ctx.fillStyle = 'rgba(13,14,18,0.85)';
    ctx.fillRect(0, 0, W, H);

    const layout = this._cardLayouts(W, H);
    const headerGap = landscape ? 20 : narrow ? 36 : 50;
    const headerY = layout[0].y - headerGap;

    // Header — wave context banner
    ctx.textAlign = 'center';
    const wc = this.waveContext;
    if (wc && !landscape) {
      if (wc.type === 'early') {
        ctx.fillStyle = '#8dff6a';
        ctx.font      = `bold ${compact ? 11 : 14}px monospace`;
        ctx.fillText(
          wc.bonusPts > 0
            ? `WAVE CLEARED  ·  +${wc.bonusPts} BONUS PTS`
            : 'WAVE CLEARED',
          W / 2, headerY - (narrow ? 30 : 46)
        );
      } else {
        ctx.fillStyle = '#fd6c1d';
        ctx.font      = `bold ${compact ? 11 : 14}px monospace`;
        ctx.fillText(
          "TIME'S UP  ·  NEXT WAVE INCOMING  ·  NO BONUS",
          W / 2, headerY - (narrow ? 30 : 46)
        );
      }
    }
    ctx.fillStyle = 'rgba(180,190,210,0.5)';
    ctx.font      = `${compact ? 11 : 15}px monospace`;
    if (!landscape) {
      ctx.fillText('— SIGNAL RESONANCE —', W / 2, headerY - (narrow ? 14 : 24));
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font      = `bold ${compact ? 18 : 28}px monospace`;
    ctx.fillText('SELECT UPGRADE', W / 2, headerY);

    for (let i = 0; i < this.cards.length; i++) {
      const card            = this.cards[i];
      const { x, y, w, h } = layout[i];
      const isHovered       = i === this.hovered;
      const classColor      = card.class ? CLASS_COLORS[card.class] : null;
      const tierLabel       = card.tier ? `T${card.tier}` : null;
      const isClass         = !!card.class;

      // Card background — class cards get a subtle tint
      ctx.fillStyle = isHovered
        ? (classColor ? classColor + '18' : '#1E2130')
        : (isClass    ? classColor + '0C' : '#13151C');
      drawRoundedRect(ctx, x, y, w, h, 6);
      ctx.fill();

      // Card border — class cards always show their color, not dimmed
      ctx.strokeStyle = isHovered
        ? (classColor || '#6A70A0')
        : (classColor ? classColor + 'AA' : '#3A3E52');
      ctx.lineWidth = isHovered ? 2 : 1.5;
      if (classColor) {
        ctx.shadowBlur  = isHovered ? 16 : 6;
        ctx.shadowColor = classColor;
      }
      drawRoundedRect(ctx, x, y, w, h, 6);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Color accent bar on left edge for class cards
      if (isClass) {
        ctx.fillStyle   = classColor + (isHovered ? 'FF' : 'CC');
        ctx.shadowBlur  = isHovered ? 10 : 4;
        ctx.shadowColor = classColor;
        ctx.beginPath();
        ctx.roundRect(x, y + 6, 3, h - 12, 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      const nameFontSize = compact ? 13 : 20;
      const descFontSize = compact ? 11 : 16;
      const tagFontSize  = compact ? 9  : 12;
      const numFontSize  = compact ? 10 : 13;
      const nameY        = landscape ? y + 18 : narrow ? y + 24 : y + 32;
      const divY         = landscape ? y + 25 : narrow ? y + 32 : y + 44;
      const descY        = landscape ? y + 40 : narrow ? y + 52 : y + 68;

      // Class + tier tag (top-right) — bright, readable
      if (card.class) {
        const tag = tierLabel ? `${card.class.toUpperCase()}  ${tierLabel}` : card.class.toUpperCase();
        ctx.fillStyle   = classColor;
        ctx.font        = `bold ${tagFontSize}px monospace`;
        ctx.textAlign   = 'right';
        ctx.shadowBlur  = 6;
        ctx.shadowColor = classColor;
        ctx.fillText(tag, x + w - 12, y + (landscape ? 12 : 16));
        ctx.shadowBlur  = 0;
      }

      // Number key hint — slightly brighter
      ctx.fillStyle = 'rgba(180,190,210,0.5)';
      ctx.font      = `${numFontSize}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(`[${i + 1}]`, x + 12, nameY);

      // Upgrade name — always white, class cards get glow on hover
      ctx.fillStyle = '#FFFFFF';
      ctx.font      = `bold ${nameFontSize}px monospace`;
      if (isHovered && classColor) {
        ctx.shadowBlur  = 10;
        ctx.shadowColor = classColor;
      }
      ctx.fillText(card.name, x + 36, nameY);
      ctx.shadowBlur = 0;

      // Divider line — slightly more visible
      ctx.strokeStyle = classColor ? classColor + '33' : '#2A2E42';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(x + 36, divY);
      ctx.lineTo(x + w - 14, divY);
      ctx.stroke();

      // Description — bright white, no more grey
      ctx.fillStyle = isClass ? '#E8EAF0' : '#C8CCD8';
      ctx.font      = `${descFontSize}px monospace`;
      ctx.textAlign = 'left';
      const maxDescW = w - 52;
      let desc = card.desc;
      while (desc.length > 0 && ctx.measureText(desc).width > maxDescW) {
        desc = desc.slice(0, -1);
      }
      ctx.fillText(desc, x + 36, descY);
    }

    // Footer hint — slightly brighter
    ctx.fillStyle = 'rgba(180,190,210,0.6)';
    ctx.font      = `${compact ? 11 : 15}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(compact ? 'tap a card' : 'click or press 1 / 2 / 3', W / 2, layout[2].y + layout[2].h + (landscape ? 14 : 22));
    ctx.textAlign = 'left';
  }
}
