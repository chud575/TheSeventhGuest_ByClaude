import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Kitchen furniture & props. Every builder returns a THREE.Group whose origin is
 * documented per function; geometry uses metre UVs (repeat = 1 / tile size).
 */

const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function mk(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

/** Rounded (bevelled) box with metre UVs. */
export function rbox(G, w, h, d, r = 0.006, seg = 2) {
  const g = new G.RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.1, h / 2.1, d / 2.1));
  return G.applyBoxUVs(g, 1);
}

/** Lathe with metre-ish UVs (u around, v = height). */
export function lathe(G, pts, seg = 32) {
  return G.latheFromProfile(pts, seg);
}

/** Tube along points. */
export function tube(pts, r, seg = 24, rs = 8, closed = false) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : V3(...p))), closed, 'centripetal');
  return new THREE.TubeGeometry(c, seg, r, rs, closed);
}

// =====================================================================================
// Cast-iron kitchen range ("close range"): origin = floor, centre of the front plane of
// the hob, facing +Z. Width 1.3 m. Returns { group, fireLightPos, fireLightDir, emberMat }.
// mat needs: iron, ironEdge, ironRelief(bump), brass, steel, soot, copper, tinLining, towel,
// emberMap, makerPlate (material with the maker's plate texture), dial (oven thermometer face).
// =====================================================================================
export function buildRange(ctx, mat) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'range';
  const W = 1.3, D = 0.6, HOB = 0.82;
  const z0 = -D;
  const iron = mat.iron, edge = mat.ironEdge, brass = mat.brass, steel = mat.steel;
  // plinth / hearth kerb, body
  g.add(mk(rbox(G, W + 0.08, 0.07, D + 0.06, 0.012), edge, 0, 0.035, -D / 2 + 0.01));
  g.add(mk(rbox(G, W, HOB - 0.1, D - 0.04, 0.01), iron, 0, 0.07 + (HOB - 0.1) / 2, -D / 2 - 0.01));
  // front framing: pilasters + rails (raised castings, edge-worn)
  for (const x of [-W / 2 + 0.02, -0.16, 0.16, W / 2 - 0.02]) {
    g.add(mk(rbox(G, 0.035, HOB - 0.14, 0.02, 0.006), edge, x, 0.07 + (HOB - 0.14) / 2, 0.006));
    // capital + base blocks
    g.add(mk(rbox(G, 0.05, 0.03, 0.028, 0.006), edge, x, HOB - 0.085, 0.008));
    g.add(mk(rbox(G, 0.05, 0.03, 0.028, 0.006), edge, x, 0.085, 0.008));
  }
  g.add(mk(rbox(G, W, 0.05, 0.02, 0.006), edge, 0, HOB - 0.055, 0.006));     // fascia
  g.add(mk(rbox(G, W, 0.025, 0.018, 0.005), edge, 0, 0.1, 0.005));          // bottom rail
  // maker's plate on the fascia
  {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.04), mat.makerPlate);
    plate.position.set(0, HOB - 0.055, 0.0175);
    g.add(plate);
    for (const x of [-0.16, 0.16]) g.add(mk(new THREE.SphereGeometry(0.005, 10, 6), brass, x, HOB - 0.055, 0.017));
  }
  // ---- oven doors: raised cast frame, relief field, brass strap hinges, latch; thermometer on the left
  const ovenDoor = (x, dir) => {
    const w = 0.4, h = 0.5;
    const dg = new THREE.Group();
    dg.add(mk(rbox(G, w, h, 0.022, 0.006), iron, 0, 0, 0.011));
    dg.add(mk(G.raisedPanel(w, h, { border: 0.045, bevel: 0.012, fieldDepth: 0.003, frameDepth: 0.012 }), edge, 0, 0, 0.022));
    const field = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.11, h - 0.11), mat.ironRelief);
    field.position.set(0, 0, 0.0295);
    dg.add(field);
    // hinge side = -dir
    for (const hy of [h * 0.33, -h * 0.33]) {
      dg.add(mk(new THREE.CylinderGeometry(0.011, 0.011, 0.07, 14), brass, -dir * (w / 2 + 0.008), hy, 0.02));
      dg.add(mk(rbox(G, 0.12, 0.022, 0.005, 0.002), brass, -dir * (w / 2 - 0.05), hy, 0.0395));
      for (const k of [0.02, 0.06, 0.1]) dg.add(mk(new THREE.SphereGeometry(0.0035, 8, 6), steel, -dir * (w / 2 - k + 0.01), hy, 0.043));
    }
    // latch: turned brass handle on a pivot boss
    dg.add(mk(new THREE.CylinderGeometry(0.016, 0.018, 0.012, 18), brass, dir * (w / 2 - 0.045), 0.02, 0.036, Math.PI / 2));
    const handle = new THREE.Group();
    handle.add(mk(new THREE.CylinderGeometry(0.007, 0.007, 0.04, 10), brass, 0, 0, 0.02, Math.PI / 2));
    handle.add(mk(lathe(G, [[0, 0], [0.012, 0.0], [0.016, 0.03], [0.011, 0.07], [0.015, 0.095], [0, 0.105]], 16), brass, 0, 0, 0.04, 0, 0, -dir * Math.PI / 2));
    handle.position.set(dir * (w / 2 - 0.045), 0.02, 0.036);
    dg.add(handle);
    dg.position.set(x, 0.42, 0.012);
    return dg;
  };
  const left = ovenDoor(-0.4, 1), right = ovenDoor(0.4, -1);
  g.add(left, right);
  // oven thermometer (left door)
  {
    const t = new THREE.Group();
    t.add(mk(lathe(G, [[0, 0], [0.05, 0], [0.052, 0.006], [0.046, 0.012], [0.0, 0.012]], 32), brass, 0, 0, 0, Math.PI / 2));
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.043, 32), mat.dial);
    face.position.z = 0.0125; t.add(face);
    t.position.set(-0.4, 0.42 + 0.13, 0.05);
    g.add(t);
  }
  // ---- fire door with a pierced grille; ember card + dark firebox behind
  const fbW = 0.24, fbH = 0.22, fbY = 0.56;
  {
    const sh = new THREE.Shape();
    const hw = fbW / 2, hh = fbH / 2, rr = 0.02;
    sh.moveTo(-hw + rr, -hh); sh.lineTo(hw - rr, -hh); sh.quadraticCurveTo(hw, -hh, hw, -hh + rr); sh.lineTo(hw, hh - rr); sh.quadraticCurveTo(hw, hh, hw - rr, hh);
    sh.lineTo(-hw + rr, hh); sh.quadraticCurveTo(-hw, hh, -hw, hh - rr); sh.lineTo(-hw, -hh + rr); sh.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
    // arch of vertical slots + a ring of round holes below
    for (let i = 0; i < 7; i++) {
      const x = -0.075 + i * 0.025, top = 0.075 - Math.abs(i - 3) * 0.008, bot = 0.0;
      const hp = new THREE.Path();
      hp.moveTo(x - 0.0065, bot); hp.lineTo(x + 0.0065, bot); hp.lineTo(x + 0.0065, top); hp.absarc(x, top, 0.0065, 0, Math.PI, false); hp.lineTo(x - 0.0065, bot);
      sh.holes.push(hp);
    }
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      const hp = new THREE.Path(); hp.absarc(Math.cos(a) * 0.06, -0.025 + Math.sin(a) * 0.045, 0.007, 0, Math.PI * 2, true);
      sh.holes.push(hp);
    }
    const plate = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
    g.add(mk(G.applyBoxUVs(plate, 1), edge, 0, fbY, 0.012));
    // frame round the door + hinge pins + a brass turn-knob
    g.add(mk(G.raisedPanel(fbW + 0.06, fbH + 0.06, { border: 0.03, bevel: 0.006, fieldDepth: 0.001, frameDepth: 0.01 }), iron, 0, fbY, 0.004));
    for (const hy of [0.06, -0.06]) g.add(mk(new THREE.CylinderGeometry(0.009, 0.009, 0.04, 12), steel, -fbW / 2 - 0.006, fbY + hy, 0.022));
    g.add(mk(lathe(G, [[0, 0], [0.014, 0], [0.018, 0.012], [0.01, 0.03], [0.014, 0.04], [0, 0.044]], 16), brass, fbW / 2 - 0.03, fbY - 0.07, 0.028, Math.PI / 2));
  }
  const emberMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff5a14, emissiveIntensity: 1.5, emissiveMap: mat.emberMap, roughness: 1, name: 'embers' });
  const coals = mk(new THREE.PlaneGeometry(fbW - 0.02, fbH - 0.02), emberMat, 0, fbY - 0.01, -0.012);
  coals.userData.noBake = true; coals.userData.keep = true;
  g.add(coals);
  g.add(mk(new THREE.BoxGeometry(fbW + 0.02, fbH + 0.02, 0.05), mat.soot, 0, fbY, -0.04));
  // ---- ash-pit door: louvred
  {
    const sh = new THREE.Shape();
    sh.moveTo(-0.12, -0.07); sh.lineTo(0.12, -0.07); sh.lineTo(0.12, 0.07); sh.lineTo(-0.12, 0.07); sh.lineTo(-0.12, -0.07);
    for (let i = 0; i < 4; i++) { const y = -0.045 + i * 0.03; const hp = new THREE.Path(); hp.moveTo(-0.085, y - 0.007); hp.lineTo(0.085, y - 0.007); hp.lineTo(0.085, y + 0.007); hp.lineTo(-0.085, y + 0.007); hp.lineTo(-0.085, y - 0.007); sh.holes.push(hp); }
    g.add(mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }), 1), edge, 0, 0.235, 0.012));
    const ashMat = emberMat.clone(); ashMat.emissiveIntensity = 0.35; ashMat.name = 'ashGlow';
    const ash = mk(new THREE.PlaneGeometry(0.2, 0.12), ashMat, 0, 0.235, -0.004); ash.userData.noBake = true; g.add(ash);
    g.add(mk(new THREE.BoxGeometry(0.22, 0.13, 0.03), mat.soot, 0, 0.235, -0.022));
  }
  // dampers
  for (const x of [-0.08, 0.08]) g.add(mk(lathe(G, [[0, 0], [0.013, 0], [0.017, 0.01], [0.01, 0.026], [0.014, 0.034], [0, 0.037]], 16), brass, x, 0.72, 0.012, Math.PI / 2));
  // ---- hob slab + hob covers with ring grooves and lifting notches
  g.add(mk(rbox(G, W + 0.06, 0.04, D + 0.04, 0.012), edge, 0, HOB - 0.02, -D / 2 + 0.005));
  const cover = (R) => {
    const pts = [[0, 0], [R + 0.003, 0], [R + 0.003, 0.006], [R, 0.011], [R * 0.93, 0.012]];
    for (const [r0, r1] of [[0.86, 0.8], [0.62, 0.56], [0.38, 0.33]]) pts.push([R * r0, 0.012], [R * (r0 - 0.01), 0.008], [R * (r1 + 0.01), 0.008], [R * r1, 0.012]);
    pts.push([R * 0.12, 0.012], [R * 0.1, 0.016], [0, 0.017]);
    return lathe(G, pts, 48);
  };
  for (const [x, z, R] of [[-0.42, -0.22, 0.12], [-0.13, -0.22, 0.1], [0.15, -0.22, 0.1], [0.43, -0.22, 0.12], [-0.28, -0.45, 0.09], [0.3, -0.45, 0.09]]) {
    g.add(mk(cover(R), edge, x, HOB, z));
    g.add(mk(new THREE.BoxGeometry(0.024, 0.008, 0.012), mat.soot, x + R * 0.8, HOB + 0.009, z));
  }
  // hotplate seams: the hob is cast in sections, the joints filled with black lead and ash
  for (const z of [-0.335]) g.add(mk(new THREE.BoxGeometry(W - 0.02, 0.003, 0.006), mat.soot, 0, HOB + 0.0005, z));
  for (const x of [-0.275, 0.01, 0.29]) g.add(mk(new THREE.BoxGeometry(0.006, 0.003, 0.24), mat.soot, x, HOB + 0.0005, -0.22));
  // the fire shows as a thin red line round the lifted edge of one cover
  {
    const glowMat = emberMat.clone(); glowMat.emissiveIntensity = 0.9; glowMat.emissiveMap = null; glowMat.name = 'hobGlow';
    const ring = mk(new THREE.TorusGeometry(0.103, 0.0018, 4, 48), glowMat, 0.15, HOB + 0.002, -0.22, Math.PI / 2);
    ring.userData.noBake = true; g.add(ring);
  }
  // the cover lifter left on the hob: a forged bar with a hooked end and a coiled-wire cool handle
  {
    const lf = new THREE.Group();
    lf.add(mk(new THREE.CylinderGeometry(0.0045, 0.0045, 0.17, 8), edge, 0.085, 0, 0, 0, 0, Math.PI / 2));
    lf.add(mk(tube([[0.17, 0, 0], [0.185, 0, 0], [0.19, -0.012, 0], [0.18, -0.016, 0]], 0.0045, 10, 6), edge));
    const coil = []; for (let k = 0; k <= 90; k++) { const t = k / 90; coil.push([-0.09 * t, Math.cos(t * 60) * 0.009, Math.sin(t * 60) * 0.009]); }
    lf.add(mk(tube(coil, 0.0022, 360, 4), mat.steel));
    lf.position.set(0.38, HOB + 0.012, -0.08); lf.rotation.y = 0.5;
    g.add(lf);
  }
  // ash dust and rust blooms on the hob slab (a decal under the covers)
  {
    const HW = W + 0.04, HD = D + 0.02, hz = -D / 2 + 0.005;
    const covers = [[-0.42, -0.22, 0.12], [-0.13, -0.22, 0.1], [0.15, -0.22, 0.1], [0.43, -0.22, 0.12], [-0.28, -0.45, 0.09], [0.3, -0.45, 0.09]];
    const tex = ctx.textures.canvas('kitchen:hobAsh', 1024, 512, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const toPx = (x, z) => [((x + HW / 2) / HW) * w, ((z - hz + HD / 2) / HD) * h];
      let a = 9;
      const R = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
      // rust halos round each cover (the iron rusts where steam condenses)
      for (const [x, z, r] of covers) {
        const [px, py] = toPx(x, z), rp = (r / HW) * w;
        const gr = c.createRadialGradient(px, py, rp * 0.98, px, py, rp * 1.35);
        gr.addColorStop(0, 'rgba(120,52,18,0.85)'); gr.addColorStop(0.4, 'rgba(105,48,20,0.45)'); gr.addColorStop(1, 'rgba(90,40,18,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(px, py, rp * 1.4, 0, Math.PI * 2); c.fill();
        for (let k = 0; k < 14; k++) { const an = R() * Math.PI * 2, rr = rp * (1.02 + R() * 0.25); c.fillStyle = `rgba(140,62,22,${0.3 + R() * 0.4})`; c.beginPath(); c.arc(px + Math.cos(an) * rr, py + Math.sin(an) * rr, 1 + R() * 4, 0, Math.PI * 2); c.fill(); }
      }
      // grey ash: drifted toward the front edge and the fire door, fingered smears
      for (let k = 0; k < 900; k++) {
        const x = R() * w, y = h * (0.55 + 0.45 * R() ** 0.6);
        c.fillStyle = `rgba(150,146,138,${0.05 + R() * 0.12})`; c.beginPath(); c.arc(x, y, 1 + R() * 3.5, 0, Math.PI * 2); c.fill();
      }
      for (let k = 0; k < 20; k++) { const x = R() * w, y = R() * h; const gr = c.createRadialGradient(x, y, 0, x, y, 30 + R() * 60); gr.addColorStop(0, 'rgba(140,136,128,0.22)'); gr.addColorStop(1, 'rgba(140,136,128,0)'); c.fillStyle = gr; c.fillRect(x - 90, y - 90, 180, 180); }
      c.strokeStyle = 'rgba(30,26,22,0.35)'; c.lineWidth = 7; c.lineCap = 'round';
      for (let k = 0; k < 4; k++) { const x = w * (0.3 + R() * 0.4), y = h * (0.75 + R() * 0.2); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30 + R() * 30, y - 6 + R() * 12); c.stroke(); }
    }, { tile: false });
    const am = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, name: 'hobAsh' });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(HW, HD), am);
    pl.rotation.x = -Math.PI / 2; pl.position.set(0, HOB + 0.0006, hz); pl.renderOrder = 1;
    g.add(pl);
  }
  // brass towel rail on brackets
  g.add(mk(new THREE.CylinderGeometry(0.011, 0.011, W + 0.1, 16), brass, 0, 0.745, 0.11, 0, 0, Math.PI / 2));
  for (const x of [-W / 2 - 0.02, W / 2 + 0.02]) {
    g.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 10), brass, x, 0.745, 0.055, Math.PI / 2));
    g.add(mk(new THREE.SphereGeometry(0.018, 16, 12), brass, x + Math.sign(x) * 0.05, 0.745, 0.11));
  }
  // a linen tea towel draped over the rail
  const towel = mk(drapedCloth({ width: 0.26, front: 0.3, back: 0.2, r: 0.014, seed: 3 }), mat.towel, 0.36, 0.745, 0.11);
  towel.rotation.y = 0.04;
  g.add(towel);
  // ---- back plate, warming shelf with a gallery rail, flue
  g.add(mk(rbox(G, W, 0.64, 0.04, 0.008), iron, 0, HOB + 0.32, z0 + 0.02));
  g.add(mk(G.raisedPanel(W - 0.1, 0.5, { border: 0.04, bevel: 0.012, fieldDepth: 0.003, frameDepth: 0.01 }), edge, 0, HOB + 0.3, z0 + 0.04));
  const bp = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, 0.4), mat.ironRelief2 || mat.ironRelief);
  bp.position.set(0, HOB + 0.3, z0 + 0.0575);
  g.add(bp);
  g.add(mk(rbox(G, W + 0.04, 0.03, 0.26, 0.008), edge, 0, HOB + 0.64, z0 + 0.13));
  for (let i = 0; i < 27; i++) g.add(mk(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6), brass, -W / 2 + 0.03 + i * ((W - 0.06) / 26), HOB + 0.68, z0 + 0.255));
  g.add(mk(new THREE.CylinderGeometry(0.006, 0.006, W - 0.04, 8), brass, 0, HOB + 0.705, z0 + 0.255, 0, 0, Math.PI / 2));
  for (const x of [-W / 2 + 0.03, W / 2 - 0.03]) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(0, 0.18); sh.lineTo(0.2, 0.18); sh.quadraticCurveTo(0.04, 0.14, 0.0, 0.0);
    const b = mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: false }), 1), edge, x - 0.007, HOB + 0.45, z0 + 0.04, 0, -Math.PI / 2, 0);
    g.add(b);
  }
  g.add(mk(new THREE.CylinderGeometry(0.075, 0.075, 0.9, 32), iron, -0.38, HOB + 1.1, z0 + 0.12));
  for (const y of [HOB + 0.8, HOB + 1.2]) g.add(mk(new THREE.TorusGeometry(0.078, 0.008, 8, 32), edge, -0.38, y, z0 + 0.12, Math.PI / 2));
  // ---- kettle, stockpot, an iron frying pan
  {
    const k = new THREE.Group();
    k.add(mk(lathe(G, [[0, 0], [0.09, 0], [0.105, 0.02], [0.112, 0.06], [0.104, 0.11], [0.075, 0.148], [0.04, 0.162], [0.038, 0.172], [0.0, 0.176]], 48), mat.copper));
    k.add(mk(lathe(G, [[0, 0], [0.042, 0], [0.04, 0.008], [0.016, 0.014], [0.012, 0.022], [0.018, 0.03], [0, 0.034]], 24), mat.copper, 0, 0.17, 0));
    k.add(mk(new THREE.SphereGeometry(0.014, 14, 10), mat.ebony || mat.soot, 0, 0.208, 0));
    k.add(mk(tube([[0.092, 0.045, 0], [0.15, 0.09, 0], [0.19, 0.165, 0]], 0.014, 16, 10), mat.copper));
    k.add(mk(new THREE.TorusGeometry(0.105, 0.004, 8, 48), mat.copper, 0, 0.06, 0, Math.PI / 2));
    k.add(mk(tube([[-0.07, 0.15, 0], [-0.055, 0.29, 0], [0.055, 0.29, 0], [0.07, 0.15, 0]], 0.007, 24, 8), brass));
    k.add(mk(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 12), mat.ebony || mat.soot, 0, 0.29, 0, 0, 0, Math.PI / 2));
    k.position.set(-0.42, HOB + 0.017, -0.22); k.rotation.y = 0.5;
    g.add(k);
    const pot = buildSaucepan(G, mat, 0.13, 0.2, 0.0, { stock: true });
    pot.position.set(0.3, HOB + 0.017, -0.45);
    g.add(pot);
    const lid = new THREE.Group();
    lid.add(mk(lathe(G, [[0, 0], [0.137, 0], [0.137, 0.006], [0.12, 0.012], [0.06, 0.03], [0.0, 0.034]], 48), mat.copper));
    lid.add(mk(new THREE.TorusGeometry(0.022, 0.006, 8, 16, Math.PI), brass, 0, 0.034, 0));
    lid.position.set(0.3, HOB + 0.017 + 0.204, -0.45);
    g.add(lid);
    const fp = new THREE.Group();
    fp.add(mk(lathe(G, [[0, 0], [0.12, 0], [0.13, 0.01], [0.14, 0.04], [0.135, 0.042], [0.124, 0.012], [0.0, 0.006]], 40), iron));
    fp.add(mk(rbox(G, 0.22, 0.012, 0.03, 0.004), iron, 0.24, 0.04, 0, 0, 0, 0.12));
    fp.position.set(0.15, HOB + 0.017, -0.18); fp.rotation.y = -0.6;
    g.add(fp);
  }
  // the fire light sits just inside the grille and points out and down (spills only through the door)
  return { group: g, fireLightPos: V3(0, fbY - 0.02, 0.02), fireLightTarget: V3(0, 0.0, 0.9), emberMat, coals };
}

