import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export { RoundedBoxGeometry, mergeGeometries, mergeVertices };

/**
 * Geometry helpers for building Victorian interiors quickly and well.
 * Conventions: metres, Y up. UVs are in metres unless stated, so material
 * `repeat` = 1 / (texture tile size in metres).
 */

/** Box with world-scaled UVs on every face (uv = metres * uvScale). */
export function boxUV(w, h, d, uvScale = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    let u, v;
    if (nx > 0.5) { u = z; v = y; } else if (ny > 0.5) { u = x; v = z; } else { u = x; v = y; }
    uv.setXY(i, u * uvScale, v * uvScale);
  }
  return g;
}

/** Re-project UVs of any geometry by dominant normal axis (triplanar-ish box mapping), metres * scale. */
export function applyBoxUVs(geometry, scale = 1) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    if (nx >= ny && nx >= nz) { uv[i * 2] = z * scale; uv[i * 2 + 1] = y * scale; }
    else if (ny >= nz) { uv[i * 2] = x * scale; uv[i * 2 + 1] = z * scale; }
    else { uv[i * 2] = x * scale; uv[i * 2 + 1] = y * scale; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Flat plane (XY, facing +Z) with metre UVs. */
export function planeUV(w, h, uvScale = 1, segX = 1, segY = 1) {
  const g = new THREE.PlaneGeometry(w, h, segX, segY);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * uvScale, uv.getY(i) * h * uvScale);
  return g;
}

/**
 * Wall (XY plane, facing +Z, origin bottom-left) with rectangular or arched openings.
 * openings: [{ x, y, w, h, arch?: boolean }] in metres from bottom-left.
 * thickness > 0 extrudes the wall backwards (-Z) giving proper jamb reveals.
 */
export function wallWithOpenings(width, height, openings = [], { thickness = 0, uvScale = 1 } = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(width, 0); shape.lineTo(width, height); shape.lineTo(0, height); shape.lineTo(0, 0);
  for (const o of openings) {
    const p = new THREE.Path();
    if (o.arch) {
      const r = o.w / 2;
      p.moveTo(o.x, o.y);
      p.lineTo(o.x, o.y + o.h - r);
      p.absarc(o.x + r, o.y + o.h - r, r, Math.PI, 0, true);
      p.lineTo(o.x + o.w, o.y);
      p.lineTo(o.x, o.y);
    } else {
      p.moveTo(o.x, o.y); p.lineTo(o.x, o.y + o.h); p.lineTo(o.x + o.w, o.y + o.h); p.lineTo(o.x + o.w, o.y); p.lineTo(o.x, o.y);
    }
    shape.holes.push(p);
  }
  let g;
  if (thickness > 0) {
    g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 24 });
    g.translate(0, 0, -thickness);
    g = applyBoxUVs(g, uvScale);
  } else {
    g = new THREE.ShapeGeometry(shape, 24);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
  }
  return g;
}

/**
 * Sweep a 2D profile along a 3D polyline (mitered corners) — mouldings, rails, frames.
 * profile: Vector2[] where x = offset out from the path's "outward" side, y = offset along "up".
 * path: Vector3[]; up: Vector3 reference up (default Y). closed: loop the path.
 * UV: u = distance along path in metres * uvScale, v = 0..1 across the profile (arc length).
 */
