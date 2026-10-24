// CHROMATIC DECAY — Story levels
//
// A level is a list of beats played in order, each one a checkpoint:
//   wave      clear groups of Chromatics (groups arrive from different sides)
//   relays    power up relays while Chromatics keep coming to drain them
//   servers   shoot the marked server racks spread round the map to wake them
//   sequence  watch floor pads light up, then walk over them in the same order
//   escort    lead a slow Echo to a point; Chromatics touching it stall it
//   valves    stand on plates to open them for a few seconds; all open at once
//   exit      reach the door: the agent beams out, and the
//             first time, opening it unlocks a card for keeps
// The operator (the character who stayed behind) talks over comms between
// beats; enemies wait for the briefing to finish. Power drawn from the map
// takes on the agent's colour — green for Dex, pink for Juno, gold for Raze.
// Clearing a section grants the agent a set power-up for the rest of the level
// (game.js shows it). Going down fails the level.

import { Radio } from './dialogue.js';
import { CONFIG } from './config.js';
import { drawGlow } from './sprites.js';
import { rackHeight } from './pixelmap.js';
import { pathToPlayer } from './enemies.js';
import { drawEchoFigure } from './echoes.js';
import { circleVsRect } from './utils.js';
import { sfxRelayCharged, sfxNode, sfxNodeWrong, sfxWaveClear } from './audio.js';

const EXTRACT_BEAM = 0.7;   // seconds at the door before the beam-out starts

export const AGENT_COLOR = { dex: '#B6FF2E', juno: '#E58CFF', raze: '#FFD15C' };
const COLOR_NAME = { dex: 'green', juno: 'pink', raze: 'gold' };
// Power-ups granted as each section is cleared (wave, relays, wave), per
// agent. They last for the level and preview where each character is going.
export const POWERUPS = {
  dex: [
    { id: 'heavy_bursts', name: 'HEAVY BURSTS', desc: '4-round bursts, and 15% more damage.',          apply: p => { p.projCount += 1; p.damageMultiplier *= 1.15; } },
    { name: 'STUN GRENADE',    desc: 'Lob it over the racks: stuns and jams enemies, who take 50% more damage.', apply: p => { p.grenade = true; p.abilities.push('grenade'); },
      hint: touch => (touch ? 'Tap its button to throw it.' : 'Press E to throw it.') },
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
    powerups: true,   // the sampler: a set power-up after each section
    blurb: "Find Raze's trail: power the floor, wake the servers.",
    outcome: "Raze's logs recovered. His trail leads down, to Cold Storage.",
    beats: (op, agent) => {
      const L = (face, text) => ({ who: op, face, text });
      const f = (dexFace, junoFace) => (op === 'dex' ? dexFace : junoFace);
      const col = COLOR_NAME[agent];
      return [
        { type: 'wave',
          lines: [L(f('neutral', 'focused'), "Server Floor. Raze's signal went dark here, and these servers logged everything. If he left a trail, it's on them."),
                  L(f('determined', 'focused'), 'Chromatics moved back in. Clear them out first.')],
          groups: [[['violet', 3]], [['violet', 3]], [['violet', 2], ['yellow', 1]]],
          objective: s => `Clear the floor (${s.left} left)`,
          done: [L(f('cocky-grin', 'smirk'), 'Clean.')] },

        { type: 'relays', count: 3,
          lines: [L(f('neutral', 'focused'), "The servers need power. Three relays still hold charge: get close and pull it into your emitter."),
                  L(f('worried', 'concerned'), 'Anything touching a relay drains it, so keep them off.')],
          firstCharge: [L(f('shocked', 'alarmed'), `Wait... it's coming through ${col}. The charge is matching your signal.`)],
          eachDone: [
            [L(f('determined', 'focused'), "One. Your emitter's holding more than it should.")],
            [L(f('laughing', 'soft-smile'), "Two. I can see it from here. You're brighter.")],
            [L(f('neutral', 'focused'), "That's all three. Whatever was in those relays is in you now.")],
          ],
          objective: s => `Power the relays (${s.done}/3)`,
          done: [] },

        { type: 'wave',
          lines: [L(f('worried', 'concerned'), "That woke the rest of them up. Yellows in the mix.")],
          groups: [[['violet', 3], ['yellow', 1]], [['yellow', 2]], [['violet', 2], ['yellow', 2]]],
          objective: s => `Hold them off (${s.left} left)`,
          done: [L(f('neutral', 'soft-smile'), "That's the last of them. Power's back. Now the servers.")] },

        { type: 'servers', count: 4,
          lines: [L(f('determined', 'focused'), "Four servers hold Raze's logs, spread across the floor. Shoot each one to wake it. I've marked them."),
                  L(f('worried', 'concerned'), "Careful. All that noise is drawing a swarm. You don't have to fight them all, just keep moving.")],
          eachDone: [
            [L(f('determined', 'focused'), 'One.')],
            [L(f('cocky-grin', 'smirk'), 'Two. Halfway.')],
            [L(f('determined', 'focused'), 'Three. One left.')],
          ],
          objective: s => `Wake the servers (${s.servers}/4)`,
          interrupt: { cap: 10, period: 2, yellow: 0.25 },
          done: [L(f('shocked', 'alarmed'), "That's all four, and there's his trace. Raze went down, to Cold Storage."),
                 L(f('laughing', 'soft-smile'), "Get back to the door you came in by. I'll pull you out.")] },

        { type: 'exit',
          lines: [],
          objective: () => 'Get to the door',
          interrupt: { cap: 10, period: 2, yellow: 0.25 },
          extract: [L(f('cocky-grin', 'soft-smile'), "Got you. Coming home.")],
          done: [] },
      ];
    },
  },
};