/** A cloth draped over a horizontal rail along X at the origin: hangs `front` m on +Z side, `back` on -Z side. */
export function drapedCloth({ width = 0.26, front = 0.3, back = 0.2, r = 0.014, seed = 1, nx = 28, ny = 48 } = {}) {
  const L = front + Math.PI * r + back;
  const pos = [], uv = [], idx = [];
  const fold = (x, d) => {
    const a = Math.min(1, d / 0.12) * 0.011;
    return Math.sin(x * 48 + seed) * a + Math.sin(x * 97 + seed * 2.1) * a * 0.35;
  };
  for (let j = 0; j <= ny; j++) {
    const sDist = (j / ny) * L;
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      let x = (u - 0.5) * width, y, z;
      if (sDist < front) {
        const d = front - sDist;
        y = -d; z = r + 0.002 + Math.max(0, fold(x, d));
        x *= 1 + d * 0.25;
        x += Math.sin(d * 9 + seed) * 0.004;
      } else if (sDist < front + Math.PI * r) {
        const th = (sDist - front) / r;
        y = Math.sin(th) * (r + 0.002); z = Math.cos(th) * (r + 0.002);
      } else {
        const d = sDist - front - Math.PI * r;
        y = -d; z = -r - 0.002 - Math.max(0, fold(x + 0.03, d));
        x *= 1 + d * 0.15;
      }
      pos.push(x, y, z); uv.push(u * width * 4, (sDist / L) * L * 4);
    }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// =====================================================================================
// Kitchen dresser / pantry shelving (left wall). Origin = floor, centre of the back
// (wall plane), facing +Z (rotate to fit). Length L along X. Returns { group, shelves }
// where shelves = [{ y, zFront }] for the three puzzle shelves (local coords).
// =====================================================================================
export function buildDresser(ctx, mat, { L = 1.9 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'dresser';
  const BD = 0.5, BH = 0.88, TOP = 0.045;        // base depth/height
  const SD = 0.3, SH = 2.75;                    // shelf depth, total height
  const paint = mat.dresserPaint, pine = mat.counter || mat.pine, brass = mat.brass;
  // ---- base cupboard
  g.add(mk(rbox(G, L, BH - 0.1, BD - 0.02, 0.005), paint, 0, 0.1 + (BH - 0.1) / 2, BD / 2 - 0.01));
  g.add(mk(rbox(G, L - 0.04, 0.1, BD - 0.06, 0.004), mat.soot, 0, 0.05, BD / 2 - 0.04));      // recessed plinth shadow
  g.add(mk(rbox(G, L + 0.06, TOP, BD + 0.04, 0.01), pine, 0, BH + TOP / 2, BD / 2));               // scrubbed worktop
  // drawers row + cupboard doors
  const nDr = 3;
  for (let i = 0; i < nDr; i++) {
    const w = (L - 0.08) / nDr - 0.02;
    const x = -L / 2 + 0.04 + (i + 0.5) * ((L - 0.08) / nDr);
    g.add(mk(G.raisedPanel(w, 0.16, { border: 0.025, bevel: 0.01, fieldDepth: 0.005, frameDepth: 0.012 }), paint, x, BH - 0.12, BD));
    for (const s of [-1, 1]) g.add(mk(lathe(G, [[0, 0], [0.012, 0], [0.016, 0.01], [0.008, 0.02], [0.014, 0.026], [0, 0.03]], 14), brass, x + s * w * 0.25, BH - 0.12, BD + 0.012, Math.PI / 2));
  }
  for (let i = 0; i < 2; i++) {
    const w = (L - 0.1) / 2 - 0.03;
    const x = (i === 0 ? -1 : 1) * ((L - 0.1) / 4 + 0.01);
    g.add(mk(G.raisedPanel(w, 0.5, { border: 0.06, bevel: 0.025, fieldDepth: 0.008 }), paint, x, 0.42, BD));
    g.add(mk(new THREE.SphereGeometry(0.016, 14, 10), brass, x + (i === 0 ? 1 : -1) * (w / 2 - 0.05), 0.5, BD + 0.025));
    // escutcheon
    g.add(mk(rbox(G, 0.022, 0.05, 0.004, 0.002), brass, x + (i === 0 ? 1 : -1) * (w / 2 - 0.05), 0.44, BD + 0.012));
  }
  // ---- upper rack
  const y0 = BH + TOP;
  // back boarding
  g.add(mk(G.planeUV(L, SH - y0, 1), mat.dresserBack || mat.boarding, 0, y0 + (SH - y0) / 2, 0.036));
  // shaped side boards (cyma curve at the bottom front)
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(SD * 0.6, 0);
    sh.bezierCurveTo(SD * 0.6, 0.12, SD, 0.1, SD, 0.3);
    sh.lineTo(SD, SH - y0); sh.lineTo(0, SH - y0); sh.lineTo(0, 0);
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.028, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 16 });
    const side = mk(G.applyBoxUVs(eg, 1), paint, s * (L / 2 - 0.014) - 0.014, y0, 0, 0, -Math.PI / 2, 0);
    side.position.x = s * (L / 2) + (s > 0 ? -0.028 : 0);
    g.add(side);
  }
  // shelves (with a plate groove rail on the upper two)
  const shelfYs = [1.26, 1.48, 1.7, 2.12, 2.48];
  for (const y of shelfYs) {
    g.add(mk(rbox(G, L - 0.06, 0.025, SD, 0.004), paint, 0, y - 0.0125, SD / 2));
    // front lip moulding
    g.add(mk(rbox(G, L - 0.06, 0.035, 0.02, 0.006), paint, 0, y - 0.01, SD - 0.005));
  }
  // cornice: cove moulding swept across the front and returns
  const cy = SH;
  const prof = [V2(0, 0), V2(0.012, 0), V2(0.012, 0.02), V2(0.03, 0.03), V2(0.05, 0.06), V2(0.07, 0.085), V2(0.085, 0.09), V2(0.085, 0.11), V2(0, 0.11)];
  const cor = G.sweepProfile(prof, [V3(-L / 2, cy, 0), V3(-L / 2, cy, SD), V3(L / 2, cy, SD), V3(L / 2, cy, 0)], { uvScale: 1 });
  g.add(mk(cor, paint));
  g.add(mk(rbox(G, L + 0.18, 0.025, SD + 0.1, 0.006), paint, 0, cy + 0.12, SD / 2 + 0.03));
  // fascia board under the cornice with a scalloped lower edge
  {
    const sh = new THREE.Shape();
    const fw = L - 0.06, fh = 0.12;
    sh.moveTo(-fw / 2, fh); sh.lineTo(fw / 2, fh); sh.lineTo(fw / 2, 0);
    const n = 11;
    for (let i = n; i > 0; i--) {
      const x1 = -fw / 2 + (fw * (i - 1)) / n, xm = -fw / 2 + (fw * (i - 0.5)) / n;
      sh.quadraticCurveTo(xm, 0.06, x1, 0);
    }
    sh.lineTo(-fw / 2, fh);
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6 });
    g.add(mk(G.applyBoxUVs(eg, 1), paint, 0, cy - 0.12, SD - 0.03));
  }
  const shelves = [{ y: shelfYs[2], zFront: SD }, { y: shelfYs[1], zFront: SD }, { y: shelfYs[0], zFront: SD }]; // top row first
  return { group: g, shelves, shelfYs, extraShelves: [shelfYs[3], shelfYs[4]], SD, L, BH: BH + TOP, BD };
}

