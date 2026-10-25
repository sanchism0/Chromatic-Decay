// CHROMATIC DECAY — Player

import { CONFIG } from './config.js';
import { clamp, normalize, angle, circleVsRect, dist } from './utils.js';
import { haloSprite, drawSprite, drawGroundShadow } from './sprites.js';

// ── Character sprite ─────────────────────────────────────────
// 3 x 4 walk sheet: rows down, left, right, up; columns step A, standing, step B.
// Drawn pixel-perfect (one art pixel = SPRITE_PX canvas pixels), snapped to
// whole pixels, with feet on the ground under the player.
const SHEETS = {};
for (const who of ['dex', 'juno', 'raze']) {
  const img = new Image();
  img.onload = () => { img._ready = true; };
  img.src = `assets/characters/${who}/sprite/${who}-walk.png`;
  SHEETS[who] = img;
}
const CELL_W = 32, CELL_H = 44;
const WALK_CYCLE = [0, 1, 2, 1];   // step A, stand, step B, stand
const STRIDE     = 32;             // world px travelled per walk frame (~7 frames/s at base speed)
const ROW_FOR = { down: 0, left: 1, right: 2, up: 3 };
// Centre of the emitter's lens in each cell (art px, from the cell's top-left);
// shots leave from here. [row][col] — rows down, left, right, up.
// Printed by tools/build_sprite.py.
const LENS = {
  dex: [
    [[5, 29.5],  [5, 31.5],  [5, 30.5]],
    [[16, 30.5], [20, 31.5], [20, 31.5]],
    [[15, 30.5], [12, 31.5], [12, 31.5]],
    [[26, 28.5], [25, 28.5], [25, 28.5]],
  ],
  juno: [
    [[3.5, 30.5],  [4.5, 31.5],  [4.5, 31.5]],
    [[20.5, 30.5], [20.5, 31.5], [20.5, 31.5]],
    [[10.5, 30.5], [11.5, 31.5], [11.5, 31.5]],
    [[25.5, 29.5], [23.5, 28.5], [23.5, 28.5]],
  ],
  // Raze: his rifle hand (printed by tools/build_raze_sprite.py)
  raze: [
    [[3.5, 28.5],  [3.5, 28.5],  [3.5, 28.5]],
    [[9.5, 29.5],  [6.5, 28.5],  [9.5, 28.5]],
    [[21.5, 28.5], [25.5, 28.5], [21.5, 28.5]],
    [[15.5, 29.5], [15.5, 28.5], [16.5, 28.5]],
  ],
};

// Draw one frame of a character's sheet at canvas pixel (sx, sy), px canvas
// pixels per art pixel. Used by the character select screen. Returns false
// if the sheet hasn't loaded yet.
export function drawCharacterFrame(ctx, who, row, col, sx, sy, px) {
  const img = SHEETS[who];
  if (!img || !img._ready) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, col * CELL_W, row * CELL_H, CELL_W, CELL_H, Math.round(sx), Math.round(sy), CELL_W * px, CELL_H * px);
  return true;
}
export { WALK_CYCLE, CELL_W, CELL_H };

// ── Weapons ───────────────────────────────────────────────────
// Everyone carries an emitter; each character's handles differently. Rates
// are trigger pulls per second at base fire rate (fire-rate upgrades scale
// them); dmg multiplies base damage. Damage per second comes out about even
// (~1.7× the old single shot) — the difference is how it's delivered.
//   Juno — minigun: a stream of light, low-damage rounds with a little spray
//   Dex  — burst: three quick rounds per pull
//   Raze — heavy: slow, strong, gold rounds
// Extra projectiles (Multicast) never double up the stream: for Dex each adds
// a round to the burst, for Juno each makes the minigun 25% faster. Raze's
// heavy rounds still fan out.
export const WEAPONS = {
  juno: { name: 'Minigun', rate: 5.0,  burst: 1, gap: 0,     dmg: 0.40, spread: 0.07 },
  dex:  { name: 'Burst',   rate: 0.85, burst: 3, gap: 0.075, dmg: 0.66, spread: 0.025 },
  raze: { name: 'Heavy',   rate: 0.55, burst: 1, gap: 0,     dmg: 3.2,  spread: 0 },
};