LEVELS[2] = {
  id: 2,
  name: 'COLD STORAGE',
  map: 'cold',
  exit: 'lift',
  blurb: "Follow Raze into the frozen archive; get the lift running.",
  outcome: "The Echo showed you where Raze went: down, to The Stacks.",
  // Where things are, as fractions of the map (nudged clear of racks)
  points: { echo: [0.10, 0.47], lift: [0.88, 0.90], valves: [[0.12, 0.32], [0.88, 0.50], [0.42, 0.88]] },
  beats: (op, agent) => {
    const L = (face, text) => ({ who: op, face, text });
    const f = (dexFace, junoFace) => (op === 'dex' ? dexFace : junoFace);
    return [
      { type: 'wave',
        lines: [L(f('neutral', 'focused'), "Cold Storage. Raze's trace led down here, where they froze the old data."),
                L(f('worried', 'concerned'), "Something's still moving in the aisles. Clear them.")],
        groups: [[['violet', 3]], [['violet', 2], ['yellow', 1]], [['yellow', 2], ['violet', 2]]],
        objective: s => `Clear the aisles (${s.left} left)`,
        done: [L(f('shocked', 'alarmed'), "Clear. Wait... there's an Echo in here, and it's awake.")] },

      { type: 'escort',
        lines: [L(f('determined', 'focused'), "It saw Raze come through. It knows the way to the freight lift."),
                L(f('worried', 'concerned'), "It'll follow you. Keep the Chromatics off it: they drain it and it stops.")],
        objective: s => (s.escortStalled ? 'Get them off the Echo!' : `Lead the Echo to the lift (${s.escortLeft} m)`),
        interrupt: { cap: 4, period: 4, yellow: 0.2, goal: 0.5 },
        done: [L(f('laughing', 'soft-smile'), "It made it. ...It's showing me where he went: further down. The Stacks.")] },

      { type: 'wave',
        lines: [L(f('worried', 'concerned'), "They followed the Echo's light. Here they come.")],
        groups: [[['yellow', 2]], [['yellow', 2], ['violet', 2]], [['yellow', 3]]],
        objective: s => `Hold them off (${s.left} left)`,
        done: [L(f('neutral', 'soft-smile'), "That's the last of them. Now the lift.")] },

      { type: 'valves',
        lines: [L(f('neutral', 'focused'), "The lift's frozen solid. There are three coolant valves, spread out."),
                L(f('determined', 'neutral'), "Stand on one to open it. Get all three open at once and the ice lets go.")],
        objective: s => `Open all three valves at once (${s.valvesOpen}/3)`,
        interrupt: { cap: 3, period: 5, yellow: 0 },
        done: [L(f('shocked', 'alarmed'), "It's moving! Get on the lift.")] },

      { type: 'exit',
        lines: [],
        objective: () => 'Get on the lift',
        interrupt: { cap: 6, period: 3, yellow: 0.3 },
        extract: [L(f('cocky-grin', 'soft-smile'), "Hold on. Going down.")],
        done: [] },
    ];
  },
};

