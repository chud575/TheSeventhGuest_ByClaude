import * as THREE from 'three';
import * as H from './hexx.js';
import { plateTexture } from './textures.js';

/**
 * "The Infection" — homage to the microscope puzzle of the 1993 attic laboratory.
 *
 * Under the brass objective of Stauf's great microscope lies a specimen plate
 * etched with a hexagonal lattice. Your culture (blue) and his (green) begin on
 * alternating corners. Click one of your cells, then an empty cell one step away
 * (it divides) or two steps away (it leaps). Every green cell touching the cell
 * you land on is infected and turns blue — and Stauf answers in kind. Finish
 * with more cells than Stauf.
 */

export const INFECTION_ID = 'attic.infection';
export const infectionMeta = {
  id: INFECTION_ID,
  title: 'The Infection',
  description: 'Under the microscope two cultures fight for the plate: your blue against Stauf\'s green. Divide into a neighbouring cell, or leap two cells away; whatever you land beside is infected and turns to your colour. End with more cells than he has.',
  hints: [
    'A cell may divide into any empty neighbour — the original stays where it is — or leap exactly two cells away, leaving its old place empty. Dividing always gains you a cell; leaping only moves one.',
    'Before every move, look at what Stauf can do next. Do not leave empty holes beside a crowd of your cells: he will leap into the gap and swallow the lot. Keep your culture packed tight, and grow along the rim where fewer neighbours can touch you.',
    'Divide far more often than you leap, and only leap when it captures three or more. Fill the holes inside your own colony first. If he cannot move at all, the rest of the plate is yours — so hem him into a corner.',
  ],
};

const BLUE_COL = new THREE.Color(0x2a5fd0), GREEN_COL = new THREE.Color(0x8fb81c);

/** organic cell blob: a flattened, slightly lumpy dome with a nucleus dimple */
function blobGeometry(r) {
  const g = new THREE.SphereGeometry(r, 28, 16);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const lump = 1 + 0.06 * Math.sin(a * 3 + 0.5) + 0.04 * Math.sin(a * 5 + 1.3);
    const y = v.y > 0 ? v.y * 0.62 : v.y * 0.12;
    const dimple = v.y > 0 ? 1 - 0.18 * Math.exp(-((v.x * v.x + v.z * v.z) / (r * r)) * 9) : 1;
    p.setXYZ(i, v.x * lump, y * dimple, v.z * lump);
  }
  g.computeVertexNormals();
  return g;
}

