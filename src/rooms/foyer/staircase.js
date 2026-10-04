import * as THREE from 'three';

/**
 * The grand staircase: a straight run up the east wall that sweeps through a
 * quarter turn onto the gallery (balcony) along the north wall.
 *
 * Centre line: straight from (x0, z0) heading -z for `straight` metres, then a
 * circular arc (centre cx,cz, radius R) turning left until it heads -x.
 * Offsets are measured to the climber's LEFT (positive = inner / hall side).
 */
export const STAIR = {
  x0: 4.75, z0: 1.8, straight: 3.9, cx: 1.4, cz: -2.1, R: 3.35,
  half: 1.15, rise: 4.2, N: 28, nose: 0.035, slab: 0.045,
};
STAIR.L = STAIR.straight + STAIR.R * Math.PI / 2;
STAIR.h = STAIR.rise / STAIR.N;
STAIR.g = STAIR.L / (STAIR.N - 1);

/** centre-line point + unit tangent + left normal at distance s */
export function stairFrame(s) {
  const S = STAIR;
  if (s <= S.straight) {
    return { p: new THREE.Vector2(S.x0, S.z0 - s), t: new THREE.Vector2(0, -1), n: new THREE.Vector2(-1, 0) };
  }
  const a = -(s - S.straight) / S.R;
  const p = new THREE.Vector2(S.cx + S.R * Math.cos(a), S.cz + S.R * Math.sin(a));
  const t = new THREE.Vector2(Math.sin(a), -Math.cos(a));
  return { p, t, n: new THREE.Vector2(t.y, -t.x) };
}
/** world point (x,z) at distance s and left offset off */
export function stairXZ(s, off) {
  const f = stairFrame(s);
  return new THREE.Vector2(f.p.x + f.n.x * off, f.p.y + f.n.y * off);
}
/** nosing (pitch) line height at s */
export function pitchY(s) { return (s / STAIR.g) * STAIR.h + STAIR.h; }
/** tread top height at s (stepped) */
export function treadY(s) {
  const k = Math.max(0, Math.min(STAIR.N - 2, Math.floor(s / STAIR.g)));
  return s < 0 ? 0 : (k + 1) * STAIR.h;
}
/** a point at camera height above the stair at s (used for the glide path) */
export function stairEye(s, off = 0, eye = 1.62) {
  const p = stairXZ(s, off);
  return [p.x, pitchY(s) - STAIR.h * 0.5 + eye, p.y];
}

