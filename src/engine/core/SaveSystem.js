import { safeStorage } from './Settings.js';

const PREFIX = 't7g.save.v1.';
export const SLOTS = ['auto', '1', '2', '3'];

/**
 * localStorage-backed save slots: 'auto' + 3 manual slots.
 * Each save: { version, slot, time, room, node, roomTitle, playTime, state, thumb }
 */
export class SaveSystem {
  constructor(storage = safeStorage()) { this.storage = storage; }

  write(slot, payload) {
    const data = { version: 1, slot, time: Date.now(), ...payload };
    try {
      this.storage.setItem(PREFIX + slot, JSON.stringify(data));
    } catch (e) {
      // Quota exceeded: retry without thumbnail
      try { delete data.thumb; this.storage.setItem(PREFIX + slot, JSON.stringify(data)); }
      catch (e2) { console.warn('[save] failed', e2); return null; }
    }
    return data;
  }
  read(slot) {
    try { const raw = this.storage.getItem(PREFIX + slot); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  }
  remove(slot) { try { this.storage.removeItem(PREFIX + slot); } catch { /* ignore */ } }
  list() { return SLOTS.map((s) => ({ slot: s, data: this.read(s) })); }
  latest() {
    let best = null;
    for (const { data } of this.list()) if (data && (!best || data.time > best.time)) best = data;
    return best;
  }
}
