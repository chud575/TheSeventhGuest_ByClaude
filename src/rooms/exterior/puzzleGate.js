import * as THREE from 'three';

/**
 * "The Gate of Keys" — the lock on Stauf's gate is a cast-iron medallion of four
 * concentric rings around a fixed boss. Together, aligned, the rings show a
 * gilded key and a circular inscription. Turning a ring drags its outer
 * neighbour with it, so the rings must be set from the heart outward.
 *
 * Left click / scroll down: clockwise.  Right click / shift-click / scroll up: anticlockwise.
 */

export const STEPS = 8;
export const START = [3, 6, 2, 5];   // initial offsets (in 1/8 turns, clockwise), innermost first
const RADII = [0.085, 0.152, 0.219, 0.286, 0.352];   // ring boundaries: boss | r0 | r1 | r2 | r3
const OUTER = 0.42;

export const gateMeta = {
  id: 'exterior.gate',
  title: 'The Gate of Keys',
  description: 'The gate has no keyhole, only a medallion of iron rings. Somewhere in the rust, a key is waiting to be assembled.',
  hints: [
    'Every ring hides a piece of one picture, and a line of the inscription. Make them whole.',
    'A ring never turns alone: it drags the ring outside it along. The outermost ring is the only free one.',
    'Begin at the heart. Set the innermost ring first, then the next, working outward; each ring you fix is never disturbed again. Right-click turns a ring back.',
  ],
};

/** Draw the solved medallion artwork (colour or height) into a canvas. */
function drawMedallion(g, S, mode) {
  const C = S / 2;
  const k = S / (2 * OUTER);
  const H = mode === 'height';
  const gold = H ? '#ffffff' : '#c99a45';
  const goldDark = H ? '#b0b0b0' : '#8a6328';
  g.fillStyle = H ? '#383838' : '#16130f';
  g.fillRect(0, 0, S, S);
  // hammered iron texture
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 1 + Math.random() * 3;
    const v = Math.random();
    g.fillStyle = H ? `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},0.05)` : `rgba(${60 + v * 40},${50 + v * 30},${40 + v * 20},0.08)`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.save();
  g.translate(C, C);
  // ring grooves + beaded borders
  for (let i = 0; i < RADII.length; i++) {
    const r = RADII[i] * k;
    g.strokeStyle = H ? '#202020' : '#050403';
    g.lineWidth = S * 0.006;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
    if (i > 0) {
      const n = Math.round(r * 0.16);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        g.fillStyle = goldDark;
        g.beginPath(); g.arc(Math.cos(a) * (r - S * 0.009), Math.sin(a) * (r - S * 0.009), S * 0.0028, 0, Math.PI * 2); g.fill();
      }
    }
  }
  // inscription, one line per ring, reading clockwise from the top
  const lines = [
    null,
    'SEVENTH • GUEST • ',
    'WHO WILL BE THE • WHO WILL BE THE • ',
    'BUT ONE WAS EXPECTED • SIX CAME UP THE HILL • ',
    'ENTER FREELY, AND LEAVE SOMETHING OF THE HAPPINESS YOU BRING • ',
  ];
  for (let i = 1; i < lines.length; i++) {
    const r0 = RADII[i - 1] * k, r1 = RADII[i] * k;
    const rm = (r0 + r1) / 2 - S * 0.004;
    const txt = lines[i];
    const fs = (r1 - r0) * 0.42;
    g.font = `600 ${fs}px "Cinzel", "Times New Roman", serif`;
    g.fillStyle = gold;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // fit text around 330 degrees, leaving a gap at the top for the key notch
    const total = txt.length;
    const span = Math.PI * 2 * 0.86;
    for (let j = 0; j < total; j++) {
      const a = -Math.PI / 2 + Math.PI * 2 * 0.07 + (j / total) * span;
      g.save();
      g.rotate(a + Math.PI / 2);
      g.translate(0, -rm);
      g.fillText(txt[j], 0, 0);
      g.restore();
    }
    // alignment pip at 12 o'clock on each ring
    g.fillStyle = gold;
    g.beginPath();
    g.moveTo(0, -r1 + S * 0.004); g.lineTo(-S * 0.012, -r0 - S * 0.004); g.lineTo(S * 0.012, -r0 - S * 0.004); g.closePath(); g.fill();
  }
  // the key: bow on the boss, shaft across all rings toward 4 o'clock, bit at the rim
  g.save();
  g.rotate(Math.PI * 0.2);
  const kw = S * 0.022;
  g.fillStyle = gold;
  g.strokeStyle = gold;
  // shaft
  g.fillRect(RADII[0] * k * 0.6, -kw / 2, (RADII[4] - RADII[0] * 0.6) * k * 0.97, kw);
  // collars along the shaft (one in every ring, so each ring carries a recognisable piece)
  for (let i = 1; i < 5; i++) {
    const x = (RADII[i - 1] + RADII[i]) / 2 * k;
    g.fillRect(x - S * 0.008, -kw * 1.1, S * 0.016, kw * 2.2);
  }
  // bit (wards) at the outer ring
  const bx = RADII[3] * k + S * 0.01;
  g.fillRect(bx, kw / 2, S * 0.03, S * 0.045);
  g.fillRect(bx + S * 0.04, kw / 2, S * 0.022, S * 0.06);
  g.fillRect(bx + S * 0.068, kw / 2, S * 0.018, S * 0.035);
  g.restore();
  // bow: quatrefoil on the boss with a monogram
  g.lineWidth = S * 0.012;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    g.beginPath(); g.arc(Math.cos(a) * S * 0.035, Math.sin(a) * S * 0.035, S * 0.03, 0, Math.PI * 2); g.stroke();
  }
  g.font = `700 ${S * 0.07}px "Cinzel", serif`;
  g.fillText('S', 0, S * 0.004);
  // outer frame: twelve rivets + a notch at the top (the keyway)
  const ro = (RADII[4] + OUTER) / 2 * k;
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * Math.PI * 2 + Math.PI / 12;
    const grd = g.createRadialGradient(Math.cos(a) * ro - 3, Math.sin(a) * ro - 3, 1, Math.cos(a) * ro, Math.sin(a) * ro, S * 0.014);
    grd.addColorStop(0, H ? '#fff' : '#d8b070'); grd.addColorStop(1, H ? '#555' : '#3a2a14');
    g.fillStyle = grd;
    g.beginPath(); g.arc(Math.cos(a) * ro, Math.sin(a) * ro, S * 0.013, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = gold;
  g.beginPath(); g.moveTo(0, -RADII[4] * k + S * 0.002); g.lineTo(-S * 0.022, -OUTER * k + S * 0.01); g.lineTo(S * 0.022, -OUTER * k + S * 0.01); g.closePath(); g.fill();
  g.restore();
}

