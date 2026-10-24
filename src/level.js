// CHROMATIC DECAY — Story levels
//
// A level is a list of beats played in order, each one a checkpoint:
//   wave      clear groups of Chromatics (groups arrive from different sides)
//   relays    power up relays while Chromatics keep coming to drain them
//   servers   shoot the marked server racks spread round the map to wake them
//   sequence  watch floor pads light up, then walk over them in the same order
//   drives    grab items frozen into ice patches (you slide on ice)
//   freezers  crack frozen tanks that only a dash ability can damage
//   valves    stand on plates to open them for a few seconds; all open at once
//   hold      stand in a terminal's ring while it pulls a signal; anything else
//             in the ring stops it (stun them, lure them out, or shoot them)
//   beam      turn sealed-in mirrors (by landing a thrown ability on them) until
//             the beam from the wall reaches the vault
//   boss      a big Chromatic with its own health bar and attacks (The Queue)
//   gather    junction boxes that only open to an Arc Round jump or a bounced
//             round; each drops one of Raze's memories to walk over
//   tuning    dials (turned the same way) to match a display
//   escape    a timer to reach the far door, past live wires you can only cross
//             mid-dash
//   overload  anchors that only crack under an overload (Arc Discharge rounds,
//             or rounds fired during Spin Up)
//   hoarder   Level 5's boss: blinks, leaves turret nodes that shield it,
//             bursts you dash through, waves of Chromatics between phases
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
import { sfxRelayCharged, sfxNode, sfxNodeWrong, sfxWaveClear, sfxIceCrack, sfxQueueRing, sfxShockDash, sfxAlarm } from './audio.js';
import { STACKS, WIRE, VAULT } from './map.js';
import { drawCharacterFrame } from './player.js';

const EXTRACT_BEAM = 0.7;   // seconds at the door before the beam-out starts

