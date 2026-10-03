import * as THREE from 'three';

/**
 * Drapery for the dining-room window: pleated velvet drapes gathered into
 * tie-backs with pooled hems, a swagged valance (catenary swags + jabots) and
 * tassels. All parametric surfaces with UVs in metres.
 */

function gridGeometry(U, V, fn) {
  const pos = new Float32Array((U + 1) * (V + 1) * 3);
  const uv = new Float32Array((U + 1) * (V + 1) * 2);
  const p = new THREE.Vector3();
  const st = [0, 0];
  for (let j = 0; j <= V; j++) for (let i = 0; i <= U; i++) {
    const k = j * (U + 1) + i;
    fn(i / U, j / V, p, st);
    pos.set([p.x, p.y, p.z], k * 3);
    uv.set(st, k * 2);
  }
  const idx = [];
  for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) {
    const a = j * (U + 1) + i, b = a + 1, c = a + U + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/**
 * One drape hanging from y = 0 (rod) down to y = -height (floor), spanning x in [0, width]
 * when open. `outer` = 0 gathers toward x = 0 at the tie-back. Faces +z.
 */
export function buildCurtain({ width = 0.85, height = 2.6, folds = 10, depth = 0.05, tieback = 0.36, squeeze = 0.32, pool = 0.14, seed = 1, U = 120, V = 80 } = {}) {
  const phases = Array.from({ length: folds + 2 }, (_, i) => hash(seed * 13 + i) * 0.6);
  const tbV = 1 - tieback;                       // v (from top) of the tie-back
  return gridGeometry(U, V, (u, v, p, st) => {
    // gather profile: full width at the rod, pinched at the tie-back, flaring below
    let sq;
    if (v < tbV) { const t = v / tbV; sq = 1 - (1 - squeeze) * Math.pow(t, 1.6); }
    else { const t = (v - tbV) / (1 - tbV); sq = squeeze + (0.62 - squeeze) * Math.sin(t * Math.PI * 0.5); }
    // the inner (leading) edge sweeps in a curve; outer edge stays near the wall
    const x = width * u * sq;
    // pleats: deeper where compressed; irregular phase per fold
    const fu = u * folds;
    const fi = Math.floor(fu);
    const ph = phases[Math.min(fi, folds)] ?? 0;
    const wave = Math.sin((fu + ph * 0.3) * Math.PI * 2);
    const sharp = Math.sign(wave) * Math.pow(Math.abs(wave), 0.75);
    const comp = 1 / Math.max(sq, 0.2);
    let z = depth * sharp * (0.55 + 0.45 * Math.min(comp, 3.2)) * (0.8 + 0.4 * hash(fi + seed));
    // fabric bellies forward between rod and tie-back, top pinch-pleats
    z += 0.05 * Math.sin(Math.min(v / tbV, 1) * Math.PI) * u;
    if (v < 0.04) z *= 0.5 + 12 * v;
    let y = -v * height;
    // pooled hem: last part lies on the floor and spreads forward
    const poolStart = 1 - pool / height;
    if (v > poolStart) {
      const t = (v - poolStart) / (1 - poolStart);
      y = -height + pool * (1 - t) * 0.15 * (1 - t);
      z += pool * 1.6 * t * (0.6 + 0.4 * u) + 0.03 * Math.sin(u * 23 + seed) * t;
    }
    p.set(x, y, z);
    st[0] = u * width * 1.6; st[1] = -y;
  });
}

/** Swagged valance: `n` catenary swags across `width`, top at y = 0, faces +z. */
export function buildSwagValance({ width = 2.4, n = 3, drop = 0.5, seed = 3 } = {}) {
  const parts = [];
  const sw = width / n * 1.12;
  for (let k = 0; k < n; k++) {
    const cx = -width / 2 + (k + 0.5) * (width / n);
    const g = gridGeometry(60, 26, (s, t, p, st) => {
      const sn = Math.sin(s * Math.PI);
      const hem = drop * (0.22 + 0.78 * Math.pow(sn, 0.9));
      const y = -t * hem;
      // horizontal folds following the hem curve
      const fold = Math.sin(t * Math.PI * 4.5 + 0.4) * 0.022 * sn * (0.4 + 0.6 * t);
      const z = 0.05 * sn * t + fold + 0.012 * (k % 2) + 0.02;
      const x = cx + (s - 0.5) * sw * (1 - 0.08 * t);
      p.set(x, y, z);
      st[0] = s * sw * 1.6; st[1] = t * hem;
    });
    parts.push(g);
  }
  // jabots (cascades) at both ends: zig-zag pleats, hem slanting longer toward the outside
  for (const side of [-1, 1]) {
    const jw = 0.34, jmin = 0.55, jmax = 1.05;
    const g = gridGeometry(36, 30, (u, v, p, st) => {
      const L = jmin + (jmax - jmin) * u;
      const y = -v * L;
      const tri = Math.abs(((u * 5) % 1) - 0.5) * 2 - 0.5;
      const z = 0.07 + tri * 0.05 + 0.02 * v;
      const x = side * (width / 2 - jw + u * jw + 0.06);
      p.set(x, y, z);
      st[0] = u * jw * 1.6; st[1] = v * L;
    });
    if (side < 0) {
      // mirror winding stays correct because x mapping flips with side: flip index order
      const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      g.computeVertexNormals();
    }
    parts.push(g);
  }
  return parts;
}

/** A passementerie tassel (head + skirt of threads), origin at the hanging point. */
export function buildTassel(G, { length = 0.2, radius = 0.035 } = {}) {
  const head = G.latheFromProfile([[0, 0], [0.008, -0.004], [0.012, -0.02], [radius * 0.75, -0.045], [radius * 0.55, -0.07], [radius * 0.6, -0.08], [radius * 0.45, -0.09]], 20);
  const skirt = new THREE.CylinderGeometry(radius * 0.48, radius, length - 0.09, 32, 6, true);
  const p = skirt.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
    const r = 1 + 0.12 * Math.abs(Math.sin(a * 16));
    p.setXYZ(i, x * r, p.getY(i), z * r);
  }
  skirt.translate(0, -0.09 - (length - 0.09) / 2, 0);
  skirt.computeVertexNormals();
  return { head, skirt };
}