function annulus(r0, r1, depth) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, 0, Math.PI * 2, false);
  if (r0 > 0) { const h = new THREE.Path(); h.absarc(0, 0, r0, 0, Math.PI * 2, true); s.holes.push(h); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 72 });
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * OUTER) + 0.5, p.getY(i) / (2 * OUTER) + 0.5);
  return g;
}

/** Build the medallion mesh group. Faces +Z, centred at origin. */
export function createMedallion(ctx) {
  const S = 1024;
  const seed = 7;
  // deterministic "random" for the canvas noise
  const rand = (() => { let a = seed; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
  const draw = (mode) => (g) => { const mr = Math.random; Math.random = rand; try { drawMedallion(g, S, mode); } finally { Math.random = mr; } };
  const colorTex = ctx.textures.canvas('ext:medallion:c2', S, S, draw('color'), { tile: false });
  const bumpTex = ctx.textures.canvas('ext:medallion:h2', S, S, draw('height'), { srgb: false, tile: false });
  const mat = new THREE.MeshStandardMaterial({
    map: colorTex, bumpMap: bumpTex, bumpScale: 2.0, metalness: 0.75, roughness: 0.42, name: 'medallion', envMapIntensity: 1.4,
    emissive: new THREE.Color(1.0, 0.7, 0.3), emissiveMap: colorTex, emissiveIntensity: 0,
  });
  const group = new THREE.Group();
  group.name = 'medallion';
  // backing plate (fixed frame + boss)
  const frame = new THREE.Mesh(annulus(RADII[4] + 0.002, OUTER, 0.03), mat);
  frame.position.z = -0.005;
  group.add(frame);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(OUTER - 0.01, OUTER - 0.01, 0.02, 48), new THREE.MeshStandardMaterial({ color: 0x080706, roughness: 0.6, metalness: 0.6 }));
  back.rotation.x = Math.PI / 2; back.position.z = -0.012;
  group.add(back);
  const boss = new THREE.Mesh(annulus(0, RADII[0] - 0.002, 0.045), mat);
  group.add(boss);
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(annulus(RADII[i] + 0.002, RADII[i + 1] - 0.002, 0.024 + (3 - i) * 0.006), mat);
    m.position.z = 0.0;
    m.userData.ring = i;
    group.add(m);
    rings.push(m);
  }
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group, rings, material: mat };
}

