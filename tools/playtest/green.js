// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Green blink: run with a green trailing behind you; it should fade out (no
// hits, no contact), reform on the far side of you in your path, and fire a
// short volley. Standing still near it, it shouldn't blink.
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] + '/green';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('http://127.0.0.1:8766/index.html'); await p.waitForTimeout(800);
  const ev = s => p.evaluate(c => __ev(c), s);
  await ev("setPlayerName('TEST')");
  const setup = async (gx, gy) => {
    await ev(`selectedCharacter = "dex"; startRun(); state = STATES.PLAYING; waveSystem.active = false; enemies.reset(); input.setAutoFire(false); player.x = 120; player.y = 300;`);
    await p.waitForTimeout(1300);
    await ev(`window.__g = enemies.spawnEnemyAt('green', player.x + (${gx}), player.y + (${gy})); __g.spawnT = 1; __g.maxHp = __g.hp = 9999; player.hp = player.maxHp; window.__god = setInterval(() => { player.hp = player.maxHp; }, 50);`);
    await p.waitForTimeout(100);
    await ev('__g.blink = "hunt"; __g.blinkT = 0.3; __g.fireTimer = 99;');
  };

  // 1. Run right with the green trailing to the left
  await setup(-170, 0);
  await p.keyboard.down('d');
  let sawFade = false, fadeShot = false, hpDuringFade = null, before = null, after = null, shotsAfter = 0;
  for (let i = 0; i < 70; i++) {
    const [bl, gx, px, gy, py, hp] = await ev('[__g.blink, __g.x, player.x, __g.y, player.y, __g.hp]');
    if (bl === 'fade' && !sawFade) {
      sawFade = true; before = gx - px;
      // shoot straight at it while it's faded (right on top of it): should pass through
      hpDuringFade = await ev(`(() => { projectiles.spawnPlayer(__g.x - 4, __g.y, 0, 50, 400, 200); enemies.checkProjectileHits(projectiles, particles, player); return [__g.hp, __g.phased]; })()`);
      await ev(`window.__shots = 0; const _se = projectiles.spawnEnemy.bind(projectiles); projectiles.spawnEnemy = (...a) => { __shots++; return _se(...a); };`);
      await p.screenshot({ path: `${out}/fade.png` });
    }
    if (sawFade && bl === 'hunt' && after === null) {
      after = gx - px;
      await p.waitForTimeout(250); await p.screenshot({ path: `${out}/reform.png` });
      await p.waitForTimeout(700);
      shotsAfter = await ev('__shots');
      break;
    }
    await p.waitForTimeout(50);
  }
  await p.keyboard.up('d');
  console.log('running right: blinked', sawFade, '| green was', Math.round(before), 'px from player (x), now', Math.round(after), '(positive = ahead)');
  console.log('shot while faded: [hp, phased]', JSON.stringify(hpDuringFade), '(9999 = passed through) | shots fired within 1s of reforming', shotsAfter);

  // 2. Standing still, green close: it holds its ground and keeps firing
  // (somewhere with a clear line to the player: walled off, it would blink by design)
  for (const [ox, oy] of [[0, 120], [0, -120], [120, 0], [-110, 0], [90, 90]]) {
    await setup(ox, oy);
    await p.waitForTimeout(300);
    if (await ev('__g._los')) break;
  }
  await ev(`__g.fireTimer = 0.2; window.__shots = 0; const _se2 = projectiles.spawnEnemy.bind(projectiles); projectiles.spawnEnemy = (...a) => { __shots++; return _se2(...a); };`);
  const g0 = await ev('[__g.x, __g.y]');
  await p.waitForTimeout(3000);
  const g1 = await ev('[__g.x, __g.y]');
  console.log('standing still near it (clear shot:', await ev('__g._los'), '): blink', await ev('__g.blink'), '| moved', Math.round(Math.hypot(g1[0] - g0[0], g1[1] - g0[1])), 'px | shots in 3s', await ev('__shots'));

  // 2b. Six greens trailing, all blink at once: they land spread out
  await setup(-170, 0);
  await ev(`__g.blinkT = 99; window.__gs = []; for (let i = 0; i < 6; i++) { const g = enemies.spawnEnemyAt('green', player.x - 150 - (i % 3) * 30, player.y - 60 + Math.floor(i / 3) * 120); g.spawnT = 1; g.maxHp = g.hp = 9999; __gs.push(g); }`);
  await p.waitForTimeout(100);
  await ev('for (const g of __gs) { g.blink = "hunt"; g.blinkT = 0.05; g.fireTimer = 99; }');
  await p.keyboard.down('d');
  const blinked = new Set();
  for (let i = 0; i < 40; i++) {
    (await ev('__gs.map((g, k) => g.blink === "fade" ? k : -1)')).forEach(k => k >= 0 && blinked.add(k));
    if (blinked.size === 6 && (await ev('__gs.every(g => g.blink !== "fade")'))) break;
    await p.waitForTimeout(50);
  }
  await p.keyboard.up('d');
  console.log('greens that blinked while you ran:', blinked.size, '/ 6');
  const spots = await ev('__gs.map(g => [Math.round(g.x - player.x), Math.round(g.y - player.y)])');
  let minGap = Infinity;
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) minGap = Math.min(minGap, Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1]));
  console.log('six greens blinked: positions relative to player', JSON.stringify(spots), '| closest pair', Math.round(minGap), 'px');
  await p.screenshot({ path: `${out}/six.png` });

  // 3. A stun during the fade cancels it
  await setup(-170, 0);
  await p.keyboard.down('d');
  for (let i = 0; i < 40 && (await ev('__g.blink')) !== 'fade'; i++) await p.waitForTimeout(40);
  await ev('__g.stunTimer = 1');
  await p.waitForTimeout(100);
  await p.keyboard.up('d');
  console.log('stunned mid-fade → blink', await ev('__g.blink'), '| hittable again', !(await ev('__g.phased')));
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
