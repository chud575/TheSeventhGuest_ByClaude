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
/** remove zero-area / zero-normal triangles from a non-indexed geometry (they shade to NaN) */
export function dropDegenerate(g) {
  if (g.index) g = g.toNonIndexed();
  const P = g.attributes.position.array, N = g.attributes.normal.array, UV = g.attributes.uv?.array;
  const keep = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < P.length / 9; t++) {
    a.fromArray(P, t * 9); b.fromArray(P, t * 9 + 3); c.fromArray(P, t * 9 + 6);
    const area = b.sub(a).cross(c.sub(a)).length();
    let ok = area > 1e-10;
    for (let k = 0; k < 3 && ok; k++) { const i = t * 9 + k * 3; if (N[i] * N[i] + N[i + 1] * N[i + 1] + N[i + 2] * N[i + 2] < 1e-8) ok = false; }
    if (ok) keep.push(t);
  }
  const out = new THREE.BufferGeometry();
  const take = (src, n) => { const d = new Float32Array(keep.length * 3 * n); keep.forEach((t, j) => d.set(src.subarray(t * 3 * n, (t + 1) * 3 * n), j * 3 * n)); return d; };
  out.setAttribute('position', new THREE.BufferAttribute(take(P, 3), 3));
  out.setAttribute('normal', new THREE.BufferAttribute(take(N, 3), 3));
  if (UV) out.setAttribute('uv', new THREE.BufferAttribute(take(UV, 2), 2));
  return out;
}
/** point-in-polygon (2D, Vector2[]) */
function inPoly(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
/** distance along a ray (origin o, unit dir d) to the first polygon edge */
function rayPoly(o, d, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    const ex = b.x - a.x, ey = b.y - a.y;
    const den = d.x * ey - d.y * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a.x - o.x) * ey - (a.y - o.y) * ex) / den;
    const u = ((a.x - o.x) * d.y - (a.y - o.y) * d.x) / den;
    if (t > 1e-5 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return best;
}

/**
 * The carved "spider-web" chair back: a shaped crest rail and stiles (one bevelled
 * frame), nine tapering spokes radiating from a carved fan boss on the lower rail,
 * crossed by two concentric web rails. Each member is extruded with a bevel so the
 * edges catch the light; everything is merged into a single geometry.
 * Origin at the bottom centre of the back, +y up, +z toward the sitter.
 */
