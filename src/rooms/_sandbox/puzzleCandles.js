/**
 * Demo puzzle ("lights-out" for three flames): touching a candle toggles it and
 * its neighbours. Light all three. Shows the full puzzle API: meta (for the Book
 * of Hints), camera, setup/teardown, pointer handling, cursorAt, reset, autoSolve.
 */
const meta = {
  id: 'sandbox.candles',
  title: 'The Three Flames',
  description: 'Each flame is jealous of its neighbours. Kindle all three.',
  hints: [
    'Touching a candle changes it — and the candles beside it.',
    'The middle candle affects all three. The outer ones only two.',
    'Touch every candle exactly once, in any order.',
  ],
};

function create({ candles, light }) {
  let state = [1, 0, 1];
  const apply = () => {
    candles.forEach((c, i) => {
      const f = c.userData.flame;
      if (f) f.visible = !!state[i];
      c.userData.body.material.emissiveIntensity = state[i] ? 0.04 : 0;
    });
    const lit = state.reduce((a, b) => a + b, 0);
    light.intensity = 0.4 + lit * 0.75;
  };
  apply();
  return {
    ...meta,
    camera: { position: [1.0, 1.25, 0.95], target: [0.3, 0.98, 0.2], fov: 42 },
    setup(p) { p.status('Light all three candles.'); apply(); },
    teardown() { apply(); },
    reset(p) { state = [1, 0, 1]; apply(); p.status('The flames settle back as they were.'); },
    cursorAt(ndc, p) { return p.raycast(candles, ndc).length ? 'grab' : 'default'; },
    onPointer(type, e, ndc, p) {
      if (type !== 'up') return;
      const hit = p.raycast(candles, ndc)[0];
      if (!hit) return;
      let idx = -1;
      candles.forEach((c, i) => { let o = hit.object; while (o) { if (o === c) idx = i; o = o.parent; } });
      if (idx < 0) return;
      for (const j of [idx - 1, idx, idx + 1]) if (j >= 0 && j < 3) state[j] ^= 1;
      apply();
      p.audio.sfx('chime', { freq: 660 + idx * 110 });
      if (state.every(Boolean)) p.solve();
      else p.status(`${state.filter(Boolean).length} of 3 alight.`);
    },
    autoSolve(p) { state = [1, 1, 1]; apply(); p.solve(); },
  };
}

export const candlesPuzzle = { meta, create };
