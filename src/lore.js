// CHROMATIC DECAY — Lore Feed System

import { CONFIG } from './config.js';

// All lore blurbs keyed by trigger ID
const BLURBS = {
  run_start:          `"Three days underground. You came up expecting rescue. The gray was already everywhere."`,
  violet_first:       `Violet. Youngest signal. Probably a streaming queue that never got played.`,
  yellow_first:       `It turned toward you. Curious. Your Wi-Fi router used to do that.`,
  green_first:        `Green knows prey. It absorbed everything that ever ran a supply chain.`,
  orange_first:       `It broadcast at you. Learned that from about forty billion ad impressions.`,
  pink_first:         `One Red. Used to keep the lights on for a whole city. Now it just wants yours out.`,
  echo_first:         `A fragment of something. You pulled it back. It won't last but it helped.`,
  echo_consumed:      `Too slow. It finished the feed. You'll be faster next time.`,
  upgrade_first:      `The emitter found a new resonance. You feel it in your hands.`,
  sable_found:        `Ran 847 servers without a single outage. Now it's keeping you alive. Same job really.`,
  raze_found:         `Caused three flash crashes before breakfast. You're in good hands.`,
  lumen_found:        `Helped 40 million people disappear online. Happy to return the favor.`,
  cord_found:         `Used to turn the lights off when you left a room. Now it does that to enemies.`,
  voss_found:         `Spent six years making cats famous. Pivoting to combat felt natural.`,
  class_warden:       `You keep standing between things. Sable would approve.`,
  class_breaker:      `Everything at once. Raze would call this efficient.`,
  class_ghost:        `You were never here. Lumen taught you well.`,
  class_weaver:       `The map is a system. Cord always said that.`,
  class_herald:       `You're not alone out there. Voss knew that was the whole point.`,
  sub_bulwark:        `You hit back. Every time. That's not strategy, that's personality.`,
  sub_phantom:        `Fast and lethal. The Chromatics haven't figured out which direction to run yet.`,
  sub_drifter:        `You leave a mess wherever you go. Somehow it's working.`,
  sub_architect:      `The map is yours. The enemies just don't know it yet.`,
  sub_sentinel:       `You and everything around you. Outlast them all.`,
  near_death:         `Signal coherence critical. You're starting to dissolve.`,
  survive_10:         `Ten minutes. Most Wardens don't make it this far.`,
  survive_20:         `Twenty minutes. There are maybe three recorded instances of this.`,
  archive_complete:   `You found all of them. The Archive is complete. Now survive anyway.`,
};

export class LoreFeed {
  constructor() {
    this.enabled  = true;
    this.queue    = [];
    this.current  = null;
    this.timer    = 0;
    this.phase    = 'idle';  // idle | fadein | hold | fadeout
    this.alpha    = 0;
    this.seen     = new Set(); // per-run, resets each run
  }

  reset() {
    this.queue   = [];
    this.current = null;
    this.timer   = 0;
    this.phase   = 'idle';
    this.alpha   = 0;
    this.seen    = new Set();
  }

  trigger(id) {
    if (!this.enabled) return;
    if (this.seen.has(id)) return;
    this.seen.add(id);
    const text = BLURBS[id];
    if (text) this.queue.push(text);
  }

  update(dt) {
    if (!this.enabled) return;

    if (this.phase === 'idle' && this.queue.length > 0) {
      this.current = this.queue.shift();
      this.phase   = 'fadein';
      this.timer   = 0;
      this.alpha   = 0;
    }

    if (this.phase === 'fadein') {
      this.timer += dt;
      this.alpha = Math.min(1, this.timer / CONFIG.lore_fade_in);
      if (this.alpha >= 1) { this.phase = 'hold'; this.timer = 0; }
    } else if (this.phase === 'hold') {
      this.timer += dt;
      this.alpha  = 1;
      if (this.timer >= CONFIG.lore_hold_duration) { this.phase = 'fadeout'; this.timer = 0; }
    } else if (this.phase === 'fadeout') {
      this.timer += dt;
      this.alpha = Math.max(0, 1 - this.timer / CONFIG.lore_fade_out);
      if (this.alpha <= 0) { this.phase = 'idle'; this.current = null; }
    }
  }

  draw(ctx, canvasW, canvasH) {
    if (!this.enabled || !this.current || this.alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.alpha;

    const text   = this.current;
    const font   = 'bold 15px monospace';
    ctx.font     = font;

    const padding = 14;
    const maxW    = Math.min(700, canvasW * 0.8);
    // Word-wrap if needed (simple single-line for now — blurbs are short)
    const textW  = ctx.measureText(text).width;
    const pillW  = Math.min(textW, maxW) + padding * 2;
    const pillH  = 32;
    const pillX  = (canvasW - pillW) / 2;
    const pillY  = canvasH - 60;

    // Pill background
    ctx.fillStyle = 'rgba(13,14,18,0.70)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 4);
    ctx.fill();

    // Text
    ctx.fillStyle  = '#C4C8D4';
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvasW / 2, pillY + pillH / 2);

    ctx.restore();
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}
