import { buildDoll } from '../../../src/rooms/bedroom/doll.js';
export default async (THREE) => {
  const G = { latheFromProfile: (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg) };
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xe6d8c6, roughness: 0.3, clearcoat: 0.6, vertexColors: true });
  const cloth = (h) => new THREE.MeshPhysicalMaterial({ color: h, roughness: 0.7, sheen: 0.6, sheenColor: 0xffffff, vertexColors: false });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x3a5a8a, roughness: 0.05, clearcoat: 1 });
  const mats = { dollVelvet: (h) => cloth(h), dollHair: (h) => new THREE.MeshPhysicalMaterial({ color: h, roughness: 0.5, vertexColors: true }), dollFace: () => ({ mat: skin, skin: new THREE.MeshPhysicalMaterial({ color: 0xe6d8c6, roughness: 0.3, clearcoat: 0.6 }), glass }),
    laceFrill: new THREE.MeshStandardMaterial({ color: 0xddd5c5, side: THREE.DoubleSide }), dollSash: cloth(0x4a2a2c), pearl: cloth(0xffffff), stocking: cloth(0xcfc8b8), shoe: cloth(0x111111) };
  const ctx = { geometry: G };
  const objs = [];
  const specs = [{ seed: 1, hair: 0x5a2e14, dress: 0x7a2232 }, { seed: 2, bonnet: true, hair: 0xb89050, dress: 0x2c3e6a }, { seed: 3, hair: 0x2a140a, dress: 0xcfc2aa }, { seed: 12, bonnet: true, bonnetBack: true, hair: 0xc09a58, dress: 0x8a7290 }];
  specs.forEach((o, i) => { const d = buildDoll(ctx, mats, { size: 0.3, ...o }); d.position.x = (i - 1.5) * 0.26; d.rotation.y = 0.35 * (i % 2 ? -1 : 1); objs.push(d); });
  const cam = new THREE.Vector3(0, 0.3, 1.3);
  return { objs, view: { pos: [0, 0.32, q('far') ? 1.6 : 1.05], target: [0, 0.2, 0] } };
};
const q = (k) => new URLSearchParams(location.search).get(k);
