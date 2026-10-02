import * as THREE from 'three';
import { Bucket, mat4, instanced, rng } from './lib.js';
import { WindowKit, bracketGeometry, archBand } from './windows.js';

/**
 * Stauf Manor — a Second Empire mansion with Queen Anne flourishes: mansard roof
 * with arched dormers and iron cresting, a central entrance tower with a
 * concave mansard, a round corner turret with a witch's-hat roof, a canted bay,
 * a wraparound porch on turned columns, bracketed cornices, brick chimneys.
 * Faces +Z, ground floor level at y = F.
 */

export const F = 1.1;            // floor level (top of foundation)
export const FL2 = 5.1;          // second floor
export const TOP = 9.2;          // main wall top
export const MB = { x0: -9, x1: 9, z0: -6.5, z1: 6 };
export const TOWER = { x0: -2.6, x1: 2.6, z0: 4.0, z1: 8.0, top: 13.8 };
export const TURRET = { x: 9.0, z: 6.0, r: 2.1, top: 13.4 };
export const PORCH = { x0: -4.7, x1: 6.9, z0: 6.0, z1: 10.6, y: F, roof: 4.45 };
export const DOOR = { w: 1.9, h: 3.0, z: 8.0 };

export function buildMansion(ctx, M) {
  const G = ctx.geometry;
  const group = new THREE.Group();
  group.name = 'mansion';
  const B = new Bucket();
  const win = new WindowKit({ bucket: B, trim: M.trim, sash: M.sash });
  const R = rng(1893);

  // ------------------------------------------------------------------ helpers
  const wallBox = (x0, x1, y0, y1, z0, z1, mat = M.siding, uvScale = 0.5) => {
    B.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat, mat4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), { uvScale });
  };
  const tbox = (w, h, d, x, y, z, ry = 0, mat = M.trim) => B.box(mat, w, h, d, x, y, z, ry, { uvScale: 1 });
  // horizontal trim band around a rectangle (belt course / frieze), outset o
  const band = (x0, x1, z0, z1, y, h, o, mat = M.trim, skipFront = false) => {
    tbox(x1 - x0 + 2 * o, h, o * 2, (x0 + x1) / 2, y + h / 2, z0, 0, mat);
    if (!skipFront) tbox(x1 - x0 + 2 * o, h, o * 2, (x0 + x1) / 2, y + h / 2, z1, 0, mat);
    tbox(o * 2, h, z1 - z0, x0, y + h / 2, (z0 + z1) / 2, 0, mat);
    tbox(o * 2, h, z1 - z0, x1, y + h / 2, (z0 + z1) / 2, 0, mat);
  };
  // crown moulding swept around a rectangle (facing outward)
  const crown = (x0, x1, z0, z1, y, h, depth, mat = M.trim) => {
    const prof = G.PROFILES.crown(h, depth);
    const path = [new THREE.Vector3(x0, y, z0), new THREE.Vector3(x0, y, z1), new THREE.Vector3(x1, y, z1), new THREE.Vector3(x1, y, z0)];
    B.add(G.sweepProfile(prof, path, { closed: true, uvScale: 1 }), mat, null, { uv: 'keep' });
  };
  const brackets = [];
  const bracketRow = (ax, az, bx, bz, y, nx, nz, spacing = 1.0, pair = true) => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / spacing));
    const ry = Math.atan2(nx, nz);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const offs = pair ? [-0.11, 0.11] : [0];
      for (const o of offs) {
        const tx = (bx - ax) / len, tz = (bz - az) / len;
        brackets.push(mat4(x + tx * o, y, z + tz * o, 0, ry, 0, 1.0, 1.25, 1.35));
      }
    }
  };
  // concave (bellcast) mansard ring: from outline at yb to inset outline at yb+hgt
  const mansard = (x0, x1, z0, z1, yb, hgt, inset, mat = M.slate, rows = 8, curve = 0.35) => {
    const pos = [], uv = [], idx = [];
    const corners = [[x0, z0], [x0, z1], [x1, z1], [x1, z0]]; // CCW from above? (x0,z0)->(x0,z1) runs +z on the -x side
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const prof = [];
    let slant = 0;
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      // concave: inset grows slowly at first then fast (bell at the foot)
      const ins = inset * (t + curve * Math.sin(t * Math.PI) * (t - 0.5) * -2 * 0 + curve * (t * t - t) * -1);
      const y = yb + hgt * t;
      if (r > 0) slant += Math.hypot(hgt / rows, ins - prof[r - 1][0]);
      prof.push([ins, y, slant]);
    }
    let vbase = 0;
    for (let s = 0; s < 4; s++) {
      const [ax, az] = corners[s], [bx, bz] = corners[(s + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      for (let r = 0; r <= rows; r++) {
        const [ins, y, sl] = prof[r];
        for (const [px, pz, u] of [[ax, az, 0], [bx, bz, len]]) {
          const dx = Math.sign(cx - px), dz = Math.sign(cz - pz);
          pos.push(px + dx * ins, y, pz + dz * ins);
          // u along edge (shrinks with inset), v up the slope
          const uu = u === 0 ? ins : len - ins;
          uv.push(uu / 1.5, sl / 1.5);
        }
      }
      for (let r = 0; r < rows; r++) {
        const a = vbase + r * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
      vbase += (rows + 1) * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // make sure faces point outward
    fixOutward(g, new THREE.Vector3(cx, yb, cz));
    B.add(g, mat, null, { uv: 'keep' });
    const top = prof[rows][0];
    return { x0: x0 + top, x1: x1 - top, z0: z0 + top, z1: z1 - top, y: yb + hgt, prof };
  };
  const cresting = [];
  const crestRail = (x0, x1, z0, z1, y, spacing = 0.32) => {
    const edges = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
    for (const [ax, az, bx, bz] of edges) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / spacing));
      for (let i = 0; i < n; i++) {
        const t = i / n;
        cresting.push(mat4(ax + (bx - ax) * t, y, az + (bz - az) * t, 0, Math.atan2(bx - ax, bz - az), 0, 1, i % 4 === 0 ? 1.6 : 1, 1));
      }
      B.add(new THREE.CylinderGeometry(0.015, 0.015, len, 6), M.iron, mat4((ax + bx) / 2, y + 0.06, (az + bz) / 2, 0, Math.atan2(bx - ax, bz - az), 0).multiply(mat4(0, 0, 0, Math.PI / 2, 0, 0)), { uv: 'keep' });
      B.add(new THREE.CylinderGeometry(0.012, 0.012, len, 6), M.iron, mat4((ax + bx) / 2, y + 0.3, (az + bz) / 2, 0, Math.atan2(bx - ax, bz - az), 0).multiply(mat4(0, 0, 0, Math.PI / 2, 0, 0)), { uv: 'keep' });
    }
  };

  // ------------------------------------------------------------------ foundation
  const fo = 0.12;
  wallBox(MB.x0 - fo, MB.x1 + fo, 0, F, MB.z0 - fo, MB.z1 + fo, M.ashlar, 0.5);
  wallBox(TOWER.x0 - fo, TOWER.x1 + fo, 0, F, TOWER.z0, TOWER.z1 + fo, M.ashlar, 0.5);
  // water table cap
  band(MB.x0, MB.x1, MB.z0, MB.z1, F - 0.08, 0.12, fo + 0.04, M.ashlar);

  // ------------------------------------------------------------------ main walls
  wallBox(MB.x0, MB.x1, F, TOP, MB.z0, MB.z1);
  // corner boards
  for (const [x, z] of [[MB.x0, MB.z0], [MB.x0, MB.z1], [MB.x1, MB.z0]]) tbox(0.26, TOP - F, 0.26, x, (F + TOP) / 2, z);
  // belt course + frieze
  band(MB.x0, MB.x1, MB.z0, MB.z1, FL2 - 0.12, 0.24, 0.06);
  band(MB.x0, MB.x1, MB.z0, MB.z1, TOP - 0.7, 0.7, 0.05);
  // main cornice: soffit slab + crown, brackets
  const ov = 0.62;
  wallBox(MB.x0 - ov, MB.x1 + ov, TOP, TOP + 0.12, MB.z0 - ov, MB.z1 + ov, M.trim, 1);
  crown(MB.x0 - ov, MB.x1 + ov, MB.z0 - ov, MB.z1 + ov, TOP + 0.12, 0.34, 0.22);
  bracketRow(MB.x0, MB.z1 + 0.05, TOWER.x0 - 0.2, MB.z1 + 0.05, TOP + 0.02, 0, 1, 1.15);
  bracketRow(TOWER.x1 + 0.2, MB.z1 + 0.05, MB.x1 - 2.0, MB.z1 + 0.05, TOP + 0.02, 0, 1, 1.15);
  bracketRow(MB.x0 - 0.05, MB.z0, MB.x0 - 0.05, MB.z1, TOP + 0.02, -1, 0, 1.15);
  bracketRow(MB.x1 + 0.05, MB.z0, MB.x1 + 0.05, MB.z1 - 2.2, TOP + 0.02, 1, 0, 1.15);
  bracketRow(MB.x0, MB.z0 - 0.05, MB.x1, MB.z0 - 0.05, TOP + 0.02, 0, -1, 1.15);

  // ------------------------------------------------------------------ main mansard + dormers
  const mtop = mansard(MB.x0 - ov + 0.1, MB.x1 + ov - 0.1, MB.z0 - ov + 0.1, MB.z1 + ov - 0.1, TOP + 0.46, 3.7, 1.15);
  // curb moulding at the top of the mansard + upper low hip
  crown(mtop.x0 - 0.05, mtop.x1 + 0.05, mtop.z0 - 0.05, mtop.z1 + 0.05, mtop.y - 0.05, 0.2, 0.16);
  {
    const yb = mtop.y + 0.12;
    const hip = new THREE.BufferGeometry();
    const { x0, x1, z0, z1 } = mtop;
    const ins = 2.2, rise = 0.9;
    const v = [x0, yb, z0, x1, yb, z0, x1, yb, z1, x0, yb, z1, x0 + ins, yb + rise, z0 + ins, x1 - ins, yb + rise, z0 + ins, x1 - ins, yb + rise, z1 - ins, x0 + ins, yb + rise, z1 - ins];
    hip.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    hip.setIndex([0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4, 4, 7, 5, 5, 7, 6]);
    hip.computeVertexNormals();
    fixOutward(hip, new THREE.Vector3((x0 + x1) / 2, yb - 1, (z0 + z1) / 2));
    B.add(hip, M.slateDark, null, { uvScale: 0.66 });
    crestRail(x0 + 0.1, x1 - 0.1, z0 + 0.1, z1 - 0.1, yb);
  }
  // dormers on the mansard
  const dormer = (x, z, ry, lit = 0) => {
    const yb = TOP + 0.75;
    const w = 0.95, h = 1.75;
    const base = mat4(x, 0, z, 0, ry, 0);
    const put = (g, mat, lx, ly, lz, opts = { uvScale: 1 }) => B.add(g, mat, base.clone().multiply(mat4(lx, ly, lz)), opts);
    const dw = 1.7, dd = 1.6, dh = 2.55;
    // cheeks + face (in local: face at lz = 0, extending back -dd)
    put(new THREE.BoxGeometry(dw, dh, dd), M.trim, 0, yb + dh / 2, -dd / 2 + 0.02);
    // pilasters
    for (const sx of [-1, 1]) put(new THREE.BoxGeometry(0.2, dh, 0.1), M.trim, sx * (dw / 2 - 0.1), yb + dh / 2, 0.06);
    // arched hood (segmental roof)
    const hood = archBand(dw + 0.3, 0.55, 0.16, dd + 0.4, 16);
    put(hood, M.slateDark, 0, yb + dh - 0.02, -dd - 0.1, { uvScale: 1 });
    const fill = archBand(dw + 0.3, 0.55, 0.0001, 0.1, 16);
    const cap = new THREE.Shape();
    {
      const span = dw + 0.3, rise = 0.55;
      const Rr = (span * span / 4 + rise * rise) / (2 * rise), cy = rise - Rr, a0 = Math.atan2(-cy, span / 2);
      cap.moveTo(-span / 2, 0);
      for (let i = 0; i <= 16; i++) { const a = a0 + (Math.PI - 2 * a0) * (i / 16); cap.lineTo(Math.cos(a) * Rr, cy + Math.sin(a) * Rr); }
      cap.lineTo(span / 2, 0);
    }
    put(new THREE.ShapeGeometry(cap, 16), M.trim, 0, yb + dh - 0.02, 0.14);
    put(archBand(dw + 0.42, 0.62, 0.08, 0.12, 16), M.trim, 0, yb + dh - 0.06, 0.1);
    fill.dispose();
    win.add({ x: x + Math.sin(ry) * 0.11, y: yb + 0.35, z: z + Math.cos(ry) * 0.11, ry, w, h, type: 'round', lit, panes: 2 });
  };
  const dz = MB.z1 + ov - 0.1 - 0.45;
  dormer(-7.0, dz, 0, 0); dormer(-4.4, dz, 0, 0.0); dormer(4.4, dz, 0, 0.75);
  const dxL = MB.x0 - ov + 0.1 + 0.45, dxR = MB.x1 + ov - 0.1 - 0.45;
  dormer(dxL, -3.6, -Math.PI / 2); dormer(dxL, 0, -Math.PI / 2); dormer(dxL, 3.2, -Math.PI / 2, 0.4);
  dormer(dxR, -3.6, Math.PI / 2, 0); dormer(dxR, 0, Math.PI / 2);
  dormer(-3.2, MB.z0 - ov + 0.55, Math.PI); dormer(3.2, MB.z0 - ov + 0.55, Math.PI);

  // ------------------------------------------------------------------ tower
  {
    const T = TOWER;
    wallBox(T.x0, T.x1, F, T.top, T.z0, T.z1);
    for (const x of [T.x0, T.x1]) tbox(0.26, T.top - F, 0.26, x, (F + T.top) / 2, T.z1);
    // quoins up the corners
    for (let y = F + 0.2; y < T.top - 0.4; y += 0.55) for (const x of [T.x0, T.x1]) tbox(0.34, 0.24, 0.34, x, y, T.z1, 0, M.trim);
    band(T.x0, T.x1, MB.z1 - 0.05, T.z1, FL2 - 0.12, 0.24, 0.07);
    band(T.x0, T.x1, MB.z1 - 0.05, T.z1, TOP - 0.12, 0.24, 0.07);
    band(T.x0, T.x1, MB.z1 - 0.05, T.z1, T.top - 0.7, 0.7, 0.05);
    const tov = 0.5;
    wallBox(T.x0 - tov, T.x1 + tov, T.top, T.top + 0.12, T.z0 - tov, T.z1 + tov, M.trim, 1);
    crown(T.x0 - tov, T.x1 + tov, T.z0 - tov, T.z1 + tov, T.top + 0.12, 0.32, 0.2);
    bracketRow(T.x0 - 0.05, T.z0, T.x0 - 0.05, T.z1, T.top + 0.02, -1, 0, 1.0);
    bracketRow(T.x1 + 0.05, T.z0, T.x1 + 0.05, T.z1, T.top + 0.02, 1, 0, 1.0);
    bracketRow(T.x0, T.z1 + 0.05, T.x1, T.z1 + 0.05, T.top + 0.02, 0, 1, 1.0);
    // tall concave mansard
    const tt = mansard(T.x0 - tov + 0.08, T.x1 + tov - 0.08, T.z0 - tov + 0.08, T.z1 + tov - 0.08, T.top + 0.44, 5.0, 1.05, M.slate, 12, 0.6);
    crown(tt.x0 - 0.04, tt.x1 + 0.04, tt.z0 - 0.04, tt.z1 + 0.04, tt.y - 0.04, 0.22, 0.16);
    wallBox(tt.x0, tt.x1, tt.y + 0.1, tt.y + 0.3, tt.z0, tt.z1, M.slateDark, 1);
    crestRail(tt.x0 + 0.05, tt.x1 - 0.05, tt.z0 + 0.05, tt.z1 - 0.05, tt.y + 0.3, 0.26);
    // finial / lightning rod
    const cxT = (T.x0 + T.x1) / 2, czT = (T.z0 + T.z1) / 2;
    B.add(G.latheFromProfile([[0.0, 0], [0.16, 0], [0.12, 0.2], [0.06, 0.32], [0.14, 0.5], [0.05, 0.75], [0.03, 1.4], [0.09, 1.55], [0.02, 1.75], [0.012, 3.1], [0.0, 3.2]], 16), M.iron, mat4(cxT, tt.y + 0.3, czT), { uv: 'keep' });
    // oeil-de-boeuf dormer on the tower roof front
    {
      const yb = T.top + 1.5, zf = T.z1 + tov - 0.5;
      B.add(new THREE.CylinderGeometry(0.62, 0.62, 1.2, 28, 1, false), M.trim, mat4(cxT, yb, zf - 0.45, Math.PI / 2, 0, 0), { uvScale: 1 });
      B.add(new THREE.TorusGeometry(0.5, 0.09, 10, 32), M.trim, mat4(cxT, yb, zf + 0.16), { uvScale: 1 });
      B.add(new THREE.CylinderGeometry(0.72, 0.72, 1.3, 28, 1, false, -Math.PI / 2, Math.PI), M.slateDark, mat4(cxT, yb + 0.06, zf - 0.45, Math.PI / 2, 0, 0), { uvScale: 1 });
      win.shape(new THREE.CircleGeometry(0.5, 32), mat4(cxT, yb, zf + 0.14, 0, 0, 0, 0.84, 0.84, 1), 0.0);
    }
  }

  // ------------------------------------------------------------------ turret
  {
    const T = TURRET;
    const seg = 40;
    const cyl = (r, y0, y1, mat, uvs = 0.5) => {
      const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg, 1, true);
      // world-ish uv: u = arc length, v = height
      const p = g.attributes.position, u = g.attributes.uv;
      for (let i = 0; i < p.count; i++) u.setXY(i, Math.atan2(p.getX(i), p.getZ(i)) * r * uvs, (p.getY(i) + (y1 - y0) / 2 + y0) * uvs);
      B.add(g, mat, mat4(T.x, (y0 + y1) / 2, T.z), { uv: 'keep' });
    };
    cyl(T.r + 0.12, 0, F, M.ashlar, 0.5);
    cyl(T.r, F, T.top, M.siding, 0.5);
    for (const [y, h, o] of [[FL2 - 0.12, 0.24, 0.06], [TOP - 0.12, 0.24, 0.06], [T.top - 0.7, 0.7, 0.05], [F - 0.08, 0.12, 0.16]]) cyl(T.r + o, y, y + h, o > 0.1 ? M.ashlar : M.trim, 1);
    const tov = 0.5;
    // soffit + crown ring
    B.add(new THREE.CylinderGeometry(T.r + tov, T.r + tov, 0.12, seg), M.trim, mat4(T.x, T.top + 0.06, T.z), { uvScale: 1 });
    B.add(G.latheFromProfile(G.PROFILES.crown(0.3, 0.2).map((v) => [T.r + tov - 0.2 + v.x, v.y]), seg), M.trim, mat4(T.x, T.top + 0.12, T.z), { uv: 'keep' });
    // brackets around
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      brackets.push(mat4(T.x + Math.sin(a) * (T.r + 0.04), T.top + 0.02, T.z + Math.cos(a) * (T.r + 0.04), 0, a, 0, 1, 1.25, 1.35));
    }
    // witch's hat: bellcast cone
    const rb = T.r + tov - 0.05, H = 7.0;
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const r = rb * (1 - t) * (1 - 0.25 * Math.sin(t * Math.PI) * 0.0) - 0.22 * Math.sin(Math.min(1, t * 4) * Math.PI / 2) * (1 - t) * 1.2 + 0.0;
      pts.push([Math.max(0.02, r + (i === 0 ? 0.15 : 0)), t * H]);
    }
    const cone = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    {
      const p = cone.attributes.position, u = cone.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        u.setXY(i, Math.atan2(p.getX(i), p.getZ(i)) * Math.max(0.3, rb * (1 - y / H)) / 1.5 * 1.0, (H - y) * 1.08 / 1.5);
      }
    }
    B.add(cone, M.slate, mat4(T.x, T.top + 0.4, T.z), { uv: 'keep' });
    B.add(G.latheFromProfile([[0.0, 0], [0.2, 0], [0.16, 0.25], [0.07, 0.4], [0.17, 0.62], [0.06, 0.9], [0.035, 1.5], [0.1, 1.65], [0.025, 1.85], [0.012, 3.0], [0.0, 3.1]], 16), M.iron, mat4(T.x, T.top + 0.4 + H - 0.25, T.z), { uv: 'keep' });
    // turret windows (facing outwards on the visible arc)
    for (const [a, lit] of [[0.25, 0.0], [1.0, 0.0], [1.75, 0]]) {
      for (const [y, h, type, l] of [[F + 0.85, 2.5, 'seg', lit], [FL2 + 0.8, 2.3, 'flat', a === 1.0 ? 0.9 : 0], [TOP + 0.75, 2.0, 'round', 0]]) {
        win.add({ x: T.x + Math.sin(a) * (T.r - 0.01), y, z: T.z + Math.cos(a) * (T.r - 0.01), ry: a, w: 0.95, h, type, lit: l });
      }
    }
  }

  // ------------------------------------------------------------------ canted bay (left front)
  {
    const cx = -6.7, w0 = 3.4, w1 = 2.0, d = 1.1;
    const z0 = MB.z1;
    const y1 = TOP - 0.7;
    // centre face
    wallBox(cx - w1 / 2, cx + w1 / 2, F, y1, z0, z0 + d);
    B.add(new THREE.BoxGeometry(w1 + 0.3, F, d + 0.15), M.ashlar, mat4(cx, F / 2, z0 + d / 2 + 0.05), { uvScale: 0.5 });
    // angled faces
    const ang = Math.atan2(d, (w0 - w1) / 2);
    const sl = Math.hypot(d, (w0 - w1) / 2);
    for (const s of [-1, 1]) {
      const mx = cx + s * (w1 / 2 + (w0 - w1) / 4), mz = z0 + d / 2;
      B.add(new THREE.BoxGeometry(sl, y1 - F, 0.3), M.siding, mat4(mx, (F + y1) / 2, mz - 0.1, 0, s * ang, 0), { uvScale: 0.5 });
      B.add(new THREE.BoxGeometry(sl, F, 0.4), M.ashlar, mat4(mx, F / 2, mz - 0.1, 0, s * ang, 0), { uvScale: 0.5 });
      for (const [y, h, type] of [[F + 0.85, 2.45, 'seg'], [FL2 + 0.8, 2.25, 'flat']]) win.add({ x: mx + s * Math.sin(ang) * 0.06, y, z: mz + Math.cos(ang) * 0.06, ry: s * ang, w: 0.72, h, type, lit: 0 });
    }
    for (const [y, h, type, lit] of [[F + 0.85, 2.45, 'seg', 0.85], [FL2 + 0.8, 2.25, 'flat', 0]]) win.add({ x: cx, y, z: z0 + d, w: 1.2, h, type, lit });
    // bay belt + cornice & small roof
    tbox(w1 + 0.2, 0.24, 0.16, cx, FL2, z0 + d + 0.02);
    tbox(w1 + 0.5, 0.14, 0.5, cx, y1 + 0.07, z0 + d + 0.1);
  }

  // ------------------------------------------------------------------ main facade windows
  const fz = MB.z1;
  for (const [x, l1, l2] of [[-3.9, 0, 0.0], [3.8, 0.0, 0], [6.1, 0.0, 0]]) {
    win.add({ x, y: F + 0.85, z: fz, w: 1.15, h: 2.6, type: 'seg', lit: l1 });
    win.add({ x, y: FL2 + 0.8, z: fz, w: 1.1, h: 2.35, type: 'flat', lit: l2, shutters: x < 0 });
  }
  // side windows (left -x, right +x) and back
  for (const z of [-4.2, -1.4, 1.6]) {
    win.add({ x: MB.x0, y: F + 0.85, z, ry: -Math.PI / 2, w: 1.1, h: 2.6, type: 'seg', lit: z === -1.4 ? 0.7 : 0, shutters: true });
    win.add({ x: MB.x0, y: FL2 + 0.8, z, ry: -Math.PI / 2, w: 1.1, h: 2.35, type: 'flat', lit: 0, shutters: true });
  }
  for (const z of [-4.2, -1.4]) {
    win.add({ x: MB.x1, y: F + 0.85, z, ry: Math.PI / 2, w: 1.1, h: 2.6, type: 'seg', lit: 0, shutters: true });
    win.add({ x: MB.x1, y: FL2 + 0.8, z, ry: Math.PI / 2, w: 1.1, h: 2.35, type: 'flat', lit: z === -4.2 ? 0.55 : 0, shutters: true });
  }
  for (const x of [-6, -2, 2, 6]) {
    win.add({ x, y: F + 0.85, z: MB.z0, ry: Math.PI, w: 1.1, h: 2.6, type: 'seg' });
    win.add({ x, y: FL2 + 0.8, z: MB.z0, ry: Math.PI, w: 1.1, h: 2.35, type: 'flat', lit: x === 2 ? 0.6 : 0 });
  }
  // tower windows: paired round-headed on 2nd floor, tall round-headed on 3rd
  for (const x of [-0.62, 0.62]) win.add({ x, y: FL2 + 0.8, z: TOWER.z1, w: 0.9, h: 2.5, type: 'round', lit: 0.0 });
  win.add({ x: 0, y: TOP + 0.75, z: TOWER.z1, w: 1.1, h: 2.7, type: 'round', lit: 1.0, tint: 0.4 });
  for (const s of [-1, 1]) {
    win.add({ x: s > 0 ? TOWER.x1 : TOWER.x0, y: TOP + 0.75, z: (TOWER.z0 + TOWER.z1) / 2 + 0.5, ry: s * Math.PI / 2, w: 0.9, h: 2.4, type: 'round', lit: 0 });
  }

  // ------------------------------------------------------------------ front door (in the tower, under the porch)
  const door = new THREE.Group();
  door.name = 'frontDoor';
  {
    const z = TOWER.z1;
    // surround: pilasters + entablature
    for (const s of [-1, 1]) {
      tbox(0.28, DOOR.h + 0.2, 0.16, s * (DOOR.w / 2 + 0.55), F + (DOOR.h + 0.2) / 2, z + 0.08);
      tbox(0.42, 0.24, 0.24, s * (DOOR.w / 2 + 0.55), F + 0.12, z + 0.12);
    }
    tbox(DOOR.w + 1.6, 0.36, 0.2, 0, F + DOOR.h + 1.05, z + 0.1);
    tbox(DOOR.w + 1.9, 0.1, 0.34, 0, F + DOOR.h + 1.28, z + 0.17);
    // sidelights (lit glass)
    for (const s of [-1, 1]) {
      win.glassRect.push({ matrix: mat4(s * (DOOR.w / 2 + 0.24), F + 0.5 + (DOOR.h - 0.5) / 2, z + 0.01, 0, 0, 0, 0.3, DOOR.h - 0.5, 1), lit: 0.9, tint: 0.3 });
      tbox(0.06, DOOR.h, 0.08, s * (DOOR.w / 2 + 0.06), F + DOOR.h / 2, z + 0.04, 0, M.sash);
      tbox(0.06, DOOR.h, 0.08, s * (DOOR.w / 2 + 0.42), F + DOOR.h / 2, z + 0.04, 0, M.sash);
      tbox(0.36, 0.5, 0.06, s * (DOOR.w / 2 + 0.24), F + 0.25, z + 0.03, 0, M.doorWood);
      for (const fy of [0.33, 0.66]) tbox(0.36, 0.035, 0.05, s * (DOOR.w / 2 + 0.24), F + 0.5 + (DOOR.h - 0.5) * fy, z + 0.03, 0, M.sash);
    }
    // transom fanlight (lit)
    const tw = DOOR.w + 0.84;
    win.shape(new THREE.CircleGeometry(0.5, 32, 0, Math.PI), mat4(0, F + DOOR.h + 0.05, z + 0.01, 0, 0, 0, tw, tw, 1), 1.1);
    tbox(tw + 0.1, 0.1, 0.1, 0, F + DOOR.h + 0.05, z + 0.05, 0, M.sash);
    for (let i = 1; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      B.add(new THREE.BoxGeometry(0.03, tw / 2, 0.04), M.sash, mat4(Math.cos(a) * tw / 4, F + DOOR.h + 0.1 + Math.sin(a) * tw / 4, z + 0.04, 0, 0, a - Math.PI / 2), { uvScale: 1 });
    }
    B.add(archBand(tw - 0.02, tw / 2 - 0.01, 0.1, 0.12, 24), M.trim, mat4(0, F + DOOR.h + 0.08, z), { uvScale: 1 });
    // door leaves (separate group so they can swing open)
    const leafW = DOOR.w / 2;
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(s * DOOR.w / 2, F, z - 0.02);
      const leaf = new THREE.Group();
      leaf.position.x = -s * leafW / 2;
      const slab = new THREE.Mesh(G.boxUV(leafW - 0.01, DOOR.h, 0.07, 1), M.doorWood);
      slab.position.y = DOOR.h / 2; leaf.add(slab);
      for (const [y, hh] of [[0.55, 0.75], [1.55, 0.95], [2.5, 0.7]]) {
        const p = new THREE.Mesh(G.raisedPanel(leafW - 0.22, hh, { border: 0.06, bevel: 0.03, fieldDepth: 0.012 }), M.doorWood);
        p.position.set(0, y, 0.035); leaf.add(p);
      }
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), M.brass);
      knob.position.set(-s * (leafW / 2 - 0.1), 1.05, 0.08); leaf.add(knob);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 0.01), M.brass);
      plate.position.set(-s * (leafW / 2 - 0.1), 1.05, 0.04); leaf.add(plate);
      if (s > 0) {
        // knocker ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 10, 24), M.brass);
        ring.position.set(0, 1.62, 0.1); leaf.add(ring);
        const boss = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), M.brass);
        boss.position.set(0, 1.7, 0.08); boss.scale.z = 0.6; leaf.add(boss);
      }
      hinge.add(leaf);
      hinge.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      door.add(hinge);
      door.userData[s < 0 ? 'left' : 'right'] = hinge;
    }
  }
  group.add(door);

  // ------------------------------------------------------------------ porch
  const columns = [], balusters = [], spindles = [];
  {
    const P = PORCH;
    // deck + skirt
    wallBox(P.x0, P.x1, 0, F - 0.02, MB.z1, P.z1, M.ashlar, 0.5);
    B.add(new THREE.BoxGeometry(P.x1 - P.x0 + 0.1, 0.06, P.z1 - MB.z1 + 0.08), M.porchFloor, mat4((P.x0 + P.x1) / 2, F - 0.02, (MB.z1 + P.z1) / 2), { uvScale: 1 });
    // lattice skirt panels (dark gaps)
    for (let x = P.x0 + 0.4; x < P.x1 - 0.3; x += 1.1) if (Math.abs(x) > 1.8) tbox(0.9, 0.55, 0.03, x, 0.45, P.z1 + 0.02, 0, M.sash);
    // steps
    const nSteps = 6, sh = F / nSteps, sd = 0.34;
    for (let i = 0; i < nSteps; i++) {
      const y = F - (i + 1) * sh;
      B.add(new THREE.BoxGeometry(3.0 - i * 0.0, sh + 0.02, sd + 0.04), M.ashlar, mat4(0, y + sh / 2, P.z1 + sd * i + sd / 2), { uvScale: 0.5 });
      B.add(new THREE.BoxGeometry(3.06, 0.035, 0.06), M.ashlar, mat4(0, y + sh + 0.0, P.z1 + sd * i + sd + 0.0), { uvScale: 0.5 });
    }
    // cheek walls of the steps with newel posts
    for (const s of [-1, 1]) {
      const cheek = new THREE.Shape();
      cheek.moveTo(0, 0); cheek.lineTo(sd * nSteps + 0.2, 0); cheek.lineTo(sd * nSteps + 0.2, 0.45); cheek.lineTo(0.2, F + 0.5); cheek.lineTo(0, F + 0.5); cheek.lineTo(0, 0);
      const cg = new THREE.ExtrudeGeometry(cheek, { depth: 0.4, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
      cg.rotateY(-Math.PI / 2);
      B.add(cg, M.ashlar, mat4(s * 1.5 + (s > 0 ? 0.4 : 0), 0, P.z1 - 0.2), { uvScale: 0.5 });
      B.add(new THREE.BoxGeometry(0.5, 0.95, 0.5), M.ashlar, mat4(s * 1.7, 0.47, P.z1 + sd * nSteps + 0.05), { uvScale: 0.5 });
      B.add(G.latheFromProfile([[0, 0], [0.3, 0], [0.3, 0.06], [0.24, 0.1], [0.12, 0.16], [0.16, 0.3], [0.22, 0.42], [0.18, 0.52], [0.0, 0.56]], 20), M.ashlar, mat4(s * 1.7, 0.95, P.z1 + sd * nSteps + 0.05), { uv: 'keep' });
    }
    // columns
    const colX = [-4.5, -2.95, -1.5, 1.5, 3.2, 4.95, 6.7];
    for (const x of colX) columns.push(mat4(x, F, P.z1 - 0.2));
    columns.push(mat4(P.x0 + 0.2, F, MB.z1 + 1.6));
    // spindle frieze + beam
    const beamY = P.roof - 0.25;
    tbox(P.x1 - P.x0, 0.3, 0.22, (P.x0 + P.x1) / 2, beamY + 0.1, P.z1 - 0.2);
    tbox(0.22, 0.3, P.z1 - MB.z1, P.x0 + 0.2, beamY + 0.1, (MB.z1 + P.z1) / 2);
    tbox(P.x1 - P.x0, 0.06, 0.2, (P.x0 + P.x1) / 2, beamY - 0.45, P.z1 - 0.2);
    for (let x = P.x0 + 0.3; x < P.x1 - 0.2; x += 0.13) spindles.push(mat4(x, beamY - 0.42, P.z1 - 0.2));
    // ceiling (beadboard) + hip roof
    B.add(new THREE.BoxGeometry(P.x1 - P.x0 + 0.5, 0.05, P.z1 - MB.z1 + 0.4), M.trim, mat4((P.x0 + P.x1) / 2, P.roof - 0.03, (MB.z1 + P.z1) / 2 + 0.1), { uvScale: 1 });
    {
      const x0 = P.x0 - 0.35, x1 = P.x1 + 0.2, z1 = P.z1 + 0.45, zW = MB.z1, y0 = P.roof, y1 = P.roof + 1.05;
      const g = new THREE.BufferGeometry();
      const v = [x0, y0, z1, x1, y0, z1, x1, y1, zW, x0, y1, zW, x0, y0, zW];
      g.setAttribute('position', new THREE.Float32BufferAttribute([...v], 3));
      g.setIndex([0, 1, 2, 0, 2, 3, 4, 0, 3]);
      g.computeVertexNormals();
      fixOutward(g, new THREE.Vector3((x0 + x1) / 2, y0 - 1, (z1 + zW) / 2));
      B.add(g, M.slate, null, { uvScale: 0.66 });
      tbox(x1 - x0 + 0.05, 0.22, 0.1, (x0 + x1) / 2, y0 - 0.06, z1);      // fascia
      tbox(x1 - x0 + 0.12, 0.12, 0.14, (x0 + x1) / 2, y0 + 0.02, z1 + 0.05, 0, M.iron); // gutter
    }
    // balustrade
    const railY = F + 0.95;
    const runs = [[P.x0 + 0.2, -1.5], [1.5, P.x1 - 0.2]];
    for (const [a, b] of runs) {
      tbox(b - a, 0.08, 0.14, (a + b) / 2, railY, P.z1 - 0.2);
      tbox(b - a, 0.07, 0.11, (a + b) / 2, F + 0.12, P.z1 - 0.2);
      for (let x = a + 0.12; x < b - 0.08; x += 0.17) {
        if (colX.some((c) => Math.abs(c - x) < 0.18)) continue;
        balusters.push(mat4(x, F + 0.15, P.z1 - 0.2));
      }
    }
    tbox(0.14, 0.08, P.z1 - MB.z1 - 0.2, P.x0 + 0.2, railY, (MB.z1 + P.z1) / 2 - 0.1);
    tbox(0.11, 0.07, P.z1 - MB.z1 - 0.2, P.x0 + 0.2, F + 0.12, (MB.z1 + P.z1) / 2 - 0.1);
    for (let z = MB.z1 + 0.2; z < P.z1 - 0.3; z += 0.17) if (Math.abs(z - (MB.z1 + 1.6)) > 0.18) balusters.push(mat4(P.x0 + 0.2, F + 0.15, z));
  }
  // column geometry: turned, with capital & base
  const colGeo = G.latheFromProfile([
    [0.0, 0], [0.17, 0], [0.17, 0.12], [0.14, 0.16], [0.14, 0.22], [0.12, 0.26], [0.11, 0.5], [0.13, 0.62], [0.09, 0.72], [0.085, 1.1], [0.1, 1.2], [0.075, 1.32],
    [0.08, 2.5], [0.095, 2.6], [0.075, 2.7], [0.11, 2.86], [0.15, 2.95], [0.17, 3.02], [0.17, 3.1], [0.0, 3.1],
  ], 18);
  group.add(instanced(colGeo, M.trim, columns, { name: 'columns' }));
  const balGeo = G.latheFromProfile([[0.0, 0], [0.045, 0], [0.045, 0.06], [0.03, 0.1], [0.028, 0.18], [0.05, 0.36], [0.04, 0.5], [0.022, 0.6], [0.026, 0.68], [0.04, 0.72], [0.04, 0.76], [0.0, 0.76]], 10);
  group.add(instanced(balGeo, M.trim, balusters, { name: 'balusters' }));
  const spGeo = G.latheFromProfile([[0.0, 0], [0.018, 0], [0.012, 0.08], [0.02, 0.18], [0.012, 0.3], [0.018, 0.4], [0.0, 0.4]], 6);
  group.add(instanced(spGeo, M.trim, spindles, { name: 'spindles', cast: false }));
  // column brackets (fretwork corbels at the column heads)
  for (const m of columns) {
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    for (const s of [-1, 1]) brackets.push(mat4(p.x + s * 0.12, PORCH.roof - 0.42, p.z, 0, s * Math.PI / 2, 0, 0.9, 0.9, 1.6));
  }

  // ------------------------------------------------------------------ chimneys
  const chimney = (x, z, y0, y1, w = 1.1, d = 0.75) => {
    wallBox(x - w / 2, x + w / 2, y0, y1, z - d / 2, z + d / 2, M.brick, 1.2);
    // corbelled cap
    for (const [dy, g] of [[0, 0.08], [0.18, 0.14], [0.36, 0.2], [0.6, 0.1]]) {
      B.add(new THREE.BoxGeometry(w + g * 2, 0.18, d + g * 2), M.brick, mat4(x, y1 + dy + 0.09, z), { uvScale: 1.2 });
    }
    B.add(new THREE.BoxGeometry(w + 0.34, 0.08, d + 0.34), M.ashlar, mat4(x, y1 + 0.84, z), { uvScale: 1 });
    for (const s of [-1, 1]) B.add(G.latheFromProfile([[0.0, 0], [0.15, 0], [0.13, 0.15], [0.11, 0.45], [0.14, 0.55], [0.13, 0.6], [0.1, 0.6], [0.09, 0.2], [0.0, 0.2]], 14), M.terracotta, mat4(x + s * w * 0.25, y1 + 0.88, z), { uv: 'keep' });
  };
  chimney(-5.4, -2.2, TOP + 3, 16.0);
  chimney(5.6, -3.0, TOP + 3, 16.3);
  chimney(MB.x0 - 0.45, -2.8, 0, 15.2, 1.0, 1.3);
  chimney(1.2, -5.4, TOP + 3, 15.6, 0.9, 0.7);

  // ------------------------------------------------------------------ instanced ironwork + brackets
  const crestGeo = (() => {
    const parts = [];
    const spear = G.latheFromProfile([[0.0, 0], [0.012, 0], [0.012, 0.32], [0.03, 0.34], [0.0, 0.45]], 6);
    parts.push(spear);
    const fleur = new THREE.TorusGeometry(0.06, 0.008, 4, 12, Math.PI);
    fleur.translate(0, 0.18, 0);
    fleur.rotateY(Math.PI / 2);
    parts.push(fleur);
    return G.mergeGeometries(parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); return q; }));
  })();
  group.add(instanced(crestGeo, M.iron, cresting, { name: 'cresting', receive: false }));
  group.add(instanced(bracketGeometry(), M.trim, brackets, { name: 'brackets' }));

  // ------------------------------------------------------------------ merge + glass
  B.build(group, { name: 'mansion' });
  const glass = win.buildGlass(group, ctx);
  return { group, door, glass };
}

/** Flip triangle winding where the face normal points toward `inside`. */
export function fixOutward(g, inside) {
  const p = g.attributes.position;
  const idx = g.index.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(p, idx[i]); b.fromBufferAttribute(p, idx[i + 1]); c.fromBufferAttribute(p, idx[i + 2]);
    n.subVectors(c, b).cross(m.subVectors(a, b));
    const ctr = m.copy(a).add(b).add(c).multiplyScalar(1 / 3).sub(inside);
    if (n.dot(ctr) < 0) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
  g.index.needsUpdate = true;
  g.computeVertexNormals();
}
