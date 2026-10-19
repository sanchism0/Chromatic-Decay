// CHROMATIC DECAY — Colour Drain (kill effect)
//
// When a Chromatic dies its stolen colour comes loose and is pulled into the player:
//   0.00–0.30s  Unravel  the ghost's glow swells and fades; faint motes swirl outward
//   0.30–0.50s  Hang     motes slow and drift; a stain of the colour lingers on the floor
//   0.50–0.92s  Drain    each mote flies straight past the player's shoulder, wraps half a
//                        turn tight around them and is absorbed (soft ring + glow tint)
// Purely visual, plus a per-colour count for the run. No flashing anywhere.

const HANG_END  = 0.5;          // motes start draining after this
const STAGGER   = 0.06;         // spread of drain start across one kill's motes
const DRAIN     = 0.34;         // seconds from leaving the hang to absorption
const SWEEP     = Math.PI;      // half a turn around the player before absorbing
const ORBIT     = 14;           // px from the player's centre where motes start to wrap
const ORBIT_END = 3;
const RING      = 0.25;         // absorb ring lifetime
const MAX_MOTES = 36;           // per kill
const MAX_TOTAL = 260;          // across all kills, so huge waves stay cheap
const HALO_R    = 32;           // cached glow sprite radius; drawn scaled

// Absorb glow strength per type. Light colours read much brighter under additive
// blending, so they're scaled down to match violet and pink.
const PULSE = { violet: 1.0, yellow: 0.4, green: 0.45, orange: 0.55, pink: 1.0 };

// Linear-falloff glow, cached per colour (matches the approved prototype's look)
const _glow = new Map();
function glowSprite(color) {
  let c = _glow.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = HALO_R * 2;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(HALO_R, HALO_R, 0, HALO_R, HALO_R, HALO_R);
    grad.addColorStop(0, rgbaHex(color, 1));
    grad.addColorStop(1, rgbaHex(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, HALO_R * 2, HALO_R * 2);
    _glow.set(color, c);
  }
  return c;
}

function halo(ctx, color, x, y, r, a) {
  if (a <= 0.003) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
}

