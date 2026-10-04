import * as THREE from 'three';
import { sdfGeometry, smin, smax, ssub, sdSphere, sdEllipsoid, sdCapsule, sdRoundCone, vnoise3 } from '../../engine/lib/contrib/bedroom-sdf.js';
import { buildShield, glassEye, hairCards, toNI } from './trophy.js';

/**
 * Taxidermy trophies, round 4: the heads are SCULPTED as signed-distance fields (smooth unions of skull, jowl,
 * muzzle and jaw volumes, with eye sockets, nostrils and the mouth cut in), polygonised with surface nets, so
 * they read as one continuous modelled mass instead of a lofted tube. The coat is pushed into the surface as
 * an anisotropic clump displacement that runs from the nose back over the skull and down the neck, and the uv
 * runs the same way so the pelt texture's strands lie along the skull. Ears are thin cupped shells, the boar's
 * crest is long leaning bristle cards, the stag's tines are tapered, curved and pearled.
 *
 * Both face +Z with the shield back at z = 0, origin at the shield centre.
 */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** march from a point inside the field along dir to the zero crossing */
function surfaceHit(f, o, dir, maxLen = 0.4) {
  const d = dir.clone().normalize();
  let t = 0, prev = f(o.x, o.y, o.z);
  const p = o.clone();
  for (let i = 0; i < 400 && t < maxLen; i++) {
    t += 0.001;
    p.copy(o).addScaledVector(d, t);
    const v = f(p.x, p.y, p.z);
    if (prev < 0 && v >= 0) { const k = v / (v - prev); return p.addScaledVector(d, -0.001 * k); }
    prev = v;
  }
  return p;
}
function gradN(f, p) {
  const e = 0.0015;
  return V3(f(p.x + e, p.y, p.z) - f(p.x - e, p.y, p.z), f(p.x, p.y + e, p.z) - f(p.x, p.y - e, p.z), f(p.x, p.y, p.z + e) - f(p.x, p.y, p.z - e)).normalize();
}

/** split an indexed geometry into two by a per-triangle predicate on its centroid/normal */
function splitGeometry(g, pred) {
  const ix = g.index.array, P = g.attributes.position, N = g.attributes.normal;
  const a = [], b = [];
  const c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < ix.length; i += 3) {
    c.set(0, 0, 0); n.set(0, 0, 0);
    for (let k = 0; k < 3; k++) { c.x += P.getX(ix[i + k]); c.y += P.getY(ix[i + k]); c.z += P.getZ(ix[i + k]); n.x += N.getX(ix[i + k]); n.y += N.getY(ix[i + k]); n.z += N.getZ(ix[i + k]); }
    c.multiplyScalar(1 / 3); n.normalize();
    (pred(c, n) ? b : a).push(ix[i], ix[i + 1], ix[i + 2]);
  }
  const ga = g.clone(); ga.setIndex(a);
  const gb = g.clone(); gb.setIndex(b);
  return [ga, gb];
}

