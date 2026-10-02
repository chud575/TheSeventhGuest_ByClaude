import * as THREE from 'three';

/**
 * Dining-room furniture, all modelled for this room: spider-web-back chairs, the
 * round pedestal table, a Sheraton sideboard, the gasolier, candelabra, china.
 * Every builder returns a THREE.Group with origin on the floor (or the surface it
 * stands on) and +z as its "front".
 */

const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ chair
/**
 * The pierced "spider-web" chair back: a fan of spokes radiating from the seat
 * rail, crossed by three arched rings, cut out of a single board (Shape holes)
 * and extruded with a bevel, so the web reads as solid carved mahogany.
 */
export function webBackGeometry(G, { height = 0.84, w0 = 0.055, w1 = 0.225, thick = 0.024, frame = 0.03, bar = 0.017 } = {}) {
  const halfW = (v) => w0 + (w1 - w0) * Math.pow(v, 0.75);
  const topH = (u) => height * (0.9 + 0.1 * (1 - u * u)) + 0.025 * Math.exp(-((Math.abs(u) - 0.92) ** 2) / 0.004);
  const P = (u, v) => V2(u * halfW(v), v * topH(u));
  const shape = new THREE.Shape();
  const N = 24;
  shape.moveTo(-w0, 0);
  for (let i = 0; i <= N; i++) { const p = P(-1, i / N); shape.lineTo(p.x, p.y); }
  for (let i = 0; i <= N * 2; i++) { const u = -1 + (2 * i) / (N * 2); const p = P(u, 1); shape.lineTo(p.x, p.y); }
  for (let i = N; i >= 0; i--) { const p = P(1, i / N); shape.lineTo(p.x, p.y); }
  // web cells
  const spokes = 5;
  const rings = [0.16, 0.42, 0.64, 0.84];
  const uInner = (v) => 1 - frame / halfW(v);
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < spokes; i++) {
      const pts = [];
      const S = 8;
      const vA = rings[j], vB = rings[j + 1];
      const uAt = (k, v) => { const U = uInner(v); return -U + (2 * U * k) / spokes; };
      const du = (v) => (bar * 0.5) / halfW(v);
      const dv = bar * 0.5 / height;
      // ring lines are arched: v offset by +arch*(1-u^2)
      const arch = (u) => 0.09 * (1 - u * u);
      const pt = (u, v) => P(u, Math.min(0.995, v + arch(u)));
      const v0 = vA + dv, v1 = vB - dv;
      for (let s = 0; s <= S; s++) { const v = v0 + (v1 - v0) * (s / S); pts.push(pt(uAt(i, v) + du(v), v)); }
      for (let s = 0; s <= S; s++) { const v = v1; const a = uAt(i, v) + du(v), b = uAt(i + 1, v) - du(v); pts.push(pt(a + (b - a) * (s / S), v)); }
      for (let s = S; s >= 0; s--) { const v = v0 + (v1 - v0) * (s / S); pts.push(pt(uAt(i + 1, v) - du(v), v)); }
      for (let s = S; s >= 0; s--) { const v = v0; const a = uAt(i, v) + du(v), b = uAt(i + 1, v) - du(v); pts.push(pt(a + (b - a) * (s / S), v)); }
      shape.holes.push(new THREE.Path(pts));
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -thick / 2);
  return G.applyBoxUVs(g, 1.6);
}

