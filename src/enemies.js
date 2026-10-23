// CHROMATIC DECAY — Enemies & Spawn System

import { CONFIG } from './config.js';
import { clamp, dist, distSq, angle, normalize, circleVsRect, weightedPick } from './utils.js';
import { haloSprite, drawGlow } from './sprites.js';

let _nextId = 0;

const HIT_GLOW_TIME = 0.25;   // seconds a hit glow takes to fade

// ── Pulse rate ───────────────────────────────────────────────
// Each Chromatic's core pulses at a rate set by its colour's wavelength:
// frequency = c / λ, so violet beats fastest and orange slowest. Magenta has
// no single wavelength (the eye sees it when red and violet mix), so the pink
// boss pulses at the beat frequency between the two.

const C_NM_THZ = 299792;   // speed of light, nm·THz
const _pulseHz = {};
function pulseHz(type) {
  if (_pulseHz[type] !== undefined) return _pulseHz[type];
  const f = [].concat(CONFIG.enemies[type].wavelength_nm).map(nm => C_NM_THZ / nm);
  return (_pulseHz[type] = f.length > 1 ? Math.abs(f[0] - f[1]) / 400 : f[0] / 400);
}

// Light colours (yellow, green) blow out to white under additive blending, so
// each type's glow is scaled by its luminance to keep every ghost spectral.
const _glowK = {};
function glowStrength(type) {
  if (_glowK[type] !== undefined) return _glowK[type];
  const n = parseInt(CONFIG.enemies[type].color.slice(1), 16);
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return (_glowK[type] = Math.max(0.45, Math.min(1, 0.3 / Math.max(L, 0.01))));
}

// ── Base Enemy ───────────────────────────────────────────────

// Arrival: a new enemy gathers out of drifting motes over SPAWN_IN seconds,
// holding still and harmless until it has formed
const SPAWN_IN = 0.45;

// ── Pathing (flow field) ─────────────────────────────────────
// The shortest walkable distance to the player is worked out for every 20px cell of the map, whenever the player changes cell (Dijkstra over a grid where racks,
// grown by an enemy's radius, are walls). An enemy that can see the player
// swarms as usual (flank angle, leading); one with a rack in the way follows
// the field downhill instead of guessing which way round to go.
const FLOW = {
  C: 20, cols: 0, rows: 0, blocked: null, dist: null, ready: false,
  _obs: null, _pcell: -1,

  _build(map) {
    const C = this.C;
    this.cols = Math.ceil(CONFIG.map_width / C);
    this.rows = Math.ceil(CONFIG.map_height / C);
    this.blocked = new Uint8Array(this.cols * this.rows);
    const R = 13;   // a typical enemy's radius
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
      const x = i * C + C / 2, y = j * C + C / 2;
      if (x < R || y < R || x > CONFIG.map_width - R || y > CONFIG.map_height - R ||
          map.obstacles.some(o => x > o.x - R && x < o.x + o.w + R && y > o.y - R && y < o.y + o.h + R)) {
        this.blocked[j * this.cols + i] = 1;
      }
    }
    this.dist = new Float64Array(this.cols * this.rows);   // 64-bit: Float32 rounding made the solver loop forever
    this._obs = map.obstacles;
    this._pcell = -1;
  },

  cell(x, y) {
    const i = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.C)));
    const j = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.C)));
    return j * this.cols + i;
  },

  update(dt, map, player) {
    if (this._obs !== map.obstacles) this._build(map);
    // The map doesn't change, so only re-solve when the player changes cell
    let start = this.cell(player.x, player.y);
    if (start === this._pcell) return;
    this._pcell = start;
    // The player can stand right against a rack, in a "blocked" cell: start
    // from the nearest open cell instead
    if (this.blocked[start]) {
      const ci = start % this.cols, cj = (start / this.cols) | 0;
      let best = -1, bd = Infinity;
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= this.cols || j >= this.rows || this.blocked[j * this.cols + i]) continue;
        if (di * di + dj * dj < bd) { bd = di * di + dj * dj; best = j * this.cols + i; }
      }
      if (best >= 0) start = best;
    }
    const D = this.dist, cols = this.cols, rows = this.rows, B = this.blocked;
    D.fill(Infinity);
    D[start] = 0;
    // Binary heap of [dist, cell]
    const heap = [[0, start]];
    const push = n => { heap.push(n); let k = heap.length - 1; while (k > 0) { const pk = (k - 1) >> 1; if (heap[pk][0] <= heap[k][0]) break; [heap[pk], heap[k]] = [heap[k], heap[pk]]; k = pk; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    while (heap.length) {
      const [d, c] = pop();
      if (d > D[c]) continue;
      const ci = c % cols, cj = (c / cols) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
        const n = j * cols + i;
        if (B[n]) continue;
        // No cutting corners past a rack
        if (di && dj && (B[cj * cols + i] || B[j * cols + ci])) continue;
        const nd = d + (di && dj ? 1.4142 : 1);
        if (nd < D[n]) { D[n] = nd; push([nd, n]); }
      }
    }
    this.ready = true;
  },

  // Is the straight line between two points free of racks?
  clear(x0, y0, x1, y1) {
    const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(len / 10);
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      if (this.blocked[this.cell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)]) return false;
    }
    return true;
  },

  // Unit vector downhill from (x, y), or null if there's no way through
  dir(x, y) {
    const cols = this.cols, rows = this.rows, D = this.dist, B = this.blocked;
    const c = this.cell(x, y);
    const ci = c % cols, cj = (c / cols) | 0;
    let best = -1, bd = D[c];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
      const n = j * cols + i;
      if (B[n] || (di && dj && (B[cj * cols + i] || B[j * cols + ci]))) continue;
      if (D[n] < bd) { bd = D[n]; best = n; }
    }
    if (best < 0 || !isFinite(bd)) return null;
    const tx = (best % cols) * this.C + this.C / 2, ty = ((best / cols) | 0) * this.C + this.C / 2;
    const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d];
  },
};
const easeOut = k => 1 - (1 - k) * (1 - k);