export function sweepProfile(profile, path, { closed = false, up = new THREE.Vector3(0, 1, 0), uvScale = 1, flipOutward = false } = {}) {
  const n = path.length;
  const segs = closed ? n : n - 1;
  // profile arc-length for V
  const pv = [0];
  for (let i = 1; i < profile.length; i++) pv.push(pv[i - 1] + profile[i].distanceTo(profile[i - 1]));
  const plen = pv[pv.length - 1] || 1;
  const positions = [], uvs = [], indices = [];
  let uAcc = 0;
  const tangentAt = (i) => {
    const a = path[(i - 1 + n) % n], b = path[i], c = path[(i + 1) % n];
    let tin = null, tout = null;
    if (closed || i > 0) tin = new THREE.Vector3().subVectors(b, a).normalize();
    if (closed || i < n - 1) tout = new THREE.Vector3().subVectors(c, b).normalize();
    return { tin, tout };
  };
  const frame = (t) => {
    const outward = new THREE.Vector3().crossVectors(t, up).normalize();
    if (flipOutward) outward.negate();
    const u2 = new THREE.Vector3().crossVectors(outward, t).normalize();
    return { outward, up: flipOutward ? u2.negate() : u2 };
  };
  for (let s = 0; s < segs; s++) {
    const i0 = s, i1 = (s + 1) % n;
    const A = path[i0], B = path[i1];
    const t = new THREE.Vector3().subVectors(B, A);
    const L = t.length(); t.normalize();
    const f = frame(t);
    // miter planes at both ends
    const miter = (i, isStart) => {
      const { tin, tout } = tangentAt(i);
      if (isStart) return tin ? new THREE.Vector3().addVectors(tin, t).normalize() : t.clone();
      return tout ? new THREE.Vector3().addVectors(t, tout).normalize() : t.clone();
    };
    const mA = miter(i0, true), mB = miter(i1, false);
    const base = positions.length / 3;
    for (let end = 0; end < 2; end++) {
      const P = end === 0 ? A : B, m = end === 0 ? mA : mB;
      for (let k = 0; k < profile.length; k++) {
        const off = new THREE.Vector3().addScaledVector(f.outward, profile[k].x).addScaledVector(f.up, profile[k].y);
        // project offset onto miter plane along t
        const d = -off.dot(m) / t.dot(m);
        const q = new THREE.Vector3().copy(P).add(off).addScaledVector(t, d);
        positions.push(q.x, q.y, q.z);
        const along = uAcc + (end === 0 ? 0 : L) + d;
        uvs.push(along * uvScale, pv[k] / plen);
      }
    }
    const np = profile.length;
    for (let k = 0; k < np - 1; k++) {
      const a = base + k, b = base + k + 1, c = base + np + k, d = base + np + k + 1;
      indices.push(a, c, b, b, c, d);
    }
    uAcc += L;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Common Victorian moulding profiles (x = out from wall, y = up), in metres. */
export const PROFILES = {
  crown(h = 0.22, depth = 0.16) {
    const p = [];
    const pts = [[0, 0], [0.012, 0], [0.012, 0.015], [0.02, 0.02], [0.03, 0.035], [0.045, 0.06], [0.06, 0.07], [0.075, 0.072]];
    // cyma recta curve
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([0.075 + t * 0.06, 0.075 + Math.sin(t * Math.PI - Math.PI / 2) * 0.03 + t * 0.07]); }
    pts.push([0.14, 0.18], [0.15, 0.185], [0.15, 0.2], [0.155, 0.205], [0.16, 0.22], [0.0, 0.22]);
    for (const [x, y] of pts) p.push(new THREE.Vector2(x * depth / 0.16, y * h / 0.22));
    return p;
  },
  baseboard(h = 0.24, depth = 0.025) {
    const pts = [[0, 0], [depth, 0], [depth, h * 0.72], [depth * 0.8, h * 0.76], [depth * 0.85, h * 0.82], [depth * 0.55, h * 0.9], [depth * 0.45, h], [0, h]];
    return pts.map(([x, y]) => new THREE.Vector2(x, y));
  },
  chairRail(h = 0.07, depth = 0.03) {
    const p = [new THREE.Vector2(0, 0)];
    for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + (i / 12) * Math.PI; p.push(new THREE.Vector2(depth * 0.4 + Math.cos(a) * depth * 0.6, h * 0.5 + Math.sin(a) * h * 0.35)); }
    p.push(new THREE.Vector2(depth * 0.3, h), new THREE.Vector2(0, h));
    return p;
  },
  /** ornate picture frame profile (x = out of wall plane, y = inward from outer edge) */
  frame(width = 0.09, depth = 0.05) {
    const pts = [];
    pts.push([0, 0], [depth * 0.7, 0], [depth, width * 0.06]);
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([depth - Math.sin(t * Math.PI) * depth * 0.2 + 0.0, width * (0.06 + t * 0.34)]); }
    pts.push([depth * 0.75, width * 0.45], [depth * 0.8, width * 0.55]);
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([depth * 0.8 - t * depth * 0.45 - Math.sin(t * Math.PI) * depth * 0.08, width * (0.55 + t * 0.35)]); }
    pts.push([depth * 0.3, width * 0.95], [depth * 0.25, width]);
    return pts.map(([x, y]) => new THREE.Vector2(x, y));
  },
};

/**
 * Picture/mirror frame in the XY plane facing +Z, centred at origin.
 * w,h = inner opening (the canvas size). Returns geometry; UV v spans the profile.
 */
export function frameGeometry(w, h, { width = 0.09, depth = 0.05, profile = null, uvScale = 4 } = {}) {
  const prof = profile || PROFILES.frame(width, depth);
  // path = outer rectangle, profile x pushes toward +Z (out of wall), y inward
  const path = [new THREE.Vector3(-w / 2 - width, -h / 2 - width, 0), new THREE.Vector3(w / 2 + width, -h / 2 - width, 0), new THREE.Vector3(w / 2 + width, h / 2 + width, 0), new THREE.Vector3(-w / 2 - width, h / 2 + width, 0)];
  // for a loop in XY, "up" reference is +Z so outward = in-plane outward direction
  const g = sweepProfile(prof.map((p) => new THREE.Vector2(-p.y, p.x)), path, { closed: true, up: new THREE.Vector3(0, 0, 1), uvScale });
  return g;
}