export function buildChair(ctx, mats, { backGeo }) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'chair';
  const SH = 0.465;
  // upholstered seat with a slight dome
  const seat = new THREE.Mesh(new G.RoundedBoxGeometry(0.46, 0.06, 0.43, 4, 0.025), mats.seat);
  seat.scale.set(1, 1, 1); seat.position.set(0, SH + 0.02, 0.0);
  g.add(seat);
  const rail = new THREE.Mesh(G.boxUV(0.47, 0.07, 0.44, 1.5), mats.wood);
  rail.position.set(0, SH - 0.035, 0); g.add(rail);
  // brass nail heads along the front of the seat
  const nailGeo = new THREE.SphereGeometry(0.0045, 6, 4);
  for (let i = 0; i < 17; i++) { const n = new THREE.Mesh(nailGeo, mats.brass); n.position.set(-0.225 + i * (0.45 / 16), SH + 0.008, 0.222); g.add(n); }
  // front legs: turned
  const legProf = [[0.0, 0], [0.016, 0], [0.019, 0.02], [0.014, 0.05], [0.018, 0.12], [0.02, 0.25], [0.017, 0.34], [0.024, 0.37], [0.022, 0.4], [0.026, 0.43], [0.0, 0.43]];
  const legGeo = G.latheFromProfile(legProf, 14);
  for (const x of [-0.2, 0.2]) { const l = new THREE.Mesh(legGeo, mats.wood); l.position.set(x, 0, 0.19); g.add(l); }
  // rear legs: square, splayed backward, continuing into the back stiles
  for (const x of [-0.19, 0.19]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, SH, 4, 1), mats.wood);
    l.geometry.rotateY(Math.PI / 4);
    l.position.set(x, SH / 2, -0.2); l.rotation.x = 0.12; g.add(l);
  }
  // stretchers
  for (const z of [-0.02]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 8), mats.wood);
    s.rotation.z = Math.PI / 2; s.position.set(0, 0.16, z); g.add(s);
  }
  for (const x of [-0.195, 0.195]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 8), mats.wood);
    s.rotation.x = Math.PI / 2; s.position.set(x, 0.14, 0.0); g.add(s);
  }
  // the web back
  const back = new THREE.Mesh(backGeo, mats.wood);
  back.position.set(0, SH + 0.01, -0.205); back.rotation.x = -0.12;
  g.add(back);
  // crest finial
  const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0.0], [0.016, 0.012], [0.008, 0.026], [0.012, 0.034], [0, 0.046]], 10), mats.wood);
  fin.position.set(0, SH + 0.01 + 0.865 * Math.cos(0.12), -0.205 - 0.865 * Math.sin(0.12)); fin.rotation.x = -0.12; g.add(fin);
  return g;
}

// ------------------------------------------------------------------ table
export function buildTable(ctx, mats, { radius = 0.86, height = 0.76 } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'table';
  const R = radius;
  // top with an ogee-moulded edge (lathe)
  const top = new THREE.Mesh(G.latheFromProfile([[0, height], [R - 0.02, height], [R, height - 0.008], [R + 0.008, height - 0.02], [R, height - 0.032], [R - 0.012, height - 0.04], [R - 0.01, height - 0.048], [0, height - 0.048]], 96), mats.top);
  g.add(top);
  // apron with a bead
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.06, R - 0.06, 0.09, 72, 1, true), mats.wood);
  apron.position.y = height - 0.09; g.add(apron);
  const bead = new THREE.Mesh(new THREE.TorusGeometry(R - 0.055, 0.008, 6, 96), mats.wood);
  bead.rotation.x = Math.PI / 2; bead.position.y = height - 0.13; g.add(bead);
  // turned pedestal
  const ped = new THREE.Mesh(G.latheFromProfile([
    [0.0, 0.1], [0.16, 0.1], [0.17, 0.13], [0.13, 0.16], [0.11, 0.2], [0.12, 0.24], [0.085, 0.28], [0.07, 0.36], [0.075, 0.42], [0.1, 0.46], [0.11, 0.5], [0.09, 0.53],
    [0.065, 0.57], [0.06, 0.62], [0.08, 0.65], [0.12, 0.67], [0.12, height - 0.13], [0.0, height - 0.13],
  ], 40), mats.wood);
  g.add(ped);
  // four cabriole legs with brass paw castors
  const legProfile = [V2(-0.03, 0), V2(0.03, 0), V2(0.032, 0.02), V2(0.026, 0.05), V2(-0.026, 0.05), V2(-0.032, 0.02), V2(-0.03, 0)];
  const path = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = 0.13 + t * 0.4;
    const y = 0.2 * (1 - t) + 0.05 * Math.sin(t * Math.PI) - 0.04 * t * t + 0.03;
    path.push(V3(r, y, 0));
  }
  const legGeo = G.sweepProfile(legProfile.map((p) => V2(p.y - 0.025, p.x)), path, { uvScale: 2, up: V3(0, 0, 1) });
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(legGeo, mats.wood);
    leg.rotation.y = a; g.add(leg);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), mats.brass);
    paw.scale.set(1.2, 0.9, 1.0);
    paw.position.set(Math.cos(a) * 0.53, 0.028, -Math.sin(a) * 0.53); g.add(paw);
  }
  return g;
}

