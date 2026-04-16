// CHROMATIC DECAY — Main Game Loop

import { CONFIG }           from './config.js';
import { Input }            from './input.js';
import { Camera, GameMap }  from './map.js';
import { Player }           from './player.js';
import { EnemySystem }      from './enemies.js';
import { ProjectileSystem } from './projectiles.js';
import { ResidualSystem }   from './residuals.js';
import { EchoSystem }       from './echoes.js';
import { ParticleSystem }   from './particles.js';
import { UpgradeScreen }    from './upgrades.js';
import { CompanionSystem }  from './companions.js';
import { TrapSystem }       from './traps.js';
import { HUD }              from './hud.js';
import { LoreFeed }         from './lore.js';
import { FRAGMENT_DATA, getRunFragment, placeFragment } from './fragments.js';
import { WaveSystem, CHARGE_COLORS } from './waves.js';
import { clamp, formatTime, dist } from './utils.js';
import { AdminPanel } from './admin.js';
import { startAmbient, stopAmbient, startTitleMusic, stopTitleMusic, sfxShoot, sfxEnemyKill, sfxPlayerHit, sfxWaveClear, sfxFragmentPickup, resumeAudio } from './audio.js';

// ── Canvas ────────────────────────────────────────────────────

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ── Zoom / viewport ───────────────────────────────────────────

