import * as THREE from 'three';
import { rng } from './lib.js';

/**
 * Gnarled dead oak generator: recursive tapered tubes with parallel-transport
 * frames, twisting/kinking limbs that reach out and droop, buttress-flared
 * roots, and fine twig tips that read as lace against the sky.
 * Returns one merged BufferGeometry (position/normal/uv) per tree.
 */
// deterministic 3D value noise for bark relief (does not consume the shape RNG)
function hh(x, y, z, sd) {
  let n = (x * 374761393 + y * 668265263 + z * 1440662683 + sd * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vn3(x, y, z, sd) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hh(ix + dx, iy + dy, iz + dz, sd);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), ux), L(c(0, 1, 0), c(1, 1, 0), ux), uy), L(L(c(0, 0, 1), c(1, 0, 1), ux), L(c(0, 1, 1), c(1, 1, 1), ux), uy), uz);
}
function fbm3(x, y, z, sd, oct = 3) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vn3(x, y, z, sd + i * 7); n += a; x *= 2.07; y *= 2.07; z *= 2.07; a *= 0.5; }
  return s / n;
}

export function gnarledTree({ seed = 1, height = 9, spread = 1, trunkR = 0.45, depth = 5, lean = 0, twigs = true, droop = 0.25, reach = null, reachW = 0.8, leanZ = 0, minR = 0.006, gnarl = 1, roots = 5, rootScale = 1 } = {}) {
  const reachV = reach ? new THREE.Vector3(...reach).normalize() : null;
  const R = rng(seed);
  const pos = [], nor = [], uv = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tubes = [];
  const rootAngles = [];
  // gnarl: 0 = plain round limb; trunk/roots get an oval, twisting, fissured, burled section
  const tube = (pts, radii, radial, flare = 0, relief = 0) => {
    const n = pts.length;
    const base = pos.length / 3;
    tubes.push([base, n, radial]);
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
        const c = Math.cos(a), s2 = Math.sin(a);
        const nx = N.x * c + Bn.x * s2, ny = N.y * c + Bn.y * s2, nz = N.z * c + Bn.z * s2;
        if (flare > 0) {
          // buttresses: the flare swells into lobes that run out into the surface roots
          const f = Math.max(0, 1 - along / (radii[0] * 3.0));
          const ha = Math.atan2(nz, nx);
          let lobe = 0.18;
          for (const ra of rootAngles) { let d = Math.abs(ha - ra) % (Math.PI * 2); if (d > Math.PI) d = Math.PI * 2 - d; lobe = Math.max(lobe, Math.exp(-(d * d) / 0.09)); }
          r *= 1 + flare * f * f * (0.25 + 1.1 * lobe);
        }
        if (relief > 0) {
          // oval, slowly twisting section; burls and deep vertical fissures (twisting with the grain)
          const tw = a + along * 0.22;
          const ox = Math.cos(tw), oz = Math.sin(tw);
          r *= 1 + 0.13 * relief * Math.cos(2 * tw + seed);
          r *= 1 + 0.16 * relief * (fbm3(ox * 1.3 + 5, along * 0.55, oz * 1.3 + seed, seed, 3) - 0.5) * 2;
          const fis = Math.abs(Math.sin(tw * 7 + fbm3(ox * 2, along * 0.9, oz * 2, seed + 3, 2) * 6));
          r *= 1 - 0.05 * relief * Math.pow(1 - fis, 3);
        } else {
          r *= 1 + 0.06 * Math.sin(a * 7 + i * 0.7 + seed) * (radial > 6 ? 1 : 0.3);
        }
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
    const kink = (level === 0 ? 0.12 : 0.22 + level * 0.04) * (level <= 1 ? gnarl : 1);
    for (let i = 1; i <= segs; i++) {
      // gnarl: random bends, plus drooping for long horizontal limbs, plus reaching toward light
      d.addScaledVector(randomPerp(d), kink * (0.5 + R()));
      d.y -= droop * (level / depth) * 0.25 * (1 - Math.abs(d.y));
      if (level === 0) d.y += 0.06;
      d.normalize();
      p = p.clone().addScaledVector(d, len / segs);
      pts.push(p);
      // old, massive limbs: stay thick for most of their length, then taper (+ a swollen collar at the fork)
      const tt = i / segs;
      const collar = level >= 1 && level <= 2 ? 1 + 0.18 * Math.exp(-tt * 10) : 1;
      radii.push((r0 + (rEnd - r0) * Math.pow(tt, level === 0 ? 1.5 : level === 1 ? 1.1 : 0.8)) * collar);
    }
    if (level >= 1 && level <= 2) radii[0] *= 1.12;
    const radial = level === 0 ? 30 : level === 1 ? 12 : level === 2 ? 7 : level === 3 ? 4 : 3;
    if (level <= 1) {
      // densify the rings (smooth spline through the same skeleton: the shape RNG is untouched)
      const sub = level === 0 ? 4 : 2;
      const crv = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const P2 = [], R2 = [];
      for (let i = 0; i <= segs * sub; i++) {
        const u = i / (segs * sub);
        P2.push(crv.getPoint(u));
        const f = u * segs, i0 = Math.min(segs - 1, Math.floor(f));
        R2.push(radii[i0] + (radii[i0 + 1] - radii[i0]) * (f - i0));
      }
      tube(P2, R2, radial, level === 0 ? 0.9 : 0, level === 0 ? 1 : 0.55);
    } else tube(pts, radii, radial, 0, 0);
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
      const cr = radii[k] * (level === 0 ? 0.64 : 0.66);
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
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + R() * 0.6;
    rootAngles.push(Math.atan2(Math.sin(a), Math.cos(a)));
    const d = new THREE.Vector3(Math.cos(a), -0.55, Math.sin(a)).normalize();
    const pts = [], radii = [];
    let p = new THREE.Vector3(Math.cos(a) * trunkR * 0.3, 0.75 * Math.min(1.3, rootScale), Math.sin(a) * trunkR * 0.3);
    for (let k = 0; k < 12; k++) R();   // keep the shape RNG in step with the original 6-ring roots
    const RR = rng(seed * 31 + i * 7 + 5);
    const nk = 10;
    for (let k = 0; k <= nk; k++) {
      pts.push(p.clone());
      // buttress: thick where it leaves the trunk, snaking out and diving into the turf
      radii.push(trunkR * 0.36 * Math.sqrt(rootScale) * Math.pow(1 - k / (nk + 1), 1.15));
      d.y += k < 2 ? 0.1 : -0.1; d.x += (RR() - 0.5) * 0.3 + Math.sin(k * 1.7 + i) * 0.12; d.z += (RR() - 0.5) * 0.3 + Math.cos(k * 1.3 + i) * 0.12; d.normalize();
      p.addScaledVector(d, 0.15 * rootScale);
    }
    tube(pts, radii, trunkR > 0.6 ? 12 : 8, 0, 0.7);
  }
  const trunkDir = new THREE.Vector3(lean, 1, leanZ || lean * 0.3).normalize();
  branch(new THREE.Vector3(0, -0.4, 0), trunkDir, height * 0.42, trunkR, 0);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the shading across each tube's u seam (j = 0 and j = radial share a position)
  const na = g.attributes.normal;
  for (const [base, n, radial] of tubes) {
    for (let i = 0; i < n; i++) {
      const a = base + i * (radial + 1), b = a + radial;
      const x = na.getX(a) + na.getX(b), y = na.getY(a) + na.getY(b), z = na.getZ(a) + na.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      na.setXYZ(a, x / l, y / l, z / l); na.setXYZ(b, x / l, y / l, z / l);
    }
  }
  g.computeBoundingSphere();
  return g;
}
