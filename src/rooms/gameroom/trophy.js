import * as THREE from 'three';

/**
 * Taxidermy trophies, round 3.
 *
 * Both heads are lofted along a centre spline with an ASYMMETRIC cross-section per station (separate top / bottom
 * radii and upper / lower half-widths), so the skull reads as a deep wedge over a lighter muzzle rather than a tube.
 * Anatomy is pushed in with deformers (brow ridge, orbit, preorbital pit, masseter, jaw line, mouth crease, flared
 * nostrils). Fur is a short-pile normal map on the hide plus layered alpha-tested hair-lock cards (mane, ruff,
 * bristle crest) that taper, hang with gravity and curl outward. Antlers / tusks are tapered tubes with gutters,
 * pearling and a dark-to-ivory gradient.
 *
 * Both face +Z with the shield back at z = 0 and the origin at the shield centre.
 */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** Catmull-Rom scalar interpolation over station keys. */
function lerpKey(stations, k, t, fallback) {
  const f = t * (stations.length - 1);
  const i = Math.min(stations.length - 2, Math.floor(f));
  const u = f - i;
  const get = (j) => { const s = stations[Math.max(0, Math.min(stations.length - 1, j))]; return s[k] ?? (fallback ? s[fallback] : 0) ?? 0; };
  const a = get(i - 1), b = get(i), c = get(i + 1), d = get(i + 2);
  return 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
}

/**
 * Loft with an asymmetric section. station: { p: [x,y,z], w (upper half-width), wl (lower half-width), t (top), b (bottom), n (superellipse, 2 = ellipse) }
 * Adds attributes: along (0..1), ang (section angle).
 */
