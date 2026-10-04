import * as THREE from 'three';
import { sdfGeometry, sdEllipsoid, sdRoundCone, smin, smax } from '../../engine/lib/contrib/bedroom-sdf.js';

/**
 * Extra furniture for the foyer (round 4 dressing): a round centre table with an urn of dying roses,
 * carved hall chairs, a marble bust on a fluted plinth, a blue-and-white porcelain umbrella jar, and a
 * small console with frames for the upstairs gallery. Local +z = the piece's front.
 */

const shadowAll = (g) => { g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return g; };

/** tilt-top centre table on a turned pedestal with three carved scroll feet (Ø 1.1 m) */
export function centreTable(ctx, { wood, gilt, marble }) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'centreTable';
  const R = 0.56;
  const top = new THREE.Mesh(G.latheFromProfile([[0, 0], [R - 0.03, 0], [R, 0.008], [R + 0.008, 0.02], [R, 0.034], [R - 0.012, 0.042], [0, 0.042]], 72), marble || wood);
  top.position.y = 0.74; g.add(top);
  const apron = new THREE.Mesh(G.latheFromProfile([[0, 0], [R - 0.04, 0], [R - 0.04, 0.07], [R - 0.06, 0.075], [0, 0.075]], 64), wood);
  apron.position.y = 0.665; g.add(apron);
  const bead = new THREE.Mesh(new THREE.TorusGeometry(R - 0.038, 0.007, 8, 96), gilt); bead.rotation.x = Math.PI / 2; bead.position.y = 0.7; g.add(bead);
  const ped = G.latheFromProfile([[0, 0], [0.09, 0], [0.1, 0.02], [0.085, 0.05], [0.07, 0.07], [0.09, 0.12], [0.11, 0.2], [0.1, 0.26], [0.07, 0.3], [0.05, 0.36], [0.055, 0.42], [0.04, 0.48], [0.045, 0.56], [0.07, 0.6], [0.08, 0.63], [0.0, 0.665]], 36);
  g.add(new THREE.Mesh(ped, wood));
  for (const y of [0.42, 0.56]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 32), gilt); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const pts = [new THREE.Vector3(0.05, 0.14, 0), new THREE.Vector3(0.18, 0.1, 0), new THREE.Vector3(0.3, 0.05, 0), new THREE.Vector3(0.36, 0.02, 0), new THREE.Vector3(0.38, 0.045, 0)];
    const leg = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.03, 10, false), wood);
    leg.scale.set(1, 1, 1.25); leg.rotation.y = a; g.add(leg);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), gilt); toe.position.set(Math.cos(-a) * 0.385, 0.03, Math.sin(-a) * 0.385); g.add(toe);
  }
  return shadowAll(g);
}

