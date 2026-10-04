import * as THREE from 'three';
import { flockDamask4Texture } from '../textures3.js';
export default async (ctx, q) => {
  const t = flockDamask4Texture(ctx.textures).withRepeat(1 / 0.21, 1 / 0.3);
  const mk = flockDamask4Texture(ctx.textures, { mask: true }).withRepeat(1 / 0.21, 1 / 0.3);
  const m = new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.ormMap, roughness: 1, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.12, 0.3, 0.16), sheenColorMap: mk.map, color: new THREE.Color(1.6, 1.6, 1.6) });
  const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), m); w.position.z = 0.01;
  return { objs: [w], view: { target: [0, 0, 0], dist: 1.4 } };
};
