import * as THREE from 'three';
import { sheetMusicTexture, harpSoundboardTexture } from './textures.js';

/**
 * Harp, cello (on its stand), music stand and piano bench for the music room.
 * Every builder returns a Group with its origin on the floor.
 */

/** Pedal harp, ~1.8 m: fluted gilt column with a carved acanthus crown, double-curved
 *  neck, a flared loft soundbox with a painted soundboard, 44 strings, 7 pedals. */
export function buildHarp(ctx, { gilt, giltPlain, wood, box = wood }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'harp';
  // frame plane = XY (z = side to side). Column at x = +0.25 (front), soundbox leans back from the base.
  // ---- base: moulded plinth on gilt paw feet, pedal slots, seven pedals
  const base = new THREE.Mesh(new G.RoundedBoxGeometry(0.5, 0.1, 0.32, 3, 0.025), box);
  base.position.set(0.06, 0.08, 0); g.add(base);
  const plinth = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.035, 0.02), [new THREE.Vector3(-0.19, 0.13, -0.16), new THREE.Vector3(0.31, 0.13, -0.16), new THREE.Vector3(0.31, 0.13, 0.16), new THREE.Vector3(-0.19, 0.13, 0.16)], { closed: true, uvScale: 2 }), giltPlain);
  g.add(plinth);
  const top = new THREE.Mesh(new G.RoundedBoxGeometry(0.44, 0.03, 0.27, 2, 0.01), box);
  top.position.set(0.06, 0.145, 0); g.add(top);
  for (const [x, z] of [[-0.16, -0.13], [0.28, -0.13], [-0.16, 0.13], [0.28, 0.13]]) {
    const foot = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.032, 0.0], [0.04, 0.012], [0.03, 0.03], [0.036, 0.04], [0, 0.045]], 16), giltPlain);
    foot.position.set(x, 0, z); g.add(foot);
  }
  for (let i = 0; i < 7; i++) {
    const zz = -0.12 + i * 0.04;
    const ped = new THREE.Mesh(new G.RoundedBoxGeometry(0.11, 0.012, 0.022, 2, 0.005), giltPlain);
    const side = i < 3 ? -1 : 1;
    ped.position.set(i === 3 ? 0.34 : 0.33, 0.05 + (i % 2) * 0.012, zz); ped.rotation.z = -0.15; g.add(ped);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), giltPlain);
    tip.position.set(0.385, 0.045 + (i % 2) * 0.012, zz); g.add(tip);
    void side;
  }
  // ---- column: fluted gilt shaft on a turned base, carved crown capital
  const colX = 0.25, colY0 = 0.16, colH = 1.36;
  const shaftGeo = G.latheFromProfile([[0.045, 0], [0.05, 0.02], [0.038, 0.05], [0.042, 0.07], [0.032, 0.1], [0.03, colH * 0.5], [0.028, colH - 0.04], [0.034, colH - 0.02], [0.03, colH]], 40);
  {
    // flutes: shallow grooves in the shaft section (between turnings)
    const p = shaftGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i); if (y < 0.12 || y > colH - 0.05) continue;
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const k = 1 - 0.09 * Math.pow(Math.max(0, Math.cos(a * 12)), 4);
      p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
    }
    shaftGeo.computeVertexNormals();
  }
  const column = new THREE.Mesh(shaftGeo, gilt);
  column.position.set(colX, colY0, 0); g.add(column);
  // spiral garland twined about the shaft
  {
    const pts = [];
    for (let i = 0; i <= 160; i++) { const t = i / 160; const a = t * Math.PI * 9; pts.push(new THREE.Vector3(colX + Math.cos(a) * 0.033, colY0 + 0.15 + t * (colH - 0.25), Math.sin(a) * 0.033)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.0045, 5), giltPlain));
  }
  // capital: bell of acanthus leaves (lathe with angular ridges), abacus, and a crown of anthemion
  const capGeo = G.latheFromProfile([[0.03, 0], [0.034, 0.015], [0.05, 0.05], [0.07, 0.1], [0.085, 0.14], [0.08, 0.16], [0.06, 0.165]], 64, );
  {
    const p = capGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i));
      const leaf = Math.pow(Math.abs(Math.cos(a * 4)), 3) * Math.min(1, y / 0.06);
      const curl = 1 + 0.18 * leaf * Math.sin(Math.min(1, y / 0.16) * Math.PI) + 0.04 * Math.sin(a * 24) * Math.min(1, y / 0.1);
      p.setX(i, p.getX(i) * curl); p.setZ(i, p.getZ(i) * curl);
    }
    capGeo.computeVertexNormals();
  }
  const cap = new THREE.Mesh(capGeo, gilt);
  cap.position.set(colX, colY0 + colH, 0); g.add(cap);
  const abacus = new THREE.Mesh(new G.RoundedBoxGeometry(0.16, 0.025, 0.12, 2, 0.008), giltPlain);
  abacus.position.set(colX, colY0 + colH + 0.175, 0); g.add(abacus);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), gilt);
    leaf.scale.set(0.5, 1.6, 0.25);
    leaf.position.set(colX + Math.cos(a) * 0.065, colY0 + colH + 0.215, Math.sin(a) * 0.05);
    leaf.rotation.set(Math.sin(a) * 0.35, -a, -Math.cos(a) * 0.35);
    g.add(leaf);
  }
  const finial = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.04, 0.03], [0.022, 0.06], [0.03, 0.08], [0.0, 0.11]], 20), gilt);
  finial.position.set(colX, colY0 + colH + 0.19, 0); g.add(finial);
  // ---- soundbox: loft along the axis, flared at the base, half-round back, flat soundboard in front
  const A = new THREE.Vector2(0.0, 0.16), B = new THREE.Vector2(-0.45, 1.55);
  const u = B.clone().sub(A); const L = u.length(); u.normalize();
  const nb = new THREE.Vector2(-u.y, u.x);    // points to -x (behind); soundboard faces -nb
  if (nb.x > 0) nb.negate();
  const NS = 40, NA = 24;
  const halfW = (t) => 0.045 + 0.13 * Math.pow(1 - t, 1.3) + 0.03 * Math.pow(1 - t, 8);
  const bulge = (t) => 0.04 + 0.13 * Math.pow(1 - t, 1.1);
  {
    const pos = [], idx = [], uv = [];
    for (let i = 0; i <= NS; i++) {
      const t = i / NS;
      const c = A.clone().addScaledVector(u, L * t);
      for (let j = 0; j <= NA; j++) {
        const ph = (j / NA) * Math.PI;
        const bx = Math.sin(ph) * bulge(t), z = Math.cos(ph) * halfW(t);
        pos.push(c.x + nb.x * bx, c.y + nb.y * bx, z);
        uv.push(j / NA * 0.6, t * L);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) { const a0 = i * (NA + 1) + j, a1 = a0 + NA + 1; idx.push(a0, a0 + 1, a1, a0 + 1, a1 + 1, a1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    // make sure normals face outward (away from the axis)
    const sb = new THREE.Mesh(geo, box);
    const n0 = geo.attributes.normal; const p0 = geo.attributes.position;
    const k = Math.floor(NA / 2);
    const test = new THREE.Vector3(n0.getX(k), n0.getY(k), n0.getZ(k));
    if (test.x * nb.x + test.y * nb.y < 0) { geo.setIndex(idx.map((_, i2, arr) => arr[i2 - (i2 % 3) + [0, 2, 1][i2 % 3]])); geo.computeVertexNormals(); }
    void p0;
    g.add(sb);
    // painted spruce soundboard (flat face) with a gilt border
    const sbPos = [], sbUv = [], sbIdx = [];
    for (let i = 0; i <= NS; i++) {
      const t = i / NS; const c = A.clone().addScaledVector(u, L * t); const w = halfW(t);
      sbPos.push(c.x - nb.x * 0.002, c.y - nb.y * 0.002, -w, c.x - nb.x * 0.002, c.y - nb.y * 0.002, w);
      sbUv.push(0, t, 1, t);
    }
    for (let i = 0; i < NS; i++) { const a0 = i * 2; sbIdx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(sbPos, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(sbUv, 2));
    fg.setIndex(sbIdx); fg.computeVertexNormals();
    const face = new THREE.Mesh(fg, new THREE.MeshPhysicalMaterial({ map: harpSoundboardTexture(ctx.textures), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, side: THREE.DoubleSide }));
    g.add(face);
    // gilt edge beads along both sides of the soundboard
    for (const sgn of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= NS; i += 2) { const t = i / NS; const c = A.clone().addScaledVector(u, L * t); pts.push(new THREE.Vector3(c.x - nb.x * 0.004, c.y - nb.y * 0.004, sgn * halfW(t))); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.007, 6), giltPlain));
    }
    // centre strip (string rib) down the soundboard
    const rib = new THREE.Mesh(new G.RoundedBoxGeometry(0.022, L * 0.9, 0.012, 2, 0.004), box);
    const mid = A.clone().addScaledVector(u, L * 0.5);
    rib.position.set(mid.x - nb.x * 0.006, mid.y - nb.y * 0.006, 0);
    rib.rotation.z = Math.atan2(u.y, u.x) - Math.PI / 2; rib.rotation.y = 0;
    g.add(rib);
  }
  // ---- neck: double S-curve from the column crown to the soundbox head, gilt-edged, scroll end
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(colX, colY0 + colH + 0.2, 0),
    new THREE.Vector3(0.14, 1.79, 0),
    new THREE.Vector3(0.0, 1.73, 0),
    new THREE.Vector3(-0.13, 1.6, 0),
    new THREE.Vector3(-0.27, 1.56, 0),
    new THREE.Vector3(-0.4, 1.63, 0),
    new THREE.Vector3(-0.49, 1.66, 0),
    new THREE.Vector3(-0.53, 1.6, 0),
  ], false, 'centripetal');
  const neckGeo = new THREE.TubeGeometry(neckCurve, 120, 0.04, 14, false);
  { const p = neckGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * 0.5); neckGeo.computeVertexNormals(); }
  g.add(new THREE.Mesh(neckGeo, box));
  for (const zz of [-0.02, 0.02]) {
    const e = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 120, 0.009, 6, false), giltPlain);
    e.position.z = zz; g.add(e);
  }
  // carved gilt leaf run along the top of the neck
  for (let i = 0; i < 26; i++) {
    const t = 0.06 + (i / 25) * 0.86;
    const pt = neckCurve.getPoint(t), tg = neckCurve.getTangent(t);
    const nrm = new THREE.Vector3(-tg.y, tg.x, 0);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), giltPlain);
    leaf.scale.set(1.8, 0.6, 0.8);
    leaf.position.copy(pt).addScaledVector(nrm, 0.036);
    leaf.rotation.z = Math.atan2(tg.y, tg.x) + 0.4;
    g.add(leaf);
  }
  const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.014, 8, 24, Math.PI * 1.6), gilt);
  scroll.position.set(-0.52, 1.63, 0); scroll.rotation.z = 2.2; g.add(scroll);
  // ---- strings: soundboard eyelets up to tuning pins under the neck
  const n = 44;
  const strMat = new THREE.MeshPhysicalMaterial({ color: 0xe6dcc4, roughness: 0.3, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.15 });
  const redMat = new THREE.MeshPhysicalMaterial({ color: 0x9a1e16, roughness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.15 });
  const blueMat = new THREE.MeshPhysicalMaterial({ color: 0x1a2440, roughness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.15 });
  const sGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
  const mk = (mat) => { const im = new THREE.InstancedMesh(sGeo, mat, n); im.count = 0; im.castShadow = false; return im; };
  const sets = { w: mk(strMat), r: mk(redMat), b: mk(blueMat) };
  const pinGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 6); pinGeo.rotateX(Math.PI / 2);
  const pins = new THREE.InstancedMesh(pinGeo, new THREE.MeshStandardMaterial({ color: 0xc8c0b0, metalness: 1, roughness: 0.3 }), n);
  const eyelets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.005, 8, 6), giltPlain, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const neckSamples = []; for (let k = 0; k <= 400; k++) neckSamples.push(neckCurve.getPoint(k / 400));
  for (let i = 0; i < n; i++) {
    const t = 0.05 + (i / (n - 1)) * 0.88;
    const c = A.clone().addScaledVector(u, L * t);
    const bottom = new THREE.Vector3(c.x - nb.x * 0.008, c.y - nb.y * 0.008, 0);
    // neck underside straight above
    let best = neckSamples[0], bd = 1e9;
    for (const ns of neckSamples) { if (ns.x > colX - 0.06) continue; const d = Math.abs(ns.x - bottom.x); if (d < bd) { bd = d; best = ns; } }
    const topP = new THREE.Vector3(bottom.x + 0.004, best.y - 0.036, 0);
    const len = topP.distanceTo(bottom);
    if (len < 0.06) continue;
    const r = 0.0007 + 0.0013 * (1 - i / n);
    q.setFromUnitVectors(up, topP.clone().sub(bottom).normalize());
    m.compose(bottom.clone().lerp(topP, 0.5), q, new THREE.Vector3(r, len, r));
    const note = i % 7;
    const set = note === 0 ? sets.r : note === 4 ? sets.b : sets.w;
    set.setMatrixAt(set.count++, m);
    m.compose(new THREE.Vector3(topP.x, best.y - 0.01, 0), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); pins.setMatrixAt(i, m);
    m.compose(bottom, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); eyelets.setMatrixAt(i, m);
  }
  g.add(sets.w, sets.r, sets.b, pins, eyelets);
  return g;
}

