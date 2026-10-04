import * as THREE from 'three';
import * as T3 from '../textures3.js';
export default async (ctx, q) => {
  const fn = q.get('tex') || 'herringboneTexture';
  const rep = +(q.get('rep') || 1);
  const t = T3[fn](ctx.textures).withRepeat(rep, rep);
  const m = new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.ormMap, roughness: 1, clearcoat: 0.2 });
  const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), m); w.position.z = 0.01;
  return { objs: [w], view: { target: [0, 0, 0], dist: 1.4 } };
};
