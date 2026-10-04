import * as THREE from 'three';

/**
 * "Stauf's Funeral Cake" — homage to the 1993 cake puzzle, re-designed.
 *
 * A hexagonal red-velvet cake is scored into 54 small triangles (a hexagon of
 * side three). Six skulls and six tombstones of sugar sit on it. The player must
 * serve the six dead guests six EQUAL slices: each slice is nine triangles joined
 * edge to edge, carrying exactly one skull and exactly one tombstone.
 *
 * Interaction: click / drag across triangles to mark a slice (gold glow). When
 * nine are marked the knife judges it: a fair slice lifts out of the cake and
 * glides onto the next guest's plate; an unfair one shivers and is released.
 * Clicking a served slice sends it back. The six simple wedges do NOT work (one
 * wedge carries two skulls) — the marker layout has exactly one solution,
 * verified with an exhaustive solver while authoring.
 */

export const CAKE_ID = 'dining.cake';
export const cakeMeta = {
  id: CAKE_ID,
  title: "The Funeral Cake",
  description: 'Six guests, six slices. Cut the cake into six equal pieces — nine triangles each — so that every guest receives exactly one skull and exactly one tombstone.',
  hints: [
    'Every slice is nine little triangles joined edge to edge. Each must carry one skull and one tombstone — no more, no less.',
    'Six plain wedges will not do: one wedge carries two skulls. The rim slices wander. Start at the crowded corners.',
    'One slice runs along the whole far rim, from the tombstone at the far-left corner, and turns down the right-hand edge. Another runs along the near rim from the tombstone at the near-left corner and climbs to the skull just right of centre.',
  ],
};

// marker layout (0 plain, 1 skull, 2 tombstone) and the unique solution, by cell index
const MARKS = '020010001001000000200000000102200101000000000202000000'.split('').map(Number);
const SOLUTION = [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 2, 2, 2, 1, 1, 0, 0, 0, 0, 2, 2, 2, 2, 3, 1, 3, 4, 4, 4, 2, 2, 4, 5, 5, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 3, 3, 5, 5, 5, 5, 5, 3, 3];
const SLICE = 9, GUESTS = 6;
const PLATE_R = 0.1;          // a served slice must fit inside this radius on the plate

/** 54 unit triangles of a hexagon of side 3 (flat top). Same ordering as the authoring solver. */
export function buildCells(s = 1) {
  const h = s * Math.sqrt(3) / 2;
  const cells = [];
  for (let r = 0; r < 3; r++) {
    const wb = (2 + 0.5 * r) * s, wt = wb - 0.5 * s, yt = (3 - r) * h, yb = (2 - r) * h;
    const nUp = Math.round(2 * wb / s), nDn = Math.round(2 * wt / s);
    const row = [];
    for (let j = 0; j < nUp; j++) row.push({ up: true, v: [[-wb + j * s, yb], [-wb + (j + 1) * s, yb], [-wb + (j + 0.5) * s, yt]] });
    for (let j = 0; j < nDn; j++) row.push({ up: false, v: [[-wt + j * s, yt], [-wt + (j + 1) * s, yt], [-wt + (j + 0.5) * s, yb]] });
    row.sort((a, b) => (a.v[0][0] + a.v[1][0] + a.v[2][0]) - (b.v[0][0] + b.v[1][0] + b.v[2][0]));
    row.forEach((c) => { c.row = r; cells.push(c); });
  }
  const top = cells.slice();
  for (let r = 2; r >= 0; r--) for (const c of top.filter((c) => c.row === r)) cells.push({ up: !c.up, row: 5 - r, v: c.v.map(([x, y]) => [x, -y]) });
  const key = ([x, y]) => `${Math.round(x / s * 1000)},${Math.round(y / s * 1000)}`;
  cells.forEach((c, i) => { c.i = i; c.c = [(c.v[0][0] + c.v[1][0] + c.v[2][0]) / 3, (c.v[0][1] + c.v[1][1] + c.v[2][1]) / 3]; c.keys = c.v.map(key); });
  for (const a of cells) {
    a.nb = cells.filter((b) => b !== a && b.keys.filter((k) => a.keys.includes(k)).length === 2).map((b) => b.i);
    // which of the three edges (v[k] -> v[k+1]) is on the outer rim
    a.outer = [0, 1, 2].map((k) => {
      const k1 = a.keys[k], k2 = a.keys[(k + 1) % 3];
      return !cells.some((b) => b !== a && b.keys.includes(k1) && b.keys.includes(k2));
    });
  }
  return cells;
}