// Signature abilities — earned by clearing Story Level 1 with that character.
// Space / F, on a cooldown.
export const SIGNATURES = {
  dex:  { name: 'ARC DISCHARGE', cd: 9,  desc: 'A shotgun blast of electric rounds that pierce and stun.' },
  juno: { name: 'HALF-LIFE',     cd: 11, desc: 'For 5 seconds your rounds make Chromatics decay.' },
  raze: { name: 'GOLD STANDARD', cd: 10, desc: 'Your next 3 rounds pierce everything and hit twice as hard.' },
};

// ── Dash (Space, or the touch button) ─────────────────────────
// A short burst in the direction you're moving (toward your aim if standing
// still). You can't be hurt during it; dashing through a hit at that moment
// is a perfect dodge and refunds the cooldown once.
export const DASH_DIST = 88, DASH_TIME = 0.16, DASH_CD = 1.6;

// ── Beam-in (Mega Man X style arrival) ────────────────────────
// A streak of light in the character's colour drops to the floor, then the
// body unfolds out of it: white silhouette → colour → the real sprite.
// Smooth fades only, no flicker. Timed to sfxBeamIn() in audio.js.
export const BEAM_DUR = 1.05;
const BEAM_DROP = 0.30;                                   // streak reaches the floor
const BEAM_COLOR = { dex: '#B6FF2E', juno: '#E58CFF' };
const _silhouettes = {};
function silhouette(who, color, row = 0, col = 1) {   // default: standing, facing down
  const key = who + color + row + col;
  if (_silhouettes[key]) return _silhouettes[key];
  const img = SHEETS[who];
  if (!img || !img._ready) return null;
  const c = document.createElement('canvas');
  c.width = CELL_W; c.height = CELL_H;
  const x = c.getContext('2d');
  x.drawImage(img, col * CELL_W, row * CELL_H, CELL_W, CELL_H, 0, 0, CELL_W, CELL_H);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = color;
  x.fillRect(0, 0, CELL_W, CELL_H);
  return (_silhouettes[key] = c);
}
const easeOut = k => 1 - (1 - k) * (1 - k);
const ramp = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));

