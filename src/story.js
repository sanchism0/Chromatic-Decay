// CHROMATIC DECAY — Story Mode: Prologue
//
// 1. Intro scene   — Dex and Juno on one radio channel from two districts:
//                    former partners, rivals, maybe more. Then Null calls.
// 2. Who goes in?  — the player picks the agent (in the field); the other
//                    becomes the operator (on the line).
// 3. Tutorial      — the real game in the Basement, no waves. The operator
//                    talks the agent through moving, firing, the emitter,
//                    a first Chromatic, getting hit, and rescuing an Echo.
// 4. End card      — "Prologue complete".
//
// The game owns the world; this file owns the script and the order of
// events. game.js passes in an api object with the hooks it needs.

import { Dialogue, Radio } from './dialogue.js';

// ── Script ────────────────────────────────────────────────────

const INTRO = [
  { card: 'Ten years after the Collapse.' },
  { card: 'Nothing has colour unless it is still broadcasting. The Chromatics took the rest.' },
  { caption: 'TWO DISTRICTS APART  ·  ONE RADIO CHANNEL' },
  { who: 'juno', face: 'smirk',      text: "That's seventeen tonight, Dex. Plus an Echo I pulled out of a dryer, and Echoes count double." },
  { who: 'dex',  face: 'shocked',    text: "Since when? I'm on nineteen, and I didn't have to make up a rule to get there." },
  { who: 'juno', face: 'annoyed',    text: 'You hit the last one with a shopping cart.' },
  { who: 'dex',  face: 'cocky-grin', text: 'It unravelled, didn\'t it? A good tool is a good tool.' },
  { who: 'juno', face: 'soft-smile', text: "...It's strange. We used to run these side by side." },
  { who: 'dex',  face: 'neutral',    text: 'You were the one who wanted your own district.' },
  { who: 'juno', face: 'smirk',      text: "And you're the one who still calls every night to compare scores." },
  { who: 'dex',  face: 'laughing',   text: 'Somebody has to keep you honest.' },
  { caption: 'INCOMING  ·  PRIORITY SIGNAL' },
  { who: 'null', text: 'Dex. Juno. Stay on this channel.' },
  { who: 'dex',  face: 'worried',    text: '...Null? You never call.' },
  { who: 'null', text: "Something woke up in the Basement, under the old server farm. It's calling a name. Over and over." },
  { who: 'juno', face: 'focused',    text: 'Nobody has been down there in years. What name?' },
  { who: 'null', text: "Raze. The best shot I ever knew. They took him years ago, and I let myself believe he was gone." },
  { who: 'null', text: "If he's calling, he's still fighting. And if they finish him, they keep everything he knows." },
  { who: 'null', text: 'I need one of you to go in, and the other to stay on the line to keep them alive.' },
  { who: 'dex',  face: 'determined', text: "I'll go in. Tight corridors, lots to hit. That's my kind of room." },
  { who: 'juno', face: 'annoyed',    text: "It's a maze of signal. You need someone who can read it." },
  { who: 'null', text: "You've had this argument for three years. Settle it." },
];

// After the pick: operator (on the line) and agent (in the field)
const AFTER_PICK = {
  dex: [   // Dex goes in, Juno on the line
    { who: 'juno', face: 'smirk',      text: "Fine. You go in, I'll be in your ear. Just don't make me listen to you get hurt." },
    { who: 'dex',  face: 'cocky-grin', text: "Then keep talking. I'll keep moving." },
    { card: 'THE BASEMENT' },
  ],
  juno: [  // Juno goes in, Dex on the line
    { who: 'dex',  face: 'worried',    text: "Alright, you go in. I'll be the voice in your ear. Come back in one piece." },
    { who: 'juno', face: 'smirk',      text: 'Keep the singing to a minimum and I will.' },
    { card: 'THE BASEMENT' },
  ],
};

