// CHROMATIC DECAY — Map: Level 1 "The Basement"

import { CONFIG } from './config.js';
import { clamp } from './utils.js';

// ── Camera ────────────────────────────────────────────────────

export class Camera {
  constructor() { this.x = 0; this.y = 0; }

  follow(targetX, targetY, viewW, viewH) {
    this.x = clamp(targetX - viewW / 2, 0, CONFIG.map_width  - viewW);
    this.y = clamp(targetY - viewH / 2, 0, CONFIG.map_height - viewH);
  }
}

// ── Map ───────────────────────────────────────────────────────

const W = CONFIG.map_width;
const H = CONFIG.map_height;
const T = CONFIG.tile_size;   // 32

// Obstacle spec: { x, y, w, h }
// All coords in world pixels, origin top-left.

function makeRack(x, y, w, h) {
  return { x, y, w, h };
}

// ── Level 1 obstacle layout ───────────────────────────────────
// Design goal: break up straight kiting lanes with L-clusters,
// diagonal stagger, and offset groups that force S-curves and turns.
// All coords proportional — scales with W/H from config.

function buildObstacles() {
  const obs = [];
  // Short-hand: proportional to map size
  const p = (fx, fy, fw, fh) => makeRack(
    Math.round(fx * W), Math.round(fy * H),
    Math.round(fw * W), Math.round(fh * H)
  );

  // ── SPAWN AREA (y 0–25%) ──────────────────────────────────
  // Wall clusters + staggered mid units (off-center so no straight lanes)
  obs.push(p(0.04,  0.06, 0.05, 0.09));  // left wall top
  obs.push(p(0.04,  0.18, 0.04, 0.07));  // left wall mid
  obs.push(p(0.91,  0.06, 0.05, 0.09));  // right wall top
  obs.push(p(0.92,  0.18, 0.04, 0.07));  // right wall mid
  obs.push(p(0.27,  0.08, 0.03, 0.07));  // off-center left blocker
  obs.push(p(0.64,  0.13, 0.03, 0.07));  // off-center right (different y)
  obs.push(p(0.44,  0.19, 0.04, 0.03));  // horizontal near-center break

  // ── MID ZONE (y 25–50%) — L-clusters, slalom layout ─────
  // L-clusters: each is a vertical piece + perpendicular horizontal piece.
  // Positions are staggered so no clear horizontal or vertical lane exists.

  // L-cluster 1 — upper-left corner shape
  obs.push(p(0.09, 0.27, 0.04, 0.10));  // vertical
  obs.push(p(0.09, 0.27, 0.11, 0.03));  // horizontal right

  // L-cluster 2 — upper-right, mirrored orientation
  obs.push(p(0.84, 0.29, 0.04, 0.10));  // vertical
  obs.push(p(0.73, 0.29, 0.11, 0.03));  // horizontal left

  // L-cluster 3 — mid-left, different y (forces diagonal path)
  obs.push(p(0.19, 0.36, 0.03, 0.09));  // vertical
  obs.push(p(0.19, 0.43, 0.09, 0.03));  // horizontal right

  // L-cluster 4 — mid-right, again different y
  obs.push(p(0.74, 0.38, 0.03, 0.09));  // vertical
  obs.push(p(0.65, 0.44, 0.09, 0.03));  // horizontal left

  // Centre-left blocker (breaks any vertical lane near x=40%)
  obs.push(p(0.36, 0.40, 0.04, 0.08));
  obs.push(p(0.36, 0.40, 0.08, 0.03));  // cap piece

  // Centre-right blocker (offset y from centre-left — creates S-path)
  obs.push(p(0.56, 0.43, 0.04, 0.08));
  obs.push(p(0.48, 0.43, 0.08, 0.03));  // cap piece left

  // Side wall stubs to prevent edge-hugging
  obs.push(p(0.04, 0.29, 0.025, 0.15));
  obs.push(p(0.935, 0.29, 0.025, 0.15));

  // ── CENTER ZONE (y 50–75%) — staggered diagonal rows ────
  // Two diagonal rows of obstacles, alternating depth.
  // Row A (shallow y) and Row B (deeper y) offset by half-pitch.

  // Row A — items at alternating y positions creating a zigzag
  obs.push(p(0.13, 0.52, 0.04, 0.06));
  obs.push(p(0.27, 0.55, 0.04, 0.06));
  obs.push(p(0.41, 0.52, 0.04, 0.06));
  obs.push(p(0.55, 0.55, 0.04, 0.06));
  obs.push(p(0.69, 0.52, 0.04, 0.06));
  obs.push(p(0.83, 0.55, 0.04, 0.06));

  // Row B — deeper, offset from row A (forces direction change between rows)
  obs.push(p(0.07, 0.63, 0.035, 0.07));
  obs.push(p(0.21, 0.66, 0.035, 0.07));
  obs.push(p(0.35, 0.63, 0.035, 0.07));
  obs.push(p(0.49, 0.66, 0.035, 0.07));
  obs.push(p(0.63, 0.63, 0.035, 0.07));
  obs.push(p(0.77, 0.66, 0.035, 0.07));
  obs.push(p(0.89, 0.63, 0.035, 0.07));

  // Wall juts — push players away from edges so they can't hug walls
  obs.push(p(0.04, 0.54, 0.06, 0.03));
  obs.push(p(0.04, 0.67, 0.06, 0.03));
  obs.push(p(0.90, 0.54, 0.06, 0.03));
  obs.push(p(0.90, 0.67, 0.06, 0.03));

  // ── DEEP ZONE (y 75–100%) — tight irregular clusters ────
  // Three cluster groups (left / centre / right) with forced turns.
  // Each group has obstacles at two depth levels (upper and lower).

  // Group A — left quadrant
  obs.push(p(0.05,  0.77, 0.04, 0.09));
  obs.push(p(0.13,  0.79, 0.04, 0.09));  // offset y
  obs.push(p(0.21,  0.77, 0.04, 0.08));
  obs.push(p(0.05,  0.90, 0.04, 0.07));
  obs.push(p(0.14,  0.91, 0.04, 0.07));

  // Group B — centre (x offset so no straight path between A and C)
  obs.push(p(0.36,  0.76, 0.04, 0.08));
  obs.push(p(0.43,  0.80, 0.04, 0.08));
  obs.push(p(0.36,  0.89, 0.04, 0.07));
  obs.push(p(0.44,  0.88, 0.04, 0.07));

  // Group C — right quadrant (mirror of A but different y offsets)
  obs.push(p(0.74,  0.77, 0.04, 0.09));
  obs.push(p(0.82,  0.79, 0.04, 0.09));
  obs.push(p(0.90,  0.77, 0.04, 0.08));
  obs.push(p(0.74,  0.90, 0.04, 0.07));
  obs.push(p(0.83,  0.91, 0.04, 0.07));

  // Bottom blockers near back wall — scattered, not aligned
  obs.push(p(0.10,  0.93, 0.03, 0.05));
  obs.push(p(0.24,  0.92, 0.03, 0.05));
  obs.push(p(0.41,  0.93, 0.03, 0.05));
  obs.push(p(0.57,  0.92, 0.03, 0.05));
  obs.push(p(0.71,  0.93, 0.03, 0.05));
  obs.push(p(0.87,  0.92, 0.03, 0.05));

  return obs;
}