/** a footed urn of dark, dying roses and limp foliage */
export function flowerUrn(ctx, { urnMat, seed = 7 }) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'flowerUrn';
  const urn = G.latheFromProfile([[0, 0], [0.09, 0], [0.09, 0.02], [0.05, 0.04], [0.04, 0.09], [0.06, 0.12], [0.13, 0.17], [0.16, 0.24], [0.15, 0.3], [0.11, 0.34], [0.12, 0.36], [0.15, 0.38], [0.14, 0.39], [0.1, 0.37], [0, 0.36]], 40);
  g.add(new THREE.Mesh(urn, urnMat));
  let sd = seed * 7919 + 13; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  // blush-and-ivory roses gone over: papery, browning at the edges (they read against the dark hall)
  const petal = new THREE.MeshPhysicalMaterial({ color: 0xb88a7a, roughness: 0.7, sheen: 0.7, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.9, 0.75, 0.7) });
  const petal2 = new THREE.MeshPhysicalMaterial({ color: 0x8a5a3e, roughness: 0.85 });   // a few have browned
  const petal3 = new THREE.MeshPhysicalMaterial({ color: 0x6e1018, roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color(0.6, 0.2, 0.2) });
  const leafM = new THREE.MeshStandardMaterial({ color: 0x14200e, roughness: 0.7, side: THREE.DoubleSide });
  const stemM = new THREE.MeshStandardMaterial({ color: 0x1a2410, roughness: 0.8 });
  // a rose: three nested, slightly crumpled petal cups
  const roseGeo = (() => {
    const parts = [];
    for (let k = 0; k < 3; k++) {
      const r = 0.045 - k * 0.012;
      const s = new THREE.SphereGeometry(r, 14, 10, 0, Math.PI * 2, 0, Math.PI * (0.55 + k * 0.08));
      const p = s.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const a = Math.atan2(z, x); const f = 1 + 0.12 * Math.sin(a * 5 + k * 1.3); p.setX(i, x * f); p.setZ(i, z * f); }
      s.rotateX(Math.PI); s.rotateY(k * 0.7); s.translate(0, 0.02 + k * 0.006, 0);
      s.computeVertexNormals();
      parts.push(s.toNonIndexed());
    }
    return G.mergeGeometries(parts);
  })();
  const leafGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.03, 0.04, 0, 0.1); s.quadraticCurveTo(-0.03, 0.04, 0, 0); const lg = new THREE.ShapeGeometry(s, 6); lg.rotateX(-0.6); return lg; })();
  const n = 15;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.17;
    const h = 0.42 + rnd() * 0.22 - rr * 0.6;
    const tip = new THREE.Vector3(Math.cos(a) * rr * 1.5, h, Math.sin(a) * rr * 1.5);
    const droop = rnd() < 0.3;
    const mid = new THREE.Vector3(tip.x * 0.6, h * 0.75, tip.z * 0.6);
    const end = droop ? new THREE.Vector3(tip.x * 1.25, h - 0.08, tip.z * 1.25) : tip;
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(tip.x * 0.15, 0.3, tip.z * 0.15), mid, end]), 8, 0.004, 5), stemM));
    const pk = rnd();
    const rose = new THREE.Mesh(roseGeo, pk < 0.2 ? petal2 : pk < 0.45 ? petal3 : petal);
    rose.position.copy(end); rose.scale.setScalar(0.85 + rnd() * 0.5);
    rose.lookAt(end.clone().add(new THREE.Vector3(end.x, droop ? -0.4 : 0.35, end.z)));
    rose.rotateX(Math.PI / 2);
    g.add(rose);
    for (let j = 0; j < 2; j++) {
      const lf = new THREE.Mesh(leafGeo, leafM);
      const t = 0.4 + rnd() * 0.4;
      lf.position.lerpVectors(new THREE.Vector3(tip.x * 0.15, 0.3, tip.z * 0.15), mid, t * 1.4).setY(0.3 + (mid.y - 0.3) * t);
      lf.rotation.y = rnd() * Math.PI * 2; lf.scale.setScalar(0.8 + rnd() * 0.6);
      g.add(lf);
    }
  }
  // fallen petals on the table
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.014, 8), petal);
    const a = rnd() * Math.PI * 2, r = 0.2 + rnd() * 0.15;
    p.rotation.x = -Math.PI / 2; p.position.set(Math.cos(a) * r, 0.002, Math.sin(a) * r); p.scale.set(1, 0.7, 1);
    g.add(p);
  }
  return shadowAll(g);
}

/** carved hall chair: tall pierced shield back, solid seat, turned front legs */
export function hallChair(ctx, { wood, velvet, gilt }) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'hallChair';
  const W = 0.46, D = 0.42, SH = 0.46;
  const leg = G.latheFromProfile([[0, 0], [0.018, 0], [0.022, 0.03], [0.016, 0.07], [0.024, 0.16], [0.027, 0.24], [0.02, 0.32], [0.026, 0.36], [0.024, SH - 0.05], [0, SH - 0.05]], 12);
  for (const sx of [-1, 1]) { const m = new THREE.Mesh(leg, wood); m.position.set(sx * (W / 2 - 0.035), 0, D / 2 - 0.04); g.add(m); }
  for (const sx of [-1, 1]) {
    // raked back legs rising into the back stiles
    const pts = [new THREE.Vector3(sx * (W / 2 - 0.035), 0, -D / 2 + 0.02), new THREE.Vector3(sx * (W / 2 - 0.035), SH, -D / 2 + 0.05), new THREE.Vector3(sx * (W / 2 - 0.05), SH + 0.55, -D / 2 + 0.0)];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.02, 8), wood));
    const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.022, 0], [0.026, 0.02], [0.012, 0.05], [0, 0.06]], 10), wood); fin.position.set(sx * (W / 2 - 0.05), SH + 0.55, -D / 2); g.add(fin);
  }
  const seat = new THREE.Mesh(new G.RoundedBoxGeometry(W, 0.05, D, 2, 0.012), wood); seat.position.y = SH - 0.025; g.add(seat);
  const pad = new THREE.Mesh(new G.RoundedBoxGeometry(W - 0.06, 0.03, D - 0.07, 3, 0.012), velvet); pad.position.set(0, SH + 0.012, 0.01); g.add(pad);
  // shield back: a carved, pierced splat
  const sh = new THREE.Shape();
  sh.moveTo(-0.17, 0); sh.bezierCurveTo(-0.2, 0.18, -0.2, 0.36, -0.12, 0.46); sh.quadraticCurveTo(0, 0.53, 0.12, 0.46); sh.bezierCurveTo(0.2, 0.36, 0.2, 0.18, 0.17, 0); sh.lineTo(-0.17, 0);
  const hole = (cx, cy, rx, ry) => { const p = new THREE.Path(); p.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false); return p; };
  sh.holes.push(hole(-0.07, 0.22, 0.035, 0.12), hole(0.07, 0.22, 0.035, 0.12), hole(0, 0.4, 0.05, 0.03));
  const splat = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 20 }), 1), wood);
  splat.position.set(0, SH + 0.05, -D / 2 - 0.0); splat.rotation.x = -0.06; g.add(splat);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), gilt); boss.scale.z = 0.4; boss.position.set(0, SH + 0.3, -D / 2 + 0.03); g.add(boss);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, W - 0.07, 8), wood); str.rotation.z = Math.PI / 2; str.position.set(0, 0.14, 0.0); g.add(str);
  return shadowAll(g);
}

