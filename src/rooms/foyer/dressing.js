import * as THREE from 'three';

/**
 * Foyer set dressing: the lived-in clutter of a Victorian hall. Every builder returns
 * a Group in local space (origin on the floor, front facing +Z).
 */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function rnd(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// -------------------------------------------------------------------- foliage
/** dark glossy foliage material, shared */
let leafMat = null;
function foliageMaterial(ctx) {
  if (leafMat) return leafMat;
  const tex = ctx.textures.canvas('foyer:frond', 64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#0d1a0c'); gr.addColorStop(0.45, '#25391b'); gr.addColorStop(0.5, '#4a5a2a'); gr.addColorStop(0.55, '#25391b'); gr.addColorStop(1, '#0d1a0c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${i % 2 ? '60,70,30' : '5,10,5'},0.25)`; g.fillRect(0, (i / 40) * h, w, 1.5); }
  }, { tile: false });
  leafMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xb8c4a8, roughness: 0.55, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.6 });
  return leafMat;
}

/** Kentia-style parlour palm: arching fronds of drooping leaflets (one merged mesh) */
export function palmFronds(ctx, { fronds = 11, height = 1.5, spread = 0.9, seed = 3 } = {}) {
  const r = rnd(seed);
  const pos = [], uv = [], idx = [];
  const quad = (a, b, c, d, v0, v1) => {
    const i = pos.length / 3;
    for (const p of [a, b, c, d]) pos.push(p.x, p.y, p.z);
    uv.push(0, v0, 1, v0, 1, v1, 0, v1);
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  const stems = [];
  for (let f = 0; f < fronds; f++) {
    const az = (f / fronds) * Math.PI * 2 + r() * 0.5;
    const tilt = 0.25 + r() * 0.75;                     // 0 upright .. 1 arching out
    const len = height * (0.7 + r() * 0.4);
    const dir = V3(Math.cos(az), 0, Math.sin(az));
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const out = Math.sin(t * Math.PI * 0.5) * spread * tilt * t * 1.2;
      const up = t * len * (1 - tilt * 0.35) - t * t * len * tilt * 0.55;
      pts.push(dir.clone().multiplyScalar(out).add(V3(0, up, 0)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    stems.push(new THREE.TubeGeometry(curve, 16, 0.006, 4, false));
    const side = V3(-dir.z, 0, dir.x);
    const n = 26;
    for (let k = 3; k < n; k++) {
      const t = k / n;
      const p = curve.getPoint(t), tan = curve.getTangent(t);
      const ll = (0.22 + 0.14 * Math.sin(t * Math.PI)) * (1 - t * 0.45) * len / 1.4;
      for (const sd of [-1, 1]) {
        // leaflet: narrow strip drooping from the rachis
        const out = side.clone().multiplyScalar(sd);
        const droop = V3(0, -1, 0);
        const w = 0.016;
        const a = p.clone(), b = p.clone().addScaledVector(tan, w * 2);
        const mid = out.clone().multiplyScalar(ll * 0.55).addScaledVector(droop, ll * 0.25);
        const tip = out.clone().multiplyScalar(ll * 0.85).addScaledVector(droop, ll * 0.75).addScaledVector(tan, -ll * 0.15);
        const c1 = b.clone().add(mid), d1 = a.clone().add(mid);
        quad(a, b, c1, d1, 0, 0.6);
        const tp = a.clone().add(tip);
        quad(d1, c1, tp.clone().addScaledVector(tan, 0.004), tp, 0.6, 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(g, foliageMaterial(ctx)));
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2a3418, roughness: 0.7 });
  group.add(new THREE.Mesh(ctx.geometry.mergeGeometries(stems.map((s) => s.toNonIndexed())), stemMat));
  return group;
}

/** marble pedestal + brass jardinière + palm */
export function palmOnPedestal(ctx, { marble, brass, seed = 3, pedH = 0.78, palmH = 1.4 }) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'palm';
  const ped = G.latheFromProfile([[0.2, 0], [0.2, 0.06], [0.17, 0.08], [0.16, 0.12], [0.12, 0.16], [0.105, 0.2], [0.1, pedH - 0.14], [0.13, pedH - 0.1], [0.17, pedH - 0.05], [0.19, pedH - 0.03], [0.19, pedH], [0, pedH]], 8);
  ped.rotateY(Math.PI / 8);
  g.add(new THREE.Mesh(ped, marble));
  const pot = G.latheFromProfile([[0, 0], [0.1, 0], [0.11, 0.02], [0.09, 0.04], [0.13, 0.08], [0.19, 0.16], [0.21, 0.26], [0.2, 0.32], [0.22, 0.34], [0.215, 0.36], [0.19, 0.35], [0.0, 0.33]], 32);
  const potM = new THREE.Mesh(pot, brass); potM.position.y = pedH; g.add(potM);
  // lion-mask ring handles
  for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 6, 16), brass); h.position.set(sx * 0.215, pedH + 0.22, 0); h.rotation.y = Math.PI / 2; g.add(h); }
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.19, 20), new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 1 }));
  soil.rotation.x = -Math.PI / 2; soil.position.y = pedH + 0.33; g.add(soil);
  const palm = palmFronds(ctx, { height: palmH, spread: palmH * 0.6, seed });
  palm.position.y = pedH + 0.3; g.add(palm);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// -------------------------------------------------------------------- hall stand