class Enemy {
  constructor(type, x, y) {
    this.id      = _nextId++;
    this.type    = type;
    this.cfg     = CONFIG.enemies[type];
    this.x       = x;
    this.y       = y;
    this.alive   = true;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = 0;
    this.fireTimer   = Math.random() * (1 / (this.cfg.projectile_fire_rate || 1));
    this.aggroTimer  = 0;   // how long since last seeing player
    this.flashTimer  = 0;
    this.hitFlash    = 0;   // seconds remaining

    this.maxHp = this.cfg.base_hp;
    this.hp    = this.maxHp;

    // Persistent slow (e.g. Short Squeeze — survives across frames)
    this.slowTimer  = 0;
    this.slowFactor = 0;

    // Stun (Circuit Breaker)
    this.stunTimer  = 0;

    // Tracks whether enemy was below 25% HP before a killing hit (Frequency Shatter)
    this.wasBelow25 = false;

    // Arrival fade (see SPAWN_IN)
    this.spawnT = 0;

    // Each enemy approaches at its own angle and curves in as it closes, so a
    // crowd comes from several sides instead of trailing in a single file.
    // Spread evenly by id (golden angle) rather than at random.
    this.flank = Math.sin(this.id * 2.39996) * 1.2;   // radians, about ±70°
    // Two in three also aim ahead of where the player is heading (seconds
    // of lead), so part of the swarm cuts you off instead of trailing behind
    this.lead  = [0, 0.7, 1.3][this.id % 3];
    this._sepX = 0; this._sepY = 0;                   // set each frame by EnemySystem
  }

  get forming() { return this.spawnT < SPAWN_IN; }

  get size() { return this.cfg.size; }

  // On mobile, hitbox scales up to match the larger visual size
  get hitSize() {
    return 'ontouchstart' in window ? this.cfg.size * 1.35 : this.cfg.size;
  }

  get isAlive() { return this.alive && this.hp > 0; }

  // Visual radius — scaled up on mobile to match the larger hitbox
  get drawSize() {
    return 'ontouchstart' in window ? this.cfg.size * 1.35 : this.cfg.size;
  }

  // How high the body hovers above its ground shadow (visual only)
  get lift() {
    return this.drawSize * 0.35 + Math.sin(Date.now() * 0.004 + this.id) * 1.2;
  }

  scaleHp(elapsedMinutes) {
    const scale = 1 + elapsedMinutes * CONFIG.hp_scale_per_minute;
    this.maxHp = Math.round(this.cfg.base_hp * scale);
    this.hp    = this.maxHp;
  }

