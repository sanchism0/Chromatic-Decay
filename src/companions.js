// CHROMATIC DECAY — Herald Companion System
// Orbiting damage-absorbing orbs that explode on expiry

import { dist } from './utils.js';

const ORB_BASE_HP       = 30;
const ORB_BASE_DURATION = 8;    // seconds
const ORB_BASE_RADIUS   = 50;   // orbit radius (world px)
const ORB_EXPIRY_DAMAGE = 40;   // AoE damage on expiry
const ORB_EXPIRY_RADIUS = 80;   // AoE radius on expiry
const ORB_ORBIT_SPEED   = 1.4;  // radians/sec base

export class CompanionSystem {
  constructor() {
    this.orbs     = [];
    this._idSeq   = 0;

    // Tunable — modified by Herald traits
    this.maxOrbs                  = 3;
    this.orbDuration              = ORB_BASE_DURATION;
    this.orbHpMultiplier          = 1.0;
    this.orbitSpeed               = ORB_ORBIT_SPEED;
    this.expiryDamageMultiplier   = 1.0;
    this.expiryRadiusMultiplier   = 1.0;
    this.expiryHeal               = 0;
    this.killExtend               = 0;   // extra seconds added per kill near orb
  }

  reset() {
    this.orbs                   = [];
    this.maxOrbs                = 3;
    this.orbDuration            = ORB_BASE_DURATION;
    this.orbHpMultiplier        = 1.0;
    this.orbitSpeed             = ORB_ORBIT_SPEED;
    this.expiryDamageMultiplier = 1.0;
    this.expiryRadiusMultiplier = 1.0;
    this.expiryHeal             = 0;
    this.killExtend             = 0;
  }

  get count() { return this.orbs.length; }

  // Add one orb orbiting the player
  addOrb(player) {
    if (this.orbs.length >= this.maxOrbs) return;

    // Distribute orbs evenly around the orbit
    const angleOffset = (this.orbs.length / this.maxOrbs) * Math.PI * 2;

    this.orbs.push({
      id:       this._idSeq++,
      angle:    angleOffset,
      hp:       Math.round(ORB_BASE_HP * this.orbHpMultiplier),
      maxHp:    Math.round(ORB_BASE_HP * this.orbHpMultiplier),
      life:     this.orbDuration,
      maxLife:  this.orbDuration,
      hitFlash: 0,
    });
  }

  // Called by game.js when a kill happens near an orb
  notifyKill(killX, killY) {
    if (this.killExtend <= 0) return;
    for (const orb of this.orbs) {
      // Orb world position computed using player — passed via update below
      // We store last world position for range checks
      if (orb._worldX !== undefined) {
        const d = dist(killX, killY, orb._worldX, orb._worldY);
        if (d < 120) {
          orb.life = Math.min(orb.life + this.killExtend, orb.maxLife * 2);
        }
      }
    }
  }

  // Main update. Returns array of expiry events {x, y, damage, radius, heal}
  update(dt, player, enemies, particles) {
    const expiries = [];

    for (const orb of this.orbs) {
      orb.life     -= dt;
      orb.angle    += this.orbitSpeed * dt;
      orb.hitFlash  = Math.max(0, orb.hitFlash - dt);

      // World position
      orb._worldX = player.x + Math.cos(orb.angle) * ORB_BASE_RADIUS;
      orb._worldY = player.y + Math.sin(orb.angle) * ORB_BASE_RADIUS;

      // Absorb incoming enemy projectiles
      // (Actual projectile deflection done in game.js via checkOrbHits)

      // Expire?
      if (orb.life <= 0 || orb.hp <= 0) {
        expiries.push({
          x:      orb._worldX,
          y:      orb._worldY,
          damage: ORB_EXPIRY_DAMAGE * this.expiryDamageMultiplier,
          radius: ORB_EXPIRY_RADIUS * this.expiryRadiusMultiplier,
          heal:   this.expiryHeal,
        });
        orb._dead = true;
      }
    }

    // Apply expiry AoE
    for (const ev of expiries) {
      // Damage enemies in range
      for (const e of enemies.enemies) {
        if (!e.isAlive) continue;
        if (dist(e.x, e.y, ev.x, ev.y) < ev.radius + e.size) {
          e.takeDamage(ev.damage);
        }
      }
      // Heal player
      if (ev.heal > 0) player.heal(ev.heal);
      // Visual burst
      if (particles) particles.classEmergence(ev.x, ev.y, '#fddede');
    }

    this.orbs = this.orbs.filter(o => !o._dead);

    return expiries;
  }

  // Check if enemy projectiles hit any orb — deactivates projectile, damages orb
  checkProjectileHits(projectiles) {
    for (const p of projectiles._pool) {
      if (!p.active || p.isPlayer) continue;
      for (const orb of this.orbs) {
        if (orb._worldX === undefined) continue;
        const dx = p.x - orb._worldX, dy = p.y - orb._worldY;
        if (dx * dx + dy * dy < 12 * 12) {
          p.active   = false;
          orb.hp    -= p.damage;
          orb.hitFlash = 0.15;
          break;
        }
      }
    }
  }

  draw(ctx) {
    for (const orb of this.orbs) {
      if (orb._worldX === undefined) continue;

      const sx = orb._worldX, sy = orb._worldY;
      const lifeRatio = orb.life / orb.maxLife;
      const hpRatio   = orb.hp   / orb.maxHp;
      const pulse     = (Math.sin(Date.now() * 0.004) * 0.5 + 0.5);
      const flash     = orb.hitFlash > 0;

      // Outer ring
      ctx.globalAlpha = 0.4 + pulse * 0.3;
      ctx.strokeStyle = flash ? '#FFFFFF' : '#fddede';
      ctx.lineWidth   = 1.5;
      ctx.shadowBlur  = 12;
      ctx.shadowColor = '#fddede';
      ctx.beginPath();
      ctx.arc(sx, sy, 10 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();

      // Core
      ctx.globalAlpha = 0.85;
      ctx.fillStyle   = flash ? '#FFFFFF' : '#c85050';
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fill();

      // Bright center
      ctx.fillStyle  = '#FFEEEE';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;

      // Life bar (arc)
      const startA = -Math.PI / 2;
      const endA   = startA + Math.PI * 2 * lifeRatio;
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#fddede';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 13, startA, endA);
      ctx.stroke();

      // HP bar (tiny below orb)
      if (hpRatio < 1) {
        ctx.globalAlpha = 0.8;
        ctx.fillStyle   = '#1E2130';
        ctx.fillRect(sx - 8, sy + 16, 16, 2);
        ctx.fillStyle = '#c85050';
        ctx.fillRect(sx - 8, sy + 16, 16 * hpRatio, 2);
      }

      ctx.globalAlpha = 1;
    }
  }
}
