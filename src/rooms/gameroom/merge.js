import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * (Game-room copy.) Collapse static meshes into one mesh per (material, shadow flags) — the room is
 * built from thousands of small parts (mouldings, spindles, china) and SwiftShader
 * pays per draw call. Subtrees flagged `userData.keep` (hotspot targets, animated
 * or puzzle objects, lights, FX) are left untouched.
 */
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];
  const visit = (o) => {
    if (o.userData.keep) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.visible && !Array.isArray(o.material) && !o.material.isShaderMaterial && !o.userData.noBake && !o.morphTargetInfluences) {
      const g = o.geometry;
      if (g.attributes.position && g.attributes.normal) {
        const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.renderOrder}`;
        let b = buckets.get(key);
        if (!b) buckets.set(key, (b = { material: o.material, cast: o.castShadow, receive: o.receiveShadow, renderOrder: o.renderOrder, items: [] }));
        b.items.push(o);
        victims.push(o);
      }
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  let merged = 0;
  for (const b of buckets.values()) {
    if (b.items.length < 2) continue;
    const geos = [];
    for (const o of b.items) {
      let g = o.geometry.clone();
      const keepColor = !!b.material.vertexColors;
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', ...(keepColor ? ['color'] : [])].includes(name)) g.deleteAttribute(name);
      if (keepColor && !g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      if (keepColor && g.attributes.color.itemSize !== 3) { const c = g.attributes.color, a = new Float32Array(c.count * 3); for (let i = 0; i < c.count; i++) { a[i * 3] = c.getX(i); a[i * 3 + 1] = c.getY(i); a[i * 3 + 2] = c.getZ(i); } g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); }
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.index) {
        const n = g.attributes.position.count;
        const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
        for (let i = 0; i < n; i++) idx[i] = i;
        g.setIndex(new THREE.BufferAttribute(idx, 1));
      }
      g.clearGroups();
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      g.applyMatrix4(m);
      if (m.determinant() < 0) {
        const ix = g.index.array;
        for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      }
      geos.push(g);
    }
    const mg = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!mg) continue;
    const mesh = new THREE.Mesh(mg, b.material);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.receive; mesh.renderOrder = b.renderOrder;
    mesh.name = `merged:${b.material.name || 'mat'}`;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    for (const o of b.items) { o.userData._merged = true; }
    merged += b.items.length;
  }
  // detach merged originals (keep empty groups; harmless)
  for (const o of victims) if (o.userData._merged) { o.parent.remove(o); }
  return merged;
}
