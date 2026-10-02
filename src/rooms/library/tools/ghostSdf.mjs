// Signed-distance sculpt of the library ghost: "Mr. Quill", an original elderly
// scholar character (bald dome, white side-tufts, heavy brows, long nose, sagging
// jowls), a ruffled cravat and the ghost of a frock coat. Pure JS (no three) so
// the offline mesher (genGhost.mjs) and any future tool can share it.
// Units: metres. Origin: centre of the neck at the jaw line. +Z = face forward, +Y up.

const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function smin(a, b, k) { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return mix(b, a, h) - k * h * (1 - h); }
export function smax(a, b, k) { return -smin(-a, -b, k); }

// approximate ellipsoid distance (iq)
export function ell(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = px - cx, y = py - cy, z = pz - cz;
  const k0 = len3(x / rx, y / ry, z / rz);
  const k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
export function sph(px, py, pz, cx, cy, cz, r) { return len3(px - cx, py - cy, pz - cz) - r; }
// capsule with radius varying from ra to rb
export function cap(px, py, pz, ax, ay, az, bx, by, bz, ra, rb = ra) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - mix(ra, rb, h);
}

// cheap deterministic 3D value noise
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h & 0xffff) / 0xffff;
}
export function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const wt = (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
    r += wt * hash3(xi + dx, yi + dy, zi + dz);
  }
  return r;
}
export function fbm3(x, y, z, oct = 4) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise3(x, y, z); n += a; x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; }
  return s / n;
}

// ------------------------------------------------------------------ HEAD
export const EYE = { x: 0.0305, y: 0.071, z: 0.079, r: 0.0118 };

