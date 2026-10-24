// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Level 3's boss checkpoint: dying at The Queue offers RETRY BOSS, which
// restarts at the boss with the level's ability kept (mirrors turned, terminal
// full); leaving for the Story map and coming back starts the level over.
// Args: <outdir> [dex|juno]
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = (process.argv[2] || '/tmp') + '/checkpoint', who = process.argv[3] || 'juno';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('http://127.0.0.1:8766/index.html');
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('chromatic_decay_prologue_done', '1');
    localStorage.setItem('chromatic_decay_profile', JSON.stringify({ clears: { 1: { dex: 1, juno: 1 }, 2: { dex: 1, juno: 1 } }, player: { id: 'ptest', name: 'TEST' } }));
  });
  await p.reload(); await p.waitForTimeout(900);
  const ev = s => p.evaluate(c => __ev(c), s);
  const key = async k => { await p.keyboard.down(k); await p.waitForTimeout(60); await p.keyboard.up(k); await p.waitForTimeout(60); };
  const waitFor = async (expr, ms = 15000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr)) return true; await p.waitForTimeout(200); } return false; };
  const id = who === 'dex' ? 'grenade' : 'decoy';

  // A run that took the level's ability, then reached the boss
  await ev(`selectedCharacter = "${who}"; _pendingLevel = 3; startRun({ level: 3 }); state = STATES.PLAYING;
    level.pendingPowerUp = LEVEL_CARDS[3]["${who}"]; level.takePowerUp(player); level._skipTo(4);`);
  console.log('reached beat', await ev('level.beat.type'), '| checkpoint idx', await ev('level.checkpointIdx'), '| abilities', JSON.stringify(await ev('player.abilities')));
  await p.waitForTimeout(1200);
  // Go down
  await ev('level.radio.clear(); player.hp = 1;');
  await waitFor('state === STATES.LEVEL_FAIL', 8000);
  await p.waitForTimeout(600);
  console.log('fail screen: state', await ev('state'), '| checkpoint', JSON.stringify(await ev('_checkpoint && { id: _checkpoint.id, idx: _checkpoint.idx, granted: _checkpoint.granted.map(g => g.name) }')));
  await p.screenshot({ path: `${out}/fail-${who}.png` });
  await key('Space'); await p.waitForTimeout(800);
  console.log('retry: beat', await ev('level.idx'), await ev('level.beat.type'), '| abilities', JSON.stringify(await ev('player.abilities')), '| HUD', JSON.stringify(await ev('level.powers')),
    '| mirrors all turned', await ev('level.mirrors.every(m => m.ok)'), '| terminal', await ev('level.hold.p'), '| hp', Math.round(await ev('player.hp')));
  await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/retry-${who}.png` });
  // Die again, then leave for the map: the next start is from the top
  await ev('level.radio.clear(); player.hp = 1;');
  await waitFor('state === STATES.LEVEL_FAIL', 8000); await p.waitForTimeout(600);
  console.log('second fail still offers the boss:', !!(await ev('_checkpoint')));
  await key('Escape'); await p.waitForTimeout(400);
  console.log('left: state', await ev('state'), '(13 = story map)');
  await ev(`_pendingLevel = 3; selectedCharacter = "${who}"; startRun({ level: 3 }); state = STATES.PLAYING;`);
  console.log('fresh start: beat', await ev('level.idx'), await ev('level.beat.type'), '| checkpoint', await ev('_checkpoint'), '| abilities', JSON.stringify(await ev('player.abilities')));
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
