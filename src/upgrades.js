// CHROMATIC DECAY — Upgrade System

import { CONFIG } from './config.js';
import { drawSlab, dimBackdrop } from './ui3d.js';
import { hasCard } from './profile.js';

function _wrap(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

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
    desc: '+10 max HP.',
    baseWeight: 7, cap: 5,
    apply: p => { p.maxHp += 10; p.hp = Math.min(p.hp + 10, p.maxHp); },
  },
  {
    id: 'multicast', name: 'Multicast',
    desc: p => p.character === 'dex' ? '+1 round per burst.' : p.character === 'juno' ? 'Minigun fires 25% faster.' : '+1 projectile.',
    baseWeight: 3, cap: 3,
    apply: p => { p.projCount += 1; },
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
    id: 'emergency_cache', name: 'Triage Protocol',
    desc: p => `Heal 1 HP per ${p.killHealEvery > 0 ? p.killHealEvery - 1 : 6} kills.`,
    baseWeight: 4, cap: 3,
    apply: p => { p.killHealEvery = p.killHealEvery > 0 ? p.killHealEvery - 1 : 6; p.killHealCounter = 0; },
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

// ── Story cards ───────────────────────────────────────────────
// Earned in Story by one character (opening Level 1's door the first time as
// them). In Arcade every earned card is in one shared deck that either
// character can draft — a card does exactly what it says, whoever takes it.
// active: an activated ability; a run holds at most two (E, then F).
const STORY_COLOR = { dex: '#B6FF2E', juno: '#E58CFF', raze: '#FFD15C' };
export const STORY_CARDS = [
  { id: 'heavy_bursts', who: 'dex',  name: 'Heavy Bursts', desc: '+1 round per burst, +15% damage.', baseWeight: 5, cap: 1,
    apply: p => { p.projCount += 1; p.damageMultiplier *= 1.15; } },
  { id: 'hot_barrel',   who: 'juno', name: 'Hot Barrel',   desc: 'Minigun fires 25% faster.',        baseWeight: 5, cap: 1,
    apply: p => { p.projCount += 1; } },
  { id: 'shock_dash', who: 'dex', name: 'Shock Dash', desc: 'Chromatics you dash through are stunned and take 50% more damage.', baseWeight: 5, cap: 1,
    apply: p => { p.shockDash = true; } },
  { id: 'parting_charge', who: 'juno', name: 'Parting Charge', desc: 'Dashing leaves a light bomb where you started; it bursts a moment later.', baseWeight: 5, cap: 1,
    apply: p => { p.dashBomb = true; } },
  // Level 4's trick shots
  { id: 'arc_round', who: 'dex', name: 'Arc Round', desc: 'The last round of every burst jumps to another enemy close by.', baseWeight: 5, cap: 1,
    apply: p => { p.arcRound = true; } },
  { id: 'ricochet', who: 'juno', name: 'Ricochet', desc: 'Rounds bounce once off racks.', baseWeight: 5, cap: 1,
    apply: p => { p.rackBounce = (p.rackBounce || 0) + 1; } },
  // Level 3's thrown abilities
  { id: 'decoy_beacon', who: 'juno', active: true, name: 'Decoy Beacon', desc: 'Activated: throw a beacon that pulls nearby Chromatics to it for 3 s.', baseWeight: 5, cap: 1,
    apply: p => { p.decoy = true; p.abilities.push('decoy'); } },
  { id: 'stun_grenade', who: 'dex', active: true, name: 'Stun Grenade', desc: 'Activated: lob a grenade that stuns and jams enemies.', baseWeight: 5, cap: 1,
    apply: p => { p.grenade = true; p.abilities.push('grenade'); } },
];

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
    this.waveContext    = null;   // { type: 'early'|'timeout', bonusPts, secondsRemaining, bonusLevels }
    this.isBonusUpgrade = false;  // true when this selection was earned via bonus bank
  }

  setSystems(companions, traps) {
    this._companions = companions;
    this._traps      = traps;
  }

  // unlockedClasses: array of class id strings that have fragments collected
  present(player, unlockedClasses = []) {
    const archiveState = this._archiveState(unlockedClasses);
    const classSkills  = this._buildClassPool(unlockedClasses);
    this._who       = player.character;
    this._abilities = (player.abilities || []).length;
    this.cards = this._generateOffer(classSkills, archiveState);
    // Resolve any dynamic descriptions now that we have the player
    for (const card of this.cards) {
      if (typeof card.desc === 'function') card.desc = card.desc(player);
    }
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
    // Every Story card any character has earned, minus taken ones; activated
    // abilities stop appearing once both slots (E, F) are full
    const story = STORY_CARDS.filter(c => hasCard(c.who, c.id) && (this.takenCounts[c.id] || 0) < c.cap &&
                                          !(c.active && this._abilities >= 2));
    const available = [...GENERIC_UPGRADES.filter(u => (this.takenCounts[u.id] || 0) < u.cap), ...story];
    const weighted  = available.map(u => ({
      ...u,
      currentWeight: u.baseWeight * Math.pow(0.5, this.takenCounts[u.id] || 0),
    }));

    const unlocked  = Object.values(archiveState).filter(Boolean).length;
    const classRatio = unlocked <= 2 ? 0.33 : 0.66;

    const offer = [];
    let  guard  = 0;

    // The run's first level-up always shows a Story card, if any are earned
    if (this.takenIds.length === 0 && story.length) {
      offer.push(story[Math.floor(Math.random() * story.length)]);
    }

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

  // Header lines above the cards, top to bottom: [text, colour, font px, bold, glow]
  _headerLines(W, H) {
    const landscape = H < 500, narrow = W < 600, compact = landscape || narrow;
    const big = compact ? 13 : 18, small = compact ? 11 : 14;
    const lines = [];
    const wc = this.waveContext;
    if (!landscape) {
      if (this.isBonusUpgrade) {
        lines.push(['★  BONUS UPGRADE  ★', '#E8C86A', big, true, '#fff5c2']);
        lines.push(['EARNED FROM EARLY CLEAR  ·  KEEP CLEARING FAST', '#fff5c2', small, false, null]);
      } else if (wc) {
        if (wc.type === 'early') {
          lines.push([wc.bonusPts > 0 ? `WAVE CLEARED  ·  +${wc.bonusPts} BONUS PTS` : 'WAVE CLEARED', '#8dff6a', big, true, '#8dff6a']);
        } else {
          lines.push(["TIME'S UP  ·  NEXT WAVE INCOMING", '#fd6c1d', big, true, null]);
          if (!wc.noDamageBonus) lines.push(['NO BONUS — CLEAR FASTER TO EARN EXTRA UPGRADES', '#A0A4B0', small, false, null]);
        }
        if (wc.noDamageBonus > 0) lines.push([`✦ NO DAMAGE  ·  +${wc.noDamageBonus} PTS`, '#5de8e8', small, true, '#5de8e8']);
      }
      lines.push(['— SIGNAL RESONANCE —', 'rgba(180,190,210,0.5)', compact ? 11 : 14, false, null]);
    }
    lines.push(['SELECT UPGRADE', '#FFFFFF', compact ? 18 : 28, true, '#00E5FF']);
    return lines;
  }

  _headerHeight(W, H) {
    return this._headerLines(W, H).reduce((sum, l) => sum + Math.round(l[2] * 1.45), 0);
  }

  _cardLayouts(W, H) {
    const landscape = H < 500;   // phone in landscape — lay cards side by side
    const narrow    = W < 600;   // phone in portrait
    const depth     = 8;         // slab front face below each card
    const headerH   = this._headerHeight(W, H);

    if (landscape) {
      // 3 cards side by side — cap height so they don't fill the whole screen
      const gap     = 8;
      const cardW   = Math.floor((W - gap * 4) / 3);
      const cardH   = Math.min(H - headerH - depth - 60, 150);
      const startY  = Math.max(headerH + 12, (H - (headerH + 12 + cardH + depth + 26)) / 2 + headerH + 12);
      return [0, 1, 2].map(i => ({ x: gap + i * (cardW + gap), y: startY, w: cardW, h: cardH }));
    }

    // Header + cards + footer hint are centred as one block, and never run
    // off the top of the screen (cards shrink to fit if they must)
    const cardW  = Math.min(500, W * 0.92);
    const gap    = (narrow ? 10 : 18) + depth;
    const footer = 30, top = 14, headGap = 14;
    let cardH    = narrow ? 100 : 120;
    const room   = H - top - headerH - headGap - footer - gap * 2 - depth;
    cardH = Math.max(70, Math.min(cardH, Math.floor(room / 3)));
    const totalH = headerH + headGap + cardH * 3 + gap * 2 + depth + footer;
    const blockY = Math.max(top, (H - totalH) / 2);
    const startY = blockY + headerH + headGap;
    const startX = (W - cardW) / 2;
    return [0, 1, 2].map(i => ({ x: startX, y: startY + i * (cardH + gap), w: cardW, h: cardH }));
  }

  draw(ctx, canvas) {
    if (!this.active) return;

    const W = canvas.width, H = canvas.height;
    const landscape = H < 500;
    const narrow    = W < 600;
    const compact   = landscape || narrow;

    dimBackdrop(ctx, W, H, 0.9);

    const layout = this._cardLayouts(W, H);

    // ── Header, stacked upward from just above the first card ──
    ctx.textAlign = 'center';
    const lines = this._headerLines(W, H);
    let ly = layout[0].y - 14 - this._headerHeight(W, H);
    for (const [text, color, px, bold, glow] of lines) {
      ly += Math.round(px * 1.45);
      ctx.fillStyle = color;
      ctx.font      = `${bold ? 'bold ' : ''}${px}px monospace`;
      if (glow) { ctx.shadowBlur = 8; ctx.shadowColor = glow; }
      ctx.fillText(text, W / 2, ly - Math.round(px * 0.3));
      ctx.shadowBlur = 0;
    }

    // ── Cards — raised rack-style slabs; the hovered one rises ──
    for (let i = 0; i < this.cards.length; i++) {
      const card            = this.cards[i];
      const { x, y: y0, w, h } = layout[i];
      const isHovered       = i === this.hovered;
      const classColor      = card.class ? CLASS_COLORS[card.class] : (card.who ? STORY_COLOR[card.who] : null);
      const tierLabel       = card.tier ? `T${card.tier}` : null;
      const isClass         = !!card.class;

      const y = drawSlab(ctx, x, y0, w, h, {
        accent: classColor || '#00E5FF',
        depth:  8,
        lift:   isHovered ? 1 : 0,
        glow:   isHovered ? 0.7 : (isClass ? 0.25 : 0),
      });

      const nameFontSize = compact ? 13 : 20;
      const descFontSize = compact ? 11 : 16;
      const tagFontSize  = compact ? 9  : 12;
      const numFontSize  = compact ? 10 : 13;
      // Class tag sits on its own line above the name, so they never collide
      const nameY        = landscape ? y + 30 : narrow ? y + 30 : y + 34;
      const divY         = landscape ? y + 38 : narrow ? y + 38 : y + 46;
      const descY        = landscape ? y + 54 : narrow ? y + 56 : y + 70;

      // Class + tier tag (top-right); Story cards say whose they were
      if (card.class || card.who) {
        const tag = card.who ? `STORY · ${card.who.toUpperCase()}`
                  : tierLabel ? `${card.class.toUpperCase()}  ${tierLabel}` : card.class.toUpperCase();
        ctx.fillStyle   = classColor;
        ctx.font        = `bold ${tagFontSize}px monospace`;
        ctx.textAlign   = 'right';
        ctx.shadowBlur  = 6;
        ctx.shadowColor = classColor;
        ctx.fillText(tag, x + w - 12, y + (compact ? 14 : 16));
        ctx.shadowBlur  = 0;
      }

      // Number key hint
      ctx.fillStyle = 'rgba(180,200,215,0.55)';
      ctx.font      = `${numFontSize}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(`[${i + 1}]`, x + 12, nameY);

      // Upgrade name
      ctx.fillStyle = '#FFFFFF';
      let nfs = nameFontSize;
      do { ctx.font = `bold ${nfs}px monospace`; } while (ctx.measureText(card.name).width > w - 48 && --nfs > 9);
      if (isHovered) {
        ctx.shadowBlur  = 10;
        ctx.shadowColor = classColor || '#00E5FF';
      }
      ctx.fillText(card.name, x + 36, nameY);
      ctx.shadowBlur = 0;

      // Divider
      ctx.strokeStyle = classColor ? classColor + '33' : 'rgba(0,229,255,0.18)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(x + 36, divY);
      ctx.lineTo(x + w - 14, divY);
      ctx.stroke();

      // Description — wraps, and steps down a size if it needs more lines
      // than the card has room for (never cut off mid-word)
      ctx.fillStyle = isClass ? '#E8EAF0' : '#C8D4DC';
      ctx.textAlign = 'left';
      const maxDescW = w - 50;
      const room     = y + h - 12 - descY;
      let fs = descFontSize, lines, lh;
      for (;;) {
        ctx.font = `${fs}px monospace`;
        lh = Math.round(fs * 1.3);
        lines = _wrap(ctx, card.desc, maxDescW);
        if ((lines.length - 1) * lh <= room || fs <= 9) break;
        fs--;
      }
      lines.forEach((line, li) => ctx.fillText(line, x + 36, descY + li * lh));
    }

    // Footer hint
    ctx.fillStyle = 'rgba(180,190,210,0.6)';
    ctx.font      = `${compact ? 11 : 15}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(compact ? 'tap a card' : 'click or press 1 / 2 / 3', W / 2, layout[2].y + layout[2].h + 8 + (landscape ? 14 : 22));
    ctx.textAlign = 'left';
  }
}
