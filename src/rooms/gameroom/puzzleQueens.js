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
 * Carved Jaques-pattern queen (~0.1 * s tall, base radius 0.0228 * s): a wide weighted base with two stepped
 * collars, a slim waisted stem, a pronounced double collar under the crown, a flared cup and a coronet carved as
 * eight pointed merlons (one continuous crenellated wall, outer face + rim + inner face), a domed cap inside it and
 * a small finial ball. Vertex colours carry a dark crevice tone in the coves (concave profile) and inside the crown.
 */
function latheAO(prof, segs, s) {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(1e-5, r * s), y * s)), segs);
  const n = prof.length;
  const ao = prof.map(([r, y], j) => {
    if (j === 0 || j === n - 1) return 1;
    const [r0, y0] = prof[j - 1], [r1, y1] = prof[j + 1];
    const c = r - (r0 + r1) / 2;
    const span = Math.hypot(r1 - r0, y1 - y0) + 1e-6;
    return Math.max(0.25, 1 - 1.0 * Math.min(1, Math.max(0, -c / span) * 6));
  });
  // soften
  const aos = ao.map((v, j) => (j > 0 && j < n - 1 ? (ao[j - 1] + 2 * v + ao[j + 1]) / 4 : v));
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) { const k = aos[i % n]; col.set([k, k * 0.97, k * 0.93], i * 3); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function queenGeometry(G, s = 1) {
  const prof = [
    [0, 0], [0.0218, 0], [0.0228, 0.0006], [0.0228, 0.0034], [0.0222, 0.0040],           // weighted foot, bevelled
    [0.0208, 0.0046], [0.0200, 0.0058],                                                 // cove
    [0.0206, 0.0067], [0.0213, 0.0079], [0.0210, 0.0091], [0.0200, 0.0099],            // torus
    [0.0186, 0.0103], [0.0182, 0.0110],                                                 // fillet (first step)
    [0.0187, 0.0116], [0.0190, 0.0124], [0.0186, 0.0133], [0.0176, 0.0139],            // second collar
    [0.0163, 0.0143], [0.0160, 0.0149],
  ];
  // waisted stem: concave sweep in to ~33% of the base radius, then a slight swell under the collar
  const y0 = 0.0149, y1 = 0.0548, r0 = 0.016, r1 = 0.0074;
  for (let i = 1; i <= 18; i++) { const u = i / 18; prof.push([r1 + (r0 - r1) * Math.pow(1 - u, 2.6) + 0.0004 * Math.sin(u * Math.PI), y0 + (y1 - y0) * u]); }
  prof.push(
    [0.0080, 0.0562], [0.0094, 0.0568],                                                 // flare into the collar
    [0.0122, 0.0574], [0.0131, 0.0581], [0.0131, 0.0592], [0.0122, 0.0599],            // pronounced lower collar ring
    [0.0098, 0.0604], [0.0094, 0.0610],
    [0.0108, 0.0615], [0.0112, 0.0622], [0.0104, 0.0629],                              // smaller upper ring
    [0.0084, 0.0634], [0.0080, 0.0645],
    [0.0088, 0.0668], [0.0102, 0.0700], [0.0120, 0.0735], [0.0138, 0.0765], [0.0150, 0.0786],  // flared cup
    [0.0156, 0.0796], [0.0161, 0.0806],                                                 // crown band
    [0.0166, 0.0830], [0.0171, 0.0862], [0.0175, 0.0896], [0.0174, 0.0908],            // outer wall of the coronet
    [0.0168, 0.0916], [0.0158, 0.0917], [0.0151, 0.0910],                              // rounded lip
    [0.0146, 0.0880], [0.0138, 0.0848], [0.0128, 0.0826],                              // inner wall
    [0.0116, 0.0818], [0.0098, 0.0828], [0.0080, 0.0846], [0.0058, 0.0866], [0.0040, 0.0878],  // domed cap rising inside
    [0.0030, 0.0884], [0.0034, 0.0893], [0.0027, 0.0901], [0, 0.0903],
  );
  const RAD = 96;
  const body = latheAO(prof, RAD, s);
  {
    // carve the coronet: the wall above the band is cut into eight rounded points by a sin(8θ) height deform
    const P = body.attributes.position, C = body.attributes.color;
    const yb = 0.0812 * s;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const r = Math.hypot(x, z) / s;
      if (y <= yb || r < 0.0122) continue;
      const a = Math.atan2(z, x);
      const lobe = Math.pow(0.5 + 0.5 * Math.cos(a * 8), 1.6);
      const f = 0.32 + 0.68 * lobe;
      P.setY(i, yb + (y - yb) * f);
      // the hollows between the points and the inside of the crown take a darker wax tone
      const k = 0.62 + 0.38 * lobe;
      C.setXYZ(i, C.getX(i) * k, C.getY(i) * k, C.getZ(i) * k);
    }
    body.computeVertexNormals();
  }
  const parts = [body];
  // a pearl on each point and the finial ball
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const pb = new THREE.SphereGeometry(0.0021 * s, 12, 8); pb.translate(Math.cos(a) * 0.0164 * s, 0.0925 * s, Math.sin(a) * 0.0164 * s);
    pb.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pb.attributes.position.count * 3).fill(1), 3));
    parts.push(pb);
  }
  const ball = new THREE.SphereGeometry(0.0042 * s, 24, 16); ball.translate(0, 0.0938 * s, 0);
  ball.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(ball.attributes.position.count * 3).fill(1), 3));
  parts.push(ball);
  // cylindrical uv: u around, v up the piece, so the boxwood grain runs vertically
  for (const p of parts) {
    const P = p.attributes.position, uv = new Float32Array(P.count * 2);
    const u0 = p.attributes.uv;
    for (let i = 0; i < P.count; i++) { uv[i * 2] = (p === body ? u0.getX(i) : Math.atan2(P.getZ(i), P.getX(i)) / (Math.PI * 2) + 0.5) * 2; uv[i * 2 + 1] = P.getY(i) / s / 0.02; }
    p.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  const g = G.mergeGeometries(parts.map((p) => {
    const q = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) q.deleteAttribute(k);
    if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
    if (!q.attributes.normal) q.computeVertexNormals();
    return q;
  }));
  return g;
}

