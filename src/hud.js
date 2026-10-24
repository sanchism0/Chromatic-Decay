// CHROMATIC DECAY — HUD

import { CONFIG } from './config.js';
import { clamp, formatTime, drawRoundedRect } from './utils.js';

export class HUD {
  constructor() {
    this.killFlash  = 0;
    this.echoFlash  = 0;
  }

  flashKill()  { this.killFlash  = 0.15; }
  flashEcho()  { this.echoFlash  = 0.3;  }

  update(dt) {
    this.killFlash = Math.max(0, this.killFlash - dt);
    this.echoFlash = Math.max(0, this.echoFlash - dt);
  }

  draw(ctx, player, elapsed, waveSystem, W, H) {
    const pad    = 14;
    // Narrow (phone portrait): smaller type, HP numbers under the bar, and the
    // wave label moves to the right-hand column so nothing collides
    const narrow = W < 600;
    const fs     = px => `${narrow ? Math.round(px * 0.72) : px}px monospace`;

    // ── HP Bar ─────────────────────────────────────────────────
    // Touch: a slim bar tucked into the top-left corner, just the number
    const touch  = 'ontouchstart' in window;
    const hpBarW = touch ? Math.round(Math.min(120, W * 0.3)) : narrow ? Math.round(Math.min(160, W * 0.38)) : 200;
    const hpBarH = touch ? 8 : narrow ? 10 : 14;
    const hpX    = touch ? 10 : pad;
    const hpY    = touch ? 10 : pad + (narrow ? 18 : 24);
    const hpPct  = clamp(player.hp / player.maxHp, 0, 1);

    ctx.textAlign = 'left';
    if (!touch) {
      ctx.fillStyle = '#8A8E99';
      ctx.font      = fs(20);
      ctx.fillText('HP', hpX, hpY - 5);
    }

    ctx.fillStyle = '#1E2130';
    ctx.fillRect(hpX, hpY, hpBarW, hpBarH);

    let hpColor;
    if (hpPct > 0.5)       hpColor = '#8dff6a';
    else if (hpPct > 0.25) hpColor = '#fd6c1d';
    else                   hpColor = '#f81d78';

    if (hpPct > 0) {
      ctx.fillStyle = hpColor;
      ctx.fillRect(hpX, hpY, hpBarW * hpPct, hpBarH);
    }

    ctx.fillStyle = '#C4C8D4';
    ctx.font      = fs(20);
    if (touch) { ctx.font = 'bold 12px monospace'; ctx.fillText(String(Math.ceil(player.hp)), hpX + hpBarW + 6, hpY + hpBarH); }
    else if (narrow) ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, hpX, hpY + hpBarH + 16);
    else        ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, hpX + hpBarW + 8, hpY + hpBarH + 4);

    if (this.echoFlash > 0) {
      ctx.globalAlpha = this.echoFlash / 0.3 * 0.35;
      ctx.fillStyle   = '#C45A1A';
      ctx.fillRect(hpX, hpY, hpBarW, hpBarH);
      ctx.globalAlpha = 1;
    }

    let nextBarY = hpY + hpBarH + (touch ? 6 : narrow ? 22 : 4);

    // ── Shield Bar (Warden) ────────────────────────────────────
    if (player.shield > 0 || player.maxHp !== CONFIG.player_base_hp) {
      const maxShield = 80;
      if (player.shield > 0 || (player.classId === 'warden')) {
        const shPct = clamp(player.shield / maxShield, 0, 1);
        ctx.fillStyle = '#8A8E99';
        ctx.font      = fs(20);
        ctx.fillText('SHIELD', hpX, nextBarY + 14);
        ctx.fillStyle = '#1E2130';
        ctx.fillRect(hpX + 48, nextBarY + 2, 130, 6);
        if (shPct > 0) {
          ctx.fillStyle = '#eafae4';
          ctx.shadowBlur  = 4;
          ctx.shadowColor = '#eafae4';
          ctx.fillRect(hpX + 48, nextBarY + 2, 130 * shPct, 6);
          ctx.shadowBlur = 0;
        }
        nextBarY += 16;
      }
    }

    // ── Wave indicator (top center) ────────────────────────────
    if (waveSystem && waveSystem.wave > 0 && !narrow) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#C4C8D4';
      ctx.font      = 'bold ' + fs(22);
      ctx.fillText(`— WAVE ${waveSystem.wave} —`, W / 2, pad + 16);
    }

    // ── Score / Wave timer (top right) ───────────────────────
    // Story tutorial: HP only — no score, wave or timer
    if (this.minimal) { ctx.textAlign = 'left'; return; }

    const score = waveSystem ? waveSystem.killScore : player.frequencyScore(elapsed);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#C4C8D4';
    ctx.font      = fs(21);
    ctx.fillText(`SCORE  ${score.toLocaleString()}`, W - pad, pad + (narrow ? 14 : 20));

    if (waveSystem) {
      // Wave countdown — yellow at ≤10s, bright yellow + glow at ≤5s
      const wt  = waveSystem.waveTimer;
      const low = wt > 0 && wt <= 10;
      const hot = wt > 0 && wt <= 5;
      ctx.fillStyle = low ? '#e9ff6a' : '#A0A4B0';
      if (hot) { ctx.shadowBlur = 8; ctx.shadowColor = '#e9ff6a'; }
      ctx.font = (low ? 'bold ' : '') + fs(21);
      ctx.fillText(`${waveSystem.waveTimerStr} wave`, W - pad, pad + (narrow ? 32 : 44));
      ctx.shadowBlur = 0;
      if (narrow && waveSystem.wave > 0) {
        ctx.fillStyle = '#C4C8D4';
        ctx.font      = 'bold ' + fs(22);
        ctx.fillText(`WAVE ${waveSystem.wave}`, W - pad, pad + 50);
      }
    }

    // ── Class + Subclass display (bottom-left) ─────────────────
    const classY = H - 14;
    if (player.subclassId) {
      ctx.textAlign = 'left';
      ctx.fillStyle = player.glowColor;
      ctx.font      = 'bold ' + fs(23);
      ctx.shadowBlur  = 8;
      ctx.shadowColor = player.glowColor;
      ctx.fillText(player.classLabel || player.classId.toUpperCase(), pad, classY - 22);
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = '#8A8E99';
      ctx.font        = fs(20);
      ctx.fillText(`+ ${player.subclassId.toUpperCase()}`, pad, classY);
    } else if (player.classId) {
      ctx.textAlign = 'left';
      ctx.fillStyle = player.glowColor;
      ctx.font      = 'bold ' + fs(23);
      ctx.shadowBlur  = 8;
      ctx.shadowColor = player.glowColor;
      ctx.fillText(player.classLabel || player.classId.toUpperCase(), pad, classY);
      ctx.shadowBlur  = 0;
    }

    // ── Ability Cooldown Bar ───────────────────────────────────
    if (player.classId && player.abilityCooldownMax > 0) {
      const abilityBarW = 120;
      const abilityBarH = 4;
      const abX         = pad;
      const abY         = H - (player.subclassId ? 54 : 38);
      const ready       = player.abilityCooldown <= 0;
      const cdPct       = ready ? 1 : 1 - player.abilityCooldown / player.abilityCooldownMax;

      ctx.fillStyle = '#8A8E99';
      ctx.font      = fs(22);
      ctx.textAlign = 'left';
      const abilityNames = {
        warden: 'BARRIER PULSE', breaker: 'OVERLOAD BURST',
        ghost: 'PHASE SHIFT', weaver: 'DEPLOY TRAP', herald: 'SUMMON ORB',
      };
      const label = abilityNames[player.classId] || 'ABILITY';
      ctx.fillStyle = ready ? player.glowColor : '#4A4E58';
      ctx.fillText(label, abX, abY - 5);

      ctx.fillStyle = '#1E2130';
      ctx.fillRect(abX, abY, abilityBarW, abilityBarH);

      if (cdPct > 0) {
        ctx.fillStyle = ready ? player.glowColor : '#4A5070';
        if (ready) {
          ctx.shadowBlur  = 6;
          ctx.shadowColor = player.glowColor;
        }
        ctx.fillRect(abX, abY, abilityBarW * cdPct, abilityBarH);
        ctx.shadowBlur = 0;
      }

      if (ready) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font      = fs(22);
        ctx.fillText('AUTO', abX + abilityBarW + 6, abY + 6);
      }
    }

    // ── Breaker active buff indicators ───────────────────────────
    if (player.classId === 'breaker' || player.subclassId) {
      let buffY = H - (player.subclassId ? 78 : 62);

      // Overclock active: doubled fire rate
      if (player.overclockActive && player.overclockTimer > 0) {
        ctx.fillStyle = '#fff5c2';
        ctx.font      = fs(22);
        ctx.textAlign = 'left';
        ctx.shadowBlur  = 6;
        ctx.shadowColor = '#fff5c2';
        ctx.fillText(`⚡ OVERCLOCK  ${player.overclockTimer.toFixed(1)}s`, pad, buffY);
        ctx.shadowBlur = 0;
        buffY -= 26;
      }

      // Algorithmic Aggression: kill streak bonus
      if (player.algorithmicAggression && player.algoBonus > 0) {
        ctx.fillStyle = '#fff5c2';
        ctx.font      = fs(22);
        ctx.textAlign = 'left';
        ctx.fillText(`▲ ALGO  +${Math.round(player.algoBonus * 100)}%  ×${player.algoKillStreak}`, pad, buffY);
        buffY -= 26;
      }

      // Circuit Breaker available indicator
      if (player.circuitBreaker && !player.circuitBreakerUsed && player.abilityCooldown <= 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font      = fs(22);
        ctx.textAlign = 'left';
        ctx.shadowBlur  = 6;
        ctx.shadowColor = '#fff5c2';
        ctx.fillText('◼ CIRCUIT BREAKER READY', pad, buffY);
        ctx.shadowBlur = 0;
      }
    }

    // ── Near-death vignette ────────────────────────────────────
    if (player.hp / player.maxHp <= 0.2 && player.alive) {
      ctx.globalAlpha = 0.07;   // steady tint — no pulsing
      ctx.fillStyle   = '#f81d78';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  drawPaused(ctx, W, H) {
    ctx.fillStyle = 'rgba(13,14,18,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle  = '#C4C8D4';
    ctx.font       = 'bold 30px monospace';
    ctx.textAlign  = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2 - 16);
    ctx.fillStyle  = '#8A8E99';
    ctx.font       = '22px monospace';
    ctx.fillText('press ESC to resume', W / 2, H / 2 + 18);
    ctx.textAlign  = 'left';
  }
}
