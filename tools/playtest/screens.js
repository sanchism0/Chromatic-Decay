// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Screenshots of every screen for a readability check (minimum text size):
// title, story map, character select, a level HUD with comms, the power-up
// and card screens, results, level failed, Arcade HUD, upgrade cards, pause,
// settings, game over. Args: <outdir> [desk|phone|land]
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = (process.argv[2] || '/tmp') + '/screens', mode = process.argv[3] || 'desk';
const phone = mode !== 'desk', land = mode === 'land';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: land ? { width: 844, height: 390 } : phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: phone });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('http://127.0.0.1:8766/index.html');
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('chromatic_decay_prologue_done', '1');
    localStorage.setItem('chromatic_decay_profile', JSON.stringify({ clears: { 1: { dex: 1, juno: 1 }, 2: { dex: 1 }, 3: { dex: 1 } }, cards: { dex: ['heavy_bursts', 'shock_dash', 'stun_grenade'], juno: ['hot_barrel'] }, player: { id: 'ptest', name: 'TESTER' }, chroma: { violet: 120, yellow: 40, green: 12 } }));
  });
  await p.reload(); await p.waitForTimeout(1200);
  const ev = s => p.evaluate(c => __ev(c), s);
  const shot = async (name, setup, wait = 700) => {
    try { await ev(setup); } catch (e) { console.log(name, 'setup failed:', e.message.split('\n')[0]); return; }
    await p.waitForTimeout(wait);
    await p.screenshot({ path: `${out}/${mode}-${name}.png` });
    console.log('saved', name, '| state', await ev('state'));
  };
  await shot('title', 'state = STATES.TITLE');
  await shot('storymap', '_openStoryMap()');
  await shot('charselect', `_pendingLevel = 4; _openCharSelect('level')`);
  await shot('level', `selectedCharacter = 'dex'; _pendingLevel = 4; startRun({ level: 4 }); state = STATES.PLAYING;`, 2600);
  await shot('powerup', `level.radio.clear(); level.pendingPowerUp = LEVEL_CARDS[4].dex; _unlockT = 1; state = STATES.POWER_UP;`, 1200);
  await shot('unlock', `level.pendingPowerUp = null; state = STATES.PLAYING; level.awaitUnlock = true; _unlockT = 1; state = STATES.ABILITY_UNLOCK;`, 1200);
  await shot('results', `_finishLevel(); _levelEndDelay = 0;`, 1200);
  await shot('fail', `startRun({ level: 3 }); state = STATES.PLAYING; _levelFail = { id: 3, name: 'THE STACKS', agent: 'dex', kept: { violet: 4, yellow: 1, green: 0 } }; _checkpoint = { id: 3, label: 'boss', granted: [] }; level = null; state = STATES.LEVEL_FAIL;`, 900);
  await shot('arcade', `selectedCharacter = 'juno'; startRun(); state = STATES.PLAYING;`, 3500);
  await shot('upgrade', `upgradeUI.present(player, []); state = STATES.UPGRADE;`, 900);
  await shot('pause', `state = STATES.PAUSED;`);
  await shot('settings', `state = STATES.SETTINGS;`);
  await shot('gameover', `state = STATES.PLAYING; handleGameOver();`, 1500);
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