/** Triangular prism for one cake cell, centred on its centroid. Groups: 0 ganache (top, bottom, outer sides), 1 sponge (cut faces). */
function cellGeometry(cell, s, H, gap) {
  const [cx, cy] = cell.c;
  // world mapping: 2D (x, y) -> (x, -y) in xz, so +y (top row) is the far side
  const P = cell.v.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy);
    const k = (L - gap) / L;
    return new THREE.Vector2(dx * k, -(dy * k));
  });
  const pos = [], uv = [], nor = [];
  const groups = [];
  const push = (a, ua, n) => { pos.push(a.x, a.y, a.z); uv.push(ua[0], ua[1]); nor.push(n.x, n.y, n.z); };
  const up = new THREE.Vector3(0, 1, 0), dn = new THREE.Vector3(0, -1, 0);
  // top (CCW seen from +y)
  const tri = (pts, n, uvs) => { for (let i = 0; i < 3; i++) push(pts[i], uvs[i], n); };
  const top = P.map((p) => new THREE.Vector3(p.x, H, p.y));
  const bot = P.map((p) => new THREE.Vector3(p.x, 0, p.y));
  const wuv = (p) => [(p.x + cx) * 2.2, (p.z - cy) * 2.2];
  // orientation: ensure CCW from above
  const area = (top[1].x - top[0].x) * (top[2].z - top[0].z) - (top[2].x - top[0].x) * (top[1].z - top[0].z);
  const order = area < 0 ? [0, 1, 2] : [0, 2, 1];
  let start = 0;
  tri(order.map((i) => top[i]), up, order.map((i) => wuv(top[i])));
  tri([...order].reverse().map((i) => bot[i]), dn, [...order].reverse().map((i) => wuv(bot[i])));
  groups.push([start, 6, 0]); start += 6;
  const sideGroups = [[], []];
  for (let k = 0; k < 3; k++) {
    const a = k, b = (k + 1) % 3;
    const A0 = bot[a], B0 = bot[b], A1 = top[a], B1 = top[b];
    const n = new THREE.Vector3().subVectors(B0, A0).cross(up).normalize();
    // make n point outward from the centroid (origin)
    const mid = new THREE.Vector3().addVectors(A0, B0).multiplyScalar(0.5);
    let q = [A0, B0, B1, A1];
    if (n.dot(mid) < 0) { n.negate(); }
    // winding so that the face normal = n
    const fn = new THREE.Vector3().subVectors(B0, A0).cross(new THREE.Vector3().subVectors(A1, A0));
    if (fn.dot(n) < 0) q = [B0, A0, A1, B1];
    const L = A0.distanceTo(B0) / s;
    const g = cell.outer[k] ? 0 : 1;
    sideGroups[g].push({ q, n, L });
  }
  for (let g = 0; g < 2; g++) {
    const n0 = start;
    for (const { q, n, L } of sideGroups[g]) {
      const u = [[0, 0], [L, 0], [L, 1], [0, 1]];
      tri([q[0], q[1], q[2]], n, [u[0], u[1], u[2]]);
      tri([q[0], q[2], q[3]], n, [u[0], u[2], u[3]]);
      start += 6;
    }
    if (start > n0) groups.push([n0, start - n0, g === 0 ? 0 : 1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  for (const [a, c, m] of groups) geo.addGroup(a, c, m);
  return { geo, P };
}

const clean = (gs) => gs.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k); return g.index ? g.toNonIndexed() : g; });