/*
 * Cello, modelled to real proportions: a 0.755 m body (lower bout 0.44, C-bouts 0.23, upper bout
 * 0.344) with pointed corners, 12 cm ribs, arched spruce top with real f-holes (alpha-cut through
 * the plate, a dark interior behind them), flamed maple back and ribs, purfling, an ebony
 * fingerboard dead centre, a carved bridge, tailpiece, four strings, pegbox, pegs and a scroll.
 * Local frame: y up from the bottom of the body, top plate faces +Z.
 */
const CELLO_L = 0.755;
function celloHalfOutline() {
  const seg = (cp, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * (cp.length - 1), k = Math.min(cp.length - 2, Math.floor(t)), f = t - k;
      const p0 = cp[Math.max(0, k - 1)], p1 = cp[k], p2 = cp[k + 1], p3 = cp[Math.min(cp.length - 1, k + 2)];
      const c = (a) => 0.5 * ((2 * p1[a]) + (-p0[a] + p2[a]) * f + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * f * f + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * f * f * f);
      out.push([c(0), c(1)]);
    }
    return out;
  };
  // three spans meeting at sharp corners: lower bout, C-bout, upper bout
  const lower = seg([[0, 0], [0.1, 0.007], [0.172, 0.036], [0.212, 0.09], [0.22, 0.15], [0.21, 0.212], [0.188, 0.258], [0.172, 0.292]], 36);
  const cb = seg([[0.172, 0.292], [0.142, 0.302], [0.122, 0.33], [0.115, 0.375], [0.12, 0.42], [0.138, 0.452], [0.16, 0.466]], 24);
  const upper = seg([[0.16, 0.466], [0.166, 0.49], [0.172, 0.54], [0.164, 0.6], [0.14, 0.655], [0.1, 0.705], [0.05, 0.742], [0, CELLO_L]], 30);
  return [...lower, ...cb.slice(1), ...upper.slice(1)];
}
function halfWidthAt(half, y) {
  let best = 0;
  for (let i = 0; i < half.length - 1; i++) {
    const a = half[i], b = half[i + 1];
    if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const t = (y - a[1]) / (b[1] - a[1]); best = Math.max(best, a[0] + (b[0] - a[0]) * t); }
  }
  return best;
}
function celloTextures(ctx) {
  // spruce top under an amber-red oil varnish: straight fine grain along the body, wider toward the flanks
  const top = ctx.textures.generate('music:cellotop3', {
    size: 1024, normalStrength: 0.12, tile: false,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float x = uv.y - 0.5;                                   // across (v), 0 = centre joint
  float w = fbm(vec2(uv.x * 3.0, uv.y * 2.0), vec2(3.0, 2.0), 3) * 0.004;
  float g = abs(x) + w;
  float spacing = mix(0.0045, 0.009, smoothstep(0.0, 0.5, abs(x)));
  float line = smoothstep(0.55, 1.0, sin(g / spacing * 6.2831) * 0.5 + 0.5);
  vec3 varnish = mix(vec3(0.36, 0.13, 0.045), vec3(0.52, 0.23, 0.075), 0.5 + 0.5 * fbm(uv * vec2(2.0, 3.0), vec2(2.0, 3.0), 4));
  // worn / burnished centre where the player's knees and bow have rubbed through to the amber ground
  float wear = smoothstep(0.24, 0.0, length((uv - vec2(0.42, 0.5)) * vec2(1.0, 1.4)));
  varnish = mix(varnish, vec3(0.66, 0.38, 0.14), wear * 0.35);
  // antiqued: the varnish pools darker toward the edges and the C-bouts, a little patchy
  float edgeD = smoothstep(0.18, 0.5, abs(x)) * 0.45 + 0.25 * smoothstep(0.3, 0.0, abs(uv.x - 0.5)) * smoothstep(0.25, 0.45, abs(x));
  varnish *= (1.0 - edgeD) * (0.88 + 0.2 * fbm(uv * vec2(5.0, 9.0) + 2.0, vec2(5.0, 9.0), 3));
  vec3 col = varnish * (1.0 - 0.12 * line);
  s.albedo = col; s.height = 0.5 - 0.08 * line; s.rough = 0.3 + 0.08 * line; s.metal = 0.0; s.ao = 1.0;
}`,
  });
  // one-piece flamed maple back + ribs: grain along the body, tiger flames sweeping across it
  const back = ctx.textures.generate('music:celloback2', {
    size: 1024, normalStrength: 0.1, tile: true,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float x = uv.y - 0.5;
  float wav = fbm(vec2(uv.x * 4.0, uv.y * 3.0), vec2(4.0, 3.0), 3);
  float flame = sin((uv.x * 26.0 + abs(x) * 9.0 + wav * 2.2) * 6.2831) * 0.5 + 0.5;
  flame = smoothstep(0.25, 0.85, flame);
  float grain = sin((uv.y * 140.0 + wav * 6.0) * 6.2831) * 0.5 + 0.5;
  vec3 dark = vec3(0.3, 0.1, 0.035), light = vec3(0.6, 0.29, 0.1);
  vec3 col = mix(dark, light, 0.25 + 0.6 * flame) * (0.93 + 0.07 * grain);
  s.albedo = col; s.height = 0.5 + 0.03 * flame; s.rough = 0.3; s.metal = 0.0; s.ao = 1.0;
}`,
  });
  // f-hole mask (alpha): canvas in body space, x in [-0.25, 0.25], y in [0, L]
  const W = 512, H = 1024;
  const mask = ctx.textures.canvas('music:cellofholes', W, H, (g) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const P = (x, y) => [((x + 0.25) / 0.5) * W, (1 - y / CELLO_L) * H];
    const S = W / 0.5;
    g.fillStyle = '#000';
    for (const s of [-1, 1]) {
      // eyes: the upper one nearer the centre line, the lower one wider and lower
      const up = [s * 0.073, 0.428], lo = [s * 0.098, 0.268];
      g.beginPath(); g.arc(...P(...up), 0.0062 * S, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(...P(...lo), 0.0072 * S, 0, Math.PI * 2); g.fill();
      // the stem: a long S, wider in the middle, tapering into each eye
      const N = 40, left = [], right = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const y = lo[1] + (up[1] - lo[1]) * t;
        const x = lo[0] + (up[0] - lo[0]) * (t - 0.18 * Math.sin(t * Math.PI * 2) * 1.0) + s * 0.006 * Math.sin(t * Math.PI * 2);
        const w = 0.0016 + 0.0026 * Math.sin(Math.PI * t);
        left.push(P(x - w, y)); right.push(P(x + w, y));
      }
      g.beginPath(); g.moveTo(...left[0]); for (const p of left) g.lineTo(...p); for (let i = right.length - 1; i >= 0; i--) g.lineTo(...right[i]); g.closePath(); g.fill();
      // the nicks at the waist of the f
      const mid = [lo[0] + (up[0] - lo[0]) * 0.5, (lo[1] + up[1]) / 2];
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(...P(mid[0] + sd * 0.0035, mid[1] + 0.003)); g.lineTo(...P(mid[0] + sd * 0.0085, mid[1])); g.lineTo(...P(mid[0] + sd * 0.0035, mid[1] - 0.003)); g.closePath(); g.fill(); }
    }
  }, { tile: false, srgb: false });
  return { top, back, mask };
}

