// Library furniture & props: writing desk + oil lamp, side chair, wing chair,
// terrestrial globe, brass telescope, lectern with the Book of Hints, gas sconce,
// pictures and the rug.
import * as THREE from 'three';
import { L, V3, merge, bboxAt, mesh, lathe, extrudeOutline } from './lib.js';
import { WALLS, wallToWorld, OPEN } from './shell.js';
import { flicker } from '../../engine/fx/Flame.js';

export const SPOTS = {
  desk: { x: -1.95, z: -0.55, ry: 0 },            // long axis along z
  chair: { x: -1.05, z: -0.75, ry: -1.75 },
  wing: { x: 0.55, z: -0.2, ry: -1.95 },
  globe: { x: 0.36, z: -1.55 },
  telescope: { x: -3.2, z: 2.05 },
  lectern: { x: 0.45, z: 3.1, ry: Math.PI + 0.45 },
};

function turnedLeg(h, r = 0.022) {
  return lathe([[0.001, 0], [r * 0.7, 0], [r * 0.9, 0.02], [r * 0.75, 0.05], [r * 1.1, h * 0.2], [r * 0.7, h * 0.32], [r * 0.85, h * 0.5], [r * 0.65, h * 0.7], [r * 1.05, h * 0.82], [r * 1.0, h * 0.95], [r * 1.25, h * 0.97], [r * 1.25, h], [0.001, h]], 16);
}

