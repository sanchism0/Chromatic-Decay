// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Level 4 "Wire Room": greens in wave 1, the ability (Dex: Arc Round, Juno:
// Ricochet), junction boxes that ignore plain rounds and open only to an arc
// jump (off a cable or a Chromatic) or a bounced round, the pieces, the
// tuning dials, then the escape: live wires (walking in zaps you back,
// dashing goes through), the timer running out (DOOR SEALED, retry from the
// escape), and getting out. Args: <outdir> [desk|phone|land] [dex|juno]
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] + '/lvl4', mode = process.argv[3] || 'desk', who = process.argv[4] || 'dex';
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
    localStorage.setItem('chromatic_decay_profile', JSON.stringify({ clears: { 1: { dex: 1, juno: 1 }, 2: { dex: 1, juno: 1 }, 3: { dex: 1, juno: 1 } },
      cards: { dex: ['heavy_bursts', 'shock_dash', 'stun_grenade'], juno: ['hot_barrel', 'parting_charge', 'decoy_beacon'] }, player: { id: 'ptest', name: 'TEST' } }));
  });
  await p.reload(); await p.waitForTimeout(900);
  const ev = s => p.evaluate(c => __ev(c), s);
  const key = async k => { await p.keyboard.down(k); await p.waitForTimeout(60); await p.keyboard.up(k); await p.waitForTimeout(60); };
  const skipTalk = async () => { for (let i = 0; i < 40 && await ev('level && level.radio.busy'); i++) { if (phone) await ev('level.radio.next()'); else await key('Enter'); } };
  const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr).catch(() => false)) return true; await p.waitForTimeout(200); } return false; };
  const killAll = () => ev('enemies.enemies.forEach(e => { if (!e.forming) e.takeDamage(1e9); })');
  await ev('window.__god = setInterval(() => { if (player) player.hp = player.maxHp; }, 50)');
  // A shot at a target the way the player would make it. kind: 'plain' straight
  // at it, 'arc' an Arc Round into the cable beside it, 'bounce' a ricochet off
  // that cable into it
  await ev(`window.__shoot = (t, kind) => {
    let best = null, bd = 1e9;
    for (const o of map.obstacles) { const cx = Math.max(o.x, Math.min(t.x, o.x + o.w)), cy = Math.max(o.y, Math.min(t.y, o.y + o.h)); const d = Math.hypot(t.x - cx, t.y - cy); if (d < bd) { bd = d; best = { cx, cy, o }; } }
    const nx = (t.x - best.cx) / bd, ny = (t.y - best.cy) / bd, tx = -ny, ty = nx;
    let s;
    if (kind === 'plain') { s = projectiles.spawnPlayer(t.x + nx * 70, t.y + ny * 70, Math.atan2(-ny, -nx), 5, 520, 400, 0); }
    else if (kind === 'arc') { const hx = best.cx + tx * 50, hy = best.cy + ty * 50; s = projectiles.spawnPlayer(hx + nx * 80, hy + ny * 80, Math.atan2(-ny, -nx), 5, 520, 400, 0); s.arc = true; }
    else { const mx = t.x - 2 * bd * nx, my = t.y - 2 * bd * ny, sx = best.cx + tx * 90 + nx * 70, sy = best.cy + ty * 90 + ny * 70;
           s = projectiles.spawnPlayer(sx, sy, Math.atan2(my - sy, mx - sx), 5, 520, 400, 0); s.rackBounce = 1; }
    return !!s;
  }`);

  await ev(`selectedCharacter = "${who}"; _pendingLevel = 4; startRun({ level: 4 }); state = STATES.PLAYING;`);
  await p.waitForTimeout(600);
  console.log('level', await ev('level.id'), 'map', await ev('map.layout'), '| start kit', JSON.stringify(await ev('level.powers')));
  await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${tag}-start.png` });

  // Wave 1 (greens), then the ability
  await skipTalk(); await waitFor('level.ready');
  await p.waitForTimeout(1500);
  console.log('wave 1 types', JSON.stringify(await ev('[...new Set(enemies.enemies.map(e => e.type))]')));
  await p.screenshot({ path: `${out}/${tag}-greens.png` });
  for (let i = 0; i < 100 && await ev('level.idx') === 0 && !(await ev('state === STATES.POWER_UP')); i++) { await killAll(); await p.waitForTimeout(250); }
  await waitFor('state === STATES.POWER_UP', 8000);
  console.log('power-up', await ev('level.pendingPowerUp && level.pendingPowerUp.name'));
  await p.waitForTimeout(800); await p.screenshot({ path: `${out}/${tag}-ability.png` });
  await ev('level.takePowerUp(player); state = STATES.PLAYING;');
  console.log('arcRound', await ev('!!player.arcRound'), '| rackBounce', await ev('player.rackBounce || 0'));

  // Gather
  await skipTalk(); await waitFor('level.ready');
  await ev('level.spawnT = 99'); await killAll();
  await ev('input.setAutoFire(false)');
  const mine = who === 'dex' ? 'arc' : 'bounce';
  const clear = async () => { await skipTalk(); await killAll(); await ev('level.spawnT = 99'); };
  for (const kind of ['plain']) {
    await ev(`__shoot(level.boxes[0], '${kind}')`); await p.waitForTimeout(500);
    console.log(` ${kind} shot at box 0: open`, await ev('level.boxes[0].open'));
  }
  await ev(`player.x = level.boxes[0].x; player.y = level.boxes[0].y + 20;`); await p.waitForTimeout(300);
  console.log(' walking onto box 0: open', await ev('level.boxes[0].open'));
  await ev('player.x = level.exitPos.x; player.y = level.exitPos.y - 100;');
  for (let i = 0; i < 6; i++) {
    await clear();
    if (who === 'dex' && i === 1) {
      // the other way in for Dex: an arc off a Chromatic next to the box
      await ev(`window.__v = enemies.spawnEnemyAt('violet', level.boxes[1].x + 60, level.boxes[1].y + 40); __v.spawnT = 1; __v.maxHp = __v.hp = 999; __v.update = () => {};
        const s = projectiles.spawnPlayer(__v.x - 120, __v.y, 0, 5, 520, 400, 0); s.arc = true;`);
      await p.waitForTimeout(500);
      console.log(' arc off a Chromatic beside box 1: open', await ev('level.boxes[1].open'));
      await ev('__v.takeDamage(1e9)');
      continue;
    }
    await ev(`__shoot(level.boxes[${i}], '${mine}')`); await p.waitForTimeout(500);
    console.log(` ${mine} at box ${i}: open`, await ev(`level.boxes[${i}].open`));
  }
  await p.screenshot({ path: `${out}/${tag}-boxes.png` });
  for (let i = 0; i < 6; i++) { await ev(`if (level.boxes[${i}].piece) { player.x = level.boxes[${i}].piece.x; player.y = level.boxes[${i}].piece.y; }`); await p.waitForTimeout(250); await skipTalk(); }
  await waitFor('level.beat.type !== "gather"', 4000);
  console.log('gather done → beat', await ev('level.beat.type'), '|', await ev('level.objective'));

  // Wave 2
  await skipTalk(); await waitFor('level.ready');
  for (let i = 0; i < 120 && await ev('level.beat.type') === 'wave'; i++) { await killAll(); await p.waitForTimeout(250); }

  // Tuning
  await skipTalk(); await waitFor('level.ready');
  await ev('level.spawnT = 99'); await killAll();
  console.log('tuning: pattern', JSON.stringify(await ev('level.pattern')), '|', await ev('level.objective'));
  await ev(`__shoot(level.dials[0], 'plain')`); await p.waitForTimeout(400);
  console.log(' plain shot at dial 0: value', await ev('level.dials[0].v'));
  for (let k = 0; k < 3; k++) {
    await skipTalk(); await killAll(); await ev('level.spawnT = 99');
    for (let n = 0; n < 3 && await ev('level.beat.type') === 'tuning' && await ev(`level.dials[${k}].v !== level.pattern[${k}]`); n++) { await ev(`__shoot(level.dials[${k}], '${mine}')`); await p.waitForTimeout(450); }
    console.log(` dial ${k}:`, await ev(`level.dials ? level.dials[${k}].v : '?'`), '| beat', await ev('level.beat.type'));
  }
  await p.screenshot({ path: `${out}/${tag}-tuning.png` });
  await waitFor('level.beat.type === "escape"', 3000);

  // Escape: run out of time once
  console.log('escape: beat', await ev('level.beat.type'), '| checkpoint', await ev('level.checkpointLabel'));
  await skipTalk(); await waitFor('level.ready');
  await ev('level.escapeT = 0.2;');
  await waitFor('state === STATES.LEVEL_FAIL', 8000); await p.waitForTimeout(500);
  console.log('time up: state', await ev('state'), '| reason', await ev('_levelFail.reason'), '| retry', JSON.stringify(await ev('_checkpoint && _checkpoint.label')));
  await p.screenshot({ path: `${out}/${tag}-sealed.png` });
  await key('Space'); if (phone) await ev('updateLevelFail(0)'); await p.waitForTimeout(600);
  if (await ev('state === STATES.LEVEL_FAIL')) await ev('startRun({ level: 4, from: _checkpoint }); state = STATES.PLAYING;');
  console.log('retry: beat', await ev('level.beat.type'), '| timer', await ev('Math.round(level.escapeT)'), '| ability kept', await ev(who === 'dex' ? '!!player.arcRound' : 'player.rackBounce > 0'));
  await skipTalk(); await waitFor('level.ready');
  await ev('level.spawnT = 99'); await killAll();
  // A live wire: walk into it, then dash through it
  await ev(`(() => { const w = level.wires[0]; player.x = (w.x1 + w.x2) / 2 + 30; player.y = w.y1 - 40; })()`);
  await p.waitForTimeout(400);
  await ev('window.__hp = []; const _td = player.takeDamage.bind(player); player.takeDamage = a => { const r = _td(a); if (r) __hp.push(a); return r; }');
  await ev('clearInterval(__god)');
  if (!phone) { await p.keyboard.down('s'); await p.waitForTimeout(700); await p.keyboard.up('s'); }
  else { await ev('input.touchMoveY = 1'); await p.waitForTimeout(700); await ev('input.touchMoveY = 0'); }
  console.log('walked into wire 0: zaps', JSON.stringify(await ev('__hp')), '| still above it', await ev('player.y < level.wires[0].y1'));
  await p.screenshot({ path: `${out}/${tag}-wire.png` });
  await ev('__hp = []; player.dashCooldown = 0; player.dashQueued = true; player.dashToward = { x: player.x, y: player.y + 200 };');
  await p.waitForTimeout(400);
  console.log('dashed through: zaps', JSON.stringify(await ev('__hp')), '| past it', await ev('player.y > level.wires[0].y1'));
  await ev('window.__god = setInterval(() => { if (player) player.hp = player.maxHp; }, 50)');
  console.log('escape objective:', await ev('level.objective'));
  await ev('player.x = level.exitPos.x; player.y = level.exitPos.y;');
  await waitFor('state === STATES.ABILITY_UNLOCK || state === STATES.LEVEL_END', 9000);
  if (await ev('state === STATES.ABILITY_UNLOCK')) { await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${tag}-card.png` }); await ev('_unlockT = 1'); await key('Enter'); await waitFor('state === STATES.LEVEL_END', 5000); }
  console.log('results: state', await ev('state'), '|', await ev('_levelResult && _levelResult.outcome'));
  console.log('cards now', JSON.stringify(await ev('profile().cards')));
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