// ------------------------------------------------------------------ sideboard
export function buildSideboard(ctx, mats, { w = 1.75, d = 0.56, h = 0.93 } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'sideboard';
  const bodyH = 0.36, bodyY = h - 0.035 - bodyH / 2;
  const body = new THREE.Mesh(new G.RoundedBoxGeometry(w - 0.04, bodyH, d - 0.04, 3, 0.008), mats.wood);
  body.position.y = bodyY; g.add(body);
  const top = new THREE.Mesh(new G.RoundedBoxGeometry(w + 0.04, 0.035, d + 0.03, 3, 0.012), mats.top);
  top.position.y = h - 0.017; g.add(top);
  // drawer fronts / doors with gilt stringing
  const fronts = [[-w * 0.33, w * 0.3], [0, w * 0.32], [w * 0.33, w * 0.3]];
  for (const [x, fw] of fronts) {
    const dr = new THREE.Mesh(G.raisedPanel(fw - 0.03, bodyH - 0.05, { border: 0.03, bevel: 0.012, fieldDepth: 0.006, frameDepth: 0.012 }), mats.wood);
    dr.position.set(x, bodyY, d / 2 - 0.02); g.add(dr);
    // gilt line inlay (thin frame)
    const iw = fw - 0.1, ih = bodyH - 0.12;
    for (const [sx, sy, px, py] of [[iw, 0.004, 0, ih / 2], [iw, 0.004, 0, -ih / 2], [0.004, ih, iw / 2, 0], [0.004, ih, -iw / 2, 0]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.002), mats.gilt);
      l.position.set(x + px, bodyY + py, d / 2 + 0.002); g.add(l);
    }
    const knob = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0], [0.008, 0.012], [0.016, 0.02], [0.0, 0.03]], 12), mats.brass);
    knob.rotation.x = Math.PI / 2; knob.position.set(x, bodyY, d / 2 - 0.0); g.add(knob);
  }
  // six square tapered legs with spade feet
  const legH = h - 0.035 - bodyH;
  const legGeo = new THREE.CylinderGeometry(0.03, 0.017, legH, 4, 1);
  legGeo.rotateY(Math.PI / 4);
  const footGeo = new THREE.CylinderGeometry(0.02, 0.014, 0.05, 4, 1); footGeo.rotateY(Math.PI / 4);
  for (const x of [-w / 2 + 0.05, -w * 0.17, w * 0.17, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) {
    if (Math.abs(x) < 0.4 && z < 0) continue;
    const l = new THREE.Mesh(legGeo, mats.wood); l.position.set(x, legH / 2 + 0.03, z); g.add(l);
    const f = new THREE.Mesh(footGeo, mats.wood); f.position.set(x, 0.025, z); g.add(f);
    // gilt collar
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.045), mats.gilt); c.position.set(x, legH + 0.024, z); g.add(c);
  }
  // back gallery
  const gal = new THREE.Mesh(new G.RoundedBoxGeometry(w, 0.12, 0.025, 2, 0.008), mats.wood);
  gal.position.set(0, h + 0.06, -d / 2 + 0.02); g.add(gal);
  const galTop = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, w + 0.02, 10), mats.gilt);
  galTop.rotation.z = Math.PI / 2; galTop.position.set(0, h + 0.125, -d / 2 + 0.02); g.add(galTop);
  return g;
}