/** a classical marble bust on a fluted plinth (1.65 m overall) */
export function bustOnPlinth(ctx, { marble, plinthMat }) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'bust';
  const plinth = G.latheFromProfile([[0, 0], [0.22, 0], [0.22, 0.06], [0.19, 0.08], [0.18, 0.12], [0.15, 0.15], [0.14, 0.95], [0.16, 0.98], [0.19, 1.02], [0.21, 1.06], [0.21, 1.1], [0, 1.1]], 24);
  // flutes: modulate the shaft radius
  const p = plinth.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i); if (y < 0.16 || y > 0.94) continue;
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
    const f = 1 - 0.07 * Math.max(0, Math.cos(a * 12)) ** 0.5;
    p.setX(i, Math.cos(a) * r * f); p.setZ(i, Math.sin(a) * r * f);
  }
  plinth.computeVertexNormals();
  g.add(new THREE.Mesh(plinth, plinthMat));
  const base = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.09, 0], [0.09, 0.02], [0.06, 0.04], [0.045, 0.08], [0.06, 0.1], [0, 0.1]], 24), marble);
  base.position.y = 1.1; g.add(base);
  // the sitter, sculpted as an SDF and polygonised once: truncated chest and shoulders under a toga
  // whose folds sweep over the left shoulder, a muscular neck, and a Roman head (cranium, brow ridge,
  // sockets, aquiline nose, lips, chin, ears) with a cap of curls; baked cavity occlusion in vertex colour
  const yaw = 0.35, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const sdf = (x, y, z) => {
    // chest and shoulders
    let d = sdEllipsoid(x, y - 0.1, z, 0.215, 0.14, 0.11);
    d = smin(d, sdEllipsoid(x - 0.13, y - 0.17, z + 0.005, 0.085, 0.05, 0.075), 0.05);
    d = smin(d, sdEllipsoid(x + 0.13, y - 0.17, z + 0.005, 0.085, 0.05, 0.075), 0.05);
    // toga: diagonal folds from the left shoulder across the chest, deepest at the front
    const fold = Math.sin((x * 0.8 + y * 1.3) * 42) * 0.0055 * Math.max(0, Math.min(1, (z + 0.02) * 12)) * (x < 0.08 ? 1 : 0.25);
    d += fold;
    d = smax(d, -(y - 0.012), 0.004);                 // flat cut on the socle
    // neck (sterno-mastoid swell)
    d = smin(d, sdRoundCone(x, y, z, [0, 0.17, -0.005], [0, 0.3, 0.012], 0.062, 0.05), 0.03);
    // head in its own (turned) frame
    const hx = cy * x - sy * z, hz = sy * x + cy * z, hy = y;
    let h = sdEllipsoid(hx, hy - 0.4, hz + 0.008, 0.083, 0.1, 0.098);                       // cranium
    h = smin(h, sdEllipsoid(hx, hy - 0.335, hz - 0.03, 0.066, 0.075, 0.07), 0.03);          // face mass
    h = smin(h, sdEllipsoid(hx, hy - 0.29, hz - 0.058, 0.03, 0.026, 0.028), 0.02);          // chin
    h = smin(h, sdEllipsoid(hx, hy - 0.392, hz - 0.08, 0.06, 0.014, 0.02), 0.012);          // brow ridge
    h = smin(h, sdRoundCone(hx, hy, hz, [0, 0.385, 0.088], [0, 0.345, 0.11], 0.009, 0.014), 0.006); // nose
    for (const s2 of [-1, 1]) {
      h = smax(h, -sdEllipsoid(hx - s2 * 0.031, hy - 0.37, hz - 0.088, 0.017, 0.011, 0.014), 0.008);   // eye sockets
      h = smin(h, sdEllipsoid(hx - s2 * 0.03, hy - 0.368, hz - 0.08, 0.011, 0.008, 0.008), 0.004);     // eyeballs (blank, as in marble)
      h = smin(h, sdEllipsoid(hx - s2 * 0.081, hy - 0.36, hz + 0.004, 0.011, 0.028, 0.018), 0.008);   // ears
      h = smin(h, sdEllipsoid(hx - s2 * 0.035, hy - 0.335, hz - 0.075, 0.018, 0.02, 0.02), 0.012);     // cheekbones
    }
    h = smin(h, sdEllipsoid(hx, hy - 0.318, hz - 0.091, 0.02, 0.006, 0.01), 0.004);          // upper lip
    h = smin(h, sdEllipsoid(hx, hy - 0.307, hz - 0.087, 0.017, 0.0055, 0.009), 0.004);       // lower lip
    h = smax(h, -sdEllipsoid(hx, hy - 0.312, hz - 0.098, 0.016, 0.0015, 0.01), 0.002);       // mouth line
    // cap of curls over crown, temples and nape
    const hairZone = Math.max(0, Math.min(1, (hy - 0.4) * 30 + 0.5)) * (hz < 0.06 ? 1 : Math.max(0, 1 - (hz - 0.06) * 40)) + (hz < -0.02 && hy > 0.32 ? 1 : 0);
    if (hairZone > 0) {
      const c = Math.sin(hx * 150) * Math.sin(hy * 140 + hx * 30) * Math.sin(hz * 150 + hy * 20);
      h -= Math.min(1, hairZone) * (0.006 + 0.004 * c);
    }
    return smin(d, h, 0.02);
  };
  const bustGeo = sdfGeometry(sdf, { min: [-0.26, 0.0, -0.17], max: [0.26, 0.53, 0.2], step: 0.0042, ao: 0.03, aoStrength: 1.1 });
  const bm = marble.clone();
  bm.vertexColors = true;
  if (bm.isMeshPhysicalMaterial || bm.isMeshStandardMaterial) {
    bm.roughness = Math.max(0.3, bm.roughness);
    if ('sheen' in bm) { bm.sheen = 0.55; bm.sheenRoughness = 0.6; bm.sheenColor = new THREE.Color(1.0, 0.94, 0.86); }
  }
  const bust = new THREE.Mesh(bustGeo, bm); bust.position.y = 1.19; g.add(bust);
  return shadowAll(g);
}

