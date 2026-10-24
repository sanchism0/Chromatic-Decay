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

// ── Level 2 "Cold Storage" ────────────────────────────────────
// The frozen archive: four rows of long, tall cold racks make horizontal
// aisles; the cross-gaps between racks are staggered row to row, so you weave
// down the map instead of running straight. The door is top centre; the
// freight lift is in the bottom-right corner.
function buildColdStorage() {
  const obs = [];
  const p = (fx, fy, fw, fh) => obs.push(makeRack(
    Math.round(fx * W), Math.round(fy * H), Math.round(fw * W), Math.round(fh * H)));
  const ROW_H = 0.055;
  // Rows A and C: three long racks; rows B and D: shifted, so gaps don't line up
  for (const y of [0.20, 0.56]) { p(0.06, y, 0.24, ROW_H); p(0.38, y, 0.24, ROW_H); p(0.70, y, 0.24, ROW_H); }
  for (const y of [0.38, 0.74]) { p(0.12, y, 0.12, ROW_H); p(0.32, y, 0.24, ROW_H); p(0.64, y, 0.22, ROW_H); }
  // A few short freezer units in the aisles break up long sightlines
  p(0.28, 0.30, 0.03, 0.035); p(0.66, 0.48, 0.03, 0.035);
  p(0.14, 0.65, 0.03, 0.035); p(0.56, 0.86, 0.03, 0.035);
  return obs;
}

// ── Level 3 "The Stacks" ──────────────────────────────────────
// Towers of old tape in a ring round an open centre (the vault, and the boss
// arena). Three sealed pockets (racks on all four sides, no way in on foot)
// hold the beam mirrors: you lob an ability over the walls to turn them.
// A few low shelves break up the outer ring. The door is top centre.
export const STACKS = {
  centre: [0.5, 0.5],
  ringR: 0.27,
  pockets: [[0.12, 0.50], [0.50, 0.88], [0.88, 0.50]],   // centres of the sealed pockets
  pocketIn: 0.075, pocketWall: 0.02,                       // interior size, wall thickness
};
function buildStacks() {
  const obs = [];
  const p = (fx, fy, fw, fh) => obs.push(makeRack(
    Math.round(fx * W), Math.round(fy * H), Math.round(fw * W), Math.round(fh * H)));
  // The ring: eight tall tape towers, turned so the gaps between them face
  // straight up, down, left and right (the way in from the door, and the
  // beam's lines to the pockets)
  const T = 0.075;
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + Math.PI / 8;
    const cx = 0.5 + Math.cos(a) * STACKS.ringR, cy = 0.5 + Math.sin(a) * STACKS.ringR;
    p(cx - T / 2, cy - T / 2, T, T);
  }
  // Sealed pockets
  const I = STACKS.pocketIn, Wt = STACKS.pocketWall;
  for (const [cx, cy] of STACKS.pockets) {
    const x0 = cx - I / 2 - Wt, y0 = cy - I / 2 - Wt, S = I + 2 * Wt;
    p(x0, y0, S, Wt); p(x0, y0 + S - Wt, S, Wt);           // top, bottom
    p(x0, y0 + Wt, Wt, I); p(x0 + S - Wt, y0 + Wt, Wt, I); // left, right
  }
  // Low tape shelves in the outer ring
  p(0.20, 0.17, 0.10, 0.03); p(0.70, 0.30, 0.03, 0.08);
  p(0.24, 0.70, 0.03, 0.09); p(0.70, 0.76, 0.10, 0.03);
  p(0.08, 0.30, 0.08, 0.03); p(0.84, 0.70, 0.08, 0.03);
  return obs;
}

