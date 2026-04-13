// CHROMATIC DECAY — Utilities

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distSq(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}

export function angle(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function normalize(dx, dy) {
  const d = Math.sqrt(dx * dx + dy * dy);
  return d > 0 ? { x: dx / d, y: dy / d } : { x: 0, y: 0 };
}

export function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(randBetween(min, max + 1));
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Weighted random pick — weights array sums to any value
export function weightedPick(items, weights) {
  let total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Fisher-Yates shuffle, returns new array
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Canvas Drawing Helpers ────────────────────────────────────

export function drawOctagon(ctx, x, y, r) {
  const a = r * 0.924;  // cos(22.5°) * r
  const b = r * 0.383;  // sin(22.5°) * r
  ctx.beginPath();
  ctx.moveTo(x + b, y - a);
  ctx.lineTo(x + a, y - b);
  ctx.lineTo(x + a, y + b);
  ctx.lineTo(x + b, y + a);
  ctx.lineTo(x - b, y + a);
  ctx.lineTo(x - a, y + b);
  ctx.lineTo(x - a, y - b);
  ctx.lineTo(x - b, y - a);
  ctx.closePath();
}

export function drawTriangle(ctx, x, y, r, angle = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = angle + (i * Math.PI * 2) / 3;
    const jag = i % 2 === 0 ? 1.0 : 0.85; // slight jaggedness
    const px = x + Math.cos(a) * r * jag;
    const py = y + Math.sin(a) * r * jag;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawDiamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
}

export function drawSquare(ctx, x, y, r) {
  ctx.beginPath();
  ctx.rect(x - r, y - r, r * 2, r * 2);
  ctx.closePath();
}

export function drawRoundedRect(ctx, x, y, w, h, radius = 4) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

// Draw a shape based on type string
export function drawEnemyShape(ctx, shape, x, y, r) {
  switch (shape) {
    case 'octagon':  drawOctagon(ctx, x, y, r); break;
    case 'circle':   ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); break;
    case 'triangle': drawTriangle(ctx, x, y, r); break;
    case 'diamond':  drawDiamond(ctx, x, y, r); break;
    case 'square':   drawSquare(ctx, x, y, r); break;
  }
}

// AABB rectangle overlap test
export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Point inside rect
export function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

// Circle vs AABB collision — returns true and minimum push vector if overlapping
export function circleVsRect(cx, cy, cr, rx, ry, rw, rh) {
  const nearX = clamp(cx, rx, rx + rw);
  const nearY = clamp(cy, ry, ry + rh);
  const dx = cx - nearX;
  const dy = cy - nearY;
  const d2 = dx * dx + dy * dy;
  if (d2 >= cr * cr) return null;
  const d = Math.sqrt(d2) || 0.001;
  return { nx: dx / d, ny: dy / d, depth: cr - d };
}

// Format time as MM:SS
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
