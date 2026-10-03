import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** weld an ExtrudeGeometry so curved walls shade smoothly (bevels keep the cap edges soft anyway) */
function smooth(g, tol) {
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const m = mergeVertices(g, tol);
  m.computeVertexNormals();
  return m;
}

/**
 * Carved Staunton-style chess knight (contributed by the bedroom room).
 *   knightGeometry(height = 0.06) -> BufferGeometry, origin at the base centre,
 *   the horse's muzzle faces +Z.
 *
 * Built from:
 *  - a turned base (lathe): foot, bead, cove, collar;
 *  - the horse head as a bevelled side-profile extrusion (arched neck, forelock,
 *    pricked ears, dished face, flared muzzle, open jaw line);
 *  - a raised mane crest down the back of the neck, cut into 7 carved locks;
 *  - eye bosses, nostrils and a cheek (jowl) swelling on both sides.
 * UVs are in units of `height` everywhere so a grain texture can use one repeat.
 * Any room may import it (e.g. for a chess set).
 */
export function knightGeometry(height = 0.06, { radial = 32, curveSegments = 6 } = {}) {
  const u = height;                      // all numbers below are fractions of the total height
  const parts = [];

  // ---------------------------------------------------------------- turned base
  const base = [
    [0, 0], [0.33, 0], [0.335, 0.012], [0.335, 0.03], [0.32, 0.042], [0.3, 0.048],          // foot with a fillet
    [0.305, 0.058], [0.31, 0.07], [0.3, 0.082], [0.275, 0.088],                             // bead
    [0.24, 0.1], [0.215, 0.118], [0.205, 0.135],                                           // cove
    [0.215, 0.145], [0.235, 0.152], [0.235, 0.165], [0.215, 0.172], [0.19, 0.176],          // collar
    [0.18, 0.19], [0.0, 0.19],
  ];
  const lathe = new THREE.LatheGeometry(base.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r * u), y * u)), radial);
  {
    const uv = lathe.attributes.uv, p = lathe.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.0, p.getY(i) / u);
  }
  parts.push(lathe);

  // ---------------------------------------------------------------- head profile
  // Shape x = forward (muzzle side), y = up. Traced clockwise from the front of the chest.
  const P = (x, y) => new THREE.Vector2(x * u, y * u);
  const front = [
    P(0.17, 0.175), P(0.2, 0.24), P(0.21, 0.31), P(0.185, 0.39),          // chest swelling
    P(0.15, 0.45), P(0.135, 0.5),                                          // throat (narrowest)
    P(0.17, 0.54), P(0.24, 0.565), P(0.31, 0.585), P(0.365, 0.6),          // under-jaw to chin
    P(0.395, 0.62), P(0.41, 0.645),                                        // lower lip
    P(0.405, 0.665), P(0.415, 0.69), P(0.405, 0.72), P(0.375, 0.74),       // mouth notch + nose
    P(0.32, 0.755), P(0.25, 0.79), P(0.19, 0.835),                         // dished face
    P(0.15, 0.875), P(0.135, 0.905),                                       // forehead / forelock
  ];
  const ears = [
    P(0.145, 0.94), P(0.155, 1.0),                                         // front ear tip
    P(0.11, 0.955), P(0.085, 0.945), P(0.07, 0.985), P(0.045, 0.94),        // notch + back ear
  ];
  const back = [
    P(0.0, 0.915), P(-0.07, 0.875), P(-0.13, 0.81), P(-0.18, 0.72),        // poll -> crest of the arched neck
    P(-0.215, 0.62), P(-0.235, 0.5), P(-0.24, 0.38), P(-0.235, 0.27),
    P(-0.215, 0.175),
  ];
  const shape = new THREE.Shape();
  shape.moveTo(front[0].x, front[0].y);
  shape.splineThru(front.slice(1));
  shape.lineTo(ears[0].x, ears[0].y);
  shape.lineTo(ears[1].x, ears[1].y);
  shape.splineThru(ears.slice(2));
  shape.splineThru(back);
  shape.lineTo(front[0].x, front[0].y);

  const thick = 0.15 * u;
  const bevel = 0.06 * u;
  const head = new THREE.ExtrudeGeometry(shape, {
    depth: thick, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.05 * u, bevelSegments: 4, curveSegments,
  });
  head.translate(0, 0, -thick / 2);
  // taper toward the muzzle: a horse's face is narrower than its neck
  {
    const p = head.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / u, y = p.getY(i) / u;
      const k = 1 - 0.32 * THREE.MathUtils.smoothstep(x, 0.12, 0.42) * THREE.MathUtils.smoothstep(y, 0.5, 0.65);
      const neck = 1 + 0.12 * THREE.MathUtils.smoothstep(-x, -0.05, 0.2) * (1 - THREE.MathUtils.smoothstep(y, 0.6, 0.9));
      p.setZ(i, p.getZ(i) * k * neck);
    }
  }
  const headS = smooth(head, u * 1e-4);
  headS.rotateY(-Math.PI / 2);           // shape +x (muzzle) -> +z
  parts.push(headS);

  // ---------------------------------------------------------------- mane: carved locks along the crest
  {
    const crest = [[-0.03, 0.9], [-0.1, 0.85], [-0.155, 0.775], [-0.195, 0.685], [-0.222, 0.585], [-0.238, 0.48], [-0.245, 0.375], [-0.243, 0.28]];
    for (let i = 0; i < crest.length - 1; i++) {
      const [x0, y0] = crest[i], [x1, y1] = crest[i + 1];
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      // one lock: a teardrop leaning back and down, standing proud of the crest
      const lk = new THREE.Shape();
      const L = len * 1.25, Wd = 0.05;
      lk.moveTo(0, 0);
      lk.quadraticCurveTo(L * 0.35, Wd, L, Wd * 0.25);
      lk.quadraticCurveTo(L * 0.6, -Wd * 0.25, 0, 0);
      const lg = new THREE.ExtrudeGeometry(lk, { depth: thick * 1.05, bevelEnabled: true, bevelThickness: bevel * 0.7, bevelSize: 0.012, bevelSegments: 3, curveSegments: 6 });
      lg.scale(u, u, 1);
      lg.translate(0, 0, -thick * 1.05 / 2);
      lg.rotateZ(Math.atan2(dy, dx));
      lg.translate(x0 * u - 0.012 * u, y0 * u + 0.005 * u, 0);
      lg.rotateY(-Math.PI / 2);
      parts.push(smooth(lg, u * 1e-4));
    }
  }

  // ---------------------------------------------------------------- eyes, brows, nostrils, jowls (both sides)
  const halfW = (z) => z;   // placeholder for readability
  void halfW;
  for (const side of [-1, 1]) {
    const sx = side * (thick / 2 + bevel * 0.75);
    // eye boss + pupil dimple suggested by a smaller inset sphere
    const eye = new THREE.SphereGeometry(0.038 * u, 14, 10);
    eye.scale(0.6, 1, 1.15);
    eye.translate(sx * 0.93, 0.835 * u, 0.135 * u);
    parts.push(eye);
    const brow = new THREE.CapsuleGeometry(0.016 * u, 0.06 * u, 3, 8);
    brow.rotateX(Math.PI / 2 - 0.35);
    brow.translate(sx * 0.98, 0.875 * u, 0.13 * u);
    parts.push(brow);
    // nostril flare
    const nos = new THREE.SphereGeometry(0.032 * u, 12, 8);
    nos.scale(0.55, 0.8, 1.2);
    nos.translate(sx * 0.72, 0.705 * u, 0.36 * u);
    parts.push(nos);
    // cheek / jowl swelling
    const jowl = new THREE.SphereGeometry(0.085 * u, 16, 12);
    jowl.scale(0.38, 0.85, 1.0);
    jowl.translate(sx * 0.96, 0.66 * u, 0.06 * u);
    parts.push(jowl);
    // bridle-like carved band at the throat (classic Staunton detail)
  }
  // a small ring of beading where the neck meets the collar
  const ring = new THREE.TorusGeometry(0.17 * u, 0.018 * u, 8, radial);
  ring.rotateX(Math.PI / 2); ring.scale(1, 1, 0.8); ring.translate(0, 0.19 * u, 0);
  parts.push(ring);

  const norm = parts.map((p) => {
    let q = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k);
    if (!q.attributes.normal) q.computeVertexNormals();
    // planar UVs in units of `height` for everything but the lathe (already set)
    if (p !== lathe) {
      const pos = q.attributes.position;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getZ(i) + pos.getX(i) * 0.3) / u; uv[i * 2 + 1] = pos.getY(i) / u; }
      q.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }
    return q;
  });
  const g = mergeGeometries(norm);
  // zero-area slivers from the curve joins get zero-length normals -> NaN in the shader; patch them
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i), y = n.getY(i), z = n.getZ(i);
    const l = Math.hypot(x, y, z);
    if (!(l > 1e-6)) n.setXYZ(i, 0, 1, 0); else if (Math.abs(l - 1) > 1e-3) n.setXYZ(i, x / l, y / l, z / l);
  }
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
