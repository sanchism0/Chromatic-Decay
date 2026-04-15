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

    const passesBoth = c => {
      const pdx = c.x - playerX, pdy = c.y - playerY;
      if (pdx * pdx + pdy * pdy < minPlayerDist * minPlayerDist) return false;
      for (const ep of enemyPositions) {
        const ex = c.x - ep.x, ey = c.y - ep.y;
        if (ex * ex + ey * ey < minEnemyDist * minEnemyDist) return false;
      }
      return true;
    };

    const passesPlayer = c => {
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

  draw(ctx) {
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

    // ── Server rack obstacles ─────────────────────────────────
    for (const obs of this.obstacles) {
      // Strong blue glow halo
      ctx.shadowColor = '#4488FF';
      ctx.shadowBlur  = 20;
      ctx.fillStyle   = '#E8EFFF';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.shadowBlur  = 0;

      // Screen panel — pure white
      const screenH = Math.min(24, obs.h * 0.35);
      const screenInset = 4;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(
        obs.x + screenInset,
        obs.y + screenInset,
        obs.w - screenInset * 2,
        screenH
      );

      // Scan-line
      ctx.globalAlpha = 0.4;
      ctx.fillStyle   = '#6680FF';
      ctx.fillRect(obs.x + screenInset, obs.y + screenInset + screenH * 0.45, obs.w - screenInset * 2, 1);
      ctx.globalAlpha = 1;

      // Bright white edge
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.9;
      ctx.strokeRect(obs.x + 0.5, obs.y + 0.5, obs.w - 1, obs.h - 1);
      ctx.globalAlpha = 1;

      // Status LED row — vivid cyan-blue
      if (obs.h > 60) {
        ctx.shadowColor = '#00AAFF';
        ctx.shadowBlur  = 6;
        ctx.fillStyle   = '#00CCFF';
        ctx.fillRect(obs.x + 4, obs.y + obs.h - 6, obs.w - 8, 3);
        ctx.shadowBlur  = 0;
      }
    }

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
  }
}
