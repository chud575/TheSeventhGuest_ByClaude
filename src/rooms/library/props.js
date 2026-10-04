// Library furniture & props: writing desk + oil lamp, side chair, wing chair,
// terrestrial globe, brass telescope, lectern with the Book of Hints, gas sconce,
// pictures and the rug.
import * as THREE from 'three';
import { L, V3, merge, bboxAt, mesh, lathe, extrudeOutline } from './lib.js';
import { WALLS, wallToWorld, OPEN } from './shell.js';
import { flicker } from '../../engine/fx/Flame.js';

export const SPOTS = {
  desk: { x: -1.05, z: -0.35, ry: 0 },             // long axis along z, drawers face the room (+x)
  chair: { x: -0.5, z: -0.72, ry: -Math.PI / 2 - 0.55 },   // desk chair, pulled out and turned
  wing: { x: 0.66, z: -0.5, ry: -0.55 },
  globe: { x: 0.24, z: -1.7 },
  telescope: { x: -3.2, z: 2.05 },
  lectern: { x: 0.45, z: 3.1, ry: Math.PI + 0.45 },
};

function turnedLeg(h, r = 0.022) {
  return lathe([[0.001, 0], [r * 0.7, 0], [r * 0.9, 0.02], [r * 0.75, 0.05], [r * 1.1, h * 0.2], [r * 0.7, h * 0.32], [r * 0.85, h * 0.5], [r * 0.65, h * 0.7], [r * 1.05, h * 0.82], [r * 1.0, h * 0.95], [r * 1.25, h * 0.97], [r * 1.25, h], [0.001, h]], 16);
}

/** Replace degenerate (zero) vertex normals, which turn into NaN in the shader. */
function safeNormals(geo) {
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) if (Math.abs(n.getX(i)) + Math.abs(n.getY(i)) + Math.abs(n.getZ(i)) < 1e-6) n.setXYZ(i, 0, 1, 0);
  return geo;
}

/** Book with a rounded spine, inset page block and square boards (local: spine toward -x, lying flat; y up). */
export function leatherBook(w, h, d, cover, pages, { round = 0.35 } = {}) {
  // w = width (along z), d = depth across (x), h = thickness (y)
  const g = new THREE.Group();
  const board = 0.0025;
  for (const sy of [0, 1]) {
    const b = new THREE.Mesh(bboxAt(d, board, w, 0, sy ? h - board / 2 : board / 2, 0, { r: 0.0012 }), cover);
    g.add(b);
  }
  const blk = new THREE.Mesh(bboxAt(d - 0.006, h - board * 2, w - 0.006, 0.003, h / 2, 0, { r: 0.0008 }), pages);
  g.add(blk);
  // rounded spine (half cylinder squashed)
  const sp = new THREE.CylinderGeometry(h / 2, h / 2, w, 20, 1, false, Math.PI, Math.PI);
  sp.rotateX(Math.PI / 2);
  sp.scale(round, 1, 1);
  sp.translate(-d / 2 + 0.001, h / 2, 0);
  g.add(new THREE.Mesh(sp, cover));
  // two raised bands
  for (const z of [-w * 0.22, w * 0.22]) {
    const band = new THREE.CylinderGeometry(h / 2 + 0.0012, h / 2 + 0.0012, 0.006, 20, 1, false, Math.PI, Math.PI);
    band.rotateX(Math.PI / 2); band.scale(round, 1, 1); band.translate(-d / 2 + 0.001, h / 2, z);
    g.add(new THREE.Mesh(band, cover));
  }
  return g;
}

/** An open folio: two curved page blocks rising from the gutter, a printed spread, gilt edges. Local: spine along z, y up. */
export function openFolio({ w = 0.3, d = 0.42, thick = 0.035, cover, pagesTex, edgeMat, ribbonMat, segs = 28 }) {
  const g = new THREE.Group();
  // cover boards (slightly larger than the blocks), lying open
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(bboxAt(w + 0.012, 0.005, d + 0.02, s * (w / 2 + 0.006), 0.0025, 0, { r: 0.0015 }), cover);
    g.add(b);
  }
  const prof = (t) => thick * (0.28 + 0.72 * (1 - Math.pow(1 - Math.min(1, t * 1.25), 2.4))) - thick * 0.12 * Math.max(0, t - 0.8) / 0.2;
  const pageMat = new THREE.MeshStandardMaterial({ map: pagesTex, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    // block body: extruded profile (gilt edges show on head, tail and fore-edge)
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.004);
    for (let k = 0; k <= segs; k++) { const t = k / segs; sh.lineTo(t * w, 0.004 + prof(t)); }
    sh.lineTo(w, 0.004);
    const body = new THREE.ExtrudeGeometry(sh, { depth: d - 0.008, bevelEnabled: false, curveSegments: 4 });
    body.translate(0, 0, -(d - 0.008) / 2);
    if (s < 0) body.scale(-1, 1, 1);
    if (s < 0) body.computeVertexNormals();
    const bm = new THREE.Mesh(safeNormals(body), edgeMat);
    g.add(bm);
    // printed top surface
    const top = new THREE.PlaneGeometry(w, d - 0.008, segs, 1);
    top.rotateX(-Math.PI / 2);
    const pos = top.attributes.position, uv = top.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + w / 2; const t = x / w;
      pos.setXYZ(i, s * x, 0.0045 + prof(t), pos.getZ(i));
      const u = s > 0 ? 0.5 + 0.5 * t : 0.5 - 0.5 * t;
      uv.setXY(i, u, uv.getY(i));
    }
    top.computeVertexNormals();
    if (s < 0) { const idx = top.index.array; for (let i = 0; i < idx.length; i += 3) { const tmp = idx[i]; idx[i] = idx[i + 1]; idx[i + 1] = tmp; } top.computeVertexNormals(); }
    g.add(new THREE.Mesh(safeNormals(top), pageMat));
  }
  if (ribbonMat) {
    const rb = new THREE.PlaneGeometry(0.014, d * 0.75, 1, 12);
    const pos = rb.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, Math.max(0, -y - d * 0.2) * 0.25); }
    rb.rotateX(-Math.PI / 2); rb.translate(0.004, thick * 0.3 + 0.006, d * 0.25);
    g.add(new THREE.Mesh(rb, ribbonMat));
  }
  return g;
}

