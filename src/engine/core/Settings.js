import { Events } from './Events.js';

const KEY = 't7g.settings.v1';

export const DEFAULT_SETTINGS = {
  quality: 'auto',          // auto | low | medium | high | ultra
  masterVolume: 0.9,
  musicVolume: 0.6,
  sfxVolume: 0.85,
  voiceVolume: 1.0,
  ambienceVolume: 0.8,
  invertY: false,
  invertX: false,
  lookSensitivity: 1.0,
  fov: 55,                  // base vertical FOV in degrees (nodes may override)
  reduceMotion: false,      // no head-bob/sway, quick dissolves instead of glides
  transitionSpeed: 1.0,     // multiplier on glide speed
  subtitles: true,
  subtitleSize: 1.0,
  cursorSize: 1.0,
  hotspotHints: 'hold',     // hold (Tab) | toggle | off
  filmGrain: true,
  brightness: 1.0,          // exposure multiplier
  showFps: false,
};

export class Settings extends Events {
  constructor(storage = safeStorage()) {
    super();
    this.storage = storage;
    this.values = { ...DEFAULT_SETTINGS };
    try {
      const raw = this.storage?.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch { /* ignore */ }
  }
  get(k) { return this.values[k]; }
  set(k, v) {
    if (this.values[k] === v) return;
    this.values[k] = v;
    this.save();
    this.emit('change', k, v);
    this.emit(`change:${k}`, v);
  }
  save() { try { this.storage?.setItem(KEY, JSON.stringify(this.values)); } catch { /* ignore */ } }
  resetToDefaults() {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) this.set(k, v);
  }
}

export function safeStorage() {
  try {
    const s = window.localStorage;
    const t = '__t7g_test__';
    s.setItem(t, '1'); s.removeItem(t);
    return s;
  } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  }
}
