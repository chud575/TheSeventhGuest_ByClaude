import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { dollFaceTexture, dappleTexture, dollCrackBump } from './textures.js';

/**
 * Stauf's toys, modelled properly: porcelain dolls with painted faces and pleated
 * cloth dresses, a carved dapple-grey rocking horse on bow rockers, a jointed
 * marionette, a jack-in-the-box with a crank, the model of the mansion with its
 * roofs, chimneys, porch and glowing windows, a music box, paint pots, screws and
 * a half-assembled puzzle box. Every builder returns a Group whose origin sits on
 * the surface it stands on.
 */

const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const mesh = (g, m) => new THREE.Mesh(g, m);
const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(Math.max(r, 1e-4), y)), seg);
const G2 = { RoundedBoxGeometry };
const rbox = (w, h, d, r = 0.004, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.01, h / 2.01, d / 2.01));

/** tapered tube through points with a radius per point */
export function taperTube(points, radii, seg = 8, tubular = 20) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, tubular, 1, seg, false);
  const p = g.attributes.position, nrm = g.attributes.normal;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const k = t * (radii.length - 1), i0 = Math.floor(k), i1 = Math.min(radii.length - 1, i0 + 1);
    const r = THREE.MathUtils.lerp(radii[i0], radii[i1], k - i0);
    curve.getPointAt(t, c);
    for (let j = 0; j <= seg; j++) { const idx = i * (seg + 1) + j; v.fromBufferAttribute(nrm, idx); p.setXYZ(idx, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r); }
  }
  g.computeVertexNormals();
  return g;
}

/** helix ringlet hanging down from `top` */
function ringlet(top, len, r, seed) {
  const pts = [];
  for (let i = 0; i <= 18; i++) { const t = i / 18; const a = t * Math.PI * 2 * 3.2 + seed; pts.push(V3(top.x + Math.cos(a) * r * (1 - 0.3 * t), top.y - t * len, top.z + Math.sin(a) * r * (1 - 0.3 * t))); }
  return taperTube(pts, [0.0045, 0.0042, 0.0035, 0.002], 5, 54);
}

/** pleated lathe skirt: radial pleats growing toward the hem, wavy hem line */
function skirtGeometry(profile, { pleats = 14, amp = 0.08, seed = 0, hemY = 0, topY = 1 } = {}) {
  const g = lathe(profile, 72);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 - THREE.MathUtils.clamp((y - hemY) / (topY - hemY), 0, 1);
    const pl = Math.sin(a * pleats + seed) * 0.7 + Math.sin(a * pleats * 2.3 + seed * 1.7) * 0.3;
    const s = 1 + amp * pl * k;
    p.setXYZ(i, x * s, y + Math.sin(a * 5 + seed) * 0.004 * k, z * s);
  }
  g.computeVertexNormals();
  return g;
}

// ====================================================================== porcelain doll
/** bisque head: a sphere sculpted to a doll's face (high round brow, plump cheeks, small chin, button nose), +z = face */
function dollHeadGeometry(R) {
  const g = new THREE.SphereGeometry(R, 48, 36);
  const p = g.attributes.position;
  const ga = (x, w) => Math.exp(-(x * x) / (w * w));
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) / R, y = p.getY(i) / R, z = p.getZ(i) / R;
    const f = Math.max(0, z), ax = Math.abs(x), sx = Math.sign(x) || 1;
    y *= 1.04; x *= 0.95;
    // lower face narrows into a small rounded chin, the chin a touch forward
    if (y < -0.1) { const k = (-y - 0.1) / 0.94; x *= 1 - 0.28 * k * k; z *= 1 - 0.18 * k * k; z += f * 0.1 * k * ga(x, 0.3); y -= 0.06 * k * k * f; }
    // plump cheeks
    z += 0.09 * f * ga(y + 0.28, 0.2) * ga(ax - 0.42, 0.22);
    x += sx * 0.05 * ga(y + 0.25, 0.25) * ga(z - 0.5, 0.4);
    // eye hollows, a little button nose, the philtrum and lips
    z -= 0.05 * f * ga(y - 0.05, 0.1) * ga(ax - 0.33, 0.13);
    z += 0.07 * f * ga(y + 0.17, 0.08) * ga(x, 0.1);
    z += 0.03 * f * ga(y + 0.42, 0.05) * ga(x, 0.13);
    // flat-ish back of the head where the wig is glued
    z -= 0.06 * Math.max(0, -z) * ga(y - 0.2, 0.5);
    p.setXYZ(i, x * R, y * R, z * R);
  }
  g.computeVertexNormals();
  return g;
}

/** scalloped lace band (open cylinder, the bottom edge scalloped), alpha-tested lace pattern */
function laceBand(forge, r, h, scallops = 28) {
  const tex = forge.canvas('attic:lace', 512, 64, (g, w, hh) => {
    g.clearRect(0, 0, w, hh);
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, hh * 0.18);
    const n = 16, cw = w / n;
    for (let i = 0; i < n; i++) {
      const x = i * cw;
      g.beginPath(); g.arc(x + cw / 2, hh * 0.18, cw * 0.5, 0, Math.PI); g.lineTo(x, hh * 0.18); g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(x + cw / 2, hh * 0.38, cw * 0.17, 0, Math.PI * 2); g.fill();
      for (const k of [-1, 1]) { g.beginPath(); g.arc(x + cw / 2 + k * cw * 0.3, hh * 0.28, cw * 0.07, 0, Math.PI * 2); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      g.beginPath(); g.arc(x + cw / 2, hh * 0.6, cw * 0.1, 0, Math.PI * 2); g.fill();
    }
  }, { tile: true });
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(scallops / 16, 1);
  const g = new THREE.CylinderGeometry(r, r * 1.04, h, 96, 1, true);
  return { geo: g, tex };
}

