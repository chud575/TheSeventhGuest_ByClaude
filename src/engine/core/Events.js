// Tiny typed-ish event emitter.
export class Events {
  constructor() { this._l = new Map(); }
  on(type, fn) {
    if (!this._l.has(type)) this._l.set(type, new Set());
    this._l.get(type).add(fn);
    return () => this.off(type, fn);
  }
  once(type, fn) {
    const off = this.on(type, (...a) => { off(); fn(...a); });
    return off;
  }
  off(type, fn) { this._l.get(type)?.delete(fn); }
  emit(type, ...args) {
    const set = this._l.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(...args); } catch (e) { console.error(`[events] ${type} handler failed`, e); }
    }
  }
  clear() { this._l.clear(); }
}
