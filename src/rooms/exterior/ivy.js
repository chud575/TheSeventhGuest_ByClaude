import * as THREE from 'three';
import { rng } from './lib.js';

/**
 * Creeping ivy: vines random-walk up a wall or round a column (upward bias, gravity
 * droop, the odd side branch), shedding small three-lobed leaves that sit 2-6 cm off
 * the surface, facing out with a random tilt. All leaves of all patches are one
 * instanced mesh; per-leaf colour runs from near-black old growth to dull olive tips.
 *
 * Surfaces are described by a mapping (u, v) -> { p: Vector3, n: Vector3 }, with u
 * across and v up (both in metres), e.g. ivyPlane() / ivyCylinder().
 */

export function ivyPlane(origin, right, normal) {
  const o = origin.clone(), r = right.clone().normalize(), n = normal.clone().normalize();
  const up = new THREE.Vector3().crossVectors(n, r).normalize();
  if (up.y < 0) up.negate();
  return (u, v) => ({ p: o.clone().addScaledVector(r, u).addScaledVector(up, v), n });
}

export function ivyCylinder(center, radius) {
  return (u, v) => {
    const a = u / radius;
    const n = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    return { p: new THREE.Vector3(center.x + n.x * radius, center.y + v, center.z + n.z * radius), n };
  };
}

function leafTexture(ctx) {
  return ctx.textures.canvas('ext:ivyLeaf2', 128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    // three-lobed ivy leaf, stem at the bottom centre
    const lobe = (ang, len, wid) => {
      g.save();
      g.translate(w / 2, h * 0.86);
      g.rotate(ang);
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(wid, -len * 0.25, wid * 0.9, -len * 0.75, 0, -len);
      g.bezierCurveTo(-wid * 0.9, -len * 0.75, -wid, -len * 0.25, 0, 0);
      g.fill();
      g.restore();
    };
    const grd = g.createRadialGradient(w / 2, h * 0.7, 4, w / 2, h * 0.55, w * 0.55);
    grd.addColorStop(0, 'rgb(150,160,120)');
    grd.addColorStop(1, 'rgb(205,215,180)');
    g.fillStyle = grd;
    lobe(0, h * 0.78, w * 0.26);
    lobe(-0.95, h * 0.55, w * 0.2);
    lobe(0.95, h * 0.55, w * 0.2);
    lobe(-1.7, h * 0.32, w * 0.13);
    lobe(1.7, h * 0.32, w * 0.13);
    // pale veins
    g.strokeStyle = 'rgba(255,255,240,0.55)';
    g.lineWidth = 2;
    for (const a of [0, -0.95, 0.95]) {
      g.beginPath(); g.moveTo(w / 2, h * 0.86);
      g.lineTo(w / 2 + Math.sin(a) * h * 0.5 * (a ? 0.9 : 1.3), h * 0.86 - Math.cos(a) * h * 0.5 * (a ? 0.9 : 1.3));
      g.stroke();
    }
  }, { tile: false });
}

/**
 * patches: [{ surf, u0, v0, uSpan:[min,max], height, vines, seed, density, size }]
 */
export function buildIvy(ctx, patches) {
  const mats = [];
  const cols = [];
  const c = new THREE.Color();
  const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  const z = new THREE.Vector3(0, 0, 1);
  for (const P of patches) {
    const R = rng(P.seed || 1);
    const size = P.size || 0.12;
    const walk = (u, v, len, depth) => {
      let ang = Math.PI / 2 + (R() - 0.5) * 0.8;
      let travelled = 0;
      while (travelled < len) {
        const step = 0.06;
        ang += (R() - 0.5) * 0.7;
        ang += (Math.PI / 2 - ang) * 0.12;   // keep climbing
        u += Math.cos(ang) * step; v += Math.sin(ang) * step;
        if (P.uSpan && (u < P.uSpan[0] || u > P.uSpan[1])) { ang = Math.PI - ang; u = Math.min(P.uSpan[1], Math.max(P.uSpan[0], u)); }
        if (v < 0) v = 0;
        travelled += step;
        const dens = (P.density || 1) * (1 - 0.5 * travelled / len);
        // leaves: a few per step, crowding the older growth
        const nl = R() < dens ? 1 + Math.floor(R() * 2.2 * dens) : 0;
        for (let k = 0; k < nl; k++) {
          const uu = u + (R() - 0.5) * 0.22, vv = v + (R() - 0.5) * 0.16;
          const { p, n } = P.surf(uu, vv);
          const s = size * (0.55 + R() * 0.7) * (1 - 0.35 * travelled / len);
          const pos = p.clone().addScaledVector(n, 0.02 + R() * 0.05);
          // face out from the wall, leaf tip up-ish, random tilt
          tmpQ.setFromUnitVectors(z, n);
          tmpE.set((R() - 0.5) * 1.1 - 0.35, (R() - 0.5) * 1.1, (R() - 0.5) * 1.4);
          const q = tmpQ.clone().multiply(new THREE.Quaternion().setFromEuler(tmpE));
          mats.push(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(s, s, s)));
          const t = travelled / len;
          const v0 = 0.45 + R() * 0.55;
          if (R() < 0.12) c.setRGB(0.07 * v0, 0.045 * v0, 0.02 * v0);           // dead brown leaf
          else c.setRGB((0.02 + 0.03 * t) * v0, (0.035 + 0.04 * t) * v0, (0.018 + 0.015 * t) * v0);
          cols.push(c.clone());
        }
        if (depth < 2 && R() < 0.05) walk(u, v, (len - travelled) * (0.4 + R() * 0.5), depth + 1);
      }
    };
    for (let i = 0; i < (P.vines || 3); i++) {
      const u = P.u0 + (P.uSpan ? (R() - 0.5) * (P.uSpan[1] - P.uSpan[0]) * 0.6 : (R() - 0.5) * 0.6);
      walk(u, (P.v0 || 0) + R() * 0.3, P.height * (0.6 + R() * 0.5), 0);
    }
  }
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.42, 0);
  const tex = leafTexture(ctx);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0, color: 0xffffff, envMapIntensity: 0.6, name: 'ivy' });
  mat.userData.rim = 0.6;
  mat.userData.flashRim = 0.4;
  const m = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((mx, i) => { m.setMatrixAt(i, mx); m.setColorAt(i, cols[i]); });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = true; m.receiveShadow = true;
  m.name = 'ivy';
  m.computeBoundingSphere();
  return m;
}
