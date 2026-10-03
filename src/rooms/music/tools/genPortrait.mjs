#!/usr/bin/env node
// Offline "oil portrait" of Herr Kessler for the music-room overmantel.
// Ray-marches the same SDF sculpt as the ghost (genGhost.mjs) in a three-quarter
// bust pose, lights it like a Rembrandt (single warm key from the upper left,
// soft shadows, cavity occlusion), colours it by region (skin / hair / coat /
// linen), then "paints" it: brush-stroke smear, canvas weave, craquelure,
// yellowed varnish, darkened edges. Writes public/assets/music/portrait.jpg.
//   node src/rooms/music/tools/genPortrait.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { body, head, HEAD, SHOULDER, rcone, sph, smin, bodyTint } from './genGhost.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../../../public/assets/music/portrait.jpg');
const W = 720, H = 948;

// ---------------------------------------------------------------- scene SDF (bust, head upright, turned a little toward the viewer)
const headRotY = 0.35, headRotX = 0.06;
const cy = Math.cos(headRotY), sy = Math.sin(headRotY), cx = Math.cos(headRotX), sx = Math.sin(headRotX);
function headLocal(x, y, z) {
  let px = x - HEAD[0], py = y - HEAD[1], pz = z - HEAD[2];
  // inverse rotation: Y then X
  const qx = cy * px - sy * pz, qz = sy * px + cy * pz;
  const ry = cx * py + sx * qz, rz = -sx * py + cx * qz;
  return [qx, ry, rz];
}
function sceneParts(x, y, z) {
  const [hx, hy, hz] = headLocal(x, y, z);
  const dh = head(hx, hy, hz);
  let db = body(x, y, z);
  // upper arms hanging at the sides (the ghost's arms reach for the keys; a portrait sitter's don't)
  for (const s of [-1, 1]) {
    const sh = SHOULDER[s < 0 ? 'L' : 'R'];
    db = smin(db, rcone(x, y, z, sh, [s * 0.26, 0.74, 0.52], 0.058, 0.048), 0.04);
  }
  return [dh, db, hx, hy, hz];
}
function scene(x, y, z) { const r = sceneParts(x, y, z); return Math.min(r[0], r[1]); }

// ---------------------------------------------------------------- camera
const cam = [-0.38, 1.33, -0.6];
const look = [0.0, 1.235, 0.44];
const fwd = norm(sub(look, cam));
const right = norm(cross(fwd, [0, 1, 0]));
const up = cross(right, fwd);
const fovY = 30 * Math.PI / 180;
const keyDir = norm([-0.75, 0.75, -0.55]);       // toward the light (upper left, front)
const fillDir = norm([0.8, 0.2, -0.4]);

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;

function normal(p) {
  const e = 0.0012;
  const nx = scene(p[0] + e, p[1], p[2]) - scene(p[0] - e, p[1], p[2]);
  const ny = scene(p[0], p[1] + e, p[2]) - scene(p[0], p[1] - e, p[2]);
  const nz = scene(p[0], p[1], p[2] + e) - scene(p[0], p[1], p[2] - e);
  return norm([nx, ny, nz]);
}
function softShadow(p, l) {
  let res = 1, t = 0.008;
  for (let i = 0; i < 40 && t < 0.8; i++) {
    const d = scene(p[0] + l[0] * t, p[1] + l[1] * t, p[2] + l[2] * t);
    if (d < 0.0005) return 0;
    res = Math.min(res, 10 * d / t);
    t += Math.max(0.004, d);
  }
  return clamp(res);
}
function ao(p, n) {
  let o = 0, w = 1;
  for (let i = 1; i <= 5; i++) { const h = 0.012 * i; o += w * (h - scene(p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h)); w *= 0.6; }
  return clamp(1 - o * 9);
}

