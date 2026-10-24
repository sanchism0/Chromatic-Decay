// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] + '/lvl', phone = process.argv[3] === 'phone' || process.argv[3] === 'land', land = process.argv[3] === 'land', who = process.argv[4] || 'dex';
const tag = (land ? 'land' : phone ? 'phone' : 'desk') + '-' + who;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: land ? { width: 844, height: 390 } : phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: phone });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !m.text().includes('TUNNEL') && errs.push(m.text()));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(require('path').join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.goto('http://127.0.0.1:8766/index.html');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('chromatic_decay_prologue_done', '1'); localStorage.setItem('chromatic_decay_autofire', '0'); });
  await p.reload(); await p.waitForTimeout(900);
  const ev = s => p.evaluate(c => __ev(c), s);
  await ev("setPlayerName('TEST')");
  const click = async r => { if (phone) await p.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); else { await p.mouse.move(r.x + r.w / 2, r.y + r.h / 2); await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up(); } await p.waitForTimeout(250); };
  const key = async k => { await p.keyboard.down(k); await p.waitForTimeout(60); await p.keyboard.up(k); await p.waitForTimeout(60); };
  const skipTalk = async () => { for (let i = 0; i < 40 && await ev('level && level.radio.busy'); i++) await key('Enter'); };
  let picks = 0, shotUp = false;
  let powerShots = 0;
  const pick = async () => {
    while (await ev('state === STATES.POWER_UP')) {
      await p.waitForTimeout(950);
      if (powerShots++ === 0) await p.screenshot({ path: `${out}/${tag}-powerup.png` });
      await click(await ev('_unlockBtn.r')); picks++;
      await p.waitForTimeout(150);
    }
    while (await ev('state === STATES.UPGRADE')) {
      if (!shotUp) { shotUp = true; await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${tag}-upgrade.png` }); }
      const c = await ev('upgradeUI._cardLayouts(canvas.width, canvas.height)[0]');
      await click(c); picks++;
      await p.waitForTimeout(150);
    }
  };
  const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 200; i++) { await pick(); if (await ev(expr)) return true; await p.waitForTimeout(200); } return false; };

  await click(await ev('_titleBtns.story'));
  console.log('story map state', await ev('state'));
  await p.screenshot({ path: `${out}/${tag}-map.png` });
  await click(await ev('_mapBtns.rows.find(r => r.id === 1).r'));
  console.log('char select', await ev('state'), await ev('_csMode'));
  await ev(`selectedCharacter = "${who}"`); await key('Space');
  await p.waitForTimeout(500);
  console.log('level', await ev('!!level'), 'beat', await ev('level.beat.type'), 'agent', await ev('level.agent'), 'signature', await ev('player.signature'));
  await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${tag}-mission.png` });
  await p.waitForTimeout(1400); await p.screenshot({ path: `${out}/${tag}-start.png` });

  // Wave 1
  await skipTalk(); await waitFor('level.ready');
  await p.waitForTimeout(800);
  console.log('wave1 enemies after briefing', await ev('enemies.enemies.length'));
  await p.screenshot({ path: `${out}/${tag}-wave1.png` });
  for (let i = 0; i < 100 && await ev('level.idx') === 0; i++) { await ev('enemies.enemies.forEach(e => { if (!e.forming) e.takeDamage(1e9); })'); await p.waitForTimeout(250); await pick(); }
  console.log('after wave1 beat', await ev('level.beat.type'), 'chroma', JSON.stringify(await ev('level.chroma')));

  // Relays
  await skipTalk(); await waitFor('level.ready');
  const relays = await ev('level.relays.map(r => [r.x, r.y])');
  // An enemy standing in the relay blocks the charge
  await ev(`player.x = ${relays[0][0]}; player.y = ${relays[0][1]}; enemies.spawnEnemyAt('violet', ${relays[0][0] + 20}, ${relays[0][1]})`);
  await p.waitForTimeout(1500);
  console.log('charge with enemy inside', (await ev('level.relays[0].charge')).toFixed(3), 'drain', await ev('level.relays[0].drain'));
  await ev('enemies.enemies.forEach(e => e.takeDamage(1e9))');
  await p.waitForTimeout(2500);
  console.log('charge after clearing (2.5s)', (await ev('level.relays[0].charge')).toFixed(3), 'motes', await ev('level.motes.length'));
  await p.screenshot({ path: `${out}/${tag}-relay.png` });
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 80 && !(await ev(`level.relays[${k}].done`)); i++) {
      await ev(`player.x = ${relays[k][0]}; player.y = ${relays[k][1]}; player.hp = player.maxHp; enemies.enemies.forEach(e => { if (Math.hypot(e.x - player.x, e.y - player.y) < 140) e.takeDamage(1e9); })`);
      await p.waitForTimeout(250); await pick();
    }
    console.log('relay', k, 'done', await ev(`level.relays[${k}].done`), 'interrupters seen', await ev('enemies.enemies.length'), 'echoes', await ev('echoes.echoes.length'));
  }
  await waitFor('level.idx === 2');
  console.log('beat', await ev('level.beat.type'), 'charge', await ev('level.charge'));

  // Wave 2
  await skipTalk(); await waitFor('level.ready');
  for (let i = 0; i < 120 && await ev('level.idx') === 2; i++) { await ev('player.hp = player.maxHp; enemies.enemies.forEach(e => { if (!e.forming) e.takeDamage(1e9); })'); await p.waitForTimeout(250); await pick(); }
  console.log('beat', await ev('level.beat.type'), 'power-ups taken', picks, JSON.stringify(await ev('level.powers')), 'player', JSON.stringify(await ev('[player.projCount, player.piercingShots, !!player.kineticFinish, player.rackBounce || 0, !!player.grenade]')));

  // Servers: shoot each of the four
  const godId = await ev('setInterval(() => { player.hp = player.maxHp; }, 50)');
  await skipTalk(); await waitFor('level.ready && level.beat.type === "servers"');
  const servers = await ev('level.servers.map(s => [s.o.x, s.o.y, s.o.w, s.o.h])');
  console.log('servers at', JSON.stringify(servers.map(([x, y, w, h]) => [Math.round((x + w / 2) / 11.74) + '%', Math.round((y + h / 2) / 11.74) + '%'])));
  for (let k = 0; k < 4; k++) { await p.waitForTimeout(2000); console.log('swarm alive at', (k + 1) * 2 + 's', await ev('enemies.enemies.filter(e => e.isAlive).map(e => e.type[0]).join("")')); }
  await p.screenshot({ path: `${out}/${tag}-servers.png` });
  for (let i = 0; i < servers.length; i++) {
    const [x, y, w, h] = servers[i];
    const fromLeft = x > 80;
    await ev(`player.x = ${fromLeft ? x - 60 : x + w + 60}; player.y = ${y + h / 2};`);
    await p.waitForTimeout(300);
    if (i === 1) await p.screenshot({ path: `${out}/${tag}-server-near.png` });
    await ev(`projectiles.spawnPlayer(${fromLeft ? x - 40 : x + w + 40}, ${y + h / 2}, ${fromLeft ? 0 : Math.PI}, 1, 360, 200)`);
    await p.waitForTimeout(400);
    await pick();
    console.log('server', i, 'lit', await ev(`level.servers[${i}].lit`), 'objective', await ev('level.objective'));
  }
  console.log('after servers beat', await ev('level.beat.type'), 'radio', await ev('level.radio.cur && level.radio.cur.text'));
  await p.screenshot({ path: `${out}/${tag}-servers-done.png` });

  // Exit
  await skipTalk();
  const ex = await ev('[level.exitPos.x, level.exitPos.y]');
  await waitFor('level.ready');
  await p.screenshot({ path: `${out}/${tag}-exit.png` });
  await ev(`player.x = ${ex[0]}; player.y = ${ex[1]} + 10`);
  await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${tag}-extract.png` });
  await p.waitForTimeout(450); await p.screenshot({ path: `${out}/${tag}-beamout1.png` });
  console.log('extract', await ev('[level.extractT.toFixed(2), player.beaming, player.beamOutT && player.beamOutT.toFixed(2)]'));
  await p.waitForTimeout(450); await p.screenshot({ path: `${out}/${tag}-beamout2.png` });
  await waitFor('state === STATES.ABILITY_UNLOCK', 6000); await p.waitForTimeout(1000);
  console.log('door -> unlock screen', await ev('state'));
  await p.screenshot({ path: `${out}/${tag}-unlock.png` });
  await click(await ev('_unlockBtn.r'));
  console.log('took it: cards', JSON.stringify(await ev('profile().cards')));
  await waitFor('state === STATES.LEVEL_END', 5000);
  await p.waitForTimeout(900);
  await ev(`clearInterval(${godId})`);
  console.log('end state', await ev('state'), 'result', JSON.stringify(await ev('_levelResult')));
  console.log('profile', JSON.stringify(await ev('profile()')));
  await p.screenshot({ path: `${out}/${tag}-results.png` });
  await click(await ev('_levelEndBtns.cont'));
  console.log('back to map', await ev('state'));
  await p.screenshot({ path: `${out}/${tag}-map2.png` });

  // Going down: death burst, then the level-failed screen
  await ev(`selectedCharacter = "${who}"; startRun({ level: 1 })`);
  await p.waitForTimeout(1300); await skipTalk(); await waitFor('level.ready'); await p.waitForTimeout(800);
  await ev('player.invincible = 0; player.takeDamage(1e4)');
  await p.waitForTimeout(200);
  console.log('down -> state', await ev('state'), '(15 = dying)');
  for (const t of [0.2, 0.5, 0.9, 1.4]) { await ev(`_death.t = ${t}`); await p.screenshot({ path: `${out}/${tag}-death-${t}.png` }); }
  await waitFor('state === STATES.LEVEL_FAIL', 5000); await p.waitForTimeout(600);
  console.log('fail state', await ev('state'), 'kept', JSON.stringify(await ev('_levelFail.kept')));
  await p.screenshot({ path: `${out}/${tag}-fail.png` });
  await click(await ev('_failBtns.restart'));
  console.log('restart -> level', await ev('!!level'), 'state', await ev('state'), 'beat', await ev('level.idx'));
  await waitFor('!player.beaming');

  // Signature in use
  await waitFor('!player.beaming');
  await skipTalk();
  const before = await ev('projectiles.playerProjectiles.length');
  if (phone) { const sb = await ev('_sigBtn.r'); console.log('touch signature button', !!sb); if (sb) await click(sb); } else await key('f');
  await p.waitForTimeout(100);
  console.log('signature cd', (await ev('player.signatureCooldown')).toFixed(1), 'shots before/after', before, await ev('projectiles.playerProjectiles.length'), 'spinUp', await ev('player.spinUpTimer'));
  await p.screenshot({ path: `${out}/${tag}-signature.png` });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