// =====================================================================================
// Pantry clutter: stoneware crocks, preserving jars, a salt box, a mortar. Returns geometries
// merged into few meshes. Adds into `parent` at positions given (local to dresser).
// =====================================================================================
export function crock(G, h = 0.2, r = 0.075, neck = 0.6) {
  return lathe(G, [[0, 0], [r * 0.85, 0], [r, h * 0.08], [r * 1.02, h * 0.5], [r * 0.95, h * 0.82], [r * neck, h * 0.92], [r * neck * 1.08, h], [r * neck * 0.9, h], [0.0, h * 0.97]], 32);
}
export function jarGeo(G, h = 0.18, r = 0.05) {
  return lathe(G, [[0, 0], [r * 0.9, 0], [r, h * 0.05], [r, h * 0.78], [r * 0.8, h * 0.86], [r * 0.78, h * 0.95], [0, h * 0.95]], 28);
}

// =====================================================================================
// Butcher's block table: a 20 cm end-grain block (dished & scored in the middle, chamfered
// arrises) on four turned, tapered legs with aprons, low stretchers and a slatted pot board.
// Origin = floor centre. Top surface at y = TOPY; pot board top at POTY.
// mat: butcher (top, uv 0..1 over W x D), blockSide (long-grain staves, metre UVs), blockBase, iron
// =====================================================================================
export function buildButcherBlock(ctx, mat, { W = 1.5, D = 0.78 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'butcherblock';
  const TOPY = 0.88, T = 0.2, C = 0.016;
  // ---- block sides (staves), top at TOPY - C
  g.add(mk(rbox(G, W, T - C, D, 0.004, 1), mat.blockSide, 0, TOPY - C - (T - C) / 2, 0));
  // ---- top: custom grid with the chamfer rolled down at the edges and a dished, cook-worn hollow
  {
    const xs = [], zs = [];
    const nX = 90, nZ = 48;
    const pushAxis = (arr, half, n) => {
      arr.push(-half, -half + C * 0.5, -half + C);
      for (let i = 1; i < n; i++) arr.push(-half + C + (i / n) * (2 * half - 2 * C));
      arr.push(half - C, half - C * 0.5, half);
    };
    pushAxis(xs, W / 2, nX); pushAxis(zs, D / 2, nZ);
    const pos = [], uv = [], idx = [];
    for (let j = 0; j < zs.length; j++) for (let i = 0; i < xs.length; i++) {
      const x = xs[i], z = zs[j];
      const de = Math.min(W / 2 - Math.abs(x), D / 2 - Math.abs(z));
      let y = 0;
      if (de < C) y = -(C - de) * 0.95;                    // 45-degree chamfer, slightly rounded
      if (de < C * 0.5) y -= (C * 0.5 - de) * 0.3;
      const nx = x / (W / 2), nz = z / (D / 2);
      const dish = Math.exp(-(nx * nx * 2.0 + (nz - 0.15) * (nz - 0.15) * 2.6));
      y -= 0.016 * dish * Math.min(1, de / 0.06);
      y += 0.0006 * Math.sin(x * 57.1) * Math.sin(z * 49.3) * Math.min(1, de / 0.03);
      pos.push(x, y, z);
      uv.push((x + W / 2) / W, (z + D / 2) / D);
    }
    const NXp = xs.length;
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < NXp - 1; i++) {
      const a0 = j * NXp + i, a1 = a0 + 1, b0 = a0 + NXp, b1 = b0 + 1;
      idx.push(a0, b0, a1, a1, b0, b1);
    }
    const top = new THREE.BufferGeometry();
    top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    top.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    top.setIndex(idx);
    top.computeVertexNormals();
    g.add(mk(top, mat.butcher, 0, TOPY, 0));
  }
  // iron tie-rods through the block: square washers + nuts on the ends
  for (const s of [-1, 1]) for (const zz of [-0.24, 0, 0.24]) {
    g.add(mk(rbox(G, 0.006, 0.04, 0.04, 0.002), mat.iron, s * (W / 2 + 0.003), TOPY - T * 0.55, zz));
    g.add(mk(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 6), mat.iron, s * (W / 2 + 0.01), TOPY - T * 0.55, zz, 0, 0, Math.PI / 2));
    g.add(mk(new THREE.CylinderGeometry(0.004, 0.004, 0.012, 8), mat.iron, s * (W / 2 + 0.018), TOPY - T * 0.55, zz, 0, 0, Math.PI / 2));
  }
  // ---- base: turned legs, aprons, stretchers, pot board
  const LH = TOPY - T;                      // leg height under the block
  const lx = W / 2 - 0.1, lz = D / 2 - 0.1;
  const legProf = [
    [0, 0], [0.034, 0], [0.04, 0.008], [0.04, 0.03], [0.034, 0.04], [0.036, 0.05], [0.028, 0.07],
    [0.026, 0.14], [0.031, 0.15], [0.033, 0.165], [0.029, 0.18], [0.032, 0.2], [0.03, 0.215],
    [0.036, 0.3], [0.04, 0.4], [0.042, 0.44], [0.037, 0.455], [0.044, 0.47], [0.046, 0.49], [0.0, 0.49],
  ];
  const legTurn = lathe(G, legProf, 28);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mk(legTurn, mat.blockBase, sx * lx, 0, sz * lz));
    g.add(mk(rbox(G, 0.088, LH - 0.48, 0.088, 0.008, 2), mat.blockBase, sx * lx, 0.48 + (LH - 0.48) / 2, sz * lz));   // square block for the aprons
  }
  // aprons under the block (with a bead along the lower edge)
  for (const s of [-1, 1]) {
    g.add(mk(rbox(G, 2 * lx - 0.06, 0.11, 0.024, 0.004), mat.blockBase, 0, LH - 0.065, s * (lz + 0.02)));
    g.add(mk(new THREE.CylinderGeometry(0.006, 0.006, 2 * lx - 0.06, 8), mat.blockBase, 0, LH - 0.122, s * (lz + 0.03), 0, 0, Math.PI / 2));
    g.add(mk(rbox(G, 0.024, 0.11, 2 * lz - 0.06, 0.004), mat.blockBase, s * (lx + 0.02), LH - 0.065, 0));
  }
  // low stretchers (worn on top where boots rest) and a slatted pot board
  const SY = 0.16;
  for (const s of [-1, 1]) {
    g.add(mk(rbox(G, 2 * lx, 0.05, 0.045, 0.008), mat.blockBase, 0, SY, s * lz));
    g.add(mk(rbox(G, 0.045, 0.05, 2 * lz, 0.008), mat.blockBase, s * lx, SY, 0));
  }
  const nSl = 7, slW = (2 * lz + 0.04) / nSl;
  for (let i = 0; i < nSl; i++) {
    const z = -lz - 0.02 + (i + 0.5) * slW;
    g.add(mk(rbox(G, 2 * lx - 0.02, 0.018, slW - 0.008, 0.003), mat.blockBase, (i % 2 ? 0.003 : -0.002), SY + 0.034, z));
  }
  const surfaceY = (x, z) => {
    const nx = x / (W / 2), nz = z / (D / 2);
    const de = Math.min(W / 2 - Math.abs(x), D / 2 - Math.abs(z));
    return TOPY - 0.016 * Math.exp(-(nx * nx * 2.0 + (nz - 0.15) * (nz - 0.15) * 2.6)) * Math.min(1, de / 0.06);
  };
  return { group: g, TOPY, POTY: SY + 0.043, surfaceY };
}