export function webBackGeometry(G, { height = 0.86, w0 = 0.165, w1 = 0.215, thick = 0.028, frame = 0.042 } = {}) {
  const ext = (shape, depth = thick, bevel = 0.0045) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 2, curveSegments: 10 });
    g.translate(0, 0, -depth / 2 + bevel);
    return g.index ? g.toNonIndexed() : g;
  };
  // outline: stiles splay slightly; crest arched with eared corners
  const crest = (u) => height * (0.93 + 0.07 * (1 - u * u)) + 0.022 * Math.exp(-((Math.abs(u) - 0.97) ** 2) / 0.0025);
  const halfW = (v) => w0 + (w1 - w0) * v;
  const outer = [], N = 28;
  outer.push(V2(-w0, 0));
  for (let i = 1; i <= N; i++) { const v = (i / N) * 0.93; outer.push(V2(-halfW(v), v * height)); }
  for (let i = 0; i <= N * 2; i++) { const u = -1 + (2 * i) / (N * 2); outer.push(V2(u * w1, crest(u))); }
  for (let i = N; i >= 1; i--) { const v = (i / N) * 0.93; outer.push(V2(halfW(v), v * height)); }
  outer.push(V2(w0, 0));
  const railH = 0.07;
  const crestIn = (u) => crest(u) - frame * 1.5 - 0.02 * (1 - u * u);
  const inner = [];
  const iw = (v) => halfW(v) - frame;
  inner.push(V2(-iw(railH / height), railH));
  for (let i = 0; i <= N * 2; i++) { const u = -1 + (2 * i) / (N * 2); const y = crestIn(u * 0.98); inner.push(V2(u * iw(y / height), y)); }
  inner.push(V2(iw(railH / height), railH));
  const shape = new THREE.Shape(outer);
  shape.holes.push(new THREE.Path(inner.slice().reverse()));
  const parts = [ext(shape)];
  // fan boss on the lower rail
  const B = V2(0, railH - 0.005);
  const bossR = 0.07;
  {
    const bs = new THREE.Shape();
    bs.moveTo(-bossR, B.y); bs.absarc(B.x, B.y, bossR, Math.PI, 0, true); bs.lineTo(-bossR, B.y);
    parts.push(ext(bs, thick + 0.01, 0.006));
    // carved flutes in the boss (raised ribs)
    for (let k = 0; k < 7; k++) {
      const a = Math.PI * (k + 0.5) / 7;
      const rs = new THREE.Shape();
      const d = V2(Math.cos(a), Math.sin(a)), n = V2(-d.y, d.x);
      const p0 = V2(B.x + d.x * 0.018, B.y + d.y * 0.018), p1 = V2(B.x + d.x * (bossR - 0.008), B.y + d.y * (bossR - 0.008));
      rs.moveTo(p0.x - n.x * 0.002, p0.y - n.y * 0.002); rs.lineTo(p1.x - n.x * 0.006, p1.y - n.y * 0.006);
      rs.lineTo(p1.x + n.x * 0.006, p1.y + n.y * 0.006); rs.lineTo(p0.x + n.x * 0.002, p0.y + n.y * 0.002);
      parts.push(ext(rs, thick + 0.018, 0.003));
    }
  }
  // spokes
  const spokes = 11;
  for (let k = 0; k < spokes; k++) {
    const a = THREE.MathUtils.degToRad(-74 + (148 * k) / (spokes - 1));
    const d = V2(Math.sin(a), Math.cos(a));
    const O = V2(B.x + d.x * 0.06, B.y + d.y * 0.06);
    const L = 0.06 + rayPoly(O, d, inner) + 0.012;
    const n = V2(-d.y, d.x);
    const r0 = bossR - 0.01, wA = 0.0125, wB = 0.0085;
    const p0 = V2(B.x + d.x * r0, B.y + d.y * r0), p1 = V2(B.x + d.x * L, B.y + d.y * L);
    const sp = new THREE.Shape();
    sp.moveTo(p0.x - n.x * wA, p0.y - n.y * wA); sp.lineTo(p1.x - n.x * wB, p1.y - n.y * wB);
    sp.lineTo(p1.x + n.x * wB, p1.y + n.y * wB); sp.lineTo(p0.x + n.x * wA, p0.y + n.y * wA);
    parts.push(ext(sp, thick * 0.8, 0.0035));
  }
  // concentric web rails (gently scalloped between the spokes)
  for (const [R, w] of [[0.27, 0.0115], [0.52, 0.011]]) {
    let run = [];
    const flush = () => {
      if (run.length > 2) {
        const sh = new THREE.Shape();
        const out = run.map(([a, r]) => V2(B.x + Math.sin(a) * (r + w), B.y + Math.cos(a) * (r + w)));
        const inn = run.map(([a, r]) => V2(B.x + Math.sin(a) * (r - w), B.y + Math.cos(a) * (r - w))).reverse();
        sh.setFromPoints([...out, ...inn]);
        parts.push(ext(sh, thick * 0.7, 0.003));
      }
      run = [];
    };
    for (let i = 0; i <= 120; i++) {
      const a = THREE.MathUtils.degToRad(-88 + (176 * i) / 120);
      const sc = R * (1 - 0.06 * Math.abs(Math.sin((a + THREE.MathUtils.degToRad(74)) * (spokes - 1) / THREE.MathUtils.degToRad(148) * Math.PI)));
      const p = V2(B.x + Math.sin(a) * sc, B.y + Math.cos(a) * sc);
      // keep inside the frame opening (slightly overlapping into the frame)
      const pIn = V2(B.x + Math.sin(a) * (sc - 0.016), B.y + Math.cos(a) * (sc - 0.016));
      if (inPoly(pIn, inner) && p.y > railH) run.push([a, sc]); else flush();
    }
    flush();
  }
  // pierced fan crest standing on the top rail: a half-disc with radiating slots and a beaded rim
  {
    const cy = crest(0) - 0.004, R = 0.075;
    const fs = new THREE.Shape();
    fs.moveTo(-R, cy); fs.absarc(0, cy, R, Math.PI, 0, true); fs.lineTo(-R, cy);
    for (let k = 0; k < 6; k++) {
      const a0 = Math.PI * (k + 0.18) / 6, a1 = Math.PI * (k + 0.82) / 6;
      const hp = new THREE.Path();
      hp.moveTo(Math.cos(a0) * 0.022, cy + Math.sin(a0) * 0.022);
      hp.lineTo(Math.cos(a0) * (R - 0.014), cy + Math.sin(a0) * (R - 0.014));
      hp.absarc(0, cy, R - 0.014, a0, a1, false);
      hp.lineTo(Math.cos(a1) * 0.022, cy + Math.sin(a1) * 0.022);
      fs.holes.push(hp);
    }
    parts.push(ext(fs, thick * 0.9, 0.004));
    const boss = new THREE.Shape(); boss.moveTo(-0.02, cy); boss.absarc(0, cy, 0.02, Math.PI, 0, true); boss.lineTo(-0.02, cy);
    parts.push(ext(boss, thick + 0.008, 0.005));
  }
  const g = G.mergeGeometries(parts.map((x) => { for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); return x; }));
  return dropDegenerate(G.applyBoxUVs(g, 1.6));
}

/** domed, button-tufted seat cushion (top surface displaced, rounded edges) */
function seatGeometry(w, d, h) {
  const g = new THREE.BoxGeometry(w, h, d, 24, 3, 22);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ux = x / (w / 2), uz = z / (d / 2);
    // round the vertical edges and dome the top
    const r = Math.max(Math.abs(ux), Math.abs(uz));
    if (y > 0) y += 0.022 * (1 - ux * ux) * (1 - uz * uz) - 0.012 * Math.pow(r, 6);
    const pinch = 1 - 0.035 * Math.pow(Math.abs(y / (h / 2)), 3);
    p.setXYZ(i, x * pinch, y, z * pinch);
  }
  g.computeVertexNormals();
  // planar top UVs in metres
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) + 0.5, p.getZ(i) + 0.5);
  return g;
}

