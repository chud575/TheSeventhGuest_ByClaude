import * as THREE from 'three';

/**
 * The ghost pianist, Herr Kessler: a seated maestro in a tailcoat, swept-back
 * hair, hands over the keys. The figure is sculpted offline as an SDF and
 * meshed (tools/genGhost.mjs -> public/assets/music/ghost.bin); here it is
 * loaded and drawn with the engine's ghost shader. Local frame = piano frame
 * (pianist at +Z facing -Z). Head and arms are separate so they can move.
 */

async function loadParts(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ghost.bin ${res.status}`);
  const buf = await res.arrayBuffer();
  const hl = new DataView(buf).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  const base = 4 + hl;
  const parts = {};
  for (const p of header.parts) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, base + p.pos, p.vertices * 3), 3));
    const n4 = new Int8Array(buf, base + p.nrm, p.vertices * 4);
    const n3 = new Float32Array(p.vertices * 3);
    for (let i = 0; i < p.vertices; i++) { n3[i * 3] = n4[i * 4] / 127; n3[i * 3 + 1] = n4[i * 4 + 1] / 127; n3[i * 3 + 2] = n4[i * 4 + 2] / 127; }
    g.setAttribute('normal', new THREE.BufferAttribute(n3, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.vertices * 2), 2));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, base + p.idx, p.indices), 1));
    g.computeBoundingSphere();
    parts[p.name] = g;
  }
  return { parts, header };
}

/** Sculpted ghost (public/assets/music/ghost.bin, made by tools/genGhost.mjs). */
export async function buildGhostPianist(ctx) {
  const { parts, header } = await loadParts(ctx.assetUrl('ghost.bin'));
  const opts = { color: 0x4f7fff, rimColor: 0xc4d8ff, opacity: 0.8, intensity: 1.05, rimPower: 2.4, dissolveY: 0.62, dissolveSoft: 0.22, wobble: 0.004, flicker: 0.2 };
  const mat = ctx.fx.ghostMaterial(opts);
  const headMat = ctx.fx.ghostMaterial({ ...opts, dissolveY: -10, wobble: 0.0015, intensity: 1.2, rimPower: 2.0 });
  const armMat = ctx.fx.ghostMaterial({ ...opts, dissolveY: -10, wobble: 0.003 });
  const group = new THREE.Group();
  group.name = 'ghostPianist';
  const mesh = new THREE.Mesh(parts.body, mat);
  mesh.renderOrder = 8;
  group.add(mesh);
  const head = new THREE.Mesh(parts.head, headMat);
  head.position.fromArray(header.head);
  head.renderOrder = 9;
  group.add(head);
  const arms = [];
  for (const k of ['L', 'R']) {
    const arm = new THREE.Mesh(parts['arm' + k], armMat);
    arm.position.fromArray(header.shoulders[k]);
    arm.renderOrder = 8;
    group.add(arm);
    arms.push(arm);
  }
  group.traverse((o) => { o.userData.noBake = true; o.castShadow = false; o.receiveShadow = false; });

  const target = [0, 0];
  const dip = [0, 0];
  return {
    group, mat, headMat, arms, head,
    setOpacity(v) { mat.uniforms.uOpacity.value = v; armMat.uniforms.uOpacity.value = v; headMat.uniforms.uOpacity.value = Math.min(1, v * 1.1); },
    want: null,   // set by the room: (opacity) => void, eases toward it
    reachFor(x) {
      const side = x < 0.0 ? 0 : 1;
      target[side] = x; dip[side] = 1;
    },
    update(dt, t, idle = true) {
      for (let i = 0; i < 2; i++) {
        const s = i === 0 ? -1 : 1;
        const arm = arms[i];
        const base = s * 0.16;
        const want = idle ? Math.sin(t * 1.3 + i * 1.7) * 0.05 : THREE.MathUtils.clamp((target[i] - base) * 1.4, -0.45, 0.45);
        arm.rotation.y += (-want - arm.rotation.y) * Math.min(1, dt * 8);
        dip[i] = Math.max(0, dip[i] - dt * 5);
        arm.rotation.x = -0.08 * dip[i] + (idle ? Math.sin(t * 2.1 + i) * 0.03 : 0);
      }
      head.rotation.y = Math.sin(t * 0.5) * 0.08;
      head.rotation.x = 0.12 + Math.sin(t * 0.7) * 0.03;
    },
  };
}