/** walnut hall stand: mirror in a carved frame, coat hooks, a glove box and umbrella wells (2.2 m) */
export function hallStand(ctx, { wood, brass, mirrorMat, tile, hats = true }) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'hallStand';
  const RB = (w, h, d, r = 0.006) => new G.RoundedBoxGeometry(w, h, d, 2, r);
  const box = (w, h, d, x, y, z, m = wood) => { const b = new THREE.Mesh(RB(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  const W = 1.0;
  // uprights
  for (const sx of [-1, 1]) {
    const up = G.latheFromProfile([[0.032, 0], [0.032, 0.06], [0.024, 0.08], [0.026, 0.3], [0.035, 0.36], [0.024, 0.42], [0.024, 1.6], [0.032, 1.64], [0.024, 1.68], [0.024, 2.02], [0.034, 2.06], [0.012, 2.16], [0, 2.18]], 10);
    const m = new THREE.Mesh(up, wood); m.position.set(sx * (W / 2 - 0.03), 0, 0.0); g.add(m);
  }
  // base with umbrella wells (drip trays in the tile)
  box(W, 0.05, 0.3, 0, 0.05, 0.04);
  for (const sx of [-1, 1]) { const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.04, 20), brass); tray.position.set(sx * 0.3, 0.095, 0.06); g.add(tray); }
  box(W - 0.06, 0.03, 0.04, 0, 0.62, 0.12);      // umbrella rail
  // glove box + marble shelf
  box(0.56, 0.16, 0.3, 0, 0.84, 0.05);
  box(0.62, 0.025, 0.34, 0, 0.935, 0.06, tile || wood);
  const pull = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 14, Math.PI), brass); pull.position.set(0, 0.84, 0.205); pull.rotation.z = Math.PI; g.add(pull);
  // back board + mirror
  box(W - 0.04, 1.05, 0.03, 0, 1.5, -0.03);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.72), mirrorMat); mirror.position.set(0, 1.5, -0.01); g.add(mirror);
  const mf = new THREE.Mesh(G.frameGeometry(0.56, 0.72, { width: 0.06, depth: 0.04, uvScale: 1 }), wood); mf.position.set(0, 1.5, -0.012); g.add(mf);
  // carved crest
  const crest = new THREE.Shape();
  crest.moveTo(-W / 2, 0); crest.bezierCurveTo(-0.3, 0.06, -0.2, 0.22, 0, 0.24); crest.bezierCurveTo(0.2, 0.22, 0.3, 0.06, W / 2, 0); crest.lineTo(-W / 2, 0);
  const cg = G.applyBoxUVs(new THREE.ExtrudeGeometry(crest, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 14 }), 1);
  const cm = new THREE.Mesh(cg, wood); cm.position.set(0, 2.02, -0.04); g.add(cm);
  // brass hat & coat hooks
  const hookGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, 0, 0), V3(0, 0.02, 0.06), V3(0, 0.07, 0.1), V3(0, 0.1, 0.08)]), 10, 0.006, 6, false);
  for (const [x, y] of [[-0.42, 1.95], [-0.38, 1.25], [0.38, 1.25], [0.42, 1.95], [-0.38, 1.7], [0.38, 1.7]]) { const h = new THREE.Mesh(hookGeo, brass); h.position.set(x, y, 0.0); g.add(h); }
  if (hats) {
    // a black top hat and a grey overcoat left by the last guest
    const hat = new THREE.Group();
    const felt = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.5 });
    hat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.16, 24), felt));
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.008, 28), felt); brim.position.y = -0.08; brim.scale.z = 0.85; hat.add(brim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.081, 0.03, 24), new THREE.MeshStandardMaterial({ color: 0x1a0f12, roughness: 0.3 })); band.position.y = -0.055; hat.add(band);
    hat.position.set(0.43, 2.08, 0.12); hat.rotation.set(0.2, 0, -0.25); g.add(hat);
    const coat = ctx.geometry.curtainGeometry({ width: 0.34, height: 0.95, folds: 5, depth: 0.05, seed: 7 });
    fixNaNGeo(coat, 140);
    const cMesh = new THREE.Mesh(coat, new THREE.MeshStandardMaterial({ color: 0x1d1d22, roughness: 0.95, side: THREE.DoubleSide }));
    cMesh.position.set(-0.38, 1.72, 0.1); g.add(cMesh);
  }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

