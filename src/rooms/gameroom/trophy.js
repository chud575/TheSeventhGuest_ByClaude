import * as THREE from 'three';

/**
 * The stag's head over the mantel, modelled properly: a lofted head/neck (smooth
 * station spline, 36 radial segments) with a tapered muzzle, nostril dents, eye
 * sockets, glossy glass eyes, cupped ears and a neck that flares into a carved
 * walnut shield. Antlers are tapering tubes with a beaded burr at the pedicle and
 * a bone-brown to ivory gradient toward the tine tips.
 *
 * Faces +Z, shield back at z = 0, origin at the shield centre.
 */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Loft an elliptical-ish cross-section along a spline of stations.
 * station: { p: [x,y,z], rx, ry, under?: lower-half narrowing 0..1, top?: flatten top 0..1 }
 * returns BufferGeometry with uv (u around, v along) and a per-vertex 't' (0..1 along) in attribute 'along'.
 */
export function loft(stations, { rings = 48, radial = 36, capEnd = true, deform } = {}) {
  const P = new THREE.CatmullRomCurve3(stations.map((s) => V3(...s.p)), false, 'centripetal');
  const lerpKey = (k, t) => {
    const f = t * (stations.length - 1);
    const i = Math.min(stations.length - 2, Math.floor(f));
    const u = f - i;
    const a = stations[Math.max(0, i - 1)][k] ?? 0, b = stations[i][k] ?? 0, c = stations[i + 1][k] ?? 0, d = stations[Math.min(stations.length - 1, i + 2)][k] ?? 0;
    // Catmull-Rom on scalars
    return 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  };
  const pos = [], uv = [], along = [], idx = [];
  const up = V3(0, 1, 0);
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const c = P.getPoint(t);
    const T = P.getTangent(t).normalize();
    const X = new THREE.Vector3().crossVectors(up, T).normalize();
    if (X.lengthSq() < 1e-6) X.set(1, 0, 0);
    const Y = new THREE.Vector3().crossVectors(T, X).normalize();
    const rx = Math.max(1e-4, lerpKey('rx', t)), ry = Math.max(1e-4, lerpKey('ry', t));
    const under = lerpKey('under', t), top = lerpKey('top', t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      let x = ca * rx, y = sa * ry;
      if (sa < 0) x *= 1 - under * (-sa) * 0.55;          // jaw / throat narrows underneath
      if (sa > 0) y *= 1 - top * sa * sa * 0.25;           // flatter forehead
      const p = c.clone().addScaledVector(X, x).addScaledVector(Y, y);
      if (deform) deform(p, t, a, c, X, Y);
      pos.push(p.x, p.y, p.z);
      uv.push(j / radial * 2, t * 3);
      along.push(t);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  if (capEnd) {
    const end = P.getPoint(1);
    const ci = pos.length / 3;
    pos.push(end.x, end.y, end.z); uv.push(0.5, 3); along.push(1);
    const base = rings * (radial + 1);
    for (let j = 0; j < radial; j++) idx.push(base + j, base + j + 1, ci);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Tapered tube with a pointed tip and a vertex-colour gradient (c0 at base -> c1 at tip). */
export function antlerTube(curve, segs, r0, r1, radial, c0, c1, tipPow = 1.0) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const len = curve.getLength();
  const ca = new THREE.Color(), cb = new THREE.Color(c0), cc = new THREE.Color(c1);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    let r = r0 + (r1 - r0) * t;
    if (t > 0.85) r *= Math.max(0.05, 1 - ((t - 0.85) / 0.15) ** 1.6 * 0.95);   // sharpen the point
    // slight knurling / beading along the beam
    r *= 1 + 0.06 * Math.sin(t * len * 140) * (1 - t);
    const N = frames.normals[i], B = frames.binormals[i];
    ca.copy(cb).lerp(cc, Math.pow(t, tipPow));
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const n = N.clone().multiplyScalar(Math.cos(a)).add(B.clone().multiplyScalar(Math.sin(a)));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      nor.push(n.x, n.y, n.z);
      uv.push(j / radial, t * len * 3);
      col.push(ca.r, ca.g, ca.b);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

function toNI(g) {
  let q = g.index ? g.toNonIndexed() : g;
  if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
  if (!q.attributes.color) {
    const c = new Float32Array(q.attributes.position.count * 3).fill(1);
    q.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  }
  for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) q.deleteAttribute(k);
  return q;
}

/**
 * @param mats { shield (walnut), fur (map set), eye, nose, antlerMap, gilt }
 */
export function buildStag(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'trophy:stag';

  // -------------------------------------------------------------- carved walnut shield
  const pw = 0.25, ph = 0.4;
  const shieldShape = (s) => {
    const sh = new THREE.Shape();
    const w = pw * s, h = ph * s;
    sh.moveTo(0, -h / 2 - 0.05 * s);
    sh.bezierCurveTo(w * 0.55, -h / 2 - 0.02 * s, w, -h * 0.3, w, 0);
    sh.bezierCurveTo(w, h * 0.3, w * 0.92, h / 2, w * 0.62, h / 2);
    sh.bezierCurveTo(w * 0.35, h / 2, w * 0.18, h / 2 + 0.01 * s, 0, h / 2 + 0.06 * s);
    sh.bezierCurveTo(-w * 0.18, h / 2 + 0.01 * s, -w * 0.35, h / 2, -w * 0.62, h / 2);
    sh.bezierCurveTo(-w * 0.92, h / 2, -w, h * 0.3, -w, 0);
    sh.bezierCurveTo(-w, -h * 0.3, -w * 0.55, -h / 2 - 0.02 * s, 0, -h / 2 - 0.05 * s);
    return sh;
  };
  const back = new THREE.ExtrudeGeometry(shieldShape(1), { depth: 0.022, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.016, bevelSegments: 4, curveSegments: 28 });
  back.translate(0, 0, 0.012);
  g.add(new THREE.Mesh(G.applyBoxUVs(back, 1.5), mats.shield));
  const mid = new THREE.ExtrudeGeometry(shieldShape(0.82), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 3, curveSegments: 28 });
  mid.translate(0, 0.005, 0.05);
  g.add(new THREE.Mesh(G.applyBoxUVs(mid, 1.5), mats.shield));
  // gilt bead around the inner field
  {
    const pts = shieldShape(0.84).getSpacedPoints(120).map((p) => V3(p.x, p.y + 0.005, 0.048));
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.004, 6, true);
    g.add(new THREE.Mesh(tube, mats.gilt));
  }

  // -------------------------------------------------------------- head + neck loft
  // spine from the shield (z ~ 0.06) out and up into the skull, then down the long face
  const st = [
    { p: [0, -0.06, 0.04], rx: 0.145, ry: 0.2, under: 0.0 },
    { p: [0, -0.025, 0.13], rx: 0.115, ry: 0.16, under: 0.15 },
    { p: [0, 0.03, 0.21], rx: 0.094, ry: 0.128, under: 0.3 },
    { p: [0, 0.09, 0.28], rx: 0.084, ry: 0.1, under: 0.45, top: 0.2 },
    { p: [0, 0.133, 0.34], rx: 0.079, ry: 0.08, under: 0.55, top: 0.5 },
    { p: [0, 0.142, 0.4], rx: 0.067, ry: 0.066, under: 0.55, top: 0.6 },
    { p: [0, 0.127, 0.47], rx: 0.05, ry: 0.056, under: 0.42, top: 0.5 },
    { p: [0, 0.106, 0.54], rx: 0.042, ry: 0.05, under: 0.3, top: 0.4 },
    { p: [0, 0.09, 0.6], rx: 0.039, ry: 0.046, under: 0.2, top: 0.3 },
    { p: [0, 0.083, 0.633], rx: 0.033, ry: 0.038, under: 0.1 },
    { p: [0, 0.079, 0.646], rx: 0.015, ry: 0.018 },
  ];

  const deform = (p, t, a, c, X, Y) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    // nostril dents on each side of the nose tip
    if (t > 0.86 && t < 0.98) { const k = Math.exp(-(((t - 0.93) / 0.035) ** 2)) * Math.exp(-(((Math.abs(ca) - 0.8) / 0.18) ** 2)) * (sa > -0.3 ? 1 : 0); p.addScaledVector(X, -Math.sign(ca) * 0.008 * k); }
    // eye sockets: brow ridge above, hollow below/in front
    if (t > 0.45 && t < 0.66) {
      const e = Math.exp(-(((t - 0.555) / 0.04) ** 2)) * Math.exp(-(((a % (Math.PI * 2)) - (ca > 0 ? 0.45 : Math.PI - 0.45)) ** 2 / 0.06));
      p.addScaledVector(X, -Math.sign(ca) * 0.008 * e);
    }
    // pre-orbital hollows down the face
    if (t > 0.62 && t < 0.85) { const k = Math.exp(-(((t - 0.72) / 0.06) ** 2)) * Math.exp(-((sa - 0.1) ** 2) / 0.05) * Math.abs(ca); p.addScaledVector(X, -Math.sign(ca) * 0.005 * k); }
    // mouth crease low on the muzzle
    if (t > 0.78 && t < 0.97) { const k = Math.exp(-((sa + 0.45) ** 2) / 0.006) * Math.abs(ca); p.addScaledVector(X, -Math.sign(ca) * 0.004 * k); }
    // a mane ridge along the top of the neck
    if (t < 0.4) { const k = Math.exp(-((sa - 1) ** 2) / 0.08) * (1 - t / 0.4); p.addScaledVector(Y, 0.012 * k); }
  };
  const headG = loft(st, { rings: 64, radial: 40, deform });
  // vertex colours: dark mane on the neck, lighter face, pale throat, near-black nose and lips
  {
    const along = headG.attributes.along, pos = headG.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const radial = 41;
    for (let i = 0; i < pos.count; i++) {
      const t = along.getX(i);
      const j = i % radial; const a = (j / 40) * Math.PI * 2; const sa = Math.sin(a);
      let c = [1, 1, 1];
      const mane = Math.max(0, 1 - t / 0.42);
      c = c.map((v) => v * (1 - mane * 0.45));
      const throat = Math.exp(-(((t - 0.42) / 0.12) ** 2)) * Math.max(0, -sa);
      c = [c[0] + throat * 0.9, c[1] + throat * 0.85, c[2] + throat * 0.75];
      const face = Math.max(0, Math.min(1, (t - 0.55) / 0.2));
      c = [c[0] * (1 + face * 0.25), c[1] * (1 + face * 0.2), c[2] * (1 + face * 0.1)];
      const nose = Math.max(0, Math.min(1, (t - 0.9) / 0.05)) * (sa > -0.6 ? 1 : 0.6);
      c = c.map((v) => v * (1 - nose * 0.9));
      const lip = Math.exp(-((sa + 0.5) ** 2) / 0.01) * Math.max(0, Math.min(1, (t - 0.75) / 0.1));
      c = c.map((v) => v * (1 - lip * 0.6));
      col.set(c, i * 3);
    }
    headG.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  const head = new THREE.Mesh(headG, mats.fur);
  g.add(head);

  // glossy nose leather + glass eyes with a lid ring
  const noseG = new THREE.SphereGeometry(0.03, 24, 16); noseG.scale(1.2, 0.85, 0.7); noseG.translate(0, 0.086, 0.634);
  g.add(new THREE.Mesh(noseG, mats.nose));
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 20, 14), mats.eye);
    eye.position.set(sx * 0.061, 0.158, 0.41); eye.scale.set(0.8, 1, 1.15); eye.rotation.y = sx * 0.4;
    g.add(eye);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.0138, 0.0035, 8, 24), mats.nose);
    lid.position.copy(eye.position); lid.rotation.y = sx * (Math.PI / 2 - 0.4); lid.scale.set(1.15, 0.85, 1);
    g.add(lid);
    // tear-duct (pre-orbital gland) slit
    const gl = new THREE.Mesh(new THREE.CapsuleGeometry(0.003, 0.02, 4, 8), mats.nose);
    gl.position.set(sx * 0.052, 0.142, 0.445); gl.rotation.set(1.2, 0, sx * 0.3); g.add(gl);
  }
  // cupped ears: a partial sphere shell, long and pointed, turned outward
  for (const sx of [-1, 1]) {
    const eg = new THREE.SphereGeometry(0.045, 20, 16, Math.PI * 0.15, Math.PI * 1.1, 0, Math.PI);
    const p = eg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 0.045;
      const taper = 0.35 + 0.65 * Math.max(0, 1 - Math.max(0, y)) ** 1.5;
      p.setXYZ(i, p.getX(i) * taper * 0.5, p.getY(i) * 1.35, p.getZ(i) * taper * 0.42);
    }
    eg.computeVertexNormals();
    const c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const k = 0.6 + 0.4 * (p.getY(i) / 0.06 * 0.5 + 0.5); c.set([k, k, k], i * 3); }
    eg.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const ear = new THREE.Mesh(eg, mats.furDouble);
    ear.position.set(sx * 0.098, 0.205, 0.33);
    ear.rotation.set(-0.45, sx * 0.55, -sx * 0.95);
    g.add(ear);
  }

  // -------------------------------------------------------------- antlers
  const C0 = 0x6a5038, C1 = 0xfff6e4;
  const bone = [];
  for (const sx of [-1, 1]) {
    const base = V3(sx * 0.042, 0.205, 0.36);
    const beam = new THREE.CatmullRomCurve3([
      base, V3(sx * 0.1, 0.27, 0.31), V3(sx * 0.19, 0.38, 0.25), V3(sx * 0.26, 0.52, 0.2),
      V3(sx * 0.28, 0.66, 0.22), V3(sx * 0.25, 0.79, 0.28), V3(sx * 0.21, 0.88, 0.33),
    ], false, 'centripetal');
    bone.push(antlerTube(beam, 48, 0.021, 0.008, 12, C0, 0xd8c4a0, 1.2));
    // tines: brow (forward, low), bez, trez, then a three-point crown
    const tines = [
      [0.07, V3(sx * 0.02, 0.05, 0.17), 0.012, 0.15],
      [0.2, V3(sx * 0.02, 0.07, 0.15), 0.011, 0.13],
      [0.45, V3(sx * 0.01, 0.1, 0.13), 0.01, 0.12],
      [0.78, V3(-sx * 0.03, 0.12, 0.08), 0.0085, 0.11],
      [0.9, V3(sx * 0.07, 0.1, 0.02), 0.008, 0.1],
      [1.0, V3(sx * 0.0, 0.09, 0.05), 0.0075, 0.09],
    ];
    for (const [t, d, r] of tines) {
      const p = beam.getPointAt(t);
      const c = new THREE.CatmullRomCurve3([p.clone().addScaledVector(d, -0.05), p.clone().add(V3(d.x * 0.45, d.y * 0.3, d.z * 0.55)), p.clone().add(d)]);
      bone.push(antlerTube(c, 14, r, r * 0.25, 9, 0x9a8060, C1, 0.8));
    }
    // beaded burr (coronet) at the pedicle
    const burr = new THREE.TorusGeometry(0.026, 0.009, 8, 24);
    const bp = burr.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
      const a = Math.atan2(y, x);
      const bump = 1 + 0.25 * Math.max(0, Math.sin(a * 11) * Math.cos(a * 5 + 1));
      const r = Math.hypot(x, y); const k = (0.026 + (r - 0.026) * bump) / r;
      bp.setXYZ(i, x * k, y * k, z * bump);
    }
    burr.computeVertexNormals();
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), beam.getTangentAt(0.03));
    burr.applyQuaternion(q); const bpos = beam.getPointAt(0.03); burr.translate(bpos.x, bpos.y, bpos.z);
    const bc = new Float32Array(burr.attributes.position.count * 3); const cc = new THREE.Color(0x4a3522);
    for (let i = 0; i < bc.length; i += 3) bc.set([cc.r, cc.g, cc.b], i);
    burr.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
    bone.push(burr);
    // pedicle stub hidden in the fur
    const ped = new THREE.CylinderGeometry(0.02, 0.026, 0.06, 12); ped.applyQuaternion(q); ped.translate(base.x, base.y - 0.01, base.z);
    bone.push(ped);
  }
  g.add(new THREE.Mesh(G.mergeGeometries(bone.map(toNI)), mats.antler));
  return g;
}
