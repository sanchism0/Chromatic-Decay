// CHROMATIC DECAY — Player profile (Story progress, Chroma, unlocks)
//
// Kept in localStorage. Chroma is the colour drained from Chromatics in Story
// levels, banked per colour; it will buy skill-tree nodes in the Workshop.
// Clears are tracked per level per character. Opening Level 1's door the first
// time as a character unlocks their first power-up as an Arcade card.
// The player picks a name on first start; it, a random id, lifetime Chroma and
// Story progress feed the online leaderboards (leaderboard.js).

const KEY = 'chromatic_decay_profile';

const BLANK = () => ({
  chroma: { violet: 0, yellow: 0, green: 0, orange: 0, pink: 0 },
  clears: {},                       // { levelId: { dex: n, juno: n } } — times cleared
  signatures: {},                   // { dex: true } — unlocked signature abilities
  cards: {},                        // { dex: ['heavy_bursts'] } — Story cards for Arcade
  characters: { dex: true, juno: true, raze: false },
  seen: {},                         // { raze: true } once his NEW tag has been seen on the pick screen
  seenCards: [],                    // ['dex:shock_dash'] Story cards already offered in Arcade (NEW tags)
  player: { id: null, name: '' },   // leaderboard identity, one per device
  lifetime: 0,                      // Chroma ever earned, as one value (CHROMA_VALUE)
  best: {},                         // { desktop: n, mobile: n } — best Arcade score
  storyAt: 0,                       // when Story points last went up (ties: first there wins)
});

// Chroma as one number: rarer colours are worth ten times the last
export const CHROMA_VALUE = { violet: 1, yellow: 10, green: 100, orange: 1000, pink: 10000 };
export const chromaValue = counts => Object.entries(counts || {}).reduce((t, [c, n]) => t + (CHROMA_VALUE[c] || 0) * n, 0);

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
      _profile.player     = { ...BLANK().player, ...(raw.player || {}) };
      // Saves from before NEW tags: everything already earned counts as seen
      if (!raw.seenCards) _profile.seenCards = Object.entries(raw.cards || {}).flatMap(([who, ids]) => ids.map(id => `${who}:${id}`));
    }
  } catch (e) {}
  if (!_profile.player.id) {
    _profile.player.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    save();
  }
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
  p.lifetime = (p.lifetime || 0) + chromaValue(banked);
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
  if (first) p.storyAt = Date.now();
  const unlocks = [];
  // Clearing Level 5 (with anyone) brings Raze home: he joins as an agent
  if (+levelId === 5 && !p.characters.raze) { p.characters.raze = true; unlocks.push({ kind: 'agent', who: 'raze' }); }
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

// Raze is playable once he's been rescued (Level 5 cleared by anyone)
export function razeFree() {
  const p = profile();
  return !!p.characters.raze || Object.values(p.clears[5] || {}).some(n => n > 0);
}
export const seenNew = who => !!(profile().seen || {})[who];
export function markSeen(who) {
  const p = profile();
  if ((p.seen || (p.seen = {}))[who]) return;
  p.seen[who] = true;
  save();
}

// Story cards not yet offered in Arcade (they wear a NEW tag until they are)
export const cardSeen = (who, id) => (profile().seenCards || []).includes(`${who}:${id}`);
export function markCardsSeen(cards) {
  const p = profile();
  const list = p.seenCards || (p.seenCards = []);
  let changed = false;
  for (const c of cards) { const k = `${c.who}:${c.id}`; if (!list.includes(k)) { list.push(k); changed = true; } }
  if (changed) save();
}

export function levelUnlocked(levelId) {
  if (levelId === 1) return true;
  const prev = profile().clears[levelId - 1] || {};
  return Object.values(prev).some(n => n > 0);
}

// ── Leaderboard identity and stats ───────────────────────────
export const playerId   = () => profile().player.id;
export const playerName = () => profile().player.name || '';
export function setPlayerName(name) { profile().player.name = name; save(); }

// Story points: one per level cleared with each different character
export function storyStats() {
  const clears = profile().clears;
  let points = 0, furthest = 0;
  const agents = new Set();
  for (const [id, row] of Object.entries(clears)) {
    for (const [who, n] of Object.entries(row)) {
      if (n > 0) { points++; furthest = Math.max(furthest, +id); agents.add(who); }
    }
  }
  return { points, furthest, agents: ['dex', 'juno', 'raze'].filter(a => agents.has(a)).map(a => a[0]).join('') };
}

export const arcadeBest = platform => profile().best[platform] || 0;
export function recordArcadeScore(platform, score) {
  const p = profile();
  const prev = p.best[platform] || 0;
  if (score > prev) { p.best[platform] = score; save(); }
  return { prev, isBest: score > prev && score > 0 };
}
