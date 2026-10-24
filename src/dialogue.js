// CHROMATIC DECAY — Dialogue
//
// Mega Man Legends–style talking: short boxes, the speaker's portrait beside
// the box, text typed out, one tap/click/Space to move on to the next line.
// Two presentations:
//   Dialogue — a scene: full-width box at the bottom, waits for the player
//   Radio    — in-game comms: a compact box at the top that advances on its
//              own, so the player keeps moving and shooting while it talks
//
// A line is { who, face, text } where who is 'dex' | 'juno' | 'null', or
// { card: text } for a typed title card on black, or { caption: text } for a
// small location tag that sets the scene without a box.

import { drawSlab } from './ui3d.js';
import { sfxTextBlip } from './audio.js';

export const SPEAKERS = {
  dex:  { name: 'DEX',  color: '#B6FF2E', faces: ['neutral', 'determined', 'cocky-grin', 'laughing', 'worried', 'shocked', 'angry', 'hurt'] },
  juno: { name: 'JUNO', color: '#C79BFF', faces: ['neutral', 'focused', 'smirk', 'laughing', 'concerned', 'alarmed', 'annoyed', 'soft-smile'] },
  raze: { name: 'RAZE', color: '#FFB52E', faces: ['neutral', 'stern', 'smirk', 'laughing', 'uneasy', 'shocked', 'angry', 'snarl'] },
  null: { name: 'NULL', color: '#E8F0FF', faces: [] },
};

// Portraits load on first use
const _faces = {};
function portrait(who, face) {
  const sp = SPEAKERS[who];
  if (!sp || !sp.faces.length) return null;
  const f = sp.faces.includes(face) ? face : sp.faces[0];
  const key = `${who}-${f}`;
  if (!_faces[key]) {
    const img = new Image();
    img.onload = () => { img._ready = true; };
    img.src = `assets/characters/${who}/expressions/${key}.png`;
    _faces[key] = img;
  }
  return _faces[key]._ready ? _faces[key] : null;
}
export function preloadPortraits(lines) {
  for (const l of lines) if (l.who) portrait(l.who, l.face);
}

function wrap(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (line && ctx.measureText(test).width > maxW) { out.push(line); line = word; }
    else line = test;
  }
  if (line) out.push(line);
  return out;
}

// Null has no face: a slow-breathing point of white light with thin rings
function drawNullSignal(ctx, cx, cy, r, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.85 + 0.15 * Math.sin(t * 2.1);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0,    `rgba(255,255,255,${0.95 * pulse})`);
  g.addColorStop(0.18, `rgba(232,240,255,${0.55 * pulse})`);
  g.addColorStop(0.5,  'rgba(190,215,255,0.12)');
  g.addColorStop(1,    'rgba(190,215,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(232,240,255,0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const rr = r * (0.3 + ((t * 0.25 + i / 3) % 1) * 0.7);
    ctx.globalAlpha = 1 - (rr / r);
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawPortrait(ctx, who, face, x, y, w, h, flip, t) {
  if (who === 'null') { drawNullSignal(ctx, x + w / 2, y + h * 0.48, Math.min(w, h) * 0.45, t); return; }
  const img = portrait(who, face);
  if (!img) return;
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (flip) { ctx.translate(x + w, 0); ctx.scale(-1, 1); x = 0; }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, x + (w - dw) / 2, y + h - dh, dw, dh);
  ctx.restore();
}

const CPS = 72;   // characters typed per second

// Two blips per five letters newly typed (spaces are silent)
function blip(text, from, to, who) {
  for (let k = Math.floor(from); k < Math.floor(to); k++) {
    if ((k % 5 === 0 || k % 5 === 2) && text[k] && text[k] !== ' ') { sfxTextBlip(who); return; }
  }
}

export class Dialogue {
  // sides: which side each speaker's portrait sits on, e.g. { juno: 'left', dex: 'right', null: 'left' }
  constructor(lines, sides = {}) {
    this.lines = lines;
    this.sides = sides;
    this.i = 0;
    this.shown = 0;
    this.t = 0;
    this.done = lines.length === 0;
    this._delay = 0.25;   // ignore the input that opened the scene
    preloadPortraits(lines);
  }

  get line() { return this.lines[this.i]; }
  get caption() {
    for (let k = this.i; k >= 0; k--) if (this.lines[k].caption) return this.lines[k].caption;
    return null;
  }

  _text(l) { return l.card || l.text || ''; }