export function loft2(stations0, { rings = 80, radial = 48, capEnd = true, deform } = {}) {
  const stations = stations0.map((s) => ({ n: 2, ...s }));
  const P = new THREE.CatmullRomCurve3(stations.map((s) => V3(...s.p)), false, 'centripetal');
  const pos = [], uv = [], along = [], angA = [], idx = [];
  const up = V3(0, 1, 0);
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const c = P.getPoint(t);
    const T = P.getTangent(t).normalize();
    const X = new THREE.Vector3().crossVectors(up, T).normalize();
    if (X.lengthSq() < 1e-6) X.set(1, 0, 0);
    const Y = new THREE.Vector3().crossVectors(T, X).normalize();
    const w = Math.max(1e-4, lerpKey(stations, 'w', t)), wl = Math.max(1e-4, lerpKey(stations, 'wl', t, 'w'));
    const tp = Math.max(1e-4, lerpKey(stations, 't', t)), bt = Math.max(1e-4, lerpKey(stations, 'b', t, 't'));
    const n = Math.max(1.5, lerpKey(stations, 'n', t));
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const e = 2 / n;
      const cx = Math.sign(ca) * Math.abs(ca) ** e, sy = Math.sign(sa) * Math.abs(sa) ** e;
      const ww = sa >= 0 ? w : w + (wl - w) * (-sa) ** 0.7;
      const x = cx * ww, y = sy >= 0 ? sy * tp : sy * bt;
      const p = c.clone().addScaledVector(X, x).addScaledVector(Y, y);
      if (deform) deform(p, t, a, c, X, Y);
      pos.push(p.x, p.y, p.z);
      uv.push(j / radial * 2, t * 3);
      along.push(t); angA.push(a);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  if (capEnd) {
    const end = P.getPoint(1);
    const ci = pos.length / 3;
    pos.push(end.x, end.y, end.z); uv.push(0.5, 3); along.push(1); angA.push(0);
    const base = rings * (radial + 1);
    for (let j = 0; j < radial; j++) idx.push(base + j, base + j + 1, ci);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute('ang', new THREE.Float32BufferAttribute(angA, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Back-compat symmetric loft (used by older callers). */
export function loft(stations, opts) {
  return loft2(stations.map((s) => ({ p: s.p, w: s.rx, wl: s.rx * (1 - (s.under || 0) * 0.55), t: s.ry * (1 - (s.top || 0) * 0.25), b: s.ry })), opts);
}

/**
 * Antler / tusk tube: tapering, pointed, with longitudinal gutters, pearling near the base and a colour ramp
 * c0 (base) -> c1 (mid) -> c2 (tip) in vertex colours. r(t) = r0 -> r1 with a sharpened point.
 */
export function antlerTube(curve, segs, r0, r1, radial, c0, c1, tipPow = 1.0, { gutters = 0.06, pearl = 0.1, seed = 0, c2 = null } = {}) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], uv = [], col = [], idx = [];
  const len = curve.getLength();
  const lin = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
  const ca = new THREE.Color(), cb = lin(c0), cc = lin(c1), cd = c2 ? lin(c2) : null;
  const h = (x) => { const s = Math.sin(x * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    let r = r0 + (r1 - r0) * t;
    if (t > 0.8) r *= Math.max(0.04, 1 - ((t - 0.8) / 0.2) ** 1.5 * 0.96);
    const N = frames.normals[i], B = frames.binormals[i];
    if (cd) { if (t < 0.6) ca.copy(cb).lerp(cc, (t / 0.6) ** tipPow); else ca.copy(cc).lerp(cd, ((t - 0.6) / 0.4) ** 0.8); }
    else ca.copy(cb).lerp(cc, Math.pow(t, tipPow));
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      let rr = r * (1 + gutters * Math.sin(a * 5 + t * 3.0 + seed) * (1 - t * 0.7));
      // pearling: hashed knobs on the lower beam
      const pk = h(Math.floor(t * len * 90) * 13.0 + Math.floor(a * 3)) ;
      rr *= 1 + pearl * Math.max(0, pk - 0.55) * (1 - clamp01(t / 0.45));
      const n = N.clone().multiplyScalar(Math.cos(a)).add(B.clone().multiplyScalar(Math.sin(a)));
      pos.push(p.x + n.x * rr, p.y + n.y * rr, p.z + n.z * rr);
      uv.push(j / radial, t * len * 3);
      const k = 1 - 0.18 * Math.max(0, -Math.sin(a * 5 + t * 3.0 + seed)) * (1 - t);   // darker in the gutters
      col.push(ca.r * k, ca.g * k, ca.b * k);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function toNI(g) {
  const q = g.index ? g.toNonIndexed() : g;
  if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
  if (!q.attributes.normal) q.computeVertexNormals();
  if (!q.attributes.color) q.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 3).fill(1), 3));
  for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) q.deleteAttribute(k);
  return q;
}

/**
 * Hair-lock cards: each sample { p, n (surface normal), d (growth direction), len, w } becomes a ribbon of `segs`
 * segments that leaves the hide along d, sags with gravity and curls outward toward the tip. uv: u across, v root->tip.
 */
export function hairCards(samples, { segs = 4, gravity = 0.6, curl = 0.5 } = {}) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const down = V3(0, -1, 0);
  let base = 0;
  for (const s of samples) {
    const n = s.n.clone().normalize();
    let d = s.d.clone().normalize();
    const side0 = new THREE.Vector3().crossVectors(d, n);
    if (side0.lengthSq() < 1e-6) side0.set(1, 0, 0);
    side0.normalize();
    let p = s.p.clone();
    const step = s.len / segs;
    const tint = s.c ?? 1;
    for (let k = 0; k <= segs; k++) {
      const v = k / segs;
      const wv = s.w * (1 - 0.35 * v);
      const side = side0.clone().applyAxisAngle(d, (s.twist || 0) * v);
      const cn = new THREE.Vector3().crossVectors(side, d).normalize();
      pos.push(p.x - side.x * wv / 2, p.y - side.y * wv / 2, p.z - side.z * wv / 2, p.x + side.x * wv / 2, p.y + side.y * wv / 2, p.z + side.z * wv / 2);
      // bend the normals toward the hide normal so the lock shades like the coat beneath
      const bn = cn.clone().lerp(n, 0.5).normalize();
      nor.push(bn.x, bn.y, bn.z, bn.x, bn.y, bn.z);
      uv.push(0, v, 1, v);
      const kc = tint * (0.75 + 0.25 * v);
      col.push(kc, kc, kc, kc, kc, kc);
      if (k < segs) {
        d = d.clone().addScaledVector(down, gravity * step / Math.max(s.len, 1e-3)).addScaledVector(n, curl * step / Math.max(s.len, 1e-3)).normalize();
        p = p.clone().addScaledVector(d, step);
        const a = base + k * 2;
        idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
    base += (segs + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Shield (escutcheon) outline. */
function shieldShape(pw, ph, s = 1) {
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
}

function buildShield(G, mats, pw, ph) {
  const g = new THREE.Group();
  const back = new THREE.ExtrudeGeometry(shieldShape(pw, ph, 1), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.018, bevelSegments: 5, curveSegments: 32 });
  back.translate(0, 0, 0.012);
  g.add(new THREE.Mesh(G.applyBoxUVs(back, 3), mats.shield));
  const mid = new THREE.ExtrudeGeometry(shieldShape(pw, ph, 0.82), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 4, curveSegments: 32 });
  mid.translate(0, 0.005, 0.05);
  g.add(new THREE.Mesh(G.applyBoxUVs(mid, 3), mats.shield));
  const pts = shieldShape(pw, ph, 0.86).getSpacedPoints(140).map((p) => V3(p.x, p.y + 0.005, 0.047));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 180, 0.0035, 6, true), mats.gilt));
  return g;
}

/** Glass eye: sphere with its +Y pole (iris) turned to look along `dir`, set into a dark lid ring. */
function glassEye(mats, pos, dir, r, scale = [1, 1, 1]) {
  const g = new THREE.Group();
  const eg = new THREE.SphereGeometry(r, 28, 20);
  const eye = new THREE.Mesh(eg, mats.eye);
  eye.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize());
  eye.scale.set(...scale);
  g.add(eye);
  const lid = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, r * 0.3, 10, 32), mats.lid || mats.nose);
  lid.quaternion.setFromUnitVectors(V3(0, 0, 1), dir.clone().normalize());
  lid.position.addScaledVector(dir.clone().normalize(), r * 0.35);
  lid.scale.set(1.25, 0.85, 1);
  g.add(lid);
  g.position.copy(pos);
  return g;
}