// Before Level 3: the agent rides the lift down to the Stacks while the
// operator keeps them company. Ten years of this, how it started, and why the
// colour matters. Keyed by the agent.
export const STACKS_INTRO = {
  dex: [   // Dex in the lift, Juno on the line
    { caption: 'THE LIFT DOWN  ·  ONE RADIO CHANNEL' },
    { who: 'juno', face: 'smirk',      text: "Lift's still going. Tell me you're not humming." },
    { who: 'dex',  face: 'cocky-grin', text: "I'm not humming. The lift is humming. I'm harmonising." },
    { who: 'juno', face: 'soft-smile', text: 'Ten years, and you still sing in elevators.' },
    { who: 'dex',  face: 'neutral',    text: "Ten years. Remember our first one? Behind the laundromat, the week the colour went." },
    { who: 'juno', face: 'laughing',   text: 'You hit it with a toaster.' },
    { who: 'dex',  face: 'laughing',   text: 'And it worked! A bit of green came off it and went straight into the laundromat sign. First lit window on the block.' },
    { who: 'juno', face: 'focused',    text: "That's still the job. Every Chromatic we unravel gives a little colour back. It's the only reason our districts are lit." },
    { who: 'dex',  face: 'determined', text: "And they keep coming back for it. Whatever stops broadcasting, they take, until it's all grey." },
    { who: 'juno', face: 'concerned',  text: "So don't go grey down there. I mean it." },
    { who: 'dex',  face: 'cocky-grin', text: 'Aw. You do care.' },
    { who: 'juno', face: 'annoyed',    text: 'I care about the scoreboard. You still owe me three from last week.' },
    { who: 'dex',  face: 'shocked',    text: 'Those were shared!' },
    { who: 'juno', face: 'smirk',      text: "Lift's stopping. Go be loud somewhere useful." },
    { card: 'THE STACKS' },
  ],
  juno: [  // Juno in the lift, Dex on the line
    { caption: 'THE LIFT DOWN  ·  ONE RADIO CHANNEL' },
    { who: 'dex',  face: 'neutral',    text: 'Lift still moving? Talk to me.' },
    { who: 'juno', face: 'smirk',      text: "It's playing music. Ten years of nothing working, and the elevator music made it." },
    { who: 'dex',  face: 'laughing',   text: "Tell me it's not the song from the laundromat." },
    { who: 'juno', face: 'soft-smile', text: "It's the song from the laundromat." },
    { who: 'dex',  face: 'cocky-grin', text: 'Our first one. You read its signal, I hit it with a toaster.' },
    { who: 'juno', face: 'laughing',   text: 'And a bit of green came loose and went right into the sign. You cried.' },
    { who: 'dex',  face: 'shocked',    text: 'I had something in my eye! It was colour. First colour anyone had seen in weeks.' },
    { who: 'juno', face: 'focused',    text: "It still is. Every Chromatic we unravel gives a little back. That's all that keeps our districts lit." },
    { who: 'dex',  face: 'worried',    text: "And down there's a whole tower of what they stole. They'll fight to keep it." },
    { who: 'juno', face: 'annoyed',    text: "You're worried." },
    { who: 'dex',  face: 'neutral',    text: "I'm always worried. I'm just louder about it when it's you." },
    { who: 'juno', face: 'soft-smile', text: '...Keep the channel open.' },
    { who: 'dex',  face: 'determined', text: 'Never closed it.' },
    { card: 'THE STACKS' },
  ],
};

