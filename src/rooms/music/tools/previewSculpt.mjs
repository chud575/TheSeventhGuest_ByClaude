#!/usr/bin/env node
// Quick sculpt preview for genGhost.mjs: ray-marches the head (or an arm) SDF from a few
// angles with plain lambert + cavity shading and writes a contact sheet PNG.
//   node src/rooms/music/tools/previewSculpt.mjs [head|armR|body] out.png
import sharp from 'sharp';
import { head, body, makeArm, SHOULDER } from './genGhost.mjs';

const which = process.argv[2] || 'head';
const out = process.argv[3] || '/tmp/sculpt.png';
const R = 320;
let f, center, dist;
if (which === 'head') { f = head; center = [0, -0.03, 0]; dist = 0.95; }
else if (which === 'body') { f = body; center = [0, 0.7, 0.5]; dist = 2.2; }
else { const s = which === 'armL' ? -1 : 1; f = makeArm(s); const sh = SHOULDER[s < 0 ? 'L' : 'R']; center = [s * 0.17 - sh[0], 0.77 - sh[1], 0.16 - sh[2]]; dist = 0.3; }
const views = which === 'head' ? [0, 0.6, 1.57, 3.14] : [0, 0.8, 1.57, 2.6];   // yaw around Y, 0 = from the front (-Z)
const img = Buffer.alloc(R * views.length * R * 3);
const L = [-0.5, 0.6, -0.6]; { const l = Math.hypot(...L); L[0] /= l; L[1] /= l; L[2] /= l; }
views.forEach((yaw, vi) => {
  const cam = [center[0] - Math.sin(yaw) * dist, center[1] + 0.02, center[2] - Math.cos(yaw) * dist];
  const fw = [center[0] - cam[0], center[1] - cam[1], center[2] - cam[2]]; const fl = Math.hypot(...fw); fw.forEach((_, i) => { fw[i] /= fl; });
  const rt = [-fw[2], 0, fw[0]]; const rl = Math.hypot(...rt); rt.forEach((_, i) => { rt[i] /= rl; });
  const up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
  const tanF = Math.tan(0.2);
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
    const sx = ((i + 0.5) / R * 2 - 1) * tanF, sy = (1 - (j + 0.5) / R * 2) * tanF;
    const d = [fw[0] + rt[0] * sx + up[0] * sy, fw[1] + rt[1] * sx + up[1] * sy, fw[2] + rt[2] * sx + up[2] * sy];
    const dl = Math.hypot(...d); d[0] /= dl; d[1] /= dl; d[2] /= dl;
    let t = dist * 0.5, hit = false;
    for (let k = 0; k < 160; k++) {
      const p = [cam[0] + d[0] * t, cam[1] + d[1] * t, cam[2] + d[2] * t];
      const v = f(p[0], p[1], p[2]);
      if (v < 0.0004) { hit = true; break; }
      t += v * 0.8; if (t > dist * 2) break;
    }
    let c = [40, 44, 60];
    if (hit) {
      const p = [cam[0] + d[0] * t, cam[1] + d[1] * t, cam[2] + d[2] * t];
      const e = 0.0008;
      const n = [f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]), f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]), f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e)];
      const nl = Math.hypot(...n) || 1; n[0] /= nl; n[1] /= nl; n[2] /= nl;
      const lam = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      let occ = 0; for (const [s, w] of [[0.004, 0.5], [0.01, 0.3], [0.02, 0.2]]) occ += w * Math.max(0, Math.min(1, f(p[0] + n[0] * s, p[1] + n[1] * s, p[2] + n[2] * s) / s));
      const v = (0.15 + 0.85 * lam) * (0.4 + 0.6 * occ);
      c = [v * 235, v * 215, v * 195];
    }
    const o = (j * R * views.length + vi * R + i) * 3;
    img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2];
  }
});
await sharp(img, { raw: { width: R * views.length, height: R, channels: 3 } }).png().toFile(out);
console.log('wrote', out);
