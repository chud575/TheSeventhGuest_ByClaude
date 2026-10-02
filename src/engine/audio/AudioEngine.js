/**
 * Procedural WebAudio engine. No audio files needed (but supported).
 * Buses: master -> { music, ambience, sfx, voice } with a shared convolution "mansion" reverb.
 *
 * Ambience layers (toggle per room): wind, creaks, clock, thunder, rain, heartbeat.
 * Music: slow dark organ/strings pad with sparse celesta motif (procedural).
 * SFX: click, hover, whoosh, stinger, fail, door, chime, pickup, page, solved.
 * Voice: say({ text, speaker, url?, duration? }) -> plays file or a whispered
 *        murmur placeholder, and shows subtitles through the UI hook.
 */
export class AudioEngine {
  constructor(settings, { enabled = true } = {}) {
    this.settings = settings;
    this.enabled = enabled;
    this.ctx = null;
    this.started = false;
    this.layers = {};
    this.timers = new Set();
    this.subtitleHook = null;
    this._musicOn = false;
    this.buffers = new Map();
  }

  /** Must be called from a user gesture. Idempotent. */
  async start() {
    if (!this.enabled) return;
    if (this.started) { if (this.ctx.state !== 'running') await this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.ratio.value = 3; this.comp.attack.value = 0.01; this.comp.release.value = 0.3;
    this.master.connect(this.comp).connect(c.destination);
    this.reverb = c.createConvolver();
    this.reverb.buffer = this._impulse(3.2, 2.6);
    this.reverbGain = c.createGain(); this.reverbGain.gain.value = 0.32;
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.bus = {};
    for (const name of ['music', 'ambience', 'sfx', 'voice']) {
      const g = c.createGain();
      g.connect(this.master);
      const send = c.createGain(); send.gain.value = name === 'voice' ? 0.12 : name === 'music' ? 0.35 : 0.25;
      g.connect(send).connect(this.reverb);
      this.bus[name] = g;
    }
    this.noise = this._noiseBuffer(4);
    this.brown = this._brownBuffer(6);
    this.applyVolumes();
    this.settings?.on('change', (k) => { if (/Volume$/.test(k)) this.applyVolumes(); });
    this.started = true;
    if (c.state !== 'running') await c.resume();
    if (this._pendingAmb) { const a = this._pendingAmb; this._pendingAmb = null; this.setAmbience(a); }
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    const set = (g, v) => g.gain.setTargetAtTime(v, t, 0.1);
    set(this.master, s?.get('masterVolume') ?? 0.9);
    set(this.bus.music, (s?.get('musicVolume') ?? 0.6) * 0.5);
    set(this.bus.ambience, (s?.get('ambienceVolume') ?? 0.8) * 0.8);
    set(this.bus.sfx, s?.get('sfxVolume') ?? 0.85);
    set(this.bus.voice, s?.get('voiceVolume') ?? 1);
  }

  // ------------------------------------------------------------- utilities
  _noiseBuffer(sec) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  _brownBuffer(sec) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    return b;
  }
  _impulse(sec, decay) {
    const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // early reflections + dense tail
        const er = i < c.sampleRate * 0.08 && Math.random() < 0.004 ? (Math.random() * 2 - 1) * 0.8 : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) + er) * (ch ? 0.95 : 1);
      }
    }
    return b;
  }
  _src(buffer, loop = true) {
    const s = this.ctx.createBufferSource(); s.buffer = buffer; s.loop = loop;
    s.loopStart = Math.random() * (buffer.duration - 0.5);
    return s;
  }
  _after(sec, fn) {
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, sec * 1000);
    this.timers.add(id);
  }
  _rand(a, b) { return a + Math.random() * (b - a); }

  // ------------------------------------------------------------- ambience
  /** Set ambience layers: { wind: 0..1, creaks: 0..1, clock: 0..1, thunder: 0..1, rain: 0..1, heartbeat: 0..1, roomTone: 0..1 } */
  setAmbience(cfg = {}) {
    if (!this.started) { this._pendingAmb = cfg; return; }
    const want = { wind: 0, creaks: 0, clock: 0, thunder: 0, rain: 0, heartbeat: 0, roomTone: 0.3, ...cfg };
    for (const [k, v] of Object.entries(want)) this._layer(k, v);
  }

  _layer(name, level) {
    const L = this.layers[name];
    const t = this.ctx.currentTime;
    if (L) { L.gain.gain.setTargetAtTime(level * (L.base || 1), t, 1.2); L.level = level; return; }
    if (level <= 0) return;
    const g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.bus.ambience);
    const layer = { gain: g, level, base: 1 };
    this.layers[name] = layer;
    const fn = this[`_amb_${name}`];
    if (fn) fn.call(this, layer);
    g.gain.setTargetAtTime(level * layer.base, t, 1.5);
  }

  _amb_wind(L) {
    const c = this.ctx;
    const src = this._src(this.noise);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.7;
    const bp2 = c.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 900; bp2.Q.value = 9; // whistle
    const g2 = c.createGain(); g2.gain.value = 0.06;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = 260;
    lfo.connect(lfoG).connect(bp.frequency);
    const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.11;
    const lfo2G = c.createGain(); lfo2G.gain.value = 300;
    lfo2.connect(lfo2G).connect(bp2.frequency);
    const amp = c.createGain(); amp.gain.value = 0.5;
    const ampLfo = c.createOscillator(); ampLfo.frequency.value = 0.05;
    const ampLfoG = c.createGain(); ampLfoG.gain.value = 0.3;
    ampLfo.connect(ampLfoG).connect(amp.gain);
    src.connect(bp).connect(amp).connect(L.gain);
    src.connect(bp2).connect(g2).connect(amp);
    src.start(); lfo.start(); lfo2.start(); ampLfo.start();
    L.base = 0.55;
    L.nodes = [src, lfo, lfo2, ampLfo];
    // gusts
    const gust = () => {
      if (!this.layers.wind) return;
      const t = c.currentTime;
      amp.gain.setTargetAtTime(0.9, t, 0.8);
      amp.gain.setTargetAtTime(0.45, t + this._rand(1.5, 3), 1.5);
      this._after(this._rand(6, 16), gust);
    };
    this._after(3, gust);
  }

  _amb_roomTone(L) {
    const c = this.ctx;
    const src = this._src(this.brown);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    src.connect(lp).connect(L.gain);
    src.start();
    const hum = c.createOscillator(); hum.frequency.value = 55; hum.type = 'sine';
    const hg = c.createGain(); hg.gain.value = 0.02;
    hum.connect(hg).connect(L.gain); hum.start();
    L.base = 0.35;
    L.nodes = [src, hum];
  }

  _amb_creaks(L) {
    const loop = () => {
      if (!this.layers.creaks) return;
      if (this.layers.creaks.level > 0.01) this.creak(this.layers.creaks.level, L.gain);
      this._after(this._rand(7, 22), loop);
    };
    this._after(this._rand(2, 6), loop);
  }

  /** a single wooden creak / groan */
  creak(level = 1, dest = this.bus?.sfx) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    const f0 = this._rand(70, 160);
    o.frequency.setValueAtTime(f0, t);
    const dur = this._rand(0.6, 1.6);
    for (let i = 1; i <= 8; i++) o.frequency.linearRampToValueAtTime(f0 * (1 + 0.25 * Math.sin(i * 1.7) + this._rand(-0.1, 0.1)), t + (dur * i) / 8);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = this._rand(500, 1200); bp.Q.value = 6;
    const g = c.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.18 * level, t + 0.08);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.8, 0.12);
    const pan = c.createStereoPanner(); pan.pan.value = this._rand(-0.8, 0.8);
    o.connect(bp).connect(g).connect(pan).connect(dest);
    o.start(t); o.stop(t + dur + 0.6);
  }

  _amb_clock(L) {
    const c = this.ctx;
    let tick = true;
    const pan = c.createStereoPanner(); pan.pan.value = -0.35; pan.connect(L.gain);
    const iv = setInterval(() => {
      if (!this.layers.clock || this.layers.clock.level <= 0.001) return;
      const t = c.currentTime;
      const s = c.createBufferSource(); s.buffer = this.noise;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = tick ? 2600 : 2100; bp.Q.value = 5;
      const g = c.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(bp).connect(g).connect(pan);
      s.start(t, Math.random() * 2, 0.06);
      const o = c.createOscillator(); o.frequency.value = tick ? 820 : 640;
      const og = c.createGain(); og.gain.setValueAtTime(0.05, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(og).connect(pan); o.start(t); o.stop(t + 0.15);
      tick = !tick;
    }, 1000);
    L.interval = iv;
    L.base = 0.5;
  }

  /** grandfather clock chime (n strikes) */
  chimeClock(n = 3) {
    if (!this.started) return;
    for (let i = 0; i < n; i++) this._after(i * 2.2, () => this.bell(98, 0.35, 5));
  }

  _amb_thunder(L) {
    const loop = () => {
      if (!this.layers.thunder) return;
      if (this.layers.thunder.level > 0.01) this.thunder(this.layers.thunder.level, L.gain);
      this._after(this._rand(25, 70), loop);
    };
    this._after(this._rand(6, 15), loop);
  }

  thunder(level = 1, dest = this.bus?.ambience) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const s = this._src(this.brown, false);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(120, t + 4);
    const g = c.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.9 * level, t + 0.15);
    g.gain.setTargetAtTime(0.35 * level, t + 0.5, 0.6);
    g.gain.setTargetAtTime(0.0001, t + 2.5, 1.4);
    s.connect(lp).connect(g).connect(dest);
    s.start(t, this._rand(0, 3)); s.stop(t + 9);
    this.onThunder?.(level);
  }

  _amb_rain(L) {
    const c = this.ctx;
    const src = this._src(this.noise);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
    src.connect(hp).connect(lp).connect(L.gain); src.start();
    L.base = 0.18; L.nodes = [src];
  }

  _amb_heartbeat(L) {
    const c = this.ctx;
    const beat = () => {
      if (!this.layers.heartbeat) return;
      const lvl = this.layers.heartbeat.level;
      if (lvl > 0.01) for (const [dt, a] of [[0, 1], [0.28, 0.7]]) {
        const t = c.currentTime + dt;
        const o = c.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        const g = c.createGain(); g.gain.setValueAtTime(0.5 * a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g).connect(L.gain); o.start(t); o.stop(t + 0.25);
      }
      this._after(60 / (60 + lvl * 50), beat);
    };
    beat();
  }

  // ------------------------------------------------------------- music
  startMusic({ key = 50, mood = 'dread' } = {}) {
    if (!this.started || this._musicOn) return;
    this._musicOn = true;
    const c = this.ctx;
    this.musicGain = c.createGain(); this.musicGain.gain.value = 0;
    this.musicGain.connect(this.bus.music);
    this.musicGain.gain.setTargetAtTime(1, c.currentTime, 3);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.5;
    lp.connect(this.musicGain);
    this._musicLP = lp;
    // D minor-ish progression (semitones from key): i, VI, iv, V(b9), i, bII
    const prog = mood === 'dread'
      ? [[0, 3, 7, 12], [-4, 0, 3, 8], [5, 8, 12, 17], [7, 11, 14, 13], [0, 3, 7, 10], [1, 5, 8, 13]]
      : [[0, 3, 7, 12], [8, 12, 15, 20], [5, 8, 12, 15], [7, 10, 14, 19]];
    const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
    let i = 0;
    const chord = () => {
      if (!this._musicOn) return;
      const t = c.currentTime;
      const dur = 9;
      for (const st of prog[i % prog.length]) {
        for (const det of [-6, 5]) {
          const o = c.createOscillator(); o.type = 'sawtooth';
          o.frequency.value = m2f(key + st - 12); o.detune.value = det + this._rand(-3, 3);
          const g = c.createGain(); g.gain.value = 0;
          g.gain.linearRampToValueAtTime(0.022, t + 3);
          g.gain.setValueAtTime(0.022, t + dur - 1);
          g.gain.linearRampToValueAtTime(0, t + dur + 2.5);
          o.connect(g).connect(lp); o.start(t); o.stop(t + dur + 3);
        }
      }
      // bass
      const b = c.createOscillator(); b.type = 'triangle'; b.frequency.value = m2f(key + prog[i % prog.length][0] - 24);
      const bg = c.createGain(); bg.gain.value = 0; bg.gain.linearRampToValueAtTime(0.06, t + 2); bg.gain.linearRampToValueAtTime(0, t + dur + 2);
      b.connect(bg).connect(lp); b.start(t); b.stop(t + dur + 3);
      // sparse celesta motif
      if (Math.random() < 0.6) {
        const motif = [12, 15, 14, 10, 12, 7];
        const start = this._rand(1, 4);
        motif.forEach((n, k) => { if (Math.random() < 0.85) this._after(start + k * 0.62, () => this.celesta(m2f(key + n + 12 + prog[i % prog.length][0] * 0), 0.05)); });
      }
      i++;
      this._after(dur, chord);
    };
    chord();
  }
  stopMusic(fade = 3) {
    if (!this._musicOn) return;
    this._musicOn = false;
    const g = this.musicGain;
    g.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
    this._after(fade + 2, () => g.disconnect());
  }

  celesta(freq, level = 0.06) {
    const c = this.ctx, t = c.currentTime;
    for (const [mult, a, d] of [[1, 1, 2.2], [2.0, 0.35, 1.1], [3.01, 0.12, 0.6], [4.2, 0.06, 0.3]]) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq * mult;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level * a, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(this.bus.music); o.start(t); o.stop(t + d + 0.1);
    }
  }

  bell(freq = 220, level = 0.2, decay = 4, dest = this.bus?.sfx) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    for (const [m, a] of [[1, 1], [2.76, 0.45], [5.4, 0.25], [8.93, 0.12], [0.5, 0.3]]) {
      const o = c.createOscillator(); o.frequency.value = freq * m;
      const g = c.createGain(); g.gain.setValueAtTime(level * a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + decay / Math.sqrt(m));
      o.connect(g).connect(dest); o.start(t); o.stop(t + decay + 0.1);
    }
  }

  // ------------------------------------------------------------- sfx
  sfx(name, opts = {}) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime, out = this.bus.sfx;
    const env = (g, a, d, peak) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    switch (name) {
      case 'hover': {
        const o = c.createOscillator(); o.frequency.value = 1800; o.type = 'sine';
        const g = c.createGain(); env(g, 0.002, 0.05, 0.015);
        o.connect(g).connect(out); o.start(t); o.stop(t + 0.08); break;
      }
      case 'click': {
        const s = c.createBufferSource(); s.buffer = this.noise;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 3;
        const g = c.createGain(); env(g, 0.001, 0.08, 0.25);
        s.connect(bp).connect(g).connect(out); s.start(t, Math.random(), 0.1);
        const o = c.createOscillator(); o.frequency.value = 180;
        const og = c.createGain(); env(og, 0.002, 0.1, 0.12);
        o.connect(og).connect(out); o.start(t); o.stop(t + 0.15); break;
      }
      case 'whoosh': {
        const d = opts.duration ?? 1.2;
        const s = this._src(this.noise, false);
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(250, t); bp.frequency.exponentialRampToValueAtTime(1100, t + d * 0.5); bp.frequency.exponentialRampToValueAtTime(300, t + d);
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06 * (opts.level ?? 1), t + d * 0.45); g.gain.linearRampToValueAtTime(0, t + d);
        s.connect(bp).connect(g).connect(out); s.start(t); s.stop(t + d + 0.1); break;
      }
      case 'stinger': case 'solved': {
        const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
        const notes = name === 'solved' ? [62, 65, 69, 74, 77] : [50, 51, 57, 62];
        notes.forEach((n, k) => {
          const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = m2f(n);
          const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(2400, t + 1.5);
          const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.4 + k * 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
          o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + 5);
        });
        this.bell(name === 'solved' ? 587 : 147, 0.15, 5); break;
      }
      case 'fail': {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.5);
        const g = c.createGain(); env(g, 0.01, 0.6, 0.3);
        o.connect(g).connect(out); o.start(t); o.stop(t + 0.7); break;
      }
      case 'door': this.creak(1.4, out); this._after(0.9, () => this.sfx('thud')); break;
      case 'thud': {
        const s = this._src(this.brown, false);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
        const g = c.createGain(); env(g, 0.005, 0.5, 0.8);
        s.connect(lp).connect(g).connect(out); s.start(t); s.stop(t + 0.6); break;
      }
      case 'chime': this.bell(opts.freq ?? 880, 0.08, 2.5); break;
      case 'pickup': this.celesta(1046, 0.08); this._after(0.1, () => this.celesta(1568, 0.06)); break;
      case 'page': {
        const s = c.createBufferSource(); s.buffer = this.noise;
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        s.connect(hp).connect(g).connect(out); s.start(t, Math.random(), 0.4); break;
      }
      case 'laugh': this.staufLaugh(); break;
      default: break;
    }
  }

  /** Ghostly descending laugh placeholder (until voiced lines exist). */
  staufLaugh() {
    if (!this.started) return;
    const c = this.ctx;
    for (let i = 0; i < 6; i++) {
      const t = c.currentTime + i * 0.17;
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(190 - i * 12, t); o.frequency.exponentialRampToValueAtTime(140 - i * 10, t + 0.14);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 4;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(f).connect(g).connect(this.bus.voice); o.start(t); o.stop(t + 0.2);
    }
  }

  // ------------------------------------------------------------- voice
  /**
   * Speak a line with subtitles. line: string | { text, speaker, url, duration }
   * Returns a promise resolving when the line ends.
   */
  async say(line) {
    const L = typeof line === 'string' ? { text: line } : line;
    const words = (L.text || '').split(/\s+/).length;
    let duration = L.duration ?? Math.max(1.8, words * 0.36 + 0.6);
    let node = null;
    if (L.url && this.started) {
      try {
        const buf = await this._load(L.url);
        node = this.ctx.createBufferSource(); node.buffer = buf; node.connect(this.bus.voice); node.start();
        duration = buf.duration;
      } catch (e) { console.warn('[audio] voice load failed', e); }
    } else if (this.started && L.murmur !== false) {
      this._murmur(duration, L.speaker);
    }
    this.subtitleHook?.(L, duration);
    await new Promise((r) => setTimeout(r, duration * 1000));
  }

  _murmur(duration, speaker = 'stauf') {
    const c = this.ctx, t0 = c.currentTime;
    const s = this._src(this.noise, true);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = speaker === 'stauf' ? 650 : 900; bp.Q.value = 2.5;
    const bp2 = c.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 1800; bp2.Q.value = 3;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(bp).connect(g); s.connect(bp2).connect(g);
    g.connect(this.bus.voice);
    let t = t0;
    while (t < t0 + duration - 0.2) {
      const syl = this._rand(0.11, 0.24);
      g.gain.setTargetAtTime(this._rand(0.05, 0.12), t, 0.02);
      g.gain.setTargetAtTime(0.005, t + syl * 0.7, 0.03);
      bp.frequency.setTargetAtTime(this._rand(450, 950), t, 0.05);
      t += syl + (Math.random() < 0.15 ? 0.25 : 0.03);
    }
    g.gain.setTargetAtTime(0, t0 + duration - 0.1, 0.05);
    s.start(t0); s.stop(t0 + duration + 0.3);
  }

  async _load(url) {
    if (this.buffers.has(url)) return this.buffers.get(url);
    const res = await fetch(url);
    const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
    this.buffers.set(url, buf);
    return buf;
  }

  /** Play an audio file on a bus. */
  async play(url, { bus = 'sfx', loop = false, volume = 1 } = {}) {
    if (!this.started) return null;
    const buf = await this._load(url);
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = loop;
    const g = this.ctx.createGain(); g.gain.value = volume;
    s.connect(g).connect(this.bus[bus] || this.bus.sfx); s.start();
    return { stop: () => s.stop(), gain: g };
  }

  /** Duck everything but voice briefly (for dramatic lines). */
  duck(amount = 0.4, sec = 2) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    for (const k of ['music', 'ambience']) {
      const g = this.bus[k].gain; const v = g.value;
      g.setTargetAtTime(v * amount, t, 0.2); g.setTargetAtTime(v, t + sec, 0.6);
    }
  }

  stopAmbience() {
    for (const [k, L] of Object.entries(this.layers)) {
      L.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      if (L.interval) clearInterval(L.interval);
      const nodes = L.nodes || [];
      setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* */ } }); L.gain.disconnect(); }, 3000);
      delete this.layers[k];
    }
  }
}
