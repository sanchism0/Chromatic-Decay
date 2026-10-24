// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
// Leaderboards: name entry, game over rank/PB, board cycling, story + chroma sync.
// Supabase is faked in-page with a tiny PostgREST stand-in (or left unreachable with "offline").
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] + '/boards', phone = process.argv[3] === 'phone', offline = process.argv[4] === 'offline';
fs.mkdirSync(out, { recursive: true });
const tag = (phone ? 'phone' : 'desk') + (offline ? '-off' : '');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: phone });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/TUNNEL|Failed to load resource|net::/.test(m.text()) && errs.push(m.text()));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(require('path').join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  // Fake database
  const db = { scores: [
    { initials: 'ACE', score: 9000, wave: 12, time: 700, platform: 'desktop', class: 'juno', agent: 'juno', player_id: 'x1', created_at: '2020-01-01T00:00:00Z' },
    { initials: 'BOB', score: 500, wave: 3, time: 200, platform: 'desktop', class: 'warden', created_at: new Date().toISOString() },
    { initials: 'MOB', score: 4000, wave: 8, time: 500, platform: 'mobile', agent: 'dex', player_id: 'x2', created_at: new Date().toISOString() },
  ], players: [
    { id: 'x1', name: 'ACE', story_points: 3, furthest_level: 2, story_agents: 'dj', story_at: '2026-01-01T00:00:00Z', lifetime_chroma: 9000 },
    { id: 'x2', name: 'MOBSTER', story_points: 1, furthest_level: 1, story_agents: 'd', story_at: '2026-02-01T00:00:00Z', lifetime_chroma: 120 },
  ] };
  const posts = [];
  await p.route('**/rest/v1/**', async r => {
    if (offline) return r.abort();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const u = new URL(r.request().url()), table = u.pathname.split('/').pop(), q = u.searchParams, m = r.request().method();
    if (m === 'POST') {
      const row = JSON.parse(r.request().postData()); posts.push([table, row]);
      if (table === 'scores') db.scores.push({ ...row, created_at: new Date().toISOString() });
      else { const i = db.players.findIndex(x => x.id === row.id); if (i >= 0) db.players[i] = row; else db.players.push(row); }
      return r.fulfill({ status: 201, headers: cors, body: '' });
    }
    let rows = db[table].slice();
    for (const [k, v] of q) {
      if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue;
      const [op, val] = [v.slice(0, v.indexOf('.')), v.slice(v.indexOf('.') + 1)];
      rows = rows.filter(x => op === 'eq' ? String(x[k]) === val : op === 'gt' ? (k === 'created_at' ? x[k] > val : +x[k] > +val) : op === 'gte' ? String(x[k] || '') >= val : true);
    }
    const ord = (q.get('order') || '').split(',').filter(Boolean);
    rows.sort((a, c) => { for (const o of ord) { const [k, d] = o.split('.'); if (a[k] !== c[k]) return (a[k] > c[k] ? 1 : -1) * (d === 'desc' ? -1 : 1); } return 0; });
    if (m === 'HEAD') return r.fulfill({ status: 206, headers: { ...cors, 'content-range': `0-0/${rows.length}` }, body: '' });
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(rows.slice(0, +(q.get('limit') || 99))) });
  });
  await p.goto('http://127.0.0.1:8766/index.html');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('chromatic_decay_prologue_done', '1'); });
  await p.reload(); await p.waitForTimeout(1200);
  const ev = s => p.evaluate(c => __ev(c), s);
  const tap = async (r) => { if (phone) await p.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); else { await p.mouse.move(r.x + r.w / 2, r.y + r.h / 2); await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up(); } await p.waitForTimeout(250); };
  await p.screenshot({ path: `${out}/${tag}-title-noname.png` });
  console.log('player id', await ev('profile().player.id'));

  // Arcade without a name → name entry
  await tap(await ev('_titleBtns.start'));
  console.log('after Arcade click state', await ev('state'), '(19 = name entry)', 'overlay', await ev('_kbdOverlay'));
  if (phone) {
    await p.waitForTimeout(300);
    console.log('kbd keys', await ev('_kbdBtns.map(b => b.key).join("")'), errs);
    for (const k of ['Z', 'A', 'K']) { const btn = await ev(`_kbdBtns.find(b => b.key === '${k}')`); await tap(btn); }
    await p.screenshot({ path: `${out}/${tag}-name.png` });
    await tap(await ev(`_kbdBtns.find(b => b.key === 'OK')`));
  } else {
    await p.keyboard.type('zak9'); await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/${tag}-name.png` });
    await p.keyboard.press('Enter');
  }
  await p.waitForTimeout(400);
  console.log('name saved', await ev('playerName()'), 'state', await ev('state'), '(10 = char select)', 'player posts', posts.filter(x => x[0] === 'players').length);

  // A run ends: post it, rank it
  await ev('state = STATES.TITLE'); await p.waitForTimeout(200);
  await ev('startRun(); waveSystem.killScore = 1234; waveSystem.wave = 4; _runChroma = { violet: 10, yellow: 2 }; handleGameOver();');
  await p.waitForTimeout(1500);
  console.log('game over result', JSON.stringify(await ev('_arcadeResult')), 'pb', JSON.stringify(await ev('_arcadePB')), 'lifetime', await ev('profile().lifetime'), 'wallet violet', await ev('profile().chroma.violet'));
  console.log('posted score', JSON.stringify((posts.find(x => x[0] === 'scores') || [])[1]));
  await p.screenshot({ path: `${out}/${tag}-gameover.png` });
  await ev('state = STATES.TITLE');
  await ev('startRun(); waveSystem.killScore = 800; waveSystem.wave = 2; handleGameOver();');
  await p.waitForTimeout(1200);
  console.log('second run', JSON.stringify(await ev('_arcadeResult')), 'pb', JSON.stringify(await ev('_arcadePB')));
  await p.screenshot({ path: `${out}/${tag}-gameover2.png` });

  // Story progress → players row
  await ev("profile().clears = { 1: { dex: 2, juno: 1 }, 2: { dex: 1 } }; syncPlayer();");
  await p.waitForTimeout(600);
  console.log('player row', JSON.stringify((posts.filter(x => x[0] === 'players').pop() || [])[1]));

  // Title boards: cycle through all six
  await ev('state = STATES.TITLE'); await p.waitForTimeout(500);
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${out}/${tag}-board${i}.png` });
    if (phone) {
      // swipe left on the board
      const r = await ev('_titleBoard.rect');
      const y = r.y + r.h / 2;
      await p.evaluate(([x0, x1, y]) => {
        const c = document.querySelector('canvas'), rect = c.getBoundingClientRect();
        const mk = (type, x) => { const t = new Touch({ identifier: 7, target: c, clientX: x * rect.width / c.width + rect.left, clientY: y * rect.height / c.height + rect.top }); c.dispatchEvent(new TouchEvent(type, { changedTouches: [t], touches: type === 'touchend' ? [] : [t], bubbles: true, cancelable: true })); };
        mk('touchstart', x0); mk('touchmove', x1); mk('touchend', x1);
      }, [r.x + r.w * 0.8, r.x + r.w * 0.2, y]);
    } else if (i % 2) await tap(await ev('_titleBoard.next'));
    else await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(150);
  }
  console.log('boards done');
  // Change the name from the title
  await tap(await ev('_titleBtns.name'));
  console.log('change name state', await ev('state'));
  if (!phone) { await p.keyboard.press('Escape'); console.log('escape keeps name', await ev('playerName()'), 'state', await ev('state')); }
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
