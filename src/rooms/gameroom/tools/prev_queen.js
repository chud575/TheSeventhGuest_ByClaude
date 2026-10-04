import * as THREE from 'three';
import { queenGeometry } from '../puzzleQueens.js';
import { boxwood2Texture } from '../textures3.js';
export default async (ctx, q) => {
  const bx = boxwood2Texture(ctx.textures);
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(1.0, 0.95, 0.88), map: bx.map, normalMap: bx.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: bx.ormMap, roughness: 0.9, vertexColors: true, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  const objs = [];
  for (let i = 0; i < 2; i++) { const g = new THREE.Mesh(queenGeometry(ctx.geometry, 1.4), m); g.position.set(i * 0.08 - 0.04, 0, 0.1); g.rotation.y = i; objs.push(g); }
  return { objs, view: { target: [0, 0.07, 0.1], dist: 0.45 } };
};