export function headSdf(px, py, pz) {
  const ax = Math.abs(px); // symmetric features
  // cranium: high, domed, slightly long front-to-back
  let d = ell(px, py, pz, 0, 0.104, -0.008, 0.076, 0.086, 0.097);
  // temples pinch a little (elderly)
  d = smax(d, -ell(ax, py, pz, 0.092, 0.098, 0.05, 0.022, 0.03, 0.03), 0.02);
  // face mass (narrowing toward the chin)
  const tx = px * (1 + 3.0 * Math.max(0, 0.035 - py));
  d = smin(d, ell(tx, py, pz, 0, 0.045, 0.036, 0.06, 0.083, 0.068), 0.03);
  // forehead slope
  d = smin(d, ell(px, py, pz, 0, 0.105, 0.035, 0.064, 0.058, 0.058), 0.02);
  // cheekbones
  d = smin(d, ell(ax, py, pz, 0.046, 0.05, 0.062, 0.019, 0.013, 0.019), 0.012);
  // hollow under the cheekbone (gaunt)
  d = smax(d, -ell(ax, py, pz, 0.064, 0.024, 0.07, 0.01, 0.014, 0.008), 0.012);
  // jaw + chin
  d = smin(d, ell(tx, py, pz, 0, -0.016, 0.04, 0.047, 0.03, 0.052), 0.02);
  d = smin(d, ell(px, py, pz, 0, -0.038, 0.079, 0.018, 0.016, 0.015), 0.014);
  // sagging jowls
  // under-chin / wattle
  d = smin(d, ell(px, py, pz, 0, -0.05, 0.036, 0.03, 0.017, 0.03), 0.02);
  // muzzle (around the mouth)
  d = smin(d, ell(px, py, pz, 0, 0.006, 0.082, 0.028, 0.024, 0.021), 0.012);

  // eye sockets
  d = smax(d, -ell(ax, py, pz, EYE.x, EYE.y + 0.002, 0.097, 0.0195, 0.0135, 0.019), 0.011);
  // brow ridge (heavier on the outside, dips at the glabella)
  d = smin(d, cap(ax, py, pz, 0.008, 0.087, 0.096, 0.05, 0.088, 0.083, 0.0075, 0.0085), 0.01);
  // eyeballs
  d = Math.min(d, sph(ax, py, pz, EYE.x, EYE.y, EYE.z, EYE.r));
  // hooded upper lids (droop over the top third of the iris) + lower lid bags
  {
    const lid = Math.max(sph(ax, py, pz, EYE.x, EYE.y + 0.0006, EYE.z - 0.0004, EYE.r + 0.0014), -(py - (EYE.y + 0.0048 - (ax - EYE.x) * 0.1)));
    d = smin(d, lid, 0.004);
    const low = Math.max(sph(ax, py, pz, EYE.x, EYE.y - 0.0005, EYE.z - 0.0012, EYE.r + 0.0011), (py - (EYE.y - 0.0078)));
    d = smin(d, low, 0.004);
    d = smin(d, ell(ax, py, pz, EYE.x + 0.002, EYE.y - 0.017, 0.088, 0.014, 0.006, 0.006), 0.008); // bags
  }

  // nose: long, slightly hooked
  d = smin(d, cap(px, py, pz, 0, 0.077, 0.098, 0, 0.036, 0.12, 0.0058, 0.0078), 0.008);
  d = smin(d, sph(px, py, pz, 0, 0.031, 0.12, 0.0098), 0.007);
  d = smin(d, sph(ax, py, pz, 0.0108, 0.027, 0.108, 0.0062), 0.006);
  // columella / under-nose
  d = smin(d, cap(px, py, pz, 0, 0.023, 0.114, 0, 0.018, 0.104, 0.004), 0.004);
  // nostrils
  d = smax(d, -ell(ax, py, pz, 0.008, 0.019, 0.112, 0.0035, 0.0022, 0.005), 0.002);

  // lips (thin, downturned corners)
  {
    const corner = ax * ax * 4.0; // droop toward the corners
    d = smin(d, ell(px, py + corner, pz, 0, 0.0035, 0.0985, 0.02, 0.0045, 0.0065), 0.004);
    d = smin(d, ell(px, py + corner, pz, 0, -0.0062, 0.096, 0.017, 0.005, 0.0068), 0.004);
    // mouth line
    const ml = Math.max(Math.abs(py + corner + 0.0012) - 0.0005, ax - 0.021, -(pz - 0.097));
    d = smax(d, -ml, 0.0025);
  }
  // philtrum groove
  d = smax(d, -cap(px, py, pz, 0, 0.016, 0.109, 0, 0.008, 0.106, 0.0016), 0.002);
  // nasolabial folds: a groove with a fleshy bulge on the cheek side
  {
    const fold = cap(ax, py, pz, 0.017, 0.025, 0.104, 0.027, -0.003, 0.093, 0.0012);
    d = smax(d, -fold, 0.004);
    d = smin(d, ell(ax, py, pz, 0.034, 0.02, 0.078, 0.016, 0.02, 0.014), 0.012);  // soft cheek fat pad
  }
  // chin crease
  d = smax(d, -cap(px, py, pz, -0.012, -0.024, 0.093, 0.012, -0.024, 0.093, 0.0018), 0.003);

  // forehead wrinkles (shallow horizontal grooves)
  if (py > 0.09 && py < 0.135 && pz > 0.04) {
    const w = smoothstep(0.09, 0.1, py) * smoothstep(0.135, 0.125, py) * smoothstep(0.05, 0.0, ax - 0.035);
    d += w * 0.0005 * (0.5 + 0.5 * Math.cos((py - 0.094) * 2 * Math.PI / 0.0085 + Math.sin(px * 60) * 0.8));
  }
  // crow's feet
  if (ax > 0.042 && ax < 0.06 && Math.abs(py - EYE.y) < 0.014 && pz > 0.05) {
    d += 0.00012 * Math.cos(Math.atan2(py - EYE.y, ax - EYE.x) * 14) * smoothstep(0.042, 0.05, ax);
  }

  // ears (large in old age)
  {
    const ex = ax - 0.075, ey = py - 0.058, ez = pz + 0.004;
    // tilt back
    const c = Math.cos(0.25), s = Math.sin(0.25);
    const ry = ey * c - ez * s, rz = ey * s + ez * c;
    let e = ell(ex, ry, rz, 0, 0, 0, 0.009, 0.03, 0.017);
    e = smax(e, -ell(ex, ry, rz, 0.008, 0.002, 0.002, 0.004, 0.018, 0.01), 0.004); // concha
    d = smin(d, e, 0.006);
  }
  // neck (thin, sinewy)
  d = smin(d, cap(px, py, pz, 0, -0.02, -0.014, 0, -0.14, 0.0, 0.042, 0.048), 0.028);
  d = smin(d, cap(ax, py, pz, 0.018, -0.04, 0.035, 0.012, -0.12, 0.05, 0.009), 0.015); // sternocleidomastoid
  return d;
}