/** A sugar skull ~3.6 cm tall: domed cranium, brow, cheekbones, narrowed maxilla, jaw with teeth. Faces +z. */
function skullGeometry(G) {
  const parts = [];
  const sph = (r, sx, sy, sz, x, y, z, ws = 18, hs = 12) => { const g = new THREE.SphereGeometry(r, ws, hs); g.scale(sx, sy, sz); g.translate(x, y, z); parts.push(g); };
  sph(0.016, 1.0, 0.95, 1.12, 0, 0.021, -0.002);           // cranium
  sph(0.0115, 1.15, 0.55, 0.9, 0, 0.0145, 0.0075);          // brow ridge
  for (const sx of [-1, 1]) sph(0.0055, 1, 0.8, 1, sx * 0.0095, 0.0085, 0.0085, 10, 8);   // cheekbones
  sph(0.0085, 1.0, 0.9, 0.9, 0, 0.0075, 0.007);            // maxilla
  const jaw = new G.RoundedBoxGeometry(0.0135, 0.0055, 0.011, 2, 0.0022); jaw.translate(0, 0.0028, 0.0075); parts.push(jaw);
  // teeth: a row of tiny blocks along the front of the jaw line
  for (let i = 0; i < 6; i++) { const t = new THREE.BoxGeometry(0.0016, 0.0024, 0.0016); t.translate(-0.0045 + i * 0.0018, 0.0056, 0.0128 - Math.abs(i - 2.5) * 0.0004); parts.push(t); }
  return G.mergeGeometries(clean(parts));
}
function socketsGeometry(G) {
  const parts = [];
  for (const x of [-0.006, 0.006]) { const e = new THREE.SphereGeometry(0.0049, 12, 8); e.scale(1, 0.95, 0.6); e.translate(x, 0.0155, 0.0152); parts.push(e); }
  const nose = new THREE.ConeGeometry(0.0021, 0.0042, 3); nose.rotateX(Math.PI); nose.translate(0, 0.0085, 0.0162); parts.push(nose);
  // painted icing flourish on the forehead (dark violet dots)
  for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4; const d = new THREE.SphereGeometry(0.0011, 6, 4); d.translate(Math.sin(a) * 0.009, 0.024 + Math.cos(a) * 0.004, 0.0165 - Math.abs(a) * 0.002); parts.push(d); }
  return G.mergeGeometries(clean(parts));
}
function tombGeometry(G) {
  const w = 0.026, h = 0.034;
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); sh.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0018, bevelSize: 0.0016, bevelSegments: 3, curveSegments: 16 });
  g.translate(0, 0, -0.003);
  const base = new G.RoundedBoxGeometry(0.032, 0.005, 0.014, 2, 0.0015); base.translate(0, 0.0025, 0);
  const m = G.mergeGeometries([g, base].map((x) => (x.index ? x.toNonIndexed() : x)).map((x) => { for (const k of Object.keys(x.attributes)) if (!['position', 'normal'].includes(k)) x.deleteAttribute(k); return x; }));
  // planar front projection so the engraved R.I.P. sits on the face
  const p = m.attributes.position; const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + w / 2 + 0.002) / (w + 0.004); uv[i * 2 + 1] = (p.getY(i) - 0.003) / (h - 0.001); }
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return m;
}
/** piped buttercream rosette: a spiral of tapered rope, ~2.2 cm across */
function rosetteGeometry(segs = 96, rad = 8) {
  const pts = [];
  for (let i = 0; i <= 64; i++) { const t = i / 64; const a = t * Math.PI * 2 * 2.4; const r = 0.0095 * (1 - t * 0.85); pts.push(new THREE.Vector3(Math.cos(a) * r, 0.002 + t * 0.011, Math.sin(a) * r)); }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, 0.0034, rad);
  const p = g.attributes.position;
  // star-tip ridges
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { const k = i % (rad + 1); const f = 1 + 0.25 * Math.cos(k * (Math.PI * 2 / rad) * 3); p.setXYZ(i, p.getX(i) + n.getX(i) * 0.0006 * f, p.getY(i) + n.getY(i) * 0.0006 * f, p.getZ(i) + n.getZ(i) * 0.0006 * f); }
  g.computeVertexNormals();
  return g;
}
/** ganache drip hanging over an outer edge: a tapered teardrop, local y down from 0 */
function dripGeometry(len) {
  const g = new THREE.CapsuleGeometry(0.0032, len, 3, 8);
  g.translate(0, -len / 2, 0); g.scale(1, 1, 0.5);
  return g;
}