// ------------------------------------------------------------------ candelabrum
export function buildCandelabrum(ctx, mats, { arms = 2, armR = 0.15, lit = true, seed = 1, candleH = 0.2 } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'candelabrum';
  g.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.085, 0], [0.085, 0.01], [0.06, 0.03], [0.03, 0.05], [0.02, 0.09], [0.032, 0.12], [0.016, 0.16], [0.014, 0.3], [0.026, 0.32], [0.012, 0.34], [0.0, 0.34]], 28), mats.metal));
  const candles = [];
  const cupGeo = G.latheFromProfile([[0, 0], [0.012, 0], [0.024, 0.012], [0.03, 0.016], [0.02, 0.02], [0.016, 0.04], [0.0, 0.04]], 16);
  const spots = [[0, 0.34]];
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(V3(Math.cos(a) * armR * t, 0.24 + Math.sin(t * Math.PI) * 0.06 - t * 0.02, -Math.sin(a) * armR * t)); }
    const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.007, 6), mats.metal);
    g.add(arm);
    spots.push([a, 0.24 - 0.02, Math.cos(a) * armR, -Math.sin(a) * armR]);
  }
  spots.forEach((sp, i) => {
    const x = sp.length > 2 ? sp[2] : 0, z = sp.length > 2 ? sp[3] : 0, y = sp.length > 2 ? sp[1] : sp[1];
    const cup = new THREE.Mesh(cupGeo, mats.metal); cup.position.set(x, y, z); g.add(cup);
    const c = ctx.fx.candle({ height: candleH - (i === 0 ? 0 : 0.02), radius: 0.011, lit, light: false, seed: seed * 13 + i * 7, burn: 0.5 + 0.12 * i });
    c.position.set(x, y + 0.035, z); c.userData.keep = true; g.add(c); candles.push(c);
  });
  g.userData.candles = candles;
  return g;
}

// ------------------------------------------------------------------ gasolier
export function buildChandelier(ctx, mats, { drop = 1.0, arms = 5, armR = 0.42 } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'chandelier';
  // ceiling rose is built by the room; here: stem from y=0 down to -drop
  const stem = new THREE.Mesh(G.latheFromProfile([
    [0.0, 0], [0.05, 0], [0.05, -0.02], [0.02, -0.05], [0.014, -0.08], [0.014, -drop * 0.35], [0.03, -drop * 0.37], [0.014, -drop * 0.4], [0.014, -drop * 0.62],
    [0.035, -drop * 0.65], [0.05, -drop * 0.7], [0.03, -drop * 0.74], [0.02, -drop * 0.78],
  ], 20), mats.brass);
  g.add(stem);
  // chain links near the top
  const linkGeo = new THREE.TorusGeometry(0.018, 0.0045, 6, 12);
  for (let i = 0; i < 8; i++) { const l = new THREE.Mesh(linkGeo, mats.brass); l.position.y = -0.1 - i * 0.03; l.rotation.y = (i % 2) * Math.PI / 2; g.add(l); }
  const hubY = -drop * 0.8;
  // brass bowl hub + frosted dish
  g.add(new THREE.Mesh(G.latheFromProfile([[0, hubY + 0.04], [0.06, hubY + 0.03], [0.11, hubY], [0.13, hubY - 0.03], [0.1, hubY - 0.06], [0.05, hubY - 0.09], [0.025, hubY - 0.14], [0.035, hubY - 0.17], [0.0, hubY - 0.2]], 28), mats.brass));
  const dish = new THREE.Mesh(G.latheFromProfile([[0.0, hubY - 0.05], [0.1, hubY - 0.045], [0.17, hubY - 0.02], [0.2, hubY + 0.015], [0.205, hubY + 0.02]], 32), mats.frost);
  dish.userData.glow = true; g.add(dish);
  const globes = [];
  const globeGeo = G.latheFromProfile([[0.0, 0], [0.03, 0.005], [0.06, 0.03], [0.075, 0.07], [0.07, 0.11], [0.05, 0.14], [0.03, 0.15], [0.032, 0.16], [0.0, 0.16]], 24);
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + 0.3;
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      const r = 0.08 + t * armR;
      const y = hubY - 0.06 - Math.sin(t * Math.PI) * 0.1 + t * t * 0.17;
      pts.push(V3(Math.cos(a) * r, y, -Math.sin(a) * r));
    }
    const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.011, 8), mats.brass);
    g.add(arm);
    // scroll curl under each arm
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 6, 16, Math.PI * 1.4), mats.brass);
    curl.position.set(Math.cos(a) * (0.08 + armR * 0.35), hubY - 0.13, -Math.sin(a) * (0.08 + armR * 0.35));
    curl.rotation.y = a + Math.PI / 2; g.add(curl);
    const end = pts[pts.length - 1];
    const cup = new THREE.Mesh(G.latheFromProfile([[0, -0.02], [0.02, -0.02], [0.04, 0.0], [0.045, 0.02], [0.035, 0.025], [0.0, 0.025]], 16), mats.brass);
    cup.position.copy(end); g.add(cup);
    const globe = new THREE.Mesh(globeGeo, mats.globe);
    globe.position.copy(end).add(V3(0, 0.02, 0)); g.add(globe);
    globe.userData.glow = true;
    globes.push(globe);
    // a few crystal drops
    const drop1 = new THREE.Mesh(new THREE.OctahedronGeometry(0.012, 0), mats.crystal);
    drop1.scale.set(1, 1.8, 1); drop1.position.copy(end).add(V3(0, -0.06, 0)); g.add(drop1);
  }
  g.userData.globes = globes;
  g.userData.hubY = hubY;
  return g;
}