// =====================================================================================
// Copper saucepan: planished body, rolled rim, tinned interior, riveted iron handle with a
// hanging loop. origin = base centre, opening +Y, handle along +X. stock: two loop handles.
// Returns a Group; userData.loop = local position of the handle's hanging loop.
// =====================================================================================
export function buildSaucepan(G, mat, r = 0.1, h = 0.08, handleLen = 0.22, { stock = false, seed = 0 } = {}) {
  const g = new THREE.Group();
  const t = 0.0025;
  const rnd = (k) => hash3(seed * 3.3 + 1, k * 1.7, r * 40);
  // body: flat base with a rounded heel, straight walls flaring a touch, a rolled bead at the rim
  const body = lathe(G, [[0, 0.0006], [r * 0.82, 0], [r * 0.94, h * 0.03], [r * 0.985, h * 0.1], [r, h * 0.2], [r * 1.01, h * 0.97], [r * 1.012 + 0.0005, h]], 64);
  // tarnish & heat colour as vertex tint: dark bloom at the rim and round the handle joint, a heat band at the base
  {
    const p = body.attributes.position, col = new Float32Array(p.count * 3);
    const ha = rnd(1) * 0.4 - 0.2;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const hj = Math.exp(-((Math.atan2(Math.sin(a - ha), Math.cos(a - ha))) ** 2) / 0.12) * Math.exp(-((y - h * 0.84) ** 2) / (h * h * 0.08));
      const rim = Math.exp(-((h - y) ** 2) / (h * h * 0.02)) * (0.6 + 0.4 * fbm3(x * 30, y * 30, z * 30 + seed, 2));
      const base = Math.exp(-(y * y) / (h * h * 0.03));
      const blot = Math.max(0, fbm3(x * 14 + seed, y * 14, z * 14, 3) - 0.55) * 1.6;
      const dk = 1 - 0.38 * hj - 0.3 * rim - 0.22 * blot;
      col[i * 3] = dk * (1 - base * 0.25); col[i * 3 + 1] = dk * (1 - base * 0.4); col[i * 3 + 2] = dk * (1 - base * 0.3);
    }
    body.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  g.add(mk(body, mat.copperV || mat.copper));
  g.add(mk(new THREE.TorusGeometry(r * 1.012 + 0.0012, 0.0034, 10, 72), mat.copperV ? mat.copper : mat.copper, 0, h, 0, Math.PI / 2));
  // tinned interior: a burn ring and scorched floor in the vertex colour
  const lining = lathe(G, [[r * 1.012 - t, h + 0.001], [r - t, h * 0.2], [r * 0.985 - t, h * 0.1 + t * 0.5], [r * 0.93 - t, h * 0.03 + t], [r * 0.8, t], [0, t]], 64);
  {
    const p = lining.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), rr = Math.hypot(x, z);
      const floor = y < t * 1.5 ? 1 : 0;
      const ring = Math.exp(-((rr - r * 0.62) ** 2) / (r * r * 0.02)) * floor;
      const n = fbm3(x * 25 + seed, y * 25, z * 25, 3);
      const burn = floor * (0.25 + 0.5 * Math.max(0, n - 0.4)) + ring * 0.4;
      const tide = Math.exp(-((y - h * (0.45 + 0.2 * rnd(4))) ** 2) / (h * h * 0.004)) * 0.25;   // a dried soup line
      const v = 1 - burn - tide;
      col[i * 3] = v * (1 - burn * 0.1); col[i * 3 + 1] = v * (1 - burn * 0.25); col[i * 3 + 2] = v * (1 - burn * 0.4);
    }
    lining.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  g.add(mk(lining, mat.tinLiningV || mat.tinLining || mat.copper));
  if (stock) {
    for (const s of [-1, 1]) {
      g.add(mk(new THREE.TorusGeometry(0.03, 0.006, 8, 18, Math.PI), mat.brass, s * (r + 0.004), h * 0.8, 0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0));
      for (const z of [-0.022, 0.022]) g.add(mk(new THREE.SphereGeometry(0.005, 8, 6), mat.copper, s * (r + 0.002), h * 0.8, z));
    }
    return g;
  }
  // long cast-iron handle: a riveted spoon-shaped strap on the body, a ribbed tapering bar, a hanging loop
  const hg = new THREE.Group();
  const L = handleLen;
  const bar = new THREE.Shape();
  bar.moveTo(0, -0.019); bar.quadraticCurveTo(0.03, -0.019, 0.05, -0.011); bar.lineTo(L, -0.0085);
  bar.absarc(L + 0.013, 0, 0.0175, -Math.PI / 2, Math.PI / 2, false);
  bar.lineTo(0.05, 0.011); bar.quadraticCurveTo(0.03, 0.019, 0, 0.019); bar.lineTo(0, -0.019);
  const hole = new THREE.Path(); hole.absarc(L + 0.015, 0, 0.0085, 0, Math.PI * 2, true); bar.holes.push(hole);
  const hgeo = new THREE.ExtrudeGeometry(bar, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0025, bevelSegments: 3, curveSegments: 20 });
  hgeo.translate(0, 0, -0.0035); hgeo.rotateX(Math.PI / 2);
  hg.add(mk(G.applyBoxUVs(hgeo, 1), mat.ironEdge || mat.ironPolished || mat.iron));
  // a raised rib down the bar
  hg.add(mk(rbox(G, L - 0.06, 0.004, 0.006, 0.0018), mat.ironEdge || mat.iron, 0.03 + (L - 0.06) / 2 + 0.02, 0.0055, 0));
  // two big copper rivets through strap and wall, their peened heads visible inside the tin
  for (const z of [-0.0085, 0.0085]) {
    hg.add(mk(new THREE.SphereGeometry(0.0055, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat.copper, 0.012, 0.0045, z));
  }
  hg.position.set(r * 1.005, h * 0.8, 0);
  hg.rotation.z = 0.14;
  g.add(hg);
  for (const z of [-0.0085, 0.0085]) g.add(mk(new THREE.SphereGeometry(0.005, 10, 6), mat.tinLining || mat.copper, r - t - 0.0015, h * 0.8 + 0.0015, z, 0, 0, Math.PI / 2));
  const lp = new THREE.Vector3(L + 0.015, 0, 0).applyEuler(hg.rotation).add(hg.position);
  g.userData.loop = lp;
  return g;
}

