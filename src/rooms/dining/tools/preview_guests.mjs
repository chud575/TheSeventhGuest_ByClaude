// CPU ray-marched preview of the guest sculpts: node preview_guests.mjs out.png [names] [yawDeg]
import { guestSDF, GUESTS } from '../guestSculpt.js';
import sharp from 'sharp';
const out = process.argv[2] || 'guests_prev.png';
const names = (process.argv[3] || Object.keys(GUESTS).join(',')).split(',');
const yawDeg = Number(process.argv[4] || 25);
const zoom = process.argv[5] === 'head';
const W = zoom ? 260 : 300, H = zoom ? 300 : 520;
const img = Buffer.alloc(W * names.length * H * 3);
names.forEach((nm, gi) => {
  const f = guestSDF(GUESTS[nm]);
  const yaw = yawDeg * Math.PI / 180;
  const cam = zoom ? [Math.sin(yaw) * 0.9, 1.33, 0.15 + Math.cos(yaw) * 0.9] : [Math.sin(yaw) * 3.2, 1.2, 0.1 + Math.cos(yaw) * 3.2];
  const tgt = zoom ? [0, 1.29, 0.15] : [0, 0.85, 0.1];
  const fw = tgt.map((v, i) => v - cam[i]); const fl = Math.hypot(...fw); fw.forEach((v, i) => fw[i] = v / fl);
  let rt = [fw[2], 0, -fw[0]]; const rl = Math.hypot(...rt); rt = rt.map((v) => -v / rl);
  const up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
  const L = [0.4, 0.8, 0.5]; const ll = Math.hypot(...L); L.forEach((v, i) => L[i] = v / ll);
  const s = zoom ? 0.2 : 0.27;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const u = (px / W - 0.5) * s * (W / H) * 2, v = -(py / H - 0.5) * s * 2;
    const d = [fw[0] + rt[0] * u + up[0] * v, fw[1] + rt[1] * u + up[1] * v, fw[2] + rt[2] * u + up[2] * v];
    const dl = Math.hypot(...d); d.forEach((q, i) => d[i] = q / dl);
    let t = 0, hit = false;
    for (let k = 0; k < 160 && t < 6; k++) {
      const p = [cam[0] + d[0] * t, cam[1] + d[1] * t, cam[2] + d[2] * t];
      const dist = f(...p);
      if (dist < 0.0006) { hit = true; break; }
      t += Math.max(dist * 0.8, 0.0005);
    }
    let c = [30, 30, 40];
    if (hit) {
      const p = [cam[0] + d[0] * t, cam[1] + d[1] * t, cam[2] + d[2] * t]; const e = 0.001;
      const n = [f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]), f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]), f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e)];
      const nl = Math.hypot(...n); n.forEach((q, i) => n[i] = q / nl);
      const dif = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      const fr = Math.pow(1 - Math.abs(n[0] * d[0] + n[1] * d[1] + n[2] * d[2]), 2);
      const val = 40 + 170 * dif + 40 * fr;
      c = [val, val * 0.95, val * 0.9];
    }
    const o = ((py * W * names.length) + gi * W + px) * 3;
    img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2];
  }
});
await sharp(img, { raw: { width: W * names.length, height: H, channels: 3 } }).png().toFile(out);
console.log(out);
