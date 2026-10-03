import * as THREE from 'three';

/**
 * Attic props, all modelled here: Stauf's workbench and the toys on it, the lab
 * table with the great brass microscope, a hanging oil lamp, steamer trunks, a
 * rocking horse, a dressmaker's dummy, dust-sheeted furniture, crates, a bird
 * cage, a marionette and a little model of the mansion itself.
 * Every builder returns a Group whose origin sits on the floor (or the surface it stands on).
 */

const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const mesh = (g, m) => new THREE.Mesh(g, m);

/** bevelled box (ExtrudeGeometry, box UVs in metres) */
export function bevelBox(G, w, h, d, bevel = 0.006) {
  const b = Math.min(bevel, w / 4, h / 4, d / 4);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + b, -h / 2 + b); s.lineTo(w / 2 - b, -h / 2 + b); s.lineTo(w / 2 - b, h / 2 - b); s.lineTo(-w / 2 + b, h / 2 - b); s.lineTo(-w / 2 + b, -h / 2 + b);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return G.applyBoxUVs(g, 1);
}

/** rough timber with chamfered arrises */
export function beam(G, w, h, len, ch = 0.012) {
  return bevelBox(G, w, h, len, ch);
}

/** lathe helper taking [r, y] pairs */
const lathe = (G, pts, seg = 24) => G.latheFromProfile(pts, seg);

// ====================================================================== workbench
export function buildWorkbench(ctx, m, { w = 2.5, d = 0.72, h = 0.9 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'workbench';
  const top = 0.07;
  // top: two thick planks with a tool well between
  g.add(at(mesh(bevelBox(G, w, top, d * 0.62, 0.008), m.benchTop), 0, h - top / 2, d * 0.19));
  g.add(at(mesh(bevelBox(G, w, top * 0.6, d * 0.12, 0.004), m.benchTop), 0, h - top * 0.8, -d * 0.2));
  g.add(at(mesh(bevelBox(G, w, top, d * 0.24, 0.008), m.benchTop), 0, h - top / 2, -d * 0.38));
  // legs, aprons, stretchers
  const lw = 0.09;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(beam(G, lw, h - top, lw, 0.01), m.benchFrame), sx * (w / 2 - 0.12), (h - top) / 2, sz * (d / 2 - 0.07)));
  for (const sz of [-1, 1]) g.add(at(mesh(beam(G, w - 0.2, 0.12, 0.04, 0.006), m.benchFrame), 0, h - top - 0.06, sz * (d / 2 - 0.05)));
  for (const sx of [-1, 1]) g.add(at(mesh(beam(G, 0.06, 0.07, d - 0.1, 0.006), m.benchFrame), sx * (w / 2 - 0.12), 0.18, 0));
  g.add(at(mesh(beam(G, w - 0.22, 0.07, 0.06, 0.006), m.benchFrame), 0, 0.18, 0));
  // lower shelf boards (with a gap)
  for (let i = 0; i < 4; i++) g.add(at(mesh(bevelBox(G, w - 0.3, 0.022, d * 0.2, 0.003), m.benchFrame), 0, 0.225, -d * 0.33 + i * d * 0.22));
  // drawers under the front plank
  const nd = 3;
  for (let i = 0; i < nd; i++) {
    const x = -w / 2 + 0.35 + i * 0.42;
    g.add(at(mesh(bevelBox(G, 0.38, 0.1, 0.02, 0.004), m.benchFrame), x, h - top - 0.07, d / 2 - 0.02));
    const pull = mesh(new THREE.TorusGeometry(0.014, 0.0035, 6, 14, Math.PI), m.brass); pull.rotation.z = Math.PI; at(pull, x, h - top - 0.06, d / 2 + 0.002); g.add(pull);
  }
  // front vice: chop, screw and tommy bar
  const vx = w / 2 - 0.3;
  g.add(at(mesh(bevelBox(G, 0.32, 0.2, 0.06, 0.008), m.benchTop), vx, h - 0.1, d / 2 + 0.04));
  const screw = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 16), m.benchFrame); screw.rotation.x = Math.PI / 2; at(screw, vx, h - 0.11, d / 2 + 0.12); g.add(screw);
  const bar = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), m.benchFrame); bar.rotation.z = 1.2; at(bar, vx, h - 0.11, d / 2 + 0.2); g.add(bar);
  for (const s of [-1, 1]) g.add(at(mesh(new THREE.SphereGeometry(0.014, 10, 8), m.benchFrame), vx + Math.cos(1.2 + Math.PI / 2) * 0.15 * s, h - 0.11 + Math.sin(1.2 + Math.PI / 2) * 0.15 * s, d / 2 + 0.2));
  // bench dogs and a wooden mallet / plane on top
  for (let i = 0; i < 4; i++) g.add(at(mesh(new THREE.BoxGeometry(0.02, 0.03, 0.02), m.benchFrame), -w / 2 + 0.4 + i * 0.5, h + 0.01, d * 0.4));
  return g;
}

/** tool rack: back board with hanging tools (saw, chisels, hammer, pliers, coil of wire) */
export function buildToolRack(ctx, m, { w = 1.4, h = 0.55 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'toolRack';
  for (let i = 0; i < 5; i++) g.add(at(mesh(bevelBox(G, w, h / 5 - 0.006, 0.02, 0.003), m.benchFrame), 0, h / 10 + (i * h) / 5, 0.0));
  g.add(at(mesh(beam(G, w + 0.06, 0.05, 0.05, 0.006), m.benchFrame), 0, h * 0.78, 0.03));
  // pegs
  const pegs = [];
  for (let i = 0; i < 9; i++) { const x = -w / 2 + 0.1 + i * ((w - 0.2) / 8); pegs.push(x); const p = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6), m.benchFrame); p.rotation.x = Math.PI / 2; at(p, x, h * 0.78, 0.07); g.add(p); }
  // hand saw
  {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.42, 0.04); s.lineTo(0.42, 0.12); s.lineTo(0, 0.1); s.lineTo(0, 0);
    const blade = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: false }), m.steel); blade.rotation.z = -Math.PI / 2 - 0.05; at(blade, pegs[0] - 0.05, h * 0.78 - 0.06, 0.05); g.add(blade);
    g.add(at(mesh(bevelBox(G, 0.05, 0.12, 0.025, 0.008), m.handle), pegs[0], h * 0.78 - 0.02, 0.055));
  }
  // chisels
  for (let i = 0; i < 4; i++) {
    const x = pegs[2] + i * 0.045;
    g.add(at(mesh(lathe(G, [[0, 0], [0.011, 0.005], [0.012, 0.07], [0.008, 0.1], [0.004, 0.11], [0, 0.11]], 10), m.handle), x, h * 0.78 - 0.13, 0.06));
    g.add(at(mesh(new THREE.BoxGeometry(0.008 + i * 0.003, 0.12, 0.003), m.steel), x, h * 0.78 - 0.2, 0.06));
  }
  // claw hammer
  {
    const hm = new THREE.Group();
    hm.add(at(mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.3, 8), m.handle), 0, -0.15, 0));
    hm.add(at(mesh(bevelBox(G, 0.1, 0.025, 0.025, 0.004), m.iron), 0.0, 0.0, 0));
    at(hm, pegs[6], h * 0.78 - 0.02, 0.07); hm.rotation.z = 0.08; g.add(hm);
  }
  // coil of wire
  const coil = mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 24), m.iron); at(coil, pegs[8], h * 0.78 - 0.07, 0.06); g.add(coil);
  return g;
}