export function buildProps(ctx, root, mat) {
  const G = ctx.geometry;
  const out = {};

  // ---------------------------------------------------------------- oil lamp factory (brass font, collar, chimney, frosted globe)
  // frosted glass lit from within: unlit (its own flame would blow it out), brighter through the middle band
  const frost = ctx.textures.canvas('library:frost:v1', 64, 256, (g2, w, h) => {
    const grd = g2.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#5a4a38'); grd.addColorStop(0.35, '#e8d2b0'); grd.addColorStop(0.6, '#fff0d8'); grd.addColorStop(0.85, '#c8b090'); grd.addColorStop(1, '#4a3c2c');
    g2.fillStyle = grd; g2.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g2.fillStyle = `rgba(0,0,0,${0.03 + 0.04 * ((i * 7919) % 13) / 13})`; g2.fillRect((i * 37) % w, (i * 101) % h, 2, 2); }
  }, { tile: false });
  const lampGlobeMat = (shadeColor) => new THREE.MeshBasicMaterial({
    map: frost, color: new THREE.Color(shadeColor).multiplyScalar(1.15), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
  });
  out.makeOilLamp = ({ shadeColor = 0xffb070, scale = 1, seed = 11, flameIntensity = 7 } = {}) => {
    const lamp = new THREE.Group();
    lamp.name = 'oil-lamp';
    lamp.add(new THREE.Mesh(lathe([[0.001, 0], [0.078, 0], [0.08, 0.006], [0.072, 0.016], [0.05, 0.026], [0.032, 0.04], [0.026, 0.07], [0.022, 0.11], [0.03, 0.125], [0.026, 0.135], [0.04, 0.15], [0.062, 0.17], [0.072, 0.2], [0.068, 0.225], [0.05, 0.245], [0.03, 0.255], [0.024, 0.27], [0.001, 0.27]], 64), mat.brass));
    // burner collar + gallery
    lamp.add(new THREE.Mesh(lathe([[0.001, 0.268], [0.032, 0.268], [0.036, 0.276], [0.03, 0.284], [0.036, 0.292], [0.022, 0.302], [0.001, 0.302]], 48), mat.brassBright));
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; lamp.add(new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.03, 0.006).translate(Math.cos(a) * 0.05, 0.31, Math.sin(a) * 0.05).rotateY(0), mat.brass)); }
    lamp.add(new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0025, 6, 48).rotateX(Math.PI / 2).translate(0, 0.325, 0), mat.brass));
    // glass chimney
    const chim = new THREE.Mesh(lathe([[0.017, 0.3], [0.025, 0.325], [0.027, 0.36], [0.018, 0.42], [0.016, 0.52], [0.017, 0.53]], 48), mat.glassClear);
    chim.userData.noShadow = true;
    lamp.add(chim);
    // frosted globe shade with an emissive inner glow
    const shadeProf = new THREE.SplineCurve([[0.034, 0.318], [0.05, 0.326], [0.078, 0.345], [0.098, 0.372], [0.106, 0.4], [0.101, 0.432], [0.084, 0.458], [0.06, 0.474], [0.046, 0.482], [0.042, 0.494]].map(([x, y]) => new THREE.Vector2(x, y))).getPoints(48).map((v) => [v.x, v.y]);
    const shade = new THREE.Mesh(lathe(shadeProf, 72), lampGlobeMat(shadeColor));
    shade.userData.noShadow = true;
    shade.renderOrder = 5;
    lamp.add(shade);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(shadeColor).multiplyScalar(1.2), transparent: true, opacity: 0.18, toneMapped: false, depthWrite: false }));
    core.scale.set(1, 1.4, 1); core.position.y = 0.37; core.userData.noShadow = true;
    lamp.add(core);
    const flame = ctx.fx.flame({ height: 0.04, width: 0.015, intensity: flameIntensity, seed });
    flame.position.y = 0.31;
    lamp.add(flame);
    lamp.scale.setScalar(scale);
    lamp.userData.shade = shade;
    return lamp;
  };

  // ================================================================ writing desk (pedestal, leather top)
  {
    const g = new THREE.Group();
    g.name = 'desk';
    const W = 0.8, Dz = 1.4, Hh = 0.78;
    const wood = [], brassG = [];
    // top with moulded edge + tooled leather inlay with a gilt fillet
    wood.push(bboxAt(W, 0.045, Dz, 0, Hh - 0.0225, 0, { r: 0.014 }));
    wood.push(bboxAt(W - 0.04, 0.03, Dz - 0.04, 0, Hh - 0.06, 0, { r: 0.006 }));
    const leather = mesh(bboxAt(W - 0.12, 0.003, Dz - 0.14, 0, Hh + 0.0005, 0, { r: 0.0012 }), mat.deskLeather, 'desk-leather');
    g.add(leather);
    const fillet = [];
    for (const s of [-1, 1]) {
      fillet.push(bboxAt(W - 0.14, 0.001, 0.004, 0, Hh + 0.0022, s * (Dz - 0.17) / 2, { r: 0.0004 }));
      fillet.push(bboxAt(0.004, 0.001, Dz - 0.17, s * (W - 0.15) / 2, Hh + 0.0022, 0, { r: 0.0004 }));
    }
    g.add(mesh(merge(fillet), mat.gilt, 'desk-fillet'));
    // two pedestals on turned bun feet
    for (const s of [-1, 1]) {
      const pz = s * (Dz / 2 - 0.25);
      wood.push(bboxAt(W - 0.06, Hh - 0.14, 0.46, 0, 0.08 + (Hh - 0.14) / 2, pz, { r: 0.008 }));
      wood.push(bboxAt(W - 0.02, 0.05, 0.5, 0, 0.065, pz, { r: 0.012 }));
      for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) wood.push(lathe([[0.001, 0], [0.028, 0], [0.036, 0.012], [0.034, 0.03], [0.024, 0.04], [0.001, 0.04]], 20).translate(fx * (W / 2 - 0.06), 0, pz + fz * 0.19));
      for (let k = 0; k < 3; k++) {
        const y = 0.19 + k * 0.165;
        const p = G.raisedPanel(0.4, 0.14, { border: 0.02, bevel: 0.012, frameDepth: 0.008, fieldDepth: 0.006 });
        p.rotateY(Math.PI / 2); p.translate((W - 0.06) / 2, y, pz);
        wood.push(p);
        const pull = new THREE.TorusGeometry(0.018, 0.0035, 8, 20, Math.PI);
        pull.rotateZ(Math.PI); pull.rotateY(Math.PI / 2); pull.translate((W - 0.06) / 2 + 0.018, y + 0.005, pz);
        brassG.push(pull);
        brassG.push(lathe([[0.001, 0], [0.012, 0], [0.01, 0.004], [0.001, 0.005]], 16).rotateZ(-Math.PI / 2).translate((W - 0.06) / 2 + 0.006, y + 0.005, pz));
      }
    }
    // kneehole drawer + modesty panel + turned stretcher
    wood.push(bboxAt(W - 0.08, 0.1, Dz - 1.0, 0, Hh - 0.12, 0, { r: 0.006 }));
    wood.push(bboxAt(0.02, Hh - 0.25, Dz - 0.96, -W / 2 + 0.06, (Hh - 0.25) / 2 + 0.06, 0, { r: 0.004 }));
    g.add(mesh(merge(wood), mat.mahogany, 'desk-wood'));
    g.add(mesh(merge(brassG), mat.brass, 'desk-brass'));

    // --- desk objects
    const objs = new THREE.Group();
    objs.name = 'desk-objs';
    // an open ledger (curved pages)
    {
      const bk = openFolio({ w: 0.17, d: 0.25, thick: 0.014, cover: mat.leatherBox, pagesTex: mat.ledgerTex, edgeMat: mat.pageEdge, ribbonMat: mat.ribbon, segs: 18 });
      bk.position.set(0.08, Hh + 0.002, 0.22); bk.rotation.y = Math.PI / 2 + 0.3;
      objs.add(bk);
    }
    // inkwell (cut glass + brass lid) + quill
    {
      const ink = new THREE.Mesh(lathe([[0.001, 0], [0.032, 0], [0.034, 0.008], [0.032, 0.034], [0.014, 0.046], [0.013, 0.052], [0.001, 0.052]], 8), mat.glassDark);
      ink.position.set(-0.2, Hh, -0.02);
      objs.add(ink);
      const lid = new THREE.Mesh(lathe([[0.001, 0], [0.016, 0], [0.017, 0.006], [0.012, 0.012], [0.004, 0.016], [0.001, 0.02]], 24), mat.brass);
      lid.position.set(-0.2, Hh + 0.052, -0.02); objs.add(lid);
      // quill: tapered shaft + vaned feather (bent plane)
      const qg = new THREE.Group();
      qg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0025, 0.28, 6).translate(0, 0.14, 0), mat.feather));
      const vane = new THREE.PlaneGeometry(0.03, 0.2, 2, 10);
      { const pos = vane.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), x = pos.getX(i); const t = (y + 0.1) / 0.2; const wv = Math.max(0.06, Math.sin(Math.PI * Math.min(1, t * 1.1))) * (x < 0 ? 0.9 : 0.55); pos.setX(i, x * wv); pos.setZ(i, Math.abs(x) * 0.15); } vane.computeVertexNormals(); safeNormals(vane); }
      vane.translate(0, 0.17, 0);
      qg.add(new THREE.Mesh(vane, mat.feather));
      qg.position.set(-0.2, Hh + 0.03, -0.02); qg.rotation.set(0.4, 0.5, -0.35);
      objs.add(qg);
    }
    // scattered letters (aged paper, slightly curled)
    for (let k = 0; k < 3; k++) {
      const pg = new THREE.PlaneGeometry(0.2, 0.27, 6, 6);
      { const pos = pg.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, 0.004 * Math.pow(Math.abs(x) / 0.1, 3) + 0.003 * Math.pow(Math.abs(y) / 0.135, 4) * (k % 2)); } pg.computeVertexNormals(); }
      const pp = new THREE.Mesh(pg, mat.letterPaper);
      pp.rotation.x = -Math.PI / 2; pp.rotation.z = 0.35 * k - 0.4;
      pp.position.set(0.14 - k * 0.04, Hh + 0.003 + k * 0.0012, -0.18 - k * 0.07);
      objs.add(pp);
    }
    // a stack of leather volumes with rounded spines
    {
      const bs = [[0.24, 0.05, 0.3, mat.leatherBox], [0.21, 0.04, 0.28, mat.leatherRed], [0.19, 0.055, 0.25, mat.leatherGreen], [0.16, 0.03, 0.22, mat.leatherBox]];
      let y = Hh;
      bs.forEach(([wz, h, dx, m], i) => {
        const b = leatherBook(wz, h, dx, m, mat.pageEdge);
        b.rotation.y = 0.14 * i - 0.12 + Math.PI; b.position.set(-0.2, y, -0.18);
        objs.add(b); y += h;
      });
    }
    // a three-branch brass candelabrum at the near end of the desk (warm practical in the hero view)
    {
      const cb = new THREE.Group();
      cb.name = 'candelabrum';
      cb.add(new THREE.Mesh(lathe([[0.001, 0], [0.07, 0], [0.068, 0.01], [0.04, 0.025], [0.018, 0.05], [0.014, 0.2], [0.022, 0.22], [0.016, 0.24], [0.001, 0.25]], 48), mat.brass));
      const armG = [];
      for (const s of [-1, 1]) {
        const curve = new THREE.CatmullRomCurve3([V3(0, 0.2, 0), V3(s * 0.06, 0.19, 0), V3(s * 0.11, 0.23, 0), V3(s * 0.12, 0.27, 0)]);
        armG.push(new THREE.TubeGeometry(curve, 24, 0.006, 8, false));
        armG.push(lathe([[0.001, 0], [0.02, 0], [0.022, 0.012], [0.014, 0.03], [0.001, 0.03]], 24).translate(s * 0.12, 0.265, 0));
      }
      armG.push(lathe([[0.001, 0], [0.02, 0], [0.022, 0.012], [0.014, 0.03], [0.001, 0.03]], 24).translate(0, 0.245, 0));
      cb.add(new THREE.Mesh(merge(armG), mat.brass));
      const tips = [[-0.12, 0.295, 0.13], [0, 0.275, 0.18], [0.12, 0.295, 0.1]];
      tips.forEach(([x, y, hgt], k) => {
        const c = ctx.fx.candle({ height: hgt, radius: 0.0105, light: false, seed: 60 + k, burn: 0.75 });
        const fu = c.userData.flame?.material?.uniforms?.uIntensity;
        if (fu) fu.value = 3.2;   // glow, don't blow out
        c.position.set(x, y, 0); cb.add(c);
      });
      // set back on the far side of the desk, left of the ghost, and a little lower: a practical, not the focal point
      cb.position.set(-0.24, Hh, 0.3); cb.rotation.y = 0.5; cb.scale.setScalar(0.8);
      g.add(cb);
      const pl = new THREE.PointLight(0xffa456, 1.5, 5, 2);
      pl.position.set(-0.24, Hh + 0.42, 0.3);
      g.add(pl);
      ctx.onUpdate((dt, t) => { pl.intensity = 1.5 * flicker(t * 0.7, 3.3); });
    }
    g.add(objs);

    // oil lamp (the room's warm key) at the far end of the desk
    {
      const lamp = out.makeOilLamp({ shadeColor: 0xffb070, seed: 11, flameIntensity: 4 });
      lamp.position.set(-0.1, Hh, -0.55);
      g.add(lamp);
      const pl = new THREE.PointLight(0xffa252, 3.0, 10, 2);
      pl.position.set(-0.1, Hh + 0.39, -0.55);
      pl.castShadow = ctx.quality.shadows;
      pl.shadow.mapSize.set(1024, 1024);
      pl.shadow.bias = -0.002; pl.shadow.normalBias = 0.025; pl.shadow.radius = 6;
      pl.shadow.camera.near = 0.12;
      g.add(pl);
      out.lampLight = pl;
      out.lampShade = lamp.userData.shade;
      ctx.onUpdate((dt, t) => { pl.intensity = out.lampBase * flicker(t * 0.6, 4.2); });
      out.lampBase = 3.4;
    }
    g.position.set(SPOTS.desk.x, 0, SPOTS.desk.z); g.rotation.y = SPOTS.desk.ry;
    root.add(g);
    g.traverse((o) => { if (o.isMesh && !o.userData.noShadow && !o.material?.transparent) { o.castShadow = true; o.receiveShadow = true; } });
    out.desk = g;
  }

  // ================================================================ desk chair (turned front legs, raked open back with a carved crest rail and pierced vase splat, drop-in leather seat)
  {
    const g = new THREE.Group();
    g.name = 'desk-chair';
    const wood = [], brassN = [];
    const SW = 0.48, SWb = 0.4, SD = 0.44, SH = 0.46;
    // front legs: turned, with a block at the seat rail
    for (const s of [-1, 1]) {
      wood.push(turnedLeg(SH - 0.07, 0.022).translate(s * (SW / 2 - 0.03), 0, SD / 2 - 0.03));
      wood.push(bboxAt(0.046, 0.075, 0.046, s * (SW / 2 - 0.03), SH - 0.07, SD / 2 - 0.03, { r: 0.006 }));
    }
    // back legs flow up into raked stiles (one continuous curved member each side)
    const stileTop = 0.98;
    for (const s of [-1, 1]) {
      const x0 = s * (SWb / 2 - 0.02), x1 = s * (SWb / 2 + 0.005);
      const curve = new THREE.CatmullRomCurve3([V3(x0, 0, -SD / 2 - 0.04), V3(x0, 0.2, -SD / 2 + 0.01), V3(x0, SH - 0.04, -SD / 2 + 0.03), V3(x1, 0.68, -SD / 2 - 0.0), V3(x1, stileTop - 0.04, -SD / 2 - 0.06)]);
      const tube = new THREE.TubeGeometry(curve, 48, 0.017, 10, false);
      wood.push(tube);
      wood.push(new THREE.SphereGeometry(0.018, 12, 8).translate(x1, stileTop - 0.04, -SD / 2 - 0.06));
    }
    // seat rails
    wood.push(bboxAt(SW - 0.04, 0.075, 0.024, 0, SH - 0.07, SD / 2 - 0.03, { r: 0.006 }));
    wood.push(bboxAt(SWb - 0.02, 0.075, 0.024, 0, SH - 0.07, -SD / 2 + 0.03, { r: 0.006 }));
    for (const s of [-1, 1]) {
      const side = bboxAt(0.024, 0.075, SD - 0.04, 0, 0, 0, { r: 0.006 });
      side.rotateY(s * Math.atan2((SW - SWb) / 2, SD)); side.translate(s * ((SW + SWb) / 4 - 0.03), SH - 0.07, 0);
      wood.push(side);
    }
    // turned H-stretcher
    for (const s of [-1, 1]) wood.push(lathe([[0.008, 0], [0.012, 0.08], [0.008, 0.18], [0.012, 0.3], [0.008, SD - 0.06]], 12).rotateX(Math.PI / 2).translate(s * (SW / 2 - 0.04), 0.14, -(SD - 0.06) / 2));
    wood.push(lathe([[0.007, 0], [0.011, 0.1], [0.007, 0.2], [0.011, 0.3], [0.007, SW - 0.08]], 12).rotateZ(-Math.PI / 2).translate(-(SW - 0.08) / 2, 0.14, 0.02));
    // carved crest rail: arched top with scrolled ears, bent to follow the sitter's back
    const bend = (geo, k) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + k * p.getX(i) * p.getX(i)); geo.computeVertexNormals(); return geo; };
    {
      const w = SWb / 2 + 0.03;
      const pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24, x = -w + 2 * w * t; pts.push([x, 0.05 + 0.035 * Math.cos((t - 0.5) * Math.PI) + 0.012 * Math.exp(-Math.pow((t - 0.5) / 0.06, 2))]); }
      // scrolled ears dip down
      pts.push([w + 0.012, 0.03], [w + 0.006, 0.0], [w - 0.02, -0.012]);
      for (let i = 24; i >= 0; i--) { const t = i / 24, x = -w + 2 * w * t; pts.push([x, -0.012 + 0.018 * Math.cos((t - 0.5) * Math.PI)]); }
      pts.push([-w + 0.02, -0.012], [-w - 0.006, 0.0], [-w - 0.012, 0.03]);
      const crest = extrudeOutline(pts, 0.026, { bevel: 0.006, uv: 1 });
      bend(crest, 0.9);
      crest.rotateX(-0.22);
      crest.translate(0, stileTop - 0.08, -SD / 2 - 0.055);
      wood.push(crest);
      // carved shell boss in the centre of the crest
      const shell = new THREE.SphereGeometry(0.03, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      { const p = shell.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const r = 1 + 0.12 * Math.cos(a * 9); p.setX(i, p.getX(i) * r); p.setZ(i, p.getZ(i) * r); } shell.computeVertexNormals(); }
      shell.rotateX(Math.PI / 2 - 0.22); shell.scale(1, 1, 0.5); shell.translate(0, stileTop - 0.055, -SD / 2 - 0.035);
      wood.push(shell);
    }
    // pierced vase splat + shoe rail + mid rail
    {
      const prof = (t) => 0.045 + 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.6)) * (t < 0.62 ? 1 : 0.5) - 0.02 * Math.exp(-Math.pow((t - 0.72) / 0.08, 2)) + 0.03 * Math.max(0, t - 0.82) / 0.18;
      const Hs = 0.42;
      const outline = [];
      for (let i = 0; i <= 30; i++) { const t = i / 30; outline.push([prof(t), t * Hs]); }
      for (let i = 30; i >= 0; i--) { const t = i / 30; outline.push([-prof(t), t * Hs]); }
      const sh = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
      for (const sx of [-1, 1]) {
        const hole = new THREE.Path();
        const hp = [];
        for (let i = 0; i <= 16; i++) { const t = 0.18 + 0.38 * i / 16; hp.push(new THREE.Vector2(sx * (0.012 + (prof(t) - 0.03) * 0.62 * Math.sin(Math.PI * (i / 16))), t * Hs)); }
        for (let i = 16; i >= 0; i--) { const t = 0.18 + 0.38 * i / 16; hp.push(new THREE.Vector2(sx * 0.012, t * Hs)); }
        if (sx < 0) hp.reverse();
        hole.setFromPoints(hp);
        sh.holes.push(hole);
      }
      const splat = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 8 });
      bend(splat, 0.9);
      splat.translate(0, 0, -0.006);
      splat.rotateX(-0.2);
      splat.translate(0, SH + 0.04, -SD / 2 + 0.005);
      wood.push(splat);
      wood.push(bboxAt(SWb - 0.02, 0.035, 0.03, 0, SH + 0.03, -SD / 2 + 0.03, { r: 0.008 }));
    }
    g.add(mesh(merge(wood), mat.mahogany, 'chair-wood'));
    // drop-in leather seat, stuffed and slightly sagging, close-nailed round the edge
    {
      const seatG = new G.RoundedBoxGeometry(SW - 0.01, 0.06, SD - 0.02, 6, 0.025);
      const pos = seatG.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const taper = 1 - 0.5 * ((SW - SWb) / SW) * (0.5 - z / (SD - 0.02));
        pos.setX(i, x * taper);
        if (y > 0) { const u = x / (SW / 2), v = z / (SD / 2); pos.setY(i, y + 0.022 * (1 - u * u) * (1 - v * v) - 0.008 * Math.exp(-(u * u + (v - 0.1) ** 2) * 6)); }
      }
      seatG.computeVertexNormals();
      const seat = mesh(seatG, mat.leatherRed, 'chair-seat');
      seat.position.y = SH;
      g.add(seat);
      for (let k = 0; k <= 22; k++) { const x = -SW / 2 + 0.01 + k * ((SW - 0.02) / 22); brassN.push(new THREE.SphereGeometry(0.0045, 8, 5).translate(x, SH - 0.02, SD / 2 - 0.008)); }
      for (const s of [-1, 1]) for (let k = 0; k <= 18; k++) { const t = k / 18, z = SD / 2 - 0.01 - t * (SD - 0.03); const xw = (SW / 2 - 0.004) * (1 - 0.5 * ((SW - SWb) / SW) * t); brassN.push(new THREE.SphereGeometry(0.0045, 8, 5).translate(s * xw, SH - 0.02, z)); }
      g.add(mesh(merge(brassN), mat.brass, 'chair-nails'));
    }
    g.position.set(SPOTS.chair.x, 0, SPOTS.chair.z); g.rotation.y = SPOTS.chair.ry;
    root.add(g);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    out.chair = g;
  }

  // ================================================================ wing chair (camel back, flared wings, scroll arms)
  {
    const g = new THREE.Group();
    g.name = 'wing-chair';
    const up = [];
    const puff = (geo, amt, axis = 'y') => {   // pillowy displacement of a rounded box
      geo.computeBoundingBox();
      const bb = geo.boundingBox, pos = geo.attributes.position;
      const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
      for (let i = 0; i < pos.count; i++) {
        const x = (pos.getX(i) - c.x) / (sz.x / 2), y = (pos.getY(i) - c.y) / (sz.y / 2), z = (pos.getZ(i) - c.z) / (sz.z / 2);
        if (axis === 'y' && y > 0.2) pos.setY(i, pos.getY(i) + amt * (1 - x * x) * (1 - z * z));
        if (axis === 'z' && z > 0.2) pos.setZ(i, pos.getZ(i) + amt * (1 - x * x) * (1 - Math.min(1, y * y)));
      }
      geo.computeVertexNormals();
      return geo;
    };
    // seat frame with a pleated skirt
    up.push(bboxAt(0.8, 0.24, 0.74, 0, 0.26, 0.0, { r: 0.035 }));
    const skirt = new THREE.CylinderGeometry(0.5, 0.52, 0.12, 64, 1, true);
    { const pos = skirt.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const a = Math.atan2(z, x); const r = 1 + 0.015 * Math.sin(a * 40); const sx = 0.82 / 1.0, sz = 0.76 / 1.0; pos.setX(i, Math.sign(x) * Math.min(Math.abs(x) * r * sx * 1.25, 0.41)); pos.setZ(i, Math.sign(z) * Math.min(Math.abs(z) * r * sz * 1.25, 0.385)); } skirt.computeVertexNormals(); }
    skirt.translate(0, 0.15, 0);
    up.push(skirt);
    // seat cushion (domed)
    {
      // seat cushion: domed at the edges, slumped where a century of sitters sat
      const cu = puff(new G.RoundedBoxGeometry(0.6, 0.13, 0.64, 14, 0.055), 0.03);
      const pos = cu.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (y > 0) pos.setY(i, y - 0.028 * Math.exp(-((x / 0.2) ** 2 + ((z - 0.06) / 0.2) ** 2)) + 0.006 * Math.sin(x * 30) * Math.exp(-(((z + 0.2) / 0.1) ** 2)));
      }
      cu.computeVertexNormals();
      up.push(cu.translate(0, 0.44, 0.05));
    }
    // camel back: padded, reclined, crest rising in the middle
    {
      const back = new G.RoundedBoxGeometry(0.74, 0.84, 0.18, 28, 0.07);
      const pos = back.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        let ny = y;
        if (y > 0.3) ny = y + 0.07 * Math.cos(x * 4.2) - 0.02;            // camel crest
        let nz = z + x * x * 0.35;                                         // curve around the sitter
        if (z > 0.02) {
          nz += 0.035 * (1 - (x / 0.37) ** 2) * (1 - ((y - 0.0) / 0.42) ** 2); // padded face
          // deep-buttoned (tufted) diamond pattern
          for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - (r % 2); c++) {
            const bx = -0.24 + c * 0.16 + (r % 2) * 0.08, by = -0.12 + r * 0.17;
            nz -= 0.02 * Math.exp(-((x - bx) ** 2 + (y - by) ** 2) * 700);
          }
        }
        pos.setXYZ(i, x, ny, nz);
      }
      back.computeVertexNormals();
      back.rotateX(-0.16);
      back.translate(0, 0.86, -0.3);
      up.push(back);
      // the covered buttons sitting in each tuft
      const btn = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - (r % 2); c++) {
        const bx = -0.24 + c * 0.16 + (r % 2) * 0.08, by = -0.12 + r * 0.17;
        const zf = 0.09 + 0.035 * (1 - (bx / 0.37) ** 2) * (1 - (by / 0.42) ** 2) - 0.02 + bx * bx * 0.35;
        const b = new THREE.SphereGeometry(0.011, 10, 6); b.scale(1, 1, 0.55);
        b.translate(bx, by, zf + 0.002); b.rotateX(-0.16); b.translate(0, 0.86, -0.3);
        btn.push(b);
      }
      g.add(mesh(merge(btn), mat.piping, 'wing-buttons'));
    }
    // wings: smooth side-profile outline, extruded thick with a big bevel, flared outward
    for (const sd of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(-0.06, 0.0);
      sh.lineTo(-0.1, 0.46);
      sh.bezierCurveTo(-0.08, 0.56, 0.08, 0.58, 0.16, 0.5);
      sh.bezierCurveTo(0.26, 0.4, 0.3, 0.26, 0.26, 0.12);
      sh.bezierCurveTo(0.24, 0.05, 0.2, 0.0, 0.14, 0.0);
      sh.lineTo(-0.06, 0.0);
      const w = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 5, curveSegments: 28 });
      w.translate(0, 0, -0.015);
      w.rotateY(-Math.PI / 2);          // profile now in the z/y plane, thickness along x
      w.rotateZ(-sd * 0.12);            // lean outward
      w.rotateY(sd * 0.1);              // flare forward-outward
      w.translate(sd * 0.36, 0.66, -0.2);
      up.push(w);
      // arm: padded panel + roll + scroll face
      up.push(new G.RoundedBoxGeometry(0.1, 0.3, 0.7, 4, 0.04).translate(sd * 0.37, 0.48, 0.03));
      const roll = new THREE.CylinderGeometry(0.068, 0.068, 0.7, 28, 1);
      roll.rotateX(Math.PI / 2); roll.translate(sd * 0.39, 0.64, 0.03);
      up.push(roll);
      const scroll = new THREE.SphereGeometry(0.075, 24, 16);
      scroll.scale(1, 1, 0.45); scroll.translate(sd * 0.39, 0.64, 0.38);
      up.push(scroll);
      const face = new G.RoundedBoxGeometry(0.12, 0.3, 0.06, 3, 0.025);
      face.translate(sd * 0.385, 0.48, 0.37);
      up.push(face);
    }
    // slight lumpy sag over the whole upholstery (old horsehair stuffing)
    const upG = merge(up);
    {
      const pos = upG.attributes.position, nor = upG.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const n = Math.sin(x * 23.1 + y * 7.3) * Math.sin(z * 19.7 - y * 11.1) * 0.5 + Math.sin(x * 51 + z * 43 + y * 37) * 0.25;
        const k = 0.0035 * n;
        pos.setXYZ(i, x + nor.getX(i) * k, y + nor.getY(i) * k, z + nor.getZ(i) * k);
      }
      upG.computeVertexNormals();
    }
    g.add(mesh(upG, mat.tapestry, 'wing-upholstery'));
    // piping (self-welt cord) along every seam: wing outlines, arm scroll faces, seat cushion edges, back crest
    {
      const pipe = [];
      const tubeAlong = (pts, r = 0.0065, closed = false) => pipe.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), Math.max(16, pts.length * 4), r, 6, closed));
      for (const sd of [-1, 1]) {
        // wing outline (same shape and transforms as the wing)
        const sh = new THREE.Shape();
        sh.moveTo(-0.1, 0.46);
        sh.bezierCurveTo(-0.08, 0.56, 0.08, 0.58, 0.16, 0.5);
        sh.bezierCurveTo(0.26, 0.4, 0.3, 0.26, 0.26, 0.12);
        const m4 = new THREE.Matrix4().makeTranslation(sd * 0.36, 0.66, -0.2)
          .multiply(new THREE.Matrix4().makeRotationY(sd * 0.1))
          .multiply(new THREE.Matrix4().makeRotationZ(-sd * 0.12))
          .multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
        for (const zf of [-0.046, 0.046]) {
          const pts = sh.getPoints(20).map((p2) => new THREE.Vector3(p2.x, p2.y, zf).applyMatrix4(m4));
          tubeAlong(pts, 0.006);
        }
        // scroll face ring + the seam running back along the top of the arm roll
        const ring = [];
        for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2; ring.push(V3(sd * 0.39 + Math.cos(a) * 0.072, 0.64 + Math.sin(a) * 0.072, 0.39)); }
        tubeAlong(ring, 0.006, true);
        for (const ox of [-0.05, 0.05]) tubeAlong([V3(sd * 0.39 + ox, 0.64 + 0.05, 0.38), V3(sd * 0.39 + ox, 0.64 + 0.052, 0.03), V3(sd * 0.39 + ox, 0.64 + 0.05, -0.31)], 0.0055);
      }
      // seat cushion: top and bottom perimeter welts
      for (const yy of [0.44 + 0.07, 0.44 - 0.06]) {
        const w2 = 0.3, d2 = 0.32, rr = 0.05, pts = [];
        for (let k = 0; k < 4; k++) {
          const cx = (k === 0 || k === 3 ? 1 : -1) * (w2 - rr), cz = (k < 2 ? 1 : -1) * (d2 - rr);
          for (let j = 0; j <= 4; j++) { const a = (k * Math.PI) / 2 + (j / 4) * (Math.PI / 2); pts.push(V3(cx + Math.cos(a) * rr, yy, 0.05 + cz + Math.sin(a) * rr)); }
        }
        tubeAlong(pts, 0.0055, true);
      }
      g.add(mesh(merge(pipe), mat.piping, 'wing-piping'));
    }
    // cabriole front legs, plain splayed back legs
    const legs = [];
    for (const [x, z, front] of [[-0.34, -0.3, 0], [0.34, -0.3, 0], [-0.35, 0.32, 1], [0.35, 0.32, 1]]) {
      const pts = front ? [[0.001, 0.02], [0.022, 0.03], [0.018, 0.05], [0.02, 0.08], [0.032, 0.11], [0.042, 0.13], [0.001, 0.13]] : [[0.001, 0], [0.022, 0], [0.026, 0.06], [0.032, 0.13], [0.001, 0.13]];
      if (front) {
        legs.push(new THREE.SphereGeometry(0.024, 16, 12).translate(x, 0.024, z + 0.01));
        for (let k = 0; k < 3; k++) { const a = -0.9 + k * 0.9; legs.push(new THREE.CapsuleGeometry(0.007, 0.03, 4, 8).rotateX(Math.PI / 2 - 0.6).rotateY(a).translate(x + Math.sin(a) * 0.016, 0.03, z + 0.01 + Math.cos(a) * 0.016)); }
      }
      const l = lathe(pts, 14);
      if (front) l.rotateX(0.12);
      l.translate(x, 0, z);
      legs.push(l);
    }
    g.add(mesh(merge(legs), mat.mahogany, 'wing-legs'));
    // brass nail-head trim along the arm fronts
    const nails = [];
    for (const sd of [-1, 1]) for (let k = 0; k < 16; k++) { const a = (k / 15) * Math.PI * 1.6 - Math.PI * 0.3; nails.push(new THREE.SphereGeometry(0.0045, 6, 4).translate(sd * 0.39 + Math.cos(a) * 0.07 * sd * 0, 0.64 + Math.sin(a) * 0.072, 0.405 + Math.cos(a) * 0.0)); }
    g.add(mesh(merge(nails), mat.brass, 'wing-nails'));
    g.position.set(SPOTS.wing.x, 0, SPOTS.wing.z); g.rotation.y = SPOTS.wing.ry;
    root.add(g);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    out.wing = g;
  }

  // ================================================================ terrestrial globe on a turned floor stand
  {
    const g = new THREE.Group();
    g.name = 'globe';
    const R = 0.25, cy = 0.82;
    const stand = [];
    // tripod cabriole legs (stout, square-section with chamfers) ending in turned pad feet, tied by a turned stretcher
    const legProf = [[-0.026, -0.03], [0.022, -0.03], [0.026, -0.024], [0.026, 0.024], [0.022, 0.03], [-0.022, 0.03], [-0.026, 0.024], [-0.026, -0.03]].map(([x, y]) => new THREE.Vector2(x, y));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.3;
      const leg = G.sweepProfile(legProf, [V3(0.035, 0.38, 0), V3(0.11, 0.31, 0), V3(0.19, 0.17, 0), V3(0.24, 0.07, 0), V3(0.29, 0.035, 0)], { uvScale: 1 });
      leg.rotateY(-a);
      stand.push(leg);
      stand.push(lathe([[0.001, 0], [0.032, 0], [0.036, 0.01], [0.028, 0.022], [0.02, 0.032], [0.001, 0.034]], 20).translate(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3));
      // turned stretcher from each leg to a central boss
      const st = lathe([[0.008, 0], [0.012, 0.03], [0.009, 0.07], [0.013, 0.1], [0.008, 0.17]], 12);
      st.rotateZ(-Math.PI / 2); st.translate(0.02, 0.14, 0); st.rotateY(-a);
      stand.push(st);
    }
    stand.push(lathe([[0.001, 0.12], [0.035, 0.12], [0.04, 0.14], [0.035, 0.16], [0.001, 0.16]], 20));
    stand.push(lathe([[0.001, 0.03], [0.012, 0.04], [0.02, 0.1], [0.015, 0.14], [0.001, 0.15]], 12));
    // stout turned pillar (vase + ring turnings) up to the horizon ring supports
    stand.push(lathe([[0.001, 0.3], [0.07, 0.3], [0.078, 0.32], [0.07, 0.34], [0.05, 0.36], [0.058, 0.4], [0.064, 0.44], [0.05, 0.48], [0.036, 0.5], [0.05, 0.515], [0.04, 0.53], [0.032, 0.56], [0.001, 0.56]], 32));
    // horizon ring supports (four quadrant arms)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const arm = G.sweepProfile([new THREE.Vector2(-0.013, -0.015), new THREE.Vector2(0.013, -0.015), new THREE.Vector2(0.013, 0.015), new THREE.Vector2(-0.013, 0.015), new THREE.Vector2(-0.013, -0.015)],
        [V3(0.02, 0.55, 0), V3(0.15, 0.6, 0), V3(0.26, 0.7, 0), V3(R + 0.06, cy - 0.01, 0)], { uvScale: 1 });
      arm.rotateY(-a);
      stand.push(arm);
    }
    g.add(mesh(merge(stand), mat.caseWood, 'globe-stand'));
    // horizon ring (flat wooden annulus with a printed calendar band)
    const ring = new THREE.Mesh(new THREE.RingGeometry(R + 0.012, R + 0.075, 96, 1), mat.horizonRing);
    ring.rotation.x = -Math.PI / 2; ring.position.y = cy;
    g.add(ring);
    const ringEdge = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.075, R + 0.075, 0.018, 96, 1, true), mat.caseWood);
    ringEdge.position.y = cy - 0.009;
    g.add(ringEdge);
    // tilted axis assembly: brass meridian + sphere
    const tilt = new THREE.Group();
    tilt.position.y = cy;
    tilt.rotation.z = THREE.MathUtils.degToRad(23.5);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), mat.globe);
    sphere.rotation.y = 2.2;
    sphere.name = 'globe-sphere';
    tilt.add(sphere);
    // engraved brass meridian: a flat band graduated in degrees
    {
      const tick = ctx.textures.canvas('library:meridian:v1', 1024, 1024, (c2, w, h) => {
        c2.fillStyle = '#b08a48'; c2.fillRect(0, 0, w, h);
        const cx = w / 2, cy2 = h / 2, r0 = (R + 0.004) / (R + 0.032) * w / 2, r1 = w / 2;
        c2.strokeStyle = 'rgba(40,24,8,0.9)';
        for (let d = 0; d < 360; d++) {
          const a = (d / 180) * Math.PI, long = d % 10 === 0, mid = d % 5 === 0;
          const ra = r1 - (long ? 0.55 : mid ? 0.38 : 0.25) * (r1 - r0);
          c2.lineWidth = long ? 2.2 : 1.2;
          c2.beginPath(); c2.moveTo(cx + Math.cos(a) * ra, cy2 + Math.sin(a) * ra); c2.lineTo(cx + Math.cos(a) * (r1 - 2), cy2 + Math.sin(a) * (r1 - 2)); c2.stroke();
        }
        c2.lineWidth = 1.5; c2.beginPath(); c2.arc(cx, cy2, r1 - 0.6 * (r1 - r0), 0, Math.PI * 2); c2.stroke();
        for (let i = 0; i < 400; i++) { c2.fillStyle = `rgba(30,40,20,${0.03 + 0.05 * ((i * 7919) % 11) / 11})`; c2.beginPath(); c2.arc((i * 377) % w, (i * 911) % h, 6 + (i % 7) * 4, 0, 7); c2.fill(); }
      }, { tile: false });
      const merMat = new THREE.MeshStandardMaterial({ map: tick, metalness: 1, roughness: 0.38, side: THREE.DoubleSide, color: 0xffffff });
      for (const zz of [-0.0035, 0.0035]) {
        const band = new THREE.Mesh(new THREE.RingGeometry(R + 0.004, R + 0.032, 128, 1), merMat);
        band.position.z = zz; tilt.add(band);
      }
      for (const rr of [R + 0.004, R + 0.032]) {
        const edge = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.007, 128, 1, true), mat.brass);
        edge.rotation.x = Math.PI / 2; tilt.add(edge);
      }
    }
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, (R + 0.04) * 2, 8), mat.brass);
    tilt.add(pin);
    g.add(tilt);
    // meridian cradle under the sphere
    const cradle = new THREE.Mesh(lathe([[0.001, 0], [0.04, 0], [0.03, 0.03], [0.015, 0.05], [0.001, 0.05]], 16), mat.brass);
    cradle.position.y = cy - R - 0.07;
    g.add(cradle);
    g.position.set(SPOTS.globe.x, 0, SPOTS.globe.z);
    g.rotation.y = -0.4;
    g.scale.setScalar(1.3);
    root.add(g);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    out.globe = g; out.globeSphere = sphere;
  }

  // ================================================================ brass telescope on a wooden tripod (bay window)
  {
    const g = new THREE.Group();
    g.name = 'telescope';
    const head = V3(0, 1.32, 0);
    const legs = [], ferrules = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      const foot = V3(Math.cos(a) * 0.48, 0, Math.sin(a) * 0.48);
      const dir = head.clone().sub(foot);
      const len = dir.length();
      const leg = new THREE.CylinderGeometry(0.016, 0.022, len, 10);
      leg.translate(0, len / 2, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir.normalize());
      leg.applyQuaternion(q); leg.translate(foot.x, 0, foot.z);
      legs.push(leg);
      // brass shoe, a mid-leg clamp collar and a top ferrule
      const shoe = new THREE.CylinderGeometry(0.024, 0.017, 0.06, 16);
      shoe.applyQuaternion(q); shoe.translate(foot.x, 0.03, foot.z);
      ferrules.push(shoe);
      for (const [t, r, h] of [[0.47, 0.024, 0.035], [0.93, 0.02, 0.05]]) {
        const c = new THREE.CylinderGeometry(r, r, h, 16);
        c.applyQuaternion(q);
        const pp = foot.clone().lerp(head, t);
        c.translate(pp.x, pp.y, pp.z);
        ferrules.push(c);
      }
    }
    // spreader ring (brass)
    ferrules.push(new THREE.TorusGeometry(0.17, 0.007, 8, 32).rotateX(Math.PI / 2).translate(0, 0.62, 0));
    g.add(mesh(merge(legs), mat.walnut || mat.mahogany, 'tripod'));
    g.add(mesh(merge(ferrules), mat.brass, 'tripod-brass'));
    const mount = new THREE.Mesh(lathe([[0.001, 0], [0.06, 0], [0.05, 0.03], [0.03, 0.06], [0.028, 0.1], [0.001, 0.1]], 24), mat.brass);
    mount.position.copy(head).add(V3(0, -0.03, 0));
    g.add(mount);
    // the tube assembly: aimed in update by the room
    const tube = new THREE.Group();
    tube.name = 'telescope-tube';
    tube.position.copy(head).add(V3(0, 0.1, 0));
    const tubeGeo = [];
    // main tube along -z (objective at -z), eyepiece at +z
    const segs = [[0.052, 0.052, 0.62, -0.18], [0.044, 0.044, 0.34, 0.28], [0.034, 0.034, 0.22, 0.52]];
    for (const [r0, r1, len, zc] of segs) { const c = new THREE.CylinderGeometry(r0, r1, len, 40, 1, true); c.rotateX(Math.PI / 2); c.translate(0, 0, zc); tubeGeo.push(c); }
    // rings / collars
    for (const [r, z] of [[0.06, -0.49], [0.058, -0.4], [0.056, 0.11], [0.048, 0.11], [0.05, 0.45], [0.04, 0.41], [0.04, 0.63]]) {
      const ring = new THREE.CylinderGeometry(r, r, 0.025, 40); ring.rotateX(Math.PI / 2); ring.translate(0, 0, z); tubeGeo.push(ring);
    }
    // dew cap + objective
    const dew = new THREE.CylinderGeometry(0.066, 0.06, 0.16, 40, 1, true); dew.rotateX(Math.PI / 2); dew.translate(0, 0, -0.57); tubeGeo.push(dew);
    const eye = lathe([[0.001, 0], [0.02, 0], [0.022, 0.02], [0.016, 0.05], [0.018, 0.08], [0.001, 0.08]], 20); eye.rotateX(Math.PI / 2); eye.translate(0, 0, 0.64); tubeGeo.push(eye);
    // focusing knob
    tubeGeo.push(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 16).rotateZ(Math.PI / 2).translate(0, -0.04, 0.42));
    // knurled draw-tube rings at each step + engraved bands
    for (const [r, z] of [[0.046, 0.12], [0.046, 0.135], [0.036, 0.4], [0.036, 0.415], [0.054, -0.3], [0.054, -0.32], [0.054, -0.34]]) {
      const rg = new THREE.TorusGeometry(r, 0.0025, 6, 48); rg.translate(0, 0, z); tubeGeo.push(rg);
    }
    // finder scope on two brackets
    {
      const f = new THREE.CylinderGeometry(0.013, 0.013, 0.24, 24, 1, false); f.rotateX(Math.PI / 2); f.translate(0, 0.085, -0.1); tubeGeo.push(f);
      const fo = new THREE.CylinderGeometry(0.016, 0.016, 0.03, 24); fo.rotateX(Math.PI / 2); fo.translate(0, 0.085, -0.21); tubeGeo.push(fo);
      const fe = new THREE.CylinderGeometry(0.009, 0.011, 0.04, 16); fe.rotateX(Math.PI / 2); fe.translate(0, 0.085, 0.04); tubeGeo.push(fe);
      for (const z of [-0.18, -0.02]) { tubeGeo.push(new THREE.BoxGeometry(0.008, 0.035, 0.012).translate(0, 0.064, z)); const ring = new THREE.TorusGeometry(0.016, 0.003, 6, 24); ring.translate(0, 0.085, z); tubeGeo.push(ring); }
    }
    const tubeMesh = mesh(merge(tubeGeo), mat.brassBright, 'telescope-brass');
    tubeMesh.material.side = THREE.DoubleSide;
    tube.add(tubeMesh);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 32), mat.lens);
    lens.position.z = -0.49; lens.rotation.y = Math.PI;
    tube.add(lens);
    // leather grip
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0545, 0.0545, 0.2, 48, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.18), mat.leatherBox);
    tube.add(grip);
    g.add(tube);
    g.position.set(SPOTS.telescope.x, 0, SPOTS.telescope.z);
    root.add(g);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    out.telescope = g; out.telescopeTube = tube;
    // eyepiece world position helper
    out.telescopeEye = () => tube.localToWorld(V3(0, 0, 0.72));
  }

  // ================================================================ lectern with the Book of Hints (front-right corner)
  {
    const g = new THREE.Group();
    g.name = 'lectern';
    const wood = [];
    wood.push(lathe([[0.001, 0], [0.2, 0], [0.2, 0.04], [0.16, 0.06], [0.07, 0.1], [0.05, 0.2], [0.07, 0.3], [0.045, 0.45], [0.06, 0.7], [0.045, 0.85], [0.08, 0.95], [0.001, 0.97]], 24));
    const desk = bboxAt(0.56, 0.035, 0.42, 0, 0, 0, { r: 0.01 });
    desk.rotateX(0.42); desk.translate(0, 1.04, 0);
    wood.push(desk);
    const lip = bboxAt(0.56, 0.04, 0.03, 0, 0, 0, { r: 0.008 });
    lip.rotateX(0.42); lip.translate(0, 0.96, 0.2);
    wood.push(lip);
    g.add(mesh(merge(wood), mat.mahogany, 'lectern-wood'));
    // the Book of Hints: huge, open, its pages faintly luminous
    const book = new THREE.Group();
    book.name = 'book-of-hints';
    const folio = openFolio({ w: 0.3, d: 0.42, thick: 0.05, cover: mat.leatherRed, pagesTex: mat.hintTex, edgeMat: mat.giltEdge, ribbonMat: mat.ribbon, segs: 32 });
    folio.position.y = -0.012;
    book.add(folio);
    // brass corner bosses on the boards
    for (const [x, z] of [[-0.6, -0.21], [0.6, -0.21], [-0.6, 0.21], [0.6, 0.21]]) book.add(new THREE.Mesh(lathe([[0.001, 0], [0.018, 0], [0.016, 0.004], [0.008, 0.008], [0.001, 0.009]], 20).translate(x * 0.5, -0.011, z), mat.brass));
    book.rotation.x = 0.42; book.position.set(0, 1.08, 0);
    g.add(book);
    g.position.set(SPOTS.lectern.x, 0, SPOTS.lectern.z); g.rotation.y = SPOTS.lectern.ry;
    root.add(g);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    out.lectern = g; out.hintBook = book;
    // a candle on a tall pricket stand beside the lectern
    const stand = new THREE.Group();
    // a tall turned-brass pricket stand (catches the flame along its knops, so the candle never floats)
    stand.add(new THREE.Mesh(lathe([[0.001, 0], [0.15, 0], [0.15, 0.012], [0.13, 0.03], [0.07, 0.05], [0.045, 0.07], [0.05, 0.09], [0.03, 0.12], [0.024, 0.3], [0.042, 0.34], [0.046, 0.37], [0.03, 0.4], [0.022, 0.62], [0.038, 0.66], [0.022, 0.7], [0.019, 0.95], [0.032, 1.0], [0.026, 1.06], [0.04, 1.1], [0.078, 1.135], [0.07, 1.16], [0.001, 1.16]], 32), mat.brass));
    const candle = ctx.fx.candle({ height: 0.28, radius: 0.016, lightIntensity: 0.9, lightDistance: 5, seed: 23, burn: 0.8 });
    candle.position.y = 1.16;
    stand.add(candle);
    stand.position.copy(new THREE.Vector3(0.95, 0, 0).applyAxisAngle(V3(0, 1, 0), SPOTS.lectern.ry).add(V3(SPOTS.lectern.x, 0, SPOTS.lectern.z)));
    root.add(stand);
    out.pricket = stand;
  }

  // ================================================================ gas sconce beside the right-hand door
  {
    const o = OPEN.rightDoor;
    const sc = new THREE.Group();
    sc.add(new THREE.Mesh(lathe([[0.001, 0], [0.06, 0], [0.055, 0.015], [0.02, 0.03], [0.001, 0.035]], 24).rotateX(Math.PI / 2), mat.brass));
    const arm = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.009, 8, 24, Math.PI / 2).rotateY(Math.PI / 2).translate(0, -0.12, 0.0), mat.brass);
    sc.add(arm);
    sc.add(new THREE.Mesh(lathe([[0.001, 0], [0.03, 0], [0.035, 0.02], [0.02, 0.035], [0.001, 0.04]], 16).translate(0, 0, 0.12), mat.brass));
    sc.add(new THREE.Mesh(lathe([[0.012, 0.0], [0.026, 0.0], [0.028, 0.012], [0.022, 0.024], [0.012, 0.026]], 48).translate(0, 0.0, 0.12), mat.brassBright));
    const tulip = new THREE.Mesh(lathe([[0.02, 0.02], [0.034, 0.03], [0.05, 0.05], [0.064, 0.085], [0.066, 0.11], [0.06, 0.14], [0.052, 0.152], [0.056, 0.16]], 64).translate(0, 0.0, 0.12), lampGlobeMat(0xff9a50));
    tulip.userData.noShadow = true;
    sc.add(tulip);
    const sCore = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9a50).multiplyScalar(2.0), transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }));
    sCore.scale.set(1, 1.5, 1); sCore.position.set(0, 0.075, 0.12); sc.add(sCore);
    const fl = ctx.fx.flame({ height: 0.04, width: 0.014, intensity: 6, seed: 31 });
    fl.position.set(0, 0.06, 0.12);
    sc.add(fl);
    sc.position.copy(wallToWorld('right', o.x + o.w + 0.36, 1.78, 0.06));
    sc.rotation.y = WALLS.right.ry;
    root.add(sc);
    const pl = new THREE.PointLight(0xff9a50, 2.2, 8, 2);
    pl.position.copy(wallToWorld('right', o.x + o.w + 0.36, 1.9, 0.25));
    root.add(pl);
    ctx.onUpdate((dt, t) => { pl.intensity = out.sconceBase * flicker(t * 0.5, 9.1); });
    out.sconceBase = 2.2;
    out.sconceLight = pl;
  }

  // ================================================================ pictures
  {
    const hang = (wall, x, y, w, h, subject, seed, frameW = 0.085) => {
      const g = new THREE.Group();
      const pm = subject === 'vanitas' ? mat.vanitas : ctx.materials.create('painting', { subject, seed, aspect: w / h, size: 1024, varnish: 0.35, cracks: 0.6, roughness: 0.85, clearcoat: 0.12, clearcoatRoughness: 0.55 });
      // matte, aged oil (the generator's glossy varnish turned every canvas into a mirror for the sconces)
      const cm = subject === 'vanitas' ? pm : new THREE.MeshStandardMaterial({ map: pm.map, normalMap: pm.normalMap || null, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.88, metalness: 0, envMapIntensity: 0.25, color: 0xe8e0d0 });
      const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cm);
      // pictures hang forward-tilted from a cord (top away from the wall), so lamp glare drops out of the eye line
      const tilt = new THREE.Group();
      tilt.rotation.x = 0.07;
      tilt.add(canvas);
      g.add(tilt);
      const fr = new THREE.Mesh(G.frameGeometry(w, h, { width: frameW, depth: 0.05, uvScale: 1 }), mat.frameGilt);
      tilt.add(fr);
      tilt.position.z = Math.sin(0.07) * h / 2;
      g.position.copy(wallToWorld(wall, x, y, 0.07)); g.rotation.y = WALLS[wall].ry;
      g.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      root.add(g);
      return g;
    };
    out.pictures = [
      hang('right', 3.35, 1.72, 0.72, 0.52, 0, 21),
      hang('right', 5.6, 1.8, 0.5, 0.66, 1, 33, 0.07),
      hang('back', 5.05, 1.7, 0.6, 0.46, 2, 12, 0.07),
      hang('front', 0.95, 1.75, 0.72, 0.52, 'vanitas', 44, 0.08),
    ];
  }

  // ================================================================ rug (faded Persian)
  {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.4), ctx.materials.create('rug', { palette: 'heriz', colors: { field: [0.36, 0.06, 0.045], border: [0.16, 0.05, 0.035], ivory: [0.55, 0.45, 0.31], gold: [0.56, 0.37, 0.13], teal: [0.07, 0.12, 0.11], dark: [0.04, 0.03, 0.03], rose: [0.48, 0.16, 0.1] }, aspect: 2.3 / 3.4, knots: 220, wear: 0.5, fringe: 0.04, seed: 7, size: 1536, color: [1.15, 0.92, 0.82] }));
    rug.rotation.x = -Math.PI / 2; rug.rotation.z = 0.04;
    rug.position.set(-1.7, 0.005, -2.3);
    rug.receiveShadow = true;
    root.add(rug);
    out.rug = rug;
  }
  return out;
}
