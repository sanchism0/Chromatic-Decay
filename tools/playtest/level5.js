// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Level 5 "Raze's Room": Raze caged on the core, wave 1, the F ability (Dex:
// Arc Discharge, Juno: Spin Up), anchors that ignore plain rounds and crack
// under the F ability, the Signal Hoarder (nodes shield it, bursts, phase
// waves, checkpoint), the level ending on its death, the scene with Raze and
// Null, the card. Args: <outdir> [desk|phone|land] [dex|juno|raze] [post]
// post (implied for raze): Raze is already free, so the cage is empty and
// Dex and Juno get no scene after it
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] + '/lvl5', mode = process.argv[3] || 'desk', who = process.argv[4] || 'dex';
const post = who === 'raze' || process.argv[5] === 'post';
const phone = mode === 'phone' || mode === 'land', land = mode === 'land';
fs.mkdirSync(out, { recursive: true });
const tag = mode + '-' + who + (post && who !== 'raze' ? '-post' : '');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: land ? { width: 844, height: 390 } : phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: phone });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('http://127.0.0.1:8766/index.html');
  await p.evaluate(post => {
    localStorage.clear(); localStorage.setItem('chromatic_decay_prologue_done', '1');
    const clears = { 1: { dex: 1, juno: 1, raze: 1 }, 2: { dex: 1, juno: 1, raze: 1 }, 3: { dex: 1, juno: 1, raze: 1 }, 4: { dex: 1, juno: 1, raze: 1 } };
    if (post) clears[5] = { dex: 1 };
    localStorage.setItem('chromatic_decay_profile', JSON.stringify({ clears, characters: { raze: post },
      cards: { dex: ['heavy_bursts', 'shock_dash', 'stun_grenade', 'arc_round'], juno: ['hot_barrel', 'parting_charge', 'decoy_beacon', 'ricochet'],
               raze: ['follow_up', 'net', 'snare_trap', 'punch_through'] }, player: { id: 'ptest', name: 'TEST' } }));
  }, post);
  await p.reload(); await p.waitForTimeout(900);
  const ev = s => p.evaluate(c => __ev(c), s);
  const key = async k => { await p.keyboard.down(k); await p.waitForTimeout(60); await p.keyboard.up(k); await p.waitForTimeout(60); };
  const skipTalk = async () => { for (let i = 0; i < 40 && await ev('level && level.radio.busy'); i++) { if (phone) await ev('level.radio.next()'); else await key('Enter'); } };
  const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr).catch(() => false)) return true; await p.waitForTimeout(200); } return false; };
  const killAdds = () => ev('enemies.enemies.forEach(e => { if (!e.forming && !e.boss) e.takeDamage(1e9); })');
  await ev('window.__god = setInterval(() => { if (player) player.hp = player.maxHp; }, 50)');

  await ev(`selectedCharacter = "${who}"; _pendingLevel = 5; startRun({ level: 5 }); state = STATES.PLAYING;`);
  await p.waitForTimeout(600);
  console.log('level', await ev('level.id'), 'map', await ev('map.layout'), '| start kit', JSON.stringify(await ev('level.powers')), '| abilities', JSON.stringify(await ev('player.abilities')));
  await p.waitForTimeout(1600); await p.screenshot({ path: `${out}/${tag}-start.png` });
  console.log('first lines:', JSON.stringify(await ev('level.radio.queue.concat(level.radio.cur ? [level.radio.cur] : []).map(l => l.who)')));

  // Wave 1 → F ability
  await skipTalk(); await waitFor('level.ready');
  for (let i = 0; i < 100 && await ev('level.idx') === 0 && !(await ev('state === STATES.POWER_UP')); i++) { await killAdds(); await p.waitForTimeout(250); }
  await waitFor('state === STATES.POWER_UP', 8000);
  console.log('power-up', await ev('level.pendingPowerUp && level.pendingPowerUp.name'));
  await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${tag}-ability.png` });
  await ev('level.takePowerUp(player); state = STATES.PLAYING;');
  console.log('abilities', JSON.stringify(await ev('player.abilities')), '| signature', await ev('player.signature'));

  // Anchors
  await skipTalk(); await waitFor('level.ready');
  await ev('level.spawnT = 99'); await killAdds();
  await ev('window.__plain = projectiles.spawnPlayer(level.anchors[0].x, level.anchors[0].y + 80, -Math.PI / 2, 5, 520, 400, 0)');
  await p.waitForTimeout(400);
  console.log('plain shot at anchor 0: lights left', await ev('level.anchors[0].hp'), '(of 2)');
  const casts = [];
  for (let i = 0; i < 4; i++) {
    let n = 0;
    for (; n < 8 && await ev(`level.anchors && level.anchors[${i}].hp > 0`); n++) {
      await skipTalk(); await killAdds();
      await ev(`(() => { const a = level.anchors[${i}]; player.x = a.x + 34; player.y = a.y + 26; player.signatureCooldown = 0; })()`);
      if (who === 'juno' || who === 'raze') {
        if (who === 'juno') await ev(`input.setAutoFire(true)`);
        if (!phone) { const sx = await ev(`(level.anchors[${i}].x - camera.x) * ZOOM`), sy = await ev(`(level.anchors[${i}].y - 12 - camera.y) * ZOOM`); await p.mouse.move(sx, sy); }
        else await ev(`input.touchAimAngle = Math.atan2(level.anchors[${i}].y - 12 - player.y, level.anchors[${i}].x - player.x)`);
      }
      await ev(`_useAbility('signature')`);
      await p.waitForTimeout(who === 'juno' ? 4300 : 500);
      if (i === 0 && n === 0) { console.log(' after one use: lights filled', await ev('2 - level.anchors[0].hp'), '| next light', (await ev('level.anchors[0].charge')).toFixed(2)); await p.screenshot({ path: `${out}/${tag}-anchor1.png` }); }
    }
    casts.push(n);
  }
  console.log('uses per anchor', JSON.stringify(casts));
  await p.screenshot({ path: `${out}/${tag}-anchors.png` });
  await waitFor('level.beat.type === "hoarder"', 4000);
  console.log('anchors done → beat', await ev('level.beat.type'), '| checkpoint', await ev('level.checkpointLabel'));

  // Boss
  await skipTalk(); await waitFor('level.ready');
  await ev('input.setAutoFire(false)');
  await waitFor('level.boss && !level.boss.forming', 5000);
  console.log('Hoarder: hp', await ev('level.boss.hp'), '| shielded', await ev('level.boss.shielded'));
  await waitFor('level.nodes && level.nodes.length > 0', 9000);
  await p.waitForTimeout(600);
  console.log('after a blink: nodes', await ev('level.nodes.length'), '| shielded', await ev('level.boss.shielded'), '| enemy rounds in the air', await ev('projectiles.enemyProjectiles.length'));
  await p.screenshot({ path: `${out}/${tag}-boss.png` });
  const hp0 = await ev('level.boss.hp');
  await ev('level.boss.takeDamage(100)');
  console.log('hit while shielded: hp', hp0, '->', await ev('level.boss.hp'));
  await ev('level.nodes.forEach(n => n.takeDamage(1e9))');
  await p.waitForTimeout(250); await p.screenshot({ path: `${out}/${tag}-payback.png` });
  await waitFor('level.hoarderStunT > 0', 3000);
  console.log('turrets down: beams back, stunned for', (await ev('level.hoarderStunT')).toFixed(1), 's | shielded', await ev('level.boss.shielded'), '|', await ev('level.objective'));
  await p.screenshot({ path: `${out}/${tag}-stunned.png` });
  const bx = await ev('level.boss.x'); await p.waitForTimeout(1000);
  console.log('while stunned it stays put:', Math.round(Math.abs(await ev('level.boss.x') - bx)), 'px moved');
  await ev('level.boss.takeDamage(100)');
  console.log('hit while stunned: hp', await ev('Math.round(level.boss.hp)'));
  await waitFor('level.hoarderStunT <= 0', 3000);
  // Phase 1 wave at 66%
  await ev('level.nodes.forEach(n => n.takeDamage(1e9)); level.boss.shielded = false; level.boss.hp = level.boss.maxHp * 0.6');
  await waitFor('!!level.bossWave', 3000);
  console.log('at 60%: wave', !!(await ev('level.bossWave')), '| shielded', await ev('level.boss.shielded'), '|', await ev('level.objective'));
  await skipTalk();
  for (let i = 0; i < 80 && await ev('!!level.bossWave'); i++) { await skipTalk(); await killAdds(); await p.waitForTimeout(250); }
  console.log('wave cleared: shielded', await ev('level.boss.shielded'), '| Echoes', await ev('echoes.echoes.length'));
  // Checkpoint: go down at the boss
  await ev('clearInterval(__god); level.radio.clear(); player.hp = 1;');
  await waitFor('state === STATES.LEVEL_FAIL', 8000); await p.waitForTimeout(500);
  console.log('down at the boss: retry', JSON.stringify(await ev('_checkpoint && _checkpoint.label')));
  await key('Space'); await p.waitForTimeout(600);
  if (await ev('state === STATES.LEVEL_FAIL')) await ev('startRun({ level: 5, from: _checkpoint }); state = STATES.PLAYING;');
  await ev('window.__god = setInterval(() => { if (player) player.hp = player.maxHp; }, 50)');
  console.log('retry: beat', await ev('level.beat.type'), '| F kept', await ev('player.signature'), '| anchors broken', await ev('level.anchors.every(a => a.hp <= 0)'));
  await skipTalk(); await waitFor('level.boss && !level.boss.forming', 6000);
  // Kill it: the level ends, then the scene, card, results
  await ev('level.boss.shielded = false; level.nodes.forEach(n => n.takeDamage(1e9)); level.bossPhase = 2; level.boss.takeDamage(1e9);');
  await waitFor('state === STATES.STORY' + (post && who !== 'raze' ? ' || state === STATES.ABILITY_UNLOCK || state === STATES.LEVEL_END' : ''), 10000);
  console.log('boss down → scene:', await ev('state === STATES.STORY && story.phase'), '| lines', await ev('story.scene && story.scene.lines.length'));
  await p.waitForTimeout(700); await p.screenshot({ path: `${out}/${tag}-raze.png` });
  for (let i = 0; i < 12; i++) { await ev('story.updateScene(0.016, true)'); await p.waitForTimeout(80); }
  await p.waitForTimeout(600); await p.screenshot({ path: `${out}/${tag}-null.png` });
  for (let i = 0; i < 40 && await ev('state === STATES.STORY'); i++) { await ev('story.updateScene(0.016, true)'); await p.waitForTimeout(60); }
  await waitFor('state === STATES.ABILITY_UNLOCK || state === STATES.LEVEL_END', 6000);
  if (await ev('state === STATES.ABILITY_UNLOCK')) { await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${tag}-card.png` }); await ev('_unlockT = 1'); await key('Enter'); await waitFor('state === STATES.LEVEL_END', 5000); }
  console.log('results: state', await ev('state'), '|', await ev('_levelResult && _levelResult.outcome'));
  await p.screenshot({ path: `${out}/${tag}-results.png` });
  console.log('cards now', JSON.stringify(await ev('profile().cards')));
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
