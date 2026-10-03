import * as THREE from 'three';
import { buildLabelAtlas } from './labels.js';

/**
 * The Soup Can Puzzle (homage): three shelves of Stauf's Superior Soups, one big
 * lithographed letter per tin. The gaps on the shelves mark word breaks. Click a
 * tin to lift it, click another to swap them. Spell Stauf's recipe to solve.
 *
 *   top shelf:    T H E   S O U P   I S
 *   middle shelf: M A D E   O F
 *   bottom shelf: G U E S T S
 */

export const CANS_ID = 'kitchen.cans';
export const SENTENCE = [['THE', 'SOUP', 'IS'], ['MADE', 'OF'], ['GUESTS']];
const SOLUTION = SENTENCE.map((r) => r.join('')).join('');

export const cansMeta = {
  id: CANS_ID,
  title: 'Stauf’s Superior Soups',
  description: 'A pantry shelf of soup tins, each stamped with a single letter. The cook left a recipe here — if you can stomach reading it.',
  hints: [
    'The pepper pots and spice bottles standing among the tins mark the spaces between words. Read the shelves from the top down, like a page.',
    'The bottom shelf is a single six-letter word: those who come to dinner at this house. The top shelf begins with THE.',
    'Arrange the tins to read: THE SOUP IS / MADE OF / GUESTS.',
  ],
};

const PITCH = 0.094, GAP = 0.056;

// three tin formats: standard 1 lb, tall, squat; each with its own bead count and lid style
export const FORMATS = [
  { r: 0.039, h: 0.112, beads: 2, lid: 'rings' },
  { r: 0.0355, h: 0.126, beads: 3, lid: 'cap' },
  { r: 0.045, h: 0.084, beads: 1, lid: 'dome' },
];
const formatOf = (i) => [0, 1, 0, 0, 2, 0, 1, 0, 2, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 2, 0, 1][i % 22];
const labelSpan = (F) => [0.013, F.h - 0.013];
export const labelUnits = (F) => { const [a, b] = labelSpan(F); return (768 * (b - a)) / (2 * Math.PI * F.r); };

// deterministic scramble that leaves no tin in its home slot
function scramble(n) {
  let s = 1993;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const a = [...Array(n).keys()];
  for (let tries = 0; tries < 50; tries++) {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.every((c, i) => SOLUTION[c] !== SOLUTION[i])) break;
  }
  return a;
}

// circumferential bead ribs pressed into the body near both rims (in the gilt bands, clear of the letter)
function beadFn(F) {
  const ys = [];
  for (let k = 0; k < F.beads; k++) { ys.push(0.0205 + k * 0.006); ys.push(F.h - 0.0205 - k * 0.006); }
  return (y) => { let d = 0; for (const b of ys) d = Math.max(d, Math.exp(-((y - b) ** 2) / 0.0000016)); return d * 0.0011; };
}

function tinGeometry(G, F) {
  const { r, h } = F;
  const bead = beadFn(F);
  // double-seamed rims top & bottom (a rolled bead standing proud), beaded body, lid by style
  const pts = [
    [0.0, 0.0015], [r * 0.86, 0.0015], [r * 0.9, 0.0], [r + 0.0008, 0.0006], [r + 0.0022, 0.0022], [r + 0.0024, 0.0045], [r + 0.0018, 0.0068], [r + 0.0004, 0.0078], [r, 0.009],
  ];
  for (let y = 0.012; y <= h - 0.012 + 1e-6; y += 0.0015) pts.push([r - 0.0004 - bead(y), y]);
  pts.push([r, h - 0.009], [r + 0.0004, h - 0.0078], [r + 0.0018, h - 0.0068], [r + 0.0024, h - 0.0045], [r + 0.0022, h - 0.0018], [r + 0.0012, h - 0.0004], [r * 0.97, h], [r * 0.94, h - 0.0028]);
  if (F.lid === 'rings') pts.push([r * 0.82, h - 0.0034], [r * 0.79, h - 0.0022], [r * 0.76, h - 0.0034], [r * 0.6, h - 0.0034], [r * 0.57, h - 0.0024], [r * 0.54, h - 0.0034], [r * 0.3, h - 0.0034], [r * 0.27, h - 0.0026], [r * 0.24, h - 0.0034], [0.0, h - 0.0034]);
  else if (F.lid === 'cap') pts.push([r * 0.8, h - 0.0034], [r * 0.36, h - 0.0034], [r * 0.34, h - 0.0016], [r * 0.32, h - 0.0008], [r * 0.12, h - 0.0008], [r * 0.1, h - 0.0016], [0.0, h - 0.0016]);
  else pts.push([r * 0.86, h - 0.0034], [r * 0.7, h - 0.0026], [r * 0.45, h - 0.0016], [0.0, h - 0.0012]);
  const g = G.latheFromProfile(pts, 64);
  // AO in the crevices: where the seams meet the body, under the lid's chuck wall
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), rad = Math.hypot(p.getX(i), p.getZ(i));
    let ao = 1;
    ao -= 0.45 * Math.exp(-((y - 0.0105) ** 2) / 0.000003) + 0.45 * Math.exp(-((y - (h - 0.0105)) ** 2) / 0.000003);
    if (y > h - 0.004 && rad < r * 0.95) ao -= 0.4 * Math.exp(-((rad - r * 0.93) ** 2) / 0.000004);
    ao -= 0.3 * bead(y) / 0.0011;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.max(0.35, ao);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Label (lithographed print) skin following the beads; dented per seed. */
