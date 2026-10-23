// CHROMATIC DECAY — Story levels
//
// A level is a list of beats played in order, each one a checkpoint:
//   wave      clear groups of Chromatics (groups arrive from different sides)
//   relays    power up relays while Chromatics keep coming to drain them
//   sequence  watch floor pads light up, then walk over them in the same order
//   exit      open the door — the first time, it unlocks a card for keeps
// The operator (the character who stayed behind) talks over comms between
// beats; enemies wait for the briefing to finish. Power drawn from the map
// takes on the agent's colour — green for Dex, pink for Juno, gold for Raze.
// Clearing a section grants the agent a set power-up for the rest of the level
// (game.js shows it). Going down fails the level.

import { Radio } from './dialogue.js';
import { CONFIG } from './config.js';
import { drawGlow } from './sprites.js';
import { sfxRelayCharged, sfxNode, sfxNodeWrong, sfxWaveClear } from './audio.js';

export const AGENT_COLOR = { dex: '#B6FF2E', juno: '#E58CFF', raze: '#FFD15C' };
const COLOR_NAME = { dex: 'green', juno: 'pink', raze: 'gold' };
// Power-ups granted as each section is cleared (wave, relays, wave), per
// agent. They last for the level and preview where each character is going.
export const POWERUPS = {
  dex: [
    { id: 'heavy_bursts', name: 'HEAVY BURSTS', desc: '4-round bursts, and 15% more damage.',          apply: p => { p.projCount += 1; p.damageMultiplier *= 1.15; } },
    { name: 'STUN GRENADE',    desc: 'Lob it over the racks: stuns and jams enemies, who take 50% more damage.', apply: p => { p.grenade = true; p.abilities.push('grenade'); },
      hint: 'Press E to throw it. On a phone, use its button.' },
    { name: 'KINETIC FINISH',  desc: 'The last round of every burst knocks its target back.', apply: p => { p.kineticFinish = true; } },
  ],
  juno: [
    { id: 'hot_barrel', name: 'HOT BARREL', desc: 'The minigun fires 25% faster.',                 apply: p => { p.projCount += 1; } },
    { name: 'PIERCING STREAM', desc: 'Rounds pass through one enemy.',                apply: p => { p.piercingShots += 1; } },
    { name: 'RICOCHET',        desc: 'Rounds bounce once off racks.',                 apply: p => { p.rackBounce = (p.rackBounce || 0) + 1; } },
  ],
};

// ── Level data ────────────────────────────────────────────────

export const LEVELS = {
  1: {
    id: 1,
    name: 'SERVER FLOOR',
    blurb: 'Clear the floor, pull the power out of three relays, open the lock.',
    beats: (op, agent) => {
      const L = (face, text) => ({ who: op, face, text });
      const f = (dexFace, junoFace) => (op === 'dex' ? dexFace : junoFace);
      const col = COLOR_NAME[agent];
      return [
        { type: 'wave',
          lines: [L(f('neutral', 'focused'), "Server Floor. The Chromatics moved back in after you left."),
                  L(f('determined', 'neutral'), 'Clear them out. Then we get the power back on.')],
          groups: [[['violet', 3]], [['violet', 3]], [['violet', 2], ['yellow', 1]]],
          objective: s => `Clear the floor (${s.left} left)`,
          done: [L(f('cocky-grin', 'smirk'), 'Clean.')] },

        { type: 'relays', count: 3,
          lines: [L(f('neutral', 'focused'), 'Three relays down here still hold charge. Get close and pull it into your emitter.'),
                  L(f('worried', 'concerned'), "Chromatics feed on signal. Anything touching a relay drains it, so keep them off.")],
          firstCharge: [L(f('shocked', 'alarmed'), `Wait... it's coming through ${col}. The charge is matching your signal.`)],
          eachDone: [
            [L(f('determined', 'focused'), "One. Your emitter's holding more than it should.")],
            [L(f('laughing', 'soft-smile'), "Two. I can see it from here. You're brighter.")],
            [L(f('neutral', 'focused'), "That's all three. Whatever was in those relays is in you now.")],
          ],
          objective: s => `Power the relays (${s.done}/3)`,
          done: [] },

        { type: 'wave',
          lines: [L(f('worried', 'concerned'), "That woke the rest of them up. Yellows in the mix."),
                  L(f('determined', 'focused'), 'Yellows lunge. When one lights up and lines up on you, get out of the line.'),
                  L(f('cocky-grin', 'smirk'), "Let's see what that charge does.")],
          groups: [[['violet', 3], ['yellow', 1]], [['yellow', 2]], [['violet', 2], ['yellow', 2]]],
          objective: s => `Hold them off (${s.left} left)`,
          done: [L(f('neutral', 'soft-smile'), "That's the last of them. The way out is sealed, though.")] },

        { type: 'sequence', nodes: 4, length: 4,
          lines: [L(f('neutral', 'focused'), "There's a lock set into the floor ahead. Four pads."),
                  L(f('determined', 'neutral'), 'Watch the order they light up, then walk over them in the same order.'),
                  L(f('worried', 'concerned'), "They're still coming. Good chance to try out that new upgrade.")],
          wrong: [L(f('worried', 'annoyed'), "Not that one. Watch again.")],
          objective: () => 'Walk over the pads in order',
          done: [L(f('laughing', 'soft-smile'), "Great. Now get out of there. You'll need to open the door, back where you came in.")] },

        { type: 'exit',
          lines: [],
          objective: () => 'Open the door',
          done: [] },
      ];
    },
  },
};