export function createQueensPuzzle(ctx, { parent, center, size, homeZ, homeY = 0, homeSpacing, mats, camera, onSolved, onChange, borderOuter }) {
  const { geometry: G } = ctx;
  const sq = size / N;
  const group = new THREE.Group(); group.name = 'queensPuzzle';
  group.position.copy(center);
  group.userData.keep = true;
  parent.add(group);

  const squarePos = (c, r) => new THREE.Vector3((c - 3.5) * sq, 0, (3.5 - r) * sq);
  const homePos = (i) => new THREE.Vector3((i - 3.5) * (homeSpacing ?? sq), homeY, homeZ);

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
  // soft dark contact discs under every queen (fade as she is lifted)
  const aoTex = ctx.textures.canvas('gameroom:queenAO', 64, 64, (c) => { const g2 = c.createRadialGradient(32, 32, 0, 32, 32, 32); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.45, 'rgba(0,0,0,0.75)'); g2.addColorStop(0.75, 'rgba(0,0,0,0.25)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.clearRect(0, 0, 64, 64); c.fillStyle = g2; c.fillRect(0, 0, 64, 64); }, { tile: false });
  const discG = new THREE.PlaneGeometry(sq * 0.98, sq * 0.98).rotateX(-Math.PI / 2);
  for (const q of queens) {
    const d = new THREE.Mesh(discG, new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: 0.6, depthWrite: false, name: 'queenContact' }));
    d.renderOrder = 4; d.userData.noBake = true; d.userData.noShadow = true;
    group.add(d); q.disc = d;
  }
  const syncDiscs = () => {
    for (const q of queens) {
      const baseY = q.sq ? 0 : homeY;
      const lift = q.mesh.position.y - baseY;
      q.disc.position.set(q.mesh.position.x, baseY + 0.0008, q.mesh.position.z);
      q.disc.material.opacity = 0.6 * Math.max(0, 1 - lift / 0.04);
      const k = 1 + lift * 12; q.disc.scale.set(k, 1, k);
    }
  };
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
        float band = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.18, 0.36, t));
        // perimeter coordinate 0..1 around the square, a warm wave running round the stringing twice
        vec2 q = vP / max(e, 1e-4);
        float per = abs(q.x) > abs(q.y) ? (q.x > 0.0 ? 0.125 * q.y : 0.5 - 0.125 * q.y) : (q.y > 0.0 ? 0.25 - 0.125 * q.x : 0.75 + 0.125 * q.x);
        per = fract(per + 0.125);
        float w1 = fract(per * 2.0 - uTime * 0.22);
        float wave = exp(-pow((w1 - 0.5) / 0.09, 2.0));
        gl_FragColor = vec4(vec3(1.0, 0.62, 0.24) * band * (0.18 + 1.2 * wave) * uAmt, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const glow = new THREE.Mesh(new THREE.ShapeGeometry(glowShape).rotateX(-Math.PI / 2), glowMat);
  glow.position.y = 0.0012; glow.renderOrder = 5; glow.visible = false; glow.userData.noBake = true; glow.userData.noShadow = true;
  group.add(glow);
  const sweep = new THREE.PointLight(0xffb060, 0, size * 1.6, 2);
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
      if (solvedFlag) {
        // each queen in turn: a warm rim pulse and a 2 mm lift-and-settle
        const lt = solvedT - 0.28 * q.i;
        const pulse = Math.exp(-(((lt - 0.3) / 0.2) ** 2));
        e.setRGB(0.34, 0.19, 0.05).multiplyScalar(0.08 + 0.9 * pulse);
        if (!anims.some((a) => a.q === q) && q.sq) q.mesh.position.y = 0.002 * Math.sin(Math.PI * Math.min(1, Math.max(0, lt / 0.6)));
      }
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
      sweep.position.set(u * size * 0.6, 0.16, -size * 0.75);
      sweep.intensity = 0.22 * amt;
      syncDiscs();
      return;
    }
    sweep.intensity = 0;
    syncDiscs();
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