export function buildCello(ctx, { wood, ebony, giltPlain }) {
  const { geometry: G } = ctx;
  void wood; void giltPlain;
  const g = new THREE.Group();
  g.name = 'cello';
  const L = CELLO_L, RIB = 0.118;
  const half = celloHalfOutline();
  const hw = (y) => halfWidthAt(half, y);
  const tex = celloTextures(ctx);
  // oil varnish: a deep glassy coat over the wood, so the arching carries a moving highlight
  const varnishOpts = { roughness: 1, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.14, envMapIntensity: 0.6, sheen: 0.0 };
  const topMat = new THREE.MeshPhysicalMaterial({ map: tex.top.map, normalMap: tex.top.normalMap, roughnessMap: tex.top.roughnessMap, alphaMap: tex.mask, alphaTest: 0.5, side: THREE.DoubleSide, ...varnishOpts });
  const backMat = new THREE.MeshPhysicalMaterial({ map: tex.back.map, normalMap: tex.back.normalMap, roughnessMap: tex.back.roughnessMap, side: THREE.DoubleSide, ...varnishOpts });
  const arch = (u, y) => 0.021 * Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.85) * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, y / L)))), 0.45);
  // ---- arched plates (grid meshes so they can carry the arching), planar UVs along the body
  const plate = (sgn, mat, inset = 0) => {
    const NY = 150, NX = 44, pos = [], uv = [], idx = [];
    for (let j = 0; j <= NY; j++) {
      const y = 0.002 + (L - 0.004) * (j / NY);
      const w = Math.max(0.004, hw(y) + 0.003 - inset);
      for (let i = 0; i <= NX; i++) {
        const u = i / NX, x = (u * 2 - 1) * w;
        pos.push(x, y, sgn * (RIB / 2 + arch(u, y) - inset * 0.6));
        uv.push(y / L, (x + 0.25) / 0.5);
      }
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + NX + 1;
      if (sgn > 0) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };
  // the alpha mask is laid out with u across, v along: swap so it lines up with the plate UVs
  tex.mask.center.set(0.5, 0.5); tex.mask.rotation = 0; tex.mask.matrixAutoUpdate = false;
  tex.mask.matrix.set(0, 1, 0, 1, 0, 0, 0, 0, 1);   // (u, v) -> (v, u)
  g.add(plate(1, topMat));
  g.add(plate(-1, backMat));
  // dark interior seen through the f-holes
  const inside = plate(1, new THREE.MeshBasicMaterial({ color: 0x0a0503 }), 0.012);
  g.add(inside);
  // ---- ribs: a ring round the outline
  {
    const loop = [...half, ...half.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
    const pos = [], uv = [], idx = [];
    let acc = 0;
    for (let i = 0; i <= loop.length; i++) {
      const p = loop[i % loop.length];
      if (i > 0) { const q = loop[i - 1]; acc += Math.hypot(p[0] - q[0], p[1] - q[1]); }
      pos.push(p[0], p[1], -RIB / 2, p[0], p[1], RIB / 2);
      uv.push(acc, 0.45, acc, 0.55);
    }
    for (let i = 0; i < loop.length; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, backMat));
    // purfling: a fine black inlay just inside the edge of both plates
    const purf = new THREE.MeshStandardMaterial({ color: 0x0a0604, roughness: 0.4 });
    for (const sgn of [-1, 1]) {
      const pts = [];
      for (let i = 0; i < half.length; i += 2) { const [x, y] = half[i]; if (y < 0.006 || y > L - 0.006) continue; pts.push(new THREE.Vector3(x - 0.0045, y, sgn * (RIB / 2 + 0.0012))); }
      const all = [...pts, ...pts.slice().reverse().map((p) => new THREE.Vector3(-p.x, p.y, p.z))];
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(all, true), 300, 0.0011, 4, true), purf));
    }
  }
  const topZ = (y) => RIB / 2 + arch(0.5, y);
  // ---- neck, fingerboard (ebony, dead centre), nut
  const ebonyMat = new THREE.MeshPhysicalMaterial({ color: 0x0c0a09, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.8 });
  const neckLen = 0.28, nutY = L + neckLen;
  {
    const neck = new THREE.Mesh(new G.RoundedBoxGeometry(0.034, neckLen + 0.03, 0.04, 3, 0.014), backMat);
    neck.position.set(0, L + neckLen / 2 - 0.005, RIB / 2 - 0.004); g.add(neck);
    const heel = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.024, 0], [0.02, 0.03], [0.0, 0.05]], 16), backMat);
    heel.rotation.x = Math.PI; heel.position.set(0, L + 0.02, RIB / 2 - 0.035); heel.scale.set(1, 1, 0.7); g.add(heel);
    // fingerboard: tapered, cambered, raised over the top toward the bridge
    const fbLen = 0.58, y0 = nutY - fbLen;
    const shape = new THREE.Shape();
    shape.moveTo(-0.0155, nutY); shape.lineTo(0.0155, nutY); shape.lineTo(0.022, y0); shape.lineTo(-0.022, y0); shape.closePath();
    const fg = new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2 });
    const p = fg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), t = (y - y0) / fbLen;
      const camber = 0.004 * (1 - Math.pow(p.getX(i) / 0.022, 2));
      p.setZ(i, p.getZ(i) + (p.getZ(i) > 0.005 ? camber : 0) + RIB / 2 + 0.016 + (1 - t) * 0.02 + (t * 0.0));
    }
    fg.computeVertexNormals();
    g.add(new THREE.Mesh(fg, ebonyMat));
    const nut = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.006, 0.008), ebonyMat);
    nut.position.set(0, nutY, RIB / 2 + 0.032); g.add(nut);
  }
  // ---- pegbox + scroll, angled back
  const head = new THREE.Group();
  head.position.set(0, nutY, RIB / 2 + 0.01); head.rotation.x = -0.32;
  {
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new G.RoundedBoxGeometry(0.008, 0.17, 0.042, 2, 0.003), backMat);
      cheek.position.set(s * 0.017, 0.085, -0.012); head.add(cheek);
    }
    const floorB = new THREE.Mesh(new G.RoundedBoxGeometry(0.034, 0.17, 0.008, 2, 0.003), backMat);
    floorB.position.set(0, 0.085, -0.03); head.add(floorB);
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.16), new THREE.MeshBasicMaterial({ color: 0x0a0503 }));
    dark.position.set(0, 0.085, -0.025); head.add(dark);
    // scroll: a tapering tube wound in an Archimedean spiral (2.3 turns), wide across
    const spiral = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, a = t * Math.PI * 2 * 2.3, r = 0.034 * (1 - 0.8 * t);
      spiral.push(new THREE.Vector3(0, 0.205 + r * Math.cos(a) - 0.034 * 0.0, -0.012 - r * Math.sin(a) + 0.0));
    }
    const sg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral), 240, 1, 10, false);
    {
      const pp = sg.attributes.position, path = new THREE.CatmullRomCurve3(spiral);
      // taper the tube radius along the spiral, and widen it across (x) into a volute
      for (let i = 0; i < pp.count; i++) {
        const k = Math.floor(i / 11) / 240;
        const c = path.getPoint(Math.min(1, k));
        const dx = pp.getX(i) - c.x, dy = pp.getY(i) - c.y, dz = pp.getZ(i) - c.z;
        const r = 0.011 * (1 - 0.7 * k) + 0.002;
        pp.setXYZ(i, c.x + dx * r * 2.0, c.y + dy * r, c.z + dz * r);
      }
      sg.computeVertexNormals();
    }
    head.add(new THREE.Mesh(sg, backMat));
    // four pegs, heads alternating sides
    for (let i = 0; i < 4; i++) {
      const s = i % 2 ? 1 : -1;
      const peg = new THREE.Mesh(G.latheFromProfile([[0.004, 0], [0.005, 0.045], [0.009, 0.05], [0.017, 0.058], [0.018, 0.075], [0.008, 0.082], [0, 0.083]], 12), ebonyMat);
      peg.rotation.z = -s * Math.PI / 2;
      peg.position.set(-s * 0.022, 0.03 + i * 0.033, -0.012); head.add(peg);
    }
  }
  g.add(head);
  // ---- bridge: carved maple, heart and kidney cut-outs, feet following the arching
  const bridgeY = 0.348;
  {
    const sh = new THREE.Shape();
    sh.moveTo(-0.046, 0); sh.lineTo(-0.03, 0); sh.quadraticCurveTo(-0.022, 0.016, -0.008, 0.022); sh.quadraticCurveTo(0, 0.025, 0.008, 0.022);
    sh.quadraticCurveTo(0.022, 0.016, 0.03, 0); sh.lineTo(0.046, 0); sh.lineTo(0.044, 0.04); sh.quadraticCurveTo(0.034, 0.055, 0.043, 0.072);
    sh.quadraticCurveTo(0.02, 0.094, 0, 0.096); sh.quadraticCurveTo(-0.02, 0.094, -0.043, 0.072); sh.quadraticCurveTo(-0.034, 0.055, -0.044, 0.04); sh.closePath();
    const heart = new THREE.Path(); heart.absellipse(0, 0.05, 0.0065, 0.0095, 0, Math.PI * 2, true); sh.holes.push(heart);
    for (const s of [-1, 1]) { const k = new THREE.Path(); k.absellipse(s * 0.024, 0.06, 0.0065, 0.0035, 0, Math.PI * 2, true); sh.holes.push(k); }
    const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.001, bevelSegments: 1, curveSegments: 10 });
    bg.translate(0, 0, -0.003);
    bg.rotateX(Math.PI / 2); bg.rotateX(-Math.PI / 2);   // keep in XY, facing +z... (stands upright on the top)
    const bridge = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: 0xc9a26a, roughness: 0.6 }));
    // stand it up: shape XY -> local X (across) and Z (height off the plate)
    bridge.rotation.x = Math.PI / 2; bridge.position.set(0, bridgeY, topZ(bridgeY) - 0.001);
    bridge.rotation.set(Math.PI / 2, 0, 0); bridge.scale.set(1, 1, -1);
    g.add(bridge);
  }
  // ---- tailpiece, tail gut, endpin
  const tailTop = 0.24, tailBot = 0.03;
  {
    const sh = new THREE.Shape();
    sh.moveTo(-0.029, tailTop); sh.quadraticCurveTo(0, tailTop + 0.008, 0.029, tailTop); sh.lineTo(0.016, tailBot); sh.quadraticCurveTo(0, tailBot - 0.006, -0.016, tailBot); sh.closePath();
    const tg = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
    const p = tg.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) + topZ(y) + 0.012 + (y - tailBot) * 0.04); }
    tg.computeVertexNormals();
    g.add(new THREE.Mesh(tg, ebonyMat));
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.012), ebonyMat);
    saddle.position.set(0, 0.004, RIB / 2 + 0.004); g.add(saddle);
  }
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.3, metalness: 1 }));
  pin.position.set(0, -0.1, 0); g.add(pin);
  const button = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.02, 0], [0.022, 0.012], [0.012, 0.02], [0, 0.02]], 14), ebonyMat);
  button.rotation.x = Math.PI; button.position.set(0, 0.012, 0); g.add(button);
  // ---- strings: tailpiece -> bridge crown -> nut, then into the pegbox (A D G C)
  {
    const strMat = new THREE.MeshStandardMaterial({ color: 0xe0d8c8, roughness: 0.22, metalness: 0.9, envMapIntensity: 1.6 });
    const bridgeTop = topZ(bridgeY) + 0.094;
    for (let i = 0; i < 4; i++) {
      const o = (i - 1.5);
      const r = 0.0006 + 0.00025 * i;
      const pts = [
        new THREE.Vector3(o * 0.011, tailTop - 0.01, topZ(tailTop) + 0.022),
        new THREE.Vector3(o * 0.0118, bridgeY, bridgeTop + 0.003 - Math.abs(o) * 0.004),
        new THREE.Vector3(o * 0.0058, nutY, RIB / 2 + 0.036),
        new THREE.Vector3(o * 0.004, nutY + 0.03, RIB / 2 + 0.02),
      ];
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1], len = a.distanceTo(b);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 5), strMat);
        s.position.copy(a).lerp(b, 0.5); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        g.add(s);
      }
    }
  }
  // ---- the bow, leaning beside it: octagonal pernambuco stick, ebony frog, pale horsehair
  {
    const bow = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0055, 0.72, 8), new THREE.MeshPhysicalMaterial({ color: 0x3a1608, roughness: 0.35, clearcoat: 0.6 }));
    stick.position.y = 0.36; bow.add(stick);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.66, 0.0012), new THREE.MeshStandardMaterial({ color: 0xe0d8c6, roughness: 0.85 }));
    hair.position.set(0, 0.37, 0.016); bow.add(hair);
    const frog = new THREE.Mesh(new G.RoundedBoxGeometry(0.014, 0.045, 0.022, 2, 0.004), ebonyMat);
    frog.position.set(0, 0.035, 0.009); bow.add(frog);
    const tip = new THREE.Mesh(new G.RoundedBoxGeometry(0.008, 0.02, 0.02, 2, 0.003), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.5 }));
    tip.position.set(0, 0.715, 0.008); bow.add(tip);
    bow.position.set(0.25, -0.1, 0.02); bow.rotation.set(0.05, 0.4, -0.2);
    g.add(bow);
  }
  return g;
}