/** cylindrical "lay" uv: u around the head axis (repeats uRep times), v along z (1 unit per vLen metres) */
function layUV(g, axisY, { uRep = 4, vLen = 0.12, neckZ = 0.0, neckBlend = 0 } = {}) {
  const P = g.attributes.position;
  const uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const yc = axisY(z);
    let u = Math.atan2(x, y - yc) / (Math.PI * 2) + 0.5;
    uv[i * 2] = u * uRep;
    // on the neck the hair turns to run downward: bend v toward -y there
    const w = neckBlend ? sstep(neckZ + neckBlend, neckZ - neckBlend, z) : 0;
    uv[i * 2 + 1] = ((1 - w) * z + w * (0.25 - y) * 0.8) / vLen;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function tint(g, fn) {
  const P = g.attributes.position, N = g.attributes.normal;
  const old = g.attributes.color;
  const col = new Float32Array(P.count * 3);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    p.fromBufferAttribute(P, i); n.fromBufferAttribute(N, i);
    const ao = old ? old.getX(i) : 1;
    const c = fn(p, n, ao);
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Ear: a thin cupped shell lofted along +Y (base at 0, tip at L), the hollow opening toward +Z. The cross-section
 * is a crescent (inner cupped face + outer face meeting at a rounded rim) so it has real thickness and a cavity.
 * vertex colour darkens the inner face. Returns { geometry, rim: [{p, n, d}] } for hair on the rim.
 */
export function earShell({ L = 0.15, W = 0.045, cup = 0.6, thick = 0.006, curl = 0.02, tipPow = 0.9, segU = 28, segS = 36, innerTint = [0.55, 0.45, 0.42], outerTint = [1, 1, 1] } = {}) {
  const pos = [], col = [], uv = [], idx = [];
  const rim = [];
  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    const hw = Math.max(0.0006, W * Math.pow(1 - u, tipPow) * Math.min(1, (u + 0.12) * 2.6));
    const y = u * L;
    const zc = curl * u * u;
    for (let j = 0; j <= segS; j++) {
      const s = j / segS;                                  // 0..0.5 inner face (v -1 -> 1), 0.5..1 outer face (v 1 -> -1)
      const inner = s <= 0.5;
      const v = inner ? -Math.cos(s * 2 * Math.PI) : -Math.cos(s * 2 * Math.PI);
      const vv = inner ? -1 + s * 4 : 1 - (s - 0.5) * 4;  // linear across
      const xv = Math.sin((vv * Math.PI) / 2);            // smoother rim
      const depth = cup * hw * (1 - xv * xv);              // hollow of the cup
      const th = thick * (1 - 0.6 * u) * Math.sqrt(Math.max(0, 1 - xv * xv)) + 0.0008;
      const z = zc - (inner ? depth : depth + th);
      pos.push(xv * hw, y, z);
      const k = inner ? innerTint : outerTint;
      const edge = 1 - Math.abs(xv);
      const c = inner ? k.map((q) => q * (0.6 + 0.4 * (1 - edge))) : k;
      col.push(c[0], c[1], c[2]);
      uv.push(vv * 0.3, y / 0.08);
      void v;
    }
    if (i > 1 && i < segU - 4) for (const sx of [-1, 1]) for (const fx of [0.55, 0.8]) { const xv = sx * fx; rim.push({ p: V3(xv * hw, y, zc - cup * hw * (1 - xv * xv) + 0.0005), n: V3(-xv * 0.5, 0, 1).normalize(), d: V3(-xv * 0.3, 0.8, 0.45).normalize(), u }); }
  }
  for (let i = 0; i < segU; i++) for (let j = 0; j < segS; j++) {
    const a = i * (segS + 1) + j, b = a + segS + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geometry: g, rim };
}

/** place an ear group: base at p, opening facing `face`, pointing along `up` */
function placeEar(ear, p, up, face) {
  const Y = up.clone().normalize();
  const Z = face.clone().addScaledVector(Y, -face.dot(Y)).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
  const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(p);
  ear.applyMatrix4(m);
  return m;
}

/**
 * Tapered, curved, pearled antler / tusk tube. Radius r0 -> r1 with r(t) = r1 + (r0 - r1)(1 - t)^taper and a
 * sharpened point; longitudinal gutters; pearl knobs (hashed bumps) on the lower part; colour ramp c0 -> c1 -> c2.
 */
export function hornTube(curve, segs, r0, r1, radial, c0, c1, c2, { taper = 1.6, gutters = 0.12, pearl = 0.3, pearlTo = 0.5, seed = 0, flat = 1 } = {}) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], col = [], uv = [], idx = [];
  const len = curve.getLength();
  const A = new THREE.Color(c0), B = new THREE.Color(c1), Cc = new THREE.Color(c2), ca = new THREE.Color();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    let r = r1 + (r0 - r1) * Math.pow(1 - t, taper);
    if (t > 0.86) r *= Math.max(0.05, 1 - Math.pow((t - 0.86) / 0.14, 1.4) * 0.95);
    const N = frames.normals[i], Bn = frames.binormals[i];
    if (t < 0.55) ca.copy(A).lerp(B, Math.pow(t / 0.55, 0.8)); else ca.copy(B).lerp(Cc, Math.pow((t - 0.55) / 0.45, 1.3));
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const gx = Math.sin(a * 6 + t * 4.0 + seed) + 0.5 * Math.sin(a * 11 - t * 7 + seed * 2);
      let rr = r * (1 + gutters * gx * 0.5 * (1 - t * 0.8));
      const pk = vnoise3(Math.cos(a) * 4 + seed * 3, Math.sin(a) * 4, t * len * 160);
      rr *= 1 + pearl * Math.max(0, pk - 0.52) * (1 - sstep(pearlTo * 0.6, pearlTo, t));
      const n = N.clone().multiplyScalar(Math.cos(a) * flat).add(Bn.clone().multiplyScalar(Math.sin(a)));
      pos.push(p.x + n.x * rr, p.y + n.y * rr, p.z + n.z * rr);
      const k = (1 - 0.22 * Math.max(0, -gx) * (1 - t)) * (1 + 0.15 * Math.max(0, pk - 0.55) * (1 - t));
      col.push(ca.r * k, ca.g * k, ca.b * k);
      uv.push(j / radial, t * len * 4);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** sample n surface points from a geometry with a weight function w(p, n) in 0..1 */
