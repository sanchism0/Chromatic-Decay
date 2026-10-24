// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Touch grenade: press the GRENADE button and drag to where it should land
// (a ring shows the spot); let go to throw. A tap with no drag throws nothing.
// Also prints the phone zoom. Args: <outdir> [phone|land]
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || '/tmp', mode = process.argv[3] || 'phone';
(async () => {
  const b = await chromium.launch();
  const vp = mode === 'land' ? { width: 844, height: 390 } : { width: 390, height: 844 };
  const p = await b.newPage({ viewport: vp, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('http://127.0.0.1:8766/index.html'); await p.waitForTimeout(800);
  const ev = s => p.evaluate(c => __ev(c), s);
  await ev("setPlayerName('TEST')");
  await ev(`selectedCharacter = "dex"; startRun(); state = STATES.PLAYING; waveSystem.active = false; player.beamT = 9; enemies.reset();
    player.grenade = true; player.abilities.push('grenade'); player.grenadeCooldown = 0;`);
  await p.waitForTimeout(300);
  console.log('zoom', (await ev('ZOOM')).toFixed(3), '| world width shown', Math.round(await ev('vw()')), 'px');
  const r = await ev('_grenadeBtn.r');
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const touch = (type, x, y) => p.evaluate(([type, x, y]) => {
    const c = document.querySelector('canvas');
    const t = new Touch({ identifier: 7, target: c, clientX: x, clientY: y });
    c.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }));
  }, [type, x, y]);
  // A tap: nothing thrown
  await touch('touchstart', cx, cy); await p.waitForTimeout(60); await touch('touchend', cx, cy); await p.waitForTimeout(100);
  console.log('tap on GRENADE: thrown', await ev('grenades.flying.length'), '| cooldown', (await ev('player.grenadeCooldown')).toFixed(1));
  // Press and drag up-left, half range
  await touch('touchstart', cx, cy); await p.waitForTimeout(60);
  for (let k = 1; k <= 5; k++) { await touch('touchmove', cx - 8 * k, cy - 8 * k); await p.waitForTimeout(30); }
  await p.waitForTimeout(100);
  console.log('dragging: aim shown', await ev('!!input.btnDrag'), '| aim point', JSON.stringify(await ev('(() => { const a = _grenadeDragAim({ dx: input.btnDrag.x - input.btnDrag.x0, dy: input.btnDrag.y - input.btnDrag.y0 }); return a && [Math.round(a.x - player.x), Math.round(a.y - player.y)]; })()')));
  await p.screenshot({ path: `${out}/grenadeaim-${mode}.png` });
  await touch('touchend', cx - 40, cy - 40); await p.waitForTimeout(80);
  const g = await ev('grenades.flying[0] && [Math.round(grenades.flying[0].tx - player.x), Math.round(grenades.flying[0].ty - player.y)]');
  console.log('let go: thrown', await ev('grenades.flying.length'), '| lands at (from player)', JSON.stringify(g), '| cooldown', (await ev('player.grenadeCooldown')).toFixed(1));
  console.log('player moved by the drag (should be ~0):', Math.round(await ev('Math.hypot(input.touchMoveX, input.touchMoveY) * 100')));
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