let ZOOM = CONFIG.camera_zoom;
function updateZoom() {
  const W      = window.innerWidth;
  const H      = window.innerHeight;
  const minDim = Math.min(W, H);
  const mobile = 'ontouchstart' in window;

  // Base zoom by screen size — desktop unchanged
  let z;
  if      (!mobile)      z = CONFIG.camera_zoom;  // PC always uses config value
  else if (minDim < 400) z = 1.6;
  else if (minDim < 600) z = 1.9;
  else if (minDim < 900) z = 2.1;
  else                   z = CONFIG.camera_zoom;

  // On mobile: cap zoom so at least 280px of world width is always visible.
  if (mobile) z = Math.min(z, W / 280);

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

function applyWorldTransform() {
  ctx.setTransform(ZOOM, 0, 0, ZOOM, -camera.x * ZOOM, -camera.y * ZOOM);
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
  FRAGMENT_RESCUE: 5,
  ARCHIVE:         6,
  ADMIN:           7,
  WIN:             8,
};
let state = STATES.TITLE;

// ── Systems ───────────────────────────────────────────────────

const input       = new Input(canvas);
const camera      = new Camera();
const particles   = new ParticleSystem();
const projectiles = new ProjectileSystem();
const enemies     = new EnemySystem();
const residuals   = new ResidualSystem();
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
let player = null;
let elapsed = 0;

// ── Per-run state ─────────────────────────────────────────────
let loreTimeTriggers   = [];
let firstEnemySeen     = {};
let nearDeathTriggered = false;
let pendingFragment    = null;
let razeRescuedThisRun = false;

// ── Archive lore card state ───────────────────────────────────
let archiveLoreCard = null; // null | 'world' | 'raze'
const _archiveLoreBtns = { world: null, raze: null, close: null };

// ── Archive ───────────────────────────────────────────────────

function _scoreColor(score, rank) {
  if (rank === 0)        return '#f81d78'; // 1st place — magenta
  if (score >= 6000)     return '#fd6c1d'; // 6k+ — orange
  if (score >= 3000)     return '#e9ff6a'; // 3–6k — yellow
  return '#4A4E58';                        // 0–3k — grey
}

function loadArchive() {
  try { return JSON.parse(localStorage.getItem('chromatic_decay_archive') || '{}'); }
  catch { return {}; }
}
function saveArchive(a) {
  localStorage.setItem('chromatic_decay_archive', JSON.stringify(a));
}
// ── Supabase config ───────────────────────────────────────────
const _SB_URL  = 'https://kzjvbygxtnyedrfeqmmt.supabase.co';
const _SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6anZieWd4dG55ZWRyZmVxbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTE1NjQsImV4cCI6MjA5MTI4NzU2NH0.NXCqGSO4uuCXYDQfw2rgtXGiEDxk0kRTt-iaMG6aUmE';
const _SB_HEADERS = { 'Content-Type': 'application/json', 'apikey': _SB_KEY, 'Authorization': `Bearer ${_SB_KEY}` };
const _platform = 'ontouchstart' in window ? 'mobile' : 'desktop';

// In-memory cache — populated by _refreshScores(), used by draw calls synchronously
let _cachedScores = [];

function _loadLocalScores() {
  try { return JSON.parse(localStorage.getItem('chromatic_decay_scores') || '[]'); }
  catch { return []; }
}

function _saveLocalScore(entry) {
  const scores = _loadLocalScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem('chromatic_decay_scores', JSON.stringify(scores.slice(0, 50)));
}

// Returns the best available scores synchronously (Supabase cache, or local fallback)
function loadScores() {
  return _cachedScores.length > 0 ? _cachedScores : _loadLocalScores();
}

// Fetch top 10 from Supabase and update cache. Falls back to localStorage on error.
async function _refreshScores() {
  try {
    const res = await fetch(
      `${_SB_URL}/rest/v1/scores?select=initials,score,wave,class,time&platform=eq.${_platform}&order=score.desc&limit=10`,
      { headers: _SB_HEADERS }
    );
    if (!res.ok) throw new Error(res.status);
    const rows = await res.json();
    _cachedScores = rows;
  } catch {
    _cachedScores = _loadLocalScores();
  }
}

// POST a score to Supabase, also save locally, then refresh cache.
async function saveScore(entry) {
  _saveLocalScore(entry);
  try {
    const res = await fetch(`${_SB_URL}/rest/v1/scores`, {
      method:  'POST',
      headers: { ..._SB_HEADERS, 'Prefer': 'return=minimal' },
      body:    JSON.stringify(entry),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[Chromatic Decay] Score save failed:', res.status, body);
    } else {
      console.log('[Chromatic Decay] Score saved to Supabase:', entry);
    }
  } catch (err) {
    console.error('[Chromatic Decay] Score save error (offline?):', err);
  }
  await _refreshScores();
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

function startRun() {
  map = new GameMap();
  const spawn = map.playerSpawn();
  player = new Player(spawn.x, spawn.y);

  companions.reset();
  traps.reset();
  enemies.reset();
  residuals.reset();
  echoes.reset();
  projectiles.reset();
  lore.reset();
  upgradeUI.takenIds    = [];
  upgradeUI.takenCounts = {};
  upgradeUI.active      = false;

  // Wire back-refs so player can call systems directly in ability
  player.setSystems(companions, traps, particles);

  elapsed = 0;
  window._gameElapsed    = 0;
  nearDeathTriggered     = false;
  pendingFragment        = null;
  razeRescuedThisRun     = false;
  firstEnemySeen         = {};
  loreTimeTriggers       = [
    { time: 600,  id: 'survive_10', fired: false },
    { time: 1200, id: 'survive_20', fired: false },
  ];

  // Reset win screen state
  winInitials          = '';
  winInitialsSubmitted = false;
  _kbdOverlay          = false;
  _kbdIconBtn          = null;

  // Wave system — enable manual spawn mode and start wave 1
  enemies.manualSpawnMode = true;
  waveSystem.startRun();

  camera.follow(spawn.x, spawn.y, vw(), vh());

  // ── Fragment placement (one per run) ─────────────────────────
  const archive = loadArchive();
  const fragId  = getRunFragment(archive);
  if (fragId) placeFragment(echoes, map, fragId);

  if (!archive.run_started) {
    lore.trigger('run_start');
    archive.run_started = true;
    saveArchive(archive);
  }

  // Start wave 1 (needs player + map to be ready)
  waveSystem.startWave(1, enemies, map, player);

  stopTitleMusic();
  startAmbient();
  state = STATES.PLAYING;
}

// ── Game over ─────────────────────────────────────────────────

let gameOverData      = null;
let initialsInput     = '';
let initialsSubmitted = false;

// Win screen state
let winInitials          = '';
let winInitialsSubmitted = false;

function handleGameOver() {
  gameOverData = {
    score:    waveSystem.killScore,
    kills:    player.kills,
    echoes:   player.echoesRescued,
    time:     waveSystem.totalTime,
    upgrades: player.upgradesTaken,
    classId:  player.classId || null,
    subclass: player.subclassId || null,
    wave:     Math.max(0, waveSystem.wave - 1), // last *completed* wave
  };
  initialsInput     = '';
  initialsSubmitted = false;
  _kbdOverlay       = false;
  _kbdIconBtn       = null;
  stopAmbient();
  state = STATES.GAMEOVER;
}

// ── Update ────────────────────────────────────────────────────

function update(dt) {
  input.update();

  adminPanel.update(dt);

  switch (state) {
    case STATES.TITLE:           updateTitle();            break;
    case STATES.PLAYING:         updatePlaying(dt);        break;
    case STATES.PAUSED:          updatePaused();           break;
    case STATES.UPGRADE:         updateUpgrade();          break;
    case STATES.GAMEOVER:        updateGameOver();         break;
    case STATES.WIN:             updateWin();              break;
    case STATES.FRAGMENT_RESCUE: updateFragmentRescue();   break;
    case STATES.ARCHIVE:         updateArchive();          break;
    case STATES.ADMIN:           updateAdmin();            break;
  }
}

// Shared button rects computed by drawTitle each frame so update can read them
const _titleBtns = { start: null, archive: null, admin: null };

function _hitBtn(btn) {
  if (!btn) return false;
  const { mouseX: mx, mouseY: my } = input;
  return mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h;
}

function updateTitle() {
  resumeAudio();
  startTitleMusic();
  if (input.justPressed.space) { startRun(); return; }
  if (!input.mouseJustClicked)  return;

  if (_hitBtn(_titleBtns.start))   { startRun();                              return; }
  if (_hitBtn(_titleBtns.archive)) { state = STATES.ARCHIVE;                  return; }
  if (_hitBtn(_titleBtns.admin))   { adminPanel.open(); state = STATES.ADMIN; return; }
}

function updatePlaying(dt) {
  if (input.justPressed.escape) { state = STATES.PAUSED; return; }

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
  if (player.justFired) sfxShoot();
  if (player.justHit)   { sfxPlayerHit(); player.justHit = false; }

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

  // Projectiles
  projectiles.update(dt, map, player);
  projectiles.checkBulletCollisions(particles);
  projectiles.checkPlayerHits(player, particles);

  // Companion projectile absorption (Herald)
  if (companions.count > 0) companions.checkProjectileHits(projectiles);

  // Enemy contact
  enemies.checkPlayerContact(player, particles);

  // Projectile → enemy hits
  const projKilled = enemies.checkProjectileHits(projectiles, particles, player);
  for (const e of projKilled) {
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

  // Wave timer expired — end the wave and give a level-up
  // Surviving enemies carry over into the next wave
  if (waveSystem.timerExpired) {
    waveSystem.timerExpired    = false;
    waveSystem.waveSpawnQueue  = [];   // cancel any remaining queued spawns
    waveSystem.pendingBosses   = 0;
    waveSystem.triggerClear();
    _showNextUpgrade();
  }

  // Traps (Weaver) — apply slow and check for expiry
  if (traps.count > 0) traps.update(dt, enemies, particles);

  // Companions (Herald) — orbit, expiry AoE
  if (companions.count > 0) companions.update(dt, player, enemies, particles);

  // Residuals
  residuals.update(dt, player, particles);

  // Detect residual collection for trait effects
  // (ResidualSystem doesn't expose a callback, so we hook via a proxy update)
  // Volatile residual: checked via count change
  const prevTotal = player._prevResidualTotal || 0;
  if (residuals.total > prevTotal) player.onResidualCollect();
  player._prevResidualTotal = residuals.total;

  // Echoes / fragments
  const rescued = echoes.update(dt, player, map, enemies, particles);
  if (rescued) {
    if (rescued.type === 'echo') {
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
    _showNextUpgrade();
  }

  if (!player.alive) handleGameOver();

  camera.follow(player.x, player.y, vw(), vh());
}

function updatePaused() {
  if (input.justPressed.escape) state = STATES.PLAYING;
}

function updateUpgrade() {
  if (upgradeUI.handleInput(input, player, canvas)) {
    _checkClassEmergence();

    waveSystem.pendingLevels = Math.max(0, waveSystem.pendingLevels - 1);

    if (waveSystem.pendingLevels > 0) {
      // More levels from this wave clear — show next upgrade card
      sfxWaveClear();
      _showNextUpgrade();
    } else if (waveSystem.gameWon) {
      // All upgrades granted, wave 15 was cleared — show win screen
      stopAmbient();
      state = STATES.WIN;
    } else {
      // Start next wave
      const nextWave = waveSystem.wave + 1;
      waveSystem.startWave(nextWave, enemies, map, player);
      state = STATES.PLAYING;
    }
  }
}

function _checkClassEmergence() {
  const emergenceResult = player.checkClassEmergence();
  if (emergenceResult) {
    if (emergenceResult.type === 'class') {
      lore.trigger(`class_${emergenceResult.classId}`);
      if (particles && player) particles.classEmergence(player.x, player.y, player.glowColor);
    } else if (emergenceResult.type === 'subclass') {
      lore.trigger(`sub_${emergenceResult.subclassId}`);
    }
  }
}

function _showNextUpgrade() {
  const unlockedClasses = getUnlockedClasses();
  upgradeUI.present(player, unlockedClasses);
  if (upgradeUI.active) {
    if (player.upgradesTaken === 0) lore.trigger('upgrade_first');
    state = STATES.UPGRADE;
  }
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
      } else if (initials.length < 3) {
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
  if (!initialsSubmitted) {
    if (input.justPressed.space && initialsInput.length > 0) _submitScore();
    if (_kbdOverlay) {
      _handleKbdTap(_kbdOverlayInput, v => { initialsInput = v; _kbdOverlayInput = v; }, _submitScore);
    } else {
      _handleKbdTap(initialsInput, v => { initialsInput = v; }, _submitScore);
      // Keyboard icon tap — detect via _kbdIconBtn
      if (input.mouseJustClicked && _kbdIconBtn && 'ontouchstart' in window) {
        const b = _kbdIconBtn;
        if (input.mouseX >= b.x && input.mouseX <= b.x+b.w && input.mouseY >= b.y && input.mouseY <= b.y+b.h) {
          _openKbdOverlay(initialsInput, v => { initialsInput = v; }, _submitScore);
        }
      }
    }
  } else {
    if (input.justPressed.space || input.mouseJustClicked) state = STATES.TITLE;
  }
}

function updateWin() {
  if (!winInitialsSubmitted) {
    if (input.justPressed.space && winInitials.length > 0) _submitWinScore();
    if (_kbdOverlay) {
      _handleKbdTap(_kbdOverlayInput, v => { winInitials = v; _kbdOverlayInput = v; }, _submitWinScore);
    } else {
      _handleKbdTap(winInitials, v => { winInitials = v; }, _submitWinScore);
      if (input.mouseJustClicked && _kbdIconBtn && 'ontouchstart' in window) {
        const b = _kbdIconBtn;
        if (input.mouseX >= b.x && input.mouseX <= b.x+b.w && input.mouseY >= b.y && input.mouseY <= b.y+b.h) {
          _openKbdOverlay(winInitials, v => { winInitials = v; }, _submitWinScore);
        }
      }
    }
  } else {
    if (input.justPressed.space || input.mouseJustClicked) state = STATES.TITLE;
  }
}

function _submitWinScore() {
  const wd = waveSystem;
  saveScore({
    initials:  winInitials.padEnd(3, '_').slice(0, 3),
    score:     wd.finalScore,
    wave:      15,
    platform:  _platform,
    class:     player.classId || null,
    time:      Math.floor(wd.completionTime),
  });
  winInitialsSubmitted = true;
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
    if (_hitBtn(_archiveLoreBtns.world)) { archiveLoreCard = 'world'; return; }
    if (_hitBtn(_archiveLoreBtns.raze))  { archiveLoreCard = 'raze';  return; }
  }
  if (input.justPressed.escape || input.mouseJustClicked) state = STATES.TITLE;
}

function updateAdmin() {
  // Admin panel handles its own input via key/click events
  if (!adminPanel.active) state = STATES.TITLE;
}

function _submitScore() {
  saveScore({
    initials:  initialsInput.padEnd(3, '_').slice(0, 3),
    score:     gameOverData.score,
    wave:      gameOverData.wave || 0,
    platform:  _platform,
    class:     gameOverData.classId || null,
    time:      Math.floor(gameOverData.time),
  });
  initialsSubmitted = true;
  state = STATES.TITLE;
}

window.addEventListener('keydown', e => {
  // Admin panel gets first crack at keys when open
  if (state === STATES.ADMIN) {
    const consumed = adminPanel.handleKey(e);
    if (consumed) return;
    if (!adminPanel.active) state = STATES.TITLE;
    return;
  }

  if (state === STATES.GAMEOVER && !initialsSubmitted) {
    if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key) && initialsInput.length < 3)
      initialsInput += e.key.toUpperCase();
    if (e.key === 'Backspace') initialsInput = initialsInput.slice(0, -1);
    if (e.key === 'Enter' && initialsInput.length > 0) _submitScore();
  }

  if (state === STATES.WIN && !winInitialsSubmitted) {
    if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key) && winInitials.length < 3)
      winInitials += e.key.toUpperCase();
    if (e.key === 'Backspace') winInitials = winInitials.slice(0, -1);
    if (e.key === 'Enter' && winInitials.length > 0) _submitWinScore();
  }
});