function fixNaNGeo(g) {
  const a = g.attributes.position.array;
  const row = (g.parameters?.widthSegments ?? 140) + 1;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) a[i] = Number.isFinite(a[i + row * 3]) ? a[i + row * 3] : 0;
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// -------------------------------------------------------------------- umbrella stand
export function umbrellaStand(ctx, { brass, porcelain }) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'umbrellaStand';
  // a rouleau jar: the outer glaze is one lathe whose v runs foot -> lip so the decoration sits upright
  const prof = [[0.12, 0.0], [0.132, 0.012], [0.128, 0.03], [0.118, 0.06], [0.116, 0.2], [0.122, 0.38], [0.134, 0.5], [0.138, 0.56], [0.13, 0.6], [0.128, 0.62], [0.142, 0.645], [0.148, 0.655]];
  const body = G.latheFromProfile(prof, 48);
  const uv = body.attributes.uv, bp = body.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setY(i, bp.getY(i) / 0.655);
  g.add(new THREE.Mesh(body, porcelain));
  const inner = G.latheFromProfile([[0.0, 0.08], [0.11, 0.08], [0.11, 0.3], [0.12, 0.6], [0.14, 0.652]].map(([r, y]) => [r - 0.004, y]), 32);
  const innerM = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.5, side: THREE.BackSide });
  g.add(new THREE.Mesh(inner, innerM));
  const foot = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.12, 0], [0.12, 0.004], [0, 0.004]], 32), new THREE.MeshStandardMaterial({ color: 0x8a7a62, roughness: 0.8 })); g.add(foot);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.146, 0.006, 8, 48), brass); rim.rotation.x = Math.PI / 2; rim.position.y = 0.655; g.add(rim);
  // two umbrellas and a silver-topped cane
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.6, side: THREE.DoubleSide });
  for (const [x, z, rx, rz] of [[0.04, 0.02, 0.1, -0.12], [-0.05, -0.03, -0.08, 0.15]]) {
    const u = new THREE.Group();
    const furl = G.latheFromProfile([[0, 0], [0.012, 0.05], [0.035, 0.25], [0.03, 0.55], [0.014, 0.75], [0.008, 0.8], [0, 0.8]], 8);
    u.add(new THREE.Mesh(furl, black));
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 6), brass); shaft.position.y = 0.88; u.add(shaft);
    const crook = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 6, 14, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2a1508, roughness: 0.35 })); crook.position.set(0.04, 0.97, 0); u.add(crook);
    u.position.set(x, 0.05, z); u.rotation.set(rx, 0, rz); g.add(u);
  }
  const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.007, 0.95, 8), new THREE.MeshStandardMaterial({ color: 0x1a0d06, roughness: 0.3 }));
  cane.position.set(0.0, 0.5, 0.06); cane.rotation.x = -0.12; g.add(cane);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), ctx.materials.basic('silver', { roughness: 0.3 })); knob.position.set(0.0, 0.98, 0.002); g.add(knob);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// -------------------------------------------------------------------- bench
