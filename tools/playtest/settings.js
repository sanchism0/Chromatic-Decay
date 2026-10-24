// Headless playtest (see tools/playtest/README.md). Serve the repo on :8766 first.
// Settings screen: open it from the title, flip each switch, change the name,
// and check the developer panel only appears with ?dev.
const ROOT = process.env.REPO || require('path').resolve(__dirname, '../..');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] + '/settings', phone = process.argv[3] === 'phone';
fs.mkdirSync(out, { recursive: true });
const tag = phone ? 'phone' : 'desk';
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const open = async (query) => {
    const p = await b.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: phone });
    p.on('pageerror', e => errs.push(e.message));
    await p.route('**/src/game.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8') + '\nwindow.__ev = s => eval(s);\n' }));
    await p.route('**/rest/v1/**', r => r.abort());
    await p.goto('http://127.0.0.1:8766/index.html' + query);
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('chromatic_decay_prologue_done', '1'); });
    await p.reload(); await p.waitForTimeout(1000);
    return p;
  };
  const p = await open('');
  const ev = s => p.evaluate(c => __ev(c), s);
  const tap = async r => { if (phone) await p.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); else { await p.mouse.move(r.x + r.w / 2, r.y + r.h / 2); await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up(); } await p.waitForTimeout(250); };
  await ev("setPlayerName('ZAK')");
  await tap(await ev('_titleBtns.admin'));
  console.log('title SETTINGS → state', await ev('state'), '(20 = settings)', '| dev button', await ev('!!_setBtns.dev'));
  await p.screenshot({ path: `${out}/${tag}-settings.png` });
  const before = await ev('[_menuMuted, sfxEnabled(), input.autoFire]');
  await tap(await ev('_setBtns.music')); await tap(await ev('_setBtns.sfx')); await tap(await ev('_setBtns.auto'));
  const after = await ev('[_menuMuted, sfxEnabled(), input.autoFire]');
  console.log('music muted / sfx on / auto-fire', JSON.stringify(before), '→', JSON.stringify(after));
  console.log('saved', await ev("[localStorage.getItem('chromatic_decay_menu_muted'), localStorage.getItem('chromatic_decay_sfx_off'), localStorage.getItem('chromatic_decay_autofire')]"));
  await p.screenshot({ path: `${out}/${tag}-settings-flipped.png` });
  await tap(await ev('_setBtns.name'));
  console.log('CHANGE → state', await ev('state'), '(19 = name entry)');
  if (phone) {
    await p.waitForTimeout(300);
    await tap(await ev("_kbdBtns.find(b => b.key === 'DEL')"));
    await tap(await ev("_kbdBtns.find(b => b.key === 'X')"));
    await tap(await ev("_kbdBtns.find(b => b.key === 'OK')"));
  } else {
    await p.keyboard.press('Backspace'); await p.keyboard.type('X'); await p.keyboard.press('Enter');
  }
  await p.waitForTimeout(300);
  console.log('name now', await ev('playerName()'), '| back on settings', await ev('state') === 20);
  if (!phone) {
    await tap(await ev('_setBtns.name')); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    console.log('Esc on the name screen → state', await ev('state'), '(stays on settings) name', await ev('playerName()'));
  }
  await tap(await ev('_setBtns.back'));
  console.log('BACK → state', await ev('state'), '(0 = title)');
  const d = await open('?dev');
  const evd = s => d.evaluate(c => __ev(c), s);
  await evd("setPlayerName('ZAK'); state = STATES.SETTINGS");
  await d.waitForTimeout(300);
  console.log('with ?dev: dev button', await evd('!!_setBtns.dev'));
  await d.screenshot({ path: `${out}/${tag}-settings-dev.png` });
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
