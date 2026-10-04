import * as THREE from 'three';

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
  const petal = new THREE.MeshPhysicalMaterial({ color: 0x3a0610, roughness: 0.72, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.5, 0.12, 0.15) });
  const petal2 = new THREE.MeshPhysicalMaterial({ color: 0x5a3a2a, roughness: 0.85 });   // a few have browned
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
    const rose = new THREE.Mesh(roseGeo, rnd() < 0.2 ? petal2 : petal);
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
  // chest + shoulders: a squashed, truncated ellipsoid with a toga drape fold across it
  const chest = new THREE.SphereGeometry(0.2, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62);
  chest.scale(1.05, 0.95, 0.55);
  const cp = chest.attributes.position;
  for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i); cp.setY(i, y + 0.012 * Math.sin(x * 40 + y * 18) * (z > 0 ? 1 : 0)); }
  chest.computeVertexNormals();
  const ch = new THREE.Mesh(chest, marble); ch.position.y = 1.16; ch.scale.y = 1.1; g.add(ch);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.13, 20), marble); neck.position.set(0, 1.42, 0.0); g.add(neck);
  // head: an egg with a brow ridge, nose and chin, curls on the crown
  const head = new THREE.SphereGeometry(0.09, 36, 28);
  const hp = head.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
    const nz = z / 0.09;
    y *= 1.22; z *= 1.08;
    if (y < 0) { x *= 1 - 0.18 * (-y / 0.11); z *= 1 - 0.1 * (-y / 0.11); }
    if (nz > 0.6) {
      const f = (nz - 0.6) / 0.4;
      z += 0.022 * f * Math.exp(-((x / 0.014) ** 2) - (((y + 0.005) / 0.03) ** 2));        // nose
      z += 0.01 * f * Math.exp(-(((y - 0.035) / 0.012) ** 2)) * (1 - Math.abs(x) / 0.09);   // brow
      z += 0.008 * f * Math.exp(-(((y + 0.085) / 0.02) ** 2) - ((x / 0.03) ** 2));        // chin
      z -= 0.008 * f * Math.exp(-(((y - 0.012) / 0.012) ** 2) - (((Math.abs(x) - 0.03) / 0.015) ** 2));   // eye sockets
    }
    if (y > 0.03 || z < -0.02) { const c = 0.006 * Math.sin(x * 160) * Math.sin(y * 150) * Math.sin(z * 140); x *= 1.04 + c * 4; z *= 1.02 + c * 4; y += y > 0 ? 0.006 + c : 0; }  // curls
    hp.setXYZ(i, x, y, z);
  }
  head.computeVertexNormals();
  const hd = new THREE.Mesh(head, marble); hd.position.set(0, 1.56, 0.01); hd.rotation.y = 0.35; hd.rotation.x = 0.06; g.add(hd);
  return shadowAll(g);
}

/** blue-and-white porcelain glaze (canvas), for the umbrella jar */
export function porcelainMaterial(ctx) {
  const tex = ctx.textures.canvas('foyer:porcelain', 1024, 512, (g, w, h) => {
    g.fillStyle = '#d8dde2'; g.fillRect(0, 0, w, h);
    const blue = '#1e3a7a';
    g.strokeStyle = blue; g.fillStyle = blue;
    // bands top and bottom
    g.fillRect(0, 0, w, 26); g.fillRect(0, h - 30, w, 30);
    g.lineWidth = 3;
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.arc(x + 16, 26, 14, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(x + 16, h - 30, 14, Math.PI, 0); g.stroke(); }
    // scrolling peony and leaf
    let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    g.lineWidth = 5;
    g.beginPath();
    for (let x = 0; x <= w; x += 4) { const y = h * 0.5 + Math.sin((x / w) * Math.PI * 6) * h * 0.18; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
    for (let i = 0; i < 6; i++) {
      const x = (i + 0.25) * (w / 6), y = h * 0.5 + Math.sin(((x) / w) * Math.PI * 6) * h * 0.18;
      for (let k = 0; k < 9; k++) { g.globalAlpha = 0.7; g.beginPath(); const a = (k / 9) * Math.PI * 2; g.ellipse(x + Math.cos(a) * 22, y + Math.sin(a) * 22, 20, 11, a, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1; g.fillStyle = '#d8dde2'; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = blue;
      for (let k = 0; k < 4; k++) { g.globalAlpha = 0.8; g.beginPath(); g.ellipse(x + 50 + rnd() * 30, y + (rnd() - 0.5) * 70, 18, 7, rnd() * 3, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }
    // crackle
    g.strokeStyle = 'rgba(80,70,50,0.18)'; g.lineWidth = 1;
    for (let i = 0; i < 300; i++) { const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 30); g.stroke(); }
  });
  return new THREE.MeshPhysicalMaterial({ map: tex, color: new THREE.Color(0.7, 0.7, 0.72), roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.8 });
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
