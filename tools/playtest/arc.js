// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Arc Round (Dex, Level 1's third power-up): only the last round of a burst is
// electric, and on a hit it jumps to the nearest other enemy within range.
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(require('path').join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('http://127.0.0.1:8766/index.html'); await p.waitForTimeout(800);
  const ev = s => p.evaluate(c => __ev(c), s);
  await ev("setPlayerName('TEST')");
  await ev(`selectedCharacter = "dex"; startRun(); state = STATES.PLAYING; waveSystem.active = false; player.beamT = 9;`);
  for (const arc of [true, false]) {
    console.log(`arc ${arc}:`, await ev(`(() => {
      enemies.reset(); projectiles.reset();
      const mk = (x, y) => { const e = enemies.spawnEnemyAt('violet', x, y); e.spawnT = 1; e.maxHp = e.hp = 999; e.update = () => {}; return e; };
      const hit = mk(600, 470), near = mk(600, 560), far = mk(900, 470);
      const s = projectiles.spawnPlayer(540, 470, 0, 10, 360, 400, 0); s.arc = ${arc};
      for (let i = 0; i < 60; i++) { projectiles.update(1 / 60, map, player); enemies.checkProjectileHits(projectiles, particles, player); }
      return 'hit ' + (999 - hit.hp) + ' | near (90 px) ' + (999 - near.hp) + ' | far (300 px) ' + (999 - far.hp) + ' | bolts ' + enemies.zaps.length;
    })()`));
  }
  // Real bursts: which rounds come out electric (r = plain, A = electric)
  await ev(`enemies.reset(); projectiles.reset(); player.arcRound = true; window.__seq = [];
    const _sp = projectiles.spawnPlayer.bind(projectiles);
    const _s = player._shoot.bind(player); player._shoot = (ps, fin) => { let last; projectiles.spawnPlayer = (...a) => (last = _sp(...a)); _s(ps, fin); projectiles.spawnPlayer = _sp; __seq.push((fin ? 'F' : '') + (last && last.arc ? 'A' : 'r')); };`);
  await p.waitForTimeout(2600);
  console.log('real firing:', await ev('__seq.join(" ")'), '(F = last round of a burst; expect only F rounds electric)');
  await p.screenshot({ path: (process.argv[2] || '/tmp') + '/arc.png' });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
