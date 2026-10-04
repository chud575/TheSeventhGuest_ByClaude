import * as THREE from 'three';

/**
 * Game-room props, round 3: a properly modelled Chesterfield club armchair.
 *
 * Arms and back are swept PROFILES (inner face -> rolled scroll that overhangs the outer face by ~55 mm -> outer
 * face) turned into parametric surfaces, deep diamond button-tufted over the inner faces and across the top of
 * the rolls. The arm fronts carry gathered (radially pleated) scroll discs ringed with close nailing. The loose seat
 * cushion is crowned 25 mm with a piped welt round both edges. Vertex colours carry the wear: lighter, rubbed
 * leather on the roll tops and front edges.
 */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

/** Resample a 2D polyline to n points evenly spaced by arc length; returns { pts, s (0..1) , len }. */
function resample(poly, n) {
  const segL = []; let L = 0;
  for (let i = 1; i < poly.length; i++) { const l = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]); segL.push(l); L += l; }
  const out = [];
  for (let k = 0; k < n; k++) {
    let d = (k / (n - 1)) * L, i = 0;
    while (i < segL.length - 1 && d > segL[i]) { d -= segL[i]; i++; }
    const u = segL[i] > 0 ? d / segL[i] : 0;
    out.push([poly[i][0] + (poly[i + 1][0] - poly[i][0]) * u, poly[i][1] + (poly[i + 1][1] - poly[i][1]) * u]);
  }
  return { pts: out, len: L };
}

/** Diamond tuft field value at (a, b) in tuft cells: pillow height 0..1 and button dimple 0..1. */
function tuft(a, b) {
  const p = Math.abs(Math.sin(Math.PI * (a + b) / 2) * Math.sin(Math.PI * (a - b) / 2)) ** 0.55;
  // nearest button lattice point: (a+b) and (a-b) both even
  const ra = Math.round(a), rb = Math.round(b);
  let dm = 0;
  for (const [ia, ib] of [[ra, rb], [ra + 1, rb], [ra - 1, rb], [ra, rb + 1], [ra, rb - 1]]) {
    if ((ia + ib) % 2 !== 0) continue;
    const d2 = (a - ia) ** 2 + (b - ib) ** 2;
    dm = Math.max(dm, Math.exp(-d2 / 0.035));
  }
  return { p, dm };
}

/**
 * Sweep a profile (2D in the (h, y) plane, h = horizontal offset) along a straight run.
 * place(h, y, s) -> Vector3 maps profile coords + run parameter s (metres) into the chair space.
 * tuftFn(u01, s) -> displacement along the normal; wearFn(u01, s) -> wear 0..1.
 */