const VALVE_OPEN = 8;     // seconds a valve stays open once you step off
const ESCORT_SPEED = 78;  // px/s, about a third of the agent's walk

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
    this.extractT = null;     // set once the agent reaches the door and beams out
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
    const pts = this.def.points;
    if (pts) {
      const at = ([fx, fy], pad = 30) => freeSpot(map, W * fx, H * fy, pad);
      this.exitPos  = pts.lift ? at(pts.lift, 40) : map.playerSpawn();
      if (pts.echo) this.echoPos = at(pts.echo, 24);
      if (pts.valves) this.valvePos = pts.valves.map(v => at(v, 26));
      return;
    }
    this.relayPos = [freeSpot(map, W * 0.2, H * 0.24), freeSpot(map, W * 0.8, H * 0.26), freeSpot(map, W * 0.5, H * 0.5)];
    const c = freeSpot(map, W * 0.5, H * 0.33, 110);
    this.lockCenter = c;
    this.nodePos = [[0, -84], [84, 0], [0, 84], [-84, 0]].map(([dx, dy]) => freeSpot(map, c.x + dx, c.y + dy, 26));
    this.exitPos = map.playerSpawn();
    // Four servers to wake: the rack nearest each corner region, so the
    // player has to cover the whole floor (none right by the door)
    const racks = map.obstacles.filter(o => o.w >= 24 && o.h >= 40 &&
      Math.hypot(o.x + o.w / 2 - this.exitPos.x, o.y + o.h / 2 - this.exitPos.y) > 200);
    this.serverRacks = [];
    for (const [fx, fy] of [[0.12, 0.2], [0.88, 0.22], [0.12, 0.82], [0.88, 0.82]]) {
      const tx = W * fx, ty = H * fy;
      const o = racks.filter(r => !this.serverRacks.includes(r))
        .sort((a, b) => Math.hypot(a.x + a.w / 2 - tx, a.y + a.h / 2 - ty) - Math.hypot(b.x + b.w / 2 - tx, b.y + b.h / 2 - ty))[0];
      if (o) this.serverRacks.push(o);
    }
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
    } else if (b.type === 'escort') {
      if (!this.escort) this.escort = { x: this.echoPos.x, y: this.echoPos.y, alive: true, stalled: false, pulseTimer: 0, bobTimer: 0, drainT: 0 };
    } else if (b.type === 'valves') {
      if (!this.valves) this.valves = this.valvePos.map(p => ({ x: p.x, y: p.y, open: 0 }));
    } else if (b.type === 'servers') {
      if (!this.servers) this.servers = this.serverRacks.map(o => ({ o, x: o.x + o.w / 2, y: o.y + o.h / 2, lit: false, litT: 0 }));
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

  // Racks the player's shots hit this frame (from the projectile system):
  // a hit on a marked server wakes it
  onRackHits(hits) {
    const b = this.beat;
    if (!b || b.type !== 'servers' || !this.ready || !hits.length) return;
    for (const obs of hits) {
      const s = this.servers.find(sv => sv.o === obs && !sv.lit);
      if (!s) continue;
      s.lit = true;
      const n = this.servers.filter(sv => sv.lit).length;
      sfxNode(n - 1);
      this.radio.clear();   // a newer count replaces one still waiting or talking
      if (n < b.count) this.radio.say(b.eachDone[n - 1] || []);
      else { sfxRelayCharged(); this._finishBeat(); return; }
    }
  }

  // The game calls this once the door is opened (after any unlock screen)
  openDoor() { this.awaitUnlock = false; this.complete = true; }

  _finishBeat() {
    const b = this.beat;
    if (b.done && b.done.length) this.radio.say(b.done);
    if (b.type === 'wave' || b.type === 'relays') {
      sfxWaveClear();
      const list = this.def.powerups ? (POWERUPS[this.agent] || []) : [];
      if (this._powerIdx < list.length) this.pendingPowerUp = list[this._powerIdx++];
    }
    if (b.type === 'escort' && this.escort) this.escort.alive = false;   // safe: Chromatics lose interest
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

    if (this.extractT != null) { this._updateExtract(dt, pl); this._updateMotes(dt, pl); return; }
    // Beats with an interrupt setting keep Chromatics coming while you work
    // (Level 1's last stretch brings a swarm: not all of them need killing).
    // goal: the share of them that go after the escort instead of you
    const it = b.interrupt;
    if (it) this._interrupt(dt, it.cap, it.period, () => (Math.random() < (it.yellow || 0) ? 'yellow' : 'violet'),
      it.goal && this.escort && this.escort.alive ? e => { if (e.type === 'violet' && Math.random() < it.goal) e.goal = this.escort; } : null);
    if (b.type === 'wave') this._updateWave(dt, b);
    else if (b.type === 'escort') this._updateEscort(dt, b, pl);
    else if (b.type === 'valves') this._updateValves(dt, b, pl);
    else if (b.type === 'relays') this._updateRelays(dt, b, pl);
    else if (b.type === 'sequence') { this._updateSequence(dt, b); this._stepPads(pl, b); }
    else if (b.type === 'exit') {
      // At the door: mission complete, and the agent beams out
      if (Math.hypot(pl.x - this.exitPos.x, pl.y - this.exitPos.y) < 34) {
        this.extractT = 0;
        pl.invincible = Math.max(pl.invincible, 1);
        this.radio.say(b.extract || []);
        sfxRelayCharged();
      }
    }
    this._updateMotes(dt, pl);
  }

  // Extraction: a moment at the door, then the beam-out; once it's done, the
  // first clear shows the card unlock (game.js), then the results
  _updateExtract(dt, pl) {
    const t0 = this.extractT;
    this.extractT += dt;
    if (t0 < EXTRACT_BEAM && this.extractT >= EXTRACT_BEAM) { pl.startBeamOut(); this.api.beamOut(); }
    if (this.awaitUnlock || !pl.beamedOut || this.extractT < EXTRACT_BEAM + 1.6) return;
    if (this.api.needsUnlock()) this.awaitUnlock = true;
    else this.openDoor();
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
  _interrupt(dt, cap, period, pickType, onSpawn = null) {
    const pl = this.api.player();
    const es = this.api.enemies.enemies.filter(e => e.isAlive);
    this.spawnT -= dt;
    if (this.spawnT > 0 || es.length >= cap) return;
    const map = this.api.map();
    const at = map.randomSpawn(pl.x, pl.y, es.map(e => ({ x: e.x, y: e.y })), 320, 90);
    for (let i = 0; i < Math.min(2, cap - es.length); i++) {
      const p = freeSpot(map, at.x + (i ? 26 : -26), at.y + (Math.random() - 0.5) * 30, 22);
      const e = this.api.spawnEnemy(pickType(), p.x, p.y);
      if (onSpawn && e) onSpawn(e);
    }
    this.spawnT = period;
  }

  // Escort: the Echo follows the agent (round racks, like the swarm does) at a
  // walk, stalls while any Chromatic is touching it, and is done at the lift
  _updateEscort(dt, b, pl) {
    const e = this.escort, map = this.api.map();
    e.pulseTimer += dt; e.bobTimer += dt;
    const touching = this.api.enemies.enemies.some(en => en.isAlive && !en.forming && Math.hypot(en.x - e.x, en.y - e.y) < 34);
    e.stalled = touching;
    e.drainT = touching ? Math.min(1, e.drainT + dt * 3) : Math.max(0, e.drainT - dt * 2);
    // Near the lift it walks the last stretch by itself (it stops short of
    // the agent otherwise, and the agent is usually standing on the lift)
    const toLift = Math.hypot(e.x - this.exitPos.x, e.y - this.exitPos.y) < 130;
    const d = Math.hypot(pl.x - e.x, pl.y - e.y);
    if (!touching && (toLift || d > 48)) {
      const [ux, uy] = toLift ? (() => { const dx = this.exitPos.x - e.x, dy = this.exitPos.y - e.y, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; })()
                              : pathToPlayer(e.x, e.y, pl.x, pl.y);
      const step = ESCORT_SPEED * dt, r = 8;
      const free = (x, y) => x > 30 && y > 30 && x < CONFIG.map_width - 30 && y < CONFIG.map_height - 30 &&
        !map.obstacles.some(o => circleVsRect(x, y, r, o.x, o.y, o.w, o.h));
      if (free(e.x + ux * step, e.y)) e.x += ux * step;
      if (free(e.x, e.y + uy * step)) e.y += uy * step;
    }
    if (Math.hypot(e.x - this.exitPos.x, e.y - this.exitPos.y) < 46) { sfxRelayCharged(); this._finishBeat(); }
  }

  // Valves: standing on one opens it (and keeps it open); stepped off, it
  // closes after VALVE_OPEN seconds. All open at once finishes the beat.
  _updateValves(dt, b, pl) {
    this.valves.forEach((v, i) => {
      if (Math.hypot(pl.x - v.x, pl.y - v.y) < 26) {
        if (v.open <= 0) sfxNode(i);
        v.open = VALVE_OPEN;
      } else v.open = Math.max(0, v.open - dt);
    });
    if (this.valves.every(v => v.open > 0)) { sfxRelayCharged(); this._finishBeat(); }
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
    if (this.extractT != null) return null;   // nothing left to do
    const b = this.beat;
    if (!b || !b.objective) return null;
    if (b.type === 'sequence' && this.showing) return 'Watch the order';
    const left = this.api.enemies.enemies.filter(e => e.isAlive).length;
    const done = this.relays ? this.relays.filter(r => r.done).length : 0;
    const servers = this.servers ? this.servers.filter(s => s.lit).length : 0;
    const e = this.escort;
    const escortLeft = e ? Math.max(0, Math.round((Math.hypot(e.x - this.exitPos.x, e.y - this.exitPos.y) - 46) / 10)) : 0;
    const valvesOpen = this.valves ? this.valves.filter(v => v.open > 0).length : 0;
    return b.objective({ left, done, servers, escortLeft, escortStalled: !!(e && e.stalled), valvesOpen });
  }

  // ── Drawing ─────────────────────────────────────────────────

  drawWorld(ctx) {
    const b = this.beat;
    const t = this.t;
    if (this.relays || (b && b.type === 'relays')) {
      for (const r of (this.relays || this.relayPos.map(p => ({ ...p, charge: 0, done: false, drain: 0 })))) this._drawRelay(ctx, r, t);
    }
    if (this.seq) this._drawLock(ctx, t);
    if (this.def.exit === 'lift') this._drawLift(ctx, t, b && b.type === 'exit');
    else if (b && b.type === 'exit') this._drawExit(ctx, t);
    if (this.valves || (b && b.type === 'valves')) {
      (this.valves || this.valvePos.map(p => ({ ...p, open: 0 }))).forEach((v, i) => this._drawValve(ctx, v, i, t));
    }
    if (this.escort && (this.escort.alive || (b && b.type === 'escort'))) this._drawEscort(ctx, t);
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

  // The freight lift: a platform with hazard chevrons; lit in the agent's
  // colour once it's running (the exit beat), dim and frosted before
  _drawLift(ctx, t, live) {
    const e = this.exitPos;
    const x = Math.round(e.x), y = Math.round(e.y);
    const pulse = 0.6 + 0.4 * Math.sin(t * 3);
    const col = live ? this.color : '#4A6A88';
    ctx.save();
    if (live) {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, this.color, e.x, e.y, 70, 0.45 * pulse);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = '#0B1018'; ctx.fillRect(x - 26, y - 20, 52, 40);
    ctx.fillStyle = '#26324A'; ctx.fillRect(x - 24, y - 18, 48, 36);
    ctx.fillStyle = '#1A2436'; ctx.fillRect(x - 20, y - 14, 40, 28);
    ctx.fillStyle = col;
    ctx.globalAlpha = live ? pulse : 0.5;
    for (let k = -20; k < 20; k += 8) { ctx.fillRect(x + k, y - 18, 4, 2); ctx.fillRect(x + k + 2, y + 16, 4, 2); }   // chevrons
    ctx.fillRect(x - 24, y - 18, 2, 36); ctx.fillRect(x + 22, y - 18, 2, 36);                                      // rails
    ctx.globalAlpha = 1;
    if (!live) {   // frost crust over the deck
      ctx.fillStyle = '#5A7090';
      for (let k = 0; k < 14; k++) ctx.fillRect(x - 18 + ((k * 7) % 36), y - 12 + ((k * 11) % 24), 2, 1);
    }
    ctx.restore();
  }

  // A coolant valve plate: frosted while shut, the agent's colour while open,
  // with a ring that empties as it closes again
  _drawValve(ctx, v, i, t) {
    const x = Math.round(v.x), y = Math.round(v.y);
    const open = v.open > 0, k = v.open / VALVE_OPEN;
    const live = this.beat && this.beat.type === 'valves' && this.ready;
    ctx.save();
    ctx.globalAlpha = live ? 0.55 : 0.3;
    ctx.strokeStyle = open ? this.color : '#6A8AAA';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(v.x, v.y + 4, 30, 16, 0, 0, Math.PI * 2); ctx.stroke();
    if (open) {
      ctx.globalAlpha = 0.95; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(v.x, v.y + 4, 30, 16, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0B1018'; ctx.fillRect(x - 14, y - 10, 28, 20);
    ctx.fillStyle = '#2C3A52'; ctx.fillRect(x - 12, y - 8, 24, 16);
    ctx.fillStyle = '#3A4C6A'; ctx.fillRect(x - 12, y - 8, 24, 2);
    ctx.fillStyle = '#1A2436'; ctx.fillRect(x - 3, y - 22, 6, 14);          // pipe
    ctx.fillStyle = open ? this.color : '#5A7090';
    ctx.fillRect(x - 6, y - 24, 12, 3);                                       // wheel
    ctx.fillRect(x - 7, y - 4, 14, 8);                                        // gauge
    if (!open) { ctx.fillStyle = '#9FB8D8'; for (let n = 0; n < 6; n++) ctx.fillRect(x - 10 + n * 4, y - 7 + (n % 2) * 9, 2, 1); }
    if (open) {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, this.color, v.x, v.y, 26, 0.5);
    }
    ctx.restore();
  }

  // The Echo being escorted, with a soft trail of light; while a Chromatic is
  // draining it, it dims and pink sparks come off it
  _drawEscort(ctx, t) {
    const e = this.escort;
    drawEchoFigure(ctx, e, 1 - 0.45 * e.drainT);
    if (e.drainT > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#F85A8A';
      for (let k = 0; k < 6; k++) {
        const a = t * 4 + k * 1.05, r = 10 + ((t * 30 + k * 7) % 14);
        ctx.globalAlpha = e.drainT * (1 - ((t * 30 + k * 7) % 14) / 14);
        ctx.fillRect(Math.round(e.x + Math.cos(a) * r), Math.round(e.y - 6 + Math.sin(a) * r * 0.6), 2, 2);
      }
      ctx.restore();
    }
  }

  // Where the player should head next, if anywhere
  // Where the player should head next: one place, or every unlit server
  get targets() {
    const b = this.beat;
    if (!b || !this.ready) return [];
    const pl = this.api.player();
    if (b.type === 'relays' && this.relays) {
      const open = this.relays.filter(r => !r.done);
      if (!open.length) return [];
      return [open.reduce((a, r) => Math.hypot(r.x - pl.x, r.y - pl.y) < Math.hypot(a.x - pl.x, a.y - pl.y) ? r : a)];
    }
    if (b.type === 'servers' && this.servers) return this.servers.filter(s => !s.lit);
    if (b.type === 'escort' && this.escort) {
      const far = Math.hypot(this.escort.x - pl.x, this.escort.y - pl.y) > 200;
      return far ? [this.escort, this.exitPos] : [this.exitPos];
    }
    if (b.type === 'valves' && this.valves) return this.valves.filter(v => v.open <= 0);
    if (b.type === 'sequence') return [this.lockCenter];
    if (b.type === 'exit') return [this.exitPos];
    return [];
  }

  // Drawn over the racks: the marker on each server (dim until woken, then a
  // beam of the agent's colour rising from it)
  drawOverRacks(ctx) {
    if (!this.servers) return;
    const t = this.t;
    ctx.save();
    for (const s of this.servers) {
      const o = s.o;
      const x = Math.round(o.x + o.w / 2), y = Math.round(o.y - rackHeight(o) * 0.5 + 6);
      if (s.lit) {
        s.litT += 1 / 60;
        ctx.globalCompositeOperation = 'lighter';
        const beam = ctx.createLinearGradient(0, y - 160, 0, y);
        beam.addColorStop(0, 'rgba(0,0,0,0)'); beam.addColorStop(1, this.color);
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = beam; ctx.fillRect(x - 5, y - 160, 10, 160);
        drawGlow(ctx, this.color, x, y, 26, 0.7);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#141B24'; ctx.fillRect(x - 7, y - 7, 14, 14);
        ctx.fillStyle = this.color; ctx.fillRect(x - 5, y - 5, 10, 10);
      } else {
        const live = this.beat && this.beat.type === 'servers';
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + x);
        ctx.globalCompositeOperation = 'lighter';
        if (live) drawGlow(ctx, '#00E5CC', x, y, 20, 0.25 + 0.2 * pulse);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#141B24'; ctx.fillRect(x - 7, y - 7, 14, 14);
        ctx.fillStyle = live ? '#1F4A50' : '#26323E'; ctx.fillRect(x - 5, y - 5, 10, 10);
        if (live) {
          ctx.strokeStyle = '#00E5CC'; ctx.globalAlpha = 0.5 + 0.3 * pulse; ctx.lineWidth = 1;
          ctx.strokeRect(x - 10.5, y - 10.5, 21, 21);
        }
      }
    }
    ctx.restore();
  }

  // HUD: comms + objective, Chroma collected, emitter charge, and an arrow at
  // the screen edge toward the next place to go when it's out of view.
  // toScreen maps world → screen coordinates.
  drawHud(ctx, W, H, touch, toScreen) {
    // Keep comms clear of the Resonance / Emitter bars on narrow screens
    this.radio.draw(ctx, W, H, this.objective, touch, (W < 600 ? 100 : 96) + (this.relays ? 22 : 0));
    for (const tg of (toScreen ? this.targets : [])) {
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
    // Power-ups so far, under the health bar. Phones held sideways stack
    // them in the top-left corner, one per line, clear of the comms box
    const compact = touch && H < 500;
    const lx = compact ? 10 : 14;
    let y = compact ? 32 : narrow ? 76 : 72;
    ctx.textAlign = 'left';
    ctx.font = `${narrow || compact ? 9 : 11}px monospace`;
    if (this.powers.length) {
      ctx.fillStyle = this.color;
      if (compact) for (const n of this.powers) { ctx.fillText('◆ ' + n, lx, y); y += 11; }
      else ctx.fillText(this.powers.map(n => '◆ ' + n).join('  '), lx, y, narrow ? W - 28 : 520);
    } else {
      ctx.fillStyle = '#5A6470';
      ctx.fillText(compact ? '◇ power up: clear a section' : '◇ clear a section to power up', lx, y);
      if (compact) y += 11;
    }
    // Emitter charge, under that, once relays have started
    if (this.relays) {
      y = compact ? y + 6 : narrow ? 100 : 96;
      const bw = compact ? 120 : narrow ? 120 : 200;
      ctx.fillStyle = '#8A8E99';
      ctx.font = `${narrow || compact ? 9 : 11}px monospace`;
      ctx.fillText('EMITTER CHARGE', lx, y);
      ctx.fillStyle = '#1E2130';
      ctx.fillRect(lx, y + 5, bw, 5);
      ctx.fillStyle = this.color;
      ctx.fillRect(lx, y + 5, bw * this.charge, 5);
    }
    ctx.restore();
  }
}
