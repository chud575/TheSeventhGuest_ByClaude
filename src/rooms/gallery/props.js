import * as THREE from 'three';
import { clockFace } from './textures.js';
import { RAIL_Y } from './layout.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Gas sconce, authored facing +Z with the backplate at the origin. Returns { group, lightPos (local), shade }. */
export function makeSconce(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'sconce';
  const plate = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.055, 0], [0.058, 0.006], [0.05, 0.014], [0.035, 0.02], [0.02, 0.03], [0, 0.034]], 28), mat.brass);
  plate.rotation.x = Math.PI / 2; plate.scale.set(1, 1, 1.7); g.add(plate);
  // swan-neck arm
  const curve = new THREE.CatmullRomCurve3([V3(0, -0.02, 0.025), V3(0, -0.07, 0.09), V3(0, -0.05, 0.17), V3(0, 0.02, 0.21), V3(0, 0.07, 0.215)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.0085, 10), mat.brass));
  // decorative scroll under the arm
  const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 8, 20, Math.PI * 1.5), mat.brass);
  scroll.position.set(0, -0.1, 0.07); scroll.rotation.y = Math.PI / 2; g.add(scroll);
  const drop = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0.01], [0.016, 0.03], [0.008, 0.05], [0, 0.06]], 16), mat.brass);
  drop.position.set(0, -0.19, 0.02); g.add(drop);
  // gas cock + gallery (shade holder)
  const tap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.006, 0.006), mat.brass); tap.position.set(0, 0.0, 0.2); g.add(tap);
  const gal = new THREE.Mesh(G.latheFromProfile([[0.008, 0], [0.022, 0.004], [0.034, 0.016], [0.036, 0.024], [0.03, 0.026], [0.01, 0.012]], 24), mat.brass);
  gal.position.set(0, 0.075, 0.215); g.add(gal);
  // etched tulip shade (frosted, lit from inside)
  const shade = new THREE.Mesh(G.latheFromProfile([[0.026, 0], [0.034, 0.012], [0.05, 0.04], [0.06, 0.075], [0.062, 0.1], [0.058, 0.118], [0.064, 0.126], [0.056, 0.128]], 32), mat.shade);
  shade.position.set(0, 0.095, 0.215);
  shade.name = 'shade';
  shade.userData.noShadow = true;
  g.add(shade);
  const flame = ctx.fx.flame({ height: 0.045, width: 0.016, intensity: 7 });
  flame.position.set(0, 0.105, 0.215);
  g.add(flame);
  return { group: g, lightPos: V3(0, 0.15, 0.215), shade, flame };
}

/** Picture frame + canvas hung from the picture rail on two cords. Facing +Z, origin = canvas centre. */
export function makeFramed(ctx, mat, canvasMat, w, h, { frameW = 0.12, cords = true, centreY = 1.85 } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'framed';
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat);
  canvas.position.z = 0.012;
  canvas.name = 'canvas';
  g.add(canvas);
  const frame = new THREE.Mesh(G.frameGeometry(w, h, { width: frameW, depth: 0.075, uvScale: 1 }), mat.giltFrame);
  frame.position.z = -0.01;
  g.add(frame);
  // inner sight slip
  const slip = new THREE.Mesh(G.frameGeometry(w - 0.01, h - 0.01, { width: 0.018, depth: 0.02, uvScale: 4 }), mat.giltPlain);
  slip.position.z = 0.008; g.add(slip);
  // back board shadow-catcher
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + frameW * 2 - 0.02, h + frameW * 2 - 0.02, 0.02), mat.black);
  back.position.z = -0.02; g.add(back);
  if (cords) {
    const topY = h / 2 + frameW;
    const railRel = RAIL_Y - centreY;
    for (const s of [-1, 1]) {
      const a = V3(s * (w / 2 - 0.05), topY - 0.04, -0.015), b = V3(s * 0.04, railRel, -0.07);
      const len = a.distanceTo(b);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, len, 5), mat.cord);
      cord.position.copy(a).add(b).multiplyScalar(0.5);
      cord.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(cord);
    }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 12, Math.PI), mat.brass);
    hook.position.set(0, railRel, -0.07); hook.rotation.z = Math.PI; g.add(hook);
  }
  return { group: g, canvas, frame };
}

