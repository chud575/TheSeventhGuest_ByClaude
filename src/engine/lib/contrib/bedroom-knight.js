import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Carved Staunton-style chess knight (contributed by the bedroom room).
 *   knightGeometry(height = 0.06) -> BufferGeometry, origin at the base centre,
 *   the horse's muzzle faces +Z. Turned base (lathe) + bevelled, extruded head
 *   with a notched mane, eye sockets and flared nostrils.
 * Any room may import it (e.g. for a chess set).
 */
export function knightGeometry(height = 0.06, { radial = 28, curveSegments = 5 } = {}) {
  const u = height;                      // all numbers below are fractions of the total height
  const parts = [];
  // ---- turned base
  const base = [
    [0, 0], [0.3, 0], [0.3, 0.035], [0.285, 0.05], [0.29, 0.07], [0.26, 0.095], [0.22, 0.11], [0.235, 0.13],
    [0.2, 0.15], [0.17, 0.165], [0.18, 0.185], [0.0, 0.19],
  ].map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r * u), y * u));
  parts.push(new THREE.LatheGeometry(base, radial));

  // ---- head silhouette in the (z forward, y up) plane, drawn in x/y then rotated
  const s = new THREE.Shape();
  const P = (x, y) => [x * u, y * u];
  const pts = [
    [-0.17, 0.17], [0.16, 0.17], [0.19, 0.25], [0.17, 0.34], [0.11, 0.43],          // chest
    [0.13, 0.5], [0.24, 0.57], [0.33, 0.62], [0.36, 0.66], [0.355, 0.71],            // jaw to muzzle
    [0.32, 0.745], [0.25, 0.77], [0.15, 0.83], [0.08, 0.88],                          // nose bridge, forehead
    [0.07, 0.95], [0.04, 1.0], [0.0, 0.94],                                            // ear
    [-0.04, 0.9], [-0.1, 0.9],
  ];
  // notched mane down the back of the neck
  const mane = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = -0.1 - t * 0.12 - Math.sin(t * Math.PI) * 0.03;
    const y = 0.9 - t * 0.58;
    mane.push([x - (i % 2 ? 0.025 : 0), y]);
  }
  const all = [...pts, ...mane, [-0.2, 0.25]];
  s.moveTo(...P(...all[0]));
  for (let i = 1; i < all.length; i++) {
    const [x, y] = all[i];
    const [px, py] = all[i - 1];
    s.quadraticCurveTo(((px + x) / 2) * u, ((py + y) / 2) * u, x * u, y * u);
  }
  const thick = 0.17 * u;
  const head = new THREE.ExtrudeGeometry(s, {
    depth: thick, bevelEnabled: true, bevelThickness: 0.06 * u, bevelSize: 0.045 * u, bevelSegments: 3, curveSegments,
  });
  head.translate(0, 0, -thick / 2);
  head.rotateY(-Math.PI / 2);           // shape +x (muzzle) -> +z
  parts.push(head);
  // eyes (small domes) and nostril bumps either side
  for (const side of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.035 * u, 10, 8);
    eye.translate(side * (thick / 2 + 0.055 * u), 0.8 * u, 0.12 * u);
    parts.push(eye);
    const nos = new THREE.SphereGeometry(0.03 * u, 8, 6);
    nos.translate(side * (thick / 2 + 0.03 * u), 0.69 * u, 0.31 * u);
    parts.push(nos);
  }
  const norm = parts.map((p) => {
    const q = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k);
    if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
    if (!q.attributes.normal) q.computeVertexNormals();
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