// ====================================================================== toys
/** jack-in-the-box: painted box, lid flung open, spring and grinning clown head */
export function buildJackInBox(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'jack';
  const s = 0.12;
  g.add(at(mesh(bevelBox(G, s, s, s, 0.004), m.toyRed), 0, s / 2, 0));
  for (const [x, z] of [[0, s / 2 + 0.001], [0, -s / 2 - 0.001]]) g.add(at(mesh(new THREE.BoxGeometry(s * 0.7, s * 0.7, 0.002), m.toyGold), x, s / 2, z));
  const lid = mesh(bevelBox(G, s, 0.012, s, 0.003), m.toyRed); lid.position.set(0, s + 0.05, -s / 2 - 0.045); lid.rotation.x = -1.9; g.add(lid);
  // spring
  const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push(V3(Math.cos(t * Math.PI * 14) * 0.022, s - 0.02 + t * 0.13, Math.sin(t * Math.PI * 14) * 0.022 + t * 0.02)); }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.0028, 6), m.steel));
  // ruff, head, hat, nose
  const top = s + 0.12;
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const r = mesh(new THREE.SphereGeometry(0.018, 8, 6), i % 2 ? m.toyWhite : m.toyRed); r.scale.set(1, 0.5, 1); at(r, Math.cos(a) * 0.03, top, Math.sin(a) * 0.03 + 0.02); g.add(r); }
  g.add(at(mesh(new THREE.SphereGeometry(0.034, 20, 14), m.porcelain), 0, top + 0.035, 0.02));
  g.add(at(mesh(new THREE.SphereGeometry(0.009, 10, 8), m.toyRed), 0, top + 0.032, 0.054));
  const hat = mesh(new THREE.ConeGeometry(0.026, 0.07, 16), m.toyBlue); at(hat, 0.005, top + 0.095, 0.015); hat.rotation.z = -0.25; g.add(hat);
  g.add(at(mesh(new THREE.SphereGeometry(0.008, 8, 6), m.toyGold), 0.014, top + 0.13, 0.015));
  for (const sx of [-1, 1]) g.add(at(mesh(new THREE.SphereGeometry(0.004, 6, 4), m.black), sx * 0.012, top + 0.045, 0.05));
  const grin = mesh(new THREE.TorusGeometry(0.014, 0.0025, 4, 12, Math.PI), m.toyRed); grin.rotation.z = Math.PI; at(grin, 0, top + 0.024, 0.05); g.add(grin);
  return g;
}

/** tin soldier: turned body, busby, painted red coat */
export function soldierGeometry(G) {
  return {
    legs: lathe(G, [[0, 0], [0.012, 0], [0.012, 0.004], [0.008, 0.006], [0.008, 0.04], [0, 0.04]], 10),
    coat: lathe(G, [[0, 0.04], [0.011, 0.04], [0.012, 0.06], [0.01, 0.075], [0.006, 0.08], [0, 0.08]], 12),
    head: new THREE.SphereGeometry(0.0055, 10, 8).translate(0, 0.086, 0),
    busby: lathe(G, [[0, 0.089], [0.0065, 0.089], [0.0075, 0.1], [0.0065, 0.11], [0, 0.112]], 10),
  };
}
export function buildSoldiers(ctx, m, n = 6, seed = 1) {
  const { geometry: G } = ctx;
  const sg = soldierGeometry(G);
  const g = new THREE.Group(); g.name = 'soldiers';
  for (let i = 0; i < n; i++) {
    const s = new THREE.Group();
    s.add(mesh(sg.legs, m.toyBlack)); s.add(mesh(sg.coat, m.toyRed)); s.add(mesh(sg.head, m.porcelain)); s.add(mesh(sg.busby, m.toyBlack));
    const rifle = mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.07, 4), m.toyBlack); at(rifle, 0.012, 0.075, 0.004); s.add(rifle);
    const fallen = (i * 7 + seed) % 5 === 0;
    s.position.set((i % 3) * 0.035 + (fallen ? 0.02 : 0), 0, Math.floor(i / 3) * 0.04);
    if (fallen) { s.rotation.z = Math.PI / 2; s.position.y = 0.012; s.rotation.y = 0.6; }
    g.add(s);
  }
  return g;
}

/** spinning top with painted bands */
export function buildTop(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'top';
  const body = mesh(lathe(G, [[0, 0], [0.004, 0.004], [0.03, 0.03], [0.045, 0.05], [0.046, 0.058], [0.03, 0.068], [0.008, 0.072], [0.006, 0.1], [0, 0.104]], 32), m.topBands);
  g.add(body);
  g.rotation.z = 0.35; g.position.y = 0.012;
  return g;
}

/** toy drum with zig-zag cords */
export function buildDrum(ctx, m) {
  const g = new THREE.Group(); g.name = 'drum';
  const r = 0.07, h = 0.08;
  g.add(at(mesh(new THREE.CylinderGeometry(r, r, h, 28, 1, true), m.toyBlue), 0, h / 2, 0));
  for (const y of [0.006, h - 0.006]) g.add(at(mesh(new THREE.TorusGeometry(r + 0.002, 0.006, 6, 28), m.toyRed), 0, y, 0).rotateX(Math.PI / 2));
  g.add(at(mesh(new THREE.CircleGeometry(r, 28).rotateX(-Math.PI / 2), m.vellum), 0, h, 0));
  const pts = [];
  for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; const y = i % 2 ? 0.01 : h - 0.01; pts.push(V3(Math.cos(a) * (r + 0.004), y, Math.sin(a) * (r + 0.004))); }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.0), 96, 0.0018, 4, true), m.toyWhite));
  for (const s of [-1, 1]) { const st = mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.13, 6), m.handle); st.rotation.z = Math.PI / 2 + s * 0.3; at(st, 0.03 * s, h + 0.01, 0.03); g.add(st); }
  return g;
}