/** Tall-case clock, facing +Z, origin at floor against the wall. */
export function makeClock(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'clock';
  const rb = (w, h, d, x, y, z, m = mat.mahogany, r = 0.008) => { const b = new THREE.Mesh(new G.RoundedBoxGeometry(w, h, d, 2, r), m); b.position.set(x, y, z); g.add(b); return b; };
  rb(0.58, 0.1, 0.34, 0, 0.05, 0.17);              // plinth
  rb(0.54, 0.42, 0.3, 0, 0.31, 0.15);              // base
  const bp = new THREE.Mesh(G.raisedPanel(0.4, 0.3, { border: 0.04, bevel: 0.02 }), mat.mahogany); bp.position.set(0, 0.31, 0.3); g.add(bp);
  rb(0.56, 0.05, 0.32, 0, 0.545, 0.16);
  rb(0.42, 1.12, 0.24, 0, 1.13, 0.12);             // trunk
  // trunk door with a glazed lenticle showing the pendulum
  const td = new THREE.Mesh(G.raisedPanel(0.3, 0.95, { border: 0.04, bevel: 0.02 }), mat.mahogany); td.position.set(0, 1.12, 0.24); g.add(td);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.06, 32), mat.brassBright); lens.position.set(0, 1.0, 0.262); g.add(lens);
  const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.008, 8, 32), mat.brass); lensRing.position.set(0, 1.0, 0.262); g.add(lensRing);
  rb(0.5, 0.05, 0.3, 0, 1.71, 0.15);
  // hood
  rb(0.52, 0.62, 0.3, 0, 2.05, 0.15);
  for (const s of [-1, 1]) {
    const col = new THREE.Mesh(G.latheFromProfile([[0.022, 0], [0.022, 0.03], [0.016, 0.05], [0.016, 0.5], [0.022, 0.53], [0.022, 0.56], [0, 0.56]], 16), mat.brass);
    col.position.set(s * 0.22, 1.76, 0.31); g.add(col);
  }
  // arched dial
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.17, 48), new THREE.MeshStandardMaterial({ map: clockFace(ctx), roughness: 0.45, metalness: 0.0, name: 'clockDial' }));
  dial.position.set(0, 2.02, 0.302); g.add(dial);
  const bez = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.012, 10, 48), mat.brass); bez.position.set(0, 2.02, 0.305); g.add(bez);
  // spandrel gilt corners
  for (const [x, y] of [[-0.18, 1.82], [0.18, 1.82]]) { const sp = new THREE.Mesh(new THREE.CircleGeometry(0.04, 3), mat.giltCap); sp.position.set(x, y, 0.302); g.add(sp); }
  // broken-arch pediment + finials
  const ped = new THREE.Shape();
  ped.moveTo(-0.3, 0); ped.lineTo(0.3, 0); ped.lineTo(0.3, 0.12); ped.quadraticCurveTo(0.2, 0.2, 0.06, 0.24); ped.lineTo(0.06, 0.16); ped.lineTo(-0.06, 0.16); ped.lineTo(-0.06, 0.24); ped.quadraticCurveTo(-0.2, 0.2, -0.3, 0.12); ped.lineTo(-0.3, 0);
  const pg = new THREE.ExtrudeGeometry(ped, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 12 });
  const pm = new THREE.Mesh(G.applyBoxUVs(pg, 1), mat.mahogany); pm.position.set(0, 2.36, 0.0); g.add(pm);
  for (const x of [-0.24, 0, 0.24]) {
    const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.032, 0.02], [0.018, 0.04], [0.028, 0.07], [0.012, 0.11], [0.004, 0.14], [0, 0.15]], 16), mat.brass);
    fin.position.set(x, x === 0 ? 2.58 : 2.5, 0.16); g.add(fin);
  }
  return g;
}