/** upholstered hall bench with turned legs (1.3 m) */
export function hallBench(ctx, { wood, velvet, brass }) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'bench';
  const L = 1.3, D = 0.42;
  const leg = G.latheFromProfile([[0.0, 0], [0.022, 0], [0.026, 0.03], [0.02, 0.06], [0.026, 0.14], [0.03, 0.2], [0.022, 0.26], [0.03, 0.3], [0.032, 0.38], [0, 0.38]], 12);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const m = new THREE.Mesh(leg, wood); m.position.set(sx * (L / 2 - 0.05), 0, sz * (D / 2 - 0.05)); g.add(m); }
  const rail = new THREE.Mesh(new G.RoundedBoxGeometry(L, 0.08, D, 2, 0.01), wood); rail.position.y = 0.41; g.add(rail);
  const seat = new THREE.Mesh(new G.RoundedBoxGeometry(L - 0.04, 0.09, D - 0.04, 4, 0.04), velvet); seat.position.y = 0.49; g.add(seat);
  // buttons
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), velvet); b.position.set(-L / 2 + 0.17 + i * ((L - 0.34) / 5), 0.535, (j - 0.5) * 0.17); g.add(b); }
  const str = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, L - 0.1, 8), wood); str.rotation.z = Math.PI / 2; str.position.y = 0.12; g.add(str);
  for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), brass); f.position.set(sx * (L / 2 - 0.05), 0.01, 0); f.scale.y = 0.5; void f; }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// -------------------------------------------------------------------- drape
/**
 * A tied-back velvet drape. Local space: the OUTER (wall-side) edge hangs at x = 0, the leading edge
 * runs out to +x; top at y = 0, hanging to -height; folds in +-z around z = 0. Folds compress and deepen
 * where the fabric is gathered at the tie-back, then fan out below it and break on the floor.
 */