export function buildChair(ctx, mats, { backGeo }) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'chair';
  const SH = 0.465;
  const seat = new THREE.Mesh(seatGeometry(0.47, 0.44, 0.05), mats.seat);
  seat.position.set(0, SH + 0.018, 0.005);
  g.add(seat);
  // seat rail with a moulded lower edge
  const rail = new THREE.Mesh(new G.RoundedBoxGeometry(0.475, 0.07, 0.445, 2, 0.008), mats.wood);
  rail.position.set(0, SH - 0.035, 0); g.add(rail);
  const bead = new THREE.Mesh(new G.RoundedBoxGeometry(0.485, 0.012, 0.455, 2, 0.005), mats.wood);
  bead.position.set(0, SH - 0.072, 0); g.add(bead);
  // brass nail-head trim close-set along the front and sides of the cushion
  const nailGeo = new THREE.SphereGeometry(0.0048, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  nailGeo.rotateX(Math.PI / 2);
  const nails = [];
  const yN = SH + 0.006;
  for (let i = 0; i <= 30; i++) { const m = new THREE.Matrix4().makeTranslation(-0.232 + i * (0.464 / 30), yN, 0.228); nails.push(nailGeo.clone().applyMatrix4(m)); }
  for (const sx of [-1, 1]) for (let i = 0; i < 26; i++) {
    const m = new THREE.Matrix4().makeRotationY(sx * Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(sx * 0.238, yN, 0.21 - i * (0.42 / 26)));
    nails.push(nailGeo.clone().applyMatrix4(m));
  }
  g.add(new THREE.Mesh(G.mergeGeometries(nails), mats.brass));
  // front legs: turned, with a collar and a tapering foot
  const legProf = [[0.0, 0], [0.014, 0], [0.017, 0.012], [0.013, 0.03], [0.016, 0.1], [0.02, 0.22], [0.022, 0.3], [0.017, 0.33], [0.026, 0.355], [0.019, 0.375], [0.024, 0.395], [0.026, 0.43], [0.0, 0.43]];
  const legGeo = G.latheFromProfile(legProf, 16);
  for (const x of [-0.2, 0.2]) { const l = new THREE.Mesh(legGeo, mats.wood); l.position.set(x, 0, 0.19); g.add(l); }
  // rear legs: square, raked backward
  for (const x of [-0.185, 0.185]) {
    const l = new THREE.Mesh(new G.RoundedBoxGeometry(0.032, SH, 0.034, 2, 0.006), mats.wood);
    l.position.set(x, SH / 2 - 0.005, -0.205); l.rotation.x = 0.12; g.add(l);
  }
  // H-stretcher
  const st = (len, rot, pos) => { const s = new THREE.Mesh(G.latheFromProfile([[0, -len / 2], [0.008, -len / 2], [0.009, -len * 0.3], [0.012, 0], [0.009, len * 0.3], [0.008, len / 2], [0, len / 2]], 10), mats.wood); s.rotation.set(...rot); s.position.set(...pos); g.add(s); };
  st(0.39, [0, 0, Math.PI / 2], [0, 0.17, -0.0]);
  for (const x of [-0.195, 0.195]) st(0.39, [Math.PI / 2, 0, 0], [x, 0.14, 0.0]);
  // the carved web back
  const back = new THREE.Mesh(backGeo, mats.wood);
  back.position.set(0, SH - 0.01, -0.215); back.rotation.x = -0.13;
  g.add(back);
  // turned finials on the crest ears
  const finG = G.latheFromProfile([[0, 0], [0.011, 0.0], [0.014, 0.01], [0.007, 0.022], [0.012, 0.032], [0, 0.046]], 10);
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(finG, mats.wood);
    const y = 0.86 * 0.93 + 0.03, zz = -0.215;
    f.position.set(sx * 0.212, SH - 0.01 + y * Math.cos(0.13), zz - y * Math.sin(0.13)); f.rotation.x = -0.13; g.add(f);
  }
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
  { const p = top.geometry.attributes.position, uv = top.geometry.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2.04 * R), 0.5 - p.getZ(i) / (2.04 * R)); }
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
  // six turned, reeded and tapered legs: collar, reeded shaft, ring and a peg foot
  const legH = h - 0.035 - bodyH;
  const legGeo = G.latheFromProfile([[0, 0], [0.012, 0], [0.014, 0.02], [0.011, 0.045], [0.016, 0.06], [0.018, 0.075], [0.016, 0.09],
    [0.017, legH * 0.55], [0.022, legH - 0.07], [0.026, legH - 0.055], [0.022, legH - 0.04], [0.028, legH - 0.025], [0.028, legH], [0, legH]], 36);
  { // reeding: shallow vertical flutes on the shaft
    const lp = legGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const y = lp.getY(i); if (y < 0.1 || y > legH - 0.075) continue;
      const a = Math.atan2(lp.getZ(i), lp.getX(i)), k = 1 + 0.07 * Math.pow(Math.abs(Math.cos(a * 8)), 0.5) - 0.035;
      lp.setX(i, lp.getX(i) * k); lp.setZ(i, lp.getZ(i) * k);
    }
    legGeo.computeVertexNormals();
  }
  for (const x of [-w / 2 + 0.05, -w * 0.17, w * 0.17, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) {
    if (Math.abs(x) < 0.4 && z < 0) continue;
    const l = new THREE.Mesh(legGeo, mats.wood); l.position.set(x, 0, z); g.add(l);
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 6, 20), mats.gilt); c.rotation.x = Math.PI / 2; c.position.set(x, legH - 0.04, z); g.add(c);
  }
  // cock-beading round each drawer opening and a moulded edge under the top
  for (const [x, fw] of fronts) {
    const bw = fw - 0.012, bh = bodyH - 0.03;
    for (const [len, px, py, rz] of [[bw, 0, bh / 2, Math.PI / 2], [bw, 0, -bh / 2, Math.PI / 2], [bh, bw / 2, 0, 0], [bh, -bw / 2, 0, 0]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, len, 8), mats.wood); b.rotation.z = rz; b.position.set(x + px, bodyY + py, d / 2 - 0.018); g.add(b);
    }
  }
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, w + 0.02, 10), mats.wood); lip.rotation.z = Math.PI / 2; lip.position.set(0, h - 0.04, d / 2 - 0.01); g.add(lip);
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
/**
 * Heavy cast-brass gasolier: a turned column with a bulbous font, five S-scroll arms
 * with leaf collars and C-scroll brackets, frosted tulip shades, and a large frosted
 * bowl hung under the font on a brass rim. Origin = ceiling attachment.
 */
