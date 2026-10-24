// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Saves on the claude.ai preview copies (src/boot.js): with a stand-in for the
// artifact database, a saved profile is restored before the game starts even
// when browser storage starts empty, changes are written back, and without an
// artifact (GitHub Pages) the game just starts.
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const fakeClaude = `
    window.__cloud = JSON.parse(sessionStorage.getItem('__cloud') || 'null');
    window.claude = { use: async name => {
      if (name === 'user') return { id: async () => 'u1' };
      if (name === 'db') return { doc: path => ({
        get: async () => ({ exists: !!window.__cloud, data: () => window.__cloud }),
        set: async d => { window.__cloud = d; window.__writes = (window.__writes || 0) + 1; sessionStorage.setItem('__cloud', JSON.stringify(d)); },
      }) };
      return null;
    } };`;
  const run = async (withClaude, cloud, clearLocal) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
    await p.route('**/rest/v1/**', r => r.abort());
    await p.addInitScript(([fc, w, cloud]) => { if (cloud) sessionStorage.setItem('__cloud', JSON.stringify(cloud)); if (w) eval(fc); }, [fakeClaude, withClaude, cloud]);
    await p.goto('http://127.0.0.1:8766/index.html'); await p.waitForTimeout(1500);
    return p;
  };
  const cloud = { keys: { chromatic_decay_profile: JSON.stringify({ clears: { 1: { dex: 1 }, 2: { dex: 1 }, 3: { dex: 1 }, 4: { dex: 1 } }, player: { id: 'pcloud', name: 'CLOUDY' } }), chromatic_decay_prologue_done: '1' } };
  // 1) In an artifact, empty browser storage, a cloud save exists
  let p = await run(true, cloud);
  console.log('restored: name', await p.evaluate(() => __ev('playerName()')), '| level 5 unlocked', await p.evaluate(() => __ev('levelUnlocked(5)')), '| state', await p.evaluate(() => __ev('state')), '(0 = title)');
  // 2) A change is written back
  await p.evaluate(() => __ev("setPlayerName('RENAMED')"));
  await p.waitForTimeout(1500);
  console.log('after rename: cloud name', await p.evaluate(() => JSON.parse(window.__cloud.keys.chromatic_decay_profile).player.name), '| writes', await p.evaluate(() => window.__writes));
  await p.context().close();
  // 3) Not in an artifact: starts normally
  p = await run(false, null);
  console.log('no artifact: state', await p.evaluate(() => __ev('state')), '| claude', await p.evaluate(() => typeof window.claude));
  await p.context().close();
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
