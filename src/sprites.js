// CHROMATIC DECAY — Sprite Cache
// Pre-renders shaded, glowing shapes to offscreen canvases once, so the
// per-frame draw is a single drawImage instead of shadowBlur + paths.

import { drawEnemyShape } from './utils.js';

const SCALE  = 2;          // render at 2× so sprites stay crisp when zoomed
const _cache = new Map();

function _rgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Blend a hex colour toward another by t (0–1)
export function mix(hex, target, t) {
  const a = _rgb(hex), b = _rgb(target);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function _canvas(worldSize) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(worldSize * SCALE);
  const g = c.getContext('2d');
  g.scale(SCALE, SCALE);
  return { c, g };
}

function _cached(key, build) {
  let s = _cache.get(key);
  if (!s) { s = build(); _cache.set(key, s); }
  return s;
}

// Draw a cached sprite centred on (x, y)
export function drawSprite(ctx, s, x, y) {
  ctx.drawImage(s.canvas, x - s.half, y - s.half, s.half * 2, s.half * 2);
}

// Enemy-style shape lit from the top-left, with baked glow and specular
export function shapeSprite(shape, r, fill, edge, glow, blur, lineWidth) {
  return _cached(`shape|${shape}|${r}|${fill}|${edge}|${glow}|${blur}|${lineWidth}`, () => {
    const half = r + blur + 4;
    const { c, g } = _canvas(half * 2);
    g.translate(half, half);

    // Body — light top-left, falling to shadow bottom-right
    const body = g.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.25);
    body.addColorStop(0,    mix(fill, '#ffffff', 0.55));
    body.addColorStop(0.45, fill);
    body.addColorStop(1,    mix(fill, '#000000', 0.45));
    g.shadowBlur  = blur;
    g.shadowColor = glow;
    g.fillStyle   = body;
    drawEnemyShape(g, shape, 0, 0, r);
    g.fill();
    g.shadowBlur = 0;

    // Specular highlight, clipped to the shape
    g.save();
    drawEnemyShape(g, shape, 0, 0, r);
    g.clip();
    const spec = g.createRadialGradient(-r * 0.38, -r * 0.42, 0, -r * 0.38, -r * 0.42, r * 0.55);
    spec.addColorStop(0, 'rgba(255,255,255,0.55)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = spec;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();

    g.strokeStyle = edge;
    g.lineWidth   = lineWidth;
    drawEnemyShape(g, shape, 0, 0, r);
    g.stroke();

    return { canvas: c, half };
  });
}

// Glowing orb with a bright core — bullets, residuals
export function orbSprite(color, r, blur, core) {
  return _cached(`orb|${color}|${r}|${blur}|${core}`, () => {
    const half = r + blur + 2;
    const { c, g } = _canvas(half * 2);
    g.translate(half, half);
    g.shadowBlur  = blur;
    g.shadowColor = color;
    g.fillStyle   = color;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.shadowBlur  = 0;
    g.fillStyle   = core;
    g.beginPath(); g.arc(-r * 0.15, -r * 0.15, r * 0.5, 0, Math.PI * 2); g.fill();
    return { canvas: c, half };
  });
}

// Soft additive halo — drawn with 'lighter' so overlapping glows bloom
export function haloSprite(color, r, alpha) {
  return _cached(`halo|${color}|${r}|${alpha}`, () => {
    const { c, g } = _canvas(r * 2);
    const [R, G, B] = _rgb(color);
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0,   `rgba(${R},${G},${B},${alpha})`);
    grad.addColorStop(0.4, `rgba(${R},${G},${B},${alpha * 0.35})`);
    grad.addColorStop(1,   `rgba(${R},${G},${B},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, r * 2, r * 2);
    return { canvas: c, half: r };
  });
}

// Soft elliptical contact shadow under hovering objects
let _shadow = null;
export function drawGroundShadow(ctx, x, y, rx, ry, alpha = 0.5) {
  if (!_shadow) {
    _shadow = document.createElement('canvas');
    _shadow.width = _shadow.height = 64;
    const g    = _shadow.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0,   'rgba(0,0,0,0.9)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.drawImage(_shadow, x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = prev;
}