export function buildChandelier(ctx, mats, { drop = 1.0, arms = 5, armR = 0.42 } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'chandelier';
  const brass = [], frost = [], globe = [];
  const put = (list, geo, m) => { if (m) geo.applyMatrix4(m); list.push(geo.index ? geo.toNonIndexed() : geo); };
  const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  // canopy + gas pipe stem with collars
  put(brass, G.latheFromProfile([[0, 0], [0.11, 0], [0.11, -0.02], [0.09, -0.05], [0.05, -0.08], [0.03, -0.1], [0, -0.11]], 32));
  const hubY = -drop * 0.78;
  put(brass, G.latheFromProfile([
    [0.0, -0.1], [0.018, -0.1], [0.018, -0.18], [0.03, -0.2], [0.018, -0.22], [0.016, hubY * 0.55], [0.034, hubY * 0.55 - 0.02], [0.05, hubY * 0.55 - 0.05],
    [0.034, hubY * 0.55 - 0.08], [0.018, hubY * 0.55 - 0.1], [0.018, hubY + 0.2], [0.03, hubY + 0.18], [0.02, hubY + 0.16], [0, hubY + 0.16],
  ].map(([r, y]) => [r, y]).reverse(), 28));
  // font: heavy urn body with gadrooned belly (scaled lathe + ribs)
  put(brass, G.latheFromProfile([[0, hubY + 0.17], [0.03, hubY + 0.165], [0.05, hubY + 0.14], [0.06, hubY + 0.12], [0.1, hubY + 0.06], [0.125, hubY + 0.0], [0.115, hubY - 0.04], [0.085, hubY - 0.07], [0.06, hubY - 0.08], [0.0, hubY - 0.08]].reverse(), 40));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rib = new THREE.CapsuleGeometry(0.012, 0.08, 4, 8);
    const m = new THREE.Matrix4().makeRotationZ(0.55).premultiply(new THREE.Matrix4().makeRotationY(-a)).premultiply(T(Math.cos(a) * 0.105, hubY + 0.04, Math.sin(a) * 0.105));
    put(brass, rib, m);
  }
  put(brass, new THREE.TorusGeometry(0.122, 0.012, 8, 48), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(T(0, hubY + 0.005, 0)));
  // frosted bowl below the font, on a brass rim, with a finial
  const bowlTop = hubY - 0.09;
  put(frost, G.latheFromProfile([[0.0, bowlTop - 0.2], [0.06, bowlTop - 0.195], [0.13, bowlTop - 0.165], [0.18, bowlTop - 0.11], [0.205, bowlTop - 0.05], [0.21, bowlTop - 0.0]], 48));
  put(brass, new THREE.TorusGeometry(0.212, 0.011, 8, 56), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(T(0, bowlTop, 0)));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const pts = [V3(Math.cos(a) * 0.07, hubY - 0.07, Math.sin(a) * 0.07), V3(Math.cos(a) * 0.15, bowlTop + 0.03, Math.sin(a) * 0.15), V3(Math.cos(a) * 0.21, bowlTop, Math.sin(a) * 0.21)];
    put(brass, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.007, 6));
  }
  put(brass, G.latheFromProfile([[0, bowlTop - 0.19], [0.03, bowlTop - 0.2], [0.025, bowlTop - 0.23], [0.012, bowlTop - 0.26], [0.02, bowlTop - 0.28], [0, bowlTop - 0.31]].reverse(), 20));
  // S-scroll arms
  const globes = [];
  const shadeG = G.latheFromProfile([[0.022, 0], [0.03, 0.01], [0.05, 0.035], [0.068, 0.075], [0.075, 0.11], [0.07, 0.13], [0.064, 0.135]], 28);
  const collarG = G.latheFromProfile([[0, -0.012], [0.022, -0.012], [0.026, -0.004], [0.02, 0.004], [0.024, 0.01], [0, 0.012]], 14);
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + 0.3;
    const c = Math.cos(a), sn = -Math.sin(a);
    const P = (r, y) => V3(c * r, hubY + y, sn * r);
    const pts = [P(0.11, 0.0), P(0.18, -0.06), P(0.26, -0.08), P(0.33, -0.05), P(armR - 0.02, 0.03), P(armR, 0.1), P(armR, 0.14)];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    put(brass, new THREE.TubeGeometry(curve, 40, 0.016, 10));
    // leaf collars along the arm
    for (const t of [0.18, 0.55]) {
      const q = curve.getPointAt(t), tg = curve.getTangentAt(t);
      const m = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), tg)).premultiply(T(q.x, q.y, q.z));
      put(brass, collarG.clone(), m);
    }
    // C-scroll bracket under the arm
    const cs = new THREE.TorusGeometry(0.05, 0.008, 6, 20, Math.PI * 1.5);
    const m2 = new THREE.Matrix4().makeRotationY(a).premultiply(T(c * 0.2, hubY - 0.13, sn * 0.2));
    put(brass, cs, m2);
    // cup, gallery and frosted tulip shade
    const end = pts[pts.length - 1];
    put(brass, G.latheFromProfile([[0, -0.02], [0.025, -0.02], [0.045, 0.0], [0.05, 0.015], [0.04, 0.02], [0.03, 0.02], [0.028, 0.035], [0.0, 0.035]], 18), T(end.x, end.y, end.z));
    const sh = shadeG.clone(); sh.applyMatrix4(T(end.x, end.y + 0.035, end.z));
    globe.push(sh);
    globes.push(end.clone().add(V3(0, 0.1, 0)));
  }
  const mk = (list, mat, name) => { const m = new THREE.Mesh(G.mergeGeometries(list.map((x) => { for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); return x; })), mat); m.name = name; g.add(m); return m; };
  mk(brass, mats.brass, 'chandBrass');
  const fm = mk(frost, mats.frost, 'chandBowl'); fm.userData.glow = true;
  const gm = mk(globe, mats.globe, 'chandShades'); gm.userData.glow = true;
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

