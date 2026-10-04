import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sdfGeometry, sdChain, sdRoundCone, sdEllipsoid, sdSphere, smin, smax, ssub, clamp } from './bedroom-sdf.js';

/**
 * Carved Staunton-style chess knight (contributed by the bedroom room).
 *   knightGeometry(height = 0.06) -> BufferGeometry, origin at the base centre,
 *   the horse's muzzle faces +Z. Has a `color` attribute (grey cavity/occlusion term,
 *   1 = open surface, darker in the carved crevices) for materials that want it.
 *
 * The turned base is a lathe; the horse is sculpted as a signed-distance field and
 * polygonised (see bedroom-sdf.js): a flat-sided arched neck swelling into the chest,
 * a tapering head with round jowls, a dished face and a flared muzzle with nostrils and
 * a carved mouth line, deep-set eyes under a brow, leaf-shaped ears with hollows, a
 * forelock, and a raised mane down the crest cut into diagonal locks.
 * Any room may import it (e.g. for a chess set).
 */
function horseSDF(x, y, z) {
  const ax = Math.abs(x);
  // ---- neck: flat-sided (x squashed) chain arching back, then forward into the poll
  const NX = 1.55;
  let d = sdChain(x * NX, y, z, [[0, 0.16, 0.0, 0.15], [0, 0.31, -0.025, 0.128], [0, 0.46, -0.045, 0.11], [0, 0.6, -0.04, 0.1], [0, 0.745, -0.005, 0.096]], 0.05) / NX;
  // chest swelling at the front of the neck
  d = smin(d, sdEllipsoid(x, y - 0.27, z - 0.05, 0.095, 0.11, 0.1), 0.06);
  // ---- head: a round cone from the jowl down to the muzzle (squashed sideways)
  const HX = 1.32;
  const head = sdRoundCone(x * HX, y, z, [0, 0.79, 0.04], [0, 0.66, 0.355], 0.112, 0.062) / HX;
  d = smin(d, head, 0.045);
  // round jowls (cheek plates)
  d = smin(d, sdEllipsoid(ax - 0.01, y - 0.72, z - 0.04, 0.085, 0.105, 0.115), 0.035);
  // flared muzzle + chin
  d = smin(d, sdEllipsoid(x, y - 0.665, z - 0.372, 0.056, 0.062, 0.068), 0.03);
  d = smin(d, sdEllipsoid(x, y - 0.614, z - 0.335, 0.042, 0.032, 0.062), 0.025);
  // dished face: shave a little off the nose bridge between the eyes and the muzzle
  d = smax(d, -sdEllipsoid(x, y - 0.795, z - 0.29, 0.12, 0.038, 0.075) - 0.004, 0.02);
  // ---- forelock and ears
  d = smin(d, sdEllipsoid(x, y - 0.868, z - 0.07, 0.034, 0.028, 0.05), 0.018);
  for (const s of [-1, 1]) {
    const ear = sdRoundCone(x, y, (z - 0.012) * 1.7, [s * 0.04, 0.845, 0.0], [s * 0.052, 1.0, 0.04], 0.034, 0.006);
    d = smin(d, ear / 1.3, 0.02);
    d = ssub(d, sdEllipsoid(x - s * 0.047, y - 0.935, z - 0.04, 0.014, 0.048, 0.016), 0.006);
  }
  // ---- eyes: socket, eyeball, brow
  for (const s of [-1, 1]) {
    d = ssub(d, sdSphere(x - s * 0.09, y - 0.805, z - 0.145, 0.03), 0.012);
    d = smin(d, sdSphere(x - s * 0.062, y - 0.803, z - 0.147, 0.021), 0.004);
    // nostrils
    d = ssub(d, sdEllipsoid(x - s * 0.033, y - 0.68, z - 0.43, 0.011, 0.017, 0.02), 0.006);
    // the cheek-plate edge, a shallow carved line sweeping up behind the jowl
    const cg = Math.abs(Math.hypot((y - 0.72) / 1.0, (z - 0.04) / 1.05) - 0.108) - 0.0035;
    d = smax(d, -Math.max(cg, -(d + 0.006), z - 0.06, -0.035 - z, y - 0.8), 0.003);
  }
  // mouth line: a groove on the muzzle sides only (limited to a thin shell under the surface)
  {
    const yl = 0.628 + (z - 0.33) * 0.12;
    const slab = Math.max(Math.abs(y - yl) - 0.004, 0.29 - z, z - 0.47);
    d = smax(d, -Math.max(slab, -(d + 0.014)), 0.003);
  }
  // ---- mane: a ridge standing proud of the crest, cut into diagonal locks
  const crest = [[0, 0.22, -0.162, 0.026], [0, 0.4, -0.172, 0.032], [0, 0.56, -0.155, 0.033], [0, 0.7, -0.118, 0.03], [0, 0.82, -0.068, 0.025], [0, 0.885, -0.015, 0.02]];
  const dm = sdChain(x * 1.15, y, z, crest, 0.02) / 1.15;
  d = smin(d, dm, 0.018);
  {
    const w = clamp(1 - Math.max(0, dm) / 0.03, 0, 1) * clamp((0.06 - z) / 0.08, 0, 1);
    if (w > 0) {
      const s = y * 0.82 - z * 0.58 + ax * 0.6;
      const c = Math.abs(Math.cos((Math.PI * s) / 0.052));
      d += w * 0.0085 * Math.pow(c, 10);
      // fine strands within each lock
      d += w * 0.0012 * Math.abs(Math.sin((Math.PI * (y * 0.5 + z * 0.85)) / 0.011));
    }
  }
  // cut flat inside the collar
  d = Math.max(d, 0.165 - y);
  return d;
}

