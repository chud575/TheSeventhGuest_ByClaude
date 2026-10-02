import { Events } from '../core/Events.js';

/**
 * Unified input -> high level actions.
 * Emits:
 *   'pointer' (x, y, ndc)            hover move (no drag)
 *   'click'   (x, y, ndc, button)    click without drag
 *   'drag'    (dx, dy)               look drag in pixels
 *   'dragstart' / 'dragend'
 *   'wheel'   (delta)
 *   'action'  (name, down:boolean)   menu, map, hints, skip, back, cycleNext, cyclePrev, activate,
 *                                     reveal, quicksave, quickload, lookLeft/Right/Up/Down
 *   'pad'     (state)                per-frame gamepad state { lx, ly, rx, ry }
 *   'pointerdevice' (kind)           'mouse' | 'touch' | 'pad' | 'keyboard'
 *
 * Pointer events from puzzles are also re-emitted raw as 'raw' (type, event, ndc).
 */
export class Input extends Events {
  constructor(el) {
    super();
    this.el = el;
    this.x = 0; this.y = 0;
    this.down = null;
    this.dragging = false;
    this.keys = new Set();
    this.enabled = true;
    this.padPrev = {};
    this.lastDevice = 'mouse';
    this._bind();
  }

  ndc(x, y) {
    const r = this.el.getBoundingClientRect();
    return { x: ((x - r.left) / r.width) * 2 - 1, y: -((y - r.top) / r.height) * 2 + 1 };
  }

  _bind() {
    const el = this.el;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      el.setPointerCapture?.(e.pointerId);
      this.down = { x: e.clientX, y: e.clientY, button: e.button, t: performance.now(), id: e.pointerId };
      this.dragging = false;
      this._device(e.pointerType === 'touch' ? 'touch' : 'mouse');
      this.emit('raw', 'down', e, this.ndc(e.clientX, e.clientY));
    });
    el.addEventListener('pointermove', (e) => {
      const px = this.x, py = this.y;
      this.x = e.clientX; this.y = e.clientY;
      if (e.pointerType !== 'touch') this._device('mouse');
      const n = this.ndc(e.clientX, e.clientY);
      this.emit('raw', 'move', e, n);
      if (!this.enabled) return;
      if (this.down) {
        const dx = e.clientX - this.down.x, dy = e.clientY - this.down.y;
        if (!this.dragging && Math.hypot(dx, dy) > 6) { this.dragging = true; this.emit('dragstart'); }
        if (this.dragging) this.emit('drag', e.clientX - px, e.clientY - py);
      } else {
        this.emit('pointer', e.clientX, e.clientY, n);
      }
    });
    const up = (e) => {
      const n = this.ndc(e.clientX, e.clientY);
      this.emit('raw', 'up', e, n);
      if (!this.down) return;
      const d = this.down; this.down = null;
      if (!this.enabled) return;
      if (this.dragging) { this.dragging = false; this.emit('dragend'); }
      else if (e.type === 'pointerup') this.emit('click', e.clientX, e.clientY, n, d.button);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => this.emit('leave'));
    el.addEventListener('wheel', (e) => { e.preventDefault(); if (this.enabled) this.emit('wheel', Math.sign(e.deltaY)); this.emit('raw', 'wheel', e, this.ndc(e.clientX, e.clientY)); }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'SELECT') return;
      const a = this._keyAction(e);
      if (a) {
        if (['quicksave', 'quickload', 'reveal', 'menu'].includes(a) || e.key === ' ' || e.key.startsWith('Arrow') || e.key === 'Backspace') e.preventDefault();
        if (!e.repeat || a.startsWith('look')) this.emit('action', a, true, e);
      }
      this.keys.add(e.code);
      this._device('keyboard');
      this.emit('rawkey', 'down', e);
    });
    window.addEventListener('keyup', (e) => {
      const a = this._keyAction(e);
      if (a) this.emit('action', a, false, e);
      this.keys.delete(e.code);
      this.emit('rawkey', 'up', e);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.emit('action', 'reveal', false); });
  }

  _keyAction(e) {
    switch (e.code) {
      case 'Escape': return 'menu';
      case 'KeyM': return 'map';
      case 'KeyH': return 'hints';
      case 'Tab': return 'reveal';
      case 'Space': return 'skip';
      case 'Backspace': return 'back';
      case 'KeyE': case 'BracketRight': return 'cycleNext';
      case 'KeyQ': case 'BracketLeft': return 'cyclePrev';
      case 'Enter': case 'NumpadEnter': return 'activate';
      case 'F5': return 'quicksave';
      case 'F9': return 'quickload';
      case 'ArrowLeft': case 'KeyA': return 'lookLeft';
      case 'ArrowRight': case 'KeyD': return 'lookRight';
      case 'ArrowUp': case 'KeyW': return 'lookUp';
      case 'ArrowDown': case 'KeyS': return 'lookDown';
      case 'KeyR': return 'resetLook';
      default: return null;
    }
  }

  _device(kind) { if (kind !== this.lastDevice) { this.lastDevice = kind; this.emit('pointerdevice', kind); } }

  /** keyboard look vector (-1..1) */
  lookAxes() {
    const k = this.keys;
    return {
      x: (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0),
      y: (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0),
    };
  }

  /** Poll gamepads (call each frame). */
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find((x) => x && x.connected);
    if (!p) return null;
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    const st = { lx: dz(p.axes[0] || 0), ly: dz(p.axes[1] || 0), rx: dz(p.axes[2] || 0), ry: dz(p.axes[3] || 0) };
    const map = { 0: 'activate', 1: 'back', 3: 'hints', 9: 'menu', 8: 'map', 4: 'cyclePrev', 5: 'cycleNext', 2: 'reveal', 6: 'skip', 7: 'skip' };
    for (const [i, name] of Object.entries(map)) {
      const pressed = !!p.buttons[i]?.pressed;
      const was = !!this.padPrev[i];
      if (pressed !== was) { this.emit('action', name, pressed, { pad: true }); this._device('pad'); }
      this.padPrev[i] = pressed;
    }
    if (st.lx || st.ly || st.rx || st.ry) this._device('pad');
    this.emit('pad', st);
    return st;
  }
}
