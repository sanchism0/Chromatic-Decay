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
import { WaveSystem } from './waves.js';
import { clamp, formatTime, dist } from './utils.js';
import { AdminPanel } from './admin.js';

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
  else if (minDim < 400) z = 0.95;
  else if (minDim < 600) z = 1.2;
  else if (minDim < 900) z = 1.5;
  else                   z = CONFIG.camera_zoom;

  // On mobile: also cap zoom so at least 380px of world width is always visible.
  // Prevents portrait phones from seeing an overly narrow slice of the map.
  if (mobile) z = Math.min(z, W / 380);

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

// ── Archive ───────────────────────────────────────────────────

function loadArchive() {
  try { return JSON.parse(localStorage.getItem('chromatic_decay_archive') || '{}'); }
  catch { return {}; }
}
function saveArchive(a) {
  localStorage.setItem('chromatic_decay_archive', JSON.stringify(a));
}
function loadScores() {
  try { return JSON.parse(localStorage.getItem('chromatic_decay_scores') || '[]'); }
  catch { return []; }
}
function saveScore(entry) {
  const scores = loadScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem('chromatic_decay_scores', JSON.stringify(scores.slice(0, 50)));
}

function getUnlockedClasses() {
  const archive = loadArchive();
  // Map fragment ids to their class names
  const classMap = { sable: 'warden', raze: 'breaker', lumen: 'ghost', cord: 'weaver', voss: 'herald' };
  return Object.entries(classMap)
    .filter(([fragId]) => archive[fragId])
    .map(([, cls]) => cls);
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
  firstEnemySeen         = {};
  loreTimeTriggers       = [
    { time: 600,  id: 'survive_10', fired: false },
    { time: 1200, id: 'survive_20', fired: false },
  ];

  // Reset win screen state
  winInitials          = '';
  winInitialsSubmitted = false;

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
    classId:  player.classId || 'Null',
    subclass: player.subclassId || null,
    wave:     waveSystem.wave,
  };
  initialsInput     = '';
  initialsSubmitted = false;
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
        lore.trigger(frag.loreId);
        const archive = loadArchive();
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
      _showNextUpgrade();
    } else if (waveSystem.gameWon) {
      // All upgrades granted, wave 15 was cleared — show win screen
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

function _handleKbdTap(initials, setFn, submitFn) {
  if (!input.mouseJustClicked) return;
  const mx = input.mouseX, my = input.mouseY;
  for (const btn of _kbdBtns) {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      if (btn.key === 'DEL') {
        setFn(initials.slice(0, -1));
      } else if (btn.key === 'OK') {
        if (initials.length > 0) submitFn();
      } else if (initials.length < 3) {
        setFn(initials + btn.key);
      }
      return;
    }
  }
}

function updateGameOver() {
  if (!initialsSubmitted) {
    if (input.justPressed.space && initialsInput.length > 0) _submitScore();
    _handleKbdTap(initialsInput, v => { initialsInput = v; }, _submitScore);
  } else {
    if (input.justPressed.space || input.mouseJustClicked) state = STATES.TITLE;
  }
}

function updateWin() {
  if (!winInitialsSubmitted) {
    if (input.justPressed.space && winInitials.length > 0) _submitWinScore();
    _handleKbdTap(winInitials, v => { winInitials = v; }, _submitWinScore);
  } else {
    if (input.justPressed.space || input.mouseJustClicked) state = STATES.TITLE;
  }
}

