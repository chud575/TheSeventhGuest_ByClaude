import * as THREE from 'three';

/**
 * "Stauf's Web" — the foyer floor puzzle (homage to the classic octagram
 * spider puzzle). Eight brass studs sit at the points of an eight-pointed star
 * {8/3} inlaid in the marble medallion. Each brass line joins two studs.
 *
 * Rules: choose an EMPTY stud for a spider to start on, then the stud at the
 * other end of one of its lines — also empty. The spider runs along the line and
 * stays there. Seven spiders must find seven different resting places.
 *
 * Solution strategy (one of many): always end a move on the stud where the
 * previous spider started (0→3, 5→0, 2→5, 7→2, 4→7, 1→4, 6→1).
 */

export const WEB_ID = 'foyer.web';
export const webMeta = {
  id: WEB_ID,
  title: "Stauf's Web",
  description: 'Seven spiders, eight points. Each spider must start on an empty point and run along a brass line to another empty point — and stay there.',
  hints: [
    'A spider can only start on an empty point, and only finish on an empty point at the other end of a line.',
    'Do not strand the points you will need later. Think about where the *last* spider began.',
    'Make each new spider finish on the point where the previous spider started.',
  ],
};

const SOLUTION = [[0, 3], [5, 0], [2, 5], [7, 2], [4, 7], [1, 4], [6, 1]];