/** a porcelain doll sitting with legs out: cloth dress, ringlets, glass eyes */
export function buildDoll(ctx, m, { dress } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'doll';
  const d = dress || m.toyBlue;
  g.add(at(mesh(lathe(G, [[0, 0], [0.06, 0], [0.065, 0.02], [0.045, 0.08], [0.03, 0.12], [0.022, 0.14], [0, 0.145]], 20), d), 0, 0, 0));
  for (const s of [-1, 1]) {
    const leg = mesh(new THREE.CapsuleGeometry(0.012, 0.08, 4, 8), m.porcelain); leg.rotation.x = Math.PI / 2 - 0.1; at(leg, s * 0.022, 0.015, 0.07); g.add(leg);
    g.add(at(mesh(new THREE.SphereGeometry(0.014, 10, 8).scale(1, 0.8, 1.5), m.toyBlack), s * 0.022, 0.012, 0.125));
    const arm = mesh(new THREE.CapsuleGeometry(0.009, 0.06, 4, 8), m.porcelain); arm.rotation.z = s * 0.35; arm.rotation.x = -0.3; at(arm, s * 0.04, 0.09, 0.015); g.add(arm);
  }
  g.add(at(mesh(new THREE.SphereGeometry(0.038, 24, 18), m.porcelain), 0, 0.18, 0));
  for (const s of [-1, 1]) {
    g.add(at(mesh(new THREE.SphereGeometry(0.0075, 10, 8), m.glassEye), s * 0.014, 0.187, 0.031));
    for (let k = 0; k < 3; k++) g.add(at(mesh(new THREE.CapsuleGeometry(0.008, 0.035, 3, 6), m.hair), s * (0.034 + k * 0.004), 0.16 - k * 0.006, -0.01 - k * 0.012));
  }
  g.add(at(mesh(new THREE.SphereGeometry(0.041, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m.hair), 0, 0.185, -0.004).rotateX(-0.25));
  g.add(at(mesh(new THREE.SphereGeometry(0.004, 6, 4), m.toyRed), 0, 0.168, 0.036));
  return g;
}

/** rocking horse: dapple grey body, red saddle, curved rockers, stand pegs */
export function buildRockingHorse(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'rockingHorse';
  // rockers: two arcs (extruded crescent)
  const R = 1.6, span = 0.55;
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    const a0 = -span / 2, a1 = span / 2;
    for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * (i / 24); const p = V2(Math.sin(a) * R, R - Math.cos(a) * R); i ? sh.lineTo(p.x, p.y) : sh.moveTo(p.x, p.y); }
    for (let i = 24; i >= 0; i--) { const a = a0 + (a1 - a0) * (i / 24); sh.lineTo(Math.sin(a) * (R - 0.06), R - Math.cos(a) * (R - 0.06) + 0.0); }
    const rg = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
    const rk = mesh(G.applyBoxUVs(rg, 1), m.horseWood); at(rk, 0, 0.0, s * 0.16 - 0.015); g.add(rk);
  }
  for (const x of [-0.5, 0.5]) g.add(at(mesh(beam(G, 0.05, 0.03, 0.36, 0.005), m.horseWood), x, 0.1, 0));
  // legs (splayed)
  const legG = new THREE.CapsuleGeometry(0.025, 0.36, 4, 10);
  for (const [x, z, rx, rz] of [[-0.3, 0.1, 0.12, -0.35], [-0.3, -0.1, -0.12, -0.35], [0.3, 0.1, 0.12, 0.35], [0.3, -0.1, -0.12, 0.35]]) {
    const l = mesh(legG, m.horse); at(l, x, 0.32, z); l.rotation.set(rx, 0, rz); g.add(l);
    const hoof = mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.04, 12), m.toyBlack); at(hoof, x + Math.sin(-rz) * 0.2 * -1, 0.13, z - Math.sin(rx) * 0.2); g.add(hoof);
  }
  // body, neck, head
  const body = mesh(new THREE.CapsuleGeometry(0.13, 0.42, 8, 16), m.horse); body.rotation.z = Math.PI / 2; at(body, 0, 0.58, 0); body.scale.set(1, 1, 0.82); g.add(body);
  const neck = mesh(new THREE.CapsuleGeometry(0.075, 0.22, 6, 12), m.horse); at(neck, 0.31, 0.76, 0); neck.rotation.z = -0.55; g.add(neck);
  const head = mesh(new THREE.CapsuleGeometry(0.06, 0.18, 6, 12), m.horse); at(head, 0.44, 0.86, 0); head.rotation.z = -1.95; g.add(head);
  for (const s of [-1, 1]) {
    g.add(at(mesh(new THREE.SphereGeometry(0.014, 10, 8), m.glassEye), 0.43, 0.9, s * 0.05));
    const ear = mesh(new THREE.ConeGeometry(0.02, 0.06, 8), m.horse); at(ear, 0.38, 0.97, s * 0.03); ear.rotation.z = 0.2; g.add(ear);
  }
  // mane: row of hair tufts
  for (let i = 0; i < 10; i++) { const t = i / 9; const tu = mesh(new THREE.CapsuleGeometry(0.02, 0.07, 3, 6), m.hair); at(tu, 0.2 + t * 0.2, 0.74 + t * 0.2, 0); tu.rotation.z = 0.9 + t * 0.4; g.add(tu); }
  // tail
  const tp = []; for (let i = 0; i <= 10; i++) { const t = i / 10; tp.push(V3(-0.33 - t * 0.12, 0.62 - t * 0.3, Math.sin(t * 3) * 0.02)); }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tp), 20, 0.025, 8), m.hair));
  // saddle + stirrups + bridle
  const sad = mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.22, 20, 1, true, -Math.PI * 0.45, Math.PI * 0.9), m.saddle); sad.rotation.x = Math.PI / 2; sad.rotation.y = Math.PI / 2; at(sad, -0.02, 0.585, 0); sad.scale.set(1, 1, 0.83); g.add(sad);
  for (const s of [-1, 1]) {
    const st = mesh(new THREE.TorusGeometry(0.025, 0.004, 4, 12), m.brass); at(st, -0.02, 0.36, s * 0.13); g.add(st);
    const strap = mesh(new THREE.BoxGeometry(0.012, 0.18, 0.003), m.saddle); at(strap, -0.02, 0.46, s * 0.122); g.add(strap);
  }
  const bridle = mesh(new THREE.TorusGeometry(0.062, 0.005, 4, 18), m.saddle); bridle.rotation.y = Math.PI / 2; at(bridle, 0.49, 0.84, 0); g.add(bridle);
  return g;
}

