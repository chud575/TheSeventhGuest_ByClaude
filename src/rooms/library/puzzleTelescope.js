// "The Telescope": the brass refractor by the bay window is trained not on the
// stars but on the bookcase frieze, where sixteen four-sided brass prisms sit
// too small and too dusty to read with the naked eye. Through the glass, turn
// each prism until the frieze speaks Stauf's sentence.
import * as THREE from 'three';
import { letterAtlas, letterUV } from './textures.js';

export const PUZZLE_ID = 'library.telescope';
export const PHRASE = 'THE HOUSE IS HUNGRY';
// four letters per prism (index 0 = the correct one); decoys keep false words tempting but wrong
const SETS = [
  'TMBS', 'HAOW', 'EIYU',
  'HLRD', 'OAEI', 'URNL', 'SDTK', 'EYAO',
  'IAOU', 'STNF',
  'HBWD', 'UIAE', 'NRML', 'GTSC', 'RLIT', 'YSEA',
];
// deterministic scramble (face index shown at start, per prism)
const START = [2, 1, 3, 0, 2, 3, 1, 2, 3, 1, 2, 0, 1, 3, 2, 1];

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

export function createTelescopePuzzle(ctx, { parent, frieze, telescope, eyePose, onSolvedFx }) {
  const atlas = letterAtlas(ctx);
  const tileMat = new THREE.MeshStandardMaterial({
    map: atlas, emissiveMap: atlas, emissive: new THREE.Color(1, 0.86, 0.6), emissiveIntensity: 0.04,
    metalness: 0.75, roughness: 0.42, envMapIntensity: 1.2, name: 'letter-tiles',
  });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x5c4320, metalness: 0.85, roughness: 0.45 });
  const slots = [];
  const chars = PHRASE.split('');
  const slotW = (frieze.x1 - frieze.x0) / chars.length;
  const tw = slotW * 0.84, ts = 0.092;
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
    p.position.set(x, frieze.y, frieze.z + ts / 2 + 0.006);
    for (let k = 0; k < 4; k++) {
      const g = new THREE.PlaneGeometry(tw, ts);
      const [u0, v0, u1, v1] = letterUV(set[k]);
      const uv = g.attributes.uv;
      // canvas textures are flipY=true: row 0 at the top
      for (let n = 0; n < uv.count; n++) uv.setXY(n, uv.getX(n) ? u1 : u0, uv.getY(n) ? 1 - v0 : 1 - v1);
      g.translate(0, 0, ts / 2);
      g.rotateX(-k * Math.PI / 2);
      const face = new THREE.Mesh(g, tileMat);
      face.userData.prism = li;
      p.add(face);
    }
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.004, ts * 0.98, ts * 0.98), capMat);
      cap.position.x = s * tw / 2; p.add(cap);
    }
    // axle
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, slotW, 8).rotateZ(Math.PI / 2), capMat);
    p.add(axle);
    group.add(p);
    prisms.push({ group: p, set, face: START[li] % 4, angle: (START[li] % 4) * Math.PI / 2, target: (START[li] % 4) * Math.PI / 2 });
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
        float edge = smoothstep(0.9, 0.97, r);
        float rim = smoothstep(0.86, 0.93, r) * (1.0 - smoothstep(0.95, 1.0, r));
        vec3 brass = vec3(0.35, 0.24, 0.1) * (0.6 + 0.4 * sin(atan(p.y, p.x) * 3.0 + 1.0));
        float a = max(edge, rim * 0.6);
        vec3 col = mix(brass * rim, vec3(0.0), edge);
        // faint crosshair etched in the reticle
        float ch = (1.0 - smoothstep(0.0, 0.003, abs(p.x))) + (1.0 - smoothstep(0.0, 0.003, abs(p.y)));
        float chm = ch * 0.12 * step(r, 0.86) * step(0.05, r);
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
    p.face = (p.face + dir + 4) % 4;
    p.target += dir * Math.PI / 2;
  };
  const resetState = () => prisms.forEach((p, i) => { p.face = START[i] % 4; p.target = p.angle = p.face * Math.PI / 2; p.group.rotation.x = p.angle; });
  const applySolved = (instant = false) => {
    prisms.forEach((p) => {
      const d = ((-p.face % 4) + 4) % 4;
      p.face = 0; p.target += d * Math.PI / 2;
      if (instant) { p.angle = p.target; p.group.rotation.x = p.angle; }
    });
    tileMat.emissiveIntensity = 0.5;
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
      ctx.post.set({ exposure: 2.6, vignette: 0.0, dof: null, bloomStrength: 0.25 }, 0.4);
      p.status('Click a prism to turn it. ' + RIDDLE[0] + ' ' + RIDDLE[1]);
      ctx.audio.sfx?.('chime', { freq: 330 });
    },
    teardown() {
      vig.visible = false;
      telescope.tubeVisible(true);
      ctx.post.reset(0.6);
    },
    reset(p) { resetState(); p.status('The prisms clatter back to where Stauf left them.'); },
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
