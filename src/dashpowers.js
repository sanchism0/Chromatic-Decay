// CHROMATIC DECAY — Dash abilities (Story cards earned in Level 2)
//
//   Dex  · Shock Dash      every Chromatic he dashes through is stunned and
//                          jammed (takes 50% more damage) for a moment
//   Juno · Parting Charge  a light bomb drops where she dashed from and
//                          bursts a moment later
//
// Both also crack things bullets can't, like Level 2's frozen tanks: the level
// hands those over as targets { x, y, r, hit() }. Soft light, no flashing.

import { drawGlow } from './sprites.js';
import { sfxShockDash, sfxChargeBurst } from './audio.js';

const SHOCK = { reach: 16, stun: 1.2, jam: 1.6, damage: 4 };
const BOMB  = { fuse: 0.6, radius: 72, damage: 28 };
const DEX = '#B6FF2E', JUNO = '#E58CFF';

export class DashPowers {
  constructor() { this.reset(); }

  reset() {
    this.bombs  = [];   // Parting Charges waiting to burst
    this.bursts = [];   // bursts fading out
    this.sparks = [];   // Shock Dash crackle along the path
    this._hit   = new Set();
    this.t      = 0;
  }

  // After the player moves each frame. targets: things only these can crack.
  update(dt, player, enemySystem, targets) {
    this.t += dt;
    // A new dash has started (game.js clears player.justDashed before this runs)
    const dashing = player.dashT > 0;
    const started = dashing && !this._wasDashing;
    this._wasDashing = dashing;
    if (started) {
      this._hit = new Set();
      if (player.dashBomb && player.dashFrom) this.bombs.push({ x: player.dashFrom.x, y: player.dashFrom.y, t: 0, k: player.damageMultiplier || 1 });
    }

    // Shock Dash: everything the dash passes through
    if (player.shockDash && player.dashT > 0) {
      this.sparks.push({ x: player.x, y: player.y - 6, t: 0, seed: Math.floor(Math.random() * 1e5) });
      let hits = 0;
      for (const e of enemySystem.enemies) {
        if (!e.isAlive || e.phased || this._hit.has(e)) continue;
        if (Math.hypot(e.x - player.x, e.y - player.y) < e.size + SHOCK.reach) {
          this._hit.add(e);
          const k = e.type === 'pink' ? 0.4 : 1;
          e.stunTimer = Math.max(e.stunTimer || 0, SHOCK.stun * k);
          e.jammed    = Math.max(e.jammed || 0, SHOCK.jam * k);
          e.takeDamage(SHOCK.damage);
          hits++;
        }
      }
      for (const tg of targets || []) {
        if (this._hit.has(tg) || Math.hypot(tg.x - player.x, tg.y - player.y) > tg.r + SHOCK.reach) continue;
        this._hit.add(tg);
        tg.hit();
        hits++;
      }
      if (hits) sfxShockDash();
    }

    // Parting Charges: burst when the fuse runs out
    for (const b of this.bombs) {
      b.t += dt;
      if (b.t < BOMB.fuse) continue;
      for (const e of enemySystem.enemies) {
        if (!e.isAlive || e.phased) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < BOMB.radius + e.size) e.takeDamage(BOMB.damage * b.k);
      }
      for (const tg of targets || []) if (Math.hypot(tg.x - b.x, tg.y - b.y) < BOMB.radius + tg.r) tg.hit();
      this.bursts.push({ x: b.x, y: b.y, t: 0 });
      sfxChargeBurst();
    }
    this.bombs = this.bombs.filter(b => b.t < BOMB.fuse);
    for (const s of this.sparks) s.t += dt;
    this.sparks = this.sparks.filter(s => s.t < 0.3);
    for (const b of this.bursts) b.t += dt;
    this.bursts = this.bursts.filter(b => b.t < 0.5);
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Shock Dash: short jagged arcs left along the path, fading fast
    ctx.lineWidth = 1.5;
    for (const s of this.sparks) {
      const a = 1 - s.t / 0.3;
      let r = s.seed;
      const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280 - 0.5; };
      ctx.globalAlpha = 0.8 * a;
      ctx.strokeStyle = DEX;
      ctx.beginPath();
      ctx.moveTo(s.x + rnd() * 16, s.y + rnd() * 16);
      for (let k = 0; k < 3; k++) ctx.lineTo(s.x + rnd() * 20, s.y + rnd() * 20);
      ctx.stroke();
      drawGlow(ctx, DEX, s.x, s.y, 14, 0.25 * a);
    }
    // Parting Charge: a pulsing core and a ring closing in as the fuse burns
    for (const b of this.bombs) {
      const k = b.t / BOMB.fuse;
      drawGlow(ctx, JUNO, b.x, b.y, 16 + 6 * Math.sin(this.t * 20), 0.55);
      ctx.globalAlpha = 0.5 + 0.4 * k;
      ctx.strokeStyle = JUNO; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(b.x, b.y + 4, BOMB.radius * (1 - k * 0.85), BOMB.radius * 0.55 * (1 - k * 0.85), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);
    }
    // Bursts: an expanding ring and a glow that fades (no flash)
    for (const b of this.bursts) {
      const k = b.t / 0.5;
      drawGlow(ctx, JUNO, b.x, b.y, BOMB.radius, 0.5 * (1 - k));
      ctx.globalAlpha = 0.7 * (1 - k);
      ctx.strokeStyle = JUNO; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(b.x, b.y + 4, BOMB.radius * (0.4 + 0.7 * k), BOMB.radius * 0.55 * (0.4 + 0.7 * k), 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}