// =====================================================================================
// Victorian brass kitchen scale with pan and stacked weights. origin = base on table.
// =====================================================================================
export function buildScale(G, mat) {
  const g = new THREE.Group();
  g.add(mk(rbox(G, 0.3, 0.035, 0.14, 0.008), mat.iron, 0, 0.0175, 0));
  g.add(mk(lathe(G, [[0, 0], [0.025, 0], [0.018, 0.03], [0.014, 0.12], [0.02, 0.13], [0, 0.14]], 16), mat.iron, 0, 0.035, 0));
  g.add(mk(rbox(G, 0.3, 0.012, 0.02, 0.004), mat.brass, 0, 0.17, 0));
  // pan (left), platform (right)
  g.add(mk(lathe(G, [[0, 0], [0.06, 0], [0.11, 0.035], [0.115, 0.04], [0.105, 0.04], [0.055, 0.008], [0, 0.008]], 40), mat.brass, -0.12, 0.18, 0));
  g.add(mk(new THREE.CylinderGeometry(0.06, 0.06, 0.008, 32), mat.brass, 0.12, 0.18, 0));
  // weights stack
  let y = 0.184;
  for (const [r, hh] of [[0.045, 0.03], [0.036, 0.025], [0.028, 0.02], [0.021, 0.016]]) {
    g.add(mk(lathe(G, [[0, 0], [r, 0], [r, hh * 0.85], [r * 0.85, hh], [0.01, hh], [0.01, hh + 0.008], [0, hh + 0.01]], 24), mat.brass, 0.12, y, 0));
    y += hh;
  }
  return g;
}

// =====================================================================================
// Gas wall bracket with an etched globe. origin = wall plate centre, arm toward +Z.
// returns { group, globe, lightPos }
// =====================================================================================
export function buildGasBracket(G, mat, globeMat) {
  const g = new THREE.Group();
  g.add(mk(lathe(G, [[0, 0], [0.055, 0], [0.05, 0.012], [0.03, 0.02], [0, 0.025]], 24), mat.brass, 0, 0, 0, Math.PI / 2));
  g.add(mk(tube([[0, 0, 0.02], [0, -0.03, 0.12], [0, 0.02, 0.22], [0, 0.07, 0.26]], 0.009, 24, 8), mat.brass));
  // tap key
  g.add(mk(rbox(G, 0.05, 0.008, 0.01, 0.002), mat.brass, 0, -0.02, 0.1));
  // gallery + globe + chimney
  g.add(mk(lathe(G, [[0.015, 0], [0.05, 0.01], [0.055, 0.02], [0.05, 0.024], [0.015, 0.012]], 24), mat.brass, 0, 0.07, 0.26));
  const globe = mk(lathe(G, [[0.03, 0], [0.06, 0.02], [0.075, 0.07], [0.07, 0.12], [0.045, 0.16], [0.04, 0.17]], 32), globeMat, 0, 0.09, 0.26);
  globe.userData.noBake = true;
  g.add(globe);
  return { group: g, globe, lightPos: V3(0, 0.17, 0.26) };
}

/** Merge many (geometry, matrix) pairs into one geometry (strips extra attributes). */
export function mergeInto(list) {
  const geos = list.map(({ geo, m }) => {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (m) g.applyMatrix4(m);
    return g;
  });
  return mergeGeometries(geos, false);
}

// =====================================================================================
// Brass paraffin lamp with a glass chimney. origin = base. returns { group, flameY }
// =====================================================================================
export function buildOilLamp(ctx, mat, { flame: fI = 1.6 } = {}) {
  const { geometry: G, fx } = ctx;
  const g = new THREE.Group();
  g.add(mk(lathe(G, [[0, 0], [0.07, 0], [0.072, 0.008], [0.06, 0.016], [0.025, 0.03], [0.02, 0.08], [0.03, 0.09], [0.065, 0.12], [0.072, 0.15], [0.06, 0.18], [0.025, 0.195], [0.03, 0.21], [0.0, 0.215]], 32), mat.brass));
  // burner gallery
  g.add(mk(lathe(G, [[0.02, 0.21], [0.036, 0.215], [0.04, 0.24], [0.035, 0.245], [0.02, 0.24]], 24), mat.brass));
  const chimney = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.18, emissive: new THREE.Color(1.0, 0.7, 0.4), emissiveIntensity: 0.03, clearcoat: 1, name: 'lampChimney' });
  const ch = mk(lathe(G, [[0.03, 0.24], [0.034, 0.26], [0.045, 0.3], [0.042, 0.33], [0.022, 0.38], [0.02, 0.47]], 28), chimney);
  ch.userData.noBake = true;
  g.add(ch);
  const flame = fx.flame({ height: 0.032, width: 0.011, intensity: fI });
  flame.position.y = 0.255;
  g.add(flame);
  return { group: g, flameY: 0.3 };
}

