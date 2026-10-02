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

function skullGeometry(G) {
  const parts = [];
  const cran = new THREE.SphereGeometry(0.016, 18, 12); cran.scale(1, 0.95, 1.1); cran.translate(0, 0.019, 0); parts.push(cran);
  const face = new THREE.SphereGeometry(0.012, 14, 10); face.scale(1.05, 0.9, 0.8); face.translate(0, 0.011, 0.008); parts.push(face);
  const jaw = new G.RoundedBoxGeometry(0.018, 0.008, 0.014, 2, 0.003); jaw.translate(0, 0.004, 0.009); parts.push(jaw);
  return G.mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
}
function socketsGeometry(G) {
  const parts = [];
  for (const x of [-0.0058, 0.0058]) { const e = new THREE.SphereGeometry(0.0046, 10, 8); e.translate(x, 0.016, 0.0165); parts.push(e); }
  const nose = new THREE.ConeGeometry(0.0022, 0.005, 3); nose.rotateX(Math.PI); nose.translate(0, 0.0095, 0.0185); parts.push(nose);
  return G.mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
}
function tombGeometry(G) {
  const w = 0.026, h = 0.034;
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); sh.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 14 });
  g.translate(0, 0, -0.0035);
  const crossV = new THREE.BoxGeometry(0.003, 0.014, 0.002); crossV.translate(0, h * 0.58, 0.0052);
  const crossH = new THREE.BoxGeometry(0.01, 0.003, 0.002); crossH.translate(0, h * 0.64, 0.0052);
  const base = new THREE.BoxGeometry(0.032, 0.005, 0.014); base.translate(0, 0.0025, 0);
  const parts = [g, crossV, crossH, base].map((x) => { x.deleteAttribute('uv'); return x.index ? x.toNonIndexed() : x; });
  return G.mergeGeometries(parts);
}

