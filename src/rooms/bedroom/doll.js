import * as THREE from 'three';
import { sdfGeometry, sdEllipsoid, sdSphere, sdCapsule, sdRoundCone, smin, smax, ssub, clamp } from '../../engine/lib/contrib/bedroom-sdf.js';

/**
 * Antique bisque dolls, sculpted (signed-distance heads polygonised with surface nets):
 * a heavy cranium over a small, plump lower face, a pinched chin, a ridge of brow over deep
 * sockets that hold real glass eyes under heavy porcelain lids, a button nose with nostrils,
 * a parted rosebud mouth, small ears. Hair is a sculpted mass with combed strand grooves and a
 * centre parting, with corkscrew ringlets; bonnets are brimmed silk half-shells that wrap the
 * skull, edged with a goffered frill. Grime settles in every crease (baked cavity term in the
 * vertex colours, used by the room's porcelain material).
 */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// all head shapes are in units of the head radius, face toward +z
function headSDF(v) {
  // four faces: round baby, long-faced girl, heavy-browed, pinched little mouth
  const chub = [0.28, 0.24, 0.33, 0.27][v], jaw = [0.7, 0.64, 0.74, 0.66][v];
  const crH = [0.98, 1.04, 0.95, 1.0][v], crW = [0.92, 0.88, 0.96, 0.9][v];
  const chinY = [0.72, 0.8, 0.7, 0.76][v], nose = [1.0, 0.85, 1.15, 0.9][v];
  return (x, y, z) => {
    const ax = Math.abs(x);
    let d = sdEllipsoid(x, y - 0.08, z + 0.05, crW, crH, 0.97);                             // cranium
    d = smin(d, sdEllipsoid(x, y + 0.28, z - 0.12, jaw, 0.72, 0.78), 0.3);                  // lower face
    d = smin(d, sdSphere(x, y + chinY, z - 0.46, 0.22), 0.26);                               // chin
    d = smin(d, sdSphere(ax - 0.4, y + 0.3, z - 0.5, chub), 0.25);                           // plump cheeks
    d = smin(d, sdCapsule(x, y, z, [-0.4, 0.16, 0.74], [0.4, 0.16, 0.74], 0.12), 0.22);     // brow ridge
    d = ssub(d, sdEllipsoid(ax - 0.32, y - 0.0, z - 0.92, 0.2, 0.16, 0.22), 0.07);           // eye sockets
    // heavy upper lids: the top of a shell round each eyeball, cut off at a slanting lid line
    const lid = smax(sdSphere(ax - 0.32, y + 0.01, z - 0.665, 0.185), -(0.0 - y + (z - 0.8) * 0.2 - (ax - 0.32) * 0.12), 0.02);
    d = smin(d, lid, 0.03);
    // lower lid rim
    d = smin(d, sdCapsule(x, y, z, [Math.sign(x) * 0.2, -0.15, 0.82], [Math.sign(x) * 0.45, -0.13, 0.78], 0.035), 0.05);
    d = smin(d, sdRoundCone(x, y, z, [0, -0.02, 0.88], [0, -0.22, 0.98], 0.06 * nose, 0.105 * nose), 0.09);  // button nose
    d = ssub(d, sdSphere(ax - 0.05, y + 0.25, z - 0.985, 0.028), 0.02);                      // nostrils
    d = smin(d, sdEllipsoid(x, y + 0.4, z - 0.87, 0.16, 0.055, 0.08), 0.05);                 // upper lip (cupid's bow)
    d = smin(d, sdEllipsoid(x, y + 0.49, z - 0.85, 0.12, 0.05, 0.07), 0.045);                // lower lip
    d = ssub(d, sdEllipsoid(x, y + 0.445, z - 0.93, 0.095, 0.011, 0.09), 0.012);              // parted mouth
    d = ssub(d, sdEllipsoid(x, y + 0.31, z - 0.95, 0.025, 0.07, 0.03), 0.03);                // philtrum
    d = smin(d, sdEllipsoid(ax - 0.88, y + 0.12, z - 0.0, 0.09, 0.19, 0.13), 0.08);          // ears
    d = smin(d, sdCapsule(x, y, z, [0, -0.6, -0.08], [0, -1.3, -0.08], 0.3), 0.14);          // neck
    return Math.max(d, -1.2 - y);
  };
}
// sculpted hair mass: a shell over the cranium, hairline round the face, combed grooves, centre parting
function hairSDF(v) {
  return (x, y, z) => {
    const ax = Math.abs(x);
    let d = sdEllipsoid(x, y - 0.12, z + 0.1, 1.0, 1.05, 1.03);
    // hang lower at the back and sides
    d = smin(d, sdEllipsoid(x, y + 0.25, z + 0.38, 0.86, 0.75, 0.62), 0.25);
    const a = Math.abs(Math.atan2(x, z));                       // 0 front .. pi back
    const hl = 0.42 - 1.25 * THREE.MathUtils.smoothstep(a, 0.55, 2.3) - (v % 2 ? 0.08 : 0);
    d = smax(d, hl - y, 0.08);
    // keep it off the face: carve away anything in front of the forehead
    d = smax(d, -sdEllipsoid(x, y + 0.1, z - 0.2, 0.8, 0.74, 0.9), 0.05);
    // a little fringe of bangs on the forehead (alternate dolls)
    if (v % 3 === 0) d = smin(d, sdEllipsoid(x, y - 0.42, z - 0.72, 0.5, 0.16, 0.2), 0.08);
    // combed strand grooves running from the crown, and the centre parting
    const phi = Math.atan2(x, z + 0.1);
    d += 0.012 * Math.pow(1 - Math.abs(Math.sin(phi * 13 + y * 1.5)), 3) + 0.004 * Math.abs(Math.sin(phi * 47));
    d += 0.04 * Math.exp(-(x * x) / 0.0015) * clamp((y - 0.4) / 0.3, 0, 1) * clamp(z + 0.3, 0, 1);
    return d;
  };
}
// poke bonnet: a silk shell round the back of the skull, and a deep brim that runs forward from the
// face opening like a hood, flaring as it goes, framing the brow and cheeks (open under the chin),
// its lip edged with a goffered ruffle. Not a flat ring: seen from the side it projects past the face.
function bonnetSDF(back) {
  // the face opening plane: n·p = c  (tilted back when the bonnet has slipped off the crown)
  let ny = back ? 0.62 : 0.32, nz = back ? 0.78 : 0.95;
  const nl = Math.hypot(ny, nz); ny /= nl; nz /= nl;
  const c = back ? 0.18 : 0.34;
  const t0 = c - (ny * 0.12 + nz * -0.08);
  const cy = 0.12 + ny * t0, cz = -0.08 + nz * t0;          // centre of the opening
  const L = back ? 0.3 : 0.42;
  return (x, y, z) => {
    const pv = y * ny + z * nz - c;
    const e = sdEllipsoid(x, y - 0.12, z + 0.08, 1.12, 1.16, 1.12);
    let d = Math.abs(e) - 0.035;
    d = smax(d, pv, 0.02);
    // brim, in the opening's frame: w forward along n, (rx, ru) across it
    const w = pv;
    const ry = y - cy - ny * w, rz = z - cz - nz * w;
    const ru = ry * nz - rz * ny;                              // 'up' across the opening
    const rad = Math.hypot(x, ru);
    const a = Math.atan2(ru, x);                               // pi/2 = top of the face
    const sa = Math.sin(a);
    const len = L * (0.45 + 0.55 * clamp((sa + 0.3) / 1.0, 0, 1));        // deepest over the brow
    const lipK = clamp((w - (len - 0.14)) / 0.14, 0, 1);
    const R = 1.08 + 0.42 * w + 0.05 * lipK * Math.sin(a * 22) + 0.03 * lipK * lipK;
    let brim = Math.abs(rad - R) - (0.028 + 0.012 * lipK);
    brim = smax(brim, Math.max(-w - 0.02, w - len), 0.02);
    brim = smax(brim, -(sa + 0.42) * 0.35, 0.03);              // open under the chin
    d = smin(d, brim, 0.03);
    // gathered crown seam at the back + a bow of silk over it
    d = smin(d, sdSphere(x, y - 0.25, z + 1.12, 0.12), 0.06);
    return Math.max(d, -0.95 - y);
  };
}

