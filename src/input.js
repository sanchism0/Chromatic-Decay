// CHROMATIC DECAY — Input Handler

export class Input {
  constructor(canvas) {
    this.canvas = canvas;

    // Keyboard state
    this.keys = {
      w: false, a: false, s: false, d: false,
      space: false, escape: false, f: false, q: false, enter: false, e: false,
    };
    // Edge detection — true for exactly one frame
    this.justPressed = {
      escape: false, space: false, f: false, q: false, enter: false, e: false, dash: false,
    };
    this._prevE = false;
    this._prevEscape = false;
    this._prevSpace  = false;
    this._prevF      = false;
    this._prevQ      = false;
    this._prevEnter  = false;

    // Auto-fire: on by default; off means hold the mouse / aim stick to fire
    this.autoFire = true;
    try { this.autoFire = localStorage.getItem('chromatic_decay_autofire') !== '0'; } catch (e) {}

    // On-screen buttons register a hit test here so a touch on them is a tap,
    // not the start of a joystick
    this.uiHit = null;

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

    this._joystickRadius = 72;
    this._leftTouch      = null;  // { id, baseX, baseY, curX, curY }
    this._rightTouch     = null;

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
        case 'KeyQ':    this.keys.q      = true;  break;
        case 'KeyE':    this.keys.e      = true;  break;
        case 'Enter':   this.keys.enter  = true;  break;
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
        case 'KeyQ':    this.keys.q      = false; break;
        case 'KeyE':    this.keys.e      = false; break;
        case 'Enter':   this.keys.enter  = false; break;
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

    const getCanvasPos = (touch) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top)  * scaleY,
      };
    };

    // Track touch start positions to detect taps vs drags
    this._touchStartPos = {};

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const W = canvas.width;

      for (const t of e.changedTouches) {
        const { x, y } = getCanvasPos(t);

        // Always update mouse position so menu hit-tests work
        this.mouseX = x;
        this.mouseY = y;
        this._touchStartPos[t.identifier] = { x, y };

        // On-screen button → leave it to the tap
        if (this.uiHit && this.uiHit(x, y)) continue;

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
        const { x, y } = getCanvasPos(t);
        const start = this._touchStartPos[t.identifier];
        delete this._touchStartPos[t.identifier];

        // A quick sideways drag is a swipe (menus page through with it)
        if (start && Math.abs(x - start.x) > 60 && Math.abs(x - start.x) > 1.5 * Math.abs(y - start.y)) {
          this._swipePending = x < start.x ? -1 : 1;
        }

        // Tap detection: finger didn't move much → treat as mouse click
        if (start && Math.hypot(x - start.x, y - start.y) < 20) {
          this.mouseX = x;
          this.mouseY = y;
          this.mouseDown      = true;
          this._tapJustEnded  = true;
        }

        if (this._leftTouch   && t.identifier === this._leftTouch.id)   this._leftTouch   = null;
        if (this._rightTouch  && t.identifier === this._rightTouch.id)  this._rightTouch  = null;
      }
      this._updateTouchState();
    }, { passive: false });

    canvas.addEventListener('touchcancel', e => {
      this._leftTouch     = null;
      this._rightTouch    = null;
      this._touchStartPos = {};
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
      // Only update angle when displacement is meaningful — preserve last angle on release
      if (len > 12) this.touchAimAngle = Math.atan2(dy, dx);
    }
    // When rightTouch is null, touchAimAngle intentionally keeps its last value
  }

  // Call once per frame AFTER processing, to compute edge states
  update() {
    this.justPressed.escape       = this.keys.escape && !this._prevEscape;
    this.justPressed.space        = this.keys.space  && !this._prevSpace;
    this.justPressed.f            = this.keys.f      && !this._prevF;
    this.justPressed.q            = this.keys.q      && !this._prevQ;
    this.justPressed.enter        = this.keys.enter  && !this._prevEnter;
    this.justPressed.e            = this.keys.e && !this._prevE;
    this.justPressed.dash         = this.justPressed.space;
    this._prevE      = this.keys.e;
    this.justPressed.touchAbility = this._abilityTouchDown && !this._prevAbilityTouch;
    this.mouseJustClicked         = (this.mouseDown && !this._prevMouseDown) || !!this._tapJustEnded;
    this.swipe                    = this._swipePending || 0;   // -1 left, 1 right, for one frame
    this._swipePending            = 0;

    this._prevEscape       = this.keys.escape;
    this._prevSpace        = this.keys.space;
    this._prevF            = this.keys.f;
    this._prevQ            = this.keys.q;
    this._prevEnter        = this.keys.enter;
    this._prevMouseDown    = this.mouseDown;
    this._prevAbilityTouch = this._abilityTouchDown;

    // Clear tap state and the synthetic mouseDown after one frame
    if (this._tapJustEnded) {
      this._tapJustEnded = false;
      this.mouseDown     = false;
    }
  }

  // Returns world-space mouse position given camera offset and zoom
  worldMouse(cameraX, cameraY, zoom = 1) {
    return {
      x: this.mouseX / zoom + cameraX,
      y: this.mouseY / zoom + cameraY,
    };
  }

  // First activated ability — E (F is the second; game.js maps both)
  get abilityJustPressed() {
    return this.justPressed.e;
  }

  setAutoFire(on) {
    this.autoFire = on;
    try { localStorage.setItem('chromatic_decay_autofire', on ? '1' : '0'); } catch (e) {}
  }

  // Manual fire: mouse held (not a one-frame tap) or the aim stick in use
  get fireHeld() {
    return (this.mouseDown && !this._tapJustEnded) || !!this._rightTouch;
  }

  // Expose joystick state for HUD drawing
  get leftJoystick()   { return this._leftTouch;  }
  get rightJoystick()  { return this._rightTouch; }
  get joystickRadius() { return this._joystickRadius; }
}
