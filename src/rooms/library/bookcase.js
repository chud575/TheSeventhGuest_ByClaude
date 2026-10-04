// The columned bookcase on the back wall: base cabinets, fluted columns with
// gilt capitals, entablature (whose frieze carries the telescope letters),
// and ~900 instanced books with props.
import * as THREE from 'three';
import { L, V3, merge, bboxAt, mesh, lathe, flutedShaft, extrudeOutline } from './lib.js';
import { BOOK_ATLAS, bookAtlas } from './textures.js';
import { WALLS, BOOKCASE } from './shell.js';

export const CASE = {
  x0: BOOKCASE.x0, x1: BOOKCASE.x1,
  baseH: 0.8, baseD: 0.5, shelfD: 0.36,
  top: 2.64,             // underside of the architrave
  archH: 0.1, friezeH: 0.22, corniceH: 0.17,
  colR: 0.075,
};
// bay layout (local x along the back wall)
const COLS = [0.33, 0.56, 1.24, 2.86, 3.54, 3.77];
const BAYS = [[0.66, 1.14], [1.34, 2.76], [2.96, 3.44]];
const ROWS = 6;

function bookGeometry() {
  // unit book: x∈[-.5,.5] (thickness), y∈[0,1], z∈[-.5,.5], spine at +z
  const P = [], N = [], U = [];
  const A = BOOK_ATLAS;
  const cu = 1 / A.cols, cv = 1 / A.rows;
  const face = (verts, n, uvs) => {
    const idx = [0, 1, 2, 0, 2, 3];
    for (const i of idx) { P.push(...verts[i]); N.push(...n); U.push(uvs[i][0] * cu, uvs[i][1] * cv); }
  };
  const s0 = A.spine[0], s1 = A.spine[1], c0 = A.cover[0], c1 = A.cover[1], p0 = A.pages[0], p1 = A.pages[1];
  // rounded spine: a bulging strip (bulge 6% of depth) so the spines catch rim light
  const NS = 8, BULGE = 0.06;
  for (let k = 0; k < NS; k++) {
    const a0 = k / NS, a1 = (k + 1) / NS;
    const x0 = a0 - 0.5, x1 = a1 - 0.5;
    const z0 = 0.5 + BULGE * Math.sin(a0 * Math.PI) - BULGE * 0.5, z1 = 0.5 + BULGE * Math.sin(a1 * Math.PI) - BULGE * 0.5;
    const n0 = new THREE.Vector3(Math.cos(a0 * Math.PI) * -1.4, 0, 1).normalize(), n1 = new THREE.Vector3(Math.cos(a1 * Math.PI) * -1.4, 0, 1).normalize();
    const u0 = s0 + (s1 - s0) * a0, u1 = s0 + (s1 - s0) * a1;
    const V = [[x0, 0, z0], [x1, 0, z1], [x1, 1, z1], [x0, 1, z0]];
    const NN = [n0, n1, n1, n0];
    const UV = [[u0, 0], [u1, 0], [u1, 1], [u0, 1]];
    for (const i of [0, 1, 2, 0, 2, 3]) { P.push(...V[i]); N.push(NN[i].x, NN[i].y, NN[i].z); U.push(UV[i][0] * cu, UV[i][1] * cv); }
  }
  face([[0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5]], [1, 0, 0], [[c0, 0], [c1, 0], [c1, 1], [c0, 1]]);
  face([[-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0.5], [-0.5, 1, -0.5]], [-1, 0, 0], [[c0, 0], [c1, 0], [c1, 1], [c0, 1]]);
  face([[0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, -0.5], [0.5, 1, -0.5]], [0, 0, -1], [[c0, 0], [c1, 0], [c1, 1], [c0, 1]]);
  face([[-0.5, 1, 0.5], [0.5, 1, 0.5], [0.5, 1, -0.5], [-0.5, 1, -0.5]], [0, 1, 0], [[p0, 0.1], [p1, 0.1], [p1, 0.9], [p0, 0.9]]);
  face([[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5]], [0, -1, 0], [[p0, 0.1], [p1, 0.1], [p1, 0.9], [p0, 0.9]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  return g;
}

function bookMaterial(ctx) {
  const set = bookAtlas(ctx);
  const m = new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap, roughnessMap: set.ormMap, metalnessMap: set.ormMap, aoMap: set.ormMap,
    roughness: 1, metalness: 1, envMapIntensity: 0.9, name: 'books',
  });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aOff;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_MAP
  vMapUv += aOff;
#endif
#ifdef USE_NORMALMAP
  vNormalMapUv += aOff;
#endif
#ifdef USE_ROUGHNESSMAP
  vRoughnessMapUv += aOff;
#endif
#ifdef USE_METALNESSMAP
  vMetalnessMapUv += aOff;
#endif
#ifdef USE_AOMAP
  vAoMapUv += aOff;
#endif`);
  };
  m.customProgramCacheKey = () => 'library-books-v1';
  return m;
}

