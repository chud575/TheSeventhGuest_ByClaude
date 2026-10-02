import * as THREE from 'three';
import { rng } from './lib.js';

/**
 * A small colony of bats wheeling around the tower and turret: one dynamic
 * BufferGeometry (all bats, CPU-animated each frame — a few dozen triangles),
 * flat dark silhouettes with scalloped wings that flap and glide.
 */

// wing outline in bat space (x = out along the wing, z = back), scalloped trailing edge
const WING = [[0.0, 0.0], [0.12, -0.05], [0.28, -0.03], [0.36, 0.02], [0.3, 0.07], [0.24, 0.05], [0.19, 0.11], [0.13, 0.08], [0.08, 0.14], [0.03, 0.1]];

export function buildBats({ count = 9, seed = 66, centers }) {
  const R = rng(seed);
  const bats = [];
  for (let i = 0; i < count; i++) {
    const c = centers[i % centers.length];
    bats.push({
      c, r: c.r[0] + (c.r[1] - c.r[0]) * R(), y: c.y[0] + (c.y[1] - c.y[0]) * R(),
      speed: (0.35 + R() * 0.3) * (R() < 0.3 ? -1 : 1), phase: R() * Math.PI * 2, flap: 9 + R() * 5,
      wob: R() * 10, size: 1.1 + R() * 0.6,
    });
  }
  const triPerWing = WING.length - 2;
  const triPerBat = triPerWing * 2 + 2;
  const pos = new Float32Array(count * triPerBat * 9);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
  const mat = new THREE.MeshBasicMaterial({ color: 0x040507, side: THREE.DoubleSide, name: 'bats' });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'Bats';
  mesh.frustumCulled = false;
  mesh.userData.noBake = true;

  const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(0, 1, 0), _s = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const update = (t) => {
    let o = 0;
    const put = (v) => { pos[o++] = v.x; pos[o++] = v.y; pos[o++] = v.z; };
    for (const b of bats) {
      const a = b.phase + t * b.speed * (6 / b.r);
      const yy = b.y + Math.sin(t * 0.7 + b.wob) * 0.8 + Math.sin(t * 2.3 + b.wob * 2) * 0.25;
      const rr = b.r + Math.sin(t * 0.5 + b.wob) * 1.2;
      _p.set(b.c.x + Math.cos(a) * rr, yy, b.c.z + Math.sin(a) * rr);
      // forward = tangent of the circle
      const sgn = Math.sign(b.speed);
      _f.set(-Math.sin(a) * sgn, 0.05 * Math.cos(t * 2.3 + b.wob * 2), Math.cos(a) * sgn).normalize();
      _s.crossVectors(_f, _u).normalize();
      const up = tmp.crossVectors(_s, _f).normalize();
      // bank into the turn
      const bank = 0.45 * sgn;
      const sideB = _s.clone().multiplyScalar(Math.cos(bank)).addScaledVector(up, Math.sin(bank));
      const upB = up.clone().multiplyScalar(Math.cos(bank)).addScaledVector(_s, -Math.sin(bank));
      // flap (with glides)
      const glide = Math.sin(t * 0.9 + b.wob) > 0.55;
      const fl = glide ? 0.15 : Math.sin(t * b.flap + b.wob) * 0.9;
      const k = b.size;
      for (const side of [-1, 1]) {
        const ca = Math.cos(fl), sa = Math.sin(fl);
        const vtx = WING.map(([x, z]) => {
          const wx = x * ca * k, wy = x * sa * k * (x > 0.2 ? 1.25 : 1.0);
          return _p.clone().addScaledVector(sideB, side * wx).addScaledVector(upB, wy).addScaledVector(_f, -z * k);
        });
        for (let i = 1; i < vtx.length - 1; i++) { put(vtx[0]); put(vtx[i]); put(vtx[i + 1]); }
      }
      // body + head (two thin triangles)
      const head = _p.clone().addScaledVector(_f, 0.07 * k);
      const tail = _p.clone().addScaledVector(_f, -0.13 * k);
      const l = _p.clone().addScaledVector(sideB, -0.03 * k), r = _p.clone().addScaledVector(sideB, 0.03 * k);
      put(head); put(l); put(tail); put(head); put(tail); put(r);
    }
    g.attributes.position.needsUpdate = true;
  };
  update(0);
  return { mesh, update };
}
