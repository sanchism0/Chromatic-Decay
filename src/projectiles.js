// CHROMATIC DECAY — Projectile System

import { CONFIG } from './config.js';
import { clamp } from './utils.js';

class Projectile {
  constructor() { this.active = false; }

  init(x, y, angle, damage, speed, range, isPlayer, color = '#FFFFFF', piercing = 0, bounce = false, homing = false) {
    this.x        = x;
    this.y        = y;
    this.vx       = Math.cos(angle) * speed;
    this.vy       = Math.sin(angle) * speed;
    this.damage   = damage;
    this.speed    = speed;
    this.range    = range;
    this.traveled = 0;
    this.isPlayer = isPlayer;
    this.color    = color;
    this.piercing = piercing;   // hits remaining after first
    this.bounce   = bounce;     // reflect off map edges
    this.homing   = homing;     // tracks toward player
    this.active   = true;
  }
}

export class ProjectileSystem {
  constructor() {
    // Object pools — separate for player vs enemy
    this._pool = Array.from({ length: 400 }, () => new Projectile());
  }

  get playerProjectiles() {
    return this._pool.filter(p => p.active && p.isPlayer);
  }

  get enemyProjectiles() {
    return this._pool.filter(p => p.active && !p.isPlayer);
  }

  _getFree() {
    return this._pool.find(p => !p.active) || null;
  }

  spawnPlayer(x, y, angle, damage, speed, range, piercing = 0, bounce = false) {
    const p = this._getFree();
    if (p) p.init(x, y, angle, damage, speed, range, true, '#FFFFFF', piercing, bounce);
  }

  spawnEnemy(x, y, angle, damage, speed, range, color) {
    const p = this._getFree();
    if (p) p.init(x, y, angle, damage, speed, range, false, color);
  }

  spawnEnemyHoming(x, y, angle, damage, speed, range, color) {
    const p = this._getFree();
    if (p) p.init(x, y, angle, damage, speed, range, false, color, 0, false, true);
  }

  update(dt, map, player) {
    for (const p of this._pool) {
      if (!p.active) continue;

      // Homing: steer toward player
      if (p.homing && player && player.alive) {
        const hdx = player.x - p.x, hdy = player.y - p.y;
        const hlen = Math.sqrt(hdx * hdx + hdy * hdy) || 1;
        const tx = (hdx / hlen) * p.speed, ty = (hdy / hlen) * p.speed;
        const turnRate = 3.5; // radians/sec
        p.vx += (tx - p.vx) * Math.min(1, turnRate * dt);
        p.vy += (ty - p.vy) * Math.min(1, turnRate * dt);
        // Re-normalize to constant speed
        const vlen = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
        p.vx = (p.vx / vlen) * p.speed;
        p.vy = (p.vy / vlen) * p.speed;
      }

      const prevX = p.x, prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Distance traveled
      const ddx = p.x - prevX, ddy = p.y - prevY;
      p.traveled += Math.sqrt(ddx * ddx + ddy * ddy);

      // Out of range
      if (p.traveled >= p.range) { p.active = false; continue; }

      // Map boundary
      if (p.x < 0 || p.x > CONFIG.map_width || p.y < 0 || p.y > CONFIG.map_height) {
        if (p.bounce && p.isPlayer) {
          // Reflect off the edge
          if (p.x < 0 || p.x > CONFIG.map_width)  p.vx = -p.vx;
          if (p.y < 0 || p.y > CONFIG.map_height) p.vy = -p.vy;
          p.x = clamp(p.x, 0, CONFIG.map_width);
          p.y = clamp(p.y, 0, CONFIG.map_height);
          p.bounce = false;  // only bounce once
        } else {
          p.active = false;
          continue;
        }
      }

      // Obstacle collision
      for (const obs of map.obstacles) {
        if (p.x >= obs.x && p.x <= obs.x + obs.w &&
            p.y >= obs.y && p.y <= obs.y + obs.h) {
          p.active = false;
          break;
        }
      }
    }
  }

  // Player bullets destroy enemy bullets on collision (unless piercing)
  checkBulletCollisions(particles) {
    for (const pp of this.playerProjectiles) {
      for (const ep of this.enemyProjectiles) {
        const dx = pp.x - ep.x, dy = pp.y - ep.y;
        if (dx * dx + dy * dy < 64) { // ~8px combined radius
          if (particles) particles.bulletCollision((pp.x + ep.x) / 2, (pp.y + ep.y) / 2);
          ep.active = false;
          if (pp.piercing > 0) {
            pp.piercing--;
          } else {
            pp.active = false;
          }
        }
      }
    }
  }

  // Check enemy projectiles vs player
  checkPlayerHits(player, particles) {
    if (!player.alive) return;
    const r = player.size / 2 + 3;
    for (const p of this._pool) {
      if (!p.active || p.isPlayer) continue;
      const dx = p.x - player.x, dy = p.y - player.y;
      if (dx * dx + dy * dy < r * r) {
        p.active = false;
        if (player.takeDamage(p.damage)) {
          particles.playerHit(player.x, player.y);
        }
      }
    }
  }

  reset() {
    for (const p of this._pool) p.active = false;
  }

  draw(ctx) {
    for (const p of this._pool) {
      if (!p.active) continue;

      if (p.isPlayer) {
        const nx = -p.vx / p.speed, ny = -p.vy / p.speed;
        const trailAlphas = [0.12, 0.22, 0.35];
        for (let i = 0; i < 3; i++) {
          const td = (i + 1) * 6;
          ctx.globalAlpha = trailAlphas[i];
          ctx.fillStyle = '#E8F0FF';
          ctx.fillRect(p.x + nx * td - 1.5, p.y + ny * td - 1.5, 3, 3);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 6;
        ctx.shadowColor = '#FFFFFF';
        ctx.fillStyle   = '#FFFFFF';
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        ctx.shadowBlur  = 0;
      } else {
        ctx.shadowBlur  = 8;
        ctx.shadowColor = p.color;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur  = 0;
      }
    }
    ctx.globalAlpha = 1;
  }
}