/** Wrought brass music stand with a lyre desk and a score. */
export function buildMusicStand(ctx, { brass, seed = 7 }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'musicstand';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(G.sweepProfile([new THREE.Vector2(-0.006, -0.006), new THREE.Vector2(0.006, -0.006), new THREE.Vector2(0.006, 0.006), new THREE.Vector2(-0.006, 0.006), new THREE.Vector2(-0.006, -0.006)], [
      new THREE.Vector3(0, 0.32, 0), new THREE.Vector3(0.1, 0.12, 0), new THREE.Vector3(0.24, 0.02, 0), new THREE.Vector3(0.27, 0.0, 0),
    ]), brass);
    leg.rotation.y = a; g.add(leg);
  }
  const shaft = new THREE.Mesh(G.latheFromProfile([[0.016, 0.3], [0.02, 0.33], [0.009, 0.36], [0.009, 1.0], [0.014, 1.02], [0.006, 1.06]], 12), brass);
  g.add(shaft);
  const desk = new THREE.Group();
  const frame = new THREE.Mesh(G.frameGeometry(0.5, 0.32, { width: 0.012, depth: 0.008, uvScale: 2 }), brass);
  desk.add(frame);
  // lyre bars
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.004, 6, 24, Math.PI), brass);
    c.position.set(s * 0.11, -0.02, 0); c.rotation.z = s > 0 ? 0 : 0; desk.add(c);
  }
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.008, 0.04), brass);
  ledge.position.set(0, -0.165, 0.018); desk.add(ledge);
  // an open folio: two pages bowing away from the spine, outer corners lifting
  for (const sx of [-1, 1]) {
    const pg = new THREE.PlaneGeometry(0.225, 0.31, 12, 6);
    const p = pg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) / 0.225 + 0.5);         // 0 at spine side (after mirroring) -> 1 outer
      const uu = sx < 0 ? 1 - u : u;
      const v = p.getY(i) / 0.31 + 0.5;
      p.setZ(i, 0.018 * Math.sin(uu * Math.PI * 0.85) + 0.012 * uu * uu * (v > 0.75 ? (v - 0.75) * 4 : 0));
    }
    pg.computeVertexNormals();
    const page = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: sheetMusicTexture(ctx.textures, { seed: seed + (sx > 0 ? 1 : 0), title: sx < 0 ? 'Danse des Ombres' : '' }), roughness: 0.85, side: THREE.DoubleSide }));
    page.position.set(sx * 0.1135, 0.0, 0.01);
    desk.add(page);
  }
  desk.position.set(0, 1.18, 0.03); desk.rotation.x = -0.35;
  g.add(desk);
  return g;
}