// Before Level 4: scoreboard banter, until Null cuts in. He explains what
// they're collecting (Raze's memories, which the Chromatics have been taking
// from him for years) and why it matters. Keyed by the agent.
export const WIRE_INTRO = {
  dex: [   // Dex in the field, Juno on the line
    { caption: 'BEFORE THE WIRE ROOM  ·  ONE RADIO CHANNEL' },
    { who: 'dex',  face: 'cocky-grin', text: "Scoreboard check before the next room. I'm up four." },
    { who: 'juno', face: 'annoyed',    text: "You're counting The Queue as forty." },
    { who: 'dex',  face: 'laughing',   text: 'It WAS forty. It was a queue.' },
    { who: 'juno', face: 'smirk',      text: "That's not how queues work, Dex." },
    { who: 'dex',  face: 'cocky-grin', text: "That's exactly how queues w—" },
    { caption: 'INCOMING  ·  PRIORITY SIGNAL' },
    { who: 'null', text: 'Dex. Juno. Listen.' },
    { who: 'juno', face: 'alarmed',    text: '...Null. Twice in one week.' },
    { who: 'null', text: "What you pulled out of the Stacks was a memory. One of Raze's. They've kept him down there for years, draining him one memory at a time to feed the hoard." },
    { who: 'null', text: 'The rest are in the Wire Room, locked in the old switchboard. Bring them back.' },
    { who: 'dex',  face: 'worried',    text: 'And if we just go get him?' },
    { who: 'null', text: "Then you'll find a man who answers to his name and doesn't know who he is. And Raze doesn't miss." },
    { who: 'juno', face: 'focused',    text: 'Why him, Null? Out of everything down there.' },
    { who: 'null', text: 'Because he remembers the Collapse from the inside. Get his memories. Then get him.' },
    { who: 'dex',  face: 'determined', text: '...Okay. Scoreboard can wait.' },
    { who: 'juno', face: 'soft-smile', text: 'It really can\'t. You still owe me three.' },
    { card: 'WIRE ROOM' },
  ],
  juno: [  // Juno in the field, Dex on the line
    { caption: 'BEFORE THE WIRE ROOM  ·  ONE RADIO CHANNEL' },
    { who: 'juno', face: 'smirk',      text: "Scoreboard check before the next room. I'm up four." },
    { who: 'dex',  face: 'shocked',    text: 'You counted The Queue as one?' },
    { who: 'juno', face: 'focused',    text: 'It was one. A big one.' },
    { who: 'dex',  face: 'laughing',   text: 'It was forty! It was literally a queue of—' },
    { caption: 'INCOMING  ·  PRIORITY SIGNAL' },
    { who: 'null', text: 'Dex. Juno. Listen.' },
    { who: 'dex',  face: 'worried',    text: '...Null. Twice in one week.' },
    { who: 'null', text: "What you pulled out of the Stacks was a memory. One of Raze's. They've kept him down there for years, draining him one memory at a time to feed the hoard." },
    { who: 'null', text: 'The rest are in the Wire Room, locked in the old switchboard. Bring them back.' },
    { who: 'juno', face: 'concerned',  text: 'And if we just go get him?' },
    { who: 'null', text: "Then you'll find a man who answers to his name and doesn't know who he is. And Raze doesn't miss." },
    { who: 'dex',  face: 'neutral',    text: 'Why him, Null? Out of everything down there.' },
    { who: 'null', text: 'Because he remembers the Collapse from the inside. Get his memories. Then get him.' },
    { who: 'juno', face: 'focused',    text: 'Memories first. Then Raze.' },
    { who: 'dex',  face: 'cocky-grin', text: "And then the scoreboard. You're not getting away with 'one'." },
    { card: 'WIRE ROOM' },
  ],
};

// Scenes that open a level, by LEVELS[n].intro
export const INTROS = { stacks: STACKS_INTRO, wire: WIRE_INTRO };