/** A porcelain doll sitting with legs out. ~0.27 m tall seated. Origin = seat on the shelf. */
export function buildDoll(ctx, m, { dress, trim, seed = 1, eye = '#2a3a5a', lip = '#9a2a2a', hair } = {}) {
  const g = new THREE.Group(); g.name = 'doll';
  const D = dress || m.toyBlue;
  const T = trim || m.lace;
  const H = hair || m.hair;
  const faceTex = dollFaceTexture(ctx.textures, { key: `doll${seed}`, eye, lip, seed });
  const bump = dollCrackBump(ctx.textures, { key: `doll${seed}`, seed });
  const face = new THREE.MeshPhysicalMaterial({ map: faceTex, bumpMap: bump, bumpScale: 1.5, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 0.7, name: `dollFace${seed}` });
  // bisque limbs share a duller, dustier porcelain
  const bisque = new THREE.MeshPhysicalMaterial({ color: 0xe6dccd, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3, name: 'dollBisque' });
  const dusty = (mt) => { mt.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  { float up = clamp(normalize(vNormal).y, 0.0, 1.0); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.39, 0.35), up * up * 0.35); }'); }; mt.customProgramCacheKey = () => 'dollDust'; return mt; };
  dusty(bisque);
  // pleated skirt (hem lifted clear of the shelf) + petticoat + scalloped lace hem
  const HEM = 0.012;
  g.add(mesh(skirtGeometry([[0.0, HEM], [0.082, HEM], [0.086, HEM + 0.008], [0.078, 0.034], [0.06, 0.072], [0.042, 0.1], [0.03, 0.115], [0, 0.116]], { pleats: 13, amp: 0.1, seed, hemY: HEM, topY: 0.116 }), D));
  g.add(mesh(skirtGeometry([[0.0, HEM - 0.004], [0.08, HEM - 0.004], [0.083, HEM + 0.006], [0.07, 0.04], [0, 0.04]], { pleats: 19, amp: 0.12, seed: seed + 5, hemY: HEM - 0.004, topY: 0.04 }), T));
  { const lb = laceBand(ctx.textures, 0.087, 0.014); const lm = new THREE.MeshStandardMaterial({ color: 0xd8cfbb, roughness: 0.85, alphaMap: lb.tex, alphaTest: 0.5, side: THREE.DoubleSide, name: 'lace' });
    const band = mesh(lb.geo, lm); band.position.y = HEM + 0.001; g.add(band);
    { const pp = lb.geo.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i); const a = Math.atan2(z, x); const k = 1 + 0.1 * (Math.sin(a * 13 + seed) * 0.7 + Math.sin(a * 13 * 2.3 + seed * 1.7) * 0.3); pp.setX(i, x * k); pp.setZ(i, z * k); } lb.geo.computeVertexNormals(); } }
  // bodice, sash, lace collar
  g.add(mesh(lathe([[0, 0.11], [0.033, 0.11], [0.03, 0.13], [0.032, 0.15], [0.027, 0.166], [0.012, 0.172], [0, 0.173]], 28), D));
  g.add(at(mesh(new THREE.TorusGeometry(0.032, 0.006, 6, 28), m.sash || T), 0, 0.118, 0).rotateX(Math.PI / 2));
  { const bow = mesh(new THREE.SphereGeometry(0.012, 10, 8), m.sash || T); bow.scale.set(1.6, 0.8, 0.5); at(bow, 0, 0.118, -0.034); g.add(bow);
    for (const k of [-1, 1]) g.add(mesh(taperTube([V3(k * 0.004, 0.115, -0.036), V3(k * 0.012, 0.09, -0.042), V3(k * 0.016, 0.06, -0.05)], [0.004, 0.0035, 0.003], 4, 8), m.sash || T)); }
  g.add(at(mesh(skirtGeometry([[0.012, 0.172], [0.03, 0.168], [0.04, 0.158], [0.042, 0.155]], { pleats: 20, amp: 0.12, seed: seed + 2, hemY: 0.155, topY: 0.172 }), T), 0, 0, 0));
  // puffed sleeves, tapered bisque arms with a wrist, mitten hands with a separate thumb
  for (const s of [-1, 1]) {
    const puff = mesh(new THREE.SphereGeometry(0.019, 14, 10), D); puff.scale.set(1, 1.15, 1); at(puff, s * 0.038, 0.152, 0); g.add(puff);
    const sh = V3(s * 0.045, 0.142, 0.0), el = V3(s * 0.051, 0.112, 0.016), wr = V3(s * 0.044, 0.09, 0.038);
    g.add(mesh(taperTube([sh, el, wr.clone().lerp(el, 0.15), wr], [0.0088, 0.0074, 0.0056, 0.0049], 10, 16), bisque));
    const hand = new THREE.Group(); hand.position.copy(wr); g.add(hand);
    hand.lookAt(wr.clone().add(wr.clone().sub(el)));
    const mitt = mesh(new THREE.SphereGeometry(0.0085, 14, 10), bisque); mitt.scale.set(0.95, 0.55, 1.35); mitt.position.z = 0.009; hand.add(mitt);
    const th = mesh(new THREE.CapsuleGeometry(0.0028, 0.006, 3, 8), bisque); th.position.set(-s * 0.006, 0.0, 0.006); th.rotation.set(Math.PI / 2, 0, s * 0.7); hand.add(th);
    // legs: stockinged, bent at the knee, ending in molded button boots that sit flat on the shelf
    const hip = V3(s * 0.022, 0.03, 0.02), knee = V3(s * 0.026, 0.03, 0.075), ank = V3(s * 0.028, 0.016, 0.118);
    g.add(mesh(taperTube([hip, hip.clone().lerp(knee, 0.5).add(V3(0, 0.004, 0)), knee, knee.clone().lerp(ank, 0.5), ank], [0.0135, 0.012, 0.0108, 0.0092, 0.0078], 10, 18), m.stocking || m.toyWhite));
    // boot: lathed ankle shaft + a lofted foot with toe spring
    const boot = new THREE.Group(); boot.position.set(ank.x, 0, ank.z); g.add(boot);
    boot.add(at(mesh(lathe([[0.0, 0], [0.0098, 0], [0.0098, 0.022], [0.0085, 0.028], [0, 0.028]], 16), m.toyBlack), 0, 0.006, 0));
    const ft = mesh(new THREE.SphereGeometry(0.011, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), m.toyBlack); ft.scale.set(0.85, 0.9, 1.9); ft.position.set(0, 0.002, 0.009); boot.add(ft);
    boot.add(at(mesh(new G2.RoundedBoxGeometry(0.019, 0.004, 0.044, 1, 0.0015), m.leatherStrap || m.toyBlack), 0, 0.002, 0.008));
    for (let k = 0; k < 3; k++) boot.add(at(mesh(new THREE.SphereGeometry(0.0013, 6, 4), m.brass), s * 0.0085, 0.012 + k * 0.006, 0.004));
  }
  // neck, head with painted face
  g.add(at(mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.02, 12), bisque), 0, 0.18, 0));
  const head = mesh(dollHeadGeometry(0.037), face); at(head, 0, 0.215, 0.003); g.add(head);
  // a glued-on wig: centre-parted, waved bands sweeping back over a sculpted cap, ringlets all round the back, a fringe of curls
  const cap = new THREE.SphereGeometry(0.0405, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.56);
  { const pp = cap.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i); const a = Math.atan2(x, z); const wv = 1 + 0.035 * Math.sin(a * 22) * Math.min(1, (0.04 - y) / 0.02) - 0.03 * Math.exp(-(x * x) / 0.00002) * Math.max(0, z / 0.04); pp.setXYZ(i, x * wv, y, z * wv); } cap.computeVertexNormals(); }
  const capM = mesh(cap, H); capM.scale.set(1.0, 1.08, 1.04); at(capM, 0, 0.217, -0.004); capM.rotation.x = -0.18; g.add(capM);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const y0 = 0.236 - k * 0.006;
    g.add(mesh(taperTube([V3(s * 0.004, y0 + 0.016, 0.03), V3(s * 0.024, y0 + 0.006, 0.026 - k * 0.003), V3(s * 0.038, y0 - 0.012, 0.006 - k * 0.004), V3(s * 0.036, y0 - 0.03, -0.014)], [0.0042, 0.005, 0.0045, 0.003], 6, 14), H));
  }
  for (let k = 0; k < 15; k++) {
    const a = Math.PI * (0.32 + k * (1.36 / 14));
    g.add(mesh(ringlet(V3(Math.cos(a) * 0.034, 0.212, -Math.abs(Math.sin(a)) * 0.026 - 0.004), 0.055 + (k % 3) * 0.012, 0.0062, seed + k), H));
  }
  for (let k = 0; k < 5; k++) { const cu = mesh(new THREE.TorusGeometry(0.0045, 0.0022, 5, 10), H); cu.position.set(-0.016 + k * 0.008, 0.245, 0.03); cu.rotation.set(0.2, 0, k); g.add(cu); }
  for (const s of [-1, 1]) { const b = mesh(new THREE.SphereGeometry(0.014, 10, 8), m.bow || D); b.scale.set(1.2, 0.7, 0.45); at(b, s * 0.016, 0.257, -0.012); b.rotation.z = s * 0.4; g.add(b); }
  return g;
}

