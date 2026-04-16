// CHROMATIC DECAY — Player

import { CONFIG } from './config.js';
import { clamp, normalize, angle, circleVsRect, dist } from './utils.js';

// Class emergence thresholds
const EMERGE_THRESHOLD   = 4;   // traits from one class → full emergence
const SUBCLASS_THRESHOLD = 3;   // two classes both at 3+ → subclass

// Class visual data
const CLASS_DATA = {
  warden:  { color: '#eafae4', label: 'WARDEN',  abilityName: 'Barrier Pulse' },
  breaker: { color: '#fff5c2', label: 'BREAKER', abilityName: 'Overload Burst' },
  ghost:   { color: '#ffe0f0', label: 'GHOST',   abilityName: 'Phase Shift' },
  weaver:  { color: '#d6faf7', label: 'WEAVER',  abilityName: 'Deploy Trap' },
  herald:  { color: '#fddede', label: 'HERALD',  abilityName: 'Summon Orb' },
};

const SUBCLASS_DATA = {
  bulwark:   { color: '#d4f0cc', label: 'BULWARK',   classes: ['warden',  'breaker'] },
  phantom:   { color: '#ffe8d0', label: 'PHANTOM',   classes: ['breaker', 'ghost']   },
  drifter:   { color: '#ffdcf8', label: 'DRIFTER',   classes: ['ghost',   'weaver']  },
  architect: { color: '#cceef0', label: 'ARCHITECT', classes: ['weaver',  'herald']  },
  sentinel:  { color: '#f0e8dd', label: 'SENTINEL',  classes: ['herald',  'warden']  },
};

