// CHROMATIC DECAY — Leaderboards
//
// Six boards, cycled with arrows (desktop) or a swipe (touch):
//   ARCADE · DESKTOP / MOBILE        best runs of all time, per platform
//   THIS WEEK · DESKTOP / MOBILE     the same, since Monday 00:00 UTC
//   STORY PROGRESS                   a point per level cleared with each character
//   LIFETIME CHROMA                  every bit of colour ever drained, as one value
// Arcade runs are rows in the Supabase `scores` table; Story and Chroma come
// from one `players` row per device (id + name), kept up to date as you play.
// If the database can't be reached, Arcade boards fall back to this device's
// own runs and the board says it's offline.

import { profile, playerId, playerName, storyStats } from './profile.js';
import { AGENT_COLOR } from './level.js';

const SB_URL  = 'https://kzjvbygxtnyedrfeqmmt.supabase.co';
const SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6anZieWd4dG55ZWRyZmVxbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTE1NjQsImV4cCI6MjA5MTI4NzU2NH0.NXCqGSO4uuCXYDQfw2rgtXGiEDxk0kRTt-iaMG6aUmE';
const HEADERS = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };

export const PLATFORM = 'ontouchstart' in window ? 'mobile' : 'desktop';

export const BOARDS = [
  { id: 'arcade-desktop', title: 'ARCADE · DESKTOP',    kind: 'arcade', platform: 'desktop' },
  { id: 'arcade-mobile',  title: 'ARCADE · MOBILE',     kind: 'arcade', platform: 'mobile' },
  { id: 'week-desktop',   title: 'THIS WEEK · DESKTOP', kind: 'arcade', platform: 'desktop', weekly: true },
  { id: 'week-mobile',    title: 'THIS WEEK · MOBILE',  kind: 'arcade', platform: 'mobile',  weekly: true },
  { id: 'story',          title: 'STORY PROGRESS',      kind: 'story' },
  { id: 'chroma',         title: 'LIFETIME CHROMA',     kind: 'chroma' },
];

// Start on your own platform's Arcade board
let _idx = PLATFORM === 'mobile' ? 1 : 0;
const _cache = {};   // board id → { rows, status: 'loading' | 'ok' | 'offline', at }

export const currentBoard = () => BOARDS[_idx];
// Back to your own platform's Arcade board (each time the title screen opens)
export function resetBoard() { _idx = PLATFORM === 'mobile' ? 1 : 0; }
export function cycleBoard(step) {
  _idx = (_idx + step + BOARDS.length) % BOARDS.length;
  refreshBoard();
}

// Monday 00:00 UTC of this week
function weekStart() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString();
}

async function sb(path, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    return await fetch(`${SB_URL}/rest/v1/${path}`, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) }, signal: ctl.signal });
  } finally { clearTimeout(timer); }
}

// ── This device's own runs (offline fallback) ────────────────

function localScores() {
  try { return JSON.parse(localStorage.getItem('chromatic_decay_scores') || '[]'); } catch { return []; }
}
function saveLocalScore(entry) {
  const list = localScores();
  list.push({ ...entry, created_at: new Date().toISOString() });
  list.sort((a, b) => b.score - a.score);
  try { localStorage.setItem('chromatic_decay_scores', JSON.stringify(list.slice(0, 50))); } catch {}
}
function localBoard(b) {
  const since = b.weekly ? weekStart() : '';
  return localScores().filter(s => (s.platform || 'desktop') === b.platform && (!since || (s.created_at || '') >= since)).slice(0, 10);
}
function youRow() {
  const st = storyStats();
  return { id: playerId(), name: playerName() || 'YOU', story_points: st.points, furthest_level: st.furthest, story_agents: st.agents, lifetime_chroma: profile().lifetime || 0 };
}

// ── Fetching ─────────────────────────────────────────────────

export async function refreshBoard(b = currentBoard()) {
  const c = _cache[b.id];
  if (c && c.status === 'loading') return;
  if (c && c.status === 'ok' && Date.now() - c.at < 30000) return;
  _cache[b.id] = { rows: c ? c.rows : [], status: 'loading', at: Date.now() };
  let path;
  if (b.kind === 'arcade') {
    path = `scores?select=*&platform=eq.${b.platform}&order=score.desc&limit=10`;
    if (b.weekly) path += `&created_at=gte.${encodeURIComponent(weekStart())}`;
  } else if (b.kind === 'story') {
    path = 'players?select=*&story_points=gt.0&order=story_points.desc,story_at.asc&limit=10';
  } else {
    path = 'players?select=*&lifetime_chroma=gt.0&order=lifetime_chroma.desc&limit=10';
  }
  try {
    const res = await sb(path);
    if (!res.ok) throw new Error(res.status);
    _cache[b.id] = { rows: await res.json(), status: 'ok', at: Date.now() };
  } catch (e) {
    _cache[b.id] = { rows: b.kind === 'arcade' ? localBoard(b) : [youRow()], status: 'offline', at: Date.now() };
  }
}