/** blue-and-white porcelain glaze (canvas), for the umbrella jar: ruyi collar, key-fret, a dense
 *  scrolling peony field, lappet foot band; the glaze carries a fine brown craquelure */
export function porcelainMaterial(ctx) {
  const tex = ctx.textures.canvas('foyer:porcelain2', 2048, 1024, (g, w, h) => {
    let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    g.fillStyle = '#e4e6e3'; g.fillRect(0, 0, w, h);
    const blue = '#14306e', blue2 = '#3a5aa0';
    // v = 0 at the foot (canvas bottom), 1 at the lip (canvas top)
    const band = (y0, y1) => { g.fillStyle = blue; g.fillRect(0, y0, w, y1 - y0); };
    band(0, 18); band(h - 22, h);
    // ruyi-head collar under the lip
    g.fillStyle = blue;
    for (let x = 0; x < w; x += 128) { g.beginPath(); g.moveTo(x, 18); g.bezierCurveTo(x + 10, 110, x + 60, 60, x + 64, 120); g.bezierCurveTo(x + 68, 60, x + 118, 110, x + 128, 18); g.fill(); }
    g.fillStyle = '#e4e6e3';
    for (let x = 0; x < w; x += 128) { g.beginPath(); g.arc(x + 64, 70, 16, 0, Math.PI * 2); g.fill(); }
    // key-fret band
    const fy = 140; g.strokeStyle = blue; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, fy - 2); g.lineTo(w, fy - 2); g.moveTo(0, fy + 42); g.lineTo(w, fy + 42); g.stroke();
    for (let x = 0; x < w; x += 48) { g.beginPath(); g.moveTo(x + 6, fy + 36); g.lineTo(x + 6, fy + 6); g.lineTo(x + 40, fy + 6); g.lineTo(x + 40, fy + 30); g.lineTo(x + 18, fy + 30); g.lineTo(x + 18, fy + 18); g.lineTo(x + 30, fy + 18); g.stroke(); }
    // main field: two rows of large peonies on a scrolling vine, leaves washed in two blues
    const top = fy + 60, bot = h - 170;
    g.lineWidth = 7; g.strokeStyle = blue;
    for (const ph of [0, Math.PI]) {
      g.beginPath();
      for (let x = 0; x <= w; x += 4) { const y = (top + bot) / 2 + Math.sin((x / w) * Math.PI * 8 + ph) * (bot - top) * 0.3; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const x = (i + 0.5) * (w / 16), up = i % 2 === 0;
      const y = (top + bot) / 2 + (up ? -1 : 1) * (bot - top) * 0.26;
      // leaves
      for (let k = 0; k < 6; k++) {
        const a = rnd() * Math.PI * 2, r = 70 + rnd() * 30;
        g.fillStyle = k % 2 ? blue2 : blue; g.globalAlpha = 0.85;
        g.beginPath(); g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 34, 13, a, 0, Math.PI * 2); g.fill();
      }
      // peony: layered petals, dark outline, pale centre
      g.globalAlpha = 1;
      for (let ring = 3; ring >= 1; ring--) {
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 + ring * 0.3, r = ring * 18;
          g.fillStyle = ring === 1 ? blue : (ring === 2 ? blue2 : blue); g.globalAlpha = ring === 3 ? 0.9 : 0.8;
          g.beginPath(); g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, 22, 14, a, 0, Math.PI * 2); g.fill();
        }
      }
      g.globalAlpha = 1; g.fillStyle = '#e4e6e3'; g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = blue; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(x + (rnd() - 0.5) * 12, y + (rnd() - 0.5) * 12, 2.5, 0, 7); g.fill(); }
    }
    // lappet band at the foot
    const ly = h - 150;
    g.strokeStyle = blue; g.lineWidth = 5; g.beginPath(); g.moveTo(0, ly); g.lineTo(w, ly); g.stroke();
    for (let x = 0; x < w; x += 96) {
      g.fillStyle = blue; g.beginPath(); g.moveTo(x + 6, h - 24); g.lineTo(x + 6, ly + 40); g.quadraticCurveTo(x + 48, ly - 10, x + 90, ly + 40); g.lineTo(x + 90, h - 24); g.fill();
      g.fillStyle = '#e4e6e3'; g.beginPath(); g.moveTo(x + 22, h - 34); g.lineTo(x + 22, ly + 46); g.quadraticCurveTo(x + 48, ly + 16, x + 74, ly + 46); g.lineTo(x + 74, h - 34); g.fill();
      g.fillStyle = blue; g.beginPath(); g.arc(x + 48, h - 70, 12, 0, 7); g.fill();
    }
    // craquelure: a fine brown network in the glaze
    g.strokeStyle = 'rgba(90,72,48,0.22)'; g.lineWidth = 1.2;
    for (let i = 0; i < 900; i++) {
      let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 34; y += (rnd() - 0.5) * 34; g.lineTo(x, y); }
      g.stroke();
    }
  });
  return new THREE.MeshPhysicalMaterial({ map: tex, color: new THREE.Color(0.62, 0.64, 0.68), roughness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 0.9 });
}

/** small half-moon console for the upstairs gallery */
export function demiluneConsole(ctx, { wood, gilt }) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.absarc(0, 0, 0.5, 0, Math.PI, false);
  const top = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 40 }), 1), wood);
  top.rotation.x = Math.PI / 2; top.scale.set(1, 0.68, 1); top.position.y = 0.83; g.add(top);
  const apron = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 40 }), 1), wood);
  apron.rotation.x = Math.PI / 2; apron.scale.set(0.92, 0.6, 1); apron.position.y = 0.8; g.add(apron);
  for (const [x, z] of [[-0.36, 0.04], [0.36, 0.04], [-0.15, 0.27], [0.15, 0.27]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.011, 0.7, 10), wood); leg.position.set(x, 0.35, z); g.add(leg);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), gilt); c.position.set(x, 0.01, z); g.add(c);
  }
  return shadowAll(g);
}