// ------------------------------------------------------------ geometry helpers
function quadStrip(rows, { flip = false } = {}) {
  // rows: array of arrays of {p:Vector3, u, v}; builds triangles between consecutive rows
  const pos = [], uv = [], idx = [];
  const w = rows[0].length;
  for (const r of rows) for (const c of r) { pos.push(c.p.x, c.p.y, c.p.z); uv.push(c.u, c.v); }
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < w - 1; j++) {
      const a = i * w + j, b = a + 1, c = a + w, d = c + 1;
      if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** flat-shaded quads from a list of [a,b,c,d] (counter-clockwise seen from the front) with uvs */
function quads(list) {
  const pos = [], uv = [], nor = [];
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  for (const q of list) {
    const [a, b, c, d] = q.p;
    e1.subVectors(b, a); e2.subVectors(d, a); n.crossVectors(e1, e2).normalize();
    for (const [P, U] of [[a, q.uv[0]], [b, q.uv[1]], [c, q.uv[2]], [a, q.uv[0]], [c, q.uv[2]], [d, q.uv[3]]]) {
      pos.push(P.x, P.y, P.z); uv.push(U[0], U[1]); nor.push(n.x, n.y, n.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

const V3 = (xz, y) => new THREE.Vector3(xz.x, y, xz.y);

/**
 * Build the staircase. Returns { group, balusterSpots, railPathInner, newel, eyePath }.
 */
export function buildStaircase(ctx, mats) {
  const S = STAIR;
  const { geometry: G } = ctx;
  const group = new THREE.Group();
  group.name = 'staircase';
  const treadGeos = [], riserGeos = [];

  // -------------------------------------------------------------- treads + risers
  for (let k = 0; k < S.N - 1; k++) {
    const sA = k * S.g, sB = (k + 1) * S.g;
    const yTop = (k + 1) * S.h;
    const inArc = sB > S.straight;
    const samples = inArc ? 6 : 2;
    let offIn = S.half + 0.03, offOut = -S.half - 0.06;    // inner end housed in the closed string
    // curtail: the bottom three steps flare out round the newel, the first in a full bullnose
    const flare = [0.82, 0.52, 0.26][k] ?? 0;
    const pts = [];
    // outer edge from sA-nose -> sB, then inner edge back
    for (let i = 0; i <= samples; i++) { const s = sA - S.nose + (sB - sA + S.nose) * (i / samples); pts.push(stairXZ(s, offOut)); }
    if (flare > 0) {
      // bullnose: inner end extends and wraps in a half-round
      const r = (sB - sA + S.nose) / 2;
      const sc = (sA - S.nose + sB) / 2;
      const f = stairFrame(sc);
      const c = new THREE.Vector2(f.p.x + f.n.x * (offIn + flare - r), f.p.y + f.n.y * (offIn + flare - r));
      const baseAng = Math.atan2(f.t.y, f.t.x);
      for (let i = 0; i <= 12; i++) {
        const a = baseAng + (i / 12) * Math.PI * (f.n.x * f.t.y - f.n.y * f.t.x > 0 ? -1 : 1);
        pts.push(new THREE.Vector2(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r));
      }
    } else {
      for (let i = samples; i >= 0; i--) { const s = sA - S.nose + (sB - sA + S.nose) * (i / samples); pts.push(stairXZ(s, offIn)); }
    }
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)));
    const slab = new THREE.ExtrudeGeometry(shape, { depth: S.slab - 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 4, curveSegments: 4 });   // rounded bullnose edge
    slab.rotateX(-Math.PI / 2);
    slab.translate(0, yTop - S.slab + 0.01, 0);
    treadGeos.push(G.applyBoxUVs(slab, 1));
    // riser (vertical) under the nosing at sA, from previous tread top to this tread underside
    const y0 = k * S.h, y1 = yTop - S.slab;
    if (flare > 0) {
      // solid block for the bullnose steps (shape extruded full height)
      const blk = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 4 });
      blk.rotateX(-Math.PI / 2);
      blk.translate(0, y0, 0);
      // shrink slightly so the slab nosing overhangs
      riserGeos.push(G.applyBoxUVs(blk, 1));
    } else {
      const rIn = S.half + 0.03;    // riser housed in the closed string
      const a = V3(stairXZ(sA, offOut), y0), b = V3(stairXZ(sA, rIn), y0), c = V3(stairXZ(sA, rIn), y1), d = V3(stairXZ(sA, offOut), y1);
      const w = S.half * 2 + 0.12;
      riserGeos.push(quads([{ p: [b, a, d, c], uv: [[0, y0], [w, y0], [w, y1], [0, y1]] }]));
    }
  }
  const treads = new THREE.Mesh(G.mergeGeometries(treadGeos), mats.tread);
  treads.name = 'treads';
  const risers = new THREE.Mesh(G.mergeGeometries(riserGeos.map((g) => (g.index ? g.toNonIndexed() : g))), mats.riser);
  risers.name = 'risers';
  group.add(treads, risers);

  // -------------------------------------------------------------- carpet runner
  {
    const half = S.half - 0.33, cols = 12, list = [];
    let v = 0;
    const P = (s, off, y) => V3(stairXZ(s, off), y);
    const lift = 0.006;
    for (let k = 0; k < S.N - 1; k++) {
      const sA = k * S.g, sB = (k + 1) * S.g;
      const yT = (k + 1) * S.h + lift;
      const yPrev = k * S.h + lift;
      // profile for this step: riser up, nosing, tread
      // runner: down the face of the riser (in front of it), tucked under the nosing, over the bullnose, along the tread
      const prof = [
        [sA - 0.007, yPrev], [sA - 0.007, yT - S.slab - 0.006], [sA - S.nose - 0.01, yT - S.slab * 0.55], [sA - S.nose - 0.004, yT - 0.006], [sA - S.nose + 0.012, yT], [sB - 0.007, yT],
      ];
      const nSub = sB > S.straight ? 4 : 1;
      for (let i = 0; i < prof.length - 1; i++) {
        const [s0, y0] = prof[i], [s1, y1] = prof[i + 1];
        const subs = i === prof.length - 2 ? nSub : 1;
        for (let m = 0; m < subs; m++) {
          const ta = m / subs, tb = (m + 1) / subs;
          const sa = s0 + (s1 - s0) * ta, sb = s0 + (s1 - s0) * tb;
          const ya = y0 + (y1 - y0) * ta, yb = y0 + (y1 - y0) * tb;
          const len = Math.hypot(sb - sa, yb - ya);
          for (let j = 0; j < cols; j++) {
            const oa = -half + (2 * half) * (j / cols), ob = -half + (2 * half) * ((j + 1) / cols);
            const ua = j / cols, ub = (j + 1) / cols;
            list.push({
              p: [P(sa, ob, ya), P(sa, oa, ya), P(sb, oa, yb), P(sb, ob, yb)],
              uv: [[ub, v / 0.6], [ua, v / 0.6], [ua, (v + len) / 0.6], [ub, (v + len) / 0.6]],
            });
          }
          v += len;
        }
      }
    }
    const carpet = new THREE.Mesh(quads(list), mats.carpet);
    carpet.name = 'stairCarpet';
    carpet.castShadow = false;
    group.add(carpet);
  }

  // -------------------------------------------------------------- stair rods (instanced)
  {
    const rodGeo = new THREE.CylinderGeometry(0.0085, 0.0085, (S.half - 0.33) * 2 + 0.1, 12);
    rodGeo.rotateZ(Math.PI / 2);
    // acorn finials on the rod eyes
    const capGeo = G.latheFromProfile([[0, -0.018], [0.008, -0.016], [0.014, -0.008], [0.015, 0.0], [0.012, 0.008], [0.006, 0.014], [0.0, 0.022]], 12);
    capGeo.rotateZ(Math.PI / 2);
    const n = S.N - 2;
    const rods = new THREE.InstancedMesh(rodGeo, mats.brass, n);
    const caps = new THREE.InstancedMesh(capGeo, mats.brass, n * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let k = 1; k <= n; k++) {
      const s = k * S.g - 0.017;
      const y = k * S.h + 0.017;
      const f = stairFrame(s);
      const ang = Math.atan2(-f.n.y, f.n.x);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      const c = stairXZ(s, 0);
      m.compose(new THREE.Vector3(c.x, y, c.y), q, new THREE.Vector3(1, 1, 1));
      rods.setMatrixAt(k - 1, m);
      for (const [i, off] of [[0, S.half - 0.27], [1, -(S.half - 0.27)]]) {
        const e = stairXZ(s, off);
        m.compose(new THREE.Vector3(e.x, y, e.y), q, new THREE.Vector3(off > 0 ? -1 : 1, 1, 1));
        caps.setMatrixAt((k - 1) * 2 + i, m);
      }
    }
    rods.name = 'stairRods'; caps.name = 'stairRodEyes';
    group.add(rods, caps);
  }

  // -------------------------------------------------------------- strings, soffit
  const sStart = S.g * 0.5;
  const stringRows = (off, faceLeft, depthBelow, above) => {
    const rows = [];
    const n = 90;
    for (let i = 0; i <= n; i++) {
      const s = sStart + (S.L - sStart) * (i / n);
      const yp = pitchY(s);
      const yb = Math.max(0, yp - depthBelow), yt = yp + above;
      const xz = stairXZ(s, off);
      rows.push([{ p: V3(xz, yb), u: s, v: yb }, { p: V3(xz, yt), u: s, v: yt }]);
    }
    return quadStrip(rows, { flip: faceLeft });
  };
  const inner = S.half + 0.07, outer = -S.half - 0.07;
  // inner (hall side) CUT string: its top follows the step outline, so every tread end and riser shows
  const cutRows = (off, depthBelow) => {
    const rows = [];
    const push = (s, yt) => {
      const xz = stairXZ(s, off);
      const yb = Math.max(0, pitchY(s) - depthBelow);
      rows.push([{ p: V3(xz, yb), u: s, v: yb }, { p: V3(xz, Math.max(yb + 0.001, yt)), u: s, v: yt }]);
    };
    for (let k = 0; k < S.N - 1; k++) {
      const sA = Math.max(sStart, k * S.g), sB = (k + 1) * S.g;
      if (sB <= sStart) continue;
      const yt = (k + 1) * S.h - S.slab;
      const sub = sB > S.straight ? 4 : 1;
      for (let i = 0; i <= sub; i++) push(sA + (sB - sA) * (i / sub) - (i === sub ? 0.0005 : 0), yt);
    }
    return quadStrip(rows, { flip: false });
  };
  // CLOSED string on the hall side: a deep raking apron that hides the step ends (no sawtooth), capped by a
  // moulded rail the balusters stand on, its face panelled with applied bolection mouldings
  const STR_TOP = 0.07, STR_DEPTH = 0.4;
  const strMat = mats.string.clone(); strMat.side = THREE.DoubleSide;
  const strInnerOut = new THREE.Mesh(stringRows(inner + 0.035, false, STR_DEPTH, STR_TOP), strMat);
  const strInnerIn = new THREE.Mesh(stringRows(inner - 0.035, false, STR_DEPTH, STR_TOP), strMat);
  strInnerOut.name = 'string';
  group.add(strInnerOut, strInnerIn);
  void cutRows;
  {
    // string capping (the shoe rail): covers the top edge and the 7 cm thickness
    const capProf = [[-0.055, 0], [0.055, 0], [0.055, 0.012], [0.045, 0.02], [0.03, 0.028], [-0.03, 0.028], [-0.045, 0.02], [-0.055, 0.012], [-0.055, 0]].map(([x, y]) => new THREE.Vector2(x, y));
    const capPath = [], beadA = [], beadB = [];
    for (let i = 0; i <= 90; i++) {
      const sv = sStart + (S.L - sStart) * (i / 90);
      capPath.push(V3(stairXZ(sv, inner), pitchY(sv) + STR_TOP));
      beadA.push(V3(stairXZ(sv, inner + 0.036), pitchY(sv) + STR_TOP - 0.06));
      beadB.push(V3(stairXZ(sv, inner + 0.036), Math.max(0.03, pitchY(sv) - STR_DEPTH + 0.07)));
    }
    group.add(new THREE.Mesh(G.sweepProfile(capProf, capPath, { uvScale: 1 }), mats.rail));
    // applied panel mouldings: two raking beads with stiles between, so the apron reads as framed panels
    const bead = [[0, -0.014], [0.006, -0.012], [0.011, -0.006], [0.013, 0], [0.011, 0.006], [0.006, 0.012], [0, 0.014]].map(([x, y]) => new THREE.Vector2(y, x));
    const gbead = [[0, -0.005], [0.004, -0.003], [0.005, 0], [0.004, 0.003], [0, 0.005]].map(([x, y]) => new THREE.Vector2(y, x));
    const geos = [];
    const push = (g) => geos.push(g.index ? g.toNonIndexed() : g);
    const faceN = (sv) => { const f = stairFrame(sv); return new THREE.Vector3(f.n.x, 0, f.n.y); };
    push(G.sweepProfile(bead, beadA, { uvScale: 1, up: undefined }));
    push(G.sweepProfile(bead, beadB, { uvScale: 1 }));
    const panelLen = 0.95;
    for (let sv = sStart + 0.25; sv < S.L - 0.2; sv += panelLen) {
      const a = V3(stairXZ(sv, inner + 0.036), pitchY(sv) + STR_TOP - 0.075);
      const b = V3(stairXZ(sv, inner + 0.036), Math.max(0.05, pitchY(sv) - STR_DEPTH + 0.085));
      if (a.y - b.y < 0.1) continue;
      push(G.sweepProfile(bead, [a, b], { uvScale: 1 }));
    }
    void faceN;
    group.add(new THREE.Mesh(G.mergeGeometries(geos), mats.rail));
    // a fine gilt line inside the frame
    const gl = [];
    for (let i = 0; i <= 90; i++) { const sv = sStart + (S.L - sStart) * (i / 90); gl.push(V3(stairXZ(sv, inner + 0.036), pitchY(sv) - 0.17)); }
    group.add(new THREE.Mesh(G.sweepProfile(gbead, gl, { uvScale: 2 }), mats.gilt));
  }
  // cove moulding tucked under every nosing
  {
    const cove = [[0, 0], [0.0, -0.022], [0.006, -0.012], [0.014, -0.005], [0.022, 0]].map(([x, y]) => new THREE.Vector2(x, y));
    const geos = [];
    for (let k = 1; k < S.N - 1; k++) {
      const sA = k * S.g;
      const y = (k + 1) * S.h - S.slab + 0.001;
      // only where the wood shows either side of the runner (profile x faces the climber)
      for (const [o0, o1] of [[-S.half - 0.04, -(S.half - 0.32)], [S.half - 0.32, S.half + 0.03]]) {
        const a = stairXZ(sA - 0.001, o0), b = stairXZ(sA - 0.001, o1);
        const g = G.sweepProfile(cove, [V3(a, y), V3(b, y)], { uvScale: 1 });
        geos.push(g.index ? g.toNonIndexed() : g);
      }
    }
    const coves = new THREE.Mesh(G.mergeGeometries(geos), mats.rail);
    coves.name = 'nosingCoves';
    group.add(coves);
  }
  // wall string
  group.add(new THREE.Mesh(stringRows(outer + 0.03, true, 0.34, 0.1), mats.string));
  // string mouldings: cap sweep along the inner string top, bead along the bottom
  {
    const capPath = [], botPath = [];
    for (let i = 0; i <= 60; i++) {
      const s = sStart + (S.L - sStart) * (i / 60);
      const xz = stairXZ(s, inner);
      capPath.push(V3(xz, pitchY(s) + 0.07));
      botPath.push(V3(xz, Math.max(0.02, pitchY(s) - 0.36)));
    }
    const capProf = [[-0.045, 0], [0.045, 0], [0.045, 0.01], [0.03, 0.022], [0.0, 0.028], [-0.03, 0.022], [-0.045, 0.01], [-0.045, 0]].map(([x, y]) => new THREE.Vector2(x, y));
    void capProf; void capPath;
    const botProf = [[-0.05, 0.0], [0.05, 0.0], [0.05, 0.02], [0.03, 0.035], [-0.03, 0.035], [-0.05, 0.02], [-0.05, 0]].map(([x, y]) => new THREE.Vector2(x, -y));
    group.add(new THREE.Mesh(G.sweepProfile(botProf, botPath, { uvScale: 1 }), mats.gilt));
  }
  // soffit (plaster underside)
  {
    const rows = [];
    const n = 90;
    for (let i = 0; i <= n; i++) {
      const s = sStart + (S.L - sStart) * (i / n);
      const y = Math.max(0.0, pitchY(s) - 0.34);
      const row = [];
      for (let j = 0; j <= 6; j++) {
        const off = outer + (inner - outer) * (j / 6);
        const xz = stairXZ(s, off);
        row.push({ p: V3(xz, y), u: off, v: s });
      }
      rows.push(row);
    }
    const soffit = new THREE.Mesh(quadStrip(rows, { flip: true }), mats.soffit);
    soffit.name = 'soffit';
    group.add(soffit);
    // panelled soffit: moulded ribs across the underside every ~0.8 m and a bead along each edge
    const ribs = [];
    const rib = [[-0.06, 0], [0.06, 0], [0.06, -0.025], [0.045, -0.04], [0.04, -0.055], [0.022, -0.068], [0.0, -0.072], [-0.022, -0.068], [-0.04, -0.055], [-0.045, -0.04], [-0.06, -0.025], [-0.06, 0]].map(([x, y]) => new THREE.Vector2(x, y));
    for (let sv = sStart + 0.6; sv < S.L - 0.3; sv += 0.62) {
      const y = pitchY(sv) - 0.34;
      if (y < 1.0) continue;
      const g = G.sweepProfile(rib, [V3(stairXZ(sv, outer + 0.02), y), V3(stairXZ(sv, inner - 0.04), y)], { uvScale: 1 });
      ribs.push(g.index ? g.toNonIndexed() : g);
    }
    for (const off of [outer + 0.05, inner - 0.07]) {
      const pth = [];
      for (let i = 0; i <= 60; i++) { const sv = sStart + (S.L - sStart) * (i / 60); const y = pitchY(sv) - 0.34; if (y > 0.9) pth.push(V3(stairXZ(sv, off), y)); }
      if (pth.length > 2) { const g = G.sweepProfile(rib.map((v) => v.clone().multiplyScalar(0.7)), pth, { uvScale: 1 }); ribs.push(g.index ? g.toNonIndexed() : g); }
    }
    if (ribs.length) { const rm = new THREE.Mesh(G.mergeGeometries(ribs), mats.soffit); rm.name = 'soffitRibs'; group.add(rm); }
  }

  // -------------------------------------------------------------- balusters + rails
  // three alternating turned profiles standing on the string capping: A = vase & ring, B = bobbin-turned,
  // C = barley twist; all turned in the stair's mahogany
  const railGap = 0.93;
  const BAL_Y0 = STR_TOP + 0.028;
  const LA = railGap - BAL_Y0;
  const lathe = (pts, len) => {
    const sc = len / pts[pts.length - 1][1];
    return G.latheFromProfile(pts.map(([r, y]) => [r, y * sc]), 16);
  };
  const profA = [
    [0.024, 0], [0.024, 0.09], [0.019, 0.1], [0.021, 0.115], [0.015, 0.13], [0.014, 0.17], [0.02, 0.21], [0.029, 0.27], [0.033, 0.33], [0.031, 0.38],
    [0.024, 0.43], [0.016, 0.48], [0.012, 0.53], [0.012, 0.6], [0.017, 0.615], [0.021, 0.63], [0.016, 0.645], [0.012, 0.66], [0.012, 0.74],
    [0.018, 0.755], [0.013, 0.77], [0.019, 0.79], [0.019, 0.93], [0.0, 0.93],
  ];
  const profB = [[0.024, 0], [0.024, 0.09], [0.018, 0.1], [0.02, 0.112]];
  for (let i = 0; i < 9; i++) { const y0 = 0.12 + i * 0.07; profB.push([0.013, y0], [0.021, y0 + 0.02], [0.023, y0 + 0.035], [0.021, y0 + 0.05], [0.013, y0 + 0.07]); }
  profB.push([0.017, 0.78], [0.019, 0.79], [0.019, 0.93], [0.0, 0.93]);
  const twistGeo = (len) => {
    const parts = [];
    const blockLo = lathe([[0.024, 0], [0.024, 0.1], [0.02, 0.11], [0.022, 0.125], [0.016, 0.14], [0.0, 0.14]], 0.14 * len / 0.93 * 0.93);
    parts.push(blockLo);
    const blockHi = lathe([[0.016, 0], [0.022, 0.015], [0.019, 0.03], [0.019, 0.12], [0.0, 0.12]], 0.12 * len / 0.93 * 0.93);
    blockHi.translate(0, len - 0.12 * len, 0); parts.push(blockHi);
    // double barley twist between the blocks
    const y0 = 0.14 * len, y1 = len - 0.12 * len, rows = 64, seg = 20;
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= rows; j++) {
      const t = j / rows, y = y0 + (y1 - y0) * t;
      const taper = Math.min(1, Math.min(t, 1 - t) * 10);
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * Math.PI * 2;
        const r = 0.012 + 0.0065 * taper * (0.5 + 0.5 * Math.cos(2 * (th - y * 26.0)));
        pos.push(Math.cos(th) * r, y, Math.sin(th) * r); uv.push(i / seg, y);
      }
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const tw = new THREE.BufferGeometry();
    tw.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tw.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tw.setIndex(idx); tw.computeVertexNormals();
    parts.push(tw);
    return G.mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  };
  const balGeo = lathe(profA, LA);
  const balGeoB = lathe(profB, LA);
  const balGeoC = twistGeo(LA);
  const spots = [[], [], []], spotsO = [];
  let bi = 0;
  for (let k = 1; k < S.N - 1; k++) {
    for (const fr of [0.25, 0.75]) {
      const s = k * S.g + S.g * fr;
      spots[bi++ % 3].push({ s, off: inner, y: pitchY(s) + BAL_Y0 });
      if (s > S.straight + 0.15) spotsO.push({ s, off: outer + 0.03, y: pitchY(s) + 0.1 });
    }
  }
  const instance = (geo, sp, sy = 1) => {
    const im = new THREE.InstancedMesh(geo, mats.baluster, sp.length);
    const m = new THREE.Matrix4();
    sp.forEach((p, i) => { const xz = stairXZ(p.s, p.off); m.makeScale(1, sy, 1).setPosition(xz.x, p.y, xz.y); im.setMatrixAt(i, m); });
    im.name = 'balusters';
    group.add(im);
    return im;
  };
  instance(balGeo, spots[0]); instance(balGeoB, spots[1]); instance(balGeoC, spots[2]);
  instance(balGeo, spotsO, 0.86 / LA);
  const balusterH = 0.86;
  const balGeoGallery = lathe(profA, 0.86);

  // handrails (mahogany, mushroom profile)
  const railProf = [];
  {
    // heavy moulded Victorian rail (~95 mm wide)
    const pts = [[0, -0.06], [0.026, -0.06], [0.03, -0.052], [0.027, -0.042], [0.034, -0.034], [0.046, -0.022], [0.05, -0.004], [0.048, 0.012], [0.04, 0.026], [0.024, 0.036], [0.0, 0.04]];
    for (const [x, y] of pts) railProf.push(new THREE.Vector2(x, y));
    for (let i = pts.length - 2; i >= 0; i--) railProf.push(new THREE.Vector2(-pts[i][0], pts[i][1]));
  }
  const railPath = (off, y0, from, to, n = 80) => {
    const p = [];
    for (let i = 0; i <= n; i++) { const s = from + (to - from) * (i / n); const xz = stairXZ(s, off); p.push(V3(xz, pitchY(s) + y0)); }
    return p;
  };
  const innerRailPath = railPath(inner, railGap + 0.06, S.g * 0.62, S.L, 90);
  const rail = new THREE.Mesh(G.sweepProfile(railProf, innerRailPath, { uvScale: 1 }), mats.rail);
  rail.name = 'handrail';
  group.add(rail);
  // outer rail on the curve
  group.add(new THREE.Mesh(G.sweepProfile(railProf, railPath(outer + 0.03, 0.1 + 0.86 + 0.06, S.straight + 0.05, S.L, 50), { uvScale: 1 }), mats.rail));
  // wall rail on brass brackets along the straight run
  {
    const wp = railPath(-S.half - 0.04, 0.92, 0.3, S.straight + 0.08, 12);
    const small = railProf.map((p) => p.clone().multiplyScalar(0.7));
    group.add(new THREE.Mesh(G.sweepProfile(small, wp, { uvScale: 1 }), mats.rail));
    for (let s = 0.6; s < S.straight; s += 1.1) {
      const xz = stairXZ(s, -S.half - 0.04);
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), mats.brass);
      br.rotation.z = Math.PI / 2; br.position.set(xz.x + 0.035, pitchY(s) + 0.88, xz.y);
      group.add(br);
    }
  }

  // -------------------------------------------------------------- newel posts
  // carved starting newel: moulded plinth, square shaft with raised & gilt-lined panels, necking,
  // capital block and a turned urn finial
  const newel = new THREE.Group();
  const carvedNewel = (height, w = 0.2) => {
    const g = new THREE.Group();
    const RB = (bw, bh, bd, r = 0.006) => new G.RoundedBoxGeometry(bw, bh, bd, 2, r);
    const box = (bw, bh, bd, y, m = mats.newel) => { const b = new THREE.Mesh(RB(bw, bh, bd), m); b.position.y = y; g.add(b); return b; };
    box(w + 0.07, 0.06, w + 0.07, 0.03);
    box(w + 0.04, 0.05, w + 0.04, 0.085);
    box(w + 0.015, 0.03, w + 0.015, 0.125);
    const shaftH = height - 0.38;
    box(w, shaftH, w, 0.14 + shaftH / 2);
    const pg = G.raisedPanel(w - 0.06, shaftH - 0.12, { border: 0.018, bevel: 0.016, fieldDepth: 0.006 });
    for (let i = 0; i < 4; i++) {
      const pnl = new THREE.Mesh(pg, mats.newel);
      const a = i * Math.PI / 2;
      pnl.position.set(Math.sin(a) * w / 2, 0.14 + shaftH / 2, Math.cos(a) * w / 2); pnl.rotation.y = a; g.add(pnl);
      const line = new THREE.Mesh(G.frameGeometry(w - 0.05, shaftH - 0.11, { width: 0.006, depth: 0.004, uvScale: 1 }), mats.gilt);
      line.position.copy(pnl.position); line.rotation.y = a; g.add(line);
    }
    const top = 0.14 + shaftH;
    box(w + 0.02, 0.025, w + 0.02, top + 0.0125, mats.gilt);
    box(w - 0.02, 0.06, w - 0.02, top + 0.055);
    box(w + 0.05, 0.035, w + 0.05, top + 0.1);
    box(w + 0.08, 0.03, w + 0.08, top + 0.13);
    const urn = G.latheFromProfile([[0.0, 0], [0.06, 0], [0.06, 0.015], [0.04, 0.03], [0.035, 0.05], [0.06, 0.08], [0.075, 0.11], [0.07, 0.14], [0.05, 0.16], [0.03, 0.175], [0.035, 0.19], [0.022, 0.21], [0.03, 0.235], [0.012, 0.265], [0.0, 0.28]], 24);
    const u = new THREE.Mesh(urn, mats.newel); u.position.y = top + 0.145; g.add(u);
    g.userData.top = top + 0.145;
    return g;
  };
  {
    const f = stairFrame(S.g * 0.45);
    const xz = stairXZ(S.g * 0.45, S.half + 0.12);
    const baseY = S.h;
    const post = carvedNewel(1.13, 0.21);
    newel.add(post);
    newel.position.set(xz.x, baseY, xz.y);
    newel.rotation.y = Math.atan2(f.t.x, f.t.y);
    newel.userData.top = new THREE.Vector3(xz.x, baseY + post.userData.top, xz.y);
    group.add(newel);
  }
  // top newel where the stair meets the gallery
  {
    const xz = stairXZ(S.L, inner);
    const post = carvedNewel(1.12, 0.17);
    post.position.set(xz.x, S.rise, xz.y);
    group.add(post);
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group, newel, innerRailPath, railProf, balGeo: balGeoGallery, balusterH, carvedNewel };
}
