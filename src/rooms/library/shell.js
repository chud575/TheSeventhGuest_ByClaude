// Library shell: floorboards, brick-and-timber walls, coffered skylight ceiling,
// doors, the bay window and its moonlit sky.
import * as THREE from 'three';
import { L, V3, merge, bboxAt, mesh, extrudeOutline, lathe, applyBoxUVs } from './lib.js';

const { X0, X1, Z0, Z1, H, CEIL } = L;

// wall frames: origin + rotation so that local +x runs along the wall and local +z faces into the room
export const WALLS = {
  back: { origin: V3(X0, 0, Z0), ry: 0, len: X1 - X0 },
  right: { origin: V3(X1, 0, Z0), ry: -Math.PI / 2, len: Z1 - Z0 },
  front: { origin: V3(X1, 0, Z1), ry: Math.PI, len: X1 - X0 },
  left: { origin: V3(X0, 0, Z1), ry: Math.PI / 2, len: Z1 - Z0 },
};
// openings in wall-local metres
export const OPEN = {
  rightDoor: { wall: 'right', x: 0.62, y: 0, w: 1.06, h: 2.42, arch: true },
  entrance: { wall: 'front', x: 2.05, y: 0, w: 1.55, h: 2.62 },
  bay: { wall: 'left', x: 1.45, y: 0.72, w: 1.62, h: 2.3, arch: true },
};
export const BOOKCASE = { x0: 0.2, x1: 3.9 };       // on the back wall (local x)
export function wallToWorld(wall, x, y, z = 0) {
  const w = WALLS[wall];
  const v = new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), w.ry);
  return v.add(w.origin);
}