/**
 * Standing bishop's-mitre napkin: two tall pointed panels (front and back) rising
 * from a folded cuff, with crisp pleat creases (flat-shaded so the folds read).
 */
export function napkinGeometry(G, { rx = 0.05, rz = 0.026, h = 0.15 } = {}) {
  const U = 24, V = 6;
  const pos = [];
  const P = (i, j) => {
    const u = i / U, v = j / V, a = u * Math.PI * 2;
    const sa = Math.abs(Math.sin(a));
    // pointed mitre peaks front/back (a = 90, 270 deg), low shoulders at the sides
    const top = h * (0.42 + 0.58 * Math.pow(sa, 2.2));
    const y = v * top;
    // pleat creases: zig-zag in the radius, deeper toward the base
    const tri = Math.abs(((u * 8) % 1) - 0.5) * 2;
    const pleat = 1 + 0.16 * (tri - 0.5) * (1 - v * 0.6);
    // panels converge toward the peak; the cuff flares slightly at the base
    const taper = (1 - Math.pow(v, 1.4) * 0.72) * (j === 0 ? 1.06 : 1);
    return [Math.cos(a) * rx * taper * pleat, y, Math.sin(a) * rz * taper * pleat * (1 - v * 0.35)];
  };
  for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1);
    pos.push(...a, ...c, ...b, ...b, ...c, ...d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // make sure the faces point outward
  const p = g.attributes.position, n = g.attributes.normal;
  let dot = 0; for (let i = 0; i < p.count; i++) dot += p.getX(i) * n.getX(i) + p.getZ(i) * n.getZ(i);
  if (dot < 0) { const arr = p.array; for (let t = 0; t < arr.length; t += 9) for (let k = 0; k < 3; k++) { const tmp = arr[t + 3 + k]; arr[t + 3 + k] = arr[t + 6 + k]; arr[t + 6 + k] = tmp; } g.computeVertexNormals(); }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
  return g;
}