/**
 * Puzzle logic. `rings` are the ring meshes, `onSolved` opens the gate.
 * State is kept in ctx.state under 'exterior.gateRings' so it survives saves.
 */
export function createGatePuzzle(ctx, { rings, material, worldCenter, onSolved }) {
  const key = 'exterior.gateRings';
  let off = (ctx.state.get(key) || START).slice();
  const shown = off.map((o) => o);           // animated display value (in steps)
  let hover = -1;
  const apply = () => { rings.forEach((r, i) => { r.rotation.z = -(shown[i] / STEPS) * Math.PI * 2; }); };
  const solvedNow = () => off.every((o) => ((o % STEPS) + STEPS) % STEPS === 0);
  if (ctx.state.isSolved?.(gateMeta.id)) { off = [0, 0, 0, 0]; shown.splice(0, 4, 0, 0, 0, 0); }
  apply();

  const turn = (i, d) => {
    for (const j of [i, i + 1]) if (j < 4) off[j] += d;
    ctx.state.set(key, off.map((o) => ((o % STEPS) + STEPS) % STEPS));
  };
  const ringAt = (ndc, p) => {
    const hit = p.raycast(rings, ndc)[0];
    return hit ? hit.object.userData.ring : -1;
  };
  const cam = worldCenter.clone();
  const puzzle = {
    ...gateMeta,
    camera: { position: [cam.x, cam.y + 0.02, cam.z + 1.35], target: [cam.x, cam.y, cam.z], fov: 38 },
    setup(p) {
      p.status('Turn the rings until the key is whole. Left click: clockwise • right click: back.');
      off = (ctx.state.get(key) || off).slice();
    },
    update(dt) {
      let moving = false;
      for (let i = 0; i < 4; i++) {
        const d = off[i] - shown[i];
        if (Math.abs(d) > 0.001) { shown[i] += d * Math.min(1, dt * 9); moving = true; } else shown[i] = off[i];
      }
      material.emissiveIntensity += ((hover >= 0 ? 0.0 : 0) + (puzzle._glow || 0) - material.emissiveIntensity) * Math.min(1, dt * 3);
      apply();
      return moving;
    },
    cursorAt(ndc, p) { hover = ringAt(ndc, p); return hover >= 0 ? 'grab' : 'default'; },
    onPointer(type, e, ndc, p) {
      if (type === 'wheel') {
        const i = ringAt(ndc, p);
        if (i < 0) return;
        turn(i, (e.deltaY || 0) > 0 ? 1 : -1);
      } else if (type === 'up') {
        const i = ringAt(ndc, p);
        if (i < 0) return;
        const back = e.button === 2 || e.shiftKey || e.altKey;
        turn(i, back ? -1 : 1);
      } else return;
      ctx.audio.sfx?.('click', { freq: 220 + 40 * (hover < 0 ? 0 : hover) });
      if (solvedNow()) {
        puzzle._glow = 2.2;
        p.status('The key is whole. Something heavy shifts inside the pillar.');
        p.solve();
      } else {
        const fixed = off.findIndex((o) => ((o % STEPS) + STEPS) % STEPS !== 0);
        p.status(fixed < 0 ? '' : `${fixed} of 4 rings set from the heart.`);
      }
    },
    reset(p) { off = START.slice(); ctx.state.set(key, off.slice()); p.status('The rings grind back to where Stauf left them.'); },
    autoSolve(p) { off = off.map((o) => Math.round(o / STEPS) * STEPS); puzzle._glow = 2.2; p.solve(); },
    onSolved() { puzzle._glow = 2.2; onSolved?.(); },
    teardown() { hover = -1; puzzle._glow = ctx.state.isSolved?.(gateMeta.id) ? 0.35 : 0; },
    // QA helpers
    get offsets() { return off.slice(); },
    turn,
    solvedNow,
  };
  return puzzle;
}
