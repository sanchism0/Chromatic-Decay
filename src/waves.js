// CHROMATIC DECAY — Wave System
// 15-wave structure, countdown timers, bonus bank carry-forward,
// sequential boss spawning, kill scoring, win condition.

import { CONFIG } from './config.js';

// Per-type gap between consecutive spawns of the same type (seconds)
const SPAWN_GAPS = { violet: 0.5, yellow: 0.5, green: 0.5, orange: 0.5, pink: 5.0 };
// How long the charging zone flashes before the enemy actually appears
const CHARGE_TIME = 1.0;
// Color of each type's charging zone — also used by game.js for rendering
export const CHARGE_COLORS = {
  violet: '#5200ff', yellow: '#e9ff6a', green: '#8dff6a',
  orange: '#fd6c1d', pink:   '#f81d78',
};

// ── Wave compositions ─────────────────────────────────────────
// enemies: { type: count }  —  pink = boss
// sequentialBosses: each subsequent boss spawns when current boss hits 50% HP

export const WAVE_DATA = [
  // ── Phase 1: Introduction — one type per wave ────────────────
  { id:  1, timer:  60, enemies: { violet:  8 } },
  { id:  2, timer:  60, enemies: { yellow: 10 } },
  { id:  3, timer:  60, enemies: { green:  10 } },
  { id:  4, timer:  60, enemies: { orange:  8 } },
  { id:  5, timer:  90, enemies: { pink: 1, violet: 8 }, sequentialBosses: true },

  // ── Phase 2: Combination — mixed types ───────────────────────
  { id:  6, timer:  60, enemies: { violet: 10, yellow:  8 } },
  { id:  7, timer:  60, enemies: { green:   8, orange:  6 } },
  { id:  8, timer:  60, enemies: { orange:  8, green:   6 } },
  { id:  9, timer:  60, enemies: { violet:  5, yellow:  5, green: 5, orange: 4 } },
  { id: 10, timer:  90, enemies: { pink: 2, violet: 4, yellow: 3, green: 2 }, sequentialBosses: true },

  // ── Phase 3: Escalation — maximum pressure ───────────────────
  { id: 11, timer:  60, enemies: { violet:  5, yellow:  5, green:  8, orange:  8 } },
  { id: 12, timer:  75, enemies: { pink: 1, violet: 6, yellow: 5, green: 4, orange: 3 }, sequentialBosses: true },
  { id: 13, timer:  60, enemies: { violet:  8, yellow:  7, green:  8, orange:  6 } },
  { id: 14, timer:  90, enemies: { pink: 2, violet: 5, yellow: 5, green: 6, orange: 5 }, sequentialBosses: true },
  { id: 15, timer: 120, enemies: { pink: 3, violet: 8, yellow: 8, green: 8, orange: 8 }, sequentialBosses: true },
];

// ── WaveSystem ────────────────────────────────────────────────

export class WaveSystem {
  constructor() {
    this.reset();
  }

  reset() {
    this.wave           = 0;      // current wave number (1–15, 0 = not started)
    this.waveTimer      = 0;      // seconds remaining on wave countdown
    this.bonusBank      = 0;      // accumulated saved seconds (carry-forward across waves)
    this.totalTime      = 0;      // overall stopwatch — always counting up
    this.killScore      = 0;      // total kill points earned this run

    // Per-wave spawn state
    this.waveSpawnQueue  = [];    // flat shuffled list of non-pink types waiting to be announced
    this._typeCooldowns  = {};    // { type: secondsRemaining } — per-type spawn gap tracking

    // Pending spawns — announced but not yet spawned; exposed for game.js (charging zone draw)
    this.pendingSpawns   = [];    // [{ type, x, y, chargeTimer }]

    // Boss tracking (sequential bosses)
    this.activeBoss      = null;  // reference to most-recently-spawned boss enemy
    this.pendingBosses   = 0;     // bosses still waiting to spawn this wave
    this._bossTriggered  = false; // prevents double-spawn on 50% HP check
    this._bossCharging   = false; // true while a pink is in the pending charge queue

    // Level granting — game.js reads and decrements this
    this.pendingLevels  = 0;

    // Flags read by game.js each frame, reset after consumption
    this.waveClearFlag  = false;  // true when all wave enemies cleared
    this.timerExpired   = false;  // true when wave countdown hits 0
    this.gameWon        = false;  // true when wave 15 clears

    // Win scoring (populated when wave 15 clears)
    this.completionTime = 0;
    this.timeBonus      = 0;
    this.finalScore     = 0;

    // Wave-end context — read by upgrade screen to explain why upgrades appeared
    this.lastClearBonus = null; // { type: 'early'|'timeout', bonusPts, secondsRemaining }

    this.active         = false;  // wave is actively running
  }