// ── Saving ───────────────────────────────────────────────────

// Posts an Arcade run, then finds its rank (all time and this week) on its
// platform. Resolves { rank, weekRank } — or { offline: true } if unreachable.
export async function submitArcade({ score, wave, time, agent }) {
  const name = playerName() || 'ANON';
  const entry = { initials: name, score, wave, time, platform: PLATFORM, class: agent, agent, player_id: playerId() };
  saveLocalScore(entry);
  try {
    let res = await sb('scores', { method: 'POST', body: JSON.stringify(entry) });
    if (!res.ok) {
      // Older table without the newer columns: send the original fields only
      const legacy = { initials: name.slice(0, 3), score, wave, time, platform: PLATFORM, class: agent };
      res = await sb('scores', { method: 'POST', body: JSON.stringify(legacy) });
      if (!res.ok) throw new Error(res.status);
    }
    for (const b of BOARDS) if (b.kind === 'arcade') delete _cache[b.id];
    const [rank, weekRank] = await Promise.all([countAbove(score, ''), countAbove(score, weekStart())]);
    return { rank, weekRank };
  } catch (e) {
    return { offline: true };
  }
}

// Rank = runs scoring more than this one, plus one
async function countAbove(score, since) {
  try {
    let path = `scores?select=score&platform=eq.${PLATFORM}&score=gt.${score}`;
    if (since) path += `&created_at=gte.${encodeURIComponent(since)}`;
    const res = await sb(path, { method: 'HEAD', headers: { Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' } });
    if (!res.ok && res.status !== 206) return null;
    const n = parseInt((res.headers.get('content-range') || '').split('/')[1], 10);
    return Number.isFinite(n) ? n + 1 : null;
  } catch { return null; }
}

// Story points and lifetime Chroma: one row per player, overwritten each time
export async function syncPlayer() {
  if (!playerName()) return;
  const st = storyStats(), p = profile();
  const row = {
    id: playerId(), name: playerName(), platform: PLATFORM,
    story_points: st.points, furthest_level: st.furthest, story_agents: st.agents,
    story_at: new Date(p.storyAt || Date.now()).toISOString(),
    lifetime_chroma: p.lifetime || 0, updated_at: new Date().toISOString(),
  };
  try {
    await sb('players?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(row) });
    delete _cache.story; delete _cache.chroma;
  } catch (e) {}
}

// ── Drawing (title screen) ───────────────────────────────────

const fmtTime = s => (s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);
const AGENT_LETTER = { d: 'dex', j: 'juno', r: 'raze' };

// Draws the current board in a panel; maxRows fit the space given. On
// desktop the arrows are big buttons either side of the panel; on phones
// they sit in the header (and a swipe works too).
// Returns the arrow hit boxes { prev, next } and the panel rect (for swipes).
export function drawBoard(ctx, x, y, w, maxH, narrow, mouse = null) {
  const b = currentBoard();
  const c = _cache[b.id] || { rows: [], status: 'loading' };
  if (!_cache[b.id]) refreshBoard(b);
  const rowH = narrow ? 15 : 16;
  const rows = c.rows.slice(0, Math.max(0, Math.min(10, Math.floor((maxH - 58) / rowH))));
  const h = 58 + Math.max(1, rows.length) * rowH + 6 + (c.status === 'offline' ? 12 : 0);
  const fs = narrow ? 10 : 11;

  ctx.save();
  ctx.fillStyle = 'rgba(7,11,18,0.82)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill();
  ctx.strokeStyle = '#00897B66'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.stroke();

  // Header: TITLE and a dot per board; arrows either side
  ctx.textAlign = 'center';
  ctx.fillStyle = '#00E5CC'; ctx.font = `bold ${narrow ? 12 : 14}px monospace`;
  ctx.fillText(b.title, x + w / 2, y + 19);
  let prev, next;
  if (narrow) {
    prev = { x: x + 2, y: y, w: 44, h: 34 }; next = { x: x + w - 46, y: y, w: 44, h: 34 };
    ctx.fillStyle = '#7ADDD4'; ctx.font = 'bold 22px monospace';
    ctx.fillText('‹', prev.x + prev.w / 2, y + 23);
    ctx.fillText('›', next.x + next.w / 2, y + 23);
  } else {
    const bw = 52, bh = Math.min(h, 120), by = y + (h - bh) / 2;
    prev = { x: x - bw - 12, y: by, w: bw, h: bh }; next = { x: x + w + 12, y: by, w: bw, h: bh };
    for (const [r, ch] of [[prev, '‹'], [next, '›']]) {
      const hot = mouse && mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h;
      ctx.fillStyle = hot ? 'rgba(0,229,204,0.18)' : 'rgba(7,11,18,0.82)';
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.fill();
      ctx.strokeStyle = hot ? '#00E5CC' : '#00897B'; ctx.lineWidth = hot ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.stroke();
      ctx.fillStyle = hot ? '#FFFFFF' : '#7ADDD4'; ctx.font = 'bold 40px monospace';
      ctx.fillText(ch, r.x + r.w / 2, r.y + r.h / 2 + 13);
    }
  }
  for (let i = 0; i < BOARDS.length; i++) {
    ctx.fillStyle = i === _idx ? '#00E5CC' : '#2E4A4A';
    ctx.fillRect(Math.round(x + w / 2 + (i - (BOARDS.length - 1) / 2) * 10 - 2), y + 27, 4, 4);
  }

  // Columns
  const col = f => x + w * f;
  const cols = b.kind === 'arcade'
    ? [['#', 0.03, 'left'], ['NAME', 0.09, 'left'], ['AGENT', 0.42, 'left'], ['SCORE', 0.72, 'right'], ['WAVE', 0.83, 'right'], ['TIME', 0.97, 'right']]
    : b.kind === 'story'
      ? [['#', 0.03, 'left'], ['NAME', 0.09, 'left'], ['POINTS', 0.62, 'right'], ['LEVEL', 0.78, 'right'], ['AGENTS', 0.97, 'right']]
      : [['#', 0.03, 'left'], ['NAME', 0.09, 'left'], ['CHROMA', 0.97, 'right']];
  ctx.font = `bold ${fs}px monospace`; ctx.fillStyle = '#5de8e8';
  for (const [label, f, align] of cols) { ctx.textAlign = align; ctx.fillText(label, col(f), y + 46); }
  ctx.strokeStyle = '#5de8e844';
  ctx.beginPath(); ctx.moveTo(x + 8, y + 50); ctx.lineTo(x + w - 8, y + 50); ctx.stroke();

  const me = playerId();
  if (!rows.length) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#4A5068'; ctx.font = `${fs}px monospace`;
    ctx.fillText(c.status === 'loading' ? 'loading…' : b.weekly ? 'no runs yet this week' : 'no records yet', x + w / 2, y + 64);
  }
  rows.forEach((r, i) => {
    const ry = y + 64 + i * rowH;
    const mine = r.player_id === me || r.id === me;
    if (mine) { ctx.fillStyle = 'rgba(0,229,204,0.12)'; ctx.fillRect(x + 4, ry - rowH + 4, w - 8, rowH); }
    const color = i === 0 ? '#E8A020' : mine ? '#FFFFFF' : '#C4C8D4';
    ctx.font = `${i === 0 || mine ? 'bold ' : ''}${fs}px monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(String(i + 1), col(0.03), ry);
    const nameMaxW = col(b.kind === 'arcade' ? 0.40 : b.kind === 'story' ? 0.48 : 0.70) - col(0.09);
    ctx.fillText(String(r.initials || r.name || '???').toUpperCase(), col(0.09), ry, nameMaxW);
    if (b.kind === 'arcade') {
      const agent = r.agent || (AGENT_COLOR[r.class] ? r.class : null);
      ctx.fillStyle = agent ? AGENT_COLOR[agent] : '#5A6470';
      ctx.fillText(agent ? agent.toUpperCase() : '—', col(0.42), ry);
      ctx.fillStyle = color; ctx.textAlign = 'right';
      ctx.fillText((r.score || 0).toLocaleString(), col(0.72), ry);
      ctx.fillText(r.wave != null ? String(r.wave) : '—', col(0.83), ry);
      ctx.fillText(fmtTime(r.time), col(0.97), ry);
    } else if (b.kind === 'story') {
      ctx.textAlign = 'right';
      ctx.fillText(String(r.story_points || 0), col(0.62), ry);
      ctx.fillText(r.furthest_level ? `L${r.furthest_level}` : '—', col(0.78), ry);
      // A letter per character who has cleared a level, in their colour
      const have = r.story_agents || '';
      let ax = col(0.97);
      for (const l of ['r', 'j', 'd']) {
        ctx.fillStyle = have.includes(l) ? AGENT_COLOR[AGENT_LETTER[l]] : '#2E3440';
        ctx.fillText(l.toUpperCase(), ax, ry);
        ax -= ctx.measureText('M ').width;
      }
    } else {
      ctx.textAlign = 'right';
      ctx.fillText((r.lifetime_chroma || 0).toLocaleString(), col(0.97), ry);
    }
  });
  if (c.status === 'offline') {
    ctx.textAlign = 'center'; ctx.fillStyle = '#8A5A5A'; ctx.font = `${narrow ? 9 : 10}px monospace`;
    ctx.fillText(b.kind === 'arcade' ? 'offline · showing this device' : 'offline · showing you', x + w / 2, y + h - 3);
  }
  ctx.restore();
  return { prev, next, rect: { x, y, w, h }, h };
}
