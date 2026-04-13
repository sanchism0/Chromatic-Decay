// CHROMATIC DECAY — Residual Pickups

import { CONFIG } from './config.js';
import { distSq } from './utils.js';

class Residual {
  constructor(x, y, amount) {
    this.x       = x;
    this.y       = y;
    this.amount  = amount;
    this.active  = true;
    this.age     = 0;         // for bobbing animation
    this.vx      = (Math.random() - 0.5) * 60;
    this.vy      = (Math.random() - 0.5) * 60;
    this.friction = 0.88;     // velocity decay
  }
}

export class ResidualSystem {
  constructor() {
    this.residuals  = [];
    this.total      = 0;       // total collected this run
    this.threshold  = CONFIG.residual_base_threshold;
    this.upgradesDue = 0;      // number of upgrade selections pending
  }

  reset() {
    this.residuals   = [];
    this.total       = 0;
    this.threshold   = CONFIG.residual_base_threshold;
    this.upgradesDue = 0;
  }

  spawn(x, y, amount) {
    // Scatter a few orbs
    const orbCount = Math.max(1, Math.round(amount / 5));
    const amountPer = amount / orbCount;
    for (let i = 0; i < orbCount; i++) {
      this.residuals.push(new Residual(
        x + (Math.random() - 0.5) * 20,
        y + (Math.random() - 0.5) * 20,
        amountPer,
      ));
    }
  }

  update(dt, player, particles) {
    const pickR  = player.pickupRadius;
    const pickR2 = pickR * pickR;
    const magR2  = (pickR * 2.5) ** 2;   // magnetic attraction range

    for (const r of this.residuals) {
      if (!r.active) continue;
      r.age += dt;

      // Apply velocity (from spawn scatter) with friction
      r.x  += r.vx * dt;
      r.y  += r.vy * dt;
      r.vx *= r.friction;
      r.vy *= r.friction;

      const dx   = player.x - r.x;
      const dy   = player.y - r.y;
      const d2   = dx * dx + dy * dy;

      // Magnetic pull
      if (d2 < magR2 && d2 > 0) {
        const d    = Math.sqrt(d2);
        const pull = 300 * (1 - d / Math.sqrt(magR2));
        r.x += (dx / d) * pull * dt;
        r.y += (dy / d) * pull * dt;
      }

      // Collect
      if (d2 < pickR2) {
        r.active = false;
        this.total += r.amount;
        particles.residualCollect(r.x, r.y);

        // Check threshold
        if (this.total >= this.threshold) {
          this.upgradesDue++;
          this.threshold += CONFIG.residual_threshold_increase;
        }
      }
    }

    this.residuals = this.residuals.filter(r => r.active);
  }

  draw(ctx) {
    for (const r of this.residuals) {
      if (!r.active) continue;

      const bob   = Math.sin(r.age * 3 + r.x * 0.1) * 2;
      const alpha = Math.min(1, r.age * 4);

      ctx.globalAlpha = alpha;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = '#E8C86A';

      ctx.fillStyle = '#B8882A';
      ctx.beginPath();
      ctx.arc(r.x, r.y + bob, CONFIG.residual_size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#E8C86A';
      ctx.beginPath();
      ctx.arc(r.x, r.y + bob, CONFIG.residual_size * 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }
}
