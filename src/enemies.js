// CHROMATIC DECAY — Enemies & Spawn System

import { CONFIG } from './config.js';
import { clamp, dist, distSq, angle, normalize, circleVsRect, weightedPick } from './utils.js';
import { haloSprite, drawSprite, mix, rgba } from './sprites.js';

let _nextId = 0;

// ── Light-wave profiles ──────────────────────────────────────
// Each Chromatic is drawn as the light it is made of, and its colour's
// wavelength sets its form. Frequency = c / λ; higher frequency means more
// ripples around the body, a faster shimmer, a quicker core pulse and tighter
// waves in the tail. The ordering is physical; the spread is exaggerated so
// the types read apart (violet 12 crests → orange 3).
// Magenta has no single wavelength — the eye only sees it when red and violet
// mix — so the pink boss is two interfering waves pulsing at their beat
// frequency (the difference between the two).

const C_NM_THZ = 299792;   // speed of light, nm·THz

function _waveFor(nm) {
  const f = C_NM_THZ / nm;                              // THz
  const k = Math.max(0, (f - 470) / (740 - 470));       // 0 deep red … 1 violet
  return {
    f,
    crests:     Math.max(2, Math.round(2 + 10 * k)),
    speed:      f / 100,     // rim shimmer, rad/s
    tailCycles: f / 300,     // wave cycles along the tail
  };
}

const _profiles = {};
function waveProfile(type) {
  if (_profiles[type]) return _profiles[type];
  const cfg   = CONFIG.enemies[type];
  const waves = [].concat(cfg.wavelength_nm).map(_waveFor);
  const isMix = waves.length > 1;
  const strandColors = isMix ? ['#ff2a3c', '#6a2cff'] : [cfg.color];
  // Tail tendrils: three thin wisps for a pure wave; the boss braids its
  // red and violet strands
  const strands = isMix
    ? waves.map((w, i) => ({ color: strandColors[i], cycles: w.tailCycles, speed: w.speed, offset: i * Math.PI, spread: (i ? 1 : -1) * 0.12, len: 1.15, width: 0.75 }))
    : [[-0.38, 0.85, 0.45], [0, 1.15, 0.65], [0.38, 0.8, 0.45]].map(([spread, len, width], i) => ({
        color: cfg.color, cycles: waves[0].tailCycles, speed: waves[0].speed, offset: i * 2.1, spread, len, width,
      }));
  return (_profiles[type] = {
    modes:   waves.map((w, i) => ({ n: w.crests, amp: isMix ? 0.08 : 0.12, speed: (i % 2 ? -1 : 1) * w.speed })),
    pulseHz: isMix ? Math.abs(waves[0].f - waves[1].f) / 400 : waves[0].f / 400,
    strands,
  });
}

