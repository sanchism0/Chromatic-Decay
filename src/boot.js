// CHROMATIC DECAY — Boot: makes saves stick, then starts the game
//
// Everything the game remembers (Story progress, cards, Chroma, name,
// settings) lives in localStorage under keys starting "chromatic_decay_".
// On GitHub Pages that's all there is. Inside a claude.ai artifact (the
// preview copies) browser storage can come back empty between visits, so
// there the same keys are also kept in the artifact's own database, private
// to each signed-in viewer: restored before the game starts, and written back
// shortly after anything changes. Outside an artifact this file just starts
// the game.

const PREFIX = 'chromatic_decay_';

// If browser storage can't be used at all, give the game an in-memory one so
// it still runs (and the cloud copy below still fills it)
function storage() {
  try { const s = window.localStorage; s.setItem('__cd_test', '1'); s.removeItem('__cd_test'); return s; } catch (e) {}
  const mem = new Map();
  const shim = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: k => { mem.delete(k); },
    clear: () => mem.clear(),
    key: i => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
  try { Object.defineProperty(window, 'localStorage', { value: shim, configurable: true }); } catch (e) {}
  return shim;
}

const ourKeys = s => {
  const out = {};
  for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k && k.startsWith(PREFIX)) out[k] = s.getItem(k); }
  return out;
};

async function cloudSave() {
  if (!window.claude || typeof window.claude.use !== 'function') return;   // not in an artifact
  const timeout = new Promise(r => setTimeout(() => r(null), 4000));
  const [db, user] = await Promise.race([Promise.all([window.claude.use('db'), window.claude.use('user')]), timeout.then(() => [null, null])]);
  if (!db || !user) return;
  let id;
  try { id = await user.id(); } catch (e) { return; }
  if (!id) return;
  const ref = db.doc('data/users/' + id + '/save');
  const s = storage();
  // Restore: the cloud copy wins over whatever this browser kept. If it
  // can't be read (slow or offline), stop here: writing back a fresh, empty
  // save would wipe the real one in the cloud
  let snap = null;
  try { snap = await Promise.race([ref.get(), new Promise(r => setTimeout(() => r(null), 8000))]); } catch (e) {}
  if (!snap) return;
  try {
    const data = snap.exists ? snap.data() : null;
    if (data && data.keys) {
      for (const [k, v] of Object.entries(data.keys)) if (k.startsWith(PREFIX) && typeof v === 'string') s.setItem(k, v);
    } else {
      // First visit with the cloud copy: keep what this browser already has
      const now = ourKeys(s);
      if (Object.keys(now).length) ref.set({ keys: now, at: Date.now() }).catch(() => {});
    }
  } catch (e) {}
  // Write back: any change to our keys is saved a moment later (one write
  // at a time, only when something actually changed)
  let last = JSON.stringify(ourKeys(s)), timer = null, busy = false;
  const flush = async () => {
    timer = null;
    const now = ourKeys(s), str = JSON.stringify(now);
    if (str === last || busy) { if (busy) timer = setTimeout(flush, 800); return; }
    busy = true;
    try { await ref.set({ keys: now, at: Date.now() }); last = str; } catch (e) {}
    busy = false;
  };
  const poke = () => { if (!timer) timer = setTimeout(flush, 800); };
  // Hook writes (on the Storage prototype: assigning to localStorage itself
  // would just store an item called "setItem")
  const target = (typeof Storage !== 'undefined' && s instanceof Storage) ? Storage.prototype : s;
  const set = target.setItem, del = target.removeItem;
  try {
    target.setItem = function (k, v) { set.call(this, k, v); if (String(k).startsWith(PREFIX)) poke(); };
    target.removeItem = function (k) { del.call(this, k); if (String(k).startsWith(PREFIX)) poke(); };
  } catch (e) {}
  setInterval(poke, 5000);   // catches any write that slipped past the hook
  window.addEventListener('pagehide', () => { flush(); });
}

try { await cloudSave(); } catch (e) {}
await import('./game.js');