export class GameMap {
  constructor() {
    this.obstacles = buildObstacles();
    this._defineZones();
  }

  _defineZones() {
    this.spawnZone  = { x: 0, y: 0,        w: W, h: H * 0.25 };
    this.midZone    = { x: 0, y: H * 0.25, w: W, h: H * 0.25 };
    this.centerZone = { x: 0, y: H * 0.50, w: W, h: H * 0.25 };
    this.deepZone   = { x: 0, y: H * 0.75, w: W, h: H * 0.25 };
  }

  playerSpawn() {
    return { x: W / 2, y: H * 0.12 };
  }

  // Spawn anywhere on the map at least minPlayerDist from the player
  // and at least minEnemyDist from each position in enemyPositions.
  randomSpawn(playerX, playerY, enemyPositions = [], minPlayerDist = 300, minEnemyDist = 110) {
    const INSET = 60;
    const candidates = [];
    for (let i = 0; i < 24; i++) {
      candidates.push({
        x: INSET + Math.random() * (W - INSET * 2),
        y: INSET + Math.random() * (H - INSET * 2),
      });
    }

    const PAD = 22; // enemy half-size + margin
    const inWall = c => {
      for (const obs of this.obstacles) {
        if (c.x + PAD > obs.x && c.x - PAD < obs.x + obs.w &&
            c.y + PAD > obs.y && c.y - PAD < obs.y + obs.h) return true;
      }
      return false;
    };

    const passesBoth = c => {
      if (inWall(c)) return false;
      const pdx = c.x - playerX, pdy = c.y - playerY;
      if (pdx * pdx + pdy * pdy < minPlayerDist * minPlayerDist) return false;
      for (const ep of enemyPositions) {
        const ex = c.x - ep.x, ey = c.y - ep.y;
        if (ex * ex + ey * ey < minEnemyDist * minEnemyDist) return false;
      }
      return true;
    };

    const passesPlayer = c => {
      if (inWall(c)) return false;
      const dx = c.x - playerX, dy = c.y - playerY;
      return dx * dx + dy * dy >= minPlayerDist * minPlayerDist;
    };

    let valid = candidates.filter(passesBoth);
    if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];