// =====================================================================================
// Windsor kitchen chair (elm seat, turned legs, hoop back). origin = floor centre, faces +Z.
// =====================================================================================
export function buildWindsorChair(G, mat) {
  const g = new THREE.Group();
  const seatShape = new THREE.Shape();
  seatShape.moveTo(-0.2, -0.2); seatShape.quadraticCurveTo(0, -0.24, 0.2, -0.2); seatShape.quadraticCurveTo(0.23, 0, 0.19, 0.17);
  seatShape.quadraticCurveTo(0, 0.24, -0.19, 0.17); seatShape.quadraticCurveTo(-0.23, 0, -0.2, -0.2);
  const seat = new THREE.ExtrudeGeometry(seatShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 3, curveSegments: 16 });
  g.add(mk(G.applyBoxUVs(seat, 1), mat.pineDark, 0, 0.44, 0, Math.PI / 2, 0, 0));
  const legGeo = lathe(G, [[0.016, 0], [0.019, 0.04], [0.015, 0.12], [0.022, 0.2], [0.016, 0.26], [0.02, 0.32], [0.013, 0.41], [0.0, 0.42]], 12);
  const legs = [[-0.17, -0.15], [0.17, -0.15], [-0.16, 0.14], [0.16, 0.14]];
  for (const [x, z] of legs) {
    const l = mk(legGeo, mat.pineDark, x * 1.08, 0, z * 1.1);
    l.rotation.set(-z * 0.5, 0, x * 0.5);
    g.add(l);
  }
  g.add(mk(new THREE.CylinderGeometry(0.01, 0.01, 0.36, 8), mat.pineDark, 0, 0.17, 0, 0, 0, Math.PI / 2));
  for (const s of [-1, 1]) g.add(mk(new THREE.CylinderGeometry(0.009, 0.009, 0.32, 8), mat.pineDark, s * 0.18, 0.17, 0, Math.PI / 2, 0, 0));
  // hoop back + spindles (back at -z)
  const hoop = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI * (i / 16); hoop.push(V3(Math.cos(a) * 0.18, 0.46 + Math.sin(a) * 0.48, -0.17 - Math.sin(a) * 0.06)); }
  g.add(mk(tube(hoop, 0.012, 40, 8), mat.pineDark));
  for (let i = 0; i < 6; i++) {
    const x = -0.11 + i * 0.044;
    const top = 0.46 + Math.sqrt(Math.max(0, 0.18 * 0.18 - x * x)) / 0.18 * 0.48;
    g.add(mk(tube([V3(x, 0.47, -0.16), V3(x * 1.05, top - 0.01, -0.17 - Math.sin(Math.acos(Math.min(1, Math.abs(x) / 0.18))) * 0.06)], 0.006, 2, 6), mat.pineDark));
  }
  return g;
}

// =====================================================================================
// Set dressing for the kitchen's emptier corners.
// =====================================================================================

/** A brace of cock pheasants hung by the neck. origin = hook point; birds hang down -Y. */
export function buildPheasant(G, mat, seed = 0) {
  const g = new THREE.Group();
  // hung by the neck: a heavy, rounded breast low down, the back tapering into the tail
  const body = new THREE.SphereGeometry(0.075, 32, 20);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = y / 0.075;                                        // -1 bottom (breast) .. 1 top (neck)
    const w = 1.05 - 0.55 * Math.max(0, t) ** 1.5 + 0.08 * (1 - t * t);
    const breast = z > 0 ? 1 + 0.25 * Math.max(0, -t + 0.3) : 0.85;
    p.setXYZ(i, x * w * 0.9, y * 1.8, z * w * breast * 0.85);
  }
  body.computeVertexNormals();
  g.add(mk(body, mat.plumage, 0, -0.22, 0));
  // folded wings, hanging a little loose from the shoulders
  for (const s of [-1, 1]) {
    const wg = new THREE.SphereGeometry(0.05, 16, 10);
    wg.scale(0.35, 1.7, 1.0);
    g.add(mk(wg, mat.plumage, s * 0.058, -0.2, -0.01, 0.12, 0, s * 0.12));
  }
  // neck + head (copper-green sheen) + white collar + red wattle
  g.add(mk(new THREE.CylinderGeometry(0.013, 0.02, 0.12, 10), mat.pheasantHead, 0, -0.07, 0));
  g.add(mk(new THREE.TorusGeometry(0.019, 0.005, 6, 14), mat.collar, 0, -0.125, 0, Math.PI / 2));
  g.add(mk(new THREE.SphereGeometry(0.02, 12, 10), mat.pheasantHead, 0, -0.005, 0.01));
  g.add(mk(new THREE.SphereGeometry(0.009, 8, 6), mat.wattle, 0.012, -0.003, 0.016));
  g.add(mk(new THREE.ConeGeometry(0.006, 0.022, 6), mat.bone || mat.collar, 0, 0.0, 0.032, Math.PI / 2));
  // tail: long tapering barred feathers sweeping down
  for (let k = 0; k < 4; k++) {
    const len = 0.32 + k * 0.06;
    const f = new THREE.PlaneGeometry(0.022 - k * 0.003, len, 1, 8);
    f.translate(0, -len / 2, 0);
    const fp = f.attributes.position;
    for (let i = 0; i < fp.count; i++) { const y = fp.getY(i); fp.setX(i, fp.getX(i) * (1 + y * 1.5)); fp.setZ(i, y * y * 0.4); }
    f.computeVertexNormals();
    g.add(mk(f, mat.tail, (k - 1.5) * 0.012, -0.36, -0.02 + k * 0.006, 0.12, 0, (k - 1.5) * 0.06));
  }
  // dangling legs
  for (const s of [-1, 1]) g.add(mk(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 6), mat.bone || mat.collar, s * 0.03, -0.37, 0.05, 0.3, 0, s * 0.1));
  g.add(mk(new THREE.CylinderGeometry(0.0025, 0.0025, 0.06, 5), mat.rope, 0, 0.0, 0));
  g.rotation.y = seed * 1.3;
  return g;
}

/** Galvanised mop bucket with a string mop leaning in it. origin = floor centre. */
export function buildMopBucket(G, mat) {
  const g = new THREE.Group();
  g.add(mk(lathe(G, [[0, 0], [0.13, 0], [0.135, 0.01], [0.16, 0.27], [0.168, 0.28], [0.162, 0.285], [0.152, 0.27], [0.125, 0.018], [0, 0.018]], 36), mat.zincPail));
  for (const y of [0.09, 0.18]) g.add(mk(new THREE.TorusGeometry(0.142 + y * 0.09, 0.004, 6, 40), mat.zincPail, 0, y, 0, Math.PI / 2));
  g.add(mk(tube([[-0.165, 0.25, 0], [-0.12, 0.42, 0], [0.12, 0.42, 0], [0.165, 0.25, 0]], 0.004, 24, 6), mat.steel));
  g.add(mk(new THREE.CylinderGeometry(0.155, 0.155, 0.005, 32), mat.dirtyWater, 0, 0.17, 0));
  const mop = new THREE.Group();
  mop.add(mk(new THREE.CylinderGeometry(0.013, 0.013, 1.35, 8), mat.pine, 0, 0.675, 0));
  const strands = [];
  const sg = new THREE.CylinderGeometry(0.006, 0.005, 0.32, 5);
  for (let i = 0; i < 46; i++) {
    const a = i * 2.39996, rr = 0.02 + (i % 5) * 0.008;
    strands.push({ geo: sg, m: new THREE.Matrix4().compose(V3(Math.cos(a) * rr * 1.6, 0.0 + (i % 3) * 0.01, Math.sin(a) * rr * 1.6), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)), V3(1, 1, 1)) });
  }
  mop.add(mk(mergeInto(strands), mat.mopString, 0, 0.0, 0));
  mop.position.set(0.02, 0.12, 0.0); mop.rotation.set(0.0, 0, -0.24);
  g.add(mop);
  return g;
}

/** A pair of hob-nailed boots. origin = floor between them, toes +Z. */
export function buildBoots(G, mat) {
  const g = new THREE.Group();
  const boot = () => {
    const b = new THREE.Group();
    const sole = new THREE.Shape();
    sole.moveTo(-0.04, -0.13); sole.quadraticCurveTo(0, -0.15, 0.04, -0.13); sole.lineTo(0.048, 0.06); sole.quadraticCurveTo(0.05, 0.15, 0, 0.155); sole.quadraticCurveTo(-0.05, 0.15, -0.046, 0.06); sole.lineTo(-0.04, -0.13);
    const sg = new THREE.ExtrudeGeometry(sole, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 12 });
    sg.rotateX(Math.PI / 2); sg.translate(0, 0.026, 0);
    b.add(mk(G.applyBoxUVs(sg, 1), mat.bootSole));
    const vamp = new THREE.SphereGeometry(0.06, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    vamp.scale(0.78, 0.75, 1.6); vamp.translate(0, 0.026, 0.05);
    b.add(mk(vamp, mat.leatherBoot));
    const shaft = new THREE.CylinderGeometry(0.048, 0.054, 0.2, 18, 1, true);
    shaft.scale(1, 1, 1.15); shaft.translate(0, 0.12, -0.065);
    b.add(mk(shaft, mat.leatherBoot));
    b.add(mk(new THREE.TorusGeometry(0.05, 0.005, 6, 18), mat.leatherBoot, 0, 0.22, -0.065, Math.PI / 2, 0, 0)).scale.set(1, 1.15, 1);
    for (let i = 0; i < 4; i++) b.add(mk(new THREE.TorusGeometry(0.004, 0.0012, 4, 8), mat.brass, 0.034, 0.08 + i * 0.03, -0.02 - i * 0.008, 0, Math.PI / 2, 0));
    return b;
  };
  const l = boot(); l.position.set(-0.07, 0, 0); l.rotation.y = 0.12; g.add(l);
  const r = boot(); r.position.set(0.08, 0, 0.03); r.rotation.set(0, -0.2, 0); g.add(r);
  return g;
}

