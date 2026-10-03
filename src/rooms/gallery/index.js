import * as THREE from 'three';
import { mergeStatic } from '../../engine/lib/contrib/foyer-merge.js';
import { flicker } from '../../engine/fx/index.js';
import { X0, X1, Z0, Z1, H, DADO, BAYS, BAY_CENTERS, DOORS, ARCH, WIN, PUZZLE, PIL } from './layout.js';
import { buildShell, buildWindow, buildLanding, makeDoor, mount } from './architecture.js';
import { makeFramed, makeClock, makeConsole, makeBench, makePlaque, makeLantern } from './props.js';
import { runnerTexture, nightSky, treeLine, branchCard, moonCookie } from './textures.js';
import { makePortraitMaterial, createGaze } from './portraits.js';
import { patchWallpaper, makeReflectiveFloor, giltMaterial, mahoganyTexture } from './look.js';
import { makeGasBracket, makeGlobeMaterial, makeLightPool, silhouetteTexture, makeOvalFrame, makeGiltFrame, makePictureLight, makeSideChair, makeCoveredBust, makeJardiniere, makeBirdcage, transomTexture, linenTexture } from './dressing.js';
import { makeGhost } from './ghost.js';
import { createSlidePuzzle, meta as slideMeta, SLIDE_ID } from './puzzleSlide.js';

