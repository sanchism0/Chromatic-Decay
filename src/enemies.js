// CHROMATIC DECAY — Enemies & Spawn System

import { CONFIG } from './config.js';
import { clamp, dist, distSq, angle, normalize, circleVsRect, weightedPick } from './utils.js';
import { drawEnemyShape } from './utils.js';

let _nextId = 0;

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
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

    switch (this.type) {
      case 'violet': this._updateViolet(dt, player, map); break;
      case 'yellow': this._updateYellow(dt, player, map); break;
      case 'green':  this._updateGreen(dt, player, map, projectileSystem); break;
      case 'orange': this._updateOrange(dt, player, map, projectileSystem); break;
      case 'pink':   this._updatePink(dt, player, map, projectileSystem); break;
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

    const cfg      = this.cfg;
    const _mob     = 'ontouchstart' in window;
    const drawSize = _mob ? cfg.size * 1.35 : cfg.size;

    // Movement trail — fading dots behind the enemy
    const tLen = this._trail.length;
    if (tLen > 1) {
      for (let i = 0; i < tLen - 1; i++) {
        const pt    = this._trail[i];
        const frac  = (i + 1) / tLen;          // 0 = oldest, 1 = newest
        const r     = drawSize * 0.28 * frac;
        const alpha = frac * 0.55;
        ctx.globalAlpha  = alpha;
        ctx.shadowBlur   = 0;
        ctx.fillStyle    = cfg.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1, r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // Hit flash — white overlay
    const flashColor = this.hitFlash > 0 ? '#FFFFFF' : cfg.color;

    // Glow
    ctx.shadowBlur = this.type === 'pink' ? 20 : 10;
    ctx.shadowColor = cfg.glow_color;

    ctx.strokeStyle = cfg.edge_color;
    ctx.lineWidth = this.type === 'pink' ? 2.5 : 1.5;
    ctx.fillStyle = flashColor;

    drawEnemyShape(ctx, cfg.shape, 0, 0, drawSize);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
    ctx.shadowBlur = 0;

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

  _drawHpBar(ctx) {
    const barW = this.size * 2.2;
    const barH = 3;
    const bx   = this.x - barW / 2;
    const by   = this.y - this.size - 7;
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

  countByType(type) {
    return this.enemies.filter(e => e.type === type).length;
  }
}
