// CHROMATIC DECAY — Raze's Snare Trap (his Level 3 card)
//
// Lobbed like Dex's grenade (over racks, to the cursor; on touch, where the
// drag says). It lands, arms a moment later, and the first few Chromatics to
// cross it are held: gold loops round their base, a twisting tether back to
// the trap, and 35% more damage taken while they're held (enemies.js). Held
// counts as stunned (Level 3's terminal ring ignores them). One trap down at
// a time; it fades once it's full or after a while untouched.

import { drawGlow } from './sprites.js';
import { sfxGrenadeThrow, sfxSnareArm, sfxSnareSnap } from './audio.js';

export const SNARE_CD = 9;          // seconds
export const SNARE_RADIUS = 34;     // how close a Chromatic has to come
const FLIGHT = 0.5, ARC = 40;       // the lob
const ARM = 0.25, LIFE = 12, HOLD = 2.5, MAX = 3, FADE = 0.4;
const MAX_RANGE = 280, MIN_RANGE = 40;
const GOLD = '#FFD23F';

export class SnareSystem {
  constructor() { this.reset(); }

  reset() {
    this.flying = [];
    this.trap = null;     // { x, y, t, caught: [], endT }
    this.t = 0;
    this.onLand = null;   // (x, y) → the level checks what it landed on
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
      if (g.t >= FLIGHT) {
        this.trap = { x: g.tx, y: g.ty, t: 0, caught: [], endT: null };
        sfxSnareArm();
        if (this.onLand) this.onLand(g.tx, g.ty);
      }
    }
    this.flying = this.flying.filter(g => g.t < FLIGHT);
    const tr = this.trap;
    if (!tr) return;
    tr.t += dt;
    if (tr.endT != null) { tr.endT += dt; if (tr.endT >= FADE) this.trap = null; return; }
    if (tr.t >= ARM && tr.caught.length < MAX) {
      for (const e of enemySystem.enemies) {
        if (tr.caught.length >= MAX) break;
        if (!e.isAlive || e.phased || e.forming || tr.caught.includes(e)) continue;
        if (Math.hypot(e.x - tr.x, e.y - tr.y) > SNARE_RADIUS + e.hitSize) continue;
        e.snareT = HOLD;
        e.stunTimer = Math.max(e.stunTimer || 0, HOLD * (e.boss ? 0.3 : e.type === 'pink' ? 0.4 : 1));
        tr.caught.push(e);
        sfxSnareSnap();
      }
    }
    // Full and everything let go, or left untouched too long: it fades
    const holding = tr.caught.some(e => e.isAlive && e.snareT > 0);
    if ((tr.caught.length >= MAX && !holding) || (tr.t > LIFE && !holding)) tr.endT = 0;
  }

  draw(ctx) {
    // In flight: landing ring, shadow, the trap up in its arc
    for (const g of this.flying) {
      const k = g.t / FLIGHT;
      const x = g.fx + (g.tx - g.fx) * k, y = g.fy + (g.ty - g.fy) * k;
      const z = ARC * 4 * k * (1 - k);
      ctx.save();
      ctx.globalAlpha = 0.2 + 0.3 * k;
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(g.tx, g.ty, SNARE_RADIUS, SNARE_RADIUS * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(x, y + 2, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      this._drawTrap(ctx, Math.round(x), Math.round(y - z), 0.5, false);
      ctx.restore();
    }
    const tr = this.trap;
    if (!tr) return;
    const a = tr.endT != null ? 1 - tr.endT / FADE : Math.min(1, tr.t / 0.15);
    const armed = tr.t >= ARM;
    ctx.save();
    ctx.globalAlpha = a;
    // Its reach: a faint dashed ring on the floor, turning slowly
    if (armed && tr.caught.length < 3) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]); ctx.lineDashOffset = -this.t * 10;
      ctx.globalAlpha = 0.45 * a;
      ctx.beginPath(); ctx.ellipse(tr.x, tr.y, SNARE_RADIUS, SNARE_RADIUS * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a;
    }
    this._drawTrap(ctx, Math.round(tr.x), Math.round(tr.y), a, armed);
    // Tethers to what it's holding: two strands twisting round each other
    ctx.globalCompositeOperation = 'lighter';
    for (const e of tr.caught) {
      if (!e.isAlive || !(e.snareT > 0)) continue;
      const k = Math.min(1, e.snareT / 0.4);
      const x1 = tr.x, y1 = tr.y - 2, x2 = e.x, y2 = e.y;
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1;
      for (const side of [1, -1]) {
        ctx.globalAlpha = 0.7 * k * a;
        ctx.beginPath();
        for (let s = 0; s <= 12; s++) {
          const f = s / 12, off = side * Math.sin(f * L / 9 - this.t * 7) * 2.5 * Math.sin(f * Math.PI);
          const px = x1 + dx * f + nx * off, py = y1 + dy * f + ny * off;
          s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // The trap (pixel art): a dark disc with a ring of gold teeth that close
  // when it's armed, and a small gold light in the middle
  _drawTrap(ctx, x, y, glow, armed) {
    ctx.fillStyle = '#0B0A06'; ctx.fillRect(x - 6, y - 3, 13, 6);
    ctx.fillStyle = '#2E2814'; ctx.fillRect(x - 5, y - 2, 11, 4);
    ctx.fillStyle = armed ? GOLD : '#8A7428';
    const teeth = armed ? 4 : 6;
    for (let k = -2; k <= 2; k++) { ctx.fillRect(x + k * 2.5 - 0.5, y - 3 - (k % 2 ? 1 : 2) + (armed ? 0 : 1), 1, teeth > 4 ? 1 : 2); }
    ctx.fillStyle = '#FFF6C8'; ctx.fillRect(x, y - 1, 1, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, GOLD, x, y - 1, armed ? 12 : 8, (armed ? 0.5 : 0.3) * glow);
    ctx.restore();
  }
}
