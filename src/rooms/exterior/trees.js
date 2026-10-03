import * as THREE from 'three';
import { rng } from './lib.js';

/**
 * Gnarled dead oak generator: recursive tapered tubes with parallel-transport
 * frames, twisting/kinking limbs that reach out and droop, buttress-flared
 * roots, and fine twig tips that read as lace against the sky.
 * Returns one merged BufferGeometry (position/normal/uv) per tree.
 */
export function gnarledTree({ seed = 1, height = 9, spread = 1, trunkR = 0.45, depth = 5, lean = 0, twigs = true, droop = 0.25, reach = null, reachW = 0.8, leanZ = 0, minR = 0.006 } = {}) {
  const reachV = reach ? new THREE.Vector3(...reach).normalize() : null;
  const R = rng(seed);
  const pos = [], nor = [], uv = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0);

  const tube = (pts, radii, radial, flare = 0) => {
    const n = pts.length;
    const base = pos.length / 3;
    // frames
    let T = new THREE.Vector3().subVectors(pts[1], pts[0]).normalize();
    let N = Math.abs(T.y) < 0.95 ? new THREE.Vector3().crossVectors(T, up).normalize() : new THREE.Vector3(1, 0, 0);
    let Bn = new THREE.Vector3().crossVectors(T, N).normalize();
    const kU = Math.max(1, Math.round((2 * Math.PI * radii[0]) / 1.0));
    let along = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        const Tn = new THREE.Vector3().subVectors(pts[Math.min(i + 1, n - 1)], pts[i - 1]).normalize();
        const axis = new THREE.Vector3().crossVectors(T, Tn);
        const s = axis.length();
        if (s > 1e-5) {
          const ang = Math.asin(Math.min(1, s));
          axis.normalize();
          N.applyAxisAngle(axis, ang); Bn.applyAxisAngle(axis, ang);
        }
        T = Tn;
        along += pts[i].distanceTo(pts[i - 1]);
      }
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        let r = radii[i];
        if (flare > 0) {
          const f = Math.max(0, 1 - i / (n * 0.35));
          r *= 1 + flare * f * f * (0.55 + 0.45 * Math.abs(Math.sin(a * 2.5 + seed)));
        }
        // bark ridges / burls
        r *= 1 + 0.06 * Math.sin(a * 7 + i * 0.7 + seed) * (radial > 6 ? 1 : 0.3);
        const c = Math.cos(a), s2 = Math.sin(a);
        const nx = N.x * c + Bn.x * s2, ny = N.y * c + Bn.y * s2, nz = N.z * c + Bn.z * s2;
        pos.push(pts[i].x + nx * r, pts[i].y + ny * r, pts[i].z + nz * r);
        nor.push(nx, ny, nz);
        uv.push((j / radial) * kU, along / 2.0);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
      const a = base + i * (radial + 1) + j, b = a + 1, c = a + radial + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  };

  const randomPerp = (d) => {
    const p = new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5);
    p.sub(d.clone().multiplyScalar(p.dot(d))).normalize();
    return p;
  };

  const branch = (p0, dir, len, r0, level) => {
    const segs = Math.max(3, Math.min(14, Math.round(len / (level < 2 ? 0.4 : 0.3))));
    const pts = [p0.clone()];
    const radii = [r0];
    let d = dir.clone();
    let p = p0.clone();
    const rEnd = r0 * (level === 0 ? 0.55 : 0.4);
    const kink = level === 0 ? 0.12 : 0.22 + level * 0.04;
    for (let i = 1; i <= segs; i++) {
      // gnarl: random bends, plus drooping for long horizontal limbs, plus reaching toward light
      d.addScaledVector(randomPerp(d), kink * (0.5 + R()));
      d.y -= droop * (level / depth) * 0.25 * (1 - Math.abs(d.y));
      if (level === 0) d.y += 0.06;
      d.normalize();
      p = p.clone().addScaledVector(d, len / segs);
      pts.push(p);
      radii.push(r0 + (rEnd - r0) * Math.pow(i / segs, 0.8));
    }
    const radial = level === 0 ? 14 : level === 1 ? 9 : level === 2 ? 6 : level === 3 ? 4 : 3;
    tube(pts, radii, radial, level === 0 ? 0.9 : 0);
    if (level >= depth) return;
    // children
    const nChild = level === 0 ? 4 + Math.floor(R() * 2) : level === 1 ? 3 + Math.floor(R() * 2) : 2 + Math.floor(R() * 2);
    for (let c = 0; c < nChild; c++) {
      const t = level === 0 ? 0.45 + 0.55 * (c / nChild) + R() * 0.08 : 0.25 + 0.75 * ((c + R() * 0.5) / nChild);
      const k = Math.min(segs, Math.max(1, Math.round(t * segs)));
      const at = pts[k];
      const pd = new THREE.Vector3().subVectors(pts[Math.min(k, segs)], pts[k - 1]).normalize();
      const out = randomPerp(pd);
      // bias outward from trunk & horizontal (oak crown spreads wide)
      const radial2 = new THREE.Vector3(at.x, 0, at.z).normalize();
      if (level <= 1 && radial2.lengthSq() > 0) out.addScaledVector(radial2, 0.6).normalize();
      // limbs reach one way (toward the house / across the frame)
      if (reachV && level <= 2) out.addScaledVector(reachV, reachW * (level === 0 ? 1.0 : 0.6)).normalize();
      const ang = (level === 0 ? 0.75 : 0.55) + R() * 0.45;
      const cd = pd.clone().multiplyScalar(Math.cos(ang)).addScaledVector(out, Math.sin(ang)).normalize();
      if (level === 0) cd.y = Math.max(cd.y, 0.15 + R() * 0.3);
      const cl = len * (level === 0 ? 0.62 + R() * 0.25 : 0.55 + R() * 0.25) * spread;
      const cr = radii[k] * (level === 0 ? 0.62 : 0.7);
      branch(at, cd.normalize(), cl, Math.max(minR, cr), level + 1);
    }
    // apical continuation
    if (level >= 1 && level < depth) {
      const end = pts[segs];
      const pd = new THREE.Vector3().subVectors(pts[segs], pts[segs - 1]).normalize();
      branch(end, pd.addScaledVector(randomPerp(pd), 0.35).normalize(), len * 0.6, Math.max(minR, radii[segs] * 0.95), level + 1);
    }
  };

  // roots: a few surface roots flowing into the ground
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + R() * 0.6;
    const d = new THREE.Vector3(Math.cos(a), -0.35, Math.sin(a)).normalize();
    const pts = [], radii = [];
    let p = new THREE.Vector3(Math.cos(a) * trunkR * 0.4, 0.5, Math.sin(a) * trunkR * 0.4);
    for (let k = 0; k <= 5; k++) {
      pts.push(p.clone());
      radii.push(trunkR * 0.55 * (1 - k / 6));
      d.y -= 0.08; d.x += (R() - 0.5) * 0.3; d.z += (R() - 0.5) * 0.3; d.normalize();
      p.addScaledVector(d, 0.35);
    }
    tube(pts, radii, 6);
  }
  const trunkDir = new THREE.Vector3(lean, 1, leanZ || lean * 0.3).normalize();
  branch(new THREE.Vector3(0, -0.4, 0), trunkDir, height * 0.42, trunkR, 0);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
