// CHROMATIC DECAY — Admin Config Panel
// Accessible from the title screen via [ ADMIN ] button.
// Exposes all tunable CONFIG values as editable number/bool fields.
// Changes take effect on the next run. Export/import as JSON.

import { CONFIG } from './config.js';
import { drawRoundedRect } from './utils.js';

// ── Field definitions ─────────────────────────────────────────
// Groups of related fields shown as sections in the panel.

const FIELD_GROUPS = [
  {
    label: 'PLAYER',
    fields: [
      { key: 'player_base_hp',              label: 'Base HP',           type: 'number', min: 10,  max: 500, step: 10  },
      { key: 'player_base_damage',          label: 'Base Damage',       type: 'number', min: 1,   max: 100, step: 1   },
      { key: 'player_base_fire_rate',       label: 'Fire Rate (shots/s)',type: 'number', min: 0.5, max: 10,  step: 0.5 },
      { key: 'player_move_speed',           label: 'Move Speed',        type: 'number', min: 60,  max: 600, step: 20  },
      { key: 'player_fire_slow_multiplier', label: 'Fire Slow Mult',    type: 'number', min: 0.1, max: 1.0, step: 0.05},
      { key: 'player_projectile_speed',     label: 'Proj Speed',        type: 'number', min: 100, max: 1200,step: 40  },
      { key: 'player_projectile_range',     label: 'Proj Range',        type: 'number', min: 100, max: 2000,step: 50  },
      { key: 'player_pickup_radius',        label: 'Pickup Radius',     type: 'number', min: 10,  max: 200, step: 5   },
    ],
  },
  {
    label: 'ENEMIES',
    fields: [
      { key: 'hp_scale_per_minute',  label: 'HP Scale/Min',      type: 'number', min: 0,   max: 1.0, step: 0.05},
      { key: 'base_spawn_interval',  label: 'Spawn Interval (s)', type: 'number', min: 0.5, max: 10,  step: 0.5 },
      { key: 'spawn_acceleration',   label: 'Spawn Accel',       type: 'number', min: 0,   max: 1.0, step: 0.05},
      { key: 'min_spawn_interval',   label: 'Min Spawn Interval',type: 'number', min: 0.1, max: 5.0, step: 0.1 },
      { key: 'max_enemies',          label: 'Max Enemies',        type: 'number', min: 5,   max: 200, step: 5   },
      { key: 'max_simultaneous_pinks',label:'Max Pinks',          type: 'number', min: 0,   max: 5,   step: 1   },
    ],
  },
  {
    label: 'RESIDUALS',
    fields: [
      { key: 'residual_base_threshold',    label: 'Base Threshold',    type: 'number', min: 10,  max: 500, step: 10  },
      { key: 'residual_threshold_increase',label: 'Threshold Increase',type: 'number', min: 5,   max: 200, step: 5   },
      { key: 'residual_size',              label: 'Orb Size',          type: 'number', min: 2,   max: 20,  step: 1   },
    ],
  },
  {
    label: 'ECHOES',
    fields: [
      { key: 'echo_spawn_interval', label: 'Spawn Interval (s)', type: 'number', min: 5,   max: 120, step: 5   },
      { key: 'echo_hp_restore',     label: 'HP Restore',         type: 'number', min: 0,   max: 100, step: 5   },
      { key: 'echo_channel_time',   label: 'Channel Time (s)',   type: 'number', min: 0.2, max: 5.0, step: 0.1 },
      { key: 'echo_max_count',      label: 'Max Echoes',         type: 'number', min: 1,   max: 10,  step: 1   },
    ],
  },
  {
    label: 'CAMERA',
    fields: [
      { key: 'camera_zoom', label: 'Zoom', type: 'number', min: 1.0, max: 4.0, step: 0.1 },
    ],
  },
  {
    label: 'SCORE WEIGHTS',
    fields: [
      { key: 'kill_weight',     label: 'Kill',     type: 'number', min: 0, max: 1000, step: 5  },
      { key: 'echo_weight',     label: 'Echo',     type: 'number', min: 0, max: 1000, step: 5  },
      { key: 'time_weight',     label: 'Time',     type: 'number', min: 0, max: 100,  step: 1  },
      { key: 'upgrade_weight',  label: 'Upgrade',  type: 'number', min: 0, max: 1000, step: 10 },
      { key: 'fragment_weight', label: 'Fragment', type: 'number', min: 0, max: 5000, step: 50 },
    ],
  },
];

