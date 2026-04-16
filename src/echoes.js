// CHROMATIC DECAY — Echo System (healing pickups + Warden Fragments)

import { CONFIG } from './config.js';
import { clamp, dist } from './utils.js';

let _echoId = 0;

export class Echo {
  constructor(x, y, isFragment = false, fragmentId = null) {
    this.id           = _echoId++;
    this.x            = x;
    this.y            = y;
    this.active       = true;
    this.isFragment   = isFragment;
    this.fragmentId   = fragmentId;   // 'sable' | 'raze' | 'lumen' | 'cord' | 'voss'
    this.channeling   = false;
    this.channelTimer = 0;
    this.pulseTimer   = 0;
    this.bobTimer     = Math.random() * Math.PI * 2;
  }
}

export class EchoSystem {
  constructor() {
    this.echoes      = [];
    this.spawnTimer  = CONFIG.echo_spawn_interval * 0.3;
  }

  reset() {
    this.echoes     = [];
    this.spawnTimer = CONFIG.echo_spawn_interval * 0.3;
  }

  // Add a fragment echo at a specific world position
  addFragment(x, y, fragmentId) {
    this.echoes.push(new Echo(x, y, true, fragmentId));
  }

  update(dt, player, map, enemies, particles) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.echoes.filter(e => !e.isFragment).length < CONFIG.echo_max_count) {
      this._spawnEcho(map);
      this.spawnTimer = CONFIG.echo_spawn_interval;
    }

    for (const echo of this.echoes) {
      if (!echo.active) continue;
      echo.pulseTimer += dt;
      echo.bobTimer   += dt;

      // Only fragments can be consumed by enemies — health pickups are ignored

      // Player rescue — fragments need to be close, regular echoes too
      const rescueRange = echo.isFragment ? 28 : 20;
      const d = dist(echo.x, echo.y, player.x, player.y);
      if (d < rescueRange) {
        echo.channeling = true;
      } else {
        echo.channeling    = false;
        echo.channelTimer  = 0;
      }

      if (echo.channeling && player.alive) {
        const channelTime = echo.isFragment ? CONFIG.echo_channel_time : 0;
        echo.channelTimer += dt;
        if (echo.channelTimer >= channelTime) {
          echo.active = false;
          if (echo.isFragment) {
            particles.fragmentDiscovery(echo.x, echo.y);
            return { type: 'fragment', fragmentId: echo.fragmentId };
          } else {
            player.heal(CONFIG.echo_hp_restore);
            particles.echoRescue(echo.x, echo.y);
            particles.adrenalineSpike(player.x, player.y);
            return { type: 'echo' };
          }
        }
      }
    }

    this.echoes = this.echoes.filter(e => e.active);
    return null;
  }

  _spawnEcho(map) {
    const W = CONFIG.map_width;
    const H = CONFIG.map_height;
    let attempts = 20;
    while (attempts-- > 0) {
      const x = 80 + Math.random() * (W - 160);
      const y = H * 0.15 + Math.random() * (H * 0.70);
      let blocked = false;
      for (const obs of map.obstacles) {
        if (x >= obs.x - 24 && x <= obs.x + obs.w + 24 &&
            y >= obs.y - 24 && y <= obs.y + obs.h + 24) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        this.echoes.push(new Echo(x, y));
        return;
      }
    }
  }

  draw(ctx) {
    for (const echo of this.echoes) {
      if (!echo.active) continue;

      const pulse = (Math.sin(echo.pulseTimer * 2.8) * 0.5 + 0.5);
      const bob   = Math.sin(echo.bobTimer * 2.2) * 3;

      if (echo.isFragment) {
        this._drawFragment(ctx, echo.x, echo.y + bob, pulse, echo);
      } else {
        this._drawEcho(ctx, echo.x, echo.y + bob, pulse, echo);
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  _drawEcho(ctx, sx, sy, pulse, echo) {
    const outerR = 13 + pulse * 6;
    const alpha  = 0.55 + pulse * 0.35;

    // Outer expanding ring
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = '#C4C8D4';
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#C4C8D4';
    ctx.beginPath();
    ctx.arc(sx, sy, outerR, 0, Math.PI * 2);
    ctx.stroke();

    // Core circle
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#8A9AB0';
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#C4C8D4';
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fill();

    // White center dot
    ctx.fillStyle  = '#FFFFFF';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Pink plus / health cross (small, on top of white dot)
    const arm = 4, thick = 1.5;
    ctx.fillStyle   = '#FFB3D4';
    ctx.shadowBlur  = 14;
    ctx.shadowColor = '#FF80BB';
    ctx.fillRect(sx - thick, sy - arm, thick * 2, arm * 2);
    ctx.fillRect(sx - arm,   sy - thick, arm * 2, thick * 2);
    ctx.shadowBlur = 0;

    // Channel progress
    if (echo.channeling) {
      const prog = echo.channelTimer / CONFIG.echo_channel_time;
      const bw   = 36;
      ctx.globalAlpha = 1;
      ctx.fillStyle   = '#1E2130';
      ctx.fillRect(sx - bw / 2, sy - 22, bw, 4);
      ctx.fillStyle = '#C4C8D4';
      ctx.fillRect(sx - bw / 2, sy - 22, bw * prog, 4);
    }
  }

  _drawFragment(ctx, sx, sy, pulse, echo) {
    // Fragments are dramatically more visible — large, golden, hard to miss
    const _mob   = 'ontouchstart' in window;
    const outerR = _mob ? 13 + pulse * 5 : 18 + pulse * 8;
    const coreR  = _mob ?  7 + pulse * 2 : 10 + pulse * 3;

    // Large outer glow ring
    ctx.globalAlpha = 0.3 + pulse * 0.2;
    ctx.strokeStyle = '#E8C86A';
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 24;
    ctx.shadowColor = '#E8C86A';
    ctx.beginPath();
    ctx.arc(sx, sy, outerR + 8, 0, Math.PI * 2);
    ctx.stroke();

    // Mid ring
    ctx.globalAlpha = 0.6 + pulse * 0.3;
    ctx.strokeStyle = '#E8C86A';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, outerR, 0, Math.PI * 2);
    ctx.stroke();

    // Core fill
    ctx.globalAlpha = 0.85 + pulse * 0.15;
    ctx.fillStyle   = '#B8882A';
    ctx.shadowBlur  = 20;
    ctx.shadowColor = '#E8C86A';
    ctx.beginPath();
    ctx.arc(sx, sy, coreR, 0, Math.PI * 2);
    ctx.fill();

    // Bright gold center
    ctx.fillStyle  = '#FFFDE0';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Rotating cross/star indicator
    const rot   = echo.pulseTimer * 0.8;
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#FFFDE0';
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 0;
    for (let i = 0; i < 4; i++) {
      const a  = rot + (Math.PI / 2) * i;
      const r1 = coreR + 4;
      const r2 = coreR + 10 + pulse * 4;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
      ctx.lineTo(sx + Math.cos(a) * r2, sy + Math.sin(a) * r2);
      ctx.stroke();
    }

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    // Label above fragment
    ctx.fillStyle    = '#E8C86A';
    ctx.font         = 'bold 11px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('FRAGMENT', sx, sy - outerR - 6);
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';

    // Channel progress
    if (echo.channeling) {
      const prog = echo.channelTimer / CONFIG.echo_channel_time;
      const bw   = 60;
      ctx.globalAlpha = 1;
      ctx.fillStyle   = '#1E2130';
      ctx.fillRect(sx - bw / 2, sy - outerR - 24, bw, 5);
      ctx.fillStyle = '#E8C86A';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#E8C86A';
      ctx.fillRect(sx - bw / 2, sy - outerR - 24, bw * prog, 5);
      ctx.shadowBlur = 0;
    }
  }
}
