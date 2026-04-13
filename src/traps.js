// CHROMATIC DECAY — Weaver Trap System
// Placeable slow zones — activated by ability key at player's feet

import { dist } from './utils.js';

const TRAP_BASE_RADIUS   = 55;    // world px
const TRAP_BASE_SLOW     = 0.50;  // enemies move at 50% speed inside
const TRAP_BASE_DURATION = 8;     // seconds
const TRAP_FADE_IN       = 0.3;

export class TrapSystem {
  constructor() {
    this.traps     = [];
    this._idSeq    = 0;

    // Tunable — modified by Weaver traits
    this.maxTraps       = 2;
    this.slowStrength   = TRAP_BASE_SLOW;
    this.trapDuration   = TRAP_BASE_DURATION;
    this.trapDamage     = 0;     // damage per second to enemies inside
    this.expiryBurst    = false; // deal AoE on expiry
    this.suppressFire   = false; // enemies inside can't shoot
    this.stealth        = false; // traps invisible until triggered
  }

  reset() {
    this.traps        = [];
    this.maxTraps     = 2;
    this.slowStrength = TRAP_BASE_SLOW;
    this.trapDuration = TRAP_BASE_DURATION;
    this.trapDamage   = 0;
    this.expiryBurst  = false;
    this.suppressFire = false;
    this.stealth      = false;
  }

  get count() { return this.traps.length; }

  // Place a trap at player's position
  place(x, y) {
    if (this.traps.length >= this.maxTraps) {
      // Remove oldest trap to make room
      this.traps.shift();
    }

    this.traps.push({
      id:          this._idSeq++,
      x,
      y,
      life:        this.trapDuration,
      maxLife:     this.trapDuration,
      fadeIn:      TRAP_FADE_IN,
      triggered:   false,   // for stealth — becomes true when an enemy enters
    });
  }

  // Returns array of expiry events for game.js to handle
  update(dt, enemies, particles) {
    const expiries = [];

    for (const trap of this.traps) {
      trap.life   -= dt;
      trap.fadeIn  = Math.max(0, trap.fadeIn - dt);

      if (trap.life <= 0) {
        expiries.push({ x: trap.x, y: trap.y });
        trap._dead = true;
        continue;
      }

      // Apply effects to enemies inside radius
      for (const e of enemies.enemies) {
        if (!e.isAlive) continue;
        const d = dist(e.x, e.y, trap.x, trap.y);
        if (d < TRAP_BASE_RADIUS + e.size) {
          // Mark for slow (enemy checks this each frame)
          e.trapSlow      = this.slowStrength;
          e.trapSuppressed = this.suppressFire;
          if (!trap.triggered) trap.triggered = true;

          // Deal damage over time
          if (this.trapDamage > 0) {
            e.takeDamage(this.trapDamage * dt);
          }
        }
      }
    }

    // Handle expiry bursts
    if (this.expiryBurst) {
      for (const ev of expiries) {
        for (const e of enemies.enemies) {
          if (!e.isAlive) continue;
          if (dist(e.x, e.y, ev.x, ev.y) < TRAP_BASE_RADIUS * 1.5 + e.size) {
            e.takeDamage(25);
          }
        }
        if (particles) particles.classEmergence(ev.x, ev.y, '#d6faf7');
      }
    }

    this.traps = this.traps.filter(t => !t._dead);

    return expiries;
  }

  // Returns whether world point x,y is inside any trap zone
  // Used by player for overwatch bonus damage
  isInsideTrap(x, y) {
    for (const trap of this.traps) {
      if (dist(x, y, trap.x, trap.y) < TRAP_BASE_RADIUS) return true;
    }
    return false;
  }

  draw(ctx) {
    for (const trap of this.traps) {
      const lifeRatio = trap.life / trap.maxLife;
      const fadeAlpha = trap.fadeIn > 0 ? (TRAP_FADE_IN - trap.fadeIn) / TRAP_FADE_IN : 1;

      // Stealth traps are invisible until triggered
      if (this.stealth && !trap.triggered) {
        // Draw a very faint outline to let the player know it's there
        ctx.globalAlpha = fadeAlpha * 0.15;
        ctx.strokeStyle = '#d6faf7';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.arc(trap.x, trap.y, TRAP_BASE_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }

      const baseAlpha = fadeAlpha * (0.35 + lifeRatio * 0.25);
      const pulse     = Math.sin(Date.now() * 0.003) * 0.5 + 0.5;

      // Filled zone
      ctx.globalAlpha = baseAlpha * 0.4;
      ctx.fillStyle   = '#d6faf7';
      ctx.beginPath();
      ctx.arc(trap.x, trap.y, TRAP_BASE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Ring
      ctx.globalAlpha = baseAlpha * 0.8;
      ctx.strokeStyle = '#d6faf7';
      ctx.lineWidth   = 1.5;
      ctx.shadowBlur  = 10 + pulse * 6;
      ctx.shadowColor = '#d6faf7';
      ctx.beginPath();
      ctx.arc(trap.x, trap.y, TRAP_BASE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // Inner decay ring showing remaining life
      ctx.globalAlpha = baseAlpha * 0.6;
      ctx.strokeStyle = '#88e8e0';
      ctx.lineWidth   = 2;
      const startA = -Math.PI / 2;
      ctx.beginPath();
      ctx.arc(trap.x, trap.y, TRAP_BASE_RADIUS * 0.6, startA, startA + Math.PI * 2 * lifeRatio);
      ctx.stroke();

      // Center dot
      ctx.globalAlpha = fadeAlpha * 0.8;
      ctx.fillStyle   = '#d6faf7';
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.arc(trap.x, trap.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
    }
  }
}