function rgbaHex(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

export class DrainSystem {
  constructor() { this.reset(); }

  reset() {
    this.motes  = [];
    this.bursts = [];   // unravelling ghost glow
    this.stains = [];
    this.rings  = [];
    this.tint   = null;
    this.tintK  = 1;
    this.tintA  = 0;
    this.bank   = { violet: 0, yellow: 0, green: 0, orange: 0, pink: 0 };
  }

  // Call once per dead enemy; safe to call twice for the same one
  spawn(e) {
    if (e._drained) return;
    e._drained = true;
    const cfg  = e.cfg;
    const r    = e.drawSize;
    const by   = e.y - e.lift;
    const mote = cfg.edge_color || cfg.color;
    this.bursts.push({ x: e.x, y: by, r, color: cfg.glow_color, t: 0 });
    this.stains.push({ x: e.x, y: e.y, r: r * 3, color: cfg.color, t: 0 });

    const room = MAX_TOTAL - this.motes.length;
    const n    = Math.min(MAX_MOTES, cfg.residual_drop || 5, room);
    const dir  = Math.random() < 0.5 ? -1 : 1;   // one kill wraps one way, like a small vortex
    const big  = e.type === 'pink' ? 30 : 0;
    for (let i = 0; i < n; i++) {
      const a    = Math.random() * Math.PI * 2;
      const sp   = 30 + Math.random() * 50 + big;
      const spin = Math.random() < 0.5 ? -1 : 1;
      this.motes.push({
        x: e.x + Math.cos(a) * r * 0.6, y: by + Math.sin(a) * r * 0.6,
        vx: Math.cos(a) * sp - Math.sin(a) * sp * 0.6 * spin,
        vy: Math.sin(a) * sp + Math.cos(a) * sp * 0.6 * spin,
        type: e.type, color: mote, t: 0, dir, path: null, trail: [],
        delay: HANG_END + (i / n) * STAGGER + Math.random() * 0.02,
        size: 1.6 + Math.random() * 1.4,
      });
    }
  }

  update(dt, player) {
    const px = player.x, py = player.y - player.lift;
    this.tintA = Math.max(0, this.tintA - dt * 1.4);

    for (const m of this.motes) {
      m.t += dt;
      m.trail.push(m.x, m.y);
      if (m.trail.length > 12) m.trail.splice(0, 2);

      if (m.t < m.delay) {
        // Unravel + hang: drag bleeds off the burst speed
        const drag = m.t < 0.3 ? 2.2 : 5.5;
        m.vx *= Math.exp(-drag * dt); m.vy *= Math.exp(-drag * dt);
        m.x += m.vx * dt; m.y += m.vy * dt;
        continue;
      }

      // Drain: a straight line that just grazes the player (aimed past the shoulder),
      // then half a turn tight around them. The line is tangent to the orbit, so the
      // hand-off is seamless. Stored relative to the player so it follows them.
      if (!m.path) {
        const dx = m.x - px, dy = m.y - py;
        const r0 = Math.hypot(dx, dy), a0 = Math.atan2(dy, dx);
        const far = r0 > ORBIT;
        const rs  = far ? ORBIT : r0;
        m.path = {
          sx: dx, sy: dy, rs,
          th:   far ? a0 + m.dir * Math.acos(ORBIT / r0) : a0,
          line: far ? Math.sqrt(r0 * r0 - ORBIT * ORBIT) : 0,
          orb:  SWEEP * (rs + ORBIT_END) / 2,
        };
      }
      const P = m.path;
      const k = Math.min(1, (m.t - m.delay) / DRAIN);
      const s = (P.line + P.orb) * Math.pow(k, 1.5);   // accelerating out of the hang
      if (s < P.line) {
        const f = s / P.line, tx = Math.cos(P.th) * P.rs, ty = Math.sin(P.th) * P.rs;
        m.x = px + P.sx + (tx - P.sx) * f;
        m.y = py + P.sy + (ty - P.sy) * f;
      } else {
        const u   = (s - P.line) / P.orb;
        const ang = P.th + m.dir * SWEEP * u;
        const rad = P.rs + (ORBIT_END - P.rs) * u;
        m.x = px + Math.cos(ang) * rad;
        m.y = py + Math.sin(ang) * rad;
      }

      if (k >= 1) {
        m.dead = true;
        this.bank[m.type] = (this.bank[m.type] || 0) + 1;
        const pk = PULSE[m.type] ?? 1;
        if (this.rings.length < 14) this.rings.push({ color: m.color, t: 0, pk });
        this.tint  = m.color;
        this.tintK = pk;
        this.tintA = Math.min(1, this.tintA + 0.35);
      }
    }
    this.motes = this.motes.filter(m => !m.dead);

    for (const b of this.bursts) b.t += dt;
    for (const s of this.stains) s.t += dt;
    for (const r of this.rings)  r.t += dt;
    this.bursts = this.bursts.filter(b => b.t < 0.3);
    this.stains = this.stains.filter(s => s.t < 0.9);
    this.rings  = this.rings.filter(r => r.t < RING);
  }

  // Floor layer — under entities
  drawFloor(ctx) {
    if (!this.stains.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.stains) {
      const a = s.t < 0.15 ? s.t / 0.15 : 1 - (s.t - 0.15) / 0.75;
      halo(ctx, s.color, s.x, s.y, s.r, 0.16 * a);
    }
    ctx.restore();
  }

  // Effect layer — over the player so motes wrap around them
  draw(ctx, player) {
    const px = player.x, py = player.y - player.lift;
    if (!this.motes.length && !this.bursts.length && !this.rings.length && this.tintA <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Unravel: the ghost's glow swells ~25% and fades out
    for (const b of this.bursts) {
      const k = b.t / 0.3;
      const fade = (1 - k) * (1 - k);
      halo(ctx, b.color, b.x, b.y, b.r * 3 * (1 + 0.25 * k), 0.3 * fade);
      halo(ctx, b.color, b.x, b.y, b.r * 1.5 * (1 + 0.25 * k), 0.45 * fade);
    }

    // Motes — a faint haze like a Chromatic's halo, no bright centre
    ctx.lineCap = 'round';
    for (const m of this.motes) {
      const tr = m.trail;
      if (tr.length >= 4) {
        ctx.globalAlpha = 1;
        for (let i = 2; i < tr.length; i += 2) {
          const f = i / tr.length;
          ctx.strokeStyle = rgbaHex(m.color, 0.14 * f);
          ctx.lineWidth   = m.size * 1.4 * f;
          ctx.beginPath(); ctx.moveTo(tr[i - 2], tr[i - 1]);
          ctx.lineTo(i + 1 < tr.length ? tr[i] : m.x, i + 1 < tr.length ? tr[i + 1] : m.y);
          ctx.stroke();
        }
        ctx.strokeStyle = rgbaHex(m.color, 0.16);
        ctx.lineWidth   = m.size * 1.4;
        ctx.beginPath(); ctx.moveTo(tr[tr.length - 2], tr[tr.length - 1]); ctx.lineTo(m.x, m.y); ctx.stroke();
      }
      const fadeIn  = Math.min(1, m.t / 0.12);
      const flicker = 0.85 + Math.sin(m.t * 14 + m.size * 7) * 0.15;
      halo(ctx, m.color, m.x, m.y, m.size * 4.5, 0.13 * fadeIn * flicker);
      halo(ctx, m.color, m.x, m.y, m.size * 1.8, 0.22 * fadeIn * flicker);
    }

    // Absorb: faint ring off the player and a brief tint of the colour
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const k = r.t / RING, ease = 1 - (1 - k) ** 3;
      ctx.strokeStyle = rgbaHex(r.color, 0.3 * r.pk * (1 - k));
      ctx.lineWidth   = 1.5 * (1 - k) + 0.5;
      ctx.beginPath(); ctx.arc(px, py, 9 + 12 * ease, 0, Math.PI * 2); ctx.stroke();
    }
    if (this.tint && this.tintA > 0) halo(ctx, this.tint, px, py, 28, 0.45 * this.tintK * this.tintA);

    ctx.restore();
  }
}