/** Coal hod (iron, Edwardian shape) with lumps of coal and a little shovel. origin = floor. */
export function buildCoalHod(G, mat) {
  const g = new THREE.Group();
  const hod = mk(lathe(G, [[0, 0], [0.14, 0], [0.16, 0.06], [0.17, 0.22], [0.158, 0.3], [0.165, 0.305], [0.15, 0.31], [0.14, 0.24], [0, 0.24]], 32), mat.iron);
  hod.scale.set(1, 1, 0.8);
  g.add(hod);
  // coal lumps heaped above the rim
  const lump = new THREE.IcosahedronGeometry(0.035, 0);
  const lumps = [];
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996, rr = Math.sqrt(i / 26) * 0.12;
    lumps.push({ geo: lump, m: new THREE.Matrix4().compose(V3(Math.cos(a) * rr, 0.25 + (0.12 - rr) * 0.5 + (i % 3) * 0.008, Math.sin(a) * rr * 0.8), new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 0.7, i * 1.3)), V3(1 + (i % 4) * 0.2, 0.7 + (i % 3) * 0.2, 1)) });
  }
  g.add(mk(mergeInto(lumps), mat.coal));
  g.add(mk(tube([[-0.17, 0.26, 0], [-0.1, 0.42, 0], [0.1, 0.42, 0], [0.17, 0.26, 0]], 0.007, 24, 8), mat.iron));
  g.add(mk(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 10), mat.pineDark, 0, 0.42, 0, 0, 0, Math.PI / 2));
  const sh = new THREE.Group();
  sh.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 8), mat.iron, 0, 0.18, 0));
  sh.add(mk(rbox(G, 0.09, 0.004, 0.11, 0.002), mat.iron, 0, 0.0, 0.03, 0.3, 0, 0));
  sh.position.set(0.12, 0.32, 0.02); sh.rotation.set(0.0, 0, -0.5);
  g.add(sh);
  return g;
}