// =================================================================================================== stag
/**
 * @param mats { shield, fur (vertexColors), furDouble, hair (alpha card mat), eye, nose, lid, antler (vertexColors), gilt }
 */
export function buildStag(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'trophy:stag';
  g.add(buildShield(G, mats, 0.25, 0.42));

  // ---------------------------------------------------------------- head + neck
  // neck stations rise forward from the shield; head stations are given by a top line and a bottom line so the
  // skull is ~2.4x deeper at the eyes than at the muzzle.
  const H = (z, yt, yb, w, wl, n = 2) => ({ p: [0, (yt + yb) / 2, z], t: (yt - yb) / 2, b: (yt - yb) / 2, w, wl, n });
  const st = [
    { p: [0, -0.075, 0.035], w: 0.135, wl: 0.13, t: 0.165, b: 0.175 },
    { p: [0, -0.03, 0.11], w: 0.115, wl: 0.112, t: 0.148, b: 0.165 },
    { p: [0, 0.03, 0.18], w: 0.095, wl: 0.092, t: 0.125, b: 0.145 },
    { p: [0, 0.09, 0.235], w: 0.083, wl: 0.078, t: 0.105, b: 0.12 },
    H(0.278, 0.228, 0.03, 0.08, 0.072),
    H(0.318, 0.234, 0.044, 0.076, 0.06),
    H(0.36, 0.224, 0.062, 0.064, 0.052),
    H(0.404, 0.208, 0.076, 0.053, 0.046),
    H(0.446, 0.192, 0.088, 0.045, 0.042, 2.3),
    H(0.486, 0.178, 0.096, 0.042, 0.04, 2.4),
    H(0.514, 0.17, 0.1, 0.04, 0.037, 2.4),
    H(0.532, 0.162, 0.104, 0.035, 0.032, 2.2),
    H(0.54, 0.155, 0.108, 0.017, 0.016),
  ];
  const NS = st.length - 1;
  const F = { eye: 5.0, pre: 5.85, nose: 11.2, mouth: 9.6 };
  const deform = (p, t, a, c, X, Y) => {
    const f = t * NS, ca = Math.cos(a), sa = Math.sin(a), sx = Math.sign(ca) || 1, side = Math.abs(ca);
    // throat latch: the jaw separates from the neck
    p.addScaledVector(Y, 0.02 * bump(f, 3.6, 0.5) * Math.max(0, -sa) ** 2);
    // masseter: a broad bulge on the lower cheek behind the jaw line
    p.addScaledVector(X, sx * 0.012 * bump(f, 4.7, 0.9) * bump(sa, -0.35, 0.4) * side);
    // brow ridge above and in front of the eye, orbit hollow behind it
    p.addScaledVector(X, sx * 0.009 * bump(f, F.eye - 0.1, 0.45) * bump(sa, 0.62, 0.18));
    p.addScaledVector(X, sx * 0.008 * bump(f, F.eye, 0.35) * bump(sa, 0.35, 0.22));          // the eye bulges the side of the skull
    p.addScaledVector(X, -sx * 0.007 * bump(f, F.eye + 0.45, 0.3) * bump(sa, 0.4, 0.2));
    // preorbital gland pit: a deep tear-drop hollow in front of the eye
    p.addScaledVector(X, -sx * 0.011 * bump(f, F.pre, 0.32) * bump(sa, 0.16, 0.16) * side);
    // nasal bridge slightly dished, roman just above the nose
    p.addScaledVector(Y, -0.004 * bump(f, 6.8, 1.2) * Math.max(0, sa) ** 4);
    p.addScaledVector(Y, 0.003 * bump(f, 10.2, 0.6) * Math.max(0, sa) ** 4);
    // flared nostrils: raised alar rims and a hollow behind
    p.addScaledVector(X, sx * 0.008 * bump(f, 10.9, 0.3) * bump(sa, 0.15, 0.3));
    p.addScaledVector(X, -sx * 0.006 * bump(f, 10.3, 0.35) * bump(sa, 0.25, 0.28));
    // jaw line: a ridge running from the mouth corner back and down to the angle of the jaw
    const jawSa = -0.45 - 0.05 * (f - 5);
    p.addScaledVector(X, sx * 0.0045 * bump(sa, jawSa, 0.09) * clamp01((f - 4.2) / 0.6) * clamp01((10 - f) / 1.0) * side);
    // mouth crease and lower lip
    p.addScaledVector(X, -sx * 0.006 * bump(f, 10.2, 1.0) * bump(sa, -0.42, 0.07) * side);
    p.addScaledVector(Y, -0.004 * bump(f, 10.6, 0.5) * Math.max(0, -sa) ** 3);
    // chin
    p.addScaledVector(Y, -0.005 * bump(f, 9.4, 0.5) * Math.max(0, -sa) ** 4);
    // neck musculature
    p.addScaledVector(X, sx * 0.008 * bump(f, 1.4, 0.8) * bump(sa, 0.2, 0.5));
  };
  const RADIAL = 64;
  const headG = loft2(st, { rings: 120, radial: RADIAL, deform });
  {
    // hide colouring: dark mane, rufous-grey neck, greyer face, pale eye-ring and muzzle band, black rhinarium & lips
    const along = headG.attributes.along, angs = headG.attributes.ang, pos = headG.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const f = along.getX(i) * NS, a = angs.getX(i), sa = Math.sin(a), side = Math.abs(Math.cos(a));
      let c = [1, 0.97, 0.94];
      const mane = clamp01(1 - f / 3.6);
      c = c.map((v) => v * (1 - mane * 0.55));
      const throatPale = bump(f, 3.6, 0.7) * Math.max(0, -sa) ** 2;
      c = [c[0] + throatPale * 0.3, c[1] + throatPale * 0.28, c[2] + throatPale * 0.22];
      const face = clamp01((f - 5) / 2.5);
      c = [c[0] * (1 + face * 0.1), c[1] * (1 + face * 0.12), c[2] * (1 + face * 0.14)];
      const eyeRing = bump(f, F.eye, 0.45) * bump(sa, 0.35, 0.3) * side;
      c = [c[0] + eyeRing * 0.45, c[1] + eyeRing * 0.42, c[2] + eyeRing * 0.36];
      const gland = bump(f, F.pre, 0.3) * bump(sa, 0.16, 0.12) * side;
      c = c.map((v) => v * (1 - gland * 0.85));
      const band = bump(f, 10.1, 0.35) * Math.max(0.15, 0.5 + 0.5 * sa);
      c = [c[0] + band * 0.5, c[1] + band * 0.48, c[2] + band * 0.42];
      const nose = clamp01((f - 10.75) / 0.25) * (sa > -0.3 ? 1 : 0.6);
      c = c.map((v) => v * (1 - nose * 0.95));
      const lip = bump(sa, -0.42, 0.1) * clamp01((f - 9.0) / 0.8);
      c = c.map((v) => v * (1 - lip * 0.8));
      const chin = Math.max(0, -sa) ** 2 * bump(f, 9.6, 0.7);
      c = [c[0] + chin * 0.45, c[1] + chin * 0.43, c[2] + chin * 0.38];
      const back = Math.max(0, sa) ** 3 * clamp01(1 - f / 6);
      c = c.map((v) => v * (1 - back * 0.25));
      col.set(c, i * 3);
    }
    headG.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  const head = new THREE.Mesh(headG, mats.fur);
  g.add(head);

  // surface helper on the loft (undeformed) at station f and section angle a
  const curve = new THREE.CatmullRomCurve3(st.map((q) => V3(...q.p)), false, 'centripetal');
  const frame = (f) => {
    const t = f / NS; const c = curve.getPoint(t), T = curve.getTangent(t).normalize();
    const X = new THREE.Vector3().crossVectors(V3(0, 1, 0), T).normalize(), Y = new THREE.Vector3().crossVectors(T, X).normalize();
    return { t, c, T, X, Y };
  };
  const surf = (f, a, out = 0) => {
    const { t, c, X, Y } = frame(f);
    const w = lerpKey(st, 'w', t), wl = lerpKey(st, 'wl', t, 'w'), tp = lerpKey(st, 't', t), bt = lerpKey(st, 'b', t, 't');
    const ca = Math.cos(a), sa = Math.sin(a);
    const ww = sa >= 0 ? w : w + (wl - w) * (-sa) ** 0.7;
    const p = c.clone().addScaledVector(X, ca * (ww + out)).addScaledVector(Y, sa >= 0 ? sa * (tp + out) : sa * (bt + out));
    deform(p, t, a, c, X, Y);
    return p;
  };
  const normalAt = (f, a) => { const p0 = surf(f, a), pa = surf(f, a + 0.02), pf = surf(f + 0.03, a); return new THREE.Vector3().crossVectors(pf.sub(p0), pa.sub(p0)).normalize().multiplyScalar(-1); };

  // ---------------------------------------------------------------- rhinarium (moist black nose pad), nostrils, lips
  {
    // a moist black leather cap conforming to the tip of the muzzle (a 1.2 mm shell over the loft beyond f = 10.75)
    const capG = loft2(st, { rings: 120, radial: RADIAL, capEnd: true, deform: (p, t, a, c, X, Y) => { deform(p, t, a, c, X, Y); p.addScaledVector(p.clone().sub(c).normalize(), 0.0012); } });
    {
      const al = capG.attributes.along, ix = capG.index.array, keep = [];
      const ang = capG.attributes.ang;
      for (let i = 0; i < ix.length; i += 3) {
        const f = (al.getX(ix[i]) + al.getX(ix[i + 1]) + al.getX(ix[i + 2])) / 3 * NS;
        const sa = Math.sin(ang.getX(ix[i]));
        if (f > 10.75 + (sa < -0.3 ? 0.5 : 0)) keep.push(ix[i], ix[i + 1], ix[i + 2]);
      }
      capG.setIndex(keep);
    }
    g.add(new THREE.Mesh(capG, mats.nose));
    for (const sx of [-1, 1]) {
      // comma-shaped nostril slit curving up and out
      const cv = new THREE.CatmullRomCurve3([surf(11.6, Math.PI / 2 - sx * 0.25, 0.002), surf(11.35, Math.PI / 2 - sx * 0.62, 0.002), surf(11.0, Math.PI / 2 - sx * 0.95, 0.001)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 12, 0.0042, 8, false), mats.nostril || mats.eye));
    }
    // lip line: a dark rolled lip along the mouth crease
    for (const sx of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 10; i++) { const f = 9.0 + i * 0.27; pts.push(surf(f, sx > 0 ? -0.42 : Math.PI + 0.42, 0.001)); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.003, 6, false), mats.nose));
    }
  }
  // ---------------------------------------------------------------- glass eyes under the brow, preorbital slit
  for (const sx of [-1, 1]) {
    const a = sx > 0 ? 0.36 : Math.PI - 0.36;
    const p = surf(F.eye, a, -0.006);
    const n = normalAt(F.eye, a).add(V3(0, 0, 0.35)).normalize();
    g.add(glassEye(mats, p, n, 0.0155, [1, 1, 0.9]));
    const pit = surf(F.pre, sx > 0 ? 0.16 : Math.PI - 0.16, -0.001);
    const pg = new THREE.Mesh(new THREE.CapsuleGeometry(0.0035, 0.022, 4, 8), mats.nose);
    pg.position.copy(pit); pg.rotation.set(1.2, 0, sx * 0.4); g.add(pg);
  }
  // ---------------------------------------------------------------- ears: large cupped, swept back behind the antlers
  for (const sx of [-1, 1]) {
    const L = 0.16, Wd = 0.066;
    const eg = new THREE.SphereGeometry(0.5, 28, 20, Math.PI * 0.9, Math.PI * 1.2, 0, Math.PI);
    const p = eg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 0.5, u = (y + 1) / 2;
      const taper = Math.max(0.03, Math.sin(Math.min(1, u * 1.05) * Math.PI) ** 0.75 * (1 - 0.3 * u));
      p.setXYZ(i, p.getX(i) * Wd * taper, u * L, p.getZ(i) * Wd * 0.85 * taper);
    }
    eg.computeVertexNormals();
    const c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const u = p.getY(i) / L; const k = 0.55 + 0.4 * u; c.set([k, k * 0.96, k * 0.92], i * 3); }
    eg.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const ear = new THREE.Mesh(eg, mats.furDouble);
    ear.position.copy(surf(4.2, sx > 0 ? 0.3 : Math.PI - 0.3, -0.014));
    ear.rotation.set(-0.7, sx * 0.9, -sx * 1.2);
    g.add(ear);
  }

  // ---------------------------------------------------------------- hair-lock cards: mane, throat ruff, crest
  {
    const rnd = ctx.random.fork('stag-mane');
    const samples = [];
    for (let layer = 0; layer < 4; layer++) {
      const n = [420, 320, 220, 120][layer];
      for (let k = 0; k < n; k++) {
        const f = 0.15 + rnd.next() * (layer === 0 ? 4.2 : 3.6);
        const a = rnd.next() * Math.PI * 2;
        const sa = Math.sin(a);
        const throat = Math.max(0, -sa);
        // mane density: heavy on the throat and lower neck sides, lighter along the crest, absent on the face
        const dens = 0.25 + 0.75 * throat ** 0.7;
        if (rnd.next() > dens * clamp01((4.3 - f) / 1.2)) continue;
        const nrm = normalAt(f, a);
        const p = surf(f, a, -0.003 + layer * 0.004);
        const { T } = frame(f);
        // grow back along the neck and downward; ruff locks hang, crest locks lie back
        const d = T.clone().multiplyScalar(-1).addScaledVector(V3(0, -1, 0), 0.6 + throat).addScaledVector(nrm, 0.45).normalize();
        const len = (0.026 + 0.04 * throat * clamp01(1 - f / 4.5) + rnd.next() * 0.018) * (1 + layer * 0.12);
        samples.push({ p, n: nrm, d, len, w: 0.016 + rnd.next() * 0.012, twist: (rnd.next() - 0.5) * 0.8, c: 0.7 + 0.5 * rnd.next() });
      }
    }
    const hg = hairCards(samples, { segs: 4, gravity: 0.8, curl: 0.55 });
    const hm = new THREE.Mesh(hg, mats.hair); hm.name = 'stagMane'; hm.userData.keep = true;
    g.add(hm);
  }

  // ---------------------------------------------------------------- antlers: a royal (brow, bez, trez, crown of three)
  const LC = (r, g2, b) => new THREE.Color().setRGB(r, g2, b);
  const CB = LC(0.13, 0.085, 0.05), CM = LC(0.27, 0.19, 0.12), CT = LC(0.8, 0.74, 0.62);
  const bone = [];
  for (const sx of [-1, 1]) {
    const base = surf(4.55, sx > 0 ? 1.0 : Math.PI - 1.0, -0.004);
    const P = (x, y, z) => base.clone().add(V3(sx * x, y, z));
    const beam = new THREE.CatmullRomCurve3([P(0, 0, 0), P(0.06, 0.06, -0.035), P(0.15, 0.17, -0.07), P(0.24, 0.31, -0.08), P(0.29, 0.47, -0.05), P(0.28, 0.6, 0.0), P(0.24, 0.7, 0.05)], false, 'centripetal');
    bone.push(antlerTube(beam, 80, 0.03, 0.015, 18, CB, CM, 1.0, { gutters: 0.08, pearl: 0.16, seed: sx, c2: LC(0.36, 0.27, 0.18) }));
    // tines: [t on beam, direction, length, base radius]
    const tines = [
      [0.07, V3(sx * 0.15, 0.1, 1.0), 0.17, 0.018, 0.5],    // brow: low, forward, sweeping up at the tip
      [0.16, V3(sx * 0.2, 0.25, 1.0), 0.14, 0.016, 0.45],   // bez
      [0.44, V3(sx * 0.15, 0.25, 1.0), 0.13, 0.015, 0.5],   // trez
      [0.84, V3(-sx * 0.35, 0.8, 0.6), 0.09, 0.012, 0.3],   // crown, inner
      [0.92, V3(sx * 0.7, 0.8, 0.3), 0.085, 0.011, 0.3],    // crown, outer
      [0.995, V3(sx * 0.05, 1.0, 0.45), 0.09, 0.011, 0.2],  // crown, top
    ];
    tines.forEach(([t, d, len, r, rise], i) => {
      const p = beam.getPointAt(Math.min(0.999, t));
      const dn = d.clone().normalize();
      const c = new THREE.CatmullRomCurve3([
        p.clone().addScaledVector(dn, -0.014),
        p.clone().addScaledVector(dn, len * 0.33),
        p.clone().addScaledVector(dn, len * 0.66).add(V3(0, len * rise * 0.35, 0)),
        p.clone().addScaledVector(dn, len * 0.9).add(V3(0, len * rise, 0)),
      ]);
      bone.push(antlerTube(c, 24, r, r * 0.3, 12, CM, LC(0.38, 0.29, 0.2), 0.8, { gutters: 0.05, pearl: 0.06, seed: i + sx * 7, c2: CT }));
    });
    // beaded burr (coronet) at the pedicle
    const burr = new THREE.TorusGeometry(0.031, 0.012, 12, 36);
    const bp = burr.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
      const a = Math.atan2(y, x);
      const bmp = 1 + 0.35 * Math.max(0, Math.sin(a * 17) * Math.cos(a * 7 + 1)) + 0.15 * Math.sin(a * 31);
      const r = Math.hypot(x, y); const k = (0.031 + (r - 0.031) * bmp) / r;
      bp.setXYZ(i, x * k, y * k, z * bmp);
    }
    burr.computeVertexNormals();
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), beam.getTangentAt(0.03));
    burr.applyQuaternion(q); const bpos = beam.getPointAt(0.03); burr.translate(bpos.x, bpos.y, bpos.z);
    const bc = new Float32Array(burr.attributes.position.count * 3); for (let i = 0; i < bc.length; i += 3) bc.set([0.16, 0.11, 0.07], i);
    burr.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
    bone.push(burr);
    const ped = new THREE.CylinderGeometry(0.024, 0.034, 0.05, 14); ped.applyQuaternion(q); ped.translate(base.x, base.y - 0.008, base.z);
    const pc = new Float32Array(ped.attributes.position.count * 3); for (let i = 0; i < pc.length; i += 3) pc.set([0.25, 0.18, 0.12], i);
    ped.setAttribute('color', new THREE.Float32BufferAttribute(pc, 3));
    bone.push(ped);
  }
  const ant = new THREE.Mesh(G.mergeGeometries(bone.map(toNI)), mats.antler); ant.name = 'antlers';
  g.add(ant);
  g.userData.focus = V3(0, 0.25, 0.3);
  return g;
}