function sampleSurface(g, n, rnd, w) {
  const P = g.attributes.position, N = g.attributes.normal;
  const out = [];
  const count = P.count;
  let guard = 0;
  while (out.length < n && guard++ < n * 60) {
    const i = Math.floor(rnd.next() * count);
    const p = V3(P.getX(i), P.getY(i), P.getZ(i)), nn = V3(N.getX(i), N.getY(i), N.getZ(i));
    const k = w(p, nn);
    if (k > 0 && rnd.next() < k) out.push({ p, n: nn });
  }
  return out;
}

// =================================================================================================== boar
function boarField() {
  return (x, y, z) => {
    const ax = Math.abs(x);
    // neck / shoulder mass leaving the shield
    let d = sdEllipsoid(x, y + 0.005, z - 0.07, 0.158, 0.185, 0.13);
    // the dorsal crest: a high hump behind the ears running down to the forehead
    d = smin(d, sdRoundCone(x * 1.25, y, z, [0, 0.115, 0.06], [0, 0.085, 0.2], 0.085, 0.06), 0.04);
    d = smin(d, sdRoundCone(x, y, z, [0, 0.085, 0.2], [0, 0.03, 0.33], 0.06, 0.04), 0.04);
    // cranium / cheeks
    d = smin(d, sdEllipsoid(x, y - 0.005, z - 0.205, 0.1, 0.105, 0.125), 0.04);
    // heavy jowls hanging low behind the mouth
    d = smin(d, sdEllipsoid(ax - 0.066, y + 0.078, z - 0.205, 0.058, 0.074, 0.1), 0.05);
    // throat and dewlap
    d = smin(d, sdEllipsoid(x, y + 0.115, z - 0.125, 0.1, 0.08, 0.13), 0.05);
    // long tapering snout, a touch flattened at the sides
    d = smin(d, sdRoundCone(x * 1.08, y, z, [0, -0.012, 0.27], [0, -0.05, 0.478], 0.07, 0.0445), 0.05);
    // lower jaw under the snout
    d = smin(d, sdRoundCone(x, y, z, [0, -0.088, 0.24], [0, -0.087, 0.425], 0.05, 0.026), 0.03);
    // upper-lip bosses where the tusks leave the mouth
    d = smin(d, sdEllipsoid(ax - 0.044, y + 0.071, z - 0.388, 0.022, 0.021, 0.036), 0.016);
    // brow shelf over the small eye
    d = smin(d, sdEllipsoid(ax - 0.066, y - 0.078, z - 0.258, 0.03, 0.017, 0.04), 0.02);
    // eye socket
    d = ssub(d, sdSphere(ax - 0.081, y - 0.054, z - 0.272, 0.0125), 0.012);
    // cut flat at the shield
    d = smax(d, 0.032 - z, 0.012);
    // flat snout disc with a soft bevelled rim
    d = smax(d, z - 0.486, 0.009);
    if (d > 0.012 || d < -0.03) return d;
    // teardrop nostrils sculpted into the disc
    d = ssub(d, sdRoundCone(ax, y, z, [0.0172, -0.06, 0.487], [0.0105, -0.041, 0.485], 0.0074, 0.003), 0.003);
    d = ssub(d, sdEllipsoid(ax - 0.0155, y + 0.054, z - 0.476, 0.006, 0.009, 0.012), 0.002);
    // mouth line and lip roll
    d = ssub(d, sdCapsule(ax, y, z, [0.056, -0.088, 0.27], [0.035, -0.079, 0.442], 0.0042), 0.004);
    // skin folds round the snout root
    if (z > 0.33 && z < 0.44 && y > -0.07) {
      const fold = Math.sin((z - 0.33) * 190) * 0.5 + 0.5;
      d += 0.0012 * fold * fold * sstep(0.33, 0.36, z) * sstep(0.44, 0.41, z);
    }
    // coat: clumped coarse hair lying back along the head, turning down over the neck
    const fur = sstep(0.465, 0.42, z);
    if (fur > 0) {
      const wNeck = sstep(0.2, 0.1, z);
      const nHead = vnoise3(x * 95, y * 95, z * 20);
      const nNeck = vnoise3(x * 80 + 3.1, y * 18, z * 80);
      const n = nHead * (1 - wNeck) + nNeck * wNeck;
      const ridge = 1 - Math.abs(2 * n - 1);
      const lump = vnoise3(x * 34 + 7.3, y * 34, z * 14);
      const amp = 0.0024 + 0.0024 * wNeck + 0.002 * sstep(0.05, 0.12, y) * sstep(0.34, 0.2, z);
      d -= fur * (amp * 0.55 * ridge + 0.0035 * lump);
    }
    return d;
  };
}