/** a miniature of the mansion: Stauf's model, windows lit from within */
export function buildModelHouse(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'modelHouse';
  const roofG = (w, d, h) => { const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(0, h); s.lineTo(d / 2, 0); s.lineTo(-d / 2, 0); const e = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); e.translate(0, 0, -w / 2); e.rotateY(Math.PI / 2); return G.applyBoxUVs(e, 4); };
  g.add(at(mesh(bevelBox(G, 0.42, 0.02, 0.3, 0.003), m.benchFrame), 0, 0.01, 0));
  g.add(at(mesh(bevelBox(G, 0.26, 0.16, 0.16, 0.002), m.modelWall), 0, 0.1, 0));
  g.add(at(mesh(roofG(0.28, 0.18, 0.09), m.slate), 0, 0.18, 0));
  g.add(at(mesh(bevelBox(G, 0.09, 0.2, 0.09, 0.002), m.modelWall), 0.15, 0.12, 0.02));
  const tw = mesh(new THREE.ConeGeometry(0.075, 0.13, 4), m.slate); tw.rotation.y = Math.PI / 4; at(tw, 0.15, 0.285, 0.02); g.add(tw);
  g.add(at(mesh(bevelBox(G, 0.1, 0.1, 0.1, 0.002), m.modelWall), -0.15, 0.07, 0.0));
  g.add(at(mesh(roofG(0.1, 0.11, 0.05), m.slate), -0.15, 0.12, 0));
  // porch
  g.add(at(mesh(new THREE.BoxGeometry(0.12, 0.006, 0.05), m.modelWall), 0, 0.06, 0.105));
  for (const x of [-0.05, 0.05]) g.add(at(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.06, 6), m.modelWall), x, 0.03, 0.125));
  // lit windows
  const win = new THREE.PlaneGeometry(0.018, 0.026);
  const wins = [[-0.08, 0.07], [-0.03, 0.07], [0.03, 0.07], [0.08, 0.07], [-0.08, 0.13], [0.0, 0.13], [0.08, 0.13]];
  wins.forEach(([x, y], i) => g.add(at(mesh(win, i % 3 === 1 ? m.winDark : m.winLit), x, y, 0.0805)));
  g.add(at(mesh(win, m.winLit), 0.15, 0.17, 0.0655));
  g.add(at(mesh(win, m.winLit), 0.15, 0.1, 0.0655));
  return g;
}

/** set of alphabet blocks */
export function buildBlocks(ctx, m, list) {
  const g = new THREE.Group(); g.name = 'blocks';
  const s = 0.045;
  const geo = new THREE.BoxGeometry(s, s, s);
  for (const [x, y, z, ry, k] of list) {
    const b = mesh(geo, m.blocks[k % m.blocks.length]); at(b, x, y + s / 2, z); b.rotation.y = ry; g.add(b);
  }
  return g;
}

/** marionette hanging from a hook: wooden limbs on strings, a control cross */
export function buildMarionette(ctx, m) {
  const g = new THREE.Group(); g.name = 'marionette';
  // control bar (origin at the bar)
  g.add(mesh(new THREE.BoxGeometry(0.18, 0.012, 0.012), m.handle));
  g.add(mesh(new THREE.BoxGeometry(0.012, 0.012, 0.14), m.handle));
  const hang = -0.38;
  const body = new THREE.Group(); body.position.y = hang; g.add(body);
  body.add(at(mesh(new THREE.CapsuleGeometry(0.03, 0.07, 4, 10), m.toyRed), 0, -0.08, 0));
  body.add(at(mesh(new THREE.SphereGeometry(0.03, 16, 12), m.porcelain), 0, 0.0, 0));
  body.add(at(mesh(new THREE.ConeGeometry(0.024, 0.06, 12), m.toyBlack), 0, 0.045, 0));
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.009, 0.08, 3, 6), m.porcelain); at(arm, s * 0.045, -0.09, 0); arm.rotation.z = s * 0.18; body.add(arm);
    const leg = mesh(new THREE.CapsuleGeometry(0.011, 0.1, 3, 6), m.toyBlack); at(leg, s * 0.016, -0.2, s * 0.01); leg.rotation.x = s * 0.15; body.add(leg);
  }
  // strings
  const strG = (a, b) => { const len = a.distanceTo(b); const c = new THREE.CylinderGeometry(0.0006, 0.0006, len, 3); const o = mesh(c, m.string); o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()); return o; };
  g.add(strG(V3(-0.09, 0, 0), V3(-0.05, hang - 0.14, 0)));
  g.add(strG(V3(0.09, 0, 0), V3(0.05, hang - 0.14, 0)));
  g.add(strG(V3(0, 0, 0.07), V3(0, hang + 0.03, 0)));
  g.add(strG(V3(0, 0, -0.07), V3(0, hang - 0.05, -0.02)));
  return g;
}

/** small inlaid puzzle box (Stauf sells toys and puzzles) */
export function buildPuzzleBox(ctx, m, s = 0.09) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'puzzleBox';
  g.add(at(mesh(bevelBox(G, s, s * 0.6, s, 0.003), m.inlay), 0, s * 0.3, 0));
  for (let i = 0; i < 3; i++) g.add(at(mesh(new THREE.BoxGeometry(s * 1.002, s * 0.05, s * 0.3), m.benchTop), 0, s * (0.12 + i * 0.16), (i - 1) * s * 0.2));
  return g;
}

// ====================================================================== lab
export function buildLabTable(ctx, m, { w = 1.55, d = 0.82, h = 0.86 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'labTable';
  // top with moulded edge
  g.add(at(mesh(bevelBox(G, w, 0.05, d, 0.012), m.labTop), 0, h - 0.025, 0));
  const edge = [V2(0, 0), V2(0.012, 0), V2(0.02, 0.008), V2(0.016, 0.02), V2(0.006, 0.028), V2(0, 0.028)];
  g.add(at(mesh(G.sweepProfile(edge, [V3(-w / 2, 0, d / 2), V3(w / 2, 0, d / 2), V3(w / 2, 0, -d / 2), V3(-w / 2, 0, -d / 2)].reverse(), { closed: true, uvScale: 2 }), m.labTop), 0, h - 0.078, 0));
  // apron
  for (const sz of [-1, 1]) g.add(at(mesh(bevelBox(G, w - 0.16, 0.12, 0.025, 0.004), m.labFrame), 0, h - 0.11, sz * (d / 2 - 0.06)));
  for (const sx of [-1, 1]) g.add(at(mesh(bevelBox(G, 0.025, 0.12, d - 0.16, 0.004), m.labFrame), sx * (w / 2 - 0.06), h - 0.11, 0));
  // turned legs
  const legG = lathe(G, [[0, 0], [0.028, 0], [0.032, 0.02], [0.026, 0.05], [0.022, 0.25], [0.034, 0.32], [0.036, 0.36], [0.026, 0.42], [0.03, 0.5], [0.036, 0.6], [0.038, h - 0.17], [0.04, h - 0.05], [0, h - 0.05]], 18);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(legG, m.labFrame), sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08)));
  // stretcher shelf
  g.add(at(mesh(bevelBox(G, w - 0.2, 0.02, d - 0.2, 0.004), m.labFrame), 0, 0.2, 0));
  return g;
}