// What opening each level's door unlocks for keeps, per agent: the first
// power-up, as a card in that character's Arcade upgrade offers
export const LEVEL_CARDS = { 1: { dex: POWERUPS.dex[0], juno: POWERUPS.juno[0] } };

// ── Helpers ───────────────────────────────────────────────────

function freeSpot(map, x, y, pad = 46) {
  const clear = (px, py) => px > 60 && py > 60 && px < CONFIG.map_width - 60 && py < CONFIG.map_height - 60 &&
    !map.obstacles.some(o => px + pad > o.x && px - pad < o.x + o.w && py + pad > o.y && py - pad < o.y + o.h);
  if (clear(x, y)) return { x, y };
  for (let r = 12; r < 400; r += 12) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (clear(px, py)) return { x: px, y: py };
    }
  }
  return { x, y };
}

// ── Runner ────────────────────────────────────────────────────

export class LevelRun {
  // api: { player(), enemies, map(), spawnEnemy(type, x, y), spawnEcho(x, y), clearField(), touch() }
  constructor(id, agent, api) {
    this.def   = LEVELS[id];
    this.id    = id;
    this.agent = agent;
    this.op    = agent === 'dex' ? 'juno' : 'dex';
    this.api   = api;
    this.color = AGENT_COLOR[agent] || '#FFFFFF';
    this.beats = this.def.beats(this.op, agent);
    this.radio = new Radio();
    this.chroma = { violet: 0, yellow: 0, green: 0 };
    this.t = 0;
    this.idx = -1;
    this.complete = false;
    this.failed   = false;
    this.kills    = 0;
    this.powers   = [];       // power-ups granted so far (names)
    this.pendingPowerUp = null;   // one waiting to be shown by game.js
    this._powerIdx = 0;
    this.charge = 0;          // emitter charge drawn from relays, 0..1
    this.motes  = [];         // essence flowing into the agent
    this._spawnDir = Math.random() * Math.PI * 2;
    this._layout();
    this._next();
  }

  // Where things are on the map
  _layout() {
    const map = this.api.map();
    const W = CONFIG.map_width, H = CONFIG.map_height;
    this.relayPos = [freeSpot(map, W * 0.2, H * 0.24), freeSpot(map, W * 0.8, H * 0.26), freeSpot(map, W * 0.5, H * 0.5)];
    const c = freeSpot(map, W * 0.5, H * 0.33, 110);
    this.lockCenter = c;
    this.nodePos = [[0, -84], [84, 0], [0, 84], [-84, 0]].map(([dx, dy]) => freeSpot(map, c.x + dx, c.y + dy, 26));
    this.exitPos = map.playerSpawn();
  }

  get beat() { return this.beats[this.idx]; }

  _next() {
    this.idx++;
    const b = this.beat;
    if (!b) return;
    this._enter(b);
    this.radio.say(b.lines);
  }

