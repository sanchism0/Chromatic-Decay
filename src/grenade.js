// CHROMATIC DECAY — Dex's stun grenade
//
// Lobbed at the cursor in a high arc, so it sails over the server racks (they
// stop short of the ceiling). On landing it bursts: everything nearby is
// stunned and "jammed" (takes extra damage) for a moment. The burst is
// electricity and smoke; jammed enemies crackle until it wears off.

import { drawGlow } from './sprites.js';
import { sfxGrenadeThrow, sfxGrenadeBurst } from './audio.js';

export const GRENADE_CD = 8;      // seconds
const FLIGHT    = 0.55;           // seconds in the air
const ARC       = 46;             // peak height of the lob, world px
const RADIUS    = 75;             // burst radius
const STUN      = 1.5;            // seconds stunned and jammed (bosses: less)
export const GRENADE_RANGE = 280, GRENADE_RADIUS = 75;
const MAX_RANGE = GRENADE_RANGE, MIN_RANGE = 40;
const COLOR     = '#B6FF2E';      // Dex's green

// A jagged line from (x0, y0) to (x1, y1), as points; seed keeps it steady
// for a few frames at a time so arcs flicker at a readable rate
function bolt(x0, y0, x1, y1, seed, kinks = 5, jag = 7) {
  const pts = [[x0, y0]];
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  for (let i = 1; i < kinks; i++) {
    const t = i / kinks, o = rnd() * 2 * jag;
    pts.push([x0 + dx * t + px * o, y0 + dy * t + py * o]);
  }
  pts.push([x1, y1]);
  return pts;
}

function strokeBolt(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

export class GrenadeSystem {
  constructor() { this.reset(); }

  reset() {
    this.flying = [];
    this.bursts = [];
    this.smoke  = [];
    this.t      = 0;
  }

  throw(fx, fy, tx, ty) {
    const dx = tx - fx, dy = ty - fy, d = Math.hypot(dx, dy) || 1;
    const r = Math.max(MIN_RANGE, Math.min(MAX_RANGE, d));
    this.flying.push({ fx, fy, tx: fx + dx / d * r, ty: fy + dy / d * r, t: 0 });
    sfxGrenadeThrow();
  }

  update(dt, enemySystem) {
    this.t += dt;
    for (const g of this.flying) {
      g.t += dt;
      if (g.t >= FLIGHT) this._burst(g.tx, g.ty, enemySystem);
    }
    this.flying = this.flying.filter(g => g.t < FLIGHT);
    for (const b of this.bursts) b.t += dt;
    this.bursts = this.bursts.filter(b => b.t < 0.55);
    for (const s of this.smoke) {
      s.t += dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= 1 - dt * 1.5; s.vy -= dt * 6;   // spreads, slows, drifts up
    }
    this.smoke = this.smoke.filter(s => s.t < s.life);
  }

  _burst(x, y, enemySystem) {
    for (const e of enemySystem.enemies) {
      if (!e.isAlive) continue;
      if (Math.hypot(e.x - x, e.y - y) > RADIUS + e.size) continue;
      const stun = e.type === 'pink' ? STUN * 0.4 : STUN;
      e.stunTimer = Math.max(e.stunTimer || 0, stun);
      e.jammed    = Math.max(e.jammed || 0, stun);
      e.takeDamage(6);
    }
    this.bursts.push({ x, y, t: 0, seed: Math.floor(Math.random() * 1e5) });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = 25 + Math.random() * 50;
      this.smoke.push({ x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - 12,
                        t: 0, life: 1.2 + Math.random() * 0.7, r: 11 + Math.random() * 7 });
    }
    sfxGrenadeBurst();
  }

  // Drawn after the racks: the grenade flies over them, and the burst sits on top
  draw(ctx, enemies) {
    const tick = Math.floor(this.t / 0.06);   // arcs re-jag ~16 times a second

    // In flight: landing ring, ground shadow, the canister up in its arc
    for (const g of this.flying) {
      const k = g.t / FLIGHT;
      const x = g.fx + (g.tx - g.fx) * k, y = g.fy + (g.ty - g.fy) * k;
      const z = ARC * 4 * k * (1 - k);
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.35 * k;
      ctx.strokeStyle = COLOR; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(g.tx, g.ty, RADIUS * 0.9, RADIUS * 0.9 * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(x, y + 2, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      const gx = Math.round(x), gy = Math.round(y - z);
      ctx.fillStyle = '#1B2430'; ctx.fillRect(gx - 3, gy - 3, 6, 6);
      ctx.fillStyle = '#3E5163'; ctx.fillRect(gx - 3, gy - 3, 6, 2);
      ctx.fillStyle = COLOR;     ctx.fillRect(gx - 1, gy, 2, 2);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, COLOR, gx, gy, 9, 0.5);
      ctx.restore();
    }

    // Smoke (under the electricity)
    ctx.save();
    for (const s of this.smoke) {
      const k = s.t / s.life;
      const r = s.r * (1 + k * 2.2);
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
      const a = Math.min(1, s.t / 0.12) * (1 - k);   // puffs out, then thins away
      g.addColorStop(0, `rgba(178,186,198,${0.55 * a})`);
      g.addColorStop(0.6, `rgba(150,158,170,${0.28 * a})`);
      g.addColorStop(1, 'rgba(150,158,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
    }
    ctx.restore();

    // Bursts: a shock ring, a glow, and arcs of electricity
    for (const b of this.bursts) {
      const k = b.t / 0.55;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, COLOR, b.x, b.y, RADIUS * 0.9, 0.45 * (1 - k));
      ctx.globalAlpha = 0.6 * (1 - k);
      ctx.strokeStyle = COLOR; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(b.x, b.y, RADIUS * (0.3 + 0.8 * k), RADIUS * (0.3 + 0.8 * k) * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (b.seed % 7);
        const len = RADIUS * (0.55 + 0.4 * (((b.seed >> i) & 3) / 3));
        const pts = bolt(b.x, b.y, b.x + Math.cos(a) * len, b.y + Math.sin(a) * len * 0.6, b.seed + i * 31 + tick * 7);
        ctx.globalAlpha = 0.9 * (1 - k);
        ctx.strokeStyle = COLOR; ctx.lineWidth = 2; strokeBolt(ctx, pts);
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1; strokeBolt(ctx, pts);
      }
      ctx.restore();
    }

    // Jammed enemies crackle with small arcs until it wears off
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1;
    for (const e of enemies) {
      if (!e.isAlive || !(e.jammed > 0)) continue;
      const r = e.drawSize * 1.3;
      ctx.globalAlpha = Math.min(1, e.jammed / 0.4) * 0.85;
      for (let i = 0; i < 2; i++) {
        const a = ((tick + i * 3 + e.id) * 2.39996) % (Math.PI * 2);
        const pts = bolt(e.x + Math.cos(a) * r * 0.3, e.y - e.lift + Math.sin(a) * r * 0.3,
                         e.x + Math.cos(a + 1.2) * r, e.y - e.lift + Math.sin(a + 1.2) * r, tick * 13 + e.id * 7 + i, 3, 4);
        ctx.strokeStyle = i ? '#FFFFFF' : COLOR;
        strokeBolt(ctx, pts);
      }
    }
    ctx.restore();
  }
}