// =================================================================================================== boar
/**
 * Wild boar: a long wedge of a head under a tall bristled crest, small high-set eyes, big pricked ears angled
 * forward, a flat pink-grey snout disc with two nostril recesses, curling lower tusks and whetters.
 */
export function buildBoar(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'trophy:boar';
  g.add(buildShield(G, mats, 0.21, 0.34));
  const st = [
    { p: [0, -0.03, 0.035], w: 0.15, wl: 0.15, t: 0.17, b: 0.16 },
    { p: [0, -0.01, 0.1], w: 0.138, wl: 0.14, t: 0.18, b: 0.15 },
    { p: [0, -0.02, 0.17], w: 0.118, wl: 0.128, t: 0.145, b: 0.13 },
    { p: [0, -0.03, 0.23], w: 0.094, wl: 0.106, t: 0.112, b: 0.108 },
    { p: [0, -0.042, 0.29], w: 0.072, wl: 0.08, t: 0.082, b: 0.088 },
    { p: [0, -0.05, 0.35], w: 0.056, wl: 0.06, t: 0.06, b: 0.068 },
    { p: [0, -0.054, 0.41], w: 0.048, wl: 0.049, t: 0.047, b: 0.054, n: 2.3 },
    { p: [0, -0.055, 0.455], w: 0.046, wl: 0.046, t: 0.043, b: 0.048, n: 2.5 },
    { p: [0, -0.055, 0.48], w: 0.046, wl: 0.046, t: 0.043, b: 0.046, n: 2.5 },
    { p: [0, -0.055, 0.487], w: 0.03, wl: 0.03, t: 0.028, b: 0.03 },
  ];
  const NS = st.length - 1;
  const deform = (p, t, a, c, X, Y) => {
    const f = t * NS, ca = Math.cos(a), sa = Math.sin(a), sx = Math.sign(ca) || 1, side = Math.abs(ca);
    p.addScaledVector(X, sx * 0.02 * bump(f, 2.4, 0.9) * bump(sa, -0.45, 0.4) * side);       // heavy jowls
    p.addScaledVector(X, sx * 0.006 * bump(f, 3.0, 0.3) * bump(sa, 0.5, 0.2));              // brow over the small eye
    p.addScaledVector(X, -sx * 0.007 * bump(f, 3.3, 0.3) * bump(sa, 0.3, 0.2));             // eye socket
    p.addScaledVector(X, -sx * 0.005 * bump(f, 6.0, 1.3) * bump(sa, -0.4, 0.08) * side);    // lip line
    p.addScaledVector(X, sx * 0.008 * bump(f, 6.3, 0.35) * bump(sa, -0.45, 0.3) * side);    // tusk boss on the upper lip
    p.addScaledVector(Y, 0.025 * clamp01(1 - f / 3.2) * bump(sa, 1, 0.3));                  // crest ridge
    p.addScaledVector(Y, -0.004 * bump(f, 5.0, 1.5) * bump(sa, 1, 0.35));                   // dished snout top
  };
  const headG = loft2(st, { rings: 90, radial: 56, deform });
  {
    const along = headG.attributes.along, angs = headG.attributes.ang, pos = headG.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const f = along.getX(i) * NS, sa = Math.sin(angs.getX(i));
      let k = 1 - 0.45 * clamp01(1 - f / 3.5) * Math.max(0, sa);
      k *= 1 + 0.3 * bump(f, 5.0, 1.4) * (0.5 + 0.5 * Math.max(0, -sa));      // grizzled grey snout and cheeks
      k *= 1 - 0.55 * clamp01((f - 7.6) / 0.6);
      col.set([k, k * 0.96, k * 0.92], i * 3);
    }
    headG.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  g.add(new THREE.Mesh(headG, mats.fur));
  const curve = new THREE.CatmullRomCurve3(st.map((q) => V3(...q.p)), false, 'centripetal');
  const frame = (f) => {
    const t = f / NS; const c = curve.getPoint(t), T = curve.getTangent(t).normalize();
    const X = new THREE.Vector3().crossVectors(V3(0, 1, 0), T).normalize(), Y = new THREE.Vector3().crossVectors(T, X).normalize();
    return { t, c, T, X, Y };
  };
  const surf = (f, a, out = 0) => {
    const { t, c, X, Y } = frame(f);
    const w = lerpKey(st, 'w', t), wl = lerpKey(st, 'wl', t, 'w'), tp = lerpKey(st, 't', t), bt = lerpKey(st, 'b', t, 't');
    const ca = Math.cos(a), sa = Math.sin(a);
    const ww = sa >= 0 ? w : w + (wl - w) * (-sa) ** 0.7;
    const p = c.clone().addScaledVector(X, ca * (ww + out)).addScaledVector(Y, sa >= 0 ? sa * (tp + out) : sa * (bt + out));
    deform(p, t, a, c, X, Y);
    return p;
  };
  const normalAt = (f, a) => { const p0 = surf(f, a), pa = surf(f, a + 0.02), pf = surf(f + 0.03, a); return new THREE.Vector3().crossVectors(pf.sub(p0), pa.sub(p0)).normalize().multiplyScalar(-1); };

  // snout disc: flat pink-grey pad with a rim, two nostril recesses
  {
    const dz = 0.487;
    const disc = G.latheFromProfile([[0, 0.006], [0.02, 0.0058], [0.034, 0.005], [0.042, 0.003], [0.047, 0.0], [0.048, -0.008]], 40).rotateX(Math.PI / 2);
    disc.scale(1, 0.94, 1); disc.translate(0, -0.055, dz - 0.002);
    g.add(new THREE.Mesh(disc, mats.snout || mats.nose));
    for (const sx of [-1, 1]) {
      const n = new THREE.SphereGeometry(0.0105, 16, 12); n.scale(0.75, 1.15, 0.45); n.translate(sx * 0.016, -0.053, dz + 0.0045);
      g.add(new THREE.Mesh(n, mats.nostril || mats.eye));
    }
  }
  // glass eyes, small and high
  for (const sx of [-1, 1]) {
    const a = sx > 0 ? 0.42 : Math.PI - 0.42;
    const p = surf(3.3, a, -0.004);
    const n = normalAt(3.3, a).add(V3(0, 0.1, 0.5)).normalize();
    g.add(glassEye({ ...mats, eye: mats.eyeBoar || mats.eye }, p, n, 0.0105, [1, 1, 0.9]));
  }
  // ears: pointed triangular cups, twice the old size, pricked and angled forward
  for (const sx of [-1, 1]) {
    const L = 0.16, Wd = 0.085;
    const eg = new THREE.SphereGeometry(0.5, 24, 18, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI);
    const p = eg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 0.5, u = (y + 1) / 2;
      const taper = Math.max(0.02, (1 - u) ** 0.9 * Math.min(1, u * 6 + 0.35));
      p.setXYZ(i, p.getX(i) * Wd * taper, u * L, p.getZ(i) * Wd * 0.7 * taper);
    }
    eg.computeVertexNormals();
    const c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const u = p.getY(i) / L; const k = 0.95 + 0.3 * u; c.set([k, k * 0.95, k * 0.9], i * 3); }
    eg.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const ear = new THREE.Mesh(eg, mats.furDouble);
    ear.position.copy(surf(1.9, sx > 0 ? 0.62 : Math.PI - 0.62, -0.01));
    ear.rotation.set(0.35, sx * -0.35, -sx * 0.45);
    g.add(ear);
  }
  // tusks: lower pair (~75 mm) curling up past the snout, upper whetters
  const bone = [];
  const ivB = new THREE.Color().setRGB(0.42, 0.35, 0.24), ivM = new THREE.Color().setRGB(0.72, 0.65, 0.52), ivT = new THREE.Color().setRGB(0.86, 0.82, 0.72);
  for (const sx of [-1, 1]) {
    const lower = new THREE.CatmullRomCurve3([V3(sx * 0.03, -0.092, 0.398), V3(sx * 0.062, -0.088, 0.44), V3(sx * 0.092, -0.06, 0.462), V3(sx * 0.108, -0.022, 0.458), V3(sx * 0.106, 0.012, 0.44), V3(sx * 0.094, 0.03, 0.418)]);
    bone.push(antlerTube(lower, 36, 0.0115, 0.0035, 14, ivB, ivM, 0.9, { gutters: 0.03, pearl: 0.0, seed: sx, c2: ivT }));
    const upper = new THREE.CatmullRomCurve3([V3(sx * 0.038, -0.066, 0.405), V3(sx * 0.056, -0.07, 0.432), V3(sx * 0.07, -0.056, 0.444), V3(sx * 0.078, -0.036, 0.44)]);
    bone.push(antlerTube(upper, 16, 0.0075, 0.003, 10, ivB, ivM, 0.9, { gutters: 0.03, pearl: 0.0, seed: sx + 3, c2: ivT }));
  }
  const tusks = new THREE.Mesh(G.mergeGeometries(bone.map(toNI)), mats.tusk || mats.antler); tusks.name = 'tusks';
  g.add(tusks);
  // bristle crest: 220 instanced tapering strands, dark with grey tips (vertex colours), raised along the ridge
  {
    const rnd = ctx.random.fork('boar-bristle');
    const bg = new THREE.ConeGeometry(0.0016, 1, 4, 3).translate(0, 0.5, 0);
    const bc = new Float32Array(bg.attributes.position.count * 3);
    for (let i = 0; i < bg.attributes.position.count; i++) { const y = bg.attributes.position.getY(i); const k = Math.max(0, y - 0.55) / 0.45; bc.set([0.035 + k * 0.2, 0.03 + k * 0.19, 0.027 + k * 0.18], i * 3); }
    bg.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
    const n = 420;
    const im = new THREE.InstancedMesh(bg, mats.bristle, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), upv = V3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const f = rnd.next() * 3.6;
      const a = Math.PI / 2 + (rnd.next() - 0.5) * 0.9;
      const p = surf(f, a, -0.004);
      const nrm = normalAt(f, a);
      const { T } = frame(f);
      const d = nrm.clone().multiplyScalar(1.0).addScaledVector(T, -0.75 - rnd.next() * 0.3).add(V3((rnd.next() - 0.5) * 0.4, 0, 0)).normalize();
      q.setFromUnitVectors(upv, d);
      const len = (0.04 + rnd.next() * 0.03) * (1.2 - f / 6);
      const w = 0.8 + rnd.next() * 0.6;
      m4.compose(p, q, V3(w, len, w)); im.setMatrixAt(i, m4);
    }
    im.userData.keep = true; im.name = 'boarBristle';
    g.add(im);
  }
  // coarse coat locks over the neck and cheeks (alpha cards)
  {
    const rnd = ctx.random.fork('boar-coat');
    const samples = [];
    for (let k = 0; k < 700; k++) {
      const f = 0.1 + rnd.next() * 4.8;
      const a = rnd.next() * Math.PI * 2;
      if (rnd.next() > clamp01((5.2 - f) / 1.6)) continue;
      const nrm = normalAt(f, a);
      const { T } = frame(f);
      const sa = Math.sin(a);
      const d = T.clone().multiplyScalar(-1).addScaledVector(V3(0, -1, 0), 0.25 + Math.max(0, -sa) * 0.6).addScaledVector(nrm, 0.35).normalize();
      samples.push({ p: surf(f, a, -0.002), n: nrm, d, len: 0.022 + rnd.next() * 0.03 + Math.max(0, sa) * 0.02 * (1 - f / 5), w: 0.014 + rnd.next() * 0.01, twist: (rnd.next() - 0.5), c: 0.6 + 0.5 * rnd.next() });
    }
    const hm = new THREE.Mesh(hairCards(samples, { segs: 3, gravity: 0.5, curl: 0.4 }), mats.hair);
    hm.userData.keep = true; hm.name = 'boarCoat';
    g.add(hm);
  }
  g.userData.focus = V3(0, 0.0, 0.3);
  return g;
}