  takeDamage(amount) {
    // Track low-HP state before deducting (used by Frequency Shatter)
    this.wasBelow25 = (this.hp / this.maxHp) < 0.25;
    this.hp -= amount;
    this.hitFlash = HIT_GLOW_TIME;
    if (this.hp <= 0) {
      this.alive = false;
    }
  }

  // ── Per-type update ──────────────────────────────────────────

  update(dt, player, map, projectileSystem) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.forming) { this.spawnT += dt; return; }

    // Stun check — skip all movement and firing while stunned
    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
      return;
    }

    // Tick persistent slow (Short Squeeze etc.)
    if (this.slowTimer > 0) {
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      if (this.slowTimer <= 0) this.slowFactor = 0;
    }

    // Clear per-frame debuffs (set fresh each frame by trap system)
    this.trapSlow       = 0;
    this.trapSuppressed = false;

    switch (this.type) {
      case 'violet': this._updateViolet(dt, player, map); break;
      case 'yellow': this._updateYellow(dt, player, map); break;
      case 'green':  this._updateGreen(dt, player, map, projectileSystem); break;
      case 'orange': this._updateOrange(dt, player, map, projectileSystem); break;
      case 'pink':   this._updatePink(dt, player, map, projectileSystem); break;
    }

  }

  // Toward (tx, ty), but bent by this enemy's flank angle while still far
  // away (straightening out inside ~90px), plus a push away from neighbours.
  // With a rack between it and (tx, ty), it follows the flow field instead.
  _approach(tx, ty) {
    if (FLOW.ready) {
      this._losT = (this._losT || 0) - 1 / 60;
      if (this._losT <= 0) { this._los = FLOW.clear(this.x, this.y, tx, ty); this._losT = 0.12; }
      if (!this._los) {
        const d = FLOW.dir(this.x, this.y);
        if (d) {
          // Spread out along the route: lean by part of this enemy's flank
          // angle, unless that would point it into a rack
          const b = this.flank * 0.45, c = Math.cos(b), sn = Math.sin(b);
          const lx = d[0] * c - d[1] * sn, ly = d[0] * sn + d[1] * c;
          this._flowing = true;
          return FLOW.blocked[FLOW.cell(this.x + lx * 22, this.y + ly * 22)] ? d : [lx, ly];
        }
      }
    }
    this._flowing = false;
    const pv = EnemySystem.playerVel;
    if (this.lead && pv) {
      const lx = pv.x * this.lead, ly = pv.y * this.lead;
      const ll = Math.hypot(lx, ly), cap = 260;
      const k = ll > cap ? cap / ll : 1;
      // Only lead while still out of reach; up close, go straight for them
      const far = Math.max(0, Math.min(1, (Math.hypot(tx - this.x, ty - this.y) - 70) / 200));
      tx += lx * k * far; ty += ly * k * far;
    }
    const dx = tx - this.x, dy = ty - this.y;
    const d  = Math.hypot(dx, dy) || 1;
    const bend = this.flank * Math.max(0, Math.min(1, (d - 90) / 320));
    const c = Math.cos(bend), sn = Math.sin(bend);
    return [(dx * c - dy * sn) / d, (dx * sn + dy * c) / d];
  }

  _move(dt, dx, dy, map, speedOverride) {
    let n = normalize(dx, dy);
    if (this._sepX || this._sepY) n = normalize(n.x + this._sepX, n.y + this._sepY);
    const combinedSlow = Math.max(this.trapSlow || 0, this.slowFactor || 0);
    const spd = (speedOverride !== undefined ? speedOverride : this.cfg.move_speed) * (1 - combinedSlow);
    const step = spd * dt;

    // ── Wall-steering ────────────────────────────────────────────
    // Probe ahead along the current steered direction. If blocked, rotate the
    // steer angle around the obstacle. Once clear, decay back to the direct path.
    if (this._steerAngle === undefined) { this._steerAngle = 0; this._stuckTimer = 0; }

    // Following the flow field: the path already goes round the racks
    if (this._flowing) { this._steerAngle = 0; this._stuckTimer = 0; }

    const baseAngle = Math.atan2(n.y, n.x);
    const probeDist = Math.max(30, this.size * 2.5);
    const probeX    = this.x + Math.cos(baseAngle + this._steerAngle) * probeDist;
    const probeY    = this.y + Math.sin(baseAngle + this._steerAngle) * probeDist;
    let probeHit    = false;
    if (!this._flowing) for (const obs of map.obstacles) {
      if (circleVsRect(probeX, probeY, this.size + 2, obs.x, obs.y, obs.w, obs.h)) {
        probeHit = true; break;
      }
    }

    if (probeHit) {
      // Pick a steer side on first contact, then ramp up the angle
      if (Math.abs(this._steerAngle) < 0.1) {
        this._steerAngle = (Math.random() < 0.5 ? 1 : -1) * 0.4;
      }
      this._steerAngle = Math.sign(this._steerAngle) *
        Math.min(Math.abs(this._steerAngle) + 2.5 * dt, Math.PI * 0.75);
    } else if (Math.abs(this._steerAngle) > 0.01) {
      // Path clear — gradually return to direct route
      this._steerAngle *= (1 - dt * 2.5);
      if (Math.abs(this._steerAngle) < 0.01) this._steerAngle = 0;
    }

    const finalAngle = baseAngle + this._steerAngle;
    const fnx = Math.cos(finalAngle);
    const fny = Math.sin(finalAngle);

    // ── Split-axis collision resolution ──────────────────────────
    const prevX = this.x, prevY = this.y;

    let nx = this.x + fnx * step;
    let ny = this.y;
    for (const obs of map.obstacles) {
      const hit = circleVsRect(nx, ny, this.size + 1, obs.x, obs.y, obs.w, obs.h);
      if (hit) { nx += hit.nx * hit.depth; ny += hit.ny * hit.depth; }
    }
    ny += fny * step;
    for (const obs of map.obstacles) {
      const hit = circleVsRect(nx, ny, this.size + 1, obs.x, obs.y, obs.w, obs.h);
      if (hit) { nx += hit.nx * hit.depth; ny += hit.ny * hit.depth; }
    }

    this.x = clamp(nx, this.size, CONFIG.map_width  - this.size);
    this.y = clamp(ny, this.size, CONFIG.map_height - this.size);

    // ── Stuck detection ──────────────────────────────────────────
    // If the enemy barely moved despite wanting to, flip to a random steer side
    const moved = Math.hypot(this.x - prevX, this.y - prevY);
    if (step > 0.3 && moved < step * 0.25) {
      this._stuckTimer += dt;
      if (this._stuckTimer > 0.25) {
        this._steerAngle = (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.4);
        this._stuckTimer = 0;
      }
    } else {
      this._stuckTimer = Math.max(0, this._stuckTimer - dt * 1.5);
    }

    // Record trail position (cap at 8 points)
  }

  // VIOLET — slow drift toward player (doesn't know what it's doing, still coming for you)
  _updateViolet(dt, player, map) {
    const [ax, ay] = this._approach(player.x, player.y);
    this._move(dt, ax, ay, map);
  }

  // YELLOW — persistent drift toward player, slightly faster than Violet
  _updateYellow(dt, player, map) {
    const [ax, ay] = this._approach(player.x, player.y);
    this._move(dt, ax, ay, map);
  }

  // GREEN — chase at full speed and shoot straight ahead
  _updateGreen(dt, player, map, projectileSystem) {
    const [ax, ay] = this._approach(player.x, player.y);
    this._move(dt, ax, ay, map);

    if (!this.trapSuppressed) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && projectileSystem) {
        const a = Math.atan2(player.y - this.y, player.x - this.x);
        projectileSystem.spawnEnemy(this.x, this.y, a, this.cfg.projectile_damage, this.cfg.projectile_speed, 500, this.cfg.color);
        this.fireTimer = 1 / this.cfg.projectile_fire_rate;
      }
    }
  }

  // ORANGE — moves toward player while shooting
  _updateOrange(dt, player, map, projectileSystem) {
    const [dx, dy] = this._approach(player.x, player.y);
    this._move(dt, dx, dy, map);

    // Shoot (suppressed inside Weaver traps)
    if (!this.trapSuppressed) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && projectileSystem) {
        const a = angle(this.x, this.y, player.x, player.y);
        projectileSystem.spawnEnemyHoming(this.x, this.y, a, this.cfg.projectile_damage, this.cfg.projectile_speed, 500, this.cfg.color);
        this.fireTimer = 1 / this.cfg.projectile_fire_rate;
      }
    }
  }

  // PINK (boss) — dash bursts every 3s, rapid fire
  _updatePink(dt, player, map, projectileSystem) {
    // ── Dash movement ──────────────────────────────────────────
    if (this.dashState === undefined) {
      this.dashState = 'cooldown';
      this.dashTimer = 1.0 + Math.random() * 1.5; // stagger first dash
      this.dashDirX  = 0;
      this.dashDirY  = 0;
    }

    this.dashTimer -= dt;

    if (this.dashState === 'cooldown' && this.dashTimer <= 0) {
      // Start dash — lock direction toward player at moment of dash
      this.dashState = 'dashing';
      this.dashTimer = 0.7;    // × 380 px/s ≈ 266px (doubled from 0.35s)
      const ddx = player.x - this.x, ddy = player.y - this.y;
      const dlen = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      this.dashDirX = ddx / dlen;
      this.dashDirY = ddy / dlen;
    } else if (this.dashState === 'dashing' && this.dashTimer <= 0) {
      this.dashState = 'cooldown';
      this.dashTimer = 3.0;
    }

    if (this.dashState === 'dashing') {
      this._move(dt, this.dashDirX, this.dashDirY, map, 380); // fast burst
    } else {
      this._move(dt, player.x - this.x, player.y - this.y, map); // slow drift
    }

    // ── Rapid projectile fire ─────────────────────────────────
    if (!this.trapSuppressed) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && projectileSystem) {
        const a = Math.atan2(player.y - this.y, player.x - this.x);
        projectileSystem.spawnEnemy(this.x, this.y, a, this.cfg.projectile_damage, this.cfg.projectile_speed, 600, this.cfg.color);
        this.fireTimer = 1 / this.cfg.projectile_fire_rate;
      }
    }
  }

  // Ghost of light: a soft body, a few drifting wisps and a pulsing core.
  // No outline, no eyes, no tail — the shape is carried by brightness alone.
  draw(ctx) {
    if (!this.alive) return;

    const cfg   = this.cfg;
    let   r     = this.drawSize;
    const t     = Date.now() / 1000 + this.id * 0.37;          // per-ghost phase offset
    const seed  = this.id * 2.39;
    const bx    = this.x, by = this.y - this.lift;
    // Hit glow: brightens toward white and fades smoothly — no hard flash
    const heat  = Math.pow(this.hitFlash / HIT_GLOW_TIME, 2);
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * pulseHz(this.type));
    const beat  = 0.85 + 0.15 * pulse;
    const col   = cfg.color;
    const k     = glowStrength(this.type);
    const hpK   = Math.max(0, Math.min(1, this.hp / this.maxHp));
    this._pulse = pulse;   // the halo pass breathes with the core
    const form  = easeOut(Math.min(1, this.spawnT / SPAWN_IN));

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Forming: motes of its colour drift in and gather where it will be
    if (form < 1) {
      ctx.fillStyle = col;
      for (let i = 0; i < 10; i++) {
        const a  = seed + i * 0.628 + form * 1.5;
        const rr = r * (0.6 + 2.6 * (1 - form)) * (0.7 + 0.3 * ((i * 7) % 3));
        ctx.globalAlpha = 0.9 * (1 - form * 0.8);
        ctx.fillRect(Math.round(bx + Math.cos(a) * rr) - 1, Math.round(by + Math.sin(a) * rr) - 1, 2, 2);
      }
    }
    const rFull = r;
    r = r * (0.35 + 0.65 * form);

    // Pool of its own light on the floor below (light casts glow, not shadow)
    const pool = haloSprite(cfg.glow_color, Math.round(rFull * 2), 0.35);
    ctx.globalAlpha = (0.55 + 0.45 * pulse) * form;
    ctx.drawImage(pool.canvas, this.x - r * 1.8, this.y + r * 0.35 - r * 0.7, r * 3.6, r * 1.4);
    ctx.globalAlpha = form;

    // (the wide outer glow is drawn in drawHalo, after the racks)
    for (let i = 0; i < 5; i++) {
      const a   = seed + i * 1.257 + Math.sin(t * 1.3 + i) * 0.4;
      const len = r * (1.3 + Math.sin(t * 2 + i * 2 + seed) * 0.3);
      drawGlow(ctx, col, bx + Math.cos(a) * len * 0.7, by + Math.sin(a) * len * 0.7 + r * 0.25, r * 0.9, 0.22 * k);
    }
    drawGlow(ctx, col, bx, by, r * 1.5, 0.55 * k * beat);
    // Small white core that shrinks as the ghost loses health
    drawGlow(ctx, '#ffffff', bx, by, r * 0.32 * (0.35 + 0.65 * hpK), 0.45 * beat);
    if (heat > 0) drawGlow(ctx, '#ffffff', bx, by, r * 1.0, 0.35 * k * heat);
    ctx.restore();

    // HP bar
    if (this.hp < this.maxHp && !this.forming) {
      this._drawHpBar(ctx);
    }
  }

  // Additive halo — breathes with the core; drawn in the glow pass after the racks
  drawHalo(ctx) {
    if (!this.alive) return;
    const form = easeOut(Math.min(1, this.spawnT / SPAWN_IN));
    const r = this.drawSize * (this.type === 'pink' ? 4 : 3.2) * (0.35 + 0.65 * form);
    drawGlow(ctx, this.cfg.glow_color, this.x, this.y - this.lift, r, 0.18 * form * glowStrength(this.type) * (0.85 + 0.15 * (this._pulse ?? 1)));
  }

  _drawHpBar(ctx) {
    const barW = this.size * 2.2;
    const barH = 3;
    const bx   = this.x - barW / 2;
    const by   = this.y - this.lift - this.size - 7;
    ctx.fillStyle = '#1E2130';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = this.cfg.color;
    ctx.fillRect(bx, by, barW * (this.hp / this.maxHp), barH);
  }
}

