// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2] + '/story';
const vp = process.argv[3] === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const touch = process.argv[3] === 'phone';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: vp, hasTouch: touch });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !m.text().includes('TUNNEL') && errs.push(m.text()));
  await p.route('**/src/game.js*', async route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(require('path').join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.goto('http://127.0.0.1:8766/index.html'); await p.evaluate(() => localStorage.removeItem('chromatic_decay_autofire')); await p.reload(); await p.waitForTimeout(900);
  const tag = process.argv[3] || 'desk';
  const ev = s => p.evaluate(c => __ev(c), s);
  await ev("setPlayerName('TEST')");
  const press = async () => { await p.keyboard.down('Space'); await p.waitForTimeout(60); await p.keyboard.up('Space'); await p.waitForTimeout(60); };
  // Click Story Mode
  const r = await ev('_titleBtns.story');
  await p.mouse.move(r.x + r.w / 2, r.y + r.h / 2); await p.mouse.down(); await p.waitForTimeout(100); await p.mouse.up();
  await p.waitForTimeout(500);
  console.log('state after click', await ev('state'), 'phase', await ev('story.phase'));
  // Step through the intro, screenshotting a few lines
  let n = 0;
  while ((await ev('story.phase')) === 'intro' && n < 80) {
    const i = await ev('story.scene ? story.scene.i : -1');
    if ([0, 3, 9, 12, 16].includes(i)) { await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${tag}-intro-${i}.png` }); }
    await press(); await press(); n++;
  }
  await p.waitForTimeout(400);
  console.log('after intro: state', await ev('state'), 'csMode', await ev('_csMode'));
  await p.screenshot({ path: `${out}/${tag}-pick.png` });
  // Pick Juno
  await ev('selectedCharacter = "juno"'); await press();
  await p.waitForTimeout(400);
  console.log('after pick: phase', await ev('story.phase'));
  await p.waitForTimeout(1200); await p.screenshot({ path: `${out}/${tag}-after.png` });
  n = 0; while ((await ev('story.phase')) === 'after' && n < 20) { await press(); await press(); n++; }
  await p.waitForTimeout(600);
  console.log('tutorial: phase', await ev('story.phase'), 'state', await ev('state'), 'char', await ev('player.character'), 'waves', await ev('waveSystem.active'));
  await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/${tag}-tut-1.png` });
  const waitStep = async (k, ms = 60000) => { for (let i = 0; i < ms / 250 && (await ev('story.stepIdx')) < k; i++) await p.waitForTimeout(250); };
  const enter = async () => { await p.keyboard.down('Enter'); await p.waitForTimeout(60); await p.keyboard.up('Enter'); await p.waitForTimeout(80); };
  const skipTalk = async () => { for (let i = 0; i < 30 && (await ev('story.radio.busy')); i++) await enter(); };
  // Step 0: walk
  for (const k of ['d', 's', 'a']) { await p.keyboard.down(k); await p.waitForTimeout(700); await p.keyboard.up(k); }
  await skipTalk(); await waitStep(1);
  await p.keyboard.down('Space'); await p.waitForTimeout(60); await p.keyboard.up('Space');
  await skipTalk(); await waitStep(2);
  console.log('step', await ev('story.stepIdx'), 'moved', Math.round(await ev('story.stats.moved')));
  // Step 1: fire (auto-fire on)
  await p.mouse.move(vp.width * 0.8, vp.height / 2); await skipTalk(); await waitStep(3);
  console.log('step', await ev('story.stepIdx'), 'shots', await ev('story.stats.shots'), 'highlight', await ev('story.highlight'));
  await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/${tag}-tut-auto.png` });
  // Step 2: toggle auto-fire with the on-screen button
  const ab = await ev('_autoBtn.r');
  if (touch) await p.touchscreen.tap(ab.x + ab.w / 2, ab.y + ab.h / 2);
  else { await p.mouse.move(ab.x + ab.w / 2, ab.y + ab.h / 2); await p.mouse.down(); await p.waitForTimeout(100); await p.mouse.up(); }
  await p.waitForTimeout(300);
  console.log('autoFire now', await ev('input.autoFire'), 'toggles', await ev('story.stats.toggles'));
  const s0 = await ev('story.stats.shots'); await p.waitForTimeout(1500);
  console.log('shots while manual & idle', (await ev('story.stats.shots')) - s0);
  await skipTalk(); await waitStep(4);
  await p.waitForTimeout(1200); await p.screenshot({ path: `${out}/${tag}-tut-manual.png` });
  await ev('input.setAutoFire(true)');
  await skipTalk(); await waitStep(5);
  console.log('step', await ev('story.stepIdx'), 'enemies during briefing', await ev('enemies.enemies.length'));
  await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${tag}-tut-violet.png` });
  await skipTalk(); await p.waitForTimeout(300);
  console.log('enemies after briefing', await ev('enemies.enemies.map(e => e.type).join(",")'));
  await ev('enemies.enemies.forEach(e => e.takeDamage(1e9))');
  await waitStep(6); await skipTalk(); await waitStep(7);
  await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${tag}-tut-yellow.png` });
  console.log('step', await ev('story.stepIdx'), 'enemies during briefing', await ev('enemies.enemies.length'));
  await skipTalk(); await p.waitForTimeout(300);
  console.log('enemies after briefing', await ev('enemies.enemies.map(e => e.type).join(",")'));
  await ev('player.invincible = 0; player.takeDamage(500)'); await p.waitForTimeout(200);
  console.log('hp after big hit', await ev('player.hp'), 'alive', await ev('player.alive'), 'radio', await ev('story.radio.cur && story.radio.cur.text'));
  await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${tag}-tut-hit.png` });
  await ev('enemies.enemies.forEach(e => e.takeDamage(1e9))');
  await skipTalk(); await waitStep(8);
  console.log('step', await ev('story.stepIdx'), 'highlight', await ev('story.highlight'), 'echo dist', await ev('Math.round(Math.hypot(story.echoTarget.x - player.x, story.echoTarget.y - player.y))'));
  await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/${tag}-tut-echo.png` });
  await ev('player.x += 600'); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${tag}-tut-echo-off.png` });
  await skipTalk();
  for (let i = 0; i < 60 && (await ev('story.stepIdx')) < 9; i++) { await ev('(() => { const e = story.echoTarget; if (e) { player.x = e.x; player.y = e.y; } })()'); await p.waitForTimeout(200); }
  console.log('step', await ev('story.stepIdx'), 'echoes rescued', await ev('story.stats.echoes'), 'hp', await ev('player.hp'));
  await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${tag}-tut-last.png` });
  await skipTalk();
  for (let i = 0; i < 160 && (await ev('state')) !== 12; i++) await p.waitForTimeout(250);
  console.log('end: state', await ev('state'), 'phase', await ev('story.phase'));
  await p.waitForTimeout(800); await p.screenshot({ path: `${out}/${tag}-end.png` });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