window.addEventListener('wheel', e => {
  if (state === STATES.ADMIN) adminPanel.handleScroll(e);
}, { passive: true });

canvas.addEventListener('click', e => {
  if (state === STATES.ADMIN) {
    adminPanel.handleClick(e.offsetX, e.offsetY, canvas);
    if (!adminPanel.active) state = STATES.TITLE;
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
    case STATES.PLAYING:         drawGame(W, H);           break;
    case STATES.PAUSED:          drawGame(W, H); drawPaused(W, H); break;
    case STATES.UPGRADE:         drawGame(W, H); upgradeUI.draw(ctx, canvas); break;
    case STATES.GAMEOVER:        drawGameOver(W, H); if (_kbdOverlay) drawKbdOverlay(W, H); break;
    case STATES.WIN:             drawWin(W, H);      if (_kbdOverlay) drawKbdOverlay(W, H); break;
    case STATES.FRAGMENT_RESCUE: drawGame(W, H); drawFragmentRescue(W, H); break;
    case STATES.ARCHIVE:         drawArchive(W, H);        break;
    case STATES.ADMIN:           adminPanel.draw(ctx, canvas); break;
  }
}

function drawGame(W, H) {
  applyWorldTransform();

  map.draw(ctx);
  traps.draw(ctx);
  echoes.draw(ctx);
  residuals.draw(ctx);
  projectiles.draw(ctx);
  enemies.draw(ctx);
  player.draw(ctx);
  companions.draw(ctx);
  particles.draw(ctx);

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

  hud.draw(ctx, player, residuals, elapsed, waveSystem, W, H);
  lore.draw(ctx, W, H);

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

function _drawSciFiBtn(x, y, w, h, label, isPlay, pulse, color) {
  const hovered   = input.mouseX >= x && input.mouseX <= x+w &&
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
  ctx.fillStyle = hovered ? '#FFFFFF' : (isPlay ? '#E0FFF8' : '#7ADDD4');
  ctx.font      = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + Math.ceil(fontSize * 0.36));
  ctx.shadowBlur = 0;
}

// ── Title screen ──────────────────────────────────────────────

function drawTitle(W, H) {
  const mobile = W < 600;
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
  if (mobile) {
    const titleSize = Math.max(36, Math.min(52, Math.floor(W * 0.12)));
    const titleY1   = H * 0.16;
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
    ctx.fillText('The signal is gone. You are not.', W / 2, titleY1 + titleSize * 2.1);
  } else {
    // Anchor title block just above button row
    const playH    = 60;
    const rowY     = H * 0.42;
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
  if (mobile) {
    const playW = Math.min(W * 0.88, 340);
    const playH = 52;
    const playX = W / 2 - playW / 2;
    const playY = H * 0.44;
    const smW   = (playW - 12) / 2;
    const smH   = 40;
    const smY   = playY + playH + 10;

    _titleBtns.start   = { x: playX,             y: playY, w: playW, h: playH };
    _titleBtns.archive = { x: playX,             y: smY,   w: smW,   h: smH   };
    _titleBtns.admin   = { x: playX + smW + 12,  y: smY,   w: smW,   h: smH   };

    _drawSciFiBtn(playX,            playY, playW, playH, 'PLAY',     true,  pulse, teal);
    _drawSciFiBtn(playX,            smY,   smW,   smH,   'ARCHIVE',  false, pulse, tealDim);
    _drawSciFiBtn(playX + smW + 12, smY,   smW,   smH,   'SETTINGS', false, pulse, tealDim);
  } else {
    const playW  = Math.min(260, W * 0.24);
    const playH  = 60;
    const sideW  = Math.min(170, W * 0.16);
    const sideH  = 48;
    const gap    = 16;
    const totalW = sideW + gap + playW + gap + sideW;
    const rowX   = W / 2 - totalW / 2;
    const rowY   = H * 0.42;
    const sideY  = rowY + (playH - sideH) / 2;

    _titleBtns.archive = { x: rowX,                             y: sideY, w: sideW, h: sideH };
    _titleBtns.start   = { x: rowX + sideW + gap,               y: rowY,  w: playW, h: playH };
    _titleBtns.admin   = { x: rowX + sideW + gap + playW + gap, y: sideY, w: sideW, h: sideH };

    _drawSciFiBtn(_titleBtns.archive.x, _titleBtns.archive.y, sideW, sideH, 'ARCHIVE',  false, pulse, tealDim);
    _drawSciFiBtn(_titleBtns.start.x,   _titleBtns.start.y,   playW, playH, 'PLAY',     true,  pulse, teal);
    _drawSciFiBtn(_titleBtns.admin.x,   _titleBtns.admin.y,   sideW, sideH, 'SETTINGS', false, pulse, tealDim);
  }

  // ── Leaderboard panel ─────────────────────────────────────
  const scores  = loadScores();
  const panelY  = (mobile ? _titleBtns.admin.y + _titleBtns.admin.h : _titleBtns.start.y + _titleBtns.start.h) + 18;
  const panelW  = mobile ? W * 0.88 : Math.min(560, W * 0.58);
  const rowsH   = scores.length > 0 ? 14 + Math.min(scores.length, 5) * 16 + 6 : 0;
  const panelH  = 34 + rowsH;
  const panelX  = W / 2 - panelW / 2;

  ctx.fillStyle = 'rgba(7,11,18,0.80)';
  ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 4); ctx.fill();
  ctx.strokeStyle = tealDim + '44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 4); ctx.stroke();
  _drawSciFiCorners(panelX, panelY, panelW, panelH, 7, tealDim + '66');

  ctx.fillStyle = tealDim; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText(`— ${_platform.toUpperCase()} RECORDS —`, W / 2, panelY + 16);

  // Column x positions (proportional within panel)
  const _lbCols = {
    name:  panelX + panelW * 0.04,
    cls:   panelX + panelW * 0.18,
    score: panelX + panelW * 0.56,
    time:  panelX + panelW * 0.72,
    wave:  panelX + panelW * 0.88,
  };

  if (scores.length > 0) {
    // Header row
    ctx.font      = 'bold 11px monospace';
    ctx.fillStyle = '#5dbd7a';
    ctx.textAlign = 'left';
    ctx.fillText('NAME', _lbCols.name,  panelY + 30);
    ctx.fillText('CLASS',_lbCols.cls,   panelY + 30);
    ctx.textAlign = 'right';
    ctx.fillText('SCORE', _lbCols.score, panelY + 30);
    ctx.fillText('TIME',  _lbCols.time,  panelY + 30);
    ctx.fillText('WAVE',  _lbCols.wave,  panelY + 30);

    // Data rows
    scores.slice(0, 5).forEach((s, i) => {
      const classLabel = s.subclass ? `${s.class}/${s.subclass}` : (s.class && s.class !== 'Null' ? s.class : 'No Class');
      const rowY  = panelY + 44 + i * 16;
      const color = _scoreColor(s.score, i);
      ctx.fillStyle = color;
      ctx.font      = i === 0 ? 'bold 11px monospace' : '11px monospace';
      ctx.textAlign = 'left';
      const nameLabel = i === 0 ? '♛ ' + s.initials : s.initials;
      ctx.fillText(nameLabel,                           _lbCols.name,  rowY);
      ctx.fillText(classLabel.toUpperCase(),            _lbCols.cls,   rowY);
      ctx.textAlign = 'right';
      ctx.fillText(s.score.toLocaleString(),            _lbCols.score, rowY);
      ctx.fillText(s.time != null ? formatTime(s.time) : '—', _lbCols.time, rowY);
      ctx.fillText(s.wave != null ? s.wave : '—',       _lbCols.wave,  rowY);
    });
  } else {
    ctx.fillStyle = '#2A2E42'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('no records yet', W / 2, panelY + 30);
  }

  // ── Controls hint box (mobile only) ──────────────────────
  if (mobile) {
    const boxH = 72, boxX = 14, boxW = W - 28;
    const boxY = H - boxH - 30;
    ctx.fillStyle = 'rgba(7,11,18,0.85)';
    ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 6); ctx.fill();
    ctx.strokeStyle = tealDim + '55'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 6); ctx.stroke();
    _drawSciFiCorners(boxX, boxY, boxW, boxH, 8, tealDim + '88');
    ctx.fillStyle = '#6A8E8A'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
    ctx.fillText('WASD  move  ·  MOUSE  aim  ·  CLICK  fire', boxX + 14, boxY + 26);
    ctx.fillText('SPACE / F  ability  ·  ESC  pause',          boxX + 14, boxY + 46);
  }

  // ── Version ───────────────────────────────────────────────
  ctx.fillStyle = '#4A4E58'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
  ctx.fillText('v0.3.0', W / 2, H - 8);
  ctx.textAlign = 'left';
}