function facingRow(a) {
  const c = Math.cos(a), sn = Math.sin(a);
  if (Math.abs(c) >= Math.abs(sn)) return c >= 0 ? ROW_FOR.right : ROW_FOR.left;
  return sn >= 0 ? ROW_FOR.down : ROW_FOR.up;
}

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
    this.character = 'dex';   // which operator's sprite and emitter to use

    // ── Base stats ───────────────────────────────────────────
    this.maxHp        = CONFIG.player_base_hp;
    this.hp           = this.maxHp;
    this.damage       = CONFIG.player_base_damage;
    this.fireRate     = CONFIG.player_base_fire_rate;
    this.moveSpeed    = CONFIG.player_move_speed;
    this.projSpeed    = CONFIG.player_projectile_speed;
    this.projRange    = CONFIG.player_projectile_range;
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
    // Activated abilities, in the order the character gained them: the first
    // goes on E, the second on F (game.js). Empty = those keys do nothing.
    this.abilities                = [];
    this.abilityCooldownMax       = 0;
    this.abilityCooldownMultiplier = 1.0;
    this.abilityOrbCount          = 1;   // Herald: orbs per ability use

    // ── Trait flags — general ────────────────────────────────
    this.killPulse           = false;
    this.chainReaction       = false;
    this.chainBonus          = 0;
    this.chainTimer          = 0;
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

    // ── State ────────────────────────────────────────────────
    this.firing      = false;
    this.fireTimer   = 0;
    this.alive       = true;
    this.invincible  = 0;
    this.justFired   = false;   // audio hook: true for one frame when a shot fires
    this.justHit     = false;   // audio hook: true for one frame when damage taken

    // ── Kill-triggered heal ──────────────────────────────────
    this.killHealEvery   = 0;  // 0 = disabled; set by upgrade (5→4→3)
    this.killHealCounter = 0;

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

  startBeamIn() { this.beamT = 0; this.beamOutT = null; this._drawnAt = null; }
  // Leaving: the beam-in played backwards — the body folds into a column of
  // light and the streak shoots back up. Untouchable throughout.
  startBeamOut() { this.beamOutT = 0; this.firing = false; }
  get beaming()    { return this.beamT < BEAM_DUR || this.beamOutT != null; }
  get beamedOut()  { return this.beamOutT != null && this.beamOutT >= BEAM_DUR; }

  update(dt, input, map, camera, zoom, projectileSystem) {
    this._map = map;
    if (!this.alive) return;

    // Arriving: no moving or firing until the body has formed
    if (this.beaming) {
      if (this.beamOutT != null) this.beamOutT += dt; else this.beamT += dt;
      this.firing = false; this.justFired = false; return;
    }

    // ── Timers ───────────────────────────────────────────────
    this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    this.chainTimer      = Math.max(0, this.chainTimer - dt);
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

    this.dashCooldown = Math.max(0, (this.dashCooldown || 0) - dt);
    this.dashT        = Math.max(0, (this.dashT || 0) - dt);
    for (const a of (this._afterimages || [])) a.age += dt;
    if (this._afterimages) this._afterimages = this._afterimages.filter(a => a.age < 0.25);

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

    let dir = normalize(dx, dy);
    let spd = this.effectiveSpeed;

    // Dash: start one, then it overrides movement for DASH_TIME
    // (desktop: a click dashes toward the cursor, dashToward; touch: the DASH
    // button dashes the way you're moving, or the way you face)
    const wantDash = this.dashQueued, to = this.dashToward;
    this.dashQueued = false; this.dashToward = null;
    if (wantDash && this.dashCooldown <= 0 && this.dashT <= 0) {
      this.dashDir = to && Math.hypot(to.x - this.x, to.y - this.y) > 4 ? normalize(to.x - this.x, to.y - this.y)
                   : (dx || dy) ? dir : { x: Math.cos(this.facing), y: Math.sin(this.facing) };
      this.dashFrom = { x: this.x, y: this.y };   // where it started (Juno's Parting Charge)
      this.dashT = DASH_TIME;
      this.dashCooldown = this.dashCooldownMax = DASH_CD;
      this._dodged = false;
      this._afterimages = [];
      this.justDashed = true;
    }
    if (this.dashT > 0) {
      dir = this.dashDir;
      spd = DASH_DIST / DASH_TIME;
      this._afterimages.push({ x: this.x, y: this.y, age: 0, cell: this._cell || [0, 1] });
    }

    // On ice (onIce, set by a Story level) you slide: your velocity eases
    // toward where you're steering instead of snapping to it, and a dash
    // carries on after it ends
    let vx = dir.x * spd, vy = dir.y * spd;
    if (this.onIce && this.dashT <= 0) {
      const k = Math.min(1, dt * 2.2);
      this._vx = (this._vx || 0) + (vx - (this._vx || 0)) * k;
      this._vy = (this._vy || 0) + (vy - (this._vy || 0)) * k;
      vx = this._vx; vy = this._vy;
    } else { this._vx = vx; this._vy = vy; }

    // Move in sub-steps no longer than a quarter of the body, so a slow frame
    // (large dt) can't jump the player's centre inside a rack
    const r     = this.size / 2;
    const moveDist = Math.hypot(vx, vy) * dt;
    const steps = Math.max(1, Math.ceil(moveDist / (r * 0.5)));
    for (let i = 0; i < steps; i++) {
      let nx = this.x + vx * dt / steps;
      let ny = this.y + vy * dt / steps;
      for (const obs of map.obstacles) {
        const hit = circleVsRect(nx, ny, r + 1, obs.x, obs.y, obs.w, obs.h);
        if (hit) {
          nx += hit.nx * hit.depth; ny += hit.ny * hit.depth;
          // sliding into a rack stops the slide into it, not along it
          const into = this._vx * hit.nx + this._vy * hit.ny;
          if (into < 0) { this._vx -= into * hit.nx; this._vy -= into * hit.ny; }
        }
      }
      this.x = clamp(nx, r, CONFIG.map_width  - r);
      this.y = clamp(ny, r, CONFIG.map_height - r);
    }

    // Record trail position (cap at 8 points)
    this._trail.push({ x: this.x, y: this.y });
    if (this._trail.length > 14) this._trail.shift();

    // ── Facing — right joystick overrides mouse ──────────────
    if (input.touchAimAngle !== null) {
      this.facing = input.touchAimAngle;
      this._aimPoint = null;
    } else {
      const mouse = input.worldMouse(camera.x, camera.y, zoom);
      this.facing = angle(this.x, this.y, mouse.x, mouse.y);
      this._aimPoint = mouse;
    }

    // ── Shooting — toward the cursor; auto-fire or while held ─
    // (not while the operator is talking: holdFire)
    this.firing    = !this.holdFire && (input.autoFire || input.fireHeld);
    this.justFired = false;
    this.fireTimer -= dt;
    if (!this.firing) this.fireTimer = Math.max(0, this.fireTimer);   // first press fires at once

    const W = this.weapon;
    const spin = 1;   // (Half-Life no longer speeds the gun up)
    if (this._burstLeft > 0) {
      // Rest of a burst: fires on its own once the trigger is pulled
      this._burstT -= dt;
      if (this._burstT <= 0) {
        this._shoot(projectileSystem, this._burstLeft === 1);
        this._burstLeft--;
        this._burstT = W.gap;
        this.justFired = true;
      }
    } else if (this.firing && this.fireTimer <= 0) {
      const extra = this.projCount - 1;
      this._shoot(projectileSystem, W.burst + (this.character === 'dex' ? extra : 0) === 1);
      const rate  = W.rate * (this.character === 'juno' ? 1 + 0.25 * extra : 1);
      this.fireTimer = 1 / (rate * spin * this.effectiveFireRate / CONFIG.player_base_fire_rate);
      const burst = W.burst + (this.character === 'dex' ? extra : 0);
      if (burst > 1) { this._burstLeft = burst - 1; this._burstT = W.gap; }
      this.justFired = true;
    }

    // Ability timers (the E / F keys are handled in game.js)
    this.signatureCooldown = Math.max(0, (this.signatureCooldown || 0) - dt);
    this.spinUpTimer       = Math.max(0, (this.spinUpTimer || 0) - dt);

    // ── Invincibility window ─────────────────────────────────
    if (this.invincible > 0) this.invincible -= dt;

    // ── Ghost transparency target ────────────────────────────
    const targetAlpha = this.classId === 'ghost' ? 0.65 : 1.0;
    this._drawAlpha += (targetAlpha - this._drawAlpha) * Math.min(1, dt * 4);
  }

  // Faint copy of the sprite drawn over racks that hide the player, so you
  // never lose sight of yourself behind a tall rack
  _drawBeamIn(ctx, s, T = this.beamT) {
    const col = BEAM_COLOR[this.character] || '#FFFFFF';
    const m   = ctx.getTransform();
    const gx  = Math.round(m.a * this.x + m.e);
    const gy  = Math.round(m.d * (this.y + s * 0.6) + m.f);   // feet, on screen
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';

    // 1. The streak falls (speeding up), then fades into the body
    const fall = Math.min(1, T / BEAM_DROP);
    const beamA = T < BEAM_DROP ? 1 : 1 - ramp(T, BEAM_DROP, BEAM_DROP + 0.22);
    if (beamA > 0) {
      const headY = Math.round(-30 + (gy + 30) * fall * fall);
      const len = T < BEAM_DROP ? 120 : 120 + (T - BEAM_DROP) * 300;   // the tail catches up into a column
      const top = Math.max(0, headY - len);
      const halo = ctx.createLinearGradient(gx - 16, 0, gx + 16, 0);
      halo.addColorStop(0, 'rgba(0,0,0,0)'); halo.addColorStop(0.5, col); halo.addColorStop(1, 'rgba(0,0,0,0)');
      const fadeUp = ctx.createLinearGradient(0, top, 0, headY);
      fadeUp.addColorStop(0, 'rgba(255,255,255,0)'); fadeUp.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.globalAlpha = 0.45 * beamA;
      ctx.fillStyle = halo; ctx.fillRect(gx - 16, top, 32, headY - top);
      ctx.globalAlpha = beamA;
      ctx.fillStyle = col;  ctx.fillRect(gx - 3, top, 6, headY - top);
      ctx.fillStyle = fadeUp; ctx.fillRect(gx - 1, top, 2, headY - top);
    }

    // 2. Impact: a ring of light spreads across the floor
    if (T >= BEAM_DROP) {
      const k = ramp(T, BEAM_DROP, BEAM_DROP + 0.4);
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(gx, gy, 6 + k * 34, 2 + k * 11, 0, 0, Math.PI * 2); ctx.stroke();
    }

    // 3. The body unfolds out of the beam
    if (T >= BEAM_DROP) {
      const u = ramp(T, BEAM_DROP, BEAM_DUR);
      const stretch = easeOut(ramp(u, 0, 0.45));
      const w = Math.max(2, Math.round(CELL_W * (0.12 + 0.88 * stretch)));
      const h = Math.round(CELL_H * (1.25 - 0.25 * stretch));
      const x0 = gx - Math.round(w / 2), y0 = gy - h + 1;
      const glow = ctx.createRadialGradient(gx, gy - CELL_H / 2, 0, gx, gy - CELL_H / 2, 40);
      glow.addColorStop(0, col); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.35 * (1 - u);
      ctx.fillStyle = glow; ctx.fillRect(gx - 40, gy - CELL_H / 2 - 40, 80, 80);

      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = false;
      const white = silhouette(this.character, '#FFFFFF');
      const tint  = silhouette(this.character, col);
      const sheet = SHEETS[this.character];
      const aSprite = ramp(u, 0.55, 1);
      const aTint   = ramp(u, 0.3, 0.5) * (1 - ramp(u, 0.7, 1));
      const aWhite  = 1 - ramp(u, 0.45, 0.75);
      if (sheet && sheet._ready && aSprite > 0) {
        ctx.globalAlpha = aSprite;
        ctx.drawImage(sheet, 1 * CELL_W, 0, CELL_W, CELL_H, x0, y0, w, h);
      }
      if (tint && aTint > 0)   { ctx.globalAlpha = aTint;  ctx.drawImage(tint,  x0, y0, w, h); }
      if (white && aWhite > 0) { ctx.globalAlpha = aWhite; ctx.drawImage(white, x0, y0, w, h); }
    }
    ctx.restore();
  }

  drawOccluded(ctx, alpha = 0.38) {
    const d = this._drawnAt;
    if (!d || !this.alive || !this._cell) return;
    const [row, col] = this._cell;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    ctx.drawImage(d.sheet, col * CELL_W, row * CELL_H, CELL_W, CELL_H, d.sx, d.sy, CELL_W * d.px, CELL_H * d.px);
    ctx.restore();
  }

  // Sprite bounds in world space (feet at the bottom), for occlusion checks
  spriteBounds() {
    const k = this._artScale || 0.6;
    const s = ('ontouchstart' in window ? 1.35 : 1) * this.size / 2;
    const feet = this.y + s * 0.6;
    return { x: this.x - 10 * k, y: feet - 40 * k, w: 20 * k, h: 40 * k };
  }

  // World position of the emitter lens on the current frame. Falls back to
  // the body centre before the sprite has drawn, or if the lens would sit
  // inside a rack (hugging a wall) so shots never spawn in a wall.
  emitterPos() {
    if (!this._artScale || !this._cell) return { x: this.x, y: this.y };
    const s = ('ontouchstart' in window ? 1.35 : 1) * this.size / 2;
    const [lx, ly] = (LENS[this.character] || LENS.dex)[this._cell[0]][this._cell[1]];
    const x = this.x + (lx - CELL_W / 2) * this._artScale;
    const y = this.y + s * 0.6 + (ly - (CELL_H - 1)) * this._artScale;
    for (const o of this._map?.obstacles || []) {
      if (x > o.x - 2 && x < o.x + o.w + 2 && y > o.y - 2 && y < o.y + o.h + 2) return { x: this.x, y: this.y };
    }
    return { x, y };
  }

  get weapon() { return WEAPONS[this.character] || WEAPONS.dex; }

  _useSignature(projectileSystem) {
    const sig = SIGNATURES[this.signature];
    if (!sig) return;
    this.signatureCooldown = this.signatureCooldownMax = sig.cd * (this.abilityCooldownMultiplier || 1);
    this._castId = (this._castId || 0) + 1;   // Level 5's anchors count one hit per cast
    this.justSignature = this.signature;   // game.js plays the effects
    if (this.signature === 'dex') {
      // A shotgun blast: electric rounds in a wide cone toward the aim. They
      // pierce, and stun and jam everything they pass through (enemies.js)
      const from = this.emitterPos(), ap = this._aimPoint;
      const aim = ap && Math.hypot(ap.x - from.x, ap.y - from.y) > 24 ? angle(from.x, from.y, ap.x, ap.y) : this.facing;
      const n = 11, spread = 0.95, dmg = this.effectiveDamage * 0.8;
      for (let i = 0; i < n; i++) {
        const a = aim + (i / (n - 1) - 0.5) * spread + (Math.random() - 0.5) * 0.05;
        const s = projectileSystem.spawnPlayer(from.x, from.y, a, dmg, this.projSpeed * (1 + (i % 3) * 0.06), this.projRange * 0.6, 3, false, false);
        if (s) { s.discharge = true; s.castId = this._castId; s.stunRound = true; }
      }
    } else if (this.signature === 'juno') {
      // Half-Life: her rounds go unstable for a while; what they hit decays
      this.spinUpTimer = 5;
    } else if (this.signature === 'raze') {
      this.goldRounds = 3;
    }
  }

  // finalRound: the last round of a burst (Arc Round makes it electric)
  _shoot(projectileSystem, finalRound = false) {
    // Flash Crash: every 10th shot deals 400% damage
    let flashMultiplier = 1;
    if (this.flashCrash) {
      this.flashCrashCounter++;
      if (this.flashCrashCounter >= 10) {
        flashMultiplier        = 4;
        this.flashCrashCounter = 0;
      }
    }

    // Overload Burst: next 3 shots deal 3× damage and render golden
    const isOverload = (this.overloadBurst || 0) > 0;
    if (isOverload) this.overloadBurst--;
    this.lastShotOverload = isOverload;   // audio: overload shots sound deeper

    const W      = this.weapon;
    const gold   = (this.goldRounds || 0) > 0;
    if (gold) this.goldRounds--;
    const count  = this.character === 'dex' || this.character === 'juno' ? 1 : this.projCount;
    const half   = Math.floor(count / 2);
    // Half-Life (Juno's F): rounds hit twice as hard and pierce two targets
    const halfLife = this.spinUpTimer > 0;
    const damage = this.effectiveDamage * W.dmg * flashMultiplier * (isOverload ? 3 : 1) * (gold ? 2 : 1) * (halfLife ? 2 : 1);
    const spray  = (Math.random() - 0.5) * 2 * W.spread;
    const from   = this.emitterPos();
    // Aim from the lens itself at the cursor, so shots still land where you
    // point even though they leave from his arm (stick aim keeps its angle)
    const ap     = this._aimPoint;
    const aim    = (ap && Math.hypot(ap.x - from.x, ap.y - from.y) > 24 ? angle(from.x, from.y, ap.x, ap.y) : this.facing) + spray;

    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - half) * this.projSpread;
      const a = aim + offset;
      const shot = projectileSystem.spawnPlayer(
        from.x, from.y, a,
        damage,
        this.projSpeed,
        this.projRange,
        gold ? 99 : this.piercingShots + (halfLife ? 2 : 0),
        this.projectileBounce,
        isOverload || gold,
      );
      if (shot) {
        shot.rackBounce = this.rackBounce || 0;
        shot.arc = !!(finalRound && this.arcRound);
        shot.spun = halfLife;
      }
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
        // Overload Burst — 3× damage + golden oversized shots for next 3
        this.overloadBurst = 3;

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

    // Kill-threshold heal (Triage Protocol upgrade)
    if (this.killHealEvery > 0) {
      this.killHealCounter++;
      if (this.killHealCounter >= this.killHealEvery) {
        this.heal(1);
        this.killHealCounter = 0;
      }
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

  // Called by game.js when an Echo is rescued
  onEchoRescue() {
    this.echoesRescued++;
    if (this.echoHealBonus > 0) this.heal(this.echoHealBonus);
    if (this.echoSpawnOrb && this._companions) this._companions.addOrb(this);
  }

  takeDamage(rawAmount) {
    // Mid-dash: untouchable. The first hit dodged this way is a perfect dodge
    if (this.dashT > 0) {
      if (!this._dodged) { this._dodged = true; this.perfectDodge = true; }
      return false;
    }
    if (!this.alive || this.invincible > 0 || this.beaming) return false;

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

    // Story tutorial: you can be hurt, but never knocked out
    if (this.cannotDie && this.hp < 1) this.hp = 1;

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

    const _mob = 'ontouchstart' in window;
    const s = _mob ? this.size / 2 * 1.35 : this.size / 2;
    if (this.beamOutT != null) { if (!this.beamedOut) this._drawBeamIn(ctx, s, BEAM_DUR - this.beamOutT); return; }
    if (this.beaming) { this._drawBeamIn(ctx, s); return; }

    // Protection window (after a hit, Phase Shift, Margin Call): no blinking.
    // Track the window's full length whenever it's (re)started, so the shield
    // ring can drain from full to empty.
    const inv = Math.max(0, this.invincible);
    if (inv > (this._invPrev || 0) + 1e-4) this._invMax = inv;
    this._invPrev = inv;
    const shield = inv > 0 ? Math.min(1, inv / 0.15) : 0;   // eases out over the last 0.15s
    const alpha  = this._drawAlpha * (1 - 0.4 * shield);    // see-through while protected

    // Movement trail — faint footfall glow along the floor behind the player
    const tLen = this._trail.length;
    if (tLen > 1) {
      for (let i = 0; i < tLen - 1; i++) {
        const pt    = { x: this._trail[i].x, y: this._trail[i].y + s * 0.6 };
        const frac  = (i + 1) / tLen;
        const r     = s * 0.35 * frac;
        ctx.globalAlpha  = frac * 0.18 * alpha;
        ctx.shadowBlur   = 0;
        ctx.fillStyle    = this.glowColor || '#FFFFFF';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1, r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Dash afterimages: fading copies in the character's colour
    if (this._afterimages && this._afterimages.length) {
      const t = ctx.getTransform();
      const col = BEAM_COLOR[this.character] || '#FFFFFF';
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < this._afterimages.length; i += 2) {
        const a = this._afterimages[i];
        const img = silhouette(this.character, col, a.cell[0], a.cell[1]);
        if (!img) continue;
        const gx = t.a * a.x + t.e, gy = t.d * (a.y + s * 0.6) + t.f;
        ctx.globalAlpha = 0.45 * (1 - a.age / 0.25);
        ctx.drawImage(img, Math.round(gx - CELL_W / 2), Math.round(gy - (CELL_H - 1)));
      }
      ctx.restore();
    }

    // Contact shadow, then the body
    drawGroundShadow(ctx, this.x, this.y + s * 0.6, s * 1.4, s * 0.6, 0.6 * alpha);
    // Dash recharging: a thin arc on the floor that fills back up
    if (this.dashCooldown > 0) {
      const k = 1 - this.dashCooldown / (this.dashCooldownMax || DASH_CD);
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = '#E8F0FF'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + s * 0.6, s * 1.5, s * 0.65, 0, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
      ctx.restore();
    }
    const by = this.y - this.lift;

    // Walk frame advances with distance moved; standing frame when still
    const moved = this._lastDrawX === undefined ? 0 : Math.hypot(this.x - this._lastDrawX, this.y - this._lastDrawY);
    this._lastDrawX = this.x; this._lastDrawY = this.y;
    if (moved > 0.05) { this._walkDist = (this._walkDist || 0) + moved; this._stillFor = 0; }
    else this._stillFor = (this._stillFor || 0) + 1;
    const walking = (this._stillFor || 0) < 4;
    const col = walking ? WALK_CYCLE[Math.floor((this._walkDist || 0) / STRIDE) % 4] : 1;
    const row = facingRow(this.facing);

    const sheet = SHEETS[this.character] || SHEETS.dex;
    if (sheet._ready) {
      const t   = ctx.getTransform();
      // One art pixel per screen pixel: about 24 world px tall at desktop zoom,
      // in scale with the racks and Chromatics
      const px  = 1;
      const gx  = t.a * this.x + t.e;                          // ground point on screen
      const gy  = t.d * (this.y + s * 0.6) + t.f;
      const sx  = Math.round(gx - (CELL_W / 2) * px);
      const sy  = Math.round(gy - (CELL_H - 1) * px);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sheet, col * CELL_W, row * CELL_H, CELL_W, CELL_H, sx, sy, CELL_W * px, CELL_H * px);
      ctx.restore();
      // Remember how the sprite maps to the world so shots can leave the lens,
      // and where it was drawn so a see-through copy can be shown behind racks
      this._artScale = px / t.a;
      this._cell     = [row, col];
      this._drawnAt  = { sx, sy, px, sheet };
    } else {
      // Fallback until the sheet loads: the original light-square body
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(this.x, by);
      ctx.fillStyle = '#E4ECF6';
      ctx.beginPath(); ctx.roundRect(-s, -s, s * 2, s * 2, 2); ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    // Shimmer shield — soft light bending around the body, plus a thin ring
    // that drains as the protection runs out
    if (shield > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 * shield;
      drawSprite(ctx, haloSprite('#bff4ff', Math.round(s * 3.2), 0.6), this.x, by);

      const ringR = s + 6;
      const drift = Date.now() * 0.0015;                       // slow, steady rotation
      ctx.lineWidth   = 1;
      ctx.strokeStyle = `rgba(191,244,255,${0.18 * shield})`;  // faint full track
      ctx.beginPath(); ctx.arc(this.x, by, ringR, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth   = 1.5;
      ctx.strokeStyle = `rgba(220,250,255,${0.75 * shield})`;  // remaining time
      ctx.beginPath();
      ctx.arc(this.x, by, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (inv / (this._invMax || inv)));
      ctx.stroke();

      // Two faint glints gliding around the shield
      ctx.strokeStyle = `rgba(255,255,255,${0.35 * shield})`;
      for (const off of [0, Math.PI]) {
        ctx.beginPath();
        ctx.arc(this.x, by, ringR + 3, drift + off, drift + off + 0.6);
        ctx.stroke();
      }
      ctx.restore();
    }

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
        ctx.arc(this.x, by, ringR + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner cyan ring — rotating dashes (lightning feel)
        const dashRotate = t * 1.2;
        ctx.save();
        ctx.translate(this.x, by);
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
        ctx.arc(this.x, by, ringR,
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
      ctx.arc(this.x, by, s + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * shieldRatio);
      ctx.stroke();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
    }
  }

  // How high the body hovers above its ground shadow (visual only)
  get lift() {
    const s = ('ontouchstart' in window ? 1.35 : 1) * this.size / 2;
    return s * 0.45 + Math.sin(Date.now() * 0.005) * 0.8;
  }

  // Additive halo — drawn in the glow pass after the racks
  drawHalo(ctx) {
    if (!this.alive) return;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * this._drawAlpha;
    drawSprite(ctx, haloSprite(this.glowColor, 30, 0.22), this.x, this.y - this.lift);
    ctx.globalAlpha = prev;
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
