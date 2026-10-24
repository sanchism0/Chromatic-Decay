// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Level 2 "Cold Storage": the cold map, the start kit (own cards), the dash
// ability granted after wave 1 (Dex: Shock Dash, Juno: Parting Charge), an
// all-ice floor you slide on, the frozen drives, the frozen tanks only a dash ability can
// crack, the lift exit, the card and the results.
// Args: <outdir> [desk|phone|land] [dex|juno]
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] + '/lvl2', mode = process.argv[3] || 'desk', who = process.argv[4] || 'dex';
const phone = mode === 'phone' || mode === 'land', land = mode === 'land';
fs.mkdirSync(out, { recursive: true });
const tag = mode + '-' + who;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: land ? { width: 844, height: 390 } : phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: phone });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('http://127.0.0.1:8766/index.html');
  // Level 1 already cleared by both, and each kept their Level 1 card
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('chromatic_decay_prologue_done', '1');
    localStorage.setItem('chromatic_decay_profile', JSON.stringify({ clears: { 1: { dex: 1, juno: 1 } }, cards: { dex: ['heavy_bursts'], juno: ['hot_barrel'] }, player: { id: 'ptest', name: 'TEST' } }));
  });
  await p.reload(); await p.waitForTimeout(900);
  const ev = s => p.evaluate(c => __ev(c), s);
  const click = async r => { if (phone) await p.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); else { await p.mouse.move(r.x + r.w / 2, r.y + r.h / 2); await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up(); } await p.waitForTimeout(250); };
  const key = async k => { await p.keyboard.down(k); await p.waitForTimeout(60); await p.keyboard.up(k); await p.waitForTimeout(60); };
  const skipTalk = async () => { for (let i = 0; i < 40 && await ev('level && level.radio.busy'); i++) { if (phone) await ev('level.radio.next()'); else await key('Enter'); } };
  const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr)) return true; await p.waitForTimeout(200); } return false; };
  const god = await ev('setInterval(() => { if (player) player.hp = player.maxHp; }, 50)');

  await click(await ev('_titleBtns.story'));
  await p.screenshot({ path: `${out}/${tag}-map.png` });
  await click(await ev('_mapBtns.rows.find(r => r.id === 2).r'));
  console.log('char select state', await ev('state'), await ev('_csMode'), 'pending level', await ev('_pendingLevel'));
  await p.screenshot({ path: `${out}/${tag}-charselect.png` });
  await ev(`selectedCharacter = "${who}"`); await key('Space');
  await p.waitForTimeout(600);
  console.log('level', await ev('level && level.id'), 'map', await ev('map.layout'), '| start kit powers', JSON.stringify(await ev('level.powers')), 'projCount', await ev('player.projCount'));
  await p.waitForTimeout(2200); await p.screenshot({ path: `${out}/${tag}-start.png` });

  // Wave 1, then the dash ability
  await skipTalk(); await waitFor('level.ready');
  for (let i = 0; i < 100 && await ev('level.idx') === 0 && !(await ev('state === STATES.POWER_UP')); i++) { await ev('enemies.enemies.forEach(e => { if (!e.forming) e.takeDamage(1e9); })'); await p.waitForTimeout(250); }
  await waitFor('state === STATES.POWER_UP', 8000);
  console.log('after wave 1: power-up screen', await ev('state === STATES.POWER_UP'), '|', await ev('level.pendingPowerUp && level.pendingPowerUp.name'));
  await p.waitForTimeout(1000); await p.screenshot({ path: `${out}/${tag}-ability.png` });
  await ev('level.takePowerUp(player); state = STATES.PLAYING;');
  console.log('has it:', who === 'dex' ? 'shockDash ' + await ev('player.shockDash') : 'dashBomb ' + await ev('player.dashBomb'), '| HUD powers', JSON.stringify(await ev('level.powers')));

  // The ability on enemies
  await skipTalk(); await waitFor('level.ready');
  await ev('enemies.enemies.forEach(e => e.takeDamage(1e9)); player.dashCooldown = 0;');
  await p.waitForTimeout(300);
  if (who === 'dex') {
    await ev(`window.__v = enemies.spawnEnemyAt('violet', player.x + 50, player.y); __v.spawnT = 1; __v.maxHp = __v.hp = 1000; player.dashCooldown = 0; player.dashQueued = true; player.dashToward = { x: player.x + 200, y: player.y };`);
    await p.waitForTimeout(250);
    console.log('Shock Dash through a violet: stunned', (await ev('__v.stunTimer')).toFixed(2), 's, jammed', (await ev('__v.jammed')).toFixed(2), 's, hp', Math.round(await ev('__v.hp')));
  } else {
    await ev(`window.__v = enemies.spawnEnemyAt('violet', player.x - 30, player.y); __v.spawnT = 1; __v.maxHp = __v.hp = 1000; __v.update = () => {}; player.dashCooldown = 0; player.dashQueued = true; player.dashToward = { x: player.x + 200, y: player.y };`);
    await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${tag}-bomb.png` });
    await p.waitForTimeout(600);
    console.log('Parting Charge next to a violet: its hp', Math.round(await ev('__v.hp')), '(was 1000)');
  }
  await ev('enemies.enemies.forEach(e => e.takeDamage(1e9))');

  // Drives on the ice: sliding, then grab all three
  const drives = await ev('level.drives.map(d => [d.x, d.y])');
  console.log('drives at', JSON.stringify(drives.map(d => d.map(Math.round))), '| objective', await ev('level.objective'));
  await ev(`player.x = CONFIG.map_width * 0.66; player.y = CONFIG.map_height * 0.88;`);
  await p.waitForTimeout(200);
  console.log('on ice:', await ev('player.onIce'));
  if (!phone) {
    await p.keyboard.down('d'); await p.waitForTimeout(600); await p.keyboard.up('d');
    const x0 = await ev('player.x'); await p.waitForTimeout(400);
    console.log('let go of D on the ice: slid on', Math.round((await ev('player.x')) - x0), 'px');
  }
  await p.screenshot({ path: `${out}/${tag}-ice.png` });
  for (const [x, y] of drives) { await ev(`player.x = ${x}; player.y = ${y}; enemies.enemies.forEach(e => e.takeDamage(1e9));`); await p.waitForTimeout(300); }
  await waitFor('level.beat.type !== "drives"', 4000);
  console.log('drives done → beat', await ev('level.beat.type'));

  // Wave 2
  await skipTalk(); await waitFor('level.ready');
  for (let i = 0; i < 120 && await ev('level.beat.type') === 'wave'; i++) { await ev('enemies.enemies.forEach(e => { if (!e.forming) e.takeDamage(1e9); })'); await p.waitForTimeout(250); }
  console.log('after wave 2:', await ev('level.beat.type'));

  // Frozen tanks: bullets do nothing; the dash ability cracks them (twice each)
  await skipTalk(); await waitFor('level.ready');
  const tanks = await ev('level.tanks.map(t => [t.x, t.y])');
  await ev(`player.x = ${tanks[0][0]} - 60; player.y = ${tanks[0][1]};`);
  await p.waitForTimeout(200);
  await ev(`for (let i = 0; i < 6; i++) projectiles.spawnPlayer(player.x, player.y, 0, 50, 400, 200);`);
  await p.waitForTimeout(500);
  console.log('shot a tank 6 times: its hits left', await ev('level.tanks[0].hp'), '(2 = untouched)');
  await p.screenshot({ path: `${out}/${tag}-tank.png` });
  for (let k = 0; k < tanks.length; k++) {
    for (let h = 0; h < 2; h++) {
      const [tx, ty] = tanks[k];
      // Dex dashes through it; Juno dashes away from it (the charge drops by it)
      if (who === 'dex') await ev(`player.x = ${tx} - 50; player.y = ${ty}; player.dashCooldown = 0; player.dashQueued = true; player.dashToward = { x: ${tx} + 200, y: ${ty} };`);
      else await ev(`player.x = ${tx} - 24; player.y = ${ty}; player.dashCooldown = 0; player.dashQueued = true; player.dashToward = { x: ${tx} - 300, y: ${ty} };`);
      await p.waitForTimeout(who === 'dex' ? 400 : 1000);
      await ev('enemies.enemies.forEach(e => e.takeDamage(1e9))');
    }
    console.log('tank', k, 'hits left', await ev(`level.tanks[${k}].hp`));
  }
  await waitFor('level.beat.type !== "freezers"', 4000);
  console.log('tanks done → beat', await ev('level.beat.type'));

  // Exit at the lift
  await skipTalk(); await waitFor('level.ready');
  await ev('player.x = level.exitPos.x - 90; player.y = level.exitPos.y;');
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/${tag}-lift.png` });
  await ev('player.x = level.exitPos.x; player.y = level.exitPos.y + 4;');
  await waitFor('state === STATES.LEVEL_END || state === STATES.ABILITY_UNLOCK', 8000);
  console.log('after the lift: state', await ev('state'), '(17 = card unlock)');
  if (await ev('state === STATES.ABILITY_UNLOCK')) { await p.waitForTimeout(1000); await p.screenshot({ path: `${out}/${tag}-card.png` }); await ev('_unlockT = 1'); await key('Enter'); await waitFor('state === STATES.LEVEL_END', 5000); }
  console.log('cards now', JSON.stringify(await ev('profile().cards')));
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/${tag}-results.png` });
  console.log('result', JSON.stringify(await ev('_levelResult')));
  console.log('clears', JSON.stringify(await ev('profile().clears')));
  await ev(`clearInterval(${god})`);
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