// ── AdminPanel class ──────────────────────────────────────────

const ADMIN_PASSWORD = 'decay';   // ← change this to whatever you want

export class AdminPanel {
  constructor() {
    this.active         = false;
    this._authenticated = false;
    this._pwBuffer      = '';
    this._pwFailed      = false;
    this._pwFailTimer   = 0;
    this._scrollY       = 0;
    this._maxScrollY    = 0;
    this._hovered       = null;
    this._editingKey    = null;
    this._editBuffer    = '';
    this._statusMsg     = '';
    this._statusTimer   = 0;

    // Local shadow of CONFIG values — applied on demand
    this._values = this._snapshot();
  }

  _snapshot() {
    const out = {};
    for (const g of FIELD_GROUPS) {
      for (const f of g.fields) {
        out[f.key] = CONFIG[f.key];
      }
    }
    return out;
  }

  _applyToConfig() {
    for (const [k, v] of Object.entries(this._values)) {
      if (k in CONFIG) CONFIG[k] = v;
    }
  }

  open() {
    this.active         = true;
    this._authenticated = false;
    this._pwBuffer      = '';
    this._pwFailed      = false;
    this._scrollY       = 0;
    this._values        = this._snapshot();
  }

  close() {
    this.active         = false;
    this._authenticated = false;
    this._pwBuffer      = '';
    this._editingKey    = null;
    this._editBuffer    = '';
  }

  _setStatus(msg) {
    this._statusMsg   = msg;
    this._statusTimer = 2.5;
  }

  // ── Input ────────────────────────────────────────────────────

  handleKey(e) {
    if (!this.active) return false;

    // ── Password gate ─────────────────────────────────────────
    if (!this._authenticated) {
      if (e.key === 'Escape') { this.close(); return true; }
      if (e.key === 'Backspace') { this._pwBuffer = this._pwBuffer.slice(0, -1); return true; }
      if (e.key === 'Enter') {
        if (this._pwBuffer === ADMIN_PASSWORD) {
          this._authenticated = true;
          this._pwBuffer      = '';
        } else {
          this._pwFailed    = true;
          this._pwFailTimer = 1.5;
          this._pwBuffer    = '';
        }
        return true;
      }
      if (e.key.length === 1 && this._pwBuffer.length < 20) {
        this._pwBuffer += e.key;
        return true;
      }
      return true;
    }

    if (this._editingKey) {
      if (e.key === 'Escape') {
        this._editingKey = null;
        this._editBuffer = '';
        return true;
      }
      if (e.key === 'Enter') {
        this._commitEdit();
        return true;
      }
      if (e.key === 'Backspace') {
        this._editBuffer = this._editBuffer.slice(0, -1);
        return true;
      }
      if (/^[-0-9.]$/.test(e.key) && this._editBuffer.length < 10) {
        this._editBuffer += e.key;
        return true;
      }
      return true;
    }

    if (e.key === 'Escape') { this.close(); return true; }
    return false;
  }

  handleScroll(e) {
    if (!this.active) return false;
    this._scrollY = Math.max(0, Math.min(this._maxScrollY, this._scrollY + e.deltaY * 0.5));
    return true;
  }

  _commitEdit() {
    const val = parseFloat(this._editBuffer);
    if (!isNaN(val)) {
      const allFields = FIELD_GROUPS.flatMap(g => g.fields);
      const field = allFields.find(f => f.key === this._editingKey);
      if (field) {
        this._values[this._editingKey] = Math.max(field.min, Math.min(field.max, val));
      }
    }
    this._editingKey = null;
    this._editBuffer = '';
  }