function labelGeometry(rect, seed, dentAmt, F) {
  const [y0, y1] = labelSpan(F);
  const bead = beadFn(F);
  const pts = [];
  const N = 64;
  for (let j = 0; j <= N; j++) { const y = y0 + (j / N) * (y1 - y0); pts.push(new THREE.Vector2(F.r + 0.0002 - bead(y), y)); }
  const g = new THREE.LatheGeometry(pts, 80);
  g.rotateY(Math.PI);                       // u = 0.5 faces +Z
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, rect.u0 + uv.getX(i) * (rect.u1 - rect.u0), rect.v0 + uv.getY(i) * (rect.v1 - rect.v0));
  dent(pos, seed, dentAmt, F.h);
  g.computeVertexNormals();
  return g;
}

/** Push a dent (or two) into a tin's side, away from the letter face; a knocked rim on some. */
function dent(pos, seed, amt, H) {
  if (amt <= 0) return;
  const dents = [[Math.PI + (((seed * 1.7) % 2) - 1) * 1.3, 0.025 + (seed % 5) * 0.012 * (H / 0.112), 0.06 * amt]];
  if (seed % 3 === 0) dents.push([((seed * 2.3) % 6.28), H * 0.72, 0.035 * amt]);
  const rimA = (seed * 2.71) % 6.28, rimK = seed % 4 === 1 ? 0.05 * amt : 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(x, z);
    let k = 1 + 0.0015 * Math.sin(a * 7 + seed);
    if (y > 0.006 && y < H - 0.006) {
      for (const [da, dy, s] of dents) {
        let d = Math.cos(a - da); d = Math.max(0, d - 0.88) / 0.12;
        k -= d * d * Math.exp(-((y - dy) ** 2) / 0.0003) * s;
      }
    }
    // a knocked top rim: flattened over a short arc
    if (rimK > 0 && y > H - 0.014) { const d = Math.max(0, Math.cos(a - rimA) - 0.9) / 0.1; k -= d * rimK * ((y - (H - 0.014)) / 0.014); }
    pos.setXYZ(i, x * k, y, z * k);
  }
}

/**
 * Build the tins on the dresser.
 * @param ctx room ctx
 * @param parent dresser group (local +Z = out of the shelves, +X along the shelf)
 * @param shelves [{ y, zFront }] top row first (local coords)
 * @param opts { tinMat, camera } camera: puzzle camera in world space
 */
