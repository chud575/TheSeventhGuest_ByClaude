import * as THREE from 'three';
import { buildSideChair } from '../props.js';
export default async (ctx, q) => {
  const wood = new THREE.MeshPhysicalMaterial({ color: 0x4a2414, roughness: 0.45, clearcoat: 0.4 });
  const seat = new THREE.MeshStandardMaterial({ color: 0x3a0e08, roughness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: 0.3 });
  const c = buildSideChair(ctx, { wood, carve: wood, seat, brass });
  c.position.z = 0.4;
  return { objs: [c], view: { target: [0, 0.6, 0.3], dist: 2.2 } };
};
