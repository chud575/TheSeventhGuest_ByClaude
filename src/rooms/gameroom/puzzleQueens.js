import * as THREE from 'three';

/**
 * "The Queens' Gambit" — homage to the eight-queens puzzle of the 1993 game room.
 *
 * Eight carved ivory queens wait in a row along the near border of an inlaid
 * board. Click an empty square and the next queen glides onto it; click a placed
 * queen to send her home. A queen that is attacked (same rank, file or diagonal
 * as another) flushes blood-red; hovering a queen shows every square she
 * threatens. Eight queens, none attacking another, solves it.
 */

export const QUEENS_ID = 'gameroom.queens';
export const queensMeta = {
  id: QUEENS_ID,
  title: 'The Queens',
  description: 'Place all eight queens on the board so that no queen can take another — no two may share a rank, a file, or a diagonal.',
  hints: [
    'A queen strikes along her rank, her file and both diagonals, as far as the board runs. Eight queens means exactly one on every rank and one on every file.',
    'Corners and centres are traps. Start the nearest rank on its first square, then on each rank further away try the leftmost square no queen can see — and when you are stuck, move the queen behind you along.',
    'One answer, nearest rank first, files lettered left to right: A, E, H, F, C, G, B, D.',
  ],
};

export const SOLUTION = [0, 4, 7, 5, 2, 6, 1, 3];          // file for each rank (rank 0 = nearest the player)
const N = 8;

/**
 * Carved Staunton-style queen: moulded plinth with two beads, a fluted waist, a
 * beaded collar, and a flared coronet notched into eight real points around a
 * domed cap and ball finial. ~0.097 * s tall, base radius 0.0215 * s.
 */
export function queenGeometry(G, s = 1) {
  const prof = [
    [0, 0], [0.0215, 0], [0.0219, 0.0025], [0.0212, 0.005], [0.0203, 0.006], [0.0211, 0.0078], [0.0203, 0.0098], [0.0185, 0.011],
    [0.0166, 0.0128], [0.0174, 0.0148], [0.0166, 0.0166], [0.0146, 0.0182], [0.0128, 0.0215], [0.0114, 0.028], [0.0101, 0.037],
    [0.0091, 0.046], [0.0084, 0.054], [0.0083, 0.0585], [0.0118, 0.0598], [0.0131, 0.0618], [0.0131, 0.0636], [0.0118, 0.0652],
    [0.0088, 0.066], [0.0084, 0.0685], [0.0094, 0.0712], [0.0, 0.0712],
  ];
  const RAD = 48;
  const body = G.latheFromProfile(prof.map(([r, y]) => [r * s, y * s]), RAD);
  // flutes on the waist
  {
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i) / s, z = p.getZ(i);
      if (y < 0.022 || y > 0.0565) continue;
      const a = Math.atan2(z, x);
      const w = Math.sin(((y - 0.022) / 0.0345) * Math.PI);
      const k = 1 - 0.07 * w * Math.pow(0.5 + 0.5 * Math.cos(a * 12), 2);
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    body.computeVertexNormals();
  }
  const parts = [body];
  // beaded collar
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const b = new THREE.SphereGeometry(0.0021 * s, 8, 6);
    b.translate(Math.cos(a) * 0.0133 * s, 0.0627 * s, Math.sin(a) * 0.0133 * s);
    parts.push(b);
  }
  // coronet: per-angle profile (outer wall up to a point/notch, rim, inner wall)
  {
    const N = 96, pos = [], idx = [];
    const y0 = 0.0705, r0 = 0.0093, r1 = 0.0168, th = 0.0014;
    const topY = (a) => { const c = Math.abs(Math.cos(a * 4)); return 0.0855 + 0.0075 * Math.pow(c, 4) - 0.0025 * Math.pow(1 - c, 2); };
    const cols = 6;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const yt = topY(a);
      const pts = [[r0, y0], [r0 + (r1 - r0) * 0.45, y0 + (yt - y0) * 0.55], [r1, yt], [r1 - th, yt], [r0 + (r1 - r0) * 0.45 - th, y0 + (yt - y0) * 0.55 + 0.0005], [r0 - th, y0 + 0.003]];
      for (const [r, y] of pts) pos.push(ca * r * s, y * s, sa * r * s);
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = (i + 1) * cols + j;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cg.setIndex(idx); cg.computeVertexNormals();
    parts.push(cg);
  }
  const dome = new THREE.SphereGeometry(0.0118 * s, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.62, 1); dome.translate(0, 0.0815 * s, 0); parts.push(dome);
  const stem = G.latheFromProfile([[0, 0.088], [0.0024, 0.088], [0.0034, 0.0895], [0.0018, 0.0915], [0, 0.0915]].map(([r, y]) => [r * s, y * s]), 16); parts.push(stem);
  const ball = new THREE.SphereGeometry(0.0043 * s, 16, 12); ball.translate(0, 0.0955 * s, 0); parts.push(ball);
  const g = G.mergeGeometries(parts.map((p) => {
    const q = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k);
    if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
    if (!q.attributes.normal) q.computeVertexNormals();
    return q;
  }));
  return g;
}