/** Duet piano bench: tufted velvet seat on cabriole legs. */
export function buildBench(ctx, { ebony, velvet }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'bench';
  // domed, button-tufted cushion
  const cg = new G.RoundedBoxGeometry(0.88, 0.08, 0.37, 6, 0.035);
  {
    const tufts = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) tufts.push([-0.3 + i * 0.2, -0.08 + j * 0.16]);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y <= 0) continue;
      const dome = Math.max(0, 1 - (x / 0.44) ** 4) * Math.max(0, 1 - (z / 0.185) ** 4);
      let dy = dome * 0.022;
      for (const [tx, tz] of tufts) dy -= 0.012 * Math.exp(-((x - tx) ** 2 + (z - tz) ** 2) / 0.0006);
      p.setY(i, y + dy * (y / 0.04));
    }
    cg.computeVertexNormals();
  }
  const seat = new THREE.Mesh(cg, velvet);
  seat.position.y = 0.5; g.add(seat);
  const frame = new THREE.Mesh(new G.RoundedBoxGeometry(0.92, 0.075, 0.4, 2, 0.01), ebony);
  frame.position.y = 0.445; g.add(frame);
  const apron = new THREE.Mesh(G.sweepProfile([new THREE.Vector2(0, 0), new THREE.Vector2(0.012, 0.0), new THREE.Vector2(0.016, 0.02), new THREE.Vector2(0.008, 0.035), new THREE.Vector2(0, 0.04)],
    [new THREE.Vector3(-0.46, 0.39, -0.2), new THREE.Vector3(0.46, 0.39, -0.2), new THREE.Vector3(0.46, 0.39, 0.2), new THREE.Vector3(-0.46, 0.39, 0.2)], { closed: true, uvScale: 2 }), ebony);
  g.add(apron);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), velvet);
    b.position.set(-0.3 + i * 0.2, 0.531, -0.08 + j * 0.16); g.add(b);
  }
  const legProfile = [new THREE.Vector2(-0.018, -0.018), new THREE.Vector2(0.018, -0.018), new THREE.Vector2(0.018, 0.018), new THREE.Vector2(-0.018, 0.018), new THREE.Vector2(-0.018, -0.018)];
  for (const [x, z] of [[-0.4, -0.15], [0.4, -0.15], [-0.4, 0.15], [0.4, 0.15]]) {
    const sx = Math.sign(x), sz = Math.sign(z);
    const path = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; const bow = Math.sin(t * Math.PI * 1.2) * 0.035 - t * t * 0.03; path.push(new THREE.Vector3(x + sx * bow, 0.42 - t * 0.41, z + sz * bow)); }
    const leg = new THREE.Mesh(G.sweepProfile(legProfile.map((p) => p.clone().multiplyScalar(1)), path, { up: new THREE.Vector3(0, 0, 1) }), ebony);
    g.add(leg);
  }
  return g;
}