function _submitWinScore() {
  const wd = waveSystem;
  saveScore({
    initials:       winInitials.padEnd(3, '_').slice(0, 3),
    score:          wd.finalScore,
    kill_score:     wd.killScore,
    time_bonus:     wd.timeBonus,
    class:          player.classId || 'Null',
    subclass:       player.subclassId || null,
    time:           Math.floor(wd.completionTime),
    kills:          player.kills,
    echoes:         player.echoesRescued,
    waves_cleared:  15,
    under_target:   wd.completionTime < CONFIG.target_time_seconds,
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
  if (input.justPressed.escape || input.mouseJustClicked) state = STATES.TITLE;
}

function updateAdmin() {
  // Admin panel handles its own input via key/click events
  if (!adminPanel.active) state = STATES.TITLE;
}

function _submitScore() {
  saveScore({
    initials: initialsInput.padEnd(3, '_').slice(0, 3),
    score:    gameOverData.score,
    class:    gameOverData.classId,
    subclass: gameOverData.subclass,
    time:     Math.floor(gameOverData.time),
    kills:    gameOverData.kills,
    echoes:   gameOverData.echoes,
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
    case STATES.GAMEOVER:        drawGameOver(W, H);       break;
    case STATES.WIN:             drawWin(W, H);            break;
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

  // Right joystick (aim)
  const rj = input.rightJoystick;
  const rBaseX = rj ? rj.baseX : W * 0.82;
  const rBaseY = rj ? rj.baseY : H - pad - r - 80;
  drawJoystick(rBaseX, rBaseY, rj ? rj.curX : rBaseX, rj ? rj.curY : rBaseY, !!rj);

  // Ability button (fixed bottom-right)
  const abX    = input.abilityBtnX;
  const abY    = input.abilityBtnY;
  const abR    = 44;
  const abReady = player.abilityCooldown <= 0 && !!player.classId;

  ctx.beginPath();
  ctx.arc(abX, abY, abR, 0, Math.PI * 2);
  ctx.fillStyle = abReady ? 'rgba(255,245,194,0.18)' : 'rgba(74,78,88,0.25)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(abX, abY, abR, 0, Math.PI * 2);
  ctx.strokeStyle = abReady ? 'rgba(255,245,194,0.70)' : 'rgba(74,78,88,0.55)';
  ctx.lineWidth   = 2;
  if (abReady) { ctx.shadowBlur = 10; ctx.shadowColor = '#fff5c2'; }
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = abReady ? '#fff5c2' : '#4A4E58';
  ctx.font      = '18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ABILITY', abX, abY + 6);
  ctx.textAlign = 'left';
}

// ── Title ─────────────────────────────────────────────────────

// Enemy colors, vivid versions for title particles
const _ENEMY_COLORS = ['#7B3FFF', '#FFEE22', '#55FF11', '#FF5500', '#FF0066'];

let _titleParts = [];

function drawTitle(W, H) {
  // ── Background particles ──────────────────────────────────
  if (Math.random() < 0.10) {
    const col = _ENEMY_COLORS[Math.floor(Math.random() * _ENEMY_COLORS.length)];
    _titleParts.push({
      x:       Math.random() * W,
      y:       H + 10,
      vy:      -(40 + Math.random() * 90),
      vx:      (Math.random() - 0.5) * 18,
      color:   col,
      size:    3 + Math.random() * 6,
      life:    4 + Math.random() * 4,
      maxLife: 8,
    });
  }
  _titleParts = _titleParts.filter(p => {
    p.x   += p.vx * (1/60);
    p.y   += p.vy * (1/60);
    p.life -= 1/60;
    const a = Math.min(0.7, (p.life / p.maxLife) * 1.4);
    ctx.globalAlpha = a;
    ctx.shadowBlur  = 10;
    ctx.shadowColor = p.color;
    ctx.fillStyle   = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    return p.life > 0;
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;

  // ── Title ─────────────────────────────────────────────────
  const cy = H * 0.32;

  // Title — min 48px, glow purple per UI spec
  const titleSize = Math.max(48, Math.min(64, Math.floor(W * 0.052)));
  ctx.shadowBlur  = 24;
  ctx.shadowColor = '#5200ff';
  ctx.fillStyle   = '#FFFFFF';
  ctx.font        = `bold ${titleSize}px monospace`;
  ctx.textAlign   = 'center';
  ctx.fillText('CHROMATIC DECAY', W / 2, cy);
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.fillStyle = '#C4C8D4'; ctx.font = '22px monospace';
  ctx.fillText('The signal is gone. You are not.', W / 2, cy + titleSize * 0.6 + 8);

  // ── START button ──────────────────────────────────────────
  const btnW  = Math.min(400, W * 0.90);
  const btnH  = 56;
  const btnX  = W / 2 - btnW / 2;
  const btnY  = cy + titleSize * 0.6 + 36;
  _titleBtns.start = { x: btnX, y: btnY, w: btnW, h: btnH };

  const pulse = Math.sin(Date.now() * 0.003) * 0.5 + 0.5;

  // Button fill
  ctx.fillStyle = '#1E2130';
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 4);
  ctx.fill();

  // Button border — pulses subtly
  ctx.shadowBlur  = 12 + pulse * 10;
  ctx.shadowColor = '#5200ff';
  ctx.strokeStyle = `rgba(82,0,255,${0.4 + pulse * 0.5})`;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 4);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FFFFFF';
  ctx.font      = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PLAY', W / 2, btnY + btnH / 2 + 7);

  // ── Controls hint ─────────────────────────────────────────
  ctx.fillStyle = '#4A4E58'; ctx.font = '15px monospace';
  ctx.fillText('WASD  move  ·  MOUSE  aim  ·  CLICK  fire  ·  SPACE / F  ability  ·  ESC  pause', W / 2, btnY + btnH + 20);

  // ── Archive + Admin buttons ───────────────────────────────
  const smBtnW = Math.min(160, W * 0.18);
  const smBtnH = 44;
  const smBtnGap = 12;
  const smBtnTotalW = smBtnW * 2 + smBtnGap;
  const smBtnStartX = W / 2 - smBtnTotalW / 2;
  const smBtnY = btnY + btnH + 40;

  _titleBtns.archive = { x: smBtnStartX,                     y: smBtnY, w: smBtnW, h: smBtnH };
  _titleBtns.admin   = { x: smBtnStartX + smBtnW + smBtnGap, y: smBtnY, w: smBtnW, h: smBtnH };

  for (const [btn, label] of [[_titleBtns.archive, 'ARCHIVE'], [_titleBtns.admin, 'ADMIN']]) {
    const hovered = input.mouseX >= btn.x && input.mouseX <= btn.x + btn.w &&
                    input.mouseY >= btn.y && input.mouseY <= btn.y + btn.h;
    ctx.fillStyle   = hovered ? '#1E2130' : '#0D0F17';
    ctx.strokeStyle = hovered ? '#C4C8D4' : '#2A2E42';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = hovered ? '#FFFFFF' : '#4A4E58';
    ctx.font      = '22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 5);
  }

  // ── Local records ─────────────────────────────────────────
  const scores  = loadScores();
  const scoresY = smBtnY + smBtnH + 28;
  if (scores.length > 0) {
    ctx.fillStyle = '#2A2E42'; ctx.font = '15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('— FREQUENCY RECORDS —', W / 2, scoresY);
    scores.slice(0, 5).forEach((s, i) => {
      const classLabel = s.subclass ? `${s.class}/${s.subclass}` : (s.class || 'Null');
      ctx.fillStyle = i === 0 ? '#B8882A' : '#4A4E58';
      ctx.font      = i === 0 ? 'bold 15px monospace' : '15px monospace';
      ctx.fillText(
        `${i + 1}.  ${s.initials}   ${s.score.toLocaleString()}   ${formatTime(s.time)}   ${classLabel.toUpperCase()}`,
        W / 2, scoresY + 18 + i * 17
      );
    });
  }

  // Version — smallest text, bottom of screen per UI spec
  ctx.fillStyle = '#8A8E99'; ctx.font = '15px monospace';
  ctx.fillText('v0.3.0', W / 2, H - 12);
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
    const tableY = cy2 + 50;
    ctx.fillStyle = '#4A4E58'; ctx.font = '22px monospace';
    ctx.fillText('— TOP RECORDS —', W / 2, tableY);
    scores.slice(0, 8).forEach((s, i) => {
      const classLabel = s.subclass ? `${s.class}/${s.subclass}` : (s.class || 'Null');
      ctx.fillStyle = i === 0 ? '#B8882A' : '#4A4E58';
      ctx.font = i === 0 ? 'bold 22px monospace' : '22px monospace';
      ctx.fillText(
        `${i+1}.  ${s.initials}   ${s.score.toLocaleString()}   ${formatTime(s.time)}   ${classLabel.toUpperCase()}`,
        W / 2, tableY + 18 + i * 15
      );
    });
  }

  // Back hint
  const blink = Math.floor(Date.now() / 600) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#4A4E58'; ctx.font = '15px monospace';
    ctx.fillText('ESC or CLICK to return', W / 2, H - 16);
  }

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
  ctx.fillStyle = 'rgba(13,14,18,0.96)';
  ctx.fillRect(0, 0, W, H);

  const wd          = waveSystem;
  const cy          = H * 0.24;
  const underTarget = wd.completionTime < CONFIG.target_time_seconds;

  // Title
  ctx.shadowBlur  = 22;
  ctx.shadowColor = '#5200ff';
  ctx.fillStyle   = '#FFFFFF';
  ctx.font        = `bold ${Math.floor(W * 0.040)}px monospace`;
  ctx.textAlign   = 'center';
  ctx.fillText('SIGNAL RESTORED', W / 2, cy);
  ctx.shadowBlur  = 0;

  ctx.fillStyle = '#8A8E99';
  ctx.font      = '15px monospace';
  ctx.fillText('wave 15 cleared', W / 2, cy + 24);

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
  ctx.shadowBlur  = 14;
  ctx.shadowColor = '#5200ff';
  ctx.fillStyle   = '#FFFFFF';
  ctx.font        = 'bold 22px monospace';
  ctx.fillText(`Final score:  ${wd.finalScore.toLocaleString()}`, W / 2, ly + 16);
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
    ctx.fillText('ontouchstart' in window ? 'tap letters below' : 'type 3 letters · ENTER to confirm', W / 2, ly + 56);
    drawOnScreenKeyboard(W, ly + 72, winInitials);
  } else {
    ctx.fillStyle = '#B8882A';
    ctx.font      = 'bold 22px monospace';
    ctx.fillText('SCORE RECORDED', W / 2, ly + 18);
    if (Math.floor(Date.now() / 600) % 2 === 0) {
      ctx.fillStyle = '#C4C8D4';
      ctx.font      = '17px monospace';
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
  const cardH  = 520;
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
    ctx.fillText('ontouchstart' in window ? 'tap letters below' : 'type 3 letters · ENTER to confirm', W/2, iy + 56);
    drawOnScreenKeyboard(W, iy + 72, initialsInput);
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