export function createQueensPuzzle(ctx, { parent, center, size, homeZ, mats, camera, onSolved, onChange, borderOuter }) {
  const { geometry: G } = ctx;
  const sq = size / N;
  const group = new THREE.Group(); group.name = 'queensPuzzle';
  group.position.copy(center);
  group.userData.keep = true;
  parent.add(group);

  const squarePos = (c, r) => new THREE.Vector3((c - 3.5) * sq, 0, (3.5 - r) * sq);
  const homePos = (i) => new THREE.Vector3((i - 3.5) * sq, 0, homeZ);

  // ---------------------------------------------------------------- pieces
  const qg = queenGeometry(G, (sq / 0.057) * 1.12);
  const queens = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(qg, mats.ivory.clone());
    m.material.emissive = new THREE.Color(0, 0, 0);
    m.castShadow = true; m.receiveShadow = true;
    m.position.copy(homePos(i));
    m.rotation.y = (i * 0.7) % 1.3;
    m.userData.queen = i;
    group.add(m);
    queens.push({ mesh: m, sq: null, i });
  }
  // invisible pick plane over the 8x8 field
  const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), pickMat);
  pickPlane.position.y = 0.001; pickPlane.userData.noBake = true; pickPlane.userData.noShadow = true;
  group.add(pickPlane);
  // square overlays (threat / hover)
  const ovG = new THREE.PlaneGeometry(sq * 0.92, sq * 0.92).rotateX(-Math.PI / 2);
  const overlays = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const om = new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    const o = new THREE.Mesh(ovG, om);
    o.position.copy(squarePos(c, r)); o.position.y = 0.0015; o.visible = false; o.renderOrder = 5; o.userData.noBake = true; o.userData.noShadow = true;
    group.add(o); overlays.push(o);
  }
  const ov = (c, r) => overlays[r * N + c];
  // solved: the stringing/dentil border warms to a gilt glow, and a warm rim light sweeps the queens
  const glowShape = new THREE.Shape();
  const go = size / 2 + (borderOuter ?? size * 0.12), gi = size / 2 + 0.002;
  glowShape.moveTo(-go, -go); glowShape.lineTo(go, -go); glowShape.lineTo(go, go); glowShape.lineTo(-go, go); glowShape.lineTo(-go, -go);
  const gh = new THREE.Path(); gh.moveTo(-gi, -gi); gh.lineTo(-gi, gi); gh.lineTo(gi, gi); gh.lineTo(gi, -gi); gh.lineTo(-gi, -gi); glowShape.holes.push(gh);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uAmt: { value: 0 }, uTime: ctx.time, uIn: { value: gi }, uOut: { value: go } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uAmt; uniform float uTime; uniform float uIn; uniform float uOut; varying vec2 vP;
      void main(){ float e = max(abs(vP.x), abs(vP.y)); float t = (e - uIn) / (uOut - uIn);
        float band = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.35, 0.6, t));
        float a = atan(vP.y, vP.x); float run = 0.6 + 0.4 * sin(a * 2.0 - uTime * 1.5);
        gl_FragColor = vec4(vec3(1.0, 0.68, 0.28) * band * run * uAmt * 0.55, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const glow = new THREE.Mesh(new THREE.ShapeGeometry(glowShape).rotateX(-Math.PI / 2), glowMat);
  glow.position.y = 0.0012; glow.renderOrder = 5; glow.visible = false; glow.userData.noBake = true; glow.userData.noShadow = true;
  group.add(glow);
  const sweep = new THREE.PointLight(0xffb060, 0, size * 1.2, 2);
  sweep.position.set(0, 0.07, 0); group.add(sweep);
  let solvedT = 0;

  // ---------------------------------------------------------------- state
  let hoverSq = null, hoverQueen = -1, solvedFlag = false;
  const anims = [];
  const board = () => queens.filter((q) => q.sq);
  const queenAt = (c, r) => queens.find((q) => q.sq && q.sq[0] === c && q.sq[1] === r);
  const attacks = (a, b) => a[0] === b[0] || a[1] === b[1] || Math.abs(a[0] - b[0]) === Math.abs(a[1] - b[1]);
  const conflicts = () => {
    const placed = board(); const bad = new Set();
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) if (attacks(placed[i].sq, placed[j].sq)) { bad.add(placed[i].i); bad.add(placed[j].i); }
    return bad;
  };
  function moveTo(q, target, instant, lift = 0.09) {
    for (let k = anims.length - 1; k >= 0; k--) if (anims[k].q === q) anims.splice(k, 1);
    if (instant) { q.mesh.position.copy(target); return; }
    anims.push({ q, from: q.mesh.position.clone(), to: target.clone(), t: 0, d: 0.75, lift });
  }
  function place(q, c, r, instant = false) { q.sq = [c, r]; moveTo(q, squarePos(c, r), instant); }
  function sendHome(q, instant = false) { q.sq = null; moveTo(q, homePos(q.i), instant); }
  function nextFree() { return queens.find((q) => !q.sq); }

  function refresh(t = 0) {
    const bad = conflicts();
    for (const q of queens) {
      const e = q.mesh.material.emissive;
      if (solvedFlag) { const sx = Math.sin(t * 0.45) * size * 0.65; e.setRGB(0.3, 0.17, 0.04).multiplyScalar(0.18 + 0.6 * Math.exp(-(((q.mesh.position.x - sx) / (size * 0.22)) ** 2))); }
      else if (bad.has(q.i)) e.setRGB(0.55, 0.03, 0.01).multiplyScalar(0.65 + 0.35 * Math.sin(t * 6));
      else if (q.i === hoverQueen) e.setRGB(0.12, 0.08, 0.02);
      else e.setRGB(0, 0, 0);
    }
    for (const o of overlays) { o.visible = false; o.material.opacity = 0; }
    glow.visible = solvedFlag;
    if (solvedFlag) {
      const amt = Math.min(1, 0.35 + solvedT * 0.4);
      glowMat.uniforms.uAmt.value = amt;
      // the rim light sweeps slowly from one side of the board to the other and back, low and warm
      const u = Math.sin(t * 0.45);
      sweep.position.set(u * size * 0.65, 0.06, -size * 0.62);
      sweep.intensity = 0.55 * amt;
      return;
    }
    sweep.intensity = 0;
    const hq = hoverQueen >= 0 ? queens[hoverQueen] : null;
    if (hq?.sq) {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (c === hq.sq[0] && r === hq.sq[1]) continue;
        if (attacks(hq.sq, [c, r])) { const o = ov(c, r); o.visible = true; o.material.color.setRGB(1, 0.16, 0.06); o.material.opacity = 0.16; }
      }
    }
    if (hoverSq && !queenAt(...hoverSq)) {
      const o = ov(...hoverSq); o.visible = true;
      const threatened = board().some((q) => attacks(q.sq, hoverSq));
      if (threatened) o.material.color.setRGB(1, 0.2, 0.08); else o.material.color.setRGB(1, 0.72, 0.3);
      o.material.opacity = threatened ? 0.2 : 0.3;
    }
  }

  function statusLine() {
    const n = board().length, bad = conflicts().size;
    if (solvedFlag) return 'Eight queens, and not one of them can touch another.';
    if (n === 0) return 'Click a square to set down the first queen.';
    if (bad) return `${n} of ${N} queens placed — ${bad} of them under attack.`;
    return `${n} of ${N} queens placed. None threatened — yet.`;
  }
  function check(p) {
    const n = board().length, bad = conflicts().size;
    onChange?.(state());
    if (n === N && bad === 0 && !solvedFlag) {
      solvedFlag = true;
      p?.status?.(statusLine());
      setTimeout(() => p?.solve?.(), 900);
      return true;
    }
    p?.status?.(statusLine());
    if (n === N && bad) p?.say?.({ text: 'All eight on the board... and still they *quarrel*.', speaker: 'stauf', speakerName: 'Stauf' });
    return false;
  }

  function pick(p, ndc) {
    const hits = p.raycast([pickPlane, ...queens.map((q) => q.mesh)], ndc);
    for (const h of hits) {
      if (h.object.userData.queen !== undefined) return { queen: h.object.userData.queen };
      if (h.object === pickPlane) {
        const lp = group.worldToLocal(h.point.clone());
        const c = Math.floor(lp.x / sq + 4), r = Math.floor(-lp.z / sq + 4);
        if (c >= 0 && c < N && r >= 0 && r < N) { const q = queenAt(c, r); return q ? { queen: q.i, sq: [c, r] } : { sq: [c, r] }; }
      }
    }
    return {};
  }

  function clickSquare(c, r, p) {
    if (solvedFlag) return false;
    const there = queenAt(c, r);
    if (there) { sendHome(there); p?.audio?.sfx?.('pickup'); return check(p); }
    const q = nextFree();
    if (!q) { p?.fail?.('All eight queens are already on the board. Click one to lift her off.'); return false; }
    place(q, c, r); p?.audio?.sfx?.('click');
    return check(p);
  }

  function resetAll(instant = false) {
    solvedFlag = false;
    for (const q of queens) sendHome(q, instant);
    refresh();
  }
  function applySolved() {
    for (const q of queens) { q.sq = [SOLUTION[q.i], q.i]; moveTo(q, squarePos(SOLUTION[q.i], q.i), true); }
    solvedFlag = true; solvedT = 2;
    refresh(2);
  }
  function state() {
    return { solved: solvedFlag, placed: board().map((q) => q.sq.slice()), conflicts: [...conflicts()], animating: anims.length > 0 };
  }

  const puzzle = {
    ...queensMeta,
    camera,
    cameraDuration: 1.4,
    setup(p) { p.status(statusLine()); },
    update(dt, t) {
      for (let k = anims.length - 1; k >= 0; k--) {
        const a = anims[k];
        a.t += dt;
        const u = Math.min(1, a.t / a.d);
        const e = u * u * (3 - 2 * u);
        a.q.mesh.position.lerpVectors(a.from, a.to, e);
        a.q.mesh.position.y += Math.sin(u * Math.PI) * a.lift;
        if (u >= 1) { a.q.mesh.position.copy(a.to); anims.splice(k, 1); }
      }
      if (solvedFlag) solvedT += dt;
      refresh(t);
    },
    cursorAt(ndc, p) {
      if (solvedFlag) { hoverSq = null; hoverQueen = -1; return 'default'; }
      const hit = pick(p, ndc);
      hoverSq = hit.sq || null;
      hoverQueen = hit.queen ?? -1;
      if (hit.queen !== undefined) return queens[hit.queen].sq ? 'grab' : 'default';
      return hit.sq ? 'grab' : 'default';
    },
    onPointer(type, e, ndc, p) {
      if (type !== 'down' || solvedFlag) return;
      const hit = pick(p, ndc);
      if (hit.queen !== undefined && queens[hit.queen].sq) { const [c, r] = queens[hit.queen].sq; clickSquare(c, r, p); return; }
      if (hit.sq) clickSquare(hit.sq[0], hit.sq[1], p);
    },
    reset(p) { if (solvedFlag) return; resetAll(false); p.status('The queens return to their places.'); onChange?.(state()); },
    autoSolve(p) {
      solvedFlag = false;
      queens.forEach((q, i) => { q.sq = [SOLUTION[i], i]; moveTo(q, squarePos(SOLUTION[i], i), false); });
      solvedFlag = true;
      onChange?.(state());
      p.status(statusLine());
      setTimeout(() => p.solve(), 900);
    },
    async onSolved(p) { solvedFlag = true; await onSolved?.(p); },
    teardown() { hoverSq = null; hoverQueen = -1; refresh(); },
  };

  return {
    puzzle, group, queens, applySolved, state, reset: resetAll,
    tick: (dt, t) => puzzle.update(dt, t),
    /** QA: click a square (c = file 0..7 left->right, r = rank 0..7 near->far) */
    click: (c, r, p = {}) => clickSquare(c, r, { status() {}, fail() {}, say() {}, solve() {}, ...p }),
    /** QA/screenshots: place queens instantly at [[c,r],...] */
    arrange(list) { resetAll(true); list.forEach(([c, r], i) => place(queens[i], c, r, true)); refresh(1); onChange?.(state()); },
    hover(c, r) { hoverSq = [c, r]; const q = queenAt(c, r); hoverQueen = q ? q.i : -1; refresh(1); },
  };
}
