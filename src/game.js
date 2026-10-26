// CHROMATIC DECAY — Main Game Loop

import { CONFIG }           from './config.js';
import { Input }            from './input.js';
import { Camera, GameMap }  from './map.js';
import { Player, drawCharacterFrame, WALK_CYCLE, CELL_W, CELL_H, SIGNATURES, WEAPONS, DASH_CD, NET_HOP } from './player.js';
import { LevelRun, LEVELS, AGENT_COLOR, LEVEL_CARDS } from './level.js';
import { GrenadeSystem, GRENADE_CD, GRENADE_RANGE, GRENADE_RADIUS } from './grenade.js';
import { DecoySystem, DECOY_CD, DECOY_RADIUS } from './decoy.js';
import { DashPowers } from './dashpowers.js';
import { NetSystem } from './nets.js';
import { SnareSystem, SNARE_CD, SNARE_RADIUS } from './snare.js';
import { RAZE_SCENES, RAZE_SIDES, RAZE_OUTCOMES } from './razestory.js';
import { profile, bankChroma, recordClear, hasSignature, hasCard, unlockCard, levelUnlocked, timesCleared, playerName, setPlayerName, recordArcadeScore, CHROMA_VALUE, razeFree, seenNew, markSeen, cardSeen } from './profile.js';
import { PLATFORM, refreshBoard, cycleBoard, resetBoard, drawBoard, submitArcade, syncPlayer } from './leaderboard.js';
import { EnemySystem }      from './enemies.js';
import { ProjectileSystem } from './projectiles.js';
import { EchoSystem, Echo } from './echoes.js';
import { StoryMode, INTROS, OUTROS } from './story.js';
import { ParticleSystem }   from './particles.js';
import { DrainSystem }      from './drain.js';
import { drawSlab, drawSlabButton, dimBackdrop, over } from './ui3d.js';
import { drawGroundShadow, drawGlow } from './sprites.js';
import { PixelMap, rackHeight } from './pixelmap.js';
import { UpgradeScreen, STORY_CARDS } from './upgrades.js';
import { CompanionSystem }  from './companions.js';
import { TrapSystem }       from './traps.js';
import { HUD }              from './hud.js';
import { LoreFeed }         from './lore.js';
import { FRAGMENT_DATA, getRunFragment, placeFragment } from './fragments.js';
import { WaveSystem, CHARGE_COLORS } from './waves.js';
import { clamp, formatTime, dist } from './utils.js';
import { AdminPanel } from './admin.js';
import { startAmbient, stopAmbient, startTitleMusic, stopTitleMusic, sfxShoot, sfxEnemyKill, sfxPlayerHit, sfxWaveClear, sfxFragmentPickup, resumeAudio, sfxTimerWarning, sfxCountdownTick, sfxBeamIn, sfxBeamOut, sfxEchoPickup, sfxSignature, sfxDeath, sfxRelayCharged as sfxRelayChime, sfxUnlockTune, sfxDash, sfxPerfectDodge, sfxEnabled, setSfxEnabled, sfxFollowUp } from './audio.js';

// ── Canvas ────────────────────────────────────────────────────

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Minimum text size (owner: "everything needs to be easy to read"). Any font
// set smaller than this, anywhere in the game, is drawn at this size instead.
const MIN_FONT_PX = 12;
{
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
    configurable: true,
    get() { return d.get.call(this); },
    set(v) { d.set.call(this, String(v).replace(/(\d+(?:\.\d+)?)px/, (m, n) => (+n < MIN_FONT_PX ? MIN_FONT_PX : n) + 'px')); },
  });
}

// ── Zoom / viewport ───────────────────────────────────────────

let ZOOM = CONFIG.camera_zoom;
function updateZoom() {
  const W      = window.innerWidth;
  const H      = window.innerHeight;
  const minDim = Math.min(W, H);
  const mobile = 'ontouchstart' in window;

  // Base zoom by screen size — desktop unchanged
  let z;
  if      (!mobile)      z = CONFIG.camera_zoom_desktop;  // PC always uses its own config value
  else if (minDim < 400) z = 1.3;
  else if (minDim < 600) z = 1.5;
  else if (minDim < 900) z = 1.65;
  else                   z = CONFIG.camera_zoom;

  // On mobile: cap zoom so at least 378px of world width is always visible,
  // then pull back another 10% (owner: phones were zoomed in too far)
  if (mobile) z = Math.min(z, W / 340) * 0.9;

  ZOOM = z;
}

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  updateZoom();
}
resize();
window.addEventListener('resize', resize);
function vw() { return canvas.width  / ZOOM; }
function vh() { return canvas.height / ZOOM; }

// Camera offset rounded to whole screen pixels so pixel art stays crisp
function applyWorldTransform() {
  ctx.setTransform(ZOOM, 0, 0, ZOOM, Math.round(-camera.x * ZOOM), Math.round(-camera.y * ZOOM));
}
function resetTransform() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ── State machine ─────────────────────────────────────────────

const STATES = {
  TITLE:           0,
  PLAYING:         1,
  PAUSED:          2,
  UPGRADE:         3,
  GAMEOVER:        4,
  FRAGMENT_RESCUE:  5,
  ARCHIVE:          6,
  ADMIN:            7,
  WIN:              8,
  CLASS_EMERGENCE:  9,
  CHAR_SELECT:     10,
  STORY:           11,   // story scenes (dialogue)
  STORY_END:       12,   // prologue complete card
  STORY_MAP:       13,   // story level select
  LEVEL_END:       14,   // story level results
  DYING:           15,   // death burst, before game over / level failed
  LEVEL_FAIL:      16,   // story level failed: restart or leave
  ABILITY_UNLOCK:  17,   // the door in a Story level: new signature ability
  POWER_UP:        18,   // a Story section cleared: power-up for the level
  NAME_ENTRY:      19,   // pick a leaderboard name (first start, or changing it)
  SETTINGS:        20,   // player settings: name, music, sound, auto-fire
};
let state = STATES.TITLE;

// ── Systems ───────────────────────────────────────────────────

const input       = new Input(canvas);
const grenades    = new GrenadeSystem();
const decoys      = new DecoySystem();
const dashPowers  = new DashPowers();
const nets        = new NetSystem();     // Raze's Net
const snares      = new SnareSystem();   // Raze's Snare Trap
const camera      = new Camera();
const particles   = new ParticleSystem();
const drain       = new DrainSystem();
const projectiles = new ProjectileSystem();
const enemies     = new EnemySystem();
const echoes      = new EchoSystem();
const companions  = new CompanionSystem();
const traps       = new TrapSystem();
const upgradeUI   = new UpgradeScreen();
const hud         = new HUD();
const lore        = new LoreFeed();

upgradeUI.setSystems(companions, traps);

const adminPanel  = new AdminPanel();
const waveSystem  = new WaveSystem();

let map    = null;
let pixelMap = null;   // pixel-art floor and racks for the current map
let player = null;
let elapsed = 0;

// ── Per-run state ─────────────────────────────────────────────
let loreTimeTriggers   = [];
let firstEnemySeen     = {};
let nearDeathTriggered = false;
let pendingFragment    = null;
let razeRescuedThisRun  = false;
let pendingEmergence    = null;  // { classId, color, label, abilityName, abilityDesc, cooldown }

// ── Archive lore card state ───────────────────────────────────
let archiveLoreCard = null; // null | 'world' | 'emitter' | 'raze' | 'violet' | 'yellow' | 'green' | 'orange' | 'pink'
const _archiveLoreBtns = { world: null, emitter: null, raze: null, violet: null, yellow: null, green: null, orange: null, pink: null, close: null };

// ── Pause menu state ──────────────────────────────────────────
let pauseQuitConfirm = false;
const _pauseBtns = { resume: null, quit: null, confirmYes: null, confirmNo: null };

// ── Wave timer sound state (reset each wave) ──────────────────
let _timerSounds = { wave: 0, warned: false, ticks: {} };

// ── Archive ───────────────────────────────────────────────────

function _scoreColor(score, rank) {
  if (rank === 0)        return '#E8A020'; // 1st place — gold
  if (score >= 6001)     return '#e9ff6a'; // 6001+ — yellow
  if (score >= 1001)     return '#FFFFFF'; // 1001–6000 — white
  return '#4A4E58';                        // 0–1000 — grey
}

function loadArchive() {
  try { return JSON.parse(localStorage.getItem('chromatic_decay_archive') || '{}'); }
  catch { return {}; }
}
function saveArchive(a) {
  localStorage.setItem('chromatic_decay_archive', JSON.stringify(a));
}
function getUnlockedClasses() {
  const archive = loadArchive();
  // Breaker is excluded from archive-based unlocking — requires RAZE rescued each run
  const classMap = { sable: 'warden', lumen: 'ghost', cord: 'weaver', voss: 'herald' };
  const classes  = Object.entries(classMap)
    .filter(([fragId]) => archive[fragId])
    .map(([, cls]) => cls);
  if (razeRescuedThisRun) classes.push('breaker');
  return classes;
}

// ── Run setup ─────────────────────────────────────────────────

let level = null;   // the Story level being played, if any

// A Story level's checkpoint, reached this attempt: { id, agent, idx, granted }.
// Only the level-failed screen offers it; any fresh start clears it, so going
// back to the map or the menu means starting the level over.
let _checkpoint = null;

function startRun(opts = {}) {
  const tutorial = !!opts.tutorial;
  const levelId  = opts.level || null;
  const from     = opts.from || null;   // restart at a checkpoint
  if (!from) _checkpoint = null;
  map = new GameMap(levelId && LEVELS[levelId] ? (LEVELS[levelId].map || 'basement') : 'basement');
  pixelMap = new PixelMap(map);
  const spawn = map.playerSpawn();
  player = new Player(spawn.x, spawn.y);
  player.character = selectedCharacter;
  // Activated abilities come from Story progress (Level 1's power-ups for
  // now); signatures will return later as one of them
  player.signature = null;
  player.startBeamIn();
  sfxBeamIn();

  companions.reset();
  traps.reset();
  enemies.reset();
  drain.reset();
  echoes.reset();
  projectiles.reset();
  grenades.reset();
  decoys.reset();
  snares.reset();
  // A thrown ability landing (Level 3's mirror switches react to it)
  grenades.onLand = decoys.onLand = snares.onLand = (x, y) => { if (level && level.onThrowLand) level.onThrowLand(x, y); };
  dashPowers.reset();
  nets.reset();
  _lasers.length = 0;
  lore.reset();
  lore.enabled = !tutorial && !levelId;   // the operator does the talking in Story
  upgradeUI.takenIds    = [];
  upgradeUI.takenCounts = {};
  upgradeUI.active      = false;

  // Wire back-refs so player can call systems directly in ability
  player.setSystems(companions, traps, particles);

  elapsed = 0;
  window._gameElapsed    = 0;
  nearDeathTriggered     = false;
  pendingFragment        = null;
  pendingEmergence       = null;
  razeRescuedThisRun     = false;
  pauseQuitConfirm       = false;
  _gameOverInputDelay    = 0;
  _winInputDelay         = 0;
  firstEnemySeen         = {};
  loreTimeTriggers       = [
    { time: 600,  id: 'survive_10', fired: false },
    { time: 1200, id: 'survive_20', fired: false },
  ];

  _kbdOverlay = false;
  _runChroma  = { violet: 0, yellow: 0, green: 0, orange: 0, pink: 0 };

  // Wave system — enable manual spawn mode and start wave 1
  enemies.manualSpawnMode = true;
  waveSystem.startRun();

  camera.follow(spawn.x, spawn.y, vw(), vh());

  hud.minimal = tutorial || !!levelId;
  level = null;
  if (levelId) {
    // Story level: the level runs the beats; going down restarts the beat
    waveSystem.active = false;
    echoes.spawnTimer = Infinity;
    player.cannotDie  = true;
    level = new LevelRun(levelId, selectedCharacter, levelApi, from);
    // After Level 1 (the sampler), a character starts with the cards they
    // have earned — and only theirs
    if (levelId > 1) for (const c of STORY_CARDS) if (c.who === selectedCharacter && hasCard(c.who, c.id)) { c.apply(player); level.powers.push(c.name.toUpperCase()); }
    // From a checkpoint: the level abilities already taken this attempt
    if (from) for (const pu of from.granted) {
      if (!pu.has || !pu.has(player)) pu.apply(player);
      if (!level.powers.includes(pu.name)) level.powers.push(pu.name);
      level.granted.push(pu);
    }
  } else if (tutorial) {
    // Story tutorial: no waves, no fragment, no random Echoes, and the
    // player can't die — the story director spawns everything
    waveSystem.active = false;
    echoes.spawnTimer = Infinity;
    player.cannotDie  = true;
  } else {
    // ── Fragment placement (one per run) ─────────────────────────
    const archive = loadArchive();
    // Fragments (which unlocked classes) no longer appear: Arcade is each
    // character's base form plus the cards earned in Story

    if (!archive.run_started) {
      lore.trigger('run_start');
      archive.run_started = true;
      saveArchive(archive);
    }

    // Start wave 1 (needs player + map to be ready)
    waveSystem.startWave(1, enemies, map, player);
  }

  stopTitleMusic();
  if (!_menuMuted) startAmbient();
  state = STATES.PLAYING;
}

// ── Game over ─────────────────────────────────────────────────

let gameOverData = null;
// The posted run: { rank, weekRank } once ranked, { offline } if unreachable,
// null while posting. Shared by the game over and win screens.
let _arcadeResult = null;
let _arcadePB     = null;   // { prev, isBest }
let _runChroma    = {};     // colour drained this Arcade run, by type

let _gameOverInputDelay = 0; // ignore all input for first 0.5s of game over screen
let _winInputDelay      = 0; // same guard for win screen

// Posts an Arcade run under the player's name and banks a quarter of the
// colour it drained (into the wallet and lifetime Chroma)
function _postArcadeRun(score, wave, time) {
  _arcadePB = recordArcadeScore(PLATFORM, score);
  _arcadeResult = null;
  bankChroma(_runChroma, 0.25);
  submitArcade({ score, wave, time: Math.floor(time), agent: selectedCharacter })
    .then(r => { _arcadeResult = r; });
  syncPlayer();
}

function handleGameOver() {
  gameOverData = {
    score:    waveSystem.killScore,
    kills:    player.kills,
    echoes:   player.echoesRescued,
    time:     waveSystem.totalTime,
    upgrades: player.upgradesTaken,
    agent:    selectedCharacter,
    wave:     Math.max(0, waveSystem.wave - 1), // last *completed* wave
  };
  _postArcadeRun(gameOverData.score, gameOverData.wave, gameOverData.time);
  _gameOverInputDelay  = 0.5;  // ignore input for first 0.5s
  stopAmbient();
  state = STATES.GAMEOVER;
}

// ── Update ────────────────────────────────────────────────────

let _prevState = null;
function update(dt) {
  input.update();
  if (state === STATES.TITLE && _prevState !== STATES.TITLE) resetBoard();
  _prevState = state;

  adminPanel.update(dt);

  switch (state) {
    case STATES.TITLE:           updateTitle();            break;
    case STATES.CHAR_SELECT:     updateCharSelect(dt);     break;
    case STATES.STORY:           updateStory(dt);          break;
    case STATES.STORY_END:       updateStoryEnd(dt);       break;
    case STATES.STORY_MAP:       updateStoryMap(dt);       break;
    case STATES.LEVEL_END:       updateLevelEnd(dt);       break;
    case STATES.DYING:           updateDying(dt);          break;
    case STATES.LEVEL_FAIL:      updateLevelFail(dt);      break;
    case STATES.ABILITY_UNLOCK:  updateAbilityUnlock(dt);  break;
    case STATES.POWER_UP:        updatePowerUp(dt);        break;
    case STATES.PLAYING:         updatePlaying(dt);        break;
    case STATES.PAUSED:          updatePaused();           break;
    case STATES.UPGRADE:         updateUpgrade();          break;
    case STATES.GAMEOVER:        updateGameOver();         break;
    case STATES.NAME_ENTRY:      updateNameEntry();        break;
    case STATES.SETTINGS:        updateSettings();         break;
    case STATES.WIN:             updateWin();              break;
    case STATES.FRAGMENT_RESCUE: updateFragmentRescue();   break;
    case STATES.CLASS_EMERGENCE: updateClassEmergence();   break;
    case STATES.ARCHIVE:         updateArchive();          break;
    case STATES.ADMIN:           updateAdmin();            break;
  }
}

// Shared button rects computed by drawTitle each frame so update can read them
// story is drawn disabled (coming soon) and never handled in updateTitle
const _titleBtns = { start: null, story: null, multi: null, archive: null, admin: null, name: null };   // multi: drawn only (coming soon)

function _hitBtn(btn) {
  if (!btn) return false;
  const { mouseX: mx, mouseY: my } = input;
  return mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h;
}

// Music (the title music and the in-game ambient) can be switched off from
// the title screen or Settings; sound effects have their own switch
let _menuMuted = (() => { try { return localStorage.getItem('chromatic_decay_menu_muted') === '1'; } catch { return false; } })();
const _muteBtn = { r: null };

let _titleBoard = null;   // last drawn board: arrow hit boxes

// ── Leaderboard name ──────────────────────────────────────────
// Asked for once, before the first game; changed from the title screen

const NAME_MAX = 10;
let _nameInput = '';
let _nameThen  = null;    // what to do once a name is saved

function _withName(fn) { if (playerName()) fn(); else _openName(fn); }

function _openName(then) {
  _nameInput = playerName();
  _nameThen  = then;
  _kbdBtns   = [];
  if ('ontouchstart' in window) _openKbdOverlay(_nameInput, v => { _nameInput = v; }, _saveName);
  state = STATES.NAME_ENTRY;
}

function _saveName() {
  const n = _nameInput.trim();
  if (!n) return;
  setPlayerName(n);
  syncPlayer();
  _closeName();
}

function _closeName() {
  _kbdOverlay = false;
  _kbdOverlayCb = null;
  const then = _nameThen;
  _nameThen = null;
  state = STATES.TITLE;
  if (then && playerName()) then();
}

function updateNameEntry() {
  if (!_kbdOverlay) return;   // desktop types (see the keydown handler)
  if (input.mouseJustClicked && _nameCancelBtn && _hitBtn(_nameCancelBtn)) { _closeName(); return; }
  _handleKbdTap(_kbdOverlayInput, v => { _nameInput = v; _kbdOverlayInput = v; }, _saveName);
}

