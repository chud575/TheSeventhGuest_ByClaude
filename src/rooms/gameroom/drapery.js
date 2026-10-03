import * as THREE from 'three';

/**
 * Heavy velvet drapery for the game-room windows, modelled rather than waved:
 *  - drapeGeometry: a panel hung from pinch pleats at the header, falling in
 *    straight gravity folds, gathered by a tieback (the inner edge sweeps up to
 *    it in a long diagonal), flaring out again below and pooling on the floor.
 *    Every fold has its own spacing, depth and phase; fold depth grows where the
 *    cloth is gathered (the width has to go somewhere) and relaxes toward the hem.
 *  - swagGeometry: a festoon hanging between two points with curved catenary
 *    pleats and a forward belly.
 *  - jabotGeometry: a pleated cascade with a diagonal hem.
 * All are indexed grids with smooth normals and metre UVs. Local frame: x across
 * (outer edge at -w/2), y up (header at y = 0), z toward the room.
 */

function rng(seed) { let s = (seed * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Irregular fold field: returns z offset for a stretched-across coordinate u (0..1) */
function foldField(n, seed) {
  const r = rng(seed);
  // irregular fold centres
  const cuts = [0];
  for (let i = 0; i < n; i++) cuts.push(cuts[cuts.length - 1] + 0.7 + r() * 0.6);
  const total = cuts[cuts.length - 1];
  const amps = [], phases = [];
  for (let i = 0; i < n; i++) { amps.push(0.65 + r() * 0.7); phases.push(r()); }
  return (u, sharp = 0.5) => {
    const x = u * total;
    let k = 0; while (k < n - 1 && x > cuts[k + 1]) k++;
    const f = (x - cuts[k]) / (cuts[k + 1] - cuts[k]);
    // rounded, slightly asymmetric fold (velvet never creases to a knife-edge, nor flattens into a ribbon)
    const th = f * Math.PI * 2;
    const shaped = Math.cos(th) * (1 - 0.18 * sharp) + 0.18 * sharp * Math.cos(2 * th + phases[k] * 6.28);
    return { z: shaped * amps[k], k, amp: amps[k], ph: phases[k] };
  };
}

export function drapeGeometry({ width = 0.62, height = 3.0, folds = 7, depth = 0.055, tieback = 0.56, tieW = 0.16, pool = 0.12, seed = 1, segX = 72, segY = 90 } = {}) {
  const field = foldField(folds, seed);
  const header = foldField(folds * 2, seed + 7);
  const r = rng(seed + 3);
  const lean = (r() - 0.5) * 0.02;
  const pos = [], uv = [], idx = [];
  const H = height + pool;
  for (let j = 0; j <= segY; j++) {
    const v = j / segY;                       // 0 header .. 1 end of the pool
    const yHang = -v * H;
    // horizontal gather: 1 at the tieback, easing off above (long sweep) and below (quick flare)
    const vt = tieback;
    // the leading edge runs in a near-straight diagonal down to the cord, then falls almost plumb, flaring gently to the floor
    const above = v < vt ? Math.pow(v / vt, 1.15) : 0;
    const below = v >= vt ? 1 - smooth(vt, 1.0, v) * 0.5 : 0;
    const gather = v < vt ? above : below;
    // width at this height: full at the header, tieW at the tieback, ~45% of full at the floor
    const wHere = width + (tieW - width) * gather;
    for (let i = 0; i <= segX; i++) {
      const u = i / segX;
      // cloth is gathered toward the outer edge (-w/2)
      let x = -width / 2 + u * wHere;
      // fold depth: pinched pleats in the header, straight falls, deepening where gathered
      const f = field(u + lean * v, 0.4);
      const comp = Math.sqrt(width / Math.max(wHere, 0.05));
      let amp = depth * f.amp * Math.min(2.6, comp);
      let z = f.z * depth * Math.min(2.6, comp) * (0.8 + 0.2 * Math.sin(v * 7 + f.ph * 6));
      // secondary ripples: small folds that come and go down the drop
      z += depth * 0.22 * Math.sin(u * folds * 2.0 * Math.PI * 2.0 + f.ph * 9.0 + v * 2.5) * (0.5 + 0.5 * Math.sin(v * 4.0 + f.ph * 3.0));
      if (v < 0.07) {
        const hp = header(u, 0.9);
        const tH = smooth(0.0, 0.07, v);
        z = z * tH + hp.z * depth * 0.7 * (1 - tH);
        if (v < 0.015) z *= 0.6;
      }
      // folds drift slightly sideways as they fall (no perfectly vertical ribbons)
      x += Math.sin(v * 5.0 + f.ph * 6.28) * 0.006 * (1 + gather);
      // the inner edge rolls back on itself where it sweeps to the tieback
      // a bulge just above the tieback where the cloth blouses over the cord
      z += 0.035 * Math.exp(-(((v - (vt - 0.05)) / 0.05) ** 2));
      let y = yHang;
      // pool: below the floor line the cloth spills forward over the boards
      if (-yHang > height) {
        const over = -yHang - height;
        y = -height + 0.004 + 0.012 * Math.max(0, f.z) * (1 - over / pool);
        z += over * (0.9 + 0.5 * f.amp) + 0.01;
        x += (u - 0.5) * over * 0.6;
      }
      pos.push(x, y, z + amp * 0.2);
      uv.push(u * width, -yHang);
    }
  }
  for (let j = 0; j < segY; j++) for (let i = 0; i < segX; i++) {
    const a = j * (segX + 1) + i, b = a + segX + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.tieY = -tieback * H;
  g.userData.tieX = -width / 2 + tieW / 2;
  return g;
}

/** A festoon swag between x = -w/2 and w/2 hanging from y = 0, sag = drop at the centre. */
export function swagGeometry({ width = 0.9, drop = 0.42, top = 0.08, pleats = 5, belly = 0.07, segX = 60, segY = 30 } = {}) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= segY; j++) {
    const v = j / segY;
    for (let i = 0; i <= segX; i++) {
      const u = i / segX;
      const s = Math.sin(u * Math.PI);
      const d = top + (drop - top) * Math.pow(s, 0.9);
      const x = (u - 0.5) * width * (1 - 0.06 * v * s);
      const y = -v * d;
      // catenary pleats: horizontal folds that follow the swag curve
      const pl = Math.sin(v * Math.PI * pleats) * 0.014 * s * (0.4 + 0.6 * v);
      const z = belly * s * Math.sin(v * Math.PI * 0.85) + pl + 0.01 * v;
      pos.push(x, y, z);
      uv.push(u * width, v * d);
    }
  }
  for (let j = 0; j < segY; j++) for (let i = 0; i < segX; i++) {
    const a = j * (segX + 1) + i, b = a + segX + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Pleated cascade (jabot) hanging from y = 0, long at the outer edge (u = 0), short at the inner. */
export function jabotGeometry({ width = 0.2, long = 0.75, short = 0.3, pleats = 4, depth = 0.04, segX = 40, segY = 40 } = {}) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= segY; j++) {
    const v = j / segY;
    for (let i = 0; i <= segX; i++) {
      const u = i / segX;
      const len = long + (short - long) * u;
      const y = -v * len;
      const tri = Math.abs(((u * pleats) % 1) - 0.5) * 2;          // knife pleats, softened
      const z = (Math.pow(tri, 1.4) - 0.5) * depth * (0.6 + 0.4 * v) + 0.03;
      const x = (u - 0.5) * width * (0.6 + 0.4 * v);
      pos.push(x, y, z);
      uv.push(u * width, -y);
    }
  }
  for (let j = 0; j < segY; j++) for (let i = 0; i < segX; i++) {
    const a = j * (segX + 1) + i, b = a + segX + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Twisted silk cord tieback loop with a tassel, centred on (0,0,0), wrapping a gathered bundle of half-width hw. */
export function tiebackGeometry({ hw = 0.09, depth = 0.11, cord = 0.011 } = {}) {
  const parts = [];
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * hw, Math.sin(a * 2) * 0.006, Math.sin(a) * depth * 0.5 + depth * 0.45));
  }
  const loop = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 80, cord, 8, true);
  // twist: ridges along the cord
  const p = loop.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + 0.12 * Math.sin(i * 1.7);
    p.setY(i, p.getY(i) * k);
  }
  loop.computeVertexNormals();
  parts.push(loop);
  // tassel hanging from the outer side: knob, skirt of threads
  const knob = new THREE.SphereGeometry(0.022, 14, 10); knob.scale(1, 1.2, 1); knob.translate(-hw - 0.01, -0.05, depth * 0.5); parts.push(knob);
  const skirt = new THREE.LatheGeometry([[0.012, 0], [0.026, -0.03], [0.034, -0.1], [0.036, -0.15], [0.0, -0.152]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
  const sp = skirt.attributes.position;
  for (let i = 0; i < sp.count; i++) { const a = Math.atan2(sp.getZ(i), sp.getX(i)); const k = 1 + 0.08 * Math.sin(a * 22); sp.setX(i, sp.getX(i) * k); sp.setZ(i, sp.getZ(i) * k); }
  skirt.computeVertexNormals();
  skirt.translate(-hw - 0.01, -0.075, depth * 0.5); parts.push(skirt);
  return parts;
}
