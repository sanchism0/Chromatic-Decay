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
  await ev(`selectedCharacter = "juno"; startRun(); state = STATES.PLAYING; waveSystem.active = false; player.beamT = 9;`);
  for (const pierce of [0, 1, 2]) {
    console.log(`piercing ${pierce}:`, await ev(`(() => {
      enemies.reset(); projectiles.reset();
      const es = [0, 1, 2].map(i => { const e = enemies.spawnEnemyAt('violet', 600 + i * 40, 470); e.spawnT = 1; e.maxHp = e.hp = 999; e.update = () => {}; return e; });
      projectiles.spawnPlayer(540, 470, 0, 10, 360, 400, ${pierce});
      for (let i = 0; i < 60; i++) { projectiles.update(1 / 60, map, player); enemies.checkProjectileHits(projectiles, particles, player); }
      return es.map(e => 999 - e.hp).join(' / ') + ' damage taken (front to back)';
    })()`));
  }
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
