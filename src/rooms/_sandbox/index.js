import * as THREE from 'three';
import { candlesPuzzle } from './puzzleCandles.js';

/**
 * _sandbox — "The Blue Parlour": a compact Victorian room that exercises the whole
 * engine (procedural PBR materials, mouldings, moonlight + shadows, volumetric
 * shaft, dust, fog, candles, ghost shader, nodes/edges, hotspots, a puzzle,
 * cinematic + Stauf line, a locked exit). Use it as a reference implementation.
 */

const W = 6, D = 7, H = 3.6;           // room size (x, z, y)
const X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
const DADO = 0.95;
const WIN = { x: 0, w: 1.5, sill: 0.95, h: 2.25, depth: 0.38 };
const DOOR = { x: 0, w: 1.1, h: 2.35 };

export default {
  id: '_sandbox',
  title: 'The Blue Parlour',
  floorName: 'Engine Sandbox',
  map: { floor: 'ground', rect: [60, 420, 160, 120] },
  start: 'entry',
  ambience: { wind: 0.6, creaks: 0.4, clock: 0.35, thunder: 0.4, roomTone: 0.3 },
  puzzles: [candlesPuzzle.meta],

  async build(ctx) {
    const { materials: M, geometry: G, fx } = ctx;
    const root = new THREE.Group();
    root.name = 'sandbox';
    const add = (o, { cast = true, receive = true } = {}) => { o.traverse?.((c) => { if (c.isMesh) { c.castShadow = cast; c.receiveShadow = receive; } }); root.add(o); return o; };

    // ---------------------------------------------------------------- materials
    const wallpaper = M.create('damask', { repeat: [1.85, 1.85], sheen: 0.6 });
    const parquet = M.create('parquet', { species: 'walnut', ratio: 5, planksAcross: 2, repeat: [1.0, 1.0], polish: 0.6, wear: 0.4 });
    const mahogany = M.create('mahogany', { repeat: [1, 1] });
    const panelWood = M.create('wood', { species: 'mahogany', boards: 0, polish: 0.75, repeat: [1.2, 1.2], clearcoat: 0.5, clearcoatRoughness: 0.25 });
    const plaster = M.create('plaster', { color: [0.42, 0.44, 0.5], cracks: 0.35, stains: 0.35, repeat: [0.5, 0.5] });
    const crownGilt = M.create('gilded', { pattern: 0, repeats: 4, wear: 0.45, dirt: 0.6, repeat: [1 / 0.5, 1] });
    const frieze = M.create('gilded', { pattern: 6, repeats: 3, ground: 1, groundColor: [0.035, 0.045, 0.1], wear: 0.3, dirt: 0.5, repeat: [1 / 0.75, 1] });
    const giltFrame = M.create('gilded', { pattern: 1, repeats: 3, wear: 0.5, dirt: 0.7, repeat: [1 / 0.45, 1] });
    const giltPlain = M.create('gold', { wear: 0.5, dirt: 0.5, repeat: [2, 1] });
    const velvet = M.create('velvet', { color: [0.06, 0.09, 0.25], crush: 0.55, repeat: [2, 2], side: THREE.DoubleSide });
    const seatVelvet = M.create('velvet', { color: [0.25, 0.04, 0.05], crush: 0.4, repeat: [3, 3] });
    const brass = M.create('brass', { tarnish: 0.35, polish: 0.7, repeat: [2, 2] });
    const glassMat = M.create('glass', { dirt: 0.5, transparent: true, opacity: 0.14 });
    const rugMat = M.create('rug', { palette: 'heriz', aspect: 3.0 / 4.2, knots: 200, wear: 0.4, size: ctx.quality.textureSize >= 2048 ? 2048 : 1536 });

    // ---------------------------------------------------------------- shell
    // floor
    const floor = new THREE.Mesh(G.planeUV(W, D, 1), parquet);
    floor.rotation.x = -Math.PI / 2;
    add(floor, { cast: false });
    // ceiling
    const ceil = new THREE.Mesh(G.planeUV(W, D, 1), plaster);
    ceil.name = 'ceiling';
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
    add(ceil, { cast: false });

    // walls: back (window), left, right, front (door). Wallpaper above the dado.
    const wallUV = 1;
    const back = new THREE.Mesh(G.wallWithOpenings(W, H - DADO, [{ x: W / 2 + WIN.x - WIN.w / 2, y: WIN.sill - DADO, w: WIN.w, h: WIN.h, arch: true }], { uvScale: wallUV }), wallpaper);
    back.position.set(X0, DADO, Z0);
    back.name = 'backwall';
    add(back);
    const left = new THREE.Mesh(G.planeUV(D, H - DADO, wallUV), wallpaper);
    left.rotation.y = Math.PI / 2; left.position.set(X0, DADO + (H - DADO) / 2, 0);
    add(left);
    const right = new THREE.Mesh(G.planeUV(D, H - DADO, wallUV), wallpaper);
    right.rotation.y = -Math.PI / 2; right.position.set(X1, DADO + (H - DADO) / 2, 0);
    add(right);
    const front = new THREE.Mesh(G.wallWithOpenings(W, H - DADO, [{ x: W / 2 + DOOR.x - DOOR.w / 2, y: -1, w: DOOR.w, h: DOOR.h - DADO + 1 }], { uvScale: wallUV }), wallpaper);
    front.rotation.y = Math.PI; front.position.set(X1, DADO, Z1);
    add(front);

    // window reveal (deep jambs) — extruded plaster ring around the opening
    {
      const shape = new THREE.Shape();
      const ow = WIN.w + 0.001, r = WIN.w / 2;
      shape.moveTo(-ow / 2 - 0.02, -0.02); shape.lineTo(ow / 2 + 0.02, -0.02); shape.lineTo(ow / 2 + 0.02, WIN.h + 0.04); shape.lineTo(-ow / 2 - 0.02, WIN.h + 0.04);
      const hole = new THREE.Path();
      hole.moveTo(-r, 0); hole.lineTo(-r, WIN.h - r); hole.absarc(0, WIN.h - r, r, Math.PI, 0, true); hole.lineTo(r, 0); hole.lineTo(-r, 0);
      shape.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(shape, { depth: WIN.depth, bevelEnabled: false, curveSegments: 32 });
      const reveal = new THREE.Mesh(G.applyBoxUVs(g, 1), plaster);
      reveal.name = 'reveal';
      reveal.position.set(WIN.x, WIN.sill, Z0 - WIN.depth);
      add(reveal);
      // marble-ish sill (painted wood)
      const sill = new THREE.Mesh(G.boxUV(WIN.w + 0.24, 0.045, WIN.depth + 0.12, 1), mahogany);
      sill.position.set(WIN.x, WIN.sill - 0.022, Z0 - WIN.depth / 2 + 0.06);
      add(sill);
    }

    // window: sash frame, mullions, glass and a moonlit night sky beyond
    const winGroup = new THREE.Group();
    winGroup.name = 'window';
    winGroup.position.set(WIN.x, WIN.sill, Z0 - WIN.depth * 0.55);
    {
      const fm = M.basic('black', { color: 0x0d0a09, roughness: 0.55 });
      const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), fm); m.position.set(x, y, 0); winGroup.add(m); };
      const r = WIN.w / 2;
      bar(WIN.w, 0.06, 0, 0.03);
      bar(0.05, WIN.h - r, 0, (WIN.h - r) / 2);
      for (const y of [0.62, 1.3]) bar(WIN.w, 0.04, 0, y);
      bar(0.05, WIN.h - r, -r + 0.025, (WIN.h - r) / 2);
      bar(0.05, WIN.h - r, r - 0.025, (WIN.h - r) / 2);
      // arch tracery spokes
      for (let i = 1; i < 4; i++) {
        const a = Math.PI * (i / 4);
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.035, r, 0.04), fm);
        m.position.set(Math.cos(a) * r * 0.5, WIN.h - r + Math.sin(a) * r * 0.5, 0);
        m.rotation.z = a - Math.PI / 2;
        winGroup.add(m);
      }
      const arc = new THREE.Mesh(new THREE.TorusGeometry(r - 0.025, 0.025, 6, 32, Math.PI), fm);
      arc.position.set(0, WIN.h - r, 0); winGroup.add(arc);
      // glass
      const gs = new THREE.Shape();
      gs.moveTo(-r, 0); gs.lineTo(-r, WIN.h - r); gs.absarc(0, WIN.h - r, r, Math.PI, 0, true); gs.lineTo(r, 0); gs.lineTo(-r, 0);
      const glass = new THREE.Mesh(new THREE.ShapeGeometry(gs, 32), glassMat);
      glass.position.z = 0.01;
      glass.userData.noShadow = true;
      winGroup.add(glass);
    }
    add(winGroup);
    winGroup.traverse((o) => { if (o.userData.noShadow) o.castShadow = false; });
    // sky backdrop (HDR emissive) generated with a custom TextureForge shader
    const skyTex = ctx.textures.generate('sandbox:nightsky', {
      size: 512, aspect: 1.0, tile: false, glsl: /* glsl */ `
      void surface(vec2 uv, inout Surface s) {
        vec2 p = uv;
        vec2 moon = vec2(0.66, 0.74);
        float md = length(p - moon);
        float cl = fbm(p * vec2(1.0, 1.6) + vec2(0.2, 0.0), vec2(3.0, 2.0), 6);
        vec3 sky = mix(vec3(0.03, 0.05, 0.12), vec3(0.22, 0.3, 0.5), smoothstep(0.0, 1.0, p.y));
        sky += vec3(0.55, 0.62, 0.8) * exp(-md * 6.0) * 0.9;
        sky = mix(sky, sky * 0.35 + vec3(0.02, 0.025, 0.04), smoothstep(-0.05, 0.35, cl) * 0.8);
        sky += vec3(0.7, 0.75, 0.85) * smoothstep(0.12, 0.0, abs(cl - 0.05)) * exp(-md * 3.0) * 0.5;
        sky = mix(sky, vec3(1.0, 0.98, 0.92) * 1.0, smoothstep(0.052, 0.045, md));
        // bare tree silhouettes
        float trunk = abs(p.x - 0.18 - 0.03 * sin(p.y * 9.0)) - 0.018 * (1.2 - p.y);
        float br = 1.0;
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          vec2 o = vec2(0.18, 0.35 + fi * 0.1);
          vec2 d = rot2(0.6 + 0.4 * sin(fi * 3.1)) * (p - o);
          br = min(br, max(abs(d.y + 0.02 * sin(d.x * 30.0)) - 0.006 * (1.0 - d.x * 2.0), -d.x));
          br = max(br, d.x - 0.35);
        }
        float tree = min(trunk, br);
        float hill = p.y - (0.12 + 0.05 * fbm(vec2(p.x * 2.0, 0.0), vec2(2.0, 1.0), 4));
        vec3 col = sky;
        col = mix(col, vec3(0.01, 0.012, 0.02), smoothstep(0.004, -0.004, min(tree, hill)));
        s.albedo = col;
        s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
      }`,
    });
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex.map, color: new THREE.Color(1, 1, 1).multiplyScalar(4.0), toneMapped: false });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), skyMat);
    sky.position.set(WIN.x + 0.3, WIN.sill + 1.2, Z0 - 2.4);
    root.add(sky);

    // ---------------------------------------------------------------- mouldings
    const crownH = 0.24;
    const crown = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(crownH, 0.18), [
      new THREE.Vector3(X0, H - crownH, Z0), new THREE.Vector3(X1, H - crownH, Z0), new THREE.Vector3(X1, H - crownH, Z1), new THREE.Vector3(X0, H - crownH, Z1),
    ], { closed: true, uvScale: 1 }), crownGilt);
    add(crown, { cast: false });
    // frieze band under the crown (flat strip)
    const friezeH = 0.2;
    const friezeProfile = [new THREE.Vector2(0.004, 0), new THREE.Vector2(0.004, friezeH)];
    const friezeMesh = new THREE.Mesh(G.sweepProfile(friezeProfile, [
      new THREE.Vector3(X0, H - crownH - friezeH, Z0), new THREE.Vector3(X1, H - crownH - friezeH, Z0), new THREE.Vector3(X1, H - crownH - friezeH, Z1), new THREE.Vector3(X0, H - crownH - friezeH, Z1),
    ], { closed: true, uvScale: 1 }), frieze);
    add(friezeMesh, { cast: false });
    // picture rail
    const railProfile = G.PROFILES.chairRail(0.035, 0.02);
    const rail = new THREE.Mesh(G.sweepProfile(railProfile, [
      new THREE.Vector3(X0, H - crownH - friezeH - 0.035, Z0), new THREE.Vector3(X1, H - crownH - friezeH - 0.035, Z0), new THREE.Vector3(X1, H - crownH - friezeH - 0.035, Z1), new THREE.Vector3(X0, H - crownH - friezeH - 0.035, Z1),
    ], { closed: true, uvScale: 2 }), giltPlain);
    add(rail, { cast: false });
    // chair rail + baseboard (open paths skipping door / window)
    const dl = DOOR.x - DOOR.w / 2 - 0.12, dr = DOOR.x + DOOR.w / 2 + 0.12;
    const chair1 = [new THREE.Vector3(dl, DADO - 0.05, Z1), new THREE.Vector3(X0, DADO - 0.05, Z1), new THREE.Vector3(X0, DADO - 0.05, Z0), new THREE.Vector3(X1, DADO - 0.05, Z0), new THREE.Vector3(X1, DADO - 0.05, Z1), new THREE.Vector3(dr, DADO - 0.05, Z1)];
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.075, 0.035), chair1, { uvScale: 1 }), panelWood));
    const base1 = chair1.map((p) => new THREE.Vector3(p.x, 0, p.z));
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.baseboard(0.22, 0.03), base1, { uvScale: 1 }), panelWood));

    // wainscot: backing + raised panels on every wall segment
    const wainscot = new THREE.Group();
    const panelGeo = G.raisedPanel(0.62, 0.56, { border: 0.07, bevel: 0.03 });
    const backing = (len, pos, rotY) => {
      const m = new THREE.Mesh(G.boxUV(len, DADO - 0.05, 0.02, 1), panelWood);
      m.position.copy(pos); m.rotation.y = rotY; wainscot.add(m);
      const n = Math.max(1, Math.round(len / 0.74));
      for (let i = 0; i < n; i++) {
        const p = new THREE.Mesh(panelGeo, panelWood);
        const off = -len / 2 + (len / n) * (i + 0.5);
        const local = new THREE.Vector3(off, 0.52 - (DADO - 0.05) / 2, 0.01);
        local.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        p.position.copy(pos).add(local);
        p.rotation.y = rotY;
        p.scale.set((len / n - 0.1) / 0.62, 1, 1);
        wainscot.add(p);
      }
    };
    const wy = (DADO - 0.05) / 2;
    backing(W, new THREE.Vector3(0, wy, Z0 + 0.01), 0);
    backing(D, new THREE.Vector3(X0 + 0.01, wy, 0), Math.PI / 2);
    backing(D, new THREE.Vector3(X1 - 0.01, wy, 0), -Math.PI / 2);
    backing(X1 - dr, new THREE.Vector3((X1 + dr) / 2, wy, Z1 - 0.01), Math.PI);
    backing(dl - X0, new THREE.Vector3((X0 + dl) / 2, wy, Z1 - 0.01), Math.PI);
    wainscot.name = 'wainscot';
    add(wainscot);

    // ceiling rose
    const rose = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.42, 0], [0.42, -0.02], [0.36, -0.035], [0.3, -0.03], [0.22, -0.05], [0.12, -0.06], [0.05, -0.09], [0.0, -0.1]], 48), giltPlain);
    rose.position.set(0.3, H, 0.2);
    add(rose, { cast: false });

    // ---------------------------------------------------------------- door (front wall, mostly behind the start view)
    {
      const door = new THREE.Group();
      const leaf = new THREE.Mesh(G.boxUV(DOOR.w, DOOR.h, 0.05, 1), panelWood);
      leaf.position.y = DOOR.h / 2; door.add(leaf);
      for (const [y, hgt] of [[0.62, 0.9], [1.72, 0.9]]) for (const x of [-0.25, 0.25]) {
        const p = new THREE.Mesh(G.raisedPanel(0.42, hgt, { border: 0.05 }), panelWood);
        p.position.set(x, y, 0.025); door.add(p);
      }
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.032, 24, 16), brass);
      knob.position.set(0.42, 1.0, 0.07); door.add(knob);
      const casing = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.11, 0.035), [
        new THREE.Vector3(-DOOR.w / 2 - 0.06, 0, 0), new THREE.Vector3(-DOOR.w / 2 - 0.06, DOOR.h + 0.06, 0), new THREE.Vector3(DOOR.w / 2 + 0.06, DOOR.h + 0.06, 0), new THREE.Vector3(DOOR.w / 2 + 0.06, 0, 0),
      ], { up: new THREE.Vector3(0, 0, 1), uvScale: 1, flipOutward: true }), panelWood);
      door.add(casing);
      door.position.set(DOOR.x, 0, Z1 - 0.03);
      door.rotation.y = Math.PI;
      add(door);
      ctx._door = door;
    }

    // ---------------------------------------------------------------- curtains + valance
    for (const side of [-1, 1]) {
      const c = new THREE.Mesh(G.curtainGeometry({ width: 1.0, height: 3.05, folds: 8, depth: 0.075, tieback: 0, pool: 0.1, seed: side + 3 }), velvet);
      c.position.set(WIN.x + side * (WIN.w / 2 + 0.22), WIN.sill + WIN.h + 0.25, Z0 + 0.12);
      if (side > 0) c.scale.x = -1;
      c.name = 'curtain';
      add(c);
    }
    {
      const val = new THREE.Mesh(G.curtainGeometry({ width: WIN.w + 1.4, height: 0.42, folds: 14, depth: 0.045, gather: 1, seed: 9 }), velvet);
      val.position.set(WIN.x, WIN.sill + WIN.h + 0.36, Z0 + 0.16);
      val.name = 'valance';
      add(val);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, WIN.w + 1.7, 16), brass);
      rod.rotation.z = Math.PI / 2; rod.position.set(WIN.x, WIN.sill + WIN.h + 0.38, Z0 + 0.12);
      add(rod);
      for (const s of [-1, 1]) {
        const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0.01], [0.04, 0.04], [0.02, 0.07], [0.035, 0.1], [0, 0.13]], 20), brass);
        fin.rotation.z = -s * Math.PI / 2; fin.position.set(WIN.x + s * (WIN.w / 2 + 0.85), WIN.sill + WIN.h + 0.38, Z0 + 0.12);
        add(fin);
      }
    }

    // ---------------------------------------------------------------- rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.2), rugMat);
    rug.rotation.x = -Math.PI / 2; rug.position.set(0.2, 0.006, 0.1);
    add(rug, { cast: false });

    // ---------------------------------------------------------------- table + candelabra
    const table = new THREE.Group();
    {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.6, 0.045, 64), mahogany);
      top.position.y = 0.745; table.add(top);
      const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.08, 64, 1, true), mahogany);
      apron.position.y = 0.69; table.add(apron);
      const ped = new THREE.Mesh(G.latheFromProfile([[0.0, 0.0], [0.09, 0.12], [0.07, 0.2], [0.11, 0.28], [0.06, 0.36], [0.05, 0.5], [0.08, 0.6], [0.1, 0.66], [0.0, 0.7]], 40), mahogany);
      table.add(ped);
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(G.sweepProfile([new THREE.Vector2(-0.02, 0), new THREE.Vector2(0.02, 0), new THREE.Vector2(0.02, 0.05), new THREE.Vector2(-0.02, 0.05), new THREE.Vector2(-0.02, 0)], [
          new THREE.Vector3(0, 0.16, 0), new THREE.Vector3(0.22, 0.07, 0), new THREE.Vector3(0.4, 0.02, 0),
        ]), mahogany);
        leg.rotation.y = (i * Math.PI) / 2 + Math.PI / 4; table.add(leg);
        const foot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), brass);
        foot.position.set(Math.cos(-leg.rotation.y) * 0.4, 0.03, Math.sin(-leg.rotation.y) * 0.4); table.add(foot);
      }
      // runner + a few objects
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.012, 48), M.basic('porcelain'));
      plate.position.set(-0.32, 0.775, 0.18); table.add(plate);
      const goblet = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.035, 0.002], [0.01, 0.01], [0.006, 0.07], [0.03, 0.09], [0.04, 0.13], [0.038, 0.16], [0.0, 0.16]], 32), M.basic('crystal'));
      goblet.position.set(-0.18, 0.77, 0.32); table.add(goblet);
    }
    table.position.set(0.3, 0, 0.2);
    add(table);

    // candelabra (brass, three arms) with candles managed by the puzzle
    const candelabra = new THREE.Group();
    const stem = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.09, 0.0], [0.08, 0.02], [0.03, 0.05], [0.02, 0.12], [0.035, 0.16], [0.015, 0.22], [0.015, 0.3], [0.03, 0.32], [0, 0.33]], 32), brass);
    candelabra.add(stem);
    const arms = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.009, 8, 32, Math.PI), brass);
    arms.position.y = 0.24; arms.rotation.z = Math.PI; candelabra.add(arms);
    const candles = [];
    [-0.13, 0, 0.13].forEach((x, i) => {
      const cup = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.022, 0.0], [0.028, 0.02], [0.02, 0.03], [0, 0.03]], 20), brass);
      const y = i === 1 ? 0.33 : 0.24;
      cup.position.set(x, y, 0); candelabra.add(cup);
      const c = fx.candle({ height: 0.2 - (i === 1 ? 0.03 : 0), radius: 0.011, light: false, seed: i * 17 + 3, burn: 0.6 + i * 0.1 });
      c.position.set(x, y + 0.025, 0);
      candelabra.add(c);
      candles.push(c);
    });
    candelabra.position.set(0.3, 0.77, 0.2);
    add(candelabra);
    // one shared light for the candelabra (cheaper than three, casts table shadows)
    const candleLight = new THREE.PointLight(0xffa04a, 5.5, 9, 2);
    candleLight.position.set(0.3, 1.28, 0.2);
    candleLight.castShadow = ctx.quality.shadows;
    candleLight.shadow.mapSize.set(512, 512);
    candleLight.shadow.bias = -0.003; candleLight.shadow.normalBias = 0.03; candleLight.shadow.radius = 4;
    root.add(candleLight);

    // ---------------------------------------------------------------- chairs
    const chair = () => {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new G.RoundedBoxGeometry(0.44, 0.07, 0.42, 3, 0.02), seatVelvet);
      seat.position.y = 0.47; g.add(seat);
      for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) {
        const leg = new THREE.Mesh(G.latheFromProfile([[0.02, 0], [0.016, 0.1], [0.022, 0.2], [0.015, 0.3], [0.02, 0.44], [0.0, 0.44]], 12), mahogany);
        leg.position.set(x, 0, z); g.add(leg);
      }
      for (const x of [-0.19, 0.19]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.62, 10), mahogany);
        post.position.set(x, 0.8, 0.19); post.rotation.x = -0.08; g.add(post);
      }
      const crest = new THREE.Mesh(new G.RoundedBoxGeometry(0.46, 0.08, 0.035, 2, 0.012), mahogany);
      crest.position.set(0, 1.1, 0.215); g.add(crest);
      // pierced splat: a fan of slats (like the original's spider-web chairs)
      for (let i = -3; i <= 3; i++) {
        const sl = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.5, 0.012), mahogany);
        sl.position.set(i * 0.022, 0.82, 0.2); sl.rotation.z = i * 0.11; g.add(sl);
      }
      return g;
    };
    const ch1 = chair(); ch1.position.set(0.3, 0, 1.05); ch1.rotation.y = 0; add(ch1);
    const ch2 = chair(); ch2.position.set(-0.6, 0, -0.4); ch2.rotation.y = Math.PI * 0.75; add(ch2);

    // ---------------------------------------------------------------- sideboard (right wall)
    {
      const sb = new THREE.Group();
      const body = new THREE.Mesh(new G.RoundedBoxGeometry(1.5, 0.42, 0.48, 3, 0.012), mahogany);
      body.position.y = 0.66; sb.add(body);
      const topB = new THREE.Mesh(new G.RoundedBoxGeometry(1.58, 0.035, 0.53, 3, 0.012), mahogany);
      topB.position.y = 0.885; sb.add(topB);
      for (const x of [-0.37, 0.37]) {
        const dr = new THREE.Mesh(G.raisedPanel(0.66, 0.16, { border: 0.025, bevel: 0.012, fieldDepth: 0.006 }), panelWood);
        dr.position.set(x, 0.76, 0.24); sb.add(dr);
        const pull = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 8, 16, Math.PI), brass);
        pull.position.set(x, 0.76, 0.27); pull.rotation.z = Math.PI; sb.add(pull);
      }
      for (const [x, z] of [[-0.7, -0.2], [0.7, -0.2], [-0.7, 0.2], [0.7, 0.2]]) {
        const leg = new THREE.Mesh(G.latheFromProfile([[0.022, 0], [0.018, 0.06], [0.028, 0.14], [0.02, 0.3], [0.03, 0.45], [0, 0.45]], 12), mahogany);
        leg.position.set(x, 0, z); sb.add(leg);
      }
      sb.position.set(X1 - 0.3, 0, -1.4); sb.rotation.y = -Math.PI / 2;
      add(sb);
      const c = fx.candle({ height: 0.26, radius: 0.014, lightIntensity: 2.6, lightDistance: 7, seed: 41 });
      const holder = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.05, 0.015], [0.015, 0.04], [0.012, 0.12], [0.03, 0.14], [0, 0.14]], 24), brass);
      holder.position.set(X1 - 0.3, 0.9, -1.0); c.position.set(X1 - 0.3, 1.04, -1.0);
      add(holder); add(c, { cast: false });
    }

    // ---------------------------------------------------------------- paintings (left wall)
    const paintings = [];
    const hangPainting = ({ w, h, z, y, subject, seed, frameW = 0.11 }) => {
      const g = new THREE.Group();
      const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.create('painting', { subject, seed, aspect: w / h, size: 1024 }));
      g.add(canvas);
      const frame = new THREE.Mesh(G.frameGeometry(w, h, { width: frameW, depth: 0.06, uvScale: 1 }), giltFrame);
      g.add(frame);
      g.position.set(X0 + 0.03, y, z); g.rotation.y = Math.PI / 2;
      add(g);
      paintings.push(canvas);
      return g;
    };
    const landscape = hangPainting({ w: 1.25, h: 0.88, z: -1.0, y: 1.95, subject: 0, seed: 3 });
    const portrait = hangPainting({ w: 0.62, h: 0.82, z: 1.15, y: 1.9, subject: 1, seed: 7, frameW: 0.09 });
    // a small seascape on the right wall above the sideboard
    {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), M.create('painting', { subject: 2, seed: 5, aspect: 1.5, size: 1024 })));
      g.add(new THREE.Mesh(G.frameGeometry(0.9, 0.6, { width: 0.08, depth: 0.05, uvScale: 1 }), giltFrame));
      g.position.set(X1 - 0.03, 1.85, -1.4); g.rotation.y = -Math.PI / 2;
      add(g);
    }

    // wall sconce (right wall, near the door): warm gas-lamp glow
    {
      const sc = new THREE.Group();
      const plate = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.05, 0.02], [0, 0.03]], 24), brass);
      plate.rotation.x = Math.PI / 2; sc.add(plate);
      const arm = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 24, Math.PI / 2), brass);
      arm.position.set(0, -0.1, 0); arm.rotation.y = Math.PI / 2; sc.add(arm);
      const shade = new THREE.Mesh(G.latheFromProfile([[0.02, 0], [0.06, 0.03], [0.07, 0.09], [0.05, 0.15], [0.03, 0.16]], 24), new THREE.MeshStandardMaterial({ color: 0x221a10, emissive: new THREE.Color(1.0, 0.62, 0.3), emissiveIntensity: 3.2, roughness: 0.4, transparent: true, opacity: 0.92 }));
      shade.position.set(0, 0.0, 0.1); sc.add(shade);
      sc.position.set(X1 - 0.02, 1.95, 1.9); sc.rotation.y = -Math.PI / 2;
      add(sc, { cast: false });
      const pl = new THREE.PointLight(0xffa860, 4.0, 8, 2);
      pl.position.set(X1 - 0.15, 2.05, 1.9);
      root.add(pl);
      ctx.onUpdate((dt, t) => { pl.intensity = 4.0 * (0.97 + 0.03 * Math.sin(t * 9.1) * Math.sin(t * 3.7)); });
    }

    // ---------------------------------------------------------------- moonlight
    const moon = new THREE.SpotLight(0xa9bfff, 1400, 18, 0.3, 0.35, 2);
    moon.position.set(1.0, 5.4, Z0 - 4.2);
    moon.target.position.set(-0.35, 0, -0.75);
    moon.castShadow = ctx.quality.shadows && ctx.params.get('moonshadow') !== '0';
    moon.shadow.mapSize.set(ctx.quality.shadowMapSize, ctx.quality.shadowMapSize);
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02; moon.shadow.radius = ctx.quality.shadowRadius;
    moon.shadow.camera.near = 1; moon.shadow.camera.far = 16;
    root.add(moon, moon.target);
    // faint cool fill so the far corners don't crush to pure black
    const fill = new THREE.HemisphereLight(0x5068b0, 0x24160c, 1.1);
    root.add(fill);
    // soft moonlit spill from the window onto the walls and floor
    root.add(fx.areaLight({ center: [WIN.x, WIN.sill + 1.1, Z0 + 0.05], normal: [0, -0.4, 1], width: WIN.w, height: WIN.h, color: 0x8ea6ff, intensity: 5 }));

    // volumetric beam + dust in the beam + floor mist
    const winCenter = new THREE.Vector3(WIN.x, WIN.sill + WIN.h * 0.48, Z0 - 0.02);
    const beamDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shaft = fx.shaft({
      center: winCenter, right: new THREE.Vector3(WIN.w / 2, 0, 0), up: new THREE.Vector3(0, WIN.h * 0.5, 0),
      direction: beamDir, length: 3.6, color: 0x9fb6ff, intensity: 0.32, softness: 0.3, falloff: 1.1, panes: [2, 3], mullion: 0.035, noise: 0.7,
    });
    root.add(shaft);
    const dust = fx.dust({ box: new THREE.Box3(new THREE.Vector3(-1.8, 0.1, Z0 + 0.05), new THREE.Vector3(1.4, 3.0, 0.6)), count: 2200, shafts: [shaft], size: 0.011, intensity: 2.2, ambient: 0.05 });
    root.add(dust);
    const fog = fx.fog({ box: new THREE.Box3(new THREE.Vector3(X0 + 0.2, 0, Z0 + 0.1), new THREE.Vector3(X1 - 0.2, 0.55, 1.5)), color: 0x0b111e, litColor: 0x31405e, density: 0.5, heightFalloff: 4 });
    root.add(fog);

    // ---------------------------------------------------------------- ghost
    const ghostMat = fx.ghostMaterial({ color: 0x6f96ff, rimColor: 0xcfe0ff, opacity: 0.6, intensity: 1.2, dissolveY: 0.55, dissolveSoft: 0.6 });
    const ghost = new THREE.Mesh(G.latheFromProfile([
      [0.0, 1.78], [0.06, 1.77], [0.1, 1.72], [0.115, 1.64], [0.105, 1.56], [0.07, 1.5], [0.06, 1.44], [0.17, 1.38], [0.23, 1.3], [0.24, 1.1],
      [0.22, 0.9], [0.26, 0.6], [0.3, 0.3], [0.34, 0.0],
    ], 40), ghostMat);
    ghost.position.set(1.7, -0.1, -2.6);
    ghost.renderOrder = 7;
    root.add(ghost);
    ctx.onUpdate((dt, t) => { ghost.position.y = -0.1 + Math.sin(t * 0.8) * 0.03; ghost.rotation.y = Math.sin(t * 0.3) * 0.2; });

    // ---------------------------------------------------------------- navigation graph
    const nodes = {
      entry: { position: [0.25, 1.62, 2.55], target: [0.05, 1.45, -3.5], fov: 58, label: 'The parlour' },
      entry_back: { position: [0.25, 1.62, 2.4], target: [0.1, 1.3, 6.0], fov: 58, label: 'The door' },
      table: { position: [1.35, 1.5, 1.35], target: [0.3, 0.85, 0.15], fov: 52, label: 'The table' },
      window: { position: [-0.25, 1.58, -1.15], target: [0.0, 1.95, -3.6], fov: 56, label: 'The window', look: { yaw: [-60, 60], pitch: [-30, 30] } },
      paintings: { position: [0.9, 1.6, 0.4], target: [-3.0, 1.85, 0.1], fov: 54, label: 'The paintings' },
    };
    const edges = [
      ['entry', 'table', [[1.0, 1.58, 2.2]]],
      ['entry', 'window', [[-0.6, 1.6, 1.0]]],
      ['table', 'window', [[0.9, 1.56, -0.6]]],
      ['entry', 'paintings'],
      ['table', 'paintings'],
      ['window', 'paintings', [[0.2, 1.6, -0.6]]],
      ['entry', 'entry_back', null, { hotspot: { entry_back: { position: [0.25, 1.4, 4.6], radius: 0.9 }, entry: { position: [0.1, 1.4, -2.0], radius: 0.9 } } }],
    ];
    const exits = [
      { node: 'entry_back', toRoom: 'foyer', toNode: null, label: 'To the foyer', hotspot: { box: { min: [-0.6, 0.2, 3.3], max: [0.6, 2.4, 3.6] } } },
    ];

    // ---------------------------------------------------------------- hotspots
    const hotspots = [
      {
        id: 'landscape', nodes: ['paintings', 'entry'], object: landscape, cursor: 'examine', label: 'A dark landscape',
        onActivate: () => ctx.ui.caption('A ruined castle on a crag, a single window lit. Someone painted this from memory — or from inside.', { title: 'The Landscape' }),
      },
      {
        id: 'portrait', nodes: ['paintings'], object: portrait, cursor: 'talk', label: 'The portrait',
        onActivate: async () => {
          ctx.audio.sfx('laugh');
          await ctx.say({ text: 'Admiring my likeness? It never did capture my *best* side.', speaker: 'stauf', speakerName: 'Stauf' });
        },
      },
      {
        id: 'ghost', nodes: ['window', 'entry', 'table'], sphere: { center: [1.7, 1.2, -2.6], radius: 0.45 }, cursor: 'ghost', label: 'A presence',
        onActivate: () => ctx.cinematic(async (c, h) => {
          ctx.post.set({ saturation: 0.6, vignette: 0.6 }, 0.8);
          ghostMat.uniforms.uOpacity.value = 0.95;
          await ctx.nav.lookAt(new THREE.Vector3(1.7, 1.35, -2.6), 1.2);
          await ctx.say({ text: 'Six guests came to the house that night. Each wanted something only I could give.', speaker: 'stauf', speakerName: 'Stauf' });
          await h.wait(0.5);
          ghostMat.uniforms.uOpacity.value = 0.55;
          ctx.post.reset(1.2);
          await ctx.nav.returnToNode(1.0);
        }),
      },
      { id: 'candles', nodes: ['table', 'entry'], object: candelabra, cursor: 'puzzle', label: 'The candelabra', puzzle: candlesPuzzle.create({ candles, light: candleLight }) },
      {
        id: 'window-look', nodes: ['window'], box: { min: [-0.75, 1.0, -3.95], max: [0.75, 3.2, -3.5] }, cursor: 'examine', label: 'The night',
        onActivate: () => ctx.ui.caption('The moon watches the house the way a cat watches a mousehole.', { title: 'Outside' }),
      },
    ];

    // god rays from the window
    const godRays = [{ position: new THREE.Vector3(0.3, WIN.sill + 1.2, Z0 - 1.2), color: new THREE.Color(0.7, 0.8, 1.0), strength: 1.0, radius: 0.22 }];

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'entry',
      grade: { exposure: 1.85, bloomStrength: 0.4, godRayWeight: 0.45, fogDensity: 0.0 },
      environment: { position: [0.9, 1.7, 1.6], intensity: 1.0 },
      update(dt, t) { /* per-frame room logic */ },
      dispose() { /* nothing extra: engine disposes geometries/materials in `scene` */ },
    };
  },
};