export function createInfectionPuzzle(ctx, { parent, center, plateRadius = 0.25, mats, camera, onSolved, onLose, level = 1 }) {
  const { geometry: G } = ctx;
  const group = new THREE.Group(); group.name = 'infectionPuzzle';
  group.position.copy(center);
  group.userData.dynamic = true; group.userData.keep = true;
  parent.add(group);

  const cellU = 0.113;                        // hex circumradius in plate units
  const c = cellU * plateRadius;              // hex circumradius in metres
  const cellPos = (i) => { const [q, r] = H.CELLS[i]; return new THREE.Vector3(c * 1.5 * q, 0, c * Math.sqrt(3) * (r + q / 2)); };
  const POS = H.CELLS.map((_, i) => cellPos(i));

  // ---------------------------------------------------------------- plate
  const plateTex = plateTexture(ctx.textures, { cell: cellU });
  const plateMat = new THREE.MeshPhysicalMaterial({ map: plateTex, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.28, emissive: new THREE.Color(1, 1, 1), emissiveMap: plateTex, emissiveIntensity: 0.12, envMapIntensity: 1.2, name: 'specimenPlate' });
  const plate = new THREE.Mesh(new THREE.CircleGeometry(plateRadius, 96).rotateX(-Math.PI / 2), plateMat);
  plate.receiveShadow = true;
  group.add(plate);
  // brass bezel: knurled outer ring with a bevelled lip
  const bez = new THREE.Mesh(G.latheFromProfile([[plateRadius - 0.004, 0.0], [plateRadius + 0.002, 0.008], [plateRadius + 0.012, 0.01], [plateRadius + 0.02, 0.006], [plateRadius + 0.022, -0.02], [plateRadius + 0.012, -0.026], [plateRadius - 0.002, -0.026]], 128), mats.brass);
  bez.castShadow = true; bez.receiveShadow = true; group.add(bez);
  // stage clips
  for (const s of [-1, 1]) {
    const clip = new THREE.Mesh(new G.RoundedBoxGeometry(0.11, 0.006, 0.024, 2, 0.002), mats.brass);
    clip.position.set(s * (plateRadius + 0.03), 0.012, -plateRadius * 0.45); clip.rotation.y = s * 0.5; clip.castShadow = true; group.add(clip);
  }

  // ---------------------------------------------------------------- cells (two instanced cultures)
  const blob = blobGeometry(c * 0.8);
  // cell skin: a dark nucleus on the crown (top pole of the sphere UVs), granular cytoplasm, a pale membrane at the rim
  const cellTex = ctx.textures.canvas('attic:cell', 256, 256, (g, w, h) => {
    // smooth granular cytoplasm (value noise, no periodic terms), a dark nucleus at the crown, organelles
    const img = g.createImageData(w, h);
    const hsh = (x, y) => { const s2 = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s2 - Math.floor(s2); };
    const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v2 = yf * yf * (3 - 2 * yf);
      return (hsh(xi, yi) * (1 - u) + hsh(xi + 1, yi) * u) * (1 - v2) + (hsh(xi, yi + 1) * (1 - u) + hsh(xi + 1, yi + 1) * u) * v2; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = 1 - y / h;
      const nuc = Math.max(0, 1 - Math.abs(v - 0.93) / 0.075);
      const n = 0.5 * vn(x / 16, y / 16) + 0.3 * vn(x / 7 + 9, y / 7) + 0.2 * vn(x / 3 + 3, y / 3 + 5);
      const gran = n > 0.7 ? 0.75 : 1;
      let k = (0.62 + 0.4 * n) * gran * (1 - nuc * nuc * 0.85);
      k *= 0.75 + 0.25 * Math.min(1, v * 1.6);   // darker toward the base (thicker culture)
      const c = Math.round(Math.min(1, Math.max(0.05, k)) * 255);
      const i = (y * w + x) * 4; img.data[i] = c; img.data[i + 1] = c; img.data[i + 2] = c; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { tile: false });
  const mkCellMat = (col, glow, rimCol) => {
    const m = new THREE.MeshPhysicalMaterial({ map: cellTex, emissiveMap: cellTex, color: col.clone().multiplyScalar(0.55), emissive: col.clone().multiplyScalar(0.8), emissiveIntensity: glow, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.32, sheen: 0.6, sheenRoughness: 0.4, sheenColor: rimCol, envMapIntensity: 0.4, name: 'culture' });
    // membrane: a translucent fresnel rim, as if light scatters through the edge of the cell
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRimC = { value: rimCol };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRimC;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  { float fr = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 2.5); totalEmissiveRadiance += uRimC * fr * 0.9; }');
    };
    m.customProgramCacheKey = () => `culture${rimCol.getHexString()}`;
    return m;
  };
  const blueMat = mkCellMat(BLUE_COL, 0.3, new THREE.Color(0.45, 0.7, 1.0)), greenMat = mkCellMat(GREEN_COL, 0.22, new THREE.Color(0.75, 0.9, 0.3));
  // Stauf's presence while he thinks: a sickly green glow creeps round the bezel and up off the plate
  const staufRing = new THREE.Mesh(new THREE.TorusGeometry(plateRadius + 0.012, 0.006, 8, 128).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.0, 0.12).multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  staufRing.position.y = 0.01; staufRing.userData.noBake = true; staufRing.renderOrder = 6; group.add(staufRing);
  const staufLight = new THREE.PointLight(0x7aff3a, 0, 1.2, 2); staufLight.position.set(0, 0.45, -0.1); group.add(staufLight);
  let presence = 0;
  const blues = new THREE.InstancedMesh(blob, blueMat, H.N + 1);
  const greens = new THREE.InstancedMesh(blob, greenMat, H.N + 1);
  for (const im of [blues, greens]) { im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; group.add(im); }
  // the last instance of each is the "flyer" used for leaps
  const FLY = H.N;

  // ---------------------------------------------------------------- highlights (hex rings)
  const ringG = new THREE.RingGeometry(c * 0.8, c * 0.97, 6, 1).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const rings = new THREE.InstancedMesh(ringG, ringMat, H.N);
  rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(H.N * 3), 3);
  rings.renderOrder = 6; rings.userData.noBake = true; rings.frustumCulled = false; group.add(rings);

  const pick = new THREE.Mesh(new THREE.CircleGeometry(plateRadius, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
  pick.position.y = 0.012; pick.userData.noBake = true; group.add(pick);

  // ---------------------------------------------------------------- state
  let board = H.initialBoard();
  let rand = H.prng(1935);
  let phase = 'player';                     // player | stauf | over | solved
  let selected = -1, hover = -1, result = null, thinkT = 0, moves = 0, lastQuip = -10;
  const sB = new Float32Array(H.N), sG = new Float32Array(H.N);   // displayed scales
  const delay = new Float32Array(H.N);
  let fly = null;                           // { color, from, to, t, d }
  const syncScales = (instant) => { for (let i = 0; i < H.N; i++) { if (instant) { sB[i] = board[i] === H.BLUE ? 1 : 0; sG[i] = board[i] === H.GREEN ? 1 : 0; } delay[i] = 0; } };
  syncScales(true);

  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  function writeInstances(t) {
    for (let i = 0; i < H.N; i++) {
      const breath = 1 + 0.035 * Math.sin(t * 1.7 + i * 1.3);
      q4.setFromAxisAngle(yAxis, i * 0.9 + t * 0.05);
      for (const [im, s] of [[blues, sB[i]], [greens, sG[i]]]) {
        const s0 = Math.max(0, s);
        const sq = Math.sin(Math.PI * Math.min(1, s0)) * (s0 < 0.999 ? 1 : 0);   // squash wide, then spring up
        const k = s0 * breath * (1 + 0.32 * sq);
        sv.set(k, s0 * (0.9 + 0.12 * Math.sin(t * 2.3 + i)) * (1 - 0.4 * sq), k);
        pv.copy(POS[i]); pv.y = 0.002;
        m4.compose(pv, q4, k > 0.001 ? sv : sv.set(0, 0, 0));
        im.setMatrixAt(i, m4);
      }
    }
    for (const im of [blues, greens]) {
      if (fly && ((im === blues) === (fly.color === H.BLUE))) {
        const u = Math.min(1, fly.t / fly.d), e = u * u * (3 - 2 * u);
        pv.lerpVectors(POS[fly.from], POS[fly.to], e); pv.y = 0.002 + Math.sin(u * Math.PI) * c * 2.2;
        sv.setScalar(0.85); m4.compose(pv, q4, sv);
      } else m4.makeScale(0, 0, 0);
      im.setMatrixAt(FLY, m4);
      im.instanceMatrix.needsUpdate = true;
    }
  }

  const tmpC = new THREE.Color();
  function writeRings(t) {
    let n = 0;
    const put = (i, r, g, b) => { m4.makeTranslation(POS[i].x, 0.0025, POS[i].z); rings.setMatrixAt(n, m4); rings.instanceColor.setXYZ(n, r, g, b); n++; };
    if (phase === 'player') {
      if (selected >= 0) {
        const pulse = 0.8 + 0.2 * Math.sin(t * 6);
        put(selected, 1.4 * pulse, 1.2 * pulse, 0.7 * pulse);
        for (const j of H.NEAR[selected]) if (board[j] === H.EMPTY) put(j, j === hover ? 0.5 : 0.15, j === hover ? 1.1 : 0.5, j === hover ? 1.6 : 0.9);
        for (const j of H.FAR[selected]) if (board[j] === H.EMPTY) put(j, j === hover ? 1.2 : 0.45, j === hover ? 0.75 : 0.28, j === hover ? 0.2 : 0.06);
      } else if (hover >= 0 && board[hover] === H.BLUE) put(hover, 0.5, 0.6, 0.9);
    }
    if (phase === 'solved' || (phase === 'over' && result?.winner === H.BLUE)) {
      for (let i = 0; i < H.N; i++) { const k = 0.25 + 0.25 * Math.sin(t * 3 - POS[i].length() * 60); put(i, 0.3 * k, 0.5 * k, 1.2 * k); }
    }
    rings.count = n;
    rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
  }

  function animateMove(color, m, infected) {
    const bArr = color === H.BLUE ? sB : sG, oArr = color === H.BLUE ? sG : sB;
    if (m.jump) {
      bArr[m.from] = 0; fly = { color, from: m.from, to: m.to, t: 0, d: 0.55 };
      delay[m.to] = 0.55;
    } else { delay[m.to] = 0; bArr[m.to] = 0.15; }
    infected.forEach((j, k) => { delay[j] = (m.jump ? 0.55 : 0.2) + 0.12 * k; });
    void oArr;
  }
  function stepScales(dt) {
    if (fly) { fly.t += dt; if (fly.t >= fly.d) fly = null; }
    for (let i = 0; i < H.N; i++) {
      if (delay[i] > 0) { delay[i] -= dt; if (delay[i] > 0) continue; }
      const tb = board[i] === H.BLUE ? 1 : 0, tg = board[i] === H.GREEN ? 1 : 0;
      const k = Math.min(1, dt * 7);
      // shrink first, then grow (an infected cell collapses before it swells in the new colour)
      if (sB[i] > tb) sB[i] = Math.max(tb, sB[i] - dt * 4.5);
      if (sG[i] > tg) sG[i] = Math.max(tg, sG[i] - dt * 4.5);
      if (tb > sB[i] && sG[i] < 0.25) sB[i] += (tb - sB[i]) * k + dt * 0.5;
      if (tg > sG[i] && sB[i] < 0.25) sG[i] += (tg - sG[i]) * k + dt * 0.5;
      sB[i] = Math.min(1, sB[i]); sG[i] = Math.min(1, sG[i]);
    }
  }
  const busy = () => !!fly || [...delay].some((d) => d > 0);

  function statusLine() {
    const b = H.count(board, H.BLUE), g = H.count(board, H.GREEN);
    const score = `Blue ${b}  —  Green ${g}`;
    if (phase === 'solved') return `${score}.  The plate is yours — and Stauf's germs are ash.`;
    if (phase === 'over') return result.winner === H.BLUE ? `${score}.  The plate is yours.` : `${score}.  Stauf\'s culture has the plate. Click the plate to try again.`;
    if (phase === 'stauf') return `${score}.  Stauf is considering...`;
    if (selected >= 0) return `${score}.  Divide into a blue-ringed cell, or leap to an amber one.`;
    return `${score}.  Your move: choose one of your blue cells.`;
  }

  let P = null;           // live puzzle ctx while the puzzle is open
  /** result banner centred over the plate, in the game's title-card typography */
  let bannerEl = null, bannerT = 0;
  function banner(small, big, sec = 5) {
    if (typeof document === 'undefined') return;
    bannerEl?.remove();
    const el = document.createElement('div');
    el.className = 't7-title-card';
    el.style.cssText = 'top: 36vh; padding: 18px 60px 14px; background: radial-gradient(ellipse at center, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 72%); z-index: 60;';
    const a = document.createElement('div'); a.className = 'small'; a.textContent = small;
    const b = document.createElement('div'); b.className = 'big'; b.textContent = big;
    const r = document.createElement('div'); r.className = 'rule';
    el.append(a, b, r);
    (document.querySelector('.t7-ui') || document.body).append(el);
    requestAnimationFrame(() => el.classList.add('show'));
    if (ctx.shot) el.classList.add('show');
    bannerEl = el; clearTimeout(bannerT);
    bannerT = setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 1500); if (bannerEl === el) bannerEl = null; }, sec * 1000);
  }
  const quip = (text) => { if (moves - lastQuip < 3) return; lastQuip = moves; (P?.say || ctx.say)?.({ text, speaker: 'stauf', speakerName: 'Stauf' }); };

  function endIfOver(nextToMove) {
    const r = H.settle(board, nextToMove);
    if (!r) return false;
    result = r; phase = 'over'; selected = -1;
    r.filled.forEach((j, k) => { delay[j] = 0.3 + k * 0.04; });
    if (r.winner === H.BLUE) {
      phase = 'solved';
      P?.status?.(statusLine());
      banner('The plate is yours', `Blue ${H.count(board, H.BLUE)}  ·  Green ${H.count(board, H.GREEN)}`);
      setTimeout(() => P?.solve?.(), 1600);
    } else {
      P?.status?.(statusLine());
      banner(r.winner === H.GREEN ? 'Stauf\'s culture takes the plate' : 'Neither culture prevails', `Blue ${H.count(board, H.BLUE)}  ·  Green ${H.count(board, H.GREEN)}`);
      ctx.audio?.sfx?.('thud');
      onLose?.(r);
      (P?.say || ctx.say)?.({ text: r.winner === H.GREEN ? 'Ha! My little *pets* have eaten yours. Again? You have all the time in the world... *forever*.' : 'A draw? How *dull*. Again.', speaker: 'stauf', speakerName: 'Stauf' });
    }
    return true;
  }

  function playerMove(from, to) {
    const m = H.isLegal(board, H.BLUE, from, to);
    if (!m) return false;
    const inf = H.applyMove(board, H.BLUE, m);
    animateMove(H.BLUE, m, inf); moves++;
    ctx.audio?.sfx?.(m.jump ? 'pickup' : 'click');
    if (inf.length >= 4) quip('Clever... for a *corpse*.');
    selected = -1;
    if (endIfOver(H.GREEN)) return true;
    phase = 'stauf'; thinkT = 0.9 + rand() * 0.5;
    P?.status?.(statusLine());
    return true;
  }
  function staufMove() {
    const m = H.chooseMove(board, H.GREEN, { level, rand, foresight: 0.55 });
    if (!m) { endIfOver(H.GREEN); return; }
    const inf = H.applyMove(board, H.GREEN, m);
    animateMove(H.GREEN, m, inf); moves++;
    ctx.audio?.sfx?.('click');
    if (inf.length >= 4) quip(['Mmm. *Delicious*.', 'Feel that? That was *me*.', 'My germs are hungry tonight.'][moves % 3]);
    if (endIfOver(H.BLUE)) return;
    phase = 'player';
    P?.status?.(statusLine());
  }

  function pickCell(p, ndc) {
    const hit = p.raycast([pick], ndc)[0];
    if (!hit) return -1;
    const lp = group.worldToLocal(hit.point.clone());
    const qf = (2 / 3 * lp.x) / c, rf = (-1 / 3 * lp.x + Math.sqrt(3) / 3 * lp.z) / c;
    let x = qf, z = rf, y = -x - z;
    let rx = Math.round(x), rz = Math.round(z), ry = Math.round(y);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
    return H.indexOf(rx, rz);
  }

  function resetAll() {
    board = H.initialBoard(); rand = H.prng(1935); phase = 'player'; selected = -1; hover = -1; result = null; moves = 0; lastQuip = -10; fly = null;
    syncScales(false);
  }
  function applySolved() {
    for (let i = 0; i < H.N; i++) board[i] = H.BLUE;
    phase = 'solved'; selected = -1; result = { winner: H.BLUE, blue: H.N, green: 0, filled: [] };
    syncScales(true); writeInstances(0); writeRings(0);
  }
  function state() {
    return { phase, blue: H.count(board, H.BLUE), green: H.count(board, H.GREEN), empty: H.N - H.count(board, H.BLUE) - H.count(board, H.GREEN), selected, moves, solved: phase === 'solved', board: Array.from(board) };
  }

  const puzzle = {
    ...infectionMeta,
    camera,
    cameraDuration: 1.5,
    setup(p) { P = p; if (phase === 'over') resetAll(); p.status(statusLine()); },
    update(dt, t, p) {
      if (p) P = p;
      stepScales(dt);
      if (phase === 'stauf' && !busy()) { thinkT -= dt; if (thinkT <= 0) staufMove(); }
      presence += ((phase === 'stauf' ? 1 : 0) - presence) * Math.min(1, dt * 3);
      { const pulse = 0.55 + 0.45 * Math.sin(t * 5.0) * Math.sin(t * 1.7 + 1.0); staufRing.material.opacity = presence * (0.35 + 0.5 * pulse); staufLight.intensity = presence * (0.05 + 0.08 * pulse); }
      writeInstances(t); writeRings(t);
    },
    cursorAt(ndc, p) {
      if (phase === 'over') return 'grab';
      if (phase !== 'player') { hover = -1; return phase === 'stauf' ? 'wait' : 'default'; }
      hover = pickCell(p, ndc);
      if (hover < 0) return 'default';
      if (board[hover] === H.BLUE) return 'grab';
      if (selected >= 0 && board[hover] === H.EMPTY && H.hexDist(selected, hover) <= 2) return 'grab';
      return 'default';
    },
    onPointer(type, e, ndc, p) {
      if (type !== 'down') return;
      if (phase === 'over') { resetAll(); p.status('The plate is wiped clean. Your move.'); return; }
      if (phase !== 'player' || busy()) return;
      const i = pickCell(p, ndc);
      if (i < 0) { selected = -1; p.status(statusLine()); return; }
      if (board[i] === H.BLUE) { selected = selected === i ? -1 : i; ctx.audio?.sfx?.('tick'); p.status(statusLine()); return; }
      if (selected >= 0 && board[i] === H.EMPTY) {
        if (!playerMove(selected, i)) p.status('Too far. A cell can divide one step, or leap two — no further.');
        return;
      }
      selected = -1; p.status(statusLine());
    },
    reset(p) { if (phase === 'solved') return; resetAll(); p.status('The plate is wiped clean. Your move.'); },
    autoSolve(p) {
      // the book's remedy: a blue tide washes outward from the centre
      for (let i = 0; i < H.N; i++) { delay[i] = POS[i].length() * 6; board[i] = H.BLUE; }
      phase = 'solved'; selected = -1; result = { winner: H.BLUE, blue: H.N, green: 0, filled: [] };
      p.status(statusLine());
      banner('The plate is yours', `Blue ${H.N}  ·  Green 0`);
      setTimeout(() => p.solve(), 1800);
    },
    async onSolved(p) { phase = 'solved'; await onSolved?.(p); },
    teardown() { selected = -1; hover = -1; P = null; bannerEl?.remove(); bannerEl = null; },
  };

  writeInstances(0); writeRings(0);
  return {
    puzzle, group, applySolved, state, reset: resetAll,
    POS, cellRadius: c,
    tick: (dt, t) => puzzle.update(dt, t),
    /** QA: make a player move by axial coordinates or indices; returns true if legal */
    move(from, to, p = {}) { if (phase !== 'player') return false; P = { status() {}, say() {}, solve() {}, ...P, ...p }; return playerMove(from, to); },
    /** QA: let Stauf move immediately */
    staufNow() { if (phase === 'stauf') staufMove(); },
    /** QA/shots: play `plies` moves of Stauf-vs-Stauf (blue at level 1) to reach a believable mid-game */
    simulate(plies = 12, seed = 3) {
      resetAll(); const r = H.prng(seed); let side = H.BLUE;
      for (let k = 0; k < plies; k++) {
        const m = H.chooseMove(board, side, { level: 1, rand: r, foresight: 0.55 });
        if (!m) break;
        H.applyMove(board, side, m); side = H.other(side);
      }
      phase = 'player'; syncScales(true); writeInstances(0); writeRings(0);
    },
    select(i) { selected = i; },
    /** shots: freeze Stauf mid-thought (green presence on the plate) */
    think() { phase = 'stauf'; thinkT = 1e9; presence = 1; },
    /** QA: let the computer play one blue move at the given level */
    aiMove(lvl = 1, seed = 11) { if (phase !== 'player') return false; const m = H.chooseMove(board, H.BLUE, { level: lvl, rand: H.prng(seed + moves), foresight: 0.55 }); return m ? playerMove(m.from, m.to) : false; },
    legal: () => H.legalMoves(board, H.BLUE),
  };
}
