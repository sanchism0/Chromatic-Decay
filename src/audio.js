// CHROMATIC DECAY — Audio System (Web Audio API)
//
// Design language:
//   NEGATIVE  — ambient world, enemy presence, player damage: dissonant, decaying
//   POSITIVE  — player actions, kills, progress: resolving, crisp, ascending

let _ctx = null;

function _ac() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Utilities ─────────────────────────────────────────────────

function _osc(type, freq, t, duration, peak, freqEnd = null) {
  const ctx  = _ac();
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.01);
}

function _noise(t, duration, peak, filterFreq, filterQ = 1.5) {
  const ctx     = _ac();
  const bufSize = Math.ceil(ctx.sampleRate * duration);
  const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data    = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const source  = ctx.createBufferSource();
  source.buffer = buffer;
  const filter  = ctx.createBiquadFilter();
  filter.type            = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value         = filterQ;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(t);
  source.stop(t + duration + 0.01);
}

// ── Ambient hum (negative — dissonant detuned drone) ──────────

let _ambientNodes = null;

export function startAmbient() {
  if (_ambientNodes) return;
  const ctx = _ac();

  // Two sawtooth waves a semitone apart — creates uneasy beating
  const osc1   = ctx.createOscillator();
  const osc2   = ctx.createOscillator();
  const sub    = ctx.createOscillator();
  osc1.type    = 'sawtooth';
  osc2.type    = 'sawtooth';
  sub.type     = 'sine';
  osc1.frequency.value = 55;    // A1
  osc2.frequency.value = 58.3;  // slightly sharp — beats against osc1
  sub.frequency.value  = 27.5;  // A0 sub rumble

  const lpf = ctx.createBiquadFilter();
  lpf.type            = 'lowpass';
  lpf.frequency.value = 180;
  lpf.Q.value         = 0.8;

  const g1  = ctx.createGain(); g1.gain.value  = 0.055;
  const g2  = ctx.createGain(); g2.gain.value  = 0.055;
  const g3  = ctx.createGain(); g3.gain.value  = 0.035;
  const out = ctx.createGain(); out.gain.value = 0.55;

  osc1.connect(g1); g1.connect(lpf);
  osc2.connect(g2); g2.connect(lpf);
  sub.connect(g3);  g3.connect(out);
  lpf.connect(out);
  out.connect(ctx.destination);

  osc1.start(); osc2.start(); sub.start();
  _ambientNodes = { osc1, osc2, sub, out };
}

export function stopAmbient() {
  if (!_ambientNodes) return;
  const { osc1, osc2, sub } = _ambientNodes;
  try { osc1.stop(); osc2.stop(); sub.stop(); } catch (_) {}
  _ambientNodes = null;
}

// ── Player shoot — the Pulse Emitter (positive) ───────────────
// Each operator's emitter has its own voice: Dex's salvaged magnetron rig
// goes "PEW" with an electric buzz; Juno's tuned antenna coil rings like glass.

export function sfxShoot(overload = false, character = 'dex') {
  if (character === 'juno') _shotGlass(overload);
  else                      _shotPew(overload);
}

