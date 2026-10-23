// CHROMATIC DECAY — Echo System (healing pickups + Warden Fragments)

import { CONFIG } from './config.js';
import { clamp, dist } from './utils.js';
import { drawGroundShadow } from './sprites.js';

let _echoId = 0;

// ── Echo figure ───────────────────────────────────────────────
// A small faceless person made of white light, a pink health cross on the
// chest, fading into a wisp instead of legs.
const ECHO_ART = [
  '.....ooo.....',
  '....o###o....',
  '....o###o....',
  '....o###o....',
  '.....o#o.....',
  '...ooo#ooo...',
  '..o#######o..',
  '.o#o#####o#o.',
  'o#.o##+##o.#o',
  'o..o#+++#o..o',
  '...o##+##o...',
  '....o###o....',
  '....os#so....',
  '.....s#s.....',
  '.....s#s.....',
  '......#......',
  '......s......',
  '......s......',
];
const ECHO_PAL = { '#': '#FFFFFF', s: '#C9D3E6', o: '#7888A6', '+': '#FF4F9A' };
const ECHO_W = ECHO_ART[0].length, ECHO_H = ECHO_ART.length;
const ECHO_PX = 1;   // screen pixels per art pixel, same as the characters
const ECHO_TAIL = 12; // rows from here down are the wisp
const ECHO_IN = 0.6;  // seconds to fade in when it appears
const _echoArt = (() => {
  const c = document.createElement('canvas');
  c.width = ECHO_W; c.height = ECHO_H;
  const x = c.getContext('2d');
  ECHO_ART.forEach((row, j) => [...row].forEach((ch, i) => {
    if (!ECHO_PAL[ch]) return;
    // The wisp thins out toward the tip
    x.globalAlpha = j >= ECHO_TAIL ? Math.max(0.3, 1 - (j - ECHO_TAIL + 1) * 0.12) : 1;
    x.fillStyle = ECHO_PAL[ch];
    x.fillRect(i, j, 1, 1);
  }));
  return c;
})();

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
      const rescueRange = echo.isFragment ? 28 : 32;
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

      // Contact shadow stays on the floor while the pickup bobs above it
      const shR = echo.isFragment ? 14 : 7;
      drawGroundShadow(ctx, echo.x, echo.y + shR, shR * 1.2, shR * 0.45, 0.55);

      if (echo.isFragment) {
        this._drawFragment(ctx, echo.x, echo.y + bob, pulse, echo);
      } else {
        this._drawEcho(ctx, echo.x, echo.y + bob, pulse, echo);
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  // A see-through copy of each Echo that a rack in front is hiding, drawn after
  // the racks, so health is never lost behind the scenery. isHidden(echo)
  // comes from game.js, which knows the rack layout.
  drawHidden(ctx, isHidden) {
    this._seeThrough = 0.6;
    for (const echo of this.echoes) {
      if (!echo.active || echo.isFragment || !isHidden(echo)) continue;
      const pulse = Math.sin(echo.pulseTimer * 2.8) * 0.5 + 0.5;
      const bob   = Math.sin(echo.bobTimer * 2.2) * 3;
      this._drawEcho(ctx, echo.x, echo.y + bob, pulse, echo);
    }
    this._seeThrough = 0;
    ctx.globalAlpha = 1;
  }

  _drawEcho(ctx, sx, sy, pulse, echo) {
    // Soft light behind the figure (smooth, like every other light)
    const t = echo.pulseTimer;
    // Arriving: it brightens in over ECHO_IN seconds out of rising motes
    const form = Math.min(1, t / ECHO_IN);
    if (form < 1) {
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < 8; i++) {
        const k  = (form + i / 8) % 1;
        ctx.globalAlpha = (1 - form) * Math.sin(k * Math.PI);
        ctx.fillRect(Math.round(sx + Math.sin(i * 2.4) * 10 * (1 - k)), Math.round(sy + 14 - k * 22), 1, 1);
      }
    }

    // A little white fog drifting around it
    const k0 = this._seeThrough || 1;   // < 1 when drawn see-through over a rack
    ctx.globalAlpha = k0;
    for (let k = 0; k < 5; k++) {
      const a  = t * (0.5 + k * 0.13) + k * 1.26;
      const fx = sx + Math.cos(a) * (7 + (k % 3) * 3);
      const fy = sy + 3 + Math.sin(a * 1.3) * 5;
      const fr = 11 + (k % 2) * 4;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
      fg.addColorStop(0, `rgba(240,245,255,${0.16 * form})`);
      fg.addColorStop(1, 'rgba(240,245,255,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
    }
    const R = 17 + pulse * 3;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
    g.addColorStop(0, `rgba(255,255,255,${(0.42 + pulse * 0.14) * form})`);
    g.addColorStop(0.45, 'rgba(235,242,255,0.14)');
    g.addColorStop(1, 'rgba(235,242,255,0)');
    ctx.globalAlpha = k0;
    ctx.fillStyle = g;
    ctx.fillRect(sx - R, sy - R, R * 2, R * 2);

    // The figure: pixel art, ECHO_PX screen pixels per art pixel, snapped to
    // whole pixels. The wispy tail sways a pixel side to side.
    const m  = ctx.getTransform();
    const px = ECHO_PX;
    const ox = Math.round(m.a * sx + m.e - (ECHO_W * px) / 2);
    const oy = Math.round(m.d * sy + m.f - (ECHO_H * px) * 0.55);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = form * k0;
    for (let y = 0; y < ECHO_H; y++) {
      const sway = y >= ECHO_TAIL ? Math.round(Math.sin(t * 3 - y * 0.6) * (y - ECHO_TAIL + 2) / 4) * px : 0;
      ctx.drawImage(_echoArt, 0, y, ECHO_W, 1, ox + sway, oy + y * px, ECHO_W * px, px);
    }
    ctx.restore();
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
