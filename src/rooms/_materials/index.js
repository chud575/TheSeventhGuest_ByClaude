import * as THREE from 'three';

/**
 * _materials — a neutral-lit gallery of every procedural material in the engine
 * library. Use it to preview materials before using them in a room:
 *   npm run shot -- --room _materials --node all --out review/materials.png
 *   (close-ups: row1 .. row4)
 */
const TILES = [
  ['damask', {}], ['damask', { variant: 1, base: [0.3, 0.06, 0.06], motif: [0.42, 0.1, 0.09], accentStrength: 0.6 }], ['parquet', { species: 'oak' }], ['floorboards', {}], ['mahogany', {}], ['walnut', {}], ['ebony', {}],
  ['rug', { palette: 'heriz', aspect: 0.7 }], ['rug', { palette: 'tabriz', aspect: 0.7, seed: 4 }], ['gilded', { pattern: 0 }], ['gilded', { pattern: 1 }], ['gilded', { pattern: 6, ground: 1 }], ['gilded', { pattern: 2 }], ['gold', {}],
  ['marble', { type: 'carrara' }], ['marble', { type: 'nero' }], ['marble', { type: 'verde' }], ['checker', { tiles: 4 }], ['plaster', {}], ['velvet', {}], ['velvet', { color: [0.3, 0.04, 0.05] }],
  ['brass', {}], ['leather', { buttons: 1 }], ['brick', {}], ['stone', {}], ['books', {}], ['painting', { subject: 0, aspect: 1 }], ['painting', { subject: 1, aspect: 1 }],
  ['painting', { subject: 2, aspect: 1 }], ['painting', { subject: 3, aspect: 1 }], ['wax', {}], ['glass', { opacity: 0.6 }], ['wood', { species: 'oak', boards: 3 }], ['wood', { species: 'rosewood', boards: 0 }], ['gilded', { pattern: 3 }],
];
const COLS = 7, S = 0.8, GAP = 0.12;

export default {
  id: '_materials',
  title: 'Material Gallery',
  floorName: 'Engine Sandbox',
  ambience: { roomTone: 0.2 },
  music: false,
  async build(ctx) {
    const { materials: M, geometry: G } = ctx;
    const root = new THREE.Group();
    const rows = Math.ceil(TILES.length / COLS);
    const W = COLS * (S + GAP), H = rows * (S + GAP);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, H + 2), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 }));
    back.position.set(0, H / 2 + 0.3, -0.02); back.receiveShadow = true; root.add(back);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);
    TILES.forEach(([name, opts], i) => {
      const cx = (i % COLS) - (COLS - 1) / 2, cy = rows - 1 - Math.floor(i / COLS);
      const x = cx * (S + GAP), y = 0.3 + GAP / 2 + S / 2 + cy * (S + GAP);
      const mat = M.create(name, { ...opts, transparent: name === 'glass' ? true : undefined });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(S, S), mat);
      panel.position.set(x, y, 0.02); panel.castShadow = true; panel.receiveShadow = true;
      root.add(panel);
      const label = ctx.textures.canvas(`matlabel:${i}`, 256, 32, (g, w, h) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#c9a55a'; g.font = '20px Georgia'; g.textAlign = 'center';
        g.fillText(`${name}${opts.pattern !== undefined ? ` ${opts.pattern}` : ''}${opts.palette ? ` ${opts.palette}` : ''}${opts.type ? ` ${opts.type}` : ''}${opts.subject !== undefined ? ` ${opts.subject}` : ''}`, w / 2, 23);
      }, { tile: false });
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(S, S / 8), new THREE.MeshBasicMaterial({ map: label, toneMapped: false }));
      lab.position.set(x, y - S / 2 - GAP * 0.3, 0.02);
      root.add(lab);
    });
    // neutral studio lighting: large soft key, rim and fill
    const key = new THREE.RectAreaLight(0xffffff, 3.5, 4, 3); key.position.set(-2.5, 3.5, 4); key.lookAt(0, 1.8, 0); root.add(key);
    const dir = new THREE.DirectionalLight(0xfff4e8, 1.4); dir.position.set(-3, 5, 5); dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024); Object.assign(dir.shadow.camera, { left: -5, right: 5, top: 5, bottom: -1 }); root.add(dir);
    root.add(new THREE.HemisphereLight(0x9aa8c8, 0x302820, 0.5));
    const cy = (r) => 0.3 + GAP / 2 + S / 2 + (rows - 1 - r) * (S + GAP);
    const nodes = {
      all: { position: [0, H / 2 + 0.3, 5.6], target: [0, H / 2 + 0.3, 0], fov: 50 },
    };
    for (let r = 0; r < rows; r++) nodes[`row${r + 1}`] = { position: [0, cy(r), 2.6], target: [0, cy(r), 0], fov: 60 };
    for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c; if (i >= TILES.length) continue;
      nodes[`t${i}`] = { position: [(c - (COLS - 1) / 2) * (S + GAP), cy(r), 0.75], target: [(c - (COLS - 1) / 2) * (S + GAP), cy(r), 0], fov: 55 };
    }
    const edges = Object.keys(nodes).filter((n) => n !== 'all').map((n) => ['all', n]);
    return {
      scene: root, nodes, edges, start: 'all',
      grade: { exposure: 1.0, vignette: 0.15, grain: 0.01, splitAmount: 0.2, bloomStrength: 0.15, godRayWeight: 0 },
      environment: { intensity: 1.0 },
    };
  },
};