export function drapeGeometry({ width = 0.8, height = 3, folds = 7, depth = 0.07, tie = 0.55, gather = 0.28, flare = 0.55, pool = 0.06, seed = 1 } = {}) {
  const r = rnd(seed);
  const cols = 120, rows = 90;
  const phases = Array.from({ length: 4 }, () => r() * Math.PI * 2);
  const pos = [], uv = [], idx = [];
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;                       // 0 top .. 1 bottom
    const g = v < tie ? 1 + (gather - 1) * sm(0, tie, v) ** 0.8 : gather + (flare - gather) * sm(tie, 1, v);
    const amp = depth * Math.min(2.4, Math.pow(1 / g, 0.6));
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      // the leading edge sweeps in a curve towards the tie-back
      const x = u * width * g + (v > tie ? 0 : 0) ;
      const ph = u * folds * Math.PI * 2;
      let z = amp * (0.62 * Math.sin(ph + phases[0]) + 0.25 * Math.sin(ph * 2.03 + phases[1]) + 0.13 * Math.sin(ph * 0.5 + phases[2] + v * 2.0));
      // header pleats: crisp at the top
      z *= 0.55 + 0.45 * sm(0.0, 0.06, v);
      let y = -v * height;
      // the hem breaks on the floor
      if (v > 1 - pool / height * 3) { z += (v - (1 - pool / height * 3)) * 0.4 * Math.sin(ph * 1.5 + phases[3]); }
      pos.push(x, y, z); uv.push(u * width * 2.0, v * height);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** heavy silk-velvet: deep pile with a strong grazing sheen (the folds read by their bright ridges) */
export function velvetDrapeMaterial(ctx, color = [0.16, 0.018, 0.03], sheen = [0.75, 0.22, 0.24]) {
  const base = ctx.materials.create('velvet', { color, crush: 0.5, repeat: [1.5, 1.5], physical: true, side: THREE.DoubleSide });
  base.sheen = 1; base.sheenRoughness = 0.42; base.sheenColor = new THREE.Color(...sheen);
  base.roughness = 0.9; base.envMapIntensity = 0.35;
  return base;
}

// -------------------------------------------------------------------- portières
/** a pair of heavy velvet portières tied back either side of a doorway, on a brass pole (local x along the wall) */
export function portieres(ctx, { width, height, velvet, brass, seed = 1, tassel }) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'portieres';
  const poleY = height;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, width + 0.5, 14), brass);
  pole.rotation.z = Math.PI / 2; pole.position.set(0, poleY, 0.16); g.add(pole);
  for (const sx of [-1, 1]) {
    const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.04, 0.02], [0.03, 0.05], [0.045, 0.08], [0.02, 0.12], [0, 0.14]], 14), brass);
    fin.rotation.z = -sx * Math.PI / 2; fin.position.set(sx * (width / 2 + 0.25), poleY, 0.16); g.add(fin);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), brass); br.rotation.x = Math.PI / 2; br.position.set(sx * (width / 2 + 0.12), poleY, 0.08); g.add(br);
  }
  const pw = width * 0.5;
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(drapeGeometry({ width: pw, height: height + 0.03, folds: 6, depth: 0.06, tie: 0.58, gather: 0.36, flare: 0.62, seed: seed * 5 + sx + 2 }), velvet);
    c.position.set(sx * (width / 2 + 0.22), poleY - 0.03, 0.17);
    if (sx < 0) c.scale.x = 1; else c.scale.x = -1;
    g.add(c);
    if (tassel) {
      const t = new THREE.Group();
      const cord = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 20), tassel); cord.scale.set(1, 0.35, 1); t.add(cord);
      const ts = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.02, 0.0], [0.035, -0.06], [0.03, -0.16], [0.0, -0.17]], 12), tassel); ts.position.set(0.1, 0, 0.04); t.add(ts);
      t.position.set(sx * (width / 2 + 0.12), height * 0.42, 0.2); g.add(t);
    }
  }
  // pelmet / valance
  const val = new THREE.Mesh(drapeGeometry({ width: width + 0.5, height: 0.34, folds: 11, depth: 0.03, tie: 0.99, gather: 1, flare: 1, pool: 0, seed: seed + 11 }), velvet);
  val.position.set(-(width + 0.5) / 2, poleY + 0.1, 0.21);
  g.add(val);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// -------------------------------------------------------------------- corbel
/** carved scroll corbel (side profile S-scroll), local: against a wall at z=0, projecting +z, top at y=0 */
export function corbelGeometry(G, { w = 0.14, h = 0.34, d = 0.26 } = {}) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(d, 0); s.lineTo(d, -0.04);
  s.bezierCurveTo(d * 0.95, -h * 0.25, d * 0.45, -h * 0.2, d * 0.4, -h * 0.45);
  s.bezierCurveTo(d * 0.35, -h * 0.7, d * 0.3, -h * 0.85, d * 0.16, -h * 0.9);
  s.bezierCurveTo(d * 0.08, -h * 0.95, d * 0.05, -h, 0, -h);
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2, curveSegments: 14 });
  g.translate(0, 0, -w / 2);
  g.rotateY(-Math.PI / 2);          // profile x -> +z (projection), extrusion along x
  G.applyBoxUVs(g, 1);
  return g;
}