/** Demilune console with a pair of candlesticks. Facing +Z, origin at the wall/floor. Returns { group, candles }. */
export function makeConsole(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'console';
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.035, 48, 1, false, -Math.PI / 2, Math.PI), mat.marble);
  top.position.set(0, 0.84, 0.0); g.add(top);
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.11, 48, 1, true, -Math.PI / 2, Math.PI), mat.mahogany);
  apron.position.set(0, 0.765, 0); apron.material = mat.mahogany; g.add(apron);
  const apronGilt = new THREE.Mesh(new THREE.CylinderGeometry(0.465, 0.465, 0.025, 48, 1, true, -Math.PI / 2, Math.PI), mat.giltCap);
  apronGilt.position.set(0, 0.79, 0); g.add(apronGilt);
  for (const a of [-1.2, -0.4, 0.4, 1.2]) {
    const leg = new THREE.Mesh(G.latheFromProfile([[0.008, 0], [0.014, 0.02], [0.012, 0.06], [0.018, 0.3], [0.024, 0.55], [0.02, 0.66], [0.03, 0.7], [0.0, 0.71]], 12), mat.mahogany);
    leg.position.set(Math.sin(a) * 0.42, 0, Math.cos(a) * 0.42 * 0.98); g.add(leg);
  }
  const stretcher = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.01, 6, 32, Math.PI), mat.mahogany);
  stretcher.rotation.x = -Math.PI / 2; stretcher.rotation.z = -Math.PI / 2; stretcher.position.y = 0.18; g.add(stretcher);
  const candles = [];
  for (const s of [-1, 1]) {
    const stick = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.055, 0], [0.05, 0.012], [0.02, 0.03], [0.014, 0.08], [0.024, 0.1], [0.012, 0.16], [0.012, 0.22], [0.024, 0.235], [0.018, 0.25], [0, 0.25]], 24), mat.brass);
    stick.position.set(s * 0.28, 0.857, 0.16); g.add(stick);
    const c = ctx.fx.candle({ height: 0.17 - (s > 0 ? 0.05 : 0), radius: 0.011, light: false, seed: 20 + s, burn: 0.8 });
    c.position.set(s * 0.28, 0.857 + 0.245, 0.16); g.add(c);
    candles.push(c);
  }
  // a blue-and-white jar with dried roses
  const jar = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.085, 0.06], [0.09, 0.12], [0.07, 0.2], [0.04, 0.23], [0.045, 0.25], [0.0, 0.25]], 32), mat.porcelainBlue);
  jar.position.set(0, 0.857, 0.12); g.add(jar);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, r = 0.03 + (i % 3) * 0.015;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.003, 0.32, 4), mat.stem);
    stem.position.set(Math.cos(a) * r, 1.22, 0.12 + Math.sin(a) * r); stem.rotation.set(Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25); g.add(stem);
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 1), mat.rose);
    bloom.position.set(Math.cos(a) * r * 2.4, 1.37 + (i % 2) * 0.03, 0.12 + Math.sin(a) * r * 2.4); g.add(bloom);
  }
  return { group: g, candles };
}

/** Upholstered hall bench, facing +Z, origin at the wall/floor. */
export function makeBench(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'bench';
  const seat = new THREE.Mesh(new G.RoundedBoxGeometry(1.3, 0.12, 0.44, 4, 0.04), mat.velvetSeat);
  seat.position.set(0, 0.5, 0.3); g.add(seat);
  const rail = new THREE.Mesh(new G.RoundedBoxGeometry(1.34, 0.08, 0.46, 2, 0.012), mat.mahogany);
  rail.position.set(0, 0.42, 0.3); g.add(rail);
  for (const [x, z] of [[-0.6, 0.12], [0.6, 0.12], [-0.6, 0.48], [0.6, 0.48]]) {
    const leg = new THREE.Mesh(G.latheFromProfile([[0.024, 0], [0.018, 0.04], [0.026, 0.1], [0.02, 0.18], [0.03, 0.26], [0.022, 0.34], [0.03, 0.38], [0, 0.38]], 14), mat.mahogany);
    leg.position.set(x, 0, z); g.add(leg);
  }
  // buttons
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), mat.velvetSeat);
    b.position.set(-0.5 + i * 0.2, 0.562, 0.3 + (i % 2 ? 0.08 : -0.08)); g.add(b);
  }
  return g;
}

