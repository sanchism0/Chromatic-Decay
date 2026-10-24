// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(require('path').join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.goto('http://127.0.0.1:8766/index.html'); await p.waitForTimeout(800);
  const ev = s => p.evaluate(c => __ev(c), s);
  await ev("setPlayerName('TEST')");
  const setup = async () => {
    await ev(`selectedCharacter = "dex"; startRun(); state = STATES.PLAYING; waveSystem.active = false; enemies.reset(); input.setAutoFire(false); player.x = 587; player.y = 470;`);
    await p.waitForTimeout(1300);
    await ev(`window.__y = enemies.spawnEnemyAt('yellow', player.x + 150, player.y); __y.spawnT = 1; __y.maxHp = __y.hp = 999; __y.lunge = 'chase'; __y.lungeT = 0; player.hp = player.maxHp; player.invincible = 0;`);
  };
  // 1. Stand still
  await setup();
  const log = []; let start = null, maxD = 0;
  for (let i = 0; i < 30; i++) {
    const [st, x] = await ev('[__y.lunge, __y.x]');
    if (st === 'lunging' && start === null) start = x;
    if (start !== null) maxD = Math.max(maxD, Math.abs(x - start));
    if (!log.length || log[log.length - 1] !== st) log.push(st);
    if (st === 'windup' && log.filter(s => s === 'windup').length === 1 && i < 6) { await p.screenshot({ path: process.argv[2] + '/lvl/lunge-windup.png', clip: { x: 440, y: 300, width: 420, height: 160 } }); }
    await p.waitForTimeout(50);
  }
  console.log('stand still: states', log.join(' > '), '| hp', await ev('player.hp'), '| lunge travelled ~', Math.round(maxD), 'px');
  // 2. Sidestep once the windup starts
  await setup();
  for (let i = 0; i < 20 && (await ev('__y.lunge')) !== 'windup'; i++) await p.waitForTimeout(30);
  await ev('player.y += 70;');
  for (let i = 0; i < 30; i++) { await ev('player.x = 587; player.y = 540;'); await p.waitForTimeout(40); }
  console.log('sidestep: hp', await ev('player.hp'), '| yellow state now', await ev('__y.lunge'));
  // 3. Stun cancels the windup
  await setup();
  for (let i = 0; i < 20 && (await ev('__y.lunge')) !== 'windup'; i++) await p.waitForTimeout(30);
  await ev('__y.stunTimer = 1;'); await p.waitForTimeout(80);
  console.log('stunned mid-windup -> state', await ev('__y.lunge'));
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