// ── Spawn System ─────────────────────────────────────────────

export class EnemySystem {
  constructor() {
    this.enemies          = [];
    this.spawnTimer       = 0;
    this.elapsedMin       = 0;
    this.manualSpawnMode  = false;  // true = wave system controls spawning
  }

  reset() {
    this.enemies    = [];
    this.spawnTimer = 0;
    this.elapsedMin = 0;
  }

  // Spawn a single enemy of the given type at a map edge (used by WaveSystem)
  spawnEnemy(type, map, player) {
    const positions = this.enemies.map(e => ({ x: e.x, y: e.y }));
    const spawnPos  = map.randomSpawn(player.x, player.y, positions);
    const e = new Enemy(type, spawnPos.x, spawnPos.y);
    e.scaleHp(this.elapsedMin);
    this.enemies.push(e);
    return e;
  }

  // Spawn at an explicit position (used by wave system after charge resolves)
  spawnEnemyAt(type, x, y) {
    const e = new Enemy(type, x, y);
    e.scaleHp(this.elapsedMin);
    this.enemies.push(e);
    return e;
  }

  _getMix(elapsedMin) {
    const brackets = CONFIG.population_time_brackets;
    let idx = 0;
    for (let i = 0; i < brackets.length; i++) {
      if (elapsedMin >= brackets[i]) idx = i;
    }
    return CONFIG.population_mix[idx];
  }