// ====================================================================== rocking horse
function smoothShape(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); s.splineThru(pts.slice(1).map(([x, y]) => V2(x, y))); s.closePath(); return s; }
function carved(shape, depth, bevel, G, uv = 3) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 5, curveSegments: 48, steps: 1 });
  g.translate(0, 0, -depth / 2);
  return G.applyBoxUVs(g, uv);
}
/** carved dapple-grey rocking horse on bow rockers, x forward. */
export function buildRockingHorse(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'rockingHorse';
  const dt = dappleTexture(ctx.textures).withRepeat(1.3, 1.0);
  const dapple = new THREE.MeshPhysicalMaterial({ map: dt.map, normalMap: dt.normalMap, roughnessMap: dt.ormMap, roughness: 1, clearcoat: 0.5, clearcoatRoughness: 0.35, envMapIntensity: 0.6, name: 'dapple' });
  const legMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2624, roughness: 0.45, clearcoat: 0.4, name: 'horseLegs' });
  // body, neck and head carved as one lofted form: elliptical sections along a spine curve (chest deep, belly
  // tucked, rump rounded; an arched crest; a long head tapering to a squared muzzle), each section tilted to the spine
  const loftSpine = (secs, seg = 28) => {
    const pos = [], uv = [], idx = [];
    const n = secs.length;
    for (let i = 0; i < n; i++) {
      const S = secs[i];
      const P = S.p, prev = secs[Math.max(0, i - 1)].p, next = secs[Math.min(n - 1, i + 1)].p;
      const T = next.clone().sub(prev).normalize();
      const side = V3(0, 0, 1);
      const up = side.clone().cross(T).normalize();
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        const c = Math.cos(a), sn = Math.sin(a);
        // squarer bottom on the barrel (sn < 0), keel under the chest
        const sq = S.sq || 0;
        const ry = S.h * (sn >= 0 ? 1 : 1 + sq * 0.15 * (1 - Math.abs(c)));
        const q = P.clone().addScaledVector(up, sn * ry + (S.dy || 0)).addScaledVector(side, c * S.w * (1 - (S.taper || 0) * Math.max(0, sn)));
        pos.push(q.x, q.y, q.z); uv.push(i / (n - 1), j / seg);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    // caps
    for (const [i, flip] of [[0, true], [n - 1, false]]) {
      const ci = pos.length / 3; const P = secs[i].p; pos.push(P.x, P.y + (secs[i].dy || 0), P.z); uv.push(i / (n - 1), 0.5);
      for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j; flip ? idx.push(ci, a, a + 1) : idx.push(ci, a + 1, a); }
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeVertexNormals();
    return gg;
  };
  // barrel: rump (x -0.42) to chest (x 0.3)
  g.add(mesh(loftSpine([
    { p: V3(-0.45, 0.62, 0), h: 0.02, w: 0.02 },
    { p: V3(-0.435, 0.625, 0), h: 0.07, w: 0.065 },
    { p: V3(-0.4, 0.63, 0), h: 0.105, w: 0.098 },
    { p: V3(-0.33, 0.632, 0), h: 0.125, w: 0.112, sq: 0.4 },
    { p: V3(-0.22, 0.62, 0), h: 0.122, w: 0.104, sq: 0.6, dy: -0.004 },
    { p: V3(-0.08, 0.612, 0), h: 0.118, w: 0.1, sq: 0.6, dy: -0.01 },
    { p: V3(0.06, 0.615, 0), h: 0.126, w: 0.104, sq: 0.8, dy: -0.012 },
    { p: V3(0.18, 0.63, 0), h: 0.132, w: 0.106, sq: 1.0, dy: -0.016 },
    { p: V3(0.27, 0.65, 0), h: 0.12, w: 0.095, sq: 0.8, dy: -0.01 },
    { p: V3(0.32, 0.67, 0), h: 0.08, w: 0.07 },
    { p: V3(0.34, 0.69, 0), h: 0.02, w: 0.02 },
  ], 32), dapple));
  // neck: an arched crest rising from the withers, narrowing to the throat
  g.add(mesh(loftSpine([
    { p: V3(0.14, 0.66, 0), h: 0.1, w: 0.075 },
    { p: V3(0.21, 0.74, 0), h: 0.095, w: 0.066, taper: 0.25 },
    { p: V3(0.27, 0.83, 0), h: 0.085, w: 0.058, taper: 0.35 },
    { p: V3(0.315, 0.92, 0), h: 0.074, w: 0.05, taper: 0.4 },
    { p: V3(0.34, 0.99, 0), h: 0.064, w: 0.046, taper: 0.4 },
    { p: V3(0.35, 1.03, 0), h: 0.04, w: 0.04 },
  ], 28), dapple));
  // head: poll -> forehead -> long nasal bone -> squared muzzle, with a jowl under the cheek
  g.add(mesh(loftSpine([
    { p: V3(0.32, 1.035, 0), h: 0.02, w: 0.02 },
    { p: V3(0.335, 1.03, 0), h: 0.05, w: 0.042 },
    { p: V3(0.37, 1.005, 0), h: 0.064, w: 0.048, dy: -0.012 },
    { p: V3(0.41, 0.97, 0), h: 0.062, w: 0.046, dy: -0.018, taper: 0.15 },
    { p: V3(0.46, 0.92, 0), h: 0.05, w: 0.038, dy: -0.008, taper: 0.2 },
    { p: V3(0.51, 0.87, 0), h: 0.043, w: 0.034, taper: 0.15 },
    { p: V3(0.55, 0.83, 0), h: 0.042, w: 0.036, sq: 0.6 },
    { p: V3(0.575, 0.81, 0), h: 0.034, w: 0.031 },
    { p: V3(0.588, 0.8, 0), h: 0.012, w: 0.012 },
  ], 28), dapple));
  // ears, nostrils, glass eyes, blaze
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.017, 0.07, 10), dapple); ear.scale.set(1, 1, 0.6); at(ear, 0.335, 1.085, s * 0.026); ear.rotation.set(s * -0.25, 0, 0.3); g.add(ear);
    g.add(at(mesh(new THREE.SphereGeometry(0.012, 14, 10), m.glassEye), 0.395, 0.99, s * 0.04));
    { const er = mesh(new THREE.TorusGeometry(0.013, 0.0025, 6, 16), m.toyBlack); at(er, 0.395, 0.99, s * 0.043); g.add(er); }
    g.add(at(mesh(new THREE.SphereGeometry(0.008, 8, 6), m.toyBlack), 0.582, 0.818, s * 0.019));
  }
  // legs in a flying gallop, hooves screwed to the bow
  const legs = [[0.2, 0.55, 0.05, 0.44, 0.135], [0.2, 0.55, -0.05, 0.4, 0.13], [-0.27, 0.56, 0.05, -0.46, 0.137], [-0.27, 0.56, -0.05, -0.42, 0.132]];
  for (const [x0, y0, z, x1, y1] of legs) {
    const top = V3(x0, y0, z * 1.1), foot = V3(x1, y1 + 0.03, z * 1.6);
    const knee = top.clone().lerp(foot, 0.45).add(V3(x0 > 0 ? 0.03 : -0.025, 0.0, 0));
    g.add(mesh(taperTube([top, knee, foot], [0.042, 0.026, 0.019], 10, 16), legMat));
    const hoof = mesh(lathe([[0, 0], [0.026, 0], [0.024, 0.03], [0.019, 0.04], [0, 0.04]], 16), m.toyBlack); at(hoof, x1, y1 - 0.008, z * 1.6); hoof.rotation.z = x1 > 0 ? -0.5 : 0.5; g.add(hoof);
  }
  // mane: many fine strands down the crest; forelock
  for (let i = 0; i < 64; i++) {
    const t = i / 63;
    const base = V3(0.15 + t * 0.18 + Math.sin(i * 7.1) * 0.006, 0.73 + t * 0.32, Math.sin(i * 3.3) * 0.008);
    const s = (i % 3 === 0 ? -1 : 1);       // most of the mane falls to the off side
    const len = (0.13 - t * 0.06) * (0.8 + 0.4 * Math.abs(Math.sin(i * 12.9)));
    const w = 0.02 + 0.015 * Math.sin(i * 5.7);
    g.add(mesh(taperTube([base, base.clone().add(V3(-0.015, -len * 0.3, s * 0.03)), base.clone().add(V3(-0.03 + w * 0.3, -len * 0.7, s * 0.048)), base.clone().add(V3(-0.04 + w, -len, s * (0.05 + (i % 4) * 0.006)))], [0.0065, 0.0055, 0.004, 0.0012], 5, 12), m.hair));
  }
  g.add(mesh(taperTube([V3(0.35, 1.06, 0), V3(0.39, 1.045, 0.01), V3(0.41, 1.0, 0.0)], [0.012, 0.008, 0.002], 5, 8), m.hair));
  // tail: a bunch of strands
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2, r = 0.5 + 0.5 * Math.abs(Math.sin(k * 4.7));
    g.add(mesh(taperTube([V3(-0.38, 0.65, 0), V3(-0.45, 0.59, Math.sin(a) * 0.015 * r), V3(-0.5, 0.46 + Math.cos(a) * 0.02 * r, Math.sin(a) * 0.03 * r), V3(-0.49 + Math.cos(a) * 0.02, 0.28 + (k % 5) * 0.025, Math.sin(a) * 0.045 * r)], [0.0075, 0.0065, 0.0045, 0.0012], 5, 14), m.hair));
  }
  // saddle, saddle cloth, girth, stirrups; bridle + reins
  const cloth = mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.2, 40, 1, true, Math.PI / 2 - Math.PI * 0.6, Math.PI * 1.2).rotateZ(Math.PI / 2), m.saddleCloth || m.toyBlue);
  cloth.scale.set(1, 1.3, 1.02); at(cloth, -0.03, 0.612, 0); g.add(cloth);
  const sad = mesh(lathe([[0, 0], [0.07, 0.0], [0.085, 0.012], [0.08, 0.025], [0, 0.03]], 28), m.saddle); sad.scale.set(1.4, 1, 0.95); at(sad, -0.03, 0.755, 0); g.add(sad);
  g.add(at(mesh(lathe([[0, 0], [0.025, 0], [0.02, 0.03], [0, 0.04]], 14), m.saddle), 0.06, 0.765, 0));
  for (const s of [-1, 1]) {
    g.add(mesh(taperTube([V3(-0.03, 0.76, s * 0.07), V3(-0.03, 0.6, s * 0.13), V3(-0.03, 0.44, s * 0.125)], [0.004, 0.004, 0.004], 4, 8), m.saddle));
    const st = mesh(new THREE.TorusGeometry(0.02, 0.0035, 5, 14, Math.PI * 1.4), m.brass); st.rotation.set(0, Math.PI / 2, Math.PI * 0.8); at(st, -0.03, 0.42, s * 0.125); g.add(st);
  }
  const brPts = [V3(0.535, 0.81, 0.028), V3(0.45, 0.9, 0.038), V3(0.37, 1.02, 0.036)];
  for (const s of [-1, 1]) g.add(mesh(taperTube(brPts.map((p) => V3(p.x, p.y, p.z * s)), [0.004, 0.004, 0.004], 4, 10), m.saddle));
  g.add(mesh(taperTube([V3(0.5, 0.85, -0.032), V3(0.505, 0.88, 0), V3(0.5, 0.85, 0.032)], [0.004, 0.004, 0.004], 4, 8), m.saddle));
  for (const s of [-1, 1]) g.add(mesh(taperTube([V3(0.54, 0.8, s * 0.03), V3(0.38, 0.72, s * 0.08), V3(0.12, 0.72, s * 0.07)], [0.0035, 0.0035, 0.0035], 4, 14), m.saddle));
  // bow rockers with turned stretchers
  const R = 1.9, span = 0.62;
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    for (let i = 0; i <= 40; i++) { const a = -span / 2 + span * (i / 40); const r = R; const p = V2(Math.sin(a) * r, R - Math.cos(a) * r + 0.0); i ? sh.lineTo(p.x, p.y) : sh.moveTo(p.x, p.y); }
    for (let i = 40; i >= 0; i--) { const a = -span / 2 + span * (i / 40); const r = R - 0.055 - 0.02 * Math.cos(a * 5); sh.lineTo(Math.sin(a) * r, R - Math.cos(a) * r + 0.0); }
    const rg = new THREE.ExtrudeGeometry(sh, { depth: 0.032, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
    rg.translate(0, 0, -0.016);
    const rk = mesh(G.applyBoxUVs(rg, 2), m.horseWood); at(rk, 0, 0.0, s * 0.09); g.add(rk);
  }
  const stretch = lathe([[0, 0], [0.014, 0], [0.016, 0.02], [0.011, 0.05], [0.014, 0.09], [0.011, 0.13], [0.016, 0.16], [0.014, 0.18], [0, 0.18]], 12);
  for (const x of [-0.5, -0.2, 0.2, 0.5]) { const st = mesh(stretch, m.horseWood); st.rotation.x = Math.PI / 2; const y = R - Math.cos(Math.asin(x / R)) * R + 0.035; at(st, x, y, -0.09); g.add(st); }
  for (const [x, z] of [[0.44, 1], [0.4, -1], [-0.46, 1], [-0.42, -1]]) { const y = R - Math.cos(Math.asin(x / R)) * R + 0.055; g.add(at(mesh(rbox(0.07, 0.02, 0.05, 0.006), m.horseWood), x, y + 0.01, z * 0.085)); }
  return g;
}