/**
 * The Upstairs Gallery — a long, narrow portrait hall on the upper floor.
 *
 * Five bays divided by fluted mahogany pilasters and plaster cross-beams recede
 * toward a tall arched window where the moon pours in along a crimson runner.
 * Gas sconces hiss on every pilaster. The family on the walls watch you pass —
 * literally: their eyes follow the camera. Doors lead to the bedroom and the game
 * room; a narrow door at the far end hides the attic stair, latched until the
 * Toymaker's sliding-tile likeness (the room's puzzle) is made whole.
 *
 * Axes: hall runs along Z, near end (stair landing arch) at z = +8, window at z = -9.
 */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export default {
  id: 'gallery',
  title: 'The Portrait Gallery',
  floorName: 'Upper Floor',
  map: { floor: 'upper', rect: [380, 120, 240, 90] },
  start: 'main',
  ambience: { wind: 0.5, creaks: 0.7, clock: 0.25, thunder: 0.3, rain: 0, heartbeat: 0.1, roomTone: 0.35 },
  music: { mood: 'dread' },
  puzzles: [slideMeta],

  async build(ctx) {
    const { materials: M, fx } = ctx;
    const root = new THREE.Group();
    root.name = 'gallery';
    const hiTex = ctx.quality.textureSize >= 2048 ? 2048 : 1024;

    // ================================================================ materials
    const mat = {
      wall: M.create('damask', { base: [0.062, 0.112, 0.26], motif: [0.08, 0.138, 0.3], accent: [0.5, 0.4, 0.22], accentStrength: 0.02, sheen: 0.62, aging: 0.45, variant: 0, normalScale: 0.12, repeat: [2 / 0.1777, 2 / 0.1777], size: hiTex }),
      floor: M.create('floorboards', { species: 'walnut', boards: 6, boardLength: 0.5, polish: 0.9, wear: 0.5, tint: [1.05, 0.86, 0.72], roughness: 0.85, repeat: [1 / 3.2, 1 / 1.0] }),
      ceiling: M.create('plaster', { color: [0.25, 0.28, 0.38], cracks: 0.3, stains: 0.45, repeat: [0.45, 0.45] }),
      beam: M.create('plaster', { color: [0.24, 0.27, 0.36], cracks: 0.15, stains: 0.3, repeat: [0.8, 0.8] }),
      plasterLight: M.create('plaster', { color: [0.42, 0.44, 0.5], cracks: 0.3, stains: 0.4, repeat: [0.8, 0.8] }),
      wainscot: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.75, figure: 0.7, tint: [0.62, 0.5, 0.46], repeat: [1.3, 1.3], clearcoat: 0.5, clearcoatRoughness: 0.25 }),
      pilasterWood: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.8, figure: 0.4, tint: [0.6, 0.48, 0.44], repeat: [2.2, 0.6], rotation: Math.PI / 2, clearcoat: 0.55, clearcoatRoughness: 0.2 }),
      doorWood: null,
      mahogany: M.create('mahogany', { repeat: [1.5, 1.5], color: new THREE.Color(0.62, 0.5, 0.48) }),
      crownGilt: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.5, dirt: 0.65, repeat: [1 / 0.45, 1] }),
      capitalGilt: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.4, dirt: 0.6, repeat: [1 / 0.2, 1 / 0.07] }),
      frieze: M.create('gilded', { pattern: 6, repeats: 3, ground: 1, groundColor: [0.03, 0.04, 0.09], wear: 0.35, dirt: 0.55, repeat: [1 / 0.7, 1] }),
      doorFrieze: M.create('gilded', { pattern: 1, repeats: 3, ground: 1, groundColor: [0.12, 0.04, 0.03], wear: 0.4, dirt: 0.6, repeat: [1 / 0.4, 1] }),
      soffit: M.create('gilded', { pattern: 2, repeats: 4, ground: 1, groundColor: [0.05, 0.06, 0.12], wear: 0.4, dirt: 0.6, repeat: [1 / 0.9, 1] }),
      giltFrame: M.create('gold', { wear: 0.5, dirt: 0.6, repeat: [2, 1], color: new THREE.Color(0.9, 0.82, 0.7), roughness: 1.4, envMapIntensity: 0.6 }),
      gilt: giltMaterial(ctx),
      felt: M.create('velvet', { color: [0.03, 0.09, 0.05], crush: 0.3, repeat: [6, 6] }),
      giltPlain: M.create('gold', { wear: 0.5, dirt: 0.55, repeat: [2, 1], roughness: 1.35, envMapIntensity: 0.65 }),
      giltCap: M.create('gold', { wear: 0.3, dirt: 0.4, repeat: [3, 3], roughness: 1.3, envMapIntensity: 0.65 }),
      brass: M.create('brass', { tarnish: 0.45, polish: 0.6, repeat: [3, 3], roughness: 1.25, envMapIntensity: 0.7 }),
      brassBright: M.create('brass', { tarnish: 0.1, polish: 0.95, repeat: [3, 3] }),
      velvet: M.create('velvet', { color: [0.05, 0.08, 0.24], crush: 0.55, repeat: [2, 2], side: THREE.DoubleSide }),
      velvetSeat: M.create('velvet', { color: [0.3, 0.04, 0.06], crush: 0.4, repeat: [3, 3], sheen: 1.0, sheenRoughness: 0.4, sheenColor: new THREE.Color(0.42, 0.12, 0.22) }),
      seatFabric: M.create('damask', { base: [0.22, 0.04, 0.05], motif: [0.27, 0.07, 0.07], accent: [0.6, 0.45, 0.2], accentStrength: 0.0, sheen: 0.8, aging: 0.6, variant: 1, normalScale: 0.4, repeat: [7, 7], size: 1024 }),
      marble: M.create('marble', { type: 'nero', polish: 0.8, repeat: [1, 1] }),
      glass: M.create('glass', { dirt: 0.55, transparent: true, opacity: 0.12 }),
      black: M.basic('black', { color: 0x020203, roughness: 0.9 }),
      windowFrame: M.basic('black', { color: 0x110c0a, roughness: 0.55 }),
      cord: M.basic('black', { color: 0x3a2a12, roughness: 0.8 }),
      porcelainBlue: null,
      stem: M.basic('black', { color: 0x1a1a0e, roughness: 0.9 }),
      rose: M.basic('black', { color: 0x3a0c10, roughness: 0.85 }),
      mantle: new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 2.5, 1.2), name: 'mantle' }),
      deadMantle: new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.9, name: 'deadMantle' }),
      lanternGlass: new THREE.MeshStandardMaterial({ color: 0x302010, emissive: new THREE.Color(1.0, 0.6, 0.28), emissiveIntensity: 0.55, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false, name: 'lanternGlass' }),
    };
    {
      const mt = mahoganyTexture(ctx).withRepeat(1 / 0.5, 1 / 1.0);
      mat.doorWood = new THREE.MeshPhysicalMaterial({ map: mt.map, normalMap: mt.normalMap, roughnessMap: mt.roughnessMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 1, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.3, color: new THREE.Color(1.1, 1.0, 1.0), name: 'doorMahogany' });
      // the long-case clock: same figured mahogany under a deeper French-polish lacquer
      mat.clockWood = mat.doorWood.clone();
      mat.clockWood.clearcoat = 0.6; mat.clockWood.clearcoatRoughness = 0.2; mat.clockWood.name = 'clockMahogany';
      const lt = mahoganyTexture(ctx).withRepeat(4, 4);
      mat.tileLacquer = new THREE.MeshPhysicalMaterial({ map: lt.map, normalMap: lt.normalMap, normalScale: new THREE.Vector2(0.2, 0.2), roughness: 0.55, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.35, color: new THREE.Color(0.55, 0.42, 0.36), envMapIntensity: 0.5, name: 'tileLacquer' });
    }
    // sconce jet positions (needed for soot on the wallpaper): pilaster face + bracket reach
    const jetPos = [];
    for (const z of BAYS) for (const side of [-1, 1]) jetPos.push(V3(side < 0 ? X0 + PIL.d + 0.2 : X1 - PIL.d - 0.2, 1.98 + 0.11, z));
    patchWallpaper(mat.wall, jetPos);
    {
      // blue-and-white ginger jar: painted cobalt scrolls on a greyed glaze (not a white blob)
      const jt = ctx.textures.canvas('gallery:jar', 512, 256, (g, w, h) => {
        g.fillStyle = '#b9bfc8'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#1e2f6e'; g.fillStyle = '#23367a';
        g.lineWidth = 6; for (const y of [18, 34, h - 30, h - 16]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        g.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          const cx = i * w / 6 + 40, cy = h / 2;
          g.beginPath(); for (let k = 0; k <= 40; k++) { const t = k / 40, a = t * 4.5, r = 34 * (1 - t * 0.8); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9); } g.stroke();
          for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + 20 + k * 6, cy - 30 + k * 14, 9, 4, 0.7, 0, Math.PI * 2); g.fill(); }
        }
      }, { tile: true });
      mat.porcelainBlue = new THREE.MeshPhysicalMaterial({ map: jt, color: new THREE.Color(0.75, 0.75, 0.78), roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.5, name: 'jar' });
    }
    {
      // aged linen: warm grey-ivory, weave normal at full strength, a faint sheen only (no satin)
      const ln = linenTexture(ctx).withRepeat(9, 9);
      mat.sheet = new THREE.MeshPhysicalMaterial({ map: ln.map, normalMap: ln.normalMap, roughnessMap: ln.roughnessMap, normalScale: new THREE.Vector2(1.0, 1.0), color: new THREE.Color(0.82, 0.8, 0.74).multiplyScalar(1.25), vertexColors: true, roughness: 1, metalness: 0, sheen: 0.25, sheenRoughness: 0.85, sheenColor: new THREE.Color(0.8, 0.78, 0.72), side: THREE.DoubleSide, envMapIntensity: 0.35, name: 'dustSheet' });
      mat.pedestal = M.create('ebony', { repeat: [3, 3], roughness: 3.0, clearcoat: 0.25, clearcoatRoughness: 0.45 });
    }
    const skyTex = nightSky(ctx);
    mat.sky = new THREE.MeshBasicMaterial({ map: skyTex.map, color: new THREE.Color(1, 1, 1).multiplyScalar(2.6), toneMapped: false, name: 'sky' });
    mat.skipFloor = true;
    const runnerSet = runnerTexture(ctx);
    const RUN_W = 1.05;
    mat.runner = new THREE.MeshPhysicalMaterial({ roughness: 1, metalness: 0, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.6, 0.28, 0.26), envMapIntensity: 0.3, normalScale: new THREE.Vector2(1.2, 1.2), name: 'runner' });

    // ================================================================ architecture
    buildShell(ctx, root, mat);
    const winInfo = buildWindow(ctx, root, mat);
    buildLanding(ctx, root, mat);

    {
      const zA = Z0 - WIN.depth, zB = Z1 + 2.7;
      const floor = makeReflectiveFloor(ctx, mat.floor, {
        w: 4.8, l: zB - zA, cx: 0, cz: (zA + zB) / 2, y: 0, res: ctx.shot ? 0.5 : 0.4, strength: 1.0, blur: 1.0,
        uvFn: (g) => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getY(i) - (zA + zB) / 2, p.getX(i)); },
      });
      const orig = floor.onBeforeRender;
      let frameId = 0, last = -1;
      ctx.onUpdate(() => { frameId++; });
      floor.onBeforeRender = function (r, sc, cam) { if (cam !== ctx.camera || last === frameId) return; last = frameId; orig.call(this, r, sc, cam); };
      floor.receiveShadow = true;
      root.add(floor);
    }
    // runner carpet down the centre of the hall: a 7 mm slab with softened edges, contact shadow,
    // knotted fringe at both ends and brass pins along the selvedge
    {
      const G = ctx.geometry;
      const zA = Z0 + 0.55, zB = Z1 + 0.9, len = zB - zA, TH = 0.007;
      const RPT = len / 2.1;
      const rep = runnerSet.withRepeat(1, RPT);
      mat.runner.map = rep.map; mat.runner.normalMap = rep.normalMap; mat.runner.roughnessMap = rep.ormMap; mat.runner.aoMap = rep.ormMap;
      mat.runner.roughness = 1; mat.runner.normalScale.set(0.6, 0.6);
      // wear in metres along the whole runner (never repeats): a pale, flattened walking line down
      // the centre, darker unworn edges, fading toward the moonlit window end, a few old stains
      mat.runner.onBeforeCompile = (sh) => {
        sh.uniforms.uRunLen = { value: len };
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uRunLen;
float rH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(rH(i), rH(i + vec2(1, 0)), f.x), mix(rH(i + vec2(0, 1)), rH(i + vec2(1, 1)), f.x), f.y); }
float rF(vec2 p) { return rN(p) * 0.5 + rN(p * 2.1 + 3.7) * 0.3 + rN(p * 4.3 + 9.1) * 0.2; }`).replace('#include <map_fragment>', `#include <map_fragment>
{
  float ax = abs(vMapUv.x - 0.5);
  float al = vMapUv.y * 2.1;                       // metres from the window end
  float n = rF(vec2(ax * 9.0, al * 1.4));
  float walk = smoothstep(0.3, 0.02, ax + 0.06 * (n - 0.5)) * (0.45 + 0.55 * smoothstep(0.3, 0.7, rF(vec2(ax * 4.0, al * 0.5) + 5.0)));
  float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  vec3 faded = mix(diffuseColor.rgb, vec3(lum) * vec3(1.15, 0.98, 0.82), 0.55) * 1.28 + vec3(0.02, 0.016, 0.012);
  diffuseColor.rgb = mix(diffuseColor.rgb, faded, walk * 0.55);
  // sun-fade near the window, darker where furniture kept the light off the edges
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(1.1, 0.95, 0.85) * 1.15, smoothstep(3.5, 0.0, al) * 0.3);
  diffuseColor.rgb *= 1.0 - 0.22 * smoothstep(0.3, 0.48, ax);
  // old stains and grime
  float st = smoothstep(0.72, 0.86, rF(vec2(ax * 3.0 + 11.0, al * 0.9)));
  diffuseColor.rgb *= 1.0 - 0.35 * st;
  diffuseColor.rgb *= 0.9 + 0.2 * rF(vec2(ax * 20.0, al * 6.0));
}`);
      };
      mat.runner.customProgramCacheKey = () => 'gallery-runner-wear';
      mat.runner.needsUpdate = true;
      const g = new G.RoundedBoxGeometry(RUN_W, TH, len, 2, 0.0028);
      const run = new THREE.Mesh(g, mat.runner);
      run.position.set(0, TH / 2 + 0.0005, (zA + zB) / 2);
      run.name = 'runner';
      root.add(run);
      // soft contact shadow hugging the edges
      const cs = ctx.textures.canvas('gallery:runnerShadow', 64, 64, (c, w, h) => {
        const img = c.createImageData(w, h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const d = Math.min(x + 0.5, w - x - 0.5, y + 0.5, h - y - 0.5) / (w * 0.5);
          const a = Math.min(1, d / 0.35); const i = (y * w + x) * 4;
          img.data[i + 3] = Math.round(200 * a * a);
        }
        c.putImageData(img, 0, 0);
      }, { tile: false });
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(RUN_W + 0.05, len + 0.05), new THREE.MeshBasicMaterial({ map: cs, transparent: true, depthWrite: false, color: 0x000000, name: 'runnerShadow' }));
      sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.0012, (zA + zB) / 2); sh.renderOrder = 1; sh.userData.noShadow = true;
      root.add(sh);
      // fringe: knotted ivory warp ends, drawn into a mipmapped alpha strip (no aliasing comb at
      // distance) and laid on the boards at both ends, slightly lifted where the knots sit
      {
        const ft = ctx.textures.canvas('gallery:fringe', 1024, 64, (c, w, h) => {
          c.clearRect(0, 0, w, h);
          let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
          for (let i = 0; i < 160; i++) {
            const x = (i + 0.5) * (w / 160) + (rnd() - 0.5) * 2, L = h * (0.7 + rnd() * 0.28), sway = (rnd() - 0.5) * 5;
            const tone = 175 + Math.floor(rnd() * 45);
            c.strokeStyle = `rgba(${tone},${tone - 12},${tone - 34},1)`; c.lineWidth = 2.2;
            c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + sway * 0.5, L * 0.5, x + sway, L); c.stroke();
          }
          // the knot row at the root
          for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(190,176,140,1)'; c.beginPath(); c.ellipse((i + 0.5) * (w / 40), 5, 9, 5, 0, 0, Math.PI * 2); c.fill(); }
        }, { tile: false });
        const fm = new THREE.MeshStandardMaterial({ map: ft, transparent: true, alphaTest: 0.25, roughness: 0.95, side: THREE.DoubleSide, name: 'fringe' });
        for (const e of [0, 1]) {
          const fp = new THREE.Mesh(new THREE.PlaneGeometry(RUN_W - 0.01, 0.06), fm);
          fp.rotation.x = -Math.PI / 2;
          if (!e) fp.rotation.z = Math.PI;
          fp.position.set(0, 0.0025, e ? zB + 0.03 : zA - 0.03);
          fp.userData.noShadow = true;
          root.add(fp);
        }
      }
      const m4 = new THREE.Matrix4();
      // brass stair-rod style edge pins every 90 cm
      const pinGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.004, 8);
      const n = Math.floor(len / 0.9);
      const pins = new THREE.InstancedMesh(pinGeo, mat.brass, n * 2);
      for (let i = 0; i < n; i++) for (const s of [-1, 1]) { m4.makeTranslation(s * (RUN_W / 2 - 0.012), TH + 0.0015, zA + 0.35 + i * 0.9); pins.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m4); }
      root.add(pins);
    }

    // ================================================================ doors
    const doors = {};
    for (const [name, d] of Object.entries(DOORS)) {
      const door = makeDoor(ctx, mat, { w: d.w, h: d.h, name, open: 0 });
      mount(door, d.side, d.z, 0, 0);
      root.add(door);
      doors[name] = door;
    }
    const atticHinge = doors.attic.userData.hinge;
    doors.attic.getObjectByName('void').visible = false;

    // ================================================================ gas brackets (one on every pilaster face)
    const sconces = [];
    {
      let k = 0;
      const base = [2.6, 3.2, 2.2, 2.9, 3.4, 2.4, 2.8, 2.0, 3.0, 2.5];
      for (const z of BAYS) for (const side of [-1, 1]) {
        const globeMat = makeGlobeMaterial(ctx);
        // break the rhythm: the right-hand bracket in bay 2 is dead (gas off, cold mantle), so the
        // middle of the hall has a dark gap the eye must push through
        const dead = k === 3;
        const s = makeGasBracket(ctx, mat, globeMat, dead ? mat.deadMantle : mat.mantle);
        const holder = new THREE.Group();
        holder.add(s.group);
        s.group.position.z = PIL.d + 0.005;
        mount(holder, side, z, 1.98, 0);
        root.add(holder);
        // scalloped pool of light thrown up the wallpaper beside the pilaster (both sides of it)
        for (const off of [-1, 1]) {
          const pool = makeLightPool(ctx, { w: 1.0, h: 1.9, intensity: 0.2 * base[k] / 2.7 });
          pool.position.x = -off * 0.5 * (side < 0 ? -1 : 1);
          const ph = new THREE.Group(); ph.add(pool);
          mount(ph, side, z + off * (PIL.w / 2 + 0.02 + 0.5), 1.98 + 0.11, 0.004);
          ph.userData.dynamic = true;
          root.add(ph);
          s.pools = s.pools || []; s.pools.push(pool);
        }
        const lp = s.lightPos.clone().add(V3(0, 0, PIL.d + 0.005));
        holder.updateMatrixWorld(true);
        const wp = lp.applyMatrix4(holder.matrixWorld);
        const pl = new THREE.PointLight(0xffb070, base[k], 6.5, 2);
        pl.position.copy(wp);
        root.add(pl);
        sconces.push({ light: pl, globe: globeMat, pools: s.pools, base: dead ? 0 : base[k], amp: 0.6 + 0.5 * ((k * 7) % 5) / 4, seed: 7 + k * 3.3, dying: k === 6, hard: k === 4, dead });
        if (dead) { pl.visible = false; for (const p of s.pools) p.visible = false; globeMat.emissiveIntensity = 0.02; }
        k++;
      }
    }
    // the light of one bracket on the far bay sputters, as if the gas were failing
    ctx.onUpdate((dt, t) => {
      for (const s of sconces) {
        if (s.dead) continue;
        let f = 1 + (flicker(t, s.seed) - 1) * s.amp;
        if (s.hard) {
          // a starved jet: it gutters hard, dropping to a blue bead for a beat now and then
          const g = Math.sin(t * 2.3) * Math.sin(t * 0.91 + 2.0) + 0.3 * Math.sin(t * 13.0);
          f *= g > 0.55 ? 0.18 : (0.7 + 0.3 * Math.sin(t * 23.0 + 1.0));
        }
        if (s.dying) {
          const sp = Math.sin(t * 1.7) * Math.sin(t * 0.63 + 1.0);
          const cut = sp > 0.82 ? 0.25 : 1.0;
          f *= cut * (0.85 + 0.15 * Math.sin(t * 31.0));
        }
        s.light.intensity = s.base * f;
        s.globe.emissiveIntensity = 0.5 * f;
        for (const p of s.pools) p.material.opacity = f;
      }
    });

    // hanging lanterns in bays 2 and 4 (break up the ceiling, warm pools on the runner)
    const lanterns = [];
    for (const z of [BAY_CENTERS[1], BAY_CENTERS[3]]) {
      const ln = makeLantern(ctx, mat, 1.05);
      ln.group.position.set(0, H, z);
      root.add(ln.group);
      const pl = new THREE.PointLight(0xffb070, 2.2, 6, 2);
      pl.position.set(0, H + ln.lightPos.y, z);
      root.add(pl);
      lanterns.push({ light: pl, seed: z * 1.7 });
    }
    ctx.onUpdate((dt, t) => { for (const l of lanterns) l.light.intensity = (l.base ?? 2.2) * flicker(t, l.seed); });

    // ================================================================ portraits (eyes follow)
    const portraits = [];
    const hang = async (name, side, z, { w = 0.74, h = 0.95, y = 1.86, frameW = 0.12, strength = 1, light = false } = {}) => {
      const pm = await makePortraitMaterial(ctx, name);
      const f = makeGiltFrame(ctx, mat, pm, w, h, { fw: frameW });
      mount(f.group, side, z, y, 0.03);
      f.group.userData.dynamic = true;     // keep the canvas raycastable + unmerged
      root.add(f.group);
      portraits.push({ name, mesh: f.canvas, mat: pm, strength, group: f.group, speed: 0.9 + portraits.length * 0.15 });
      if (light) {
        const pl = makePictureLight(ctx, mat, w * 0.62);
        mount(pl, side, z, y + h / 2 + frameW + 0.06, 0.0);
        root.add(pl);
        const nrm = side < 0 ? [1, -1.3, 0] : [-1, -1.3, 0];
        root.add(fx.areaLight({ center: [side < 0 ? X0 + 0.2 : X1 - 0.2, y + h / 2 + frameW + 0.06, z], normal: nrm, width: w * 0.6, height: 0.05, color: 0xffb877, intensity: 28 }));
      }
      return f;
    };
    // salon hang on BOTH walls: a principal canvas per bay with smaller cabinet portraits, ovals,
    // silhouettes and landscapes around it; every principal has its own brass picture light
    const pLady = await hang('lady', -1, BAY_CENTERS[0], { light: true });
    const pColonel = await hang('colonel', -1, BAY_CENTERS[1], { w: 0.8, h: 1.02, light: true });
    const pElder = await hang('elder', 1, 5.45, { light: true });
    await hang('poet', 1, 6.62, { w: 0.42, h: 0.54, y: 1.5, frameW: 0.08 });
    const pWidow = await hang('widow', 1, BAY_CENTERS[2] + 0.38, { w: 0.7, h: 0.9, y: 1.95, light: true });
    const pChild = await hang('child', 1, BAY_CENTERS[2] - 0.62, { w: 0.46, h: 0.6, y: 1.84, frameW: 0.09 });
    const pDoctor = await hang('doctor', 1, 1.8, { w: 0.46, h: 0.59, y: 1.82, frameW: 0.085 });
    // ovals carrying real portraits (eyes follow too)
    const hangOval = async (name, side, z, y, w, h) => {
      const pm = await makePortraitMaterial(ctx, name);
      const g = makeOvalFrame(ctx, mat, pm, w, h);
      mount(g, side, z, y, 0.02);
      g.userData.dynamic = true;
      root.add(g);
      portraits.push({ name, mesh: g.children[0], mat: pm, strength: 0.9, group: g, speed: 1.1 });
      return g;
    };
    const oBelle = await hangOval('belle', 1, 6.62, 2.28, 0.36, 0.46);
    // two lesser cabinet pictures by the far doors (an unknown sitter, a dark seascape)
    for (const [side, z, subject, seed] of [[1, -5.0, 1, 21], [-1, -6.25, 2, 33]]) {
      const pm = M.create('painting', { subject, seed, aspect: 0.78, size: 512 });
      const f = makeGiltFrame(ctx, mat, pm, 0.4, 0.51, { fw: 0.075 });
      mount(f.group, side, z, 1.8, 0.03);
      root.add(f.group);
    }
    const gaze = createGaze(portraits, ctx.camera, { instant: !!ctx.shot });

    // salon hang: cut-paper silhouettes and small landscapes between the big canvases
    const smalls = [
      ['sil', -1, BAY_CENTERS[0] - 0.78, 2.02, 1, true], ['sil', -1, BAY_CENTERS[0] + 0.78, 2.02, 2, false],
      ['sil', -1, BAY_CENTERS[1] - 0.82, 2.1, 3, false], ['sil', 1, 4.92, 2.32, 4, true],
      ['land', -1, BAY_CENTERS[3] - 0.78, 2.15, 5, 0], ['land', -1, BAY_CENTERS[3] + 0.78, 2.15, 6, 2],
      ['land', -1, BAY_CENTERS[1] + 0.84, 2.0, 7, 3],
      // right wall: either side of the bedroom door, over the shrouded bust, by the game-room door
      ['land', 1, 3.98, 1.78, 8, 2], ['sil', 1, 3.98, 2.3, 9, false], ['sil', 1, 1.8, 2.4, 10, true],
      ['land', 1, -2.72, 2.2, 11, 0], ['sil', 1, -5.0, 2.4, 12, false],
      ['sil', -1, -6.25, 2.4, 13, true],
    ];
    for (const [kind, side, z, y, seed, extra] of smalls) {
      let g;
      if (kind === 'sil') {
        const sm = new THREE.MeshStandardMaterial({ map: silhouetteTexture(ctx, seed, extra), roughness: 0.8, name: 'silhouette' });
        g = makeOvalFrame(ctx, mat, sm, 0.2, 0.26);
      } else {
        const pm = M.create('painting', { subject: extra, seed: seed * 13, aspect: 1.3, size: 512 });
        g = makeGiltFrame(ctx, mat, pm, 0.34, 0.26, { fw: 0.055, profile: 'slim', corners: false }).group;
      }
      mount(g, side, z, y, 0.02);
      root.add(g);
    }

    // ================================================================ furniture
    // left bay 4: pier mirror over the demilune console (dead roses, candlesticks, an empty birdcage)
    const consoleT = makeConsole(ctx, mat);
    mount(consoleT.group, -1, BAY_CENTERS[3], 0, 0.0);
    root.add(consoleT.group);
    const cage = makeBirdcage(ctx, mat);
    cage.position.set(-0.3, 0.857, 0.12); cage.scale.setScalar(0.9);
    consoleT.group.add(cage);
    {
      // antique pier glass: tired silvering, darker toward the frame, foxed in patches
      const silver = ctx.textures.canvas('gallery:silvering', 256, 384, (c, w, h) => {
        c.fillStyle = '#9a9a9c'; c.fillRect(0, 0, w, h);
        let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 160; i++) { const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 14; const g2 = c.createRadialGradient(x, y, 0, x, y, r); g2.addColorStop(0, 'rgba(30,26,20,0.55)'); g2.addColorStop(1, 'rgba(30,26,20,0)'); c.fillStyle = g2; c.fillRect(x - r, y - r, r * 2, r * 2); }
        const e = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.62);
        e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(10,8,6,0.85)'); c.fillStyle = e; c.fillRect(0, 0, w, h);
      }, { tile: false });
      const mirrorMat = new THREE.MeshStandardMaterial({ map: silver, color: 0xa8a49c, metalness: 1.0, roughness: 0.08, envMapIntensity: 1.6, name: 'mirror' });
      // the window's RectAreaLight would print a flat glowing card on the glass; the glass shows the
      // (baked) hall instead, so drop rect-light specular for this material only
      mirrorMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n#undef RE_Direct_RectArea'); };
      mirrorMat.customProgramCacheKey = () => 'gallery-mirror-norect';
      const foxing = M.textures('plaster', { color: [0.5, 0.5, 0.5], cracks: 0.0, stains: 0.9 });
      mirrorMat.roughnessMap = foxing.withRepeat(1.4, 1.4).map;
      mirrorMat.roughness = 0.1;
      const mf = makeGiltFrame(ctx, mat, mirrorMat, 0.72, 1.12, { fw: 0.1 });
      mount(mf.group, -1, BAY_CENTERS[3], 1.82, 0.03);
      root.add(mf.group);
    }
    const consoleLight = new THREE.PointLight(0xffa04a, 1.4, 4.0, 2);
    {
      consoleT.group.updateMatrixWorld(true);
      consoleLight.position.copy(V3(0, 1.2, 0.22).applyMatrix4(consoleT.group.matrixWorld));
      root.add(consoleLight);
      ctx.onUpdate((dt, t) => { consoleLight.intensity = 1.4 * flicker(t, 5.5); });
    }
    // left bay 2: a pair of balloon-back side chairs under the colonel
    for (const dz of [-0.42, 0.42]) {
      const ch = makeSideChair(ctx, mat);
      mount(ch, -1, BAY_CENTERS[1] + dz, 0, 0.03);
      ch.rotation.y += dz > 0 ? -0.12 : 0.12;
      root.add(ch);
    }
    // right bay 0: a hall chair under the old man; by the bedroom door, an aspidistra on a torchere
    {
      const ch = makeSideChair(ctx, mat);
      mount(ch, 1, 5.45, 0, 0.03);
      ch.rotation.y += 0.1;
      root.add(ch);
      const jd = makeJardiniere(ctx, mat);
      mount(jd, 1, 4.0, 0, 0.0);
      root.add(jd);
    }
    // right bay 1: a bust shrouded in a dust sheet on a marble pedestal
    const bust = await makeCoveredBust(ctx, mat);
    mount(bust, 1, -2.75, 0, 0.42);
    bust.rotation.y += 0.35;
    root.add(bust);
    const bench = makeBench(ctx, mat);
    mount(bench, 1, BAY_CENTERS[2], 0, 0.02);
    root.add(bench);
    const clock = makeClock(ctx, mat);
    mount(clock, 1, BAY_CENTERS[4] + 0.2, 0, 0.02);
    root.add(clock);
    {
      const pend = clock.userData.pendulum;
      ctx.onUpdate((dt, t) => { pend.rotation.z = Math.sin(t * Math.PI) * 0.045; });
    }

    // ================================================================ puzzle panel (left wall, middle bay)
    const toyMat = await makePortraitMaterial(ctx, 'toymaker');
    const panel = new THREE.Group();
    panel.name = 'puzzlePanel';
    {
      const G = ctx.geometry;
      const back = new THREE.Mesh(G.raisedPanel(1.42, 1.66, { border: 0.12, bevel: 0.05, fieldDepth: 0.008 }), mat.doorWood);
      back.position.set(0, 0, 0.0); panel.add(back);
      const fr = makeGiltFrame(ctx, mat, mat.black, 0.93, 0.93, { fw: 0.12 });
      fr.canvas.visible = false;
      fr.group.position.set(0, 0.0, 0.03); panel.add(fr.group);
      const plaque = makePlaque(ctx, mat, 'The Toymaker', 0.34, 0.07);
      plaque.position.set(0, -0.67, 0.04); panel.add(plaque);
    }
    mount(panel, -1, PUZZLE.z, PUZZLE.y, 0.025);
    root.add(panel);
    // brass girandoles either side of the panel, each with a candle; one light between them
    for (const s of [-1, 1]) {
      const G = ctx.geometry;
      const gir = new THREE.Group();
      // pierced, scalloped backplate (chased rosette with a ring of cut-outs) + a domed boss
      const sh = new THREE.Shape();
      for (let i = 0; i <= 96; i++) { const th = (i / 96) * Math.PI * 2, r = 0.042 * (1 + 0.1 * Math.cos(th * 10)); const x = Math.cos(th) * r, y = Math.sin(th) * r * 1.6; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
      for (let k = 0; k < 10; k++) { const th = (k / 10) * Math.PI * 2 + Math.PI / 10; const hp = new THREE.Path(); hp.absellipse(Math.cos(th) * 0.029, Math.sin(th) * 0.029 * 1.6, 0.0045, 0.007, 0, Math.PI * 2, true); sh.holes.push(hp); }
      const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 }), mat.brass);
      gir.add(plate);
      const boss = new THREE.Mesh(G.latheFromProfile([[0, 0.016], [0.01, 0.014], [0.017, 0.008], [0.02, 0], [0, 0]], 16), mat.brass);
      boss.rotation.x = Math.PI / 2; boss.position.z = 0.004; gir.add(boss);
      const curve = new THREE.CatmullRomCurve3([V3(0, 0, 0.015), V3(0, -0.06, 0.08), V3(0, -0.02, 0.15), V3(0, 0.03, 0.17)]);
      gir.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.007, 8), mat.brass));
      const cup = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0], [0.03, 0.012], [0.034, 0.02], [0.016, 0.026], [0.014, 0.04], [0, 0.04]], 20), mat.brass);
      cup.position.set(0, 0.03, 0.17); gir.add(cup);
      const c = fx.candle({ height: 0.16, radius: 0.011, light: false, seed: 31 + s * 4, burn: 0.7 });
      c.position.set(0, 0.07, 0.17); gir.add(c);
      mount(gir, -1, PUZZLE.z + s * 0.86, PUZZLE.y + 0.12, 0.03);
      root.add(gir);
    }
    // a soft warm source high and well out from the panel (a lamp held by someone behind you):
    // a rect light gives broad gradients on the gilt instead of pin-point hot spots
    const puzzleLight = fx.areaLight({ center: [X0 + 1.05, PUZZLE.y + 0.95, PUZZLE.z], normal: [-0.6, -0.9, 0], width: 0.6, height: 0.1, color: 0xffb274, intensity: 24 });
    root.add(puzzleLight);
    // after the solve the lamp swells (24 -> 40) while the likeness closes up, then settles warmer
    let puzzleBoost = 0;
    ctx.onUpdate((dt, t) => {
      const target = solvedFx >= 1 ? 0.35 : solvedFx > 0 ? 1.0 : 0;
      puzzleBoost += (target - puzzleBoost) * (1 - Math.exp(-dt * 2.5));
      if (ctx.shot) puzzleBoost = target;
      puzzleLight.intensity = (24 + 16 * puzzleBoost) * (0.9 + 0.1 * flicker(t, 9.1));
    });
    // each girandole candle throws its own small flickering pool on the paper
    for (const s of [-1, 1]) {
      const cl = new THREE.PointLight(0xff9a40, 0.4, 1.2, 2);
      cl.position.set(X0 + 0.24, PUZZLE.y + 0.12 + 0.07 + 0.2, PUZZLE.z + s * 0.86);
      root.add(cl);
      ctx.onUpdate((dt, t) => { cl.intensity = 0.4 * flicker(t, 31 + s * 4); });
    }
    let solvedFx = 0;
    const slide = createSlidePuzzle(ctx, {
      material: toyMat,
      backMaterial: mat.felt,
      edgeMaterial: mat.tileLacquer,
      trayMaterial: mat.doorWood,
      random: ctx.random.fork('gallery-slide'),
      camera: { position: [X0 + 1.7, PUZZLE.y - 0.02, PUZZLE.z], target: [X0, PUZZLE.y - 0.02, PUZZLE.z], fov: 40 },
      onSolvedCb: async () => {
        applySolved(true);
        ctx.audio.sfx('door');
        await ctx.say({ text: 'There! Now he can *see* you. And so — at last — can the attic.', speaker: 'stauf', speakerName: 'Stauf' });
      },
    });
    mount(slide.group, -1, PUZZLE.z, PUZZLE.y, 0.07);
    root.add(slide.group);
    portraits.push({ name: 'toymaker', mesh: slide.group, mat: toyMat, strength: 0.8, speed: 0.7 });

    function applySolved(animate) {
      ctx.state.set('gallery.atticOpen', true);
      solvedFx = animate ? 0.001 : 1;
      if (!animate) { atticHinge.rotation.y = -0.55; toyMat.userData.eyes.uGlow.value = 0.6; slide.forceSolved(); }
      else slide.revealSolved();
    }
    // review hook: ?gsolved=1 in shot mode renders the room as it looks after the puzzle
    const gSolvedParam = ctx.shot && typeof location !== 'undefined' && new URLSearchParams(location.search).get('gsolved') === '1';
    if (ctx.state.isSolved(SLIDE_ID) || gSolvedParam) applySolved(false);

    // ================================================================ ghost (a grey lady in the moonlight)
    // standing on the boards ~0.6 m in front of the window seat (never inside it), turned a little
    // toward whoever approaches but never billboarded
    const GHOST = V3(-0.32, 0.0, -8.25);
    const ghostRig = await makeGhost(ctx);
    const ghost = ghostRig.group;
    ghost.position.copy(GHOST);
    ghost.userData.dynamic = true;
    root.add(ghost);
    const ghostU = ghostRig.uniforms;
    let ghostBoost = 0;
    ctx.onUpdate((dt, t) => {
      ghost.position.y = GHOST.y + 0.02 + Math.sin(t * 0.7) * 0.02;
      const yaw = Math.atan2(ctx.camera.position.x - ghost.position.x, ctx.camera.position.z - ghost.position.z);
      ghost.rotation.y = THREE.MathUtils.clamp(yaw, -0.26, 0.26);
      // she comes and goes: never fully readable for long
      const cyc = Math.sin(t * 0.33) * 1.6 + 0.35 + Math.sin(t * 1.9) * 0.08;
      ghostU.uFade.value = THREE.MathUtils.clamp(cyc, 0, 1) * 0.7 + ghostBoost;
    });

    // ================================================================ moonlight + fills
    // the moon does the lighting at this end: a hard key through the window (its glazing bars are
    // cast by the real window geometry and reinforced by a mullion cookie), no hemisphere wash
    const moon = new THREE.SpotLight(0xa4c6ff, 560, 30, 0.42, 0.12, 2);
    moon.position.set(0.35, 7.2, Z0 - 6.0);
    moon.target.position.set(-0.1, 0.0, -6.2);
    moon.castShadow = ctx.quality.shadows;
    moon.shadow.mapSize.set(Math.max(2048, ctx.quality.shadowMapSize || 0), Math.max(2048, ctx.quality.shadowMapSize || 0));
    moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.02; moon.shadow.radius = 2.0; moon.shadow.blurSamples = 12;
    moon.shadow.camera.near = 3; moon.shadow.camera.far = 22;
    if (moon.castShadow) moon.map = moonCookie(ctx);
    root.add(moon, moon.target);
    // a whisper of cold sky fill so the blacks are not dead (was two hemisphere lights at 1.55 total)
    root.add(new THREE.HemisphereLight(0x30587e, 0x120c0a, 0.12));
    // the moon pool on the boards bounces a little cold light back up at the far ceiling and the clock
    root.add(fx.areaLight({ center: [0, 0.03, -6.9], normal: [0, 1, 0.15], width: 1.6, height: 2.2, color: 0x6c88b0, intensity: 1.2 }));
    // the window itself: a broad cold panel that models the curtains, jambs and window seat
    root.add(fx.areaLight({ center: [0, WIN.sill + 1.2, Z0 + 0.05], normal: [0, -0.5, 1], width: WIN.w, height: WIN.h, color: 0x88b2f2, intensity: 2.6 }));
    // warm/cold split on the end walls: the last pair of gas brackets throws a dim 2700K bounce
    for (const sx of [-1, 1]) {
      const b = new THREE.PointLight(0xffa457, 0.3, 4.5, 2);
      b.position.set(sx * 1.2, 1.7, BAYS[3] - 0.6);
      root.add(b);
    }
    // warm glow from the foyer chandelier below the landing balustrade (the fitting itself is out of sight)
    // (kept above the landing floor level, out in the stairwell, so it cannot leak up through the boards)
    // a broad soft source (no tight specular on the glossy jambs), aimed up out of the stairwell
    root.add(fx.areaLight({ center: [0, -0.4, Z1 + 4.8], normal: [0, 1, -0.25], width: 3.2, height: 2.0, color: 0xffa860, intensity: 3.2 }));
    // a gas lamp on the right-hand newel post lights the landing
    const landingFill = new THREE.PointLight(0xffb070, 5, 7, 2);
    {
      const G = ctx.geometry;
      const lamp = new THREE.Group();
      lamp.position.set(1.15, 1.15, Z1 + 2.6);
      // an intermediate newel in the balustrade carries the lamp, in view through the arch
      const newel = new THREE.Mesh(G.applyBoxUVs(new G.RoundedBoxGeometry(0.14, 1.15, 0.14, 2, 0.01), 1), mat.mahogany); newel.position.set(1.15, 0.575, Z1 + 2.6); root.add(newel);
      const cap = new THREE.Mesh(G.applyBoxUVs(new G.RoundedBoxGeometry(0.18, 0.04, 0.18, 2, 0.008), 1), mat.mahogany); cap.position.set(1.15, 1.15, Z1 + 2.6); root.add(cap);
      const stem = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.07, 0], [0.072, 0.02], [0.04, 0.04], [0.03, 0.1], [0.018, 0.14], [0.016, 0.42], [0.026, 0.45], [0.012, 0.47], [0.03, 0.5], [0, 0.5]], 20), mat.brass);
      lamp.add(stem);
      const globeMat = makeGlobeMaterial(ctx);
      const globe = new THREE.Mesh(G.latheFromProfile([[0.03, 0], [0.06, 0.02], [0.085, 0.07], [0.09, 0.11], [0.08, 0.16], [0.05, 0.2], [0.045, 0.21], [0.05, 0.215]], 32), globeMat);
      globe.position.y = 0.5; globe.renderOrder = 2; lamp.add(globe);
      const mant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.04, 12), mat.mantle); mant.position.y = 0.58; lamp.add(mant);
      root.add(lamp);
      landingFill.position.set(1.15, 1.78, Z1 + 2.5);
      ctx.onUpdate((dt, t) => { const f = flicker(t, 12.7); landingFill.intensity = 5 * f; globeMat.emissiveIntensity = 0.5 * f; });
    }
    // a pendant lantern over the landing, its spill reaching back through the arch
    {
      const ln = makeLantern(ctx, mat, 1.0);
      ln.group.position.set(0, H, Z1 + 1.5);
      root.add(ln.group);
      const pl = new THREE.PointLight(0xffb070, 3.2, 7, 2);
      pl.position.set(0, H + ln.lightPos.y, Z1 + 1.5);
      root.add(pl);
      lanterns.push({ light: pl, seed: 31.7, base: 3.2 });
      const spill = new THREE.PointLight(0xffa860, 2.4, 5, 2);
      spill.position.set(0, 2.7, Z1 - 0.6);
      root.add(spill);
    }
    // a great dark landscape over the stairwell, lit from below by the chandelier
    {
      const pw = 2.2, ph = 1.45;
      const f = makeFramed(ctx, mat, M.create('painting', { subject: 0, seed: 11, aspect: pw / ph, size: 1024 }), pw, ph, { frameW: 0.16, cords: false });
      f.group.position.set(0, 2.0, Z1 + 8.55); f.group.rotation.y = Math.PI;
      root.add(f.group);
      // its own brass picture light, so the canvas reads as a painting and not a hole in the wall
      const pl = makePictureLight(ctx, mat, 1.3);
      pl.position.set(0, 2.0 + ph / 2 + 0.16 + 0.06, Z1 + 8.6); pl.rotation.y = Math.PI; root.add(pl);
      root.add(fx.areaLight({ center: [0, 2.0 + ph / 2 + 0.2, Z1 + 8.4], normal: [0, -1.2, -1], width: 1.4, height: 0.06, color: 0xffb877, intensity: 22 }));
      // gas brackets either side of it
      for (const sx of [-1, 1]) {
        const gm = makeGlobeMaterial(ctx);
        const b = makeGasBracket(ctx, mat, gm, mat.mantle);
        b.group.position.set(sx * 1.55, 1.75, Z1 + 8.58); b.group.rotation.y = Math.PI; root.add(b.group);
        const l = new THREE.PointLight(0xffb070, 2.4, 5, 2); l.position.set(sx * 1.55, 1.9, Z1 + 8.38); root.add(l);
        ctx.onUpdate((dt, t) => { const f = flicker(t, 40 + sx * 3); l.intensity = 2.4 * f; gm.emissiveIntensity = 0.5 * f; });
      }
    }
    // a dim, low-turned bracket by the arch on the left wall so the near corner keeps its shape
    {
      const gm = makeGlobeMaterial(ctx);
      const b = makeGasBracket(ctx, mat, gm, mat.mantle);
      const holder = new THREE.Group(); holder.add(b.group);
      mount(holder, -1, Z1 - 0.45, 1.98, 0.0);
      root.add(holder);
      const l = new THREE.PointLight(0xffa860, 1.2, 4.5, 2); l.position.set(X0 + 0.22, 2.12, Z1 - 0.45); root.add(l);
      ctx.onUpdate((dt, t) => { const f = flicker(t, 77.7); l.intensity = 1.2 * f; gm.emissiveIntensity = 0.55 * f; });
      for (const off of [-1, 1]) {
        const pool = makeLightPool(ctx, { w: 0.9, h: 1.7, intensity: 0.12 });
        pool.position.x = off * 0.45;
        const ph2 = new THREE.Group(); ph2.add(pool); mount(ph2, -1, Z1 - 0.45, 2.09, 0.004); ph2.userData.dynamic = true; root.add(ph2);
      }
    }
    root.add(landingFill);

    // ---- what lies beyond the glass: sky dome, distant tree line, a near branch that sways
    {
      const sky = root.getObjectByName('sky');
      if (sky) { sky.scale.set(6.2, 3.6, 1); sky.position.set(0.0, 1.9, Z0 - 20.0); }   // far back: real parallax against the bars
      const tl = treeLine(ctx);
      const tlm = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: tl.map, transparent: true, alphaTest: 0.02, color: new THREE.Color(1.3, 1.3, 1.5), name: 'treeLine' }));
      tlm.position.set(0.4, 1.3, Z0 - 5.0); tlm.userData.noShadow = true; tlm.name = 'treeLine'; root.add(tlm);
      const br = branchCard(ctx);
      const brm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: br.map, transparent: true, alphaTest: 0.05, name: 'branch' }));
      const pivot = new THREE.Group(); pivot.position.set(-1.6, 3.9, Z0 - 1.5); pivot.userData.dynamic = true;
      brm.position.set(1.3, -1.3, 0); brm.userData.noShadow = true; brm.name = 'branch'; pivot.add(brm); root.add(pivot);
      ctx.onUpdate((dt, t) => { pivot.rotation.z = Math.sin(t * 0.6) * 0.025 + Math.sin(t * 1.7) * 0.008; });
      // window seat: fringed cushion and two bolsters
      const G = ctx.geometry;
      // corded welt along the cushion's front edge with a tassel at each end (no comb of strands)
      {
        const welt = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(V3(-WIN.w / 2 + 0.04, WIN.sill + 0.012, Z0 + 0.066), V3(WIN.w / 2 - 0.04, WIN.sill + 0.012, Z0 + 0.066)), 8, 0.009, 10), mat.velvetSeat);
        root.add(welt);
        for (const sx of [-1, 1]) {
          const tas = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.01, -0.004], [0.014, -0.02], [0.009, -0.03], [0.016, -0.045], [0.02, -0.075], [0, -0.078]], 12), mat.giltCap);
          tas.position.set(sx * (WIN.w / 2 - 0.05), WIN.sill + 0.006, Z0 + 0.07); root.add(tas);
        }
      }
      for (const sx of [-1, 1]) {
        const bol = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.22, 6, 16), mat.velvet);
        bol.rotation.z = Math.PI / 2; bol.rotation.y = sx * 0.25; bol.position.set(sx * (WIN.w / 2 - 0.2), WIN.sill + 0.175, Z0 - WIN.depth / 2 - 0.05); root.add(bol);
        for (const e of [-1, 1]) { const tas = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0.0], [0.02, -0.03], [0.008, -0.05], [0, -0.05]], 8), mat.giltCap); tas.position.set(sx * (WIN.w / 2 - 0.2) + e * 0.19 * Math.cos(sx * 0.25), WIN.sill + 0.175, Z0 - WIN.depth / 2 - 0.05 - e * sx * 0.05); tas.rotation.z = e * Math.PI / 2; root.add(tas); }
      }
    }
    // ---- the game-room door: a leaded stained-glass transom lit faintly from the room beyond
    {
      const d = DOORS.gameroom;
      const tt = transomTexture(ctx);
      const tm = new THREE.MeshStandardMaterial({ map: tt, emissiveMap: tt, emissive: new THREE.Color(1.0, 0.72, 0.45), emissiveIntensity: 0.6, roughness: 0.12, metalness: 0, envMapIntensity: 0.8, name: 'transom' });
      tm.color.setScalar(0.35);
      const t = new THREE.Mesh(new THREE.PlaneGeometry(d.w + 0.2, 0.17), tm);
      const g = new THREE.Group(); g.add(t); t.position.set(0, 0, 0.056);
      mount(g, 1, d.z, d.h + 0.24, 0.0);
      root.add(g);
      // faint coloured spill from the lit room beyond, up onto the cornice and soffit
      root.add(fx.areaLight({ center: [X1 - 0.08, d.h + 0.24, d.z], normal: [-1, 0.5, 0], width: d.w, height: 0.15, color: 0xc88a50, intensity: 1.4 }));
    }
    // ---- the attic: a narrow, steep stair glimpsed behind the low door
    {
      const d = DOORS.attic, G = ctx.geometry;
      const st = new THREE.Group();
      for (let i = 0; i < 12; i++) {
        const tread = new THREE.Mesh(G.boxUV(0.26, 0.04, d.w - 0.04, 1), mat.wainscot);
        tread.position.set(X0 - 0.45 - i * 0.22, 0.2 + i * 0.22, d.z); st.add(tread);
        const riser = new THREE.Mesh(G.boxUV(0.02, 0.22, d.w - 0.04, 1), mat.black);
        riser.position.set(X0 - 0.33 - i * 0.22, 0.09 + i * 0.22, d.z); st.add(riser);
      }
      for (const sz of [-1, 1]) { const wl = new THREE.Mesh(G.boxUV(3.4, 3.6, 0.02, 1), mat.plasterLight); wl.position.set(X0 - 1.8, 1.8, d.z + sz * (d.w / 2 + 0.02)); st.add(wl); }
      root.add(st);
      const atticCold = new THREE.PointLight(0x7f95d8, 0.6, 3.5, 2); atticCold.position.set(X0 - 1.6, 2.6, d.z); root.add(atticCold);
    }

    // volumetric moon beam, dust in it, floor mist
    const winC = V3(0, WIN.sill + 0.4 + (WIN.h - 0.4) * 0.5, Z0 - 0.05);
    const beamDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shaft = fx.shaft({
      center: winC, right: V3(WIN.w / 2, 0, 0), up: V3(0, (WIN.h - 0.4) * 0.5, 0), direction: beamDir, length: 7.5,
      color: 0x9fc0ff, intensity: 0.1, softness: 0.35, falloff: 1.1, panes: [2, 4], mullion: 0.03, noise: 0.35,
    });
    root.add(shaft);
    root.add(fx.dust({ box: new THREE.Box3(V3(X0 + 0.1, 0.05, Z0 + 0.1), V3(X1 - 0.1, 3.2, -2.5)), count: 300, shafts: [shaft], size: 0.007, intensity: 0.7, ambient: 0.015 }));
    root.add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.05, 0, Z0 + 0.3), V3(X1 - 0.05, 0.6, Z1 - 0.2)), color: 0x080c18, litColor: 0x121a2e, density: 0.18, heightFalloff: 4 }));

    // ================================================================ navigation
    const nodes = {
      main: { position: [0.28, 1.62, 7.35], target: [-0.08, 1.48, -9.0], fov: 56, label: 'The gallery', look: { yaw: [-55, 55], pitch: [-28, 26] } },
      back: { position: [0.2, 1.62, 5.6], target: [0.0, 1.35, 14.0], fov: 58, label: 'The stair landing' },
      bedroom: { position: [-0.95, 1.62, 4.1], target: [1.6, 1.62, 2.75], fov: 58, label: 'The bedroom door' },
      portraits: { position: [0.62, 1.62, 1.15], target: [-1.6, 1.68, -0.75], fov: 56, label: 'The Toymaker', look: { yaw: [-60, 60], pitch: [-28, 26] } },
      gamedoor: { position: [-0.95, 1.62, -2.4], target: [1.6, 1.62, -4.05], fov: 58, label: 'The game room door' },
      far: { position: [0.12, 1.62, -3.4], target: [0.0, 1.62, -9.0], fov: 56, label: 'The window', look: { yaw: [-60, 60], pitch: [-28, 28] } },
      attic: { position: [0.85, 1.62, -5.6], target: [-1.6, 1.45, -7.4], fov: 58, label: 'The attic door' },
    };
    const edges = [
      ['main', 'back', null, { hotspot: { back: { position: [0.0, 1.4, 8.6], radius: 0.8 }, main: { position: [0.0, 1.5, 2.0], radius: 0.8 } } }],
      ['main', 'bedroom', [[0.1, 1.62, 5.4]]],
      ['main', 'portraits', [[0.4, 1.62, 3.6]]],
      ['bedroom', 'portraits', [[-0.1, 1.62, 2.4]]],
      ['portraits', 'gamedoor', [[0.0, 1.62, -1.6]]],
      ['portraits', 'far', [[0.25, 1.62, -1.2]]],
      ['gamedoor', 'far', null],
      ['far', 'attic', [[0.35, 1.62, -5.0]]],
      ['gamedoor', 'attic', [[0.2, 1.62, -4.8]]],
      ['far', 'main', [[0.2, 1.62, 1.0], [0.25, 1.62, 5.0]], { hidden: true }],
    ];
    const dBox = (d, pad = 0.0) => {
      const x = d.side < 0 ? X0 : X1;
      return { min: [Math.min(x, x - d.side * 0.25), 0.1, d.z - d.w / 2 - pad], max: [Math.max(x, x - d.side * 0.25), d.h, d.z + d.w / 2 + pad] };
    };
    const exits = [
      { node: 'back', toRoom: 'foyer', toNode: 'landing_n', label: 'Down to the foyer', hotspot: { box: { min: [-ARCH.w / 2, 0.1, Z1 + 0.2], max: [ARCH.w / 2, 2.6, Z1 + 2.6] } } },
      { node: 'bedroom', toRoom: 'bedroom', toNode: null, label: 'The bedroom', hotspot: { box: dBox(DOORS.bedroom) } },
      { node: 'gamedoor', toRoom: 'gameroom', toNode: null, label: 'The game room', hotspot: { box: dBox(DOORS.gameroom) } },
      { node: 'attic', toRoom: 'attic', toNode: null, label: 'Up to the attic', hotspot: { box: dBox(DOORS.attic, 0.05) }, enabled: (st) => !!(st.get?.('gallery.atticOpen') || st.isSolved?.(SLIDE_ID)) },
    ];

    // ================================================================ hotspots
    // boxes for props that get merged into static batches below
    const bbox = (o, pad = 0.02) => { o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o).expandByScalar(pad); return { min: b.min.toArray(), max: b.max.toArray() }; };
    const panelBox = bbox(panel), clockBox = bbox(clock), consoleBox = bbox(consoleT.group), bustBox = bbox(bust);
    const say = (text) => ctx.say({ text, speaker: 'stauf', speakerName: 'Stauf' });
    const examine = (title, text) => () => ctx.ui.caption(text, { title });
    const hotspots = [
      { id: 'puzzle', nodes: ['portraits', 'main', 'bedroom'], box: panelBox, cursor: 'puzzle', label: "The Toymaker's likeness", puzzle: slide.puzzle, enabled: () => !ctx.state.isSolved(SLIDE_ID) },
      { id: 'puzzle-done', nodes: ['portraits'], box: panelBox, cursor: 'examine', label: 'The Toymaker', enabled: () => ctx.state.isSolved(SLIDE_ID), onActivate: async () => { ctx.audio.sfx('laugh'); await say('Handsome devil, isn\'t he? I had the eyes done *last*.'); } },
      { id: 'bust', nodes: ['portraits', 'gamedoor', 'bedroom'], box: bustBox, cursor: 'examine', label: 'A shrouded bust', onActivate: examine('Under the Sheet', 'Someone has covered a bust with a dust sheet. Under the cloth the features are just too sharp: the nose, the brow, the open mouth.') },
      { id: 'lady', nodes: ['main', 'bedroom'], object: pLady.group, cursor: 'examine', label: 'A lady in blue', onActivate: examine('The Lady in Blue', 'Her pearls are painted with real care. Her smile was painted over twice — you can see the ghost of a different mouth beneath the varnish.') },
      { id: 'colonel', nodes: ['bedroom', 'portraits', 'main'], object: pColonel.group, cursor: 'examine', label: 'The captain', onActivate: examine('The Captain', 'Scarlet coat, brass buttons, whiskers like a hedge in winter. A brass label once named him; someone has scratched it out with a pin.') },
      { id: 'child', nodes: ['portraits', 'gamedoor', 'bedroom'], object: pChild.group, cursor: 'talk', label: 'A pale child', onActivate: async () => { ctx.audio.sfx('chime', { freq: 1320 }); await ctx.ui.caption('A small child in a starched collar. For a moment you could swear the paint is still wet around the eyes.', { title: 'The Boy' }); } },
      { id: 'widow', nodes: ['portraits', 'gamedoor', 'bedroom'], object: pWidow.group, cursor: 'examine', label: 'A widow in black', onActivate: examine('The Widow', 'Black bombazine, a brooch at her throat. The canvas is warm to the touch, as though someone had been standing very close to it.') },
      { id: 'belle', nodes: ['main', 'back', 'bedroom'], object: oBelle, cursor: 'examine', label: 'A girl in green', onActivate: examine('The Girl in Green', 'A small oval, very finely done. The green of her dress has been mixed with something that was never paint.') },
      { id: 'doctor', nodes: ['main', 'bedroom', 'portraits'], object: pDoctor.group, cursor: 'examine', label: 'A bearded man', onActivate: examine('The Physician', 'Pince-nez, a black coat, a gold watch-chain. On the back of the canvas, in pencil: \'He came to treat the children. He stayed.\'') },
      { id: 'elder', nodes: ['main', 'back', 'portraits'], object: pElder.group, cursor: 'talk', label: 'An old man', onActivate: async () => { await say('My dear old patron. He *also* thought he could leave whenever he liked.'); } },
      { id: 'clock', nodes: ['far', 'attic', 'gamedoor'], box: clockBox, cursor: 'examine', label: 'The long-case clock', onActivate: () => { ctx.audio.chimeClock?.(1); ctx.ui.caption('Its hands are stopped at five minutes to midnight. Yet you can hear it ticking.', { title: 'The Clock' }); } },
      { id: 'window', nodes: ['far', 'attic'], box: { min: [-WIN.w / 2, WIN.sill + 0.1, Z0 - WIN.depth], max: [WIN.w / 2, WIN.sill + WIN.h, Z0 - WIN.depth + 0.2] }, cursor: 'examine', label: 'The window', onActivate: examine('The Window', 'The moon hangs over the grounds like a coin on a dead man\'s eye. Down in the garden nothing moves. Nothing at all.') },
      { id: 'attic-locked', nodes: ['attic', 'far'], box: dBox(DOORS.attic, 0.05), cursor: 'examine', label: 'A narrow door', enabled: () => !ctx.state.isSolved(SLIDE_ID), onActivate: async () => { ctx.audio.sfx('thud'); await ctx.ui.caption('Latched fast. The keyhole is shaped like a tiny eye — and it is shut.', { title: 'The Attic Door' }); } },
      { id: 'ghost', nodes: ['far', 'attic', 'main'], sphere: { center: [GHOST.x, 1.0, GHOST.z], radius: 0.55 }, cursor: 'ghost', label: 'A grey shape', onActivate: () => ctx.cinematic(async (c, h) => {
        ctx.post.set({ saturation: 0.6, vignette: 0.6 }, 0.8);
        ghostBoost = 0.6;
        await ctx.nav.lookAt(V3(GHOST.x, 1.45, GHOST.z), 1.2);
        await ctx.say({ text: 'She walks the gallery every night, looking for the child she lost. She never looks *up*.', speaker: 'stauf', speakerName: 'Stauf' });
        await h.wait(0.4);
        ghostBoost = 0;
        ctx.post.set({ saturation: 1.05, vignette: 0.48 }, 1.2);   // back to the room's own grade
        await ctx.nav.returnToNode(1.0);
      }) },
      { id: 'console', nodes: ['portraits', 'gamedoor', 'far'], box: consoleBox, cursor: 'examine', label: 'A console table', onActivate: examine('Dried Roses', 'Roses dried in a blue jar, black at the edges, beside an empty birdcage. In the mirror above, the hall behind you looks a little longer than it should.') },
    ];

    // ================================================================ QA hooks
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {}; dbg.states ||= {};
      dbg.solvers.gallery = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'gallery' && game.startPuzzle && !ctx.state.isSolved(SLIDE_ID)) {
          game.startPuzzle(slide.puzzle);
          await new Promise((r) => setTimeout(r, 50));
        }
        if (game?.puzzle?.def?.id === SLIDE_ID) { slide.puzzle.autoSolve(game.puzzle.pctx); return true; }
        slide.forceSolved(); ctx.state.markSolved?.(SLIDE_ID); applySolved(false);
        return true;
      };
      dbg.states.gallery = () => ({ ...slide.state(), isSolved: ctx.state.isSolved(SLIDE_ID), atticOpen: !!ctx.state.get('gallery.atticOpen') });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.gallery = { slide, slideAt: slide.slideAt, portraits };
    }

    // ================================================================ shadows + merge
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || (m?.transparent && (m.opacity ?? 1) < 0.95) || o.userData.noBake;
      o.castShadow = !o.userData.noShadow && !fxLike && !['floor', 'runner'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    const merged = mergeStatic(root);
    root.userData.mergedCount = merged;

    const godRays = [{ position: V3(0.3, WIN.sill + 1.5, Z0 - 2.0), color: new THREE.Color(0.72, 0.8, 1.0), strength: 0.8, radius: 0.18 }];

    let rayNode = null;
    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      grade: { exposure: 1.85, contrast: 1.12, saturation: 1.05, shadowTint: [0.86, 0.99, 1.1], splitAmount: 0.55, lift: [0.0, 0.004, 0.008], bloomStrength: 0.3, bloomThreshold: 1.35, godRayWeight: 0.35, godRayThreshold: 2.5, vignette: 0.48, aoIntensity: 1.1, aoRadius: 0.4, grain: 0.025 },
      environment: { position: [0.0, 1.7, 0.4], intensity: 0.8 },
      onEnter() {
        if (!ctx.state.has('gallery.greeted')) {
          ctx.state.set('gallery.greeted', true);
          setTimeout(() => say('My family. Such *attentive* company. Do mind your manners — they never forget a face.'), 1600);
        }
      },
      update(dt, t) {
        // side views: the moon is off-screen, so screen-space rays would only smear across the
        // pier glass and the jambs; keep them for the views that look down the hall
        const nid = ctx.nav.current;
        if (nid && nid !== rayNode) {
          // the moonlit end gets its own, harder grade: deeper blacks, neutral-teal shadows
          const cold = ['far', 'attic'].includes(nid);
          ctx.post.set({
            godRayWeight: ['main', 'far', 'attic'].includes(nid) ? 0.35 : 0.0,
            exposure: cold ? 1.6 : 1.85, contrast: cold ? 1.2 : 1.12,
            shadowTint: cold ? [0.9, 1.0, 1.04] : [0.86, 0.99, 1.1],
          }, rayNode ? 0.8 : 0);
          rayNode = nid;
        }
        gaze(dt);
        slide.update(dt);
        if (solvedFx > 0 && solvedFx < 1) {
          solvedFx = Math.min(1, solvedFx + dt * 0.4);
          const e = solvedFx * solvedFx * (3 - 2 * solvedFx);
          atticHinge.rotation.y = -0.55 * e;
          // the eyes kindle in pulses as the face closes up, then hold a steady ember
          toyMat.userData.eyes.uGlow.value = 0.6 * e + Math.max(0, Math.sin(t * 6)) * 0.5 * (1 - e);
        }
      },
      dispose() { const d = window.__debug; if (d) { delete d.gallery; if (d.solvers) delete d.solvers.gallery; if (d.states) delete d.states.gallery; } },
    };
  },
};