  // (Re)start a beat's state — also used when restarting from a checkpoint
  _enter(b) {
    this.ready = false;   // waits for the briefing
    this.spawnT = 1.5;    // first interrupters (where a beat has them)
    if (b.type === 'wave') {
      this.gi = 0; this.groupT = 0; this.spawnedAll = false;
    } else if (b.type === 'relays') {
      if (!this.relays) this.relays = this.relayPos.map(p => ({ ...p, charge: 0, done: false, drain: 0 }));
      for (const r of this.relays) if (!r.done) r.charge = 0;
      this._saidFirst = this._saidFirst || false;
    } else if (b.type === 'sequence') {
      if (!this.seq) {
        const order = [];
        while (order.length < b.length) {
          const n = Math.floor(Math.random() * b.nodes);
          if (order[order.length - 1] !== n) order.push(n);
        }
        this.seq = order;
      }
      this.lit = new Array(b.nodes).fill(0);   // glow per node, eases back down
      this.seqStep = 0;
      this.showT = 0; this.showing = false;
      this.wrongT = 0;
      this._onPad = -1;
    }
  }

  onKill(e) {
    if (this.chroma[e.type] !== undefined) this.chroma[e.type]++;
    this.kills++;
  }

  // game.js calls this once the power-up has been shown
  takePowerUp(player) {
    const pu = this.pendingPowerUp;
    if (!pu) return;
    pu.apply(player);
    this.powers.push(pu.name);
    this.pendingPowerUp = null;
  }

  // Stepping onto a pad (counts once until you step off)
  _stepPads(pl, b) {
    const on = this.nodePos.findIndex(n => Math.abs(pl.x - n.x) < 16 && Math.abs(pl.y - n.y) < 16);
    if (on === this._onPad) return;
    this._onPad = on;
    if (on < 0 || this.showing || this.wrongT > 0) return;
    if (on === this.seq[this.seqStep]) {
      this.lit[on] = 1;
      sfxNode(on);
      this.seqStep++;
      if (this.seqStep >= this.seq.length) this._finishBeat();
    } else {
      sfxNodeWrong();
      this.wrongT = 1.1;
      this.seqStep = 0;
      this.radio.say(b.wrong);
    }
  }

  // The game calls this once the door is opened (after any unlock screen)
  openDoor() { this.awaitUnlock = false; this.complete = true; }

  _finishBeat() {
    const b = this.beat;
    if (b.done && b.done.length) this.radio.say(b.done);
    if (b.type === 'wave' || b.type === 'relays') {
      sfxWaveClear();
      const list = POWERUPS[this.agent] || [];
      if (this._powerIdx < list.length) this.pendingPowerUp = list[this._powerIdx++];
    }
    if (b.type === 'exit') { this.complete = true; return; }
    this._next();
  }

  update(dt) {
    this.t += dt;
    this.radio.update(dt);
    const pl = this.api.player();
    const b = this.beat;
    if (!b || this.complete) return;
    if (pl.hp <= 1 && !pl.beaming) { this.failed = true; return; }
    if (!this.ready) { if (!this.radio.busy && !pl.beaming) this.ready = true; else return; }

    // The last stretch (pads and the walk to the door) keeps a slightly heavier
    // trickle than the relays, violets and yellows, to try the last power-up on
    if (b.type === 'sequence' || b.type === 'exit') this._interrupt(dt, 5, 4, () => (Math.random() < 0.5 ? 'yellow' : 'violet'));
    if (b.type === 'wave') this._updateWave(dt, b);
    else if (b.type === 'relays') this._updateRelays(dt, b, pl);
    else if (b.type === 'sequence') { this._updateSequence(dt, b); this._stepPads(pl, b); }
    else if (b.type === 'exit') {
      // At the door: the first clear unlocks the signature (game.js shows it)
      if (!this.awaitUnlock && Math.hypot(pl.x - this.exitPos.x, pl.y - this.exitPos.y) < 34) {
        if (this.api.needsUnlock()) this.awaitUnlock = true;
        else this.openDoor();
      }
    }
    this._updateMotes(dt, pl);
  }

