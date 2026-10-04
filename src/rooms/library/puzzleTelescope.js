// "The Telescope": the brass refractor by the bay window is trained not on the
// stars but on the bookcase frieze, where sixteen three-sided brass rotors sit
// too small and too dusty to read with the naked eye. Through the glass, turn
// each prism until the frieze speaks Stauf's sentence.
import * as THREE from 'three';
import { letterAtlas, letterUV } from './textures.js';

export const PUZZLE_ID = 'library.telescope';
export const PHRASE = 'THE HOUSE IS HUNGRY';
// three letters per rotor (index 0 = the correct one); decoys keep false words tempting but wrong
const SETS = [
  'TMB', 'HAO', 'EIY',
  'HLR', 'OAE', 'URN', 'SDT', 'EYA',
  'IAO', 'STN',
  'HBW', 'UIA', 'NRM', 'GTS', 'RLI', 'YSE',
];
const NF = 3;
const STEP = (Math.PI * 2) / NF;
// deterministic scramble (face index shown at start, per rotor)
const START = [2, 1, 1, 0, 2, 1, 1, 2, 2, 1, 2, 0, 1, 2, 2, 1];

export const RIDDLE = [
  'Through my glass the far grows near;',
  'four brass words are waiting here.',
  'Say what feeds on all who stay —',
  'and what it craves, both night and day.',
];

export const telescopeMeta = {
  id: PUZZLE_ID,
  title: 'The Telescope',
  description: 'The telescope is not trained on the stars. Turn the brass prisms of the far frieze until they speak.',
  hints: [
    'Look through the telescope: the frieze above the bookcase holds four words. Click a prism to turn it to its next letter.',
    'Stauf’s card asks what feeds on everyone who stays. The second word is what you are standing in. The last word is a craving.',
    'The frieze must read: THE HOUSE IS HUNGRY.',
  ],
};

