// CHROMATIC DECAY — Player profile (Story progress, Chroma, unlocks)
//
// Kept in localStorage. Chroma is the colour drained from Chromatics in Story
// levels, banked per colour; it will buy skill-tree nodes in the Workshop.
// Clears are tracked per level per character. Opening Level 1's door the first
// time as a character unlocks their first power-up as an Arcade card.

const KEY = 'chromatic_decay_profile';

const BLANK = () => ({
  chroma: { violet: 0, yellow: 0, green: 0, orange: 0, pink: 0 },
  clears: {},                       // { levelId: { dex: n, juno: n } } — times cleared
  signatures: {},                   // { dex: true } — unlocked signature abilities
  cards: {},                        // { dex: ['heavy_bursts'] } — Story cards for Arcade
  characters: { dex: true, juno: true, raze: false },
});

let _profile = null;

export function profile() {
  if (_profile) return _profile;
  _profile = BLANK();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) {
      _profile = { ...BLANK(), ...raw };
      _profile.chroma     = { ...BLANK().chroma, ...(raw.chroma || {}) };
      _profile.characters = { ...BLANK().characters, ...(raw.characters || {}) };
    }
  } catch (e) {}
  return _profile;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(profile())); } catch (e) {}
}

export function bankChroma(counts, fraction = 1) {
  const p = profile();
  const banked = {};
  for (const [c, n] of Object.entries(counts)) {
    const add = Math.floor(n * fraction);
    if (add > 0) { p.chroma[c] = (p.chroma[c] || 0) + add; banked[c] = add; }
  }
  save();
  return banked;
}

export function timesCleared(levelId, who) {
  return (profile().clears[levelId] || {})[who] || 0;
}

// Record a clear; returns the unlocks this clear earned (first clears only)
export function recordClear(levelId, who) {
  const p = profile();
  const row = p.clears[levelId] || (p.clears[levelId] = {});
  const first = !row[who];
  row[who] = (row[who] || 0) + 1;
  const unlocks = [];
  save();
  return { first, unlocks };
}

export function hasSignature(who) { return !!profile().signatures[who]; }

export function unlockSignature(who) {
  profile().signatures[who] = true;
  save();
}

// Cards earned in Story; each joins that character's Arcade upgrade offers
export function hasCard(who, id) { return (profile().cards[who] || []).includes(id); }
export function unlockCard(who, id) {
  const p = profile();
  const list = p.cards[who] || (p.cards[who] = []);
  if (!list.includes(id)) list.push(id);
  save();
}

export function levelUnlocked(levelId) {
  if (levelId === 1) return true;
  const prev = profile().clears[levelId - 1] || {};
  return Object.values(prev).some(n => n > 0);
}