/** large brass compound microscope on a horseshoe foot */
export function buildMicroscope(ctx, m, s = 1.6) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'microscope';
  // horseshoe foot
  const sh = new THREE.Shape();
  sh.absarc(0, 0, 0.06, -Math.PI * 0.8, Math.PI * 0.8, false);
  sh.absarc(0, 0, 0.025, Math.PI * 0.8, -Math.PI * 0.8, true);
  const foot = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 24 }), m.blackEnamel);
  foot.rotation.x = -Math.PI / 2; foot.position.y = 0.003; g.add(foot);
  g.add(at(mesh(lathe(G, [[0, 0], [0.016, 0], [0.012, 0.01], [0.01, 0.07], [0.016, 0.08], [0, 0.08]], 16), m.brass), 0, 0.015, 0));
  // trunnion + arm
  g.add(at(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 16).rotateX(Math.PI / 2), m.brass), 0, 0.1, 0));
  const arm = new THREE.Group(); arm.position.set(0, 0.1, 0); arm.rotation.z = 0.32; g.add(arm);
  const ap = new THREE.Shape(); ap.moveTo(-0.012, 0); ap.quadraticCurveTo(-0.03, 0.08, -0.01, 0.15); ap.lineTo(0.012, 0.15); ap.quadraticCurveTo(-0.004, 0.08, 0.012, 0); ap.lineTo(-0.012, 0);
  const armG = new THREE.ExtrudeGeometry(ap, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2 }); armG.translate(0, 0, -0.008);
  arm.add(mesh(armG, m.brass));
  // stage
  arm.add(at(mesh(bevelBox(G, 0.08, 0.006, 0.08, 0.002), m.blackEnamel), 0.035, 0.05, 0));
  arm.add(at(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 16), m.brass), 0.035, 0.035, 0));
  // mirror below
  const mir = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 20), m.mirror); at(mir, 0.035, 0.01, 0); mir.rotation.z = 0.6; arm.add(mir);
  // tube, focusing knobs, revolver, eyepiece
  const tube = new THREE.Group(); tube.position.set(0.035, 0.07, 0); arm.add(tube);
  tube.add(mesh(lathe(G, [[0, 0], [0.006, 0], [0.008, 0.006], [0.01, 0.012], [0.014, 0.016], [0.014, 0.022], [0.012, 0.026], [0.012, 0.15], [0.014, 0.155], [0.014, 0.17], [0.01, 0.175], [0.0095, 0.2], [0.012, 0.205], [0.012, 0.215], [0, 0.215]], 24), m.brass));
  tube.add(at(mesh(new THREE.CylinderGeometry(0.0045, 0.0055, 0.02, 12), m.brass), 0.012, -0.005, 0).rotateZ(0.25));
  tube.add(at(mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.018, 12), m.brass), -0.01, -0.004, 0.006).rotateZ(-0.25));
  for (const sz of [-1, 1]) {
    const k = mesh(lathe(G, [[0, 0], [0.016, 0], [0.017, 0.004], [0.017, 0.008], [0.012, 0.011], [0, 0.011]], 20), m.brass); k.rotation.x = sz * Math.PI / 2; at(k, -0.01, 0.12, sz * 0.012); tube.add(k);
  }
  g.add(at(mesh(new THREE.SphereGeometry(0.005, 8, 6), m.glass), 0, 0, 0)); // keep bucket small
  g.scale.setScalar(s);
  return g;
}

/** glassware: flasks, retort, test tube rack, bell jar */
export function buildGlassware(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'glassware';
  const flask = lathe(G, [[0.0, 0], [0.045, 0.0], [0.06, 0.03], [0.058, 0.06], [0.03, 0.11], [0.013, 0.14], [0.013, 0.19], [0.016, 0.195]], 24);
  const liq = lathe(G, [[0, 0.003], [0.043, 0.003], [0.056, 0.03], [0.054, 0.055], [0, 0.055]], 20);
  const round = lathe(G, [[0, 0], [0.03, 0.005], [0.05, 0.03], [0.055, 0.06], [0.045, 0.09], [0.014, 0.115], [0.012, 0.18], [0.015, 0.185]], 24);
  const rliq = lathe(G, [[0, 0.006], [0.03, 0.008], [0.048, 0.03], [0.052, 0.05], [0, 0.05]], 20);
  const f1 = new THREE.Group(); f1.add(mesh(flask, m.glass)); f1.add(mesh(liq, m.liquidGreen)); at(f1, 0, 0, 0); g.add(f1);
  const f2 = new THREE.Group(); f2.add(mesh(round, m.glass)); f2.add(mesh(rliq, m.liquidBlue)); at(f2, 0.14, 0, -0.05); g.add(f2);
  // round flask needs a ring stand
  g.add(at(mesh(new THREE.TorusGeometry(0.04, 0.003, 6, 20).rotateX(Math.PI / 2), m.iron), 0.14, 0.02, -0.05));
  // test tube rack
  const rack = new THREE.Group(); at(rack, -0.16, 0, 0.02); g.add(rack);
  rack.add(at(mesh(bevelBox(G, 0.2, 0.012, 0.05, 0.002), m.labFrame), 0, 0.006, 0));
  rack.add(at(mesh(bevelBox(G, 0.2, 0.012, 0.05, 0.002), m.labFrame), 0, 0.08, 0));
  for (const sx of [-1, 1]) rack.add(at(mesh(new THREE.BoxGeometry(0.01, 0.09, 0.05), m.labFrame), sx * 0.095, 0.045, 0));
  const tubeG = lathe(G, [[0, 0], [0.006, 0.002], [0.008, 0.008], [0.008, 0.13], [0.009, 0.132]], 12);
  const tliq = new THREE.CylinderGeometry(0.0072, 0.0072, 0.05, 10).translate(0, 0.03, 0);
  const tl = [m.liquidGreen, m.liquidRed, m.liquidBlue, m.liquidGreen, m.liquidAmber];
  for (let i = 0; i < 5; i++) { rack.add(at(mesh(tubeG, m.glass), -0.07 + i * 0.035, 0.02, 0)); rack.add(at(mesh(tliq, tl[i]), -0.07 + i * 0.035, 0.02, 0)); }
  return g;
}