// ====================================================================== jack-in-the-box
export function buildJackInBox(ctx, m) {
  const g = new THREE.Group(); g.name = 'jack';
  const s = 0.12;
  g.add(at(mesh(rbox(s, s, s, 0.006, 3), m.toyRed), 0, s / 2, 0));
  // painted panels with gilt beading on each face
  for (const [x, z, ry] of [[0, s / 2 + 0.0015, 0], [0, -s / 2 - 0.0015, Math.PI], [s / 2 + 0.0015, 0, Math.PI / 2], [-s / 2 - 0.0015, 0, -Math.PI / 2]]) {
    const pnl = new THREE.Group(); pnl.position.set(x, s / 2, z); pnl.rotation.y = ry; g.add(pnl);
    pnl.add(mesh(rbox(s * 0.74, s * 0.74, 0.003, 0.001, 1), m.toyBlue));
    pnl.add(at(mesh(new THREE.TorusGeometry(s * 0.2, 0.0025, 5, 24), m.toyGold), 0, 0, 0.002));
    const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2; const r = i % 2 ? 0.008 : 0.018; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    pnl.add(at(mesh(new THREE.ExtrudeGeometry(star, { depth: 0.002, bevelEnabled: false }), m.toyGold), 0, 0, 0.002));
  }
  // crank on the side
  const cr = new THREE.Group(); cr.position.set(s / 2 + 0.004, s * 0.55, 0); g.add(cr);
  cr.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 10).rotateZ(Math.PI / 2), m.brass));
  cr.add(at(mesh(rbox(0.006, 0.05, 0.008, 0.002), m.brass), 0.012, -0.02, 0));
  cr.add(at(mesh(lathe([[0, 0], [0.006, 0], [0.007, 0.01], [0.005, 0.02], [0, 0.022]], 10).rotateZ(-Math.PI / 2), m.handle), 0.014, -0.045, 0));
  // lid flung back
  const lid = mesh(rbox(s + 0.004, 0.012, s + 0.004, 0.004), m.toyRed); lid.position.set(0, s + 0.05, -s / 2 - 0.045); lid.rotation.x = -1.9; g.add(lid);
  // spring
  const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push(V3(Math.cos(t * Math.PI * 14) * 0.022, s - 0.02 + t * 0.13, Math.sin(t * Math.PI * 14) * 0.022 + t * 0.02)); }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.0028, 6), m.steel));
  // clown: pleated ruff, porcelain face, pointed cap with pompom
  const top = s + 0.12;
  g.add(at(mesh(skirtGeometry([[0.008, 0.008], [0.03, 0.004], [0.048, -0.004], [0.05, -0.008]], { pleats: 16, amp: 0.22, seed: 3, hemY: -0.008, topY: 0.008 }), m.lace), 0, top, 0.02));
  g.add(at(mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.03, 16), m.toyRed), 0, top - 0.012, 0.02));
  const faceTex = dollFaceTexture(ctx.textures, { key: 'clown', eye: '#1a1a1a', lip: '#c01818', seed: 9 });
  const face = new THREE.MeshPhysicalMaterial({ map: faceTex, roughness: 0.3, clearcoat: 0.8, name: 'clownFace' });
  const head = mesh(new THREE.SphereGeometry(0.034, 28, 20), face); head.scale.set(0.95, 1.08, 0.95); at(head, 0, top + 0.036, 0.02); head.rotation.y = 0; g.add(head);
  g.add(at(mesh(new THREE.SphereGeometry(0.009, 10, 8), m.toyRed), 0, top + 0.032, 0.055));
  const hat = mesh(new THREE.ConeGeometry(0.027, 0.075, 20), m.toyBlue); at(hat, 0.006, top + 0.098, 0.016); hat.rotation.z = -0.3; g.add(hat);
  g.add(at(mesh(new THREE.TorusGeometry(0.026, 0.004, 6, 20), m.toyGold), 0.0, top + 0.064, 0.018).rotateX(Math.PI / 2));
  g.add(at(mesh(new THREE.SphereGeometry(0.009, 10, 8), m.toyGold), 0.026, top + 0.132, 0.016));
  for (const sx of [-1, 1]) g.add(at(mesh(new THREE.SphereGeometry(0.011, 8, 6), m.hairRed || m.toyRed), sx * 0.032, top + 0.04, 0.008));
  return g;
}