  update(dt, pressed) {
    if (this.done) return;
    this.t += dt;
    // Captions only set the scene; skip straight past them
    while (this.line && this.line.caption && !this.line.text && !this.line.card) {
      this.i++; this.shown = 0;
      if (this.i >= this.lines.length) { this.done = true; return; }
    }
    const txt = this._text(this.line), len = txt.length;
    const was = this.shown;
    this.shown = Math.min(len, this.shown + dt * CPS * (this.line.card ? 0.7 : 1));
    blip(txt, was, this.shown, this.line.card ? 'card' : this.line.who);
    if (this._delay > 0) { this._delay -= dt; return; }
    if (!pressed) return;
    this.i++; this.shown = 0;   // one press moves on, typed out or not
    if (this.i >= this.lines.length) this.done = true;
  }

  draw(ctx, W, H, touch) {
    if (this.done || !this.line) return;
    const l = this.line;
    const text = this._text(l).slice(0, Math.floor(this.shown));
    const typed = this.shown >= this._text(l).length;
    ctx.save();
    ctx.textAlign = 'left';

    if (l.card) {
      ctx.fillStyle = 'rgba(5,6,9,0.92)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#E8F0FF';
      ctx.font = `${W < 600 ? 16 : 20}px monospace`;
      ctx.textAlign = 'center';
      const lines = wrap(ctx, l.card, Math.min(620, W - 48));
      lines.forEach((ln, k) => {
        const full = lines.slice(0, k).join(' ').length + (k ? 1 : 0);
        const vis = Math.max(0, Math.min(ln.length, Math.floor(this.shown) - full));
        ctx.fillText(ln.slice(0, vis), W / 2, H / 2 - (lines.length - 1) * 14 + k * 28);
      });
      if (typed) this._hint(ctx, W / 2, H / 2 + lines.length * 14 + 40, touch, 'center');
      ctx.restore();
      return;
    }

    const sp = SPEAKERS[l.who] || SPEAKERS.null;
    const narrow = W < 600;
    const boxH = narrow ? 150 : 170;
    const boxW = Math.min(980, W - 24);
    const bx = (W - boxW) / 2, by = H - boxH - 18;
    const side = this.sides[l.who] || 'left';
    const portW = narrow ? 104 : 176, portH = narrow ? 150 : 236;

    // Portrait stands on the box, on its speaker's side
    const px = side === 'left' ? bx + 8 : bx + boxW - portW - 8;
    drawPortrait(ctx, l.who, l.face, px, by - portH + (narrow ? 38 : 46), portW, portH, false, this.t);

    const top = drawSlab(ctx, bx, by, boxW, boxH, { accent: sp.color, depth: 10, glow: 0.25, led: false });
    const tx = bx + 22;
    const tw = boxW - 44;

    ctx.fillStyle = sp.color;
    ctx.font = `bold ${narrow ? 15 : 18}px monospace`;
    ctx.fillText(sp.name, tx, top + (narrow ? 24 : 30));
    ctx.fillStyle = '#E8EAF0';
    ctx.font = `${narrow ? 13 : 17}px monospace`;
    const lh = narrow ? 19 : 25;
    wrap(ctx, text, tw).forEach((ln, k) => ctx.fillText(ln, tx, top + (narrow ? 48 : 60) + k * lh));
    if (typed) this._hint(ctx, bx + boxW - 18, top + boxH - 16, touch, 'right');
    ctx.restore();
  }

  _hint(ctx, x, y, touch, align) {
    const blink = 0.55 + 0.45 * Math.sin(this.t * 5);
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#8FA8B8';
    ctx.font = '12px monospace';
    ctx.textAlign = align;
    ctx.fillText(touch ? 'tap ▸' : 'SPACE / click ▸', x, y);
    ctx.globalAlpha = 1;
  }
}

// In-game comms. Lines queue up and advance on their own after a generous
// reading pause; Space, Enter or a tap on the box moves on sooner. While a
// line is up the agent can't shoot, and with Chromatics around the game
// holds still (game.js).
export class Radio {
  constructor() { this.queue = []; this.cur = null; this.shown = 0; this.hold = 0; this.holdMax = 1; this.t = 0; this.rect = null; }

  say(lines) { for (const l of lines) { preloadPortraits([l]); this.queue.push(l); } }
  get busy() { return !!this.cur || this.queue.length > 0; }
  clear() { this.queue = []; this.cur = null; this.rect = null; }

  // Player asked to move on: drop the line, typed out or not
  next() { this.cur = null; }

