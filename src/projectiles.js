// CHROMATIC DECAY — Projectile System

import { CONFIG } from './config.js';
import { clamp } from './utils.js';
import { orbSprite, haloSprite, drawSprite, mix } from './sprites.js';

// Fill the whole-pixel line between two screen points (no anti-aliasing)
function _plotLine(ctx, x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

class Projectile {
  constructor() { this.active = false; }

  init(x, y, angle, damage, speed, range, isPlayer, color = '#FFFFFF', piercing = 0, bounce = false, homing = false, overload = false) {
    this.x        = x;
    this.y        = y;
    this.vx       = Math.cos(angle) * speed;
    this.vy       = Math.sin(angle) * speed;
    this.damage   = damage;
    this.speed    = speed;
    this.range    = range;
    this.traveled = 0;
    this.isPlayer = isPlayer;
    this.color    = color;
    this.piercing = piercing;   // hits remaining after first
    this.bounce   = bounce;     // reflect off map edges
    this.rackBounce = 0;        // ricochets left off racks (set after spawn)
    this.arc        = false;    // Arc Round: jumps to a nearby enemy on hit (set after spawn)
    this.bounced    = false;    // has ricocheted off a rack (Level 4's junction boxes need this)
    this.discharge  = false;    // from Dex's Arc Discharge ring (Level 5's anchors need this)
    this.spun       = false;    // fired during Juno's Half-Life (makes enemies decay; fills Level 5's anchors)
    this.hitIds     = null;     // enemies this round has already hit
    this.rifle      = false;    // one of Raze's rifle rounds (drawn gold and long)
    this.tracer     = false;    // Net tracer: steers onto homeTo, passes over racks
    this.homeTo     = null;     // { x, y } it steers onto (an enemy, or a target with hit())
    this.wallPierce = 0;        // Punch-Through: racks it can still go through
    this.punched    = false;    // has gone through a rack (Level 4's boxes need this or a bounce)
    this._inRack    = null;     // the rack it's passing through right now
    this.homing   = homing;     // tracks toward player
    this.overload = overload;   // Breaker: golden 3× damage shot
    this.age      = 0;          // seconds since fired (muzzle ripple, wave phase)
    this.active   = true;
  }
}

export class ProjectileSystem {
  constructor() {
    // Object pools — separate for player vs enemy
    this._pool = Array.from({ length: 400 }, () => new Projectile());
    this._fizzles = [];   // where player shots ended: a brief scatter of light
    this.rackHits = [];   // racks player shots hit this frame (Story objectives read these)
    this.arcRackHits = [];   // where Arc Rounds hit a rack this frame (the arc can jump on from there)
    this.missed = 0;         // player rounds that ended without hitting anything (Follow-Up)
    this.punches = [];       // where rounds went through a rack (sparks)
  }

  get playerProjectiles() {
    return this._pool.filter(p => p.active && p.isPlayer);
  }

  get enemyProjectiles() {
    return this._pool.filter(p => p.active && !p.isPlayer);
  }

  _getFree() {
    return this._pool.find(p => !p.active) || null;
  }

  spawnPlayer(x, y, angle, damage, speed, range, piercing = 0, bounce = false, overload = false) {
    const p = this._getFree();
    if (p) p.init(x, y, angle, damage, speed, range, true, '#FFFFFF', piercing, bounce, false, overload);
    return p;
  }

  spawnEnemy(x, y, angle, damage, speed, range, color) {
    const p = this._getFree();
    if (p) p.init(x, y, angle, damage, speed, range, false, color);
  }

  spawnEnemyHoming(x, y, angle, damage, speed, range, color) {
    const p = this._getFree();
    if (p) p.init(x, y, angle, damage, speed, range, false, color, 0, false, true);
  }

  update(dt, map, player) {
    for (const p of this._pool) {
      if (!p.active) continue;

      // Homing: steer toward player
      if (p.homing && player && player.alive) {
        const hdx = player.x - p.x, hdy = player.y - p.y;
        const hlen = Math.sqrt(hdx * hdx + hdy * hdy) || 1;
        const tx = (hdx / hlen) * p.speed, ty = (hdy / hlen) * p.speed;
        const turnRate = 3.5; // radians/sec
        p.vx += (tx - p.vx) * Math.min(1, turnRate * dt);
        p.vy += (ty - p.vy) * Math.min(1, turnRate * dt);
        // Re-normalize to constant speed
        const vlen = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
        p.vx = (p.vx / vlen) * p.speed;
        p.vy = (p.vy / vlen) * p.speed;
      }

      // Net tracer: turns hard onto its target; one that isn't an enemy
      // (Level 2's frozen tanks) is hit when the tracer arrives
      if (p.tracer && p.homeTo) {
        const tg = p.homeTo, hx = tg.x - p.x, hy = tg.y - p.y, hd = Math.hypot(hx, hy) || 1;
        if (tg.hit && hd < 14) { tg.hit(); this._endShot(p); continue; }
        if (tg.isAlive === undefined || tg.isAlive) {
          const k = Math.min(1, dt * 14);
          p.vx += (hx / hd * p.speed - p.vx) * k; p.vy += (hy / hd * p.speed - p.vy) * k;
          const vl = Math.hypot(p.vx, p.vy) || 1;
          p.vx = p.vx / vl * p.speed; p.vy = p.vy / vl * p.speed;
        }
      }

      p.age += dt;
      const prevX = p.x, prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Distance traveled
      const ddx = p.x - prevX, ddy = p.y - prevY;
      p.traveled += Math.sqrt(ddx * ddx + ddy * ddy);

      // Out of range — the pulse loses coherence and scatters
      if (p.traveled >= p.range) { this._endShot(p); continue; }

      // Map boundary
      if (p.x < 0 || p.x > CONFIG.map_width || p.y < 0 || p.y > CONFIG.map_height) {
        if (p.bounce && p.isPlayer) {
          // Reflect off the edge
          if (p.x < 0 || p.x > CONFIG.map_width)  p.vx = -p.vx;
          if (p.y < 0 || p.y > CONFIG.map_height) p.vy = -p.vy;
          p.x = clamp(p.x, 0, CONFIG.map_width);
          p.y = clamp(p.y, 0, CONFIG.map_height);
          p.bounce = false;  // only bounce once
        } else {
          this._endShot(p);
          continue;
        }
      }

      // Obstacle collision — ricochet rounds bounce off the face they hit;
      // Punch-Through rounds go through (one rack each); tracers fly over
      if (p._inRack && !(p.x >= p._inRack.x && p.x <= p._inRack.x + p._inRack.w && p.y >= p._inRack.y && p.y <= p._inRack.y + p._inRack.h)) {
        this.punches.push({ x: p.x, y: p.y, a: Math.atan2(p.vy, p.vx), t: 0 });
        p._inRack = null;
      }
      if (p.tracer) continue;
      for (const obs of map.obstacles) {
        if (p.x >= obs.x && p.x <= obs.x + obs.w &&
            p.y >= obs.y && p.y <= obs.y + obs.h) {
          if (obs === p._inRack) break;
          if (p.isPlayer) this.rackHits.push(obs);
          if (p.isPlayer && p.wallPierce > 0) {
            p.wallPierce--;
            p.punched = true;
            p._inRack = obs;
            this.punches.push({ x: prevX, y: prevY, a: Math.atan2(p.vy, p.vx), t: 0 });
          } else if (p.isPlayer && p.rackBounce > 0) {
            p.rackBounce--;
            p.bounced = true;
            if (prevX < obs.x || prevX > obs.x + obs.w) p.vx = -p.vx; else p.vy = -p.vy;
            p.x = prevX; p.y = prevY;
          } else {
            if (p.isPlayer && p.arc) this.arcRackHits.push({ x: prevX, y: prevY });
            this._endShot(p);
          }
          break;
        }
      }
    }
    for (const f of this._fizzles) f.t += dt;
    this._fizzles = this._fizzles.filter(f => f.t < 0.18);
    for (const k of this.punches) k.t += dt;
    this.punches = this.punches.filter(k => k.t < 0.3);
  }

  _endShot(p) {
    p.active = false;
    if (p.isPlayer && !p.hitIds && !p.tracer) this.missed++;
    if (p.isPlayer && this._fizzles.length < 40) {
      this._fizzles.push({ x: p.x, y: p.y, a: Math.atan2(p.vy, p.vx), t: 0, gold: p.overload });
    }
  }

  // Player bullets destroy enemy bullets on collision (unless piercing)
  checkBulletCollisions(particles) {
    for (const pp of this.playerProjectiles) {
      for (const ep of this.enemyProjectiles) {
        const dx = pp.x - ep.x, dy = pp.y - ep.y;
        if (dx * dx + dy * dy < 64) { // ~8px combined radius
          if (particles) particles.bulletCollision((pp.x + ep.x) / 2, (pp.y + ep.y) / 2);
          ep.active = false;
          if (pp.piercing > 0) {
            pp.piercing--;
          } else {
            pp.active = false;
          }
        }
      }
    }
  }

  // Check enemy projectiles vs player
  checkPlayerHits(player, particles) {
    if (!player.alive) return;
    const r = player.size / 2 + 3;
    for (const p of this._pool) {
      if (!p.active || p.isPlayer) continue;
      const dx = p.x - player.x, dy = p.y - player.y;
      if (dx * dx + dy * dy < r * r) {
        p.active = false;
        if (player.takeDamage(p.damage)) {
          particles.playerHit(player.x, player.y);
        }
      }
    }
  }

  reset() {
    for (const p of this._pool) p.active = false;
    this._fizzles = [];
    this.rackHits = [];
    this.arcRackHits = [];
    this.missed = 0;
    this.punches = [];
  }

  draw(ctx) {
    for (const p of this._pool) {
      if (!p.active) continue;

      if (p.isPlayer) {
        this._drawPulse(ctx, p);
      } else {
        drawSprite(ctx, orbSprite(p.color, 4, 8, mix(p.color, '#ffffff', 0.6)), p.x, p.y);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Additive halos for enemy shots — drawn in the glow pass after the racks
  drawHalos(ctx) {
    for (const p of this._pool) {
      if (!p.active) continue;
      if (p.isPlayer) drawSprite(ctx, haloSprite(p.rifle ? '#FFD23F' : p.overload ? '#FFD36A' : '#E8F0FF', p.overload || p.rifle ? 12 : 9, p.rifle ? 0.3 : 0.22), p.x, p.y);
      else            drawSprite(ctx, haloSprite(p.color, 12, 0.3), p.x, p.y);
    }
  }

  // ── Pulse Emitter shot ──────────────────────────────────────
  // Coherent light: a bright core with thin waves trailing behind it that
  // ripple in step (same phase on both sides), drawn as crisp screen pixels
  // to match the pixel-art map. Overload shots are the same pulse in gold.
  _drawPulse(ctx, p) {
    const t  = ctx.getTransform();
    const sx = t.a * p.x + t.e, sy = t.d * p.y + t.f;
    const ux = p.vx / p.speed, uy = p.vy / p.speed;    // travel direction
    const px = -uy, py = ux;                             // across it
    const gold = p.overload, rifle = p.rifle || p.tracer;
    const elec = p.arc || p.stunRound, rad = p.spun;
    // Raze's rounds: a long, thin gold streak with tight waves (a tracer even
    // longer); never orange
    const core = rifle ? '#FFF6C8' : gold ? '#FFE9A8' : elec ? '#F2FFD6' : rad ? '#F6DDFF' : '#FFFFFF';
    const wave = rifle ? '255,214,70' : gold ? '255,200,90' : elec ? '182,255,46' : rad ? '229,140,255' : '200,232,255';
    const coreLen = p.tracer ? 22 : rifle ? 16 : gold ? 10 : rad ? 11 : 8, coreW = gold || rad || rifle ? 3 : 2;
    const trail = Math.min(p.tracer ? 70 : rifle ? 52 : gold ? 34 : 28, p.traveled * t.a);   // grows out of the lens
    const base = rifle ? 2 : gold ? 4 : 3, amp = rifle ? 1 : 1.5, lambda = rifle ? 14 : 10;
    const phase = p.age * 30;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';

    // Two parallel waves, one either side of the path, rippling together —
    // the same phase on both, so they move in step. Joined pixel by pixel.
    for (const side of [1, -1]) {
      let lx = null, ly = null;
      for (let d = 3; d < trail; d += 1) {
        const f = 1 - d / trail;
        const off = base * side + Math.sin(d / lambda * Math.PI * 2 + phase) * amp;
        const x = Math.round(sx - ux * d + px * off), y = Math.round(sy - uy * d + py * off);
        ctx.fillStyle = `rgba(${wave},${(0.8 * f).toFixed(3)})`;
        if (lx !== null) _plotLine(ctx, lx, ly, x, y); else ctx.fillRect(x, y, 1, 1);
        lx = x; ly = y;
      }
    }
    // Faint centre line between them
    for (let d = 2; d < trail; d += 2) {
      ctx.fillStyle = `rgba(${wave},${(0.3 * (1 - d / trail)).toFixed(3)})`;
      ctx.fillRect(Math.round(sx - ux * d), Math.round(sy - uy * d), 1, 1);
    }

    // Core: a short bright streak, coreW pixels thick
    ctx.fillStyle = core;
    for (let d = 0; d < coreLen; d++) {
      for (let w = 0; w < coreW; w++) {
        const o = w - (coreW - 1) / 2;
        ctx.fillRect(Math.round(sx - ux * d + px * o), Math.round(sy - uy * d + py * o), 1, 1);
      }
    }

    // Half-Life: an unstable round sheds lilac motes behind it and wears a halo
    if (rad) {
      for (let k = 0; k < 4; k++) {
        const d = 6 + ((p.age * 120 + k * 9) % 34);
        const j = Math.sin(p.age * 40 + k * 2.3) * 4;
        ctx.fillStyle = `rgba(229,140,255,${(0.75 * (1 - d / 40)).toFixed(3)})`;
        ctx.fillRect(Math.round(sx - ux * d + px * j), Math.round(sy - uy * d + py * j), 2, 2);
      }
      ctx.fillStyle = 'rgba(229,140,255,0.35)';
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + p.age * 8; ctx.fillRect(Math.round(sx + Math.cos(a) * 5), Math.round(sy + Math.sin(a) * 5), 1, 1); }
    }

    // Muzzle ripple at the lens for the first moment — a ring that opens
    // and fades (soft, no flash)
    if (p.age < 0.08 && p.traveled < 40) {
      const k = p.age / 0.08;
      const r = 2 + k * 6;
      const ox = sx - ux * p.traveled * t.a, oy = sy - uy * p.traveled * t.a;
      ctx.fillStyle = `rgba(${wave},${(0.5 * (1 - k)).toFixed(3)})`;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        ctx.fillRect(Math.round(ox + Math.cos(a) * r), Math.round(oy + Math.sin(a) * r), 1, 1);
      }
    }
    ctx.restore();
  }

  // Where a shot ends (rack, edge or out of range) its light scatters: a few
  // pixels spraying back and fading in under a fifth of a second
  drawFizzles(ctx) {
    if (!this._fizzles.length && !this.punches.length) return;
    const t = ctx.getTransform();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    // Punch-Through: a gold ring of light where a round went into or out of
    // a rack, and a few chips thrown forward
    for (const k of this.punches) {
      const f = k.t / 0.3, sx = t.a * k.x + t.e, sy = t.d * k.y + t.f;
      ctx.fillStyle = `rgba(255,214,70,${(0.85 * (1 - f)).toFixed(3)})`;
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2, r = 2 + f * 9;
        ctx.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r * 0.7), 1, 1);
      }
      for (let i = 0; i < 4; i++) {
        const a = k.a + (i - 1.5) * 0.35, r = 3 + f * (10 + i * 3);
        ctx.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r), 2, 2);
      }
    }
    for (const f of this._fizzles) {
      const k = f.t / 0.18;
      const sx = t.a * f.x + t.e, sy = t.d * f.y + t.f;
      ctx.fillStyle = f.gold ? `rgba(255,200,90,${(0.8 * (1 - k)).toFixed(3)})` : `rgba(220,240,255,${(0.8 * (1 - k)).toFixed(3)})`;
      for (let i = 0; i < 6; i++) {
        const a = f.a + Math.PI + (i - 2.5) * 0.45;   // spray back the way it came
        const r = 2 + k * (6 + (i % 3) * 3);
        ctx.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r), 1, 1);
      }
    }
    ctx.restore();
  }
}