// fringe of white hair around the back and sides (a thin layer over the scalp), wispy tufts over the ears
export function hairSdf(px, py, pz) {
  const ax = Math.abs(px);
  const n = fbm3(px * 180 + 3, py * 90, pz * 180, 4);
  const ang = Math.atan2(pz + 0.01, px);
  const strands = 0.0012 * Math.sin(ang * 90 + py * 260 + n * 7);
  // horseshoe band: above the ears, below a crown line that rises toward the back
  const crownY = 0.098 - 0.32 * Math.min(0, pz + 0.01);
  const mask = smoothstep(0.03, 0.05, py) * smoothstep(crownY + 0.004, crownY - 0.012, py) * smoothstep(0.035, 0.0, pz)
    * (1 - smoothstep(0.08, 0.06, py) * smoothstep(0.065, 0.075, ax) * smoothstep(-0.035, -0.015, pz));
  const thick = mask * (0.0022 + 0.0035 * n) + strands * mask;
  let d = ell(px, py, pz, 0, 0.104, -0.008, 0.076, 0.086, 0.097) - thick;
  d = smin(d, ell(px, py, pz, 0, 0.1, -0.018, 0.074, 0.083, 0.086) - thick, 0.004);
  // wispy tufts sticking out over the ears
  const tuft = ell(ax, py, pz, 0.079, 0.086, -0.016, 0.009 + 0.007 * n, 0.016, 0.026) - 0.0025 * n + strands;
  d = smin(d, tuft, 0.006);
  return d;
}

// eyebrows: bushy white brows
export function browSdf(px, py, pz) {
  const ax = Math.abs(px);
  const n = fbm3(px * 300, py * 300, pz * 300, 3);
  const b = cap(ax, py, pz, 0.01, 0.0865, 0.103, 0.05, 0.088, 0.091, 0.0036, 0.0046);
  return b - 0.0022 * n + 0.0009;
}