// ====================================================================== marionette
/** jointed marionette hanging from its control (origin at the control bar) */
export function buildMarionette(ctx, m) {
  const g = new THREE.Group(); g.name = 'marionette';
  g.add(mesh(rbox(0.2, 0.014, 0.014, 0.004), m.handle));
  g.add(mesh(rbox(0.014, 0.014, 0.15, 0.004), m.handle));
  g.add(at(mesh(rbox(0.1, 0.012, 0.012, 0.003), m.handle), 0, 0.012, 0.06));
  const hang = -0.36;
  const body = new THREE.Group(); body.position.y = hang; body.rotation.z = 0.06; g.add(body);
  const faceTex = dollFaceTexture(ctx.textures, { key: 'puppet', eye: '#3a2010', lip: '#7a1a1a', seed: 4 });
  const face = new THREE.MeshPhysicalMaterial({ map: faceTex, roughness: 0.45, clearcoat: 0.4, name: 'puppetFace' });
  // head + jester hood with two bells
  const head = mesh(new THREE.SphereGeometry(0.028, 24, 18), face); head.scale.set(0.95, 1.1, 0.95); body.add(head);
  const hood = mesh(new THREE.SphereGeometry(0.031, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), m.toyRed); hood.rotation.x = -0.35; at(hood, 0, 0.004, -0.004); body.add(hood);
  for (const s of [-1, 1]) {
    body.add(mesh(taperTube([V3(s * 0.015, 0.02, -0.005), V3(s * 0.04, 0.045, -0.01), V3(s * 0.06, 0.03, -0.004)], [0.012, 0.007, 0.003], 6, 10), s < 0 ? m.toyRed : m.toyBlue));
    body.add(at(mesh(new THREE.SphereGeometry(0.006, 8, 6), m.toyGold), s * 0.062, 0.027, -0.004));
  }
  // ruff, torso (doublet), belt
  body.add(at(mesh(skirtGeometry([[0.006, 0.006], [0.024, 0.002], [0.034, -0.004]], { pleats: 12, amp: 0.25, seed: 2, hemY: -0.004, topY: 0.006 }), m.lace), 0, -0.03, 0));
  body.add(mesh(lathe([[0, -0.035], [0.022, -0.036], [0.027, -0.06], [0.023, -0.095], [0.026, -0.115], [0, -0.118]], 18), m.toyRed));
  body.add(at(mesh(new THREE.TorusGeometry(0.024, 0.003, 5, 18), m.toyBlack), 0, -0.098, 0).rotateX(Math.PI / 2));
  // jointed limbs: upper/lower with ball joints, carved hands and pointed shoes
  for (const s of [-1, 1]) {
    const sh = V3(s * 0.03, -0.045, 0), el = V3(s * 0.04, -0.09, 0.012), wr = V3(s * 0.036, -0.13, 0.02);
    body.add(mesh(taperTube([sh, el], [0.008, 0.007], 6, 4), s < 0 ? m.toyRed : m.toyBlue));
    body.add(at(mesh(new THREE.SphereGeometry(0.007, 8, 6), m.benchTop), el.x, el.y, el.z));
    body.add(mesh(taperTube([el, wr], [0.0065, 0.0055], 6, 4), s < 0 ? m.toyRed : m.toyBlue));
    body.add(at(mesh(new THREE.SphereGeometry(0.008, 8, 6).scale(0.8, 1.2, 0.6), m.porcelain), wr.x, wr.y - 0.006, wr.z));
    const hp = V3(s * 0.012, -0.118, 0), kn = V3(s * 0.016, -0.17, 0.014 * s), an = V3(s * 0.014, -0.225, 0.004);
    body.add(mesh(taperTube([hp, kn], [0.0095, 0.008], 6, 4), s < 0 ? m.toyBlue : m.toyRed));
    body.add(at(mesh(new THREE.SphereGeometry(0.0085, 8, 6), m.benchTop), kn.x, kn.y, kn.z));
    body.add(mesh(taperTube([kn, an], [0.0075, 0.0065], 6, 4), s < 0 ? m.toyBlue : m.toyRed));
    body.add(mesh(taperTube([V3(an.x, an.y - 0.004, an.z - 0.01), V3(an.x, an.y - 0.008, an.z + 0.02), V3(an.x, an.y - 0.0, an.z + 0.038)], [0.008, 0.007, 0.002], 6, 8), m.toyBlack));
  }
  // strings to hands, head and knees
  const strG = (a, b) => { const len = a.distanceTo(b); const c = new THREE.CylinderGeometry(0.0005, 0.0005, len, 3); const o = mesh(c, m.string); o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()); return o; };
  g.add(strG(V3(-0.1, 0, 0), V3(-0.036, hang - 0.13, 0.02)));
  g.add(strG(V3(0.1, 0, 0), V3(0.036, hang - 0.13, 0.02)));
  g.add(strG(V3(-0.02, 0.0, 0.075), V3(-0.02, hang + 0.025, 0)));
  g.add(strG(V3(0.02, 0.0, 0.075), V3(0.02, hang + 0.025, 0)));
  g.add(strG(V3(0, 0, -0.075), V3(0, hang - 0.11, -0.02)));
  g.add(strG(V3(-0.05, 0.012, 0.06), V3(-0.016, hang - 0.17, 0.0)));
  g.add(strG(V3(0.05, 0.012, 0.06), V3(0.016, hang - 0.17, 0.0)));
  return g;
}

