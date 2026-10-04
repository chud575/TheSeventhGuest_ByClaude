import * as THREE from 'three';

/**
 * Game-room dressing for the front (door) wall and floor: a mahogany billiard
 * scoreboard with brass slide pointers, framed sporting prints, a two-tier
 * drinks trolley, a brass spittoon and a hat stand. All modelled here; wall
 * pieces face +Z with their back at z = 0.
 */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

/** Billiard scoreboard: carved pediment, ebonised number panel (two players, 0..60), brass rods with sliding pointers, chalk ledge. */
export function buildScoreboard(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'scoreboard';
  const W = 0.78, H = 0.64;
  const panelTex = ctx.textures.canvas('gameroom:scorepanel', 1024, 840, (c, w, h) => {
    c.fillStyle = '#0d0b0a'; c.fillRect(0, 0, w, h);
    // faint chalk haze
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(200,200,190,${0.012 + (i % 7) * 0.002})`; c.beginPath(); c.ellipse((i * 137) % w, (i * 251) % h, 60 + (i % 5) * 30, 20 + (i % 3) * 14, i, 0, 7); c.fill(); }
    c.strokeStyle = '#b89a5a'; c.lineWidth = 6; c.strokeRect(24, 24, w - 48, h - 48);
    c.lineWidth = 2; c.strokeRect(40, 40, w - 80, h - 80);
    c.fillStyle = '#d8c69c'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'italic 54px "IM Fell English", Georgia, serif';
    c.fillText('Billiards', w / 2, 100);
    c.font = '28px "IM Fell English SC", Georgia, serif';
    for (const [k, y] of [[0, 300], [1, 560]]) {
      c.fillText(k ? 'Second Player' : 'First Player', w / 2, y - 80);
      for (let i = 0; i <= 12; i++) {
        const x = 90 + i * ((w - 180) / 12);
        c.fillText(String(i * 5), x, y + 52);
        c.fillRect(x - 1, y - 24, 2, i % 2 ? 22 : 34);
      }
    }
  }, { tile: false });
  const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.7, name: 'scorePanel' });
  // case
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(W + 0.1, H + 0.1, 0.05, 2, 0.008), mats.wood), 0, 0, 0.025));
  g.add(at(new THREE.Mesh(G.frameGeometry(W, H, { width: 0.045, depth: 0.03, uvScale: 2 }), mats.wood), 0, 0, 0.05));
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(W, H), panelMat), 0, 0, 0.051));
  // brass rods + pointers
  for (const [k, y] of [[0, 0.06], [1, -0.25]]) {
    const ry = y * (H / 0.64);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, W - 0.08, 8).rotateZ(Math.PI / 2), mats.brass); rod.position.set(0, ry, 0.068); g.add(rod);
    for (const sx of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 10).rotateX(Math.PI / 2), mats.brass), sx * (W / 2 - 0.04), ry, 0.06));
    const px = -W / 2 + 0.085 + (k ? 0.42 : 0.66) * (W - 0.17);
    const ptr = new THREE.Group();
    ptr.add(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.026, 12).rotateZ(Math.PI / 2), mats.brass));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.03, 4), mats.brass); tip.position.y = -0.022; tip.rotation.x = Math.PI; ptr.add(tip);
    ptr.position.set(px, ry, 0.069); g.add(ptr);
  }
  // pediment with a turned finial, chalk ledge with chalk cubes
  const ped = new THREE.Shape(); ped.moveTo(-W / 2 - 0.06, 0); ped.lineTo(W / 2 + 0.06, 0); ped.lineTo(W / 2 + 0.03, 0.04); ped.quadraticCurveTo(0.15, 0.06, 0, 0.13); ped.quadraticCurveTo(-0.15, 0.06, -W / 2 - 0.03, 0.04); ped.lineTo(-W / 2 - 0.06, 0);
  const pe = new THREE.ExtrudeGeometry(ped, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 12 });
  g.add(at(new THREE.Mesh(G.applyBoxUVs(pe, 2), mats.wood), 0, H / 2 + 0.05, 0.008));
  g.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.018, 0], [0.024, 0.02], [0.012, 0.04], [0.016, 0.055], [0, 0.075]], 12), mats.gilt), 0, H / 2 + 0.19, 0.03));
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(W + 0.14, 0.03, 0.09, 2, 0.008), mats.wood), 0, -H / 2 - 0.065, 0.045));
  for (const x of [-0.25, 0.28]) g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.022, 0.022, 0.022, 1, 0.003), mats.chalk), x, -H / 2 - 0.039, 0.06));
  return g;
}

/** A framed sporting print: cream mount, ebonised frame with a gilt slip. */
export function buildPrint(ctx, mats, { w = 0.42, h = 0.54, seed = 3, subject = 0 } = {}) {
  const { geometry: G, materials: M } = ctx;
  const g = new THREE.Group();
  const iw = w - 0.12, ih = h - 0.12;
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w - 0.02, h - 0.02), mats.mount), 0, 0, 0.004));
  // a sepia line engraving (hunt / stag / billiards) on cream laid paper inside a bevelled cream mat
  const et = mats.engraving ? mats.engraving(subject, iw / ih) : null;
  const pm = et ? new THREE.MeshStandardMaterial({ map: et.map, normalMap: et.normalMap, roughness: 0.85, name: 'engraving' }) : M.create('painting', { subject, seed, aspect: iw / ih, size: 512, varnish: 0.2, cracks: 0.1, color: [0.85, 0.78, 0.66] });
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), pm), 0, 0, 0.006));
  // mat bevel: a thin pale core round the window
  g.add(at(new THREE.Mesh(G.frameGeometry(iw + 0.008, ih + 0.008, { width: 0.004, depth: 0.003, uvScale: 2 }), mats.mountCore || mats.mount), 0, 0, 0.004));
  g.add(at(new THREE.Mesh(G.frameGeometry(w, h, { width: 0.035, depth: 0.025, uvScale: 2 }), mats.ebony), 0, 0, 0.0));
  g.add(at(new THREE.Mesh(G.frameGeometry(w - 0.06, h - 0.06, { width: 0.008, depth: 0.008, uvScale: 2 }), mats.gilt), 0, 0, 0.006));
  // glass
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), mats.glass), 0, 0, 0.02));
  return g;
}

/** Two-tier mahogany drinks trolley on brass castors with decanters, a soda siphon and glasses. Origin on the floor. */
export function buildDrinksCart(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'drinksCart';
  const W = 0.7, D = 0.42;
  for (const y of [0.22, 0.68]) {
    g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(W, 0.025, D, 2, 0.006), mats.wood), 0, y, 0));
    // gallery rail
    for (const sz of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, W - 0.04, 8).rotateZ(Math.PI / 2), mats.brass), 0, y + 0.05, sz * (D / 2 - 0.015)));
    for (const sx of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, D - 0.04, 8).rotateX(Math.PI / 2), mats.brass), sx * (W / 2 - 0.015), y + 0.05, 0));
  }
  const legG = G.latheFromProfile([[0, 0], [0.016, 0], [0.012, 0.05], [0.014, 0.25], [0.018, 0.3], [0.013, 0.35], [0.013, 0.7], [0.018, 0.74], [0, 0.76]], 12);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(at(new THREE.Mesh(legG, mats.wood), sx * (W / 2 - 0.02), 0.035, sz * (D / 2 - 0.02)));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 14).rotateX(Math.PI / 2), mats.brass), sx * (W / 2 - 0.02), 0.022, sz * (D / 2 - 0.02)));
  }
  // handle
  const hcurve = new THREE.CatmullRomCurve3([V3(-W / 2 - 0.01, 0.7, -D / 2 + 0.03), V3(-W / 2 - 0.08, 0.78, -D / 4), V3(-W / 2 - 0.08, 0.78, D / 4), V3(-W / 2 - 0.01, 0.7, D / 2 - 0.03)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(hcurve, 24, 0.008, 8), mats.brass));
  // decanters (square cut-glass) with spirits, stoppers
  const liq = [0x5a2a08, 0x7a4a14, 0x3a0a0a];
  for (let i = 0; i < 3; i++) {
    const x = -0.2 + i * 0.13;
    const d = new THREE.Mesh(new G.RoundedBoxGeometry(0.085, 0.18, 0.085, 2, 0.01), mats.crystal); d.position.set(x, 0.7 + 0.09, -0.06); g.add(d);
    const l = new THREE.Mesh(new G.RoundedBoxGeometry(0.078, 0.11 - i * 0.025, 0.078, 2, 0.008), new THREE.MeshPhysicalMaterial({ color: liq[i], roughness: 0.05, clearcoat: 1, name: 'spirit' })); l.position.set(x, 0.705 + (0.11 - i * 0.025) / 2, -0.06); g.add(l);
    g.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.016, 0], [0.016, 0.02], [0.024, 0.03], [0.02, 0.05], [0, 0.06]], 8), mats.crystal), x, 0.88, -0.06));
  }
  // tumblers and a soda siphon
  const tum = G.latheFromProfile([[0, 0], [0.03, 0], [0.032, 0.004], [0.034, 0.085], [0.031, 0.085], [0.029, 0.01], [0, 0.01]], 10);
  for (const [x, z] of [[0.17, 0.08], [0.24, 0.02], [0.2, -0.08]]) g.add(at(new THREE.Mesh(tum, mats.crystal), x, 0.693, z));
  g.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.045, 0], [0.048, 0.02], [0.048, 0.22], [0.03, 0.25], [0.012, 0.26], [0, 0.26]], 18), mats.siphon), 0.05, 0.23, 0.05));
  g.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.02, 0], [0.022, 0.03], [0.015, 0.07], [0, 0.08]], 12), mats.silver), 0.05, 0.49, 0.05));
  // an ice bucket below
  g.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.07, 0], [0.085, 0.16], [0.09, 0.17], [0.0, 0.17]], 20), mats.silver), -0.18, 0.233, 0.02));
  return g;
}

export function buildSpittoon(ctx, mats) {
  const { geometry: G } = ctx;
  return new THREE.Mesh(G.latheFromProfile([[0, 0], [0.11, 0], [0.13, 0.03], [0.14, 0.07], [0.12, 0.11], [0.06, 0.13], [0.05, 0.14], [0.09, 0.16], [0.1, 0.17], [0.045, 0.165], [0.04, 0.12], [0, 0.11]], 28), mats.brass);
}

/** Bentwood-style hat stand with a bowler hat and a walking cane. */
export function buildHatStand(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'hatStand';
  g.add(new THREE.Mesh(G.latheFromProfile([[0, 1.85], [0.02, 1.85], [0.03, 1.82], [0.02, 1.78], [0.018, 1.2], [0.022, 0.6], [0.026, 0.2], [0.03, 0.1], [0, 0.1]], 14), mats.wood));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const leg = new THREE.CatmullRomCurve3([V3(0, 0.3, 0), V3(Math.cos(a) * 0.12, 0.12, Math.sin(a) * 0.12), V3(Math.cos(a) * 0.26, 0.01, Math.sin(a) * 0.26)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(leg, 16, 0.014, 8), mats.wood));
    const hook = new THREE.CatmullRomCurve3([V3(0, 1.62, 0), V3(Math.cos(a) * 0.1, 1.68, Math.sin(a) * 0.1), V3(Math.cos(a) * 0.16, 1.78, Math.sin(a) * 0.16), V3(Math.cos(a) * 0.15, 1.83, Math.sin(a) * 0.15)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(hook, 16, 0.011, 8), mats.wood));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), mats.brass), Math.cos(a) * 0.15, 1.835, Math.sin(a) * 0.15));
  }
  // bowler hat hung on one hook
  const hat = new THREE.Group();
  hat.add(new THREE.Mesh(G.latheFromProfile([[0, 0.12], [0.05, 0.118], [0.08, 0.1], [0.092, 0.06], [0.094, 0.01], [0.13, 0.0], [0.145, 0.012], [0.14, 0.006], [0.0, 0.002]].reverse(), 28), mats.felt));
  hat.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.0945, 0.0945, 0.02, 28, 1, true), mats.ribbon), 0, 0.02, 0));
  hat.rotation.set(0.5, 0, 0.3); hat.position.set(Math.cos(0.3) * 0.16, 1.72, Math.sin(0.3) * 0.16 + 0.04);
  g.add(hat);
  // cane leaning against the post
  const cane = new THREE.Group();
  cane.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.008, 0.88, 8), mats.ebony), 0, 0.44, 0));
  cane.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), mats.silver), 0, 0.89, 0));
  cane.rotation.z = 0.12; cane.position.set(0.15, 0, 0.12);
  g.add(cane);
  return g;
}
