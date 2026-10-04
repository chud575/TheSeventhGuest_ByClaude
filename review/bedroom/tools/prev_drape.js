import { TextureForge } from '../../../src/engine/materials/TextureForge.js';
import { tornDrape } from '../../../src/rooms/bedroom/textures.js';
export default async function (THREE, r) {
  const tf = new TextureForge(r);
  const ctx = { textures: { generate: (k, d) => tf.generate(k, d) } };
  const objs = [];
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: 0xd0c8a0 }));
  bg.position.z = -0.3; objs.push(bg);
  const sets = [tornDrape(ctx, { seed: 1 }), tornDrape(ctx, { seed: 2 }), tornDrape(ctx, { seed: 4, strip: true })];
  const dims = [[0.7, 2.4], [0.7, 2.4], [0.16, 1.4]];
  let x = -0.9;
  sets.forEach((set, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(...dims[i]), new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }));
    m.position.set(x, 0, 0); x += 0.85; objs.push(m);
  });
  // a zoomed copy of panel 1
  const z = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * 2.2, 2.4 * 2.2), new THREE.MeshStandardMaterial({ map: sets[1].map, alphaTest: 0.5, side: THREE.DoubleSide }));
  z.position.set(1.75, 0.0, 0); objs.push(z);
  return { objs, view: { pos: [0.5, 0, 5.2], target: [0.5, 0, 0] } };
}