    // Fallback: relax enemy spacing, keep player distance
    valid = candidates.filter(passesPlayer);
    return valid.length > 0 ? valid[Math.floor(Math.random() * valid.length)] : candidates[0];
  }

  randomDeepPosition() {
    const z = this.deepZone;
    return {
      x: z.x + 80 + Math.random() * (z.w - 160),
      y: z.y + 40 + Math.random() * (z.h - 80),
    };
  }

  // Floor never changes, so it is rendered once to an offscreen canvas
  drawFloor(ctx) {
    if (!this._floor) this._floor = this._buildFloor();
    ctx.drawImage(this._floor, 0, 0);
  }

  _buildFloor() {
    const c   = document.createElement('canvas');
    c.width   = W;
    c.height  = H;
    const ctx = c.getContext('2d');

    // ── Tile floor ────────────────────────────────────────────
    for (let ty = 0; ty < H / T; ty++) {
      for (let tx = 0; tx < W / T; tx++) {
        ctx.fillStyle = (tx + ty) % 2 === 0 ? '#13151C' : '#0F1118';
        ctx.fillRect(tx * T, ty * T, T, T);
      }
    }

    // ── Emergency floor strips — faint red glow at map edges ──
    // Left edge
    const edgeW = 48;
    const grad = ctx.createLinearGradient(0, 0, edgeW, 0);
    grad.addColorStop(0, 'rgba(58,10,10,0.55)');
    grad.addColorStop(1, 'rgba(58,10,10,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(20, 20, edgeW, H - 40);

    // Right edge
    const gradR = ctx.createLinearGradient(W - edgeW, 0, W, 0);
    gradR.addColorStop(0, 'rgba(58,10,10,0)');
    gradR.addColorStop(1, 'rgba(58,10,10,0.55)');
    ctx.fillStyle = gradR;
    ctx.fillRect(W - edgeW - 20, 20, edgeW, H - 40);

    // Bottom edge (deep racks — most danger)
    const gradB = ctx.createLinearGradient(0, H - edgeW, 0, H);
    gradB.addColorStop(0, 'rgba(58,10,10,0)');
    gradB.addColorStop(1, 'rgba(58,10,10,0.7)');
    ctx.fillStyle = gradB;
    ctx.fillRect(20, H - edgeW - 20, W - 40, edgeW);

    // ── Cable tray lines ──────────────────────────────────────
    // Faint horizontal infrastructure marks across mid zone
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#2A2E42';
    ctx.lineWidth   = 1;
    const cableYs = [560, 640, 720, 800, 880, 1520, 1600, 1680, 1760];
    for (const cy of cableYs) {
      ctx.beginPath();
      ctx.moveTo(20, cy);
      ctx.lineTo(W - 20, cy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Collapsed center atmosphere ───────────────────────────
    // Subtle darkening in the clearing to give it a pit-like feel
    ctx.globalAlpha = 0.18;
    ctx.fillStyle   = '#000000';
    ctx.fillRect(0, H * 0.5, W, H * 0.25);
    ctx.globalAlpha = 1;

    // ── Deep racks atmosphere ─────────────────────────────────
    // Dark crimson tint — makes the floor visually distinct from pure black
    // and signals danger (this is the hardest zone)
    ctx.globalAlpha = 0.22;
    ctx.fillStyle   = '#2A0808';
    ctx.fillRect(0, H * 0.75, W, H * 0.25);
    ctx.globalAlpha = 1;

    // Vertical gradient fade from collapsed center into deep racks
    const deepFade = ctx.createLinearGradient(0, H * 0.75, 0, H * 0.75 + 240);
    deepFade.addColorStop(0, 'rgba(40,6,6,0.30)');
    deepFade.addColorStop(1, 'rgba(40,6,6,0)');
    ctx.fillStyle = deepFade;
    ctx.fillRect(0, H * 0.75, W, 240);

    // ── Ambient occlusion — soft dark pool around each rack base ──
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = 'rgba(0,0,0,0.7)';
    for (const obs of this.obstacles) ctx.fillRect(obs.x - 2, obs.y - 2, obs.w + 4, obs.h + 4);
    ctx.restore();

    // ── Border walls ──────────────────────────────────────────
    const B = 20;
    ctx.fillStyle = '#1A1C28';
    ctx.fillRect(0,     0,     W, B);
    ctx.fillRect(0,     H - B, W, B);
    ctx.fillRect(0,     0,     B, H);
    ctx.fillRect(W - B, 0,     B, H);

    ctx.strokeStyle = '#3A0A0A';
    ctx.lineWidth   = 2;
    ctx.strokeRect(B, B, W - B * 2, H - B * 2);

    // ── Zone label watermarks ─────────────────────────────────
    ctx.fillStyle    = '#1E2130';
    ctx.font         = 'bold 18px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha  = 0.35;
    ctx.fillText('THE BASEMENT',    W / 2, H * 0.125);
    ctx.fillText('SERVER ROWS',     W / 2, H * 0.375);
    ctx.fillText('COLLAPSED FLOOR', W / 2, H * 0.625);
    ctx.fillText('DEEP RACKS',      W / 2, H * 0.875);
    ctx.globalAlpha  = 1;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';

    return c;
  }

  // ── Racks as 3D boxes ───────────────────────────────────────
  // The camera sits above the screen centre (cx, cy). Each rack's top face is
  // its footprint scaled away from that point by 1 + k, so racks lean outward
  // toward the screen edges. Collision still uses the flat footprint.
  // lightAt(x, y, nx, ny) → 0–1 player light at a point (normal 0,0 = top face).
  drawWalls(ctx, cx, cy, k, view, lightAt) {
    const s      = 1 + k;
    const margin = 60;
    const racks  = [];
    for (const o of this.obstacles) {
      if (o.x + o.w < view.x - margin || o.x > view.x + view.w + margin ||
          o.y + o.h < view.y - margin || o.y > view.y + view.h + margin) continue;
      const mx = o.x + o.w / 2, my = o.y + o.h / 2;
      racks.push({
        o,
        d:  (mx - cx) ** 2 + (my - cy) ** 2,
        tx: cx + (o.x - cx) * s,
        ty: cy + (o.y - cy) * s,
        tw: o.w * s,
        th: o.h * s,
      });
    }
    // Farthest first, so nearer side faces paint over farther ones
    racks.sort((a, b) => b.d - a.d);

    // Side faces first, then tops — all tops share one height, so no top
    // can ever be behind another rack's side face
    for (const r of racks) this._drawSides(ctx, r, cx, cy, lightAt);
    for (const r of racks) this._drawTop(ctx, r, lightAt);
    for (const r of racks) this._drawRim(ctx, r, lightAt);
  }

  _drawSides(ctx, r, cx, cy, lightAt) {
    const { o, tx, ty, tw, th } = r;
    // [base x1,y1, base x2,y2, top above x2, top above x1, normal]
    const faces = [];
    if (o.y + o.h < cy) faces.push([o.x, o.y + o.h, o.x + o.w, o.y + o.h, tx + tw, ty + th, tx,      ty + th,  0,  1]);
    if (o.y > cy)       faces.push([o.x, o.y,       o.x + o.w, o.y,       tx + tw, ty,      tx,      ty,       0, -1]);
    if (o.x + o.w < cx) faces.push([o.x + o.w, o.y, o.x + o.w, o.y + o.h, tx + tw, ty + th, tx + tw, ty,       1,  0]);
    if (o.x > cx)       faces.push([o.x,       o.y, o.x,       o.y + o.h, tx,      ty + th, tx,      ty,      -1,  0]);

    for (const [x1, y1, x2, y2, x3, y3, x4, y4, nx, ny] of faces) {
      const lit     = lightAt((x1 + x2) / 2 + nx * 2, (y1 + y2) / 2 + ny * 2, nx, ny);
      const ambient = (nx < 0 || ny < 0) ? 0.10 : 0.06;   // up/left faces catch the key light

      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
      ctx.closePath();
      ctx.fillStyle = '#0a0f16';
      ctx.fill();
      ctx.fillStyle = `rgba(150,215,255,${ambient + lit * 0.5})`;
      ctx.fill();

      // Rack-unit lines across the face
      ctx.strokeStyle = `rgba(0,229,255,${0.10 + lit * 0.25})`;
      ctx.lineWidth   = 0.75;
      ctx.beginPath();
      for (const t of [0.3, 0.55, 0.8]) {
        ctx.moveTo(x1 + (x4 - x1) * t, y1 + (y4 - y1) * t);
        ctx.lineTo(x2 + (x3 - x2) * t, y2 + (y3 - y2) * t);
      }
      ctx.stroke();

      // Rim light where the face meets the top
      ctx.strokeStyle = `rgba(0,229,255,${0.35 + lit * 0.4})`;
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(x4, y4); ctx.lineTo(x3, y3); ctx.stroke();
    }
  }

  // Footprint edge segments not buried inside another rack (cached per rack)
  _rimEdges(o) {
    if (o._rim) return o._rim;
    const others = this.obstacles.filter(b => b !== o);
    // Subtract covered intervals from [a0, a1] along one axis
    const visible = (a0, a1, covers) => {
      let parts = [[a0, a1]];
      for (const [c0, c1] of covers) {
        parts = parts.flatMap(([p0, p1]) => {
          if (c1 <= p0 || c0 >= p1) return [[p0, p1]];
          const out = [];
          if (c0 > p0) out.push([p0, c0]);
          if (c1 < p1) out.push([c1, p1]);
          return out;
        });
      }
      return parts;
    };
    const rim = [];
    for (const y of [o.y, o.y + o.h]) {
      const covers = others.filter(b => y > b.y && y < b.y + b.h).map(b => [b.x, b.x + b.w]);
      for (const [a, b] of visible(o.x, o.x + o.w, covers)) rim.push([a, y, b, y]);
    }
    for (const x of [o.x, o.x + o.w]) {
      const covers = others.filter(b => x > b.x && x < b.x + b.w).map(b => [b.y, b.y + b.h]);
      for (const [a, b] of visible(o.y, o.y + o.h, covers)) rim.push([x, a, x, b]);
    }
    o._rim = rim;
    return rim;
  }

  _drawTop(ctx, r, lightAt) {
    const { o, tx, ty, tw, th } = r;
    const lit   = lightAt(o.x + o.w / 2, o.y + o.h / 2, 0, 0);
    const inset = 3;

    ctx.fillStyle = '#16202b';
    ctx.fillRect(tx, ty, tw, th);
    ctx.fillStyle = `rgba(190,240,255,${0.06 + lit * 0.4})`;
    ctx.fillRect(tx, ty, tw, th);

    // Screen panel + scan-line
    const sh = Math.min(16, th * 0.3);
    ctx.fillStyle = `rgba(160,240,255,${0.18 + lit * 0.35})`;
    ctx.fillRect(tx + inset, ty + inset, tw - inset * 2, sh);
    ctx.fillStyle = 'rgba(0,229,255,0.5)';
    ctx.fillRect(tx + inset, ty + inset + sh * 0.5, tw - inset * 2, 1);

    // Vents
    if (th > sh + 24) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let i = 0; i < 3; i++) ctx.fillRect(tx + inset, ty + inset + sh + 5 + i * 5, tw - inset * 2, 1.5);
    }

    // LED strip along the south rim (tall racks) — always visible
    if (o.h > 60) {
      const lx = tx + 4, ly = ty + th - 6, lw = tw - 8;
      ctx.fillStyle = 'rgba(0,255,255,0.25)';
      ctx.fillRect(lx - 2, ly - 2, lw + 4, 7);
      ctx.fillStyle = '#00FFFF';
      ctx.fillRect(lx, ly, lw, 3);
    }
  }

  // Rim glow — wide soft stroke + thin bright stroke (cheaper than shadowBlur).
  // Only outer edges are stroked, so overlapping racks (L-clusters) read as one shape.
  _drawRim(ctx, r, lightAt) {
    const { o, tx, ty, tw } = r;
    const lit = lightAt(o.x + o.w / 2, o.y + o.h / 2, 0, 0);
    const s = tw / o.w;
    const ox = tx - o.x * s, oy = ty - o.y * s;   // footprint → top-face transform
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of this._rimEdges(o)) {
      ctx.moveTo(ox + x1 * s, oy + y1 * s);
      ctx.lineTo(ox + x2 * s, oy + y2 * s);
    }
    ctx.strokeStyle = 'rgba(0,229,255,0.16)';
    ctx.lineWidth   = 4;
    ctx.stroke();
    ctx.strokeStyle = `rgba(0,229,255,${0.6 + lit * 0.4})`;
    ctx.lineWidth   = 1;
    ctx.stroke();
  }
}