function shadePixel(px, py) {
  const u = (px + 0.5) / W * 2 - 1, v = 1 - (py + 0.5) / H * 2;
  const tY = Math.tan(fovY / 2), tX = tY * W / H;
  const rd = norm([fwd[0] + right[0] * u * tX + up[0] * v * tY, fwd[1] + right[1] * u * tX + up[1] * v * tY, fwd[2] + right[2] * u * tX + up[2] * v * tY]);
  let t = 0.3, hit = false, p;
  for (let i = 0; i < 160 && t < 2.5; i++) {
    p = [cam[0] + rd[0] * t, cam[1] + rd[1] * t, cam[2] + rd[2] * t];
    const d = scene(p[0], p[1], p[2]);
    if (d < 0.0004) { hit = true; break; }
    t += d * 0.9;
  }
  if (!hit) return null;
  const parts = sceneParts(p[0], p[1], p[2]);
  const n = normal(p);
  const [hx, hy, hz] = [parts[2], parts[3], parts[4]];
  const isHead = parts[0] < parts[1] + 0.002;
  // region colours (linear)
  let alb, spec = 0.04, rough = 0.6, sss = 0;
  if (isHead) {
    head(hx, hy, hz);
    const hairLike = head.hair < head.skull - 0.0005;
    if (hairLike) { const st = 0.75 + 0.5 * Math.abs(Math.sin(hx * 300 + hz * 120 + Math.sin(hy * 90) * 2)); alb = [0.2 * st, 0.195 * st, 0.19 * st]; rough = 0.4; spec = 0.12; }
    else { alb = [0.62, 0.4, 0.29]; sss = 1; rough = 0.5; }
    // lips / cheeks warmth, eyes
    if (!hairLike && Math.abs(hx) < 0.026 && Math.abs(hy + 0.06) < 0.012 && hz < -0.08) alb = [0.55, 0.28, 0.24];
    for (const s of [-1, 1]) {
      const ex = hx - s * 0.031, ey = hy - 0.011, ez = hz + 0.081;
      const de = Math.hypot(ex, ey, ez);
      if (de < 0.0145 && ez < 0) {
        const r = Math.hypot(ex, ey);
        alb = r < 0.0035 ? [0.02, 0.015, 0.01] : r < 0.0065 ? [0.14, 0.1, 0.07] : [0.38, 0.32, 0.27];
        spec = 0.3; rough = 0.1; sss = 0;
      }
    }
  } else {
    const linen = bodyTint(p[0], p[1], p[2]) > 0.5;
    alb = linen ? [0.7, 0.66, 0.56] : [0.025, 0.022, 0.022];
    rough = linen ? 0.7 : 0.75; spec = linen ? 0.04 : 0.02;
  }
  const occ = ao(p, n);
  const ndl = dot(n, keyDir);
  const sh = ndl > 0 ? softShadow([p[0] + n[0] * 0.002, p[1] + n[1] * 0.002, p[2] + n[2] * 0.002], keyDir) : 0;
  const keyC = [1.0, 0.84, 0.64];
  let diff = Math.max(0, ndl) * sh;
  // a little subsurface wrap on skin
  if (sss) diff = Math.max(diff, clamp((ndl + 0.3) / 1.3) * 0.25 * (0.4 + 0.6 * sh));
  const fill = clamp(dot(n, fillDir) * 0.5 + 0.5) * 0.08;
  const rim = Math.pow(1 - clamp(-dot(n, rd)), 3) * 0.12 * clamp(n[0] * 0.6 + 0.6);
  const hv = norm([keyDir[0] - rd[0], keyDir[1] - rd[1], keyDir[2] - rd[2]]);
  const sp = Math.pow(clamp(dot(n, hv)), mix(8, 120, 1 - rough)) * spec * 6 * sh;
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) out[k] = alb[k] * (keyC[k] * diff * 1.5 + [0.5, 0.45, 0.42][k] * fill * occ + rim) * (0.35 + 0.65 * occ) + sp * keyC[k];
  return { c: out, depth: t, region: isHead ? 1 : 2 };
}