function sweptSurface(profile, runLen, { nu = 90, ns = 60, place, tuftFn, wearFn, flip = false, buttons, buttonAt }) {
  const { pts } = resample(profile, nu);
  const pos = [], uv = [], col = [], idx = [];
  // base positions to estimate normals before displacement
  const base = [];
  for (let j = 0; j <= ns; j++) {
    const s = (j / ns) * runLen;
    for (let i = 0; i < nu; i++) base.push(place(pts[i][0], pts[i][1], s));
  }
  const N = (i, j) => {
    const a = base[j * nu + Math.min(nu - 1, i + 1)].clone().sub(base[j * nu + Math.max(0, i - 1)]);
    const b = base[Math.min(ns, j + 1) * nu + i].clone().sub(base[Math.max(0, j - 1) * nu + i]);
    const n = new THREE.Vector3().crossVectors(b, a).normalize();
    return flip ? n.negate() : n;
  };
  for (let j = 0; j <= ns; j++) {
    const s = (j / ns) * runLen;
    for (let i = 0; i < nu; i++) {
      const u = i / (nu - 1);
      const p = base[j * nu + i].clone();
      const d = tuftFn ? tuftFn(u, s) : 0;
      if (d) p.addScaledVector(N(i, j), d);
      pos.push(p.x, p.y, p.z);
      uv.push(u * 2.2, s * 2.5);
      const w = wearFn ? wearFn(u, s) : 0;
      col.push(1 + 0.55 * w, 1 + 0.5 * w, 1 + 0.42 * w);
    }
  }
  for (let j = 0; j < ns; j++) for (let i = 0; i < nu - 1; i++) {
    const a = j * nu + i, b = a + nu;
    if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (buttons && buttonAt) {
    // re-sample the button points from the displaced surface
    for (const [u, s] of buttonAt) {
      const i = Math.round(u * (nu - 1)), j = Math.round((s / runLen) * ns);
      const k = (Math.max(0, Math.min(ns, j)) * nu + Math.max(0, Math.min(nu - 1, i))) * 3;
      buttons.push({ p: V3(pos[k], pos[k + 1], pos[k + 2]), n: N(Math.max(0, Math.min(nu - 1, i)), Math.max(0, Math.min(ns, j))) });
    }
  }
  return g;
}

/** Arm / back profile: inner face rising (with a slight outward splay) into a scroll roll of radius R that
 * overhangs the outer face, then the outer face down to the plinth. h: + = outward. Returns { poly, roll: {cx, cy, R}, uRollTop }. */
function scrollProfile({ yBot, yTop, R = 0.085, inner = -0.07, outer = 0.025, splay = 0.018 }) {
  const cx = inner - splay + R - 0.005 + 0.0, cy = yTop - R;
  const poly = [];
  const yIn1 = cy;
  for (let k = 0; k <= 8; k++) { const t = k / 8; poly.push([inner - splay * t * t, yBot + (yIn1 - yBot) * t]); }
  const x0 = poly[poly.length - 1][0];
  const ccx = x0 + R;
  for (let k = 1; k <= 36; k++) { const a = Math.PI - (k / 36) * (Math.PI + 1.25); poly.push([ccx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
  const last = poly[poly.length - 1];
  // tuck under the roll, then the outer face down
  poly.push([outer + 0.004, last[1] - 0.012]);
  for (let k = 1; k <= 6; k++) { const t = k / 6; poly.push([outer + 0.004 * (1 - t), last[1] - 0.012 + (yBot - (last[1] - 0.012)) * t]); }
  return { poly, roll: { cx: ccx, cy, R }, x0 };
}

export function buildChesterfield2(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'chesterfield';
  const W = 1.04, D = 0.92, foot = 0.075, seatY = 0.44, topY = 0.76;
  const L = mats.leather;
  const buttons = [];
  const studs = [];

  // ---------------------------------------------------------------- plinth
  {
    const ph = seatY - foot - 0.1;
    const pg = new G.RoundedBoxGeometry(W - 0.02, ph, D - 0.03, 4, 0.03);
    const c = new Float32Array(pg.attributes.position.count * 3).fill(1);
    pg.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.add(at(new THREE.Mesh(pg, L), 0, foot + ph / 2, -0.005));
    for (let x = -W / 2 + 0.03; x <= W / 2 - 0.03; x += 0.022) studs.push({ p: V3(x, foot + 0.022, D / 2 - 0.018), n: V3(0, 0, 1) });
    for (const sx of [-1, 1]) for (let z = -D / 2 + 0.04; z <= D / 2 - 0.04; z += 0.022) studs.push({ p: V3(sx * (W / 2 - 0.008), foot + 0.022, z), n: V3(sx, 0, 0) });
  }

  // ---------------------------------------------------------------- arms
  const armIn = -0.072, armOut = 0.028;
  const prof = scrollProfile({ yBot: seatY - 0.12, yTop: topY, R: 0.085, inner: armIn, outer: armOut, splay: 0.016 });
  const armX = W / 2 - 0.095;                       // arm centre line (profile h = 0)
  const zA0 = -D / 2 + 0.02, zA1 = D / 2 - 0.012, runA = zA1 - zA0;
  const { pts: armPts } = resample(prof.poly, 90);
  // profile u where the roll starts / its top / where tufting stops (past the crown of the roll)
  const uOf = (pred) => { for (let i = 0; i < armPts.length; i++) if (pred(armPts[i])) return i / (armPts.length - 1); return 1; };
  const uRollStart = uOf((p) => p[1] >= prof.roll.cy - 0.001);
  const uRollTop = uOf((p) => p[0] >= prof.roll.cx);
  const uTuftEnd = uOf((p) => p[0] >= prof.roll.cx + prof.roll.R * 0.55);
  for (const sx of [-1, 1]) {
    const place = (h, y, s) => V3(sx * (armX + h), y, zA0 + s);
    const cellU = (uTuftEnd - 0.06) / 3.0, cellS = (runA - 0.2) / 6.0;
    const tuftFn = (u, s) => {
      if (u < 0.05 || u > uTuftEnd + 0.04 || s < 0.16 || s > runA - 0.05) return 0;
      const e = Math.min(1, (u - 0.05) / 0.05, (uTuftEnd + 0.04 - u) / 0.05, (s - 0.16) / 0.05, (runA - 0.05 - s) / 0.05);
      const { p, dm } = tuft((u - 0.05) / cellU, (s - 0.16) / cellS);
      return (0.014 + 0.016 * p - 0.022 * dm) * Math.max(0, e);
    };
    const wearFn = (u, s) => Math.exp(-(((u - uRollTop) / 0.06) ** 2)) * (0.45 + 0.55 * Math.min(1, s / runA) ** 2) + Math.exp(-(((runA - s) / 0.03) ** 2)) * 0.6;
    const bAt = [];
    for (let iu = 0; iu <= 3; iu++) for (let is = 0; is <= 6; is++) if ((iu + is) % 2 === 0) { const u = 0.05 + iu * cellU, s = 0.16 + is * cellS; if (iu > 0 && is > 0 && is < 6 && u < uTuftEnd) bAt.push([u, s]); }
    const ag = sweptSurface(prof.poly, runA, { nu: 90, ns: 64, place, tuftFn, wearFn, flip: sx < 0, buttons, buttonAt: bAt });
    g.add(new THREE.Mesh(ag, L));
    // front cap: the profile filled, slightly inset, and a gathered scroll disc on the roll
    // (built for the left arm and mirrored for the right so both face +z)
    const shp = new THREE.Shape(prof.poly.map(([h, y]) => new THREE.Vector2(-(armX + h), y)));
    const capG = new THREE.ShapeGeometry(shp, 24);
    const cc = new Float32Array(capG.attributes.position.count * 3).fill(1.1);
    capG.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    const front = at(new THREE.Mesh(capG, L), 0, 0, zA1 + 0.001); front.scale.x = -sx; g.add(front);
    const back = new THREE.Mesh(capG, L); back.scale.set(-sx, 1, -1); back.position.z = zA0; g.add(back);
    // scroll disc: radial pleats gathered into a centre button
    const R = prof.roll.R + 0.003;
    const disc = new THREE.CircleGeometry(R, 72, 0, Math.PI * 2);
    {
      const p = disc.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i); const r = Math.hypot(x, y) / R, a = Math.atan2(y, x);
        p.setZ(i, 0.012 * (1 - r * r) + 0.0045 * Math.abs(Math.sin(a * 11)) * r * (1 - r * 0.5));
      }
      disc.computeVertexNormals();
      const dc = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)) / R; const k = 0.95 + 0.25 * r; dc.set([k, k * 0.97, k * 0.94], i * 3); }
      disc.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
    }
    const dcx = sx * (armX + prof.roll.cx), dcy = prof.roll.cy;
    g.add(at(new THREE.Mesh(disc, L), dcx, dcy, zA1 + 0.002));
    buttons.push({ p: V3(dcx, dcy, zA1 + 0.014), n: V3(0, 0, 1) });
    for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2; studs.push({ p: V3(dcx + Math.cos(a) * (R + 0.002), dcy + Math.sin(a) * (R + 0.002), zA1 + 0.003), n: V3(0, 0, 1) }); }
    // close nailing down the front edges of the arm face
    for (let y = foot + 0.04; y < prof.roll.cy - R - 0.012; y += 0.022) {
      studs.push({ p: V3(sx * (armX + armOut + 0.004), y, zA1 + 0.003), n: V3(0, 0, 1) });
      studs.push({ p: V3(sx * (armX + armIn - 0.002), Math.max(y, seatY - 0.1), zA1 + 0.003), n: V3(0, 0, 1) });
    }
  }

  // ---------------------------------------------------------------- back (profile swept across the width)
  {
    const bp = scrollProfile({ yBot: seatY - 0.12, yTop: topY + 0.005, R: 0.08, inner: -0.07, outer: 0.03, splay: 0.03 });
    const backZ = -D / 2 + 0.11;                       // profile h=0 line; h+ = toward the back (-z)
    const x0 = -W / 2 + 0.07, run = W - 0.14;
    const { pts } = resample(bp.poly, 90);
    const uOfB = (pred) => { for (let i = 0; i < pts.length; i++) if (pred(pts[i])) return i / (pts.length - 1); return 1; };
    const uTop = uOfB((p) => p[0] >= bp.roll.cx), uEnd = uOfB((p) => p[0] >= bp.roll.cx + bp.roll.R * 0.5);
    const place = (h, y, s) => V3(x0 + s, y, backZ - h);
    const cols = 7, rows = 3;
    const s0 = 0.12, s1 = run - 0.12;
    const cellU = (uEnd - 0.04) / rows, cellS = (s1 - s0) / cols;
    const tuftFn = (u, s) => {
      if (u < 0.04 || u > uEnd + 0.04 || s < s0 - 0.02 || s > s1 + 0.02) return 0;
      const e = Math.min(1, (u - 0.04) / 0.05, (uEnd + 0.04 - u) / 0.05, (s - s0 + 0.02) / 0.05, (s1 + 0.02 - s) / 0.05);
      const { p, dm } = tuft((u - 0.04) / cellU, (s - s0) / cellS);
      return (0.016 + 0.018 * p - 0.026 * dm) * Math.max(0, e);
    };
    const wearFn = (u) => Math.exp(-(((u - uTop) / 0.06) ** 2)) * 0.7;
    const bAt = [];
    for (let iu = 1; iu <= rows; iu++) for (let is = 0; is <= cols; is++) if ((iu + is) % 2 === 0) { const u = 0.04 + iu * cellU; if (u <= uEnd + 0.01) bAt.push([u, s0 + is * cellS]); }
    const bg = sweptSurface(bp.poly, run, { nu: 90, ns: 80, place, tuftFn, wearFn, flip: false, buttons, buttonAt: bAt });
    g.add(new THREE.Mesh(bg, L));
  }

  // ---------------------------------------------------------------- seat cushion: crowned, piped
  {
    const cw = W - 2 * 0.095 - 2 * 0.075 + 0.02, cd = D - 0.25, ch = 0.12;
    const cz = 0.075;
    const cg = new G.RoundedBoxGeometry(cw, ch, cd, 8, 0.04);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y > 0) {
        const u = x / (cw / 2), v = z / (cd / 2);
        const crown = Math.max(0, 1 - u * u) ** 0.8 * Math.max(0, 1 - v * v) ** 0.8;
        // crowned 25 mm, with a faint sitting hollow and creases radiating from it
        const hollow = Math.exp(-((u / 0.45) ** 2 + ((v + 0.05) / 0.5) ** 2));
        p.setY(i, y + crown * 0.025 - hollow * 0.008 + 0.0018 * Math.sin(Math.atan2(v, u) * 7) * hollow);
      }
    }
    cg.computeVertexNormals();
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i), y = p.getY(i); const w = Math.exp(-(((cd / 2 - z) / 0.03) ** 2)) * (y > 0 ? 1 : 0.5); c.set([1 + 0.5 * w, 1 + 0.45 * w, 1 + 0.38 * w], i * 3); }
    cg.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const cy = seatY - 0.09 + ch / 2;
    g.add(at(new THREE.Mesh(cg, L), 0, cy, cz));
    // piped welts round the top and bottom edges
    const rr = (w, d, r) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2 + r, -d / 2); sh.lineTo(w / 2 - r, -d / 2); sh.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r); sh.lineTo(w / 2, d / 2 - r); sh.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); sh.lineTo(-w / 2 + r, d / 2); sh.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); sh.lineTo(-w / 2, -d / 2 + r); sh.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2); return sh.getSpacedPoints(120).map((q) => V3(q.x, 0, q.y)); };
    for (const [y, inset] of [[ch / 2 - 0.012, 0.006], [-ch / 2 + 0.012, 0.004]]) {
      const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rr(cw - inset, cd - inset, 0.045), true), 200, 0.0055, 8, true);
      const tc = new Float32Array(tg.attributes.position.count * 3).fill(1.15);
      tg.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
      g.add(at(new THREE.Mesh(tg, L), 0, cy + y, cz));
    }
  }

  // ---------------------------------------------------------------- buttons, studs, feet
  const btnG = new THREE.SphereGeometry(0.0095, 12, 8); btnG.scale(1, 1, 0.55);
  const bm = new THREE.InstancedMesh(btnG, mats.leatherDark || L, buttons.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), zf = V3(0, 0, 1), one = V3(1, 1, 1);
  buttons.forEach((b, i) => { q.setFromUnitVectors(zf, b.n.clone().normalize()); m4.compose(b.p.clone().addScaledVector(b.n, 0.002), q, one); bm.setMatrixAt(i, m4); });
  bm.userData.keep = true; g.add(bm);
  const studG = new THREE.SphereGeometry(0.0058, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); studG.rotateX(Math.PI / 2);
  const st = new THREE.InstancedMesh(studG, mats.brass, studs.length);
  studs.forEach((s, i) => { q.setFromUnitVectors(zf, s.n); m4.compose(s.p, q, one); st.setMatrixAt(i, m4); });
  st.userData.keep = true; g.add(st);
  const fG = G.latheFromProfile([[0, 0.014], [0.036, 0.014], [0.05, 0.03], [0.05, 0.05], [0.04, 0.066], [0.03, 0.072], [0.0, 0.075]], 20);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(at(new THREE.Mesh(fG, mats.wood), sx * (W / 2 - 0.08), 0, sz * (D / 2 - 0.08)));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 14).rotateZ(Math.PI / 2), mats.brass), sx * (W / 2 - 0.08), 0.008, sz * (D / 2 - 0.08)));
  }
  return g;
}
