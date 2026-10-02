import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * mergeStatic(root) — bake every static mesh under `root` into one mesh per
 * (material, shadow flags) bucket. Typical rooms drop from ~1000 to ~150 draw calls.
 * (contributed by the foyer)
 *
 * Skipped automatically: InstancedMesh, SkinnedMesh, Points, ShaderMaterial (fx),
 * multi-material meshes, geometries with attributes other than position/normal/uv,
 * and any subtree whose ancestor has `userData.dynamic = true` (animated parts,
 * hotspot objects you raycast against, puzzle pieces) or `userData.noMerge`.
 * Call it at the END of build(), after everything is positioned. Returns stats.
 */
export function mergeStatic(root, { minCount = 2 } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const isDynamic = (o) => { for (let p = o; p; p = p.parent) { if (p.userData?.dynamic || p.userData?.noMerge) return true; if (p === root) break; } return false; };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.isPoints || !o.visible) return;
    const m = o.material;
    if (!m || Array.isArray(m) || m.isShaderMaterial || m.isRawShaderMaterial) return;
    if (o.morphTargetInfluences || o.renderOrder) return;
    const g = o.geometry;
    const names = Object.keys(g.attributes);
    if (!g.attributes.position || !g.attributes.normal || !g.attributes.uv) return;
    if (names.some((k) => k !== 'position' && k !== 'normal' && k !== 'uv')) return;
    if (isDynamic(o)) return;
    const key = `${m.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material: m, cast: o.castShadow, receive: o.receiveShadow, items: [] }));
    b.items.push(o);
  });
  let removed = 0, created = 0;
  for (const b of buckets.values()) {
    if (b.items.length < minCount) continue;
    const geos = [];
    for (const o of b.items) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.morphAttributes = {};
      g.clearGroups();
      const mtx = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      g.applyMatrix4(mtx);
      if (mtx.determinant() < 0) {
        // mirrored instance: restore counter-clockwise winding
        for (const name of ['position', 'normal', 'uv']) {
          const a = g.attributes[name], s = a.itemSize, arr = a.array;
          for (let t = 0; t < a.count; t += 3) for (let k = 0; k < s; k++) { const i1 = (t + 1) * s + k, i2 = (t + 2) * s + k; const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp; }
        }
      }
      for (const n of Object.keys(g.attributes)) if (g.attributes[n].isInterleavedBufferAttribute) g.setAttribute(n, g.attributes[n].clone());
      geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.receive;
    mesh.name = `merged:${b.material.name || 'mat'}`;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    created++;
    for (const o of b.items) { o.parent?.remove(o); removed++; }
  }
  // drop now-empty groups
  const empties = [];
  root.traverse((o) => { if (o !== root && o.isGroup && o.children.length === 0 && !o.userData.dynamic) empties.push(o); });
  for (const e of empties) e.parent?.remove(e);
  return { removed, created };
}