  // Groups arrive from different sides; the next comes when this one thins out
  _updateWave(dt, b) {
    const alive = this.api.enemies.enemies.filter(e => e.isAlive).length;
    this.groupT += dt;
    if (this.gi < b.groups.length && (this.gi === 0 || alive <= 2 || this.groupT > 8)) {
      this._spawnGroup(b.groups[this.gi]);
      this.gi++; this.groupT = 0;
    }
    if (this.gi >= b.groups.length && alive === 0) this._finishBeat();
  }

  _spawnGroup(group, near = null) {
    const pl = this.api.player();
    const map = this.api.map();
    this._spawnDir = (this._spawnDir + 2.39996) % (Math.PI * 2);
    const o = near || pl;
    // Pick a direction whose spot is on the map and well away from the player
    // (near an edge, the straight-out spot can be off the map, and the nearest
    // open floor to it might be right next to them)
    let c = null;
    for (let k = 0; k < 8 && !c; k++) {
      const a = this._spawnDir + k * 0.8, d = 330 + Math.random() * 90;
      const tx = o.x + Math.cos(a) * d, ty = o.y + Math.sin(a) * d;
      if (tx < 70 || ty < 70 || tx > CONFIG.map_width - 70 || ty > CONFIG.map_height - 70) continue;
      const spot = freeSpot(map, tx, ty, 30);
      if (Math.hypot(spot.x - pl.x, spot.y - pl.y) >= 260) c = spot;
    }
    if (!c) c = map.randomSpawn(pl.x, pl.y, [], 300, 0);
    for (const [type, n] of group) {
      for (let i = 0; i < n; i++) {
        const p = freeSpot(map, c.x + (Math.random() - 0.5) * 90, c.y + (Math.random() - 0.5) * 90, 22);
        this.api.spawnEnemy(type, p.x, p.y);
      }
    }
  }

  // Charging: stand in a relay's ring. Any Chromatic inside stops the charge
  // and drains it. Chromatics keep arriving while there's work left.
  _updateRelays(dt, b, pl) {
    const R = 64;
    const es = this.api.enemies.enemies.filter(e => e.isAlive && !e.forming);
    let charging = null;
    for (const r of this.relays) {
      if (r.done) continue;
      const crowd = es.filter(e => Math.hypot(e.x - r.x, e.y - r.y) < R).length;
      r.drain = crowd;
      const inside = Math.hypot(pl.x - r.x, pl.y - r.y) < R;
      if (crowd > 0) r.charge = Math.max(0, r.charge - 0.07 * crowd * dt);
      else if (inside) {
        r.charge = Math.min(1, r.charge + dt / 7);
        charging = r;
        if (!this._saidFirst && r.charge > 0.08) { this._saidFirst = true; this.radio.say(b.firstCharge); }
      }
      if (r.charge >= 1) {
        r.done = true;
        const n = this.relays.filter(x => x.done).length;
        sfxRelayCharged();
        this.radio.say(b.eachDone[n - 1] || []);
        // An Echo drifts out of the spent relay — health for the next push
        if (n < b.count) this.api.spawnEcho(r.x + 56, r.y + 24);
      }
    }
    this.charging = charging;
    this.charge = this.relays.reduce((s, r) => s + (r.done ? 1 : r.charge), 0) / b.count;
    if (charging && Math.random() < dt * 22) this.motes.push({ x: charging.x, y: charging.y - 18, t: 0, s: Math.random() });

    // Interrupters: pairs of violets from anywhere on the map, at most 4 at once
    const done = this.relays.filter(r => r.done).length;
    this._interrupt(dt, 4, 4.5, () => 'violet');
    if (done >= b.count) { this.charging = null; this._finishBeat(); }
  }

  // A steady trickle of Chromatics in pairs, arriving from anywhere on the map
  // (well away from the player), never more than `cap` on the floor at once
  _interrupt(dt, cap, period, pickType) {
    const pl = this.api.player();
    const es = this.api.enemies.enemies.filter(e => e.isAlive);
    this.spawnT -= dt;
    if (this.spawnT > 0 || es.length >= cap) return;
    const map = this.api.map();
    const at = map.randomSpawn(pl.x, pl.y, es.map(e => ({ x: e.x, y: e.y })), 320, 90);
    for (let i = 0; i < Math.min(2, cap - es.length); i++) {
      const p = freeSpot(map, at.x + (i ? 26 : -26), at.y + (Math.random() - 0.5) * 30, 22);
      this.api.spawnEnemy(pickType(), p.x, p.y);
    }
    this.spawnT = period;
  }

