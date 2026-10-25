// CHROMATIC DECAY — Raze's Net (his Level 2 card)
//
// Like Caitlyn's net: his dash throws him one way and a net of gold light
// flies the other. The first few Chromatics it reaches are caught: held in
// place for a moment, wrapped in a mesh of light. His next pull of the
// trigger then fires a tracer at each thing caught (player.js): fast rounds
// that steer onto their target and hit it 2.5x as hard (enemies.js).
// The net also catches things only dash abilities can crack (Level 2's frozen
// tanks); a tracer into one cracks it. Soft light, no flashing.

import { drawGlow } from './sprites.js';
import { sfxNetFire, sfxNetCatch } from './audio.js';

const NET = { speed: 540, range: 210, r0: 10, r1: 34, max: 3, hold: 2.2, window: 3, fade: 0.35 };
const GOLD = '#FFD23F';

export class NetSystem {
  constructor() { this.reset(); }

  reset() {
    this.nets = [];
    this.t = 0;
  }

  fire(x, y, a) {
    this.nets.push({ x0: x, y0: y, x, y, a, d: 0, r: NET.r0, caught: [], done: false, fadeT: 0 });
    sfxNetFire();
  }

  // targets: things only dash abilities crack ({ x, y, r, hit() })
  update(dt, player, enemySystem, map, targets) {
    this.t += dt;
    if (player.tracerQueue) {
      player.tracerT -= dt;
      if (player.tracerT <= 0) player.tracerQueue = null;
    }
    for (const n of this.nets) {
      if (n.done) { n.fadeT += dt; continue; }
      n.d = Math.min(NET.range, n.d + NET.speed * dt);
      n.x = n.x0 + Math.cos(n.a) * n.d;
      n.y = n.y0 + Math.sin(n.a) * n.d;
      n.r = NET.r0 + (NET.r1 - NET.r0) * n.d / NET.range;
      const fresh = [];
      for (const e of enemySystem.enemies) {
        if (n.caught.length + fresh.length >= NET.max) break;
        if (!e.isAlive || e.phased || e.forming || n.caught.includes(e)) continue;
        if (Math.hypot(e.x - n.x, e.y - n.y) > n.r + e.hitSize) continue;
        e.netT = NET.hold;
        e.stunTimer = Math.max(e.stunTimer || 0, NET.hold * (e.boss ? 0.3 : e.type === 'pink' ? 0.4 : 1));
        fresh.push(e);
      }
      for (const tg of targets || []) {
        if (n.caught.length + fresh.length >= NET.max) break;
        if (n.caught.some(c => c.src === tg.key) || Math.hypot(tg.x - n.x, tg.y - n.y) > n.r + tg.r) continue;
        fresh.push({ x: tg.x, y: tg.y, hit: tg.hit, src: tg.key, alive: tg.alive || (() => true), netT: NET.hold });
      }
      if (fresh.length) {
        n.caught.push(...fresh);
        player.tracerQueue = [...(player.tracerQueue || []), ...fresh];
        player.tracerT = NET.window;
        sfxNetCatch();
      }
      // It stops at a rack, when it's full, or at the end of its throw
      const hitRack = map.obstacles.some(o => n.x > o.x && n.x < o.x + o.w && n.y > o.y && n.y < o.y + o.h);
      if (hitRack || n.caught.length >= NET.max || n.d >= NET.range) n.done = true;
    }
    this.nets = this.nets.filter(n => n.fadeT < NET.fade);
  }

  draw(ctx) {
    if (!this.nets.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1;
    for (const n of this.nets) {
      const a = 1 - n.fadeT / NET.fade;
      const r = n.r, spin = this.t * 5;
      // The mesh: a ring with chords crossing it both ways, turning as it flies
      ctx.globalAlpha = 0.85 * a;
      ctx.beginPath(); ctx.ellipse(n.x, n.y, r, r * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.save();
      ctx.translate(n.x, n.y); ctx.scale(1, 0.7); ctx.rotate(spin);
      for (let i = -2; i <= 2; i++) {
        const o = i * r * 0.4, h = Math.sqrt(Math.max(0, r * r - o * o));
        ctx.beginPath(); ctx.moveTo(o, -h); ctx.lineTo(o, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-h, o); ctx.lineTo(h, o); ctx.stroke();
      }
      ctx.restore();
      // weights at its rim
      ctx.fillStyle = '#FFF6C8';
      for (let k = 0; k < 6; k++) {
        const an = spin + k * Math.PI / 3;
        ctx.fillRect(Math.round(n.x + Math.cos(an) * r) - 1, Math.round(n.y + Math.sin(an) * r * 0.7) - 1, 2, 2);
      }
      drawGlow(ctx, GOLD, n.x, n.y, r * 1.4, 0.22 * a);
    }
    ctx.restore();
  }
}
