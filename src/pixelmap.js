// CHROMATIC DECAY — Pixel-art floor and server racks
//
// The map drawn in the same 16-bit style as the character sprites: one art
// pixel per screen pixel, flat colours, 1-pixel dark outlines, and the same
// three-quarter top-down view (a rack's top face sits above its footprint and
// its front face is visible below). Floor and racks are pre-rendered per zoom
// level and drawn at whole-pixel positions so nothing blurs or shimmers.
// Collision still uses each rack's flat footprint.

import { CONFIG } from './config.js';

const W = CONFIG.map_width;
const H = CONFIG.map_height;
const T = CONFIG.tile_size;
const BORDER = 20;

// Palettes, one per room. C and LED_COLOURS point at the current room's.
const THEMES = {
  basement: {
    C: {
      outline:   '#07080b',
      floor:     '#151821', floorAlt: '#13161e',
      seam:      '#0a0b10', bevelLt: '#1e222d', bevelDk: '#0d0f14',
      screw:     '#2a3040', dot: '#0c0e13',
      pit:       '#050608', pitEdge: '#1b1f2a',
      wall:      '#1a1d27', wallLine: '#12141b', wallTop: '#252a37',
      red:       '#6a1414',
      rackTop:   '#262c3c', rackTopLt: '#3b445c', rackTopSide: '#313950',
      vent:      '#161a25', screen: '#16444e', screenLine: '#2de2f0',
      rim:       '#4a5370', rimCyan: '#1b8fa0',
      front:     '#181e2a', blade: '#222a3a', bladeGap: '#0f1219', handle: '#36405a',
      strip:     '#00d9f0', stripDim: '#0b5560',
    },
    leds: ['#3cff7a', '#2de2f0', '#ffb43c', '#3cff7a'],
    labels: [['THE BASEMENT', 0.125], ['SERVER ROWS', 0.375], ['COLLAPSED FLOOR', 0.625], ['DEEP RACKS', 0.875]],
    pits: true, tints: true, frost: false,
  },
  // Cold Storage: pale steel-blue panels crusted with frost, icy rack lights
  cold: {
    C: {
      outline:   '#070b12',
      floor:     '#2a3850', floorAlt: '#273448',
      seam:      '#111a28', bevelLt: '#3c4e6c', bevelDk: '#18222f',
      screw:     '#5a7096', dot: '#1a2434',
      pit:       '#05070a', pitEdge: '#2a3a52',
      wall:      '#24324a', wallLine: '#18222f', wallTop: '#3a4e70',
      red:       '#4a8ac0',
      rackTop:   '#3e5274', rackTopLt: '#8aa6d0', rackTopSide: '#4e6690',
      vent:      '#24324a', screen: '#2a5a80', screenLine: '#bfeaff',
      rim:       '#8aa6d0', rimCyan: '#7ac8f0',
      front:     '#26344c', blade: '#344664', bladeGap: '#18222f', handle: '#6a84aa',
      strip:     '#bff0ff', stripDim: '#2a6a88',
      frost:     '#6a86b0', frostLt: '#a8c4e8',
    },
    leds: ['#9fe8ff', '#ffffff', '#6ad0ff', '#9fe8ff'],
    labels: [['COLD STORAGE', 0.11], ['ARCHIVE AISLES', 0.32], ['THE FREEZE', 0.68], ['FREIGHT LIFT', 0.92]],
    pits: false, tints: false, frost: true,
  },
  // The Stacks: dusty sepia floor, towers of old tape in warm brown with
  // amber reels, and amber rack lights
  stacks: {
    C: {
      outline:   '#0b0806',
      floor:     '#382c21', floorAlt: '#33281e',
      seam:      '#160f0a', bevelLt: '#4a3c2e', bevelDk: '#1e1610',
      screw:     '#5a4a38', dot: '#16110d',
      pit:       '#060504', pitEdge: '#2e251d',
      wall:      '#2c241c', wallLine: '#1a1510', wallTop: '#40342a',
      red:       '#8a5a20',
      rackTop:   '#3e3226', rackTopLt: '#7a644a', rackTopSide: '#4e3f30',
      vent:      '#2a2119', screen: '#5a3a14', screenLine: '#ffc46a',
      rim:       '#8a7256', rimCyan: '#c08a3a',
      front:     '#2e251c', blade: '#3e3226', bladeGap: '#18130f', handle: '#7a644a',
      strip:     '#ffc46a', stripDim: '#6a4a1a',
    },
    leds: ['#ffc46a', '#ff9a3c', '#ffe2a8', '#ffc46a'],
    labels: [['THE STACKS', 0.10], ['THE VAULT', 0.5]],
    pits: false, tints: false, frost: false,
  },
  // Wire Room: dark teal-grey floor, black rubber cable bundles with copper
  // trim, warm copper and signal-yellow lights
  wire: {
    C: {
      outline:   '#060809',
      floor:     '#1f2a2c', floorAlt: '#1c2628',
      seam:      '#0c1112', bevelLt: '#2c3a3d', bevelDk: '#121a1b',
      screw:     '#4a5a5c', dot: '#111819',
      pit:       '#050607', pitEdge: '#26302f',
      wall:      '#1e2526', wallLine: '#121718', wallTop: '#2e3839',
      red:       '#8a5a2a',
      rackTop:   '#1a1d20', rackTopLt: '#3a3f44', rackTopSide: '#25292d',
      vent:      '#131618', screen: '#4a2c14', screenLine: '#ffb860',
      rim:       '#b87333', rimCyan: '#d08a40',
      front:     '#16181b', blade: '#22262a', bladeGap: '#0c0e10', handle: '#c06030',
      strip:     '#ffd060', stripDim: '#6a5020',
    },
    leds: ['#ffd060', '#ff8a3c', '#60d0ff', '#ffd060'],
    labels: [['WIRE ROOM', 0.10], ['SWITCHBOARD', 0.40], ['SERVICE CORRIDOR', 0.86]],
    pits: false, tints: false, frost: false,
  },
  // Raze's Room: near-black floor with gold seams, black walls trimmed in
  // gold, gold lights
  vault: {
    C: {
      outline:   '#060504',
      floor:     '#1c1812', floorAlt: '#19150f',
      seam:      '#0a0806', bevelLt: '#2e271c', bevelDk: '#100d09',
      screw:     '#6a5428', dot: '#0e0b08',
      pit:       '#050403', pitEdge: '#2a2318',
      wall:      '#1a1610', wallLine: '#0f0c08', wallTop: '#2c2418',
      red:       '#a07020',
      rackTop:   '#1c1914', rackTopLt: '#4a3f2c', rackTopSide: '#28231a',
      vent:      '#141109', screen: '#5a3c0a', screenLine: '#ffb52e',
      rim:       '#c08a30', rimCyan: '#e0a040',
      front:     '#14110c', blade: '#211c14', bladeGap: '#0a0806', handle: '#c08a30',
      strip:     '#ffb52e', stripDim: '#6a4a10',
    },
    leds: ['#ffb52e', '#ffd070', '#ff8a20', '#ffb52e'],
    labels: [["RAZE'S ROOM", 0.07]],
    pits: false, tints: false, frost: false,
  },
};
let THEME = THEMES.basement;
let C = THEME.C;
let LED_COLOURS = THEME.leds;

