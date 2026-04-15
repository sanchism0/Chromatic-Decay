// CHROMATIC DECAY — Particle System

import { CONFIG } from './config.js';

class Particle {
  constructor() { this.active = false; }

  init(x, y, vx, vy, color, size, life, fade = true, shape = 'square') {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color = color;
    this.size = size;
    this.maxLife = life;
    this.life = life;
    this.fade = fade;
    this.shape = shape;
    this.active = true;
  }
}

export class ParticleSystem {
  constructor() {
    this.pool = Array.from({ length: CONFIG.max_particles }, () => new Particle());
  }

  _spawn(x, y, vx, vy, color, size, life, fade = true, shape = 'square') {
    const p = this.pool.find(p => !p.active);
    if (p) p.init(x, y, vx, vy, color, size, life, fade, shape);
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 30 * dt; // slight gravity
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
  }

  draw(ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const alpha = p.fade ? Math.max(0, p.life / p.maxLife) : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── Effect presets ──────────────────────────────────────────

  enemyDeath(x, y, color) {
    const count = 7;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const spd = 60 + Math.random() * 80;
      this._spawn(x, y, Math.cos(a) * spd, Math.sin(a) * spd, '#B8882A', 3 + Math.random() * 2, 0.4 + Math.random() * 0.2);
    }
    // Core flash in enemy color
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 50;
      this._spawn(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, 2, 0.25);
    }
  }

  residualCollect(x, y) {
    // Golden ring expand — approximate with outward dots
    const count = 8;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count;
      this._spawn(x, y, Math.cos(a) * 120, Math.sin(a) * 120, '#E8C86A', 2, 0.2, true, 'circle');
    }
  }

  playerHit(x, y) {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * 60;
      this._spawn(x, y, Math.cos(a) * spd, Math.sin(a) * spd, '#FFFFFF', 2.5, 0.3);
    }
  }

  echoRescue(x, y) {
    // Upward-drifting white particles
    for (let i = 0; i < 12; i++) {
      const vx = (Math.random() - 0.5) * 40;
      const vy = -(60 + Math.random() * 80);
      this._spawn(x, y + Math.random() * 10, vx, vy, '#C4C8D4', 2 + Math.random() * 1.5, 0.8 + Math.random() * 0.4, true, 'circle');
    }
  }

  adrenalineSpike(x, y) {
    // Warm orange pulse ring
    const count = 12;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count;
      this._spawn(x, y, Math.cos(a) * 100, Math.sin(a) * 100, '#C45A1A', 3, 0.5, true, 'circle');
    }
  }

  classEmergence(x, y, color) {
    // Expanding ring in class color
    const count = 24;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count;
      const spd = 150 + Math.random() * 80;
      this._spawn(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, 3, 1.2 + Math.random() * 0.3, true, 'circle');
    }
  }

  bulletCollision(x, y) {
    const rainbow = ['#ff4466', '#ff9933', '#ffee33', '#66ff44', '#33ccff', '#aa44ff', '#ff44cc'];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 60;
      const color = rainbow[Math.floor(Math.random() * rainbow.length)];
      this._spawn(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, 1.5 + Math.random() * 1.5, 0.25 + Math.random() * 0.15, true, 'circle');
    }
  }

  fragmentDiscovery(x, y) {
    // Golden burst, sustained
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 50 + Math.random() * 150;
      this._spawn(x, y, Math.cos(a) * spd, Math.sin(a) * spd, '#E8C86A', 2 + Math.random() * 3, 1.0 + Math.random() * 0.5, true, 'circle');
    }
  }
}