  startRun() {
    this.reset();
  }

  // ── Start a fresh wave (called after upgrades are granted) ────
  startWave(waveId, enemySystem, map, player) {
    const waveData = WAVE_DATA[waveId - 1];
    if (!waveData) return;

    this.wave            = waveId;
    this.waveTimer       = waveData.timer;
    this.active          = true;
    this.waveClearFlag   = false;
    this.timerExpired    = false;
    this.activeBoss      = null;
    this._bossTriggered  = false;
    this._bossCharging   = false;
    this._typeCooldowns  = {};
    this.pendingSpawns   = [];
    this.pendingBosses   = waveData.enemies.pink || 0;

    // Build shuffled spawn queue — non-boss types only
    this.waveSpawnQueue = [];
    for (const [type, count] of Object.entries(waveData.enemies)) {
      if (type === 'pink') continue;
      for (let i = 0; i < count; i++) this.waveSpawnQueue.push(type);
    }
    _shuffle(this.waveSpawnQueue);

    // Spawn first boss immediately (sequential: subsequent bosses wait for 50% HP trigger)
    if (this.pendingBosses > 0) {
      this._spawnBoss(enemySystem, map, player);
      this.pendingBosses--;
    }
  }

  // ── Cascade: add new wave on top of existing enemies ─────────
  // Called when wave timer expires without clearing.
  addWaveOnTop(waveId, enemySystem, map, player) {
    const waveData = WAVE_DATA[waveId - 1];
    if (!waveData) return;

    this.wave          = waveId;
    this.waveTimer     = waveData.timer;
    this.timerExpired  = false;
    this._bossTriggered = false;

    // Append new enemies to existing spawn queue
    const newEntries = [];
    for (const [type, count] of Object.entries(waveData.enemies)) {
      if (type === 'pink') continue;
      for (let i = 0; i < count; i++) newEntries.push(type);
    }
    _shuffle(newEntries);
    this.waveSpawnQueue.push(...newEntries);

    // Add new bosses
    const newBosses = waveData.enemies.pink || 0;
    this.pendingBosses += newBosses;
    if (newBosses > 0 && !this.activeBoss && !this._bossCharging) {
      this._spawnBoss(enemySystem, map, player);
      this.pendingBosses--;
    }
  }

  // ── Main update — called every PLAYING frame ──────────────────
  update(dt, enemySystem, map, player) {
    if (!this.active) return;

    // Overall stopwatch — stops when win condition met (_onWin sets active=false)
    this.totalTime += dt;

    // Wave countdown
    if (this.waveTimer > 0) {
      this.waveTimer = Math.max(0, this.waveTimer - dt);
      if (this.waveTimer <= 0 && !this.timerExpired) {
        this.timerExpired = true;
      }
    }

    // ── Tick per-type cooldowns ───────────────────────────────
    for (const type of Object.keys(this._typeCooldowns)) {
      this._typeCooldowns[type] = Math.max(0, this._typeCooldowns[type] - dt);
    }

    // ── Announce next enemy from queue (respects per-type gap) ──
    if (this.waveSpawnQueue.length > 0) {
      for (let i = 0; i < this.waveSpawnQueue.length; i++) {
        const type = this.waveSpawnQueue[i];
        if ((this._typeCooldowns[type] || 0) <= 0) {
          this.waveSpawnQueue.splice(i, 1);
          this._announceSpawn(type, map, player, enemySystem);
          this._typeCooldowns[type] = SPAWN_GAPS[type] || 0.5;
          break; // one announcement per frame
        }
      }
    }

    // ── Resolve pending (charging) spawns ────────────────────
    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      const ps = this.pendingSpawns[i];
      ps.chargeTimer -= dt;
      if (ps.chargeTimer <= 0) {
        const e = enemySystem.spawnEnemyAt(ps.type, ps.x, ps.y);
        if (ps.type === 'pink') {
          this.activeBoss    = e;
          this._bossCharging = false;
          this._bossTriggered = false;
        }
        this.pendingSpawns.splice(i, 1);
      }
    }