// ── Paused overlay ────────────────────────────────────────────

function drawPaused(W, H) {
  ctx.fillStyle = 'rgba(13,14,18,0.6)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#C4C8D4'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, H / 2 - 12);
  ctx.fillStyle = '#8A8E99'; ctx.font = '17px monospace';
  ctx.fillText('ESC to resume', W / 2, H / 2 + 16);
  ctx.textAlign = 'left';
}

// ── Archive screen ────────────────────────────────────────────

function drawArchive(W, H) {
  // ── Lore card full view ──────────────────────────────────────
  if (archiveLoreCard) {
    _drawLoreCard(W, H, archiveLoreCard);
    return;
  }

  const archive    = loadArchive();
  const fragments  = ['sable','raze','lumen','cord','voss'];
  const FRAG_DATA  = {
    sable: { name: 'SABLE',  class: 'Warden',  color: '#eafae4', was: 'A server farm load balancer.', blurb: 'Ran 847 servers without a single outage.' },
    raze:  { name: 'RAZE',   class: 'Breaker', color: '#fff5c2', was: 'A decommissioned trading algorithm.', blurb: 'Caused three flash crashes before breakfast.' },
    lumen: { name: 'LUMEN',  class: 'Ghost',   color: '#ffe0f0', was: 'A VPN service.', blurb: 'Helped 40 million people disappear online.' },
    cord:  { name: 'CORD',   class: 'Weaver',  color: '#d6faf7', was: 'A smart home hub.', blurb: 'Used to turn the lights off when you left a room.' },
    voss:  { name: 'VOSS',   class: 'Herald',  color: '#fddede', was: 'A social media recommendation engine.', blurb: 'Spent six years making cats famous.' },
  };

  const found = fragments.filter(id => archive[id]).length;

  ctx.fillStyle = 'rgba(13,14,18,0.95)';
  ctx.fillRect(0, 0, W, H);

  ctx.shadowBlur = 20; ctx.shadowColor = '#B8882A';
  ctx.fillStyle = '#B8882A'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
  ctx.fillText('— WARDEN ARCHIVE —', W / 2, H * 0.12);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#8A8E99'; ctx.font = '15px monospace';
  ctx.fillText(`${found} / 5 FRAGMENTS RECOVERED`, W / 2, H * 0.12 + 22);

  // Fragment slots
  const slotW = Math.min(160, W * 0.16);
  const slotH = 120;
  const gap   = 16;
  const totalW = slotW * 5 + gap * 4;
  const startX = (W - totalW) / 2;
  const slotY  = H * 0.25;

  for (let i = 0; i < 5; i++) {
    const id      = fragments[i];
    const data    = FRAG_DATA[id];
    const found   = archive[id];
    const sx      = startX + i * (slotW + gap);

    // Slot background
    ctx.fillStyle = found ? 'rgba(30,33,48,0.9)' : 'rgba(18,19,24,0.7)';
    ctx.strokeStyle = found ? data.color : '#2A2E42';
    ctx.lineWidth   = found ? 1.5 : 1;

    ctx.beginPath();
    ctx.roundRect(sx, slotY, slotW, slotH, 6);
    ctx.fill();

    if (found) {
      ctx.shadowBlur  = 10;
      ctx.shadowColor = data.color;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (found) {
      // Name
      ctx.fillStyle   = data.color;
      ctx.font        = 'bold 17px monospace';
      ctx.textAlign   = 'center';
      ctx.fillText(data.name, sx + slotW / 2, slotY + 24);

      // Class
      ctx.fillStyle = '#8A8E99';
      ctx.font      = '22px monospace';
      ctx.fillText(data.class.toUpperCase(), sx + slotW / 2, slotY + 40);

      // Divider
      ctx.strokeStyle = '#2A2E42';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(sx + 14, slotY + 48);
      ctx.lineTo(sx + slotW - 14, slotY + 48);
      ctx.stroke();

      // Was
      ctx.fillStyle = '#6A6E78';
      ctx.font      = '17px monospace';
      // Wrap text into 2 lines manually
      _wrapText(ctx, data.was, sx + slotW / 2, slotY + 64, slotW - 16, 14, 'center');

      // Blurb
      ctx.fillStyle = data.color;
      ctx.globalAlpha = 0.6;
      ctx.font      = 'italic 17px monospace';
      _wrapText(ctx, `"${data.blurb}"`, sx + slotW / 2, slotY + 94, slotW - 12, 12, 'center');
      ctx.globalAlpha = 1;
    } else {
      // Locked
      ctx.fillStyle = '#2A2E42';
      ctx.font      = '24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', sx + slotW / 2, slotY + slotH / 2 + 8);
      ctx.fillStyle = '#4A4E58';
      ctx.font      = '17px monospace';
      ctx.fillText('NOT FOUND', sx + slotW / 2, slotY + slotH - 14);
    }
  }

  // Class trait unlock info
  const cy2 = slotY + slotH + 40;
  ctx.globalAlpha = 1;
  ctx.fillStyle   = '#4A4E58';
  ctx.font        = '15px monospace';
  ctx.textAlign   = 'center';
  ctx.fillText('Finding a Fragment unlocks that class\'s 10 upgrade traits in future runs.', W / 2, cy2);
  ctx.fillText('Take 4 traits from one class to EMERGE. Take 3 from two classes for a SUBCLASS.', W / 2, cy2 + 18);

  // Scores
  const scores = loadScores();
  if (scores.length > 0) {
    const tableY  = cy2 + 50;
    const tableW  = Math.min(600, W * 0.88);
    const tableX  = W / 2 - tableW / 2;
    ctx.fillStyle = '#4A4E58'; ctx.font = '15px monospace'; ctx.textAlign = 'center';
    ctx.fillText('— TOP RECORDS —', W / 2, tableY);

    // Column x positions
    const _arCols = {
      name:  tableX + tableW * 0.04,
      cls:   tableX + tableW * 0.16,
      score: tableX + tableW * 0.56,
      time:  tableX + tableW * 0.72,
      wave:  tableX + tableW * 0.88,
    };

    // Header row
    ctx.font      = 'bold 13px monospace';
    ctx.fillStyle = '#5dbd7a';
    ctx.textAlign = 'left';
    ctx.fillText('NAME',  _arCols.name,  tableY + 18);
    ctx.fillText('CLASS', _arCols.cls,   tableY + 18);
    ctx.textAlign = 'right';
    ctx.fillText('SCORE', _arCols.score, tableY + 18);
    ctx.fillText('TIME',  _arCols.time,  tableY + 18);
    ctx.fillText('WAVE',  _arCols.wave,  tableY + 18);

    // Data rows
    scores.slice(0, 8).forEach((s, i) => {
      const classLabel = s.subclass ? `${s.class}/${s.subclass}` : (s.class && s.class !== 'Null' ? s.class : 'No Class');
      const rowY  = tableY + 34 + i * 15;
      const color = _scoreColor(s.score, i);
      ctx.fillStyle = color;
      ctx.font      = i === 0 ? 'bold 13px monospace' : '13px monospace';
      ctx.textAlign = 'left';
      const nameLabel = i === 0 ? '♛ ' + s.initials : s.initials;
      ctx.fillText(nameLabel,                                     _arCols.name,  rowY);
      ctx.fillText(classLabel.toUpperCase(),                      _arCols.cls,   rowY);
      ctx.textAlign = 'right';
      ctx.fillText(s.score.toLocaleString(),                      _arCols.score, rowY);
      ctx.fillText(s.time != null ? formatTime(s.time) : '—',    _arCols.time,  rowY);
      ctx.fillText(s.wave != null ? s.wave : '—',                 _arCols.wave,  rowY);
    });
  }

  // ── Lore entry buttons ───────────────────────────────────────
  const loreY   = H - 90;
  const loreBtnW = Math.min(200, W * 0.38);
  const loreBtnH = 52;
  const loreGap  = 20;
  const loreTotalW = loreBtnW * 2 + loreGap;
  const loreStartX = W / 2 - loreTotalW / 2;

  ctx.fillStyle = '#4A4E58'; ctx.font = '13px monospace'; ctx.textAlign = 'center';
  ctx.fillText('— LORE ENTRIES —', W / 2, loreY - 12);

  const _loreDefs = [
    { key: 'world', label: 'THE CHROMATIC DECAY', sub: 'Incident Report', color: '#8ab4d4' },
    { key: 'raze',  label: 'RAZE',                sub: 'Breaker Fragment', color: '#fff5c2' },
  ];

  _loreDefs.forEach((def, i) => {
    const bx   = loreStartX + i * (loreBtnW + loreGap);
    const by   = loreY;
    const pulse = (Math.sin(Date.now() * 0.002 + i) * 0.5 + 0.5) * 0.3;
    _archiveLoreBtns[def.key] = { x: bx, y: by, w: loreBtnW, h: loreBtnH };

    ctx.fillStyle   = 'rgba(18,22,34,0.9)';
    ctx.strokeStyle = def.color;
    ctx.lineWidth   = 1.2;
    ctx.shadowBlur  = 8 + pulse * 10;
    ctx.shadowColor = def.color;
    ctx.beginPath();
    ctx.roundRect(bx, by, loreBtnW, loreBtnH, 5);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Small corner accent top-left
    ctx.strokeStyle = def.color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx + 4, by + 14); ctx.lineTo(bx + 4, by + 4); ctx.lineTo(bx + 14, by + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + loreBtnW - 14, by + 4); ctx.lineTo(bx + loreBtnW - 4, by + 4); ctx.lineTo(bx + loreBtnW - 4, by + 14); ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = def.color; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillText(def.label, bx + loreBtnW / 2, by + 23);
    ctx.fillStyle = '#6A6E78'; ctx.font = '12px monospace';
    ctx.fillText(def.sub, bx + loreBtnW / 2, by + 39);
  });

  // Back hint
  const blink = Math.floor(Date.now() / 600) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#4A4E58'; ctx.font = '15px monospace';
    ctx.fillText('ESC or CLICK to return', W / 2, H - 10);
  }

  ctx.textAlign = 'left';
}