// -------------------------------------------------------------------- torchère
/** a cast-brass knop/bobeche drip pan with a scalloped rim (lathe, radius modulated) */
export function scallopedPan(G, r = 0.05, lobes = 10) {
  const geo = G.latheFromProfile([[0.0001, -0.004], [r * 0.45, -0.006], [r * 0.8, -0.002], [r, 0.004], [r * 1.02, 0.008], [r * 0.92, 0.007], [r * 0.5, 0.002], [0.0001, 0.003]], lobes * 6);
  const ps = geo.attributes.position;
  for (let i = 0; i < ps.count; i++) {
    const x = ps.getX(i), z = ps.getZ(i), rr = Math.hypot(x, z);
    if (rr < r * 0.6) continue;
    const a = Math.atan2(z, x), k = 1 - 0.08 * (1 - Math.abs(Math.cos(a * lobes / 2)));
    ps.setX(i, x * k); ps.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}
/** wax runs down a candle and a puddle on the pan: returns a Group in candle-local space */
export function waxDrips(ctx, { height, radius, seed = 1, mat }) {
  const g = new THREE.Group();
  let sd = seed * 977 + 13; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const n = 3 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2, len = height * (0.25 + rnd() * 0.55), top = height * (0.82 + rnd() * 0.12);
    const pts = [];
    for (let t = 0; t <= 6; t++) { const u = t / 6; pts.push(new THREE.Vector3(Math.cos(a + Math.sin(u * 3 + k) * 0.08) * radius * 1.02, top - len * u, Math.sin(a + Math.sin(u * 3 + k) * 0.08) * radius * 1.02)); }
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, radius * (0.16 + rnd() * 0.1), 6, false);
    const tp = tg.attributes.position;   // taper to a bead at the bottom
    g.add(new THREE.Mesh(tg, mat));
    const bead = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.3, 8, 6), mat); bead.position.copy(pts[6]); bead.scale.set(1, 1.3, 1); g.add(bead);
    void tp;
  }
  const pud = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.9, radius * 2.2, radius * 0.35, 18), mat); pud.position.y = radius * 0.15; g.add(pud);
  return g;
}
/** tall brass floor candelabrum (≈1.75 m): cast tripod with lion-paw feet, a stout baluster stem with knops,
 *  five branches each ending in a scalloped drip pan; guttered, dripping candles */