// Tutorial: each step says its lines, then waits for its condition. A step
// moves on only once its condition is met AND the operator has finished
// talking, so nothing is said over the top of a fight. `spawnAfter` holds the
// enemies back until the briefing is over. Conditions get the stats and a
// snapshot of them from when the step began.
function tutorialSteps(agent, touch, api) {
  const op = agent === 'dex' ? 'juno' : 'dex';
  const f = (dexFace, junoFace) => (op === 'dex' ? dexFace : junoFace);
  const L = (face, text) => ({ who: op, face, text });
  return [
    { lines: [L(f('neutral', 'focused'), touch ? "Comms are up. Drag your left thumb to walk." : 'Comms are up. Walk around with W, A, S, D.')],
      objective: 'Walk around', until: (s, b) => s.moved - b.moved > 200 },
    { lines: [L(f('determined', 'focused'), touch ? 'Tap DASH to burst out of trouble. Nothing can touch you mid-dash.'
                                                  : 'Press Space or click to dash toward your cursor. Nothing can touch you mid-dash.')],
      objective: touch ? 'Dash (DASH button)' : 'Dash (Space or click)', until: (s, b) => s.dashes > b.dashes },
    { lines: [L(f('neutral', 'focused'), touch ? 'Your emitter fires on its own. Drag your right thumb to aim.' : 'Your emitter fires on its own. Aim with the mouse.')],
      objective: 'Fire your emitter', until: (s, b) => s.shots - b.shots >= 6 },
    { highlight: 'autofire',
      lines: [L(f('neutral', 'focused'), touch ? 'Tap AUTO to turn auto-fire off. Then it only fires while you hold the aim stick.'
                                               : 'Press Q to turn auto-fire off. Then it fires while you hold the mouse button.')],
      objective: touch ? 'Toggle auto-fire (AUTO button)' : 'Toggle auto-fire (Q)', until: (s, b) => s.toggles > b.toggles },
    { lines: [L(f('worried', 'alarmed'), 'Signal ahead. A violet. Take it out before it reaches you.')],
      spawnAfter: [['violet', 1]],
      objective: 'Destroy the violet Chromatic', until: (s, b) => s.kills - b.kills >= 1 },
    { lines: [L(f('neutral', 'soft-smile'), 'See that? Its colour came loose, and it came to you.')],
      until: () => true },
    { lines: [L(f('worried', 'concerned'), touch ? 'Two yellows. They lunge: when one lights up, get out of its line, or tap DASH.'
                                                 : 'Two yellows. They lunge: when one lights up, get out of its line, or dash.')],
      spawnAfter: [['yellow', 2]],
      objective: (s, b) => `Destroy the yellow Chromatics (${Math.min(2, s.kills - b.kills)}/2)`, until: (s, b) => s.kills - b.kills >= 2 },
    { echo: true, highlight: 'echo',
      lines: [L(f('shocked', 'alarmed'), "There's an Echo nearby, still holding on. I've marked it. Walk into it: Echoes heal you.")],
      objective: 'Find the Echo and walk into it', until: (s, b) => s.echoes > b.echoes },
    { lines: [L(f('laughing', 'soft-smile'), "Got it. One more Echo out of the dark."),
              L(f('worried', 'concerned'), "Raze is deeper in. That's who we came for. Be careful.")],
      until: () => true, end: true },
  ];
}

// Said once, the first time the agent gets hit in the tutorial
const FIRST_HIT = {
  dex:  { face: 'worried',   text: "That's your health dropping, top left. Don't let it hit zero." },
  juno: { face: 'concerned', text: "That's your health dropping, top left. Don't let it hit zero." },
};

// ── Director ──────────────────────────────────────────────────

export class StoryMode {
  constructor(api) {
    this.api = api;      // { touch(), openCharSelect(), startTutorialRun(agent), spawnNear(type, n), spawnEchoNear(), playerHurt(), autoFire(), endTutorial() }
    this.reset();
  }

  reset() {
    this.phase = null;   // 'intro' | 'pick' | 'after' | 'tutorial' | 'end'
    this.scene = null;
    this.radio = new Radio();
    this.agent = null;
    this.stepIdx = 0;
    this.stats = null;
    this.highlight = null;   // 'autofire' | 'echo' — what the HUD points at
    this.echoTarget = null;
    this._pendingSpawn = null;
    this._saidHit = false;
  }

  get active() { return this.phase !== null; }
  get inTutorial() { return this.phase === 'tutorial'; }

  start() {
    this.reset();
    this.phase = 'intro';
    this.scene = new Dialogue(INTRO, { juno: 'left', dex: 'right', null: 'left' });
  }

  // Called by the character select when story mode is picking
  picked(id) {
    this.agent = id;
    this.phase = 'after';
    const sides = id === 'dex' ? { juno: 'left', dex: 'right' } : { dex: 'left', juno: 'right' };
    this.scene = new Dialogue(AFTER_PICK[id], sides);
  }

  // A scene between levels (e.g. before Level 3), then onDone
  playInterlude(lines, sides, onDone) {
    this.phase = 'interlude';
    this.scene = new Dialogue(lines, sides);
    this._onInterludeDone = onDone;
  }
  _endInterlude() {
    this.phase = null; this.scene = null;
    const f = this._onInterludeDone; this._onInterludeDone = null;
    if (f) f();
  }

  skipScene() {
    if (!this.scene) return;
    if (this.phase === 'interlude') { this._endInterlude(); return; }
    if (this.phase === 'intro') { this.phase = 'pick'; this.scene = null; this.api.openCharSelect(); }
    else if (this.phase === 'after') this._beginTutorial();
  }

