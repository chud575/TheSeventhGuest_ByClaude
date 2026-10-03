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
    'The empty gaps along each shelf are the spaces between words. Read the shelves from the top down, like a page.',
    'The bottom shelf is a single six-letter word: those who come to dinner at this house. The top shelf begins with THE.',
    'Arrange the tins to read: THE SOUP IS / MADE OF / GUESTS.',
  ],
};

const CAN_R = 0.039, CAN_H = 0.112, PITCH = 0.092, GAP = 0.07;

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

// circumferential bead ribs pressed into the body (in the gilt bands, clear of the letter)
const BEADS = [0.0205, 0.0265, 0.0855, 0.0915];
const bead = (y) => { let d = 0; for (const b of BEADS) d = Math.max(d, Math.exp(-((y - b) ** 2) / 0.0000016)); return d * 0.0011; };

function tinGeometry(G) {
  const r = CAN_R, h = CAN_H;
  // double-seamed rims top & bottom (a rolled bead standing proud), beaded body, lid with expansion rings
  const pts = [
    [0.0, 0.0015], [r * 0.86, 0.0015], [r * 0.9, 0.0], [r + 0.0008, 0.0006], [r + 0.0022, 0.0022], [r + 0.0024, 0.0045], [r + 0.0018, 0.0068], [r + 0.0004, 0.0078], [r, 0.009],
  ];
  for (let y = 0.012; y <= h - 0.012 + 1e-6; y += 0.0015) pts.push([r - 0.0004 - bead(y), y]);
  pts.push(
    [r, h - 0.009], [r + 0.0004, h - 0.0078], [r + 0.0018, h - 0.0068], [r + 0.0024, h - 0.0045], [r + 0.0022, h - 0.0018], [r + 0.0012, h - 0.0004], [r * 0.97, h], [r * 0.94, h - 0.0028],
    [r * 0.82, h - 0.0034], [r * 0.79, h - 0.0022], [r * 0.76, h - 0.0034], [r * 0.6, h - 0.0034], [r * 0.57, h - 0.0024], [r * 0.54, h - 0.0034], [r * 0.3, h - 0.0034], [r * 0.27, h - 0.0026], [r * 0.24, h - 0.0034], [0.0, h - 0.0034],
  );
  return G.latheFromProfile(pts, 56);
}

/** Label (lithographed print) skin following the beads; dented per seed. */
function labelGeometry(rect, seed, dentAmt = 1) {
  const y0 = 0.013, y1 = CAN_H - 0.013;
  const pts = [];
  const N = 64;
  for (let j = 0; j <= N; j++) { const y = y0 + (j / N) * (y1 - y0); pts.push(new THREE.Vector2(CAN_R + 0.0002 - bead(y), y)); }
  const g = new THREE.LatheGeometry(pts, 72);
  g.rotateY(Math.PI);                       // u = 0.5 faces +Z
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, rect.u0 + uv.getX(i) * (rect.u1 - rect.u0), rect.v0 + uv.getY(i) * (rect.v1 - rect.v0));
  dent(pos, seed, dentAmt);
  g.computeVertexNormals();
  return g;
}

/** Push a dent (or two) into a tin's side, away from the letter face. */
function dent(pos, seed, amt) {
  if (amt <= 0) return;
  const dents = [[Math.PI + (((seed * 1.7) % 2) - 1) * 1.3, 0.025 + (seed % 5) * 0.014, 0.06 * amt]];
  if (seed % 3 === 0) dents.push([((seed * 2.3) % 6.28), 0.08, 0.035 * amt]);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y < 0.006 || y > CAN_H - 0.006) continue;
    const a = Math.atan2(x, z);
    let k = 1 + 0.0015 * Math.sin(a * 7 + seed);
    for (const [da, dy, s] of dents) {
      let d = Math.cos(a - da); d = Math.max(0, d - 0.88) / 0.12;
      k -= d * d * Math.exp(-((y - dy) ** 2) / 0.0003) * s;
    }
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
  const atlas = await buildLabelAtlas(letters, { extras: ['7'] });
  const labelMat = new THREE.MeshPhysicalMaterial({
    map: atlas.map, roughnessMap: atlas.orm, metalnessMap: atlas.orm, roughness: 1, metalness: 1,
    clearcoat: 0.3, clearcoatRoughness: 0.45, envMapIntensity: 0.85, name: 'canLabel',
  });
  const tinGeo = tinGeometry(G);

  // ---- slots (local to the dresser)
  const slots = [];
  SENTENCE.forEach((words, row) => {
    const n = words.join('').length;
    const width = n * PITCH + (words.length - 1) * GAP;
    let x = -width / 2 + PITCH / 2;
    const { y, zFront } = shelves[row];
    words.forEach((w, wi) => {
      for (let k = 0; k < w.length; k++) { slots.push(new THREE.Vector3(x, y, zFront - 0.075)); x += PITCH; }
      if (wi < words.length - 1) x += GAP;
    });
  });

  // ---- tins
  const cans = letters.map((L, i) => {
    const g = new THREE.Group();
    g.name = `can-${i}-${L}`;
    const dentAmt = [0, 0.6, 1.0, 0.3, 0.8][i % 5];
    const label = new THREE.Mesh(labelGeometry(atlas.uvRect(i), i + 1, dentAmt), labelMat);
    let tg = tinGeo;
    if (dentAmt > 0) { tg = tinGeo.clone(); dent(tg.attributes.position, i + 1, dentAmt); tg.computeVertexNormals(); }
    const tin = new THREE.Mesh(tg, tinMat);
    label.castShadow = tin.castShadow = true;
    label.receiveShadow = tin.receiveShadow = true;
    g.add(tin, label);
    g.userData.canIndex = i;
    g.userData.letter = L;
    g.userData.yaw = ((i * 7919) % 13 - 6) * 0.018;
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
      const target = slots[s].clone();
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
      p.status(isSolvedNow() ? 'The recipe is complete.' : 'Lift a tin, then choose another to trade places with it.');
    },
    teardown() { if (lifted >= 0) { lifted = -1; place(false); } },
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
    const lg = tinGeo.clone(); dent(lg.attributes.position, 11, 1.6); lg.computeVertexNormals();
    lure.add(new THREE.Mesh(lg, tinMat));
    lure.add(new THREE.Mesh(labelGeometry(atlas.uvRect(letters.length), 11, 1.6), labelMat));
    lure.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  return {
    puzzle, cans, slots, labelMat, lure,
    word, readout, isSolvedNow,
    swap: (s1, s2) => swapSlots(s1, s2),
    applySolved: () => { canAt = letters.map((_, i) => i); lifted = -1; place(true); persist(); },
    state: () => ({ order: readout(), word: word(), solved: isSolvedNow(), lifted }),
  };
}