    // ── Sequential boss logic ─────────────────────────────────
    if (this.activeBoss && !this.activeBoss.isAlive) {
      this.activeBoss     = null;
      this._bossTriggered = false;
    }

    const waveData = WAVE_DATA[this.wave - 1];
    if (this.pendingBosses > 0 && waveData && waveData.sequentialBosses && !this._bossCharging) {
      if (!this.activeBoss) {
        // Previous boss died — announce next
        this._spawnBoss(enemySystem, map, player);
        this.pendingBosses--;
      } else if (!this._bossTriggered &&
                 this.activeBoss.hp / this.activeBoss.maxHp <= CONFIG.boss_spawn_threshold) {
        // Current boss at 50% HP — announce next
        this._bossTriggered = true;
        this._spawnBoss(enemySystem, map, player);
        this.pendingBosses--;
      }
    }

  }

  // ── Called by game.js at end of frame when clear conditions are met ──
  triggerClear() {
    if (!this.waveClearFlag) this._onWaveClear();
  }

  // ── Called by game.js for every enemy kill ────────────────────
  onEnemyKilled(type) {
    const pts = (CONFIG.kill_points && CONFIG.kill_points[type]) || 10;
    this.killScore += pts;
  }

  // ── Internals ──────────────────────────────────────────────────

  _onWaveClear() {
    this.waveClearFlag = true;

    // Bonus bank: bank remaining seconds, cash out full levels
    const secondsRemaining = this.waveTimer;
    this.bonusBank        += secondsRemaining;
    const bonusLevels      = Math.floor(this.bonusBank / CONFIG.seconds_per_bonus_level);
    this.bonusBank         = this.bonusBank % CONFIG.seconds_per_bonus_level;
    this.pendingLevels     = 2 + bonusLevels; // guaranteed 2 + earned bonuses

    // Award bonus points and store context for upgrade screen header
    const type     = secondsRemaining > 0 ? 'early' : 'timeout';
    const bonusPts = Math.round(secondsRemaining * 10);
    if (bonusPts > 0) this.killScore += bonusPts;
    this.lastClearBonus = { type, bonusPts, secondsRemaining: Math.floor(secondsRemaining) };

    if (this.wave === 15) {
      this._onWin();
    }
  }

  _onWin() {
    this.gameWon        = true;
    this.completionTime = this.totalTime;
    const secondsUnder  = CONFIG.target_time_seconds - this.completionTime;
    this.timeBonus      = secondsUnder > 0
      ? Math.round(secondsUnder * CONFIG.time_bonus_per_second)
      : 0;
    this.finalScore     = this.killScore + this.timeBonus;
    this.active         = false; // stop stopwatch
  }

  _spawnBoss(enemySystem, map, player) {
    // Bosses use the charge system — activeBoss is set when charge resolves
    this._bossCharging = true;
    this._announceSpawn('pink', map, player, enemySystem);
  }

  _announceSpawn(type, map, player, enemySystem) {
    const occupied = [
      ...enemySystem.enemies.map(e => ({ x: e.x, y: e.y })),
      ...this.pendingSpawns.map(p => ({ x: p.x, y: p.y })),
    ];
    const pos = map.randomSpawn(player.x, player.y, occupied);
    this.pendingSpawns.push({ type, x: pos.x, y: pos.y, chargeTimer: CHARGE_TIME });
  }

  // ── Convenience getters ───────────────────────────────────────

  get bonusWindowClosed() {
    return this.totalTime >= CONFIG.target_time_seconds;
  }

  // "0:42"
  get waveTimerStr() {
    const s   = Math.ceil(this.waveTimer);
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  // "04:18"
  get totalTimeStr() {
    const s   = Math.floor(this.totalTime);
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
}

// ── Helpers ───────────────────────────────────────────────────

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