// ── Level 4 "Wire Room" ───────────────────────────────────────
// The Basement's switchboard: a maze of thick cable bundles in the main room
// (top left), walled off from an L-shaped corridor that runs down the right
// side and back along the bottom to the far door. The escape runs down that
// corridor; WIRE.wires are the live wires across it.
export const WIRE = {
  wallX: 0.83, wallY: 0.72,             // inner corridor walls
  corridorIn: [0.915, 0.20],            // where the corridor starts (top right)
  door: [0.07, 0.86],                   // the far door (bottom left)
  // Live wires: [x1, y1, x2, y2] as fractions, each spanning the corridor
  wires: [[0.85, 0.42, 1.0, 0.42], [0.85, 0.60, 1.0, 0.60], [0.62, 0.74, 0.62, 1.0], [0.30, 0.74, 0.30, 1.0]],
};
function buildWireRoom() {
  const obs = [];
  const p = (fx, fy, fw, fh) => obs.push(makeRack(
    Math.round(fx * W), Math.round(fy * H), Math.round(fw * W), Math.round(fh * H)));
  const T = 0.03;
  // Corridor walls: down the right (open at the top, into the room), then
  // along the bottom (open at the right, round the corner)
  p(WIRE.wallX, 0.30, T, WIRE.wallY - 0.30 + T);
  p(0.0, WIRE.wallY, WIRE.wallX, T);
  // The maze of cable bundles
  p(0.08, 0.20, 0.22, T); p(0.40, 0.17, 0.28, T);
  p(0.32, 0.26, T, 0.17); p(0.14, 0.30, T, 0.12);
  p(0.08, 0.50, 0.20, T); p(0.48, 0.38, 0.22, T);
  p(0.60, 0.48, T, 0.16); p(0.22, 0.60, 0.26, T);
  p(0.42, 0.48, 0.10, T); p(0.70, 0.62, 0.10, T);
  // A few stubs in the corridor (cover, never blocking it)
  p(0.88, 0.50, 0.04, 0.03); p(0.46, 0.80, 0.03, 0.05); p(0.15, 0.94, 0.05, 0.03);
  return obs;
}

// Floor nothing may spawn or blink onto: the inside of the sealed pockets
function stacksNoSpawn() {
  const s = (STACKS.pocketIn / 2 + STACKS.pocketWall) * W;
  return STACKS.pockets.map(([cx, cy]) => ({ x: cx * W - s, y: cy * H - s, w: s * 2, h: s * 2 }));
}

const LAYOUTS = {
  basement: { build: buildObstacles,    spawn: [0.5, 0.12] },
  cold:     { build: buildColdStorage,  spawn: [0.5, 0.10] },
  stacks:   { build: buildStacks,       spawn: [0.5, 0.10], noSpawn: stacksNoSpawn },
  wire:     { build: buildWireRoom,     spawn: [0.42, 0.08] },
};

export class GameMap {
  // layout: which room ('basement' for Arcade, the tutorial and Level 1)
  constructor(layout = 'basement') {
    this.layout = LAYOUTS[layout] ? layout : 'basement';
    this.obstacles = LAYOUTS[this.layout].build();
    this.noSpawn   = LAYOUTS[this.layout].noSpawn ? LAYOUTS[this.layout].noSpawn() : [];
    this._defineZones();
  }

  _defineZones() {
    this.spawnZone  = { x: 0, y: 0,        w: W, h: H * 0.25 };
    this.midZone    = { x: 0, y: H * 0.25, w: W, h: H * 0.25 };
    this.centerZone = { x: 0, y: H * 0.50, w: W, h: H * 0.25 };
    this.deepZone   = { x: 0, y: H * 0.75, w: W, h: H * 0.25 };
  }

  playerSpawn() {
    const [fx, fy] = LAYOUTS[this.layout].spawn;
    return { x: W * fx, y: H * fy };
  }

  // Spawn anywhere on the map at least minPlayerDist from the player
  // and at least minEnemyDist from each position in enemyPositions.
  // prefAngle (radians, optional): prefer spots in that direction from the
  // player, within about ±50°; falls back to anywhere if none are free
  randomSpawn(playerX, playerY, enemyPositions = [], minPlayerDist = 300, minEnemyDist = 110, prefAngle = null) {
    const INSET = 60;
    const candidates = [];
    for (let i = 0; i < 48; i++) {
      candidates.push({
        x: INSET + Math.random() * (W - INSET * 2),
        y: INSET + Math.random() * (H - INSET * 2),
      });
    }

    const PAD = 22; // enemy half-size + margin
    const inWall = c => {
      for (const obs of this.noSpawn.concat(this.obstacles)) {
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
    if (prefAngle !== null) {
      const facing = valid.filter(c => {
        let da = Math.atan2(c.y - playerY, c.x - playerX) - prefAngle;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        return Math.abs(da) < 0.87;
      });
      if (facing.length > 0) return facing[Math.floor(Math.random() * facing.length)];
    }
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
}