const geoCache = new Map();
const cached = (k, fn) => { if (!geoCache.has(k)) geoCache.set(k, fn()); return geoCache.get(k); };

function ringletGeo() {
  return cached('ringlet', () => {
    const pts = [];
    for (let i = 0; i <= 64; i++) { const t = i / 64; const a = t * Math.PI * 2 * 3.2; const r = 0.07 * (1 - t * 0.35); pts.push(V3(Math.cos(a) * r, -t * 0.62, Math.sin(a) * r)); }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.048, 10, false);
    // taper the tip
    const c = new Float32Array(g.attributes.position.count * 3);
    const uv = g.attributes.uv;
    // the inside of each coil is in shadow
    for (let i = 0; i < uv.count; i++) { const k = 0.55 + 0.45 * Math.max(0, Math.sin(uv.getY(i) * Math.PI * 2)); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  });
}

/** sculpted skirt: a lathe with deep irregular folds, sagging, ruffled hem */
function skirtGeo(s, seed) {
  const prof = [[0, 0.012], [0.118, 0.012], [0.12, 0.022], [0.11, 0.05], [0.09, 0.08], [0.066, 0.108], [0.047, 0.128], [0.0, 0.13]].map(([r, y]) => new THREE.Vector2(r * s, y * s));
  const g = new THREE.LatheGeometry(prof, 96);
  const p = g.attributes.position;
  const rnd = (i) => { const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };
  const ph = [rnd(1) * 6.28, rnd(2) * 6.28, rnd(3) * 6.28];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z); if (r < 1e-5) continue;
    const a = Math.atan2(z, x);
    const k = 1 - Math.min(1, Math.max(0, (y / s - 0.012) / 0.11));            // 1 at hem .. 0 at waist
    // big soft folds (irregular), small crushed folds near the hem, a sag where it drapes
    const fold = 0.08 * Math.sin(a * 7 + ph[0] + Math.sin(a * 3 + ph[1]) * 0.8) + 0.04 * Math.sin(a * 13 + ph[2]) + 0.02 * Math.sin(a * 29 + y * 300);
    const f = 1 + fold * Math.pow(k, 0.8);
    p.setX(i, x * f); p.setZ(i, z * f);
    p.setY(i, y - k * k * 0.004 * s * (1 + Math.sin(a * 5 + ph[1])));
  }
  g.computeVertexNormals();
  return g;
}