  hit(x, y) {
    const r = this.rect;
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  update(dt) {
    this.t += dt;
    if (!this.cur) {
      if (!this.queue.length) return;
      this.cur = this.queue.shift(); this.shown = 0;
      this.hold = this.holdMax = 1.4 + this.cur.text.length * 0.045;   // reading time after it's typed
    }
    const len = this.cur.text.length;
    if (this.shown < len) {
      const was = this.shown;
      this.shown = Math.min(len, this.shown + dt * CPS);
      blip(this.cur.text, was, this.shown, this.cur.who);
      return;
    }
    this.hold -= dt;
    if (this.hold <= 0) this.cur = null;
  }

  // Compact box under the HUD; objective line underneath it
  // clearLeft: if the box would reach into the top-left HUD column (x < 230),
  // start it at this y instead, below the bars
  // Desktop: the comms box sits just below the middle of the screen, where
  // people read it (the agent is in the middle, so it sits under them), and
  // the objective line at the top. Phones: both at the top, out of the way of
  // the sticks; in landscape, between the health bar and the Chroma counts.
  draw(ctx, W, H, objective, touch, clearLeft = 0) {
    const compact = touch && H < 500;
    const narrow = W < 600 || compact;
    this.rect = null;
    const boxW = compact ? Math.min(480, W - 340) : Math.min(560, W - 24);
    const bx = (W - boxW) / 2;
    if (this.cur) {
      const sp = SPEAKERS[this.cur.who] || SPEAKERS.null;
      const portS = compact ? 44 : narrow ? 56 : 68;
      ctx.save();
      ctx.font = `${narrow ? 12 : 14}px monospace`;
      const lines = wrap(ctx, this.cur.text.slice(0, Math.floor(this.shown)), boxW - portS - 34);
      const boxH = Math.max(portS + 12, 30 + lines.length * (narrow ? 16 : 19) + 10);
      const by = !touch ? Math.min(Math.round(H / 2 + 60), H - boxH - 80)
               : compact ? 6 : Math.max(narrow ? 78 : 70, bx < 230 ? clearLeft : 0);
      this._bottom = by + boxH + 10;
      const top = drawSlab(ctx, bx, by, boxW, boxH, { accent: sp.color, depth: 6, glow: 0.2, led: false });
      // Portrait: a head-and-shoulders crop in a small window
      ctx.save();
      ctx.fillStyle = 'rgba(5,7,10,0.7)';
      ctx.fillRect(bx + 6, top + 6, portS, boxH - 12);
      if (this.cur.who === 'null') drawNullSignal(ctx, bx + 6 + portS / 2, top + boxH / 2, portS * 0.42, this.t);
      else {
        const img = portrait(this.cur.who, this.cur.face);
        if (img) {
          ctx.beginPath(); ctx.rect(bx + 6, top + 6, portS, boxH - 12); ctx.clip();
          const s = (portS * 1.25) / img.width;
          ctx.drawImage(img, bx + 6 + (portS - img.width * s) / 2, top + 4, img.width * s, img.height * s);
        }
      }
      ctx.restore();
      const tx = bx + portS + 18;
      ctx.textAlign = 'left';
      ctx.fillStyle = sp.color;
      ctx.font = `bold ${narrow ? 12 : 13}px monospace`;
      ctx.fillText(`${sp.name}  ·  COMMS`, tx, top + (narrow ? 18 : 20));
      ctx.fillStyle = '#E8EAF0';
      ctx.font = `${narrow ? 12 : 14}px monospace`;
      lines.forEach((ln, k) => ctx.fillText(ln, tx, top + (narrow ? 36 : 40) + k * (narrow ? 16 : 19)));
      // Once typed: how long the line stays, and how to move on
      if (this.shown >= this.cur.text.length) {
        const f = Math.max(0, this.hold / this.holdMax);
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(tx, top + boxH - 5, (bx + boxW - 10 - tx) * f, 2);
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(this.t * 5);
        ctx.fillStyle = '#8FA8B8';
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(touch ? 'tap ▸' : 'SPACE ▸', bx + boxW - 12, top + (narrow ? 18 : 20));
      }
      ctx.restore();
      this.rect = { x: bx, y: by, w: boxW, h: boxH + 8 };
    }
    if (objective) {
      // Desktop: top of the screen. Phones: under the comms box (or where it
      // would be)
      const below = this.cur ? this._bottom : (compact ? 4 : Math.max(narrow ? 78 : 70, bx < 230 ? clearLeft : 0));
      const bottom = !touch ? 12 : below;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = `bold ${narrow ? 11 : 13}px monospace`;
      const label = `▸ ${objective}`;
      const w = ctx.measureText(label).width + 20;
      ctx.fillStyle = 'rgba(7,11,18,0.75)';
      const oy = bottom;
      ctx.fillRect(W / 2 - w / 2, oy + 4, w, narrow ? 20 : 24);
      ctx.fillStyle = '#00E5CC';
      ctx.fillText(label, W / 2, oy + (narrow ? 18 : 21));
      ctx.restore();
      this.objBottom = oy + (narrow ? 24 : 28);
    }
  }
}
