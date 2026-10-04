import { knightGeometry } from '../../../src/engine/lib/contrib/bedroom-knight.js';
export default async (THREE) => {
  const g = knightGeometry(1);
  const bone = new THREE.MeshPhysicalMaterial({ color: 0xe8dcc4, roughness: 0.45, clearcoat: 0.3, vertexColors: true });
  const eb = new THREE.MeshPhysicalMaterial({ color: 0x1a1410, roughness: 0.28, clearcoat: 0.8, vertexColors: true });
  const objs = [];
  const angles = [Math.PI / 2, 0, -Math.PI / 2 + 0.4, Math.PI];
  angles.forEach((a, i) => { const m = new THREE.Mesh(g, i % 2 ? eb : bone); m.position.x = (i - 1.5) * 0.85; m.rotation.y = a; objs.push(m); });
  return { objs, view: { pos: [0, 1.2, 4.6], target: [0, 0.5, 0] } };
};