  // Scene phases (state STORY)
  updateScene(dt, pressed) {
    if (!this.scene) return;
    this.scene.update(dt, pressed);
    if (!this.scene.done) return;
    if (this.phase === 'interlude') { this._endInterlude(); return; }
    if (this.phase === 'intro') { this.phase = 'pick'; this.scene = null; this.api.openCharSelect(); }
    else if (this.phase === 'after') this._beginTutorial();
  }

  _beginTutorial() {
    this.scene = null;
    this.phase = 'tutorial';
    this.steps = tutorialSteps(this.agent, this.api.touch(), this.api);
    this.stepIdx = -1;
    this.stats = { moved: 0, shots: 0, kills: 0, echoes: 0, toggles: 0, dashes: 0 };
    this.api.startTutorialRun(this.agent);
    this._nextStep();
  }

  _nextStep() {
    this.stepIdx++;
    const st = this.steps[this.stepIdx];
    if (!st) return;
    this.base = { ...this.stats };
    this.highlight = st.highlight || null;
    this._pendingSpawn = st.spawnAfter || null;
    if (st.echo) this.echoTarget = this.api.spawnEchoNear();
    this.radio.say(typeof st.lines === 'function' ? st.lines() : st.lines);
  }

  get objective() {
    const st = this.steps?.[this.stepIdx];
    if (!st || !st.objective) return null;
    return typeof st.objective === 'function' ? st.objective(this.stats, this.base) : st.objective;
  }

  // Hooks from the game loop
  onMoved(d)  { if (this.stats) this.stats.moved += d; }
  onShot()    { if (this.stats) this.stats.shots++; }
  onKill()    { if (this.stats) this.stats.kills++; }
  onEcho()    { if (this.stats) this.stats.echoes++; }
  onToggleFire() { if (this.stats) this.stats.toggles++; }
  onDash()       { if (this.stats) this.stats.dashes++; }
  onHit() {
    if (!this.inTutorial || this._saidHit) return;
    this._saidHit = true;
    const op = this.agent === 'dex' ? 'juno' : 'dex';
    this.radio.say([{ who: op, ...FIRST_HIT[op] }]);
  }

  updateTutorial(dt) {
    this.radio.update(dt);
    const st = this.steps[this.stepIdx];
    if (!st) return;
    // Enemies wait until the briefing is over
    if (this._pendingSpawn && !this.radio.busy) {
      for (const [type, n] of this._pendingSpawn) this.api.spawnNear(type, n);
      this._pendingSpawn = null;
    }
    if (this._pendingSpawn || this.radio.busy) return;
    if (st.until(this.stats, this.base)) {
      if (st.end) { this.phase = 'end'; this.highlight = null; this.api.endTutorial(); return; }
      this._nextStep();
    }
  }

  drawScene(ctx, W, H, t) {
    // Backdrop: the dark, with stolen colour drifting through it
    ctx.fillStyle = '#07080b';
    ctx.fillRect(0, 0, W, H);
    const cols = ['82,0,255', '233,255,106', '141,255,106', '253,108,29', '248,29,120'];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 137.5 + t * (8 + i % 5) * 3) % (W + 200)) - 100;
      const y = (H * 0.15) + ((i * 89) % (H * 0.6)) + Math.sin(t * 0.5 + i) * 18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 40 + (i % 3) * 18);
      g.addColorStop(0, `rgba(${cols[i % 5]},0.10)`);
      g.addColorStop(1, `rgba(${cols[i % 5]},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - 80, y - 80, 160, 160);
    }
    ctx.restore();

    // Null's call washes the scene in white light
    const l = this.scene?.line;
    if (l && l.who === 'null') {
      const g = ctx.createRadialGradient(W * 0.3, H * 0.5, 0, W * 0.3, H * 0.5, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(232,240,255,0.07)');
      g.addColorStop(1, 'rgba(232,240,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    const cap = this.scene?.caption;
    if (cap && !(l && l.card)) {
      ctx.fillStyle = '#5E8C96'; ctx.font = `${W < 600 ? 11 : 13}px monospace`; ctx.textAlign = 'left';
      ctx.fillText(cap, 18, 32);
    }
    this.scene?.draw(ctx, W, H, this.api.touch());
  }

  drawTutorialHud(ctx, W, H) {
    if (this.phase !== 'tutorial') return;
    this.radio.draw(ctx, W, H, this.objective, this.api.touch());
  }
}