export function createCakePuzzle(ctx, { parent, origin, side = 0.088, height = 0.1, plates, mats, camera, onSolved, onChange, onSetup, onTeardown, onBeat }) {
  const G = ctx.geometry;
  const cells = buildCells(side);
  const group = new THREE.Group();
  group.name = 'cake';
  group.position.copy(origin);
  group.userData.keep = true;
  parent.add(group);

  const meshes = [], overlays = [], homes = [];
  const cornerDone = new Set();
  const beadGeo = new THREE.SphereGeometry(0.0062, 8, 5);
  const skullG = skullGeometry(G), socketG = socketsGeometry(G), tombG = tombGeometry(G), rosG = rosetteGeometry(), rosRimG = rosetteGeometry(40, 6);
  const R3 = 3 * side;
  let beadN = 0;
  const overlayMats = [];
  for (const c of cells) {
    const { geo, P } = cellGeometry(c, side, height, 0.0011);
    const m = new THREE.Mesh(geo, [mats.ganache, mats.sponge]);
    m.position.set(c.c[0], 0, -c.c[1]);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.cell = c.i;
    // cream bead piping along rim edges + a few along the base
    const beads = [], drips = [], rosettes = [];
    c.outer.forEach((o, k) => {
      if (!o) return;
      const a = P[k], b = P[(k + 1) % 3];
      const L = a.distanceTo(b);
      const n = Math.max(2, Math.round(L / 0.0105));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        beadN++;
        const sc = 0.78 + 0.32 * Math.abs(Math.sin(beadN * 1.7)) + 0.1 * Math.sin(beadN * 0.37);
        // shell-bead border round the foot
        { const bg = beadGeo.clone(); bg.scale(sc * 1.15, sc * 0.9, sc * 1.15); bg.translate(a.x + (b.x - a.x) * t, 0.005, a.y + (b.y - a.y) * t); beads.push(bg); }
        // ganache drips running down the outer face
        if ((beadN * 7) % 5 < 3) {
          const len = 0.016 + 0.036 * Math.abs(Math.sin(beadN * 2.3));
          const dg = dripGeometry(len);
          const nx = (a.y - b.y), nz = (b.x - a.x); const nl = Math.hypot(nx, nz) || 1;
          const cxw = a.x + (b.x - a.x) * t, czw = a.y + (b.y - a.y) * t;
          // outward = away from the cake centre (cell centroid offset by c.c)
          let ox = nx / nl, oz = nz / nl;
          if ((cxw + c.c[0]) * ox + (czw - c.c[1]) * oz < 0) { ox = -ox; oz = -oz; }
          dg.rotateY(Math.atan2(ox, oz));
          dg.translate(cxw + ox * 0.0012, height - 0.001, czw + oz * 0.0012);
          drips.push(dg);
        }
      }
    });
    // piped star-tip rosettes all along the top rim (they read as a cake from across the room)
    c.outer.forEach((o, k) => {
      if (!o) return;
      const a = P[k], b = P[(k + 1) % 3];
      const n = Math.max(2, Math.round(a.distanceTo(b) / 0.021));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const rg = rosRimG.clone(); rg.rotateY(i * 1.3 + c.i); rg.scale(0.95, 0.85 + 0.15 * ((i + c.i) % 2), 0.95);
        const ix = a.x + (b.x - a.x) * t, iz = a.y + (b.y - a.y) * t;
        rg.translate(ix * 0.86, height - 0.002, iz * 0.86);
        rosettes.push(rg);
      }
    });
    // rosettes at the six outer corners of the hexagon
    for (let k = 0; k < 3; k++) {
      const [vx, vy] = c.v[k];
      if (Math.abs(Math.hypot(vx, vy) - R3) < side * 0.05 && !cornerDone.has(`${Math.round(vx * 1e4)},${Math.round(vy * 1e4)}`)) {
        cornerDone.add(`${Math.round(vx * 1e4)},${Math.round(vy * 1e4)}`);
        const rg = rosG.clone(); rg.scale(1.15, 1.15, 1.15); rg.translate((vx - c.c[0]) * 0.93, height, -(vy - c.c[1]) * 0.93);
        rosettes.push(rg);
      }
    }
    if (beads.length || rosettes.length) {
      const bm = new THREE.Mesh(G.mergeGeometries(clean([...beads, ...rosettes])), mats.cream);
      bm.castShadow = true; m.add(bm);
    }
    if (drips.length) { const dm = new THREE.Mesh(G.mergeGeometries(clean(drips)), mats.ganacheDrip || mats.ganache); m.add(dm); }
    // decorations
    const mk = MARKS[c.i];
    if (mk === 1) {
      const sk = new THREE.Mesh(skullG, mats.sugar); sk.castShadow = true;
      sk.add(new THREE.Mesh(socketG, mats.socket));
      sk.position.set(0, height + 0.001, 0); sk.scale.setScalar(1.95);
      sk.rotation.set(-0.5, ((c.i * 37) % 7 - 3) * 0.08, 0, 'YXZ');
      m.add(sk);
    } else if (mk === 2) {
      const tb = new THREE.Mesh(tombG, mats.stone); tb.castShadow = true; tb.scale.setScalar(1.75);
      tb.position.set(0, height, 0.002);
      tb.rotation.set(-0.12 + ((c.i * 13) % 5) * 0.03, ((c.i * 29) % 7 - 3) * 0.1, ((c.i * 7) % 5 - 2) * 0.04);
      m.add(tb);
    }
    // glow overlay
    // selection glow: a hot ember line traced along the knife cuts (the cell's edges), with only a
    // faint warmth over the icing inside, so a marked slice reads as scored, not painted
    const og = new THREE.BufferGeometry();
    const ring = [0.985, 0.86, 0.0];
    const vpos = [], vcol = [];
    const hot = [2.2, 1.1, 0.34], dim = [0.12, 0.06, 0.02];
    for (const k of ring) for (let q = 0; q < 3; q++) { vpos.push(P[q].x * k, 0, P[q].y * k); vcol.push(...(k > 0.5 ? hot : dim)); }
    vcol.splice(3 * 3, 9, ...hot.map((v) => v * 0.55), ...hot.map((v) => v * 0.55), ...hot.map((v) => v * 0.55));
    og.setAttribute('position', new THREE.Float32BufferAttribute(vpos, 3));
    og.setAttribute('color', new THREE.Float32BufferAttribute(vcol, 3));
    const oi = [];
    for (let q = 0; q < 3; q++) { const q1 = (q + 1) % 3; oi.push(q, q1, 3 + q1, q, 3 + q1, 3 + q, 3 + q, 3 + q1, 6 + q1, 3 + q, 6 + q1, 6 + q); }
    og.setIndex(oi);
    const om = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    overlayMats.push(om);
    const ov = new THREE.Mesh(og, om); ov.position.y = height + 0.0035; ov.visible = false; ov.renderOrder = 4; ov.userData.noBake = true;
    m.add(ov);
    overlays.push(ov);
    group.add(m);
    meshes.push(m);
    homes.push(m.position.clone());
  }

  // ------------------------------------------------------------------ state
  // owner[i]: -1 on cake, else plate index the cell was served on
  let owner = new Array(cells.length).fill(-1);
  let selected = new Set();
  let hover = -1, painting = null, solvedFlag = false, live = null;
  const served = [];                 // [{ plate, cells:[...] }]
  const anims = [];                  // { mesh, from, to, t, d, lift, rotFrom, rotTo }
  const shakes = new Map();
  const plateUsed = new Array(GUESTS).fill(false);

  const remaining = () => cells.filter((c) => owner[c.i] < 0).map((c) => c.i);
  const connected = (ids) => {
    const set = new Set(ids); const seen = new Set([ids[0]]); const st = [ids[0]];
    while (st.length) { const c = st.pop(); for (const b of cells[c].nb) if (set.has(b) && !seen.has(b)) { seen.add(b); st.push(b); } }
    return seen.size === set.size;
  };
  /** remaining cake can still be shared fairly? (each component: multiple of 9, matching skull/tomb counts) */
  const remainderOK = () => {
    const rem = new Set(remaining()); const seen = new Set();
    for (const i of rem) if (!seen.has(i)) {
      let n = 0, sk = 0, tb = 0; const st = [i]; seen.add(i);
      while (st.length) { const c = st.pop(); n++; if (MARKS[c] === 1) sk++; if (MARKS[c] === 2) tb++; for (const b of cells[c].nb) if (rem.has(b) && !seen.has(b)) { seen.add(b); st.push(b); } }
      if (n % SLICE || sk !== n / SLICE || tb !== n / SLICE) return false;
    }
    return true;
  };

  const plateWorld = (k) => plates[k].clone().sub(origin);   // in cake-group space
  function centroid(ids) { const c = new THREE.Vector3(); ids.forEach((i) => c.add(homes[i])); return c.multiplyScalar(1 / ids.length); }
  function choosePlate(ids) {
    const c = centroid(ids);
    const ang = Math.atan2(-c.z, c.x);
    let best = -1, bd = 1e9;
    for (let k = 0; k < GUESTS; k++) {
      if (plateUsed[k]) continue;
      const p = plateWorld(k);
      const a = Math.atan2(-p.z, p.x);
      let d = Math.abs(((a - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function serve(ids, k, instant = false) {
    plateUsed[k] = true;
    served.push({ plate: k, cells: ids.slice() });
    const c = centroid(ids);
    const p = plateWorld(k);
    // keep the slice's orientation as the guest sees it (its tip still points at the cake),
    // and shrink it, if need be, so that no crumb overhangs the plate rim or knocks a glass
    const yaw = Math.atan2(-p.z, p.x) - Math.atan2(-c.z, c.x);
    let maxR = 0;
    for (const i of ids) for (const v of cells[i].v) maxR = Math.max(maxR, Math.hypot(v[0] - c.x, -v[1] - c.z));
    const sc = Math.min(1, PLATE_R / maxR);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    ids.forEach((i, n) => {
      owner[i] = k;
      const rx = (homes[i].x - c.x) * sc, rz = (homes[i].z - c.z) * sc;
      const to = new THREE.Vector3(p.x + rx * cy + rz * sy, p.y + 0.013, p.z - rx * sy + rz * cy);
      if (instant) { meshes[i].position.copy(to); meshes[i].rotation.set(0, yaw, 0); meshes[i].scale.setScalar(sc); return; }
      anims.push({ mesh: meshes[i], from: meshes[i].position.clone(), to, t: -n * 0.025, d: 1.35, lift: 0.16, tilt: [0.22 * Math.sign(p.z - c.z || 1), -0.22 * Math.sign(p.x - c.x || 1)], rot0: meshes[i].rotation.y, rot1: yaw, s0: meshes[i].scale.x, s1: sc });
    });
    if (!instant) burst(c);
  }
  // ---- crumbs: a small pool of sponge/ganache crumbs thrown up when a slice is lifted out
  const CRUMBS = 96;
  const crumbGeo = new THREE.IcosahedronGeometry(0.0028, 0);
  const crumbMesh = new THREE.InstancedMesh(crumbGeo, mats.crumb || mats.sponge, CRUMBS);
  crumbMesh.count = CRUMBS; crumbMesh.frustumCulled = false; crumbMesh.userData.noBake = true;
  const crumbs = Array.from({ length: CRUMBS }, () => ({ p: new THREE.Vector3(0, -10, 0), v: new THREE.Vector3(), r: 0, live: false, s: 1 }));
  const dummy = new THREE.Object3D();
  let crumbIdx = 0, crumbSeed = 1;
  const rnd = () => { const x = Math.sin(crumbSeed++ * 91.345 + 7.13) * 43758.5453; return x - Math.floor(x); };
  function burst(c) {
    for (let k = 0; k < 18; k++) {
      const cr = crumbs[crumbIdx++ % CRUMBS];
      const a = rnd() * Math.PI * 2, sp = 0.15 + rnd() * 0.35;
      cr.p.set(c.x + (rnd() - 0.5) * 0.06, height * (0.3 + rnd() * 0.7), c.z + (rnd() - 0.5) * 0.06);
      cr.v.set(Math.cos(a) * sp, 0.5 + rnd() * 0.7, Math.sin(a) * sp);
      cr.r = rnd() * 6; cr.s = 0.6 + rnd() * 0.9; cr.live = true;
    }
  }
  function tickCrumbs(dt) {
    crumbs.forEach((cr, i) => {
      if (cr.live) {
        cr.v.y -= 9.8 * dt; cr.p.addScaledVector(cr.v, dt); cr.r += dt * 8;
        if (cr.p.y < 0.001) { cr.p.y = 0.001; cr.v.set(0, 0, 0); cr.live = false; }
      }
      dummy.position.copy(cr.p); dummy.rotation.set(cr.r, cr.r * 0.7, 0); dummy.scale.setScalar(cr.s); dummy.updateMatrix();
      crumbMesh.setMatrixAt(i, dummy.matrix);
    });
    crumbMesh.instanceMatrix.needsUpdate = true;
  }
  tickCrumbs(0);
  group.add(crumbMesh);
  function unserve(k, instant = false) {
    const idx = served.findIndex((s) => s.plate === k);
    if (idx < 0) return;
    const s = served[idx];
    served.splice(idx, 1);
    plateUsed[k] = false;
    s.cells.forEach((i, n) => {
      owner[i] = -1;
      if (instant) { meshes[i].position.copy(homes[i]); meshes[i].rotation.set(0, 0, 0); meshes[i].scale.setScalar(1); return; }
      anims.push({ mesh: meshes[i], from: meshes[i].position.clone(), to: homes[i].clone(), t: -n * 0.02, d: 1.1, lift: 0.14, rot0: meshes[i].rotation.y, rot1: 0, s0: meshes[i].scale.x, s1: 1 });
    });
  }
  function refreshOverlays(t = 0) {
    for (let i = 0; i < cells.length; i++) {
      const ov = overlays[i];
      let v = 0;
      if (owner[i] < 0) {
        if (selected.has(i)) v = 0.8 + 0.2 * Math.sin(t * 5);
        else if (i === hover && !solvedFlag) v = 0.35;
      }
      ov.visible = v > 0.01;
      ov.material.opacity = v;
      // marked cells rise a little out of the cake
      if (owner[i] < 0 && !anims.some((a) => a.mesh === meshes[i])) meshes[i].position.y = homes[i].y + (selected.has(i) ? 0.005 : 0);
    }
  }
  function resetAll(instant = true) {
    anims.length = 0; selected.clear(); served.length = 0; plateUsed.fill(false);
    owner = new Array(cells.length).fill(-1);
    meshes.forEach((m, i) => { m.position.copy(homes[i]); m.rotation.set(0, 0, 0); m.scale.setScalar(1); });
    solvedFlag = false;
    refreshOverlays();
  }
  function applySolved() {
    resetAll();
    for (let k = 0; k < GUESTS; k++) {
      const ids = cells.filter((c) => SOLUTION[c.i] === k).map((c) => c.i);
      serve(ids, choosePlate(ids), true);
    }
    solvedFlag = true;
    refreshOverlays();
  }

  function judge(p) {
    const ids = [...selected];
    const sk = ids.filter((i) => MARKS[i] === 1).length, tb = ids.filter((i) => MARKS[i] === 2).length;
    let why = null;
    if (!connected(ids)) why = 'That slice would fall apart — its triangles must join edge to edge.';
    else if (sk === 0) why = 'No skull in that slice. Every guest must have one.';
    else if (sk > 1) why = `${sk} skulls in one slice — one guest would be served two deaths.`;
    else if (tb === 0) why = 'No tombstone in that slice. Every guest must have one.';
    else if (tb > 1) why = `${tb} tombstones in one slice — greedy, greedy.`;
    if (why) {
      ids.forEach((i) => shakes.set(i, 0.45));
      selected.clear();
      p.fail?.(why);
      p.audio?.sfx?.('fail');
      return false;
    }
    const k = choosePlate(ids);
    selected.clear();
    serve(ids, k);
    p.audio?.sfx?.('pickup');
    onChange?.(state());
    const n = served.length;
    if (n >= GUESTS) {
      solvedFlag = true;
      p.status?.('Six guests, six slices — not a crumb left over. The guests are served.');
      p.audio?.sfx?.('chime', { freq: 880 });
      onBeat?.();
      setTimeout(() => { p.solve?.(); }, 2600);
      return true;
    }
    if (!remainderOK()) {
      p.status?.(`${n} of ${GUESTS} served — but what is left can no longer be shared fairly. Click a served slice to return it.`);
      p.say?.({ text: 'Somebody is going to go *hungry*.', speaker: 'stauf', speakerName: 'Stauf' });
    } else p.status?.(`${n} of ${GUESTS} guests served.`);
    return true;
  }

  const pickables = meshes;
  function pick(p, ndc) {
    const hit = p.raycast(pickables, ndc)[0];
    if (!hit) return { cell: -1 };
    let o = hit.object;
    while (o && o.userData.cell === undefined) o = o.parent;
    return o ? { cell: o.userData.cell } : { cell: -1 };
  }
  function applyPaint(i, p) {
    if (i < 0 || owner[i] >= 0 || !painting) return;
    if (painting === 'add' && !selected.has(i)) {
      if (selected.size >= SLICE) return;
      selected.add(i);
      p.audio?.sfx?.('click');
    } else if (painting === 'remove' && selected.has(i)) selected.delete(i);
    refreshOverlays();
    p.status?.(selected.size ? `${selected.size} of ${SLICE} triangles marked.` : `${served.length} of ${GUESTS} guests served.`);
  }

  function state() {
    return {
      solved: solvedFlag, served: served.map((s) => ({ plate: s.plate, cells: s.cells.slice() })), selected: [...selected],
      owner: owner.slice(), animating: anims.length > 0, remainderOK: remainderOK(),
      marks: MARKS.slice(), solution: SOLUTION.slice(),
    };
  }

  const puzzle = {
    ...cakeMeta,
    camera,
    cameraDuration: 1.4,
    setup(p) {
      live = p; onSetup?.(p);
      if (solvedFlag) { p.status('Six guests, six slices. Nothing left over.'); return; }
      p.status(served.length ? `${served.length} of ${GUESTS} guests served.` : 'Mark nine triangles for the first guest — click or drag across the cake.');
    },
    update(dt, t) {
      tickCrumbs(Math.min(dt, 0.05));
      for (let k = anims.length - 1; k >= 0; k--) {
        const a = anims[k];
        a.t += dt;
        const u = Math.min(1, Math.max(0, a.t / a.d));
        const e = u * u * (3 - 2 * u);
        a.mesh.position.lerpVectors(a.from, a.to, e);
        a.mesh.position.y += Math.sin(u * Math.PI) * a.lift;
        const tl = Math.sin(u * Math.PI) * (a.tilt ? 1 : 0);
        if (a.tilt) { a.mesh.rotation.x = a.tilt[0] * tl; a.mesh.rotation.z = a.tilt[1] * tl; }
        if (a.rot1 !== undefined) { a.mesh.rotation.y = a.rot0 + (a.rot1 - a.rot0) * e; a.mesh.scale.setScalar(a.s0 + (a.s1 - a.s0) * e); }
        if (u >= 1) { a.mesh.position.copy(a.to); a.mesh.rotation.set(0, a.rot1 ?? 0, 0); if (a.s1 !== undefined) a.mesh.scale.setScalar(a.s1); anims.splice(k, 1); }
      }
      for (const [i, left] of shakes) {
        const l = left - dt;
        if (l <= 0) { shakes.delete(i); meshes[i].position.x = homes[i].x; continue; }
        shakes.set(i, l);
        meshes[i].position.x = homes[i].x + Math.sin(l * 70) * 0.004 * (l / 0.45);
      }
      refreshOverlays(t);
    },
    cursorAt(ndc, p) {
      if (solvedFlag) return 'default';
      const { cell } = pick(p, ndc);
      if (cell !== hover) { hover = cell; refreshOverlays(); }
      if (cell < 0) return 'default';
      return 'grab';
    },
    onPointer(type, e, ndc, p) {
      if (solvedFlag) return;
      if (type === 'down') {
        const { cell } = pick(p, ndc);
        if (cell < 0) return;
        if (owner[cell] >= 0) { // a served slice: send it back
          const k = owner[cell];
          unserve(k);
          p.audio?.sfx?.('pickup');
          p.status(`The slice returns to the cake. ${served.length} of ${GUESTS} guests served.`);
          onChange?.(state());
          return;
        }
        painting = selected.has(cell) ? 'remove' : 'add';
        applyPaint(cell, p);
      } else if (type === 'move' && painting) {
        const { cell } = pick(p, ndc);
        applyPaint(cell, p);
      } else if (type === 'up') {
        painting = null;
        if (selected.size === SLICE) judge(p);
      }
    },
    reset(p) {
      if (solvedFlag) return;
      resetAll(false);
      p.status('The knife is wiped clean. The cake is whole again.');
      onChange?.(state());
    },
    autoSolve(p) {
      applySolved();
      onChange?.(state());
      p.solve();
    },
    async onSolved(p) { solvedFlag = true; await onSolved?.(p); },
    teardown(p) { hover = -1; painting = null; selected.clear(); refreshOverlays(); live = null; onTeardown?.(p); },
  };

  return {
    puzzle, group, meshes, cells,
    applySolved, reset: resetAll, state,
    /** QA: try to serve a slice by cell ids (returns judge result or false if illegal) */
    trySlice(ids, p = {}) {
      if (solvedFlag) return false;
      selected = new Set(ids.filter((i) => owner[i] < 0));
      if (selected.size !== SLICE) { selected.clear(); return false; }
      return judge({ status: (t) => live?.status?.(t), fail: (t) => live?.status?.(t), say() {}, solve() {}, audio: null, ...p });
    },
    tick: (dt, t) => puzzle.update(dt, t),
    /** QA: mark cells as the current (unjudged) selection */
    select(ids) { selected = new Set(ids.filter((i) => owner[i] < 0)); refreshOverlays(1); },
  };
}