// ------------------------------------------------------------------ tableware
export function plateGeometry(G, r = 0.13) {
  return G.latheFromProfile([[0, 0], [r * 0.55, 0], [r * 0.58, 0.003], [r * 0.62, 0.008], [r * 0.8, 0.012], [r, 0.02], [r * 0.985, 0.024], [r * 0.78, 0.016], [r * 0.6, 0.011], [0, 0.011]], 40);
}

/** Planar UV for the china texture (disc in xz). */
export function discUV(geo, r) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = 0.5 + pos.getX(i) / (2 * r); uv[i * 2 + 1] = 0.5 - pos.getZ(i) / (2 * r); }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export function gobletGeometry(G, s = 1) {
  return G.latheFromProfile([[0, 0], [0.034, 0.0], [0.033, 0.004], [0.008, 0.012], [0.005, 0.03], [0.009, 0.075], [0.004, 0.09], [0.022, 0.1], [0.036, 0.13], [0.038, 0.165], [0.0365, 0.168], [0.034, 0.13], [0.02, 0.104], [0.0, 0.1]].map(([r, y]) => [r * s, y * s]), 24);
}

export function buildPlaceSetting(ctx, mats, { chinaMat } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  const charger = new THREE.Mesh(plateGeometry(G, 0.16), mats.charger); g.add(charger);
  const plate = new THREE.Mesh(discUV(plateGeometry(G, 0.125), 0.125), chinaMat); plate.position.y = 0.012; g.add(plate);
  // folded napkin (bishop's mitre — a pinched cone)
  const nap = new THREE.Mesh(new G.RoundedBoxGeometry(0.1, 0.022, 0.16, 2, 0.008), mats.linen);
  nap.position.set(-0.27, 0.011, 0.02); nap.rotation.y = 0.08; g.add(nap);
  // cutlery
  const knife = new THREE.Mesh(new G.RoundedBoxGeometry(0.016, 0.004, 0.2, 2, 0.0018), mats.silver); knife.position.set(0.19, 0.004, 0.0); g.add(knife);
  const fork = new THREE.Mesh(new G.RoundedBoxGeometry(0.018, 0.004, 0.19, 2, 0.0018), mats.silver); fork.position.set(-0.19, 0.004, 0.0); g.add(fork);
  const spoon = new THREE.Mesh(new G.RoundedBoxGeometry(0.014, 0.004, 0.17, 2, 0.0018), mats.silver); spoon.position.set(0.22, 0.004, 0.0); g.add(spoon);
  // goblet + wine glass
  const gob = new THREE.Mesh(gobletGeometry(G, 1.0), mats.crystal); gob.position.set(0.16, 0, -0.17); g.add(gob);
  const wine = new THREE.Mesh(G.latheFromProfile([[0, 0.11], [0.024, 0.115], [0.03, 0.13], [0.0, 0.13]], 16), mats.wine); wine.position.set(0.16, 0, -0.17); g.add(wine);
  const gob2 = new THREE.Mesh(gobletGeometry(G, 0.8), mats.crystal); gob2.position.set(0.23, 0, -0.1); g.add(gob2);
  return g;
}