// ====================================================================== the model mansion
/** Stauf's model of the mansion: hipped main block, gabled wing, tower with a spire, porch, chimneys, framed glowing windows. */
export function buildModelHouse(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'modelHouse';
  const roofPrism = (w, d, h, over = 0.012) => {
    const s = new THREE.Shape(); s.moveTo(-d / 2 - over, -0.004); s.lineTo(0, h); s.lineTo(d / 2 + over, -0.004); s.lineTo(d / 2 + over, 0.0); s.lineTo(-d / 2 - over, 0.0);
    const e = new THREE.ExtrudeGeometry(s, { depth: w + over * 2, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }); e.translate(0, 0, -(w + over * 2) / 2); e.rotateY(Math.PI / 2);
    return G.applyBoxUVs(e, 6);
  };
  const hipRoof = (w, d, h, over = 0.012) => { const c = new THREE.ConeGeometry(1, 1, 4, 1); c.rotateY(Math.PI / 4); c.scale((w / 2 + over) * Math.SQRT2, h, (d / 2 + over) * Math.SQRT2); c.translate(0, h / 2, 0); return c; };
  // base board with a gravel drive and lawn
  g.add(at(mesh(rbox(0.46, 0.022, 0.32, 0.004), m.benchFrame), 0, 0.011, 0));
  g.add(at(mesh(rbox(0.44, 0.003, 0.3, 0.001), m.lawn || m.toyGreen), 0, 0.0235, 0));
  g.add(at(mesh(rbox(0.05, 0.002, 0.11, 0.001), m.modelWall), 0, 0.025, 0.105));
  const Y0 = 0.025;
  const windows = [];
  const wall = (w, h, d, x, z) => { g.add(at(mesh(rbox(w, h, d, 0.002), m.modelWall), x, Y0 + h / 2, z)); };
  // string course + quoins helper
  const course = (w, d, x, y, z) => g.add(at(mesh(rbox(w + 0.006, 0.004, d + 0.006, 0.001), m.modelTrim || m.toyWhite), x, Y0 + y, z));
  const win = (x, y, z, ry, lit, tall = 0.03) => {
    const f = new THREE.Group(); f.position.set(x, Y0 + y, z); f.rotation.y = ry; g.add(f);
    const pane = mesh(new THREE.PlaneGeometry(0.016, tall), lit ? m.winLit : m.winDark); pane.position.z = 0.0008; f.add(pane);
    f.add(at(mesh(rbox(0.022, 0.004, 0.004, 0.001), m.modelTrim || m.toyWhite), 0, tall / 2 + 0.002, 0.002));
    f.add(at(mesh(rbox(0.024, 0.003, 0.006, 0.001), m.modelTrim || m.toyWhite), 0, -tall / 2 - 0.0015, 0.003));
    f.add(at(mesh(new THREE.BoxGeometry(0.0015, tall, 0.002), m.modelTrim || m.toyWhite), 0, 0, 0.0015));
    f.add(at(mesh(new THREE.BoxGeometry(0.016, 0.0015, 0.002), m.modelTrim || m.toyWhite), 0, 0.002, 0.0015));
    windows.push(f);
  };
  // main block 0.24 x 0.14 x 0.15, hipped roof
  wall(0.24, 0.14, 0.15, 0, -0.02);
  course(0.24, 0.15, 0, 0.07, -0.02); course(0.24, 0.15, 0, 0.138, -0.02);
  g.add(at(mesh(hipRoof(0.24, 0.15, 0.075), m.slate), 0, Y0 + 0.14, -0.02));
  const fz = -0.02 + 0.075 + 0.001;
  [[-0.09, 0.105, 1], [-0.045, 0.105, 0], [0.045, 0.105, 1], [0.09, 0.105, 1], [-0.09, 0.035, 1], [-0.045, 0.035, 1], [0.045, 0.035, 0], [0.09, 0.035, 1]].forEach(([x, y, l]) => win(x, y, fz, 0, l));
  // dormers on the roof
  for (const x of [-0.06, 0.06]) {
    g.add(at(mesh(rbox(0.03, 0.03, 0.04, 0.002), m.modelWall), x, Y0 + 0.165, 0.025));
    g.add(at(mesh(roofPrism(0.04, 0.034, 0.02, 0.004), m.slate), x, Y0 + 0.18, 0.025).rotateY(Math.PI / 2));
    win(x, 0.164, 0.046, 0, x < 0, 0.016);
  }
  // tower on the right with a spire and finial
  wall(0.075, 0.24, 0.075, 0.15, 0.02);
  course(0.075, 0.075, 0.15, 0.07, 0.02); course(0.075, 0.075, 0.15, 0.138, 0.02); course(0.075, 0.075, 0.15, 0.238, 0.02);
  const spire = mesh(new THREE.ConeGeometry(0.058, 0.14, 8), m.slate); at(spire, 0.15, Y0 + 0.31, 0.02); g.add(spire);
  g.add(at(mesh(lathe([[0, 0], [0.004, 0], [0.002, 0.02], [0.004, 0.026], [0, 0.04]], 8), m.toyGold), 0.15, Y0 + 0.375, 0.02));
  win(0.15, 0.105, 0.02 + 0.0385, 0, true); win(0.15, 0.035, 0.02 + 0.0385, 0, true); win(0.15, 0.19, 0.02 + 0.0385, 0, true, 0.024);
  // gabled left wing
  wall(0.1, 0.1, 0.12, -0.165, 0.0);
  course(0.1, 0.12, -0.165, 0.07, 0.0);
  g.add(at(mesh(roofPrism(0.1, 0.12, 0.06), m.slate), -0.165, Y0 + 0.1, 0.0).rotateY(Math.PI / 2));
  win(-0.165, 0.035, 0.061, 0, true); win(-0.185, 0.035 + 0.0, 0.061, 0, false); win(-0.2165, 0.035, 0.0, -Math.PI / 2, true);
  // chimneys with pots
  for (const [x, z, h] of [[-0.07, -0.05, 0.1], [0.06, -0.06, 0.09], [-0.18, -0.02, 0.07]]) {
    g.add(at(mesh(rbox(0.022, h, 0.022, 0.002), m.brickToy || m.toyRed), x, Y0 + 0.14 + h / 2 - (x < -0.15 ? 0.04 : 0), z));
    g.add(at(mesh(rbox(0.028, 0.006, 0.028, 0.001), m.modelTrim || m.toyWhite), x, Y0 + 0.14 + h - (x < -0.15 ? 0.04 : 0), z));
    for (const dx of [-0.005, 0.005]) g.add(at(mesh(new THREE.CylinderGeometry(0.004, 0.0045, 0.012, 8), m.modelWall), x + dx, Y0 + 0.146 + h - (x < -0.15 ? 0.04 : 0), z));
  }
  // porch: steps, columns, roof, front door
  g.add(at(mesh(rbox(0.09, 0.008, 0.04, 0.001), m.modelTrim || m.toyWhite), 0, Y0 + 0.004, 0.075));
  g.add(at(mesh(rbox(0.07, 0.008, 0.025, 0.001), m.modelTrim || m.toyWhite), 0, Y0 + 0.004, 0.1));
  for (const x of [-0.035, 0.035]) g.add(at(mesh(lathe([[0, 0], [0.004, 0], [0.003, 0.004], [0.0028, 0.05], [0.004, 0.054], [0, 0.056]], 8), m.modelTrim || m.toyWhite), x, Y0 + 0.008, 0.09));
  g.add(at(mesh(roofPrism(0.09, 0.05, 0.022, 0.004), m.slate), 0, Y0 + 0.064, 0.075).rotateY(Math.PI / 2));
  g.add(at(mesh(new THREE.PlaneGeometry(0.02, 0.036), m.winLit), 0, Y0 + 0.026, fz + 0.0005));
  g.add(at(mesh(rbox(0.026, 0.004, 0.004, 0.001), m.modelTrim || m.toyWhite), 0, Y0 + 0.046, fz + 0.002));
  g.userData.windows = windows;
  return g;
}

