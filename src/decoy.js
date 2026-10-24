// CHROMATIC DECAY — Juno's Decoy Beacon (earned in Level 3)
//
// Thrown like Dex's grenade: it arcs over the racks and lands at the cursor
// (on touch, where the drag says). For a few seconds it pulses soft lilac
// light, and every violet and yellow nearby forgets Juno and crowds it;
// yellows lunge at it, greens shoot at it. It does no damage itself: it
// bunches them up for the minigun. Then the light fades and they turn back.
// enemies.js reads the active lure from EnemySystem.lure.

import { drawGlow } from './sprites.js';
import { sfxGrenadeThrow, sfxDecoyLand, sfxDecoyEnd } from './audio.js';

export const DECOY_CD = 10;       // seconds
const FLIGHT    = 0.55;           // seconds in the air
const ARC       = 46;             // peak height of the lob, world px
const LURE      = 3;              // seconds it holds them
export const DECOY_RADIUS = 220;  // how far it reaches
const MAX_RANGE = 280, MIN_RANGE = 40;
const COLOR     = '#E58CFF';      // Juno's lilac
const FADE      = 0.4;

export class DecoySystem {
  constructor() { this.reset(); }

  reset() {
    this.flying = [];
    this.beacon = null;   // { x, y, t } while it's down
    this.t      = 0;
    this.onLand = null;   // (x, y) → the level checks what it landed on
  }

  throw(fx, fy, tx, ty) {
    const dx = tx - fx, dy = ty - fy, d = Math.hypot(dx, dy) || 1;
    const r = Math.max(MIN_RANGE, Math.min(MAX_RANGE, d));
    this.flying.push({ fx, fy, tx: fx + dx / d * r, ty: fy + dy / d * r, t: 0 });
    sfxGrenadeThrow();
  }

  // The lure enemies follow right now, or null
  get lure() {
    const b = this.beacon;
    return b && b.t < LURE ? { x: b.x, y: b.y, r: DECOY_RADIUS } : null;
  }

  update(dt, enemySystem) {
    this.t += dt;
    for (const g of this.flying) {
      g.t += dt;
      if (g.t >= FLIGHT) {
        this.beacon = { x: g.tx, y: g.ty, t: 0 };
        sfxDecoyLand();
        if (this.onLand) this.onLand(g.tx, g.ty);
      }
    }
    this.flying = this.flying.filter(g => g.t < FLIGHT);
    if (this.beacon) {
      const t0 = this.beacon.t;
      this.beacon.t += dt;
      if (t0 < LURE && this.beacon.t >= LURE) sfxDecoyEnd();
      if (this.beacon.t >= LURE + FADE) this.beacon = null;
    }
    if (enemySystem) enemySystem.lure = this.lure;
  }

  draw(ctx) {
    // In flight: landing ring, shadow, the beacon up in its arc
    for (const g of this.flying) {
      const k = g.t / FLIGHT;
      const x = g.fx + (g.tx - g.fx) * k, y = g.fy + (g.ty - g.fy) * k;
      const z = ARC * 4 * k * (1 - k);
      ctx.save();
      ctx.globalAlpha = 0.2 + 0.3 * k;
      ctx.strokeStyle = COLOR; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(g.tx, g.ty, 18, 10, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(x, y + 2, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      this._drawPost(ctx, Math.round(x), Math.round(y - z), 1);
      ctx.restore();
    }
    const b = this.beacon;
    if (!b) return;
    const a = b.t < LURE ? Math.min(1, b.t / 0.15) : Math.max(0, 1 - (b.t - LURE) / FADE);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // A slow breathing glow and soft rings drifting outward to its reach
    drawGlow(ctx, COLOR, b.x, b.y - 6, 30 + 6 * Math.sin(b.t * 4), 0.55 * a);
    ctx.strokeStyle = COLOR; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const k = ((b.t * 0.6 + i / 3) % 1);
      ctx.globalAlpha = 0.35 * (1 - k) * a;
      const r = 20 + k * (DECOY_RADIUS - 20);
      ctx.beginPath(); ctx.ellipse(b.x, b.y, r, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.max(0.4, a);
    this._drawPost(ctx, Math.round(b.x), Math.round(b.y), a);
    ctx.restore();
  }

  // The beacon: a small dark post with a lilac lens on top (pixel art)
  _drawPost(ctx, x, y, glow) {
    ctx.fillStyle = '#0B0A12'; ctx.fillRect(x - 3, y - 12, 7, 13);
    ctx.fillStyle = '#2C2440'; ctx.fillRect(x - 2, y - 11, 5, 11);
    ctx.fillStyle = '#4A3C6A'; ctx.fillRect(x - 2, y - 11, 5, 2);
    ctx.fillStyle = COLOR;     ctx.fillRect(x - 1, y - 14, 3, 3);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y - 13, 1, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, COLOR, x, y - 13, 10, 0.5 * glow);
    ctx.restore();
  }
}