  _pickType(mix) {
    const types = ['violet', 'yellow', 'green', 'orange', 'pink'];
    return weightedPick(types, mix);
  }

  _currentSpawnInterval() {
    return Math.max(
      CONFIG.min_spawn_interval,
      CONFIG.base_spawn_interval - this.elapsedMin * CONFIG.spawn_acceleration
    );
  }

  update(dt, player, map, projectileSystem, particles) {
    this.elapsedMin = (window._gameElapsed || 0) / 60;

    // Auto-spawn only in legacy (non-wave) mode
    if (!this.manualSpawnMode) {
      this.spawnTimer += dt;
      const interval = this._currentSpawnInterval();
      if (this.spawnTimer >= interval && this.enemies.length < CONFIG.max_enemies) {
        this.spawnTimer = 0;
        this._spawnOne(player, map);
        // Occasional small groups
        if (Math.random() < 0.25 && this.enemies.length < CONFIG.max_enemies - 2) {
          this._spawnOne(player, map);
        }
      }
    }

    FLOW.update(dt, map, player);

    // The player's velocity (smoothed), for enemies that lead their target
    if (this._lastPX !== undefined && dt > 0) {
      const vx = (player.x - this._lastPX) / dt, vy = (player.y - this._lastPY) / dt;
      const pv = EnemySystem.playerVel || { x: 0, y: 0 };
      const k = Math.min(1, dt * 6);
      EnemySystem.playerVel = Math.hypot(vx, vy) > 2000 ? { x: 0, y: 0 } : { x: pv.x + (vx - pv.x) * k, y: pv.y + (vy - pv.y) * k };
    }
    this._lastPX = player.x; this._lastPY = player.y;

    // Personal space: each enemy is pushed gently away from close neighbours,
    // so a crowd spreads into a loose swarm instead of a queue
    const list = this.enemies;
    for (const e of list) { e._sepX = 0; e._sepY = 0; }
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const R = (a.size + b.size) * 2.6;
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (1 - d / R) * 1.8;
        a._sepX += dx / d * push; a._sepY += dy / d * push;
        b._sepX -= dx / d * push; b._sepY -= dy / d * push;
      }
    }

    // Update enemies
    for (const e of this.enemies) {
      e.update(dt, player, map, projectileSystem);
    }

    // Remove dead enemies; game.js spawns their Colour Drain
    const dead = this.enemies.filter(e => !e.isAlive);
    this.enemies = this.enemies.filter(e => e.isAlive);

    return dead;
  }

  _spawnOne(player, map) {
    const mix  = this._getMix(this.elapsedMin);
    let type   = this._pickType(mix);

    // Pink hard cap
    if (type === 'pink') {
      const pinkCount = this.enemies.filter(e => e.type === 'pink').length;
      if (pinkCount >= CONFIG.max_simultaneous_pinks) {
        type = 'orange'; // downgrade
      }
    }

    const positions = this.enemies.map(e => ({ x: e.x, y: e.y }));
    const spawnPos  = map.randomSpawn(player.x, player.y, positions);
    const e = new Enemy(type, spawnPos.x, spawnPos.y);
    e.scaleHp(this.elapsedMin);
    this.enemies.push(e);
  }

  // Check projectile hits against enemies (supports piercing).
  // player is optional — used for Volatile Signal and Short Squeeze trait effects.
  checkProjectileHits(projectiles, particles, player) {
    const killed = [];
    for (const proj of projectiles.playerProjectiles) {
      if (!proj.active) continue;
      for (const e of this.enemies) {
        if (!e.isAlive) continue;
        const dx = e.x - proj.x, dy = e.y - proj.y;
        if (dx * dx + dy * dy < (e.hitSize + 3) * (e.hitSize + 3)) {
          // ── Volatile Signal: bonus damage based on travel distance ──
          let dmg = proj.damage;
          if (player && player.volatileSignal) {
            const travelBonus = Math.min(0.5, (proj.traveled / 100) * 0.05);
            dmg += proj.damage * travelBonus;
          }

          const wasAlive = e.isAlive;
          e.takeDamage(dmg);

          // Knockback rounds shove the target along the shot (not into a rack)
          if (proj.knockback && e.isAlive) {
            const v = Math.hypot(proj.vx, proj.vy) || 1;
            const nx = e.x + proj.vx / v * proj.knockback, ny = e.y + proj.vy / v * proj.knockback;
            if (!FLOW.blocked || !FLOW.blocked[FLOW.cell(nx, ny)]) { e.x = nx; e.y = ny; }
            e.stunTimer = Math.max(e.stunTimer || 0, 0.3);
          }

          if (!e.isAlive) {
            killed.push(e);   // death effect: DrainSystem, spawned by game.js
          } else if (wasAlive && player && player.shortSqueeze) {
            // ── Short Squeeze: surviving enemies are slowed 30% for 3s ──
            e.slowFactor = 0.3;
            e.slowTimer  = 3.0;
          }

          // Piercing: reduce count rather than deactivate
          if (proj.piercing > 0) {
            proj.piercing--;
          } else {
            proj.active = false;
            break;
          }
        }
      }
    }
    return killed;
  }

  // Check enemy contact with player
  checkPlayerContact(player, particles) {
    if (!player.alive) return;
    for (const e of this.enemies) {
      if (!e.isAlive || e.forming) continue;
      // Only melee enemies deal contact damage (violet/yellow/green)
      if (e.type !== 'violet' && e.type !== 'yellow' && e.type !== 'green') continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const minDist = e.size + player.size / 2;
      if (dx * dx + dy * dy < minDist * minDist) {
        const damage = e.type === 'green' ? 7 : (e.type === 'yellow' ? 14 : 4);
        if (player.takeDamage(damage)) {
          particles.playerHit(player.x, player.y);
        }
      }
    }
  }

  draw(ctx) {
    for (const e of this.enemies) {
      e.draw(ctx);
    }
  }

  drawHalos(ctx) {
    for (const e of this.enemies) e.drawHalo(ctx);
  }

  countByType(type) {
    return this.enemies.filter(e => e.type === type).length;
  }
}