// ====================================================================== bench clutter
/** open music box: walnut case, brass pinned cylinder, steel comb, winding key. */
export function buildMusicBox(ctx, m) {
  const g = new THREE.Group(); g.name = 'musicBox';
  const w = 0.13, d = 0.085, h = 0.045;
  g.add(at(mesh(rbox(w, 0.006, d, 0.002), m.labTop), 0, 0.003, 0));
  for (const s of [-1, 1]) g.add(at(mesh(rbox(w, h, 0.006, 0.0015), m.labTop), 0, h / 2, s * (d / 2 - 0.003)));
  for (const s of [-1, 1]) g.add(at(mesh(rbox(0.006, h, d - 0.012, 0.0015), m.labTop), s * (w / 2 - 0.003), h / 2, 0));
  g.add(at(mesh(rbox(w * 0.5, 0.004, 0.0062, 0.001), m.toyGold), 0, h * 0.5, d / 2 + 0.0002));
  const lid = new THREE.Group(); lid.position.set(0, h, -d / 2); lid.rotation.x = -1.75; g.add(lid);
  lid.add(at(mesh(rbox(w + 0.004, 0.007, d + 0.004, 0.002), m.labTop), 0, 0.0035, d / 2));
  lid.add(at(mesh(new THREE.PlaneGeometry(w * 0.8, d * 0.75).rotateX(-Math.PI / 2), m.velvetRed || m.saddle), 0, -0.0005, d / 2).rotateX(Math.PI));
  // cylinder with pins
  const cyl = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.085, 24).rotateZ(Math.PI / 2), m.brass); at(cyl, -0.005, 0.025, -0.01); g.add(cyl);
  const pins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.004, 3), m.steel, 90);
  const q = new THREE.Quaternion(), mm = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) { const a = (i * 2.399) % (Math.PI * 2); const x = -0.04 + ((i * 0.618) % 1) * 0.08; q.setFromAxisAngle(V3(1, 0, 0), a); const p = V3(x - 0.005, 0.025 + Math.cos(a) * 0.0135, -0.01 + Math.sin(a) * 0.0135); mm.compose(p, q, V3(1, 1, 1)); pins.setMatrixAt(i, mm); }
  g.add(pins);
  // comb
  g.add(at(mesh(rbox(0.085, 0.012, 0.004, 0.001), m.steel), -0.005, 0.022, 0.008));
  for (let i = 0; i < 18; i++) g.add(at(mesh(new THREE.BoxGeometry(0.003, 0.0012, 0.018 - (i % 18) * 0.0004), m.steel), -0.045 + i * 0.0047, 0.03, 0.012).rotateX(0.1));
  // spring barrel + winding key outside
  g.add(at(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 20).rotateZ(Math.PI / 2), m.brass), 0.05, 0.022, -0.012));
  const key = new THREE.Group(); key.position.set(w / 2 + 0.008, 0.024, -0.012); g.add(key);
  key.add(mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.012, 8).rotateZ(Math.PI / 2), m.brass));
  key.add(at(mesh(new THREE.TorusGeometry(0.008, 0.0025, 6, 16), m.brass), 0.01, 0, 0).rotateY(Math.PI / 2));
  return g;
}

