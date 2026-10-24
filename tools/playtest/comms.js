// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Comms rules: the box sits just below the middle on desktop and at the top on
// phones; while a line is up the agent can't shoot; with Chromatics around
// everything holds still; Space moves the line on (and doesn't dash).
// Args: <outdir> [desk|phone|land]
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] + '/comms', mode = process.argv[3] || 'desk';
const phone = mode !== 'desk', land = mode === 'land';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const vp = land ? { width: 844, height: 390 } : phone ? { width: 390, height: 844 } : { width: 1280, height: 720 };
  const p = await b.newPage({ viewport: vp, hasTouch: phone });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('http://127.0.0.1:8766/index.html'); await p.waitForTimeout(800);
  const ev = s => p.evaluate(c => __ev(c), s);
  await ev("setPlayerName('TEST')");
  await ev(`selectedCharacter = "dex"; _pendingLevel = 1; startRun({ level: 1 }); state = STATES.PLAYING; input.setAutoFire(true);`);
  await p.waitForTimeout(1500);
  // Briefing with no enemies: the agent can move, but doesn't shoot
  const shots = 'window.__n = 0; const _sp = projectiles.spawnPlayer.bind(projectiles); projectiles.spawnPlayer = (...a) => { __n++; return _sp(...a); };';
  await ev(shots);
  await p.waitForTimeout(800);
  const box = await ev('level.radio.rect');
  console.log('briefing: line up', await ev('!!level.radio.cur'), '| box top at', box && Math.round(box.y), 'of', vp.height, phone ? '(top:' : '(mid-screen:', box && (phone ? box.y < vp.height * 0.3 : box.y > vp.height * 0.35 && box.y < vp.height * 0.75), ') | shots while talking', await ev('__n'));
  await p.screenshot({ path: `${out}/${mode}-briefing.png` });
  // Line up with an enemy around: everything holds still
  await ev(`level.radio.clear(); window.__v = enemies.spawnEnemyAt('violet', player.x + 200, player.y); __v.spawnT = 1; level.radio.say([{ who: 'juno', face: 'focused', text: 'Hold on, this is a test line while a Chromatic is close.' }]);`);
  await p.waitForTimeout(300);
  const a0 = await ev('[__v.x, __v.y]'); await ev('__n = 0');
  await p.waitForTimeout(900);
  const a1 = await ev('[__v.x, __v.y]');
  console.log('line up, enemy around: enemy moved', Math.round(Math.hypot(a1[0] - a0[0], a1[1] - a0[1])), 'px | shots', await ev('__n'));
  await p.screenshot({ path: `${out}/${mode}-frozen.png` });
  // Space (desktop) moves on; then the fight resumes
  if (!phone) { await p.keyboard.down('Space'); await p.waitForTimeout(60); await p.keyboard.up('Space'); }
  else await ev('level.radio.next()');
  await p.waitForTimeout(150);
  console.log('after Space: line up', await ev('!!level.radio.cur'), '| dashed', await ev('player.dashT > 0'));
  await p.waitForTimeout(800);
  const a2 = await ev('[__v.x, __v.y]');
  console.log('then: enemy moved', Math.round(Math.hypot(a2[0] - a1[0], a2[1] - a1[1])), 'px | shots', await ev('__n'));
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