export async function createCansPuzzle(ctx, parent, shelves, { tinMat, camera, onSolved } = {}) {
  const { geometry: G } = ctx;
  const letters = SOLUTION.split('');
  const heights = [...letters.map((_, i) => labelUnits(FORMATS[formatOf(i)])), labelUnits(FORMATS[0])];
  const atlas = await buildLabelAtlas(letters, { extras: ['7'], heights });
  const labelMat = new THREE.MeshPhysicalMaterial({
    map: atlas.map, roughnessMap: atlas.orm, metalnessMap: atlas.orm, roughness: 1, metalness: 1,
    clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 0.7, name: 'canLabel',
  });
  const tinMatV = tinMat.clone(); tinMatV.vertexColors = true; tinMatV.name = 'tinPlateAO'; tinMatV.envMapIntensity = 0.75;
  const tinGeos = FORMATS.map((F) => tinGeometry(G, F));

  // ---- slots (local to the dresser)
  const slots = [];
  SENTENCE.forEach((words, row) => {
    const n = words.join('').length;
    const width = n * PITCH + (words.length - 1) * GAP;
    let x = -width / 2 + PITCH / 2;
    const { y, zFront } = shelves[row];
    words.forEach((w, wi) => {
      for (let k = 0; k < w.length; k++) { slots.push(new THREE.Vector3(x, y, zFront - 0.08)); x += PITCH; }
      if (wi < words.length - 1) x += GAP;
    });
  });

  // layout for the room's set dressing: row extents and the word gaps
  const layout = SENTENCE.map((words, row) => {
    const n = words.join('').length;
    const width = n * PITCH + (words.length - 1) * GAP;
    const gaps = [];
    let x = -width / 2;
    words.forEach((w, wi) => { x += w.length * PITCH; if (wi < words.length - 1) { gaps.push(x + GAP / 2); x += GAP; } });
    return { y: shelves[row].y, z: shelves[row].zFront - 0.08, x0: -width / 2, x1: width / 2, gaps };
  });

  // ---- tins
  const cans = letters.map((L, i) => {
    const g = new THREE.Group();
    g.name = `can-${i}-${L}`;
    const F = FORMATS[formatOf(i)];
    const dentAmt = [0, 0.6, 1.0, 0.3, 0.8, 0, 0.5][i % 7];
    const label = new THREE.Mesh(labelGeometry(atlas.uvRect(i), i + 1, dentAmt, F), labelMat);
    let tg = tinGeos[formatOf(i)];
    if (dentAmt > 0) { tg = tg.clone(); dent(tg.attributes.position, i + 1, dentAmt, F.h); tg.computeVertexNormals(); }
    const tin = new THREE.Mesh(tg, tinMatV);
    label.castShadow = tin.castShadow = true;
    label.receiveShadow = tin.receiveShadow = true;
    g.add(tin, label);
    g.userData.canIndex = i;
    g.userData.letter = L;
    g.userData.yaw = ((i * 7919) % 13 - 6) * 0.0115;            // up to +-4 degrees
    g.userData.off = new THREE.Vector3((((i * 4241) % 9) - 4) * 0.0005, 0, (((i * 6113) % 9) - 4) * 0.0005);
    g.rotation.y = g.userData.yaw;
    parent.add(g);
    return g;
  });
  const holder = new THREE.Group(); holder.userData.dynamic = true; holder.userData.keep = true;
  parent.add(holder);
  cans.forEach((c) => holder.add(c));

  // ---- state
  const saved = ctx.state.get?.('kitchen.cansOrder');
  let canAt = Array.isArray(saved) && saved.length === letters.length ? [...saved] : scramble(letters.length);
  if (ctx.state.isSolved(CANS_ID)) canAt = letters.map((_, i) => i);
  let lifted = -1;                         // slot index currently lifted
  const anim = cans.map(() => ({ from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, arc: 0 }));
  const word = () => canAt.map((c) => letters[c]).join('');
  const slotOfCan = (c) => canAt.indexOf(c);
  const LIFT = new THREE.Vector3(0, 0.03, 0.06);
  const place = (instant) => {
    canAt.forEach((c, s) => {
      const target = slots[s].clone().add(cans[c].userData.off);
      if (s === lifted) target.add(LIFT);
      const a = anim[c];
      if (instant) { cans[c].position.copy(target); a.t = 1; a.to.copy(target); return; }
      if (!a.to.equals(target)) { a.from.copy(cans[c].position); a.to.copy(target); a.t = 0; }
    });
  };
  place(true);

  ctx.onUpdate((dt) => {
    for (let c = 0; c < cans.length; c++) {
      const a = anim[c];
      if (a.t >= 1) continue;
      a.t = Math.min(1, a.t + dt / (a.arc ? 0.55 : 0.18));
      const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - (-2 * a.t + 2) ** 2 / 2;
      cans[c].position.lerpVectors(a.from, a.to, e);
      if (a.arc) {
        const s = Math.sin(Math.PI * a.t);
        cans[c].position.y += s * 0.07 * a.arc;
        cans[c].position.z += s * 0.08 * a.arc;
        cans[c].rotation.y = cans[c].userData.yaw + s * 0.5 * a.arc;
      }
      if (a.t >= 1) { a.arc = 0; cans[c].rotation.y = cans[c].userData.yaw; }
    }
  });

  const persist = () => { try { ctx.state.set('kitchen.cansOrder', [...canAt]); } catch { /* */ } };
  const swapSlots = (s1, s2) => {
    const c1 = canAt[s1], c2 = canAt[s2];
    canAt[s1] = c2; canAt[s2] = c1;
    lifted = -1;
    anim[c1].arc = 1; anim[c2].arc = -0.6;
    place(false);
    persist();
  };
  const isSolvedNow = () => word() === SOLUTION;
  const readout = () => {
    let i = 0;
    return SENTENCE.map((ws) => ws.map((w) => { const s = word().slice(i, i + w.length); i += w.length; return s; }).join(' ')).join(' / ');
  };

  const canFromHit = (hits) => {
    for (const h of hits) { let o = h.object; while (o) { if (o.userData?.canIndex !== undefined) return o.userData.canIndex; o = o.parent; } }
    return -1;
  };

  const puzzle = {
    ...cansMeta,
    camera,
    cameraDuration: 1.4,
    setup(p) {
      try { p.post?.set?.({ bloomThreshold: 3.2, bloomStrength: 0.18, exposure: 1.9 }, 0.8); } catch { /* */ }
      p.status(isSolvedNow() ? 'The recipe is complete.' : 'Lift a tin, then choose another to trade places with it.');
    },
    teardown(p) { if (lifted >= 0) { lifted = -1; place(false); } try { p?.post?.reset?.(0.8); } catch { /* */ } },
    cursorAt(ndc, p) { return canFromHit(p.raycast(cans, ndc)) >= 0 ? 'grab' : 'default'; },
    onPointer(type, e, ndc, p) {
      if (type !== 'up') return;
      const c = canFromHit(p.raycast(cans, ndc));
      if (c < 0) { if (lifted >= 0) { lifted = -1; place(false); } return; }
      const s = slotOfCan(c);
      if (lifted < 0) {
        lifted = s; place(false);
        p.audio.sfx('click', { freq: 900 });
        return;
      }
      if (lifted === s) { lifted = -1; place(false); p.audio.sfx('click', { freq: 600 }); return; }
      swapSlots(lifted, s);
      p.audio.sfx('chime', { freq: 520 + (s % 9) * 40 });
      if (isSolvedNow()) setTimeout(() => p.solve(), 650);
    },
    reset(p) {
      canAt = scramble(letters.length); lifted = -1;
      cans.forEach((c, i) => { anim[i].arc = 0.6; });
      place(false); persist();
      p.status('The tins shuffle themselves back. Someone in the house enjoys this.');
    },
    autoSolve(p) {
      canAt = letters.map((_, i) => i); lifted = -1;
      cans.forEach((c, i) => { anim[i].arc = 0.8; });
      place(false); persist();
      setTimeout(() => p.solve(), 900);
    },
    async onSolved(p) {
      p.status(readout());
      await onSolved?.(p);
    },
  };

  // a stray tin for the butcher's block: number seven, badly dented
  const lure = new THREE.Group();
  {
    const lg = tinGeos[0].clone(); dent(lg.attributes.position, 11, 1.6, FORMATS[0].h); lg.computeVertexNormals();
    lure.add(new THREE.Mesh(lg, tinMatV));
    lure.add(new THREE.Mesh(labelGeometry(atlas.uvRect(letters.length), 11, 1.6, FORMATS[0]), labelMat));
    lure.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  return {
    puzzle, cans, slots, labelMat, lure, layout,
    word, readout, isSolvedNow,
    swap: (s1, s2) => swapSlots(s1, s2),
    applySolved: () => { canAt = letters.map((_, i) => i); lifted = -1; place(true); persist(); },
    state: () => ({ order: readout(), word: word(), solved: isSolvedNow(), lifted }),
  };
}