/** bell jar over a small specimen (a pickled thing on a stand) */
export function buildBellJar(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'bellJar';
  g.add(mesh(lathe(G, [[0, 0], [0.1, 0], [0.105, 0.01], [0.1, 0.02], [0, 0.02]], 32), m.labFrame));
  g.add(at(mesh(lathe(G, [[0, 0], [0.025, 0], [0.012, 0.01], [0.008, 0.06], [0, 0.06]], 12), m.brass), 0, 0.02, 0));
  // the specimen: a little skull
  const sk = mesh(new THREE.SphereGeometry(0.03, 18, 14), m.bone); sk.scale.set(0.9, 1, 1.15); at(sk, 0, 0.11, 0); g.add(sk);
  const jaw = mesh(new THREE.SphereGeometry(0.02, 12, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.bone); at(jaw, 0, 0.09, 0.012); g.add(jaw);
  for (const s of [-1, 1]) g.add(at(mesh(new THREE.SphereGeometry(0.008, 8, 6), m.black), s * 0.011, 0.11, 0.028));
  const jar = mesh(lathe(G, [[0.088, 0.02], [0.09, 0.15], [0.085, 0.2], [0.07, 0.235], [0.04, 0.25], [0.012, 0.255], [0.014, 0.27], [0.022, 0.285], [0.0, 0.29]], 40), m.glass);
  g.add(jar);
  return g;
}

/** hanging oil lamp: chain, smoke bell, font with brass collar, glass chimney (flame added by caller) */
export function buildHangingLamp(ctx, m, { drop = 0.7 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'hangingLamp';
  // chain: alternating torus links
  const link = new THREE.TorusGeometry(0.012, 0.0025, 5, 10);
  const n = Math.floor(drop / 0.02);
  for (let i = 0; i < n; i++) { const l = mesh(link, m.iron); l.position.y = -i * 0.02; l.rotation.y = (i % 2) * Math.PI / 2; l.scale.y = 1.25; g.add(l); }
  const y0 = -drop;
  // smoke bell / reflector
  g.add(at(mesh(lathe(G, [[0.0, 0.04], [0.02, 0.04], [0.03, 0.03], [0.08, 0.0], [0.14, -0.045], [0.145, -0.05], [0.0, -0.05]].map(([r, y]) => [r, y]), 32), m.tin), 0, y0 + 0.02, 0));
  g.add(at(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.001, 32, 1, true), m.tin), 0, y0 - 0.03, 0));
  // three hanging rods
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const r = mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.3, 5), m.brass); at(r, Math.cos(a) * 0.06, y0 - 0.17, Math.sin(a) * 0.06); g.add(r); }
  // font
  const fy = y0 - 0.38;
  g.add(at(mesh(lathe(G, [[0, -0.02], [0.03, -0.02], [0.06, 0.0], [0.075, 0.03], [0.07, 0.06], [0.04, 0.08], [0.03, 0.085], [0.0, 0.085]], 32), m.ruby), 0, fy, 0));
  g.add(at(mesh(lathe(G, [[0, -0.06], [0.01, -0.06], [0.015, -0.035], [0.03, -0.02], [0.0, -0.02]], 18), m.brass), 0, fy, 0));
  g.add(at(mesh(lathe(G, [[0.024, 0.085], [0.036, 0.09], [0.036, 0.11], [0.028, 0.12], [0.024, 0.12]], 24), m.brass), 0, fy, 0));
  // gallery ring at the rods' ends
  g.add(at(mesh(new THREE.TorusGeometry(0.062, 0.004, 6, 32).rotateX(Math.PI / 2), m.brass), 0, fy + 0.04, 0));
  const chim = mesh(lathe(G, [[0.022, 0], [0.03, 0.02], [0.038, 0.05], [0.032, 0.08], [0.02, 0.12], [0.019, 0.2]], 24), m.chimney);
  chim.position.set(0, fy + 0.12, 0); chim.userData.noShadow = true; chim.renderOrder = 3; g.add(chim);
  g.userData.flameY = fy + 0.135;
  return g;
}

// ====================================================================== storage & furniture
/** domed steamer trunk: canvas/leather skin, wood slats, brass corners and lock */
export function buildTrunk(ctx, m, { w = 0.9, d = 0.5, h = 0.42, dome = 0.12, open = 0 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'trunk';
  g.add(at(mesh(bevelBox(G, w, h, d, 0.012), m.trunk), 0, h / 2, 0));
  // domed lid: extruded arch profile
  const lid = new THREE.Shape();
  lid.moveTo(-d / 2, 0); lid.lineTo(-d / 2, 0.03); lid.quadraticCurveTo(-d / 2, dome + 0.03, 0, dome + 0.03); lid.quadraticCurveTo(d / 2, dome + 0.03, d / 2, 0.03); lid.lineTo(d / 2, 0); lid.lineTo(-d / 2, 0);
  const lg = new THREE.ExtrudeGeometry(lid, { depth: w - 0.01, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 16 });
  lg.translate(0, 0, -(w - 0.01) / 2); lg.rotateY(Math.PI / 2);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, h, -d / 2); g.add(lidPivot);
  const lm = mesh(G.applyBoxUVs(lg, 1), m.trunk); lm.position.set(0, 0, d / 2); lidPivot.add(lm);
  lidPivot.rotation.x = -open;
  // slats
  for (const x of [-w * 0.32, w * 0.32]) {
    g.add(at(mesh(bevelBox(G, 0.05, h + 0.004, d + 0.012, 0.004), m.slat), x, h / 2, 0));
    const sl = new THREE.Shape(); sl.moveTo(-d / 2 - 0.006, 0); sl.lineTo(-d / 2 - 0.006, 0.03); sl.quadraticCurveTo(-d / 2 - 0.006, dome + 0.037, 0, dome + 0.037); sl.quadraticCurveTo(d / 2 + 0.006, dome + 0.037, d / 2 + 0.006, 0.03); sl.lineTo(d / 2 + 0.006, 0);
    const hole = new THREE.Path(); hole.moveTo(-d / 2 + 0.01, 0.002); hole.lineTo(d / 2 - 0.01, 0.002); hole.lineTo(d / 2 - 0.01, 0.028); hole.quadraticCurveTo(d / 2 - 0.01, dome + 0.02, 0, dome + 0.02); hole.quadraticCurveTo(-d / 2 + 0.01, dome + 0.02, -d / 2 + 0.01, 0.028); hole.lineTo(-d / 2 + 0.01, 0.002);
    sl.holes.push(hole);
    const sg = new THREE.ExtrudeGeometry(sl, { depth: 0.05, bevelEnabled: false, curveSegments: 16 }); sg.translate(0, 0, -0.025); sg.rotateY(Math.PI / 2);
    const s = mesh(G.applyBoxUVs(sg, 1), m.slat); s.position.set(x, 0, d / 2); lidPivot.add(s);
  }
  for (const y of [0.06, h - 0.05]) g.add(at(mesh(bevelBox(G, w + 0.008, 0.035, d + 0.008, 0.003), m.slat), 0, y, 0));
  // brass corners + lock + handles
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0.03, h - 0.03]) g.add(at(mesh(new THREE.SphereGeometry(0.022, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1), m.brass), sx * (w / 2 - 0.004), y, sz * (d / 2 - 0.004)).rotateX(y < 0.1 ? Math.PI : 0));
  g.add(at(mesh(bevelBox(G, 0.07, 0.08, 0.012, 0.003), m.brass), 0, h - 0.02, d / 2 + 0.006));
  for (const sx of [-1, 1]) { const hd = mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 16, Math.PI), m.leatherStrap); hd.rotation.y = Math.PI / 2; hd.rotation.z = Math.PI; at(hd, sx * (w / 2 + 0.01), h * 0.6, 0); g.add(hd); }
  return g;
}