// Deterministic per-tile/per-rack randomness
function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function rackHeight(o) {
  return o.h > 60 ? 30 : 22;   // world px the rack stands above its footprint
}

export class PixelMap {
  constructor(map) {
    this.map  = map;
    this.zoom = 0;
    THEME = THEMES[map.layout] || THEMES.basement;
    C = THEME.C; LED_COLOURS = THEME.leds;
  }

  // (Re)build everything for this zoom — art pixel = 1 screen pixel
  ensure(zoom) {
    if (zoom === this.zoom && this.floor) return;
    this.zoom  = zoom;
    this.floor = this._buildFloor(zoom);
    this.racks = this.map.obstacles.map((o, i) => this._buildRack(o, i, zoom));
  }

  // Screen position (whole pixels) of a world point for camera (cx, cy)
  _sx(x, cx) { return Math.round((x - cx) * this.zoom); }
  _sy(y, cy) { return Math.round((y - cy) * this.zoom); }

  drawFloor(ctx, cx, cy) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.floor, this._sx(0, cx), this._sy(0, cy));
    ctx.restore();
  }

  // Draw racks for which pick(o) is true. lightAt(x, y, nx, ny) → 0–1.
  drawRacks(ctx, cx, cy, view, pick, lightAt) {
    const z = this.zoom, t = Date.now();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    for (const r of this.racks) {
      const o = r.o;
      if (!pick(o)) continue;
      const hw = rackHeight(o);
      if (o.x + o.w < view.x || o.x > view.x + view.w || o.y + o.h < view.y - hw || o.y - hw > view.y + view.h) continue;
      const sx = this._sx(o.x, cx), sy = this._sy(o.y - hw, cy);
      ctx.drawImage(r.canvas, sx, sy);

      // Blinking server LEDs
      for (const led of r.leds) {
        const on = hash(led.seed, Math.floor(t / led.rate)) > 0.3;
        ctx.fillStyle = on ? led.col : C.bladeGap;
        ctx.fillRect(sx + led.x, sy + led.y, 1, 1);
      }

      // Flat lighting per face, so the pixel art stays crisp
      if (lightAt) {
        const top   = lightAt(o.x + o.w / 2, o.y + o.h / 2, 0, 0);
        const front = lightAt(o.x + o.w / 2, o.y + o.h, 0, 1);
        ctx.fillStyle = `rgba(0,0,0,${(0.3 * (1 - Math.min(1, top * 1.6))).toFixed(3)})`;
        ctx.fillRect(sx, sy, r.canvas.width, r.topH);
        ctx.fillStyle = `rgba(0,0,0,${(0.42 * (1 - Math.min(1, front * 1.6))).toFixed(3)})`;
        ctx.fillRect(sx, sy + r.topH, r.canvas.width, r.canvas.height - r.topH);
      }
    }
    ctx.restore();
  }

  _buildFloor(z) {
    const c = document.createElement('canvas');
    c.width = Math.round(W * z); c.height = Math.round(H * z);
    const g = c.getContext('2d');
    const P = (x) => Math.round(x * z);   // world → art px

    // Raised-floor panels
    const nx = Math.ceil(W / T), ny = Math.ceil(H / T);
    for (let ty = 0; ty < ny; ty++) {
      for (let tx = 0; tx < nx; tx++) {
        const x0 = P(tx * T), y0 = P(ty * T), x1 = P((tx + 1) * T), y1 = P((ty + 1) * T);
        const w = x1 - x0, h = y1 - y0;
        const r = hash(tx, ty);
        const collapsed = THEME.pits && ty * T > H * 0.5 && ty * T < H * 0.75 && hash(tx, ty, 7) < 0.07;

        if (collapsed) {
          // A missing panel — the raised floor gave way here
          g.fillStyle = C.pit; g.fillRect(x0, y0, w, h);
          g.fillStyle = C.pitEdge;
          g.fillRect(x0, y0, w, 1); g.fillRect(x0, y0, 1, h);
          g.fillStyle = '#0b0d12';
          for (let i = 3; i < w - 3; i += 6) g.fillRect(x0 + i, y0 + 2 + (i % 4), 3, 1);   // broken support rail
          continue;
        }

        g.fillStyle = (tx + ty) % 2 ? C.floor : C.floorAlt;
        g.fillRect(x0, y0, w, h);
        // Bevel: lit top/left, dark bottom/right, seam on the outer edge
        g.fillStyle = C.bevelLt; g.fillRect(x0 + 1, y0 + 1, w - 2, 1); g.fillRect(x0 + 1, y0 + 1, 1, h - 2);
        g.fillStyle = C.bevelDk; g.fillRect(x0 + 1, y1 - 2, w - 2, 1); g.fillRect(x1 - 2, y0 + 1, 1, h - 2);
        g.fillStyle = C.seam;    g.fillRect(x0, y1 - 1, w, 1);         g.fillRect(x1 - 1, y0, 1, h);
        // Corner screws
        g.fillStyle = C.screw;
        for (const [sx, sy] of [[3, 3], [w - 5, 3], [3, h - 5], [w - 5, h - 5]]) g.fillRect(x0 + sx, y0 + sy, 2, 2);

        if (r < 0.16) {
          // Perforated vent panel
          g.fillStyle = C.dot;
          for (let yy = 7; yy < h - 7; yy += 4) for (let xx = 7; xx < w - 7; xx += 4) g.fillRect(x0 + xx, y0 + yy, 2, 2);
        } else if (r < 0.21) {
          // Cable cut-out with a grommet
          const cw = Math.round(w * 0.42), ch = Math.round(h * 0.22);
          const cx0 = x0 + ((w - cw) >> 1), cy0 = y0 + ((h - ch) >> 1);
          g.fillStyle = C.screw; g.fillRect(cx0 - 1, cy0 - 1, cw + 2, ch + 2);
          g.fillStyle = C.pit;   g.fillRect(cx0, cy0, cw, ch);
          g.fillStyle = '#1f3a2a'; g.fillRect(cx0 + 2, cy0 + 2, cw - 4, 1);   // a green cable inside
        } else if (THEME.frost && r < 0.55) {
          // Frost: a crust creeping in from one corner of the panel
          const n = 14 + Math.floor(hash(tx, ty, 4) * 18);
          const fromR = hash(tx, ty, 5) < 0.5, fromB = hash(tx, ty, 6) < 0.5;
          for (let i = 0; i < n; i++) {
            const a = hash(tx, ty, 30 + i), b = hash(tx, ty, 50 + i);
            const fx = Math.floor(a * a * (w - 6)), fy = Math.floor(b * b * (h - 6));
            g.fillStyle = i % 3 ? C.frost : C.frostLt;
            g.fillRect(fromR ? x1 - 4 - fx : x0 + 3 + fx, fromB ? y1 - 4 - fy : y0 + 3 + fy, 1 + (i % 3), 1 + (i % 2));
          }
        } else if (r < 0.30) {
          // Scuffs
          g.fillStyle = C.bevelDk;
          const n = 2 + Math.floor(hash(tx, ty, 3) * 3);
          for (let i = 0; i < n; i++) {
            const sx = x0 + 6 + Math.floor(hash(tx, ty, 10 + i) * (w - 16));
            const sy = y0 + 6 + Math.floor(hash(tx, ty, 20 + i) * (h - 16));
            for (let k = 0; k < 5; k++) g.fillRect(sx + k, sy + (k >> 1), 1, 1);
          }
        }
      }
    }

    // Zone tints (flat, so pixels stay crisp)
    if (THEME.tints) {
      g.fillStyle = 'rgba(0,0,0,0.18)';      g.fillRect(0, P(H * 0.5), c.width, P(H * 0.25));
      g.fillStyle = 'rgba(42,8,8,0.22)';     g.fillRect(0, P(H * 0.75), c.width, c.height - P(H * 0.75));
    }

    // Stencilled zone names, painted on the floor
    g.fillStyle = THEME.frost ? 'rgba(70,92,124,0.5)' : 'rgba(40,46,62,0.55)';
    g.font = `bold ${Math.round(16 * z)}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [label, fy] of THEME.labels) g.fillText(label, c.width / 2, P(H * fy));

    // Contact shadow under each rack's front edge, and a darker footprint
    for (const o of this.map.obstacles) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(P(o.x) - 2, P(o.y) - 2, P(o.w) + 4, P(o.h) + 4);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(P(o.x) + 2, P(o.y + o.h), P(o.w), Math.round(4 * z));
    }

    // Border walls: panelled, with emergency LEDs along the inside edge
    const B = P(BORDER);
    g.fillStyle = C.wall;
    g.fillRect(0, 0, c.width, B); g.fillRect(0, c.height - B, c.width, B);
    g.fillRect(0, 0, B, c.height); g.fillRect(c.width - B, 0, B, c.height);
    g.fillStyle = C.wallLine;
    for (let x = 0; x < c.width; x += 24) { g.fillRect(x, 0, 1, B); g.fillRect(x, c.height - B, 1, B); }
    for (let y = 0; y < c.height; y += 24) { g.fillRect(0, y, B, 1); g.fillRect(c.width - B, y, B, 1); }
    g.fillStyle = C.wallTop;
    g.fillRect(B, B - 2, c.width - 2 * B, 2);
    g.fillStyle = C.outline;
    g.fillRect(B, B, c.width - 2 * B, 1); g.fillRect(B, c.height - B - 1, c.width - 2 * B, 1);
    g.fillRect(B, B, 1, c.height - 2 * B); g.fillRect(c.width - B - 1, B, 1, c.height - 2 * B);
    g.fillStyle = C.red;
    for (let y = B + 8; y < c.height - B - 8; y += 14) { g.fillRect(B + 3, y, 1, 4); g.fillRect(c.width - B - 4, y, 1, 4); }
    for (let x = B + 8; x < c.width - B - 8; x += 14) g.fillRect(x, c.height - B - 4, 4, 1);

    return c;
  }

  _buildRack(o, idx, z) {
    const hw = rackHeight(o);
    const wA = Math.max(6, Math.round(o.w * z));
    const hA = Math.round((o.h + hw) * z);
    const frontH = Math.round(hw * z);
    const topH = hA - frontH;
    const c = document.createElement('canvas');
    c.width = wA; c.height = hA;
    const g = c.getContext('2d');
    const leds = [];

    // Silhouette outline
    g.fillStyle = C.outline; g.fillRect(0, 0, wA, hA);

    // ── Top face ──
    g.fillStyle = C.rackTop;     g.fillRect(1, 1, wA - 2, topH - 1);
    g.fillStyle = C.rackTopLt;   g.fillRect(1, 1, wA - 2, 1);
    g.fillStyle = C.rackTopSide; g.fillRect(1, 2, 1, topH - 2);
    g.fillStyle = C.rimCyan;     // thin cyan inner rim keeps the old glow identity
    g.fillRect(2, 2, wA - 4, 1); g.fillRect(2, topH - 2, wA - 4, 1);
    g.fillRect(2, 2, 1, topH - 3); g.fillRect(wA - 3, 2, 1, topH - 3);
    // Screen strip with scan line
    const sh = Math.max(3, Math.min(8, Math.round(topH * 0.18)));
    if (topH > sh + 10) {
      g.fillStyle = C.screen;     g.fillRect(4, 4, wA - 8, sh);
      g.fillStyle = C.screenLine; g.fillRect(4, 4 + (sh >> 1), wA - 8, 1);
    }
    // Vents
    g.fillStyle = C.vent;
    for (let y = 6 + sh + 3; y < topH - 6; y += 4) g.fillRect(5, y, wA - 10, 2);

    // Lit edge where top meets front
    g.fillStyle = C.rim; g.fillRect(1, topH, wA - 2, 1);

    // ── Front face: stacked server blades ──
    const fy = topH + 1, fh = frontH - 2;
    g.fillStyle = C.front; g.fillRect(1, fy, wA - 2, fh);
    for (let y = fy + 1, i = 0; y + 3 < fy + fh - 2; y += 5, i++) {
      g.fillStyle = C.blade;    g.fillRect(2, y, wA - 4, 4);
      g.fillStyle = C.bladeGap; g.fillRect(2, y + 4, wA - 4, 1);
      g.fillStyle = C.handle;   g.fillRect(3, y + 1, 1, 2); g.fillRect(wA - 4, y + 1, 1, 2);
      // one or two status LEDs per blade
      const n = wA > 30 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const lx = 6 + k * 3;
        if (lx < wA - 6) leds.push({
          x: lx, y: y + 1,
          col: LED_COLOURS[Math.floor(hash(idx, i, k) * LED_COLOURS.length)],
          seed: idx * 97 + i * 7 + k,
          rate: 300 + Math.floor(hash(idx, i, k + 5) * 900),
        });
      }
    }
    // LED strip along the bottom of tall racks (also a light source in game)
    if (o.h > 60) {
      g.fillStyle = C.stripDim; g.fillRect(3, hA - 4, wA - 6, 1);
      g.fillStyle = C.strip;    g.fillRect(4, hA - 3, wA - 8, 1);
    }

    return { o, canvas: c, topH, leds };
  }
}