export function buildBookcase(ctx, root, mat) {
  const G = ctx.geometry;
  const rnd = ctx.random.fork ? ctx.random.fork('books') : ctx.random;
  const group = new THREE.Group();
  group.name = 'bookcase';
  group.position.copy(WALLS.back.origin);
  root.add(group);
  const C = CASE;
  const W = C.x1 - C.x0, cx = (C.x0 + C.x1) / 2;
  const caseGeos = [], giltGeos = [], darkGeos = [];

  // ---------------------------------------------------------- base cabinet
  caseGeos.push(bboxAt(W, C.baseH - 0.12, C.baseD - 0.02, cx, 0.12 + (C.baseH - 0.12) / 2, (C.baseD - 0.02) / 2, { r: 0.008 }));
  caseGeos.push(bboxAt(W + 0.04, 0.12, C.baseD + 0.02, cx, 0.06, (C.baseD + 0.02) / 2, { r: 0.01 }));            // plinth
  caseGeos.push(bboxAt(W + 0.06, 0.045, C.baseD + 0.05, cx, C.baseH - 0.0225, (C.baseD + 0.05) / 2, { r: 0.012 })); // counter top
  giltGeos.push(bboxAt(W + 0.05, 0.022, 0.012, cx, 0.125, C.baseD + 0.016, { r: 0.004 }));                         // gilt plinth bead
  giltGeos.push(bboxAt(W + 0.07, 0.012, 0.01, cx, C.baseH - 0.05, C.baseD + 0.036, { r: 0.003 }));
  // cupboard doors (raised panels) between the column pedestals
  const doorSpans = [[0.12, 0.77], ...BAYS.map(([a, b]) => [a - 0.06, b + 0.06]), [3.63, 3.88]];
  for (const [a, b] of [[C.x0 + 0.02, 0.66 - 0.02], [0.66, 1.14], [1.34, 2.05], [2.05, 2.76], [2.96, 3.44], [3.66, C.x1 - 0.02]]) {
    const w = b - a;
    if (w < 0.1) continue;
    const p = G.raisedPanel(w - 0.05, C.baseH - 0.3, { border: 0.045, bevel: 0.025, frameDepth: 0.014, fieldDepth: 0.01 });
    p.translate((a + b) / 2, 0.14 + (C.baseH - 0.3) / 2 + 0.02, C.baseD - 0.02);
    caseGeos.push(p);
    // tiny brass escutcheon
    giltGeos.push(bboxAt(0.012, 0.03, 0.006, (a + b) / 2 + w * 0.32, 0.5, C.baseD + 0.008, { r: 0.002 }));
  }
  void doorSpans;

  // ---------------------------------------------------------- shelving carcass
  const sTop = C.top, sBot = C.baseH;
  // back boards (dark) and uprights
  darkGeos.push(bboxAt(W - 0.04, sTop - sBot, 0.02, cx, (sTop + sBot) / 2, 0.012, { r: 0.002 }));
  const rowH = (sTop - sBot - 0.04) / ROWS;
  for (const [a, b] of BAYS) {
    // uprights
    caseGeos.push(bboxAt(0.035, sTop - sBot, C.shelfD, a - 0.0175, (sTop + sBot) / 2, C.shelfD / 2, { r: 0.004 }));
    caseGeos.push(bboxAt(0.035, sTop - sBot, C.shelfD, b + 0.0175, (sTop + sBot) / 2, C.shelfD / 2, { r: 0.004 }));
    // shelves with a moulded lip
    for (let r = 0; r <= ROWS; r++) {
      const y = sBot + 0.02 + r * rowH;
      if (r > 0) caseGeos.push(bboxAt(b - a, 0.026, C.shelfD - 0.01, (a + b) / 2, y, (C.shelfD - 0.01) / 2, { r: 0.004 }));
      if (r > 0 && r < ROWS) giltGeos.push(bboxAt(b - a, 0.007, 0.006, (a + b) / 2, y - 0.004, C.shelfD - 0.004, { r: 0.002 }));
    }
  }
  // pilaster backs behind the columns (fill between bays)
  for (const [a, b] of [[C.x0, 0.66 - 0.035], [1.14 + 0.035, 1.34 - 0.035], [2.76 + 0.035, 2.96 - 0.035], [3.44 + 0.035, C.x1]]) {
    caseGeos.push(bboxAt(b - a, sTop - sBot, C.shelfD - 0.04, (a + b) / 2, (sTop + sBot) / 2, (C.shelfD - 0.04) / 2, { r: 0.006 }));
    // sunken panel on the pilaster
    const p = G.raisedPanel(Math.max(0.08, b - a - 0.08), sTop - sBot - 0.2, { border: 0.03, bevel: 0.015, frameDepth: 0.008, fieldDepth: 0.006 });
    p.translate((a + b) / 2, (sTop + sBot) / 2, C.shelfD - 0.04);
    caseGeos.push(p);
  }

  // ---------------------------------------------------------- columns
  const colGeos = [], capGeos = [];
  const colH = sTop - sBot;
  for (const x of COLS) {
    const z = C.shelfD + 0.03;
    // square plinth block + attic base (gilt torus)
    caseGeos.push(bboxAt(0.2, 0.09, 0.2, x, sBot + 0.045, z, { r: 0.006 }));
    capGeos.push(at(lathe([[0.001, 0], [0.098, 0], [0.098, 0.012], [0.09, 0.02], [0.094, 0.032], [0.085, 0.044], [0.08, 0.046], [0.082, 0.056], [0.077, 0.066], [0.001, 0.066]], 40), x, sBot + 0.09, z));
    // fluted shaft
    const sh = flutedShaft(C.colR, colH - 0.36, { flutes: 18, depth: 0.0055, taper: 0.9 });
    sh.translate(x, sBot + 0.156 + (colH - 0.36) / 2, z);
    colGeos.push(sh);
    // Ionic capital: necking astragal, egg-and-dart echinus, a channelled band (canalis) rolling
    // into two spiral volutes on the front and back faces, bolsters (pulvini) on the sides, abacus
    const cy = sBot + 0.156 + colH - 0.36;
    capGeos.push(at(lathe([[0.001, 0], [0.072, 0], [0.078, 0.006], [0.078, 0.014], [0.071, 0.02], [0.071, 0.026], [0.084, 0.05], [0.092, 0.07], [0.09, 0.08], [0.001, 0.08]], 48), x, cy, z));
    for (let k = 0; k < 16; k++) {        // eggs round the echinus
      const a = (k / 16) * Math.PI * 2;
      const egg = new THREE.SphereGeometry(0.012, 7, 5);
      egg.scale(0.75, 1.15, 0.55);
      egg.rotateY(-a + Math.PI / 2);
      egg.translate(x + Math.cos(a) * 0.084, cy + 0.052, z + Math.sin(a) * 0.084);
      capGeos.push(egg);
    }
    const vy = cy + 0.095, vx = 0.088;
    for (const sx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        const pts = [];
        const turns = 2.6 * Math.PI;
        for (let k = 0; k <= 40; k++) {
          const t = (k / 40) * turns;
          const r = 0.036 * Math.exp(-0.17 * t);
          const ang = Math.PI / 2 - sx * t;          // start at the top, roll outward then down and in
          pts.push(V3(x + sx * vx + Math.cos(ang) * r, vy + Math.sin(ang) * r, z + fz * 0.08));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = new THREE.TubeGeometry(curve, 48, 1, 6, false);
        // taper the tube radius along the spiral
        const pos = tube.attributes.position, cpts = curve.getSpacedPoints(48);
        for (let i = 0; i < pos.count; i++) {
          const seg = Math.min(48, Math.floor(i / 7));
          const c = cpts[seg];
          const rr = 0.0062 * (1 - 0.55 * (seg / 48));
          const dx = pos.getX(i) - c.x, dy = pos.getY(i) - c.y, dz = pos.getZ(i) - c.z;
          const len = Math.hypot(dx, dy, dz) || 1;
          pos.setXYZ(i, c.x + dx / len * rr, c.y + dy / len * rr, c.z + dz / len * rr);
        }
        tube.computeVertexNormals();
        capGeos.push(tube);
        // the volute face (a shallow disc behind the spiral) and its eye
        const disc = new THREE.CylinderGeometry(0.036, 0.036, 0.008, 20).rotateX(Math.PI / 2);
        disc.translate(x + sx * vx, vy, z + fz * 0.076);
        capGeos.push(disc);
        const eye = new THREE.SphereGeometry(0.0075, 8, 6);
        eye.translate(x + sx * vx, vy, z + fz * 0.083);
        capGeos.push(eye);
      }
      // bolster between the two faces, pinched by a belt
      const bol = lathe([[0.001, -0.08], [0.034, -0.08], [0.03, -0.05], [0.024, -0.012], [0.028, -0.008], [0.028, 0.008], [0.024, 0.012], [0.03, 0.05], [0.034, 0.08], [0.001, 0.08]], 24);
      bol.rotateX(Math.PI / 2);
      bol.translate(x + sx * vx, vy, z);
      capGeos.push(bol);
    }
    // canalis: the band that joins the volutes across each face
    for (const fz of [-1, 1]) capGeos.push(bboxAt(2 * vx, 0.024, 0.012, x, vy + 0.024, z + fz * 0.077, { r: 0.004 }));
    capGeos.push(bboxAt(2 * vx, 0.03, 0.15, x, vy + 0.02, z, { r: 0.004 }));
    // abacus with a small ovolo
    capGeos.push(bboxAt(0.23, 0.022, 0.23, x, cy + 0.15, z, { r: 0.004 }));
    capGeos.push(bboxAt(0.25, 0.018, 0.25, x, cy + 0.17, z, { r: 0.006 }));
  }

  // ---------------------------------------------------------- entablature
  const ent = sTop;
  const projZ = C.shelfD + 0.18;
  caseGeos.push(bboxAt(W + 0.06, C.archH, projZ, cx, ent + C.archH / 2 + 0.04, projZ / 2, { r: 0.008 }));
  // frieze board (darker, with the letter recess in the centre bay)
  caseGeos.push(bboxAt(W + 0.04, C.friezeH, projZ - 0.02, cx, ent + 0.04 + C.archH + C.friezeH / 2, (projZ - 0.02) / 2, { r: 0.006 }));
  // gilt astragal + dentil course
  giltGeos.push(bboxAt(W + 0.08, 0.016, 0.02, cx, ent + 0.04 + C.archH, projZ + 0.006, { r: 0.006 }));
  const dentY = ent + 0.04 + C.archH + C.friezeH + 0.02;
  for (let x = C.x0 - 0.03; x <= C.x1 + 0.03; x += 0.05) caseGeos.push(bboxAt(0.026, 0.035, 0.03, x, dentY, projZ + 0.012, { r: 0.002 }));
  // cornice: swept crown profile across the front and returning at the ends
  {
    const yb = ent + 0.04 + C.archH + C.friezeH;
    const prof = G.PROFILES.crown(C.corniceH, 0.16);
    const path = [V3(C.x0 - 0.04, yb, 0.0), V3(C.x0 - 0.04, yb, projZ), V3(C.x1 + 0.04, yb, projZ), V3(C.x1 + 0.04, yb, 0.0)];
    // sweep wants CCW from above for an outward-facing profile: run it right->left and flip
    const g = G.sweepProfile(prof, path.slice().reverse(), { uvScale: 1 });
    caseGeos.push(g);
    caseGeos.push(bboxAt(W + 0.4, 0.03, projZ + 0.16, cx, yb + C.corniceH + 0.015, (projZ + 0.16) / 2, { r: 0.008 }));
    giltGeos.push(bboxAt(W + 0.42, 0.012, 0.012, cx, yb + C.corniceH + 0.034, projZ + 0.155, { r: 0.004 }));
  }
  // frieze letter recess (dark field the brass prisms sit in) over the central bay
  const frieze = {
    y: ent + 0.04 + C.archH + C.friezeH / 2,
    x0: BAYS[1][0] - 0.06, x1: BAYS[1][1] + 0.06,
    z: projZ - 0.02,
  };
  darkGeos.push(bboxAt(frieze.x1 - frieze.x0, C.friezeH - 0.06, 0.012, (frieze.x0 + frieze.x1) / 2, frieze.y, frieze.z + 0.002, { r: 0.002 }));
  // small rosettes on the frieze above each column
  for (const x of COLS) {
    const ro = lathe([[0.001, 0], [0.04, 0], [0.04, 0.006], [0.03, 0.012], [0.018, 0.02], [0.001, 0.024]], 24);
    ro.rotateX(Math.PI / 2); ro.translate(x, frieze.y, projZ - 0.02);
    giltGeos.push(ro);
  }

  group.add(mesh(merge(caseGeos), mat.caseWood, 'case-wood'));
  group.add(mesh(merge(darkGeos), mat.caseDark, 'case-back'));
  group.add(mesh(merge(giltGeos), mat.gilt, 'case-gilt'));
  group.add(mesh(merge(colGeos), mat.column, 'columns'));
  { const caps = mesh(merge(capGeos), mat.giltCap, 'capitals', { cast: false }); caps.userData.noShadow = true; group.add(caps); }

  // ---------------------------------------------------------- books (instanced)
  const books = [];
  const props = [];
  BAYS.forEach(([a, b], bi) => {
    for (let r = 0; r < ROWS; r++) {
      const y0 = sBot + 0.02 + r * rowH + 0.013;
      const clear = rowH - 0.03;
      let x = a + 0.006;
      // reserve a prop gap on some shelves
      const propAt = (bi === 1 && r === 4) || (bi === 0 && r === 2) || rnd.chance(0.07) ? a + (b - a) * rnd.range(0.2, 0.75) : -1;
      let propDone = false;
      while (x < b - 0.02) {
        if (!propDone && propAt > 0 && x > propAt) {
          props.push({ x: x + 0.07, y: y0, z: C.shelfD * 0.55, bay: bi, row: r });
          x += 0.16; propDone = true; continue;
        }
        // occasional horizontal stack
        if (rnd.chance(0.07) && b - x > 0.3) {
          const n = rnd.int(2, 5);
          const bw = rnd.range(0.17, 0.25), bd = rnd.range(0.15, 0.22);
          let yy = y0;
          for (let k = 0; k < n; k++) {
            const th = rnd.range(0.025, 0.05);
            books.push({ x: x + bw / 2 + rnd.range(-0.01, 0.01), y: yy, z: C.shelfD - bd / 2 - 0.02, w: th, h: bw, d: bd, lie: true, rot: rnd.range(-0.08, 0.08) });
            yy += th;
          }
          x += bw + 0.02;
          continue;
        }
        const w = rnd.chance(0.14) ? rnd.range(0.05, 0.08) : rnd.range(0.018, 0.05);
        const h = Math.min(clear - 0.004, (rnd.chance(0.25) ? rnd.range(0.86, 0.97) : rnd.chance(0.1) ? rnd.range(0.5, 0.62) : rnd.range(0.66, 0.88)) * clear);
        const d = Math.min(C.shelfD - 0.04, h * rnd.range(0.62, 0.8));
        // a lean at the end of a run
        if (rnd.chance(0.11) && x > a + 0.2) {
          const lean = rnd.range(0.18, 0.32);
          books.push({ x: x + Math.sin(lean) * h * 0.5 + w / 2, y: y0, z: C.shelfD - d / 2 - 0.025, w, h, d, lean });
          x += Math.sin(lean) * h + w + 0.03;
          continue;
        }
        books.push({ x: x + w / 2, y: y0, z: C.shelfD - d / 2 - 0.012 - rnd.range(0, 0.025), w, h, d });
        x += w + (rnd.chance(0.06) ? rnd.range(0.003, 0.01) : 0.0008);
      }
    }
  });
  const geo = bookGeometry();
  const bm = bookMaterial(ctx);
  const inst = new THREE.InstancedMesh(geo, bm, books.length);
  inst.name = 'books';
  const off = new Float32Array(books.length * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  books.forEach((bk, i) => {
    if (bk.lie) { e.set(0, bk.rot, Math.PI / 2); p.set(bk.x + bk.h / 2, bk.y + bk.w / 2, bk.z); s.set(bk.w, bk.h, bk.d); }
    else if (bk.lean) { e.set(0, 0, bk.lean); p.set(bk.x + Math.sin(bk.lean) * bk.h * 0.5, bk.y, bk.z); s.set(bk.w, bk.h, bk.d); }
    else { e.set(rnd.range(-0.01, 0.01), 0, rnd.range(-0.012, 0.012)); p.set(bk.x, bk.y, bk.z); s.set(bk.w, bk.h, bk.d); }
    q.setFromEuler(e);
    m4.compose(p, q, s);
    inst.setMatrixAt(i, m4);
    const v = rnd.int(0, 15);
    off[i * 2] = (v % 8) / 8; off[i * 2 + 1] = Math.floor(v / 8) / 2;
    const br = rnd.range(0.78, 1.15);
    col.setRGB(br, br * rnd.range(0.93, 1.0), br * rnd.range(0.85, 1.0));
    inst.setColorAt(i, col);
  });
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = true; inst.receiveShadow = true;
  group.add(inst);

  // ---------------------------------------------------------- shelf props
  const propGroup = new THREE.Group();
  propGroup.name = 'shelf-props';
  group.add(propGroup);
  props.forEach((pp, i) => {
    let o;
    switch (i % 5) {
      case 0: { // hourglass
        o = new THREE.Group();
        const glass = new THREE.Mesh(lathe([[0.001, 0.012], [0.03, 0.02], [0.034, 0.05], [0.006, 0.09], [0.034, 0.13], [0.03, 0.16], [0.001, 0.168]], 24), mat.glassClear);
        o.add(glass);
        const sand = new THREE.Mesh(lathe([[0.001, 0.014], [0.027, 0.022], [0.022, 0.045], [0.001, 0.06]], 20), mat.sand);
        o.add(sand);
        for (const y of [0, 0.168]) o.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 24).translate(0, y + 0.006, 0), mat.caseWood));
        for (let k = 0; k < 3; k++) { const a = k * 2.094; o.add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.168, 6).translate(Math.cos(a) * 0.038, 0.09, Math.sin(a) * 0.038), mat.caseWood)); }
        break;
      }
      case 1: { // small framed photograph / miniature on a stand
        o = new THREE.Group();
        const fr = new THREE.Mesh(G.frameGeometry(0.1, 0.13, { width: 0.018, depth: 0.012, uvScale: 4 }), mat.gilt);
        fr.position.y = 0.09; fr.rotation.x = -0.12; o.add(fr);
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.13), mat.miniature);
        pic.position.set(0, 0.09, -0.002); pic.rotation.x = -0.12; o.add(pic);
        o.rotation.y = 0.2;
        break;
      }
      case 2: { // brass candlestick, unlit stub
        o = new THREE.Group();
        o.add(new THREE.Mesh(lathe([[0.001, 0], [0.04, 0], [0.036, 0.01], [0.012, 0.03], [0.009, 0.1], [0.018, 0.12], [0.014, 0.13], [0.001, 0.13]], 24), mat.brass));
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.011, 0.06, 14).translate(0, 0.16, 0), mat.wax);
        o.add(c);
        break;
      }
      case 3: { // a small skull (memento mori)
        o = new THREE.Group();
        const sk = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 18), mat.bone);
        sk.scale.set(0.85, 0.9, 1.05); sk.position.y = 0.055; o.add(sk);
        const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 10), mat.bone);
        jaw.scale.set(1, 0.6, 1.1); jaw.position.set(0, 0.02, 0.022); o.add(jaw);
        for (const sx of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), mat.black);
          eye.position.set(sx * 0.018, 0.058, 0.045); o.add(eye);
        }
        o.rotation.y = -0.5;
        break;
      }
      default: { // stacked brass-bound box
        o = new THREE.Group();
        o.add(new THREE.Mesh(bboxAt(0.14, 0.07, 0.1, 0, 0.035, 0, { r: 0.005 }), mat.leatherBox));
        o.add(new THREE.Mesh(bboxAt(0.145, 0.008, 0.105, 0, 0.06, 0, { r: 0.002 }), mat.brass));
        break;
      }
    }
    o.position.set(pp.x, pp.y, pp.z);
    o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    propGroup.add(o);
  });

  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), WALLS.back.ry).add(WALLS.back.origin);
  return { group, books: inst, frieze: { ...frieze, worldCenter: toWorld((frieze.x0 + frieze.x1) / 2, frieze.y, frieze.z) }, toWorld, count: books.length };
}

function at(g, x, y, z) { g.translate(x, y, z); return g; }
void extrudeOutline;