// ------------------------------------------------------------------ CRAVAT
function blade(px, py, pz, ax_, ay, az, bx, by, bz, w0, w1, t0, t1) {
  // flattened capsule: elliptical cross-section (width w across x, thickness t along z)
  const bax = bx - ax_, bay = by - ay, baz = bz - az;
  const h = clamp(((px - ax_) * bax + (py - ay) * bay + (pz - az) * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  const lx = px - (ax_ + bax * h), ly = py - (ay + bay * h), lz = pz - (az + baz * h);
  const w = mix(w0, w1, h), t = mix(t0, t1, h);
  const k = len3(lx / w, ly / Math.max(w, t), lz / t);
  return (k - 1) * Math.min(w, t);
}
export function cravatSdf(px, py, pz) {
  const ax = Math.abs(px);
  const ang = Math.atan2(px, pz);
  const fold = 0.0012 * Math.sin(ang * 7 + py * 30) + 0.0006 * Math.sin(ang * 15 - py * 50);
  // linen wound round the neck: a soft roll, lower at the front
  const yw = -0.083 - 0.012 * Math.max(0, Math.cos(ang));
  const rr = Math.hypot(px, (pz - 0.004));
  let d = len3(rr - 0.055, (py - yw) * 0.8, 0) - 0.017 - fold;
  // the knot
  d = smin(d, ell(px, py, pz, 0, -0.108, 0.062, 0.024, 0.02, 0.019) - fold, 0.012);
  // two broad ends spilling over the chest, fluted
  const fl = (0.0024 * Math.sin(px * 95 + py * 12) + 0.0009 * Math.sin(px * 210 + 1.0)) * clamp((-0.11 - py) / 0.05, 0, 1);
  d = smin(d, blade(px, py, pz, -0.004, -0.115, 0.064, -0.012, -0.235, 0.084, 0.02, 0.04, 0.007, 0.006) - fl, 0.012);
  d = smin(d, blade(px, py, pz, 0.006, -0.118, 0.068, 0.016, -0.215, 0.092, 0.018, 0.034, 0.006, 0.0055) - fl, 0.01);
  return d;
}

// ------------------------------------------------------------------ COAT (very faint)
export function coatSdf(px, py, pz) {
  const ax = Math.abs(px);
  // sloping shoulders and chest (smooth), open at the front where the linen shows
  let d = ell(px, py, pz, 0, -0.215, -0.012, 0.19, 0.1, 0.11);
  d = smin(d, ell(px, py, pz, 0, -0.33, 0.0, 0.165, 0.19, 0.105), 0.07);
  d = smin(d, ell(ax, py, pz, 0.15, -0.23, -0.012, 0.06, 0.075, 0.07), 0.05);
  // V opening
  const v = ell(px, py, pz, 0, -0.2, 0.1, 0.045 + 0.12 * Math.max(0, -0.15 - py), 0.13, 0.06);
  d = smax(d, -v, 0.02);
  // rolled collar behind the neck
  d = smin(d, len3(Math.hypot(px, pz + 0.004) - 0.066, (py + 0.11) * 0.7, 0) - 0.016 + Math.max(0, pz - 0.0) * 0.4, 0.02);
  return d;
}

// ------------------------------------------------------------------ PAINT (vertex colours, sRGB 0..1)
export function headColor(px, py, pz, region) {
  const ax = Math.abs(px);
  const n = fbm3(px * 220 + 7, py * 220, pz * 220, 4);
  if (region === 'hair' || region === 'brow') {
    const g = 0.78 + 0.18 * n;
    return [g, g * 0.98, g * 0.95];
  }
  if (region === 'cravat') { const g = 0.92 + 0.06 * n; return [g, g * 0.99, g * 0.95]; }
  if (region === 'coat') { const g = 0.16 + 0.05 * n; return [g * 0.9, g, g * 1.15]; }
  // skin: pale, cool, waxy; liver spots on the dome; ruddy nose tip, ear rims
  let r = 0.80, g = 0.70, b = 0.63;
  const sh = 0.92 + 0.12 * (n - 0.5);
  r *= sh; g *= sh; b *= sh;
  // eyeballs
  const ex = ax - EYE.x, ey = py - EYE.y, ez = pz - EYE.z;
  const er = len3(ex, ey, ez);
  if (er < EYE.r + 0.0006) {
    const fwd = ez / Math.max(er, 1e-6);
    const off = Math.sqrt(ex * ex + ey * ey);
    if (fwd > 0.6 && off < 0.0026) return [0.03, 0.03, 0.035];         // pupil
    if (fwd > 0.55 && off < 0.0058) return [0.22 + 0.1 * n, 0.26 + 0.1 * n, 0.28 + 0.1 * n];   // grey-blue iris
    return [0.72, 0.7, 0.66];                                           // sclera (aged)
  }
  // shadowy sockets and lids
  const sock = smoothstep(0.022, 0.012, len3(ex * 0.8, ey * 1.1, (pz - 0.092) * 0.5));
  r = mix(r, 0.5, sock * 0.55); g = mix(g, 0.4, sock * 0.6); b = mix(b, 0.4, sock * 0.55);
  // ruddy nose + cheeks, ear rims
  const nose = smoothstep(0.02, 0.0, len3(px, py - 0.03, pz - 0.12));
  const cheek = smoothstep(0.03, 0.0, len3(ax - 0.045, py - 0.03, (pz - 0.075) * 0.7));
  const ear = smoothstep(0.07, 0.085, ax) * smoothstep(0.03, 0.06, py);
  const red = Math.min(1, nose * 0.8 + cheek * 0.35 + ear * 0.4);
  r = mix(r, 0.82, red * 0.5); g = mix(g, 0.55, red * 0.5); b = mix(b, 0.52, red * 0.5);
  // lips
  const lip = smoothstep(0.004, 0.0, Math.abs(py + 0.0015 + ax * ax * 9) - 0.007) * smoothstep(0.024, 0.016, ax) * smoothstep(0.09, 0.097, pz);
  r = mix(r, 0.62, lip * 0.6); g = mix(g, 0.44, lip * 0.6); b = mix(b, 0.44, lip * 0.6);
  // liver spots on the scalp
  if (py > 0.12) {
    const sp = smoothstep(0.72, 0.8, fbm3(px * 90, py * 90, pz * 90, 3));
    r = mix(r, 0.58, sp * 0.6); g = mix(g, 0.46, sp * 0.6); b = mix(b, 0.38, sp * 0.6);
  }
  // stubble shadow on the jaw
  const jaw = smoothstep(0.02, -0.03, py) * smoothstep(0.06, 0.1, pz) * (1 - lip);
  r = mix(r, 0.6, jaw * 0.12); g = mix(g, 0.58, jaw * 0.12); b = mix(b, 0.58, jaw * 0.12);
  return [r, g, b];
}
