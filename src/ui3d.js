// CHROMATIC DECAY — 3D menu panels
// Menu panels drawn the way the map draws its server racks: a lit top face,
// a darker extruded front face with rack-unit lines, a soft cyan rim and an
// LED strip, sitting on a contact shadow. Hovered panels rise a few pixels.

import { rgba } from './sprites.js';

const RACK_CYAN = '#00E5FF';

// Draws a raised slab and returns the y of its top face (it moves up when
// lifted), so callers can place text on it.
//   accent  rim / LED colour            depth  front-face height in px
//   lift    0–1 hover rise              glow   0–1 extra rim brightness
//   led     LED strip along the front   screen height of a screen strip at the top (0 = none)
export function drawSlab(ctx, x, y, w, h, o = {}) {
  const accent = o.accent || RACK_CYAN;
  const depth  = o.depth ?? 10;
  const lift   = o.lift ?? 0;
  const glow   = o.glow ?? 0;
  const rise   = lift * 4;
  const top    = y - rise;
  const d      = depth + rise;                 // the front face grows as it rises
  const inset  = Math.min(d * 0.6, w * 0.04);  // front face narrows: seen from above

  ctx.save();

  // Contact shadow on the floor
  ctx.shadowColor   = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur    = 22 + rise * 3;
  ctx.shadowOffsetY = 8 + rise * 2;
  ctx.fillStyle     = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x + 6, y + depth, w - 12, h * 0.6);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // Front face — dark, faintly lit, narrowing toward the floor
  const fy = top + h;
  ctx.beginPath();
  ctx.moveTo(x, fy); ctx.lineTo(x + w, fy);
  ctx.lineTo(x + w - inset, fy + d); ctx.lineTo(x + inset, fy + d);
  ctx.closePath();
  ctx.fillStyle = '#0a0f16';
  ctx.fill();
  const face = ctx.createLinearGradient(0, fy, 0, fy + d);
  face.addColorStop(0, rgba(accent, 0.16 + glow * 0.1));
  face.addColorStop(1, rgba(accent, 0.03));
  ctx.fillStyle = face;
  ctx.fill();
  // Rack-unit lines across the face
  ctx.strokeStyle = rgba(accent, 0.14 + glow * 0.1);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let ly = fy + 4; ly < fy + d - 1; ly += 4) {
    const k = (ly - fy) / d;
    ctx.moveTo(x + inset * k + 3, ly + 0.5); ctx.lineTo(x + w - inset * k - 3, ly + 0.5);
  }
  ctx.stroke();

  // Top face — rack-top blue-black, lit from the top left
  ctx.fillStyle = '#16202b';
  ctx.fillRect(x, top, w, h);
  const lit = ctx.createLinearGradient(x, top, x + w * 0.6, top + h);
  lit.addColorStop(0, `rgba(190,240,255,${0.10 + glow * 0.06})`);
  lit.addColorStop(1, 'rgba(190,240,255,0.02)');
  ctx.fillStyle = lit;
  ctx.fillRect(x, top, w, h);

  // Screen strip with a scan line, like the rack tops
  if (o.screen) {
    ctx.fillStyle = rgba(accent, 0.10 + glow * 0.05);
    ctx.fillRect(x + 4, top + 4, w - 8, o.screen);
    ctx.fillStyle = rgba(accent, 0.45);
    ctx.fillRect(x + 4, top + 4 + Math.round(o.screen * 0.5), w - 8, 1);
  }

  // LED strip along the front edge of the top face
  if (o.led !== false) {
    const ly = top + h - 6;
    ctx.fillStyle = rgba(accent, 0.18 + glow * 0.15);
    ctx.fillRect(x + 6, ly - 2, w - 12, 6);
    ctx.fillStyle = rgba(accent, 0.75 + glow * 0.25);
    ctx.fillRect(x + 8, ly, w - 16, 2);
  }

  // Rim — wide soft stroke + thin bright stroke (same recipe as the racks)
  ctx.strokeStyle = rgba(accent, 0.16 + glow * 0.12);
  ctx.lineWidth = 4;
  ctx.strokeRect(x, top, w, h);
  ctx.strokeStyle = rgba(accent, 0.6 + glow * 0.4);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, top + 0.5, w - 1, h - 1);

  ctx.restore();
  return top;
}

// A slab button with a centred label; returns the hit rect (the resting footprint)
export function drawSlabButton(ctx, x, y, w, h, label, o = {}) {
  const top = drawSlab(ctx, x, y, w, h, { depth: 6, led: false, ...o });
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = o.lift ? '#FFFFFF' : (o.textColor || o.accent || '#C4C8D4');
  ctx.font = `bold ${o.fontSize || 14}px monospace`;
  ctx.fillText(label, x + w / 2, top + h / 2 + 5);
  ctx.restore();
  return { x, y: y - 4, w, h: h + 10 };
}

// Dim the frozen game behind a menu and darken the edges
export function dimBackdrop(ctx, W, H, alpha = 0.6) {
  ctx.save();
  ctx.fillStyle = `rgba(13,14,18,${alpha})`;
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Is the mouse over a rect?
export function over(input, r) {
  return !!r && input.mouseX >= r.x && input.mouseX <= r.x + r.w && input.mouseY >= r.y && input.mouseY <= r.y + r.h;
}