function flatExtrude(shape, t) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelThickness: t * 0.4, bevelSize: t * 0.5, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);   // shape xy -> xz (y up thickness)
  return g.index ? g.toNonIndexed() : g;
}
/** knife, fork and spoon with real silhouettes, lying flat; blade/tines toward -z */
export function cutleryGeometries(G) {
  const T = 0.0016;
  // knife: rounded handle, bolster, blade with a curved spine
  const k = new THREE.Shape();
  k.moveTo(-0.0075, 0.1); k.quadraticCurveTo(-0.009, 0.06, -0.006, 0.0); k.lineTo(-0.007, -0.01);
  k.lineTo(-0.0075, -0.09); k.quadraticCurveTo(-0.006, -0.11, 0.0, -0.112); k.quadraticCurveTo(0.006, -0.1, 0.0065, -0.02);
  k.lineTo(0.0055, -0.01); k.lineTo(0.006, 0.0); k.quadraticCurveTo(0.009, 0.06, 0.0075, 0.1); k.quadraticCurveTo(0, 0.108, -0.0075, 0.1);
  const knife = flatExtrude(k, T * 1.4);
  // fork: handle flaring at the end, neck, head with four tines
  const f = new THREE.Shape();
  f.moveTo(-0.008, 0.1); f.quadraticCurveTo(-0.01, 0.07, -0.0035, 0.02); f.lineTo(-0.003, -0.02);
  f.quadraticCurveTo(-0.011, -0.03, -0.0115, -0.05);
  const tw = 0.023 / 7;
  for (let i = 0; i < 4; i++) {
    const x0 = -0.0115 + i * 2 * tw;
    f.lineTo(x0, -0.095); f.quadraticCurveTo(x0 + tw / 2, -0.099, x0 + tw, -0.095);
    if (i < 3) { f.lineTo(x0 + tw, -0.06); f.lineTo(x0 + 2 * tw, -0.06); }
  }
  f.lineTo(0.0115, -0.05); f.quadraticCurveTo(0.011, -0.03, 0.003, -0.02); f.lineTo(0.0035, 0.02);
  f.quadraticCurveTo(0.01, 0.07, 0.008, 0.1); f.quadraticCurveTo(0, 0.108, -0.008, 0.1);
  const fork = flatExtrude(f, T * 1.2);
  // spoon: handle + oval bowl
  const sp = new THREE.Shape();
  sp.moveTo(-0.0075, 0.09); sp.quadraticCurveTo(-0.0095, 0.06, -0.003, 0.0); sp.lineTo(-0.0025, -0.03); sp.lineTo(0.0025, -0.03); sp.lineTo(0.003, 0.0);
  sp.quadraticCurveTo(0.0095, 0.06, 0.0075, 0.09); sp.quadraticCurveTo(0, 0.098, -0.0075, 0.09);
  const handle = flatExtrude(sp, T * 1.2);
  const bowl = new THREE.SphereGeometry(0.02, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  bowl.scale(0.85, 0.32, 1.3); bowl.translate(0, 0.0065, -0.054);
  const spoon = G.mergeGeometries([handle, bowl.toNonIndexed()].map((x) => { for (const kk of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(kk)) x.deleteAttribute(kk); return x; }));
  return { knife, fork, spoon };
}

export function buildPlaceSetting(ctx, mats, { chinaMat, cutlery, napkin } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  const charger = new THREE.Mesh(discUV(plateGeometry(G, 0.16), 0.16), mats.charger); g.add(charger);
  const plate = new THREE.Mesh(discUV(plateGeometry(G, 0.125), 0.125), chinaMat); plate.position.y = 0.012; g.add(plate);
  // lace doily under the charger
  if (mats.lace) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.2, 48), mats.lace); d.rotation.x = -Math.PI / 2; d.position.y = 0.0012; g.add(d); }
  const nap = new THREE.Mesh(napkin, mats.linen); nap.position.set(-0.26, 0.002, -0.02); nap.rotation.y = 0.15; g.add(nap);
  const kn = new THREE.Mesh(cutlery.knife, mats.silver); kn.position.set(0.19, 0.0022, 0.0); kn.rotation.y = Math.PI; g.add(kn);
  const sp = new THREE.Mesh(cutlery.spoon, mats.silver); sp.position.set(0.222, 0.0022, 0.0); sp.rotation.y = Math.PI; g.add(sp);
  const fk = new THREE.Mesh(cutlery.fork, mats.silver); fk.position.set(-0.19, 0.0022, 0.0); fk.rotation.y = Math.PI; g.add(fk);
  // goblet + wine glass
  const gob = new THREE.Mesh(gobletGeometry(G, 1.0), mats.crystal); gob.position.set(0.16, 0, -0.17); g.add(gob);
  const wine = new THREE.Mesh(G.latheFromProfile([[0, 0.11], [0.024, 0.115], [0.03, 0.13], [0.0, 0.13]], 16), mats.wine); wine.position.set(0.16, 0, -0.17); g.add(wine);
  const gob2 = new THREE.Mesh(gobletGeometry(G, 0.8), mats.crystal); gob2.position.set(0.23, 0, -0.1); g.add(gob2);
  return g;
}

// ------------------------------------------------------------------ doors
/**
 * A real six-panel-style door leaf: stiles and rails (rounded, 5 cm thick), raised
 * fields with a broad 3.5 cm bevel, an ovolo sticking bead round every opening and
 * three butt hinges on the hinge side. Origin bottom centre, +z = room side.
 * `rows` = panel openings from the bottom: [[y0, y1], ...] in metres.
 */