/** slatted packing crate */
export function buildCrate(ctx, m, { w = 0.6, h = 0.45, d = 0.5, seed = 0 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'crate';
  const t = 0.018, n = 4;
  const boards = (len, axis, y, z, x, ww) => { const b = mesh(bevelBox(G, axis === 'x' ? len : t, ww, axis === 'x' ? t : len, 0.003), m.crate); at(b, x, y, z); g.add(b); };
  for (let i = 0; i < n; i++) {
    const y = (i + 0.5) * (h / n);
    const bh = h / n - 0.012;
    boards(w, 'x', y, d / 2 - t / 2, 0, bh); boards(w, 'x', y, -d / 2 + t / 2, 0, bh);
    boards(d - 2 * t, 'z', y, 0, w / 2 - t / 2, bh); boards(d - 2 * t, 'z', y, 0, -w / 2 + t / 2, bh);
  }
  for (let i = 0; i < 5; i++) g.add(at(mesh(bevelBox(G, w, t, d / 5 - 0.008, 0.003), m.crate), 0, h + t / 2, -d / 2 + (i + 0.5) * (d / 5)));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(new THREE.BoxGeometry(0.04, h, 0.04), m.crate), sx * (w / 2 - 0.035), h / 2, sz * (d / 2 - 0.035)));
  // straw poking out
  if (seed % 2 === 0) for (let i = 0; i < 12; i++) { const s = mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.12, 3), m.straw); at(s, -w / 2 + 0.05 + (i * 0.37 % 1) * (w - 0.1), h + 0.03, d / 2 - 0.02); s.rotation.set(0.6 + (i % 3) * 0.2, 0, (i % 5 - 2) * 0.3); g.add(s); }
  return g;
}

/** dressmaker's dummy on a tripod */
export function buildDressForm(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'dressForm';
  const torso = mesh(lathe(G, [[0, 0.82], [0.13, 0.82], [0.16, 0.9], [0.15, 1.0], [0.12, 1.08], [0.135, 1.18], [0.17, 1.26], [0.16, 1.34], [0.11, 1.4], [0.05, 1.43], [0.045, 1.46], [0.05, 1.47], [0, 1.48]], 32), m.dressForm);
  torso.scale.set(1, 1, 0.75); g.add(torso);
  g.add(at(mesh(lathe(G, [[0, 0], [0.02, 0], [0.025, 0.02], [0.03, 0.04], [0, 0.04]], 12), m.labFrame), 0, 1.46, 0));
  g.add(at(mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.8, 10), m.labFrame), 0, 0.42, 0));
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const l = mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.36, 8), m.labFrame); at(l, Math.cos(a) * 0.14, 0.1, Math.sin(a) * 0.14); l.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); g.add(l); }
  // a tape measure draped over the shoulder
  const pts = [V3(-0.16, 1.2, 0.02), V3(-0.12, 1.36, 0.06), V3(0.0, 1.42, 0.1), V3(0.06, 1.38, 0.12), V3(0.1, 1.22, 0.1), V3(0.12, 1.05, 0.08)];
  const tape = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.006, 3), m.tape); tape.scale.set(1, 1, 0.75); g.add(tape);
  return g;
}

/** bird cage on a stand: domed wire cage, perch, an empty swing */
export function buildBirdCage(ctx, m) {
  const g = new THREE.Group(); g.name = 'birdCage';
  const r = 0.14, h = 0.3;
  g.add(mesh(new THREE.CylinderGeometry(r + 0.01, r + 0.015, 0.03, 32), m.brass));
  const wires = [];
  const nW = 24;
  for (let i = 0; i < nW; i++) {
    const a = (i / nW) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(V3(Math.cos(a) * r, 0.015 + t * h, Math.sin(a) * r)); }
    for (let k = 1; k <= 10; k++) { const t = k / 10; const rr = r * Math.cos(t * Math.PI / 2); pts.push(V3(Math.cos(a) * rr, 0.015 + h + Math.sin(t * Math.PI / 2) * r * 0.9, Math.sin(a) * rr)); }
    wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.0016, 3));
  }
  for (const w of wires) g.add(mesh(w, m.brass));
  for (const y of [0.1, 0.22, h]) g.add(at(mesh(new THREE.TorusGeometry(r, 0.0025, 4, 40).rotateX(Math.PI / 2), m.brass), 0, y, 0));
  g.add(at(mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 16), m.brass), 0, h + r * 0.9 + 0.035, 0));
  const perch = mesh(new THREE.CylinderGeometry(0.004, 0.004, r * 1.9, 6), m.handle); perch.rotation.z = Math.PI / 2; at(perch, 0, 0.12, 0); g.add(perch);
  return g;
}

/**
 * Dust sheet draped over an object: a grid shrink-wrapped over a height function,
 * the skirt falling to the floor with folds and a little pooling.
 * topH(x, z) gives the top surface over the footprint [-hw,hw]x[-hd,hd].
 */
export function dustSheetGeometry({ hw, hd, topH, seg = 72, seed = 1, flare = 0.06 }) {
  const maxH = 2.2;
  const L = Math.max(hw, hd) + maxH;
  const g = new THREE.PlaneGeometry(2 * L, 2 * L, seg, seg).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    // map the outer square onto the footprint + hanging skirt
    const ux = x / L, uz = z / L;
    const cx = THREE.MathUtils.clamp(ux * (hw + 0.6), -hw, hw);
    const cz = THREE.MathUtils.clamp(uz * (hd + 0.6), -hd, hd);
    const ex = ux * (hw + 0.6) - cx, ez = uz * (hd + 0.6) - cz;
    const top = topH(cx, cz);
    let e = Math.min(Math.hypot(ex, ez) * (maxH / 0.6), top + 0.1 + 0.05 * Math.sin(Math.atan2(ez, ex) * 7 + seed));
    let y = top - e;
    const dirx = e > 0 ? ex / Math.hypot(ex, ez) : 0, dirz = e > 0 ? ez / Math.hypot(ex, ez) : 0;
    const per = Math.atan2(cz + dirz, cx + dirx);
    const fold = Math.sin(per * 9 + seed) * 0.5 + Math.sin(per * 23 + seed * 2.1) * 0.3;
    let out = Math.min(e, 0.25) * 0.08 + flare * Math.min(1, e / Math.max(top, 0.01)) * (1 + 0.6 * fold);
    if (y < 0.004) { out += (0.004 - y) * 0.5; y = 0.004 + Math.abs(fold) * 0.008; }
    const nx = cx + dirx * out + (e > 0 ? -dirz : 0) * fold * 0.012 * Math.min(1, e);
    const nz = cz + dirz * out + (e > 0 ? dirx : 0) * fold * 0.012 * Math.min(1, e);
    p.setXYZ(i, nx, y + (e > 0 ? 0 : Math.sin(cx * 13 + seed) * Math.sin(cz * 11) * 0.006), nz);
    uv.setXY(i, x * 1.0, z * 1.0);
  }
  g.computeVertexNormals();
  return g;
}