/**
 * Heavy draped curtain (XY plane, hanging from y=0 down to -height, folds bulge along Z).
 * Regular pinch-pleats at the heading relax into broad, irregular folds at the hem.
 * Options: folds (pleat count), depth (fold depth, m), pool (extra length pooling on the floor),
 * tieback (0..1 pinch toward one side at ~60% height), seed.
 */
export function curtainGeometry({ width = 1.2, height = 2.6, folds = 9, depth = 0.08, gather = 0.6, segX = 140, segY = 64, seed = 1, tieback = 0, pool = 0 } = {}) {
  const g = new THREE.PlaneGeometry(width, height, segX, segY);
  g.translate(0, -height / 2, 0);
  const pos = g.attributes.position;
  const rnd = (i) => { const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
  // irregular bottom fold spectrum
  const waves = [];
  for (let k = 0; k < 5; k++) waves.push({ f: folds * (0.45 + 0.35 * k) * (0.9 + 0.2 * rnd(k + 3)), a: 1 / (1 + k * 0.9), p: rnd(k + 11) * Math.PI * 2 });
  const aSum = waves.reduce((s, w) => s + w.a, 0);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    const v = -y / height;                          // 0 top .. 1 bottom
    const u = x / width + 0.5;
    // heading: crisp pinch pleats
    const ph = u * folds;
    const fr = ph - Math.floor(ph);
    const pleat = Math.pow(Math.abs(Math.sin(fr * Math.PI)), 0.6) * 2 - 1;
    const zTop = pleat * depth * 0.55;
    // body: broad irregular folds, deepening toward the hem
    let zb = 0;
    for (const w of waves) zb += Math.sin(u * w.f * Math.PI * 2 + w.p + v * 0.8) * w.a;
    zb = (zb / aSum) * depth * 1.9;
    const blend = Math.min(1, Math.pow(v * 1.6, 0.75));
    let z = zTop * (1 - blend) + zb * blend;
    // the heading is gathered (narrower) and the folds spread slightly toward the hem
    x *= 1 - gather * 0.1 * (1 - v);
    if (tieback > 0) {
      const tb = Math.exp(-((v - 0.62) ** 2) / 0.015);
      const pull = tieback * tb;
      x = x * (1 - pull * 0.55) - pull * 0.22 * width;
      z *= 1 + pull * 0.6;
    }
    let yy = y;
    if (pool > 0 && v > 1 - pool / height) {
      const k = (v - (1 - pool / height)) / (pool / height);
      z += k * k * pool * 0.8;
      yy = y + k * k * pool * 0.6;
    }
    pos.setXYZ(i, x, yy, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Lathe from [[r,y],...] pairs. */
export function latheFromProfile(points, segments = 32) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), segments);
}

/** Raised panel (door/wainscot) in XY facing +Z: border frame + bevelled raised field. */
export function raisedPanel(w, h, { border = 0.08, fieldDepth = 0.012, frameDepth = 0.02, bevel = 0.025 } = {}) {
  const parts = [];
  const frame = new THREE.Shape();
  frame.moveTo(-w / 2, -h / 2); frame.lineTo(w / 2, -h / 2); frame.lineTo(w / 2, h / 2); frame.lineTo(-w / 2, h / 2); frame.lineTo(-w / 2, -h / 2);
  const hole = new THREE.Path();
  const iw = w / 2 - border, ih = h / 2 - border;
  hole.moveTo(-iw, -ih); hole.lineTo(-iw, ih); hole.lineTo(iw, ih); hole.lineTo(iw, -ih); hole.lineTo(-iw, -ih);
  frame.holes.push(hole);
  parts.push(new THREE.ExtrudeGeometry(frame, { depth: frameDepth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }));
  const field = new THREE.Shape();
  const fw = iw - bevel * 0.2, fh = ih - bevel * 0.2;
  field.moveTo(-fw + bevel, -fh + bevel); field.lineTo(fw - bevel, -fh + bevel); field.lineTo(fw - bevel, fh - bevel); field.lineTo(-fw + bevel, fh - bevel); field.lineTo(-fw + bevel, -fh + bevel);
  parts.push(new THREE.ExtrudeGeometry(field, { depth: fieldDepth, bevelEnabled: true, bevelThickness: fieldDepth, bevelSize: bevel, bevelSegments: 3 }));
  const g = mergeGeometries(parts.map((p) => applyBoxUVs(p, 1)));
  return g;
}