export function createTelescopePuzzle(ctx, { parent, frieze, telescope, eyePose, onSolvedFx, restoreGrade }) {
  const atlas = letterAtlas(ctx);
  // from the room the rotors are what the caption says: small, dusty, dull brass blocks (no legible text);
  // through the glass they are cleaned up by the puzzle's warm light and a little emissive lift
  const DUSTY = new THREE.Color(0x5e584c), CLEAN = new THREE.Color(1, 1, 1);
  const tileMat = new THREE.MeshPhysicalMaterial({
    map: atlas, emissiveMap: atlas, emissive: new THREE.Color(1, 0.86, 0.6), emissiveIntensity: 0.0, color: DUSTY.clone(),
    metalness: 0.85, roughness: 0.6, envMapIntensity: 0.8, clearcoat: 0.0, clearcoatRoughness: 0.5, name: 'letter-tiles',
  });
  const dusty = (on) => { tileMat.color.copy(on ? DUSTY : CLEAN); tileMat.roughness = on ? 0.6 : 0.32; tileMat.envMapIntensity = on ? 0.8 : 1.4; };
  const capMat = new THREE.MeshStandardMaterial({ color: 0x7a5a28, metalness: 0.9, roughness: 0.35, envMapIntensity: 1.3 });
  const slots = [];
  const chars = PHRASE.split('');
  const slotW = (frieze.x1 - frieze.x0) / chars.length;
  const tw = slotW * 0.84, ts = 0.088;          // face width, face height (= triangle side)
  const apo = ts / (2 * Math.sqrt(3));           // apothem: axis -> face
  const circ = ts / Math.sqrt(3);                // circumradius: axis -> edge
  const group = new THREE.Group();
  group.name = 'frieze-prisms';
  parent.add(group);
  let li = 0;
  const prisms = [];
  chars.forEach((ch, i) => {
    const x = frieze.x0 + (i + 0.5) * slotW;
    if (ch === ' ') {
      // a small gilt rosette marks the word gaps
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 16).rotateX(Math.PI / 2), capMat);
      r.position.set(x, frieze.y, frieze.z + 0.012);
      group.add(r);
      return;
    }
    const set = SETS[li];
    const p = new THREE.Group();
    p.position.set(x, frieze.y, frieze.z + circ + 0.006);
    for (let k = 0; k < NF; k++) {
      const g = new THREE.PlaneGeometry(tw, ts);
      const [u0, v0, u1, v1] = letterUV(set[k]);
      const uv = g.attributes.uv;
      // canvas textures are flipY=true: row 0 at the top
      for (let n = 0; n < uv.count; n++) uv.setXY(n, uv.getX(n) ? u1 : u0, uv.getY(n) ? 1 - v0 : 1 - v1);
      g.translate(0, 0, apo);
      g.rotateX(-k * STEP);
      const face = new THREE.Mesh(g, tileMat);
      face.userData.prism = li;
      p.add(face);
    }
    // triangular end plates + rounded (bevelled) brass arrises along the three edges
    for (const sd of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(circ * 1.06, circ * 1.06, 0.004, 3).rotateZ(Math.PI / 2).rotateX(Math.PI / 3), capMat);
      cap.position.x = sd * (tw / 2 + 0.002); p.add(cap);
    }
    for (let k = 0; k < NF; k++) {
      const a = -k * STEP + STEP / 2;
      const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, tw, 10).rotateZ(Math.PI / 2), capMat);
      edge.position.set(0, -Math.sin(a) * circ * 0.97, Math.cos(a) * circ * 0.97);
      p.add(edge);
    }
    // axle
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, slotW, 8).rotateZ(Math.PI / 2), capMat);
    p.add(axle);
    group.add(p);
    prisms.push({ group: p, set, face: START[li] % NF, angle: (START[li] % NF) * STEP, target: (START[li] % NF) * STEP });
    p.rotation.x = prisms[li].angle;
    li++;
  });

  // ------------------------------------------------------------ eyepiece vignette (brass tube edge)
  const vig = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uAspect: { value: 1.33 }, uTime: ctx.time },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uAspect; uniform float uTime;
      void main(){
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
        float r = length(p);
        float edge = smoothstep(1.0, 1.06, r);
        float rim = smoothstep(0.95, 1.01, r) * (1.0 - smoothstep(1.03, 1.08, r));
        vec3 brass = vec3(0.35, 0.24, 0.1) * (0.6 + 0.4 * sin(atan(p.y, p.x) * 3.0 + 1.0));
        // prismatic fringe just inside the field stop (lateral colour of an old achromat)
        float fr = smoothstep(0.86, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
        vec3 fringe = vec3(0.12, 0.05, 0.1) * smoothstep(0.88, 0.95, r) + vec3(0.04, 0.1, 0.08) * (1.0 - smoothstep(0.9, 0.96, r));
        // soft darkening toward the edge of the field (optical vignetting)
        float ov = smoothstep(0.55, 1.0, r) * 0.55;
        float a = max(max(edge, rim * 0.6), max(ov, fr * 0.15));
        vec3 col = mix(brass * rim + fringe * fr, vec3(0.0), max(edge, ov * (1.0 - fr)));
        // faint crosshair etched in the reticle
        float ch = (1.0 - smoothstep(0.0, 0.003, abs(p.x))) + (1.0 - smoothstep(0.0, 0.003, abs(p.y)));
        float chm = ch * 0.12 * step(r, 0.95) * step(0.05, r);
        gl_FragColor = vec4(col, clamp(a + chm, 0.0, 1.0));
      }`,
  }));
  vig.frustumCulled = false;
  vig.renderOrder = 1000;
  vig.visible = false;
  vig.userData.noBake = true;
  parent.parent ? parent.parent.add(vig) : parent.add(vig);

  const isSolvedNow = () => prisms.every((p) => p.face === 0);
  const letters = () => {
    let k = 0;
    return chars.map((c) => (c === ' ' ? ' ' : prisms[k++].set[prisms[k - 1].face])).join('');
  };
  const turn = (i, dir = 1) => {
    const p = prisms[i];
    p.face = (p.face + dir + NF) % NF;
    p.target += dir * STEP;
  };
  const resetState = () => prisms.forEach((p, i) => { p.face = START[i] % NF; p.target = p.angle = p.face * STEP; p.group.rotation.x = p.angle; });
  const applySolved = (instant = false) => {
    prisms.forEach((p) => {
      const d = ((-p.face % NF) + NF) % NF;
      p.face = 0; p.target += d * STEP;
      if (instant) { p.angle = p.target; p.group.rotation.x = p.angle; }
    });
    tileMat.emissiveIntensity = 0.5;
    dusty(false);
  };
  ctx.onUpdate((dt, t) => {
    for (const p of prisms) {
      if (Math.abs(p.target - p.angle) > 1e-4) {
        p.angle += (p.target - p.angle) * Math.min(1, (dt || 0.016) * 12);
        if (Math.abs(p.target - p.angle) < 0.002 || dt === 0) p.angle = p.target;
        p.group.rotation.x = p.angle;
      }
    }
    if (ctx.state.isSolved(PUZZLE_ID)) tileMat.emissiveIntensity = 0.35 + 0.12 * Math.sin(t * 1.7);
  });
  if (ctx.state.isSolved(PUZZLE_ID)) applySolved(true);

  // a hidden candle glow below the frieze so the brass reads gold through the glass
  const warm = new THREE.PointLight(0xffb060, 0.25, 2.2, 2);
  warm.position.set((frieze.x0 + frieze.x1) / 2, frieze.y - 0.35, frieze.z + 0.45);
  parent.add(warm);
  let focusT = 1;
  const focusDist = () => { const e = eyePose(); return new THREE.Vector3(...e.position).distanceTo(new THREE.Vector3(...e.target)); };

  const faces = [];
  group.traverse((o) => { if (o.userData.prism !== undefined) faces.push(o); });
  const hitPrism = (p, ndc) => { const h = p.raycast(faces, ndc)[0]; return h ? h.object.userData.prism : -1; };

  const puzzle = {
    ...telescopeMeta,
    get camera() { return eyePose(); },
    cameraDuration: 1.6,
    solvedDelay: 3.2,
    setup(p) {
      telescope.tubeVisible(false);
      vig.material.uniforms.uAspect.value = (ctx.camera.aspect || 1.33);
      vig.visible = true;
      if (!ctx.state.isSolved(PUZZLE_ID)) tileMat.emissiveIntensity = 0.22;
      dusty(false);
      ctx.post.set({ exposure: 1.9, vignette: 0.0, dof: null, bloomStrength: 0.25, chromaticAberration: 0.0035, saturation: 0.85 }, 0.4);
      focusT = ctx.shot ? 1 : 0;
      warm.intensity = 1.6;
      p.status('Click a rotor to turn it. ' + RIDDLE[0] + ' ' + RIDDLE[1]);
      ctx.audio.sfx?.('chime', { freq: 330 });
    },
    teardown() {
      vig.visible = false;
      if (!ctx.state.isSolved(PUZZLE_ID)) { tileMat.emissiveIntensity = 0.0; dusty(true); }
      telescope.tubeVisible(true);
      warm.intensity = 0.25;
      if (ctx.post.grade) ctx.post.grade.dof = null;
      if (restoreGrade) restoreGrade(0.6); else ctx.post.reset(0.6);
    },
    // focus pull as the eye settles to the glass
    update(dt) {
      if (focusT >= 1 || !ctx.post.grade) return;
      focusT = Math.min(1, focusT + (dt || 0) / 1.4);
      const k = focusT * focusT * (3 - 2 * focusT);
      const d = focusDist();
      ctx.post.grade.dof = focusT >= 1 ? null : { focus: d * (0.35 + 0.65 * k), aperture: 1.6 * (1 - k) + 0.05, maxBlur: 10 * (1 - k) };
    },
    reset(p) { resetState(); p.status('The rotors clatter back to where Stauf left them.'); },
    cursorAt(ndc, p) { return hitPrism(p, ndc) >= 0 ? 'grab' : 'default'; },
    onPointer(type, e, ndc, p) {
      if (type !== 'up') return;
      const i = hitPrism(p, ndc);
      if (i < 0) return;
      turn(i, e?.button === 2 ? -1 : 1);
      ctx.audio.sfx?.('click');
      if (isSolvedNow()) { p.solve(); return; }
      p.status(`The frieze reads: ${letters()}`);
    },
    autoSolve(p) { applySolved(); p.solve?.(); },
    async onSolved(p) {
      tileMat.emissiveIntensity = 0.5;
      p.status('THE HOUSE IS HUNGRY');
      onSolvedFx?.();
    },
  };

  return { puzzle, prisms, letters, isSolvedNow, turn, resetState, applySolved, vignette: vig, group };
}