// small deterministic value noise for geometry displacement
function hash3(x, y, z) { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
export function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
export function fbm3(x, y, z, oct = 3) { let a = 0, s = 0.5, f = 1; for (let i = 0; i < oct; i++) { a += s * vnoise3(x * f, y * f, z * f); f *= 2.03; s *= 0.5; } return a / (1 - 0.5 ** oct); }

/**
 * A filled hessian flour sack standing under its own weight: flat splayed base that bulges
 * sideways, an asymmetric slump, two or three big diagonal creases, shoulders gathered into a
 * short twisted neck. Vertex colours carry the low-frequency ageing (dirt and damp toward the
 * base, flour dusting on the shoulders). origin = floor centre, neck up +Y.
 * opts.lying: shorten & flatten for a sack laid on its side (caller rotates it).
 */
export function sackGeometry(seed = 0, { r = 0.2, h = 0.5, slump = 0.3, neck = 0.11, flour = 0.6 } = {}) {
  const NU = 72, NV = 56;
  const pos = [], col = [], uvs = [], suv = [], idx = [];
  const rnd = (k) => hash3(seed * 1.7, k * 3.1, 0.5);
  const lean = [(rnd(1) - 0.5) * 0.5 * slump * r, (rnd(2) - 0.5) * 0.35 * slump * r];
  const creases = [0, 1, 2, 3].slice(0, 3 + (seed % 2)).map((k) => ({ a: rnd(10 + k) * Math.PI * 2, t: 0.35 + rnd(20 + k) * 0.4, tilt: (rnd(30 + k) - 0.5) * 3.0, depth: 0.16 + rnd(40 + k) * 0.1 }));
  const sagBands = [0.48 + rnd(50) * 0.1, 0.62 + rnd(51) * 0.08];
  const tNeck = 1 - neck / h * 1.0;          // where the neck starts
  for (let j = 0; j <= NV; j++) {
    const t = j / NV;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU, a = u * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      // ---- profile: radius & height for parameter t
      let rr, y;
      if (t < 0.08) {               // flat base, rounding up into the bulge
        const k = t / 0.08;
        rr = r * (0.0 + 1.12 * Math.sin(k * Math.PI / 2));
        y = h * 0.035 * (1 - Math.cos(k * Math.PI / 2));
      } else if (t < tNeck - 0.08) { // body: widest low down (settled), narrowing to the shoulder
        const k = (t - 0.08) / (tNeck - 0.16);
        // pear-shaped: the flour settles into a fat belly low down, the top half slack
        rr = r * (1.08 + 0.1 * slump + 0.07 * Math.sin(Math.min(1, k / 0.3) * Math.PI * 0.5) - k * 0.1 - 4.0 * Math.max(0, k - 0.74) ** 2);
        y = h * (0.035 + k * (tNeck - 0.12));
      } else if (t < tNeck) {        // shoulder gathered into the neck
        const k = (t - (tNeck - 0.08)) / 0.08;
        rr = r * (0.82 * (1 - k) + 0.17 * k);
        y = h * ((tNeck - 0.085) + k * 0.07);
      } else {                       // twisted neck + small ruffled mouth
        const k = (t - tNeck) / (1 - tNeck);
        // the gathered mouth above the tie flares open in a ruff of hessian
        rr = r * (0.16 - 0.03 * Math.sin(k * Math.PI) + (k > 0.55 ? ((k - 0.55) / 0.45) ** 1.5 * 0.32 : 0));
        y = h * (tNeck - 0.015) + neck * 1.25 * k;
      }
      // the sack settles: base squashed wide, the upper half sags to one side and forward
      const sag = Math.sin(Math.min(1, t / tNeck) * Math.PI * 0.5) ** 2;
      let x = ca * rr, z = sa * rr * (0.9 - 0.08 * slump);
      // big diagonal creases (inward folds with a soft ridge either side)
      let fold = 0;
      for (const c of creases) {
        let da = Math.atan2(Math.sin(a - c.a - c.tilt * (t - c.t)), Math.cos(a - c.a - c.tilt * (t - c.t)));
        const band = Math.exp(-((t - c.t) ** 2) / 0.05);
        fold += (-c.depth * Math.exp(-(da * da) / 0.006) + c.depth * 0.4 * Math.exp(-((Math.abs(da) - 0.16) ** 2) / 0.006)) * band;
      }
      // lumpy fill (flour settles unevenly) - kept low so the silhouette stays taut, not a beanbag
      const lump = (fbm3(ca * 2.2 + seed, t * 3.0, sa * 2.2, 3) - 0.5) * 0.09;
      // gathered folds radiating down from the tie: sharp V valleys between soft ridges, deepest at the neck
      const nF = 4 + (seed % 2);
      const gath = Math.max(0, Math.min(1, (t - (tNeck - 0.26)) / 0.26));
      const fphase = a * nF * 0.5 + seed * 1.3 + (t - tNeck) * 4.0 * (rnd(60) - 0.5);
      const vfold = 1 - Math.pow(Math.abs(Math.sin(fphase)), 0.35);
      const wr = -gath * gath * (0.3 * vfold) + gath * 0.05 * Math.sin(a * 11 + t * 30 + seed);
      const twist = t > tNeck ? Math.sin(a * 6 + (t - tNeck) * 60 + seed) * 0.22 - 0.12 * vfold + (t > tNeck + (1 - tNeck) * 0.5 ? 0.22 * Math.sin(a * 9 + seed) * ((t - tNeck) / (1 - tNeck)) : 0) : 0;
      // the side seams: the sack was sewn from a flat tube, so two crisp ridges run up its sides
      const seamA = Math.min(Math.abs(Math.atan2(Math.sin(a), Math.cos(a))), Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))));
      const seamR = 0.035 * Math.exp(-(seamA * seamA) / 0.004) - 0.02 * Math.exp(-((seamA - 0.12) ** 2) / 0.003);
      // belly: the full sack sags over its base, a crease where it meets the floor
      const belly = 0.07 * Math.exp(-((t - 0.13) ** 2) / 0.0025) - 0.06 * Math.exp(-((t - 0.065) ** 2) / 0.0005);
      // horizontal sag wrinkles where the slack top folds over the full belly
      let sagW = 0;
      for (const b of sagBands) sagW -= 0.045 * Math.exp(-((t - b) ** 2) / 0.0012) * (0.6 + 0.4 * Math.sin(a * 2 + seed + b * 9));
      const k = 1 + (t > 0.03 && t < tNeck ? fold + lump + sagW + seamR * (1 - gath) + belly : 0) + wr + twist;
      x *= k; z *= k;
      x += lean[0] * sag; z += lean[1] * sag;
      y *= 1 - slump * 0.12 * sag;
      if (t >= 0.08 && t < tNeck) y += (fbm3(ca * 3 + 4, t * 2, sa * 3 + seed, 2) - 0.5) * 0.03 * h;
      pos.push(x, Math.max(0, y), z);
      // ---- ageing colour
      const n1 = fbm3(ca * 1.6 + seed * 3, y * 3.2, sa * 1.6, 4), n2 = fbm3(ca * 5 + 9, y * 9, sa * 5 + seed, 3);
      const dirt = Math.exp(-y / (0.07 + 0.05 * n1));
      const damp = Math.max(0, n1 - 0.62) * 2.5 * (1 - Math.min(1, y / (h * 0.6)));
      const dust = flour * Math.max(0, n2 - 0.38) * 1.6 * (0.4 + 0.6 * Math.max(0, 1 - Math.abs(t - 0.82) * 3)) + flour * 0.5 * Math.max(0, n2 - 0.55) * Math.max(0, 0.2 - y) * 5
        + flour * 0.9 * Math.exp(-(seamA * seamA) / 0.01) * (0.4 + 0.8 * n2)          // flour sifts out through the seams
        + flour * 0.7 * Math.exp(-y / 0.05) * (0.3 + 0.9 * n1)                          // and cakes round the base
        + flour * 0.6 * gath * vfold * (0.5 + n2);                                      // and lodges in the neck folds
      let cr = 1, cg = 1, cb = 1;
      const shade = 1 - dirt * 0.45 - damp * 0.35 + (n2 - 0.5) * 0.18;
      cr *= shade; cg *= shade * 0.98; cb *= shade * 0.95;
      const fd = Math.min(0.75, dust);
      cr = cr * (1 - fd) + 1.55 * fd; cg = cg * (1 - fd) + 1.6 * fd; cb = cb * (1 - fd) + 1.75 * fd;
      col.push(cr, cg, cb);
      uvs.push(u * 2 * Math.PI * r * 1.1, t * (h + r));
      suv.push(u, t / tNeck);
    }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a0 = j * (NU + 1) + i, a1 = a0 + 1, b0 = a0 + NU + 1, b1 = b0 + 1;
    idx.push(a0, b0, a1, a1, b0, b1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('suv', new THREE.Float32BufferAttribute(suv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // weld the seam normals (u = 0 / 1)
  const n = geo.attributes.normal;
  for (let j = 0; j <= NV; j++) {
    const a0 = j * (NU + 1), a1 = a0 + NU;
    const nx = n.getX(a0) + n.getX(a1), ny = n.getY(a0) + n.getY(a1), nz = n.getZ(a0) + n.getZ(a1);
    const l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a0, nx / l, ny / l, nz / l); n.setXYZ(a1, nx / l, ny / l, nz / l);
  }
  geo.userData.neckY = h * (tNeck - 0.015) * (1 - slump * 0.12);
  geo.userData.neckR = r * 0.16;
  geo.userData.lean = lean;
  return geo;
}

/** Cord tied round a sack neck: two wraps, a knot and a hanging loop. origin = neck centre. */
export function sackTie(mat, r = 0.032, seed = 0) {
  const g = new THREE.Group();
  for (let k = 0; k < 2; k++) g.add(mk(new THREE.TorusGeometry(r + k * 0.004, 0.0045, 6, 28), mat, 0, k * 0.011 - 0.005, 0, Math.PI / 2 + (k - 0.5) * 0.12, 0, 0));
  g.add(mk(new THREE.SphereGeometry(0.011, 10, 8), mat, r + 0.004, 0.0, 0.0));
  const s = seed % 2 ? 1 : -1;
  g.add(mk(tube([[r + 0.006, 0, 0], [r + 0.03, -0.035, 0.02 * s], [r + 0.03, -0.09, 0.03 * s], [r + 0.01, -0.12, 0.0], [r - 0.005, -0.08, -0.015 * s], [r + 0.004, -0.01, 0]], 0.0035, 30, 5), mat));
  g.add(mk(tube([[r + 0.008, 0, 0.004], [r + 0.025, -0.04, -0.03 * s], [r + 0.02, -0.07, -0.05 * s]], 0.0035, 12, 5), mat));
  return g;
}

/** Cottage loaf: two stacked, slashed domes. origin = base. */
export function loafGeometry(G) {
  const parts = [];
  const lower = new THREE.SphereGeometry(0.09, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
  lower.scale(1, 0.55, 1); lower.translate(0, 0.0, 0);
  const upper = new THREE.SphereGeometry(0.055, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.7);
  upper.scale(1, 0.75, 1); upper.translate(0, 0.045, 0);
  for (const g of [lower, upper]) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 - 0.035 * Math.max(0, Math.cos(a * 6)) ** 8; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    g.computeVertexNormals();
    parts.push(g);
  }
  return mergeInto(parts.map((geo) => ({ geo })));
}

/** A plaited string of onions (and a few garlic bulbs) hanging from a loop. origin = loop top, hangs down -Y. */
export function buildOnionString(G, mats, { seed = 1, len = 0.62, n = 14 } = {}) {
  const g = new THREE.Group();
  const R = (k) => hash3(seed * 5.1, k * 2.3, 0.7);
  // the onion: a squat teardrop with a pointed neck and a wisp of root at the base
  const onionProf = [[0, -0.0005], [0.008, 0.0], [0.024, 0.006], [0.036, 0.02], [0.04, 0.034], [0.036, 0.048], [0.024, 0.06], [0.012, 0.07], [0.005, 0.082], [0.002, 0.094], [0, 0.095]];
  const onion = lathe(G, onionProf, 20);
  // papery skin: faint longitudinal ridges
  { const p = onion.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.035 * Math.sin(a * 9); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } onion.computeVertexNormals(); }
  const garlic = lathe(G, [[0, 0], [0.012, 0.002], [0.024, 0.012], [0.027, 0.024], [0.02, 0.036], [0.008, 0.044], [0.003, 0.058], [0, 0.06]], 16);
  { const p = garlic.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.12 * Math.abs(Math.sin(a * 4)) - 0.06; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } garlic.computeVertexNormals(); }
  // straw plait core
  const core = []; for (let i = 0; i <= 20; i++) { const t = i / 20; core.push([Math.sin(t * 9 + seed) * 0.006, -t * len, Math.cos(t * 7 + seed) * 0.006]); }
  g.add(mk(tube(core, 0.009, 40, 6), mats.straw));
  g.add(mk(new THREE.TorusGeometry(0.03, 0.005, 6, 16), mats.straw, 0, 0.02, 0));
  for (let i = 0; i < n; i++) {
    const t = 0.1 + (i / (n - 1)) * 0.82;
    const a = i * 2.4 + R(i) * 0.8;
    const isG = i % 5 === 3;
    const sc = isG ? 0.95 + R(i + 40) * 0.2 : 0.85 + R(i + 20) * 0.35;
    const tilt = 0.5 + R(i + 60) * 0.5;
    const out = 0.008 + (isG ? 0.055 : 0.088) * sc * Math.sin(tilt);
    const m = mk(isG ? garlic : onion, isG ? mats.garlic : mats.onions[i % mats.onions.length], Math.cos(a) * out, -t * len - 0.06 * Math.cos(tilt), Math.sin(a) * out);
    // neck tucked into the plait: the bulb tilts outward and hangs below it
    m.rotation.set(-Math.sin(a) * tilt, 0, Math.cos(a) * tilt);
    m.scale.setScalar(sc);
    g.add(m);
  }
  return g;
}

/**
 * A poured heap of flour: a displaced, slumped cone (angle-of-repose flanks, a soft crater where the stream fell,
 * avalanche runnels), elongated along +X by `stretch`, with an RGBA vertex colour whose alpha feathers the skirt to
 * nothing so it melts into the floor decal. origin = centre on the ground.
 */
export function flourMound({ R = 0.25, h = 0.07, seed = 1, stretch = 1.3, nr = 28, ns = 72 } = {}) {
  const pos = [], col = [], uv = [], idx = [];
  const rr = (k) => hash3(seed * 2.1, k * 1.9, 0.3);
  for (let j = 0; j <= nr; j++) {
    const rho = j / nr;
    for (let i = 0; i <= ns; i++) {
      const th = (i / ns) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      const edge = 1 + 0.16 * Math.sin(th * 3 + rr(1) * 6) + 0.08 * Math.sin(th * 7 + rr(2) * 6) + 0.12 * (fbm3(c * 2 + seed, s * 2, 0.5, 3) - 0.5);
      const rad = rho * R * edge;
      let x = c * rad * (c > 0 ? stretch : 1), z = s * rad;
      // profile: rounded summit, straight-ish repose flank, long feathered toe
      const prof = Math.pow(Math.max(0, 1 - rho), 1.7) * (1 - 0.25 * Math.exp(-rho * rho / 0.02));
      const runnel = 0.08 * Math.sin(th * 13 + rr(3) * 6) * Math.sin(Math.PI * Math.min(1, rho * 1.3));
      const lump = (fbm3(x * 18 + seed, z * 18, 1.3, 3) - 0.5) * 0.25;
      const y = h * prof * (1 + runnel + lump);
      pos.push(x, Math.max(0.0005, y), z);
      const a = 1 - smoothstepJS(0.62, 1.0, rho);
      const shade = 0.92 + 0.08 * fbm3(x * 9, z * 9, seed, 2);
      col.push(shade, shade, shade * 0.98, a);
      uv.push(x * 4, z * 4);
    }
  }
  for (let j = 0; j < nr; j++) for (let i = 0; i < ns; i++) {
    const a0 = j * (ns + 1) + i, a1 = a0 + 1, b0 = a0 + ns + 1, b1 = b0 + 1;
    idx.push(a0, a1, b0, a1, b1, b0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
function smoothstepJS(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