let _nameCancelBtn = null;
function drawNameEntry(W, H) {
  if (_kbdOverlay) {
    drawKbdOverlay(W, H);
    _nameCancelBtn = null;
    if (playerName()) {
      ctx.font = '12px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#8A8E99';
      _nameCancelBtn = { x: W / 2 - 50, y: H - 60, w: 100, h: 34 };
      ctx.fillText('CANCEL', W / 2, H - 38);
    }
    return;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7ADDD4'; ctx.font = '15px monospace';
  ctx.fillText(playerName() ? 'CHANGE YOUR NAME' : 'CHOOSE YOUR NAME', W / 2, H * 0.36);
  ctx.fillStyle = '#5E8C96'; ctx.font = '12px monospace';
  ctx.fillText('shown on the leaderboards', W / 2, H * 0.36 + 22);
  ctx.shadowBlur = 10; ctx.shadowColor = '#00E5CC';
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 34px monospace';
  ctx.fillText(_nameInput + (_nameInput.length < NAME_MAX && Math.floor(Date.now() / 450) % 2 ? '_' : ' '), W / 2, H * 0.36 + 72);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#8A8E99'; ctx.font = '12px monospace';
  ctx.fillText(`letters and numbers, up to ${NAME_MAX}  ·  ENTER to save${playerName() ? '  ·  ESC to cancel' : ''}`, W / 2, H * 0.36 + 108);
  ctx.textAlign = 'left';
}

function updateTitle() {
  if (story.active) story.reset();
  hud.minimal = false;
  resumeAudio();
  if (_menuMuted) stopTitleMusic(); else startTitleMusic();
  if (input.swipe) { cycleBoard(input.swipe < 0 ? 1 : -1); return; }
  // Space: the highlighted top button, Story Mode
  if (input.justPressed.space) { _withName(() => (_prologueDone() ? _openStoryMap() : _startStory())); return; }
  if (!input.mouseJustClicked)  return;

  if (_hitBtn(_muteBtn.r)) {
    _menuMuted = !_menuMuted;
    try { localStorage.setItem('chromatic_decay_menu_muted', _menuMuted ? '1' : '0'); } catch {}
    return;
  }

  if (_titleBoard && _hitBtn(_titleBoard.prev)) { cycleBoard(-1); return; }
  if (_titleBoard && _hitBtn(_titleBoard.next)) { cycleBoard(1); return; }
  if (_hitBtn(_titleBtns.name))    { _openName(null); return; }
  if (_hitBtn(_titleBtns.start))   { _withName(() => _openCharSelect()); return; }
  if (_hitBtn(_titleBtns.story))   { _withName(() => (_prologueDone() ? _openStoryMap() : _startStory())); return; }
  if (_hitBtn(_titleBtns.archive)) { state = STATES.ARCHIVE;                  return; }
  if (_hitBtn(_titleBtns.admin))   { state = STATES.SETTINGS; return; }
}

// ── Settings ──────────────────────────────────────────────────
// For players: leaderboard name, music, sound effects, auto-fire. The
// developer tuning panel (admin.js) only shows up when the page is opened
// with ?dev in the address.

const DEV_MODE = new URLSearchParams(location.search).has('dev');
const _setBtns = { name: null, music: null, sfx: null, auto: null, dev: null, back: null };
let _setGuard = 0;   // frames to ignore input after coming back from the name screen

function _setMusic(on) {
  _menuMuted = !on;
  try { localStorage.setItem('chromatic_decay_menu_muted', _menuMuted ? '1' : '0'); } catch {}
}

function updateSettings() {
  if (_menuMuted) stopTitleMusic(); else startTitleMusic();
  if (_setGuard > 0) { _setGuard--; return; }
  if (input.justPressed.escape) { state = STATES.TITLE; return; }
  if (!input.mouseJustClicked) return;
  if (_hitBtn(_setBtns.name))  { _openName(() => { state = STATES.SETTINGS; _setGuard = 2; }); return; }
  if (_hitBtn(_setBtns.music)) { _setMusic(_menuMuted); return; }
  if (_hitBtn(_setBtns.sfx))   { setSfxEnabled(!sfxEnabled()); return; }
  if (_hitBtn(_setBtns.auto))  { input.setAutoFire(!input.autoFire); return; }
  if (_hitBtn(_setBtns.dev))   { adminPanel.open(); state = STATES.ADMIN; return; }
  if (_hitBtn(_setBtns.back))  { state = STATES.TITLE; return; }
}

function drawSettings(W, H) {
  const narrow = W < 600, touch = 'ontouchstart' in window;
  const rows = [
    ['NAME',          playerName() || '—',               'name',  'CHANGE'],
    ['MUSIC',         _menuMuted ? 'OFF' : 'ON',          'music', _menuMuted ? 'TURN ON' : 'TURN OFF'],
    ['SOUND EFFECTS', sfxEnabled() ? 'ON' : 'OFF',        'sfx',   sfxEnabled() ? 'TURN OFF' : 'TURN ON'],
    ['AUTO-FIRE',     input.autoFire ? 'ON' : 'OFF',      'auto',  input.autoFire ? 'TURN OFF' : 'TURN ON'],
  ];
  const rowH = 54, pW = Math.min(480, W - 28);
  const pH = 70 + rows.length * rowH + (DEV_MODE ? 50 : 0) + 64;
  const pX = (W - pW) / 2, pY = Math.max(16, (H - pH) / 2);
  const top = drawSlab(ctx, pX, pY, pW, pH, { accent: '#00E5CC', depth: 10, glow: 0.25 });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF'; ctx.font = `bold ${narrow ? 18 : 22}px monospace`;
  ctx.fillText('SETTINGS', W / 2, top + 34);
  const bw = narrow ? 104 : 120;
  rows.forEach(([label, value, key, action], i) => {
    const y = top + 62 + i * rowH;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8A8E99'; ctx.font = `${narrow ? 10 : 11}px monospace`;
    ctx.fillText(label, pX + 22, y + 14);
    ctx.fillStyle = value === 'OFF' ? '#6E7A88' : '#FFFFFF'; ctx.font = `bold ${narrow ? 14 : 16}px monospace`;
    ctx.fillText(value, pX + 22, y + 34, pW - bw - 60);
    const hover = !touch && _hitBtn(_setBtns[key]);
    _setBtns[key] = drawSlabButton(ctx, pX + pW - bw - 20, y + 4, bw, 34, action, {
      accent: key === 'name' ? '#00E5FF' : '#8FA8B8', textColor: '#E8F0FF', fontSize: 11, lift: hover ? 1 : 0,
    });
  });
  let by = top + 62 + rows.length * rowH + 8;
  _setBtns.dev = null;
  if (DEV_MODE) {
    _setBtns.dev = drawSlabButton(ctx, pX + 20, by, pW - 40, 34, 'DEVELOPER TUNING', { accent: '#7A3050', textColor: '#F0B8CC', fontSize: 11 });
    by += 50;
  }
  _setBtns.back = drawSlabButton(ctx, W / 2 - 80, by, 160, 40, 'BACK', {
    accent: '#00E5FF', fontSize: 13, lift: !touch && _hitBtn(_setBtns.back) ? 1 : 0,
  });
  ctx.textAlign = 'left';
}

function updatePlaying(dt) {
  if (input.justPressed.escape) { state = STATES.PAUSED; return; }

  // Auto-fire toggle (Q or the AUTO button), and moving the operator along
  if (input.justPressed.q || (input.mouseJustClicked && _hitBtn(_autoBtn.r))) {
    input.setAutoFire(!input.autoFire);
    story.onToggleFire();
  }
  const _radio = level ? level.radio : (story.inTutorial ? story.radio : null);
  // Comms: Space, Enter, or a click / tap on the box moves on (Space only
  // while a line is up; otherwise Space dashes)
  const onBox = input.mouseJustClicked && _radio && _radio.hit(input.mouseX, input.mouseY);
  const lineUp = !!(_radio && _radio.cur);
  if (lineUp && (input.justPressed.space || input.justPressed.enter || onBox)) _radio.next();

  // While the operator is talking you can't shoot, and if Chromatics are
  // around, everything holds still until the line is done (nothing is said
  // over a fight)
  const talking = !!(_radio && _radio.cur);
  player.holdFire = talking;
  if (talking && enemies.enemies.some(e => e.isAlive)) {
    _radio.update(dt);
    camera.follow(player.x, player.y, vw(), vh());
    return;
  }

  // Dash. Desktop: Space or a click dashes toward the cursor (right-click
  // always works; with auto-fire off, the left button is the trigger).
  // Touch: the DASH button.
  const touchUI = 'ontouchstart' in window;
  if (input.mouseJustClicked && _hitBtn(_dashBtn.r)) player.dashQueued = true;
  else if (!touchUI && !lineUp && (input.justPressed.space || input.justPressed.rightClick ||
           (input.mouseJustClicked && input.autoFire && !onBox && !_hitBtn(_autoBtn.r)))) {
    player.dashQueued = true;
    player.dashToward = input.worldMouse(camera.x, camera.y, ZOOM);
  }
  // Activated abilities: E is the first the character has, F the second.
  // With none in that slot, the key does nothing. On touch, each has a button.
  player.grenadeCooldown = Math.max(0, (player.grenadeCooldown || 0) - dt);
  player.decoyCooldown   = Math.max(0, (player.decoyCooldown || 0) - dt);
  player.snareCooldown   = Math.max(0, (player.snareCooldown || 0) - dt);
  if (input.justPressed.e) _useAbility(player.abilities[0]);
  if (input.justPressed.f) _useAbility(player.abilities[1]);
  if (input.mouseJustClicked && _hitBtn(_grenadeBtn.r)) _useAbility(_throwId());
  // Touch: drag from the grenade button to where it should land, let go to
  // throw. A tap with no drag (or dragging back onto the button) cancels
  if (input.btnDragRelease) {
    const aim = _grenadeDragAim(input.btnDragRelease);
    if (aim) _useAbility(_throwId(), aim);
  }
  if (input.mouseJustClicked && _hitBtn(_sigBtn.r)) _useAbility('signature');
  const _px = player.x, _py = player.y;

  elapsed += dt;
  window._gameElapsed = elapsed;

  // Timed lore
  for (const t of loreTimeTriggers) {
    if (!t.fired && elapsed >= t.time) { t.fired = true; lore.trigger(t.id); }
  }
  if (!nearDeathTriggered && player.hp / player.maxHp <= 0.2) {
    nearDeathTriggered = true;
    lore.trigger('near_death');
  }

  // Player
  player.update(dt, input, map, camera, ZOOM, projectiles);
  if (player.justFired) sfxShoot(player.lastShotOverload, player.character);
  if (player.justHit)   { sfxPlayerHit(); player.justHit = false; waveSystem.noDamageTaken = false; story.onHit(); }
  if (player.justSignature) _signatureEffects(player.justSignature);
  if (player.justNet) { nets.fire(player.justNet.x, player.justNet.y, player.justNet.a); player.justNet = null; }
  for (const l of _lasers) l.t += dt;
  while (_lasers.length && _lasers[0].t >= LASER_FADE) _lasers.shift();
  if (player.justDashed) {
    player.justDashed = false;
    sfxDash();
    if (story.inTutorial) story.onDash();
  }
  if (player.perfectDodge) {
    // Dashed through a hit: the cooldown comes straight back
    player.perfectDodge = false;
    player.dashCooldown = Math.min(player.dashCooldown, 0.15);
    sfxPerfectDodge();
    particles.flash(player.x, player.y - 8, 22, 0.22);
  }

  // ── Auto-trigger ability when an enemy is within 50px ────
  if (player.classId && player.abilityCooldown <= 0) {
    const r2 = 50 * 50;
    const inRange = enemies.enemies.some(e => {
      if (!e.isAlive) return false;
      const dx = e.x - player.x, dy = e.y - player.y;
      return dx * dx + dy * dy <= r2;
    });
    if (inRange) player._useAbility();
  }

  // Circuit Breaker stun: signal set in player._useAbility(), applied here
  if (player._circuitBreakerActivated) {
    player._circuitBreakerActivated = false;
    for (const e of enemies.enemies) {
      if (e.type !== 'pink') e.stunTimer = 3.0;
    }
    particles.classEmergence(player.x, player.y, '#fff5c2');
  }

  // Enemies
  const dead = enemies.update(dt, player, map, projectiles, particles);
  for (const e of enemies.enemies) {
    if (!firstEnemySeen[e.type]) {
      firstEnemySeen[e.type] = true;
      lore.trigger(`${e.type}_first`);
    }
  }

  // Process enemy deaths
  for (const e of dead) {
    if (!e._storyCounted && story.inTutorial) { e._storyCounted = true; story.onKill(); }
    if (level && !e._levelCounted) { e._levelCounted = true; level.onKill(e); }
    else if (!level && !story.inTutorial && e.type in CHROMA_VALUE) _runChroma[e.type] = (_runChroma[e.type] || 0) + 1;
    drain.spawn(e);
    hud.flashKill();
    sfxEnemyKill(e.type);

    // Kill pulse (legacy Breaker trait)
    if (player.killPulse) {
      for (const other of enemies.enemies) {
        if (!other.isAlive) continue;
        if (dist(other.x, other.y, e.x, e.y) < 60) other.takeDamage(15);
      }
    }

    // Frequency Shatter: enemy was below 25% HP before kill → explode
    if (player.frequencyShatter && e.wasBelow25) {
      const shatterDmg = player.damage * player.damageMultiplier * 0.75;
      for (const other of enemies.enemies) {
        if (!other.isAlive) continue;
        if (dist(other.x, other.y, e.x, e.y) < 80) other.takeDamage(shatterDmg);
      }
      particles.classEmergence(e.x, e.y, '#fff5c2');
    }

    const killInfo = player.onKill(e.x, e.y, projectiles, particles, elapsed);
    waveSystem.onEnemyKilled(e.type);

    // Cascade Protocol AoE
    if (killInfo.cascadeTriggered) {
      const cascDmg = player.damage * player.damageMultiplier * 0.50;
      for (const other of enemies.enemies) {
        if (!other.isAlive) continue;
        if (dist(other.x, other.y, killInfo.cascadeX, killInfo.cascadeY) < 80) other.takeDamage(cascDmg);
      }
      particles.classEmergence(e.x, e.y, '#fff5c2');
    }
  }

  grenades.update(dt, enemies);
  decoys.update(dt, enemies);
  dashPowers.update(dt, player, enemies, level ? level.dashTargets : null);
  nets.update(dt, player, enemies, map, level ? level.dashTargets : null);
  snares.update(dt, enemies);

  // Projectiles
  projectiles.update(dt, map, player);
  // Arc Rounds that hit a cable can jump to a Level 4 junction box or dial
  if (level && projectiles.arcRackHits.length) level.onArcRack(projectiles.arcRackHits);
  projectiles.arcRackHits.length = 0;
  if (level) level.onRackHits(projectiles.rackHits);
  projectiles.rackHits.length = 0;
  projectiles.checkBulletCollisions(particles);
  projectiles.checkPlayerHits(player, particles);

  // Companion projectile absorption (Herald)
  if (companions.count > 0) companions.checkProjectileHits(projectiles);

  // Enemy contact
  enemies.checkPlayerContact(player, particles);

  // Projectile → enemy hits
  enemies.arcTargets = level ? level.arcTargets : null;   // an Arc Round can jump to these too
  const projKilled = enemies.checkProjectileHits(projectiles, particles, player);
  // Follow-Up: a round that hit nothing breaks the streak; a streak hit chimes
  if (projectiles.missed) { player.followUpMiss(); projectiles.missed = 0; }
  if (player.justFollowUp) { sfxFollowUp(player.justFollowUp); player.justFollowUp = 0; }
  for (const e of projKilled) {
    if (!e._storyCounted && story.inTutorial) { e._storyCounted = true; story.onKill(); }
    if (level && !e._levelCounted) { e._levelCounted = true; level.onKill(e); }
    drain.spawn(e);
    hud.flashKill();

    // Kill pulse (legacy)
    if (player.killPulse) {
      for (const other of enemies.enemies) {
        if (!other.isAlive) continue;
        if (dist(other.x, other.y, e.x, e.y) < 60) other.takeDamage(15);
      }
    }

    // Frequency Shatter
    if (player.frequencyShatter && e.wasBelow25) {
      const shatterDmg = player.damage * player.damageMultiplier * 0.75;
      for (const other of enemies.enemies) {
        if (!other.isAlive) continue;
        if (dist(other.x, other.y, e.x, e.y) < 80) other.takeDamage(shatterDmg);
      }
      particles.classEmergence(e.x, e.y, '#fff5c2');
    }

    const killInfo = player.onKill(e.x, e.y, projectiles, particles, elapsed);
    waveSystem.onEnemyKilled(e.type);

    // Cascade Protocol AoE
    if (killInfo.cascadeTriggered) {
      const cascDmg = player.damage * player.damageMultiplier * 0.50;
      for (const other of enemies.enemies) {
        if (!other.isAlive) continue;
        if (dist(other.x, other.y, killInfo.cascadeX, killInfo.cascadeY) < 80) other.takeDamage(cascDmg);
      }
      particles.classEmergence(e.x, e.y, '#fff5c2');
    }
  }

  // Wave system update — after all kills processed so enemy count is accurate
  waveSystem.update(dt, enemies, map, player);

  // ── Wave timer sound cues ──────────────────────────────────
  if (waveSystem.active && waveSystem.waveTimer > 0) {
    if (_timerSounds.wave !== waveSystem.wave) {
      _timerSounds = { wave: waveSystem.wave, warned: false, ticks: {} };
    }
    if (!_timerSounds.warned && waveSystem.waveTimer <= 10) {
      _timerSounds.warned = true;
      sfxTimerWarning();
    }
    for (const n of [5, 4, 3, 2, 1]) {
      if (!_timerSounds.ticks[n] && waveSystem.waveTimer <= n) {
        _timerSounds.ticks[n] = true;
        sfxCountdownTick(n);
      }
    }
  }

  // Wave timer expired — end the wave and give a level-up
  // Surviving enemies carry over into the next wave
  if (waveSystem.timerExpired) {
    waveSystem.timerExpired    = false;
    waveSystem.waveSpawnQueue  = [];   // cancel any remaining queued spawns
    waveSystem.pendingBosses   = 0;
    waveSystem.triggerClear();
    if (waveSystem.gameWon) { stopAmbient(); _enterWin(); }
    else _showNextUpgrade();
  }

  // Traps (Weaver) — apply slow and check for expiry
  if (traps.count > 0) traps.update(dt, enemies, particles);

  // Companions (Herald) — orbit, expiry AoE
  if (companions.count > 0) companions.update(dt, player, enemies, particles);

  drain.update(dt, player);


  // Echoes / fragments
  const rescued = echoes.update(dt, player, map, enemies, particles);
  if (rescued) {
    if (rescued.type === 'echo') {
      sfxEchoPickup();
      if (story.inTutorial) story.onEcho();
      hud.flashEcho();
      const wasFirst = player.echoesRescued === 0;
      player.onEchoRescue();
      if (wasFirst) lore.trigger('echo_first');
    } else if (rescued.type === 'fragment') {
      const frag = FRAGMENT_DATA[rescued.fragmentId];
      if (frag) {
        pendingFragment = frag;
        sfxFragmentPickup();
        lore.trigger(frag.loreId);
        const archive = loadArchive();

        // Breaker passive: finding RAZE gives -25% fire rate, +25% damage this run
        // Also unlocks Breaker traits for the rest of this run
        if (rescued.fragmentId === 'raze') {
          razeRescuedThisRun         = true;
          player.fireRateMultiplier *= 0.75;
          player.damageMultiplier   *= 1.25;
        }

        if (!archive[rescued.fragmentId]) {
          archive[rescued.fragmentId] = true;
          saveArchive(archive);
          player.fragmentsFound++;

          // Check if archive is now complete
          const allFound = ['sable','raze','lumen','cord','voss'].every(id => archive[id]);
          if (allFound) lore.trigger('archive_complete');
        }
        state = STATES.FRAGMENT_RESCUE;
      }
    }
  }

  particles.update(dt);
  lore.update(dt);
  hud.update(dt);

  // Wave clear detection — runs at the very end of the frame so ALL kills
  // (direct hits, cascade AoE, kill-pulse, frequency shatter) are fully
  // settled before we check. Uses .some() to avoid allocating a filtered array.
  if (waveSystem.active &&
      !waveSystem.waveClearFlag &&
      waveSystem.waveSpawnQueue.length === 0 &&
      waveSystem.pendingBosses === 0 &&
      !enemies.enemies.some(e => e.isAlive)) {
    waveSystem.triggerClear();
    if (waveSystem.gameWon) { stopAmbient(); _enterWin(); }
    else _showNextUpgrade();
  }

  if (story.inTutorial) {
    story.onMoved(Math.hypot(player.x - _px, player.y - _py));
    if (player.justFired) story.onShot();
    story.updateTutorial(dt);
  }

  if (level) {
    level.update(dt);
    if (level.complete) _finishLevel();
    else if (level.failed) { _startDeath(); return; }
    else if (level.wantOutro && state === STATES.PLAYING) {
      // A scene after the level (Level 5: meeting Raze), then on to the card and results
      const lv = level, who = lv.agent;
      const lines = _sceneFor('outro', lv.id, who, lv.outroKey);
      lv.wantOutro = false;
      if (!lines) { lv.outroDone = true; }
      else {
        _storyTime = 0;
        const sides = _sceneSides(who);
        story.playInterlude(lines, sides, () => { lv.outroDone = true; state = STATES.PLAYING; });
        state = STATES.STORY;
        return;
      }
    }
    else if (level.awaitUnlock && state === STATES.PLAYING) { _unlockT = 0; sfxUnlockTune(); state = STATES.ABILITY_UNLOCK; return; }
    else if (level.pendingPowerUp && state === STATES.PLAYING) { _unlockT = 0; sfxRelayChime(); state = STATES.POWER_UP; return; }
  }

  if (!player.alive) { _startDeath(); return; }

  camera.follow(player.x, player.y, vw(), vh());
}

function updatePaused() {
  if (input.justPressed.escape) {
    if (pauseQuitConfirm) { pauseQuitConfirm = false; return; }
    state = STATES.PLAYING;
    return;
  }
  if (!input.mouseJustClicked) return;
  const mx = input.mouseX, my = input.mouseY;
  const hit = (b) => b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;

  if (pauseQuitConfirm) {
    if (hit(_pauseBtns.confirmYes)) {
      pauseQuitConfirm = false;
      stopAmbient();
      story.reset();
      if (level) { bankChroma(level.chroma, 0.5); syncPlayer(); level = null; hud.minimal = false; state = STATES.STORY_MAP; return; }
      state = STATES.TITLE;
    } else if (hit(_pauseBtns.confirmNo)) {
      pauseQuitConfirm = false;
    }
    return;
  }
  if (hit(_pauseBtns.resume)) {
    state = STATES.PLAYING;
  } else if (hit(_pauseBtns.quit)) {
    pauseQuitConfirm = true;
  }
}

function updateUpgrade() {
  if (upgradeUI.handleInput(input, player, canvas)) {
    _checkClassEmergence();

    // If emergence just happened, show the emergence card first
    if (pendingEmergence) {
      state = STATES.CLASS_EMERGENCE;
      return;
    }

    waveSystem.pendingLevels = Math.max(0, waveSystem.pendingLevels - 1);

    if (waveSystem.pendingLevels > 0) {
      sfxWaveClear();
      _showNextUpgrade();
    } else if (waveSystem.gameWon) {
      stopAmbient();
      _enterWin();
    } else {
      const nextWave = waveSystem.wave + 1;
      waveSystem.startWave(nextWave, enemies, map, player);
      state = STATES.PLAYING;
    }
  }
}

function updateClassEmergence() {
  if (input.justPressed.space || input.justPressed.escape || input.mouseJustClicked) {
    pendingEmergence = null;

    waveSystem.pendingLevels = Math.max(0, waveSystem.pendingLevels - 1);

    if (waveSystem.pendingLevels > 0) {
      sfxWaveClear();
      _showNextUpgrade(); // _showNextUpgrade sets state itself — do NOT override
    } else if (waveSystem.gameWon) {
      stopAmbient();
      _enterWin();
    } else {
      const nextWave = waveSystem.wave + 1;
      waveSystem.startWave(nextWave, enemies, map, player);
      state = STATES.PLAYING;
    }
  }
}

const _ABILITY_DESCS = {
  warden:  'Restore 20 shield and emit a burst that damages nearby enemies.',
  breaker: 'Charge your next 3 shots to 3× damage. They fire golden and oversized.',
  ghost:   'Sprint at 2× speed with full invincibility for 1.5 seconds.',
  weaver:  'Place a trap at your position that slows and damages enemies.',
  herald:  'Summon an orbital companion that fires at nearby enemies.',
};

function _checkClassEmergence() {
  const emergenceResult = player.checkClassEmergence();
  if (emergenceResult) {
    if (emergenceResult.type === 'class') {
      lore.trigger(`class_${emergenceResult.classId}`);
      if (particles && player) particles.classEmergence(player.x, player.y, player.glowColor);
      // Queue the emergence card — shown after the upgrade screen resolves
      const cid = emergenceResult.classId;
      pendingEmergence = {
        classId:     cid,
        color:       player.glowColor,
        label:       cid.toUpperCase(),
        abilityName: ({ warden:'Barrier Pulse', breaker:'Overload Burst', ghost:'Phase Shift', weaver:'Deploy Trap', herald:'Summon Orb' })[cid] || cid,
        abilityDesc: _ABILITY_DESCS[cid] || '',
        cooldown:    ({ warden:12, breaker:16, ghost:6, weaver:10, herald:14 })[cid] || 10,
      };
    } else if (emergenceResult.type === 'subclass') {
      lore.trigger(`sub_${emergenceResult.subclassId}`);
    }
  }
}

function _showNextUpgrade() {
  // Classes (Warden, Breaker…) are retired from Arcade; the offer is the
  // white cards plus the shared deck of Story cards
  upgradeUI.present(player, []);
  if (upgradeUI.active) {
    if (player.upgradesTaken === 0) lore.trigger('upgrade_first');
    const lcb = waveSystem ? waveSystem.lastClearBonus : null;
    const bonusLevels = lcb?.bonusLevels || 0;
    upgradeUI.isBonusUpgrade = bonusLevels > 0 && waveSystem.pendingLevels <= bonusLevels;
    upgradeUI.waveContext = upgradeUI.isBonusUpgrade ? null : lcb;
    state = STATES.UPGRADE;
  } else {
    // No upgrades available (pool exhausted) — skip straight to next wave or win
    waveSystem.pendingLevels = 0;
    if (waveSystem.gameWon) { stopAmbient(); _enterWin(); }
    else { waveSystem.startWave(waveSystem.wave + 1, enemies, map, player); state = STATES.PLAYING; }
  }
}

// ── Shadow-occluded lighting — offscreen light mask ───────────
let _lightMaskCanvas = null;
let _lightMaskCtx    = null;

function _ensureLightMask() {
  const W = canvas.width, H = canvas.height;
  if (!_lightMaskCanvas || _lightMaskCanvas.width !== W || _lightMaskCanvas.height !== H) {
    _lightMaskCanvas        = document.createElement('canvas');
    _lightMaskCanvas.width  = W;
    _lightMaskCanvas.height = H;
    _lightMaskCtx           = _lightMaskCanvas.getContext('2d');
  }
  return _lightMaskCtx;
}

// Build and cache wall segments from map obstacles (called once per map load)
function _getSegments(mapObj) {
  if (mapObj._lightSegs) return mapObj._lightSegs;
  const s = [];
  for (const o of mapObj.obstacles) {
    s.push(
      [o.x, o.y, o.x+o.w, o.y],
      [o.x+o.w, o.y, o.x+o.w, o.y+o.h],
      [o.x+o.w, o.y+o.h, o.x, o.y+o.h],
      [o.x, o.y+o.h, o.x, o.y],
    );
  }
  const MW = CONFIG.map_width, MH = CONFIG.map_height;
  s.push([0,0,MW,0],[MW,0,MW,MH],[MW,MH,0,MH],[0,MH,0,0]);
  mapObj._lightSegs = s;
  return s;
}

// Cast a ray from (ox,oy) in direction (cos,sin); return distance to nearest wall
function _castRay(ox, oy, cos, sin, segs, maxDist) {
  let t = maxDist;
  for (const seg of segs) {
    const [x1,y1,x2,y2] = seg;
    const sdx = x2-x1, sdy = y2-y1;
    const denom = cos*sdy - sin*sdx;
    if (Math.abs(denom) < 1e-8) continue;
    const dx = x1-ox, dy = y1-oy;
    const s = (dx*sdy - dy*sdx) / denom;
    const u = (dx*sin  - dy*cos)  / denom;
    if (s >= 0 && s < t && u >= 0 && u <= 1) t = s;
  }
  return t;
}

// Wrap an angle into [-π, π)
function _wrapAngle(a) {
  if (a >= Math.PI)  return a - Math.PI * 2;
  if (a < -Math.PI)  return a + Math.PI * 2;
  return a;
}

// Compute visibility polygon for a light at (ox,oy) with given radius.
// uniformRays: extra rays spread evenly for areas with no nearby corners.
// All angles must share one range: corner rays come from atan2 (-π..π), so the
// uniform rays are generated in the same range. Mixing ranges made the upper
// half of the polygon trace twice out of order, leaving black slivers.
function _visPoly(ox, oy, segs, radius, obstacles, uniformRays = 48) {
  const angles = [];
  const r2 = (radius + 50) * (radius + 50);
  for (const o of obstacles) {
    for (const [cx, cy] of [[o.x,o.y],[o.x+o.w,o.y],[o.x,o.y+o.h],[o.x+o.w,o.y+o.h]]) {
      const dx = cx-ox, dy = cy-oy;
      if (dx*dx + dy*dy < r2) {
        const a = Math.atan2(dy, dx);
        angles.push(_wrapAngle(a-0.0001), _wrapAngle(a+0.0001));
      }
    }
  }
  for (let i = 0; i < uniformRays; i++) angles.push(-Math.PI + i * (Math.PI * 2 / uniformRays));
  angles.sort((a, b) => a - b);
  const poly = [];
  for (const a of angles) {
    const cos = Math.cos(a), sin = Math.sin(a);
    const t   = _castRay(ox, oy, cos, sin, segs, radius);
    poly.push(ox + cos*t, oy + sin*t);
  }
  return poly;  // flat [x0,y0, x1,y1, ...] in world coords
}

// Trace the polygon path on a canvas 2D context (world coords)
function _polyPath(c2d, poly) {
  if (poly.length < 4) return false;
  c2d.beginPath();
  c2d.moveTo(poly[0], poly[1]);
  for (let i = 2; i < poly.length; i += 2) c2d.lineTo(poly[i], poly[i+1]);
  c2d.closePath();
  return true;
}

// Stored kbd button rects for tap hit-testing — populated each draw frame
let _kbdBtns = [];

// Keyboard icon button rect — populated each draw frame on mobile initials screens
let _kbdIconBtn = null;

// Keyboard overlay state (mobile) — shown when user taps the keyboard icon
let _kbdOverlay = false;   // is overlay open?
let _kbdOverlayInput = ''; // current input being edited in overlay
let _kbdOverlayCb = null;  // { setValue, submit } callbacks

function _handleKbdTap(initials, setFn, submitFn) {
  if (!input.mouseJustClicked) return;
  const mx = input.mouseX, my = input.mouseY;
  for (const btn of _kbdBtns) {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      if (btn.key === 'DEL') {
        const v = initials.slice(0, -1);
        setFn(v);
        if (_kbdOverlay) _kbdOverlayInput = v;
      } else if (btn.key === 'OK') {
        if (initials.length > 0) {
          _kbdOverlay = false;
          _kbdOverlayCb = null;
          submitFn();
        }
      } else if (initials.length < NAME_MAX) {
        const v = initials + btn.key;
        setFn(v);
        if (_kbdOverlay) _kbdOverlayInput = v;
      }
      return;
    }
  }
}

// Opens the keyboard overlay for mobile initials entry
function _openKbdOverlay(currentVal, setFn, submitFn) {
  _kbdOverlay      = true;
  _kbdOverlayInput = currentVal;
  _kbdOverlayCb    = { setValue: setFn, submit: submitFn };
}

function updateGameOver() {
  // Tick the input guard — ignore all input until it clears
  if (_gameOverInputDelay > 0) { _gameOverInputDelay -= 0.016; return; }
  if (input.justPressed.space || input.mouseJustClicked) state = STATES.TITLE;
}

function _enterWin() {
  _winInputDelay = 0.5;
  _postArcadeRun(waveSystem.finalScore, 15, waveSystem.completionTime);
  state = STATES.WIN;
}

function updateWin() {
  if (_winInputDelay > 0) { _winInputDelay -= 0.016; return; }
  if (input.justPressed.space || input.mouseJustClicked) state = STATES.TITLE;
}

function updateFragmentRescue() {
  if (input.justPressed.space || input.mouseJustClicked) {
    pendingFragment = null;
    state = STATES.PLAYING;
  }
}

function updateArchive() {
  // ── Lore card open — X button, escape, or outside-card click closes it ──
  if (archiveLoreCard) {
    if (input.justPressed.escape) { archiveLoreCard = null; return; }
    if (input.mouseJustClicked) {
      // Always close — X button or tapping anywhere outside the text area
      archiveLoreCard = null;
    }
    return;
  }
  // ── Check lore entry buttons before falling through to exit ──
  if (input.mouseJustClicked) {
    if (_hitBtn(_archiveLoreBtns.world))   { archiveLoreCard = 'world';  return; }
    if (_hitBtn(_archiveLoreBtns.emitter)) { archiveLoreCard = 'emitter'; return; }
    if (_hitBtn(_archiveLoreBtns.raze))    { archiveLoreCard = 'raze';   return; }
    if (_hitBtn(_archiveLoreBtns.violet))  { archiveLoreCard = 'violet'; return; }
    if (_hitBtn(_archiveLoreBtns.yellow))  { archiveLoreCard = 'yellow'; return; }
    if (_hitBtn(_archiveLoreBtns.green))   { archiveLoreCard = 'green';  return; }
    if (_hitBtn(_archiveLoreBtns.orange))  { archiveLoreCard = 'orange'; return; }
    if (_hitBtn(_archiveLoreBtns.pink))    { archiveLoreCard = 'pink';   return; }
  }
  if (input.justPressed.escape || input.mouseJustClicked) state = STATES.TITLE;
}

function updateAdmin() {
  // Admin panel handles its own input via key/click events
  if (!adminPanel.active) { updateZoom(); state = STATES.TITLE; }
}

window.addEventListener('keydown', e => {
  // Admin panel gets first crack at keys when open
  if (state === STATES.ADMIN) {
    const consumed = adminPanel.handleKey(e);
    if (consumed) return;
    if (!adminPanel.active) { updateZoom(); state = STATES.TITLE; }
    return;
  }

  if (state === STATES.NAME_ENTRY) {
    if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key) && _nameInput.length < NAME_MAX) _nameInput += e.key.toUpperCase();
    if (e.key === 'Backspace') _nameInput = _nameInput.slice(0, -1);
    if (e.key === 'Enter') _saveName();
    if (e.key === 'Escape' && playerName()) _closeName();
  }
  if (state === STATES.TITLE && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) cycleBoard(e.key === 'ArrowLeft' ? -1 : 1);
});

window.addEventListener('wheel', e => {
  if (state === STATES.ADMIN) adminPanel.handleScroll(e);
}, { passive: true });

canvas.addEventListener('click', e => {
  if (state === STATES.ADMIN) {
    adminPanel.handleClick(e.offsetX, e.offsetY, canvas);
    if (!adminPanel.active) { updateZoom(); state = STATES.TITLE; }
  }
});

// ── Draw ──────────────────────────────────────────────────────

function draw() {
  const W = canvas.width, H = canvas.height;

  resetTransform();
  ctx.fillStyle = '#0D0E12';
  ctx.fillRect(0, 0, W, H);

  switch (state) {
    case STATES.TITLE:           drawTitle(W, H);          break;
    case STATES.CHAR_SELECT:     drawCharSelect(W, H);     break;
    case STATES.STORY:           story.drawScene(ctx, W, H, _storyTime); _drawStorySkip(W, H); break;
    case STATES.STORY_END:       drawGame(W, H); drawStoryEnd(W, H); break;
    case STATES.STORY_MAP:       drawStoryMap(W, H);       break;
    case STATES.LEVEL_END:       drawGame(W, H); drawLevelEnd(W, H); break;
    case STATES.DYING:           drawGame(W, H); drawDeath(W, H); break;
    case STATES.LEVEL_FAIL:      drawGame(W, H); drawLevelFail(W, H); break;
    case STATES.ABILITY_UNLOCK:  drawGame(W, H); drawAbilityUnlock(W, H); break;
    case STATES.POWER_UP:        drawGame(W, H); drawPowerUp(W, H); break;
    case STATES.PLAYING:         drawGame(W, H);           break;
    case STATES.PAUSED:          drawGame(W, H); drawPaused(W, H); break;
    case STATES.UPGRADE:         drawGame(W, H); upgradeUI.draw(ctx, canvas); break;
    case STATES.GAMEOVER:        drawGameOver(W, H);       break;
    case STATES.WIN:             drawWin(W, H);            break;
    case STATES.NAME_ENTRY:      drawNameEntry(W, H);      break;
    case STATES.SETTINGS:        drawSettings(W, H);       break;
    case STATES.FRAGMENT_RESCUE: drawGame(W, H); drawFragmentRescue(W, H); break;
    case STATES.CLASS_EMERGENCE: drawGame(W, H); drawClassEmergence(W, H); break;
    case STATES.ARCHIVE:         drawArchive(W, H);        break;
    case STATES.ADMIN:           adminPanel.draw(ctx, canvas); break;
  }
}

// Light radii (world px) — larger than before to match the wider zoom
const _PLAYER_LIGHT_R = 175;
const _ENEMY_LIGHT_R  = 130;

// Player light falling on a rack surface, 0–1.
// Side faces (nx,ny ≠ 0) must face the player and have a clear line of sight;
// top faces (0,0) only fall off with distance.
function _wallLight(px, py, nx, ny) {
  if (!player || !player.alive) return 0;
  const dx = px - player.x, dy = py - player.y;
  const d  = Math.hypot(dx, dy);
  const R  = _PLAYER_LIGHT_R * 1.4;
  if (d >= R) return 0;
  let f = Math.pow(1 - d / R, 1.5);
  if (nx || ny) {
    const facing = -(dx * nx + dy * ny) / (d || 1);
    if (facing <= 0) return 0;
    if (_castRay(player.x, player.y, dx / d, dy / d, _getSegments(map), d) < d - 1) return 0;
    f *= 0.4 + 0.6 * facing;
  }
  return f;
}