export function buildProps(ctx, root, mat) {
  const G = ctx.geometry;
  const out = {};

  // ================================================================ writing desk (pedestal, leather top)
  {
    const g = new THREE.Group();
    g.name = 'desk';
    const W = 0.8, Dz = 1.55, Hh = 0.78;
    const wood = [], brassG = [];
    // top with moulded edge + leather inlay
    wood.push(bboxAt(W, 0.045, Dz, 0, Hh - 0.0225, 0, { r: 0.012 }));
    wood.push(bboxAt(W - 0.04, 0.03, Dz - 0.04, 0, Hh - 0.06, 0, { r: 0.006 }));
    const leather = mesh(bboxAt(W - 0.14, 0.004, Dz - 0.16, 0, Hh + 0.001, 0, { r: 0.0015 }), mat.deskLeather, 'desk-leather');
    g.add(leather);
    // two pedestals
    for (const s of [-1, 1]) {
      const pz = s * (Dz / 2 - 0.25);
      wood.push(bboxAt(W - 0.06, Hh - 0.12, 0.46, 0, 0.06 + (Hh - 0.12) / 2, pz, { r: 0.008 }));
      wood.push(bboxAt(W - 0.02, 0.07, 0.5, 0, 0.035, pz, { r: 0.01 }));
      // drawers on the room-facing side (+x)
      for (let k = 0; k < 3; k++) {
        const y = 0.17 + k * 0.17;
        const p = G.raisedPanel(0.4, 0.14, { border: 0.02, bevel: 0.012, frameDepth: 0.008, fieldDepth: 0.006 });
        p.rotateY(Math.PI / 2); p.translate((W - 0.06) / 2, y, pz);
        wood.push(p);
        const pull = new THREE.TorusGeometry(0.018, 0.0035, 8, 14, Math.PI);
        pull.rotateZ(Math.PI); pull.rotateY(Math.PI / 2); pull.translate((W - 0.06) / 2 + 0.018, y + 0.005, pz);
        brassG.push(pull);
        brassG.push(new THREE.SphereGeometry(0.006, 8, 6).translate((W - 0.06) / 2 + 0.012, y + 0.005, pz - 0.018));
        brassG.push(new THREE.SphereGeometry(0.006, 8, 6).translate((W - 0.06) / 2 + 0.012, y + 0.005, pz + 0.018));
      }
    }
    // kneehole drawer + modesty panel
    wood.push(bboxAt(W - 0.08, 0.1, Dz - 1.0, 0, Hh - 0.12, 0, { r: 0.006 }));
    wood.push(bboxAt(0.02, Hh - 0.25, Dz - 0.96, -W / 2 + 0.06, (Hh - 0.25) / 2 + 0.06, 0, { r: 0.004 }));
    g.add(mesh(merge(wood), mat.mahogany, 'desk-wood'));
    g.add(mesh(merge(brassG), mat.brass, 'desk-brass'));

    // --- desk objects
    const objs = new THREE.Group();
    // open book
    {
      const bk = new THREE.Group();
      for (const s of [-1, 1]) {
        const pages = new THREE.Mesh(bboxAt(0.16, 0.018, 0.23, s * 0.085, 0.009, 0, { r: 0.004 }), mat.paper);
        pages.rotation.z = -s * 0.06;
        bk.add(pages);
      }
      bk.add(new THREE.Mesh(bboxAt(0.35, 0.006, 0.245, 0, 0.0, 0, { r: 0.002 }), mat.leatherBox));
      bk.position.set(0.05, Hh + 0.005, 0.25); bk.rotation.y = 0.35;
      objs.add(bk);
    }
    // inkwell + quill
    {
      const ink = new THREE.Mesh(lathe([[0.001, 0], [0.03, 0], [0.032, 0.01], [0.028, 0.04], [0.012, 0.05], [0.012, 0.06], [0.001, 0.06]], 20), mat.glassDark);
      ink.position.set(-0.22, Hh, -0.05);
      objs.add(ink);
      const quill = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.26, 8, 1, true).translate(0, 0.13, 0), mat.feather);
      quill.scale.set(1, 1, 0.25);
      quill.position.set(-0.22, Hh + 0.04, -0.05); quill.rotation.set(0.35, 0.4, -0.3);
      objs.add(quill);
    }
    // scattered papers + a stack of books
    for (let k = 0; k < 3; k++) {
      const pp = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), mat.paper);
      pp.rotation.x = -Math.PI / 2; pp.rotation.z = 0.3 * k - 0.4;
      pp.position.set(0.12 - k * 0.04, Hh + 0.004 + k * 0.001, -0.3 - k * 0.07);
      objs.add(pp);
    }
    {
      const bs = [[0.22, 0.05, 0.3, mat.leatherBox], [0.2, 0.04, 0.27, mat.leatherRed], [0.18, 0.06, 0.25, mat.leatherGreen]];
      let y = Hh;
      bs.forEach(([w, h, d, m], i) => { const b = new THREE.Mesh(bboxAt(w, h, d, 0, y + h / 2, 0, { r: 0.004 }), m); b.rotation.y = 0.12 * i - 0.1; b.position.set(-0.18, 0, -0.55); objs.add(b); y += h; });
    }
    g.add(objs);

    // oil lamp (the room's warm key light) at the far end of the desk
    {
      const lamp = new THREE.Group();
      lamp.add(new THREE.Mesh(lathe([[0.001, 0], [0.075, 0], [0.07, 0.015], [0.03, 0.04], [0.022, 0.12], [0.03, 0.14], [0.055, 0.16], [0.07, 0.2], [0.06, 0.24], [0.028, 0.255], [0.022, 0.27], [0.001, 0.27]], 32), mat.brass));
      // gallery + glass chimney + frosted globe shade
      lamp.add(new THREE.Mesh(lathe([[0.001, 0.27], [0.03, 0.27], [0.034, 0.29], [0.02, 0.3], [0.001, 0.3]], 20), mat.brass));
      const chim = new THREE.Mesh(lathe([[0.016, 0.29], [0.024, 0.32], [0.026, 0.36], [0.016, 0.42], [0.015, 0.5]], 24), mat.glassClear);
      lamp.add(chim);
      const shade = new THREE.Mesh(lathe([[0.03, 0.31], [0.08, 0.34], [0.1, 0.39], [0.09, 0.44], [0.05, 0.46]], 32), mat.lampShade);
      shade.userData.noShadow = true;
      lamp.add(shade);
      const flame = ctx.fx.flame({ height: 0.045, width: 0.016, intensity: 7, seed: 11 });
      flame.position.y = 0.315;
      lamp.add(flame);
      lamp.position.set(-0.12, Hh, -0.42);
      g.add(lamp);
      const pl = new THREE.PointLight(0xffa252, 3.0, 10, 2);
      pl.position.set(-0.12, Hh + 0.39, -0.42);
      pl.castShadow = ctx.quality.shadows;
      pl.shadow.mapSize.set(1024, 1024);
      pl.shadow.bias = -0.002; pl.shadow.normalBias = 0.025; pl.shadow.radius = 5;
      pl.shadow.camera.near = 0.06;
      g.add(pl);
      out.lampLight = pl;
      out.lampShade = shade;
      ctx.onUpdate((dt, t) => { pl.intensity = out.lampBase * flicker(t * 0.6, 4.2); });
      out.lampBase = 3.0;
    }
    g.position.set(SPOTS.desk.x, 0, SPOTS.desk.z); g.rotation.y = SPOTS.desk.ry;
    root.add(g);
    g.traverse((o) => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; } });
    out.desk = g;
  }

  // ================================================================ side chair (upholstered, turned legs)
  {
    const g = new THREE.Group();
    g.name = 'side-chair';
    const wood = [];
    for (const [x, z] of [[-0.21, -0.2], [0.21, -0.2], [-0.21, 0.2], [0.21, 0.2]]) wood.push(turnedLeg(0.44, 0.02).translate(x, 0, z));
    wood.push(bboxAt(0.48, 0.06, 0.46, 0, 0.42, 0, { r: 0.01 }));
    for (const x of [-0.21, 0.21]) {
      const post = new THREE.CylinderGeometry(0.016, 0.019, 0.5, 12);
      post.rotateX(0.12); post.translate(x, 0.69, -0.22);
      wood.push(post);
      wood.push(new THREE.SphereGeometry(0.022, 12, 8).translate(x, 0.95, -0.25));
    }
    wood.push(bboxAt(0.44, 0.06, 0.03, 0, 0.9, -0.25, { r: 0.012, rx: 0.12 }));
    wood.push(bboxAt(0.4, 0.025, 0.02, 0, 0.64, -0.215, { r: 0.008, rx: 0.12 }));
    // stretchers
    wood.push(bboxAt(0.4, 0.02, 0.02, 0, 0.14, 0.2, { r: 0.006 }));
    wood.push(bboxAt(0.02, 0.02, 0.38, -0.21, 0.16, 0, { r: 0.006 }));
    wood.push(bboxAt(0.02, 0.02, 0.38, 0.21, 0.16, 0, { r: 0.006 }));
    g.add(mesh(merge(wood), mat.mahogany, 'chair-wood'));
    const seat = mesh(new G.RoundedBoxGeometry(0.5, 0.08, 0.48, 4, 0.035), mat.tapestry, 'chair-seat');
    seat.position.set(0, 0.48, 0.005);
    g.add(seat);
    // nail-head trim
    const nails = [];
    for (let k = 0; k < 22; k++) { const x = -0.24 + k * (0.48 / 21); nails.push(new THREE.SphereGeometry(0.004, 6, 4).translate(x, 0.455, 0.243)); }
    g.add(mesh(merge(nails), mat.brass));
    g.position.set(SPOTS.chair.x, 0, SPOTS.chair.z); g.rotation.y = SPOTS.chair.ry;
    root.add(g);
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
    up.push(puff(new G.RoundedBoxGeometry(0.6, 0.13, 0.64, 5, 0.055), 0.03).translate(0, 0.44, 0.05));
    // camel back: padded, reclined, crest rising in the middle
    {
      const back = new G.RoundedBoxGeometry(0.74, 0.84, 0.18, 6, 0.07);
      const pos = back.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        let ny = y;
        if (y > 0.3) ny = y + 0.07 * Math.cos(x * 4.2) - 0.02;            // camel crest
        let nz = z + x * x * 0.35;                                         // curve around the sitter
        if (z > 0.02) nz += 0.035 * (1 - (x / 0.37) ** 2) * (1 - ((y - 0.0) / 0.42) ** 2); // padded face
        pos.setXYZ(i, x, ny, nz);
      }
      back.computeVertexNormals();
      back.rotateX(-0.16);
      back.translate(0, 0.86, -0.3);
      up.push(back);
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
    g.add(mesh(merge(up), mat.tapestry, 'wing-upholstery'));
    // cabriole front legs, plain splayed back legs
    const legs = [];
    for (const [x, z, front] of [[-0.34, -0.3, 0], [0.34, -0.3, 0], [-0.35, 0.32, 1], [0.35, 0.32, 1]]) {
      const pts = front ? [[0.001, 0], [0.032, 0], [0.036, 0.015], [0.022, 0.04], [0.02, 0.07], [0.03, 0.1], [0.04, 0.12], [0.001, 0.12]] : [[0.001, 0], [0.022, 0], [0.026, 0.06], [0.032, 0.12], [0.001, 0.12]];
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
    // tripod cabriole legs
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.3;
      const leg = G.sweepProfile([new THREE.Vector2(-0.018, -0.02), new THREE.Vector2(0.018, -0.02), new THREE.Vector2(0.018, 0.02), new THREE.Vector2(-0.018, 0.02), new THREE.Vector2(-0.018, -0.02)],
        [V3(0.03, 0.36, 0), V3(0.12, 0.28, 0), V3(0.2, 0.14, 0), V3(0.24, 0.05, 0), V3(0.3, 0.02, 0)], { uvScale: 1 });
      leg.rotateY(-a);
      stand.push(leg);
      stand.push(new THREE.SphereGeometry(0.022, 12, 8).translate(Math.cos(a) * 0.3, 0.022, Math.sin(a) * 0.3));
    }
    // turned pillar up to the horizon ring supports
    stand.push(lathe([[0.001, 0.3], [0.05, 0.3], [0.06, 0.33], [0.04, 0.38], [0.03, 0.45], [0.045, 0.5], [0.028, 0.53], [0.024, 0.56], [0.001, 0.56]], 24));
    // horizon ring supports (four quadrant arms)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const arm = G.sweepProfile([new THREE.Vector2(-0.01, -0.012), new THREE.Vector2(0.01, -0.012), new THREE.Vector2(0.01, 0.012), new THREE.Vector2(-0.01, 0.012), new THREE.Vector2(-0.01, -0.012)],
        [V3(0.02, 0.55, 0), V3(0.15, 0.6, 0), V3(0.26, 0.7, 0), V3(R + 0.06, cy - 0.01, 0)], { uvScale: 1 });
      arm.rotateY(-a);
      stand.push(arm);
    }
    g.add(mesh(merge(stand), mat.mahogany, 'globe-stand'));
    // horizon ring (flat wooden annulus with a printed calendar band)
    const ring = new THREE.Mesh(new THREE.RingGeometry(R + 0.012, R + 0.075, 96, 1), mat.horizonRing);
    ring.rotation.x = -Math.PI / 2; ring.position.y = cy;
    g.add(ring);
    const ringEdge = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.075, R + 0.075, 0.018, 96, 1, true), mat.mahogany);
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
    const mer = new THREE.Mesh(new THREE.TorusGeometry(R + 0.012, 0.007, 8, 96), mat.brass);
    mer.scale.z = 0.6;
    tilt.add(mer);
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
    const legs = [];
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
      const shoe = new THREE.CylinderGeometry(0.02, 0.016, 0.04, 10);
      shoe.applyQuaternion(q); shoe.translate(foot.x, 0.02, foot.z);
      legs.push(shoe);
    }
    // spreader ring
    legs.push(new THREE.TorusGeometry(0.17, 0.008, 6, 24).rotateX(Math.PI / 2).translate(0, 0.62, 0));
    g.add(mesh(merge(legs), mat.mahogany, 'tripod'));
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
    const tubeMesh = mesh(merge(tubeGeo), mat.brassBright, 'telescope-brass');
    tubeMesh.material.side = THREE.DoubleSide;
    tube.add(tubeMesh);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 32), mat.lens);
    lens.position.z = -0.49; lens.rotation.y = Math.PI;
    tube.add(lens);
    // leather grip
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.18, 40, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.2), mat.leatherBox);
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
    const cover = new THREE.Mesh(bboxAt(0.62, 0.025, 0.44, 0, 0, 0, { r: 0.008 }), mat.leatherRed);
    book.add(cover);
    for (const s of [-1, 1]) {
      const pg = new THREE.Mesh(bboxAt(0.29, 0.05, 0.41, s * 0.152, 0.03, 0, { r: 0.012 }), mat.hintPages);
      pg.rotation.z = -s * 0.05;
      book.add(pg);
    }
    // brass corner bosses + a clasp
    for (const [x, z] of [[-0.3, -0.21], [0.3, -0.21], [-0.3, 0.21], [0.3, 0.21]]) book.add(new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8).translate(x, 0.0, z), mat.brass));
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.34), mat.ribbon);
    ribbon.rotation.x = -Math.PI / 2 + 0.3; ribbon.position.set(0.01, 0.06, 0.29);
    book.add(ribbon);
    book.rotation.x = 0.42; book.position.set(0, 1.08, 0);
    g.add(book);
    g.position.set(SPOTS.lectern.x, 0, SPOTS.lectern.z); g.rotation.y = SPOTS.lectern.ry;
    root.add(g);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    out.lectern = g; out.hintBook = book;
    // a candle on a tall pricket stand beside the lectern
    const stand = new THREE.Group();
    stand.add(new THREE.Mesh(lathe([[0.001, 0], [0.14, 0], [0.12, 0.03], [0.04, 0.06], [0.025, 0.3], [0.035, 0.5], [0.02, 0.9], [0.03, 1.1], [0.07, 1.14], [0.06, 1.16], [0.001, 1.16]], 20), mat.iron));
    const candle = ctx.fx.candle({ height: 0.28, radius: 0.02, lightIntensity: 2.4, lightDistance: 6, seed: 23, burn: 0.8 });
    candle.position.y = 1.16;
    stand.add(candle);
    stand.position.copy(new THREE.Vector3(0.5, 0, 0).applyAxisAngle(V3(0, 1, 0), SPOTS.lectern.ry).add(V3(SPOTS.lectern.x, 0, SPOTS.lectern.z)));
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
    const tulip = new THREE.Mesh(lathe([[0.02, 0], [0.05, 0.03], [0.065, 0.08], [0.06, 0.13], [0.045, 0.15]], 28).translate(0, 0.02, 0.12), mat.sconceShade);
    tulip.userData.noShadow = true;
    sc.add(tulip);
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
      const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ctx.materials.create('painting', { subject, seed, aspect: w / h, size: 1024, varnish: 0.8, cracks: 0.6 }));
      g.add(canvas);
      const fr = new THREE.Mesh(G.frameGeometry(w, h, { width: frameW, depth: 0.05, uvScale: 1 }), mat.frameGilt);
      g.add(fr);
      g.position.copy(wallToWorld(wall, x, y, 0.07)); g.rotation.y = WALLS[wall].ry;
      g.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      root.add(g);
      return g;
    };
    out.pictures = [
      hang('right', 3.35, 1.72, 0.72, 0.52, 0, 21),
      hang('right', 5.6, 1.8, 0.5, 0.66, 1, 33, 0.07),
      hang('back', 5.05, 1.7, 0.6, 0.46, 2, 12, 0.07),
      hang('front', 0.95, 1.75, 0.55, 0.72, 3, 44, 0.07),
    ];
  }

  // ================================================================ rug (faded Persian)
  {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.4), ctx.materials.create('rug', { palette: 'faded', aspect: 2.3 / 3.4, knots: 200, wear: 0.65, fringe: 0.04, seed: 7, size: 1536 }));
    rug.rotation.x = -Math.PI / 2; rug.rotation.z = 0.04;
    rug.position.set(-1.7, 0.005, -2.3);
    rug.receiveShadow = true;
    root.add(rug);
    out.rug = rug;
  }
  return out;
}