export function createWebPuzzle(ctx, { root, center, radius, pointsR, materials, onSolved }) {
  const N = 8, SP = 7;
  const links = (i) => [(i + 3) % N, (i + 5) % N];
  // stud world positions (texture angle i*45+90 deg, texture y -> world -z)
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = i * Math.PI / 4 + Math.PI / 2;
    pts.push(new THREE.Vector3(center.x + Math.cos(a) * pointsR, center.y, center.z - Math.sin(a) * pointsR));
  }
  const group = new THREE.Group();
  group.name = 'webPuzzle';
  root.add(group);

  // brass studs (always visible) + invisible pick discs + glow rings
  const studGeo = ctx.geometry.latheFromProfile([[0, 0.012], [0.05, 0.012], [0.056, 0.006], [0.058, 0.0], [0.058, -0.002], [0.0, -0.002]], 32);
  const domeGeo = new THREE.SphereGeometry(0.03, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const pickGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16);
  const ringGeo = new THREE.RingGeometry(0.075, 0.11, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const studs = [], picks = [], rings = [];
  for (let i = 0; i < N; i++) {
    const s = new THREE.Mesh(studGeo, materials.brass);
    s.position.copy(pts[i]); s.position.y += 0.002;
    const d = new THREE.Mesh(domeGeo, materials.brass);
    d.position.y = 0.012; s.add(d);
    s.receiveShadow = true; d.castShadow = true;
    group.add(s); studs.push(s);
    const pk = new THREE.Mesh(pickGeo, pickMat); pk.position.copy(pts[i]); pk.userData.index = i; group.add(pk); picks.push(pk);
    const rm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.55, 0.2).multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    const r = new THREE.Mesh(ringGeo, rm); r.position.copy(pts[i]); r.position.y += 0.006; r.renderOrder = 3; r.userData.noBake = true;
    group.add(r); rings.push(r);
  }
  // spiders: black lacquer with a blood-red mark; they wait at the near rim
  const spiderGeo = materials.spiderGeo;
  const mark = new THREE.SphereGeometry(0.009, 10, 6); mark.scale(1, 0.4, 1.6);
  const spiders = [];
  const home = [];
  for (let k = 0; k < SP; k++) {
    const a = -Math.PI / 2 + (k - (SP - 1) / 2) * 0.22;  // texture angle near -90deg = world +z (near side)
    const r = radius * 0.875;
    home.push(new THREE.Vector3(center.x + Math.cos(a) * r, center.y + 0.004, center.z - Math.sin(a) * r));
    const sp = new THREE.Group();
    const body = new THREE.Mesh(spiderGeo, materials.spider); body.castShadow = true; sp.add(body);
    const m = new THREE.Mesh(mark, materials.mark); m.position.set(0, 0.052, -0.035); sp.add(m);
    sp.position.copy(home[k]);
    sp.rotation.y = Math.PI + (k - 3) * 0.12;   // face the board centre
    sp.scale.setScalar(2.1);
    group.add(sp);
    spiders.push(sp);
  }

  // ------------------------------------------------------------------ state
  let occ = new Array(N).fill(false);
  let placed = 0, selected = -1, hover = -1, anim = null, solvedFlag = false;
  const moves = [];
  const vacantWithMove = (i) => !occ[i] && links(i).some((j) => !occ[j]);
  const anyMove = () => occ.some((_, i) => vacantWithMove(i));
  const ringTarget = new Array(N).fill(0);

  function placeInstant(k, from, to) {
    const sp = spiders[k];
    sp.position.copy(pts[to]); sp.position.y += 0.014;
    const d = new THREE.Vector3().subVectors(pts[to], pts[from]);
    sp.rotation.y = Math.atan2(d.x, d.z);
  }
  function resetState() {
    occ = new Array(N).fill(false); placed = 0; selected = -1; anim = null; moves.length = 0;
    spiders.forEach((sp, k) => { sp.position.copy(home[k]); sp.rotation.y = Math.PI + (k - 3) * 0.12; });
    refreshRings();
  }
  function applySolved() {
    resetState();
    SOLUTION.forEach(([a, b], k) => { occ[b] = true; placeInstant(k, a, b); moves.push([a, b]); });
    placed = SP; solvedFlag = true;
    refreshRings();
  }
  function refreshRings() {
    for (let i = 0; i < N; i++) {
      let v = 0;
      if (i === selected) v = 1;
      else if (selected >= 0 && links(selected).includes(i) && !occ[i]) v = 0.45;
      else if (i === hover && selected < 0 && vacantWithMove(i) && placed < SP) v = 0.3;
      else if (occ[i]) v = 0.16;
      ringTarget[i] = v;
    }
  }

  function pickIndex(p, ndc) {
    const hit = p.raycast(picks, ndc)[0];
    return hit ? hit.object.userData.index : -1;
  }

  function startRun(from, to, p) {
    const k = placed;
    const sp = spiders[k];
    const a = sp.position.clone();
    const b = pts[from].clone(); b.y += 0.014;
    const c = pts[to].clone(); c.y += 0.014;
    occ[to] = true; placed++;
    moves.push([from, to]);
    selected = -1; refreshRings();
    anim = { k, a, b, c, t: 0, d1: 0.55 + a.distanceTo(b) * 0.25, d2: 0.35 + b.distanceTo(c) * 0.32, p };
    p.audio?.sfx?.('pickup');
  }

  function finishRun(p) {
    anim = null;
    p.audio?.sfx?.('chime', { freq: 520 + placed * 70 });
    if (placed >= SP) {
      solvedFlag = true;
      p.status('The web is complete.');
      p.solve();
      return;
    }
    if (!anyMove()) {
      p.fail('The web is tangled — no empty point has an empty partner. Reset and try again.');
      p.say?.({ text: 'Caught in your own *web*, are we?', speaker: 'stauf', speakerName: 'Stauf' });
      return;
    }
    p.status(`${placed} of ${SP} spiders at rest.`);
  }

  const puzzle = {
    ...webMeta,
    camera: { position: [center.x, 3.35, center.z + 1.75], target: [center.x, 0.0, center.z + 0.22], fov: 50 },
    cameraDuration: 1.5,
    setup(p) {
      if (solvedFlag) { p.status('The web is complete.'); return; }
      p.status(placed ? `${placed} of ${SP} spiders at rest.` : 'Choose an empty point for the first spider.');
      refreshRings();
    },
    update(dt, t) {
      // ring fades
      for (let i = 0; i < N; i++) {
        const m = rings[i].material;
        const pulse = ringTarget[i] >= 1 ? 0.75 + 0.25 * Math.sin(t * 6) : 1;
        m.opacity += (ringTarget[i] * pulse - m.opacity) * Math.min(1, dt * 10 || 1);
      }
      if (!anim) return;
      anim.t += dt;
      const sp = spiders[anim.k];
      if (anim.t < anim.d1) {
        // scuttle (small hop) from the rim to the start point
        const u = anim.t / anim.d1, e = u * u * (3 - 2 * u);
        sp.position.lerpVectors(anim.a, anim.b, e);
        sp.position.y += Math.sin(u * Math.PI) * 0.12;
        const d = new THREE.Vector3().subVectors(anim.b, anim.a);
        sp.rotation.y = Math.atan2(d.x, d.z);
      } else if (anim.t < anim.d1 + anim.d2) {
        const u = (anim.t - anim.d1) / anim.d2, e = u * u * (3 - 2 * u);
        sp.position.lerpVectors(anim.b, anim.c, e);
        sp.position.y += Math.abs(Math.sin(u * Math.PI * 9)) * 0.004;
        const d = new THREE.Vector3().subVectors(anim.c, anim.b);
        sp.rotation.y = Math.atan2(d.x, d.z);
      } else {
        sp.position.copy(anim.c);
        finishRun(anim.p);
      }
    },
    cursorAt(ndc, p) {
      if (anim || solvedFlag) return 'default';
      const i = pickIndex(p, ndc);
      if (i !== hover) { hover = i; refreshRings(); }
      if (i < 0) return 'default';
      if (selected >= 0) return (i === selected || (links(selected).includes(i) && !occ[i]) || vacantWithMove(i)) ? 'grab' : 'default';
      return vacantWithMove(i) ? 'grab' : 'default';
    },
    onPointer(type, e, ndc, p) {
      if (type !== 'up' || anim || solvedFlag) return;
      const i = pickIndex(p, ndc);
      if (i < 0) return;
      if (selected < 0) {
        if (occ[i]) { p.fail('A spider already rests there.'); return; }
        if (!links(i).some((j) => !occ[j])) { p.fail('Both lines from that point end at a resting spider.'); return; }
        selected = i; refreshRings();
        p.audio?.sfx?.('click');
        p.status('Now choose where it runs — an empty point along one of its lines.');
        return;
      }
      if (i === selected) { selected = -1; refreshRings(); p.status('Choose an empty point for the next spider.'); return; }
      if (links(selected).includes(i) && !occ[i]) { startRun(selected, i, p); return; }
      if (vacantWithMove(i)) { selected = i; refreshRings(); p.status('Now choose where it runs.'); return; }
      p.fail('No line joins those points to an empty end.');
    },
    reset(p) { if (solvedFlag) return; resetState(); p.status('The spiders scuttle back to the rim.'); },
    autoSolve(p) { anim = null; applySolved(); p.solve(); },
    async onSolved(p) { await onSolved?.(p); },
    teardown() { hover = -1; selected = selected >= 0 ? -1 : selected; refreshRings(); for (const r of rings) r.material.opacity = 0; },
  };

  return {
    puzzle, group, studs, spiders, points: pts,
    applySolved, resetState,
    getState: () => ({ occupied: occ.slice(), placed, solved: solvedFlag, animating: !!anim, selected, moves: moves.slice() }),
    /** QA helper: perform one move programmatically (returns false if illegal) */
    tryMove(from, to) {
      if (occ[from] || occ[to] || !links(from).includes(to) || placed >= SP) return false;
      occ[to] = true; placeInstant(placed, from, to); placed++; moves.push([from, to]);
      if (placed >= SP) solvedFlag = true;
      return true;
    },
  };
}