  _updateSequence(dt, b) {
    for (let i = 0; i < this.lit.length; i++) if (this.showing || this.seqStep === 0) this.lit[i] = Math.max(0, this.lit[i] - dt * 2.2);
    if (this.wrongT > 0) {
      this.wrongT -= dt;
      for (let i = 0; i < this.lit.length; i++) this.lit[i] = Math.max(0, this.lit[i] - dt * 4);
      if (this.wrongT <= 0) { this.showing = true; this.showT = 0; this._shown = -1; }
      return;
    }
    if (this.seqStep === 0 && !this.showing && !this._everShown) { this.showing = true; this.showT = 0; this._shown = -1; this._everShown = true; }
    if (this.showing) {
      this.showT += dt;
      const STEP = 0.8;
      const k = Math.floor((this.showT - 0.4) / STEP);
      if (k >= 0 && k < this.seq.length && k !== this._shown) {
        this._shown = k;
        this.lit[this.seq[k]] = 1;
        sfxNode(this.seq[k]);
      }
      if (this.showT > 0.4 + this.seq.length * STEP + 0.3) this.showing = false;
    }
  }

  _updateMotes(dt, pl) {
    for (const m of this.motes) m.t += dt / 0.55;
    this.motes = this.motes.filter(m => m.t < 1);
  }

  get objective() {
    const b = this.beat;
    if (!b || !b.objective) return null;
    if (b.type === 'sequence' && this.showing) return 'Watch the order';
    const left = this.api.enemies.enemies.filter(e => e.isAlive).length;
    const done = this.relays ? this.relays.filter(r => r.done).length : 0;
    return b.objective({ left, done });
  }

  // ── Drawing ─────────────────────────────────────────────────