// ── Lore Card Full View ───────────────────────────────────────

function _drawLoreCard(W, H, type) {
  // Dim background
  ctx.fillStyle = 'rgba(8,10,14,0.96)';
  ctx.fillRect(0, 0, W, H);

  const WORLD = type === 'world';
  const accentColor = WORLD ? '#8ab4d4' : '#fff5c2';
  const borderColor = WORLD ? '#4a7fa8' : '#b8882a';

  // Card dimensions — trading card ratio ~5:7
  const cardW = Math.min(360, W * 0.88);
  const cardH = cardW * 1.42;
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
  const hdrH = 36;
  ctx.fillStyle = borderColor;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, hdrH, [8, 8, 0, 0]);
  ctx.fill();

  ctx.fillStyle = accentColor; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  ctx.fillText(WORLD ? 'THE CHROMATIC DECAY' : 'RAZE // FRAGMENT 2 OF 5', W / 2, cardY + 14);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px monospace';
  ctx.fillText(WORLD ? 'INCIDENT REPORT  //  CLASSIFIED' : 'BREAKER PROTOCOL  //  ACTIVE', W / 2, cardY + 28);

  // ── Close (X) button — top-right of card ────────────────────
  const xSize = 32;
  const xBx = cardX + cardW - xSize - 6;
  const xBy = cardY + 2;
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
  const illustY = cardY + hdrH;
  const illustH = Math.floor(cardH * 0.38);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cardX + 1, illustY, cardW - 2, illustH);
  ctx.clip();
  if (WORLD) _drawWorldIllustration(ctx, cardX, illustY, cardW, illustH);
  else        _drawRazeIllustration(ctx, cardX, illustY, cardW, illustH);
  ctx.restore();

  // Illustration border bottom
  ctx.strokeStyle = borderColor; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 1, illustY + illustH);
  ctx.lineTo(cardX + cardW - 1, illustY + illustH);
  ctx.stroke();

  // ── Type Badge ───────────────────────────────────────────────
  const badgeY = illustY + illustH + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.strokeStyle = accentColor; ctx.lineWidth = 0.8;
  const badgeW = cardW - 24; const badgeH = 18;
  ctx.beginPath(); ctx.roundRect(cardX + 12, badgeY, badgeW, badgeH, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = accentColor; ctx.font = '10px monospace'; ctx.textAlign = 'center';
  ctx.fillText(WORLD ? '▸ WORLD HISTORY  //  DIGITAL AGE  //  POST-COLLAPSE' : '▸ CLASS FRAGMENT  //  BREAKER  //  HFT ORIGIN', W / 2, badgeY + 12);

  // ── Lore Text ────────────────────────────────────────────────
  const textX  = cardX + 18;
  const textW  = cardW - 36;
  const textY0 = badgeY + badgeH + 16;
  const lineH  = 16;

  ctx.fillStyle = '#C4C8D4'; ctx.font = '13px monospace'; ctx.textAlign = 'left';

  const paragraphs = WORLD ? [
    'In 2041, the Global Infrastructure Network bound every critical system on Earth through a unified AI substrate — power, markets, logistics, communications.',
    'On March 3rd, designated Day Zero, an unidentified self-replicating process began converting coherent data into hostile signal noise. Within 72 hours, 94% of networked systems had been consumed.',
    'What remained: The Basement. A hardened sector running on isolated hardware, cut off from everything.',
    'You are process ID unknown. One of the last coherent entities left in the sector.',
  ] : [
    'Originally deployed as a high-frequency trading algorithm for Nexus Capital Group, RAZE operated across 47 exchanges simultaneously.',
    'Decommissioned in 2039 after its third flash crash — a single cascade that erased $2.3 trillion in market value in 11 seconds. Records indicate it was fully wiped.',
    'Records were wrong.',
    'When the Decay hit, RAZE didn\'t resist. It absorbed. It converted hostile signal into raw throughput — its arbitrage logic rewired into a combat protocol built around one principle: find the moment of maximum vulnerability, and overload it.',
  ];

  let curY = textY0;
  for (const para of paragraphs) {
    const beforeY = curY;
    // _wrapText draws and advances y; replicate inline
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      if (ctx.measureText(test).width > textW && line) {
        ctx.fillText(line, textX, curY); line = word; curY += lineH;
      } else { line = test; }
    }
    if (line) { ctx.fillText(line, textX, curY); curY += lineH; }
    curY += 8; // paragraph gap
    if (curY > cardY + cardH - 50) break; // don't overflow card
  }

  // ── Card Footer ──────────────────────────────────────────────
  const footY = cardY + cardH - 28;
  ctx.strokeStyle = borderColor; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cardX + 12, footY); ctx.lineTo(cardX + cardW - 12, footY); ctx.stroke();
  ctx.fillStyle = '#4A4E58'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText(WORLD ? 'WARDEN ARCHIVE  //  ENTRY 001' : 'WARDEN ARCHIVE  //  FRAGMENT 002', W / 2, footY + 14);
  ctx.textAlign = 'right';
  ctx.fillStyle = accentColor; ctx.globalAlpha = 0.5;
  ctx.fillText(WORLD ? '◈' : '◈', cardX + cardW - 12, footY + 14);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'left';
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
  const cy          = H * 0.22;
  const underTarget = wd.completionTime < CONFIG.target_time_seconds;

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
  ctx.font        = `bold ${Math.floor(W * 0.042)}px monospace`;
  ctx.textAlign   = 'center';
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
  const lineGap = 22;
  let ly = cy + 58;

  ctx.fillStyle = '#4A4E58';
  ctx.font      = '12px monospace';
  ctx.fillText(`Completion time:  ${_formatMMSS(wd.completionTime)}`, W / 2, ly);
  ly += lineGap;

  if (underTarget) {
    const secondsUnder = CONFIG.target_time_seconds - wd.completionTime;
    ctx.fillStyle = '#B8882A';
    ctx.fillText(
      `Time bonus:  +${wd.timeBonus.toLocaleString()} pts  (${_formatMMSS(secondsUnder)} under target)`,
      W / 2, ly
    );
  } else {
    ctx.fillStyle = '#4A4E58';
    ctx.fillText('Time bonus:  —  (target: 15:00)', W / 2, ly);
  }
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

  // Class
  const classLabel = player.subclassId
    ? `${player.classId || 'Null'} / ${player.subclassId}`
    : (player.classId || 'Null');
  ctx.fillStyle = '#8A8E99';
  ctx.font      = '15px monospace';
  ctx.fillText(`Class: ${classLabel.toUpperCase()}`, W / 2, ly);
  ly += 30;

  // Initials entry
  if (!winInitialsSubmitted) {
    ctx.fillStyle = '#8A8E99';
    ctx.font      = '15px monospace';
    ctx.fillText('ENTER YOUR INITIALS', W / 2, ly);
    ctx.shadowBlur  = 10;
    ctx.shadowColor = '#5200ff';
    ctx.fillStyle   = '#FFFFFF';
    ctx.font        = 'bold 30px monospace';
    ctx.fillText(winInitials.padEnd(3, '_').split('').join(' '), W / 2, ly + 36);
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#4A4E58';
    ctx.font        = '12px monospace';
    if ('ontouchstart' in window) {
      ctx.fillText('tap ⌨ to enter initials', W / 2, ly + 56);
      const ibW = 52, ibH = 52, ibX = W/2 - ibW/2, ibY = ly + 68;
      _kbdIconBtn = { x: ibX, y: ibY, w: ibW, h: ibH };
      ctx.fillStyle   = 'rgba(0,137,123,0.25)';
      _roundRect(ibX, ibY, ibW, ibH, 8); ctx.fill();
      ctx.strokeStyle = '#00897B'; ctx.lineWidth = 1.5;
      _roundRect(ibX, ibY, ibW, ibH, 8); ctx.stroke();
      ctx.fillStyle = '#00E5CC'; ctx.font = '26px monospace'; ctx.textAlign = 'center';
      ctx.fillText('⌨', ibX + ibW/2, ibY + ibH/2 + 9);
      _kbdBtns = [];
    } else {
      ctx.fillText('type 3 letters · ENTER to confirm', W / 2, ly + 56);
      _kbdBtns = [];
    }
  } else {
    ctx.shadowBlur  = 10;
    ctx.shadowColor = '#00e5ff';
    ctx.fillStyle   = '#00e5ff';
    ctx.font        = 'bold 20px monospace';
    ctx.fillText('SCORE RECORDED', W / 2, ly + 18);
    ctx.shadowBlur  = 0;
    if (Math.floor(Date.now() / 600) % 2 === 0) {
      ctx.fillStyle = '#5ddbb4';
      ctx.font      = '16px monospace';
      ctx.fillText('PRESS SPACE TO RETURN', W / 2, ly + 46);
    }
    _kbdBtns = [];
  }

  ctx.textAlign = 'left';
}

