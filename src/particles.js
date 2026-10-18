// CHROMATIC DECAY — Particle System

import { CONFIG } from './config.js';
import { haloSprite, drawSprite } from './sprites.js';

const MAX_FLASHES = 30;

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
    this.pool    = Array.from({ length: CONFIG.max_particles }, () => new Particle());
    this.flashes = [];   // short white light bursts + shock rings
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
    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter(f => f.life > 0);
  }

  draw(ctx) {
    // Additive — sparks read as light and brighten where they overlap
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pool) {
      if (!p.active) continue;
      const alpha = p.fade ? Math.max(0, p.life / p.maxLife) : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'streak') {
        // Spark stretched along its velocity
        ctx.strokeStyle = p.color;
        ctx.lineWidth   = p.size * 0.7;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }

    // Flashes — a white bloom that swells and fades, plus an expanding ring
    const bloom = haloSprite('#ffffff', 32, 1);
    for (const f of this.flashes) {
      const k = 1 - f.life / f.maxLife;               // 0 → 1 over the flash
      const a = Math.pow(f.life / f.maxLife, 1.5);
      const r = f.size * (0.35 + 0.65 * Math.sqrt(k));
      ctx.globalAlpha = a;
      ctx.drawImage(bloom.canvas, f.x - r, f.y - r, r * 2, r * 2);
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1.5 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * 0.15 + f.size * 1.1 * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Short burst of white light at (x, y); size is the bloom radius in world px
  flash(x, y, size = 30, life = 0.22) {
    if (this.flashes.length >= MAX_FLASHES) this.flashes.shift();
    this.flashes.push({ x, y, size, life, maxLife: life });
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
    // Chromatic spray — light split into its colours
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 190;
      const color = rainbow[Math.floor(Math.random() * rainbow.length)];
      this._spawn(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, 1.2 + Math.random() * 2, 0.3 + Math.random() * 0.4, true, i % 2 ? 'streak' : 'circle');
    }
    // White-hot core sparks
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 25 + Math.random() * 70;
      this._spawn(x, y, Math.cos(a) * spd, Math.sin(a) * spd, '#ffffff', 2 + Math.random() * 1.5, 0.15 + Math.random() * 0.15, true, 'circle');
    }
    this.flash(x, y, 30, 0.22);
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