  drawWorld(ctx) {
    const b = this.beat;
    const t = this.t;
    if (this.relays || (b && b.type === 'relays')) {
      for (const r of (this.relays || this.relayPos.map(p => ({ ...p, charge: 0, done: false, drain: 0 })))) this._drawRelay(ctx, r, t);
    }
    if (b && (b.type === 'sequence' || b.type === 'exit') || this.seq) this._drawLock(ctx, t);
    if (b && b.type === 'exit') this._drawExit(ctx, t);
    // Essence flowing from the relay into the agent
    const pl = this.api.player();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.color;
    for (const m of this.motes) {
      const from = this.charging || m;
      const k = m.t * m.t;
      const x = from.x + (pl.x - from.x) * k + Math.sin(m.t * 6 + m.s * 9) * 8 * (1 - m.t);
      const y = (from.y - 18) + (pl.y - 8 - (from.y - 18)) * k - Math.sin(m.t * Math.PI) * 18;
      ctx.globalAlpha = Math.sin(m.t * Math.PI);
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
    ctx.restore();
  }

  _drawRelay(ctx, r, t) {
    const R = 64;
    const live = this.beat && this.beat.type === 'relays' && this.ready;
    ctx.save();
    // Ring on the floor
    ctx.globalAlpha = r.done ? 0.25 : (live ? 0.55 : 0.3);
    ctx.strokeStyle = r.drain > 0 ? '#F85A8A' : '#5E8C96';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(r.x, r.y + 6, R, R * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    // Charge arc in the agent's colour
    if (r.charge > 0 || r.done) {
      ctx.globalAlpha = r.done ? 0.3 : 0.9;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(r.x, r.y + 6, R, R * 0.55, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (r.done ? 1 : r.charge)); ctx.stroke();
    }
    // The pylon (pixel blocks)
    ctx.globalAlpha = 1;
    const x = Math.round(r.x), y = Math.round(r.y);
    ctx.fillStyle = '#1B2430'; ctx.fillRect(x - 9, y - 4, 18, 8);
    ctx.fillStyle = '#2C3A48'; ctx.fillRect(x - 6, y - 30, 12, 28);
    ctx.fillStyle = '#3E5163'; ctx.fillRect(x - 6, y - 30, 12, 3);
    ctx.fillStyle = '#121820'; ctx.fillRect(x - 3, y - 24, 6, 18);
    // Core: dim teal when full of old charge, the agent's colour once drawn
    const core = r.done ? '#2A3440' : (r.charge > 0 ? this.color : '#00E5CC');
    ctx.fillStyle = core;
    const h = r.done ? 2 : Math.max(2, Math.round(18 * (1 - r.charge * 0.85)));
    ctx.fillRect(x - 2, y - 6 - h, 4, h);
    ctx.globalCompositeOperation = 'lighter';
    if (!r.done) drawGlow(ctx, r.charge > 0 ? this.color : '#00E5CC', r.x, r.y - 16, 26 + Math.sin(t * 3) * 2, 0.35);
    ctx.restore();
  }

  _drawLock(ctx, t) {
    const solved = this.beat && this.beat.type === 'exit';
    ctx.save();
    // Conduits from the pads to the centre
    ctx.strokeStyle = solved ? this.color : '#2F4250';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    for (const n of this.nodePos) { ctx.beginPath(); ctx.moveTo(this.lockCenter.x, this.lockCenter.y); ctx.lineTo(n.x, n.y); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1B2430'; ctx.fillRect(Math.round(this.lockCenter.x) - 8, Math.round(this.lockCenter.y) - 8, 16, 16);
    ctx.fillStyle = solved ? this.color : '#3E5163'; ctx.fillRect(Math.round(this.lockCenter.x) - 4, Math.round(this.lockCenter.y) - 4, 8, 8);
    // Floor pads: step on them in order
    for (let i = 0; i < this.nodePos.length; i++) {
      const n = this.nodePos[i];
      const x = Math.round(n.x), y = Math.round(n.y);
      const lit = solved ? 1 : (this.lit ? this.lit[i] : 0);
      const done = !solved && this.beat && this.beat.type === 'sequence' && !this.showing &&
                   this.seq && this.seq.slice(0, this.seqStep).includes(i);
      ctx.fillStyle = '#141B24'; ctx.fillRect(x - 16, y - 13, 32, 26);
      ctx.fillStyle = '#2C3A48'; ctx.fillRect(x - 14, y - 11, 28, 22);
      ctx.fillStyle = '#3E5163'; ctx.fillRect(x - 14, y - 11, 28, 2);
      const k = done ? 1 : lit;
      if (k > 0.02) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.35 + 0.65 * k;
        ctx.fillRect(x - 10, y - 7, 20, 14);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, this.color, n.x, n.y, 30, 0.5 * k);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.fillStyle = '#1E2833'; ctx.fillRect(x - 10, y - 7, 20, 14);
      }
    }
    ctx.restore();
  }

  // The door out: a sealed slab whose seams glow in the agent's colour
  _drawExit(ctx, t) {
    const e = this.exitPos;
    const x = Math.round(e.x), y = Math.round(e.y);
    const pulse = 0.6 + 0.4 * Math.sin(t * 3);
    ctx.save();
    // Light spilling onto the floor in front of the door, so it stands out
    // from the room: a soft pool, a fan of rays from the seam, and faint lit
    // scanlines across the floor
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.translate(e.x, y + 16);
    ctx.scale(1, 0.42);
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
    pool.addColorStop(0, this.color); pool.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.6 * (0.75 + 0.25 * pulse);
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    for (const [spread, a] of [[-28, 0.22], [0, 0.34], [28, 0.22]]) {
      const ray = ctx.createLinearGradient(0, y + 4, 0, y + 46);
      ray.addColorStop(0, this.color); ray.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a * (0.7 + 0.3 * pulse);
      ctx.fillStyle = ray;
      ctx.beginPath(); ctx.moveTo(x - 3, y + 5); ctx.lineTo(x + 3, y + 5);
      ctx.lineTo(x + spread + 9, y + 46); ctx.lineTo(x + spread - 9, y + 46); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = this.color;
    for (let k = 0; k < 7; k++) {
      const ly = y + 9 + k * 5, half = 30 - k * 2.5;
      ctx.globalAlpha = (0.42 - k * 0.05) * (0.75 + 0.25 * pulse);
      ctx.fillRect(Math.round(x - half), ly, Math.round(half * 2), 1);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#141B24'; ctx.fillRect(x - 20, y - 40, 40, 46);       // frame
    ctx.fillStyle = '#2C3A48'; ctx.fillRect(x - 17, y - 37, 34, 42);       // door
    ctx.fillStyle = '#3E5163'; ctx.fillRect(x - 17, y - 37, 34, 3);
    ctx.fillStyle = '#1E2833'; ctx.fillRect(x - 13, y - 30, 11, 30); ctx.fillRect(x + 2, y - 30, 11, 30);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = pulse;
    ctx.fillRect(x - 1, y - 37, 2, 42);                                     // centre seam
    ctx.fillRect(x - 17, y + 4, 34, 2);                                     // threshold
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, this.color, e.x, e.y - 14, 34, 0.35 * pulse);
    ctx.restore();
  }

  // Where the player should head next, if anywhere
  get target() {
    const b = this.beat;
    if (!b || !this.ready) return null;
    const pl = this.api.player();
    if (b.type === 'relays' && this.relays) {
      const open = this.relays.filter(r => !r.done);
      if (!open.length) return null;
      return open.reduce((a, r) => Math.hypot(r.x - pl.x, r.y - pl.y) < Math.hypot(a.x - pl.x, a.y - pl.y) ? r : a);
    }
    if (b.type === 'sequence') return this.lockCenter;
    if (b.type === 'exit') return this.exitPos;
    return null;
  }

  // HUD: comms + objective, Chroma collected, emitter charge, and an arrow at
  // the screen edge toward the next place to go when it's out of view.
  // toScreen maps world → screen coordinates.
  drawHud(ctx, W, H, touch, toScreen) {
    // Keep comms clear of the Resonance / Emitter bars on narrow screens
    this.radio.draw(ctx, W, H, this.objective, touch, (W < 600 ? 100 : 96) + (this.relays ? 22 : 0));
    const tg = this.target;
    if (tg && toScreen) {
      const [sx, sy] = toScreen(tg.x, tg.y);
      if (sx < 0 || sx > W || sy < 0 || sy > H) {
        const m = 30;
        const cx = Math.max(m, Math.min(W - m, sx)), cy = Math.max(m + 90, Math.min(H - m - 60, sy));
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.atan2(sy - cy, sx - cx));
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(this.t * 5);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    const narrow = W < 600;
    // Chroma, top right
    const cols = { violet: '#8B5CFF', yellow: '#E9FF6A', green: '#8DFF6A' };
    ctx.save();
    ctx.font = `bold ${narrow ? 11 : 13}px monospace`;
    ctx.textAlign = 'right';
    let x = W - 14;
    for (const c of ['green', 'yellow', 'violet']) {
      const label = String(this.chroma[c]);
      ctx.fillStyle = '#C4C8D4';
      ctx.fillText(label, x, 26);
      const w = ctx.measureText(label).width;
      ctx.fillStyle = cols[c];
      ctx.fillRect(Math.round(x - w - 12), 17, 7, 7);
      x -= w + 26;
    }
    ctx.fillStyle = '#5E8C96';
    ctx.font = `${narrow ? 9 : 10}px monospace`;
    ctx.fillText('CHROMA', W - 14, 40);
    // Power-ups so far, under the health bar
    {
      const y = narrow ? 76 : 72;
      ctx.textAlign = 'left';
      ctx.font = `${narrow ? 9 : 11}px monospace`;
      if (this.powers.length) {
        ctx.fillStyle = this.color;
        ctx.fillText(this.powers.map(n => '◆ ' + n).join('  '), 14, y, narrow ? W - 28 : 520);
      } else {
        ctx.fillStyle = '#5A6470';
        ctx.fillText('◇ clear a section to power up', 14, y);
      }
    }
    // Emitter charge, under that, once relays have started
    if (this.relays) {
      const y = narrow ? 100 : 96;
      const bw = narrow ? 120 : 200;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8A8E99';
      ctx.font = `${narrow ? 9 : 11}px monospace`;
      ctx.fillText('EMITTER CHARGE', 14, y);
      ctx.fillStyle = '#1E2130';
      ctx.fillRect(14, y + 5, bw, 5);
      ctx.fillStyle = this.color;
      ctx.fillRect(14, y + 5, bw * this.charge, 5);
    }
    ctx.restore();
  }
}