  handleClick(mouseX, mouseY, canvas) {
    if (!this.active) return false;
    if (!this._authenticated) return false;

    const layout = this._layout(canvas.width, canvas.height);

    // Apply button
    if (this._hitTest(mouseX, mouseY, layout.applyBtn)) {
      this._applyToConfig();
      this._setStatus('✓ Applied — takes effect next run');
      return true;
    }

    // Export button
    if (this._hitTest(mouseX, mouseY, layout.exportBtn)) {
      this._exportJSON();
      return true;
    }

    // Import button
    if (this._hitTest(mouseX, mouseY, layout.importBtn)) {
      this._importJSON();
      return true;
    }

    // Reset button
    if (this._hitTest(mouseX, mouseY, layout.resetBtn)) {
      this._values = this._snapshot();
      this._setStatus('Reset to current CONFIG values');
      return true;
    }

    // Clear scores button
    if (this._hitTest(mouseX, mouseY, layout.clearBtn)) {
      localStorage.removeItem('chromatic_decay_scores');
      this._setStatus('✓ Hi-scores cleared');
      return true;
    }

    // Close button
    if (this._hitTest(mouseX, mouseY, layout.closeBtn)) {
      this.close();
      return true;
    }

    // Field clicks — step up/down arrows or click-to-edit
    for (const row of layout.rows) {
      if (mouseY - this._scrollY < row.y || mouseY - this._scrollY > row.y + row.h) continue;
      if (mouseX < row.x || mouseX > row.x + row.w) continue;

      const field = row.field;
      // Right half = increment, left half = decrement
      const mid = row.x + row.w * 0.5;
      if (mouseX > row.x + row.w - 28) {
        // ▲ arrow
        const cur = this._values[field.key] ?? CONFIG[field.key];
        this._values[field.key] = Math.min(field.max, +(cur + field.step).toFixed(6));
      } else if (mouseX > row.x + row.w - 56) {
        // ▼ arrow
        const cur = this._values[field.key] ?? CONFIG[field.key];
        this._values[field.key] = Math.max(field.min, +(cur - field.step).toFixed(6));
      } else {
        // Click on value — enter edit mode
        this._editingKey  = field.key;
        this._editBuffer  = String(this._values[field.key] ?? CONFIG[field.key]);
      }
      return true;
    }

    return false;
  }

  _hitTest(mx, my, rect) {
    return mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h;
  }