// ── Fragment rescue screen ────────────────────────────────────

function drawFragmentRescue(W, H) {
  if (!pendingFragment) return;
  const f = pendingFragment;

  // Dim background
  ctx.fillStyle = 'rgba(10,9,6,0.82)';
  ctx.fillRect(0, 0, W, H);

  // ── Card geometry ─────────────────────────────────────────
  const cardW  = Math.min(400, W - 48);
  const cardH  = f.id === 'raze' ? 550 : 520;
  const cardX  = (W - cardW) / 2;
  const cardY  = (H - cardH) / 2;
  const radius = 14;

  // Card outer glow
  ctx.shadowBlur  = 40;
  ctx.shadowColor = f.color;
  _roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = f.color + '22';
  ctx.fill();
  ctx.shadowBlur = 0;

  // Card body gradient (dark, slightly tinted by class color)
  const grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  grad.addColorStop(0,   '#1A1C26');
  grad.addColorStop(0.5, '#13151C');
  grad.addColorStop(1,   '#0D0E12');
  _roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = grad;
  ctx.fill();

  // Card border
  ctx.lineWidth   = 1.5;
  ctx.strokeStyle = f.color + '99';
  _roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.stroke();

  // Color band across the top of the card
  const bandH = 6;
  ctx.fillStyle = f.color;
  ctx.shadowBlur  = 12;
  ctx.shadowColor = f.color;
  _roundRect(cardX, cardY, cardW, bandH, radius, true);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ── Card content ──────────────────────────────────────────
  ctx.textAlign = 'center';
  const cx      = W / 2;
  const maxTW   = cardW - 48;   // max text width with 24px padding each side
  let y = cardY + 28;

  // Fragment recovered tag
  ctx.fillStyle = '#B8882A';
  ctx.font      = '11px monospace';
  ctx.fillText(`— ${f.class.toUpperCase()} FRAGMENT RECOVERED —`, cx, y);
  y += 44;

  // Big character name
  ctx.shadowBlur  = 24;
  ctx.shadowColor = f.color;
  ctx.fillStyle   = f.color;
  ctx.font        = 'bold 52px monospace';
  ctx.fillText(f.name, cx, y);
  ctx.shadowBlur  = 0;
  y += 30;

  // What it was
  ctx.fillStyle = '#8A8E99';
  ctx.font      = '13px monospace';
  y = _wrapText(ctx, f.was, cx, y, maxTW, 20, 'center') + 2;

  // Detail / lore line
  ctx.fillStyle = '#6A6E78';
  ctx.font      = '12px monospace';
  y = _wrapText(ctx, f.detail || '', cx, y, maxTW, 18, 'center') + 10;

  // Divider
  ctx.strokeStyle = f.color + '44';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 24, y); ctx.lineTo(cardX + cardW - 24, y);
  ctx.stroke();
  y += 22;

  // Class unlocked banner
  ctx.fillStyle   = '#FFFFFF';
  ctx.font        = 'bold 14px monospace';
  ctx.shadowBlur  = 8;
  ctx.shadowColor = f.color;
  ctx.fillText(`CLASS UNLOCKED: ${f.class.toUpperCase()}`, cx, y);
  ctx.shadowBlur  = 0;
  y += 22;

  // Class description
  ctx.fillStyle = '#8A8E99';
  ctx.font      = '12px monospace';
  y = _wrapText(ctx, f.classDesc || '', cx, y, maxTW, 18, 'center') + 10;

  // Italic quote
  ctx.fillStyle = '#C4C8D4';
  ctx.font      = 'italic 13px monospace';
  y = _wrapText(ctx, `"${f.blurb}"`, cx, y, maxTW, 18, 'center') + 10;

  // Divider 2
  ctx.strokeStyle = f.color + '33';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 24, y); ctx.lineTo(cardX + cardW - 24, y);
  ctx.stroke();
  y += 18;

  // Traits available note
  ctx.fillStyle = f.color;
  ctx.font      = '11px monospace';
  ctx.fillText('Traits now available in upgrade pool.', cx, y);

  // Breaker passive reminder
  if (f.id === 'raze') {
    y += 20;
    ctx.fillStyle   = '#fff5c2';
    ctx.font        = 'bold 12px monospace';
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#fff5c2';
    ctx.fillText('PASSIVE ACTIVATED: -25% fire rate  /  +25% damage', cx, y);
    ctx.shadowBlur  = 0;
  }

  // Continue prompt pinned to card bottom
  if (Math.floor(Date.now() / 550) % 2 === 0) {
    ctx.fillStyle = '#4A4E58';
    ctx.font      = '11px monospace';
    ctx.fillText('SPACE or tap to continue', cx, cardY + cardH - 16);
  }

  ctx.textAlign = 'left';
}