// Dex — "Electric pew": two slightly detuned sawtooths swooping down fast,
// a fast pitch wobble for the electric buzz, a sizzle on top and a filter
// that closes as it falls. Each shot starts at a slightly different pitch.
// Overload shots are lower and longer.
function _shotPew(overload) {
  const ctx = _ac();
  const t   = ctx.currentTime + 0.002;
  const f0  = (overload ? 1150 : 1900) * (0.95 + Math.random() * 0.1);
  const f1  = overload ? 160 : 280;
  const dur = overload ? 0.18 : 0.12;
  const out = ctx.createGain();
  out.gain.value = overload ? 0.8 : 0.6;
  out.connect(ctx.destination);

  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
  lp.frequency.setValueAtTime(6500, t); lp.frequency.exponentialRampToValueAtTime(900, t + dur);
  lp.connect(out);

  // Buzz: a fast square LFO wobbling both oscillators' pitch
  const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
  lfo.type = 'square'; lfo.frequency.value = overload ? 55 : 70;
  lfoGain.gain.value = overload ? 90 : 120;
  lfo.connect(lfoGain); lfo.start(t); lfo.stop(t + dur + 0.02);

  for (const [det, peak] of [[1, 0.05], [1.012, 0.04]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * det, t);
    o.frequency.exponentialRampToValueAtTime(f1 * det, t + dur * 0.9);
    lfoGain.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(lp);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Sizzle: a short band of high noise riding the start
  const len = Math.ceil(ctx.sampleRate * 0.05);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 2;
  const sg  = ctx.createGain(); sg.gain.value = 0.045;
  src.connect(bp); bp.connect(sg); sg.connect(out);
  src.start(t); src.stop(t + 0.06);

  // A little weight underneath
  _thump(ctx, out, t, overload ? 150 : 220, overload ? 60 : 90, overload ? 0.05 : 0.03, 0.06);
  setTimeout(() => out.disconnect(), 500);
}

function _thump(ctx, out, t, f0, f1, peak, dur) {
  const b = ctx.createOscillator(), bg = ctx.createGain();
  b.type = 'sine';
  b.frequency.setValueAtTime(f0, t);
  b.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
  bg.gain.setValueAtTime(0.0001, t);
  bg.gain.linearRampToValueAtTime(peak, t + 0.004);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  b.connect(bg); bg.connect(out);
  b.start(t); b.stop(t + dur + 0.02);
}

// Juno — "Glass ping": a short breath of air, then two sines a fifth apart
// that ring briefly with a small drop, over a light body — like tapping
// glass. Each shot steps through a small A5 pentatonic run with slight
// random detune, so steady fire shimmers instead of ticking. Overload shots
// are an octave lower and ring longer.

const _PULSE_NOTES = [880, 988, 1109, 1319, 1480, 1319, 1109, 988];   // A5 pentatonic, up and back
let _pulseStep = 0;

function _shotGlass(overload) {
  const ctx  = _ac();
  const t    = ctx.currentTime + 0.002;
  const f    = _PULSE_NOTES[_pulseStep++ % _PULSE_NOTES.length] * (overload ? 0.5 : 1)
             * Math.pow(2, (Math.random() - 0.5) * 0.06);              // ±~35 cents
  const out  = ctx.createGain();
  out.gain.value = overload ? 0.95 : 0.75;
  out.connect(ctx.destination);

  // Breath: 18 ms of soft high noise, swelling and fading
  const len = Math.ceil(ctx.sampleRate * 0.018);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6000; bp.Q.value = 0.7;
  const ng  = ctx.createGain(); ng.gain.value = 0.035;
  src.connect(bp); bp.connect(ng); ng.connect(out);
  src.start(t); src.stop(t + 0.03);

  // Two sines a fifth apart, dropping slightly, ringing out
  const ring = (freq, start, dur, peak) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, start);
    o.frequency.exponentialRampToValueAtTime(freq * 0.85, start + 0.05);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(out);
    o.start(start); o.stop(start + dur + 0.02);
  };
  ring(f,       t,         overload ? 0.20 : 0.14, 0.07);
  ring(f * 1.5, t + 0.004, overload ? 0.16 : 0.10, 0.035);

  // Light body
  _thump(ctx, out, t, overload ? 160 : 240, overload ? 90 : 140, overload ? 0.04 : 0.02, 0.05);

  setTimeout(() => out.disconnect(), 500);
}

// ── Enemy kill (positive — ascending 2-note resolve per type) ─

const _KILL_PITCHES = {
  violet: [196, 294],   // G3→D4 — low, warm
  yellow: [440, 660],   // A4→E5 — bright, mid
  green:  [523, 784],   // C5→G5 — sharp, clean
  orange: [330, 494],   // E4→B4 — punchy, mid-low
  pink:   [165, 330],   // E3→E4 — deep, dramatic (boss)
};

export function sfxEnemyKill(type = 'violet') {
  const ctx = _ac();
  const t   = ctx.currentTime;
  const [f1, f2] = _KILL_PITCHES[type] || _KILL_PITCHES.violet;
  _osc('triangle', f1, t,        0.09, 0.13);
  _osc('triangle', f2, t + 0.07, 0.1,  0.11);
}

// ── Player hit (negative — noise burst + pitch-drop) ──────────