/** stacked frames leaning against a wall (backs and one face) */
export function buildFrameStack(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'frames';
  const sizes = [[0.9, 0.7], [0.75, 0.95], [0.6, 0.5]];
  sizes.forEach(([w, h], i) => {
    const f = new THREE.Group();
    f.add(mesh(G.frameGeometry(w, h, { width: 0.07, depth: 0.04 }), i === 1 ? m.gilt : m.frameDark));
    const back = mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.1), i === 1 ? m.painting : m.canvasBack);
    back.position.z = 0.01; f.add(back);
    f.position.set(i * 0.12 - 0.12, h / 2 * Math.cos(0.18), i * 0.07);
    f.rotation.x = -0.18;
    f.rotation.y = (i - 1) * 0.05;
    g.add(f);
  });
  return g;
}

/** painted toy chest, lid thrown back, toys spilling over the rim */
export function buildToyChest(ctx, m, { w = 0.8, d = 0.45, h = 0.42 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'toyChest';
  const t = 0.022;
  g.add(at(mesh(bevelBox(G, w, t, d, 0.004), m.chestPaint), 0, t / 2 + 0.03, 0));
  for (const sz of [-1, 1]) g.add(at(mesh(bevelBox(G, w, h, t, 0.005), m.chestPaint), 0, h / 2 + 0.03, sz * (d / 2 - t / 2)));
  for (const sx of [-1, 1]) g.add(at(mesh(bevelBox(G, t, h, d - 2 * t, 0.005), m.chestPaint), sx * (w / 2 - t / 2), h / 2 + 0.03, 0));
  // trim bands + bun feet
  for (const y of [0.05, h + 0.01]) for (const sz of [-1, 1]) g.add(at(mesh(bevelBox(G, w + 0.01, 0.03, 0.012, 0.003), m.toyRed), 0, y, sz * (d / 2 + 0.002)));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(new THREE.SphereGeometry(0.03, 10, 8), m.chestPaint), sx * (w / 2 - 0.05), 0.02, sz * (d / 2 - 0.05)));
  // painted star on the front
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? 0.03 : 0.07; const p = [Math.cos(a) * r, -Math.sin(a) * r]; i ? star.lineTo(...p) : star.moveTo(...p); }
  g.add(at(mesh(new THREE.ShapeGeometry(star), m.toyGold), 0, h / 2 + 0.03, d / 2 + 0.002));
  // lid hinged at the back, thrown open past vertical
  const lid = new THREE.Group(); lid.position.set(0, h + 0.03, -d / 2); lid.rotation.x = -1.95; g.add(lid);
  lid.add(at(mesh(bevelBox(G, w + 0.02, 0.025, d + 0.02, 0.005), m.chestPaint), 0, 0.0125, d / 2));
  lid.add(at(mesh(bevelBox(G, w * 0.7, 0.004, d * 0.6, 0.002), m.toyBlue), 0, 0.027, d / 2));
  // contents: a ball, a wooden train and a doll's legs
  g.add(at(mesh(new THREE.SphereGeometry(0.075, 24, 16), m.ball), -0.15, h - 0.02, 0.02));
  const train = buildTrain(ctx, m); train.position.set(0.12, h - 0.06, 0.0); train.rotation.set(0.5, 0.4, 0.2); g.add(train);
  for (const s of [-1, 1]) { const leg = mesh(new THREE.CapsuleGeometry(0.014, 0.11, 4, 8), m.porcelain); leg.position.set(0.3 + s * 0.02, h + 0.06, -0.08); leg.rotation.set(0.4, 0, -0.5 + s * 0.1); g.add(leg); }
  return g;
}

/** little wooden locomotive */
export function buildTrain(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'train';
  g.add(at(mesh(bevelBox(G, 0.2, 0.025, 0.07, 0.004), m.toyRed), 0, 0.03, 0));
  const boiler = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 18), m.toyGreen); boiler.rotation.z = Math.PI / 2; at(boiler, 0.035, 0.07, 0); g.add(boiler);
  g.add(at(mesh(bevelBox(G, 0.07, 0.08, 0.075, 0.004), m.toyBlue), -0.06, 0.08, 0));
  g.add(at(mesh(bevelBox(G, 0.085, 0.012, 0.085, 0.003), m.toyRed), -0.06, 0.125, 0));
  g.add(at(mesh(lathe(G, [[0, 0], [0.012, 0], [0.012, 0.03], [0.02, 0.045], [0, 0.045]], 12), m.toyBlack), 0.07, 0.095, 0));
  for (const x of [-0.06, 0.0, 0.06]) for (const s of [-1, 1]) { const wh = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), m.toyBlack); wh.rotation.x = Math.PI / 2; at(wh, x, 0.022, s * 0.04); g.add(wh); }
  return g;
}

/** Windsor-style workshop chair */
export function buildChair(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'chair';
  const seat = mesh(lathe(G, [[0, 0], [0.2, 0], [0.215, 0.015], [0.21, 0.035], [0, 0.04]], 28), m.benchFrame); seat.scale.set(1, 1, 0.9); at(seat, 0, 0.44, 0); g.add(seat);
  const legG = lathe(G, [[0, 0], [0.016, 0], [0.02, 0.1], [0.016, 0.2], [0.022, 0.3], [0.014, 0.44], [0, 0.44]], 10);
  for (const [x, z] of [[-0.15, 0.13], [0.15, 0.13], [-0.14, -0.13], [0.14, -0.13]]) { const l = mesh(legG, m.benchFrame); at(l, x * 1.15, 0, z * 1.15); l.rotation.set(-z * 0.5, 0, x * 0.5); g.add(l); }
  for (const z of [0.0]) { const st = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.34, 8), m.benchFrame); st.rotation.z = Math.PI / 2; at(st, 0, 0.2, z); g.add(st); }
  // spindle back + bow
  const bow = mesh(new THREE.TorusGeometry(0.19, 0.016, 8, 28, Math.PI), m.benchFrame); at(bow, 0, 0.62, -0.15); bow.rotation.x = -0.15; g.add(bow);
  for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI; const sp = mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.36, 6), m.benchFrame); at(sp, Math.cos(a) * 0.17, 0.62, -0.15 - 0.03); sp.rotation.x = -0.15; g.add(sp); sp.position.y = 0.46 + Math.sin(a) * 0.16; sp.scale.y = (Math.sin(a) * 0.16 + 0.17) / 0.36 * 1.0 + 0.1; sp.position.y = 0.46 + (Math.sin(a) * 0.19 + 0.17) / 2; sp.scale.y = (Math.sin(a) * 0.19 + 0.17) / 0.36; }
  return g;
}