export function createCakePuzzle(ctx, { parent, origin, side = 0.088, height = 0.1, plates, mats, camera, onSolved, onChange }) {
  const G = ctx.geometry;
  const cells = buildCells(side);
  const group = new THREE.Group();
  group.name = 'cake';
  group.position.copy(origin);
  group.userData.keep = true;
  parent.add(group);

  const meshes = [], overlays = [], homes = [];
  const beadGeo = new THREE.SphereGeometry(0.0062, 7, 4);
  const skullG = skullGeometry(G), socketG = socketsGeometry(G), tombG = tombGeometry(G);
  const overlayMats = [];
  for (const c of cells) {
    const { geo, P } = cellGeometry(c, side, height, 0.0011);
    const m = new THREE.Mesh(geo, [mats.ganache, mats.sponge]);
    m.position.set(c.c[0], 0, -c.c[1]);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.cell = c.i;
    // cream bead piping along rim edges + a few along the base
    const beads = [];
    c.outer.forEach((o, k) => {
      if (!o) return;
      const a = P[k], b = P[(k + 1) % 3];
      const L = a.distanceTo(b);
      const n = Math.max(2, Math.round(L / 0.0115));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const out = new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2).normalize().multiplyScalar(0.0);
        for (const y of [height + 0.002, 0.005]) {
          const bg = beadGeo.clone(); bg.translate(a.x + (b.x - a.x) * t + out.x, y, a.y + (b.y - a.y) * t + out.y);
          beads.push(bg);
        }
      }
    });
    if (beads.length) {
      const bm = new THREE.Mesh(G.mergeGeometries(beads), mats.cream);
      bm.castShadow = true; m.add(bm);
    }
    // decorations
    const mk = MARKS[c.i];
    if (mk === 1) {
      const sk = new THREE.Mesh(skullG, mats.sugar); sk.castShadow = true;
      sk.add(new THREE.Mesh(socketG, mats.socket));
      sk.position.set(0, height + 0.001, 0); sk.scale.setScalar(1.15);
      sk.rotation.y = ((c.i * 37) % 7 - 3) * 0.08;
      m.add(sk);
    } else if (mk === 2) {
      const tb = new THREE.Mesh(tombG, mats.stone); tb.castShadow = true;
      tb.position.set(0, height, 0.002);
      tb.rotation.set(-0.12 + ((c.i * 13) % 5) * 0.03, ((c.i * 29) % 7 - 3) * 0.1, ((c.i * 7) % 5 - 2) * 0.04);
      m.add(tb);
    }
    // glow overlay
    const og = new THREE.BufferGeometry();
    const sh = 0.86;
    og.setAttribute('position', new THREE.Float32BufferAttribute([P[0].x * sh, 0, P[0].y * sh, P[1].x * sh, 0, P[1].y * sh, P[2].x * sh, 0, P[2].y * sh], 3));
    og.setIndex([0, 1, 2, 0, 2, 1]);
    const om = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.5, 0.12), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
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
  let hover = -1, painting = null, solvedFlag = false;
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
    const off = new THREE.Vector3(p.x - c.x, p.y + 0.028 - homes[ids[0]].y, p.z - c.z);
    ids.forEach((i, n) => {
      owner[i] = k;
      const to = homes[i].clone().add(off);
      if (instant) { meshes[i].position.copy(to); return; }
      anims.push({ mesh: meshes[i], from: meshes[i].position.clone(), to, t: -n * 0.025, d: 1.35, lift: 0.16 });
    });
  }
  function unserve(k, instant = false) {
    const idx = served.findIndex((s) => s.plate === k);
    if (idx < 0) return;
    const s = served[idx];
    served.splice(idx, 1);
    plateUsed[k] = false;
    s.cells.forEach((i, n) => {
      owner[i] = -1;
      if (instant) { meshes[i].position.copy(homes[i]); return; }
      anims.push({ mesh: meshes[i], from: meshes[i].position.clone(), to: homes[i].clone(), t: -n * 0.02, d: 1.1, lift: 0.14 });
    });
  }
  function refreshOverlays(t = 0) {
    for (let i = 0; i < cells.length; i++) {
      const ov = overlays[i];
      let v = 0;
      if (owner[i] < 0) {
        if (selected.has(i)) v = 0.42 + 0.12 * Math.sin(t * 5);
        else if (i === hover && !solvedFlag) v = 0.22;
      }
      ov.visible = v > 0.01;
      ov.material.opacity = v;
      // marked cells rise a little out of the cake
      if (owner[i] < 0 && !anims.some((a) => a.mesh === meshes[i])) meshes[i].position.y = homes[i].y + (selected.has(i) ? 0.008 : 0);
    }
  }
  function resetAll(instant = true) {
    anims.length = 0; selected.clear(); served.length = 0; plateUsed.fill(false);
    owner = new Array(cells.length).fill(-1);
    meshes.forEach((m, i) => m.position.copy(homes[i]));
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
      setTimeout(() => { p.status?.('Six guests, six slices. Nothing left over.'); p.solve?.(); }, 1500);
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
      if (solvedFlag) { p.status('Six guests, six slices. Nothing left over.'); return; }
      p.status(served.length ? `${served.length} of ${GUESTS} guests served.` : 'Mark nine triangles for the first guest — click or drag across the cake.');
    },
    update(dt, t) {
      for (let k = anims.length - 1; k >= 0; k--) {
        const a = anims[k];
        a.t += dt;
        const u = Math.min(1, Math.max(0, a.t / a.d));
        const e = u * u * (3 - 2 * u);
        a.mesh.position.lerpVectors(a.from, a.to, e);
        a.mesh.position.y += Math.sin(u * Math.PI) * a.lift;
        if (u >= 1) { a.mesh.position.copy(a.to); anims.splice(k, 1); }
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
    teardown() { hover = -1; painting = null; selected.clear(); refreshOverlays(); },
  };

  return {
    puzzle, group, meshes, cells,
    applySolved, reset: resetAll, state,
    /** QA: try to serve a slice by cell ids (returns judge result or false if illegal) */
    trySlice(ids, p = {}) {
      if (solvedFlag) return false;
      selected = new Set(ids.filter((i) => owner[i] < 0));
      if (selected.size !== SLICE) { selected.clear(); return false; }
      return judge({ status() {}, fail() {}, say() {}, solve() {}, audio: null, ...p });
    },
    tick: (dt, t) => puzzle.update(dt, t),
    /** QA: mark cells as the current (unjudged) selection */
    select(ids) { selected = new Set(ids.filter((i) => owner[i] < 0)); refreshOverlays(1); },
  };
}