// Per-class ability cooldowns (seconds)
const ABILITY_COOLDOWNS = {
  warden:  12,
  breaker: 16,
  ghost:   6,
  weaver:  10,
  herald:  14,
};

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.facing = 0;

    // ── Base stats ───────────────────────────────────────────
    this.maxHp        = CONFIG.player_base_hp;
    this.hp           = this.maxHp;
    this.damage       = CONFIG.player_base_damage;
    this.fireRate     = CONFIG.player_base_fire_rate;
    this.moveSpeed    = CONFIG.player_move_speed;
    this.projSpeed    = CONFIG.player_projectile_speed;
    this.projRange    = CONFIG.player_projectile_range;
    this.pickupRadius = CONFIG.player_pickup_radius;
    this.projCount    = 1;
    this.projSpread   = 0.12;

    // ── Upgrade-modified stats ───────────────────────────────
    this.damageMultiplier    = 1.0;
    this.fireRateMultiplier  = 1.0;
    this.speedMultiplier     = 1.0;
    this.damageReduction     = 0;       // 0–0.6 fraction
    this.invincibilityBonus  = 0;       // extra seconds
    this.piercingShots       = 0;
    this.fireSlowImmune      = false;
    this.contactDamageReduction = 0;

    // ── Shield (Warden) ──────────────────────────────────────
    this.shield      = 0;
    this.shieldRegen = 0;   // HP/sec

    // ── Class state ──────────────────────────────────────────
    this.classId         = null;    // primary emerged class
    this.subclassId      = null;
    this.glowColor       = '#FFFFFF';
    this.classLabel      = null;
    this.classTraits     = {};      // trait id → true
    this.classTakenCounts = {};     // class id → count of traits taken

    // ── Ability ──────────────────────────────────────────────
    this.abilityCooldown          = 0;   // seconds remaining
    this.abilityCooldownMax       = 0;
    this.abilityCooldownMultiplier = 1.0;
    this.abilityOrbCount          = 1;   // Herald: orbs per ability use

    // ── Trait flags — general ────────────────────────────────
    this.killPulse           = false;
    this.chainReaction       = false;
    this.chainBonus          = 0;
    this.chainTimer          = 0;
    this.volatileResidual    = false;
    this.volatileTimer       = 0;
    this.volatileStack       = 0;
    this.berserker           = false;
    this.cascade             = false;
    this.cascadeKilledThisSec = false;
    this.cascadeTimer        = 0;
    this.driftDamage         = false;
    this.signalFade          = false;
    this.evasionEcho         = false;
    this.evasionTimer        = 0;
    this.damageTrail         = false;
    this.stealthRange        = 0;
    this.projectileBounce    = false;
    this.momentumPickup      = false;
    this.afterimage          = false;
    this.lastStand           = false;
    this._lastStandUsed      = false;
    this.overwatchBonus      = 0;
    this.echoHealBonus       = 0;
    this.echoSpawnOrb        = false;
    this.killHealChance      = 0;
    this.burstBuffer         = 0;

    // ── Breaker T1/T2/T3 runtime state ───────────────────────
    // T1: Volatile Signal — flag only (damage calc in enemies.checkProjectileHits)
    this.volatileSignal      = false;

    // T1: Overclock — doubles fire rate for 4s on taking damage, 12s cooldown
    this.overclock           = false;
    this.overclockActive     = false;
    this.overclockTimer      = 0;    // seconds remaining on overclock buff
    this.overclockCooldown   = 0;    // seconds until can trigger again

    // T1: Short Squeeze — flag only (slow applied in enemies.checkProjectileHits)
    this.shortSqueeze        = false;

    // T2: Cascade Protocol — kill chain pulse AoE
    this.cascadeProtocol     = false;
    this._lastKillTime       = -99;  // game elapsed at last kill

    // T2: Margin Call — 5 kills in 6s → 3s invincibility
    this.marginCall          = false;
    this._marginKillTimes    = [];   // array of elapsed timestamps

    // T2: Leveraged Position — damage scales with low HP, up to +60% at 10%
    this.leveragedPosition   = false;

    // T2: Algorithmic Aggression — consecutive kills without damage → +5% damage, max +50%
    this.algorithmicAggression = false;
    this.algoKillStreak      = 0;
    this.algoBonus           = 0;    // current fraction bonus (0–0.5)

    // T3: Frequency Shatter — flag only (handled in game.js kill loop)
    this.frequencyShatter    = false;

    // T3: Flash Crash — every 10th shot deals 400% damage
    this.flashCrash          = false;
    this.flashCrashCounter   = 0;   // counts shots; resets after hit

    // T3: Circuit Breaker — once per run stun on ability use
    this.circuitBreaker      = false;
    this.circuitBreakerUsed  = false;
    this._circuitBreakerActivated = false;  // signal to game.js

    // ── Generic upgrade bonuses ───────────────────────────────
    this.residualBonus       = 0;   // Scavenger: +% to residual drops

    // ── State ────────────────────────────────────────────────
    this.firing      = false;
    this.fireTimer   = 0;
    this.alive       = true;
    this.invincible  = 0;
    this.flashTimer  = 0;
    this.justFired   = false;   // audio hook: true for one frame when a shot fires
    this.justHit     = false;   // audio hook: true for one frame when damage taken

    // ── Run stats ────────────────────────────────────────────
    this.kills         = 0;
    this.echoesRescued = 0;
    this.upgradesTaken = 0;
    this.fragmentsFound = 0;

    // ── Ghost class: alpha transparency ─────────────────────
    this._drawAlpha = 1.0;

    // ── Movement trail ───────────────────────────────────────
    this._trail = [];

    // ── Systems back-ref (set by game.js) ───────────────────
    this._companions = null;
    this._traps      = null;
    this._particles  = null;
  }

  setSystems(companions, traps, particles) {
    this._companions = companions;
    this._traps      = traps;
    this._particles  = particles;
  }

  get size() { return CONFIG.player_size; }

  get effectiveSpeed() {
    const slow = (this.firing && !this.fireSlowImmune) ? CONFIG.player_fire_slow_multiplier : 1.0;
    let spd = this.moveSpeed * this.speedMultiplier * slow;
    if (this.evasionTimer > 0) spd *= 1.6;
    return spd;
  }

  get effectiveFireRate() {
    let rate = this.fireRate * this.fireRateMultiplier;
    // Overclock: doubles fire rate while active
    if (this.overclockActive) rate *= 2;
    return rate;
  }

  get effectiveDamage() {
    const base = this.damage * this.damageMultiplier;
    let d = base;

    // Berserker: double at low HP (legacy Phase 2 trait, kept for compatibility)
    if (this.berserker && this.hp / this.maxHp < 0.25) d *= 2;

    // Chain reaction bonus (legacy)
    if (this.chainReaction && this.chainTimer > 0) d *= 1 + this.chainBonus;

    // Volatile residual bonus (legacy)
    if (this.volatileResidual && this.volatileTimer > 0) d *= 1 + this.volatileStack * 0.05;

    // Drift damage: +1% per 10px/s above base speed
    if (this.driftDamage) {
      const speedAboveBase = Math.max(0, this.effectiveSpeed - CONFIG.player_move_speed);
      d *= 1 + speedAboveBase * 0.001;
    }

    // Breaker T2: Leveraged Position — up to +60% at 10% HP (additive off base)
    if (this.leveragedPosition) {
      const hpRatio    = this.hp / this.maxHp;
      const lpFraction = Math.max(0, Math.min(0.60, (1 - hpRatio) * (0.60 / 0.90)));
      d += base * lpFraction;
    }

    // Breaker T2: Algorithmic Aggression — +5% per consecutive kill, max +50% (additive off base)
    if (this.algorithmicAggression && this.algoBonus > 0) {
      d += base * this.algoBonus;
    }

    // Overwatch: extra damage to enemies in traps
    // (actual check done in game.js since we need enemy position)

    return d;
  }

  update(dt, input, map, camera, zoom, projectileSystem) {
    if (!this.alive) return;

    // ── Timers ───────────────────────────────────────────────
    this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    this.chainTimer      = Math.max(0, this.chainTimer - dt);
    this.volatileTimer   = Math.max(0, this.volatileTimer - dt);
    if (this.volatileTimer <= 0) this.volatileStack = 0;
    this.evasionTimer    = Math.max(0, this.evasionTimer - dt);

    // Cascade reset
    this.cascadeTimer = Math.max(0, this.cascadeTimer - dt);
    if (this.cascadeTimer <= 0) { this.cascadeKilledThisSec = false; this.cascadeTimer = 1; }

    // Overclock timers
    if (this.overclock) {
      this.overclockCooldown = Math.max(0, this.overclockCooldown - dt);
      if (this.overclockTimer > 0) {
        this.overclockTimer  -= dt;
        this.overclockActive  = true;
        if (this.overclockTimer <= 0) {
          this.overclockActive = false;
          this.overclockTimer  = 0;
        }
      }
    }

    // Shield regen
    if (this.shieldRegen > 0) {
      this.shield = Math.min((this.shield || 0) + this.shieldRegen * dt, 80);
    }

    // ── Movement — keyboard or touch joystick ────────────────
    let dx = 0, dy = 0;
    if (input.touchMoveX !== 0 || input.touchMoveY !== 0) {
      dx = input.touchMoveX;
      dy = input.touchMoveY;
    } else {
      if (input.keys.w) dy -= 1;
      if (input.keys.s) dy += 1;
      if (input.keys.a) dx -= 1;
      if (input.keys.d) dx += 1;
    }

    const dir = normalize(dx, dy);
    const spd = this.effectiveSpeed;
    let nx = this.x + dir.x * spd * dt;
    let ny = this.y + dir.y * spd * dt;

    // Pickup radius scales with speed (Ghost: Momentum Feed)
    if (this.momentumPickup) {
      this.pickupRadius = CONFIG.player_pickup_radius + (spd / CONFIG.player_move_speed) * 20;
    }

    // Obstacle collision
    const r = this.size / 2;
    for (const obs of map.obstacles) {
      const hit = circleVsRect(nx, ny, r + 1, obs.x, obs.y, obs.w, obs.h);
      if (hit) { nx += hit.nx * hit.depth; ny += hit.ny * hit.depth; }
    }

    this.x = clamp(nx, r, CONFIG.map_width  - r);
    this.y = clamp(ny, r, CONFIG.map_height - r);

    // Record trail position (cap at 8 points)
    this._trail.push({ x: this.x, y: this.y });
    if (this._trail.length > 14) this._trail.shift();

    // ── Facing — right joystick overrides mouse ──────────────
    if (input.touchAimAngle !== null) {
      this.facing = input.touchAimAngle;
    } else {
      const mouse = input.worldMouse(camera.x, camera.y, zoom);
      this.facing = angle(this.x, this.y, mouse.x, mouse.y);
    }

    // ── Shooting — always fires toward cursor ────────────────
    this.firing    = true;
    this.justFired = false;
    this.fireTimer -= dt;

    if (this.fireTimer <= 0) {
      this._shoot(projectileSystem);
      this.fireTimer = 1 / this.effectiveFireRate;
      this.justFired = true;
    }

    // ── Ability ──────────────────────────────────────────────
    if (input.abilityJustPressed && this.abilityCooldown <= 0 && this.classId) {
      this._useAbility();
    }

    // ── Invincibility flash ──────────────────────────────────
    if (this.invincible > 0) {
      this.invincible -= dt;
      this.flashTimer += dt;
    } else {
      this.flashTimer = 0;
    }

    // ── Ghost transparency target ────────────────────────────
    const targetAlpha = this.classId === 'ghost' ? 0.65 : 1.0;
    this._drawAlpha += (targetAlpha - this._drawAlpha) * Math.min(1, dt * 4);
  }

  _shoot(projectileSystem) {
    // Flash Crash: every 10th shot deals 400% damage
    let flashMultiplier = 1;
    if (this.flashCrash) {
      this.flashCrashCounter++;
      if (this.flashCrashCounter >= 10) {
        flashMultiplier        = 4;
        this.flashCrashCounter = 0;
      }
    }

    const half   = Math.floor(this.projCount / 2);
    const damage = this.effectiveDamage * flashMultiplier;

    for (let i = 0; i < this.projCount; i++) {
      const offset = this.projCount === 1 ? 0 : (i - half) * this.projSpread;
      const a = this.facing + offset;
      projectileSystem.spawnPlayer(
        this.x, this.y, a,
        damage,
        this.projSpeed,
        this.projRange,
        this.piercingShots,
        this.projectileBounce,
      );
    }
  }

  _useAbility() {
    if (!this.classId) return;

    const cd = (ABILITY_COOLDOWNS[this.classId] || 10) * (this.abilityCooldownMultiplier || 1.0);
    this.abilityCooldown    = cd;
    this.abilityCooldownMax = cd;

    switch (this.classId) {

      case 'warden': {
        // Barrier Pulse — restore 20 shield and emit a damage pulse
        this.shield = Math.min((this.shield || 0) + 20, 80);
        if (this._particles) this._particles.classEmergence(this.x, this.y, CLASS_DATA.warden.color);
        break;
      }

      case 'breaker': {
        // Overload Burst — 3× damage for next 3 shots (flag)
        this.overloadBurst = 3;
        if (this._particles) this._particles.classEmergence(this.x, this.y, CLASS_DATA.breaker.color);

        // Circuit Breaker — stun all non-boss enemies once per run
        if (this.circuitBreaker && !this.circuitBreakerUsed) {
          this.circuitBreakerUsed       = true;
          this._circuitBreakerActivated = true;  // game.js reads and clears this
        }
        break;
      }

      case 'ghost': {
        // Phase Shift — sprint at 2× speed for 1.5s + invincibility
        this.evasionTimer = 1.5;
        this.invincible   = 1.5;
        if (this.afterimage && this._particles) {
          this._particles.classEmergence(this.x, this.y, CLASS_DATA.ghost.color);
        }
        break;
      }

      case 'weaver': {
        // Deploy Trap — place a trap at current position
        if (this._traps) this._traps.place(this.x, this.y);
        if (this._particles) this._particles.classEmergence(this.x, this.y, CLASS_DATA.weaver.color);
        break;
      }

      case 'herald': {
        // Summon Orb — spawn orb(s)
        const count = this.abilityOrbCount || 1;
        if (this._companions) {
          for (let i = 0; i < count; i++) this._companions.addOrb(this);
        }
        if (this._particles) this._particles.classEmergence(this.x, this.y, CLASS_DATA.herald.color);
        break;
      }
    }
  }

  // Called by game.js when player kills an enemy.
  // elapsed = current run time in seconds (used for time-based kill tracking).
  onKill(enemyX, enemyY, projectileSystem, particles, elapsed) {
    this.kills++;

    // Kill pulse (legacy Breaker trait)
    if (this.killPulse && projectileSystem) {
      // Signal via returned flag — game.js handles the AoE
    }

    // Chain reaction (legacy)
    if (this.chainReaction) {
      this.chainBonus = Math.min(0.50, (this.chainBonus || 0) + 0.05);
      this.chainTimer = 3;
    }

    // Cascade: reset fire timer on first kill each second (legacy)
    if (this.cascade && !this.cascadeKilledThisSec) {
      this.fireTimer = 0;
      this.cascadeKilledThisSec = true;
    }

    // Kill heal chance (Warden)
    if (this.killHealChance > 0 && Math.random() < this.killHealChance) {
      this.heal(3);
    }

    // Companion kill extend
    if (this._companions) this._companions.notifyKill(enemyX, enemyY);

    // ── Breaker T2/T3 kill effects ────────────────────────────

    // Cascade Protocol: kill within 2s of last kill → signal AoE
    let cascadeTriggered = false;
    if (this.cascadeProtocol) {
      const t = elapsed || 0;
      if (t - this._lastKillTime < 2.0) cascadeTriggered = true;
      this._lastKillTime = t;
    }

    // Margin Call: 5 kills in 6s → 3s invincibility
    if (this.marginCall) {
      const t = elapsed || 0;
      this._marginKillTimes.push(t);
      this._marginKillTimes = this._marginKillTimes.filter(kt => t - kt <= 6.0);
      if (this._marginKillTimes.length >= 5) {
        this.invincible = Math.max(this.invincible, 3.0);
        this._marginKillTimes = [];  // reset window
        if (particles) particles.classEmergence(enemyX, enemyY, CLASS_DATA.breaker.color);
      }
    }

    // Algorithmic Aggression: consecutive kills add +5% damage (max +50%)
    if (this.algorithmicAggression) {
      this.algoKillStreak++;
      this.algoBonus = Math.min(0.50, this.algoKillStreak * 0.05);
    }

    return { killPulse: this.killPulse, cascadeTriggered, cascadeX: enemyX, cascadeY: enemyY };
  }

  // Called by game.js when a residual is collected
  onResidualCollect() {
    if (this.volatileResidual) {
      this.volatileStack = Math.min(10, (this.volatileStack || 0) + 1);
      this.volatileTimer = 5;
    }
  }

  // Called by game.js when an Echo is rescued
  onEchoRescue() {
    this.echoesRescued++;
    if (this.echoHealBonus > 0) this.heal(this.echoHealBonus);
    if (this.echoSpawnOrb && this._companions) this._companions.addOrb(this);
  }

  takeDamage(rawAmount) {
    if (!this.alive || this.invincible > 0) return false;

    let amount = rawAmount;

    // Damage reduction
    if (this.damageReduction > 0) amount *= (1 - this.damageReduction);

    // Shield absorbs first
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
    }

    this.hp = Math.max(0, this.hp - amount);

    // Last Stand
    if (this.hp <= 0 && this.lastStand && !this._lastStandUsed) {
      this.hp = 1;
      this._lastStandUsed = true;
    }

    const totalInvincibility = 0.6 + (this.invincibilityBonus || 0);
    this.invincible = totalInvincibility;

    // Evasion Echo (Ghost)
    if (this.evasionEcho) this.evasionTimer = 1.2;

    if (this.hp <= 0) this.alive = false;

    // Overclock: taking damage doubles fire rate for 4s (12s cooldown)
    if (this.overclock && this.overclockCooldown <= 0) {
      this.overclockActive   = true;
      this.overclockTimer    = 4.0;
      this.overclockCooldown = 12.0;
    }

    // Algorithmic Aggression: reset kill streak on hit
    if (this.algorithmicAggression) {
      this.algoKillStreak = 0;
      this.algoBonus      = 0;
    }

    this.justHit = true;
    return true;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  // ── Class detection ──────────────────────────────────────────

  // Call this after applying any trait. Returns event info if emergence occurred.
  checkClassEmergence() {
    const counts = this.classTakenCounts || {};

    // Full emergence
    for (const [cls, count] of Object.entries(counts)) {
      if (count >= EMERGE_THRESHOLD && this.classId !== cls) {
        this.classId    = cls;
        this.glowColor  = CLASS_DATA[cls]?.color || '#FFFFFF';
        this.classLabel = CLASS_DATA[cls]?.label || cls;
        this.abilityCooldownMax = ABILITY_COOLDOWNS[cls] || 10;
        return { type: 'class', classId: cls };
      }
    }

    // Subclass detection
    const active = Object.entries(counts).filter(([, c]) => c >= SUBCLASS_THRESHOLD);
    if (active.length >= 2 && !this.subclassId) {
      const activeIds = active.map(([id]) => id).sort();
      for (const [subId, sub] of Object.entries(SUBCLASS_DATA)) {
        const sorted = [...sub.classes].sort();
        if (sorted[0] === activeIds[0] && sorted[1] === activeIds[1]) {
          this.subclassId = subId;
          return { type: 'subclass', subclassId: subId };
        }
      }
    }

    return null;
  }

  // ── Draw ─────────────────────────────────────────────────────

  draw(ctx) {
    if (!this.alive) return;
    if (this.invincible > 0 && Math.floor(this.flashTimer * 12) % 2 === 1) return;

    const _mob = 'ontouchstart' in window;
    const s = _mob ? this.size / 2 * 1.35 : this.size / 2;

    // Movement trail — fading white smear behind the player
    const tLen = this._trail.length;
    if (tLen > 1) {
      for (let i = 0; i < tLen - 1; i++) {
        const pt    = this._trail[i];
        const frac  = (i + 1) / tLen;
        const r     = s * 0.65 * frac;
        const alpha = frac * 0.5 * this._drawAlpha;
        ctx.globalAlpha  = alpha;
        ctx.shadowBlur   = 0;
        ctx.fillStyle    = this.glowColor || '#FFFFFF';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1, r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.globalAlpha = this._drawAlpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.facing);

    ctx.shadowBlur  = 14;
    ctx.shadowColor = this.glowColor;

    ctx.fillStyle   = '#FFFFFF';
    ctx.strokeStyle = this.glowColor;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(-s, -s, this.size, this.size, 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#CCCCCC';
    ctx.beginPath();
    ctx.moveTo(s + 4, 0);
    ctx.lineTo(s, -3);
    ctx.lineTo(s, 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    // Ability cooldown / ready ring
    if (this.classId && this.abilityCooldownMax > 0) {
      const ringR   = s + 14;
      const ready   = this.abilityCooldown <= 0;
      const cdPct   = ready ? 1 : 1 - this.abilityCooldown / this.abilityCooldownMax;
      const t       = Date.now() * 0.003;

      if (ready) {
        // Outer pulse ring — slow breathe
        const pulse = 0.55 + Math.sin(t * 1.8) * 0.35;
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#fff5c2';
        ctx.lineWidth   = 1.5;
        ctx.shadowBlur  = 18;
        ctx.shadowColor = '#fff5c2';
        ctx.beginPath();
        ctx.arc(this.x, this.y, ringR + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner cyan ring — rotating dashes (lightning feel)
        const dashRotate = t * 1.2;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(dashRotate);
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth   = 2;
        ctx.shadowBlur  = 12;
        ctx.shadowColor = '#00e5ff';
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.restore();
      } else {
        // Charging arc — fills clockwise from top as cooldown ticks down
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth   = 1.5;
        ctx.shadowBlur  = 6;
        ctx.shadowColor = '#00e5ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, ringR,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * cdPct);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    }

    // Shield ring
    if (this.shield > 0) {
      const shieldRatio = this.shield / 80;
      ctx.globalAlpha = 0.5 + shieldRatio * 0.4;
      ctx.strokeStyle = CLASS_DATA.warden.color;
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = 10;
      ctx.shadowColor = CLASS_DATA.warden.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, s + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * shieldRatio);
      ctx.stroke();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
    }
  }

  frequencyScore(elapsedSeconds) {
    const C = CONFIG;
    return Math.floor(
      this.kills          * C.kill_weight     +
      this.echoesRescued  * C.echo_weight     +
      elapsedSeconds      * C.time_weight     +
      this.upgradesTaken  * C.upgrade_weight  +
      this.fragmentsFound * C.fragment_weight
    );
  }
}