if (isMainThread) {
  const sharp = (await import('sharp')).default;
  const N = Math.max(1, Math.min(4, os.cpus().length));
  const t0 = Date.now();
  const rowsPer = Math.ceil(H / N);
  const results = await Promise.all([...Array(N).keys()].map((i) => new Promise((res, rej) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { y0: i * rowsPer, y1: Math.min(H, (i + 1) * rowsPer) } });
    w.on('message', res); w.on('error', rej);
  })));
  const img = new Float32Array(W * H * 3);
  const mask = new Float32Array(W * H);
  for (const r of results) { img.set(r.img, r.y0 * W * 3); mask.set(r.mask, r.y0 * W); }
  console.log('raymarched in', Date.now() - t0, 'ms');
  // ------------------------------------------------ paint: background, brushwork, varnish, craquelure
  let seed = 1879; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const toS = (v) => Math.pow(clamp(v), 1 / 2.2);
  const px = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    // umber ground, glowing behind the head on the lit side
    const gx = x / W - 0.36, gy = y / H - 0.3;
    const glow = Math.exp(-(gx * gx * 3 + gy * gy * 2.2) * 3.2);
    const bg = [0.02 + 0.1 * glow, 0.015 + 0.07 * glow, 0.01 + 0.035 * glow];
    const m = mask[i];
    for (let k = 0; k < 3; k++) px[i * 3 + k] = mix(toS(bg[k]), toS(img[i * 3 + k]), m);
  }
  // brush smear: short directional strokes that drag colour along a slowly turning field
  const out = new Float32Array(px);
  for (let s = 0; s < 26000; s++) {
    const x0 = rnd() * W, y0 = rnd() * H;
    const ang = Math.sin(x0 * 0.013) * 1.4 + Math.cos(y0 * 0.011) * 1.2 + (rnd() - 0.5) * 0.6;
    const len = 6 + rnd() * 18, wid = 1.5 + rnd() * 2.5;
    const si = (Math.floor(y0) * W + Math.floor(x0)) * 3;
    const col = [px[si], px[si + 1], px[si + 2]];
    const a = 0.25 + rnd() * 0.25;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let t = 0; t < len; t += 1) for (let w = -wid; w <= wid; w += 1) {
      const xx = Math.round(x0 + ca * t - sa * w), yy = Math.round(y0 + sa * t + ca * w);
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = (yy * W + xx) * 3;
      const fade = a * (1 - t / len);
      for (let k = 0; k < 3; k++) out[j + k] = mix(out[j + k], col[k], fade);
    }
  }
  // canvas weave, craquelure (voronoi-ish crack lines), varnish and vignette
  const cracks = new Float32Array(W * H);
  for (let c = 0; c < 500; c++) {
    let x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI * 2;
    for (let k = 0; k < 18; k++) {
      a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 2; y += Math.sin(a) * 2;
      const xi = Math.round(x), yi = Math.round(y);
      if (xi >= 0 && yi >= 0 && xi < W && yi < H) cracks[yi * W + xi] = 1;
    }
  }
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const weave = 1 - 0.05 * ((x % 3 === 0 ? 1 : 0) + (y % 3 === 0 ? 1 : 0)) * 0.5;
    const vx = x / W - 0.5, vy = y / H - 0.45;
    const vig = 1 - clamp((Math.hypot(vx * 1.1, vy) - 0.32) * 1.4) * 0.6;
    for (let k = 0; k < 3; k++) {
      let v = out[i * 3 + k] * weave * vig;
      v *= [1.0, 0.94, 0.78][k];                    // yellowed varnish
      v = v * (1 - cracks[i] * 0.18);
      buf[i * 3 + k] = Math.round(clamp(v) * 255);
    }
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).blur(0.6).jpeg({ quality: 88 }).toFile(OUT);
  console.log('wrote', OUT, Date.now() - t0, 'ms');
} else {
  const { y0, y1 } = workerData;
  const img = new Float32Array((y1 - y0) * W * 3);
  const mask = new Float32Array((y1 - y0) * W);
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    const r = shadePixel(x, y);
    const i = (y - y0) * W + x;
    if (r) { img[i * 3] = r.c[0]; img[i * 3 + 1] = r.c[1]; img[i * 3 + 2] = r.c[2]; mask[i] = 1; }
  }
  parentPort.postMessage({ y0, img, mask });
}
