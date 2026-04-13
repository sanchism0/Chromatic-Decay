// CHROMATIC DECAY — Input Handler

export class Input {
  constructor(canvas) {
    this.canvas = canvas;

    // Keyboard state
    this.keys = {
      w: false, a: false, s: false, d: false,
      space: false, escape: false, f: false,
    };
    // Edge detection — true for exactly one frame
    this.justPressed = {
      escape: false, space: false, f: false, touchAbility: false,
    };
    this._prevEscape = false;
    this._prevSpace  = false;
    this._prevF      = false;

    // Mouse state (screen coords)
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseJustClicked = false;
    this._prevMouseDown = false;

    // ── Touch / mobile state ──────────────────────────────────
    this.touchMoveX    = 0;      // -1 to 1 (left joystick)
    this.touchMoveY    = 0;
    this.touchAimAngle = null;   // radians from right joystick, null = inactive

    this._joystickRadius    = 72;
    this._leftTouch         = null;  // { id, baseX, baseY, curX, curY }
    this._rightTouch        = null;
    this._abilityTouchId    = null;
    this._abilityTouchDown  = false;
    this._prevAbilityTouch  = false;

    this._bindEvents();
    this._bindTouchEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', e => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    this.keys.w = true;  break;
        case 'KeyS': case 'ArrowDown':  this.keys.s = true;  break;
        case 'KeyA': case 'ArrowLeft':  this.keys.a = true;  break;
        case 'KeyD': case 'ArrowRight': this.keys.d = true;  break;
        case 'Space':   e.preventDefault(); this.keys.space = true;  break;
        case 'KeyF':    this.keys.f      = true;  break;
        case 'Escape':  this.keys.escape = true; break;
      }
    });

    window.addEventListener('keyup', e => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    this.keys.w = false; break;
        case 'KeyS': case 'ArrowDown':  this.keys.s = false; break;
        case 'KeyA': case 'ArrowLeft':  this.keys.a = false; break;
        case 'KeyD': case 'ArrowRight': this.keys.d = false; break;
        case 'Space':   this.keys.space  = false; break;
        case 'KeyF':    this.keys.f      = false; break;
        case 'Escape':  this.keys.escape = false; break;
      }
    });

    this.canvas.addEventListener('mousemove', e => {
      this.mouseX = e.offsetX;
      this.mouseY = e.offsetY;
    });

    this.canvas.addEventListener('mousedown', e => {
      if (e.button === 0) this.mouseDown = true;
    });

    this.canvas.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouseDown = false;
    });

    // Prevent context menu
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  _bindTouchEvents() {
    const canvas = this.canvas;

    // Ability button position (screen-space, recomputed each touch)
    const abilityBtnRadius = 44;

    const getCanvasPos = (touch) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top)  * scaleY,
      };
    };

    const abilityBtnPos = () => ({
      x: canvas.width  - 80,
      y: canvas.height - 80,
    });

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const W = canvas.width;

      for (const t of e.changedTouches) {
        const { x, y } = getCanvasPos(t);
        const ab = abilityBtnPos();

        // Ability button takes priority
        if (Math.hypot(x - ab.x, y - ab.y) < abilityBtnRadius) {
          this._abilityTouchId   = t.identifier;
          this._abilityTouchDown = true;
          continue;
        }

        // Left half → move joystick
        if (x < W / 2 && !this._leftTouch) {
          this._leftTouch = { id: t.identifier, baseX: x, baseY: y, curX: x, curY: y };
          continue;
        }

        // Right half → aim joystick
        if (x >= W / 2 && !this._rightTouch) {
          this._rightTouch = { id: t.identifier, baseX: x, baseY: y, curX: x, curY: y };
        }
      }
      this._updateTouchState();
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const { x, y } = getCanvasPos(t);
        if (this._leftTouch  && t.identifier === this._leftTouch.id)  {
          this._leftTouch.curX  = x; this._leftTouch.curY  = y;
        }
        if (this._rightTouch && t.identifier === this._rightTouch.id) {
          this._rightTouch.curX = x; this._rightTouch.curY = y;
        }
      }
      this._updateTouchState();
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this._leftTouch   && t.identifier === this._leftTouch.id)   this._leftTouch   = null;
        if (this._rightTouch  && t.identifier === this._rightTouch.id)  this._rightTouch  = null;
        if (t.identifier === this._abilityTouchId) {
          this._abilityTouchId   = null;
          this._abilityTouchDown = false;
        }
      }
      this._updateTouchState();
    }, { passive: false });

    canvas.addEventListener('touchcancel', e => {
      this._leftTouch = null; this._rightTouch = null;
      this._abilityTouchId = null; this._abilityTouchDown = false;
      this._updateTouchState();
    }, { passive: false });
  }

  _updateTouchState() {
    const r = this._joystickRadius;

    if (this._leftTouch) {
      const dx  = this._leftTouch.curX - this._leftTouch.baseX;
      const dy  = this._leftTouch.curY - this._leftTouch.baseY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const mag = Math.min(len, r) / r;
      this.touchMoveX = (dx / len) * mag;
      this.touchMoveY = (dy / len) * mag;
    } else {
      this.touchMoveX = 0;
      this.touchMoveY = 0;
    }

    if (this._rightTouch) {
      const dx  = this._rightTouch.curX - this._rightTouch.baseX;
      const dy  = this._rightTouch.curY - this._rightTouch.baseY;
      const len = Math.sqrt(dx * dx + dy * dy);
      this.touchAimAngle = len > 12 ? Math.atan2(dy, dx) : this.touchAimAngle;
    } else {
      this.touchAimAngle = null;
    }
  }

  // Call once per frame AFTER processing, to compute edge states
  update() {
    this.justPressed.escape       = this.keys.escape && !this._prevEscape;
    this.justPressed.space        = this.keys.space  && !this._prevSpace;
    this.justPressed.f            = this.keys.f      && !this._prevF;
    this.justPressed.touchAbility = this._abilityTouchDown && !this._prevAbilityTouch;
    this.mouseJustClicked         = this.mouseDown   && !this._prevMouseDown;

    this._prevEscape       = this.keys.escape;
    this._prevSpace        = this.keys.space;
    this._prevF            = this.keys.f;
    this._prevMouseDown    = this.mouseDown;
    this._prevAbilityTouch = this._abilityTouchDown;
  }

  // Returns world-space mouse position given camera offset and zoom
  worldMouse(cameraX, cameraY, zoom = 1) {
    return {
      x: this.mouseX / zoom + cameraX,
      y: this.mouseY / zoom + cameraY,
    };
  }

  // Ability button — Space, F, or touch ability button
  get abilityJustPressed() {
    return this.justPressed.space || this.justPressed.f || this.justPressed.touchAbility;
  }

  // Expose joystick state for HUD drawing
  get leftJoystick()   { return this._leftTouch;  }
  get rightJoystick()  { return this._rightTouch; }
  get joystickRadius() { return this._joystickRadius; }
  get abilityBtnX()    { return this.canvas.width  - 80; }
  get abilityBtnY()    { return this.canvas.height - 80; }
}
