/**
 * Small WebAudio instrument synthesis for the music room: an additive piano
 * voice (inharmonic partials, per-partial decay, hammer thump, filter sweep),
 * a plucked harp voice and a bowed cello sigh. Everything routes through the
 * engine's sfx bus (and therefore its reverb send). Silent when audio is off.
 */

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function out(audio) {
  if (!audio || !audio.ctx || !audio.bus) return null;
  return { c: audio.ctx, dest: audio.bus.sfx, noise: audio.noise };
}

/** Piano note. ghost=true adds a detuned shimmer and a longer, colder tail. */
export function pianoNote(audio, midi, { velocity = 0.8, ghost = false, when = 0, length = 2.8 } = {}) {
  const o = out(audio);
  if (!o) return;
  const { c, dest } = o;
  const t0 = c.currentTime + when;
  const f = mtof(midi);
  const B = 0.00035 * Math.pow(f / 260, 0.5);
  const master = c.createGain();
  master.gain.value = 0.22 * velocity;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.4;
  lp.frequency.setValueAtTime(Math.min(16000, f * (8 + velocity * 10)), t0);
  lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2.5), t0 + length * 0.8);
  master.connect(lp).connect(dest);
  const partials = f > 1200 ? 4 : 8;
  for (let n = 1; n <= partials; n++) {
    const fn = f * n * Math.sqrt(1 + B * n * n);
    if (fn > 18000) break;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = fn;
    const g = c.createGain();
    const amp = (1 / Math.pow(n, 1.15)) * (n === 1 ? 1 : 0.9) * (1 - Math.max(0, (n - 5) * 0.08));
    const tau = (length / (1 + n * 0.45)) * (f < 220 ? 1.4 : 1);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(amp, t0 + 0.004);
    g.gain.setTargetAtTime(amp * 0.45, t0 + 0.004, 0.08);
    g.gain.setTargetAtTime(0.0, t0 + 0.12, tau * 0.45);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + length + 0.5);
  }
  if (ghost) {
    // cold shimmer an octave up, slightly detuned, swelling in after the attack
    for (const det of [-7, 6]) {
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f * 2;
      osc.detune.value = det;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.05, t0 + 0.25);
      g.gain.setTargetAtTime(0, t0 + 0.4, length * 0.35);
      osc.connect(g).connect(master);
      osc.start(t0); osc.stop(t0 + length + 0.5);
    }
  }
  // hammer thump
  if (o.noise) {
    const src = c.createBufferSource();
    src.buffer = o.noise;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = Math.min(4000, f * 3); bp.Q.value = 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.12 * velocity, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
    src.connect(bp).connect(g).connect(master);
    src.start(t0, (midi * 0.137) % 2, 0.06);
  }
}

/** Plucked harp string (Karplus-ish: filtered noise burst into partials). */
export function harpNote(audio, midi, { when = 0, velocity = 0.6 } = {}) {
  const o = out(audio);
  if (!o) return;
  const { c, dest } = o;
  const t0 = c.currentTime + when;
  const f = mtof(midi);
  const master = c.createGain();
  master.gain.value = 0.16 * velocity;
  master.connect(dest);
  for (let n = 1; n <= 5; n++) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f * n;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1 / (n * n * 0.7 + 0.3), t0 + 0.003);
    g.gain.setTargetAtTime(0, t0 + 0.003, 0.9 / n);
    osc.connect(g).connect(master);
    osc.start(t0); osc.stop(t0 + 3.5);
  }
}

/** A long bowed cello note with vibrato. */
export function celloNote(audio, midi, { when = 0, length = 2.4 } = {}) {
  const o = out(audio);
  if (!o) return;
  const { c, dest } = o;
  const t0 = c.currentTime + when;
  const f = mtof(midi);
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = f;
  const vib = c.createOscillator();
  vib.frequency.value = 5.2;
  const vg = c.createGain();
  vg.gain.setValueAtTime(0, t0);
  vg.gain.linearRampToValueAtTime(f * 0.006, t0 + 0.6);
  vib.connect(vg).connect(osc.frequency);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = f * 5; lp.Q.value = 2;
  const body = c.createBiquadFilter();
  body.type = 'peaking'; body.frequency.value = 220; body.gain.value = 6; body.Q.value = 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.09, t0 + 0.35);
  g.gain.setValueAtTime(0.09, t0 + length - 0.6);
  g.gain.linearRampToValueAtTime(0, t0 + length);
  osc.connect(lp).connect(body).connect(g).connect(dest);
  osc.start(t0); vib.start(t0);
  osc.stop(t0 + length + 0.1); vib.stop(t0 + length + 0.1);
}

export { mtof };
