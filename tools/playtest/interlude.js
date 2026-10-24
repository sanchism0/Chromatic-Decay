// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// The scene before Level 3 (Dex and Juno on the lift down): it plays after
// the character pick, Space moves through it, Esc / SKIP skips it, and the
// level starts after. Args: <outdir> [desk|phone] [dex|juno]
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = (process.argv[2] || '/tmp') + '/interlude', mode = process.argv[3] || 'desk', who = process.argv[4] || 'juno';
const phone = mode === 'phone';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: phone });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('http://127.0.0.1:8766/index.html');
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('chromatic_decay_prologue_done', '1');
    localStorage.setItem('chromatic_decay_profile', JSON.stringify({ clears: { 1: { dex: 1, juno: 1 }, 2: { dex: 1, juno: 1 } }, player: { id: 'ptest', name: 'TEST' } }));
  });
  await p.reload(); await p.waitForTimeout(900);
  const ev = s => p.evaluate(c => __ev(c), s);
  const key = async k => { await p.keyboard.down(k); await p.waitForTimeout(60); await p.keyboard.up(k); await p.waitForTimeout(80); };
  const pick = async () => { await ev(`_openStoryMap(); _pendingLevel = 3; _openCharSelect('level'); _csDelay = 0;`); await p.waitForTimeout(200); await ev(`_pickCharacter("${who}")`); await p.waitForTimeout(500); };
  await pick();
  console.log('after the pick: state', await ev('state'), '(11 = scene) | phase', await ev('story.phase'), '| lines', await ev('story.scene.lines.length'));
  await p.waitForTimeout(700); await p.screenshot({ path: `${out}/${mode}-${who}-1.png` });
  for (let i = 0; i < 6; i++) { if (phone) await ev('story.updateScene(0.016, true)'); else await key('Space'); await p.waitForTimeout(150); }
  await p.waitForTimeout(800); await p.screenshot({ path: `${out}/${mode}-${who}-2.png` });
  for (let i = 0; i < 30 && await ev('state === STATES.STORY'); i++) { if (phone) await ev('story.updateScene(0.016, true)'); else await key('Space'); await p.waitForTimeout(150); }
  console.log('played through: state', await ev('state'), '(1 = playing) | level', await ev('level && level.id'), '| map', await ev('map.layout'), '| story phase', await ev('story.phase'));
  // Again, skipping it
  await pick();
  if (phone) await ev('story.skipScene()'); else await key('Escape');
  await p.waitForTimeout(300);
  console.log('skipped: state', await ev('state'), '| level', await ev('level && level.id'));
  // Level 2 has no scene
  await ev(`_openStoryMap(); _pendingLevel = 2; _openCharSelect('level'); _csDelay = 0; _pickCharacter("${who}")`); await p.waitForTimeout(300);
  console.log('level 2 pick: state', await ev('state'), '| level', await ev('level && level.id'));
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
