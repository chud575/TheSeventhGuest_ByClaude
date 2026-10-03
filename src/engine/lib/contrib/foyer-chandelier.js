import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Victorian brass-and-crystal candle chandelier (contributed by the foyer).
 *
 *   const ch = buildChandelier(ctx, { brass, crystal, tiers: [{ arms: 10, radius: 0.78, y: 0 }, { arms: 6, radius: 0.46, y: 0.42 }], chain: 1.4 });
 *   ch.group.position.set(x, ceilingY, z);   // origin = ceiling attachment, hangs down -Y
 *   ch.candles  -> fx.candle groups (flame on/off via c.userData.flame.visible)
 *   ch.lightAnchor -> Vector3 (local) good spot for the shared point light
 *
 * Geometry is merged per material (arms, cups, chain) and crystals are instanced,
 * so the whole fixture is ~10 draw calls + candles regardless of arm count.
 */
export function buildChandelier(ctx, {
  brass, crystal, gilt = brass,
  tiers = [{ arms: 10, radius: 0.78, y: 0.0 }, { arms: 6, radius: 0.46, y: 0.42 }],
  chain = 1.4, bodyHeight = 1.25, candleHeight = 0.16, lit = 1, seed = 7,
  festoons = true, drops = true, flameIntensity = null,
} = {}) {
  const { geometry: G, fx } = ctx;
  const group = new THREE.Group();
  group.name = 'chandelier';
  const brassGeos = [], giltGeos = [];
  const add = (list, g, m) => { if (m) g.applyMatrix4(m); list.push(g.index ? g.toNonIndexed() : g); };
  const M = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));

  // ---- canopy (ceiling cup)
  add(brassGeos, G.latheFromProfile([[0.0, 0], [0.2, 0], [0.2, -0.02], [0.17, -0.05], [0.12, -0.09], [0.06, -0.12], [0.03, -0.14], [0.0, -0.15]], 32));
  // ---- chain: alternating oval links
  const linkGeo = new THREE.TorusGeometry(0.03, 0.007, 6, 14);
  linkGeo.scale(1, 1.6, 1);
  const linkLen = 0.075;
  const nLinks = Math.max(1, Math.round(chain / linkLen));
  for (let i = 0; i < nLinks; i++) add(brassGeos, linkGeo.clone(), M(0, -0.15 - i * linkLen - 0.04, 0, 0, i % 2 ? Math.PI / 2 : 0, 0));
  const top = -0.15 - nLinks * linkLen; // y where the body starts (local)
  const bodyTop = top - 0.02;
  // ---- central column (turned brass stem, urn, ball, finial)
  const H = bodyHeight;
  const stem = [
    [0.0, 0], [0.035, 0], [0.04, -0.02], [0.03, -0.05], [0.05, -0.08], [0.075, -0.13], [0.08, -0.17], [0.06, -0.21], [0.03, -0.25], [0.025, -0.4],
    [0.04, -0.43], [0.025, -0.46], [0.022, -0.6], [0.05, -0.64], [0.09, -0.7], [0.12, -0.78], [0.13, -0.86], [0.12, -0.93], [0.085, -0.98],
    [0.05, -1.02], [0.06, -1.05], [0.04, -1.1], [0.025, -1.16], [0.035, -1.2], [0.012, -1.24], [0.0, -1.27],
  ].map(([r, y]) => [r, y * (H / 1.27)]);
  add(brassGeos, G.latheFromProfile(stem, 36), M(0, bodyTop, 0));
  // gilt bands
  for (const y of [-0.17, -0.86]) add(giltGeos, new THREE.TorusGeometry(y < -0.5 ? 0.13 : 0.08, 0.008, 6, 36), M(0, bodyTop + y * (H / 1.27), 0, Math.PI / 2, 0, 0));

  // ---- arms + cups + bobeches
  const candles = [];
  const tipPositions = [];
  const armY0 = bodyTop - 0.86 * (H / 1.27);           // lower tier hub height (local)
  const rnd = (i) => { const x = Math.sin(i * 91.7 + seed * 13.1) * 43758.5453; return x - Math.floor(x); };
  tiers.forEach((tier, ti) => {
    const hubY = armY0 + tier.y;
    const tierTips = [];
    for (let i = 0; i < tier.arms; i++) {
      const a = (i / tier.arms) * Math.PI * 2 + ti * (Math.PI / tier.arms);
      const c = Math.cos(a), s = Math.sin(a);
      const R = tier.radius;
      // S-scroll: out of the hub, dip, curl up into the cup
      const ctrl = [
        [0.09, 0.0], [R * 0.35, -0.07], [R * 0.7, -0.08], [R * 0.95, -0.02], [R * 1.02, 0.06], [R, 0.12],
      ];
      const curve = new THREE.CatmullRomCurve3(ctrl.map(([r, y]) => new THREE.Vector3(c * r, hubY + y, s * r)), false, 'centripetal');
      add(brassGeos, new THREE.TubeGeometry(curve, 28, 0.011, 7, false));
      // little scroll curl under each arm
      const curl = [];
      for (let k = 0; k <= 14; k++) { const t = k / 14; const rr = 0.05 * (1 - t * 0.7); const ang = t * Math.PI * 1.6; curl.push(new THREE.Vector3(c * (R * 0.45 + Math.sin(ang) * rr), hubY - 0.08 - (1 - Math.cos(ang)) * rr * 0.9, s * (R * 0.45 + Math.sin(ang) * rr))); }
      add(brassGeos, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curl), 14, 0.006, 5, false));
      // bobeche (drip pan) + cup
      const tip = new THREE.Vector3(c * R, hubY + 0.12, s * R);
      add(giltGeos, G.latheFromProfile([[0.0, 0], [0.012, 0], [0.05, 0.012], [0.058, 0.02], [0.05, 0.022], [0.012, 0.016], [0.0, 0.016]], 20), M(tip.x, tip.y, tip.z));
      add(brassGeos, G.latheFromProfile([[0.0, 0.0], [0.012, 0.0], [0.02, 0.02], [0.024, 0.045], [0.018, 0.05], [0.0, 0.05]], 16), M(tip.x, tip.y + 0.012, tip.z));
      const cdl = fx.candle({ height: candleHeight * (0.85 + 0.3 * rnd(i + ti * 31)), radius: 0.0105, light: false, lit: rnd(i * 7 + ti * 13 + 1) < lit, seed: seed * 10 + i + ti * 50, burn: rnd(i * 3 + ti) > 0.5 ? 0.55 : 0.8 });
      cdl.position.set(tip.x, tip.y + 0.055, tip.z);
      // optional: dimmer, smaller flames so bloom halos each flame instead of the whole fixture
      if (flameIntensity != null && cdl.userData.flame?.material?.uniforms?.uIntensity) cdl.userData.flame.material.uniforms.uIntensity.value = flameIntensity;
      group.add(cdl);
      candles.push(cdl);
      tierTips.push(tip);
    }
    // ring that ties the arms
    add(giltGeos, new THREE.TorusGeometry(tier.radius * 0.36, 0.009, 6, 48), M(0, hubY - 0.068, 0, Math.PI / 2, 0, 0));
    tipPositions.push(tierTips);
  });
  // drip bowl under the lower tier & pendant finial
  add(brassGeos, G.latheFromProfile([[0.0, 0.02], [0.16, 0.02], [0.17, 0.0], [0.15, -0.04], [0.1, -0.08], [0.04, -0.1], [0.0, -0.11]], 36), M(0, armY0 - 0.06, 0));

  const brassMesh = new THREE.Mesh(mergeGeometries(brassGeos), brass);
  brassMesh.name = 'chandelierBrass';
  const giltMesh = new THREE.Mesh(mergeGeometries(giltGeos), gilt);
  giltMesh.name = 'chandelierGilt';
  group.add(brassMesh, giltMesh);

  // ---- crystals (instanced): festoons between arm tips + pendalogue drops
  const crystals = [];
  if (crystal) {
    // faceted (non-indexed, flat normals) so every facet throws its own glint
    const bead = new THREE.OctahedronGeometry(0.011, 0).toNonIndexed();
    bead.scale(1, 1.25, 1); bead.computeVertexNormals();
    const drop = new THREE.IcosahedronGeometry(0.02, 0).toNonIndexed();
    drop.scale(0.7, 2.2, 0.45); drop.computeVertexNormals();
    const beadM = [], dropM = [];
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    if (festoons) {
      tipPositions.forEach((tips, ti) => {
        for (let i = 0; i < tips.length; i++) {
          const A = tips[i].clone(), B = tips[(i + 1) % tips.length].clone();
          A.y -= 0.025; B.y -= 0.025;
          const n = ti === 0 ? 16 : 11;
          const sag = ti === 0 ? 0.16 : 0.1;
          for (let k = 1; k < n; k++) {
            const t = k / n;
            const p = A.clone().lerp(B, t);
            p.y -= Math.sin(t * Math.PI) * sag;
            p.multiplyScalar(1).setX(p.x * 1.02).setZ(p.z * 1.02);
            q.setFromEuler(new THREE.Euler(0, k * 0.7, 0));
            beadM.push(new THREE.Matrix4().compose(p, q, one));
          }
          // drop at the middle of each swag
          const mid = A.clone().lerp(B, 0.5); mid.y -= sag + 0.06;
          dropM.push(new THREE.Matrix4().compose(mid, q.setFromEuler(new THREE.Euler(0, i, 0)), one));
        }
      });
    }
    if (drops) {
      tipPositions.flat().forEach((tip, i) => {
        // a short string of three beads then a pendalogue under each bobeche
        for (let k = 0; k < 3; k++) beadM.push(new THREE.Matrix4().compose(new THREE.Vector3(tip.x, tip.y - 0.03 - k * 0.026, tip.z), q.setFromEuler(new THREE.Euler(0, i, 0)), one));
        dropM.push(new THREE.Matrix4().compose(new THREE.Vector3(tip.x, tip.y - 0.13, tip.z), q.setFromEuler(new THREE.Euler(0, i * 0.5, 0)), one));
      });
      // central cascade under the bowl
      for (let r = 0; r < 3; r++) {
        const n = 10 + r * 4, rad = 0.04 + r * 0.045;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          for (let j = 0; j < 4 - r; j++) beadM.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * rad, armY0 - 0.12 - j * 0.026 - (2 - r) * 0.03, Math.sin(a) * rad), q.setFromEuler(new THREE.Euler(0, a, 0)), one));
          dropM.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * rad, armY0 - 0.2 - (4 - r) * 0.026 - (2 - r) * 0.03, Math.sin(a) * rad), q.setFromEuler(new THREE.Euler(0, a, 0)), one));
        }
      }
      // finial ball
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 1), crystal);
      ball.position.set(0, armY0 - 0.36, 0);
      group.add(ball);
      crystals.push(ball);
    }
    const mk = (geo, list, name) => {
      const im = new THREE.InstancedMesh(geo, crystal, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.name = name;
      im.castShadow = false;
      group.add(im);
      crystals.push(im);
      return im;
    };
    if (beadM.length) mk(bead, beadM, 'crystalBeads');
    if (dropM.length) mk(drop, dropM, 'crystalDrops');
  }

  group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const lightAnchor = new THREE.Vector3(0, armY0 + 0.05, 0);
  const bottom = armY0 - 0.4;
  return { group, candles, crystals, lightAnchor, bottom, top: bodyTop };
}