export function torchere(ctx, { brass, seed = 1, flameIntensity = 4.5 }) {
  const G = ctx.geometry, fx = ctx.fx;
  const g = new THREE.Group();
  g.name = 'torchere';
  const wax = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.86, 0.8, 0.66), roughness: 0.42, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(1.0, 0.85, 0.6), emissive: new THREE.Color(1.0, 0.6, 0.25), emissiveIntensity: 0.025 });
  const stem = G.latheFromProfile([
    [0.0, 0.1], [0.1, 0.1], [0.108, 0.115], [0.095, 0.13], [0.07, 0.16], [0.052, 0.22], [0.06, 0.26], [0.078, 0.3], [0.07, 0.34], [0.045, 0.37],
    [0.036, 0.42], [0.034, 0.6], [0.05, 0.62], [0.062, 0.66], [0.05, 0.7], [0.034, 0.72],                 // lower knop
    [0.03, 0.9], [0.028, 1.06], [0.042, 1.1], [0.07, 1.16], [0.074, 1.2], [0.06, 1.25], [0.04, 1.28],      // the great knop under the branches
    [0.032, 1.3], [0.05, 1.32], [0.052, 1.35], [0.032, 1.37], [0.026, 1.45], [0.04, 1.47], [0.044, 1.49], [0.0, 1.5],
  ], 32);
  g.add(new THREE.Mesh(stem, brass));
  // ring collars on the stem
  for (const y of [0.42, 0.9, 1.06]) { const r = new THREE.Mesh(new THREE.TorusGeometry(y > 1 ? 0.03 : 0.036, 0.006, 8, 24), brass); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  // cast tripod: thick S-scroll legs with acanthus knuckles and paw feet
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const d = V3(Math.cos(a), 0, Math.sin(a));
    const pts = [V3(0, 0.24, 0), d.clone().multiplyScalar(0.07).setY(0.24), d.clone().multiplyScalar(0.15).setY(0.19), d.clone().multiplyScalar(0.2).setY(0.1), d.clone().multiplyScalar(0.235).setY(0.035)];
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.02, 8, false);
    // taper the scroll towards the foot
    const tp = tg.attributes.position, segs = 21, radial = 9;
    for (let k = 0; k < tp.count; k++) {
      const ring = Math.floor(k / radial), u = ring / (segs - 1);
      const c = new THREE.Vector3(); new THREE.CatmullRomCurve3(pts).getPointAt(Math.min(1, u), c);
      const v = new THREE.Vector3(tp.getX(k), tp.getY(k), tp.getZ(k)).sub(c).multiplyScalar(1.15 - 0.45 * u);
      tp.setXYZ(k, c.x + v.x, c.y + v.y, c.z + v.z);
    }
    tg.computeVertexNormals();
    g.add(new THREE.Mesh(tg, brass));
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), brass); knuckle.scale.set(1, 0.8, 1); knuckle.position.copy(d.clone().multiplyScalar(0.1).setY(0.235)); g.add(knuckle);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 8), brass); paw.scale.set(1, 0.62, 1.25); paw.position.copy(d.clone().multiplyScalar(0.245)).setY(0.02); paw.lookAt(d.clone().multiplyScalar(2).setY(0.02)); g.add(paw);
    for (const t of [-1, 0, 1]) { const toe = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), brass); const side = V3(-d.z, 0, d.x).multiplyScalar(t * 0.016); toe.position.copy(d.clone().multiplyScalar(0.275)).add(side).setY(0.011); g.add(toe); }
  }
  // arms + candles
  const candles = [];
  const arms = 4;
  for (let i = 0; i <= arms; i++) {
    let tip;
    if (i === arms) tip = V3(0, 1.5, 0);
    else {
      const a = (i / arms) * Math.PI * 2 + 0.4;
      const d = V3(Math.cos(a), 0, Math.sin(a));
      const pts = [V3(0, 1.33, 0), d.clone().multiplyScalar(0.08).setY(1.29), d.clone().multiplyScalar(0.17).setY(1.3), d.clone().multiplyScalar(0.22).setY(1.36), d.clone().multiplyScalar(0.225).setY(1.42)];
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.014, 8, false), brass));
      const kn = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), brass); kn.scale.set(1, 0.8, 1); kn.position.copy(d.clone().multiplyScalar(0.12).setY(1.29)); g.add(kn);
      tip = d.clone().multiplyScalar(0.225).setY(1.42);
    }
    const pan = new THREE.Mesh(scallopedPan(G, 0.05, 10), brass); pan.position.copy(tip).add(V3(0, 0.012, 0)); g.add(pan);
    const cup = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.022, 0], [0.03, 0.012], [0.026, 0.02], [0.02, 0.045], [0.024, 0.05], [0, 0.05]], 16), brass);
    cup.position.copy(tip); g.add(cup);
    const h = 0.2 + 0.05 * Math.sin(seed * 7 + i * 3);
    const c = fx.candle({ height: h, radius: 0.012, light: false, seed: seed * 20 + i, burn: 0.75 });
    c.position.copy(tip).add(V3(0, 0.048, 0)); g.add(c);
    const dr = waxDrips(ctx, { height: h * 0.8, radius: 0.012, seed: seed * 20 + i, mat: wax }); dr.position.copy(c.position); g.add(dr);
    if (c.userData.flame?.material?.uniforms?.uIntensity) c.userData.flame.material.uniforms.uIntensity.value = flameIntensity;
    candles.push(c);
  }
  g.userData.candles = candles;
  g.traverse((m) => { if (m.isMesh && !m.material.isShaderMaterial) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