  _exportJSON() {
    const data = JSON.stringify(this._values, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'chromatic-decay-config.json';
    a.click();
    URL.revokeObjectURL(url);
    this._setStatus('Config exported as JSON');
  }

  _importJSON() {
    const input     = document.createElement('input');
    input.type      = 'file';
    input.accept    = '.json';
    input.onchange  = e => {
      const file   = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const parsed = JSON.parse(ev.target.result);
          let count = 0;
          for (const [k, v] of Object.entries(parsed)) {
            if (k in this._values && typeof v === 'number') {
              this._values[k] = v;
              count++;
            }
          }
          this._setStatus(`✓ Imported ${count} values`);
        } catch {
          this._setStatus('⚠ Import failed — invalid JSON');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ── Layout ───────────────────────────────────────────────────

  _layout(W, H) {
    const panelW  = Math.min(600, W * 0.88);
    const panelX  = (W - panelW) / 2;
    const panelY  = 0;
    const panelH  = H;

    const rowH    = 28;
    const rowPad  = 8;
    const colLabelW = panelW * 0.52;
    const colValW   = panelW * 0.48;
    const bodyX     = panelX + 16;
    const bodyW     = panelW - 32;

    let curY = 70;   // start below header (in panel-space, before scroll)
    const rows = [];

    for (const group of FIELD_GROUPS) {
      curY += 24;  // group label space
      for (const field of group.fields) {
        rows.push({
          y: curY, h: rowH,
          x: bodyX, w: bodyW,
          field,
          group: group.label,
        });
        curY += rowH + 2;
      }
      curY += 8;  // group bottom margin
    }

    const contentH = curY + 80;  // 80 for bottom buttons
    this._maxScrollY = Math.max(0, contentH - H + 60);

    const btnY  = H - 52;
    const btnH  = 34;
    const btnW  = 96;
    const btnGap = 8;
    const totalBtnW = btnW * 5 + btnGap * 4;
    const btnStartX = (W - totalBtnW) / 2;

    return {
      panelX, panelY, panelW, panelH,
      rows,
      applyBtn:  { x: btnStartX,                         y: btnY, w: btnW, h: btnH },
      exportBtn: { x: btnStartX + (btnW + btnGap),       y: btnY, w: btnW, h: btnH },
      importBtn: { x: btnStartX + (btnW + btnGap) * 2,   y: btnY, w: btnW, h: btnH },
      resetBtn:  { x: btnStartX + (btnW + btnGap) * 3,   y: btnY, w: btnW, h: btnH },
      clearBtn:  { x: btnStartX + (btnW + btnGap) * 4,   y: btnY, w: btnW, h: btnH },
      closeBtn:  { x: panelX + panelW - 36, y: 14, w: 24, h: 24 },
    };
  }

  // ── Update ───────────────────────────────────────────────────

  update(dt) {
    if (!this.active) return;
    this._statusTimer = Math.max(0, this._statusTimer - dt);
    this._pwFailTimer = Math.max(0, this._pwFailTimer - dt);
  }

  // ── Draw ─────────────────────────────────────────────────────

  draw(ctx, canvas) {
    if (!this.active) return;

    const W = canvas.width, H = canvas.height;

    // ── Password overlay ──────────────────────────────────────
    if (!this._authenticated) {
      ctx.fillStyle = 'rgba(10,11,16,0.97)';
      ctx.fillRect(0, 0, W, H);

      const cy = H * 0.40;
      ctx.fillStyle = '#B8882A';
      ctx.font      = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ADMIN ACCESS', W / 2, cy - 20);

      ctx.fillStyle = '#4A4E58';
      ctx.font      = '11px monospace';
      ctx.fillText('enter password', W / 2, cy);

      // Password input box
      const boxW = 260, boxH = 36;
      const boxX = W / 2 - boxW / 2, boxY = cy + 12;
      ctx.fillStyle   = '#13151C';
      drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 4);
      ctx.fill();
      ctx.strokeStyle = this._pwFailed && this._pwFailTimer > 0 ? '#cc3344' : '#4A5070';
      ctx.lineWidth   = 1.5;
      drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 4);
      ctx.stroke();

      const masked = '●'.repeat(this._pwBuffer.length) + '|';
      ctx.fillStyle = '#FFFFFF';
      ctx.font      = 'bold 16px monospace';
      ctx.fillText(masked, W / 2, boxY + boxH / 2 + 6);

      if (this._pwFailed && this._pwFailTimer > 0) {
        ctx.fillStyle   = '#cc3344';
        ctx.globalAlpha = Math.min(1, this._pwFailTimer);
        ctx.font        = '11px monospace';
        ctx.fillText('incorrect password', W / 2, boxY + boxH + 18);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = '#2A2E42';
      ctx.font      = '10px monospace';
      ctx.fillText('ENTER to confirm  ·  ESC to cancel', W / 2, boxY + boxH + (this._pwFailed ? 34 : 20));
      ctx.textAlign = 'left';
      return;
    }

    const layout = this._layout(W, H);

    // Backdrop
    ctx.fillStyle = 'rgba(10,11,16,0.96)';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle   = '#B8882A';
    ctx.font        = 'bold 15px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('ADMIN CONFIG PANEL', W / 2, 36);
    ctx.fillStyle   = '#4A4E58';
    ctx.font        = '10px monospace';
    ctx.fillText('changes apply on next run  ·  scroll to see all fields', W / 2, 52);

    // Close button
    const cb = layout.closeBtn;
    ctx.fillStyle   = '#2A2E42';
    ctx.fillRect(cb.x, cb.y, cb.w, cb.h);
    ctx.fillStyle   = '#8A8E99';
    ctx.font        = '12px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('✕', cb.x + cb.w / 2, cb.y + cb.h / 2 + 4);

    // Scrollable content region
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 60, W, H - 110);
    ctx.clip();
    ctx.translate(0, -this._scrollY);

    let groupY = {};
    let lastGroup = null;

    for (const row of layout.rows) {
      const field = row.field;
      const val   = this._values[field.key] ?? CONFIG[field.key];
      const isEditing = this._editingKey === field.key;
      const ry    = row.y;

      // Group header
      if (row.group !== lastGroup) {
        lastGroup = row.group;
        ctx.fillStyle   = '#4A5070';
        ctx.font        = 'bold 10px monospace';
        ctx.textAlign   = 'left';
        ctx.fillText(row.group, row.x, ry - 8);

        ctx.strokeStyle = '#2A2E42';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(row.x + ctx.measureText(row.group).width + 8, ry - 4);
        ctx.lineTo(row.x + row.w, ry - 4);
        ctx.stroke();
      }

      // Row background
      ctx.fillStyle = isEditing ? '#1E2840' : '#13151C';
      ctx.fillRect(row.x, ry, row.w, row.h);

      ctx.strokeStyle = isEditing ? '#4A6090' : '#1E2130';
      ctx.lineWidth   = 1;
      ctx.strokeRect(row.x + 0.5, ry + 0.5, row.w - 1, row.h - 1);

      // Label
      ctx.fillStyle   = '#8A8E99';
      ctx.font        = '11px monospace';
      ctx.textAlign   = 'left';
      ctx.fillText(field.label, row.x + 8, ry + row.h / 2 + 4);

      // Value
      const displayVal = isEditing ? this._editBuffer + '|' : String(val);
      ctx.fillStyle    = isEditing ? '#FFFFFF' : (val !== CONFIG[field.key] ? '#E8C86A' : '#C4C8D4');
      ctx.font         = isEditing ? 'bold 11px monospace' : '11px monospace';
      ctx.textAlign    = 'right';
      ctx.fillText(displayVal, row.x + row.w - 60, ry + row.h / 2 + 4);

      // Step arrows
      ctx.fillStyle = '#4A5070';
      ctx.font      = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▲', row.x + row.w - 14, ry + row.h / 2 - 1);
      ctx.fillText('▼', row.x + row.w - 14, ry + row.h / 2 + 10);
    }

    ctx.restore();

    // Scroll indicator
    if (this._maxScrollY > 0) {
      const trackH   = H - 120;
      const thumbH   = Math.max(30, trackH * ((H - 110) / (H - 110 + this._maxScrollY)));
      const thumbY   = 60 + (trackH - thumbH) * (this._scrollY / this._maxScrollY);
      ctx.fillStyle  = '#2A2E42';
      ctx.fillRect(W - 8, 60, 4, trackH);
      ctx.fillStyle  = '#4A5070';
      ctx.fillRect(W - 8, thumbY, 4, thumbH);
    }

    // Bottom buttons
    const btns = [
      { rect: layout.applyBtn,  label: 'APPLY',  color: '#4A8040' },
      { rect: layout.exportBtn, label: 'EXPORT', color: '#4A5070' },
      { rect: layout.importBtn, label: 'IMPORT', color: '#4A5070' },
      { rect: layout.resetBtn,  label: 'RESET',  color: '#7A3030' },
      { rect: layout.clearBtn,  label: 'SCORES', color: '#7A3050' },
    ];

    for (const btn of btns) {
      const r = btn.rect;
      ctx.fillStyle = btn.color;
      drawRoundedRect(ctx, r.x, r.y, r.w, r.h, 4);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF22';
      ctx.lineWidth   = 1;
      drawRoundedRect(ctx, r.x, r.y, r.w, r.h, 4);
      ctx.stroke();
      ctx.fillStyle   = '#FFFFFF';
      ctx.font        = 'bold 11px monospace';
      ctx.textAlign   = 'center';
      ctx.fillText(btn.label, r.x + r.w / 2, r.y + r.h / 2 + 4);
    }

    // Status message
    if (this._statusTimer > 0 && this._statusMsg) {
      ctx.globalAlpha = Math.min(1, this._statusTimer);
      ctx.fillStyle   = '#B8882A';
      ctx.font        = '11px monospace';
      ctx.textAlign   = 'center';
      ctx.fillText(this._statusMsg, W / 2, H - 8);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}