const cache = new Map();
export function knightGeometry(height = 0.06, { radial = 40, step = 1 / 120 } = {}) {
  const key = `${height}|${radial}|${step}`;
  if (cache.has(key)) return cache.get(key);
  const u = height;
  // ---------------------------------------------------------------- turned base (lathe)
  const base = [
    [0, 0], [0.33, 0], [0.336, 0.008], [0.338, 0.026], [0.326, 0.04], [0.305, 0.048],
    [0.308, 0.058], [0.313, 0.07], [0.303, 0.082], [0.278, 0.088],
    [0.242, 0.1], [0.216, 0.118], [0.206, 0.135],
    [0.216, 0.145], [0.236, 0.152], [0.237, 0.165], [0.218, 0.173], [0.19, 0.178],
    [0.17, 0.19], [0.0, 0.19],
  ];
  const lathe = new THREE.LatheGeometry(base.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r * u), y * u)), radial);
  {
    const uv = lathe.attributes.uv, p = lathe.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.0, p.getY(i) / u);
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      // the cove and the underside of the bead hold dirt
      const y = p.getY(i) / u;
      const cav = Math.exp(-(((y - 0.12) / 0.03) ** 2)) * 0.35 + Math.exp(-(((y - 0.05) / 0.008) ** 2)) * 0.3 + Math.exp(-(((y - 0.18) / 0.01) ** 2)) * 0.3;
      c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = 1 - cav;
    }
    lathe.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  // ---------------------------------------------------------------- sculpted horse
  const horse = sdfGeometry(horseSDF, { min: [-0.14, 0.15, -0.23], max: [0.14, 1.04, 0.49], step, project: 4, ao: 0.06, aoStrength: 0.75, uv: 'planar', uvScale: 1 });
  horse.scale(u, u, u);
  const parts = [lathe, horse].map((p) => {
    const q = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) q.deleteAttribute(k);
    return q;
  });
  const g = mergeGeometries(parts);
  g.computeBoundingBox(); g.computeBoundingSphere();
  cache.set(key, g);
  return g;
}