function _lerpAngle(a, b, t) {
  let d = b - a;
  while (d >  Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ── Base Enemy ───────────────────────────────────────────────

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

    // Beam state (Pink only)
    this.beamPhase    = 'idle'; // idle | charge | fire
    this.beamTimer    = 0;
    this.beamTargetX  = 0;
    this.beamTargetY  = 0;
    this.beamCooldown = 0;

    // Movement trail
    this._trail = [];
  }

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
    this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.alive = false;
    }
  }

  // ── Per-type update ──────────────────────────────────────────

  update(dt, player, map, projectileSystem) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);

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

    const pdx = player.x - this.x;
    const pdy = player.y - this.y;
    this._look = Math.atan2(pdy, pdx);   // eyes track the player

    switch (this.type) {
      case 'violet': this._updateViolet(dt, player, map); break;
      case 'yellow': this._updateYellow(dt, player, map); break;
      case 'green':  this._updateGreen(dt, player, map, projectileSystem); break;
      case 'orange': this._updateOrange(dt, player, map, projectileSystem); break;
      case 'pink':   this._updatePink(dt, player, map, projectileSystem); break;
    }

    // Heading from recent movement — the tail streams out behind it
    const tr = this._trail;
    if (tr.length >= 4) {
      const a = tr[tr.length - 4], b = tr[tr.length - 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) > 0.5) {
        const target = Math.atan2(b.y - a.y, b.x - a.x);
        this._heading = this._heading === undefined ? target : _lerpAngle(this._heading, target, Math.min(1, dt * 6));
      }
    }
  }

  _move(dt, dx, dy, map, speedOverride) {
    const n = normalize(dx, dy);
    const combinedSlow = Math.max(this.trapSlow || 0, this.slowFactor || 0);
    const spd = (speedOverride !== undefined ? speedOverride : this.cfg.move_speed) * (1 - combinedSlow);
    const step = spd * dt;

    // ── Wall-steering ────────────────────────────────────────────
    // Probe ahead along the current steered direction. If blocked, rotate the
    // steer angle around the obstacle. Once clear, decay back to the direct path.
    if (this._steerAngle === undefined) { this._steerAngle = 0; this._stuckTimer = 0; }

    const baseAngle = Math.atan2(n.y, n.x);
    const probeDist = Math.max(30, this.size * 2.5);
    const probeX    = this.x + Math.cos(baseAngle + this._steerAngle) * probeDist;
    const probeY    = this.y + Math.sin(baseAngle + this._steerAngle) * probeDist;
    let probeHit    = false;
    for (const obs of map.obstacles) {
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
    this._trail.push({ x: this.x, y: this.y });
    if (this._trail.length > 14) this._trail.shift();
  }

  // VIOLET — slow drift toward player (doesn't know what it's doing, still coming for you)
  _updateViolet(dt, player, map) {
    this._move(dt, player.x - this.x, player.y - this.y, map);
  }

  // YELLOW — persistent drift toward player, slightly faster than Violet
  _updateYellow(dt, player, map) {
    this._move(dt, player.x - this.x, player.y - this.y, map);
  }

  // GREEN — chase at full speed and shoot straight ahead
  _updateGreen(dt, player, map, projectileSystem) {
    this._move(dt, player.x - this.x, player.y - this.y, map);

    if (!this.trapSuppressed) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && projectileSystem) {
        const a = Math.atan2(player.y - this.y, player.x - this.x);
        projectileSystem.spawnEnemy(this.x, this.y, a, this.cfg.projectile_damage, 220, 500, this.cfg.color);
        this.fireTimer = 1 / this.cfg.projectile_fire_rate;
      }
    }
  }

  // ORANGE — moves toward player while shooting
  _updateOrange(dt, player, map, projectileSystem) {
    const dx = player.x - this.x, dy = player.y - this.y;
    this._move(dt, dx, dy, map);

    // Shoot (suppressed inside Weaver traps)
    if (!this.trapSuppressed) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && projectileSystem) {
        const a = angle(this.x, this.y, player.x, player.y);
        projectileSystem.spawnEnemyHoming(this.x, this.y, a, this.cfg.projectile_damage, 180, 500, this.cfg.color);
        this.fireTimer = 1 / this.cfg.projectile_fire_rate;
      }
    }
  }

  // PINK (boss) — dash bursts every 3s, rapid fire, sustained beam
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
      this.dashTimer = 0.35;
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
        projectileSystem.spawnEnemy(this.x, this.y, a, this.cfg.projectile_damage, 200, 600, this.cfg.color);
        this.fireTimer = 1 / this.cfg.projectile_fire_rate;
      }
    }

    // ── Beam ──────────────────────────────────────────────────
    this.beamCooldown = Math.max(0, this.beamCooldown - dt);

    if (this.beamPhase === 'idle' && this.beamCooldown <= 0) {
      this.beamPhase   = 'charge';
      this.beamTimer   = 0.5;
      this.beamTargetX = player.x;
      this.beamTargetY = player.y;
    }

    if (this.beamPhase === 'charge') {
      this.beamTargetX = player.x;
      this.beamTargetY = player.y;
      this.beamTimer -= dt;
      if (this.beamTimer <= 0) {
        this.beamPhase = 'fire';
        this.beamTimer = 0.8;
      }
    }

    if (this.beamPhase === 'fire') {
      this.beamTimer -= dt;
      if (projectileSystem && this._playerInBeam(player)) {
        player.takeDamage((this.cfg.beam_damage ?? this.cfg.projectile_damage) * dt);
      }
      if (this.beamTimer <= 0) {
        this.beamPhase    = 'idle';
        this.beamCooldown = 1.5;
      }
    }
  }

  _playerInBeam(player) {
    // Distance from player to the line between this enemy and beam target
    const bx = this.beamTargetX - this.x, by = this.beamTargetY - this.y;
    const len = Math.sqrt(bx * bx + by * by);
    if (len === 0) return false;
    const t = clamp(((player.x - this.x) * bx + (player.y - this.y) * by) / (len * len), 0, 1);
    const cx = this.x + t * bx - player.x;
    const cy = this.y + t * by - player.y;
    return cx * cx + cy * cy < 18 * 18;
  }

  draw(ctx) {
    if (!this.alive) return;

    const cfg   = this.cfg;
    const r     = this.drawSize;
    const wave  = waveProfile(this.type);
    const t     = Date.now() / 1000 + this.id * 0.37;          // per-ghost phase offset
    const bx    = this.x, by = this.y - this.lift;
    const flash = this.hitFlash > 0;
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * wave.pulseHz);
    const look  = this._look ?? 0;
    const head  = this._heading ?? look;
    this._pulse = pulse;   // the halo pass breathes with the core

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Pool of its own light on the floor below (light casts glow, not shadow)
    const pool = haloSprite(cfg.glow_color, Math.round(r * 2), 0.35);
    ctx.globalAlpha = 0.55 + 0.45 * pulse;
    ctx.drawImage(pool.canvas, this.x - r * 1.8, this.y + r * 0.35 - r * 0.7, r * 3.6, r * 1.4);
    ctx.globalAlpha = 1;

    for (const strand of wave.strands) this._drawTail(ctx, bx, by, r, head, t, strand, flash);

    // Chromatic glitch — every so often the signal tears into offset copies
    const glitch = Math.sin(t * 2.3 + this.id * 1.7) * Math.sin(t * 5.1) > 0.82;
    if (glitch && !flash) {
      const j = r * 0.35;
      ctx.globalAlpha = 0.6;
      this._drawBody(ctx, bx - j, by, r, t + 0.2, wave, false, pulse, head);
      this._drawBody(ctx, bx + j, by + j * 0.3, r, t - 0.2, wave, false, pulse, head);
      ctx.globalAlpha = 1;
    }
    this._drawBody(ctx, bx, by, r, t, wave, flash, pulse, head);
    this._drawCore(ctx, bx, by, r, pulse);
    ctx.restore();

    this._drawEyes(ctx, bx, by, r, look, t, pulse);

    // Pink boss beam
    if (this.type === 'pink' && this.beamPhase !== 'idle') {
      this._drawBeam(ctx);
    }

    // HP bar
    if (this.hp < this.maxHp) {
      this._drawHpBar(ctx);
    }
  }

  _drawBeam(ctx) {
    const isCharge = this.beamPhase === 'charge';
    ctx.save();
    ctx.globalAlpha = isCharge ? 0.4 : 0.85;
    ctx.strokeStyle = isCharge ? '#ff6aaa' : '#f81d78';
    ctx.lineWidth   = isCharge ? 2 : 5;
    ctx.shadowBlur  = isCharge ? 6 : 18;
    ctx.shadowColor = '#f81d78';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.beamTargetX, this.beamTargetY);
    ctx.stroke();
    if (!isCharge) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 2;
      ctx.stroke();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // Tail — a transverse wave streaming behind the heading. Its cycles along
  // the length scale with frequency, so short wavelengths ripple tighter.
  // Soft-edged too: a wide faint layer under a narrow brighter one, so the
  // sides fade rather than end in a line.
  _drawTail(ctx, bx, by, r, heading, t, s, flash) {
    const back = heading + Math.PI + s.spread;
    const ux = Math.cos(back), uy = Math.sin(back);   // along the tail
    const px = -uy, py = ux;                          // across it
    const L = r * 3.0 * s.len, N = 14;
    const col = flash ? '#ffffff' : s.color;

    for (const [widthScale, peak] of [[1.0, 0.22], [0.5, 0.35]]) {
      const left = [], right = [];
      for (let i = 0; i <= N; i++) {
        const f    = i / N;
        const w    = r * 0.85 * s.width * widthScale * Math.pow(1 - f, 1.3);
        const sway = r * 0.45 * f * Math.sin(Math.PI * 2 * s.cycles * f - t * s.speed + s.offset);
        const cx   = bx + ux * f * L + px * sway;
        const cy   = by + uy * f * L + py * sway;
        left.push(cx + px * w, cy + py * w);
        right.push(cx - px * w, cy - py * w);
      }
      ctx.beginPath();
      ctx.moveTo(left[0], left[1]);
      for (let i = 2; i < left.length; i += 2) ctx.lineTo(left[i], left[i + 1]);
      for (let i = right.length - 2; i >= 0; i -= 2) ctx.lineTo(right[i], right[i + 1]);
      ctx.closePath();
      // Fades in only beyond the body, so the overlap leaves no seam
      const grad = ctx.createLinearGradient(bx, by, bx + ux * L, by + uy * L);
      grad.addColorStop(0,    rgba(col, 0,    '#ffffff', 0.2));
      grad.addColorStop(0.22, rgba(col, 0,    '#ffffff', 0.2));
      grad.addColorStop(0.45, rgba(col, peak, '#ffffff', 0.2));
      grad.addColorStop(1,    rgba(col, 0,    '#ffffff', 0.2));
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  // Body — no outline. Stacked layers of faint light, each a standing wave
  // (crests set by wavelength) with a slightly shifted phase, so the shape is
  // carried by brightness and the edge dissolves instead of ending in a line.
  _drawBody(ctx, bx, by, r, t, wave, flash, pulse, heading) {
    const N      = 40;
    const back   = heading + Math.PI;
    const col    = flash ? '#ffffff' : this.cfg.color;
    const layers = [            // scale, alpha, whiten
      [1.3,  0.05, 0.0],
      [1.1,  0.08, 0.1],
      [0.9,  0.11, 0.2],
      [0.68, 0.15, 0.35],
      [0.45, 0.2,  0.55],
    ];
    layers.forEach(([scale, alpha, whiten], li) => {
      const ph = t + li * 0.35;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * Math.PI * 2;
        // Slow organic wobble + the wavelength's standing wave
        let k = 1 + 0.07 * Math.sin(2 * th + ph * 1.3) + 0.04 * Math.sin(3 * th - ph * 0.9);
        for (const m of wave.modes) k += m.amp * Math.sin(m.n * th + ph * m.speed);
        // Wraith silhouette: the back of the body drags out toward the tail
        const drag = Math.max(0, Math.cos(th - back));
        const rr = r * scale * k * (1 + 0.55 * drag * drag);
        const x = bx + Math.cos(th) * rr, y = by + Math.sin(th) * rr;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(col, alpha * (0.8 + 0.4 * pulse), '#ffffff', whiten);
      ctx.fill();
    });
  }

  // Core — the hot centre of the light; its pulse drives the glow
  _drawCore(ctx, bx, by, r, pulse) {
    const halo = haloSprite(this.cfg.glow_color, Math.max(4, Math.round(r * 1.1)), 0.9);
    ctx.globalAlpha = 0.25 + 0.75 * pulse;
    drawSprite(ctx, halo, bx, by);
    drawSprite(ctx, haloSprite('#ffffff', Math.max(3, Math.round(r * 0.6)), 0.9), bx, by);
    ctx.globalAlpha = 1;
    ctx.fillStyle = mix(this.cfg.color, '#ffffff', 0.85);
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.15 * (0.7 + 0.6 * pulse), 0, Math.PI * 2);
    ctx.fill();
  }

  // Face — narrow angled eye-slits with a pinprick of light deep inside, and a
  // ragged, too-wide grin. All track the player; the eyes rarely blink.
  _drawEyes(ctx, bx, by, r, look, t, pulse) {
    const blink = Math.sin(t * 0.9 + this.id) > 0.97 ? 0.15 : 1;
    const fx = Math.cos(look), fy = Math.sin(look);   // toward the player ("down" the face)
    const lx = -fy, ly = fx;                           // across the face
    const at = (f, l) => [bx + fx * r * f + lx * r * l, by + fy * r * f + ly * r * l];

    // The face surfaces in the light and sinks back again
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * (0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.6 + this.id * 1.3), 0.6));

    // Soft void: faint wide ellipse under a darker core — no outline
    const voidAt = (x, y, rx, ry, rot, a) => {
      for (const [sc, k] of [[1.5, 0.3], [1, 1]]) {
        ctx.fillStyle = `rgba(3,0,10,${a * k})`;
        ctx.beginPath();
        ctx.ellipse(x, y, rx * sc, ry * sc, rot, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Eye slits — long across the face, thin, inner ends tilted toward the mouth
    const eyes = [-1, 1].map(side => at(0.12, 0.34 * side));
    eyes.forEach(([x, y], i) => {
      const side = i ? 1 : -1;
      voidAt(x, y, r * 0.09 * blink, r * 0.27, look - 0.55 * side, 0.9);
    });

    // Grin — a thin, crooked, ragged rip; one corner hitches higher than the other
    const M = 14, half = 0.52, gape = 0.6 + 0.4 * Math.sin(t * 1.3 + this.id * 2);
    const top = [], bot = [];
    for (let i = 0; i <= M; i++) {
      const u     = i / M * 2 - 1;                                    // -1 … 1 across
      const curve = 0.56 - 0.16 * u * u - 0.08 * u;                   // crooked pull-back
      const thick = (0.015 + 0.045 * (1 - u * u) * gape) *
                    (0.5 + 0.5 * Math.abs(Math.sin(u * 11 + t * 5)));  // ragged edge
      top.push(at(curve - thick, u * half));
      bot.push(at(curve + thick, u * half));
    }
    ctx.fillStyle = 'rgba(3,0,10,0.65)';
    ctx.beginPath();
    ctx.moveTo(...top[0]);
    for (const p of top.slice(1)) ctx.lineTo(...p);
    for (const p of bot.reverse()) ctx.lineTo(...p);
    ctx.closePath();
    ctx.fill();

    // Pinprick glints — barely-there cold lights deep in the dark
    if (blink === 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(this.cfg.color, 0.2 + 0.25 * pulse, '#ffffff', 0.5);
      for (const [x, y] of eyes) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, r * 0.035), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = prevAlpha;
  }

  // Additive halo — breathes with the core; drawn in the glow pass after the racks
  drawHalo(ctx) {
    if (!this.alive) return;
    const isPink = this.type === 'pink';
    const halo   = haloSprite(this.cfg.glow_color, Math.round(this.drawSize * (isPink ? 4 : 3.2)), isPink ? 0.35 : 0.28);
    const prev   = ctx.globalAlpha;
    ctx.globalAlpha = prev * (0.55 + 0.45 * (this._pulse ?? 1));
    drawSprite(ctx, halo, this.x, this.y - this.lift);
    ctx.globalAlpha = prev;
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

    // Update enemies
    for (const e of this.enemies) {
      e.update(dt, player, map, projectileSystem);
    }

    // Remove dead enemies, spawn particles + residuals
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

          if (!e.isAlive) {
            particles.enemyDeath(e.x, e.y, e.cfg.color);
            killed.push(e);
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
      if (!e.isAlive) continue;
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
