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
  const lin = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
  const ca = new THREE.Color(), cb = lin(c0), cc = lin(c1);
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
  // 12 stations: shoulder (at the shield) -> neck -> poll -> skull -> eyes -> long face -> muzzle -> nose.
  // Station k sits at t = k / 11 along the loft, which the deformers below use to place features.
  const st = [
    { p: [0, -0.085, 0.04], rx: 0.128, ry: 0.168, under: 0.0 },
    { p: [0, -0.05, 0.125], rx: 0.104, ry: 0.138, under: 0.12 },
    { p: [0, 0.005, 0.198], rx: 0.087, ry: 0.112, under: 0.28 },
    { p: [0, 0.075, 0.258], rx: 0.081, ry: 0.094, under: 0.42, top: 0.2 },
    { p: [0, 0.118, 0.308], rx: 0.081, ry: 0.08, under: 0.5, top: 0.5 },
    { p: [0, 0.128, 0.36], rx: 0.071, ry: 0.068, under: 0.5, top: 0.65 },
    { p: [0, 0.114, 0.418], rx: 0.053, ry: 0.059, under: 0.4, top: 0.55 },
    { p: [0, 0.096, 0.474], rx: 0.044, ry: 0.053, under: 0.3, top: 0.45 },
    { p: [0, 0.081, 0.524], rx: 0.04, ry: 0.049, under: 0.22, top: 0.3 },
    { p: [0, 0.071, 0.56], rx: 0.037, ry: 0.043, under: 0.12, top: 0.15 },
    { p: [0, 0.066, 0.582], rx: 0.029, ry: 0.033 },
    { p: [0, 0.064, 0.591], rx: 0.012, ry: 0.014 },
  ];
  const NS = st.length - 1;
  const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
  const deform = (p, t, a, c, X, Y) => {
    const f = t * NS, ca = Math.cos(a), sa = Math.sin(a), sx = Math.sign(ca) || 1, side = Math.abs(ca);
    // throat notch: the jaw separates from the neck
    p.addScaledVector(Y, 0.022 * bump(f, 3.15, 0.45) * Math.max(0, -sa) ** 2);
    // masseter / cheek bulge on the lower sides under the eye
    p.addScaledVector(X, sx * 0.014 * bump(f, 4.4, 0.7) * bump(sa, -0.45, 0.35) * side);
    // brow ridge over the eye, then the socket hollow
    p.addScaledVector(X, sx * 0.006 * bump(f, 4.75, 0.25) * bump(sa, 0.62, 0.18));
    p.addScaledVector(X, -sx * 0.008 * bump(f, 5.05, 0.22) * bump(sa, 0.3, 0.16));
    // pre-orbital hollow and gland groove down the face
    p.addScaledVector(X, -sx * 0.005 * bump(f, 6.0, 0.5) * bump(sa, 0.05, 0.3) * side);
    // flat bridge of the nose, slight roman curve
    p.addScaledVector(Y, -0.004 * bump(f, 6.6, 0.8) * Math.max(0, sa) ** 4);
    // flared nostrils: a raised rim with a dent behind it
    p.addScaledVector(X, sx * 0.006 * bump(f, 9.75, 0.22) * bump(sa, 0.25, 0.3));
    p.addScaledVector(X, -sx * 0.007 * bump(f, 9.4, 0.25) * bump(sa, 0.3, 0.25));
    // mouth line and chin
    p.addScaledVector(X, -sx * 0.005 * bump(f, 8.9, 0.9) * bump(sa, -0.5, 0.08) * side);
    p.addScaledVector(Y, -0.006 * bump(f, 8.6, 0.5) * Math.max(0, -sa) ** 3);
    // a ruff of mane along the top and down the front of the neck
    p.addScaledVector(Y, 0.014 * Math.max(0, 1 - f / 3.2) * bump(sa, 1, 0.35));
    p.addScaledVector(Y, -0.012 * Math.max(0, 1 - f / 2.6) * bump(sa, -1, 0.35));
  };
  const RADIAL = 48;
  const headG = loft(st, { rings: 88, radial: RADIAL, deform });
  // vertex colours: dark mane, grizzled neck, lighter face with a pale eye-ring and muzzle band, black nose and lips
  {
    const along = headG.attributes.along, pos = headG.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = along.getX(i), f = t * NS;
      const j = i % (RADIAL + 1); const a = (j / RADIAL) * Math.PI * 2; const sa = Math.sin(a), side = Math.abs(Math.cos(a));
      let c = [1, 1, 1];
      const mane = Math.max(0, 1 - f / 3.3);
      c = c.map((v) => v * (1 - mane * 0.5));
      const throat = bump(f, 2.8, 0.9) * Math.max(0, -sa);
      c = [c[0] + throat * 0.55, c[1] + throat * 0.5, c[2] + throat * 0.4];
      const face = Math.max(0, Math.min(1, (f - 5) / 2));
      c = [c[0] * (1 + face * 0.28), c[1] * (1 + face * 0.22), c[2] * (1 + face * 0.12)];
      const eyeRing = bump(f, 5.05, 0.35) * bump(sa, 0.3, 0.25) * side;
      c = [c[0] + eyeRing * 0.5, c[1] + eyeRing * 0.45, c[2] + eyeRing * 0.35];
      const gland = bump(f, 5.6, 0.35) * bump(sa, 0.12, 0.12) * side;
      c = c.map((v) => v * (1 - gland * 0.7));
      const band = bump(f, 8.95, 0.35) * Math.max(0.2, 0.5 + 0.5 * sa);
      c = [c[0] + band * 0.55, c[1] + band * 0.52, c[2] + band * 0.45];
      const nose = Math.max(0, Math.min(1, (f - 9.25) / 0.35)) * (sa > -0.55 ? 1 : 0.5);
      c = c.map((v) => v * (1 - nose * 0.93));
      const lip = bump(sa, -0.5, 0.12) * Math.max(0, Math.min(1, (f - 7.8) / 0.8));
      c = c.map((v) => v * (1 - lip * 0.75));
      const chin = Math.max(0, -sa) ** 2 * bump(f, 8.4, 0.6);
      c = [c[0] + chin * 0.4, c[1] + chin * 0.38, c[2] + chin * 0.32];
      col.set(c, i * 3);
    }
    headG.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  const head = new THREE.Mesh(headG, mats.fur);
  g.add(head);
  {
    const rnd = ctx.random.fork('stag-ruff');
    const lockG = new THREE.ConeGeometry(0.0075, 1, 5, 1, true).rotateX(Math.PI).translate(0, -0.5, 0);
    const N = 520;
    const locks = new THREE.InstancedMesh(lockG, mats.ruff || mats.fur, N);
    const pc = headG.attributes.position, al = headG.attributes.along, nn = headG.attributes.normal;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), dn = V3(0, -1, 0), tmp = new THREE.Vector3(), nrm = new THREE.Vector3();
    let k = 0, guard = 0;
    while (k < N && guard++ < 40000) {
      const i = Math.floor(rnd.next() * pc.count);
      const t = al.getX(i);
      if (t > 0.34) continue;
      nrm.set(nn.getX(i), nn.getY(i), nn.getZ(i));
      const under = nrm.y < -0.15, ridge = nrm.y > 0.75 && t < 0.25;
      if (!under && !ridge) continue;
      tmp.set(pc.getX(i), pc.getY(i), pc.getZ(i));
      const len = (under ? 0.05 + 0.06 * rnd.next() * (1 - t / 0.34) : 0.025 + 0.02 * rnd.next());
      // hang: mostly down (gravity) for the ruff, swept back along the neck for the crest
      const dir = under ? dn.clone().addScaledVector(nrm, 0.55).add(V3(0, 0, -0.25)).normalize() : nrm.clone().add(V3(0, 0.2, -1.2)).normalize();
      dir.x += (rnd.next() - 0.5) * 0.4; dir.normalize();
      q.setFromUnitVectors(dn, dir);
      const w = 0.7 + rnd.next() * 0.8;
      m4.compose(tmp.addScaledVector(nrm, -0.004), q, V3(w, len, w));
      locks.setMatrixAt(k++, m4);
    }
    locks.count = k;
    g.add(locks);
  }
  // surface point on the (undeformed) loft at station-parameter f and angle a, pushed out by `out`
  const curve = new THREE.CatmullRomCurve3(st.map((q) => V3(...q.p)), false, 'centripetal');
  const surf = (f, a, out = 0) => {
    const t = f / NS, i = Math.min(NS - 1, Math.floor(f)), u = f - i;
    const rx = st[i].rx + (st[i + 1].rx - st[i].rx) * u, ry = st[i].ry + (st[i + 1].ry - st[i].ry) * u;
    const c = curve.getPoint(t), T = curve.getTangent(t).normalize();
    const X = new THREE.Vector3().crossVectors(V3(0, 1, 0), T).normalize(), Y = new THREE.Vector3().crossVectors(T, X).normalize();
    return c.addScaledVector(X, Math.cos(a) * (rx + out)).addScaledVector(Y, Math.sin(a) * (ry + out));
  };

  // glossy nose leather (rhinarium): a flattened pad wrapped over the tip, nostril slits
  const noseG = new THREE.SphereGeometry(0.026, 28, 18); noseG.scale(1.25, 0.95, 0.55);
  const np = surf(10.4, Math.PI / 2, -0.012); noseG.translate(np.x, np.y, np.z + 0.008);
  g.add(new THREE.Mesh(noseG, mats.nose));
  for (const sx of [-1, 1]) {
    const ns = new THREE.CapsuleGeometry(0.0035, 0.012, 4, 8); ns.rotateZ(sx * 0.9); ns.rotateX(0.5);
    const q = surf(10.25, Math.PI / 2 - sx * 0.75, -0.001); ns.translate(q.x, q.y, q.z);
    g.add(new THREE.Mesh(ns, mats.eye));
  }
  // large glass eyes set under the brow, with a dark lid ring and a tear-gland slit in front
  for (const sx of [-1, 1]) {
    const a = sx > 0 ? 0.32 : Math.PI - 0.32;
    const ep = surf(5.05, a, -0.004);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 24, 16), mats.eye);
    eye.position.copy(ep); eye.scale.set(0.75, 0.95, 1.2); eye.rotation.y = sx * 0.45;
    g.add(eye);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.0155, 0.004, 8, 28), mats.nose);
    lid.position.copy(ep); lid.rotation.y = sx * (Math.PI / 2 - 0.45); lid.scale.set(1.2, 0.9, 1);
    g.add(lid);
    const gl = new THREE.Mesh(new THREE.CapsuleGeometry(0.003, 0.026, 4, 8), mats.nose);
    gl.position.copy(surf(5.65, sx > 0 ? 0.12 : Math.PI - 0.12, -0.002)); gl.rotation.set(1.15, 0, sx * 0.35); g.add(gl);
  }
  // big cupped ears, swept out and back behind the antlers
  for (const sx of [-1, 1]) {
    const L = 0.15, Wd = 0.062;
    const eg = new THREE.SphereGeometry(0.5, 24, 18, Math.PI * 0.92, Math.PI * 1.16, 0, Math.PI);
    const p = eg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 0.5;                                  // -1 base .. 1 tip
      const u = (y + 1) / 2;
      const taper = Math.max(0.04, Math.sin(Math.min(1, u * 1.05) * Math.PI) ** 0.8 * (1 - 0.25 * u));
      p.setXYZ(i, p.getX(i) * Wd * taper, (u * L), p.getZ(i) * Wd * 0.8 * taper);
    }
    eg.computeVertexNormals();
    const c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const u = p.getY(i) / L; const k = 0.55 + 0.45 * u; c.set([k, k * 0.97, k * 0.93], i * 3); }
    eg.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const ear = new THREE.Mesh(eg, mats.furDouble);
    ear.position.copy(surf(3.7, sx > 0 ? 0.25 : Math.PI - 0.25, -0.012));
    ear.rotation.set(-0.55, sx * 0.85, -sx * 1.15);
    g.add(ear);
  }

  // -------------------------------------------------------------- antlers (a royal: brow, bez, trez and a crown of three)
  // vertex colours multiply the antler map (already bone-brown): dark at the burr, bleached toward the tips
  const LC = (r, g2, b) => new THREE.Color().setRGB(r, g2, b);
  const C0 = LC(0.62, 0.54, 0.45), C1 = LC(2.0, 1.9, 1.7);
  const bone = [];
  for (const sx of [-1, 1]) {
    const base = surf(4.15, sx > 0 ? 1.05 : Math.PI - 1.05, -0.006);
    const beam = new THREE.CatmullRomCurve3([
      base, base.clone().add(V3(sx * 0.07, 0.07, -0.03)), base.clone().add(V3(sx * 0.17, 0.19, -0.05)), base.clone().add(V3(sx * 0.26, 0.34, -0.05)),
      base.clone().add(V3(sx * 0.3, 0.5, -0.01)), base.clone().add(V3(sx * 0.28, 0.64, 0.04)), base.clone().add(V3(sx * 0.22, 0.75, 0.09)),
    ], false, 'centripetal');
    bone.push(antlerTube(beam, 64, 0.032, 0.013, 14, C0, LC(1.35, 1.25, 1.08), 1.1));
    const tines = [
      [0.06, V3(sx * 0.03, 0.03, 0.2), 0.018, 0.012],
      [0.17, V3(sx * 0.035, 0.06, 0.17), 0.016, 0.011],
      [0.43, V3(sx * 0.02, 0.06, 0.16), 0.014, 0.01],
      [0.78, V3(-sx * 0.05, 0.11, 0.09), 0.012, 0.009],
      [0.9, V3(sx * 0.08, 0.09, 0.03), 0.011, 0.008],
      [1.0, V3(sx * 0.0, 0.1, 0.06), 0.011, 0.008],
    ];
    for (const [t, d, r] of tines) {
      const p = beam.getPointAt(t);
      const c = new THREE.CatmullRomCurve3([p.clone().addScaledVector(d, -0.08), p.clone().add(V3(d.x * 0.4, d.y * 0.2, d.z * 0.5)), p.clone().add(V3(d.x, d.y * 0.85, d.z)), p.clone().add(V3(d.x * 1.05, d.y * 1.2, d.z * 0.95))]);
      bone.push(antlerTube(c, 20, r, r * 0.22, 10, LC(0.8, 0.72, 0.6), C1, 0.7));
    }
    // beaded burr (coronet) at the pedicle
    const burr = new THREE.TorusGeometry(0.029, 0.01, 10, 28);
    const bp = burr.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
      const a = Math.atan2(y, x);
      const bmp = 1 + 0.3 * Math.max(0, Math.sin(a * 13) * Math.cos(a * 5 + 1));
      const r = Math.hypot(x, y); const k = (0.029 + (r - 0.029) * bmp) / r;
      bp.setXYZ(i, x * k, y * k, z * bmp);
    }
    burr.computeVertexNormals();
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), beam.getTangentAt(0.025));
    burr.applyQuaternion(q); const bpos = beam.getPointAt(0.025); burr.translate(bpos.x, bpos.y, bpos.z);
    const bc = new Float32Array(burr.attributes.position.count * 3); const cc = LC(0.3, 0.25, 0.2);
    for (let i = 0; i < bc.length; i += 3) bc.set([cc.r, cc.g, cc.b], i);
    burr.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
    bone.push(burr);
    const ped = new THREE.CylinderGeometry(0.022, 0.03, 0.06, 12); ped.applyQuaternion(q); ped.translate(base.x, base.y - 0.012, base.z);
    bone.push(ped);
  }
  g.add(new THREE.Mesh(G.mergeGeometries(bone.map(toNI)), mats.antler));
  return g;
}