/** Brass plaque with an engraved title (canvas texture). Facing +Z. */
export function makePlaque(ctx, mat, text, w = 0.3, h = 0.07) {
  const tex = ctx.textures.canvas(`gallery:plaque:${text}`, 512, Math.round(512 * h / w), (g, cw, ch) => {
    const grd = g.createLinearGradient(0, 0, cw, ch);
    grd.addColorStop(0, '#8a6a2c'); grd.addColorStop(0.5, '#c9a45a'); grd.addColorStop(1, '#7a5a22');
    g.fillStyle = grd; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = '#3a2a10'; g.lineWidth = 4; g.strokeRect(8, 8, cw - 16, ch - 16);
    g.fillStyle = '#2a1c08'; g.font = `italic ${Math.round(ch * 0.42)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, cw / 2, ch / 2 + 2);
  }, { tile: false });
  const m = new THREE.Mesh(new ctx.geometry.RoundedBoxGeometry(w, h, 0.006, 2, 0.002), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.85, roughness: 0.35, name: 'plaque' }));
  return m;
}

/** Hanging hexagonal gas lantern on a chain. Origin at the ceiling. Returns { group, glass, lightPos }. */
export function makeLantern(ctx, mat, drop = 0.95) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'lantern';
  const canopy = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.07, 0], [0.065, -0.015], [0.03, -0.04], [0.012, -0.06], [0, -0.065]], 24), mat.brass);
  g.add(canopy);
  // chain of alternating links
  const linkGeo = new THREE.TorusGeometry(0.012, 0.0028, 6, 12);
  const n = Math.floor((drop - 0.45) / 0.02);
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(linkGeo, mat.brass);
    l.position.y = -0.07 - i * 0.02; l.rotation.y = (i % 2) * Math.PI / 2; l.scale.set(1, 1.5, 1);
    g.add(l);
  }
  const y0 = -drop;                         // bottom of the lantern
  const body = new THREE.Group();
  body.position.y = y0;
  g.add(body);
  const hh = 0.34, r = 0.13;
  // crown, roof, smoke bell
  body.add(new THREE.Mesh(G.latheFromProfile([[0, hh + 0.13], [0.012, hh + 0.12], [0.02, hh + 0.09], [0.05, hh + 0.07], [0.1, hh + 0.04], [r + 0.025, hh + 0.01], [r + 0.025, hh - 0.005], [0, hh - 0.005]], 6), mat.brass));
  body.add(new THREE.Mesh(G.latheFromProfile([[0, -0.07], [0.02, -0.065], [0.05, -0.04], [r + 0.02, -0.01], [r + 0.02, 0.01], [0, 0.01]], 6), mat.brass));
  const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.018, 0.0], [0.012, -0.03], [0.004, -0.06], [0, -0.07]], 12), mat.brass); fin.position.y = -0.07; body.add(fin);
  // six corner posts + glass panes
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.97, r * 0.97, hh - 0.01, 6, 1, true), mat.lanternGlass);
  glass.position.y = hh / 2; glass.rotation.y = Math.PI / 6; glass.name = 'lanternGlass'; glass.userData.noShadow = true;
  body.add(glass);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, hh, 6), mat.brass);
    post.position.set(Math.cos(a) * r, hh / 2, Math.sin(a) * r); body.add(post);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.005, 6, 6), mat.brass); ring.rotation.x = Math.PI / 2; ring.position.y = hh * 0.55; body.add(ring);
  // gas mantle burner inside
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.08, 8), mat.brass); burner.position.y = 0.05; body.add(burner);
  const flame = ctx.fx.flame({ height: 0.07, width: 0.025, intensity: 8 });
  flame.position.y = 0.1; body.add(flame);
  return { group: g, glass, lightPos: new THREE.Vector3(0, y0 + 0.16, 0), flame };
}