export function buildBoar2(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'trophy:boar';
  g.add(buildShield(G, mats, 0.21, 0.34));
  const f = boarField();
  const step = ctx.params?.get?.('trophyStep') ? +ctx.params.get('trophyStep') : 0.0032;
  const head = sdfGeometry(f, { min: [-0.2, -0.235, 0.02], max: [0.2, 0.25, 0.53], step, project: 3, ao: 0.035, aoStrength: 1.1 });
  // tint: darker crest and nape, grizzled cheeks and snout, pale jowl tips; ao from the sculpt
  tint(head, (p, n, ao) => {
    let k = 1;
    k *= 1 - 0.45 * sstep(0.03, 0.14, p.y) * sstep(0.36, 0.2, p.z);           // dark crest & nape
    k *= 1 + 0.35 * sstep(0.25, 0.4, p.z) * (0.6 + 0.4 * sstep(0.0, -0.08, p.y)); // grizzled grey snout and lips
    k *= 1 + 0.2 * sstep(-0.05, -0.12, p.y) * sstep(0.14, 0.26, p.z);          // pale jowls
    const a = 0.35 + 0.65 * ao;
    return [k * a, k * a * 0.97, k * a * 0.93];
  });
  layUV(head, (z) => -0.012 - 0.07 * clamp01((z - 0.27) / 0.21), { uRep: 5, vLen: 0.11, neckZ: 0.15, neckBlend: 0.06 });
  const [furG, discG] = splitGeometry(head, (c) => c.z > 0.47);
  const furMesh = new THREE.Mesh(furG, mats.fur); furMesh.name = 'boarHead';
  g.add(furMesh);
  // the disc: moist leathery skin, darker in the nostrils and toward the rim
  tint(discG, (p, n, ao) => { const r = Math.hypot(p.x, (p.y + 0.05) / 0.95); const k = (0.55 + 0.45 * ao) * (0.75 + 0.35 * sstep(0.044, 0.02, r)); return [k, k * 0.9, k * 0.88]; });
  const uvd = new Float32Array(discG.attributes.position.count * 2);
  for (let i = 0; i < discG.attributes.position.count; i++) { uvd[i * 2] = discG.attributes.position.getX(i) * 22; uvd[i * 2 + 1] = discG.attributes.position.getY(i) * 22; }
  discG.setAttribute('uv', new THREE.BufferAttribute(uvd, 2));
  g.add(new THREE.Mesh(discG, mats.snout));

  // glass eyes, small, high and deep-set under the brow
  for (const sx of [-1, 1]) {
    const c = V3(sx * 0.081, 0.054, 0.272);
    const n = V3(sx * 0.85, 0.25, 0.45).normalize();
    g.add(glassEye({ ...mats, eye: mats.eye, lid: mats.lid || mats.snout }, c.clone().addScaledVector(n, 0.002), n, 0.0098, [1, 0.85, 0.9]));
  }
  // ears: big pricked cupped shells, angled forward and out, a fringe of long hair on the rims
  const earHair = [];
  for (const sx of [-1, 1]) {
    const { geometry: eg, rim } = earShell({ L: 0.15, W: 0.062, cup: 1.05, thick: 0.007, curl: 0.03, tipPow: 1.15, innerTint: [0.62, 0.5, 0.45], outerTint: [0.85, 0.8, 0.75] });
    const base = surfaceHit(f, V3(sx * 0.03, 0.08, 0.17), V3(sx * 0.9, 0.75, -0.15));
    base.addScaledVector(gradN(f, base), -0.012);
    const up = V3(sx * 0.85, 0.7, 0.2), face = V3(sx * 0.55, 0.25, 1.0);
    const m = placeEar(eg, base, up, face);
    const mesh = new THREE.Mesh(eg, mats.ear || mats.fur); g.add(mesh);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    for (const r of rim) earHair.push({ p: r.p.clone().applyMatrix4(m), n: r.n.clone().applyMatrix3(nm).normalize(), d: r.d.clone().applyMatrix3(nm).normalize(), len: 0.014 + 0.02 * (1 - r.u), w: 0.009, twist: 0.6, c: 0.9 });
  }
  // tusks: lower pair curling up past the snout, upper whetters
  const bone = [];
  for (const sx of [-1, 1]) {
    const lower = new THREE.CatmullRomCurve3([V3(sx * 0.032, -0.09, 0.39), V3(sx * 0.058, -0.084, 0.425), V3(sx * 0.084, -0.064, 0.452), V3(sx * 0.102, -0.03, 0.458), V3(sx * 0.105, 0.003, 0.447), V3(sx * 0.096, 0.026, 0.43)]);
    bone.push(hornTube(lower, 40, 0.0118, 0.0018, 16, 0x5a4a30, 0xb8a888, 0xe4dccb, { taper: 1.1, gutters: 0.05, pearl: 0, seed: sx, flat: 0.85 }));
    const upper = new THREE.CatmullRomCurve3([V3(sx * 0.04, -0.066, 0.4), V3(sx * 0.057, -0.069, 0.427), V3(sx * 0.07, -0.057, 0.442), V3(sx * 0.077, -0.037, 0.44)]);
    bone.push(hornTube(upper, 18, 0.0078, 0.002, 12, 0x5a4a30, 0xb0a080, 0xd8cdb8, { taper: 1.1, gutters: 0.05, pearl: 0, seed: sx + 3, flat: 0.85 }));
  }
  const tusks = new THREE.Mesh(G.mergeGeometries(bone.map(toNI)), mats.tusk); tusks.name = 'tusks';
  g.add(tusks);

  // hair: the dorsal bristle crest (long, coarse, leaning back, lengths jittered +-40%), a ragged coat over the
  // neck and cheeks, and the ear fringes
  const rnd = ctx.random.fork('boar2-hair');
  const crest = sampleSurface(furG, 900, rnd, (p, n) => (Math.abs(p.x) < 0.03 + 0.03 * sstep(0.3, 0.05, p.z) && n.y > 0.35 && p.z < 0.33 && p.z > 0.04 ? 1 : 0));
  const back = V3(0, 0, -1);
  const crestCards = crest.map(({ p, n }) => {
    const lenBase = 0.022 + 0.06 * sstep(0.33, 0.1, p.z);
    return { p: p.clone().addScaledVector(n, -0.002), n, d: n.clone().multiplyScalar(0.75).addScaledVector(back, 0.85).add(V3((rnd.next() - 0.5) * 0.35, 0, 0)).normalize(), len: lenBase * (0.6 + 0.8 * rnd.next()), w: 0.012 + rnd.next() * 0.008, twist: (rnd.next() - 0.5) * 1.2, c: 0.55 + 0.5 * rnd.next() };
  });
  g.add(Object.assign(new THREE.Mesh(hairCards(crestCards, { segs: 5, gravity: 0.3, curl: 0.4 }), mats.bristleCard || mats.hair), { name: 'boarCrest' }));
  const coat = sampleSurface(furG, 1300, rnd, (p) => (p.z < 0.37 ? 0.35 + 0.65 * sstep(0.3, 0.08, p.z) : 0));
  const coatCards = coat.map(({ p, n }) => {
    const dn = V3(0, -1, 0);
    const d = back.clone().multiplyScalar(0.9).addScaledVector(dn, 0.35 + 0.6 * sstep(0.18, 0.06, p.z)).addScaledVector(n, 0.35);
    d.addScaledVector(n, -d.dot(n) * 0.6).normalize();
    return { p: p.clone().addScaledVector(n, -0.0015), n, d, len: (0.018 + 0.03 * rnd.next()) * (1 + 0.6 * sstep(0.2, 0.05, p.z)), w: 0.011 + rnd.next() * 0.008, twist: (rnd.next() - 0.5), c: 0.55 + 0.55 * rnd.next() };
  });
  g.add(Object.assign(new THREE.Mesh(hairCards(coatCards, { segs: 3, gravity: 0.55, curl: 0.25 }), mats.hair), { name: 'boarCoat' }));
  g.add(Object.assign(new THREE.Mesh(hairCards(earHair, { segs: 3, gravity: 0.2, curl: 0.3 }), mats.hair), { name: 'boarEarHair' }));
  g.traverse((o) => { if (o.isMesh && /Crest|Coat|EarHair/.test(o.name)) o.userData.keep = true; });
  g.userData.focus = V3(0, 0.0, 0.3);
  return g;
}