export const AGENT_COLOR = { dex: '#B6FF2E', juno: '#E58CFF', raze: '#FFB52E' };
const COLOR_NAME = { dex: 'green', juno: 'pink', raze: 'gold' };
// Power-ups granted as each section is cleared (wave, relays, wave), per
// agent. They last for the level and preview where each character is going.
export const POWERUPS = {
  dex: [
    { id: 'heavy_bursts', name: 'HEAVY BURSTS', desc: '4-round bursts, and 15% more damage.',          apply: p => { p.projCount += 1; p.damageMultiplier *= 1.15; } },
    { name: 'STUN GRENADE',    desc: 'Lob it over the racks: stuns and jams enemies, who take 50% more damage.', apply: p => { p.grenade = true; p.abilities.push('grenade'); },
      hint: touch => (touch ? 'Press its button and drag to where it should land.' : 'Press E to throw it at the cursor.') },
    { name: 'ARC ROUND',       desc: 'The last round of every burst arcs on to another enemy close by, for 10% more damage.', apply: p => { p.arcRound = true; } },
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
  outcome: "Raze's archive drives recovered. He went down, to The Stacks.",
  unlockTop: 'THE LIFT DRINKS THE CHARGE. SOME OF IT STAYS WITH YOU.',
  icy: true,     // the whole floor is ice: you slide everywhere
  // Where things are, as fractions of the map (nudged clear of racks).
  // drives: the frozen archive drives; tanks: the frozen coolant tanks
  points: {
    lift: [0.88, 0.90],
    drives: [[0.41, 0.319], [0.71, 0.497], [0.21, 0.677]],
    tanks: [[0.14, 0.32], [0.88, 0.50], [0.40, 0.88]],
  },
  beats: (op, agent) => {
    const L = (face, text) => ({ who: op, face, text });
    const f = (dexFace, junoFace) => (op === 'dex' ? dexFace : junoFace);
    const dex = agent === 'dex';
    return [
      { type: 'wave',
        lines: [L(f('neutral', 'focused'), "Cold Storage. Raze's trace led down here, where they froze the old data."),
                L(f('worried', 'concerned'), "The whole floor's iced over, so you'll slide. And something's still moving in the aisles.")],
        groups: [[['violet', 3]], [['violet', 2], ['yellow', 1]], [['yellow', 2], ['violet', 2]]],
        objective: s => `Clear the aisles (${s.left} left)`,
        grant: true,   // the level's dash ability, after this section
        done: [L(f('shocked', 'alarmed'), "Clear. Hang on, your signal just spiked...")] },

      { type: 'drives',
        lines: [L(f('laughing', 'soft-smile'), dex ? "Your dash is crackling now. Anything you dash through gets a shock."
                                                   : "Your dash leaves a charge behind now. It goes off a second after you."),
                L(f('determined', 'focused'), "Raze's trace is split across three archive drives, frozen into the floor. I've marked them.")],
        eachDone: [[L(f('determined', 'focused'), 'One drive.')], [L(f('cocky-grin', 'smirk'), 'Two. One more.')]],
        objective: s => `Grab the frozen drives (${s.drives}/3)`,
        interrupt: { cap: 4, period: 4, yellow: 0.25 },
        done: [L(f('shocked', 'alarmed'), "That's all three, and there's his trail. Raze went down: The Stacks.")] },

      { type: 'wave',
        lines: [L(f('worried', 'concerned'), "They heard the ice crack. Here they come."),
                L(f('cocky-grin', 'smirk'), "Tip: dash through a hit just as it lands. A perfect dash, and your dash comes straight back.")],
        groups: [[['yellow', 2]], [['yellow', 2], ['violet', 2]], [['yellow', 3]]],
        objective: s => `Hold them off (${s.left} left)`,
        done: [L(f('neutral', 'soft-smile'), "That's the last of them. Now the lift.")] },

      { type: 'freezers',
        lines: [L(f('neutral', 'focused'), "The lift's frozen solid, and those three coolant tanks are why."),
                L(f('determined', 'neutral'), dex ? "Bullets won't touch that ice. Dash through a tank and your shock cracks it. Twice each."
                                                  : "Bullets won't touch that ice. Dash away from a tank and your charge cracks it. Twice each.")],
        objective: s => `Crack the frozen tanks (${s.tanks}/3)`,
        interrupt: { cap: 3, period: 5, yellow: 0 },
        done: [L(f('shocked', 'alarmed'), "That's it, the lift's moving! Get on.")] },

      { type: 'exit',
        lines: [],
        objective: () => 'Get on the lift',
        interrupt: { cap: 6, period: 3, yellow: 0.3 },
        extract: [L(f('cocky-grin', 'soft-smile'), "Hold on. Going down.")],
        done: [] },
    ];
  },
};

LEVELS[3] = {
  id: 3,
  name: 'THE STACKS',
  map: 'stacks',
  exit: 'vault',
  blurb: "Pull one of Raze's memories out of the Stacks; open the vault.",
  outcome: "One of Raze's memories recovered, and The Queue broken. He's deeper still.",
  intro: 'stacks',   // the lift-down scene (story.js INTROS) plays first
  unlockTop: 'THE STACKS GO QUIET. YOU KEEP WHAT YOU THREW.',
  // Where things are, as fractions of the map. mirrors: the sealed pockets,
  // in the order the beam visits them; dead: where each mirror points while
  // it's turned wrong; source: the emitter on the wall
  points: {
    terminal: [0.80, 0.20],
    vault:    [0.5, 0.5],
    source:   [0.12, 0.05],
    mirrors:  STACKS.pockets.map(p => [...p]),
    dead:     [[0.03, 0.95], [0.97, 0.97], [0.97, 0.05]],
  },
  beats: (op, agent) => {
    const L = (face, text) => ({ who: op, face, text });
    const f = (dexFace, junoFace) => (op === 'dex' ? dexFace : junoFace);
    const dex = agent === 'dex';
    const thing = dex ? 'grenade' : 'beacon';
    return [
      { type: 'wave',
        lines: [L(f('neutral', 'focused'), "The Stacks. Every stream nobody ever played ended up here, on tape."),
                L(f('determined', 'focused'), "Raze left part of his signal somewhere in this. Clear the floor first.")],
        groups: [[['violet', 4]], [['violet', 3], ['yellow', 1]], [['violet', 4], ['yellow', 1]]],
        objective: s => `Clear the floor (${s.left} left)`,
        grant: true,   // the level's thrown ability, after this section
        done: [L(f('cocky-grin', 'smirk'), "Clear. Hold on, I'm sending you something.")] },

      { type: 'hold',
        lines: [L(f('laughing', 'soft-smile'), dex ? "A stun grenade. Lob it over anything: whatever it lands on freezes up."
                                                   : "A decoy beacon. Throw it and they chase the light instead of you."),
                L(f('determined', 'focused'), "There's something of Raze's in that terminal. Stand in its ring while it pulls."),
                L(f('worried', 'concerned'), dex ? "Anything else in the ring stops the pull. Stunned ones don't count."
                                                 : "Anything else in the ring stops the pull. Lure them out of it.")],
        half: [L(f('determined', 'focused'), 'Halfway. Keep them out.')],
        objective: s => (s.blocked ? `Clear the ring to keep pulling (${s.hold}%)` : `Pull the signal (${s.hold}%)`),
        interrupt: { cap: 5, period: 3, yellow: 0.35 },
        done: [L(f('shocked', 'alarmed'), "Got it. It's a memory. His. I can hear him in it.")] },

      { type: 'wave',
        lines: [L(f('worried', 'concerned'), "Something heard that. Here they come.")],
        groups: [[['violet', 3], ['yellow', 1]], [['yellow', 2], ['violet', 2]], [['violet', 3], ['yellow', 2]]],
        objective: s => `Hold them off (${s.left} left)`,
        done: [L(f('neutral', 'soft-smile'), "Clear. Now the vault in the middle.")] },

      { type: 'beam',
        lines: [L(f('neutral', 'focused'), "The vault only opens to light. Bounce the beam from that wall emitter into it."),
                L(f('determined', 'neutral'), `The mirrors are sealed in. Throw your ${thing} over the wall to turn one.`)],
        eachDone: [[L(f('determined', 'focused'), 'One mirror.')], [L(f('cocky-grin', 'smirk'), 'Two. One more.')]],
        objective: s => `Turn the mirrors to the vault (${s.mirrors}/3)`,
        interrupt: { cap: 3, period: 5, yellow: 0.2 },
        done: [L(f('shocked', 'alarmed'), "It's open. Wait... something's coming up out of it.")] },

      { type: 'boss',
        checkpoint: 'boss',   // dying here offers a retry from this fight
        lines: [L(f('shocked', 'alarmed'), "That's not a Chromatic. That's all of them. Every stream nobody played."),
                L(f('determined', 'focused'), "Those rings it sends out: dash straight through them.")],
        split: [L(f('worried', 'concerned'), dex ? "It's splitting! Stun the pack and burn it down."
                                                : "It's splitting! Bunch them up with the beacon.")],
        objective: () => 'Bring down The Queue',
        done: [L(f('laughing', 'soft-smile'), "It's breaking up... it's gone."),
               L(f('determined', 'focused'), "The vault's open. Get in, I'll pull you out.")] },

      { type: 'exit',
        lines: [],
        objective: () => 'Get into the vault',
        extract: [L(f('cocky-grin', 'soft-smile'), "Got you. And one of his memories with you.")],
        done: [] },
    ];
  },
};

LEVELS[4] = {
  id: 4,
  name: 'WIRE ROOM',
  map: 'wire',
  blurb: "Recover Raze's memories from the switchboard; get out alive.",
  outcome: "Every one of Raze's memories recovered, and out by a hair. His room is next.",
  intro: 'wire',     // Null interrupts the banter (story.js INTROS) first
  unlockTop: 'THE BOARD BURNS OUT BEHIND YOU. THE TRICK STAYS.',
  // boxes: the six junction boxes; dials: the three tuning dials; display:
  // the big board they match; door: the far end of the escape corridor
  points: {
    boxes:   [[0.19, 0.255], [0.54, 0.225], [0.375, 0.34], [0.18, 0.475], [0.655, 0.56], [0.35, 0.575]],
    dials:   [[0.75, 0.595], [0.59, 0.435], [0.47, 0.535]],
    display: [0.74, 0.27],
    door:    WIRE.door,
    wires:   WIRE.wires,
  },
  beats: (op, agent) => {
    const L = (face, text) => ({ who: op, face, text });
    const f = (dexFace, junoFace) => (op === 'dex' ? dexFace : junoFace);
    const dex = agent === 'dex';
    return [
      { type: 'wave',
        lines: [L(f('neutral', 'focused'), "The Wire Room. The Basement's old switchboard, and where they locked up what they took from Raze."),
                L(f('worried', 'concerned'), "And greens. They don't chase you. They show up where you're going.")],
        groups: [[['violet', 3], ['green', 1]], [['green', 2], ['violet', 2]], [['violet', 3], ['green', 2]]],
        objective: s => `Clear the switchboard (${s.left} left)`,
        grant: true,   // the level's ability, after this section
        done: [L(f('shocked', 'alarmed'), "Clear. Huh. Your emitter's pulling something off the board...")] },

      { type: 'gather',
        lines: [L(f('laughing', 'soft-smile'), dex ? "Your last round's arcing now. It jumps to anything close." : "Your rounds bounce off the cables now."),
                L(f('determined', 'focused'), "Six junction boxes have Raze's memories locked in them. I've marked them."),
                L(f('neutral', 'focused'), dex ? "They're shielded. Hit the cable or a Chromatic right next to one and let the arc jump in."
                                               : "They're shielded. Bounce a shot off the cables into each one.")],
        eachDone: [[L(f('determined', 'focused'), 'One memory.')], [L(f('cocky-grin', 'smirk'), 'Two.')], [L(f('determined', 'focused'), 'Three. Halfway.')],
                   [L(f('cocky-grin', 'smirk'), 'Four.')], [L(f('determined', 'focused'), 'Five. One more.')]],
        objective: s => `Recover Raze's memories (${s.pieces}/6)`,
        interrupt: { cap: 5, period: 3, yellow: 0.2, green: 0.25 },
        done: [L(f('shocked', 'alarmed'), "That's all six. Everything they took from him.")] },

      { type: 'wave',
        lines: [L(f('worried', 'concerned'), 'They felt that. Greens and yellows, coming in.')],
        groups: [[['green', 2], ['yellow', 1]], [['yellow', 2], ['green', 1]], [['green', 2], ['yellow', 2]]],
        objective: s => `Hold them off (${s.left} left)`,
        done: [L(f('neutral', 'soft-smile'), 'Clear. Now the door to his room.')] },

      { type: 'tuning',
        lines: [L(f('neutral', 'focused'), "His door's locked to a frequency. Match the three dials to the big display."),
                L(f('determined', 'neutral'), dex ? 'Arc into a dial to turn it.' : 'Bounce a shot into a dial to turn it.')],
        objective: s => `Tune the dials to the display (${s.tuned}/3)`,
        interrupt: { cap: 4, period: 4, yellow: 0.2, green: 0.3 },
        done: [] },

      { type: 'escape',
        time: 22,
        lines: [L(f('shocked', 'alarmed'), "It's open! Wait... the board's overloading. The floor cables just went live!"),
                L(f('angry', 'alarmed'), 'RUN! Down the corridor to the far door. Dash straight through the live wires!')],
        objective: s => `RUN! Get to the far door (0:${String(s.secs).padStart(2, '0')})`,
        interrupt: { cap: 6, period: 2, yellow: 0.35, green: 0.2 },
        done: [] },

      { type: 'exit',
        lines: [],
        objective: () => 'Get through the door',
        extract: [L(f('laughing', 'soft-smile'), dex ? "Got you! Breathe. That was way too close." : "Got you! That was way, way too close.")],
        done: [] },
    ];
  },
};

LEVELS[5] = {
  id: 5,
  name: "RAZE'S ROOM",
  map: 'vault',
  intro: 'raze',     // Null on what to expect from Raze (story.js INTROS) first
  outro: 'raze',     // meeting Raze, then Raze and Null (story.js OUTROS) after
  endOnBoss: true,   // the level ends the moment the boss dies
  blurb: 'Break the hoard. Kill what feeds on him. Bring Raze home.',
  outcome: "Raze is out. The Basement is quiet, for now.",
  unlockTop: 'THE HOARD COLLAPSES. THE CHARGE STAYS IN YOUR EMITTER.',
  points: {
    core:    VAULT.core,
    anchors: VAULT.anchors,
  },
  beats: (op, agent) => {
    const L = (face, text) => ({ who: op, face, text });
    const R = (face, text) => ({ who: 'raze', face, text });
    const f = (dexFace, junoFace) => (op === 'dex' ? dexFace : junoFace);
    const dex = agent === 'dex';
    return [
      { type: 'wave',
        lines: [L(f('shocked', 'alarmed'), "That's him. On the core. They've got him in a cage made of light."),
                R('stern', "Another one of Null's errand kids. Stay out of my sightline."),
                L(f('angry', 'annoyed'), 'Charming. Clear the room first.')],
        groups: [[['violet', 4], ['yellow', 1]], [['green', 2], ['violet', 3]], [['yellow', 2], ['green', 2], ['violet', 2]]],
        objective: s => `Clear the vault (${s.left} left)`,
        grant: true,   // the F ability, after this section
        done: [L(f('cocky-grin', 'smirk'), 'Clear.'), R('smirk', "Not bad. For a kid.")] },

      { type: 'overload',
        lines: [L(f('laughing', 'soft-smile'), dex ? "Your emitter's holding a charge you can dump all at once. A ring of it." : 'Your coil can spin past its limit now. Four seconds of everything.'),
                L(f('determined', 'focused'), 'Four anchors are feeding his cage. Plain fire glances off them.'),
                L(f('neutral', 'focused'), dex ? 'Get close and let the ring go. That cracks them.' : 'Spin up and pour it into them. That cracks them.')],
        eachDone: [[R('stern', 'One. Three more. Faster.')], [R('smirk', 'Two. Left one next. Are you blind?')], [R('neutral', '...Three. Keep going.')]],
        objective: s => `Break the anchors (${s.anchors}/4)`,
        interrupt: { cap: 5, period: 3, yellow: 0.25, green: 0.25 },
        done: [L(f('shocked', 'alarmed'), "That's the last anchor. Something's coming up through the floor..."),
               R('snarl', "That's the thing that's been eating me. Kill it. Slowly, if you can.")] },

      { type: 'hoarder',
        checkpoint: 'boss',
        lines: [L(f('worried', 'concerned'), "It can't be hurt while its turrets are up. Take them out first."),
                L(f('determined', 'focused'), 'And those bursts it fires: dash straight through them.')],
        phase: [[R('angry', "It's calling for help. Coward.")], [R('snarl', 'Again. It always does this when it starts to lose.')]],
        objective: s => (s.bossWave ? `Clear the swarm (${s.left} left)` : s.shielded ? 'Destroy its turret nodes' : 'Hit the Signal Hoarder!'),
        done: [R('uneasy', '...Finally.')] },
    ];
  },
};

// Level 5's F abilities: the old signatures, kept as a card on a clear
const SIG_POWERS = {
  dex: { id: 'arc_discharge', name: 'ARC DISCHARGE', desc: 'Let your stored charge go as a ring of electric rounds that knocks Chromatics back.',
         has: p => p.signature === 'dex', apply: p => { p.signature = 'dex'; p.abilities.push('signature'); },
         hint: touch => (touch ? 'Tap its round button. It cracks the anchors.' : 'Press F. It cracks the anchors.') },
  juno: { id: 'spin_up', name: 'SPIN UP', desc: 'For 4 seconds your minigun fires more than twice as fast, in a tight stream.',
          has: p => p.signature === 'juno', apply: p => { p.signature = 'juno'; p.abilities.push('signature'); },
          hint: touch => (touch ? 'Tap its round button. Rounds fired while it runs crack the anchors.' : 'Press F. Rounds fired while it runs crack the anchors.') },
};
// The Signal Hoarder (Level 5's boss)
const HOARDER = { hp: 1100, size: 34, contact: 16, blinkEvery: 4.2, blinkFast: 3.2, fade: 0.45,
                  nova: 14, novaSpeed: 135, novaDamage: 9, volleyEvery: 2.2,
                  phases: [0.66, 0.33] };
const ANCHOR_HP = 12;   // overload hits (an Arc Discharge round counts 4)

// Level 4's abilities: the Level 1 sampler's preview, kept for good
const WIRE_POWERS = {
  dex: { id: 'arc_round', name: 'ARC ROUND', desc: 'The last round of every burst arcs on to a Chromatic or box close by, for 10% more damage.',
         has: p => !!p.arcRound, apply: p => { p.arcRound = true; },
         hint: () => 'Hit a cable or a Chromatic next to a box and the arc jumps in.' },
  juno: { id: 'ricochet', name: 'RICOCHET', desc: 'Rounds bounce once off racks and cables.',
          has: p => (p.rackBounce || 0) > 0, apply: p => { p.rackBounce = (p.rackBounce || 0) + 1; },
          hint: () => 'Bounce shots off the cables to reach what you can\'t hit straight on.' },
};
const ESCAPE_ZAP = 10;   // damage from walking into a live wire (dashing through is safe)

// Level 3's thrown abilities: granted after its first section, kept as a card
// the first time it's cleared (STORY_CARDS has the Arcade versions)
const THROW_POWERS = {
  dex: { id: 'stun_grenade', name: 'STUN GRENADE', desc: 'Lob it over the racks: stuns and jams enemies, who take 50% more damage.',
         has: p => !!p.grenade, apply: p => { p.grenade = true; p.abilities.push('grenade'); },
         hint: touch => (touch ? 'Press its button and drag to where it should land.' : 'Press E to throw it at the cursor.') },
  juno: { id: 'decoy_beacon', name: 'DECOY BEACON', desc: 'Throw it over the racks: nearby Chromatics chase its light for 3 seconds.',
          has: p => !!p.decoy, apply: p => { p.decoy = true; p.abilities.push('decoy'); },
          hint: touch => (touch ? 'Press its button and drag to where it should land.' : 'Press E to throw it at the cursor.') },
};

// The Queue (Level 3's boss)
const QUEUE = { hp: 900, size: 38, speed: 34, contact: 14,
                ringEvery: 3.2, ringEveryLow: 2.4, windup: 0.6, ringSpeed: 120, ringMax: 560, ringDamage: 12,
                splits: [0.75, 0.5, 0.25], splitCount: 5 };
const HOLD = { r: 72, fill: 22 };   // ring radius, seconds to fill (it never drains)

// Level 2's dash abilities: granted after its first section, kept as a card
// the first time it's cleared (STORY_CARDS has the Arcade versions)
const DASH_POWERS = {
  dex: { id: 'shock_dash', name: 'SHOCK DASH', desc: 'Chromatics you dash through take a hit, freeze for almost 2 seconds, and take 50% more damage.',
         has: p => !!p.shockDash, apply: p => { p.shockDash = true; },
         hint: touch => (touch ? 'Tap DASH and go straight through them.' : 'Space or click to dash straight through them.') },
  juno: { id: 'parting_charge', name: 'PARTING CHARGE', desc: 'Dashing leaves a light bomb where you started. It bursts a moment later.',
          has: p => !!p.dashBomb, apply: p => { p.dashBomb = true; },
          hint: touch => (touch ? 'Tap DASH to leave one behind.' : 'Space or click to dash and leave one behind.') },
};

const VALVE_OPEN = 8;     // seconds a valve stays open once you step off
const TANK_HITS  = 2;     // dash-ability hits to crack a frozen tank

// What opening each level's door unlocks for keeps, per agent: the first
// power-up, as a card in that character's Arcade upgrade offers
export const LEVEL_CARDS = { 1: { dex: POWERUPS.dex[0], juno: POWERUPS.juno[0] }, 2: DASH_POWERS, 3: THROW_POWERS, 4: WIRE_POWERS, 5: SIG_POWERS };

// ── Helpers ───────────────────────────────────────────────────

function freeSpot(map, x, y, pad = 46) {
  const clear = (px, py) => px > 60 && py > 60 && px < CONFIG.map_width - 60 && py < CONFIG.map_height - 60 &&
    ![...map.obstacles, ...(map.noSpawn || [])].some(o => px + pad > o.x && px - pad < o.x + o.w && py + pad > o.y && py - pad < o.y + o.h);
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
  // from: { idx } restarts at a checkpoint beat (the earlier beats count as done)
  constructor(id, agent, api, from = null) {
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
    this.granted  = [];       // level abilities taken so far (kept for a checkpoint restart)
    this.checkpointIdx = null;    // the last checkpoint beat reached
    this._powerIdx = 0;
    this.charge = 0;          // emitter charge drawn from relays, 0..1
    this.motes  = [];         // essence flowing into the agent
    this._spawnDir = Math.random() * Math.PI * 2;
    this._layout();
    if (from) this._skipTo(from.idx);
    else this._next();
  }

  // Restart at a checkpoint: every beat before it is set up and marked done
  // (terminal full, mirrors turned, ...), then the checkpoint beat begins
  _skipTo(idx) {
    for (let i = 0; i < idx; i++) {
      this.idx = i;
      const b = this.beat;
      this._enter(b);
      if (b.type === 'hold') { this.hold.p = 1; this.charge = 1; }
      else if (b.type === 'beam') { for (const m of this.mirrors) m.ok = true; this._chainSaid = this.mirrors.length; }
      else if (b.type === 'drives') for (const d of this.drives) d.got = true;
      else if (b.type === 'freezers') for (const t of this.tanks) t.hp = 0;
      else if (b.type === 'relays') for (const r of this.relays) { r.done = true; r.charge = 1; }
      else if (b.type === 'servers') for (const s of this.servers) s.lit = true;
      else if (b.type === 'gather') for (const x of this.boxes) { x.open = true; x.got = true; }
      else if (b.type === 'tuning') this.dials.forEach((d, k) => { d.v = this.pattern[k]; });
      else if (b.type === 'overload') for (const a of this.anchors) a.hp = 0;
    }
    this.idx = idx - 1;
    this._next();
  }

  // Where things are on the map
  _layout() {
    const map = this.api.map();
    const W = CONFIG.map_width, H = CONFIG.map_height;
    const pts = this.def.points;
    if (pts) {
      const at = ([fx, fy], pad = 30) => freeSpot(map, W * fx, H * fy, pad);
      this.exitPos  = pts.lift ? at(pts.lift, 40) : pts.vault ? { x: W * pts.vault[0], y: H * pts.vault[1] } : map.playerSpawn();
      if (pts.terminal) this.terminalPos = at(pts.terminal, 40);
      if (pts.anchors) {
        this.corePos = { x: W * pts.core[0], y: H * pts.core[1] };
        this.anchorPos = pts.anchors.map(([fx, fy]) => ({ x: W * fx, y: H * fy }));
      }
      if (pts.boxes) {
        const raw = ([fx, fy]) => freeSpot(map, W * fx, H * fy, 12);
        this.boxPos = pts.boxes.map(raw);
        this.dialPos = pts.dials.map(raw);
        this.displayPos = { x: W * pts.display[0], y: H * pts.display[1] };
        this.exitPos = { x: W * pts.door[0], y: H * pts.door[1] };
        this.wires = pts.wires.map(([a, b, c, d]) => ({ x1: W * a, y1: H * b, x2: W * c, y2: H * d, side: 0 }));
      }
      if (pts.mirrors) {
        this.sourcePos = { x: W * pts.source[0], y: H * pts.source[1] };
        this.mirrorPos = pts.mirrors.map(([fx, fy], i) => ({ x: W * fx, y: H * fy, dead: { x: W * pts.dead[i][0], y: H * pts.dead[i][1] } }));
      }
      if (pts.valves) this.valvePos = pts.valves.map(v => at(v, 26));
      if (pts.tanks) this.tankPos = pts.tanks.map(v => at(v, 26));
      if (pts.drives) this.drivePos = pts.drives.map(([fx, fy]) => ({ x: W * fx, y: H * fy }));
      if (this.def.icy) this.cracks = this._makeCracks(W, H);
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
    if (b.checkpoint) { this.checkpointIdx = this.idx; this.checkpointLabel = b.checkpoint === true ? b.type : b.checkpoint; }
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
    } else if (b.type === 'drives') {
      if (!this.drives) this.drives = this.drivePos.map(p => ({ x: p.x, y: p.y, got: false }));
    } else if (b.type === 'freezers') {
      if (!this.tanks) this.tanks = this.tankPos.map(p => ({ x: p.x, y: p.y, hp: TANK_HITS, hitT: 0 }));
    } else if (b.type === 'hold') {
      if (!this.hold) this.hold = { ...this.terminalPos, p: 0, crowd: 0, said: false };
    } else if (b.type === 'beam') {
      // Every mirror starts turned the wrong way
      if (!this.mirrors) this.mirrors = this.mirrorPos.map(m => ({ ...m, ok: false, turnT: 0, ang: null }));
    } else if (b.type === 'gather') {
      if (!this.boxes) this.boxes = this.boxPos.map(p => ({ ...p, r: 13, open: false, got: false, piece: null, shieldT: 0 }));
    } else if (b.type === 'tuning') {
      if (!this.dials) {
        this.dials = this.dialPos.map(p => ({ ...p, r: 13, v: 0, hitT: 0, shieldT: 0 }));
        this.pattern = this.dials.map(() => 1 + Math.floor(Math.random() * 2));   // every dial needs turning
      }
    } else if (b.type === 'overload') {
      if (!this.anchors) this.anchors = this.anchorPos.map(p => ({ ...p, r: 16, hp: ANCHOR_HP, shieldT: 0, hitT: 0 }));
    } else if (b.type === 'hoarder') {
      this.boss = null; this.bossPhase = 0; this.bossWave = null; this.novas = [];
    } else if (b.type === 'escape') {
      this.escapeT = b.time; this.escapeMax = b.time; this.alarmT = 0;
      for (const w of this.wires) w.side = 0;
    } else if (b.type === 'boss') {
      this.rings = []; this.boss = null; this.ringT = 2; this.windT = 0; this.splitIdx = 0;
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
    this.granted.push(pu);
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
    // Health: from Level 2 on, a couple of Echoes appear near the agent after
    // each finished section (Level 1's come out of its relays)
    if (this.id > 1 && b.type !== 'exit' && b.type !== 'boss' && b.type !== 'escape') this._dropEchoes(2);
    // The level's ability (Level 2: a dash ability), unless they have it already
    const card = b.grant && (LEVEL_CARDS[this.id] || {})[this.agent];
    if (card && card.has && !card.has(this.api.player())) this.pendingPowerUp = card;
    if (b.type === 'exit') { this.complete = true; return; }
    // Level 5: the boss dying ends the level; the agent beams out where they stand
    if (this.def.endOnBoss && (b.type === 'hoarder' || b.type === 'boss')) {
      this.extractT = 0;
      const pl = this.api.player();
      pl.invincible = Math.max(pl.invincible, 2);
      return;
    }
    this._next();
  }

  update(dt) {
    this.t += dt;
    this.radio.update(dt);
    const pl = this.api.player();
    const b = this.beat;
    if (!b || this.complete) return;
    if (pl.hp <= 1 && !pl.beaming) { this.failed = true; return; }
    pl.onIce = !!this.def.icy;
    for (const tk of this.tanks || []) tk.hitT = Math.max(0, tk.hitT - dt);
    if (!this.ready) { if (!this.radio.busy && !pl.beaming) this.ready = true; else return; }

    if (this.extractT != null) { this._updateExtract(dt, pl); this._updateMotes(dt, pl); return; }
    // Beats with an interrupt setting keep Chromatics coming while you work
    // (Level 1's last stretch brings a swarm: not all of them need killing)
    const it = b.interrupt;
    if (it) this._interrupt(dt, it.cap, it.period, () => { const r = Math.random(); return r < (it.green || 0) ? 'green' : r < (it.green || 0) + (it.yellow || 0) ? 'yellow' : 'violet'; });
    if (b.type === 'wave') this._updateWave(dt, b);
    else if (b.type === 'drives') this._updateDrives(dt, b, pl);
    else if (b.type === 'freezers') this._updateFreezers(dt, b);
    else if (b.type === 'valves') this._updateValves(dt, b, pl);
    else if (b.type === 'hold') this._updateHold(dt, b, pl);
    else if (b.type === 'beam') this._updateBeam(dt, b, pl);
    else if (b.type === 'boss') this._updateBoss(dt, b, pl);
    else if (b.type === 'gather') this._updateGather(dt, b, pl);
    else if (b.type === 'tuning') this._updateTuning(dt, b);
    else if (b.type === 'escape') this._updateEscape(dt, b, pl);
    else if (b.type === 'overload') this._updateOverload(dt, b, pl);
    else if (b.type === 'hoarder') this._updateHoarder(dt, b, pl);
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
    // A scene after the level (game.js plays it, then sets outroDone)
    if (this.def.outro && !this.outroDone) { this.wantOutro = true; return; }
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

  // Drives: walk into each one (on the ice) to grab it
  _updateDrives(dt, b, pl) {
    for (const d of this.drives) {
      if (d.got || Math.hypot(pl.x - d.x, pl.y - d.y) > 22) continue;
      d.got = true;
      const n = this.drives.filter(x => x.got).length;
      sfxNode(n - 1);
      if (n < this.drives.length) { this.radio.clear(); this.radio.say(b.eachDone[n - 1] || []); }
      else { sfxRelayCharged(); this._finishBeat(); return; }
    }
  }

  // Frozen tanks: bullets do nothing; the dash abilities (dashpowers.js) hit
  // them through dashTargets. Done when every tank is cracked open.
  _updateFreezers(dt, b) {
    if (this.tanks.every(t => t.hp <= 0)) { sfxRelayCharged(); this._finishBeat(); }
  }

  // What the dash abilities can crack right now
  get dashTargets() {
    if (!this.tanks || !this.beat || this.beat.type !== 'freezers' || !this.ready) return null;
    return this.tanks.filter(t => t.hp > 0).map(t => ({ x: t.x, y: t.y, r: 16, hit: () => {
      if (t.hitT > 0 || t.hp <= 0) return;   // one hit per dash or burst
      t.hp--; t.hitT = 0.3;
      sfxIceCrack(t.hp <= 0);
    } }));
  }

  // ── Level 4: shielded targets ──
  // Junction boxes and dials ignore plain rounds (a dull spark), grenades,
  // beacons, dashes and walking. They react to an Arc Round jumping to them
  // (arcTargets, from enemies.js or onArcRack) or a round that has bounced.
  _shieldedTargets() {
    const b = this.beat;
    if (!b || !this.ready) return [];
    if (b.type === 'gather' && this.boxes) return this.boxes.filter(x => !x.open);
    if (b.type === 'tuning' && this.dials) return this.dials;
    return [];
  }
  _hitTarget(t) {
    const b = this.beat;
    if (b.type === 'gather') {
      if (t.open) return;
      t.open = true;
      t.piece = freeSpot(this.api.map(), t.x, t.y, 18);
      sfxNode(this.boxes.filter(x => x.open).length - 1);
    } else if (b.type === 'tuning') {
      if (t.hitT > 0) return;
      t.hitT = 0.25;
      t.v = (t.v + 1) % 3;
      sfxNode(t.v);
      if (this.dials.every((d, k) => d.v === this.pattern[k])) { sfxRelayCharged(); this._finishBeat(); }
    }
  }
  // What an Arc Round can jump to (enemies.js reads this through game.js)
  get arcTargets() {
    return this._shieldedTargets().map(t => ({ x: t.x, y: t.y, hit: () => this._hitTarget(t) }));
  }
  // Arc Rounds that hit a cable: the arc jumps to a target within reach
  onArcRack(hits) {
    const ts = this._shieldedTargets();
    for (const h of hits) {
      let best = null, bd = 130;
      for (const t of ts) { const d = Math.hypot(t.x - h.x, t.y - h.y); if (d < bd) { bd = d; best = t; } }
      if (!best) continue;
      this.api.enemies.zaps.push({ x1: h.x, y1: h.y, x2: best.x, y2: best.y, t: 0, seed: Math.floor(Math.random() * 1e5) });
      sfxShockDash();
      this._hitTarget(best);
    }
  }
  // Rounds that reach a target: a bounced one counts; anything else glances off
  _shotsOnTargets(ts) {
    const shots = this.api.projectiles ? this.api.projectiles().playerProjectiles : [];
    for (const p of shots) {
      for (const t of ts) {
        if (Math.hypot(p.x - t.x, p.y - t.y) > t.r + 3) continue;
        p.active = false;
        if (p.bounced) this._hitTarget(t);
        else { t.shieldT = 0.3; if (!this._shieldSfx || this.t - this._shieldSfx > 0.3) { this._shieldSfx = this.t; sfxNodeWrong(); } }
        break;
      }
    }
  }

  _updateGather(dt, b, pl) {
    for (const x of this.boxes) x.shieldT = Math.max(0, x.shieldT - dt);
    this._shotsOnTargets(this.boxes.filter(x => !x.open));
    for (const x of this.boxes) {
      if (!x.open || x.got || Math.hypot(pl.x - x.piece.x, pl.y - x.piece.y) > 24) continue;
      x.got = true;
      const n = this.boxes.filter(y => y.got).length;
      sfxRelayCharged();
      if (n < this.boxes.length) { this.radio.clear(); this.radio.say(b.eachDone[n - 1] || []); }
      else { this._finishBeat(); return; }
    }
  }

  _updateTuning(dt, b) {
    for (const d of this.dials) { d.hitT = Math.max(0, d.hitT - dt); d.shieldT = Math.max(0, d.shieldT - dt); }
    this._shotsOnTargets(this.dials);
  }

  // Escape: get to the far door before the timer runs out. The live wires
  // across the corridor zap and throw you back unless you're mid-dash
  // (untouchable); enemies keep coming. An alarm sounds the whole way.
  _updateEscape(dt, b, pl) {
    this.escapeT -= dt;
    this.alarmT -= dt;
    if (this.alarmT <= 0) { sfxAlarm(); this.alarmT = 1.1; }
    const r = pl.size / 2 + 4;
    for (const w of this.wires) {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = Math.hypot(dx, dy);
      const nx = -dy / L, ny = dx / L;
      const along = ((pl.x - w.x1) * dx + (pl.y - w.y1) * dy) / (L * L);
      const sd = (pl.x - w.x1) * nx + (pl.y - w.y1) * ny;   // signed distance across the wire
      if (along < 0 || along > 1) continue;
      if (Math.abs(sd) > r) { w.side = Math.sign(sd); continue; }
      if (pl.dashT > 0 || !w.side) continue;   // mid-dash: straight through
      // Zapped: thrown back to the side you came from
      pl.takeDamage(ESCAPE_ZAP);
      const push = w.side * (r + 10) - sd;
      pl.x += nx * push; pl.y += ny * push;
      w.zapT = 0.3;
      sfxShockDash();
    }
    for (const w of this.wires) w.zapT = Math.max(0, (w.zapT || 0) - dt);
    if (Math.hypot(pl.x - this.exitPos.x, pl.y - this.exitPos.y) < 34) { this._finishBeat(); return; }
    if (this.escapeT <= 0) { this.failed = true; this.failReason = 'escape'; }
  }

  // ── Level 5 ──
  // Anchors: plain rounds glance off; Arc Discharge rounds (4 each) and rounds
  // fired during Spin Up (1 each) crack them. F recharges twice as fast here.
  _updateOverload(dt, b, pl) {
    pl.signatureCooldown = Math.max(0, (pl.signatureCooldown || 0) - dt);
    for (const a of this.anchors) { a.shieldT = Math.max(0, a.shieldT - dt); a.hitT = Math.max(0, a.hitT - dt); }
    const live = this.anchors.filter(a => a.hp > 0);
    const shots = this.api.projectiles ? this.api.projectiles().playerProjectiles : [];
    for (const p of shots) {
      for (const a of live) {
        if (Math.hypot(p.x - a.x, p.y - a.y) > a.r + 3) continue;
        p.active = false;
        if (p.discharge || p.spun) {
          a.hp = Math.max(0, a.hp - (p.discharge ? 4 : 1)); a.hitT = 0.15;
          if (a.hp <= 0) {
            const n = this.anchors.filter(x => x.hp <= 0).length;
            sfxRelayCharged();
            if (n < this.anchors.length) { this.radio.clear(); this.radio.say(b.eachDone[n - 1] || []); }
          }
        } else { a.shieldT = 0.3; if (!this._shieldSfx || this.t - this._shieldSfx > 0.3) { this._shieldSfx = this.t; sfxNodeWrong(); } }
        break;
      }
    }
    if (this.anchors.every(a => a.hp <= 0)) this._finishBeat();
  }

  // The Signal Hoarder: blinks to a new spot every few seconds, leaving a
  // turret node where it was; it can't be hurt while any node stands. When it
  // reforms it fires two rings of slow rounds (dash through them). At 66% and
  // 33% it calls a wave of Chromatics, shielded until they're gone. When it
  // dies, everything left dissolves and the level ends.
  _updateHoarder(dt, b, pl) {
    const es = this.api.enemies;
    const map = this.api.map();
    if (!this.boss) {
      const sp = freeSpot(map, this.corePos.x, this.corePos.y - 190, 40);
      const e = es.spawnEnemyAt('green', sp.x, sp.y);
      e.boss = 'hoarder';
      e.cfg = { ...e.cfg, size: HOARDER.size };
      e.maxHp = e.hp = HOARDER.hp;
      e.contactDamage = HOARDER.contact;
      this.boss = e; this.blinkT = 2.5; this.volleyT = HOARDER.volleyEvery; this.nodes = [];
      return;
    }
    const q = this.boss;
    if (!q.isAlive) {
      for (const e of es.enemies) if (e.isAlive) { e.shielded = false; e.takeDamage(1e9); }
      this.novas = [];
      sfxRelayCharged();
      this._finishBeat();
      return;
    }
    this.nodes = this.nodes.filter(n => n.isAlive);
    // A wave between phases: shielded until it's cleared
    if (this.bossWave) {
      q.shielded = true;
      this.bossWave.groupT += dt;
      const alive = es.enemies.filter(e => e.isAlive && e !== q && !e.node).length;
      const W = this.bossWave;
      if (W.gi < W.groups.length && (W.gi === 0 || alive <= 2 || W.groupT > 7)) { this._spawnGroup(W.groups[W.gi]); W.gi++; W.groupT = 0; }
      if (W.gi >= W.groups.length && alive === 0) { this.bossWave = null; this._dropEchoes(2); }
      return;
    }
    q.shielded = this.nodes.length > 0;
    const frac = q.hp / q.maxHp;
    if (this.bossPhase < HOARDER.phases.length && frac <= HOARDER.phases[this.bossPhase]) {
      this.bossPhase++;
      this.radio.say(b.phase[this.bossPhase - 1] || []);
      this.bossWave = { gi: 0, groupT: 0, groups: this.bossPhase === 1
        ? [[['violet', 4], ['yellow', 1]], [['yellow', 2], ['violet', 2]]]
        : [[['green', 2], ['yellow', 2]], [['violet', 4], ['green', 1]], [['yellow', 3]]] };
      return;
    }
    // Blink: fade, leave a node behind, reform somewhere else and burst
    if (q.blink === 'fade') {
      q.blinkT -= dt;
      if (q.blinkT <= 0) {
        const n = es.spawnEnemyAt('green', q.x, q.y);
        n.node = true; n.spawnT = 0.2;
        this.nodes.push(n);
        for (let k = 1; k < this.bossPhase + 1 && this.nodes.length < 6; k++) {   // more nodes as it weakens
          const p2 = freeSpot(map, q.x + (k % 2 ? 70 : -70), q.y + 40, 20);
          const n2 = es.spawnEnemyAt('green', p2.x, p2.y); n2.node = true; this.nodes.push(n2);
        }
        q.x = q._to.x; q.y = q._to.y; q.spawnT = 0; q.blink = null;
        this.burstT = 0.5; this.burstLeft = 2;
        sfxQueueRing();
      }
    } else if (!q.forming) {
      this.blinkT -= dt;
      if (this.blinkT <= 0) {
        // Somewhere open, 200-320 px from the agent, clear of the cage
        let to = null;
        for (let k = 0; k < 30 && !to; k++) {
          const a = Math.random() * Math.PI * 2, d = 200 + Math.random() * 120;
          const p2 = freeSpot(map, pl.x + Math.cos(a) * d, pl.y + Math.sin(a) * d, 40);
          if (Math.hypot(p2.x - this.corePos.x, p2.y - this.corePos.y) > 90 && Math.hypot(p2.x - pl.x, p2.y - pl.y) > 160) to = p2;
        }
        if (to) { q._to = to; q.blink = 'fade'; q.blinkT = HOARDER.fade; }
        this.blinkT = frac < 0.5 ? HOARDER.blinkFast : HOARDER.blinkEvery;
      }
      // An aimed volley now and then
      this.volleyT -= dt;
      if (this.volleyT <= 0 && this.api.projectiles) {
        const a = Math.atan2(pl.y - q.y, pl.x - q.x);
        for (const o of [-0.15, 0, 0.15]) this.api.projectiles().spawnEnemy(q.x, q.y, a + o, 8, 170, 520, '#3dff7a');
        this.volleyT = HOARDER.volleyEvery;
      }
    }
    // The bursts after a blink: rings of slow rounds
    if (this.burstLeft > 0 && !q.forming) {
      this.burstT -= dt;
      if (this.burstT <= 0 && this.api.projectiles) {
        const off = this.burstLeft % 2 ? 0 : Math.PI / HOARDER.nova;
        for (let k = 0; k < HOARDER.nova; k++) this.api.projectiles().spawnEnemy(q.x, q.y, off + k / HOARDER.nova * Math.PI * 2, HOARDER.novaDamage, HOARDER.novaSpeed, 620, '#3dff7a');
        this.burstLeft--; this.burstT = 0.4;
      }
    }
  }
  // n Echoes on open floor a short walk from the agent
  _dropEchoes(n, near = null) {
    const pl = near || this.api.player(), map = this.api.map();
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * 2.4;
      const p = freeSpot(map, pl.x + Math.cos(a) * 110, pl.y + Math.sin(a) * 110, 22);
      this.api.spawnEcho(p.x, p.y);
    }
  }

  // Hold: stand in the terminal's ring while it pulls the signal. Any
  // Chromatic in the ring that isn't stunned pauses the pull (a decoy thrown
  // outside the ring pulls them out of it); it never drains. Chromatics keep
  // coming (the beat's interrupt).
  _updateHold(dt, b, pl) {
    const h = this.hold;
    const crowd = this.api.enemies.enemies.filter(e => e.isAlive && !e.forming && !(e.stunTimer > 0) &&
      Math.hypot(e.x - h.x, e.y - h.y) < HOLD.r).length;
    h.crowd = crowd;
    const inside = Math.hypot(pl.x - h.x, pl.y - h.y) < HOLD.r;
    this.charging = null;
    // Progress only ever goes up: a Chromatic in the ring pauses it, and you
    // can step out and come back without losing any (owner's rule)
    if (crowd === 0 && inside) {
      h.p = Math.min(1, h.p + dt / HOLD.fill);
      this.charging = h;
      if (Math.random() < dt * 18) this.motes.push({ x: h.x, y: h.y - 18, t: 0, s: Math.random() });
    }
    this.charge = h.p;
    if (!h.said && h.p >= 0.5) { h.said = true; this.radio.say(b.half || []); }
    if (h.p >= 1) { this.charging = null; sfxRelayCharged(); this._finishBeat(); }
  }

  // Beam: the thrown abilities turn the mirrors (onThrowLand). The beam runs
  // from the wall emitter through each mirror that's turned right; when it
  // reaches the vault, the vault opens. Abilities recharge twice as fast here.
  _updateBeam(dt, b, pl) {
    pl.grenadeCooldown = Math.max(0, (pl.grenadeCooldown || 0) - dt);
    pl.decoyCooldown   = Math.max(0, (pl.decoyCooldown || 0) - dt);
    for (const m of this.mirrors) m.turnT = Math.max(0, m.turnT - dt);
    if (this.mirrors.every(m => m.ok)) { sfxRelayCharged(); this._finishBeat(); }
  }

  // A thrown ability (grenade burst, beacon landing) came down at (x, y)
  onThrowLand(x, y) {
    const b = this.beat;
    if (!b || b.type !== 'beam' || !this.ready || !this.mirrors) return;
    const m = this.mirrors.find(mm => Math.hypot(mm.x - x, mm.y - y) < 52);
    if (!m || m.turnT > 0) return;
    m.ok = !m.ok; m.turnT = 0.4;
    const chain = this._beamChain();
    sfxNode(this.mirrors.indexOf(m));
    if (m.ok && chain < this.mirrors.length && chain > (this._chainSaid || 0)) {
      this._chainSaid = chain;
      this.radio.clear(); this.radio.say(b.eachDone[chain - 1] || []);
    }
  }

  // How many mirrors in a row, from the emitter, send the beam on correctly
  _beamChain() {
    let n = 0;
    while (n < this.mirrors.length && this.mirrors[n].ok) n++;
    return n;
  }

  // Boss: The Queue rises from the vault, drifts after the player and sends
  // out rings (a dash goes straight through: untouchable mid-dash). At 75%,
  // 50% and 25% health it splits off a ring of violets. When it dies,
  // everything left dissolves with it.
  _updateBoss(dt, b, pl) {
    const es = this.api.enemies;
    if (!this.boss) {
      const v = this.exitPos;
      const e = es.spawnEnemyAt('violet', v.x, v.y);
      e.boss = 'queue';
      e.cfg = { ...e.cfg, size: QUEUE.size, move_speed: QUEUE.speed };
      e.maxHp = e.hp = QUEUE.hp;
      e.contactDamage = QUEUE.contact;
      this.boss = e;
      return;
    }
    const q = this.boss;
    if (!q.isAlive) {
      for (const e of es.enemies) if (e.isAlive) e.takeDamage(1e9);
      this.rings = [];
      sfxRelayCharged();
      this._finishBeat();
      return;
    }
    // Splits
    const frac = q.hp / q.maxHp;
    if (this.splitIdx < QUEUE.splits.length && frac <= QUEUE.splits[this.splitIdx]) {
      this.splitIdx++;
      const map = this.api.map();
      for (let i = 0; i < QUEUE.splitCount; i++) {
        const a = i / QUEUE.splitCount * Math.PI * 2;
        const p = freeSpot(map, q.x + Math.cos(a) * 70, q.y + Math.sin(a) * 70, 20);
        es.spawnEnemyAt('violet', p.x, p.y);
      }
      if (this.splitIdx === 1) this.radio.say(b.split || []);
      this._dropEchoes(1);   // a little health each time it splits
    }
    // Rings: a short windup (it draws in), then a ring rolls outward
    if (!q.forming) {
      if (this.windT > 0) {
        this.windT -= dt;
        if (this.windT <= 0) { this.rings.push({ x: q.x, y: q.y, r: q.size, hit: false }); sfxQueueRing(); }
      } else {
        this.ringT -= dt;
        if (this.ringT <= 0) { this.windT = QUEUE.windup; this.ringT = frac < 0.5 ? QUEUE.ringEveryLow : QUEUE.ringEvery; }
      }
    }
    for (const r of this.rings) {
      r.r += QUEUE.ringSpeed * dt;
      const d = Math.hypot(pl.x - r.x, pl.y - r.y);
      if (!r.hit && Math.abs(d - r.r) < 6 + pl.size / 2) { r.hit = true; pl.takeDamage(QUEUE.ringDamage); }
    }
    this.rings = this.rings.filter(r => r.r < QUEUE.ringMax);
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
    const valvesOpen = this.valves ? this.valves.filter(v => v.open > 0).length : 0;
    const drives = this.drives ? this.drives.filter(d => d.got).length : 0;
    const tanks = this.tanks ? this.tanks.filter(t => t.hp <= 0).length : 0;
    const hold = this.hold ? Math.floor(this.hold.p * 100) : 0;
    const blocked = !!(this.hold && this.hold.crowd > 0 && b.type === 'hold');
    const mirrors = this.mirrors ? this._beamChain() : 0;
    const pieces = this.boxes ? this.boxes.filter(x => x.got).length : 0;
    const tuned = this.dials ? this.dials.filter((d, k) => d.v === this.pattern[k]).length : 0;
    const secs = this.escapeT != null ? Math.max(0, Math.ceil(this.escapeT)) : 0;
    const anchors = this.anchors ? this.anchors.filter(a => a.hp <= 0).length : 0;
    const shielded = !!(this.boss && this.boss.shielded);
    const bossWave = !!this.bossWave;
    const leftAdds = this.api.enemies.enemies.filter(e => e.isAlive && !e.boss && !e.node).length;
    return b.objective({ left: b.type === 'hoarder' ? leftAdds : left, done, servers, valvesOpen, drives, tanks, hold, blocked, mirrors, pieces, tuned, secs, anchors, shielded, bossWave });
  }

  // ── Drawing ─────────────────────────────────────────────────

  drawWorld(ctx) {
    const b = this.beat;
    const t = this.t;
    if (this.cracks) this._drawIce(ctx, t);
    if (this.relays || (b && b.type === 'relays')) {
      for (const r of (this.relays || this.relayPos.map(p => ({ ...p, charge: 0, done: false, drain: 0 })))) this._drawRelay(ctx, r, t);
    }
    if (this.seq) this._drawLock(ctx, t);
    if (this.def.exit === 'lift') this._drawLift(ctx, t, b && b.type === 'exit');
    else if (this.def.exit === 'vault') this._drawVault(ctx, t);
    else if (b && (b.type === 'exit' || b.type === 'escape')) this._drawExit(ctx, t);
    if (this.wires) this._drawWires(ctx, t, !!(b && b.type === 'escape'));
    if (this.boxPos) this._drawSwitchboard(ctx, t);
    if (this.terminalPos) this._drawTerminal(ctx, this.hold || { ...this.terminalPos, p: 0, crowd: 0 }, t, b && b.type === 'hold' && this.ready);
    if (this.rings) this._drawRings(ctx, t);
    if (this.valves || (b && b.type === 'valves')) {
      (this.valves || this.valvePos.map(p => ({ ...p, open: 0 }))).forEach((v, i) => this._drawValve(ctx, v, i, t));
    }
    if (this.drives) for (const d of this.drives) if (!d.got) this._drawDrive(ctx, d, t);
    if (this.tanks || (b && b.type === 'freezers')) {
      for (const tk of (this.tanks || this.tankPos.map(p => ({ ...p, hp: TANK_HITS, hitT: 0 })))) this._drawTank(ctx, tk, t);
    }
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

  // An icy floor: cracks scattered over the whole map, made once
  _makeCracks(W, H) {
    let sd = 4242;
    const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
    const out = [];
    for (let k = 0; k < 90; k++) {
      let x = rnd() * W, y = rnd() * H;
      const pts = [[x, y]];
      for (let j = 0; j < 3; j++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 22; pts.push([x, y]); }
      out.push(pts);
    }
    return out;
  }

  // The whole floor under a pale glassy sheet, with cracks and a slow glint
  // sweeping across now and then (soft, never a flash)
  _drawIce(ctx, t) {
    const W = CONFIG.map_width, H = CONFIG.map_height;
    ctx.save();
    ctx.fillStyle = 'rgba(170,215,255,0.10)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(220,240,255,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const c of this.cracks) { ctx.moveTo(c[0][0], c[0][1]); for (let j = 1; j < c.length; j++) ctx.lineTo(c[j][0], c[j][1]); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    const gx = ((t * 90) % (W + H + 400)) - 200;   // a diagonal glint
    const g = ctx.createLinearGradient(gx - 60, 0, gx + 60, 60);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(230,245,255,0.06)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Level 5: the anchors and their beams into the cage, Raze standing on the
  // core inside bars of hoarded light (they fall when the boss dies), and the
  // boss's shield and the tethers from its turret nodes
  _drawRazeRoom(ctx, t) {
    const c = this.corePos;
    const caged = !(this.extractT != null || this.complete);
    const gold = '#FFB52E';
    const anchors = this.anchors || this.anchorPos.map(p => ({ ...p, hp: ANCHOR_HP, shieldT: 0, hitT: 0 }));
    ctx.save();
    for (const a of anchors) {
      const x = Math.round(a.x), y = Math.round(a.y), live = a.hp > 0;
      ctx.globalCompositeOperation = 'lighter';
      if (live && caged) {   // the hoard flowing from the anchor into the cage
        ctx.strokeStyle = '#B98CFF'; ctx.globalAlpha = 0.2; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(c.x, c.y - 30); ctx.stroke();
        ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(c.x, c.y - 30); ctx.stroke();
        drawGlow(ctx, '#B98CFF', x, y - 18, 20, 0.35 + 0.1 * Math.sin(t * 2 + x));
      }
      if (a.shieldT > 0) { ctx.globalAlpha = a.shieldT / 0.3 * 0.6; ctx.strokeStyle = '#9AA4B0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y - 10, 18, 0, Math.PI * 2); ctx.stroke(); }
      if (a.hitT > 0) drawGlow(ctx, this.color, x, y - 12, 22, 0.5 * a.hitT / 0.15);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      // the pylon (pixel art), cracking as it takes hits
      ctx.fillStyle = '#060504'; ctx.fillRect(x - 8, y - 26, 16, 27);
      ctx.fillStyle = live ? '#2a2318' : '#141109'; ctx.fillRect(x - 7, y - 25, 14, 25);
      ctx.fillStyle = live ? '#6a5428' : '#2a2318'; ctx.fillRect(x - 7, y - 25, 14, 2);
      ctx.fillStyle = live ? '#B98CFF' : '#3a3040'; ctx.fillRect(x - 3, y - 20, 6, 6);
      const cracks = Math.round((1 - a.hp / ANCHOR_HP) * 5);
      ctx.fillStyle = '#FFE9C4';
      for (let k = 0; k < cracks && live; k++) ctx.fillRect(x - 6 + (k * 5) % 12, y - 12 + (k % 3) * 3, 2, 1);
    }
    // Raze on the core
    drawCharacterFrame(ctx, 'raze', 0, 1, c.x - 16, c.y - 52, 1);
    if (caged) {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#B98CFF', c.x, c.y - 30, 46, 0.25 + 0.08 * Math.sin(t * 1.6));
      ctx.strokeStyle = '#D9C2FF'; ctx.lineWidth = 2;
      for (let k = 0; k < 7; k++) {
        const bx = c.x - 24 + k * 8;
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 2 + k);
        ctx.beginPath(); ctx.moveTo(bx, c.y - 62); ctx.lineTo(bx, c.y - 6); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, gold, c.x, c.y - 26, 40, 0.3);
      ctx.globalCompositeOperation = 'source-over';
    }
    // The boss's shield, and tethers from its nodes
    const q = this.boss;
    if (q && q.isAlive && q.shielded) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 1;
      for (const n of this.nodes || []) { ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      ctx.globalAlpha = 0.5 + 0.15 * Math.sin(t * 2.5) + (q.shieldHitT ? 0.3 : 0);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(q.x, q.y - 6, q.size * 1.9, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  // Level 4: junction boxes (shut, glinting when a plain round glances off;
  // open, with Raze's memory beside them), the tuning dials and the display
  _drawSwitchboard(ctx, t) {
    const b = this.beat;
    const boxes = this.boxes || this.boxPos.map(p => ({ ...p, open: false, got: false, shieldT: 0 }));
    const gold = '#FFD15C';
    for (const x of boxes) {
      const px = Math.round(x.x), py = Math.round(x.y);
      const live = b && b.type === 'gather' && this.ready && !x.open;
      ctx.fillStyle = '#060809'; ctx.fillRect(px - 9, py - 11, 18, 16);
      ctx.fillStyle = x.open ? '#2a2f33' : '#3a3f44'; ctx.fillRect(px - 8, py - 10, 16, 14);
      ctx.fillStyle = '#b87333'; ctx.fillRect(px - 8, py - 10, 16, 2);
      ctx.fillStyle = x.open ? '#0c0e10' : (live ? gold : '#6a5020'); ctx.fillRect(px - 3, py - 5, 6, 5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (live) drawGlow(ctx, gold, px, py - 3, 16, 0.25 + 0.1 * Math.sin(t * 3 + px));
      if (x.shieldT > 0) {   // a plain round glancing off: a dull grey ring
        ctx.globalAlpha = x.shieldT / 0.3 * 0.6; ctx.strokeStyle = '#9AA4B0'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py - 3, 16, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      if (x.open && !x.got && x.piece) {
        const qx = Math.round(x.piece.x), qy = Math.round(x.piece.y + Math.sin(t * 3 + px) * 2);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, gold, qx, qy - 6, 18, 0.55);
        ctx.restore();
        ctx.fillStyle = gold; ctx.fillRect(qx - 2, qy - 10, 4, 8); ctx.fillRect(qx - 4, qy - 7, 8, 2);
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(qx - 1, qy - 9, 1, 2);
      }
    }
    // Dials and the display they match (the display lights each dial that's right)
    const dials = this.dials || this.dialPos.map(p => ({ ...p, v: 0, shieldT: 0 }));
    const pat = this.pattern || [0, 0, 0];
    const tuningLive = b && b.type === 'tuning' && this.ready;
    dials.forEach((d, k) => {
      const px = Math.round(d.x), py = Math.round(d.y);
      const right = this.pattern && d.v === pat[k];
      ctx.fillStyle = '#060809'; ctx.beginPath(); ctx.arc(px, py - 4, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a2f33'; ctx.beginPath(); ctx.arc(px, py - 4, 9, 0, Math.PI * 2); ctx.fill();
      const a = -Math.PI * 0.75 + d.v * Math.PI * 0.75;   // three positions
      ctx.strokeStyle = right ? this.color : '#ffd060'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py - 4); ctx.lineTo(px + Math.cos(a) * 7, py - 4 + Math.sin(a) * 7); ctx.stroke();
      ctx.fillStyle = '#b87333';
      for (let v = 0; v < 3; v++) { const aa = -Math.PI * 0.75 + v * Math.PI * 0.75; ctx.fillRect(Math.round(px + Math.cos(aa) * 10) - 1, Math.round(py - 4 + Math.sin(aa) * 10) - 1, 2, 2); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (tuningLive) drawGlow(ctx, right ? this.color : '#ffd060', px, py - 4, 18, right ? 0.4 : 0.2);
      if (d.shieldT > 0) { ctx.globalAlpha = d.shieldT / 0.3 * 0.6; ctx.strokeStyle = '#9AA4B0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py - 4, 15, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    });
    // The display: a board on legs showing the frequency each dial needs
    const D = this.displayPos, dx = Math.round(D.x), dy = Math.round(D.y);
    ctx.fillStyle = '#060809'; ctx.fillRect(dx - 34, dy - 30, 68, 30);
    ctx.fillStyle = '#16181b'; ctx.fillRect(dx - 32, dy - 28, 64, 26);
    ctx.fillStyle = '#3a3f44'; ctx.fillRect(dx - 30, dy, 4, 6); ctx.fillRect(dx + 26, dy, 4, 6);
    if (this.pattern) pat.forEach((v, k) => {
      const right = dials[k].v === v;
      const cx = dx - 20 + k * 20;
      ctx.fillStyle = right ? this.color : '#ffd060';
      for (let n = 0; n <= v; n++) ctx.fillRect(cx - 4, dy - 8 - n * 6, 8, 4);
      if (right) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, this.color, cx, dy - 14, 12, 0.35); ctx.restore(); }
    });
  }

  // Live wires across the escape corridor: dark cable on the floor until the
  // board overloads, then a crackling line of light (soft; arcs re-jag at a
  // readable rate, no flashing)
  _drawWires(ctx, t, live) {
    const tick = Math.floor(t / 0.12);
    ctx.save();
    for (const w of this.wires) {
      ctx.lineWidth = 3; ctx.strokeStyle = '#0c0e10';
      ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = live ? '#ffe9a0' : '#3a3f44';
      ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
      if (!live) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      ctx.strokeStyle = '#ffd060'; ctx.globalAlpha = 0.2 + (w.zapT ? 0.3 : 0); ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
      let s = tick * 31 + Math.round(w.x1 + w.y1);
      const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
      ctx.globalAlpha = 0.85; ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff2c0';
      ctx.beginPath(); ctx.moveTo(w.x1, w.y1);
      const n = Math.max(4, Math.round(L / 18));
      for (let k = 1; k < n; k++) { const o = rnd() * 10; ctx.lineTo(w.x1 + dx * k / n + nx * o, w.y1 + dy * k / n + ny * o); }
      ctx.lineTo(w.x2, w.y2); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // The terminal and its ring: a console on the floor; the ring fills in the
  // agent's colour as the signal is pulled, and dims amber while blocked
  _drawTerminal(ctx, h, t, live) {
    const x = Math.round(h.x), y = Math.round(h.y);
    const blocked = live && h.crowd > 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = blocked ? '#C07A2A' : live ? this.color : '#5A4A38';
    ctx.globalAlpha = live ? 0.55 : 0.3;
    ctx.beginPath(); ctx.ellipse(x, y, HOLD.r, HOLD.r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    if (h.p > 0) {
      ctx.lineWidth = 3; ctx.strokeStyle = this.color; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.ellipse(x, y, HOLD.r, HOLD.r * 0.55, 0, -Math.PI / 2, -Math.PI / 2 + h.p * Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.12 * h.p; ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.ellipse(x, y, HOLD.r, HOLD.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (live) drawGlow(ctx, blocked ? '#C07A2A' : this.color, x, y - 12, 26, 0.3 + 0.1 * Math.sin(t * 3));
    ctx.restore();
    // Console: pixel art
    ctx.fillStyle = '#0B0806'; ctx.fillRect(x - 11, y - 20, 22, 21);
    ctx.fillStyle = '#3E3226'; ctx.fillRect(x - 10, y - 19, 20, 19);
    ctx.fillStyle = '#7A644A'; ctx.fillRect(x - 10, y - 19, 20, 2);
    ctx.fillStyle = live ? '#1E3A2A' : '#1A1510'; ctx.fillRect(x - 7, y - 15, 14, 8);
    if (live) { ctx.fillStyle = this.color; ctx.fillRect(x - 6, y - 12, Math.round(12 * h.p), 2); }
    ctx.fillStyle = '#ffc46a'; ctx.fillRect(x - 6, y - 4, 2, 2); ctx.fillRect(x + 4, y - 4, 2, 2);
  }

  // The vault: a round hatch in the floor at the centre. Shut (bolted, dark)
  // until the beam reaches it; open, it's a pit of the agent's light
  _drawVault(ctx, t) {
    const v = this.exitPos;
    const x = Math.round(v.x), y = Math.round(v.y);
    const open = !!(this.mirrors && this.mirrors.every(m => m.ok));
    const exiting = this.beat && this.beat.type === 'exit';
    const R = 34;
    ctx.save();
    ctx.fillStyle = '#0B0806';
    ctx.beginPath(); ctx.ellipse(x, y, R + 3, (R + 3) * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = open ? '#050403' : '#3E3226';
    ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    if (!open) {
      ctx.strokeStyle = '#7A644A'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, R * 0.65, R * 0.65 * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#8A7256';
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(a) * R * 0.85) - 1, Math.round(y + Math.sin(a) * R * 0.85 * 0.55) - 1, 2, 2); }
      ctx.fillStyle = '#ffc46a'; ctx.fillRect(x - 2, y - 1, 4, 3);
    } else {
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.6 + 0.4 * Math.sin(t * 3);
      drawGlow(ctx, this.color, x, y, R * 1.4, (exiting ? 0.6 : 0.3) * pulse);
      ctx.globalAlpha = exiting ? 0.7 : 0.35;
      ctx.strokeStyle = this.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // The Queue's rings rolling outward, and its windup (a ring drawing in)
  _drawRings(ctx, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const a = 1 - r.r / QUEUE.ringMax;
      ctx.strokeStyle = '#8B5CFF';
      ctx.globalAlpha = 0.25 * a; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.8 * a; ctx.lineWidth = 2; ctx.strokeStyle = '#C4A8FF';
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    const q = this.boss;
    if (q && q.isAlive && this.windT > 0) {
      const k = 1 - this.windT / QUEUE.windup;
      ctx.globalAlpha = 0.6 * k; ctx.lineWidth = 2; ctx.strokeStyle = '#C4A8FF';
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size + 50 * (1 - k), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // The beam puzzle, drawn over the racks (the beam runs above them): the
  // emitter on the wall, the beam through each mirror turned right, out to a
  // dead spot from the first one turned wrong, and the mirrors themselves
  _drawBeam(ctx, t) {
    const mirrors = this.mirrors || this.mirrorPos.map(m => ({ ...m, ok: false, ang: null }));
    const live = !!this.mirrors;
    const H = 14;   // the beam runs this high above the floor
    const pts = [this.sourcePos];
    let end = null;
    if (live) {
      for (let i = 0; i < mirrors.length; i++) {
        pts.push(mirrors[i]);
        if (!mirrors[i].ok) { end = mirrors[i].dead; break; }
      }
      if (!end) end = this.exitPos;
      pts.push(end);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Emitter
    const s = this.sourcePos;
    drawGlow(ctx, '#FFD9A0', s.x, s.y - H, 18, live ? 0.6 : 0.2);
    // Beam segments
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      ctx.strokeStyle = '#FFB060'; ctx.globalAlpha = 0.16; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - H); ctx.lineTo(b.x, b.y - H); ctx.stroke();
      ctx.strokeStyle = '#FFE9C4'; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - H); ctx.lineTo(b.x, b.y - H); ctx.stroke();
    }
    if (live && end) drawGlow(ctx, end === this.exitPos ? this.color : '#FFB060', end.x, end.y - H, end === this.exitPos ? 30 : 12, 0.5);
    ctx.restore();
    // Mirrors: a pedestal with a pane of glass turned to bisect the beam
    mirrors.forEach((m, i) => {
      const prev = i === 0 ? this.sourcePos : mirrors[i - 1];
      const next = m.ok ? (mirrors[i + 1] || this.exitPos) : m.dead;
      const ain = Math.atan2(prev.y - m.y, prev.x - m.x), aout = Math.atan2(next.y - m.y, next.x - m.x);
      const want = Math.atan2(Math.sin(ain) + Math.sin(aout), Math.cos(ain) + Math.cos(aout)) + Math.PI / 2;
      if (m.ang == null) m.ang = want;
      let d = want - m.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
      m.ang += d * Math.min(1, 0.2);
      const x = Math.round(m.x), y = Math.round(m.y);
      ctx.fillStyle = '#0B0806'; ctx.fillRect(x - 5, y - 6, 10, 7);
      ctx.fillStyle = '#4E3F30'; ctx.fillRect(x - 4, y - 5, 8, 5);
      const cx = m.x, cy = m.y - H, L = 11;
      ctx.strokeStyle = '#0B0806'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx - Math.cos(m.ang) * L, cy - Math.sin(m.ang) * L * 0.6); ctx.lineTo(cx + Math.cos(m.ang) * L, cy + Math.sin(m.ang) * L * 0.6); ctx.stroke();
      ctx.strokeStyle = live && (i === 0 || mirrors.slice(0, i).every(mm => mm.ok)) ? '#FFF2DA' : '#9AA4B0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - Math.cos(m.ang) * L, cy - Math.sin(m.ang) * L * 0.6); ctx.lineTo(cx + Math.cos(m.ang) * L, cy + Math.sin(m.ang) * L * 0.6); ctx.stroke();
      if (live && this.beat && this.beat.type === 'beam' && !m.ok) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, this.color, m.x, m.y - 4, 22, 0.25 + 0.15 * Math.sin(t * 3 + i));
        ctx.restore();
      }
    });
  }

  // A frozen archive drive: a dark box with a blinking light, crusted in ice
  _drawDrive(ctx, d, t) {
    const x = Math.round(d.x), y = Math.round(d.y);
    const live = this.beat && this.beat.type === 'drives' && this.ready;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, '#9FE8FF', d.x, d.y, 22, live ? 0.35 + 0.15 * Math.sin(t * 3) : 0.15);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0B1018'; ctx.fillRect(x - 9, y - 7, 18, 14);
    ctx.fillStyle = '#26344C'; ctx.fillRect(x - 8, y - 6, 16, 12);
    ctx.fillStyle = '#3A4E70'; ctx.fillRect(x - 8, y - 6, 16, 2);
    ctx.fillStyle = Math.floor(t * 2.5) % 2 ? '#9FE8FF' : '#2A6A88'; ctx.fillRect(x + 3, y - 2, 2, 2);
    ctx.fillStyle = 'rgba(200,232,255,0.55)';
    for (let k = 0; k < 5; k++) ctx.fillRect(x - 8 + ((k * 5) % 15), y + 2 - (k % 2) * 6, 3, 1);
    ctx.restore();
  }

  // A frozen coolant tank: a block of ice around a steel cylinder; cracks
  // spread with each hit, and a cracked tank is shards and a little mist
  _drawTank(ctx, tk, t) {
    const x = Math.round(tk.x), y = Math.round(tk.y);
    const live = this.beat && this.beat.type === 'freezers' && this.ready;
    ctx.save();
    if (tk.hp <= 0) {
      ctx.fillStyle = '#26344C'; ctx.fillRect(x - 6, y - 8, 12, 14);
      ctx.fillStyle = 'rgba(200,232,255,0.6)';
      for (let k = 0; k < 7; k++) ctx.fillRect(x - 16 + ((k * 9) % 30), y + 4 + (k % 3) * 3, 3, 2);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, this.color, tk.x, tk.y - 4, 20, 0.35);
      ctx.restore();
      return;
    }
    if (live) {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#9FE8FF', tk.x, tk.y - 6, 30, 0.25 + 0.1 * Math.sin(t * 2.4) + (tk.hitT > 0 ? 0.3 : 0));
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = '#0B1018'; ctx.fillRect(x - 15, y - 26, 30, 34);                  // outline
    ctx.fillStyle = '#7FA8D0'; ctx.fillRect(x - 14, y - 25, 28, 32);                  // ice
    ctx.fillStyle = '#A8C8E8'; ctx.fillRect(x - 14, y - 25, 28, 3); ctx.fillRect(x - 14, y - 25, 3, 32);
    ctx.fillStyle = '#3A4E70'; ctx.fillRect(x - 6, y - 21, 12, 24);                   // the tank inside
    ctx.fillStyle = '#5A7096'; ctx.fillRect(x - 6, y - 21, 3, 24);
    ctx.fillStyle = 'rgba(220,240,255,0.5)'; ctx.fillRect(x + 7, y - 18, 2, 10);      // shine
    if (tk.hp < TANK_HITS) {                                                         // cracks
      ctx.strokeStyle = '#E8F6FF'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 20); ctx.lineTo(x - 2, y - 10); ctx.lineTo(x - 7, y - 2); ctx.lineTo(x + 2, y + 4);
      ctx.moveTo(x - 2, y - 10); ctx.lineTo(x + 9, y - 14);
      ctx.stroke();
    }
    ctx.restore();
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
    if (b.type === 'drives' && this.drives) return this.drives.filter(d => !d.got);
    if (b.type === 'freezers' && this.tanks) return this.tanks.filter(t => t.hp > 0);
    if (b.type === 'valves' && this.valves) return this.valves.filter(v => v.open <= 0);
    if (b.type === 'sequence') return [this.lockCenter];
    if (b.type === 'hold' && this.hold) return [this.hold];
    if (b.type === 'gather' && this.boxes) return this.boxes.filter(x => !x.got).map(x => (x.open ? x.piece : x));
    if (b.type === 'tuning' && this.dials) return this.dials.filter((d, k) => d.v !== this.pattern[k]);
    if (b.type === 'escape') return [this.exitPos];
    if (b.type === 'overload' && this.anchors) return this.anchors.filter(a => a.hp > 0);
    if (b.type === 'hoarder' && this.boss && this.boss.isAlive && !this.bossWave) return this.boss.shielded ? this.nodes : [this.boss];
    if (b.type === 'beam' && this.mirrors) { const n = this._beamChain(); return n < this.mirrors.length ? [this.mirrors[n]] : []; }
    if (b.type === 'exit') return [this.exitPos];
    return [];
  }

  // Drawn over the racks: the marker on each server (dim until woken, then a
  // beam of the agent's colour rising from it)
  drawOverRacks(ctx) {
    if (this.mirrorPos) this._drawBeam(ctx, this.t);
    if (this.corePos) this._drawRazeRoom(ctx, this.t);
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
    // Escape: a steady red edge that deepens as time runs out (no pulsing)
    if (this.beat && this.beat.type === 'escape' && this.escapeT != null) {
      const k = 1 - Math.max(0, this.escapeT) / this.escapeMax;
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(160,20,20,0)');
      g.addColorStop(1, `rgba(160,20,20,${(0.18 + 0.32 * k).toFixed(3)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // Keep comms clear of the Resonance / Emitter bars on narrow screens
    this.radio.draw(ctx, W, H, this.objective, touch, (W < 600 ? 100 : 96) + (this.relays || this.hold ? 22 : 0));
    // Boss health, under the objective
    const q = this.boss;
    const bt = this.beat && this.beat.type;
    if (q && q.isAlive && (bt === 'boss' || bt === 'hoarder')) {
      const hoard = bt === 'hoarder';
      const bw = Math.min(420, W - 60), bx = Math.round(W / 2 - bw / 2), by = (this.radio.objBottom || 40) + 8;
      ctx.save();
      ctx.fillStyle = 'rgba(7,11,18,0.8)'; ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
      ctx.fillStyle = hoard ? '#123a22' : '#2A1F48'; ctx.fillRect(bx, by, bw, 8);
      ctx.fillStyle = hoard ? (q.shielded ? '#5a6a60' : '#3dff7a') : '#8B5CFF'; ctx.fillRect(bx, by, Math.round(bw * q.hp / q.maxHp), 8);
      ctx.fillStyle = '#0B0806';
      for (const s of hoard ? HOARDER.phases : QUEUE.splits) ctx.fillRect(bx + Math.round(bw * s), by, 1, 8);
      ctx.fillStyle = hoard ? '#9dffc0' : '#C4A8FF'; ctx.font = `bold ${W < 600 ? 10 : 11}px monospace`; ctx.textAlign = 'center';
      ctx.fillText(hoard ? (q.shielded ? 'THE SIGNAL HOARDER  ·  SHIELDED' : 'THE SIGNAL HOARDER') : 'THE QUEUE', W / 2, by + 22);
      ctx.restore();
    }
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
    // Emitter charge, under that, once relays (or the terminal) have started
    if (this.relays || this.hold) {
      y = compact ? y + 6 : narrow ? 100 : 96;
      const bw = compact ? 120 : narrow ? 120 : 200;
      ctx.fillStyle = '#8A8E99';
      ctx.font = `${narrow || compact ? 9 : 11}px monospace`;
      ctx.fillText(this.hold ? 'SIGNAL PULLED' : 'EMITTER CHARGE', lx, y);
      ctx.fillStyle = '#1E2130';
      ctx.fillRect(lx, y + 5, bw, 5);
      ctx.fillStyle = this.color;
      ctx.fillRect(lx, y + 5, bw * this.charge, 5);
    }
    ctx.restore();
  }
}