export function buildDoorLeaf(G, mats, { w = 0.74, h = 2.6, t = 0.05, stile = 0.115, rows = null, hingeSide = -1 } = {}) {
  const g = new THREE.Group();
  const parts = [], beads = [], brass = [];
  const box = (bw, bh, bd, x, y, z, r = 0.006) => { const b = new G.RoundedBoxGeometry(bw, bh, bd, 2, r); b.translate(x, y, z); parts.push(G.applyBoxUVs(b.index ? b.toNonIndexed() : b, 1)); };
  rows = rows || [[0.24, 0.86], [1.04, 1.86], [2.0, h - 0.13]];
  // stiles
  for (const s of [-1, 1]) box(stile, h, t, s * (w / 2 - stile / 2), h / 2, 0);
  // rails between/around the openings
  let y = 0;
  for (const [y0, y1] of rows) { if (y0 - y > 0.01) box(w - stile * 2 + 0.01, y0 - y, t * 0.96, 0, (y + y0) / 2, 0); y = y1; }
  if (h - y > 0.01) box(w - stile * 2 + 0.01, h - y, t * 0.96, 0, (y + h) / 2, 0);
  // raised fields + sticking beads
  const iw = w - stile * 2;
  for (const [y0, y1] of rows) {
    const ph = y1 - y0, cy = (y0 + y1) / 2;
    box(iw + 0.01, ph + 0.01, 0.012, 0, cy, -0.006, 0.003);                                // panel ground
    const bev = Math.min(0.035, iw * 0.18, ph * 0.18);
    const fw = iw / 2 - bev - 0.008, fh = ph / 2 - bev - 0.008;
    const sh = new THREE.Shape();
    sh.moveTo(-fw, -fh); sh.lineTo(fw, -fh); sh.lineTo(fw, fh); sh.lineTo(-fw, fh); sh.lineTo(-fw, -fh);
    const f = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.013, bevelSize: bev, bevelSegments: 1 });
    f.translate(0, cy, 0.0);
    parts.push(G.applyBoxUVs(f.index ? f.toNonIndexed() : f, 1));
    // ovolo bead: a quarter-round rod lining the opening
    const rod = (len, x, yy, rotZ) => { const c = new THREE.CylinderGeometry(0.009, 0.009, len, 8, 1); c.rotateZ(rotZ); c.scale(1, 1, 0.8); c.translate(x, yy, t / 2 - 0.006); beads.push(c.toNonIndexed()); };
    rod(iw, 0, y0 + 0.006, Math.PI / 2); rod(iw, 0, y1 - 0.006, Math.PI / 2);
    rod(ph, -iw / 2 + 0.006, cy, 0); rod(ph, iw / 2 - 0.006, cy, 0);
  }
  // butt hinges (knuckle + leaf)
  for (const hy of [0.25, h / 2 + 0.1, h - 0.25]) {
    const k = new THREE.CylinderGeometry(0.008, 0.008, 0.1, 10); k.translate(hingeSide * (w / 2 + 0.002), hy, t / 2 - 0.004); brass.push(k.toNonIndexed());
    for (const dy of [-0.051, 0.051]) { const c = new THREE.SphereGeometry(0.009, 10, 6); c.translate(hingeSide * (w / 2 + 0.002), hy + dy, t / 2 - 0.004); brass.push(c.toNonIndexed()); }
    const l = new THREE.BoxGeometry(0.03, 0.09, 0.002); l.translate(hingeSide * (w / 2 - 0.014), hy, t / 2 + 0.001); brass.push(l.toNonIndexed());
  }
  const strip = (gs) => gs.map((x) => { for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); return x; });
  g.add(new THREE.Mesh(G.mergeGeometries(strip(parts)), mats.wood));
  g.add(new THREE.Mesh(G.mergeGeometries(strip(beads.map((b) => G.applyBoxUVs(b, 2)))), mats.wood));
  g.add(new THREE.Mesh(G.mergeGeometries(strip(brass)), mats.brass));
  return g;
}

/** moulded architrave (12 cm, stepped) with plinth blocks and a cornice head; origin bottom centre of the opening */
export function buildArchitrave(G, mats, { w, h, width = 0.13, cornice = true }) {
  const g = new THREE.Group();
  // stepped profile: back band, fillet, cyma, bead (x = out from wall, y = across from the opening edge outward)
  const prof = [V2(0, 0), V2(0.012, 0), V2(0.014, 0.004), V2(0.02, 0.012), V2(0.026, 0.03), V2(0.028, 0.05), V2(0.02, 0.058), V2(0.02, 0.07), V2(0.034, 0.085), V2(0.036, 0.1), V2(0.03, 0.11), V2(0.03, width - 0.008), V2(0.024, width), V2(0, width)];
  const path = [V3(-w / 2, 0.2, 0), V3(-w / 2, h, 0), V3(w / 2, h, 0), V3(w / 2, 0.2, 0)];
  // sweep the profile so +y of the profile points away from the opening
  const m = new THREE.Mesh(G.sweepProfile(prof.map((p) => V2(p.y, p.x)), path, { up: V3(0, 0, 1), uvScale: 2, flipOutward: true }), mats.wood);
  g.add(m);
  for (const s of [-1, 1]) { const pb = new THREE.Mesh(new G.RoundedBoxGeometry(width + 0.02, 0.22, 0.045, 2, 0.006), mats.wood); pb.position.set(s * (w / 2 + width / 2), 0.11, 0.0225); g.add(pb); }
  if (cornice) {
    const fw = w + width * 2 + 0.04;
    const fr = new THREE.Mesh(new G.RoundedBoxGeometry(fw, 0.16, 0.03, 2, 0.006), mats.wood); fr.position.set(0, h + width + 0.08, 0.015); g.add(fr);
    const cr = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.1, 0.08), [V3(-fw / 2 - 0.08, 0, 0.0), V3(-fw / 2 - 0.08, 0, -0.11), V3(fw / 2 + 0.08, 0, -0.11), V3(fw / 2 + 0.08, 0, 0.0)], { uvScale: 1, flipOutward: true }), mats.gilt);
    cr.position.set(0, h + width + 0.16, 0.11); g.add(cr);
  }
  return g;
}