// =================================================================================================== stag
function stagField() {
  return (x, y, z) => {
    const ax = Math.abs(x);
    // neck: deep and narrow, rising forward from the shield
    let d = sdRoundCone(x * 1.15, y, z, [0, -0.075, 0.05], [0, 0.075, 0.225], 0.158, 0.085);
    // cranium and flat forehead between the pedicles
    d = smin(d, sdEllipsoid(x, y - 0.163, z - 0.3, 0.07, 0.07, 0.08), 0.04);
    d = smin(d, sdEllipsoid(x, y - 0.19, z - 0.315, 0.062, 0.035, 0.07), 0.03);
    // cheek plane (masseter) behind the mouth corner
    d = smin(d, sdEllipsoid(ax - 0.043, y - 0.118, z - 0.33, 0.032, 0.05, 0.068), 0.03);
    // long tapering muzzle, narrow across
    d = smin(d, sdRoundCone(x * 1.32, y, z, [0, 0.152, 0.36], [0, 0.128, 0.528], 0.058, 0.03), 0.045);
    // nasal bridge running down into the nose
    d = smin(d, sdCapsule(x * 1.2, y, z, [0, 0.178, 0.36], [0, 0.152, 0.53], 0.011), 0.02);
    // lower jaw and chin
    d = smin(d, sdRoundCone(x * 1.2, y, z, [0, 0.097, 0.33], [0, 0.104, 0.515], 0.034, 0.019), 0.025);
    d = smin(d, sdEllipsoid(x, y - 0.1, z - 0.505, 0.019, 0.016, 0.02), 0.012);
    // eye bulge and the brow ridge over it
    d = smin(d, sdSphere(ax - 0.058, y - 0.178, z - 0.345, 0.017), 0.016);
    d = smin(d, sdEllipsoid(ax - 0.05, y - 0.198, z - 0.338, 0.028, 0.011, 0.03), 0.014);
    // the eye socket the glass eye sits in
    d = ssub(d, sdSphere(ax - 0.07, y - 0.178, z - 0.35, 0.0125), 0.006);
    // preorbital gland pit: a tear-drop hollow in front of the eye
    d = ssub(d, sdRoundCone(ax, y, z, [0.054, 0.163, 0.372], [0.047, 0.152, 0.398], 0.0065, 0.003), 0.006);
    // cut at the shield
    d = smax(d, 0.032 - z, 0.012);
    if (d > 0.012 || d < -0.03) return d;
    // comma-shaped nostrils curling up and out of the rhinarium
    d = ssub(d, sdRoundCone(ax, y, z, [0.008, 0.14, 0.557], [0.019, 0.137, 0.548], 0.0042, 0.0035), 0.0025);
    d = ssub(d, sdRoundCone(ax, y, z, [0.019, 0.137, 0.548], [0.024, 0.15, 0.538], 0.0035, 0.0018), 0.0025);
    // mouth line and lip
    d = ssub(d, sdCapsule(ax, y, z, [0.02, 0.105, 0.43], [0.0135, 0.111, 0.535], 0.0028), 0.003);
    // coat: short hair lying back from the nose, longer and turning down over the neck
    const fur = sstep(0.53, 0.48, z);
    if (fur > 0) {
      const wNeck = sstep(0.27, 0.17, z);
      const nHead = vnoise3(x * 120, y * 120, z * 26);
      const nNeck = vnoise3(x * 70 + 3.1, y * 16, z * 70);
      const n = nHead * (1 - wNeck) + nNeck * wNeck;
      const ridge = 1 - Math.abs(2 * n - 1);
      const lump = vnoise3(x * 40 + 7.3, y * 40, z * 18);
      const amp = 0.0008 + 0.0032 * wNeck * (0.5 + 0.5 * sstep(0.0, -0.1, y));
      d -= fur * (amp * ridge + (0.0008 + 0.0022 * wNeck) * lump);
    }
    return d;
  };
}