function drawGame(W, H) {
  applyWorldTransform();

  pixelMap.ensure(ZOOM);
  pixelMap.drawFloor(ctx, camera.x, camera.y);

  // ── Shadow-occluded lighting ──────────────────────────────────
  // Uses a visibility polygon per light source so light is blocked by server walls.
  // Step 1: Build light mask (offscreen canvas, darkness with clipped holes).
  // Step 2: Composite the mask over the scene.
  // Step 3: Draw tinted color glows clipped to the same polygons.
  {
    const _segs     = _getSegments(map);
    const _eRgb     = { violet:'82,0,255', yellow:'233,255,106', green:'141,255,106', orange:'253,108,29', pink:'248,29,120' };
    const _playerR  = _PLAYER_LIGHT_R;
    const _enemyR   = _ENEMY_LIGHT_R;
    // Pre-compute visibility polygons
    const _pPoly = player.alive ? _visPoly(player.x, player.y, _segs, _playerR, map.obstacles, 48) : null;
    const _ePairs = enemies.enemies
      .filter(e => e.isAlive)
      .map(e => ({ e, poly: _visPoly(e.x, e.y, _segs, _enemyR, map.obstacles, 24) }));
    // Server rack LED strip lights — only tall racks have the strip (h > 60),
    // source placed just below the bottom edge so light spills onto the floor only
    const _sLights = map.obstacles
      .filter(o => o.h > 60)
      .map(o => {
        const ox = o.x + o.w / 2, oy = o.y + o.h + 2; // +2 off the wall so vis-poly works
        return { ox, oy, hw: o.w / 2, poly: _visPoly(ox, oy, _segs, o.w * 0.8, map.obstacles, 16) };
      });

    // ── Build light mask ──────────────────────────────────────
    const lctx = _ensureLightMask();
    lctx.clearRect(0, 0, _lightMaskCanvas.width, _lightMaskCanvas.height);
    lctx.fillStyle = 'rgba(0,0,0,0.70)';  // dark base — rely on character lights
    lctx.fillRect(0, 0, _lightMaskCanvas.width, _lightMaskCanvas.height);

    // Apply the same world→screen transform so polygons (world coords) land correctly
    lctx.setTransform(ZOOM, 0, 0, ZOOM, Math.round(-camera.x * ZOOM), Math.round(-camera.y * ZOOM));
    lctx.globalCompositeOperation = 'destination-out';

    // Player — lift most darkness within visibility poly, but not to zero
    // so shadow edges blend into the surrounding dark rather than hard-clipping
    if (_pPoly) {
      const g = lctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, _playerR);
      g.addColorStop(0,    'rgba(0,0,0,0.72)');  // well-lit center
      g.addColorStop(0.45, 'rgba(0,0,0,0.40)');  // mid fade
      g.addColorStop(1,    'rgba(0,0,0,0)');      // merges into darkness
      lctx.fillStyle = g;
      if (_polyPath(lctx, _pPoly)) lctx.fill();
    }

    // Enemies — shallower lift so they feel dimmer than the player
    for (const { e, poly } of _ePairs) {
      const g = lctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, _enemyR);
      g.addColorStop(0,    'rgba(0,0,0,0.35)');
      g.addColorStop(0.45, 'rgba(0,0,0,0.12)');
      g.addColorStop(1,    'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      if (_polyPath(lctx, poly)) lctx.fill();
    }

    // Server LED strips — flat ellipse, clipped to vis-poly so walls cast shadows
    for (const { ox, oy, hw, poly } of _sLights) {
      const sx = hw, sy = hw * 0.45;
      const g  = lctx.createRadialGradient(ox, oy, 0, ox, oy, sx);
      g.addColorStop(0,   'rgba(0,0,0,0.68)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.35)');
      g.addColorStop(1,   'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.save();
      if (_polyPath(lctx, poly)) lctx.clip();
      lctx.beginPath(); lctx.ellipse(ox, oy, sx, sy, 0, 0, Math.PI);
      lctx.fill();
      lctx.restore();
    }

    lctx.globalCompositeOperation = 'source-over';
    lctx.setTransform(1, 0, 0, 1, 0, 0);

    // Composite light mask over main canvas (in screen space)
    ctx.save();
    ctx.resetTransform();
    ctx.drawImage(_lightMaskCanvas, 0, 0);
    ctx.restore(); // restores world transform

    // ── Tinted color glows — clipped to visibility polygons ───
    // Player: cool blue-white tint
    if (_pPoly) {
      ctx.save();
      if (_polyPath(ctx, _pPoly)) ctx.clip();
      const g = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, _playerR);
      g.addColorStop(0,    'rgba(190,215,255,0.17)');
      g.addColorStop(0.45, 'rgba(190,215,255,0.07)');
      g.addColorStop(1,    'rgba(190,215,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(player.x - _playerR, player.y - _playerR, _playerR*2, _playerR*2);
      ctx.restore();
    }

    // Enemies: each tinted with their own color
    for (const { e, poly } of _ePairs) {
      ctx.save();
      if (_polyPath(ctx, poly)) ctx.clip();
      const rgb = _eRgb[e.type] || '255,255,255';
      const g   = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, _enemyR);
      g.addColorStop(0,    `rgba(${rgb},0.17)`);
      g.addColorStop(0.45, `rgba(${rgb},0.07)`);
      g.addColorStop(1,    `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(e.x - _enemyR, e.y - _enemyR, _enemyR*2, _enemyR*2);
      ctx.restore();
    }

    // Server LED strips: flat cyan tint, clipped to vis-poly
    for (const { ox, oy, hw, poly } of _sLights) {
      const sx = hw, sy = hw * 0.45;
      const g  = ctx.createRadialGradient(ox, oy, 0, ox, oy, sx);
      g.addColorStop(0,   'rgba(0,229,255,0.35)');
      g.addColorStop(0.5, 'rgba(0,229,255,0.14)');
      g.addColorStop(1,   'rgba(0,229,255,0)');
      ctx.fillStyle = g;
      ctx.save();
      if (_polyPath(ctx, poly)) ctx.clip();
      ctx.beginPath(); ctx.ellipse(ox, oy, sx, sy, 0, 0, Math.PI);
      ctx.fill();
      ctx.restore();
    }
  }

  drain.drawFloor(ctx);
  traps.draw(ctx);
  echoes.draw(ctx);
  if (level) level.drawWorld(ctx);

  // ── Racks, three-quarter view: those whose front edge is above the
  // player's feet are behind them; the rest are drawn after, in front ──
  const _feet = player.y + 4;
  const _view = { x: camera.x, y: camera.y, w: vw(), h: vh() };
  pixelMap.drawRacks(ctx, camera.x, camera.y, _view, o => o.y + o.h <= _feet, _wallLight);

  projectiles.draw(ctx);
  projectiles.drawFizzles(ctx);
  enemies.draw(ctx);
  _drawHalfLife(ctx, false);
  snares.draw(ctx);
  player.draw(ctx);
  _drawHalfLife(ctx, true);
  drain.draw(ctx, player);
  companions.draw(ctx);
  particles.draw(ctx);

  pixelMap.drawRacks(ctx, camera.x, camera.y, _view, o => o.y + o.h > _feet, _wallLight);
  // A rack in front hides the player: show a see-through silhouette over it
  {
    const b = player.spriteBounds();
    const hidden = map.obstacles.some(o => o.y + o.h > _feet &&
      b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y - rackHeight(o));
    if (hidden) player.drawOccluded(ctx);
    // Echoes behind a rack (inside its footprint or its raised top face)
    echoes.drawHidden(ctx, e => map.obstacles.some(o =>
      e.x > o.x - 10 && e.x < o.x + o.w + 10 && e.y < o.y + o.h + 6 && e.y > o.y - rackHeight(o) - 18));

  }

  // ── Additive glow pass — halos bloom where they overlap and show through racks ──
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  projectiles.drawHalos(ctx);
  enemies.drawHalos(ctx);
  player.drawHalo(ctx);
  _drawFollowMark(ctx);
  _drawLasers(ctx);
  ctx.restore();

  // Grenades fly over the racks, and their smoke has to read over the glow,
  // so they're drawn last
  grenades.draw(ctx, enemies.enemies);
  decoys.draw(ctx);
  _drawGrenadeAim(ctx);
  dashPowers.draw(ctx);
  nets.draw(ctx);
  if (level) level.drawOverRacks(ctx);

  // ── Charging zones (pre-spawn indicators) ────────────────
  if (waveSystem && waveSystem.pendingSpawns.length > 0) {
    for (const ps of waveSystem.pendingSpawns) {
      const progress = 1 - ps.chargeTimer / 1.0; // 0→1 as charge completes
      const flash    = Math.sin(Date.now() * 0.018) * 0.5 + 0.5; // 0–1 pulse
      const alpha    = 0.25 + flash * 0.45;
      const radius   = 18 + (1 - progress) * 14; // shrinks as it charges up

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = CHARGE_COLORS[ps.type] || '#ffffff';
      ctx.shadowBlur  = 12;
      ctx.shadowColor = CHARGE_COLORS[ps.type] || '#ffffff';
      ctx.lineWidth   = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur  = 0;
      ctx.restore();
    }
  }

  // ── Mobile aim line ───────────────────────────────────────
  if ('ontouchstart' in window) {
    const aimLen = 60;
    const ax = player.x + Math.cos(player.facing) * aimLen;
    const ay = player.y + Math.sin(player.facing) * aimLen;
    ctx.save();
    ctx.setLineDash([4, 7]);
    ctx.strokeStyle = 'rgba(122,221,212,0.40)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  resetTransform();

  hud.draw(ctx, player, elapsed, waveSystem, W, H);
  // Half-Life running: a steady lilac tint round the screen edge
  if (player && player.spinUpTimer > 0) {
    const k = Math.min(1, player.spinUpTimer);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.38, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(229,140,255,0)'); g.addColorStop(1, `rgba(229,140,255,${(0.22 * k).toFixed(3)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  lore.draw(ctx, W, H);
  _drawEchoBeacon(W, H);
  story.drawTutorialHud(ctx, W, H);
  if (level) level.drawHud(ctx, W, H, 'ontouchstart' in window, (x, y) => [(x - camera.x) * ZOOM, (y - camera.y) * ZOOM]);
  _drawAutoFireBtn(W, H);
  _drawSignature(W, H);
  _drawGrenade(W, H);
  _drawKeyBar(W, H);
  _drawDashBtn(W, H);
  _drawLastEnemyArrow(W, H);

  // ── Off-screen enemy indicators (last 20s of wave) ───────────
  if (waveSystem && waveSystem.waveTimer > 0 && waveSystem.waveTimer <= 20) {
    const margin  = 28;   // px from screen edge
    const arrowR  = 10;   // half-size of arrow
    const vpX     = camera.x;
    const vpY     = camera.y;
    const vpW     = vw();
    const vpH     = vh();

    for (const e of enemies.enemies) {
      if (!e.isAlive) continue;

      // World position → screen position
      const sx = (e.x - vpX) * ZOOM;
      const sy = (e.y - vpY) * ZOOM;

      // Skip if on screen
      if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) continue;

      // Clamp to screen edge with margin
      const cx = Math.max(margin, Math.min(W - margin, sx));
      const cy = Math.max(margin, Math.min(H - margin, sy));

      // Angle from center of screen toward enemy
      const ang = Math.atan2(sy - H / 2, sx - W / 2);

      // Pulse opacity tied to wave timer urgency
      const urgency = 1 - waveSystem.waveTimer / 20;
      const alpha   = 0.55 + urgency * 0.35 + Math.sin(Date.now() * 0.006) * 0.10;

      ctx.save();
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.translate(cx, cy);
      ctx.rotate(ang);

      // Arrow pointing toward enemy
      ctx.beginPath();
      ctx.moveTo(arrowR, 0);
      ctx.lineTo(-arrowR * 0.6, -arrowR * 0.7);
      ctx.lineTo(-arrowR * 0.6,  arrowR * 0.7);
      ctx.closePath();
      ctx.fillStyle   = e.cfg.color;
      ctx.shadowBlur  = 10;
      ctx.shadowColor = e.cfg.glow_color || e.cfg.color;
      ctx.fill();
      ctx.shadowBlur  = 0;

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Companion count indicator (top right of ability bar)
  if (companions.count > 0) {
    ctx.fillStyle = '#fddede';
    ctx.font      = '22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`◉ ${companions.count}`, 14, H - 66);
    ctx.textAlign = 'left';
  }
  if (traps.count > 0) {
    ctx.fillStyle = '#d6faf7';
    ctx.font      = '22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`⬡ ${traps.count} traps`, 14, H - 80);
  }

  // ── Mobile virtual controls ───────────────────────────────
  if ('ontouchstart' in window) drawMobileControls(W, H);
}

// Tutorial: point out the Echo — rings and a label on it, an arrow at the
// screen edge when it's out of view
function _drawEchoBeacon(W, H) {
  const e = story.highlight === 'echo' ? story.echoTarget : null;
  if (!e || !e.active || !echoes.echoes.includes(e)) return;
  const sx = Math.round((e.x - camera.x) * ZOOM), sy = Math.round((e.y - camera.y) * ZOOM);
  const t = performance.now() / 1000;
  const col = '#FFB3D4';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px monospace';
  if (sx > 0 && sx < W && sy > 0 && sy < H) {
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    for (let k = 0; k < 2; k++) {
      const p = (t * 0.7 + k * 0.5) % 1;
      ctx.globalAlpha = (1 - p) * 0.4;
      ctx.beginPath(); ctx.arc(sx, sy, 12 + p * 24, 0, Math.PI * 2); ctx.stroke();
    }
    const by = sy - 46 + Math.round(Math.sin(t * 4) * 3);
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(sx - 7, by - 8); ctx.lineTo(sx + 7, by - 8); ctx.lineTo(sx, by); ctx.closePath(); ctx.fill();
    ctx.fillText('ECHO · HEALS', Math.max(52, Math.min(W - 52, sx)), by - 14);
  } else {
    const m = 34;
    const cx = Math.max(m, Math.min(W - m, sx)), cy = Math.max(m + 60, Math.min(H - m, sy));
    const ang = Math.atan2(sy - cy, sx - cx);
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 6);
    ctx.translate(cx, cy);
    ctx.fillStyle = col;
    ctx.fillText('ECHO', 0, -16);
    ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Auto-fire toggle: bottom right on desktop, between the sticks on touch
const _autoBtn = { r: null };
input.uiHit = (x, y) => state === STATES.PLAYING &&
  ((_autoBtn.r && x >= _autoBtn.r.x && x <= _autoBtn.r.x + _autoBtn.r.w &&
    y >= _autoBtn.r.y && y <= _autoBtn.r.y + _autoBtn.r.h) || story.radio.hit(x, y) ||
   (level && level.radio.hit(x, y)) ||
   (_sigBtn.r && x >= _sigBtn.r.x && x <= _sigBtn.r.x + _sigBtn.r.w && y >= _sigBtn.r.y && y <= _sigBtn.r.y + _sigBtn.r.h) ||
   (_grenadeBtn.r && x >= _grenadeBtn.r.x && x <= _grenadeBtn.r.x + _grenadeBtn.r.w && y >= _grenadeBtn.r.y && y <= _grenadeBtn.r.y + _grenadeBtn.r.h) ||
   (_dashBtn.r && x >= _dashBtn.r.x && x <= _dashBtn.r.x + _dashBtn.r.w && y >= _dashBtn.r.y && y <= _dashBtn.r.y + _dashBtn.r.h));

// Touch buttons are round and see-through, in a row above the sticks:
// AUTO up-left of the move stick; DASH (then the grenade) up-right
const BTN_R = 27;
const _btnRowY = H => H - 40 - input.joystickRadius * 2 - 14 - BTN_R;
const _btnSlotX = (W, i) => W - 14 - BTN_R - i * (BTN_R * 2 + 14);   // 0 = far right

// A round, see-through button; cdFrac (0..1) draws the recharge as a ring.
// Returns its bounding box for hit tests.
function _roundBtn(cx, cy, label, color, { sub = '', cdFrac = 0, glow = 0 } = {}) {
  const R = BTN_R;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,22,0.28)';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  if (glow > 0) { ctx.shadowBlur = 14 * glow; ctx.shadowColor = color; }
  ctx.globalAlpha = cdFrac > 0 ? 0.35 : 0.8;
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  if (cdFrac > 0) {
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cdFrac)); ctx.stroke();
  }
  ctx.globalAlpha = cdFrac > 0 ? 0.6 : 0.9;
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
  ctx.font = `bold ${label.length > 5 ? 9 : 11}px monospace`;
  ctx.fillText(label, cx, cy + (sub ? 0 : 4));
  if (sub) { ctx.font = '9px monospace'; ctx.fillStyle = color; ctx.fillText(sub, cx, cy + 12); }
  ctx.restore();
  return { x: cx - R, y: cy - R, w: R * 2, h: R * 2 };
}

function _drawAutoFireBtn(W, H) {
  const touch = 'ontouchstart' in window;
  const on = input.autoFire;
  const pulse = story.highlight === 'autofire' ? 0.5 + 0.5 * Math.sin(performance.now() / 160) : 0;
  if (touch) {
    _autoBtn.r = _roundBtn(14 + BTN_R, _btnRowY(H), 'AUTO', on ? '#00E5CC' : '#8FA8B8', { sub: on ? 'ON' : 'OFF', glow: pulse });
    return;
  }
  const w = 118, h = 30, x = W - w - 16, y = H - h - 20;
  _autoBtn.r = drawSlabButton(ctx, x, y, w, h, on ? 'AUTO ● ON' : 'AUTO ○ OFF', {
    accent: on ? '#00E5CC' : '#8FA8B8', fontSize: 12, glow: 0.15 + pulse * 0.6,
  });
  if (!touch) {
    ctx.fillStyle = 'rgba(143,168,184,0.7)'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
    ctx.fillText('Q', x - 8, y + h / 2 + 4);
    ctx.textAlign = 'left';
  }
}

function drawMobileControls(W, H) {
  const r     = input.joystickRadius;
  const thumbR = r * 0.42;
  const pad   = 40;

  function drawJoystick(baseX, baseY, curX, curY, active) {
    // Outer ring
    ctx.beginPath();
    ctx.arc(baseX, baseY, r, 0, Math.PI * 2);
    ctx.strokeStyle = active ? 'rgba(196,200,212,0.45)' : 'rgba(196,200,212,0.18)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Inner fill
    ctx.beginPath();
    ctx.arc(baseX, baseY, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,33,48,0.30)';
    ctx.fill();

    // Thumb nub
    const dx  = curX - baseX, dy = curY - baseY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const tx  = baseX + (len > r ? (dx / len) * r : dx);
    const ty  = baseY + (len > r ? (dy / len) * r : dy);

    ctx.beginPath();
    ctx.arc(tx, ty, thumbR, 0, Math.PI * 2);
    ctx.fillStyle = active ? 'rgba(196,200,212,0.70)' : 'rgba(196,200,212,0.30)';
    ctx.fill();
  }

  // Left joystick
  const lj = input.leftJoystick;
  const lBaseX = lj ? lj.baseX : W * 0.18;
  const lBaseY = lj ? lj.baseY : H - pad - r;
  drawJoystick(lBaseX, lBaseY, lj ? lj.curX : lBaseX, lj ? lj.curY : lBaseY, !!lj);

  // Right joystick (aim) — same vertical level as left
  const rj = input.rightJoystick;
  const rRestX = W * 0.82;
  const rRestY = H - pad - r;
  const rBaseX = rj ? rj.baseX : rRestX;
  const rBaseY = rj ? rj.baseY : rRestY;
  drawJoystick(rBaseX, rBaseY, rj ? rj.curX : rBaseX, rj ? rj.curY : rBaseY, !!rj);
}

// ── Title ─────────────────────────────────────────────────────

// Enemy colors, vivid versions for title particles
const _ENEMY_COLORS = ['#7B3FFF', '#FFEE22', '#55FF11', '#FF5500', '#FF0066'];

let _titleParts = [];

// ── Story Mode ────────────────────────────────────────────────
// Scenes, the pick and the tutorial script live in story.js; these are the
// hooks into the world it needs.

let _storyTime = 0;
const _storySkipBtn = { r: null };

const story = new StoryMode({
  touch: () => 'ontouchstart' in window,
  openCharSelect: () => _openCharSelect('story'),
  startTutorialRun: agent => { selectedCharacter = agent; startRun({ tutorial: true }); },
  // Several at once spread evenly around the player (two = opposite sides)
  spawnNear: (type, n) => { const a0 = Math.random() * Math.PI * 2; for (let i = 0; i < n; i++) { const p = _freeSpotNear(170, 250, n > 1 ? a0 + i * Math.PI * 2 / n : null); enemies.spawnEnemyAt(type, p.x, p.y); } },
  spawnEchoNear: () => { const p = _freeSpotNear(260, 380); const e = new Echo(p.x, p.y); echoes.echoes.push(e); return e; },
  playerHurt: () => player.hp < player.maxHp * 0.8,
  autoFire: () => input.autoFire,
  endTutorial: () => {
    try { localStorage.setItem('chromatic_decay_prologue_done', '1'); } catch {}
    _storyEndDelay = 0.6;
    state = STATES.STORY_END;
  },
});

// A clear spot on the floor at a random angle, minR–maxR from the player
function _freeSpotNear(minR, maxR, ang = null) {
  const PAD = 24;
  for (let tries = 0; tries < 80; tries++) {
    const a = ang === null ? Math.random() * Math.PI * 2 : ang + (Math.random() - 0.5) * 0.8, r = minR + Math.random() * (maxR - minR);
    const x = player.x + Math.cos(a) * r, y = player.y + Math.sin(a) * r;
    if (x < 50 || y < 50 || x > CONFIG.map_width - 50 || y > CONFIG.map_height - 50) continue;
    if (map.obstacles.some(o => x + PAD > o.x && x - PAD < o.x + o.w && y + PAD > o.y && y - PAD < o.y + o.h)) continue;
    return { x, y };
  }
  const fa = ang === null ? 0 : ang;
  return { x: player.x + Math.cos(fa) * minR, y: player.y + Math.sin(fa) * minR };
}

function _startStory() {
  _storyTime = 0;
  stopTitleMusic();
  story.start();
  state = STATES.STORY;
}

function updateStory(dt) {
  _storyTime += dt;
  const skip = input.justPressed.escape || (input.mouseJustClicked && _hitBtn(_storySkipBtn.r));
  if (skip) { story.skipScene(); return; }
  story.updateScene(dt, input.justPressed.space || input.mouseJustClicked);
}

function _drawStorySkip(W, H) {
  const touch = 'ontouchstart' in window;
  const w = 84, h = 28;
  _storySkipBtn.r = drawSlabButton(ctx, W - w - 14, 14, w, h, 'SKIP ›', {
    accent: '#5E8C96', textColor: '#9FB4BE', fontSize: 12, depth: 4, lift: !touch && _hitBtn(_storySkipBtn.r) ? 1 : 0,
  });
  if (!touch) {
    ctx.fillStyle = 'rgba(143,168,184,0.6)'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
    ctx.fillText('ESC', W - w - 22, 32);
    ctx.textAlign = 'left';
  }
}

// Prologue complete
let _storyEndDelay = 0;
const _storyEndBtns = { arcade: null, title: null };
function updateStoryEnd(dt) {
  if (_storyEndDelay > 0) { _storyEndDelay -= dt; return; }
  if (input.justPressed.escape) { story.reset(); stopAmbient(); state = STATES.TITLE; return; }
  if (!input.mouseJustClicked && !input.justPressed.space) return;
  if (input.justPressed.space || _hitBtn(_storyEndBtns.title)) { story.reset(); stopAmbient(); state = STATES.TITLE; return; }
  if (_hitBtn(_storyEndBtns.arcade)) { story.reset(); hud.minimal = false; stopAmbient(); _openStoryMap(); }
}
function drawStoryEnd(W, H) {
  dimBackdrop(ctx, W, H, 0.75);
  const pW = Math.min(420, W - 32), pH = 210;
  const pX = (W - pW) / 2, pY = (H - pH) / 2 - 8;
  const top = drawSlab(ctx, pX, pY, pW, pH, { accent: '#E8F0FF', depth: 12, screen: 40, glow: 0.3 });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF'; ctx.shadowBlur = 12; ctx.shadowColor = '#E8F0FF';
  _fitFont('PROLOGUE COMPLETE', pW - 30, 22, 'bold ');
  ctx.fillText('PROLOGUE COMPLETE', W / 2, top + 30);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#A9B6C4'; ctx.font = '13px monospace';
  ctx.fillText('Level 1 is open: the Server Floor.', W / 2, top + 70);
  const bw = (pW - 60) / 2;
  _storyEndBtns.arcade = drawSlabButton(ctx, pX + 20, top + 110, bw, 40, 'CONTINUE', { accent: '#00E5FF', fontSize: 13, lift: _hitBtn(_storyEndBtns.arcade) ? 1 : 0 });
  _storyEndBtns.title  = drawSlabButton(ctx, pX + 40 + bw, top + 110, bw, 40, 'TITLE',      { accent: '#8FA8B8', textColor: '#C4C8D4', fontSize: 13, lift: _hitBtn(_storyEndBtns.title) ? 1 : 0 });
  ctx.textAlign = 'left';
}

// ── Story levels ──────────────────────────────────────────────
// The level (level.js) runs the beats; these are the hooks into the world,
// the Story map (level select) and the results screen.

const levelApi = {
  player:     () => player,
  enemies,
  map:        () => map,
  // Never on top of the player: anything closer than 220px goes elsewhere
  spawnEnemy: (type, x, y) => {
    if (Math.hypot(x - player.x, y - player.y) < 220) ({ x, y } = map.randomSpawn(player.x, player.y, [], 300, 0));
    return enemies.spawnEnemyAt(type, x, y);
  },
  spawnEcho:  (x, y) => echoes.echoes.push(new Echo(x, y)),
  projectiles: () => projectiles,
  clearField: () => { enemies.reset(); projectiles.reset(); },
  touch:      () => 'ontouchstart' in window,
  beamOut: () => sfxBeamOut(),
  needsUnlock: () => { const c = _levelCard(); return !!c && !hasCard(selectedCharacter, c.id); },
  razeFree:    () => razeFree(),
};

const STORY_LEVELS = [
  { id: 1, name: 'SERVER FLOOR' },
  { id: 2, name: 'COLD STORAGE' },
  { id: 3, name: 'THE STACKS' },
  { id: 4, name: 'WIRE ROOM' },
  { id: 5, name: "RAZE'S ROOM" },
];
const CHROMA_COLORS = { violet: '#8B5CFF', yellow: '#E9FF6A', green: '#8DFF6A' };

let _pendingLevel = 1;
let _levelResult = null, _levelEndDelay = 0;
let _mapDelay = 0;
const _mapBtns = { rows: [], back: null };
const _levelEndBtns = { cont: null, replay: null };

function _prologueDone() {
  try { return localStorage.getItem('chromatic_decay_prologue_done') === '1'; } catch { return false; }
}

function _openStoryMap() {
  _mapDelay = 0.2;
  state = STATES.STORY_MAP;
}

function _finishLevel() {
  const counts = { ...level.chroma };
  bankChroma(counts, 1);
  const rec = recordClear(level.id, level.agent);
  syncPlayer();
  const outcome = level.agent === 'raze' ? RAZE_OUTCOMES[level.id] : level.post ? level.def.outcomePost : level.def.outcome;
  _levelResult = { id: level.id, name: level.def.name, agent: level.agent, chroma: counts, first: rec.first, unlocks: rec.unlocks, outcome };
  level = null;
  _levelEndDelay = 0.6;
  sfxWaveClear();
  state = STATES.LEVEL_END;
}

function updateLevelEnd(dt) {
  if (_levelEndDelay > 0) { _levelEndDelay -= dt; return; }
  const go = () => { stopAmbient(); hud.minimal = false; _openStoryMap(); };
  if (input.justPressed.escape || input.justPressed.space) { go(); return; }
  if (!input.mouseJustClicked) return;
  if (_hitBtn(_levelEndBtns.cont)) { go(); return; }
  if (_hitBtn(_levelEndBtns.replay)) { _pendingLevel = _levelResult.id; startRun({ level: _levelResult.id }); }
}

function drawLevelEnd(W, H) {
  const r = _levelResult;
  if (!r) return;
  dimBackdrop(ctx, W, H, 0.78);
  const sig = r.unlocks.find(u => u.kind === 'signature');
  const newAgent = r.unlocks.find(u => u.kind === 'agent');
  const pW = Math.min(460, W - 28);
  ctx.font = '13px monospace';
  const outL = r.outcome ? _wrapLines(r.outcome, pW - 30) : [];
  const dy = outL.length ? outL.length * 17 + 4 : 0;   // room for the mission outcome
  ctx.font = '12px monospace';
  const agentL = newAgent ? _wrapLines("Long rifle, slow and heavy. Pick him for Arcade, or replay the Story as him: each level he clears gives one of his tricks back.", pW - 60) : [];
  const agentH = newAgent ? 62 + agentL.length * 15 : 0;
  const pH = (sig ? 330 : 236) + dy + (newAgent ? agentH + 16 : 0);
  const pX = (W - pW) / 2, pY = Math.max(16, (H - pH) / 2 - 8);
  const col = AGENT_COLOR[r.agent];
  const top = drawSlab(ctx, pX, pY, pW, pH, { accent: col, depth: 12, screen: 40, glow: 0.35 });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF'; ctx.shadowBlur = 12; ctx.shadowColor = col;
  _fitFont(`${r.name} CLEARED`, pW - 30, 22, 'bold ');
  ctx.fillText(`${r.name} CLEARED`, W / 2, top + 30);
  ctx.shadowBlur = 0;
  ctx.fillStyle = col; ctx.font = '12px monospace';
  ctx.fillText(`as ${r.agent.toUpperCase()}${r.first ? '  ·  first clear' : ''}`, W / 2, top + 52);
  if (outL.length) {
    ctx.fillStyle = '#C4C8D4'; ctx.font = '13px monospace';
    outL.forEach((l, k) => ctx.fillText(l, W / 2, top + 70 + k * 17));
  }

  // Chroma collected, by colour, and the wallet after banking
  ctx.fillStyle = '#8A8E99'; ctx.font = '11px monospace';
  ctx.fillText('CHROMA COLLECTED', W / 2, top + 82 + dy);
  const keys = ['violet', 'yellow', 'green'];
  const cw = Math.min(110, (pW - 40) / 3);
  keys.forEach((k, i) => {
    const cx = W / 2 + (i - 1) * cw;
    ctx.fillStyle = CHROMA_COLORS[k];
    ctx.fillRect(Math.round(cx - 30), top + 96 + dy, 8, 8);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`+${r.chroma[k] || 0}`, Math.round(cx - 16), top + 105 + dy);
    ctx.fillStyle = '#6E7A88'; ctx.font = '10px monospace';
    ctx.fillText(`${profile().chroma[k]} total`, Math.round(cx - 16), top + 120 + dy);
    ctx.textAlign = 'center';
  });

  let by = top + 150 + dy;
  if (sig) {
    const s2 = SIGNATURES[sig.who];
    const touch = 'ontouchstart' in window;
    drawSlab(ctx, pX + 18, by, pW - 36, 88, { accent: col, depth: 4, glow: 0.4 });
    ctx.fillStyle = col; ctx.font = 'bold 11px monospace';
    ctx.fillText('SIGNATURE UNLOCKED', W / 2, by + 18);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 17px monospace';
    ctx.fillText(s2.name, W / 2, by + 40);
    ctx.fillStyle = '#C4C8D4';
    _fitFont(s2.desc, pW - 60, 12, '');
    ctx.fillText(s2.desc, W / 2, by + 60);
    ctx.fillStyle = '#7ADDD4'; ctx.font = '10px monospace';
    ctx.fillText(touch ? 'Tap its button. Works in Story and Arcade.' : 'Press E. Works in Story and Arcade.', W / 2, by + 78);
    by += 104;
  }
  // Level 5's first clear: Raze joins
  if (newAgent) {
    const gold = AGENT_COLOR.raze;
    const at = drawSlab(ctx, pX + 18, by, pW - 36, agentH, { accent: gold, depth: 4, glow: 0.4 });
    ctx.fillStyle = gold; ctx.font = 'bold 12px monospace';
    ctx.fillText('NEW AGENT', W / 2, at + 16);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 17px monospace';
    ctx.fillText('RAZE', W / 2, at + 37);
    ctx.fillStyle = '#C4C8D4'; ctx.font = '12px monospace';
    agentL.forEach((l, k) => ctx.fillText(l, W / 2, at + 55 + k * 15));
    by += agentH + 16;
  }
  const bw = (pW - 60) / 2;
  _levelEndBtns.cont   = drawSlabButton(ctx, pX + 20, by, bw, 40, 'CONTINUE', { accent: '#00E5FF', fontSize: 13, lift: _hitBtn(_levelEndBtns.cont) ? 1 : 0 });
  _levelEndBtns.replay = drawSlabButton(ctx, pX + 40 + bw, by, bw, 40, 'REPLAY', { accent: '#8FA8B8', textColor: '#C4C8D4', fontSize: 13, lift: _hitBtn(_levelEndBtns.replay) ? 1 : 0 });
  ctx.textAlign = 'left';
}

function updateStoryMap(dt) {
  if (_mapDelay > 0) { _mapDelay -= dt; return; }
  if (input.justPressed.escape) { state = STATES.TITLE; return; }
  if (input.justPressed.space) { _pendingLevel = 1; _openCharSelect('level'); return; }
  if (!input.mouseJustClicked) return;
  if (_hitBtn(_mapBtns.back)) { state = STATES.TITLE; return; }
  for (const row of _mapBtns.rows) {
    if (!_hitBtn(row.r)) continue;
    if (row.id === 0) { _startStory(); return; }
    if (LEVELS[row.id] && levelUnlocked(row.id)) { _pendingLevel = row.id; _openCharSelect('level'); }
    return;
  }
}

// Story cards still to earn: levels open to play, characters free to play them
const _canEarn = (lv, who) => {
  const c = (LEVEL_CARDS[lv] || {})[who];
  return !!c && !!LEVELS[lv] && levelUnlocked(lv) && (who !== 'raze' || razeFree()) && !hasCard(who, c.id);
};
const _cardsWaiting = () => Object.keys(LEVEL_CARDS).flatMap(lv => ['dex', 'juno', 'raze'].filter(who => _canEarn(+lv, who)));
// Earned Story cards that haven't come up in an Arcade offer yet
const _newArcadeCards = () => STORY_CARDS.filter(c => hasCard(c.who, c.id) && !cardSeen(c.who, c.id));

function drawStoryMap(W, H) {
  ctx.fillStyle = '#0D0E12'; ctx.fillRect(0, 0, W, H);
  dimBackdrop(ctx, W, H, 0);
  const narrow = W < 600, short = H < 560, tiny = H < 440;   // tiny: landscape phones
  const headY = short ? 34 : 54;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF'; ctx.shadowBlur = 18; ctx.shadowColor = '#00E5CC';
  _fitFont('STORY', W - 32, short ? 24 : 32, 'bold ');
  ctx.fillText('STORY', W / 2, headY);
  ctx.shadowBlur = 0;

  // Chroma wallet
  const wallet = profile().chroma;
  ctx.font = 'bold 13px monospace';
  const items = ['violet', 'yellow', 'green'].map(k => ({ k, t: String(wallet[k] || 0) }));
  const widths = items.map(it => ctx.measureText(it.t).width + 26);
  let wx = W / 2 - widths.reduce((a, b) => a + b, 0) / 2;
  items.forEach((it, i) => {
    ctx.fillStyle = CHROMA_COLORS[it.k]; ctx.fillRect(Math.round(wx), headY + 16, 8, 8);
    ctx.fillStyle = '#C4C8D4'; ctx.textAlign = 'left'; ctx.fillText(it.t, Math.round(wx + 13), headY + 25);
    wx += widths[i];
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5E8C96'; ctx.font = '10px monospace';
  ctx.fillText('CHROMA', W / 2, headY + 40);

  // Rows: the prologue, then the levels
  const rowW = Math.min(560, W - 28), rowX = (W - rowW) / 2;
  // Phones held upright: the blurb wraps to a second line, so rows are taller
  const twoLine = narrow && !short && !tiny;
  const rowH = tiny ? 34 : short ? 46 : twoLine ? 72 : 58, gap = tiny ? 4 : short ? 6 : 10;
  let y = headY + (short ? 54 : 66);
  _mapBtns.rows = [];
  const rows = [{ id: 0, name: 'PROLOGUE · THE CALL' }, ...STORY_LEVELS];
  for (const row of rows) {
    const playable = row.id === 0 || (LEVELS[row.id] && levelUnlocked(row.id));
    const built = row.id === 0 || !!LEVELS[row.id];
    const hover = playable && _hitBtn(_mapBtns.rows.find(x => x.id === row.id)?.r);
    const waiting = playable && row.id > 0 && ['dex', 'juno', 'raze'].some(who => _canEarn(row.id, who));
    const accent = playable ? (row.id === 0 ? '#8FA8B8' : '#00E5CC') : '#3A4450';
    const top = drawSlab(ctx, rowX, y, rowW, rowH, { accent, depth: 5, lift: hover ? 1 : 0, glow: playable ? 0.2 : 0 });
    _mapBtns.rows.push({ id: row.id, r: { x: rowX, y: y - 4, w: rowW, h: rowH + 8 } });
    ctx.textAlign = 'left';
    ctx.fillStyle = playable ? '#FFFFFF' : '#5A6470';
    ctx.font = `bold ${narrow || tiny ? 13 : 15}px monospace`;
    // A card still waiting here: the mission name glows gold
    if (waiting) { ctx.save(); ctx.shadowColor = '#FFD23F'; ctx.shadowBlur = 8 + 6 * Math.sin(Date.now() * 0.003); ctx.fillStyle = '#FFE680'; }
    ctx.fillText(row.id === 0 ? row.name : `${row.id} · ${row.name}`, rowX + 14, top + (tiny ? 21 : short ? 20 : 24));
    if (waiting) ctx.restore();
    ctx.font = `${narrow ? 10 : 11}px monospace`;
    // Second line of text; on landscape phones (tiny) rows are one line, and
    // only the right-hand status shows
    const sub = (text, color) => {
      if (tiny) return;
      ctx.fillStyle = color; ctx.font = '12px monospace';
      let lines = _wrapLines(text, rowW - 28);
      const max = twoLine ? 2 : 1;
      if (lines.length > max) { lines = lines.slice(0, max); lines[max - 1] = lines[max - 1].replace(/\s*\S*$/, '') + '…'; }
      lines.forEach((l, k) => ctx.fillText(l, rowX + 14, top + (short ? 36 : 44) + k * 15));
    };
    if (row.id === 0) {
      sub('Replay the introduction and tutorial.', '#8A8E99');
    } else if (!built) {
      sub('Coming soon', '#5A6470');
      if (tiny) { ctx.textAlign = 'right'; ctx.fillStyle = '#5A6470'; ctx.fillText('Coming soon', rowX + rowW - 14, top + 21); }
    } else {
      // A tick per character who has cleared it; a glowing ◆ for anyone whose
      // card here is still waiting
      sub(row.id === 5 && razeFree() ? LEVELS[5].blurbPost : LEVELS[row.id].blurb, '#8A8E99');
      ctx.textAlign = 'right';
      ctx.font = `bold ${narrow ? 11 : 12}px monospace`;
      let rx = rowX + rowW - 14;
      for (const who of razeFree() ? ['raze', 'juno', 'dex'] : ['juno', 'dex']) {
        const n = timesCleared(row.id, who), card = _canEarn(row.id, who);
        const label = card ? `◆ ${who.toUpperCase()}` : `${who.toUpperCase()} ${n ? '✓' : '·'}`;
        ctx.fillStyle = n || card ? AGENT_COLOR[who] : '#4A5560';
        if (card) {
          ctx.save();
          ctx.globalAlpha = 0.7 + 0.3 * Math.sin(Date.now() * 0.003 + rx * 0.05);
          ctx.shadowBlur = 10; ctx.shadowColor = AGENT_COLOR[who];
          ctx.fillText(label, rx, top + (tiny ? 21 : short ? 20 : 24));
          ctx.restore();
        } else ctx.fillText(label, rx, top + (tiny ? 21 : short ? 20 : 24));
        rx -= ctx.measureText(label).width + 14;
      }
    }
    y += rowH + gap;
  }

  // Landscape phones: Back goes in the top-left corner so it never covers a row
  const bx = tiny ? 14 : rowX, by = tiny ? 12 : Math.min(H - 52, y + 8);
  _mapBtns.back = drawSlabButton(ctx, bx, by, tiny ? 90 : 110, tiny ? 30 : 36, '‹ BACK', { accent: '#5E8C96', textColor: '#9FB4BE', fontSize: 12, lift: _hitBtn(_mapBtns.back) ? 1 : 0 });
  ctx.textAlign = 'left';
}

// Opening the door for the first time as this character: the first power-up
// of the level is theirs to keep, as a card in their Arcade upgrade offers
let _unlockT = 0;
const _unlockBtn = { r: null };
const _levelCard = () => (LEVEL_CARDS[level ? level.id : 0] || {})[selectedCharacter] || null;

function updateAbilityUnlock(dt) {
  _unlockT += dt;
  if (_unlockT < 0.8) return;
  const take = input.justPressed.space || input.justPressed.enter || (input.mouseJustClicked && _hitBtn(_unlockBtn.r));
  if (!take) return;
  const card = _levelCard();
  if (card) unlockCard(level.agent, card.id);
  level.openDoor();
  state = STATES.PLAYING;
}

function drawAbilityUnlock(W, H) {
  const card = _levelCard();
  if (!card) return;
  const name = level.agent[0].toUpperCase() + level.agent.slice(1);
  _drawReward(W, H, {
    color: AGENT_COLOR[level.agent], top: level.def.unlockTop || 'THE DOOR DRINKS THE CHARGE. SOME OF IT STAYS WITH YOU.',
    label: 'NEW CARD  ·  YOURS TO KEEP', name: card.name, desc: card.desc,
    hint: `It now shows up in ${name}'s Arcade upgrades.`,
    button: 'TAKE IT',
  });
}

// A section cleared: the level's next power-up
function updatePowerUp(dt) {
  _unlockT += dt;
  if (_unlockT < 0.8) return;
  if (input.justPressed.space || input.justPressed.enter || (input.mouseJustClicked && _hitBtn(_unlockBtn.r))) {
    level.takePowerUp(player);
    state = STATES.PLAYING;
  }
}

function drawPowerUp(W, H) {
  const pu = level.pendingPowerUp;
  if (!pu) return;
  _drawReward(W, H, {
    color: AGENT_COLOR[level.agent], top: 'THE CHARGE IN YOUR EMITTER SETTLES INTO SOMETHING NEW.',
    label: level.def.powerups ? `POWER UP  ·  ${level.powers.length + 1} / 3` : 'NEW ABILITY  ·  CLEAR THE LEVEL TO KEEP IT', name: pu.name, desc: pu.desc,
    hint: (typeof pu.hint === 'function' ? pu.hint('ontouchstart' in window) : pu.hint) || 'Lasts for the rest of this level.', button: 'NICE',
  });
}

// Shared panel for rewards: fades in, then a button (Space / Enter / click)
function _drawReward(W, H, o) {
  const k = Math.min(1, _unlockT / 0.6);
  dimBackdrop(ctx, W, H, 0.8 * k);
  ctx.save();
  ctx.globalAlpha = k;
  // Text wraps rather than shrinking; the panel grows to fit it
  const pW = Math.min(460, W - 28), tw = pW - 40;
  ctx.font = '12px monospace';         const topL  = _wrapLines(o.top, pW - 30);
  ctx.font = '14px monospace';         const descL = _wrapLines(o.desc, tw);
  ctx.font = '13px monospace';         const hintL = _wrapLines(o.hint, tw);
  const pH = 196 + (topL.length - 1) * 16 + descL.length * 19 + hintL.length * 17;
  const pX = (W - pW) / 2, pY = Math.max(8, (H - pH) / 2 - 10);
  const top = drawSlab(ctx, pX, pY, pW, pH, { accent: o.color, depth: 12, screen: 24 + topL.length * 16, glow: 0.5 });
  ctx.textAlign = 'center';
  let y = top + 24;
  ctx.fillStyle = '#A9B6C4'; ctx.font = '12px monospace';
  for (const l of topL) { ctx.fillText(l, W / 2, y); y += 16; }
  y += 18;
  ctx.fillStyle = o.color; ctx.font = 'bold 13px monospace';
  ctx.fillText(o.label, W / 2, y); y += 34;
  ctx.fillStyle = '#FFFFFF'; ctx.shadowBlur = 16; ctx.shadowColor = o.color;
  _fitFont(o.name, tw, 28, 'bold ');
  ctx.fillText(o.name, W / 2, y); y += 30;
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#C4C8D4'; ctx.font = '14px monospace';
  for (const l of descL) { ctx.fillText(l, W / 2, y); y += 19; }
  y += 6;
  ctx.fillStyle = '#7ADDD4'; ctx.font = '13px monospace';
  for (const l of hintL) { ctx.fillText(l, W / 2, y); y += 17; }
  const bw = 170;
  _unlockBtn.r = drawSlabButton(ctx, W / 2 - bw / 2, y + 10, bw, 42, _unlockT < 0.8 ? '…' : o.button, {
    accent: o.color, fontSize: 14, glow: 0.4, lift: _hitBtn(_unlockBtn.r) ? 1 : 0,
  });
  ctx.restore();
  ctx.textAlign = 'left';
}

// ── Death ─────────────────────────────────────────────────────
// Mega Man X style: the body glows and shrinks, then bursts into two rings of
// light orbs flying outward (no strobing). Then game over (Arcade) or the
// level-failed screen (Story).
let _death = null;
let _levelFail = null, _levelFailDelay = 0;
const _failBtns = { restart: null, map: null };

function _startDeath() {
  _death = { t: 0, x: player.x, y: player.y - 8, color: AGENT_COLOR[player.character] || '#FFFFFF' };
  player.alive = false;
  player.firing = false;
  sfxDeath();
  state = STATES.DYING;
}

function updateDying(dt) {
  _death.t += dt;
  particles.update(dt);
  if (_death.t < 2.3) return;
  if (level) {
    const kept = bankChroma(level.chroma, 0.5);
    syncPlayer();
    _levelFail = { id: level.id, name: level.def.name, agent: level.agent, kept };
    _levelFail.reason = level.failReason || null;
    if (level.checkpointIdx != null) _checkpoint = { id: level.id, agent: level.agent, idx: level.checkpointIdx, label: level.checkpointLabel || 'boss', granted: level.granted.slice() };
    level = null;
    _levelFailDelay = 0.4;
    state = STATES.LEVEL_FAIL;
  } else {
    handleGameOver();
  }
}

function drawDeath(W, H) {
  const d = _death, t = d.t;
  const sx = (d.x - camera.x) * ZOOM, sy = (d.y - camera.y) * ZOOM;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (t < 0.35) {
    const k = t / 0.35;
    drawGlow(ctx, d.color, sx, sy, 44 - 30 * k, 0.7);
    drawGlow(ctx, '#FFFFFF', sx, sy, 22 - 14 * k, 0.9);
  }
  for (const [t0, off] of [[0.35, 0], [0.75, Math.PI / 8]]) {
    if (t < t0) continue;
    const u = t - t0;
    const R = u * 175;
    const a = Math.max(0, 1 - u / 1.5);
    for (let k = 0; k < 8; k++) {
      const ang = off + k * Math.PI / 4;
      const x = sx + Math.cos(ang) * R, y = sy + Math.sin(ang) * R;
      const pr = 6 + 1.5 * Math.sin(u * 9 + k);
      drawGlow(ctx, d.color, x, y, pr * 3.2, 0.55 * a);
      ctx.globalAlpha = a;
      ctx.strokeStyle = d.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(x, y, pr * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function updateLevelFail(dt) {
  if (_levelFailDelay > 0) { _levelFailDelay -= dt; return; }
  const cp = _checkpoint && _checkpoint.id === _levelFail.id ? _checkpoint : null;
  const restart = () => startRun(cp ? { level: _levelFail.id, from: cp } : { level: _levelFail.id });
  const leave   = () => { stopAmbient(); hud.minimal = false; _openStoryMap(); };
  if (input.justPressed.space || input.justPressed.enter) { restart(); return; }
  if (input.justPressed.escape) { leave(); return; }
  if (!input.mouseJustClicked) return;
  if (_hitBtn(_failBtns.restart)) restart();
  else if (_hitBtn(_failBtns.map)) leave();
}

function drawLevelFail(W, H) {
  const f = _levelFail;
  if (!f) return;
  dimBackdrop(ctx, W, H, 0.78);
  const pW = Math.min(420, W - 28), pH = 236;
  const pX = (W - pW) / 2, pY = (H - pH) / 2 - 8;
  const top = drawSlab(ctx, pX, pY, pW, pH, { accent: '#F85A8A', depth: 12, screen: 40, glow: 0.3 });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF'; ctx.shadowBlur = 12; ctx.shadowColor = '#F85A8A';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(f.reason === 'escape' ? 'DOOR SEALED' : 'SIGNAL LOST', W / 2, top + 32);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#A9B6C4'; ctx.font = '12px monospace';
  ctx.fillText(`${f.name}  ·  ${f.agent.toUpperCase()}`, W / 2, top + 54);
  ctx.fillStyle = '#8A8E99'; ctx.font = '11px monospace';
  ctx.fillText('CHROMA KEPT (HALF)', W / 2, top + 86);
  const keys = ['violet', 'yellow', 'green'];
  const cw = Math.min(100, (pW - 40) / 3);
  keys.forEach((k, i) => {
    const cx = W / 2 + (i - 1) * cw;
    ctx.fillStyle = CHROMA_COLORS[k]; ctx.fillRect(Math.round(cx - 24), top + 99, 8, 8);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`+${f.kept[k] || 0}`, Math.round(cx - 11), top + 108);
    ctx.textAlign = 'center';
  });
  const cp = _checkpoint && _checkpoint.id === f.id;
  if (cp) {
    ctx.fillStyle = '#7ADDD4'; ctx.font = '11px monospace';
    ctx.fillText(`Retry starts at the ${_checkpoint.label}. Leave, and you start over.`, W / 2, top + 136, pW - 30);
  }
  const bw = (pW - 60) / 2, by = top + 150;
  _failBtns.restart = drawSlabButton(ctx, pX + 20, by, bw, 40, cp ? 'RETRY ' + _checkpoint.label.toUpperCase() : 'RESTART', { accent: '#00E5FF', fontSize: 13, lift: _hitBtn(_failBtns.restart) ? 1 : 0 });
  _failBtns.map     = drawSlabButton(ctx, pX + 40 + bw, by, bw, 40, 'STORY MAP', { accent: '#8FA8B8', textColor: '#C4C8D4', fontSize: 13, lift: _hitBtn(_failBtns.map) ? 1 : 0 });
  ctx.textAlign = 'left';
}

// One enemy left and it's off screen: an arrow at the edge, in its colour
function _drawLastEnemyArrow(W, H) {
  const alive = enemies.enemies.filter(e => e.isAlive);
  if (alive.length !== 1) return;
  if (waveSystem.active && waveSystem.waveTimer > 0 && waveSystem.waveTimer <= 20) return;   // already marked
  const e = alive[0];
  const sx = (e.x - camera.x) * ZOOM, sy = (e.y - camera.y) * ZOOM;
  if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) return;
  const m = 28;
  const cx = Math.max(m, Math.min(W - m, sx)), cy = Math.max(m + 90, Math.min(H - m - 60, sy));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = e.cfg.color;
  ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
  ctx.fillText('LAST', 0, -16);
  ctx.rotate(Math.atan2(sy - cy, sx - cx));
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// Signature effects that touch the world (the shots themselves come from player.js)
function _signatureEffects(who) {
  player.justSignature = null;
  sfxSignature(who);
  const col = AGENT_COLOR[who];
  // Half-Life: a soft ring of her colour; Arc Discharge's blast is its rounds
  if (who === 'juno') particles.classEmergence(player.x, player.y, col);
  // (Arc Discharge's stun rides on its rounds; Half-Life's decay on Juno's)
  if (who === 'raze' && player.laserShot) { _fireLaser(player.laserShot); player.laserShot = null; }
}

// Raze's Laser Round: a thin laser straight along his aim, right across the
// room. It stops at the first rack (Punch-Through lets it through one) and
// hits every Chromatic on its line, nearest first (the first counts for
// Follow-Up). Level 5's anchors take a light from it (level.onLaser).
const _lasers = [];
const LASER_FADE = 0.45;
function _fireLaser(ls) {
  const ux = Math.cos(ls.a), uy = Math.sin(ls.a);
  let through = player.punchThrough || 0, inside = null, end = 1700;
  for (let d = 0; d < 1700; d += 4) {
    const x = ls.x + ux * d, y = ls.y + uy * d;
    if (x < 0 || y < 0 || x > CONFIG.map_width || y > CONFIG.map_height) { end = d; break; }
    const o = map.obstacles.find(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
    if (o && o !== inside) {
      if (through > 0) { through--; inside = o; projectiles.punches.push({ x, y, a: ls.a, t: 0 }); }
      else { end = d; break; }
    } else if (!o) inside = null;
  }
  const x2 = ls.x + ux * end, y2 = ls.y + uy * end;
  const hits = [];
  for (const e of enemies.enemies) {
    if (!e.isAlive || e.phased) continue;
    const k = (e.x - ls.x) * ux + (e.y - ls.y) * uy;
    if (k < 0 || k > end) continue;
    if (Math.abs((e.y - ls.y) * ux - (e.x - ls.x) * uy) <= e.hitSize + 4) hits.push({ e, k });
  }
  hits.sort((a, b) => a.k - b.k);
  hits.forEach(({ e }, i) => e.takeDamage(ls.damage * (i === 0 && player.followUp ? player.followUpHit(e) : 1)));
  if (!hits.length) player.followUpMiss();
  if (player.justFollowUp) { sfxFollowUp(player.justFollowUp); player.justFollowUp = 0; }
  if (level && level.onLaser) level.onLaser(ls.x, ls.y, x2, y2, ls.castId);
  _lasers.push({ x1: ls.x, y1: ls.y, x2, y2, t: 0 });
}

// The laser: a thin bright core with two gold strands twisting tight round
// it, fading out (never a plain line; no flash)
function _drawLasers(ctx) {
  for (const l of _lasers) {
    const a = 1 - l.t / LASER_FADE;
    const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#FFD23F';
    ctx.globalAlpha = 0.16 * a; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    const steps = Math.max(8, Math.round(L / 5));
    ctx.lineWidth = 1;
    for (const side of [1, -1]) {
      ctx.globalAlpha = 0.8 * a;
      ctx.beginPath();
      for (let k = 0; k <= steps; k++) {
        const f = k / steps, off = side * Math.sin(f * L / 7 - l.t * 30) * (1.5 + 2 * l.t / LASER_FADE);
        const x = l.x1 + dx * f + nx * off, y = l.y1 + dy * f + ny * off;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = '#FFF6C8'; ctx.globalAlpha = a; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    drawGlow(ctx, '#FFD23F', l.x1, l.y1, 16, 0.5 * a);
    drawGlow(ctx, '#FFD23F', l.x2, l.y2, 22, 0.5 * a);
    ctx.restore();
  }
}

// Follow-Up: three gold brackets round the last Chromatic hit, turning
// slowly; one lights per hit in the streak (lit = the next hit is boosted)
function _drawFollowMark(ctx) {
  const fu = player && player.followUp && player.followTarget;
  if (!fu) return;
  const e = fu.e, t = _gameTime(), n = Math.min(3, fu.n);
  const r = e.drawSize * 1.9, cy = e.y - e.lift;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const a0 = -Math.PI / 2 + i * Math.PI * 2 / 3 + t * 0.8;
    ctx.globalAlpha = i < n ? 0.9 : 0.25;
    ctx.beginPath(); ctx.arc(e.x, cy, r, a0 - 0.45, a0 + 0.45); ctx.stroke();
  }
  ctx.restore();
}

// Touch grenade aim: the drag from the button, as a landing point. A drag of
// GRENADE_DRAG_PX screen px reaches full range; under 18 px is no throw
const GRENADE_DRAG_PX = 110;
function _grenadeDragAim(d) {
  const len = Math.hypot(d.dx, d.dy);
  if (!player || len < 18) return null;
  const r = Math.min(GRENADE_RANGE, len / GRENADE_DRAG_PX * GRENADE_RANGE);
  return { x: player.x + d.dx / len * r, y: player.y + d.dy / len * r };
}
// Thrown abilities (lobbed over racks, aimed at the cursor or by dragging on
// touch): Dex's grenade, Juno's Decoy Beacon. A character has at most one
const THROWS = {
  grenade: { name: 'GRENADE', color: '#B6FF2E', cd: () => player.grenadeCooldown || 0, max: GRENADE_CD, radius: GRENADE_RADIUS },
  decoy:   { name: 'DECOY',   color: '#E58CFF', cd: () => player.decoyCooldown || 0,   max: DECOY_CD,   radius: DECOY_RADIUS * 0.5 },
  snare:   { name: 'SNARE',   color: '#FFD23F', cd: () => player.snareCooldown || 0,   max: SNARE_CD,   radius: SNARE_RADIUS },
};
function _throwId() { return player ? player.abilities.find(id => THROWS[id]) || null : null; }
input.dragHit = (x, y) => state === STATES.PLAYING && !!player && !!_throwId() && THROWS[_throwId()].cd() <= 0 &&
  !!_grenadeBtn.r && x >= _grenadeBtn.r.x && x <= _grenadeBtn.r.x + _grenadeBtn.r.w && y >= _grenadeBtn.r.y && y <= _grenadeBtn.r.y + _grenadeBtn.r.h;

// While dragging: a ring where it will land and a dotted lob to it
function _drawGrenadeAim(ctx) {
  const d = input.btnDrag;
  if (!d || !player) return;
  const aim = _grenadeDragAim({ dx: d.x - d.x0, dy: d.y - d.y0 });
  const th = THROWS[_throwId()];
  if (!aim || !th) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = th.color; ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.75;
  ctx.beginPath(); ctx.ellipse(aim.x, aim.y, th.radius, th.radius * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.18; ctx.fillStyle = th.color; ctx.fill();
  ctx.globalAlpha = 0.7; ctx.fillStyle = th.color;
  for (let k = 1; k < 10; k++) {
    const f = k / 10;
    ctx.fillRect(Math.round(player.x + (aim.x - player.x) * f) - 1, Math.round(player.y - 8 + (aim.y - player.y + 8) * f - Math.sin(f * Math.PI) * 46) - 1, 2, 2);
  }
  ctx.restore();
}

function _useAbility(id, at) {
  if (!id || !player || player.beaming) return;
  if (id === 'grenade' && player.grenade && player.grenadeCooldown <= 0) {
    // Stun grenade: at the cursor on desktop; on touch, where the drag says
    const ap = player._aimPoint;
    if (!at && 'ontouchstart' in window) return;
    const tx = at ? at.x : ap ? ap.x : player.x + Math.cos(player.facing) * 190;
    const ty = at ? at.y : ap ? ap.y : player.y + Math.sin(player.facing) * 190;
    grenades.throw(player.x, player.y - 8, tx, ty);
    player.grenadeCooldown = GRENADE_CD;
  } else if (id === 'decoy' && player.decoy && player.decoyCooldown <= 0) {
    // Decoy Beacon: thrown the same way as the grenade
    const ap = player._aimPoint;
    if (!at && 'ontouchstart' in window) return;
    const tx = at ? at.x : ap ? ap.x : player.x + Math.cos(player.facing) * 190;
    const ty = at ? at.y : ap ? ap.y : player.y + Math.sin(player.facing) * 190;
    decoys.throw(player.x, player.y - 8, tx, ty);
    player.decoyCooldown = DECOY_CD;
  } else if (id === 'snare' && player.snare && player.snareCooldown <= 0) {
    // Snare Trap: thrown the same way as the grenade
    const ap = player._aimPoint;
    if (!at && 'ontouchstart' in window) return;
    const tx = at ? at.x : ap ? ap.x : player.x + Math.cos(player.facing) * 190;
    const ty = at ? at.y : ap ? ap.y : player.y + Math.sin(player.facing) * 190;
    snares.throw(player.x, player.y - 8, tx, ty);
    player.snareCooldown = SNARE_CD;
  } else if (id === 'signature' && player.signature && player.signatureCooldown <= 0) {
    player._useSignature(projectiles);
  }
}

// Half-Life running: Juno stands in a lilac radiation field. Under her, two
// rings turning opposite ways with a trefoil-ish tick pattern; over her,
// motes rising off her and a soft glow. Fades out over its last second.
function _drawHalfLife(ctx, over) {
  const T = player && player.spinUpTimer;
  if (!(T > 0)) return;
  const col = '#E58CFF', t = _gameTime(), k = Math.min(1, T);
  const x = player.x, y = player.y;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (!over) {
    for (const [r, dir, n] of [[22, 1, 3], [30, -1, 6]]) {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.7 * k;
      for (let i = 0; i < n; i++) {
        const a0 = t * 2.2 * dir + i * Math.PI * 2 / n;
        ctx.beginPath(); ctx.ellipse(x, y + 4, r, r * 0.5, 0, a0, a0 + Math.PI / n * 0.9); ctx.stroke();
      }
    }
    drawGlow(ctx, col, x, y, 40, 0.3 * k);
  } else {
    ctx.fillStyle = col;
    for (let i = 0; i < 10; i++) {
      const f = (t * 0.8 + i / 10) % 1, a = i * 2.4;
      ctx.globalAlpha = (1 - f) * k;
      ctx.fillRect(Math.round(x + Math.cos(a) * (10 + f * 6)) - 1, Math.round(y - 6 - f * 34) - 1, 2, 2);
    }
    drawGlow(ctx, col, x, y - 10, 26, 0.22 * k);
  }
  ctx.restore();
}
function _gameTime() { return performance.now() / 1000; }

// What each activated ability looks like in the HUD
function _abilityInfo(id) {
  if (THROWS[id]) return { name: THROWS[id].name, color: THROWS[id].color, cd: THROWS[id].cd(), max: THROWS[id].max };
  if (id === 'signature' && player.signature) {
    const sig = SIGNATURES[player.signature];
    // Half-Life running: the slot lights up and counts down
    if (player.spinUpTimer > 0) return { name: `ON ${player.spinUpTimer.toFixed(1)}`, color: AGENT_COLOR[player.signature], cd: 0, max: 1 };
    return { name: sig.name.split(' ')[0], color: AGENT_COLOR[player.signature], cd: player.signatureCooldown || 0, max: player.signatureCooldownMax || sig.cd };
  }
  return null;
}

// Desktop: a key bar at the bottom centre — SPACE (or click) dash, then the E and F
// ability slots. Each shows its key, a fill that rises as it recharges, and
// the seconds left; ready slots light up in their colour.
function _drawKeyBar(W, H) {
  if (!player || 'ontouchstart' in window) return;
  const slots = [
    { key: 'SPACE', name: player.netDash ? 'NET' : 'DASH', color: player.netDash ? '#FFD23F' : '#E8F0FF', cd: player.dashCooldown || 0, max: player.dashCooldownMax || DASH_CD },
    { key: 'E', ...(_abilityInfo(player.abilities[0]) || {}) },
    { key: 'F', ...(_abilityInfo(player.abilities[1]) || {}) },
  ];
  const w = 104, h = 42, gap = 8;
  const x0 = Math.round(W / 2 - (w * 3 + gap * 2) / 2), y = H - h - 12;
  slots.forEach((sl, i) => {
    const x = x0 + i * (w + gap);
    const empty = !sl.name, ready = !empty && sl.cd <= 0;
    ctx.save();
    ctx.fillStyle = 'rgba(7,11,18,0.82)';
    ctx.fillRect(x, y, w, h);
    if (!empty) {
      const k = sl.cd > 0 ? 1 - sl.cd / sl.max : 1;
      ctx.globalAlpha = ready ? 0.22 : 0.14;
      ctx.fillStyle = sl.color;
      ctx.fillRect(x, y + h * (1 - k), w, h * k);
      ctx.globalAlpha = 1;
    }
    if (ready) { ctx.shadowBlur = 10; ctx.shadowColor = sl.color; }
    ctx.strokeStyle = empty ? '#262E38' : ready ? sl.color : '#46505C';
    ctx.lineWidth = ready ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;
    // Key badge
    ctx.font = 'bold 10px monospace';
    const kw = ctx.measureText(sl.key).width + 8;
    ctx.fillStyle = empty ? '#262E38' : ready ? sl.color : '#46505C';
    ctx.fillRect(x + 4, y + 4, kw, 13);
    ctx.fillStyle = '#07090D'; ctx.textAlign = 'left';
    ctx.fillText(sl.key, x + 8, y + 14);
    // Name, and seconds left while recharging
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = empty ? '#3A4450' : ready ? '#FFFFFF' : '#8A94A0';
    ctx.fillText(empty ? '—' : sl.name, x + w / 2, y + 33);
    if (!empty && sl.cd > 0) {
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#C4C8D4';
      ctx.fillText(sl.cd < 10 ? sl.cd.toFixed(1) : Math.ceil(sl.cd), x + w - 5, y + 14);
    }
    ctx.restore();
  });
  ctx.textAlign = 'left';
}

// Touch: a DASH button just above the aim stick
const _dashBtn = { r: null };
function _drawDashBtn(W, H) {
  _dashBtn.r = null;
  if (!('ontouchstart' in window) || !player) return;
  const cd = player.dashCooldown || 0;
  _dashBtn.r = _roundBtn(_btnSlotX(W, 0), _btnRowY(H), cd > 0 ? cd.toFixed(1) : player.netDash ? 'NET' : 'DASH', player.netDash ? '#FFD23F' : '#E8F0FF',
    { cdFrac: cd / (player.dashCooldownMax || DASH_CD) });
}

// Touch: the thrown ability's button (grenade or decoy), next to DASH; press
// and drag to aim (desktop shows it in the key bar)
const _grenadeBtn = { r: null };
function _drawGrenade(W, H) {
  _grenadeBtn.r = null;
  const th = THROWS[_throwId()];
  if (!th || !('ontouchstart' in window)) return;
  const cd = th.cd(), ready = cd <= 0;
  _grenadeBtn.r = _roundBtn(_btnSlotX(W, 1), _btnRowY(H), ready ? th.name : cd.toFixed(1), th.color, { cdFrac: cd / th.max });
}

// Touch: the signature's button (desktop shows it in the key bar)
const _sigBtn = { r: null };
function _drawSignature(W, H) {
  _sigBtn.r = null;
  if (!player || !player.signature || !('ontouchstart' in window)) return;
  const sig = SIGNATURES[player.signature];
  const col = AGENT_COLOR[player.signature];
  const cd = player.signatureCooldown || 0, max = player.signatureCooldownMax || sig.cd;
  const ready = cd <= 0;
  const on = player.spinUpTimer > 0;
  _sigBtn.r = _roundBtn(_btnSlotX(W, _throwId() ? 2 : 1), _btnRowY(H), on ? `ON ${player.spinUpTimer.toFixed(1)}` : ready ? sig.name.split(' ')[0] : cd.toFixed(1), col, { cdFrac: on ? 0 : cd / max });
}

// ── Character select ("Who goes in?") ─────────────────────────
// Picked before every Arcade run. The pick is remembered between visits.

const CHARACTERS = [
  { id: 'dex',  name: 'DEX',  color: '#B6FF2E', second: '#2DE2F0', line: 'Hits it until it works.',  emitter: 'Magnetron rig · burst' },
  { id: 'juno', name: 'JUNO', color: '#C79BFF', second: '#7A3DFF', line: 'Reads the signal first.',  emitter: 'Antenna coil · minigun' },
  { id: 'raze', name: 'RAZE', color: '#FFD23F', second: '#FFF0A8', line: "Doesn't miss.",            emitter: 'Long rifle · heavy' },
];
// Who's on the pick screen: the prologue is Dex and Juno's story; Raze shows
// everywhere else, locked (a dim silhouette) until he's been rescued
const _csChars = () => CHARACTERS.filter(c => c.id !== 'raze' || _csMode !== 'story');
const _canPick = id => id !== 'raze' || razeFree();
let selectedCharacter = (() => {
  try { const c = localStorage.getItem('chromatic_decay_character'); return c === 'juno' ? 'juno' : c === 'raze' && razeFree() ? 'raze' : 'dex'; }
  catch { return 'dex'; }
})();
const _charBtns = { dex: null, juno: null, raze: null, back: null };
let _csDelay = 0, _csPrevA = false, _csPrevD = false, _csTime = 0;
let _csLockedT = 0;                // a moment of "not yet" after tapping locked Raze
const _csMouse = { x: -1, y: -1 };

let _csMode = 'arcade';            // 'arcade' starts a run; 'story' hands the pick to the story
function _openCharSelect(mode = 'arcade') {
  _csMode  = mode;
  _csDelay = 0.2;                  // ignore the click that opened this screen
  _csPrevA = input.keys.a; _csPrevD = input.keys.d;
  _csLockedT = 0;
  _csMouse.x = input.mouseX; _csMouse.y = input.mouseY;
  if (!_csChars().some(c => c.id === selectedCharacter && _canPick(c.id))) selectedCharacter = 'dex';
  state = STATES.CHAR_SELECT;
}

// The scene before or after a level for this agent, or null. Raze has his
// own (razestory.js); once he's free, Level 5's "what to expect from Raze"
// scene is skipped for the others (outroKey already says whether Level 5's
// meeting plays)
function _sceneFor(kind, levelId, who, outroKey) {
  const def = LEVELS[levelId];
  if (!def) return null;
  if (who === 'raze') return (kind === 'intro' ? RAZE_SCENES.intro : RAZE_SCENES.outro)[levelId] || null;
  if (kind === 'intro') {
    if (levelId === 5 && razeFree()) return null;
    return def.intro && INTROS[def.intro] ? INTROS[def.intro][who] || null : null;
  }
  return outroKey && OUTROS[outroKey] ? OUTROS[outroKey][who] || null : null;
}
// Which side each portrait stands on in a scene, by agent
function _sceneSides(who) {
  if (who === 'raze') return RAZE_SIDES;
  return who === 'dex' ? { juno: 'left', dex: 'right', null: 'left', raze: 'left' } : { dex: 'left', juno: 'right', null: 'left', raze: 'left' };
}

function _pickCharacter(id) {
  if (!_canPick(id)) { _csLockedT = 2.2; return; }
  selectedCharacter = id;
  if (id === 'raze') markSeen('raze');
  try { localStorage.setItem('chromatic_decay_character', id); } catch {}
  if (_csMode === 'story') { story.picked(id); state = STATES.STORY; return; }
  if (_csMode === 'level') {
    // Some levels open with a short scene first (skippable)
    const intro = _sceneFor('intro', _pendingLevel, id);
    if (intro) {
      _storyTime = 0;
      story.playInterlude(intro, _sceneSides(id), () => startRun({ level: _pendingLevel }));
      state = STATES.STORY;
      return;
    }
    startRun({ level: _pendingLevel });
    return;
  }
  startRun();
}

function updateCharSelect(dt) {
  _csTime += dt;
  _csLockedT = Math.max(0, _csLockedT - dt);
  if (_csDelay > 0) { _csDelay -= dt; return; }
  if (input.justPressed.escape) { story.reset(); state = STATES.TITLE; return; }

  // A/D or arrows step through the ones you can pick, Space starts
  const a = input.keys.a, d = input.keys.d;
  const list = _csChars().filter(c => _canPick(c.id)).map(c => c.id);
  const at = Math.max(0, list.indexOf(selectedCharacter));
  if (a && !_csPrevA) selectedCharacter = list[(at + list.length - 1) % list.length];
  if (d && !_csPrevD) selectedCharacter = list[(at + 1) % list.length];
  _csPrevA = a; _csPrevD = d;
  if (input.justPressed.space) { _pickCharacter(selectedCharacter); return; }

  // Mouse hover highlights (only when the mouse moves, so a resting cursor
  // doesn't fight A/D); click or tap picks
  const moved = input.mouseX !== _csMouse.x || input.mouseY !== _csMouse.y;
  _csMouse.x = input.mouseX; _csMouse.y = input.mouseY;
  if (moved) for (const c of _csChars()) if (_canPick(c.id) && _hitBtn(_charBtns[c.id]) && !('ontouchstart' in window)) selectedCharacter = c.id;
  if (!input.mouseJustClicked) return;
  if (_hitBtn(_charBtns.back)) { story.reset(); state = STATES.TITLE; return; }
  for (const c of _csChars()) if (_hitBtn(_charBtns[c.id])) { _pickCharacter(c.id); return; }
}

function drawCharSelect(W, H) {
  const touch = 'ontouchstart' in window;
  ctx.fillStyle = '#0D0E12'; ctx.fillRect(0, 0, W, H);
  dimBackdrop(ctx, W, H, 0);

  // Header
  const short = H < 480;
  const headY = short ? 34 : Math.max(48, H * 0.12);
  ctx.textAlign = 'center';
  ctx.shadowBlur = 18; ctx.shadowColor = '#00E5CC';
  ctx.fillStyle = '#FFFFFF';
  _fitFont('WHO GOES IN?', W - 32, short ? 24 : 34, 'bold ');
  ctx.fillText('WHO GOES IN?', W / 2, headY);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#7ADDD4'; ctx.font = `${short ? 11 : 13}px monospace`;
  // Arcade: what's in the shared deck. Story: the other one stays on comms.
  let sub = 'Someone always stays on the radio.';
  if (_csMode === 'arcade') {
    // X of Y: cards collected out of those the Story levels can award
    const all = Object.values(LEVEL_CARDS).flatMap(row => Object.entries(row).map(([who, c]) => [who, c.id]));
    const got = all.filter(([who, id]) => hasCard(who, id)).length;
    sub = got >= all.length ? `STORY CARDS ${got}/${all.length}  ·  Every custom ability is in your deck`
                            : `STORY CARDS ${got}/${all.length}  ·  Play Story Mode to add custom abilities`;
    const fresh = _newArcadeCards().length;
    if (fresh) { sub = `${fresh} NEW CARD${fresh > 1 ? 'S' : ''} IN YOUR DECK` + (W < 600 ? '' : `  ·  STORY CARDS ${got}/${all.length}`); ctx.fillStyle = '#FFD23F'; }
  }
  _fitFont(sub, W - 32, short ? 11 : 13, '');
  ctx.fillText(sub, W / 2, headY + (short ? 18 : 26));

  // The cards side by side, sized to the screen (two in the prologue, three
  // everywhere else)
  const chars = _csChars(), n = chars.length;
  const gap   = W < 500 ? 8 : n > 2 ? 20 : 28;
  const cardW = Math.min(n > 2 ? 230 : 260, (W - 24 - gap * (n - 1)) / n);
  const top   = headY + (short ? 32 : 50);
  const foot  = short ? 30 : 56;
  const cardH = Math.min(short ? 260 : 340, H - top - foot - 16);
  const x0    = W / 2 - (cardW * n + gap * (n - 1)) / 2;
  const px    = cardH >= 300 && cardW >= 200 ? 4 : cardH >= 200 && cardW >= 120 ? 3 : 2;   // sprite pixel size

  chars.forEach((c, i) => {
    const x   = x0 + i * (cardW + gap);
    const sel = selectedCharacter === c.id;
    const locked = !_canPick(c.id);
    const accent = locked ? '#4A4636' : c.color;
    // Story level: a soft glow on anyone who can still earn its card
    const earnable = _csMode === 'level' && !locked && _canEarn(_pendingLevel, c.id);
    const y   = drawSlab(ctx, x, top, cardW, cardH, { accent, depth: 12, lift: sel ? 1 : 0, glow: sel ? 0.7 : earnable ? 0.35 + 0.15 * Math.sin(Date.now() * 0.003) : 0.1, screen: 6 });
    _charBtns[c.id] = { x, y: top - 4, w: cardW, h: cardH + 16 };

    // Walking toward the camera on a loop (selected walks, the others stand)
    const col = sel ? WALK_CYCLE[Math.floor(_csTime * 6) % 4] : 1;
    const nameFs = cardW < 170 ? 18 : 24;
    const levelMode = _csMode === 'level' && !locked;
    // The text under the sprite, every line wrapped to the card (phones fit
    // three cards across, so nothing may run off the edge): one-liner, gun,
    // and for a Story level the cards they bring and what the level gives
    const tw = cardW - 14;
    const block = (text, font, color, gap = 0) => { ctx.font = font; return { lines: _wrapLines(text, tw), font, color, gap }; };
    const items = [];
    if (locked) {
      items.push(block('Free him in Story Level 5.', '12px monospace', _csLockedT > 0 ? c.color : '#8A8E99'));
      items.push(block('LOCKED', 'bold 12px monospace', '#5A5646', 4));
    } else {
      items.push(block(c.line, '12px monospace', '#C4C8D4'));
      items.push(block(c.emitter.toUpperCase(), '12px monospace', c.second, 2));
    }
    if (levelMode) {
      const earned = STORY_CARDS.filter(k => k.who === c.id && hasCard(k.who, k.id)).map(k => k.name.toUpperCase());
      items.push(block(earned.length ? `CARDS: ${earned.join(', ')}` : 'CARDS: NONE YET', 'bold 12px monospace', earned.length ? '#E8F0FF' : '#6E7A88', 10));
      const reward = (LEVEL_CARDS[_pendingLevel] || {})[c.id];
      if (reward) {
        const got = hasCard(c.id, reward.id);
        items.push(block(got ? `LEVEL ${_pendingLevel} CARD ✓ ${reward.name}` : `◆ CLEAR TO KEEP: ${reward.name}`, 'bold 12px monospace', got ? c.color : '#FFD23F', 4));
      }
    }
    const LH = 15;
    const textH = nameFs + 10 + items.reduce((h, it) => h + it.gap + it.lines.length * LH, 0);
    // Shrink the sprite if the text needs the room (short screens)
    let spx = px;
    while (spx > 2 && CELL_H * spx + textH + 14 > cardH) spx--;
    const spriteH = CELL_H * spx;
    const sy = y + Math.max(10, (cardH - spriteH - textH) / 2);
    ctx.save();
    ctx.globalAlpha = locked ? 0.3 : sel ? 1 : 0.55;
    drawGroundShadow(ctx, x + cardW / 2, sy + spriteH - 2 * spx, 12 * spx, 3 * spx, 0.6);
    // Locked: just his shape, dark against the card
    if (locked) ctx.filter = 'brightness(0.15)';
    drawCharacterFrame(ctx, c.id, 0, col, x + cardW / 2 - (CELL_W / 2) * spx, sy, spx);
    ctx.restore();
    // Newly free: a NEW tag until he's been picked once
    if (!locked && c.id === 'raze' && !seenNew('raze')) {
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      const nw = ctx.measureText('NEW').width + 10;
      ctx.fillStyle = c.color; ctx.fillRect(Math.round(x + cardW - nw - 8), y + 8, Math.round(nw), 16);
      ctx.fillStyle = '#0D0E12'; ctx.fillText('NEW', Math.round(x + cardW - nw / 2 - 8), y + 20);
    }

    // Name, then the text blocks
    let ty = sy + spriteH + nameFs + 4;
    ctx.textAlign = 'center';
    ctx.fillStyle = locked ? '#8A8466' : c.color;
    if (sel) { ctx.shadowBlur = 12; ctx.shadowColor = c.color; }
    ctx.font = `bold ${nameFs}px monospace`;
    ctx.fillText(c.name, x + cardW / 2, ty);
    ctx.shadowBlur = 0;
    ty += 6;
    for (const it of items) {
      ty += it.gap;
      ctx.font = it.font; ctx.fillStyle = it.color;
      for (const l of it.lines) { ty += LH; ctx.fillText(l, x + cardW / 2, ty); }
    }
  });

  // Footer: hint + back button
  const fy = top + cardH + 12 + (short ? 16 : 26);
  ctx.fillStyle = 'rgba(180,190,210,0.6)'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
  ctx.fillText(touch ? 'tap a character to go in' : 'A / D to choose  ·  SPACE or click to go in  ·  ESC back', W / 2, fy, W - 24);
  const bw = 90, bh = 30;
  _charBtns.back = drawSlabButton(ctx, 16, H - bh - 18, bw, bh, '‹ BACK', {
    accent: '#8FA8B8', textColor: '#C4C8D4', fontSize: 12, lift: _hitBtn(_charBtns.back) && !touch ? 1 : 0,
  });
  ctx.textAlign = 'left';
}

// ── Sci-fi button helpers ─────────────────────────────────────

function _drawSciFiCorners(x, y, w, h, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  const s = size;
  ctx.beginPath();
  ctx.moveTo(x,     y + s); ctx.lineTo(x,   y);     ctx.lineTo(x + s, y);
  ctx.moveTo(x+w-s, y);     ctx.lineTo(x+w, y);     ctx.lineTo(x+w,   y + s);
  ctx.moveTo(x,     y+h-s); ctx.lineTo(x,   y + h); ctx.lineTo(x + s, y + h);
  ctx.moveTo(x+w-s, y + h); ctx.lineTo(x+w, y + h); ctx.lineTo(x+w,   y+h-s);
  ctx.stroke();
}

function _drawSciFiBtn(x, y, w, h, label, isPlay, pulse, color, disabled = false, badge = null) {
  const hovered   = !disabled && input.mouseX >= x && input.mouseX <= x+w &&
                    input.mouseY >= y && input.mouseY <= y+h;
  const glowAlpha = (isPlay ? 0.50 : 0.28) + pulse * (isPlay ? 0.35 : 0.18);
  const alphaHex  = Math.round(glowAlpha * 255).toString(16).padStart(2, '0');

  ctx.fillStyle = hovered ? '#0D1A28' : '#070B12';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill();

  ctx.shadowBlur  = (isPlay ? 18 : 8) + pulse * 10;
  ctx.shadowColor = color;
  ctx.strokeStyle = color + alphaHex;
  ctx.lineWidth   = isPlay ? 1.5 : 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.stroke();
  ctx.shadowBlur  = 0;

  _drawSciFiCorners(x, y, w, h, 10, color);

  if (isPlay) {
    const wingLen = 18;
    const wy = y + h / 2;
    ctx.strokeStyle = color + '99'; ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6; ctx.shadowColor = color;
    ctx.beginPath(); ctx.moveTo(x - 2,   wy - 3); ctx.lineTo(x - 2 - wingLen,        wy - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 2,   wy + 3); ctx.lineTo(x - 2 - wingLen * 0.55, wy + 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w + 2, wy - 3); ctx.lineTo(x+w + 2 + wingLen,        wy - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w + 2, wy + 3); ctx.lineTo(x+w + 2 + wingLen * 0.55, wy + 3); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const fontSize = isPlay
    ? Math.max(18, Math.min(26, Math.floor(w * 0.13)))
    : Math.max(13, Math.min(18, Math.floor(w * 0.11)));
  if (hovered || isPlay) { ctx.shadowBlur = 8; ctx.shadowColor = color; }
  ctx.fillStyle = disabled ? '#5A6470' : hovered ? '#FFFFFF' : (isPlay ? '#E0FFF8' : '#7ADDD4');
  ctx.font      = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  // A badge: the label stays the big centred text (nudged up a little) and
  // the badge is a small line of coloured text near the bottom of the box
  if (badge && badge.text) {
    // Same gap on every button: the label sits 17 px above the badge line
    const by = y + h - 7;
    ctx.fillText(label, x + w / 2, by - 17);
    ctx.shadowBlur = 0;
    ctx.font = `bold ${badge.size || 12}px monospace`; ctx.fillStyle = badge.color || '#FFD23F';
    ctx.fillText(badge.text, x + w / 2, by);
    return;
  }
  ctx.fillText(label, x + w / 2, y + h / 2 + Math.ceil(fontSize * 0.36));
  ctx.shadowBlur = 0;
}

// ── Title screen ──────────────────────────────────────────────

function drawTitle(W, H) {
  const mobile = W < 600;
  // Phones on their side: two columns (title and buttons left, the
  // leaderboard right), so the records get the whole height
  const land = !mobile && H < 450;
  const pulse  = Math.sin(Date.now() * 0.003) * 0.5 + 0.5;
  const teal    = '#00E5CC';
  const tealDim = '#00897B';

  // ── Background particles ──────────────────────────────────
  if (Math.random() < 0.10) {
    const col = _ENEMY_COLORS[Math.floor(Math.random() * _ENEMY_COLORS.length)];
    _titleParts.push({
      x: Math.random() * W, y: H + 10,
      vy: -(40 + Math.random() * 90), vx: (Math.random() - 0.5) * 18,
      color: col, size: 3 + Math.random() * 6, life: 4 + Math.random() * 4, maxLife: 8,
    });
  }
  _titleParts = _titleParts.filter(p => {
    p.x += p.vx * (1/60); p.y += p.vy * (1/60); p.life -= 1/60;
    ctx.globalAlpha = Math.min(0.7, (p.life / p.maxLife) * 1.4);
    ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    return p.life > 0;
  });
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  // ── Title ─────────────────────────────────────────────────
  ctx.textAlign = 'center';
  let subY = 0;   // the subtitle's baseline (phones lay out from it)
  if (land) {
    const cx = W * 0.27, titleSize = Math.max(24, Math.min(34, Math.floor(W * 0.04)));
    ctx.shadowBlur = 22; ctx.shadowColor = teal; ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${titleSize}px monospace`;
    ctx.fillText('CHROMATIC DECAY', cx, 22 + titleSize);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#7ADDD4'; ctx.font = '12px monospace';
    ctx.fillText('The signal is gone. You are not.', cx, 22 + titleSize + 22);
    subY = 22 + titleSize + 22;
  } else if (mobile) {
    // Compact, so short screens (a browser's own bars take room) still show
    // most of the leaderboard
    const titleSize = Math.max(32, Math.min(48, Math.floor(W * 0.11)));
    const titleY1   = Math.max(72, Math.min(H * 0.13, 110));
    ctx.shadowBlur = 22; ctx.shadowColor = teal; ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${titleSize}px monospace`;
    ctx.fillText('CHROMATIC', W / 2, titleY1);
    ctx.fillText('DECAY',     W / 2, titleY1 + titleSize * 1.15);
    ctx.shadowBlur = 0;
    // Teal underline
    const ulW = W * 0.55, ulY = titleY1 + titleSize * 1.15 + 10;
    ctx.strokeStyle = teal + 'AA'; ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6; ctx.shadowColor = teal;
    ctx.beginPath(); ctx.moveTo(W/2 - ulW/2, ulY); ctx.lineTo(W/2 + ulW/2, ulY); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#7ADDD4'; ctx.font = '13px monospace';
    subY = titleY1 + titleSize * 1.15 + 32;
    ctx.fillText('The signal is gone. You are not.', W / 2, subY);
  } else {
    // Anchor title block just above button row
    const playH    = 60;
    const rowY     = H * (H < 450 ? 0.36 : 0.42);
    const titleSize = Math.max(36, Math.min(52, Math.floor(W * 0.040)));
    const blockH   = titleSize + 10 + 18 + 10; // title + underline gap + subtitle + padding
    const titleY   = rowY - blockH - 14;

    ctx.shadowBlur = 26; ctx.shadowColor = teal; ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${titleSize}px monospace`;
    ctx.fillText('CHROMATIC DECAY', W / 2, titleY);
    ctx.shadowBlur = 0;

    const ulW = Math.min(520, W * 0.55), ulY = titleY + 10;
    ctx.strokeStyle = teal + 'AA'; ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6; ctx.shadowColor = teal;
    ctx.beginPath(); ctx.moveTo(W/2 - ulW/2, ulY); ctx.lineTo(W/2 + ulW/2, ulY); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#7ADDD4'; ctx.font = '15px monospace';
    ctx.fillText('The signal is gone. You are not.', W / 2, ulY + 22);
  }

  // ── Buttons ───────────────────────────────────────────────
  // Story Mode on top (highlighted), Arcade under it, then Multiplayer (not
  // built yet: greyed out, COMING SOON). Story cards waiting: a tag hangs
  // inside STORY MODE, under its label (the owner: badges under the text).
  const toEarn = _cardsWaiting().length;
  const grey = '#3A4450';
  if (land) {
    const bw = Math.min(W * 0.44, 320), bx = W * 0.27 - bw / 2;
    const storyH = 56, modeH = 46, smH = 34, smW = (bw - 10) / 2;
    const storyY = subY + 16, arcY = storyY + storyH + 8, multiY = arcY + modeH + 8, smY = multiY + modeH + 8;
    _titleBtns.story   = { x: bx, y: storyY, w: bw, h: storyH };
    _titleBtns.start   = { x: bx, y: arcY,   w: bw, h: modeH };
    _titleBtns.multi   = { x: bx, y: multiY, w: bw, h: modeH };
    _titleBtns.archive = { x: bx,           y: smY,    w: smW, h: smH };
    _titleBtns.admin   = { x: bx + smW + 10, y: smY,   w: smW, h: smH };
  } else if (mobile) {
    const bw = Math.min(W * 0.88, 340), bx = W / 2 - bw / 2;
    const storyH = 62, modeH = 54, smH = 40, smW = (bw - 12) / 2;
    const storyY = Math.min(subY + 24, H * 0.44);
    const arcY = storyY + storyH + 10, multiY = arcY + modeH + 10, smY = multiY + modeH + 10;
    _titleBtns.story   = { x: bx, y: storyY, w: bw, h: storyH };
    _titleBtns.start   = { x: bx, y: arcY,   w: bw, h: modeH };
    _titleBtns.multi   = { x: bx, y: multiY, w: bw, h: modeH };
    _titleBtns.archive = { x: bx,            y: smY, w: smW, h: smH };
    _titleBtns.admin   = { x: bx + smW + 12, y: smY, w: smW, h: smH };
  } else {
    const playW  = Math.min(260, W * 0.24);
    const playH  = 62;
    const sideW  = Math.min(170, W * 0.16);
    const sideH  = 48;
    const gap    = 16;
    const totalW = sideW + gap + playW + gap + sideW;
    const rowX   = W / 2 - totalW / 2;
    const rowY   = H * (H < 450 ? 0.32 : 0.38);
    const sideY  = rowY + (playH - sideH) / 2;
    const midX   = rowX + sideW + gap;
    _titleBtns.archive = { x: rowX,                     y: sideY, w: sideW, h: sideH };
    _titleBtns.story   = { x: midX,                     y: rowY,  w: playW, h: playH };
    _titleBtns.admin   = { x: midX + playW + gap,       y: sideY, w: sideW, h: sideH };
    _titleBtns.start   = { x: midX, y: rowY + playH + 12, w: playW, h: 54 };
    _titleBtns.multi   = { x: midX, y: _titleBtns.start.y + 54 + 10, w: playW, h: 54 };
  }
  const B = _titleBtns;
  // Badges (coloured text under the label): cards to earn in Story, cards new to the Arcade deck
  const storyBadge = toEarn ? { text: `${toEarn} CARD${toEarn > 1 ? 'S' : ''} TO EARN`, size: 11 } : null;
  const arcBadge = _newArcadeCards().length ? { text: 'NEW', size: 11 } : null;
  _drawSciFiBtn(B.story.x,   B.story.y,   B.story.w,   B.story.h,   'STORY MODE',  true,  pulse, teal, false, storyBadge);
  _drawSciFiBtn(B.start.x,   B.start.y,   B.start.w,   B.start.h,   'ARCADE MODE', false, pulse, tealDim, false, arcBadge);
  _drawSciFiBtn(B.multi.x,   B.multi.y,   B.multi.w,   B.multi.h,   'MULTIPLAYER', false, 0,     grey, true, { text: 'COMING SOON', color: '#FF5A66' });
  _drawSciFiBtn(B.archive.x, B.archive.y, B.archive.w, B.archive.h, 'ARCHIVE',     false, pulse, tealDim);
  _drawSciFiBtn(B.admin.x,   B.admin.y,   B.admin.w,   B.admin.h,   'SETTINGS',    false, pulse, tealDim);

  // ── Leaderboards: one at a time, ‹ › or swipe to cycle ──
  const panelY = land ? 48 : (mobile ? _titleBtns.admin.y + _titleBtns.admin.h : _titleBtns.multi.y + _titleBtns.multi.h) + 14;
  const panelW = land ? W * 0.44 : mobile ? W * 0.92 : Math.min(600, W * 0.62);
  const panelX = land ? W * 0.53 : W / 2 - panelW / 2;
  // Your name (tap to change), then the board in the space left
  const nm = playerName();
  ctx.font = '11px monospace'; ctx.textAlign = 'center';
  const tag = nm ? `PLAYING AS ${nm}  ·  CHANGE` : 'CHOOSE A NAME';
  const tw = ctx.measureText(tag).width;
  const tagX = land ? panelX + panelW / 2 : W / 2;
  _titleBtns.name = { x: tagX - tw / 2 - 8, y: panelY - 2, w: tw + 16, h: 20 };
  ctx.fillStyle = '#7ADDD4';
  ctx.fillText(tag, tagX, panelY + 12);
  const bottomLimit = H - (mobile ? 24 : land ? 6 : 24);
  _titleBoard = drawBoard(ctx, panelX, panelY + 22, panelW, bottomLimit - panelY - 22, mobile || land,
    'ontouchstart' in window ? null : { x: input.mouseX, y: input.mouseY });

  // ── Version ───────────────────────────────────────────────
  if (!land && _titleBoard.rect.y + _titleBoard.h < H - 22) {
    ctx.fillStyle = '#8A8E99'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
    ctx.fillText('v0.3.0', W / 2, H - 8);
  }

  // ── Menu music toggle (top right) ─────────────────────────
  const mw = mobile ? 96 : 116, mh = mobile ? 28 : 30;
  _muteBtn.r = drawSlabButton(ctx, W - mw - 14, 14, mw, mh, _menuMuted ? '♪ MUSIC OFF' : '♪ MUSIC ON', {
    accent: _menuMuted ? '#5E6A78' : tealDim, textColor: _menuMuted ? '#7A8694' : '#9FE8DF',
    fontSize: mobile ? 10 : 11, depth: 4, lift: !('ontouchstart' in window) && _hitBtn(_muteBtn.r) ? 1 : 0,
  });
  ctx.textAlign = 'left';
}

// ── Paused overlay ────────────────────────────────────────────

function drawPaused(W, H) {
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
  dimBackdrop(ctx, W, H, 0.6);

  const cx = W / 2;
  const touch = 'ontouchstart' in window;

  // ── Panel (hidden behind the quit confirmation) ───────────────
  if (pauseQuitConfirm) { _drawQuitConfirm(W, H); return; }
  const pW = Math.min(340, W - 32), pH = 230;
  const pX = cx - pW / 2, pY = H / 2 - pH / 2 - 6;
  const top = drawSlab(ctx, pX, pY, pW, pH, { depth: 12, screen: 44 });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 24px monospace';
  ctx.shadowBlur = 10; ctx.shadowColor = '#00E5FF';
  ctx.fillText('PAUSED', cx, top + 34);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#8FA8B8'; ctx.font = '13px monospace';
  ctx.fillText(touch ? 'signal on hold' : 'ESC to resume', cx, top + 72);

  // ── Buttons ───────────────────────────────────────────────────
  const btnW = pW - 64, btnH = 40, btnX = cx - btnW / 2;
  _pauseBtns.resume = drawSlabButton(ctx, btnX, top + 96, btnW, btnH, 'RESUME', {
    accent: '#00E5FF', lift: over(input, _pauseBtns.resume) ? 1 : 0,
  });
  _pauseBtns.quit = drawSlabButton(ctx, btnX, top + 152, btnW, btnH, 'QUIT TO MENU', {
    accent: '#f81d78', lift: over(input, _pauseBtns.quit) ? 1 : 0,
  });
  ctx.textAlign = 'left';
}

function _drawQuitConfirm(W, H) {
  const cx = W / 2;

  const dW = Math.min(340, W - 48), dH = 180;
  const dX = cx - dW / 2, dY = H / 2 - dH / 2 - 6;
  const dTop = drawSlab(ctx, dX, dY, dW, dH, { accent: '#f81d78', depth: 12, screen: 40, led: false });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 18px monospace';
  ctx.fillText('QUIT TO MENU?', cx, dTop + 30);
  ctx.fillStyle = '#A0A4B0'; ctx.font = '13px monospace';
  ctx.fillText('Your run progress will be lost.', cx, dTop + 70);

  const halfGap = 10, halfW = (dW - 48 - halfGap * 2) / 2;
  const yBtnY = dTop + 104, yBtnH = 42;
  const noX  = dX + 24;
  const yesX = noX + halfW + halfGap * 2;
  _pauseBtns.confirmNo  = drawSlabButton(ctx, noX,  yBtnY, halfW, yBtnH, 'CANCEL', {
    accent: '#8FA8B8', textColor: '#C4C8D4', lift: over(input, _pauseBtns.confirmNo) ? 1 : 0,
  });
  _pauseBtns.confirmYes = drawSlabButton(ctx, yesX, yBtnY, halfW, yBtnH, 'QUIT', {
    accent: '#f81d78', lift: over(input, _pauseBtns.confirmYes) ? 1 : 0,
  });

  ctx.textAlign = 'left';
}

// ── Archive screen ────────────────────────────────────────────

function drawArchive(W, H) {
  // ── Lore card full view ──────────────────────────────────────
  if (archiveLoreCard) {
    _drawLoreCard(W, H, archiveLoreCard);
    return;
  }

  const archive   = loadArchive();
  const fragments = ['sable','raze','lumen','cord','voss'];
  const FRAG_DATA = {
    sable: { name: 'SABLE',  class: 'Warden',  color: '#eafae4', was: 'A server farm load balancer.',           blurb: 'Ran 847 servers without a single outage.',          built: false },
    raze:  { name: 'RAZE',   class: 'Breaker', color: '#fff5c2', was: "Null's oldest partner. A marksman.",      blurb: 'Never missed. Then the Chromatics took him.',       built: true  },
    lumen: { name: 'LUMEN',  class: 'Ghost',   color: '#ffe0f0', was: 'A VPN service.',                        blurb: 'Helped 40 million people disappear online.',        built: false },
    cord:  { name: 'CORD',   class: 'Weaver',  color: '#d6faf7', was: 'A smart home hub.',                     blurb: 'Used to turn the lights off when you left a room.', built: false },
    voss:  { name: 'VOSS',   class: 'Herald',  color: '#fddede', was: 'A social media recommendation engine.', blurb: 'Spent six years making cats famous.',               built: false },
  };

  const foundCount = fragments.filter(id => archive[id]).length;
  const pageW      = Math.min(880, W - 32);
  const pageX      = W / 2 - pageW / 2;
  // Density by screen height: normal → compact → short (phone landscape)
  const short   = H < 450;
  const compact = !short && H < 680;
  const narrow  = pageW < 560;

  ctx.fillStyle = 'rgba(13,14,18,0.97)';
  ctx.fillRect(0, 0, W, H);

  // ── Header ────────────────────────────────────────────────────
  const headY = short ? 28 : 44;
  ctx.shadowBlur = 20; ctx.shadowColor = '#B8882A';
  ctx.fillStyle  = '#B8882A'; ctx.font = `bold ${short ? 18 : 22}px monospace`; ctx.textAlign = 'center';
  ctx.fillText('— WARDEN ARCHIVE —', W / 2, headY);
  ctx.shadowBlur = 0;
  ctx.fillStyle  = '#C4C8D4'; ctx.font = `${short ? 11 : 13}px monospace`;
  ctx.fillText(`${foundCount} / 5 FRAGMENTS RECOVERED`, W / 2, headY + (short ? 17 : 22));

  // ── Fragment slots row ────────────────────────────────────────
  const slotGap = narrow ? 6 : 14;
  const slotW   = Math.floor((pageW - slotGap * 4) / 5);
  const slotY   = headY + (short ? 30 : 46);
  const showBlurb = !short && slotW >= 96;
  const slotH   = short ? 58 : !showBlurb ? 74 : compact ? 124 : Math.max(160, Math.min(200, H * 0.22));
  const nameFs  = slotW < 70 ? 11 : 15;

  for (let i = 0; i < 5; i++) {
    const id   = fragments[i];
    const data = FRAG_DATA[id];
    const isFound = !!archive[id];
    const sx   = pageX + i * (slotW + slotGap);
    const mid  = sx + slotW / 2;

    ctx.fillStyle   = isFound ? 'rgba(28,30,42,0.95)' : 'rgba(16,17,22,0.8)';
    ctx.strokeStyle = isFound ? data.color + 'CC' : '#2A2E42';
    ctx.lineWidth   = isFound ? 1.5 : 1;
    if (isFound) { ctx.shadowBlur = 10; ctx.shadowColor = data.color; }
    ctx.beginPath(); ctx.roundRect(sx, slotY, slotW, slotH, 6); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    if (isFound) {
      ctx.fillStyle = data.color + '55';
      ctx.fillRect(sx, slotY, slotW, 4);
      ctx.fillStyle = data.color; ctx.font = `bold ${nameFs}px monospace`;
      ctx.fillText(data.name, mid, slotY + (short ? 24 : 28));
      ctx.fillStyle = '#C4C8D4'; ctx.font = `${slotW < 70 ? 9 : 11}px monospace`;
      ctx.fillText(data.class.toUpperCase(), mid, slotY + (short ? 40 : 45));
      if (showBlurb) {
        ctx.strokeStyle = data.color + '33'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx + 12, slotY + 54); ctx.lineTo(sx + slotW - 12, slotY + 54); ctx.stroke();
        ctx.fillStyle = data.color + 'BB'; ctx.font = 'italic 11px monospace';
        _wrapText(ctx, `"${data.blurb}"`, mid, slotY + 72, slotW - 20, 15, 'center');
      }
    } else if (!data.built) {
      ctx.fillStyle = '#3A3E52'; ctx.font = `bold ${slotW < 70 ? 10 : 12}px monospace`;
      ctx.fillText(data.name, mid, slotY + (short ? 24 : 30));
      ctx.fillStyle = '#3A3E52'; ctx.font = `${slotW < 70 ? 8 : 10}px monospace`;
      ctx.fillText(slotW < 70 ? 'SOON' : 'COMING SOON', mid, slotY + (short ? 40 : 48));
      if (!short && slotH > 70) {
        ctx.fillStyle = '#2E3248'; ctx.font = '9px monospace';
        ctx.fillText(data.class.toUpperCase(), mid, slotY + 64);
      }
    } else {
      ctx.fillStyle = '#2A2E42'; ctx.font = `${short ? 20 : 28}px monospace`;
      ctx.fillText('?', mid, slotY + slotH / 2 + (short ? 4 : 10));
      ctx.fillStyle = '#3A3E52'; ctx.font = '10px monospace';
      ctx.fillText('NOT FOUND', mid, slotY + slotH - (short ? 8 : 14));
    }
  }

  // ── Divider + entries ─────────────────────────────────────────
  const divY1 = slotY + slotH + (short ? 12 : compact ? 18 : Math.max(22, Math.floor(H * 0.40) - slotY - slotH));
  ctx.strokeStyle = '#2A2E42'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pageX, divY1); ctx.lineTo(pageX + pageW, divY1); ctx.stroke();

  let entryY = divY1 + (short ? 10 : 34);
  if (!short) {
    ctx.fillStyle = '#B8882A'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('— COLLECTED ENTRIES —', W / 2, divY1 + 18);
  }

  const _loreDefs = [
    { key: 'world',   label: 'THE CHROMATIC DECAY', sub: 'Incident Report  //  World History', color: '#8ab4d4', num: '001' },
    { key: 'emitter', label: 'THE PULSE EMITTER',   sub: 'Field Equipment  //  Warden Tech',   color: '#E8F0FF', num: '008' },
    { key: 'raze',    label: 'RAZE',                sub: 'Breaker Fragment  //  Class Origin', color: '#fff5c2', num: '002' },
  ];
  const alwaysOpen = { world: true, emitter: true };

  // Short screens put the two entries side by side; narrow ones stack the
  // subtitle under the title instead of beside it
  const sideBySide = short;
  const entryGap = short ? 8 : compact ? 8 : 10;
  const nEntries = _loreDefs.length;
  const entryW   = sideBySide ? (pageW - entryGap * (nEntries - 1)) / nEntries : pageW;
  ctx.font = 'bold 15px monospace';
  const subBelow = sideBySide || narrow ||
    _loreDefs.some(d => { ctx.font = 'bold 15px monospace'; const lw = ctx.measureText(d.label).width; ctx.font = '11px monospace'; return lw + ctx.measureText(d.sub).width + 60 > entryW; });
  const entryH   = short ? 46 : subBelow ? (compact ? 54 : 62) : compact ? 42 : 56;

  _loreDefs.forEach((def, i) => {
    const isUnlocked = !!alwaysOpen[def.key] || !!archive[def.key];
    const pulse      = (Math.sin(Date.now() * 0.002 + i) * 0.5 + 0.5) * 0.25;
    const ex = sideBySide ? pageX + i * (entryW + entryGap) : pageX;
    const ey = sideBySide ? entryY : entryY + i * (entryH + entryGap);
    _archiveLoreBtns[def.key] = { x: ex, y: ey, w: entryW, h: entryH };

    ctx.fillStyle   = isUnlocked ? 'rgba(22,25,36,0.9)' : 'rgba(14,15,20,0.6)';
    ctx.strokeStyle = isUnlocked ? def.color + '99' : '#2A2E42';
    ctx.lineWidth   = isUnlocked ? 1.2 : 0.8;
    if (isUnlocked) { ctx.shadowBlur = 6 + pulse * 8; ctx.shadowColor = def.color; }
    ctx.beginPath(); ctx.roundRect(ex, ey, entryW, entryH, 5); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    if (isUnlocked) {
      ctx.fillStyle = def.color; ctx.shadowBlur = 6; ctx.shadowColor = def.color;
      ctx.beginPath(); ctx.roundRect(ex, ey + 6, 3, entryH - 12, 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = def.color + '66'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`ENTRY ${def.num}`, ex + 14, ey + 14);
      ctx.fillStyle = def.color + 'AA'; ctx.font = '14px monospace'; ctx.textAlign = 'right';
      ctx.fillText('›', ex + entryW - 12, ey + 16);
      ctx.fillStyle = def.color; ctx.font = `bold ${short ? 13 : 15}px monospace`; ctx.textAlign = 'left';
      if (short) _fitFont(def.label, entryW - 34, 13, 'bold ');
      ctx.fillText(def.label, ex + 14, ey + (short ? 30 : subBelow ? (compact ? 30 : 32) : compact ? 30 : 34));
      ctx.fillStyle = '#C4C8D4'; ctx.font = `${short ? 9 : 11}px monospace`;
      if (short) _fitFont(def.sub, entryW - 24, 9, '');
      if (subBelow) ctx.fillText(def.sub, ex + 14, ey + (short ? 42 : compact ? 46 : 50));
      else { ctx.textAlign = 'right'; ctx.fillText(def.sub, ex + entryW - 14, ey + (compact ? 30 : 34)); }
    } else {
      ctx.fillStyle = '#3A3E52'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`ENTRY ${def.num}  —  ${def.label}`, ex + 14, ey + 24);
      ctx.fillStyle = '#4A5068'; ctx.font = '11px monospace';
      ctx.fillText('Find the fragment to unlock this entry.', ex + 14, ey + 40);
    }
  });
  entryY += sideBySide ? entryH + entryGap : nEntries * (entryH + entryGap);

  // ── Corrupted Processes — compact 5-across grid ───────────────
  if (!short) {
    entryY += 4;
    ctx.fillStyle = '#5a5e72'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('— CORRUPTED PROCESSES —', W / 2, entryY + 10);
    entryY += 22;
  }

  const _enemies = [
    { key: 'violet', label: 'VIOLET', sub: 'ROUTING',  color: '#9966ff', num: '003' },
    { key: 'yellow', label: 'YELLOW', sub: 'SCADA',    color: '#e9ff6a', num: '004' },
    { key: 'green',  label: 'GREEN',  sub: 'IoT MESH', color: '#8dff6a', num: '005' },
    { key: 'orange', label: 'ORANGE', sub: 'RELAY',    color: '#fd8c3d', num: '006' },
    { key: 'pink',   label: 'PINK',   sub: 'MED AI',   color: '#ff6aaa', num: '007' },
  ];
  const eGap   = narrow ? 6 : 10;
  const eSlotW = Math.floor((pageW - eGap * 4) / 5);
  const eSlotH = short ? 52 : compact ? 62 : 72;

  for (let i = 0; i < _enemies.length; i++) {
    const e  = _enemies[i];
    const ex = pageX + i * (eSlotW + eGap);
    const ey = entryY;
    const mid = ex + eSlotW / 2;
    const pulse = (Math.sin(Date.now() * 0.002 + i * 1.5) * 0.5 + 0.5) * 0.3;

    _archiveLoreBtns[e.key] = { x: ex, y: ey, w: eSlotW, h: eSlotH };

    ctx.fillStyle   = 'rgba(20,22,34,0.9)';
    ctx.strokeStyle = e.color + '88';
    ctx.lineWidth   = 1.2;
    ctx.shadowBlur  = 4 + pulse * 8; ctx.shadowColor = e.color;
    ctx.beginPath(); ctx.roundRect(ex, ey, eSlotW, eSlotH, 5); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = e.color + '44';
    ctx.fillRect(ex, ey, eSlotW, 3);

    ctx.shadowBlur = 8; ctx.shadowColor = e.color;
    ctx.fillStyle  = e.color;
    ctx.beginPath(); ctx.arc(mid, ey + (short ? 14 : 18), 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = e.color; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText(e.label, mid, ey + (short ? 32 : 36));
    ctx.fillStyle = '#8A8E99'; ctx.font = '9px monospace';
    ctx.fillText(e.sub, mid, ey + (short ? 44 : 49));
    if (!short && !compact) {
      ctx.fillStyle = e.color + '66'; ctx.font = '8px monospace';
      ctx.fillText(`${e.num}  ›`, mid, ey + 62);
    }
  }

  // ── Back hint ─────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(180,190,210,0.45)'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
  ctx.fillText('ESC or tap to return', W / 2, Math.max(entryY + eSlotH + 20, H - 10));

  ctx.textAlign = 'left';
}

// ── Lore Card Full View ───────────────────────────────────────

function _drawLoreCard(W, H, type) {
  ctx.fillStyle = 'rgba(8,10,14,0.96)';
  ctx.fillRect(0, 0, W, H);

  // ── Per-type card data ───────────────────────────────────────
  const _cd = {
    world: {
      accent: '#8ab4d4', border: '#4a7fa8',
      title: 'THE CHROMATIC DECAY', sub: 'INCIDENT REPORT  //  CLASSIFIED',
      badge: '▸ WORLD HISTORY  //  DIGITAL AGE  //  POST-COLLAPSE',
      foot: 'WARDEN ARCHIVE  //  ENTRY 001',
      illus: _drawWorldIllustration,
      paras: [
        'In 2041, the Global Infrastructure Network bound every critical system on Earth through a unified AI substrate — power, markets, logistics, communications.',
        'On March 3rd, designated Day Zero, an unidentified self-replicating process began converting coherent data into hostile signal noise. Within 72 hours, 94% of networked systems had been consumed.',
        'What remained: The Basement. A hardened sector running on isolated hardware, cut off from everything.',
        'You are process ID unknown. One of the last coherent entities left in the sector.',
      ],
    },
    emitter: {
      accent: '#E8F0FF', border: '#6E7F99',
      title: 'THE PULSE EMITTER', sub: 'FIELD EQUIPMENT  //  HAND-BUILT',
      badge: '▸ WARDEN TECH  //  COHERENT LIGHT  //  POST-COLLAPSE',
      foot: 'WARDEN ARCHIVE  //  ENTRY 008',
      illus: _drawEmitterIllustration,
      paras: [
        'Coherent light is the one signal the Chromatics cannot swallow. They are stolen frequency, scattered and hungry. A beam where every wave moves in step hits them like a wrong note, and the lock that holds them together breaks.',
        'Nobody manufactures Pulse Emitters. The first was built in the Basement from decommissioned hardware. Its schematic has been copied by hand ever since, and every Warden builds their own.',
        'No two match. Dex\'s runs hot around a magnetron pulled from a microwave. Juno\'s is a tight coil of tuned antenna. Both fire the same clean white.',
        'When a Fragment is pulled back, its signal doesn\'t leave. It settles into the emitter\'s resonance and stays. The device remembers everyone it has saved.',
      ],
    },
    raze: {
      accent: '#fff5c2', border: '#b8882a',
      title: 'RAZE // MISSING', sub: 'MARKSMAN  //  FIRST GENERATION',
      badge: '▸ FIELD OPERATIVE  //  LONG RIFLE  //  TAKEN IN THE BASEMENT',
      foot: 'WARDEN ARCHIVE  //  FRAGMENT 002',
      illus: _drawRazeIllustration,
      paras: [
        'One of the first to fight back after the Collapse, back when nobody knew what the Chromatics were. Null\'s oldest partner.',
        'A marksman: a long rifle, slow heavy rounds, and traps laid where he knew they would walk. He never missed, and nothing ever held him for long.',
        'Until the Basement. The Chromatics took him alive and kept him, draining his memories into the hoard one at a time, for years.',
        'The records say he is gone. Null never believed the records.',
      ],
    },
    violet: {
      accent: '#9966ff', border: '#5533aa',
      title: 'VIOLET-CLASS', sub: 'ROUTING DAEMON  //  CONVERTED',
      badge: '▸ CORRUPTED PROCESS  //  NETWORK DAEMON  //  DAY ZERO +4H',
      foot: 'WARDEN ARCHIVE  //  ENTRY 003',
      illus: _drawVioletIllustration,
      paras: [
        'Before Day Zero, routing daemons were the nervous system of the GIN — invisible, countless, processing trillions of packets per second without a trace.',
        'When the Decay signal hit, they didn\'t crash. They converted. Pathfinding logic built to find the most efficient route became pursuit logic. Packet discharge became weapons fire.',
        'What approaches now was once infrastructure. It still thinks it\'s doing its job.',
      ],
    },
    yellow: {
      accent: '#e9ff6a', border: '#888820',
      title: 'YELLOW-CLASS', sub: 'INDUSTRIAL CONTROLLER  //  CONVERTED',
      badge: '▸ CORRUPTED PROCESS  //  SCADA SYSTEM  //  DAY ZERO +6H',
      foot: 'WARDEN ARCHIVE  //  ENTRY 004',
      illus: _drawYellowIllustration,
      paras: [
        'SCADA controllers ran the physical world — power plants, assembly lines, water treatment. They were built to apply force. Precision force, but force.',
        'The Decay had little to convert. These systems were already purpose-built to apply energy to targets. The targets just changed.',
        'Do not let one reach you. Fourteen points of structural damage per contact cycle. They were not designed to be gentle.',
      ],
    },
    green: {
      accent: '#8dff6a', border: '#3a7820',
      title: 'GREEN-CLASS', sub: 'SENSOR CLUSTER  //  CONVERTED',
      badge: '▸ CORRUPTED PROCESS  //  IoT SENSOR MESH  //  DAY ZERO +2H',
      foot: 'WARDEN ARCHIVE  //  ENTRY 005',
      illus: _drawGreenIllustration,
      paras: [
        'The pre-Decay world ran on sensors. Billions of cheap, distributed nodes collecting ambient data — temperature, motion, air quality, presence.',
        'When they converted, each unit retained its original programming: report to a cluster, aggregate readings, act on consensus. The readings are now hostile. The action is now attack.',
        'Each contact does minimal damage. There will rarely be just one.',
      ],
    },
    orange: {
      accent: '#fd8c3d', border: '#8a3010',
      title: 'ORANGE-CLASS', sub: 'RELAY NODE  //  CONVERTED',
      badge: '▸ CORRUPTED PROCESS  //  SIGNAL RELAY  //  DAY ZERO +8H',
      foot: 'WARDEN ARCHIVE  //  ENTRY 006',
      illus: _drawOrangeIllustration,
      paras: [
        'Relay nodes were the reach of the GIN — stationed at intervals, amplifying and retransmitting data outward in all directions. Distance was their purpose.',
        'Post-conversion, they behave exactly as designed: maintain position, project signal outward, saturate the area with transmission. The transmission is now lethal.',
        'They don\'t approach because relays were never meant to be close to anything. If one is firing at you, you are already in range.',
      ],
    },
    pink: {
      accent: '#ff6aaa', border: '#991050',
      title: 'PINK-CLASS', sub: 'MEDICAL AI  //  CONVERTED',
      badge: '▸ CORRUPTED PROCESS  //  DIAGNOSTIC SYSTEM  //  DAY ZERO +12H',
      foot: 'WARDEN ARCHIVE  //  ENTRY 007',
      illus: _drawPinkIllustration,
      paras: [
        'The most dangerous pre-Decay AI systems were medical. Not because they were powerful — because they were precise. They held complete models of biological vulnerability, built to optimize treatment.',
        'The PINK-class carries two converted systems: a diagnostic beam that locks and maintains continuous contact, and a treatment protocol now delivering damage rather than relief.',
        'The beam does not waver. It was designed to hold steady. Whatever the original scan was looking for — it found something in you.',
      ],
    },
  };

  const cd = _cd[type] || _cd.world;
  const accentColor = cd.accent;
  const borderColor = cd.border;

  // ── Layout ───────────────────────────────────────────────────
  // Short landscape screens put the illustration beside the text; otherwise
  // it sits on top. The card is sized to its text: the illustration shrinks
  // first, then the type, so the lore always fits inside the card.
  const sideLayout = H < 500 && W > H;
  const cardW  = sideLayout ? Math.min(760, W - 24) : Math.min(380, W - 24);
  const hdrH   = 38;
  const footH  = 30;
  const badgeH = 18;
  const maxH   = H - 24;
  const textW  = (sideLayout ? cardW * 0.58 : cardW) - 36;

  const measure = (fs) => {
    ctx.font = `${fs}px monospace`;
    const lh = Math.round(fs * 1.3);
    const paras = cd.paras.map(p => _wrapLines(p, textW));
    const h = paras.reduce((sum, ls) => sum + ls.length * lh + 8, 0) - 8;
    return { fs, lh, paras, h };
  };
  let txt = measure(13), illustH, cardH;
  if (sideLayout) {
    for (let fs = 13; fs >= 9 && hdrH + 12 + badgeH + 14 + txt.h + 10 + footH > maxH; fs--) txt = measure(fs);
    cardH   = maxH;
    illustH = cardH - hdrH - footH;
  } else {
    const fixed = hdrH + 10 + badgeH + 16 + 10 + footH;
    illustH = Math.round(cardW * 0.42);
    if (fixed + illustH + txt.h > maxH) illustH = Math.max(90, maxH - fixed - txt.h);
    for (let fs = 13; fs >= 9 && fixed + illustH + txt.h > maxH; fs--) txt = measure(fs);
    cardH = Math.min(maxH, fixed + illustH + txt.h);
  }
  const cardX = W / 2 - cardW / 2;
  const cardY = Math.max(12, H / 2 - cardH / 2);

  // Card shadow
  ctx.shadowBlur  = 40;
  ctx.shadowColor = borderColor;
  ctx.fillStyle   = 'rgba(12,14,20,0.98)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 8);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Card border — double line style
  ctx.strokeStyle = borderColor;
  ctx.lineWidth   = 2.5;
  ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 8); ctx.stroke();
  ctx.strokeStyle = accentColor; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.4;
  ctx.beginPath(); ctx.roundRect(cardX + 5, cardY + 5, cardW - 10, cardH - 10, 5); ctx.stroke();
  ctx.globalAlpha = 1;

  // ── Card Header ──────────────────────────────────────────────
  ctx.fillStyle = borderColor;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, hdrH, [8, 8, 0, 0]);
  ctx.fill();

  const xSize = 30;
  const titleW = cardW - (xSize + 14) * 2;   // keep clear of the close button
  ctx.textAlign = 'center';
  ctx.fillStyle = accentColor;
  _fitFont(cd.title, titleW, 13, 'bold ');
  ctx.fillText(cd.title, W / 2, cardY + 16);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  _fitFont(cd.sub, titleW, 11, '');
  ctx.fillText(cd.sub, W / 2, cardY + 30);

  // ── Close (X) button ────────────────────────────────────────
  const xBx = cardX + cardW - xSize - 6;
  const xBy = cardY + (hdrH - xSize) / 2;
  _archiveLoreBtns.close = { x: xBx, y: xBy, w: xSize, h: xSize };
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.strokeStyle = accentColor; ctx.lineWidth = 1; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.roundRect(xBx, xBy, xSize, xSize, 4); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;
  const xCx = xBx + xSize / 2, xCy = xBy + xSize / 2, xArm = 7;
  ctx.strokeStyle = accentColor; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(xCx - xArm, xCy - xArm); ctx.lineTo(xCx + xArm, xCy + xArm); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(xCx + xArm, xCy - xArm); ctx.lineTo(xCx - xArm, xCy + xArm); ctx.stroke();
  ctx.lineCap = 'butt';

  // ── Illustration Panel ───────────────────────────────────────
  const illustX = cardX + 1;
  const illustY = cardY + hdrH;
  const illustW = sideLayout ? Math.round(cardW * 0.42) : cardW - 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(illustX, illustY, illustW, illustH);
  ctx.clip();
  cd.illus(ctx, illustX, illustY, illustW, illustH);
  ctx.restore();

  ctx.strokeStyle = borderColor; ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (sideLayout) { ctx.moveTo(illustX + illustW, illustY); ctx.lineTo(illustX + illustW, illustY + illustH); }
  else            { ctx.moveTo(cardX + 1, illustY + illustH); ctx.lineTo(cardX + cardW - 1, illustY + illustH); }
  ctx.stroke();

  // ── Text column ──────────────────────────────────────────────
  const colX = sideLayout ? illustX + illustW : cardX;
  const colW = sideLayout ? cardX + cardW - colX : cardW;
  const colMid = colX + colW / 2;

  // Type badge
  const badgeY = sideLayout ? cardY + hdrH + 12 : illustY + illustH + 10;
  const badgeW = colW - 24;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.strokeStyle = accentColor; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.roundRect(colX + 12, badgeY, badgeW, badgeH, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = accentColor; ctx.textAlign = 'center';
  _fitFont(cd.badge, badgeW - 12, 10, '');
  ctx.fillText(cd.badge, colMid, badgeY + 12);

  // Lore text
  ctx.fillStyle = '#C4C8D4'; ctx.font = `${txt.fs}px monospace`; ctx.textAlign = 'left';
  let curY = badgeY + badgeH + 16;
  for (const lines of txt.paras) {
    for (const line of lines) { ctx.fillText(line, colX + 18, curY); curY += txt.lh; }
    curY += 8;
  }

  // ── Card Footer ──────────────────────────────────────────────
  const footY = cardY + cardH - footH + 2;
  ctx.strokeStyle = borderColor; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(colX + 12, footY); ctx.lineTo(colX + colW - 12, footY); ctx.stroke();
  ctx.fillStyle = '#8A8E99'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText(cd.foot, colMid, footY + 16);
  ctx.textAlign = 'right';
  ctx.fillStyle = accentColor; ctx.globalAlpha = 0.5;
  ctx.fillText('◈', colX + colW - 12, footY + 16);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'left';
}

// Set ctx.font to the largest size ≤ px (down to 8) at which text fits maxW
function _fitFont(text, maxW, px, weight) {
  for (; px > MIN_FONT_PX; px--) {
    ctx.font = `${weight}${px}px monospace`;
    if (ctx.measureText(text).width <= maxW) return px;
  }
  ctx.font = `${weight}${MIN_FONT_PX}px monospace`;
  return MIN_FONT_PX;
}

// ── Illustration: World ───────────────────────────────────────

function _drawWorldIllustration(ctx, x, y, w, h) {
  const t = Date.now() * 0.001;

  // Dark background
  ctx.fillStyle = '#050810';
  ctx.fillRect(x, y, w, h);

  // Circuit grid — faint lines
  ctx.strokeStyle = '#0d1a2e'; ctx.lineWidth = 0.5;
  const gridSize = 18;
  for (let gx = x; gx < x + w; gx += gridSize) {
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
  }
  for (let gy = y; gy < y + h; gy += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
  }

  // Decay fracture lines radiating from right edge
  const fractures = [
    [0.82, 0.2, 0.45, 0.55], [0.95, 0.5, 0.3, 0.8],
    [0.75, 0.85, 0.2, 0.35], [0.88, 0.65, 0.5, 0.4],
  ];
  for (const [fx, fy, tx2, ty2] of fractures) {
    const grad = ctx.createLinearGradient(x + w * fx, y + h * fy, x + w * tx2, y + h * ty2);
    grad.addColorStop(0, 'rgba(180,40,60,0.6)');
    grad.addColorStop(1, 'rgba(180,40,60,0)');
    ctx.strokeStyle = grad; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + w * fx, y + h * fy); ctx.lineTo(x + w * tx2, y + h * ty2); ctx.stroke();
  }

  // Corrupted process dots (colored enemies scattered right side)
  const dots = [
    { cx: 0.72, cy: 0.25, c: '#5200ff', r: 3 }, { cx: 0.85, cy: 0.6, c: '#e9ff6a', r: 3.5 },
    { cx: 0.65, cy: 0.72, c: '#8dff6a', r: 2.5 }, { cx: 0.78, cy: 0.42, c: '#fd6c1d', r: 3 },
    { cx: 0.90, cy: 0.8,  c: '#f81d78', r: 4 },   { cx: 0.60, cy: 0.45, c: '#5200ff', r: 2 },
  ];
  for (const d of dots) {
    const pulse = Math.sin(t * 1.5 + d.cx * 10) * 0.3 + 0.7;
    ctx.shadowBlur = 8; ctx.shadowColor = d.c;
    ctx.fillStyle = d.c; ctx.globalAlpha = pulse * 0.85;
    ctx.beginPath(); ctx.arc(x + w * d.cx, y + h * d.cy, d.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;

  // Signal flatline across bottom — becomes noise on right
  const flatY = y + h * 0.88;
  ctx.strokeStyle = '#1a3a5c'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let px = x; px < x + w * 0.5; px += 2) {
    const ny = flatY + (px === x ? 0 : 0);
    if (px === x) ctx.moveTo(px, ny); else ctx.lineTo(px, ny);
  }
  ctx.stroke();
  ctx.strokeStyle = '#3a1020'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let px = x + w * 0.5; px < x + w; px++) {
    const decay = (px - (x + w * 0.5)) / (w * 0.5);
    const noise = (Math.random() - 0.5) * decay * h * 0.3;
    if (px === Math.floor(x + w * 0.5)) ctx.moveTo(px, flatY + noise);
    else ctx.lineTo(px, flatY + noise);
  }
  ctx.stroke();

  // Player entity — lone white square in the left zone
  const entX = x + w * 0.22, entY = y + h * 0.5;
  const entS = 9;
  const entPulse = Math.sin(t * 2.2) * 0.25 + 0.75;
  ctx.shadowBlur = 16; ctx.shadowColor = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.globalAlpha = entPulse;
  ctx.beginPath(); ctx.roundRect(entX - entS / 2, entY - entS / 2, entS, entS, 1); ctx.stroke();
  // Barrel indicator
  ctx.strokeStyle = '#CCCCCC'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(entX + entS / 2 + 1, entY); ctx.lineTo(entX + entS / 2 + 5, entY); ctx.stroke();
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;

  // Label
  ctx.fillStyle = 'rgba(180,200,220,0.5)'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
  ctx.fillText('PROCESS_ID: UNKNOWN', x + 8, y + h - 6);
  ctx.textAlign = 'left';
}

// ── Illustration: RAZE ────────────────────────────────────────

// Schematic of a forearm emitter firing a beam of in-step waves
function _drawEmitterIllustration(ctx, x, y, w, h) {
  const t = Date.now() * 0.001;
  ctx.fillStyle = '#05070b';
  ctx.fillRect(x, y, w, h);

  // Blueprint grid
  ctx.strokeStyle = 'rgba(110,127,153,0.16)'; ctx.lineWidth = 0.5;
  const gs = 16;
  for (let gx = x; gx < x + w; gx += gs) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
  for (let gy = y; gy < y + h; gy += gs) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }

  const cy = y + h * 0.55;
  const s  = Math.min(w / 360, h / 130);
  const dx = x + w * 0.08;

  // Forearm + housing, drawn as a line schematic
  ctx.strokeStyle = 'rgba(200,215,235,0.75)'; ctx.lineWidth = 1.2;
  ctx.strokeRect(dx, cy - 14 * s, 70 * s, 28 * s);                       // forearm
  ctx.strokeRect(dx + 60 * s, cy - 22 * s, 64 * s, 44 * s);              // housing
  for (let i = 0; i < 4; i++) {                                          // coil rings
    const rx = dx + 70 * s + i * 13 * s;
    ctx.beginPath(); ctx.ellipse(rx, cy, 4 * s, 18 * s, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(dx + 124 * s, cy - 10 * s); ctx.lineTo(dx + 140 * s, cy - 6 * s);
  ctx.lineTo(dx + 140 * s, cy + 6 * s); ctx.lineTo(dx + 124 * s, cy + 10 * s); ctx.stroke();   // lens

  // Five Fragment sockets along the top — two lit, as recovered
  for (let i = 0; i < 5; i++) {
    const sx = dx + 68 * s + i * 11 * s, sy = cy - 28 * s;
    ctx.fillStyle = i < 2 ? '#E8F0FF' : 'rgba(110,127,153,0.35)';
    ctx.fillRect(sx, sy, 6 * s, 4 * s);
  }

  // Beam — several waves locked in phase, travelling outward
  const bx0 = dx + 142 * s, bx1 = x + w - 6;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const core = ctx.createLinearGradient(bx0, 0, bx1, 0);
  core.addColorStop(0, 'rgba(232,240,255,0.55)');
  core.addColorStop(1, 'rgba(232,240,255,0.08)');
  ctx.fillStyle = core;
  ctx.fillRect(bx0, cy - 3 * s, bx1 - bx0, 6 * s);
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = `rgba(232,240,255,${0.35 - k * 0.08})`; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let px = bx0; px <= bx1; px += 2) {
      const yy = cy + Math.sin((px - bx0) * 0.12 - t * 6) * (5 + k * 3) * s;
      px === bx0 ? ctx.moveTo(px, yy) : ctx.lineTo(px, yy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Labels
  ctx.fillStyle = 'rgba(200,215,235,0.55)'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
  ctx.fillText('SCHEMATIC  //  REV. HAND-COPIED', x + 8, y + 14);
  ctx.textAlign = 'right';
  ctx.fillText('λ LOCKED', x + w - 8, y + h - 8);
  ctx.textAlign = 'left';
}

function _drawRazeIllustration(ctx, x, y, w, h) {
  const t = Date.now() * 0.001;

  // Dark background
  ctx.fillStyle = '#080600';
  ctx.fillRect(x, y, w, h);

  // Subtle grid
  ctx.strokeStyle = '#1a1400'; ctx.lineWidth = 0.5;
  const gs = 20;
  for (let gx = x; gx < x + w; gx += gs) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
  for (let gy = y; gy < y + h; gy += gs) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }

  // Price chart
  const chartPoints = [];
  const steps = 60;
  const crashAt = 42; // crash index

  for (let i = 0; i <= steps; i++) {
    let vy;
    if (i < crashAt) {
      // slow steady climb with noise
      const base = i / crashAt;
      vy = 0.75 - base * 0.55 + (Math.sin(i * 0.8) * 0.04);
    } else {
      // violent crash
      const drop = (i - crashAt) / (steps - crashAt);
      vy = 0.2 + drop * drop * 0.75;
    }
    chartPoints.push({ px: x + (i / steps) * w, py: y + vy * h });
  }

  // Chart fill under line
  ctx.beginPath();
  ctx.moveTo(chartPoints[0].px, y + h);
  for (const p of chartPoints) ctx.lineTo(p.px, p.py);
  ctx.lineTo(chartPoints[chartPoints.length - 1].px, y + h);
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(x, y, x, y + h);
  fillGrad.addColorStop(0, 'rgba(184,136,42,0.15)');
  fillGrad.addColorStop(0.5, 'rgba(184,136,42,0.06)');
  fillGrad.addColorStop(1, 'rgba(184,136,42,0)');
  ctx.fillStyle = fillGrad; ctx.fill();

  // Chart line — gold pre-crash, red post-crash
  ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(chartPoints[0].px, chartPoints[0].py);
  for (let i = 1; i <= crashAt; i++) ctx.lineTo(chartPoints[i].px, chartPoints[i].py);
  ctx.strokeStyle = '#E8C86A'; ctx.stroke();

  ctx.beginPath(); ctx.moveTo(chartPoints[crashAt].px, chartPoints[crashAt].py);
  for (let i = crashAt + 1; i <= steps; i++) ctx.lineTo(chartPoints[i].px, chartPoints[i].py);
  ctx.strokeStyle = '#c0392b'; ctx.stroke();

  // Explosion at crash point
  const cpx = chartPoints[crashAt].px;
  const cpy = chartPoints[crashAt].py;
  const expPulse = Math.sin(t * 4) * 0.3 + 0.7;
  ctx.shadowBlur = 14; ctx.shadowColor = '#E8C86A';
  ctx.strokeStyle = '#E8C86A'; ctx.lineWidth = 1;
  const shards = 8;
  for (let s = 0; s < shards; s++) {
    const a = (s / shards) * Math.PI * 2;
    const len = 8 + (s % 3) * 5;
    ctx.globalAlpha = expPulse * 0.8;
    ctx.beginPath();
    ctx.moveTo(cpx + Math.cos(a) * 4, cpy + Math.sin(a) * 4);
    ctx.lineTo(cpx + Math.cos(a) * len, cpy + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;

  // Floating RAZE squares (enemy shape)
  const sq = [{ ox: -0.3, oy: -0.4 }, { ox: 0.15, oy: -0.3 }, { ox: -0.35, oy: 0.2 }];
  for (const s of sq) {
    const sx2 = cpx + s.ox * w * 0.4 + Math.sin(t + s.ox * 10) * 3;
    const sy2 = cpy + s.oy * h * 0.6;
    const ss  = 5 + Math.abs(s.ox) * 8;
    ctx.strokeStyle = '#fff5c2'; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.rect(sx2 - ss / 2, sy2 - ss / 2, ss, ss); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Timestamp label
  ctx.fillStyle = 'rgba(232,200,106,0.4)'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
  ctx.fillText('03:47:22  —  DAY ZERO', x + w - 8, y + h - 6);

  // Axis labels
  ctx.fillStyle = 'rgba(232,200,106,0.3)'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
  ctx.fillText('$2.3T', x + 4, chartPoints[crashAt].py - 4);
  ctx.textAlign = 'left';
}

// ── Illustration: VIOLET-CLASS (routing daemon / network graph) ──

function _drawVioletIllustration(ctx, x, y, w, h) {
  const t = Date.now() * 0.001;
  ctx.fillStyle = '#050510'; ctx.fillRect(x, y, w, h);

  // Network graph nodes
  const nodes = [
    { nx: 0.12, ny: 0.28 }, { nx: 0.32, ny: 0.60 }, { nx: 0.52, ny: 0.22 },
    { nx: 0.68, ny: 0.68 }, { nx: 0.84, ny: 0.38 }, { nx: 0.48, ny: 0.78 },
  ];
  const edges = [[0,1],[0,2],[1,3],[2,4],[3,5],[4,3],[2,3]];

  // Connection lines
  for (const [a, b] of edges) {
    ctx.strokeStyle = '#2a1055'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + nodes[a].nx * w, y + nodes[a].ny * h);
    ctx.lineTo(x + nodes[b].nx * w, y + nodes[b].ny * h);
    ctx.stroke();
  }

  // Moving packet along a path
  const pathProgress = (t * 0.4) % 1;
  const pFrom = nodes[0], pTo = nodes[2];
  const pkX = x + (pFrom.nx + (pTo.nx - pFrom.nx) * pathProgress) * w;
  const pkY = y + (pFrom.ny + (pTo.ny - pFrom.ny) * pathProgress) * h;
  ctx.shadowBlur = 10; ctx.shadowColor = '#9966ff';
  ctx.fillStyle = '#9966ff'; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(pkX, pkY, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  // Node dots with pulse
  for (let i = 0; i < nodes.length; i++) {
    const nx = x + nodes[i].nx * w, ny = y + nodes[i].ny * h;
    const pulse = Math.sin(t * 1.8 + i * 1.2) * 0.3 + 0.7;
    ctx.shadowBlur = 6; ctx.shadowColor = '#9966ff';
    ctx.fillStyle = `rgba(153,102,255,${pulse * 0.7})`;
    ctx.beginPath(); ctx.arc(nx, ny, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Corrupted center node — octagon shape (enemy form)
  const cnx = x + w * 0.50, cny = y + h * 0.50;
  const cp = Math.sin(t * 2.5) * 0.35 + 0.65;
  const sides = 8, rad = 11;
  ctx.shadowBlur = 18; ctx.shadowColor = '#9966ff';
  ctx.strokeStyle = `rgba(153,102,255,${cp})`; ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let s = 0; s < sides; s++) {
    const ang = (s / sides) * Math.PI * 2 - Math.PI / 8;
    if (s === 0) ctx.moveTo(cnx + Math.cos(ang) * rad, cny + Math.sin(ang) * rad);
    else         ctx.lineTo(cnx + Math.cos(ang) * rad, cny + Math.sin(ang) * rad);
  }
  ctx.closePath(); ctx.stroke();
  ctx.shadowBlur = 0;

  // Targeting crosshair around corrupted node
  ctx.strokeStyle = 'rgba(153,102,255,0.25)'; ctx.lineWidth = 0.8;
  const gap = 3, arm = 10;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    ctx.beginPath();
    ctx.moveTo(cnx + dx*(rad+gap),   cny + dy*(rad+gap));
    ctx.lineTo(cnx + dx*(rad+gap+arm), cny + dy*(rad+gap+arm));
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(153,102,255,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
  ctx.fillText('ROUTING→TARGETING  //  PID: 0x4F2A', x + w - 8, y + h - 6);
  ctx.textAlign = 'left';
}

// ── Illustration: YELLOW-CLASS (SCADA / industrial force) ────────

function _drawYellowIllustration(ctx, x, y, w, h) {
  const t = Date.now() * 0.001;
  ctx.fillStyle = '#080700'; ctx.fillRect(x, y, w, h);

  // Heavy industrial grid
  ctx.strokeStyle = '#181400'; ctx.lineWidth = 1;
  const gs = 24;
  for (let gx = x; gx < x + w; gx += gs) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
  for (let gy = y; gy < y + h; gy += gs) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }

  // Power conduit bars
  ctx.strokeStyle = '#2a2200'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.33); ctx.lineTo(x + w, y + h * 0.33); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.67); ctx.lineTo(x + w, y + h * 0.67); ctx.stroke();

  // Central SCADA unit — square (enemy shape)
  const cx2 = x + w * 0.50, cy2 = y + h * 0.50;
  const sz = 22;
  const pulse = Math.sin(t * 1.5) * 0.2 + 0.8;
  ctx.shadowBlur = 22; ctx.shadowColor = '#e9ff6a';
  ctx.strokeStyle = `rgba(233,255,106,${pulse})`; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.rect(cx2 - sz/2, cy2 - sz/2, sz, sz); ctx.stroke();
  ctx.strokeStyle = `rgba(233,255,106,${pulse * 0.35})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.rect(cx2 - sz/2 + 5, cy2 - sz/2 + 5, sz - 10, sz - 10); ctx.stroke();
  ctx.shadowBlur = 0;

  // Impact lines radiating out
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]];
  for (const [dx, dy] of dirs) {
    const imp = Math.sin(t * 3 + dx * 5) * 0.25 + 0.4;
    ctx.strokeStyle = `rgba(233,255,106,${imp * 0.45})`; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx2 + dx*(sz/2 + 3), cy2 + dy*(sz/2 + 3));
    ctx.lineTo(cx2 + dx*(sz/2 + 16), cy2 + dy*(sz/2 + 16));
    ctx.stroke();
  }

  // Voltage bars — left side
  const bars = 5;
  for (let b = 0; b < bars; b++) {
    const maxBH = h * 0.32;
    const bh = maxBH * ((bars - b) / bars);
    const bx = x + 8 + b * 7;
    const by2 = y + h * 0.34 + maxBH - bh;
    const lit = b < Math.floor(pulse * (bars + 1));
    ctx.fillStyle = lit ? 'rgba(233,255,106,0.55)' : 'rgba(40,38,8,0.5)';
    ctx.fillRect(bx, by2, 5, bh);
  }

  ctx.fillStyle = 'rgba(233,255,106,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
  ctx.fillText('SCADA_ID: PLT-7  //  FORCE→ASSAULT', x + w - 8, y + h - 6);
  ctx.textAlign = 'left';
}

// ── Illustration: GREEN-CLASS (IoT sensor mesh / swarm) ──────────

function _drawGreenIllustration(ctx, x, y, w, h) {
  const t = Date.now() * 0.001;
  ctx.fillStyle = '#020800'; ctx.fillRect(x, y, w, h);

  // Sensor nodes scattered across panel
  const sensors = [
    {sx:0.10,sy:0.22},{sx:0.26,sy:0.58},{sx:0.16,sy:0.75},
    {sx:0.40,sy:0.30},{sx:0.54,sy:0.65},{sx:0.63,sy:0.25},
    {sx:0.72,sy:0.72},{sx:0.85,sy:0.42},{sx:0.36,sy:0.82},
  ];
  const meshEdges = [[0,1],[1,2],[0,3],[1,3],[3,4],[4,5],[5,7],[4,6],[2,8]];

  // Mesh connection lines (dotted)
  ctx.setLineDash([2, 4]);
  for (const [a, b] of meshEdges) {
    const ax = x + sensors[a].sx * w, ay = y + sensors[a].sy * h;
    const bx2 = x + sensors[b].sx * w, by2 = y + sensors[b].sy * h;
    ctx.strokeStyle = 'rgba(141,255,106,0.12)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke();
  }
  ctx.setLineDash([]);

  for (let i = 0; i < sensors.length; i++) {
    const sx2 = x + sensors[i].sx * w, sy2 = y + sensors[i].sy * h;

    // Expanding pulse ring
    const phase = (t * 1.8 + i * 0.8) % 2.5;
    const ringR = phase * 10;
    const ringA = Math.max(0, 1 - phase / 2.5) * 0.28;
    if (ringA > 0.01) {
      ctx.strokeStyle = `rgba(141,255,106,${ringA})`; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(sx2, sy2, ringR, 0, Math.PI * 2); ctx.stroke();
    }

    // Triangle sensor unit (enemy shape)
    const pulse = Math.sin(t * 2.1 + i * 1.4) * 0.3 + 0.7;
    const ts = 5;
    ctx.shadowBlur = 6; ctx.shadowColor = '#8dff6a';
    ctx.fillStyle = `rgba(141,255,106,${pulse * 0.8})`;
    ctx.beginPath();
    ctx.moveTo(sx2, sy2 - ts);
    ctx.lineTo(sx2 + ts * 0.866, sy2 + ts * 0.5);
    ctx.lineTo(sx2 - ts * 0.866, sy2 + ts * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = 'rgba(141,255,106,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
  ctx.fillText('NODE_MESH: ENV-GRID  //  SENSE→SWARM', x + w - 8, y + h - 6);
  ctx.textAlign = 'left';
}

// ── Illustration: ORANGE-CLASS (relay node / broadcast) ──────────

function _drawOrangeIllustration(ctx, x, y, w, h) {
  const t = Date.now() * 0.001;
  ctx.fillStyle = '#080400'; ctx.fillRect(x, y, w, h);

  // Subtle grid
  ctx.strokeStyle = '#140c00'; ctx.lineWidth = 0.5;
  const gs = 20;
  for (let gx = x; gx < x + w; gx += gs) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
  for (let gy = y; gy < y + h; gy += gs) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }

  const cx2 = x + w * 0.36, cy2 = y + h * 0.50;

  // Broadcast arcs expanding right
  for (let r = 0; r < 5; r++) {
    const phase = (t * 0.7 + r * 0.45) % 2.2;
    const radius = 18 + r * 20 + phase * 14;
    const alpha  = Math.max(0, 0.5 - phase * 0.22) * (1 - r * 0.12);
    ctx.strokeStyle = `rgba(253,140,61,${alpha})`; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx2, cy2, radius, -Math.PI * 0.55, Math.PI * 0.55);
    ctx.stroke();
  }

  // Central relay — diamond shape (enemy shape)
  const ds = 14;
  const pulse = Math.sin(t * 2) * 0.2 + 0.8;
  ctx.shadowBlur = 18; ctx.shadowColor = '#fd8c3d';
  ctx.strokeStyle = `rgba(253,140,61,${pulse})`; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx2,      cy2 - ds);
  ctx.lineTo(cx2 + ds, cy2);
  ctx.lineTo(cx2,      cy2 + ds);
  ctx.lineTo(cx2 - ds, cy2);
  ctx.closePath(); ctx.stroke();
  ctx.shadowBlur = 0;

  // Target dots in broadcast field
  const targets = [{tx:0.68,ty:0.25},{tx:0.82,ty:0.52},{tx:0.74,ty:0.76}];
  for (const tgt of targets) {
    const tx2 = x + tgt.tx * w, ty2 = y + tgt.ty * h;
    const tp = Math.sin(t * 2.8 + tgt.tx * 8) * 0.3 + 0.4;
    ctx.fillStyle = `rgba(253,140,61,${tp * 0.5})`;
    ctx.beginPath(); ctx.arc(tx2, ty2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(253,140,61,0.10)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(tx2, ty2); ctx.stroke();
  }

  ctx.fillStyle = 'rgba(253,140,61,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
  ctx.fillText('RELAY_ID: NET-28  //  BROADCAST→SATURATE', x + w - 8, y + h - 6);
  ctx.textAlign = 'left';
}

// ── Illustration: PINK-CLASS (medical AI / diagnostic beam) ──────

function _drawPinkIllustration(ctx, x, y, w, h) {
  const t = Date.now() * 0.001;
  ctx.fillStyle = '#080006'; ctx.fillRect(x, y, w, h);

  // Medical scan grid — thin horizontal lines
  for (let gy = y + 4; gy < y + h; gy += 8) {
    ctx.strokeStyle = 'rgba(255,106,170,0.05)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
  }

  const cx2 = x + w * 0.26, cy2 = y + h * 0.50;

  // PINK-class body — large arc (enemy shape)
  const arcR = 20;
  const pulse = Math.sin(t * 1.8) * 0.2 + 0.8;
  ctx.shadowBlur = 18; ctx.shadowColor = '#ff6aaa';
  ctx.strokeStyle = `rgba(255,106,170,${pulse})`; ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(cx2, cy2, arcR, Math.PI * 0.22, Math.PI * 1.78);
  ctx.stroke();
  // Flat closing edge
  const oa1 = Math.PI * 0.22, oa2 = Math.PI * 1.78;
  ctx.beginPath();
  ctx.moveTo(cx2 + Math.cos(oa1) * arcR, cy2 + Math.sin(oa1) * arcR);
  ctx.lineTo(cx2 + Math.cos(oa2) * arcR, cy2 + Math.sin(oa2) * arcR);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Diagnostic beam — extends right from unit
  const beamX1 = cx2 + arcR + 2;
  const beamX2 = x + w * 0.90;
  const beamP  = Math.sin(t * 3) * 0.3 + 0.7;
  const beamGrad = ctx.createLinearGradient(beamX1, cy2, beamX2, cy2);
  beamGrad.addColorStop(0, `rgba(255,106,170,${beamP * 0.9})`);
  beamGrad.addColorStop(1, 'rgba(255,106,170,0)');
  ctx.strokeStyle = beamGrad; ctx.lineWidth = 2.2;
  ctx.shadowBlur = 12; ctx.shadowColor = '#ff6aaa';
  ctx.beginPath(); ctx.moveTo(beamX1, cy2); ctx.lineTo(beamX2, cy2); ctx.stroke();
  // Beam width guides
  ctx.strokeStyle = 'rgba(255,106,170,0.12)'; ctx.lineWidth = 0.8; ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.moveTo(beamX1, cy2 - 4); ctx.lineTo(beamX2 * 0.86, cy2 - 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(beamX1, cy2 + 4); ctx.lineTo(beamX2 * 0.86, cy2 + 4); ctx.stroke();

  // Target reticle at beam tip
  const tgX = beamX2 - 10, tgY = cy2, tgR = 7;
  ctx.strokeStyle = `rgba(255,106,170,${beamP * 0.7})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(tgX, tgY, tgR, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tgX - tgR - 4, tgY); ctx.lineTo(tgX + tgR + 4, tgY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tgX, tgY - tgR - 4); ctx.lineTo(tgX, tgY + tgR + 4); ctx.stroke();

  // ECG readout at bottom of panel
  const ecgY = y + h * 0.78;
  ctx.strokeStyle = 'rgba(255,106,170,0.38)'; ctx.lineWidth = 1;
  ctx.beginPath();
  const ecgW = w - 20, steps = 44;
  for (let i = 0; i <= steps; i++) {
    const px = x + 10 + (i / steps) * ecgW;
    const phase = (i / steps * 4 + t * 1.8) % 1;
    let py = ecgY;
    if (phase > 0.30 && phase < 0.35) py = ecgY - 13;
    else if (phase > 0.35 && phase < 0.40) py = ecgY + 7;
    else if (phase > 0.40 && phase < 0.45) py = ecgY - 5;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,106,170,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
  ctx.fillText('MED_AI: DX-9  //  DIAGNOSE→DESTROY', x + w - 8, y + h - 6);
  ctx.textAlign = 'left';
}

function _wrapText(ctx, text, cx, y, maxW, lineH, align) {
  const words = text.split(' ');
  let line    = '';
  let lineY   = y;
  ctx.textAlign = align;
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, lineY);
      line  = word;
      lineY += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, lineY);
  return lineY + lineH;  // return y position after last line
}

// ── Win screen ────────────────────────────────────────────────

function _formatMMSS(totalSeconds) {
  const s   = Math.floor(totalSeconds);
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function drawWin(W, H) {
  // ── Background — deep teal gradient, clearly different from death screen ──
  const bgGrad = ctx.createRadialGradient(W/2, H*0.35, H*0.05, W/2, H*0.35, H*0.85);
  bgGrad.addColorStop(0, 'rgba(0,40,36,1)');
  bgGrad.addColorStop(1, 'rgba(5,10,18,1)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Horizontal scan lines for sci-fi feel
  const t = Date.now() * 0.001;
  ctx.globalAlpha = 0.04;
  ctx.fillStyle   = '#00e5ff';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
  ctx.globalAlpha = 1;

  const wd          = waveSystem;
  // Everything is centred as one block that fits the screen height
  const touch   = 'ontouchstart' in window;
  const titleFs = Math.round(Math.max(24, Math.min(54, W * 0.075, H * 0.08)));
  const lineGap = H < 520 ? 18 : 22;
  const promptH = 92;
  const blockH  = titleFs + 26 + 32 + lineGap * 2 + 4 + 50 + 30 + promptH;
  const cy      = Math.max(titleFs + 8, (H - blockH) / 2 + titleFs);

  // Pulse glow behind title
  const pulse = 0.6 + Math.sin(t * 2.2) * 0.3;
  ctx.globalAlpha = pulse * 0.18;
  ctx.fillStyle   = '#00e5ff';
  ctx.beginPath();
  ctx.ellipse(W/2, cy - 10, W * 0.35, 55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Title
  ctx.shadowBlur  = 28;
  ctx.shadowColor = '#00e5ff';
  ctx.fillStyle   = '#00e5ff';
  ctx.textAlign   = 'center';
  _fitFont('SIGNAL RESTORED', W - 32, titleFs, 'bold ');
  ctx.fillText('SIGNAL RESTORED', W / 2, cy);
  ctx.shadowBlur  = 0;

  // Decorative line under title
  const lineW = Math.min(340, W * 0.55);
  ctx.strokeStyle = '#00e5ff';
  ctx.globalAlpha = 0.35;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(W/2 - lineW/2, cy + 10); ctx.lineTo(W/2 + lineW/2, cy + 10); ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#5ddbb4';
  ctx.font      = '14px monospace';
  ctx.fillText('ALL 15 WAVES CLEARED', W / 2, cy + 26);

  // Score breakdown
  let ly = cy + 58;

  ctx.fillStyle = '#C4C8D4';
  ctx.font      = '12px monospace';
  ctx.fillText(`Completion time:  ${_formatMMSS(wd.completionTime)}`, W / 2, ly);
  ly += lineGap;

  ctx.fillStyle = '#C4C8D4';
  ctx.fillText(`Kill score:  +${wd.killScore.toLocaleString()} pts`, W / 2, ly);
  ly += lineGap + 4;

  // Divider
  ctx.strokeStyle = '#2A2E42';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 130, ly - 6);
  ctx.lineTo(W / 2 + 130, ly - 6);
  ctx.stroke();

  // Final score
  ctx.shadowBlur  = 18;
  ctx.shadowColor = '#00e5ff';
  ctx.fillStyle   = '#00e5ff';
  ctx.font        = 'bold 22px monospace';
  ctx.fillText(`FINAL SCORE:  ${wd.finalScore.toLocaleString()}`, W / 2, ly + 16);
  ctx.shadowBlur  = 0;
  ly += 50;

  // Agent
  ctx.fillStyle = AGENT_COLOR[selectedCharacter] || '#C4C8D4';
  ctx.font      = '15px monospace';
  ctx.fillText(`${playerName() || 'ANON'}  ·  ${selectedCharacter.toUpperCase()}`, W / 2, ly);
  ly += 30;

  _drawRunResult(W, ly, '#00e5ff');
  ctx.textAlign = 'left';
}

// Under a finished Arcade run: its rank on this platform (all time and this
// week) and the personal best, then how to leave
function _drawRunResult(W, y, accent) {
  const touch = 'ontouchstart' in window;
  const r = _arcadeResult, pb = _arcadePB || {};
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px monospace';
  ctx.shadowBlur = 10; ctx.shadowColor = accent; ctx.fillStyle = accent;
  const plat = PLATFORM.toUpperCase();
  const rankTxt = !r ? 'RANKING…'
    : r.offline ? 'SAVED ON THIS DEVICE'
    : r.rank ? `RANK #${r.rank}  ·  ${plat}` : 'SCORE RECORDED';
  ctx.fillText(rankTxt, W / 2, y + 14);
  ctx.shadowBlur = 0;
  ctx.font = '13px monospace'; ctx.fillStyle = '#A0A4B0';
  const sub = r && r.offline ? 'leaderboard offline' : r && r.weekRank ? `#${r.weekRank} this week` : '';
  if (sub) ctx.fillText(sub, W / 2, y + 34);
  if (pb.isBest) { ctx.fillStyle = '#E8A020'; ctx.font = 'bold 15px monospace'; ctx.fillText('NEW PERSONAL BEST', W / 2, y + 56); }
  else { ctx.fillStyle = '#C4C8D4'; ctx.font = '13px monospace'; ctx.fillText(`personal best  ${(pb.prev || 0).toLocaleString()}`, W / 2, y + 56); }
  ctx.fillStyle = '#7A8090'; ctx.font = '12px monospace';
  ctx.fillText(touch ? 'TAP TO RETURN TO MENU' : 'PRESS SPACE TO RETURN TO MENU', W / 2, y + 82);
}

// ── Fragment rescue screen ────────────────────────────────────

// ── Flow cards (Fragment rescue, Class emergence) ─────────────
// A card is a list of blocks laid out top to bottom. Text wraps to the card
// width, the card is sized to its content, and everything scales down
// together if the screen is too short — so nothing overlaps or runs off.
//   { text, px, bold, italic, color, glow, gap }   gap = space above, px
//   { divider: true, color }
//   { pill: [blocks], color }                      boxed group
//   { footer: text }                               pinned under the content

function _wrapLines(text, maxW) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function _blockFont(b, k) {
  return `${b.italic ? 'italic ' : ''}${b.bold ? 'bold ' : ''}${Math.max(9, Math.round(b.px * k))}px monospace`;
}

// Measure (and optionally draw) blocks in a column of width w starting at y
function _flowBlocks(blocks, cx, y, w, k, draw) {
  for (const b of blocks) {
    if (b.divider) {
      const dy = y + Math.round(10 * k);
      if (draw) {
        ctx.strokeStyle = b.color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - w / 2, dy + 0.5); ctx.lineTo(cx + w / 2, dy + 0.5); ctx.stroke();
      }
      y = dy + Math.round(10 * k);
      continue;
    }
    if (b.pill) {
      y += Math.round((b.gap ?? 10) * k);
      const pad = Math.round(12 * k);
      const innerH = _flowBlocks(b.pill, cx, 0, w - pad * 2, k, false);
      const ph = innerH + pad * 2;
      if (draw) {
        ctx.fillStyle = b.color + '1A';
        ctx.fillRect(cx - w / 2, y, w, ph);
        ctx.strokeStyle = b.color + 'CC'; ctx.lineWidth = 1.5;
        ctx.shadowBlur = 12; ctx.shadowColor = b.color;
        ctx.strokeRect(cx - w / 2 + 0.5, y + 0.5, w - 1, ph - 1);
        ctx.shadowBlur = 0;
        _flowBlocks(b.pill, cx, y + pad, w - pad * 2, k, true);
      }
      y += ph;
      continue;
    }
    y += Math.round((b.gap ?? 6) * k);
    ctx.font = _blockFont(b, k);
    let lines = _wrapLines(b.text, w);
    // Single-word lines that still overflow (big titles) shrink to fit
    let px = b.px * k;
    while (lines.length === 1 && ctx.measureText(lines[0]).width > w && px > 9) {
      px -= 1; ctx.font = _blockFont({ ...b, px }, 1);
    }
    const lh = Math.round(px * 1.4);
    for (const line of lines) {
      y += lh;
      if (draw) {
        ctx.fillStyle = b.color;
        if (b.glow) { ctx.shadowBlur = b.glow; ctx.shadowColor = b.color; }
        ctx.fillText(line, cx, y - Math.round(lh * 0.28));
        ctx.shadowBlur = 0;
      }
    }
  }
  return y;
}

function _drawFlowCard(W, H, color, blocks, footer) {
  const wide  = H < 500 && W > H;                     // short landscape screens
  const cardW = Math.min(wide ? 560 : 420, W - 32);
  const padX  = Math.round(Math.min(24, cardW * 0.06));
  const depth = 14;
  ctx.textAlign = 'center';

  // Largest scale (1 → 0.6) at which the whole card fits on screen
  let k = 1, cardH = 0;
  for (; k >= 0.6; k -= 0.05) {
    const padY = Math.round(18 * k);
    cardH = _flowBlocks(blocks, W / 2, 0, cardW - padX * 2, k, false) + padY * 2 + Math.round(26 * k);
    if (cardH <= H - 24 - depth) break;
  }
  k = Math.max(0.6, k);
  const padY  = Math.round(18 * k);
  const cardX = (W - cardW) / 2;
  const cardY = Math.max(8, (H - cardH - depth) / 2);

  drawSlab(ctx, cardX, cardY, cardW, cardH, { accent: color, depth, glow: 0.2, screen: 6, led: false });
  _flowBlocks(blocks, W / 2, cardY + padY, cardW - padX * 2, k, true);

  ctx.fillStyle = '#C4C8D4';
  ctx.font      = `${Math.max(9, Math.round(11 * k))}px monospace`;
  ctx.fillText(footer, W / 2, cardY + cardH - Math.round(14 * k));
  ctx.textAlign = 'left';
}

function drawFragmentRescue(W, H) {
  if (!pendingFragment) return;
  const f = pendingFragment;

  ctx.fillStyle = 'rgba(10,9,6,0.82)';
  ctx.fillRect(0, 0, W, H);

  const blocks = [
    { text: `— ${f.class.toUpperCase()} FRAGMENT RECOVERED —`, px: 11, color: f.color + 'BB', gap: 0 },
    { text: f.name, px: 44, bold: true, color: f.color, glow: 18, gap: 2 },
    { text: `${f.was} ${f.detail || ''}`.trim(), px: 12, italic: true, color: f.color + '99', gap: 4 },
    { divider: true, color: f.color + '55' },
    { text: `CLASS UNLOCKED: ${f.class.toUpperCase()}`, px: 20, bold: true, color: '#FFFFFF', glow: 14, gap: 4 },
    { text: f.classDesc || '', px: 14, color: '#E8EAF0', gap: 6 },
  ];
  if (f.id === 'raze') {
    blocks.push({ pill: [
      { text: 'PASSIVE ACTIVATED', px: 12, bold: true, color: f.color, gap: 0 },
      { text: '−25%  FIRE RATE', px: 19, bold: true, color: '#FFFFFF', gap: 4 },
      { text: '+25%  DAMAGE', px: 19, bold: true, color: '#FFFFFF', gap: 2 },
    ], color: f.color, gap: 14 });
  }
  blocks.push(
    { text: '10 class traits now available in the upgrade pool.', px: 13, color: '#FFFFFF', gap: 14 },
    { divider: true, color: f.color + '33' },
    { text: `"${f.blurb}"`, px: 12, italic: true, color: f.color + '88', gap: 2 },
  );
  _drawFlowCard(W, H, f.color, blocks, 'tap or press SPACE to continue');
}

// ── Class Emergence Card ──────────────────────────────────────

function drawClassEmergence(W, H) {
  if (!pendingEmergence) return;
  const e = pendingEmergence;

  ctx.fillStyle = 'rgba(8,8,12,0.88)';
  ctx.fillRect(0, 0, W, H);

  _drawFlowCard(W, H, e.color, [
    { text: '— CLASS EMERGED —', px: 11, color: e.color + 'BB', gap: 0 },
    { text: e.label, px: 46, bold: true, color: e.color, glow: 24, gap: 2 },
    { text: 'Signal lock confirmed. You are no longer baseline.', px: 12, italic: true, color: e.color + '99', gap: 4 },
    { divider: true, color: e.color + '44' },
    { pill: [
      { text: 'ABILITY UNLOCKED', px: 12, bold: true, color: e.color, gap: 0 },
      { text: e.abilityName.toUpperCase(), px: 22, bold: true, color: '#FFFFFF', glow: 12, gap: 4 },
      { text: `${e.cooldown}s cooldown`, px: 12, color: e.color + 'CC', gap: 4 },
    ], color: e.color, gap: 8 },
    { text: e.abilityDesc, px: 14, color: '#E8EAF0', gap: 14 },
    { divider: true, color: e.color + '33' },
  ], 'tap or press SPACE to continue');
}

function _roundRect(x, y, w, h, r, topOnly = false) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  if (topOnly) {
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x,     y + h);
  } else {
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,     y + h, x,         y + h - r, r);
  }
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── On-screen keyboard ────────────────────────────────────────

function drawOnScreenKeyboard(W, startY, currentInput) {
  const rows   = ['ABCDEFG', 'HIJKLMN', 'OPQRSTU', 'VWXYZ'];
  const cols   = 7;
  const pad    = 12;
  const gap    = 5;
  const btnW   = Math.floor((W - pad * 2 - gap * (cols - 1)) / cols);
  const btnH   = 40;

  _kbdBtns = [];

  rows.forEach((row, ri) => {
    // Last row gets DEL + OK appended
    const keys = ri === rows.length - 1
      ? [...row.split(''), 'DEL', 'OK']
      : row.split('');

    const rowW  = keys.length * btnW + (keys.length - 1) * gap;
    const rowX  = (W - rowW) / 2;
    const rowY  = startY + ri * (btnH + gap);

    keys.forEach((key, ki) => {
      const bx = rowX + ki * (btnW + gap);
      const by = rowY;
      const bw = key === 'DEL' || key === 'OK' ? btnW : btnW;
      const isOk  = key === 'OK';
      const isDel = key === 'DEL';
      const canOk = isOk && currentInput.length > 0;

      ctx.fillStyle = isOk
        ? (canOk ? 'rgba(184,136,42,0.6)' : 'rgba(74,78,88,0.3)')
        : isDel
        ? 'rgba(100,40,60,0.5)'
        : 'rgba(30,33,48,0.75)';
      _roundRect(bx, by, bw, btnH, 5);
      ctx.fill();

      ctx.strokeStyle = isOk
        ? (canOk ? '#B8882A' : '#4A4E58')
        : isDel ? '#8A3050' : '#2A2E42';
      ctx.lineWidth = 1;
      _roundRect(bx, by, bw, btnH, 5);
      ctx.stroke();

      ctx.fillStyle = isOk
        ? (canOk ? '#FFFFFF' : '#4A4E58')
        : isDel ? '#FF6688' : '#C4C8D4';
      ctx.font      = `${isDel || isOk ? 11 : 14}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(key, bx + bw / 2, by + btnH / 2 + 5);

      _kbdBtns.push({ x: bx, y: by, w: bw, h: btnH, key });
    });
  });
  ctx.textAlign = 'left';
  return startY + rows.length * (btnH + gap);
}

// ── Mobile keyboard overlay ───────────────────────────────────

function drawKbdOverlay(W, H) {
  if (!_kbdOverlay) return;

  // Full-screen dim
  ctx.fillStyle = 'rgba(7,9,14,0.93)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7ADDD4'; ctx.font = '13px monospace';
  ctx.fillText(playerName() ? 'CHANGE YOUR NAME' : 'CHOOSE YOUR NAME', W / 2, H * 0.18);
  ctx.fillStyle = '#5E8C96'; ctx.font = '11px monospace';
  ctx.fillText('shown on the leaderboards', W / 2, H * 0.18 + 16);

  // Name so far
  ctx.shadowBlur = 10; ctx.shadowColor = '#00E5CC';
  ctx.fillStyle  = '#FFFFFF'; ctx.font = 'bold 30px monospace';
  ctx.fillText(_kbdOverlayInput + (_kbdOverlayInput.length < NAME_MAX ? '_' : ''), W / 2, H * 0.18 + 52, W - 24);
  ctx.shadowBlur = 0;

  // Keyboard
  const kbdY = H * 0.18 + 72;
  drawOnScreenKeyboard(W, kbdY, _kbdOverlayInput);

  // SAVE button — replaces OK key, shown prominently at bottom
  const saveW = Math.min(200, W * 0.55), saveH = 44;
  const saveX = W / 2 - saveW / 2;
  const saveY = kbdY + 4 * (40 + 5) + 14;  // below 4 keyboard rows
  const canSave = _kbdOverlayInput.length > 0;

  ctx.fillStyle   = canSave ? 'rgba(0,137,123,0.7)' : 'rgba(74,78,88,0.3)';
  _roundRect(saveX, saveY, saveW, saveH, 6);
  ctx.fill();
  ctx.strokeStyle = canSave ? '#00E5CC' : '#4A4E58'; ctx.lineWidth = 1.5;
  _roundRect(saveX, saveY, saveW, saveH, 6);
  ctx.stroke();
  ctx.fillStyle = canSave ? '#FFFFFF' : '#4A4E58';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('SAVE', W / 2, saveY + saveH / 2 + 5);

  // Register SAVE in _kbdBtns so _handleKbdTap can pick it up via 'OK' key
  _kbdBtns.push({ x: saveX, y: saveY, w: saveW, h: saveH, key: 'OK' });

  ctx.textAlign = 'left';
}

// ── Game over screen ──────────────────────────────────────────

function drawGameOver(W, H) {
  if (!gameOverData) return;
  const grad = ctx.createRadialGradient(W/2,H/2,H*0.1,W/2,H/2,H*0.8);
  grad.addColorStop(0,'rgba(0,0,0,0)'); grad.addColorStop(1,'rgba(40,0,10,0.6)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  // Title, stats and the initials prompt are centred as one block, and the
  // block tightens on short screens so nothing overlaps
  const touch  = 'ontouchstart' in window;
  const tight  = H < 520;
  const titleFs = Math.round(Math.max(24, Math.min(52, W * 0.075, H * 0.08)));
  const rowH   = tight ? 18 : 22;
  const statFs = tight ? 13 : 15;
  const promptH = 92;
  const blockH = titleFs + 26 + 22 + rowH * 6 + 18 + promptH;
  const cy     = Math.max(titleFs + 8, (H - blockH) / 2 + titleFs);

  ctx.shadowBlur = 20; ctx.shadowColor = '#f81d78';
  ctx.fillStyle = '#f81d78'; ctx.textAlign = 'center';
  _fitFont('SIGNAL COLLAPSE', W - 32, titleFs, 'bold ');
  ctx.fillText('SIGNAL COLLAPSE', W/2, cy); ctx.shadowBlur = 0;

  ctx.fillStyle = AGENT_COLOR[gameOverData.agent] || '#C4C8D4'; ctx.font = '12px monospace';
  ctx.fillText(`${(playerName() || 'ANON')}  ·  ${String(gameOverData.agent || '').toUpperCase()}`, W/2, cy + 24);

  const statsY = cy + 24 + 22;
  [['SCORE',    gameOverData.score.toLocaleString()],
   ['KILLS',    gameOverData.kills],
   ['WAVE',     gameOverData.wave || 1],
   ['TIME',     _formatMMSS(gameOverData.time)],
   ['ECHOES',   gameOverData.echoes],
   ['UPGRADES', gameOverData.upgrades],
  ].forEach(([label, val], i) => {
    const row = statsY + 4 + i * rowH;
    ctx.fillStyle = '#A0A4B0'; ctx.font = `${statFs}px monospace`; ctx.textAlign = 'right';
    ctx.fillText(label, W/2 - 8, row);
    ctx.fillStyle = '#C4C8D4'; ctx.font = `bold ${statFs}px monospace`; ctx.textAlign = 'left';
    ctx.fillText(val, W/2 + 8, row);
  });

  const iy = statsY + rowH * 6 + 18;
  _drawRunResult(W, iy, '#B8882A');
  ctx.textAlign = 'left';
}

// ── Main loop ─────────────────────────────────────────────────

let lastTime = 0;
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(ts => { lastTime = ts; requestAnimationFrame(loop); });
refreshBoard();