export function sfxPlayerHit() {
  const ctx = _ac();
  const t   = ctx.currentTime;
  // Harsh noise band
  _noise(t, 0.14, 0.28, 380, 2.0);
  // Descending tone — signal degrading
  _osc('sawtooth', 210, t, 0.22, 0.18, 55);
}

// ── Wave clear (positive — ascending major chord) ─────────────

export function sfxWaveClear() {
  const ctx   = _ac();
  const t     = ctx.currentTime;
  const notes = [261.6, 329.6, 392, 523.2]; // C4 E4 G4 C5
  notes.forEach((f, i) => _osc('sine', f, t + i * 0.09, 0.55, 0.11));
}

// ── Fragment pickup (positive — full restoration arpeggio) ────

export function sfxFragmentPickup() {
  const ctx   = _ac();
  const t     = ctx.currentTime;
  const run   = [261.6, 329.6, 392, 523.2, 659.3, 784]; // C major run
  run.forEach((f, i) => _osc('sine', f, t + i * 0.065, 0.38, 0.12));
  // Held resolution chord underneath
  [261.6, 392, 523.2].forEach(f => _osc('sine', f, t + 0.35, 0.9, 0.07));
}

// ── Title screen music ────────────────────────────────────────
// Sparse arpeggiated melody over a dark pad — melancholic, digital

let _titleNodes = null;

export function startTitleMusic() {
  if (_titleNodes) return;
  const ctx = _ac();

  // Dark pad — two detuned sine waves, low and slow
  const pad1 = ctx.createOscillator();
  const pad2 = ctx.createOscillator();
  pad1.type = 'sine'; pad1.frequency.value = 110;   // A2
  pad2.type = 'sine'; pad2.frequency.value = 146.8; // D3 — a fourth above, slightly melancholic
  const padGain = ctx.createGain();
  padGain.gain.value = 0.06;
  pad1.connect(padGain); pad2.connect(padGain);

  // Slow LFO tremolo on pad
  const lfo     = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type            = 'sine';
  lfo.frequency.value = 0.3; // very slow pulse
  lfoGain.gain.value  = 0.03;
  lfo.connect(lfoGain);
  lfoGain.connect(padGain.gain);

  padGain.connect(ctx.destination);
  pad1.start(); pad2.start(); lfo.start();

  // Arpeggiated melody — sparse notes on a loop
  // A minor pentatonic: A3 C4 E4 G4 A4
  const melody = [220, 261.6, 329.6, 392, 440, 392, 329.6, 261.6];
  const noteLen = 1.1; // seconds between notes
  let noteIdx = 0;
  let stopped = false;

  function scheduleNote() {
    if (stopped) return;
    const t    = ctx.currentTime;
    const freq = melody[noteIdx % melody.length];
    noteIdx++;

    // Skip some notes randomly for sparseness
    if (Math.random() > 0.35) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.09, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.7);
    }

    setTimeout(scheduleNote, noteLen * 1000);
  }

  scheduleNote();

  _titleNodes = {
    pad1, pad2, lfo,
    stop() { stopped = true; try { pad1.stop(); pad2.stop(); lfo.stop(); } catch(_) {} }
  };
}

export function stopTitleMusic() {
  if (!_titleNodes) return;
  _titleNodes.stop();
  _titleNodes = null;
}

// ── Wave timer warning @ 10s (urgent but not negative) ────────

export function sfxTimerWarning() {
  const ctx = _ac();
  const t   = ctx.currentTime;
  // Two sharp pulses — attention-grabbing
  _osc('square', 880,  t,        0.07, 0.10);
  _osc('square', 1100, t + 0.12, 0.07, 0.10);
}

// ── Countdown ticks 5→1 (pitch rises as time runs out) ────────

export function sfxCountdownTick(n) {
  const ctx  = _ac();
  const t    = ctx.currentTime;
  const freqs = { 5: 440, 4: 494, 3: 554, 2: 622, 1: 880 };
  const freq  = freqs[n] || 440;
  const peak  = n === 1 ? 0.20 : 0.12;
  _osc('square', freq, t, 0.07, peak);
}

// ── Resume after user gesture (call on first input) ───────────

export function resumeAudio() {
  if (_ctx && _ctx.state === 'suspended') _ctx.resume();
}