/** goffered frill ring (lace petticoat edge / collar): uv v runs from the lace's solid band (inner) to its scallops */
function frill(rIn, rOut, { n = 14, drop = 0.3, seg = 96, lace = false } = {}) {
  const g = new THREE.RingGeometry(rIn, rOut, seg, 3);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    const t = (r - rIn) / (rOut - rIn);
    const zz = -t * (rOut - rIn) * drop + Math.sin(a * n) * t * (rOut - rIn) * 0.22;
    p.setXYZ(i, Math.cos(a) * r, zz, Math.sin(a) * r);
    uv.setXY(i, (a / (Math.PI * 2) + 0.5) * n * 0.5, lace ? 1 - t * 0.52 : t);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Seated bisque doll. Local: sitting on y = 0, facing +Z. size ≈ height of the seated doll.
 * Options: pose 'lap' | 'reach' | 'limp'; headYaw / tilt (radians); bonnet; cracked face.
 * userData.gazeAt(worldPoint, headAmount = 0.6): turn the head part-way and both glass eyes
 * fully toward a point (call after the doll is placed in the scene graph).
 */
export function buildDoll(ctx, mats, { size = 0.3, seed = 0, dress = 0xb08080, hair = 0x3a2010, cracked = false, eyes = '#3a5a8a', bonnet = false, bonnetBack = false, tilt = 0, headYaw = 0, pose = 'lap', lace = true } = {}) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'doll';
  const s = size / 0.3;
  const S = (pts) => pts.map(([r, y]) => [r * s, y * s]);
  const add = (geo, m, x = 0, y = 0, z = 0, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const dressM = mats.dollVelvet(dress);
  const hairM = mats.dollHair(hair);
  const face = mats.dollFace({ seed, cracked, eyes, hair: `#${new THREE.Color(hair).getHexString()}` });
  const v = seed % 4;
  // lace petticoat edge lying out on the shelf from under the hem
  const pet = add(frill(0.105 * s, 0.14 * s, { n: 30, drop: 0.12, lace: true }), mats.laceFrill, 0, 0.006 * s, 0.004 * s);
  pet.scale.set(1, 1, 1.12);
  const sk = add(skirtGeo(s, seed), dressM); sk.scale.set(1, 1, 1.15);
  // sash at the waist with a drooping bow at the back
  const sash = add(new THREE.TorusGeometry(0.047 * s, 0.009 * s, 8, 32), mats.dollSash, 0, 0.128 * s, 0); sash.rotation.x = Math.PI / 2; sash.scale.set(1, 1.12, 0.8);
  for (const sx of [-1, 1]) {
    const loop = add(new THREE.SphereGeometry(0.02 * s, 12, 8), mats.dollSash, sx * 0.018 * s, 0.13 * s, -0.056 * s); loop.scale.set(1.1, 0.7, 0.35);
    const tail = add(new THREE.BoxGeometry(0.014 * s, 0.07 * s, 0.003 * s), mats.dollSash, sx * 0.012 * s, 0.095 * s, -0.058 * s); tail.rotation.z = sx * 0.2;
  }
  // bodice
  add(G.latheFromProfile(S([[0.0, 0.12], [0.047, 0.12], [0.051, 0.145], [0.047, 0.18], [0.035, 0.2], [0.019, 0.208], [0.0, 0.21]]), 32), dressM);
  for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.0035 * s, 8, 6), mats.pearl, 0, (0.142 + i * 0.016) * s, 0.049 * s - i * 0.0035 * s);
  if (lace) { const col = add(frill(0.018 * s, 0.05 * s, { n: 16, drop: 0.45, lace: true }), mats.laceFrill, 0, 0.207 * s, 0); col.rotation.y = seed; }
  // legs: stockings + strapped shoes
  for (const sx of [-1, 1]) {
    const leg = add(new THREE.CapsuleGeometry(0.0145 * s, 0.085 * s, 4, 12), mats.stocking, sx * 0.034 * s, 0.02 * s, 0.1 * s); leg.rotation.x = Math.PI / 2 - 0.12;
    const shoe = add(new THREE.SphereGeometry(0.015 * s, 16, 10), mats.shoe, sx * 0.034 * s, 0.022 * s, 0.155 * s); shoe.scale.set(0.95, 0.8, 1.5);
    const strap = add(new THREE.TorusGeometry(0.0125 * s, 0.002 * s, 5, 16), mats.shoe, sx * 0.034 * s, 0.025 * s, 0.146 * s); strap.rotation.y = Math.PI / 2;
  }
  // arms
  const arms = { lap: [0.95, 0.0, 0.35], reach: [1.45, 0.0, 0.18], limp: [0.15, 0.0, 0.12] }[pose] || [0.95, 0, 0.35];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.05 * s, 0.19 * s, 0); g.add(sh);
    sh.rotation.set(arms[0] + (pose === 'limp' && sx > 0 ? 0.25 : 0), 0, sx * arms[2]);
    const puff = add(skirtPuff(s), dressM, 0, -0.012 * s, 0, sh); void puff;
    add(new THREE.CapsuleGeometry(0.0105 * s, 0.045 * s, 4, 12), face.skin, 0, -0.06 * s, 0, sh);
    const hand = add(new THREE.SphereGeometry(0.0125 * s, 14, 10), face.skin, 0, -0.093 * s, 0.003 * s, sh); hand.scale.set(0.8, 1.15, 0.55);
    const thumb = add(new THREE.CapsuleGeometry(0.0035 * s, 0.008 * s, 3, 6), face.skin, sx * -0.008 * s, -0.088 * s, 0.006 * s, sh); thumb.rotation.z = sx * 0.6;
  }
  // ---- head
  const head = new THREE.Group(); head.position.set(0, 0.268 * s, 0); head.rotation.set(0.04, headYaw, tilt); g.add(head);
  const hr = 0.06 * s;
  const hv = (seed * 3 + 1) % 4;
  const headG = cached(`head${hv}`, () => sdfGeometry(headSDF(hv), { min: [-1.1, -1.25, -1.15], max: [1.1, 1.15, 1.15], step: 0.034, project: 4, ao: 0.22, aoStrength: 1.0, uv: 'sphere' }));
  const hm = add(headG, face.mat, 0, 0, 0, head); hm.scale.setScalar(hr);
  const eyesM = [];
  for (const sx of [-1, 1]) {
    const e = add(cached('eyeball', () => new THREE.SphereGeometry(0.158, 32, 20)), face.glass, sx * 0.32 * hr, -0.01 * hr, 0.665 * hr, head);
    e.scale.setScalar(hr);
    eyesM.push(e);
  }
  // hair: sculpted mass + corkscrew ringlets
  {
    const hg = cached(`hair${v}`, () => sdfGeometry(hairSDF(v), { min: [-1.15, -1.0, -1.25], max: [1.15, 1.3, 1.1], step: 0.03, project: 3, ao: 0.15, aoStrength: 0.9, uv: 'planar', uvScale: 0.25 }));
    add(hg, hairM, 0, 0, 0, head).scale.setScalar(hr);
  }
  const nRing = bonnet ? 5 : 8;
  for (let i = 0; i < nRing; i++) {
    const a = Math.PI * 0.62 + (i / (nRing - 1)) * Math.PI * 0.76;
    const r = add(ringletGeo(), hairM, Math.cos(a) * hr * 0.74, -0.25 * hr - (i % 3) * 0.05 * hr, -Math.sin(a) * hr * 0.6 - 0.2 * hr, head);
    r.scale.setScalar(hr * (0.7 + ((i * 7) % 3) * 0.08)); r.rotation.set(Math.sin(a) * 0.2, i * 1.3, Math.cos(a) * 0.25);
  }
  if (bonnet) {
    const bg = cached(`bonnet${bonnetBack ? 'b' : ''}`, () => sdfGeometry(bonnetSDF(bonnetBack), { min: [-1.7, -1.0, -1.6], max: [1.7, 1.85, 1.75], step: 0.03, project: 3, ao: 0.2, aoStrength: 0.8, uv: 'planar', uvScale: 0.25 }));
    add(bg, mats.dollBonnet ? mats.dollBonnet(dress) : dressM, 0, 0, 0, head).scale.setScalar(hr);
    // ribbon ties hanging under the chin
    for (const sx of [-1, 1]) {
      const pts = [V3(sx * 0.8, -0.2, 0.25), V3(sx * 0.5, -0.85, 0.55), V3(sx * 0.15, -1.05, 0.62), V3(sx * 0.25, -1.6, 0.6)].map((q) => q.multiplyScalar(hr));
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.045 * hr, 6, false), mats.dollSash, 0, 0, 0, head).scale.set(1, 1, 0.6);
    }
  }
  g.userData.head = head;
  g.userData.gazeAt = (world, amount = 0.6) => {
    g.updateWorldMatrix(true, true);
    const lp = head.parent.worldToLocal(world.clone());
    const yaw = Math.atan2(lp.x - head.position.x, lp.z - head.position.z);
    head.rotation.y = clamp(yaw * amount, -0.9, 0.9);
    head.updateWorldMatrix(false, true);
    for (const e of eyesM) e.lookAt(world);
  };
  return g;
}

function skirtPuff(s) {
  return cached(`puff${s.toFixed(3)}`, () => {
    const g = new THREE.SphereGeometry(0.022 * s, 18, 12);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = 1 + 0.08 * Math.sin(a * 8) * (1 - Math.abs(y) / (0.022 * s)); p.setXYZ(i, x * k, y * 1.15, z * k); }
    g.computeVertexNormals();
    return g;
  });
}
