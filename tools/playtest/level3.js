// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Level 3 "The Stacks": the stacks map, the thrown ability granted after wave
// 1 (Dex: Stun Grenade, Juno: Decoy Beacon) and what it does to enemies, the
// terminal hold (blocked by a Chromatic in the ring until it's stunned or
// lured out), the beam puzzle (mirrors turned by landing the ability on them),
// The Queue (rings, dash through them, splits), the vault exit, the card.
// Args: <outdir> [desk|phone|land] [dex|juno]
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] + '/lvl3', mode = process.argv[3] || 'desk', who = process.argv[4] || 'dex';
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
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('chromatic_decay_prologue_done', '1');
    localStorage.setItem('chromatic_decay_profile', JSON.stringify({ clears: { 1: { dex: 1, juno: 1 }, 2: { dex: 1, juno: 1 } },
      cards: { dex: ['heavy_bursts', 'shock_dash'], juno: ['hot_barrel', 'parting_charge'] }, player: { id: 'ptest', name: 'TEST' } }));
  });
  await p.reload(); await p.waitForTimeout(900);
  const ev = s => p.evaluate(c => __ev(c), s);
  const click = async r => { if (phone) await p.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); else { await p.mouse.move(r.x + r.w / 2, r.y + r.h / 2); await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up(); } await p.waitForTimeout(250); };
  const key = async k => { await p.keyboard.down(k); await p.waitForTimeout(60); await p.keyboard.up(k); await p.waitForTimeout(60); };
  const skipTalk = async () => { for (let i = 0; i < 40 && await ev('level && level.radio.busy'); i++) { if (phone) await ev('level.radio.next()'); else await key('Enter'); } };
  const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr).catch(e => { console.log('  (waitFor error: ' + e.message.split('\n')[0] + ' | log ' + JSON.stringify(0) + ')'); return 'ERR'; }) ) return true; await p.waitForTimeout(200); } return false; };
  const killAll = () => ev('enemies.enemies.forEach(e => { if (!e.forming && !e.boss) e.takeDamage(1e9); })');
  await ev('window.__god = setInterval(() => { if (player) player.hp = player.maxHp; }, 50)');
  const id = who === 'dex' ? 'grenade' : 'decoy';

  await click(await ev('_titleBtns.story'));
  await click(await ev('_mapBtns.rows.find(r => r.id === 3).r'));
  await ev(`selectedCharacter = "${who}"`); await key('Space');
  await p.waitForTimeout(600);
  console.log('level', await ev('level && level.id'), 'map', await ev('map.layout'), '| start kit', JSON.stringify(await ev('level.powers')));
  await p.waitForTimeout(2200); await p.screenshot({ path: `${out}/${tag}-start.png` });

  // Nothing may spawn inside the sealed pockets
  const inPocket = '((x, y) => map.noSpawn.some(o => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h))';
  console.log('random spawns in a sealed pocket (of 2000):', await ev(`(() => { let n = 0; for (let i = 0; i < 2000; i++) { const sp = map.randomSpawn(player.x, player.y, [], 300, 0); if (${inPocket}(sp.x, sp.y)) n++; } return n; })()`),
    '| pockets', await ev('map.noSpawn.length'));
  await ev(`window.__inPocket = 0; window.__pk = setInterval(() => { for (const e of enemies.enemies) if (e.isAlive && ${inPocket}(e.x, e.y)) __inPocket++; }, 100);`);

  // Wave 1, then the thrown ability
  await skipTalk(); await waitFor('level.ready');
  for (let i = 0; i < 100 && await ev('level.idx') === 0 && !(await ev('state === STATES.POWER_UP')); i++) { await killAll(); await p.waitForTimeout(250); }
  await waitFor('state === STATES.POWER_UP', 8000);
  console.log('after wave 1: power-up', await ev('level.pendingPowerUp && level.pendingPowerUp.name'));
  await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${tag}-ability.png` });
  await ev('level.takePowerUp(player); state = STATES.PLAYING;');
  console.log('abilities', JSON.stringify(await ev('player.abilities')), '| throw button', await ev('_throwId()'));

  // The ability on enemies (during the hold briefing nothing else spawns)
  await skipTalk(); await waitFor('level.ready');
  await killAll(); await p.waitForTimeout(200);
  await ev(`level.ready = false; window.__vs = [0, 1, 2].map(i => { const e = enemies.spawnEnemyAt('violet', player.x + 150 + i * 20, player.y + 120); e.spawnT = 1; e.maxHp = e.hp = 999; return e; });
    player.${id}Cooldown = 0;`);
  const d0 = await ev('__vs.map(e => Math.round(Math.hypot(e.x - player.x, e.y - player.y)))');
  await ev(`_useAbility('${id}', { x: player.x + 160, y: player.y + 120 })`);
  await p.waitForTimeout(1500);
  if (who === 'dex') console.log('grenade on 3 violets: stunned', JSON.stringify(await ev('__vs.map(e => +e.stunTimer.toFixed(2))')), '| jammed', JSON.stringify(await ev('__vs.map(e => +e.jammed.toFixed(2))')));
  else {
    const d1 = await ev('__vs.map(e => Math.round(Math.hypot(e.x - player.x, e.y - player.y)))');
    const bd = await ev('decoys.beacon ? __vs.map(e => Math.round(Math.hypot(e.x - decoys.beacon.x, e.y - decoys.beacon.y))) : null');
    console.log('decoy: violets to player', JSON.stringify(d0), '->', JSON.stringify(d1), '| to beacon', JSON.stringify(bd), '| lure', JSON.stringify(await ev('enemies.lure')));
  }
  await p.screenshot({ path: `${out}/${tag}-throw.png` });
  await ev('__vs.forEach(e => e.takeDamage(1e9)); level.ready = true;');
  await p.waitForTimeout(300);

  // Hold: stand in the ring; a Chromatic in the ring blocks it
  await ev('player.x = level.hold.x; player.y = level.hold.y + 30; level.spawnT = 99;');
  await p.waitForTimeout(1500);
  console.log('hold: in ring, pull', (await ev('level.hold.p')).toFixed(2), '|', await ev('level.objective'));
  await ev(`window.__b = enemies.spawnEnemyAt('violet', level.hold.x + 30, level.hold.y); __b.spawnT = 1; __b.maxHp = __b.hp = 999;`);
  await p.waitForTimeout(600);
  const pb = await ev('level.hold.p');
  console.log('enemy in ring:', await ev('level.objective'), '| pull holds at', (await ev('level.hold.p')).toFixed(3));
  await p.screenshot({ path: `${out}/${tag}-hold.png` });
  // Dex stuns it where it is; Juno throws the beacon outside the ring to pull it out
  await ev(`player.${id}Cooldown = 0; _useAbility('${id}', ${who === 'dex' ? '{ x: __b.x, y: __b.y }' : '{ x: level.hold.x - 150, y: level.hold.y + 20 }'})`);
  await p.waitForTimeout(who === 'dex' ? 900 : 2600);
  const pa = await ev('level.hold.p');
  console.log(`after the ${id}: crowd`, await ev('level.hold.crowd'), '| pull', pb.toFixed(3), '->', pa.toFixed(3));
  await ev('__b.takeDamage(1e9); level.hold.p = 0.97;');
  await waitFor('level.beat.type !== "hold"', 5000);
  console.log('hold done → beat', await ev('level.beat.type'), '| Echoes on the floor', await ev('echoes.echoes.length'));

  // Wave 2
  await skipTalk(); await waitFor('level.ready');
  for (let i = 0; i < 120 && await ev('level.beat.type') === 'wave'; i++) { await killAll(); await p.waitForTimeout(250); }
  console.log('after wave 2:', await ev('level.beat.type'), '| enemy samples inside a pocket so far:', await ev('__inPocket'));

  // Beam: land the ability on each mirror from open floor nearby
  await skipTalk(); await waitFor('level.ready');
  await ev('level.spawnT = 99'); await killAll();
  console.log('mirrors', JSON.stringify(await ev('level.mirrors.map(m => [Math.round(m.x), Math.round(m.y), m.ok])')), '|', await ev('level.objective'));
  await p.screenshot({ path: `${out}/${tag}-beam0.png` });
  for (let i = 0; i < 3; i++) {
    await ev(`(() => { const m = level.mirrors[${i}]; const a = Math.atan2(level.exitPos.y - m.y, level.exitPos.x - m.x);
      const spot = [0, 0.6, -0.6, 1.2, -1.2].map(o => ({ x: m.x + Math.cos(a + o) * 150, y: m.y + Math.sin(a + o) * 150 }))
        .find(s => !map.obstacles.some(r => s.x > r.x - 14 && s.x < r.x + r.w + 14 && s.y > r.y - 14 && s.y < r.y + r.h + 14));
      player.x = spot.x; player.y = spot.y; player.${id}Cooldown = 0; _useAbility('${id}', { x: m.x, y: m.y }); })()`);
    await p.waitForTimeout(1000); await skipTalk(); await p.waitForTimeout(200);
    console.log(` threw at mirror ${i}: ok`, await ev(`level.mirrors[${i}].ok`), '| chain', await ev('level._beamChain()'), '| cooldown left', (await ev(`player.${id}Cooldown`)).toFixed(1));
  }
  await p.screenshot({ path: `${out}/${tag}-beam3.png` });
  await waitFor('level.beat.type === "boss"', 4000);
  console.log('beam done → beat', await ev('level.beat.type'));

  // Boss
  await skipTalk(); await waitFor('level.ready');
  await waitFor('level.boss && !level.boss.forming', 4000);
  await ev('input.setAutoFire(false); player.x = level.exitPos.x; player.y = level.exitPos.y + 200;');
  await killAll();
  console.log('The Queue: hp', await ev('level.boss.hp'), 'size', await ev('level.boss.size'));
  await ev('clearInterval(__god); player.hp = player.maxHp; window.__hits = []; const _td = player.takeDamage.bind(player); player.takeDamage = a => { const r = _td(a); if (r) __hits.push(a); return r; }; level.boss._spd = level.boss.cfg.move_speed; level.boss.cfg.move_speed = 0;');
  await waitFor('level.rings.length > 0', 6000);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/${tag}-boss.png` });
  await waitFor('level.rings.length === 0 || level.rings.every(r => r.hit)', 5000);
  console.log('ring met standing still: damage taken', JSON.stringify(await ev('__hits')));
  await ev('__hits = [];');
  await waitFor('level.rings.some(r => !r.hit && Math.abs(Math.hypot(player.x - r.x, player.y - r.y) - r.r) < 30)', 8000);
  await ev('player.dashCooldown = 0; player.dashQueued = true; player.dashToward = { x: level.boss.x, y: level.boss.y };');
  await p.waitForTimeout(500);
  console.log('dashed through a ring: damage taken', JSON.stringify(await ev('__hits')), '| perfect dodge refund: dash cooldown', (await ev('player.dashCooldown')).toFixed(2));
  await ev('window.__god = setInterval(() => { if (player) player.hp = player.maxHp; }, 50); level.boss.cfg.move_speed = level.boss._spd;');
  await ev('level.boss.hp = level.boss.maxHp * 0.7');
  await p.waitForTimeout(400);
  console.log('at 70%: splits', await ev('level.splitIdx'), '| enemies', await ev('enemies.enemies.filter(e => e.isAlive).length'), '| Echoes', await ev('echoes.echoes.length'));
  await p.screenshot({ path: `${out}/${tag}-split.png` });
  await skipTalk();
  // How long the agent's gun takes on it: aim at it with auto-fire on (splits off)
  await ev('enemies.enemies.forEach(e => { if (!e.boss) e.takeDamage(1e9); }); level.splitIdx = 3; level.boss.hp = level.boss.maxHp; level.boss.cfg.move_speed = 0; input.setAutoFire(true); window.__t0 = performance.now(); player.x = level.boss.x; player.y = level.boss.y + 150;');
  if (!phone) await p.mouse.move(await ev('(level.boss.x - camera.x) * ZOOM'), await ev('(level.boss.y - camera.y) * ZOOM'));
  else await ev('input.touchAimAngle = -Math.PI / 2');
  await waitFor('!level.boss.isAlive || level.boss.hp < level.boss.maxHp * 0.5', 40000);
  const secs = (await ev('performance.now() - __t0')) / 1000, frac = 1 - await ev('Math.max(0, level.boss.hp) / level.boss.maxHp');
  console.log(`gun on The Queue: ${Math.round(frac * 100)}% in ${secs.toFixed(1)} s → full kill about ${(secs / Math.max(frac, 0.01)).toFixed(0)} s`);
  await ev('level.boss.takeDamage(1e9)');
  await waitFor('level.beat.type === "exit"', 4000);
  console.log('Queue down: beat', await ev('level.beat.type'), '| enemies left', await ev('enemies.enemies.filter(e => e.isAlive).length'));

  // Exit through the vault
  await skipTalk();
  await ev('player.x = level.exitPos.x; player.y = level.exitPos.y;');
  await waitFor('state === 17 || state === 14', 9000);
  console.log('after the vault: state', await ev('state'), '(17 = card unlock)');
  if (await ev('state === STATES.ABILITY_UNLOCK')) { await p.waitForTimeout(1000); await p.screenshot({ path: `${out}/${tag}-card.png` }); await ev('_unlockT = 1'); if (phone) await ev('_unlockT = 1'); await key('Enter'); await waitFor('state === STATES.LEVEL_END', 5000); }
  console.log('results: state', await ev('state'), '|', JSON.stringify(await ev('_levelResult && { outcome: _levelResult.outcome, chroma: _levelResult.chroma }')));
  await p.screenshot({ path: `${out}/${tag}-results.png` });
  console.log('cards now', JSON.stringify(await ev('profile().cards')));
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
