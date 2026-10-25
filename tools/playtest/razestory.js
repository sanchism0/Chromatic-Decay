// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Raze's Story runs, Levels 1-4, each task done with his own tools:
//   1  the sampler (Follow-Up → Snare Trap → Punch-Through), his intro scene,
//      relays, servers, the door, his Level 1 card
//   2  the Net: it catches a frozen tank and the tracer cracks it (twice each)
//   3  the Snare holds Chromatics in the terminal ring (the pull keeps going),
//      lands on the sealed mirrors, The Queue
//   4  Punch-Through into the junction boxes and dials through a cable; the
//      Net hop can't clear the corridor walls; the escape
// Args: <outdir> [desk|phone|land] [levels, e.g. 1234]
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] + '/raze', mode = process.argv[3] || 'desk', levels = (process.argv[4] || '1234').split('').map(Number);
const phone = mode === 'phone' || mode === 'land', land = mode === 'land';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: land ? { width: 844, height: 390 } : phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: phone });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('http://127.0.0.1:8766/index.html');
  // Raze is free (Level 5 cleared with Dex); his cards come one level at a time
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('chromatic_decay_prologue_done', '1');
    localStorage.setItem('chromatic_decay_profile', JSON.stringify({ clears: { 1: { dex: 1 }, 2: { dex: 1 }, 3: { dex: 1 }, 4: { dex: 1 }, 5: { dex: 1 } },
      cards: { dex: ['heavy_bursts'] }, player: { id: 'ptest', name: 'TEST' } }));
  });
  await p.reload(); await p.waitForTimeout(900);
  const ev = s => p.evaluate(c => __ev(c), s);
  const key = async k => { await p.keyboard.down(k); await p.waitForTimeout(60); await p.keyboard.up(k); await p.waitForTimeout(60); };
  const skipTalk = async () => { for (let i = 0; i < 40 && await ev('level && level.radio.busy'); i++) await ev('level.radio.next()'); };
  const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr).catch(() => false)) return true; await p.waitForTimeout(200); } return false; };
  const kill = () => ev('enemies.enemies.forEach(e => { if (!e.forming && !e.boss) e.takeDamage(1e9); })');
  const takePowerUps = async () => { while (await ev('state === STATES.POWER_UP')) { await ev('_unlockT = 1; level.takePowerUp(player); state = STATES.PLAYING'); await p.waitForTimeout(100); } };
  const clearBeat = async idx => {
    for (let i = 0; i < 160 && await ev('level.idx') === idx; i++) { await skipTalk(); await kill(); await takePowerUps(); await p.waitForTimeout(220); }
    // A power-up shows the frame after its section ends
    for (let i = 0; i < 6; i++) { await p.waitForTimeout(120); await takePowerUps(); }
  };
  const finish = async (n) => {
    await waitFor('state === STATES.LEVEL_END || state === STATES.ABILITY_UNLOCK', 12000);
    if (await ev('state === STATES.ABILITY_UNLOCK')) { await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${mode}-l${n}-card.png` }); console.log(` card: ${await ev('_levelCard().name')}`); await ev('_unlockT = 1'); await key('Enter'); await waitFor('state === STATES.LEVEL_END', 5000); }
    await p.waitForTimeout(700); await p.screenshot({ path: `${out}/${mode}-l${n}-results.png` });
    console.log(` results: ${await ev('_levelResult.outcome')}`);
  };
  // Start a level as Raze the way a player does: map → pick → (scene) → run
  const start = async n => {
    await ev(`_pendingLevel = ${n}; _openCharSelect('level')`); await p.waitForTimeout(300);
    await ev(`_pickCharacter('raze')`); await p.waitForTimeout(400);
    if (await ev('state === STATES.STORY')) {
      const lines = await ev('story.scene.lines.length');
      await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${mode}-l${n}-scene.png` });
      console.log(` scene before it: ${lines} lines`);
      await ev('story.skipScene()');
    }
    await waitFor('state === STATES.PLAYING && !!level', 5000);
    await ev('clearInterval(window.__god); window.__god = setInterval(() => { if (player) player.hp = player.maxHp; }, 50)');
    console.log(`L${n}: agent ${await ev('level.agent')} | on the line: ${await ev('level.op')} | kit ${JSON.stringify(await ev('level.powers'))}`);
    await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${mode}-l${n}-start.png` });
  };

  for (const n of levels) {
    await start(n);
    if (n === 1) {
      await clearBeat(0);
      const relays = await ev('level.relays.map(r => [r.x, r.y])');
      await skipTalk(); await waitFor('level.ready');
      for (let k = 0; k < 3; k++) for (let i = 0; i < 80 && !(await ev(`level.relays[${k}].done`)); i++) {
        await ev(`player.x = ${relays[k][0]}; player.y = ${relays[k][1]}`); await kill(); await skipTalk(); await takePowerUps(); await p.waitForTimeout(220);
      }
      await clearBeat(1); await clearBeat(2);
      console.log(' sampler:', JSON.stringify(await ev('level.powers')), '| followUp', await ev('!!player.followUp'), '| snare', await ev('!!player.snare'), '| punch', await ev('player.punchThrough || 0'));
      await skipTalk(); await waitFor('level.ready');
      // Servers: a rifle round into each marked rack
      for (let k = 0; k < 4; k++) {
        await skipTalk();
        await ev(`(() => { const s = level.servers[${k}]; projectiles.spawnPlayer(s.x, s.o.y + s.o.h + 40, -Math.PI / 2, 18, 600, 200, 1).rifle = true; })()`);
        await p.waitForTimeout(400); await kill();
      }
      await waitFor('level.beat.type === "exit"', 5000);
      console.log(' servers done:', await ev('level.servers.every(s => s.lit)'));
      await skipTalk(); await waitFor('level.ready');
      await ev('player.x = level.exitPos.x; player.y = level.exitPos.y');
      await finish(1);
    }
    if (n === 2) {
      await clearBeat(0);
      console.log(' net:', await ev('!!player.netDash'), '| beat', await ev('level.idx'), await ev('level.beat.type'), await ev('state'));
      await skipTalk(); await waitFor('level.ready');
      for (const [x, y] of await ev('level.drives.map(d => [d.x, d.y])')) { await skipTalk(); await kill(); await ev(`player.x = ${x}; player.y = ${y}`); await p.waitForTimeout(300); }
      await waitFor('level.idx >= 2', 6000);
      console.log('  drives:', await ev('level.drives.filter(d => d.got).length'), '| beat', await ev('level.beat.type'));
      await clearBeat(2);
      await waitFor('level.beat.type === "freezers"', 6000);
      await skipTalk(); await waitFor('level.ready');
      await ev('level.spawnT = 999'); await kill();
      const tanks = await ev('level.tanks.map(t => [t.x, t.y])');
      // Standing still, the net flies at the cursor and he hops back
      for (let k = 0; k < tanks.length; k++) {
        let tries = 0;
        for (let h = 0; h < 4 && await ev(`level.tanks[${k}].hp > 0`); h++) {
          tries++;
          await skipTalk(); await kill();
          const [tx, ty] = tanks[k];
          await ev(`player.x = ${tx} + 80; player.y = ${ty}; player.dashCooldown = 0`);
          await p.waitForTimeout(80);
          await ev(`player.facing = Math.PI; input.touchAimAngle = Math.PI; player.dashQueued = true`);
          await p.waitForTimeout(450);
          const q = await ev('(player.tracerQueue || []).length');
          await ev('player.fireTimer = 0; player._shoot(projectiles)');
          await p.waitForTimeout(400);
          if (k === 0 && h === 0) { console.log(`  tank 0: net caught ${q}, after the tracer hits left ${await ev('level.tanks[0].hp')}`); await p.screenshot({ path: `${out}/${mode}-l2-tank.png` }); }
          await ev('input.touchAimAngle = null');
        }
        console.log(`  tank ${k}: hits left ${await ev(`level.tanks[${k}].hp`)} after ${tries} nets`);
      }
      await waitFor('level.beat.type === "exit"', 5000);
      await skipTalk(); await waitFor('level.ready');
      await ev('player.x = level.exitPos.x; player.y = level.exitPos.y + 4');
      await finish(2);
    }
    if (n === 3) {
      await clearBeat(0);
      console.log(' snare:', await ev('!!player.snare'), '| abilities', JSON.stringify(await ev('player.abilities')));
      await skipTalk(); await waitFor('level.ready');
      await ev('level.spawnT = 999'); await kill();
      // Three violets in the ring block the pull; a snare on them lets it go on
      await ev('player.x = level.hold.x; player.y = level.hold.y; window.__vs = [0, 1, 2].map(k => { const e = enemies.spawnEnemyAt("violet", level.hold.x + 40, level.hold.y - 20 + k * 20); e.spawnT = 1; return e; })');
      await skipTalk(); await p.waitForTimeout(400);
      const p0 = await ev('level.hold.p');
      console.log(`  ring with 3 violets: crowd ${await ev('level.hold.crowd')}, progress ${p0.toFixed(3)}`);
      await skipTalk(); await ev('player.snareCooldown = 0; _useAbility("snare", { x: level.hold.x + 40, y: level.hold.y })');
      await p.waitForTimeout(1100);
      console.log('  violets', JSON.stringify(await ev('__vs.map(e => [e.isAlive, +(e.snareT||0).toFixed(1), +(e.stunTimer||0).toFixed(1), Math.round(Math.hypot(e.x - level.hold.x, e.y - level.hold.y))])')), 'state', await ev('state'), 'radio', await ev('!!level.radio.cur'));
      console.log(`  snared ${await ev('__vs.filter(e => e.snareT > 0).length')} | crowd now ${await ev('level.hold.crowd')} | progress ${p0.toFixed(3)} → ${(await ev('level.hold.p')).toFixed(3)}`);
      await p.screenshot({ path: `${out}/${mode}-l3-snare.png` });
      await kill();
      for (let i = 0; i < 160 && await ev('level.beat.type') === 'hold'; i++) { await ev('player.x = level.hold.x; player.y = level.hold.y; level.hold.p = Math.min(1, level.hold.p + 0.02)'); await kill(); await p.waitForTimeout(150); }
      await clearBeat(2);
      await skipTalk(); await waitFor('level.ready');
      // Mirrors: a snare lobbed over each sealed wall
      for (let k = 0; k < 3; k++) {
        await skipTalk(); await kill();
        await ev(`(() => { const m = level.mirrors[${k}]; const a = Math.atan2(level.exitPos.y - m.y, level.exitPos.x - m.x); player.x = m.x + Math.cos(a) * 150; player.y = m.y + Math.sin(a) * 150; player.snareCooldown = 0; _useAbility('snare', { x: m.x, y: m.y }); })()`);
        await p.waitForTimeout(900); await kill();
      }
      console.log(`  mirrors turned by snares: ${await ev('level.mirrors.filter(m => m.ok).length')}/3 → beat ${await ev('level.beat.type')}`);
      await waitFor('level.beat.type === "boss"', 5000);
      await skipTalk(); await waitFor('level.boss && !level.boss.forming', 8000);
      await ev('level.boss.takeDamage(1e9)');
      await waitFor('level.beat.type === "exit"', 8000);
      await skipTalk(); await waitFor('level.ready');
      await ev('player.x = level.exitPos.x; player.y = level.exitPos.y');
      await finish(3);
    }
    if (n === 4) {
      await clearBeat(0);
      console.log(' punch-through:', await ev('player.punchThrough || 0'));
      await skipTalk(); await waitFor('level.ready');
      await ev('level.spawnT = 999'); await kill();
      // For each box: stand on the far side of the nearest cable bundle and
      // shoot through it. A plain round straight at it first: it glances off
      await ev(`window.__shootThrough = t => {
        const rk = map.obstacles.filter(o => !o.tall).map(o => ({ o, d: Math.hypot(Math.max(o.x - t.x, 0, t.x - o.x - o.w), Math.max(o.y - t.y, 0, t.y - o.y - o.h)) })).sort((a, b) => a.d - b.d)[0].o;
        const cx = Math.max(rk.x, Math.min(t.x, rk.x + rk.w)), cy = Math.max(rk.y, Math.min(t.y, rk.y + rk.h));
        let dx = cx - t.x, dy = cy - t.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        let sx = cx, sy = cy; while (sx > rk.x - 1 && sx < rk.x + rk.w + 1 && sy > rk.y - 1 && sy < rk.y + rk.h + 1) { sx += dx * 2; sy += dy * 2; }
        sx += dx * 30; sy += dy * 30;
        const s = projectiles.spawnPlayer(sx, sy, Math.atan2(t.y - sy, t.x - sx), 18, 600, 400, 1); s.rifle = true; s.wallPierce = 1;
        return [Math.round(sx), Math.round(sy)];
      }`);
      await ev('(() => { const t = level.boxes[0]; const s = projectiles.spawnPlayer(t.x + 60, t.y, Math.PI, 18, 600, 200, 1); s.rifle = true; })()');
      await p.waitForTimeout(400);
      console.log(`  plain round at box 0: open ${await ev('level.boxes[0].open')}`);
      for (let k = 0; k < 6; k++) { await ev(`__shootThrough(level.boxes[${k}])`); await p.waitForTimeout(450); }
      console.log(`  boxes opened through a cable: ${await ev('level.boxes.filter(x => x.open).length')}/6`);
      await p.screenshot({ path: `${out}/${mode}-l4-punch.png` });
      for (const [x, y] of await ev('level.boxes.filter(x => x.open).map(x => [x.piece.x, x.piece.y])')) { await skipTalk(); await kill(); await ev(`player.x = ${x}; player.y = ${y}`); await p.waitForTimeout(300); }
      await waitFor('level.idx >= 2', 6000);
      await clearBeat(2);
      await waitFor('level.beat.type === "tuning"', 6000);
      await skipTalk(); await waitFor('level.ready');
      await ev('level.spawnT = 999'); await kill();
      for (let i = 0; i < 12 && await ev('level.beat.type') === 'tuning'; i++) {
        const k = await ev('level.dials.findIndex((d, j) => d.v !== level.pattern[j])');
        if (k < 0) break;
        await skipTalk(); await ev(`__shootThrough(level.dials[${k}])`); await p.waitForTimeout(450);
      }
      console.log(`  dials tuned through cables: ${await ev('level.beat.type !== "tuning"')}`);
      await waitFor('level.beat.type === "escape"', 4000);
      await skipTalk(); await waitFor('level.ready');
      // The Net hop can't clear the corridor wall
      await ev(`player.x = CONFIG.map_width * 0.5; player.y = CONFIG.map_height * ${0.72 - 0.06}; player.dashCooldown = 0`);
      await p.waitForTimeout(100);
      if (!phone) { await p.keyboard.down('s'); await ev('player.dashQueued = true'); await p.waitForTimeout(400); await p.keyboard.up('s'); }
      else { await ev('input.touchMoveY = 1; player.dashQueued = true'); await p.waitForTimeout(400); await ev('input.touchMoveY = 0'); }
      console.log(`  hop at the corridor wall: still in the room ${await ev('player.y < CONFIG.map_height * 0.72')}`);
      // The far door (the wires are covered by level4.js)
      console.log(`  escape: ${await ev('level.beat.type')}, ${Math.round(await ev('level.escapeT'))} s left`);
      for (let i = 0; i < 20 && await ev('level.beat.type') === 'escape'; i++) { await skipTalk(); await kill(); await ev('player.x = level.exitPos.x; player.y = level.exitPos.y'); await p.waitForTimeout(250); }
      await waitFor('level.beat.type === "exit"', 5000);
      await skipTalk(); await waitFor('level.ready');
      await ev('player.x = level.exitPos.x; player.y = level.exitPos.y');
      await finish(4);
    }
    await ev('stopAmbient(); hud.minimal = false; _openStoryMap()'); await p.waitForTimeout(300);
  }
  await ev('_openStoryMap()'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${mode}-map.png` });
  console.log('Raze cards', JSON.stringify(await ev('profile().cards.raze')), '| clears', JSON.stringify(await ev('Object.fromEntries(Object.entries(profile().clears).map(([k, v]) => [k, v.raze || 0]))')));
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
