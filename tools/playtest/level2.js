// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Level 2 "Cold Storage": the cold map, the start kit (own cards), the
// escort (stalls when a Chromatic touches the Echo), the valves (all open at
// once), the lift exit and the results.  Args: <outdir> [desk|phone|land] [dex|juno]
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

  // Wave 1
  await skipTalk(); await waitFor('level.ready');
  for (let i = 0; i < 100 && await ev('level.idx') === 0; i++) { await ev('enemies.enemies.forEach(e => { if (!e.forming) e.takeDamage(1e9); })'); await p.waitForTimeout(250); }
  console.log('after wave 1:', await ev('level.beat.type'));

  // Escort
  await skipTalk(); await waitFor('level.ready');
  const e0 = await ev('[Math.round(level.escort.x), Math.round(level.escort.y)]'), lift = await ev('[Math.round(level.exitPos.x), Math.round(level.exitPos.y)]');
  console.log('escort starts at', JSON.stringify(e0), 'lift at', JSON.stringify(lift), '| objective', await ev('level.objective'));
  // A violet on the Echo stalls it
  await ev(`player.x = level.escort.x + 140; player.y = level.escort.y; window.__v = enemies.spawnEnemyAt('violet', level.escort.x + 10, level.escort.y); __v.spawnT = 1; __v.maxHp = __v.hp = 1e6; __v.update = () => {};`);
  await p.waitForTimeout(800);
  const s0 = await ev('[level.escort.stalled, Math.round(level.escort.x)]');
  await p.waitForTimeout(800);
  console.log('violet on the Echo: stalled', s0[0], '| moved while stalled', Math.abs((await ev('Math.round(level.escort.x)')) - s0[1]), 'px | objective', await ev('level.objective'));
  await p.screenshot({ path: `${out}/${tag}-escort-stalled.png` });
  await ev('__v.takeDamage(1e9)');
  // Lead it: stand a little ahead of the Echo, toward the lift, until it arrives
  let goalSeen = 0;
  for (let i = 0; i < 200 && await ev('level.beat.type') === 'escort'; i++) {
    goalSeen = Math.max(goalSeen, await ev('enemies.enemies.filter(e => e.isAlive && e.goal).length'));
    await ev(`(() => { const e = level.escort, l = level.exitPos; const dx = l.x - e.x, dy = l.y - e.y, d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, 110 / d); player.x = e.x + dx * k; player.y = e.y + dy * k;
      enemies.enemies.forEach(en => { if (!en.forming && Math.hypot(en.x - e.x, en.y - e.y) < 160) en.takeDamage(1e9); }); })()`);
    if (i === 20) await p.screenshot({ path: `${out}/${tag}-escort.png` });
    if (process.env.DEBUG && i % 20 === 0) console.log('  escort', JSON.stringify(await ev('[Math.round(level.escort.x), Math.round(level.escort.y), level.escort.stalled, Math.round(player.x), Math.round(player.y), level.ready, level.radio.busy]')));
    await p.waitForTimeout(200);
  }
  console.log('escort done → beat', await ev('level.beat.type'), '| interrupters that went for the Echo (max at once)', goalSeen);

  // Wave 2
  await skipTalk(); await waitFor('level.ready');
  for (let i = 0; i < 120 && await ev('level.beat.type') === 'wave'; i++) { await ev('enemies.enemies.forEach(e => { if (!e.forming) e.takeDamage(1e9); })'); await p.waitForTimeout(250); }
  console.log('after wave 2:', await ev('level.beat.type'));

  // Valves: one alone closes again; all three in a row finish it
  await skipTalk(); await waitFor('level.ready');
  const valves = await ev('level.valves.map(v => [v.x, v.y])');
  console.log('valves at', JSON.stringify(valves.map(v => v.map(Math.round))));
  await ev(`player.x = ${valves[0][0]}; player.y = ${valves[0][1]};`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${tag}-valve.png` });
  console.log('standing on valve 1 → open', (await ev('level.valves[0].open')).toFixed(1), 's | objective', await ev('level.objective'));
  for (const [x, y] of valves) { await ev(`player.x = ${x}; player.y = ${y};`); await p.waitForTimeout(300); }
  await p.waitForTimeout(300);
  console.log('all three opened → beat', await ev('level.beat.type'));

  // Exit at the lift
  await skipTalk(); await waitFor('level.ready');
  await ev('player.x = level.exitPos.x - 90; player.y = level.exitPos.y;');
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/${tag}-lift.png` });
  await ev('player.x = level.exitPos.x; player.y = level.exitPos.y + 4;');
  await waitFor('state === STATES.LEVEL_END || state === STATES.ABILITY_UNLOCK', 8000);
  console.log('after the lift: state', await ev('state'), '(14 = results; no card on Level 2)');
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/${tag}-results.png` });
  console.log('result', JSON.stringify(await ev('_levelResult')));
  console.log('clears', JSON.stringify(await ev('profile().clears')));
  await ev(`clearInterval(${god})`);
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