export function buildShell(ctx, root, mat) {
  const G = ctx.geometry;
  const groups = {};
  for (const [name, w] of Object.entries(WALLS)) {
    const g = new THREE.Group();
    g.name = `wall-${name}`;
    g.position.copy(w.origin); g.rotation.y = w.ry;
    root.add(g);
    groups[name] = g;
  }

  // ------------------------------------------------------------ floor (planks run toward the bookcase)
  {
    const g = new THREE.PlaneGeometry(L.W, L.D);
    const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) { uv.setXY(i, -pos.getY(i), pos.getX(i)); }
    const floor = mesh(g, mat.floor, 'floor', { cast: false });
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    root.add(floor);
  }

  // ------------------------------------------------------------ brick infill
  const openingsFor = (wall) => Object.values(OPEN).filter((o) => o.wall === wall);
  for (const [name, w] of Object.entries(WALLS)) {
    const geo = G.wallWithOpenings(w.len, H, openingsFor(name), { uvScale: 1 });
    const m = mesh(geo, mat.brick, `brick-${name}`);
    groups[name].add(m);
  }

  // ------------------------------------------------------------ timber framing (posts, rails, plates)
  for (const [name, w] of Object.entries(WALLS)) {
    const ops = openingsFor(name).map((o) => ({ ...o, x0: o.x - 0.16, x1: o.x + o.w + 0.16 }));
    if (name === 'back') ops.push({ x0: BOOKCASE.x0 - 0.02, x1: BOOKCASE.x1 + 0.02, y: 0, h: H, isCase: true });
    const geos = [], vgeos = [];
    const blocked = (x0, x1, y0, y1) => ops.filter((o) => x1 > o.x0 && x0 < o.x1 && y1 > (o.y ?? 0) && y0 < (o.y ?? 0) + o.h + (o.arch ? 0.12 : 0.1));
    // horizontal members, clipped around openings
    const rails = [
      { y: 0.0, h: 0.2, d: 0.06 },     // sole plate (doubles as skirting)
      { y: 1.02, h: 0.14, d: 0.05 },
      { y: 2.22, h: 0.14, d: 0.05 },
      { y: H - 0.3, h: 0.3, d: 0.07 }, // wall plate under the cornice
    ];
    for (const r of rails) {
      const segs = [[0, w.len]];
      for (const o of ops) {
        if (!(r.y + r.h > (o.y ?? 0) && r.y < (o.y ?? 0) + o.h + 0.12)) continue;
        for (let i = segs.length - 1; i >= 0; i--) {
          const [a, b] = segs[i];
          if (o.x1 <= a || o.x0 >= b) continue;
          segs.splice(i, 1, ...[[a, o.x0], [o.x1, b]].filter(([p, q]) => q - p > 0.05));
        }
      }
      for (const [a, b] of segs) geos.push(bboxAt(b - a, r.h, r.d, (a + b) / 2, r.y + r.h / 2, r.d / 2, { r: 0.008 }));
    }
    // posts
    const n = Math.max(2, Math.round(w.len / 1.12));
    for (let i = 0; i <= n; i++) {
      const x = Math.min(w.len - 0.09, Math.max(0.09, (w.len / n) * i));
      if (blocked(x - 0.09, x + 0.09, 0.2, H - 0.3).length) continue;
      vgeos.push(bboxAt(0.17, H - 0.5, 0.055, x, 0.2 + (H - 0.5) / 2, 0.0275, { r: 0.014 }));
    }
    // posts + head beams framing every opening
    for (const o of ops) {
      if (o.isCase) continue;
      const top = o.y + o.h + (o.arch ? 0.05 : 0.0);
      vgeos.push(bboxAt(0.16, top - (o.y > 0 ? o.y - 0.12 : 0.2), 0.06, o.x - 0.08, (top + (o.y > 0 ? o.y - 0.12 : 0.2)) / 2, 0.03, { r: 0.014 }));
      vgeos.push(bboxAt(0.16, top - (o.y > 0 ? o.y - 0.12 : 0.2), 0.06, o.x + o.w + 0.08, (top + (o.y > 0 ? o.y - 0.12 : 0.2)) / 2, 0.03, { r: 0.014 }));
      geos.push(bboxAt(o.w + 0.48, 0.2, 0.07, o.x + o.w / 2, top + 0.1, 0.035, { r: 0.012 }));
      if (o.y > 0) geos.push(bboxAt(o.w + 0.4, 0.12, 0.08, o.x + o.w / 2, o.y - 0.06, 0.04, { r: 0.01 }));
    }
    groups[name].add(mesh(merge(geos), mat.timber, `timber-${name}`));
    if (vgeos.length) groups[name].add(mesh(merge(vgeos), mat.timberV, `timber-posts-${name}`));
  }

  // ------------------------------------------------------------ cornice (crown) under the ceiling beams
  {
    const prof = G.PROFILES.crown(0.16, 0.12);
    const y = H - 0.16;
    const path = [V3(X0, y, Z0), V3(X1, y, Z0), V3(X1, y, Z1), V3(X0, y, Z1)];
    const crown = mesh(G.sweepProfile(prof, path, { closed: true, uvScale: 1 }), mat.timberDark, 'cornice', { cast: false });
    root.add(crown);
  }

  // ------------------------------------------------------------ coffered skylight ceiling
  const ceiling = new THREE.Group();
  ceiling.name = 'ceiling';
  root.add(ceiling);
  const NX = 4, NZ = 7;
  const bx = (i) => X0 + (L.W / NX) * i, bz = (j) => Z0 + (L.D / NZ) * j;
  {
    const geos = [];
    const mainW = 0.26, mainD = 0.34, crossW = 0.18, crossD = 0.26;
    for (let i = 0; i <= NX; i++) {          // main beams along z (built along x, rotated so the grain follows)
      const x = Math.min(X1 - mainW / 4, Math.max(X0 + mainW / 4, bx(i)));
      const w = (i === 0 || i === NX) ? mainW / 2 : mainW;
      const g = bboxAt(L.D, mainD, w, 0, 0, 0, { r: 0.012 });
      g.rotateY(Math.PI / 2); g.translate(x, H + mainD / 2, (Z0 + Z1) / 2);
      geos.push(g);
      // bed moulding fillets along both sides of the main beams
      if (i > 0 && i < NX) for (const s of [-1, 1]) {
        const f = bboxAt(L.D, 0.04, 0.03, 0, 0, 0, { r: 0.008 });
        f.rotateY(Math.PI / 2); f.translate(x + s * (mainW / 2 + 0.012), H + mainD - 0.02, (Z0 + Z1) / 2);
        geos.push(f);
      }
    }
    for (let j = 0; j <= NZ; j++) {          // cross beams along x
      const z = Math.min(Z1 - crossW / 4, Math.max(Z0 + crossW / 4, bz(j)));
      const w = (j === 0 || j === NZ) ? crossW / 2 : crossW;
      for (let i = 0; i < NX; i++) {
        const xa = bx(i) + mainW / 2, xb = bx(i + 1) - mainW / 2;
        geos.push(bboxAt(xb - xa, crossD, w, (xa + xb) / 2, H + (mainD - crossD) + crossD / 2, z, { r: 0.01 }));
      }
    }
    // coffer liners (stepped frames around each glass panel)
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const xa = bx(i) + mainW / 2, xb = bx(i + 1) - mainW / 2;
      const za = bz(j) + crossW / 2, zb = bz(j + 1) - crossW / 2;
      const cx = (xa + xb) / 2, cz = (za + zb) / 2, w = xb - xa, d = zb - za;
      const y0 = H + mainD;               // top of beams
      // two receding steps up to the glass
      for (const [inset, hh] of [[0.0, 0.04]]) {
        const yy = y0 + (inset ? 0.06 : 0) + hh / 2;
        geos.push(bboxAt(w - inset * 2, hh, 0.07, cx, yy, za + inset + 0.035, { r: 0.006 }));
        geos.push(bboxAt(w - inset * 2, hh, 0.07, cx, yy, zb - inset - 0.035, { r: 0.006 }));
        geos.push(bboxAt(0.07, hh, d - inset * 2 - 0.14, xa + inset + 0.035, yy, cz, { r: 0.006 }));
        geos.push(bboxAt(0.07, hh, d - inset * 2 - 0.14, xb - inset - 0.035, yy, cz, { r: 0.006 }));
      }
    }
    // a small crown moulding round the mouth of every coffer
    const cofferMould = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const xa = bx(i) + mainW / 2, xb = bx(i + 1) - mainW / 2;
      const za = bz(j) + crossW / 2, zb = bz(j + 1) - crossW / 2;
      const y = H + mainD - 0.075;
      cofferMould.push(G.sweepProfile(G.PROFILES.crown(0.075, 0.05), [V3(xa, y, za), V3(xb, y, za), V3(xb, y, zb), V3(xa, y, zb)], { closed: true, uvScale: 1 }));
    }
    // second, smaller bevelled tier stepping up to the glass + a bead at the glass stop
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const xa = bx(i) + mainW / 2 + 0.07, xb = bx(i + 1) - mainW / 2 - 0.07;
      const za = bz(j) + crossW / 2 + 0.07, zb = bz(j + 1) - crossW / 2 - 0.07;
      const y = H + mainD + 0.004;
      cofferMould.push(G.sweepProfile(G.PROFILES.crown(0.04, 0.03), [V3(xa, y, za), V3(xb, y, za), V3(xb, y, zb), V3(xa, y, zb)], { closed: true, uvScale: 1 }));
    }
    // dentil course just under each coffer mouth
    const dent = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const xa = bx(i) + mainW / 2, xb = bx(i + 1) - mainW / 2;
      const za = bz(j) + crossW / 2, zb = bz(j + 1) - crossW / 2;
      const y = H + mainD - 0.1;
      const step = 0.045;
      const box = (w, h, d, x, y2, z) => new THREE.BoxGeometry(w, h, d).translate(x, y2, z);
      for (let x = xa + 0.03; x < xb - 0.02; x += step) { dent.push(box(0.024, 0.026, 0.018, x, y, za + 0.009)); dent.push(box(0.024, 0.026, 0.018, x, y, zb - 0.009)); }
      for (let z = za + 0.03; z < zb - 0.02; z += step) { dent.push(box(0.018, 0.026, 0.024, xa + 0.009, y, z)); dent.push(box(0.018, 0.026, 0.024, xb - 0.009, y, z)); }
    }
    cofferMould.push(merge(dent));
    // carved rosettes where the cross beams meet the main beams, and ovolo beads along the beam soffits
    const ros = [];
    const rosette = () => {
      const g = lathe([[0.001, 0], [0.085, 0], [0.088, 0.008], [0.075, 0.016], [0.07, 0.02], [0.05, 0.026], [0.03, 0.04], [0.016, 0.05], [0.001, 0.052]], 40);
      const pos = g.attributes.position;
      for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), z = pos.getZ(k); const a = Math.atan2(z, x), r = Math.hypot(x, z); const petal = 1 + 0.1 * Math.cos(a * 8) * Math.min(1, r / 0.03); pos.setX(k, x * petal); pos.setZ(k, z * petal); pos.setY(k, pos.getY(k) * (1 + 0.15 * Math.cos(a * 8))); }
      g.computeVertexNormals();
      g.scale(1, -1, 1);
      return g;
    };
    for (let i = 1; i < NX; i++) for (let j = 1; j < NZ; j++) { const r = rosette(); r.translate(bx(i), H + 0.002, bz(j)); ros.push(r); }
    for (let i = 1; i < NX; i++) for (const sx of [-1, 1]) {
      const b = new THREE.CylinderGeometry(0.016, 0.016, L.D, 10, 1, false, 0, Math.PI);
      b.rotateX(Math.PI / 2); b.rotateZ(sx > 0 ? -Math.PI / 2 : Math.PI / 2);
      b.translate(bx(i) + sx * (mainW / 2 - 0.016), H + 0.016, (Z0 + Z1) / 2);
      ros.push(b);
    }
    cofferMould.push(merge(ros));
    ceiling.add(mesh(merge(cofferMould), mat.beamMould || mat.beam, 'coffer-mouldings', { cast: false }));
    const beams = mesh(merge(geos), mat.beam, 'beams');
    ceiling.add(beams);
    // glass panels (one merged mesh, emissive moonlit) + a lead/iron grid behind
    const glassGeos = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const xa = bx(i) + mainW / 2 + 0.07, xb = bx(i + 1) - mainW / 2 - 0.07;
      const za = bz(j) + crossW / 2 + 0.07, zb = bz(j + 1) - crossW / 2 - 0.07;
      const g = new THREE.PlaneGeometry(xb - xa, zb - za);
      const uv = g.attributes.uv;
      void uv; // panel uv 0..1: one lozenge field per coffer
      // per-panel brightness via vertex colour (moon side brighter)
      const col = new Float32Array(uv.count * 3);
      const lum = 0.55 + 0.45 * Math.max(0, Math.min(1, 1 - (((xa + xb) / 2 - X0) / L.W) * 0.6 - (((za + zb) / 2 - Z0) / L.D) * 0.2)) + 0.08 * Math.sin(i * 7.1 + j * 3.3);
      for (let k = 0; k < uv.count; k++) col.set([lum, lum, lum], k * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.rotateX(Math.PI / 2);
      g.translate((xa + xb) / 2, H + 0.34 + 0.04, (za + zb) / 2);
      glassGeos.push(g);
    }
    const glass = new THREE.Mesh(merge(glassGeos.map((g) => { const c = g.attributes.color; const n = g.toNonIndexed(); return n; })), mat.skylight);
    // merge() drops colours; rebuild them
    {
      const all = glassGeos.map((g) => g.toNonIndexed());
      const cols = [];
      for (const g of all) cols.push(...g.attributes.color.array);
      glass.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    }
    glass.name = 'skylights';
    glass.castShadow = false; glass.receiveShadow = false;
    glass.userData.noShadow = true;
    ceiling.add(glass);
    // dark roof void above (so nothing leaks through)
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(L.W + 0.4, L.D + 0.4), new THREE.MeshBasicMaterial({ color: 0x010102 }));
    roof.rotation.x = Math.PI / 2; roof.position.set((X0 + X1) / 2, H + 0.6, (Z0 + Z1) / 2);
    roof.userData.noShadow = true;
    ceiling.add(roof);
  }

  // ------------------------------------------------------------ right-wall arched door (to the music room)
  const doors = {};
  {
    const o = OPEN.rightDoor;
    const g = new THREE.Group();
    g.name = 'door-right';
    const r = o.w / 2;
    // planked leaf with an arched head
    const outline = [];
    outline.push([-r, 0], [r, 0], [r, o.h - r]);
    for (let k = 1; k < 24; k++) { const a = (k / 24) * Math.PI; outline.push([Math.cos(a) * r, o.h - r + Math.sin(a) * r]); }
    outline.push([-r, o.h - r]);
    const leaf = mesh(extrudeOutline(outline, 0.06, { bevel: 0.006 }), mat.doorWood, 'door-leaf');
    leaf.position.set(0, 0, -0.06);
    g.add(leaf);
    // plank grooves (thin dark strips) + iron straps
    const strips = [];
    for (let k = 1; k < 6; k++) strips.push(bboxAt(0.008, o.h - 0.1 - (Math.abs(k - 3) < 2 ? 0 : 0.25), 0.004, -r + (o.w / 6) * k, (o.h - 0.1) / 2, -0.028, { r: 0.001 }));
    g.add(mesh(merge(strips), mat.iron, 'door-grooves'));
    const straps = [];
    for (const y of [0.42, 1.55]) {
      straps.push(bboxAt(o.w * 0.86, 0.05, 0.012, -o.w * 0.03, y, -0.02, { r: 0.004 }));
      for (let k = 0; k < 6; k++) straps.push(at3(new THREE.SphereGeometry(0.011, 10, 6), -r * 0.8 + k * o.w * 0.14, y, -0.012));
    }
    g.add(mesh(merge(straps), mat.iron, 'door-straps'));
    // ring pull + escutcheon
    const ring = mesh(new THREE.TorusGeometry(0.055, 0.008, 10, 28), mat.iron, 'door-ring');
    ring.position.set(r * 0.62, 1.02, -0.008);
    g.add(ring);
    const plate = mesh(lathe([[0, 0], [0.04, 0], [0.035, 0.012], [0.01, 0.02], [0, 0.022]], 20), mat.iron);
    plate.rotation.x = Math.PI / 2; plate.position.set(r * 0.62, 1.08, -0.03);
    g.add(plate);
    // moulded arched architrave
    const archPath = [V3(-r - 0.03, 0, 0)];
    for (let k = 0; k <= 24; k++) { const a = Math.PI - (k / 24) * Math.PI; archPath.push(V3(Math.cos(a) * (r + 0.03), o.h - r + Math.sin(a) * (r + 0.03), 0)); }
    archPath.push(V3(r + 0.03, 0, 0));
    const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(0.03, 0), new THREE.Vector2(0.04, 0.02), new THREE.Vector2(0.035, 0.05), new THREE.Vector2(0.055, 0.08), new THREE.Vector2(0.05, 0.12), new THREE.Vector2(0, 0.13)];
    const arch = mesh(G.sweepProfile(prof.map((p) => new THREE.Vector2(p.y, p.x)), archPath, { up: V3(0, 0, 1), uvScale: 1, flipOutward: true }), mat.timberDark, 'door-architrave');
    g.add(arch);
    // reveal (jamb lining)
    const jamb = [];
    jamb.push(bboxAt(0.03, o.h - r, 0.26, -r - 0.015, (o.h - r) / 2, -0.13, { r: 0.004 }));
    jamb.push(bboxAt(0.03, o.h - r, 0.26, r + 0.015, (o.h - r) / 2, -0.13, { r: 0.004 }));
    g.add(mesh(merge(jamb), mat.timberDark));
    const pos = wallToWorld('right', o.x + o.w / 2, 0, 0.0);
    g.position.copy(pos); g.rotation.y = WALLS.right.ry;
    root.add(g);
    doors.right = g;
    // void behind the door (in case the leaf is ajar)
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    back.position.copy(wallToWorld('right', o.x + o.w / 2, 1.4, -0.3)); back.rotation.y = WALLS.right.ry;
    root.add(back);
  }

  // ------------------------------------------------------------ entrance double doors (front wall, from the foyer)
  {
    const o = OPEN.entrance;
    const g = new THREE.Group();
    g.name = 'door-entrance';
    const lw = o.w / 2;
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group();
      leaf.add(mesh(bboxAt(lw - 0.006, o.h - 0.01, 0.055, 0, o.h / 2, 0, { r: 0.006 }), mat.doorWood));
      for (const [y, hh] of [[0.55, 0.62], [1.62, 1.25]]) {
        const p = mesh(G.raisedPanel(lw - 0.2, hh, { border: 0.05, bevel: 0.03 }), mat.doorWood);
        p.position.set(0, y, 0.028); leaf.add(p);
      }
      const knob = mesh(new THREE.SphereGeometry(0.03, 20, 14), mat.brass);
      knob.position.set(-s * (lw / 2 - 0.08), 1.02, 0.07); leaf.add(knob);
      leaf.position.set(s * lw / 2, 0, -0.03);
      g.add(leaf);
    }
    const casing = mesh(G.sweepProfile(G.PROFILES.chairRail(0.13, 0.04), [V3(-lw - 0.07, 0, 0), V3(-lw - 0.07, o.h + 0.07, 0), V3(lw + 0.07, o.h + 0.07, 0), V3(lw + 0.07, 0, 0)], { up: V3(0, 0, 1), uvScale: 1, flipOutward: true }), mat.timberDark);
    g.add(casing);
    g.position.copy(wallToWorld('front', o.x + o.w / 2, 0, 0)); g.rotation.y = WALLS.front.ry;
    root.add(g);
    doors.entrance = g;
  }

  // ------------------------------------------------------------ bay window (left wall) with the night beyond
  let bay;
  {
    const o = OPEN.bay;
    const g = new THREE.Group();
    g.name = 'bay-window';
    const r = o.w / 2, depth = 0.42;
    // reveal: extruded ring
    const shape = new THREE.Shape();
    shape.moveTo(-r - 0.04, -0.04); shape.lineTo(r + 0.04, -0.04); shape.lineTo(r + 0.04, o.h + 0.06); shape.lineTo(-r - 0.04, o.h + 0.06); shape.lineTo(-r - 0.04, -0.04);
    const hole = new THREE.Path();
    hole.moveTo(-r, 0); hole.lineTo(-r, o.h - r); hole.absarc(0, o.h - r, r, Math.PI, 0, true); hole.lineTo(r, 0); hole.lineTo(-r, 0);
    shape.holes.push(hole);
    const rg = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 32 });
    const reveal = mesh(applyBoxUVs(rg, 1), mat.plasterDark, 'bay-reveal');
    reveal.position.set(0, 0, -depth);
    g.add(reveal);
    const sill = mesh(bboxAt(o.w + 0.3, 0.05, depth + 0.14, 0, -0.025, -depth / 2 + 0.07, { r: 0.008 }), mat.timberDark);
    g.add(sill);
    // window frame + glazing bars
    const bars = [];
    bars.push(bboxAt(o.w, 0.06, 0.05, 0, 0.03, -depth * 0.55, { r: 0.004 }));
    for (const x of [-r + 0.025, 0, r - 0.025]) bars.push(bboxAt(0.045, o.h - r, 0.05, x, (o.h - r) / 2, -depth * 0.55, { r: 0.004 }));
    for (const y of [0.55, 1.1]) bars.push(bboxAt(o.w, 0.035, 0.04, 0, y, -depth * 0.55, { r: 0.003 }));
    for (let k = 1; k < 4; k++) {
      const a = Math.PI * (k / 4);
      const b = bboxAt(0.03, r, 0.04, 0, 0, 0, { r: 0.003 });
      b.rotateZ(a - Math.PI / 2); b.translate(Math.cos(a) * r * 0.5, o.h - r + Math.sin(a) * r * 0.5, -depth * 0.55);
      bars.push(b);
    }
    const arcG = new THREE.TorusGeometry(r - 0.022, 0.022, 6, 40, Math.PI);
    arcG.translate(0, o.h - r, -depth * 0.55);
    bars.push(arcG);
    g.add(mesh(merge(bars), mat.windowFrame, 'bay-bars'));
    // glass
    const gs = new THREE.Shape();
    gs.moveTo(-r, 0); gs.lineTo(-r, o.h - r); gs.absarc(0, o.h - r, r, Math.PI, 0, true); gs.lineTo(r, 0); gs.lineTo(-r, 0);
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(gs, 32), mat.glass);
    glass.position.z = -depth * 0.55 + 0.01;
    glass.userData.noShadow = true;
    g.add(glass);
    // sky
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.4), mat.sky);
    sky.position.set(0.2, 1.4, -2.6);
    sky.userData.noShadow = true;
    g.add(sky);
    if (mat.treeline) {
      const tl = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.6), mat.treeline);
      tl.position.set(0.1, 0.9, -1.6);
      tl.userData.noShadow = true;
      g.add(tl);
    }
    g.position.copy(wallToWorld('left', o.x + o.w / 2, o.y, 0)); g.rotation.y = WALLS.left.ry;
    root.add(g);
    bay = g;
    // curtains
    for (const s of [-1, 1]) {
      const c = mesh(G.curtainGeometry({ width: 0.85, height: 3.1, folds: 7, depth: 0.07, pool: 0.12, seed: s + 5 }), mat.curtain, 'curtain');
      c.position.copy(wallToWorld('left', o.x + o.w / 2 + s * (r + 0.28), 3.12, 0.12));
      c.rotation.y = WALLS.left.ry;
      if (s > 0) c.scale.x = -1;
      root.add(c);
    }
    const rod = mesh(new THREE.CylinderGeometry(0.016, 0.016, o.w + 1.3, 14), mat.brass);
    rod.rotation.x = Math.PI / 2;
    rod.position.copy(wallToWorld('left', o.x + o.w / 2, 3.14, 0.12));
    root.add(rod);
  }

  return { groups, doors, bay, ceiling, coffer: { NX, NZ, bx, bz } };
}

function at3(g, x, y, z) { g.translate(x, y, z); return g; }
