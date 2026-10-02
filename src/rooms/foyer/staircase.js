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
  x0: 5.0, z0: 1.8, straight: 3.4, cx: 1.4, cz: -1.6, R: 3.6,
  half: 0.9, rise: 4.2, N: 28, nose: 0.035, slab: 0.045,
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
    let offIn = S.half + 0.06, offOut = -S.half - 0.06;
    const flare = k === 0 ? 0.55 : k === 1 ? 0.3 : 0;
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
    const slab = new THREE.ExtrudeGeometry(shape, { depth: S.slab, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 4 });
    slab.rotateX(-Math.PI / 2);
    slab.translate(0, yTop - S.slab, 0);
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
      const a = V3(stairXZ(sA, offOut), y0), b = V3(stairXZ(sA, offIn), y0), c = V3(stairXZ(sA, offIn), y1), d = V3(stairXZ(sA, offOut), y1);
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
    const half = 0.62, cols = 10, list = [];
    let v = 0;
    const P = (s, off, y) => V3(stairXZ(s, off), y);
    const lift = 0.006;
    for (let k = 0; k < S.N - 1; k++) {
      const sA = k * S.g, sB = (k + 1) * S.g;
      const yT = (k + 1) * S.h + lift;
      const yPrev = k * S.h + lift;
      // profile for this step: riser up, nosing, tread
      const prof = [
        [sA + 0.004, yPrev], [sA + 0.004, yT - S.slab - 0.004], [sA - S.nose - 0.006, yT - S.slab * 0.5], [sA - S.nose + 0.004, yT], [sB, yT],
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
    const rodGeo = new THREE.CylinderGeometry(0.0065, 0.0065, 1.34, 10);
    rodGeo.rotateZ(Math.PI / 2);
    const capGeo = new THREE.SphereGeometry(0.014, 12, 8);
    const n = S.N - 2;
    const rods = new THREE.InstancedMesh(rodGeo, mats.brass, n);
    const caps = new THREE.InstancedMesh(capGeo, mats.brass, n * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let k = 1; k <= n; k++) {
      const s = k * S.g + 0.012;
      const y = k * S.h + 0.014;
      const f = stairFrame(s);
      const ang = Math.atan2(-f.n.y, f.n.x);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      const c = stairXZ(s, 0);
      m.compose(new THREE.Vector3(c.x, y, c.y), q, new THREE.Vector3(1, 1, 1));
      rods.setMatrixAt(k - 1, m);
      for (const [i, off] of [[0, 0.67], [1, -0.67]]) {
        const e = stairXZ(s, off);
        m.compose(new THREE.Vector3(e.x, y, e.y), q, new THREE.Vector3(1, 1, 1));
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
  // inner (hall side) string: two faces + cap
  const strInnerOut = new THREE.Mesh(stringRows(inner + 0.035, true, 0.34, 0.07), mats.string);
  const strInnerIn = new THREE.Mesh(stringRows(inner - 0.035, false, 0.34, 0.07), mats.string);
  strInnerOut.name = 'string';
  group.add(strInnerOut, strInnerIn);
  // wall string
  group.add(new THREE.Mesh(stringRows(outer + 0.03, true, 0.34, 0.1), mats.string));
  // string mouldings: cap sweep along the inner string top, bead along the bottom
  {
    const capPath = [], botPath = [];
    for (let i = 0; i <= 60; i++) {
      const s = sStart + (S.L - sStart) * (i / 60);
      const xz = stairXZ(s, inner);
      capPath.push(V3(xz, pitchY(s) + 0.07));
      botPath.push(V3(xz, Math.max(0.02, pitchY(s) - 0.34)));
    }
    const capProf = [[-0.045, 0], [0.045, 0], [0.045, 0.01], [0.03, 0.022], [0.0, 0.028], [-0.03, 0.022], [-0.045, 0.01], [-0.045, 0]].map(([x, y]) => new THREE.Vector2(x, y));
    group.add(new THREE.Mesh(G.sweepProfile(capProf, capPath, { uvScale: 1 }), mats.rail));
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
  }

  // -------------------------------------------------------------- balusters + rails
  const balusterH = 0.86;
  const balGeo = G.latheFromProfile([
    [0.026, 0], [0.026, 0.07], [0.02, 0.08], [0.022, 0.1], [0.016, 0.115], [0.016, 0.16], [0.024, 0.22], [0.031, 0.3], [0.029, 0.36],
    [0.02, 0.43], [0.013, 0.5], [0.013, 0.6], [0.018, 0.62], [0.014, 0.64], [0.014, 0.74], [0.02, 0.76], [0.02, 0.86], [0.0, 0.86],
  ], 14);
  const spots = [];
  for (let k = 1; k < S.N - 1; k++) {
    for (const fr of [0.25, 0.75]) {
      const s = k * S.g + S.g * fr;
      spots.push({ s, off: inner, y: pitchY(s) + 0.07 });
      if (s > S.straight + 0.15) spots.push({ s, off: outer + 0.03, y: pitchY(s) + 0.1 });
    }
  }
  const bal = new THREE.InstancedMesh(balGeo, mats.baluster, spots.length);
  {
    const m = new THREE.Matrix4();
    spots.forEach((sp, i) => {
      const xz = stairXZ(sp.s, sp.off);
      m.makeTranslation(xz.x, sp.y, xz.y);
      bal.setMatrixAt(i, m);
    });
  }
  bal.name = 'balusters';
  group.add(bal);

  // handrails (mahogany, mushroom profile)
  const railProf = [];
  {
    const pts = [[0, -0.05], [0.028, -0.05], [0.03, -0.04], [0.026, -0.03], [0.04, -0.018], [0.044, 0.0], [0.04, 0.016], [0.026, 0.028], [0.0, 0.032]];
    for (const [x, y] of pts) railProf.push(new THREE.Vector2(x, y));
    for (let i = pts.length - 2; i >= 0; i--) railProf.push(new THREE.Vector2(-pts[i][0], pts[i][1]));
  }
  const railPath = (off, y0, from, to, n = 80) => {
    const p = [];
    for (let i = 0; i <= n; i++) { const s = from + (to - from) * (i / n); const xz = stairXZ(s, off); p.push(V3(xz, pitchY(s) + y0)); }
    return p;
  };
  const innerRailPath = railPath(inner, 0.07 + balusterH + 0.05, S.g * 0.62, S.L, 90);
  const rail = new THREE.Mesh(G.sweepProfile(railProf, innerRailPath, { uvScale: 1 }), mats.rail);
  rail.name = 'handrail';
  group.add(rail);
  // outer rail on the curve
  group.add(new THREE.Mesh(G.sweepProfile(railProf, railPath(outer + 0.03, 0.1 + balusterH + 0.05, S.straight + 0.05, S.L, 50), { uvScale: 1 }), mats.rail));
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
  const newel = new THREE.Group();
  {
    const f = stairFrame(S.g * 0.45);
    const xz = stairXZ(S.g * 0.45, inner + 0.04);
    const baseY = S.h;
    const post = G.latheFromProfile([
      [0.13, 0], [0.13, 0.05], [0.115, 0.07], [0.115, 0.1], [0.1, 0.12], [0.1, 0.5], [0.12, 0.55], [0.12, 0.6], [0.08, 0.66], [0.07, 0.75],
      [0.09, 0.85], [0.11, 0.95], [0.11, 1.0], [0.13, 1.03], [0.13, 1.08], [0.09, 1.12], [0.0, 1.13],
    ], 8);
    post.rotateY(Math.PI / 8);
    const pm = new THREE.Mesh(post, mats.newel);
    newel.add(pm);
    // carved field panels (gilt bands)
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.104, 0.02, 8, 1, true), mats.gilt);
    band.rotation.y = Math.PI / 8; band.position.y = 0.5; newel.add(band);
    const band2 = band.clone(); band2.position.y = 0.13; newel.add(band2);
    newel.position.set(xz.x, baseY, xz.y);
    newel.rotation.y = Math.atan2(f.t.x, f.t.y);
    newel.userData.top = new THREE.Vector3(xz.x, baseY + 1.13, xz.y);
    group.add(newel);
  }
  // top newel where the stair meets the gallery
  {
    const xz = stairXZ(S.L, inner);
    const post = new THREE.Mesh(G.boxUV(0.14, 1.2, 0.14, 1), mats.newel);
    post.position.set(xz.x, S.rise + 0.6 - 0.1, xz.y);
    group.add(post);
    const cap = new THREE.Mesh(G.latheFromProfile([[0.1, 0], [0.1, 0.03], [0.07, 0.05], [0.05, 0.09], [0.06, 0.12], [0.0, 0.16]], 4), mats.newel);
    cap.rotation.y = Math.PI / 4;
    cap.position.set(xz.x, S.rise + 1.1, xz.y);
    group.add(cap);
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group, newel, innerRailPath, railProf, balGeo, balusterH };
}