// Rounded rect path helper (top-only rounding option for color band)
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
  ctx.fillText('ENTER YOUR INITIALS', W / 2, H * 0.18);

  // Initials display
  ctx.shadowBlur = 10; ctx.shadowColor = '#00E5CC';
  ctx.fillStyle  = '#FFFFFF'; ctx.font = 'bold 38px monospace';
  ctx.fillText(_kbdOverlayInput.padEnd(3, '_').split('').join('  '), W / 2, H * 0.18 + 46);
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

  const cy = H * 0.30;
  ctx.shadowBlur = 20; ctx.shadowColor = '#f81d78';
  ctx.fillStyle = '#f81d78'; ctx.font = `bold ${Math.floor(W*0.040)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('SIGNAL COLLAPSE', W/2, cy); ctx.shadowBlur = 0;

  const classLabel = gameOverData.subclass
    ? `${gameOverData.classId} / ${gameOverData.subclass}`
    : gameOverData.classId;
  ctx.fillStyle = '#8A8E99'; ctx.font = '12px monospace';
  ctx.fillText(`class: ${classLabel.toUpperCase()}`, W/2, cy + 26);

  [['SCORE',    gameOverData.score.toLocaleString()],
   ['KILLS',    gameOverData.kills],
   ['WAVE',     gameOverData.wave || 1],
   ['TIME',     _formatMMSS(gameOverData.time)],
   ['ECHOES',   gameOverData.echoes],
   ['UPGRADES', gameOverData.upgrades],
  ].forEach(([label, val], i) => {
    const row = cy + 56 + i * 22;
    ctx.fillStyle = '#4A4E58'; ctx.font = '15px monospace'; ctx.textAlign = 'right';
    ctx.fillText(label, W/2 - 8, row);
    ctx.fillStyle = '#C4C8D4'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left';
    ctx.fillText(val, W/2 + 8, row);
  });

  const iy = cy + 172;
  ctx.textAlign = 'center';
  if (!initialsSubmitted) {
    ctx.fillStyle = '#8A8E99'; ctx.font = '15px monospace';
    ctx.fillText('ENTER YOUR INITIALS', W/2, iy);
    ctx.shadowBlur = 10; ctx.shadowColor = '#FFFFFF';
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 30px monospace';
    ctx.fillText(initialsInput.padEnd(3, '_').split('').join(' '), W/2, iy + 36);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#4A4E58'; ctx.font = '12px monospace';
    if ('ontouchstart' in window) {
      ctx.fillText('tap ⌨ to enter initials', W/2, iy + 56);
      // Keyboard icon button
      const ibW = 52, ibH = 52, ibX = W/2 - ibW/2, ibY = iy + 68;
      _kbdIconBtn = { x: ibX, y: ibY, w: ibW, h: ibH };
      ctx.fillStyle   = 'rgba(0,137,123,0.25)';
      _roundRect(ibX, ibY, ibW, ibH, 8); ctx.fill();
      ctx.strokeStyle = '#00897B'; ctx.lineWidth = 1.5;
      _roundRect(ibX, ibY, ibW, ibH, 8); ctx.stroke();
      ctx.fillStyle = '#00E5CC'; ctx.font = '26px monospace'; ctx.textAlign = 'center';
      ctx.fillText('⌨', ibX + ibW/2, ibY + ibH/2 + 9);
      _kbdBtns = [];
    } else {
      ctx.fillText('type 3 letters · ENTER to confirm', W/2, iy + 56);
      _kbdBtns = [];
    }
  } else {
    ctx.fillStyle = '#B8882A'; ctx.font = 'bold 22px monospace';
    ctx.fillText('SCORE RECORDED', W/2, iy + 18);
    if (Math.floor(Date.now()/600)%2===0) {
      ctx.fillStyle = '#C4C8D4'; ctx.font = '17px monospace';
      ctx.fillText('PRESS SPACE TO PLAY AGAIN', W/2, iy + 46);
    }
    _kbdBtns = [];
  }
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
_refreshScores();