// ------------------------------------------------------------------ carved frames
/** heavy 4-step frame profile (x = out of the wall, y = inward from the outer edge): ogee, flat, bead, cove, sight lip */
export function heavyFrameProfile(width = 0.14, depth = 0.075) {
  const pts = [[0, 0], [0.4, 0], [0.62, 0.03], [0.8, 0.07], [0.95, 0.13], [1.0, 0.2], [0.95, 0.26], [0.86, 0.3], [0.84, 0.34], [0.84, 0.46],
    [0.88, 0.49], [0.93, 0.53], [0.88, 0.57], [0.82, 0.6]];
  for (let i = 1; i <= 8; i++) { const t = i / 8; pts.push([0.82 - Math.sin(t * Math.PI / 2) * 0.42, 0.6 + t * 0.3]); }
  pts.push([0.46, 0.93], [0.52, 0.96], [0.46, 0.99], [0.3, 1.0]);
  return pts.map(([x, y]) => V2(x * depth, y * width));
}

/** an acanthus leaf: lobed outline, extruded with a bevel and curled forward along its length (+y) */
function acanthusLeaf(len, w, curl = 0.5) {
  const sh = new THREE.Shape();
  const N = 24, side = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const env = Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - 0.25 * t);
    const lobes = 1 + 0.28 * Math.max(0, Math.sin(t * Math.PI * 5));
    side.push(V2(env * w * 0.5 * lobes, t * len));
  }
  sh.moveTo(0, 0);
  for (const p of side) sh.lineTo(p.x, p.y);
  for (let i = side.length - 2; i >= 0; i--) sh.lineTo(-side[i].x, side[i].y);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i), t = y / len;
    // central rib ridge + forward curl at the tip
    p.setZ(i, p.getZ(i) + 0.006 * (1 - Math.min(1, Math.abs(x) / (w * 0.15))) + curl * len * t * t * 0.6);
    p.setY(i, y - curl * len * t * t * t * 0.25);
  }
  g.computeVertexNormals();
  return g.index ? g.toNonIndexed() : g;
}

/**
 * Carved cartouche ornament (merged): `corner` = an acanthus spray fanning out of
 * a frame corner along the diagonal; `centre` = a shell of leaves with two C-scrolls
 * and a boss, for the middle of the top rail. Faces +z, origin at its base.
 */
export function cartoucheGeometry(G, kind = 'corner', s = 1) {
  const parts = [];
  const put = (g, rz, x, y, z = 0) => { g.rotateZ(rz); g.translate(x, y, z); for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k); parts.push(g); };
  if (kind === 'corner') {
    // spray pointing inward along +x+y diagonal from the corner
    const fan = [-0.75, -0.38, 0, 0.38, 0.75];
    fan.forEach((a, i) => put(acanthusLeaf(0.11 - Math.abs(a) * 0.04, 0.05, 0.45), -Math.PI / 4 + a, 0, 0, 0.002 * i));
    const boss = new THREE.SphereGeometry(0.022, 14, 10); boss.scale(1, 1, 0.7); put(boss.toNonIndexed(), 0, 0.012, 0.012, 0.012);
    for (const sd of [-1, 1]) { const c = new THREE.TorusGeometry(0.03, 0.008, 6, 16, Math.PI * 1.3); put(c.toNonIndexed(), sd > 0 ? 0.2 : Math.PI * 0.5 - 0.2, sd > 0 ? 0.06 : -0.005, sd > 0 ? -0.005 : 0.06, 0.004); }
  } else {
    const n = 7;
    for (let i = 0; i < n; i++) { const a = -1.2 + (2.4 * i) / (n - 1); put(acanthusLeaf(0.13 - Math.abs(a) * 0.03, 0.055, 0.4), a, 0, 0, 0.002 * (3 - Math.abs(i - 3))); }
    for (const sd of [-1, 1]) {
      const c = new THREE.TorusGeometry(0.045, 0.011, 8, 20, Math.PI * 1.4); put(c.toNonIndexed(), sd > 0 ? -0.3 : Math.PI + 0.3 - Math.PI * 0.4, sd * 0.14, 0.03, 0.006);
      put(acanthusLeaf(0.12, 0.045, 0.3), sd * (Math.PI / 2 + 0.25), sd * 0.06, 0.012, 0.0);
    }
    const boss = new THREE.SphereGeometry(0.03, 16, 10); boss.scale(1.2, 1, 0.7); put(boss.toNonIndexed(), 0, 0, 0.03, 0.016);
  }
  const g = G.mergeGeometries(parts);
  g.scale(s, s, s);
  return G.applyBoxUVs(g, 4);
}