export function buildStag2(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'trophy:stag';
  g.add(buildShield(G, mats, 0.25, 0.42));
  const f = stagField();
  const step = ctx.params?.get?.('trophyStep') ? +ctx.params.get('trophyStep') : 0.003;
  const head = sdfGeometry(f, { min: [-0.19, -0.25, 0.02], max: [0.19, 0.28, 0.575], step, project: 3, ao: 0.03, aoStrength: 1.1 });
  const Fn = { eye: [0.07, 0.178, 0.35], pre: [0.05, 0.157, 0.385] };
  tint(head, (p, n, ao) => {
    const ax = Math.abs(p.x);
    let c = [1, 0.97, 0.94];
    const mane = sstep(0.26, 0.12, p.z);                                         // dark brown mane
    c = c.map((v) => v * (1 - 0.5 * mane));
    const eyeR = Math.hypot(ax - Fn.eye[0], p.y - Fn.eye[1], p.z - Fn.eye[2]);    // pale eye ring
    const ring = sstep(0.03, 0.016, eyeR) * sstep(0.008, 0.015, eyeR);
    c = c.map((v, i) => v + ring * [0.4, 0.37, 0.32][i]);
    const band = Math.exp(-(((p.z - 0.505) / 0.013) ** 2)) * sstep(0.1, 0.14, p.y);  // pale muzzle band
    c = c.map((v, i) => v + band * [0.42, 0.4, 0.35][i]);
    const chin = sstep(0.115, 0.095, p.y) * sstep(0.42, 0.5, p.z);                // pale chin & lips
    c = c.map((v, i) => v + chin * [0.4, 0.38, 0.34][i]);
    const face = sstep(0.3, 0.45, p.z) * sstep(0.12, 0.17, p.y);                  // greyer face
    c = [c[0] * (1 - 0.06 * face), c[1] * (1 + 0.02 * face), c[2] * (1 + 0.06 * face)];
    const pit = Math.hypot(ax - Fn.pre[0], (p.y - Fn.pre[1]) * 1.5, (p.z - Fn.pre[2]) * 0.6);
    c = c.map((v) => v * (1 - 0.8 * sstep(0.012, 0.004, pit)));
    const throat = sstep(0.0, -0.12, p.y) * sstep(0.08, 0.2, p.z);               // pale throat patch
    c = c.map((v, i) => v + throat * 0.25 * [1, 0.92, 0.8][i]);
    const a = 0.32 + 0.68 * ao;
    return c.map((v) => v * a);
  });
  layUV(head, (z) => (z < 0.25 ? -0.07 + (z - 0.05) * 1.1 : 0.15 - (z - 0.25) * 0.08), { uRep: 7, vLen: 0.06, neckZ: 0.2, neckBlend: 0.07 });
  const [furG, noseG] = splitGeometry(head, (c) => c.z > 0.535 && c.y > 0.112);
  g.add(Object.assign(new THREE.Mesh(furG, mats.fur), { name: 'stagHead' }));
  const uvn = new Float32Array(noseG.attributes.position.count * 2);
  for (let i = 0; i < noseG.attributes.position.count; i++) { uvn[i * 2] = noseG.attributes.position.getX(i) * 25; uvn[i * 2 + 1] = noseG.attributes.position.getY(i) * 25; }
  noseG.setAttribute('uv', new THREE.BufferAttribute(uvn, 2));
  tint(noseG, (p, n, ao) => { const k = 0.4 + 0.6 * ao; return [k, k, k]; });
  g.add(Object.assign(new THREE.Mesh(noseG, mats.nose), { name: 'rhinarium' }));
  // glass eyes in the sockets, looking slightly forward
  for (const sx of [-1, 1]) {
    const c = V3(sx * 0.07, 0.178, 0.35);
    const n = V3(sx * 0.82, 0.12, 0.55).normalize();
    g.add(glassEye({ ...mats, eye: mats.eye, lid: mats.lid }, c.clone().addScaledVector(n, -0.0005), n, 0.0128, [1, 0.8, 0.95]));
  }
  // ears: large, cupped, swept out and back behind the antlers
  const earHair = [];
  for (const sx of [-1, 1]) {
    const { geometry: eg, rim } = earShell({ L: 0.17, W: 0.055, cup: 1.0, thick: 0.006, curl: 0.02, tipPow: 0.75, innerTint: [0.5, 0.42, 0.38], outerTint: [0.85, 0.8, 0.74] });
    const base = surfaceHit(f, V3(sx * 0.02, 0.17, 0.27), V3(sx * 1.0, 0.55, -0.25));
    base.addScaledVector(gradN(f, base), -0.01);
    placeEar(eg, base, V3(sx * 0.95, 0.38, -0.35), V3(sx * 0.2, 0.25, 1.0));
    g.add(new THREE.Mesh(eg, mats.ear));
    const m = new THREE.Matrix4(); void m; void rim;
  }
  void earHair;

  // antlers: a royal — brow, bez, trez and a crown of three; tapered, curved, pearled, with knobbly burrs
  const CB = 0x241608, CM = 0x4a3420, CT = 0xd8ccb4;
  const bone = [];
  const rnd = ctx.random.fork('stag2-antler');
  for (const sx of [-1, 1]) {
    const base = surfaceHit(f, V3(sx * 0.02, 0.17, 0.29), V3(sx * 0.45, 1.0, -0.05));
    base.addScaledVector(V3(sx * 0.45, 1.0, -0.05).normalize(), -0.004);
    const P = (x, y, z) => base.clone().add(V3(sx * x, y, z));
    const beam = new THREE.CatmullRomCurve3([P(0, 0, 0), P(0.05, 0.06, -0.035), P(0.13, 0.17, -0.075), P(0.22, 0.31, -0.09), P(0.27, 0.46, -0.06), P(0.265, 0.6, 0.0), P(0.235, 0.7, 0.05)], false, 'centripetal');
    bone.push(hornTube(beam, 110, 0.03, 0.012, 22, CB, CM, 0x6a5038, { taper: 1.0, gutters: 0.16, pearl: 0.55, pearlTo: 0.5, seed: sx * 1.3 }));
    const tines = [
      // t on beam, dir, length, base r, upward sweep, sideways bend
      [0.06, V3(sx * 0.12, 0.05, 1.0), 0.19, 0.017, 0.55, -0.15],   // brow tine: low, forward, sweeping up
      [0.15, V3(sx * 0.22, 0.28, 1.0), 0.15, 0.0155, 0.45, 0.12],   // bez
      [0.45, V3(sx * 0.18, 0.3, 1.0), 0.14, 0.0145, 0.5, -0.1],     // trez
      [0.82, V3(-sx * 0.4, 0.75, 0.55), 0.1, 0.012, 0.25, 0.15],    // crown inner
      [0.91, V3(sx * 0.75, 0.75, 0.3), 0.095, 0.011, 0.3, -0.15],   // crown outer
    ];
    tines.forEach(([t, dir, len, r, rise, bend], i) => {
      const p = beam.getPointAt(t);
      const dn = dir.clone().normalize();
      const side = new THREE.Vector3().crossVectors(dn, V3(0, 1, 0)).normalize();
      const L = len * (0.92 + 0.16 * rnd.next());
      const c = new THREE.CatmullRomCurve3([
        p.clone().addScaledVector(dn, -0.012),
        p.clone().addScaledVector(dn, L * 0.3).addScaledVector(side, bend * L * 0.12),
        p.clone().addScaledVector(dn, L * 0.62).add(V3(0, L * rise * 0.3, 0)).addScaledVector(side, bend * L * 0.22),
        p.clone().addScaledVector(dn, L * 0.86).add(V3(0, L * rise * 0.75, 0)).addScaledVector(side, bend * L * 0.15),
        p.clone().addScaledVector(dn, L * 0.95).add(V3(0, L * rise * 1.15, 0)),
      ], false, 'centripetal');
      bone.push(hornTube(c, 36, r, r * 0.12, 14, CM, 0x6a5038, CT, { taper: 1.6, gutters: 0.12, pearl: 0.3, pearlTo: 0.35, seed: i * 2.1 + sx * 7 }));
    });
    // the beam's own tip carries the third crown point; give it an ivory tip
    const tipC = new THREE.CatmullRomCurve3([beam.getPointAt(0.97), beam.getPointAt(1.0), beam.getPointAt(1.0).add(V3(-sx * 0.01, 0.06, 0.03))]);
    bone.push(hornTube(tipC, 16, 0.0125, 0.002, 14, 0x6a5038, 0x9a8468, CT, { taper: 1.4, gutters: 0.08, pearl: 0, seed: sx }));
    // knobbly burr (coronet) at the pedicle
    const burr = new THREE.TorusGeometry(0.032, 0.0115, 16, 48);
    const bp = burr.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
      const a = Math.atan2(y, x);
      const nz = vnoise3(Math.cos(a) * 6 + sx * 5, Math.sin(a) * 6, z * 300);
      const k = 1 + 0.9 * Math.max(0, nz - 0.35) + 0.15 * vnoise3(x * 400, y * 400, z * 400);
      const r = Math.hypot(x, y); const rr = 0.032 + (r - 0.032) * k;
      bp.setXYZ(i, (x / r) * rr, (y / r) * rr, z * k);
    }
    burr.computeVertexNormals();
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), beam.getTangentAt(0.025));
    burr.applyQuaternion(q); const bpos = beam.getPointAt(0.025); burr.translate(bpos.x, bpos.y, bpos.z);
    const bc = new Float32Array(burr.attributes.position.count * 3);
    for (let i = 0; i < bp.count; i++) { const k = 0.6 + 0.4 * vnoise3(bp.getX(i) * 300, bp.getY(i) * 300, bp.getZ(i) * 300); bc.set([0.13 * k, 0.085 * k, 0.05 * k], i * 3); }
    burr.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
    burr.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(bp.count * 2), 2));
    bone.push(burr);
  }
  const ant = new THREE.Mesh(G.mergeGeometries(bone.map(toNI)), mats.antler); ant.name = 'antlers';
  g.add(ant);

  // hair: a throat ruff and mane that HANGS (short locks, heavy gravity), a few longer locks under the jaw
  const hr = ctx.random.fork('stag2-hair');
  const ruff = sampleSurface(furG, 1800, hr, (p, n) => (p.z < 0.3 ? (0.3 + 0.7 * sstep(0.0, -0.6, n.y)) * sstep(0.3, 0.2, p.z) : 0));
  const cards = ruff.map(({ p, n }) => {
    const d = V3(0, -1, -0.35).addScaledVector(n, 0.25);
    d.addScaledVector(n, -d.dot(n) * 0.7).normalize();
    const under = sstep(0.0, -0.7, n.y);
    return { p: p.clone().addScaledVector(n, -0.0015), n, d, len: (0.02 + 0.03 * under) * (0.7 + 0.6 * hr.next()), w: 0.012 + hr.next() * 0.008, twist: (hr.next() - 0.5) * 0.8, c: 0.55 + 0.5 * hr.next() };
  });
  g.add(Object.assign(new THREE.Mesh(hairCards(cards, { segs: 4, gravity: 0.8, curl: 0.15 }), mats.hair), { name: 'stagMane' }));
  g.traverse((o) => { if (o.isMesh && /Mane/.test(o.name)) o.userData.keep = true; });
  g.userData.focus = V3(0, 0.25, 0.3);
  return g;
}