/** half-assembled interlocking puzzle box: some burr sticks out, a sliding panel drawn half open */
export function buildBurr(ctx, m, s = 0.08) {
  const g = new THREE.Group(); g.name = 'burr';
  const stick = (len) => rbox(len, s * 0.25, s * 0.25, 0.003);
  const L = s;
  const items = [[0, 0.5, 0.25, 0, 0], [0, 0.5, -0.25, 0, 0], [0.25, 0.5, 0, 1, 0], [-0.25, 0.5, 0, 1, 0.05], [0, 0.75, 0.0, 2, 0], [0, 0.25, 0, 2, -0.035]];
  items.forEach(([x, y, z, ax, slide], i) => {
    const b = mesh(stick(L), i % 2 ? m.benchTop : m.crate);
    if (ax === 1) b.rotation.y = Math.PI / 2;
    if (ax === 2) b.rotation.z = Math.PI / 2;
    b.position.set(x * L + (ax === 0 ? slide : 0), y * L, z * L + (ax === 1 ? slide : 0) + (ax === 2 ? slide : 0));
    g.add(b);
  });
  // loose pieces beside it
  for (let i = 0; i < 3; i++) { const b = mesh(stick(L * (0.9 + i * 0.05)), i % 2 ? m.crate : m.benchTop); b.position.set(0.07 + i * 0.022, s * 0.125, 0.02 - i * 0.015); b.rotation.y = 0.4 + i * 0.5; g.add(b); }
  return g;
}

/** paint pots with brushes standing in a jar */
export function buildPaintPots(ctx, m) {
  const g = new THREE.Group(); g.name = 'paints';
  const cols = [m.toyRed, m.toyBlue, m.toyGold, m.toyWhite, m.toyGreen];
  cols.forEach((c, i) => {
    const x = (i % 3) * 0.04, z = Math.floor(i / 3) * 0.04;
    g.add(at(mesh(lathe([[0, 0], [0.016, 0], [0.017, 0.002], [0.017, 0.028], [0.015, 0.03], [0, 0.03]], 18), m.tin), x, 0, z));
    g.add(at(mesh(new THREE.CircleGeometry(0.0148, 18).rotateX(-Math.PI / 2), c), x, 0.026, z));
    g.add(at(mesh(new THREE.TorusGeometry(0.0155, 0.0015, 4, 18).rotateX(Math.PI / 2), c), x, 0.029, z));
  });
  const jar = mesh(lathe([[0, 0], [0.022, 0], [0.024, 0.004], [0.024, 0.07], [0.02, 0.075], [0.022, 0.08]], 20), m.glass); at(jar, 0.12, 0, 0.02); g.add(jar);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7, tilt = 0.18 + (i % 2) * 0.1;
    const b = new THREE.Group(); b.position.set(0.12 + Math.cos(a) * 0.008, 0.005, 0.02 + Math.sin(a) * 0.008); b.rotation.set(Math.sin(a) * tilt, 0, Math.cos(a) * tilt); g.add(b);
    b.add(at(mesh(lathe([[0, 0], [0.003, 0], [0.0035, 0.1], [0.002, 0.14], [0, 0.145]], 8), m.handle), 0, 0, 0));
    b.add(at(mesh(new THREE.CylinderGeometry(0.0038, 0.0034, 0.014, 8), m.steel), 0, 0.15, 0));
    b.add(at(mesh(new THREE.ConeGeometry(0.0036, 0.016, 8), cols[i % 5]), 0, 0.165, 0));
  }
  return g;
}

/** a scatter of wood screws, tacks and a small brass hinge */
export function buildScrews(ctx, m, n = 14, seed = 3) {
  const g = new THREE.Group(); g.name = 'screws';
  const geo = lathe([[0, 0], [0.0014, 0.001], [0.0016, 0.012], [0.0028, 0.013], [0.0028, 0.015], [0, 0.0155]], 6);
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    const sc = mesh(geo, i % 4 === 0 ? m.brass : m.steel);
    sc.rotation.set(Math.PI / 2, 0, rnd() * Math.PI * 2); sc.rotation.order = 'ZXY';
    sc.position.set((rnd() - 0.5) * 0.14, 0.0028, (rnd() - 0.5) * 0.09);
    g.add(sc);
  }
  const hinge = new THREE.Group(); hinge.position.set(0.05, 0.001, 0.03); hinge.rotation.y = 0.7; g.add(hinge);
  hinge.add(at(mesh(rbox(0.018, 0.0015, 0.03, 0.0006), m.brass), -0.01, 0, 0)); hinge.add(at(mesh(rbox(0.018, 0.0015, 0.03, 0.0006), m.brass), 0.01, 0.003, 0).rotateZ(0.4));
  hinge.add(at(mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.03, 8).rotateX(Math.PI / 2), m.brass), 0, 0.001, 0));
  return g;
}

/** leather notebook, open, with page edges, a ribbon and a dip pen with a steel nib. */
export function buildNotebook(ctx, m, pageTex) {
  const g = new THREE.Group(); g.name = 'notebook';
  const w = 0.15, d = 0.22;
  for (const s of [-1, 1]) {
    const half = new THREE.Group(); half.position.x = s * (w / 2 + 0.003); half.rotation.z = -s * 0.04; g.add(half);
    half.add(at(mesh(rbox(w + 0.008, 0.004, d + 0.01, 0.0015), m.bookLeather || m.trunk), 0, 0.002, 0));
    // page block: stacked with a slight curve
    const pb = new THREE.BoxGeometry(w, 0.012, d, 8, 1, 1);
    const pp = pb.attributes.position;
    for (let i = 0; i < pp.count; i++) { const x = pp.getX(i); const k = (x * s + w / 2) / w; pp.setY(i, pp.getY(i) + Math.sin(k * Math.PI * 0.9) * 0.006 * (pp.getY(i) > 0 ? 1 : 0.3)); }
    pb.computeVertexNormals();
    half.add(at(mesh(pb, m.pageEdge || m.vellum), 0, 0.01, 0));
    const pg = new THREE.PlaneGeometry(w - 0.002, d - 0.004, 8, 1).rotateX(-Math.PI / 2);
    const pgp = pg.attributes.position, uv = pg.attributes.uv;
    for (let i = 0; i < pgp.count; i++) { const x = pgp.getX(i); const k = (x * s + w / 2) / w; pgp.setY(i, 0.0162 + Math.sin(k * Math.PI * 0.9) * 0.006); uv.setX(i, s < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5); }
    pg.computeVertexNormals();
    half.add(mesh(pg, pageTex));
  }
  // ribbon
  g.add(mesh(taperTube([V3(0, 0.017, -d / 2 + 0.02), V3(0.01, 0.016, 0.0), V3(0.005, 0.005, d / 2 + 0.03), V3(0.012, 0.0, d / 2 + 0.06)], [0.0018, 0.0018, 0.0018, 0.0018], 3, 16), m.saddle));
  // dip pen
  const pen = new THREE.Group(); pen.position.set(0.11, 0.004, 0.06); pen.rotation.set(0, 0.9, 0); g.add(pen);
  const penG = lathe([[0, 0], [0.0025, 0.003], [0.0038, 0.02], [0.0045, 0.03], [0.0042, 0.12], [0.003, 0.15], [0, 0.155]], 12);
  const body = mesh(penG, m.toyBlack); body.rotation.z = Math.PI / 2; pen.add(body);
  const nib = mesh(new THREE.ConeGeometry(0.0025, 0.016, 8).rotateZ(-Math.PI / 2), m.steel); nib.position.x = 0.008; pen.add(nib);
  pen.position.y = 0.0045;
  return g;
}