/**
 * Wild boar's head on a shield: a lofted wedge of a head with a deep jowl, a
 * flat leathery snout disc with nostrils, curling tusks, small pricked ears,
 * glass eyes and a raised bristle crest (instanced). Faces +Z, shield at z = 0.
 */
export function buildBoar(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'trophy:boar';
  const pw = 0.2, ph = 0.31;
  const sh = new THREE.Shape();
  sh.moveTo(0, -ph / 2 - 0.04); sh.bezierCurveTo(pw * 0.6, -ph / 2 - 0.02, pw, -ph * 0.3, pw, 0); sh.bezierCurveTo(pw, ph * 0.32, pw * 0.8, ph / 2, pw * 0.45, ph / 2);
  sh.bezierCurveTo(0.08, ph / 2, 0.03, ph / 2 + 0.02, 0, ph / 2 + 0.05); sh.bezierCurveTo(-0.03, ph / 2 + 0.02, -0.08, ph / 2, -pw * 0.45, ph / 2);
  sh.bezierCurveTo(-pw * 0.8, ph / 2, -pw, ph * 0.32, -pw, 0); sh.bezierCurveTo(-pw, -ph * 0.3, -pw * 0.6, -ph / 2 - 0.02, 0, -ph / 2 - 0.04);
  const back = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 4, curveSegments: 24 });
  g.add(new THREE.Mesh(G.applyBoxUVs(back, 1.5), mats.shield));
  const st = [
    { p: [0, -0.02, 0.03], rx: 0.15, ry: 0.15 },
    { p: [0, -0.005, 0.11], rx: 0.13, ry: 0.14, under: 0.1 },
    { p: [0, 0.01, 0.18], rx: 0.108, ry: 0.118, under: 0.25, top: 0.2 },
    { p: [0, 0.008, 0.24], rx: 0.088, ry: 0.098, under: 0.4, top: 0.45 },
    { p: [0, -0.006, 0.31], rx: 0.064, ry: 0.074, under: 0.45, top: 0.5 },
    { p: [0, -0.022, 0.38], rx: 0.05, ry: 0.058, under: 0.35, top: 0.4 },
    { p: [0, -0.034, 0.44], rx: 0.044, ry: 0.048, under: 0.2 },
    { p: [0, -0.04, 0.475], rx: 0.045, ry: 0.047 },
    { p: [0, -0.041, 0.482], rx: 0.02, ry: 0.02 },
  ];
  const NS = st.length - 1;
  const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
  const deform = (p, t, a, c, X, Y) => {
    const f = t * NS, ca = Math.cos(a), sa = Math.sin(a), sx = Math.sign(ca) || 1, side = Math.abs(ca);
    p.addScaledVector(X, sx * 0.016 * bump(f, 2.2, 0.8) * bump(sa, -0.5, 0.4) * side);     // heavy jowls
    p.addScaledVector(X, -sx * 0.006 * bump(f, 3.0, 0.25) * bump(sa, 0.35, 0.2));          // eye socket
    p.addScaledVector(X, -sx * 0.004 * bump(f, 5.3, 1.0) * bump(sa, -0.45, 0.08) * side);  // lip line
    p.addScaledVector(Y, 0.02 * Math.max(0, 1 - f / 3) * bump(sa, 1, 0.3));                // crest ridge
  };
  const headG = loft(st, { rings: 60, radial: 40, deform });
  {
    const along = headG.attributes.along, pos = headG.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const f = along.getX(i) * NS; const j = i % 41; const sa = Math.sin((j / 40) * Math.PI * 2);
      let k = 1 - 0.35 * Math.max(0, 1 - f / 3) * Math.max(0, sa);
      k *= 1 + 0.25 * bump(f, 4.5, 1.2);
      k *= 1 - 0.8 * Math.max(0, Math.min(1, (f - 6.6) / 0.4));
      col.set([k, k * 0.97, k * 0.94], i * 3);
    }
    headG.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  g.add(new THREE.Mesh(headG, mats.fur));
  // snout disc + nostrils
  const disc = new THREE.CylinderGeometry(0.046, 0.048, 0.016, 28).rotateX(Math.PI / 2); disc.scale(1, 0.92, 1); disc.translate(0, -0.041, 0.48);
  g.add(new THREE.Mesh(disc, mats.nose));
  for (const sx of [-1, 1]) {
    const n = new THREE.SphereGeometry(0.009, 12, 8); n.scale(0.8, 1.2, 0.5); n.translate(sx * 0.016, -0.04, 0.489);
    g.add(new THREE.Mesh(n, mats.eye));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), mats.eye); eye.position.set(sx * 0.074, 0.03, 0.27); eye.scale.set(0.8, 0.9, 1.1); g.add(eye);
    // pricked ears
    const ear = new THREE.ConeGeometry(0.04, 0.12, 14, 1, true, 0, Math.PI * 1.3); ear.scale(1, 1, 0.5); ear.translate(0, 0.06, 0);
    const em = new THREE.Mesh(ear, mats.furDouble); em.position.set(sx * 0.08, 0.1, 0.17); em.rotation.set(-0.5, sx * 0.6, -sx * 0.55); g.add(em);
  }
  // tusks
  const bone = [];
  for (const sx of [-1, 1]) {
    const tusk = new THREE.CatmullRomCurve3([V3(sx * 0.036, -0.062, 0.4), V3(sx * 0.058, -0.056, 0.43), V3(sx * 0.072, -0.02, 0.445), V3(sx * 0.064, 0.014, 0.432), V3(sx * 0.052, 0.028, 0.415)]);
    bone.push(antlerTube(tusk, 24, 0.0095, 0.0016, 10, new THREE.Color().setRGB(1.1, 1.0, 0.8), new THREE.Color().setRGB(1.8, 1.72, 1.5), 1.0));
    const low = new THREE.CatmullRomCurve3([V3(sx * 0.03, -0.066, 0.425), V3(sx * 0.04, -0.054, 0.445), V3(sx * 0.045, -0.039, 0.45)]);
    bone.push(antlerTube(low, 10, 0.005, 0.001, 8, new THREE.Color().setRGB(1.1, 1.0, 0.8), new THREE.Color().setRGB(1.8, 1.72, 1.5), 1.0));
  }
  g.add(new THREE.Mesh(G.mergeGeometries(bone.map(toNI)), mats.antler));
  // bristle crest: instanced tapering spikes along the ridge of the neck and skull
  const rnd = ctx.random.fork('boar-bristle');
  const bg = new THREE.ConeGeometry(0.0022, 0.05, 4, 1).translate(0, 0.025, 0);
  const n = 260;
  const im = new THREE.InstancedMesh(bg, mats.bristle || mats.nose, n);
  const curve = new THREE.CatmullRomCurve3(st.slice(0, 5).map((q) => V3(q.p[0], q.p[1] + q.ry * 0.96, q.p[2])));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const t = rnd.next() * 0.92;
    const p = curve.getPoint(t);
    p.x += (rnd.next() - 0.5) * 0.05 * (1 - t);
    e.set(-0.9 - rnd.next() * 0.5 + t * 0.4, 0, (rnd.next() - 0.5) * 0.8); q.setFromEuler(e);
    const sc = (0.6 + rnd.next() * 0.8) * (1.3 - t * 0.8);
    m4.compose(p, q, V3(sc, sc, sc)); im.setMatrixAt(i, m4);
  }
  im.userData.keep = true;
  g.add(im);
  return g;
}
