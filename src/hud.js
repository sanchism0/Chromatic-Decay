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

  draw(ctx, player, residuals, elapsed, waveSystem, W, H) {
    const pad = 14;

    // ── HP Bar ─────────────────────────────────────────────────
    const hpBarW = 200;
    const hpBarH = 14;
    const hpX    = pad;
    const hpY    = pad + 24;
    const hpPct  = clamp(player.hp / player.maxHp, 0, 1);

    ctx.fillStyle = '#8A8E99';
    ctx.font      = '20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('HP', hpX, hpY - 5);

    ctx.fillStyle = '#1E2130';
    ctx.fillRect(hpX, hpY, hpBarW, hpBarH);

    let hpColor;
    if (hpPct > 0.5)       hpColor = '#8dff6a';
    else if (hpPct > 0.25) hpColor = '#fd6c1d';
    else                   hpColor = '#f81d78';

    if (hpPct > 0) {
      ctx.fillStyle = hpColor;
      if (hpPct <= 0.25) ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.008) * 0.3;
      ctx.fillRect(hpX, hpY, hpBarW * hpPct, hpBarH);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#C4C8D4';
    ctx.font      = '20px monospace';
    ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, hpX + hpBarW + 8, hpY + hpBarH + 4);

    if (this.echoFlash > 0) {
      ctx.globalAlpha = this.echoFlash / 0.3 * 0.35;
      ctx.fillStyle   = '#C45A1A';
      ctx.fillRect(hpX, hpY, hpBarW, hpBarH);
      ctx.globalAlpha = 1;
    }

    let nextBarY = hpY + hpBarH + 4;

    // ── Shield Bar (Warden) ────────────────────────────────────
    if (player.shield > 0 || player.maxHp !== CONFIG.player_base_hp) {
      const maxShield = 80;
      if (player.shield > 0 || (player.classId === 'warden')) {
        const shPct = clamp(player.shield / maxShield, 0, 1);
        ctx.fillStyle = '#8A8E99';
        ctx.font      = '20px monospace';
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
    const resX = W / 2;
    if (waveSystem && waveSystem.wave > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#C4C8D4';
      ctx.font      = 'bold 22px monospace';
      ctx.fillText(`— WAVE ${waveSystem.wave} —`, resX, pad + 16);
    }

    // ── Score / Wave timer (top right) ───────────────────────
    const score = waveSystem ? waveSystem.killScore : player.frequencyScore(elapsed);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#C4C8D4';
    ctx.font      = '21px monospace';
    ctx.fillText(`SCORE  ${score.toLocaleString()}`, W - pad, pad + 20);

    if (waveSystem) {
      // Wave countdown — yellow at ≤10s, bright yellow + glow at ≤5s
      const wt  = waveSystem.waveTimer;
      const low = wt > 0 && wt <= 10;
      const hot = wt > 0 && wt <= 5;
      ctx.fillStyle = low ? '#e9ff6a' : '#A0A4B0';
      if (hot) { ctx.shadowBlur = 8; ctx.shadowColor = '#e9ff6a'; }
      ctx.font = low ? 'bold 21px monospace' : '21px monospace';
      ctx.fillText(`${waveSystem.waveTimerStr} wave`, W - pad, pad + 44);
      ctx.shadowBlur = 0;
    }

    // ── Class + Subclass display (bottom-left) ─────────────────
    const classY = H - 14;
    if (player.subclassId) {
      ctx.textAlign = 'left';
      ctx.fillStyle = player.glowColor;
      ctx.font      = 'bold 23px monospace';
      ctx.shadowBlur  = 8;
      ctx.shadowColor = player.glowColor;
      ctx.fillText(player.classLabel || player.classId.toUpperCase(), pad, classY - 22);
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = '#8A8E99';
      ctx.font        = '20px monospace';
      ctx.fillText(`+ ${player.subclassId.toUpperCase()}`, pad, classY);
    } else if (player.classId) {
      ctx.textAlign = 'left';
      ctx.fillStyle = player.glowColor;
      ctx.font      = 'bold 23px monospace';
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
      ctx.font      = '22px monospace';
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
        const blink = Math.floor(Date.now() / 500) % 2 === 0;
        if (blink) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font      = '22px monospace';
          ctx.fillText('SPACE / F', abX + abilityBarW + 6, abY + 6);
        }
      }
    }

    // ── Breaker active buff indicators ───────────────────────────
    if (player.classId === 'breaker' || player.subclassId) {
      let buffY = H - (player.subclassId ? 78 : 62);

      // Overclock active: doubled fire rate
      if (player.overclockActive && player.overclockTimer > 0) {
        const blink = Math.floor(Date.now() / 200) % 2 === 0;
        ctx.fillStyle = blink ? '#fff5c2' : '#B8882A';
        ctx.font      = '22px monospace';
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
        ctx.font      = '22px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`▲ ALGO  +${Math.round(player.algoBonus * 100)}%  ×${player.algoKillStreak}`, pad, buffY);
        buffY -= 26;
      }

      // Circuit Breaker available indicator
      if (player.circuitBreaker && !player.circuitBreakerUsed && player.abilityCooldown <= 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font      = '22px monospace';
        ctx.textAlign = 'left';
        ctx.shadowBlur  = 6;
        ctx.shadowColor = '#fff5c2';
        ctx.fillText('◼ CIRCUIT BREAKER READY', pad, buffY);
        ctx.shadowBlur = 0;
      }
    }

    // ── Near-death vignette ────────────────────────────────────
    if (player.hp / player.maxHp <= 0.2 && player.alive) {
      const t = Date.now() * 0.004;
      ctx.globalAlpha = 0.06 + Math.sin(t) * 0.04;
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
