// Signed-distance sculpt of the library ghost: "Mr. Quill", an original elderly
// scholar character (balding dome with a thin grey fringe, lined brow, hooded eyes,
// sagging jowls), a knotted linen stock with cascading folded tails, and the ghost
// of a dark wool frock coat over a waistcoat. Pure JS (no three) so the offline
// mesher (genGhost.mjs) and any future tool can share it.
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
export const EYE = { x: 0.0315, y: 0.07, z: 0.077, r: 0.0118 };
const CRAN = [0, 0.098, -0.012, 0.0715, 0.081, 0.092];

export function headSdf(px, py, pz) {
  const ax = Math.abs(px); // symmetric features
  // cranium: domed, a touch long front-to-back (kept modest so the face carries the head)
  let d = ell(px, py, pz, CRAN[0], CRAN[1], CRAN[2], CRAN[3], CRAN[4], CRAN[5]);
  // temples pinch a little (elderly)
  d = smax(d, -ell(ax, py, pz, 0.088, 0.095, 0.045, 0.02, 0.028, 0.03), 0.02);
  // face mass, broad through the cheeks, narrowing gently to the chin
  const tx = px * (1 + 2.8 * Math.max(0, 0.03 - py));
  d = smin(d, ell(tx, py, pz, 0, 0.044, 0.034, 0.064, 0.084, 0.067), 0.03);
  // forehead slope
  d = smin(d, ell(px, py, pz, 0, 0.102, 0.034, 0.062, 0.056, 0.057), 0.02);
  // cheekbones (zygomatic arch)
  d = smin(d, ell(ax, py, pz, 0.05, 0.052, 0.058, 0.02, 0.012, 0.02), 0.012);
  // hollow under the cheekbone (gaunt)
  d = smax(d, -ell(ax, py, pz, 0.064, 0.028, 0.066, 0.007, 0.01, 0.005), 0.016);
  // jaw + chin
  d = smin(d, ell(tx, py, pz, 0, -0.013, 0.038, 0.052, 0.031, 0.053), 0.02);
  d = smin(d, ell(px, py, pz, 0, -0.037, 0.077, 0.019, 0.016, 0.015), 0.013);
  // sagging jowls hanging below the jaw line either side of the chin
  d = smin(d, ell(ax, py, pz, 0.038, -0.018, 0.06, 0.014, 0.018, 0.014), 0.012);
  // under-chin / wattle
  d = smin(d, ell(px, py, pz, 0, -0.049, 0.036, 0.032, 0.017, 0.03), 0.02);
  // muzzle (around the mouth)
  d = smin(d, ell(px, py, pz, 0, 0.006, 0.08, 0.028, 0.024, 0.021), 0.012);

  // eye sockets
  d = smax(d, -ell(ax, py, pz, EYE.x, EYE.y + 0.002, 0.095, 0.0195, 0.0135, 0.019), 0.011);
  // brow ridge: modest, dips at the glabella
  d = smin(d, cap(ax, py, pz, 0.009, 0.086, 0.094, 0.05, 0.087, 0.082, 0.0058, 0.0066), 0.01);
  // eyeballs
  d = Math.min(d, sph(ax, py, pz, EYE.x, EYE.y, EYE.z, EYE.r));
  // hooded upper lids (droop over the top third of the iris) + lower lid bags
  {
    const lid = Math.max(sph(ax, py, pz, EYE.x, EYE.y + 0.0006, EYE.z - 0.0004, EYE.r + 0.0014), -(py - (EYE.y + 0.0042 - (ax - EYE.x) * 0.12)));
    d = smin(d, lid, 0.004);
    // the hood: a fold of skin above the lid crease, heavier at the outer corner
    d = smin(d, ell(ax, py, pz, EYE.x + 0.005, EYE.y + 0.0095, EYE.z + 0.004, 0.013, 0.0032, 0.0065), 0.004);
    const low = Math.max(sph(ax, py, pz, EYE.x, EYE.y - 0.0005, EYE.z - 0.0012, EYE.r + 0.0011), (py - (EYE.y - 0.0078)));
    d = smin(d, low, 0.004);
    d = smin(d, ell(ax, py, pz, EYE.x + 0.002, EYE.y - 0.0165, 0.086, 0.0145, 0.0058, 0.006), 0.008); // bags
    // tear trough under the bag
    d = smax(d, -cap(ax, py, pz, EYE.x - 0.012, EYE.y - 0.016, 0.093, EYE.x + 0.012, EYE.y - 0.024, 0.088, 0.0012), 0.003);
  }

  // nose: long, faintly aquiline, not caricatured
  d = smin(d, cap(px, py, pz, 0, 0.077, 0.096, 0, 0.038, 0.115, 0.0056, 0.0072), 0.008);
  d = smin(d, sph(px, py, pz, 0, 0.058, 0.104, 0.0055), 0.006); // dorsal bump
  d = smin(d, sph(px, py, pz, 0, 0.033, 0.114, 0.0088), 0.007);
  d = smin(d, sph(ax, py, pz, 0.0105, 0.028, 0.104, 0.0062), 0.006);
  // columella / under-nose
  d = smin(d, cap(px, py, pz, 0, 0.024, 0.11, 0, 0.019, 0.101, 0.0038), 0.004);
  // nostrils
  d = smax(d, -ell(ax, py, pz, 0.0078, 0.0205, 0.108, 0.0033, 0.0021, 0.0048), 0.002);

  // lips (thin, downturned corners)
  {
    const corner = ax * ax * 4.5; // droop toward the corners
    d = smin(d, ell(px, py + corner, pz, 0, 0.0035, 0.0965, 0.02, 0.0042, 0.006), 0.004);
    d = smin(d, ell(px, py + corner, pz, 0, -0.006, 0.094, 0.017, 0.0048, 0.0065), 0.004);
    const ml = Math.max(Math.abs(py + corner + 0.0012) - 0.0005, ax - 0.0215, -(pz - 0.095));
    d = smax(d, -ml, 0.0025);
    // vertical lip lines (perioral wrinkles)
    if (Math.abs(py + corner) < 0.009 && ax < 0.02 && pz > 0.09) d += 0.00012 * Math.max(0, Math.cos(px * 900));
  }
  // philtrum groove
  d = smax(d, -cap(px, py, pz, 0, 0.016, 0.106, 0, 0.0085, 0.103, 0.0016), 0.002);
  // nasolabial folds: a deep groove with a fleshy cheek bulge
  {
    const fold = cap(ax, py, pz, 0.0165, 0.026, 0.102, 0.029, -0.006, 0.089, 0.0014);
    d = smax(d, -fold, 0.0045);
    d = smin(d, ell(ax, py, pz, 0.034, 0.02, 0.076, 0.014, 0.018, 0.012), 0.014);
    // marionette lines from the mouth corners down to the jowls
    d = smax(d, -cap(ax, py, pz, 0.023, -0.008, 0.088, 0.03, -0.034, 0.072, 0.0007), 0.005);
  }
  // chin crease
  d = smax(d, -cap(px, py, pz, -0.012, -0.023, 0.091, 0.012, -0.023, 0.091, 0.0018), 0.003);

  // forehead wrinkles (shallow horizontal grooves, broken and uneven)
  if (py > 0.088 && py < 0.14 && pz > 0.035) {
    const w = smoothstep(0.088, 0.1, py) * smoothstep(0.14, 0.128, py) * smoothstep(0.05, 0.0, ax - 0.03);
    const br = 0.6 + 0.4 * Math.sin(px * 140 + py * 30);
    d += w * br * 0.00045 * (0.5 + 0.5 * Math.cos((py - 0.094) * 2 * Math.PI / 0.0095 + Math.sin(px * 55) * 0.9));
  }
  // glabella frown lines (two short verticals)
  if (ax < 0.012 && py > 0.078 && py < 0.1 && pz > 0.08) d += 0.00035 * smoothstep(0.004, 0.0, Math.abs(ax - 0.006)) * smoothstep(0.078, 0.084, py);
  // crow's feet
  if (ax > 0.042 && ax < 0.064 && Math.abs(py - EYE.y) < 0.016 && pz > 0.045) {
    d += 0.00022 * Math.cos(Math.atan2(py - EYE.y, ax - EYE.x) * 13) * smoothstep(0.042, 0.052, ax) * smoothstep(0.064, 0.056, ax);
  }
  // fine skin texture everywhere on the face (pores / crepiness)
  d += (fbm3(px * 900, py * 900, pz * 900, 2) - 0.5) * 0.00018;

  // ears (large in old age, set back)
  {
    const ex = ax - 0.072, ey = py - 0.056, ez = pz + 0.006;
    const c = Math.cos(0.25), s = Math.sin(0.25);
    const ry = ey * c - ez * s, rz = ey * s + ez * c;
    let e = ell(ex, ry, rz, 0, 0, 0, 0.008, 0.027, 0.016);
    e = smax(e, -ell(ex, ry, rz, 0.007, 0.002, 0.002, 0.0038, 0.016, 0.009), 0.004); // concha
    e = smin(e, ell(ex, ry, rz, 0.002, -0.022, 0.002, 0.007, 0.008, 0.008), 0.004);   // heavy lobe
    d = smin(d, e, 0.006);
  }
  // neck: short, mostly hidden in the stock
  d = smin(d, cap(px, py, pz, 0, -0.02, -0.012, 0, -0.1, 0.0, 0.043, 0.047), 0.026);
  d = smin(d, cap(ax, py, pz, 0.018, -0.04, 0.032, 0.012, -0.09, 0.046, 0.008), 0.014); // tendons
  return d;
}

// thin, close-cropped grey fringe round the back and sides of the head (just above the scalp)
export function hairSdf(px, py, pz) {
  const ax = Math.abs(px);
  const n = fbm3(px * 160 + 3, py * 90, pz * 160, 4);
  // combed strands: run roughly front-to-back, swept slightly downward
  const strands = 0.0004 * (fbm3(px * 300, py * 2200 + pz * 300, pz * 300 + px * 200, 3) - 0.5);
  const crownY = 0.094 - 0.38 * Math.min(0, pz + 0.01);
  const mask = smoothstep(0.035, 0.05, py) * smoothstep(crownY + 0.004, crownY - 0.014, py) * smoothstep(0.03, -0.005, pz)
    * (1 - smoothstep(0.075, 0.06, py) * smoothstep(0.062, 0.072, ax) * smoothstep(-0.035, -0.012, pz)); // clear the ears
  // sideburn-ish wisps just in front of the ears
  const temple = smoothstep(0.04, 0.06, py) * smoothstep(0.1, 0.085, py) * smoothstep(0.062, 0.07, ax) * smoothstep(0.03, 0.01, pz) * smoothstep(-0.02, 0.0, pz);
  const m = Math.max(mask, temple * 0.8);
  const thick = m * (0.0011 + 0.0008 * n) + strands * m * 0.7;
  const d = ell(px, py, pz, CRAN[0], CRAN[1], CRAN[2], CRAN[3], CRAN[4], CRAN[5]) - thick + 0.00025;
  return m < 0.05 ? Math.max(d, 0.0015) : d;
}

// eyebrows: thin, wiry, a little untidy
export function browSdf(px, py, pz) {
  const ax = Math.abs(px);
  const n = fbm3(px * 400, py * 400, pz * 400, 3);
  const b = cap(ax, py, pz, 0.011, 0.0868, 0.1, 0.049, 0.0885, 0.088, 0.0022, 0.0028);
  return b - 0.0012 * n + 0.0004;
}

// ------------------------------------------------------------------ STOCK / CRAVAT
// A high linen stock wound twice round the neck, a soft knot under the chin and
// three cascading, folded tails spilling over the waistcoat.
function sheet(px, py, pz, { y0, y1, cx0, cx1, w0, w1, z0, z1, t, pleat, pleatF, phase, curl }) {
  // a folded cloth panel hanging in roughly the x/y plane between y0 (top) and y1 (bottom)
  const h = clamp((y0 - py) / (y0 - y1), 0, 1);
  const cx = mix(cx0, cx1, h);
  const w = mix(w0, w1, h);
  const u = (px - cx) / w; // -0.5..0.5 across the panel
  const amp = pleat * (0.35 + 0.65 * h);
  const zs = mix(z0, z1, h) + amp * Math.sin(u * pleatF * Math.PI + phase + h * 1.6) + curl * u * u;
  const grad = amp * pleatF * Math.PI / w;
  let d = Math.abs(pz - zs) / Math.sqrt(1 + grad * grad * 0.6) - t * (1 - 0.35 * h);
  // ragged, softly rounded hem and edges
  const edge = Math.abs(px - cx) - w / 2;
  const hem = py - (y1 + 0.006 * Math.sin(u * 9 + phase));
  d = smax(d, edge, 0.004);
  d = smax(d, -hem, 0.004);
  d = smax(d, py - y0, 0.006);
  return d;
}
export function cravatSdf(px, py, pz) {
  const ang = Math.atan2(px, pz);
  const rr = Math.hypot(px, pz - 0.004);
  // the band: tall at the back, dipping under the chin; horizontal wrapping creases
  const yc = -0.062 + 0.026 * (1 - Math.max(0, Math.cos(ang)));
  const hh = 0.025 - 0.006 * Math.max(0, Math.cos(ang));
  const crease = 0.0011 * Math.sin((py - yc) * 260 + Math.sin(ang * 3) * 1.5) + 0.0007 * Math.sin(ang * 11 + py * 90);
  const qx = rr - (0.052 + 0.004 * Math.max(0, Math.cos(ang))), qy = py - yc;
  // rounded rectangle cross-section (2D sdRoundBox)
  const bx = Math.abs(qx) - 0.006, by = Math.abs(qy) - hh;
  let d = Math.hypot(Math.max(bx, 0), Math.max(by, 0)) + Math.min(Math.max(bx, by), 0) - 0.005 - crease;
  // the knot: a soft twisted bundle with creases
  {
    const kx = px, ky = py + 0.094, kz = pz - 0.06;
    const tw = 0.0012 * Math.sin(Math.atan2(ky, kx) * 5 + kz * 200);
    d = smin(d, ell(kx, ky, kz, 0, 0, 0, 0.026, 0.018, 0.017) - tw, 0.008);
  }
  // three cascading tails (left long, right long, a short middle ruffle on top)
  const tailL = sheet(px, py, pz, { y0: -0.098, y1: -0.27, cx0: -0.008, cx1: -0.026, w0: 0.042, w1: 0.1, z0: 0.066, z1: 0.096, t: 0.0034, pleat: 0.008, pleatF: 4.0, phase: 0.4, curl: -0.05 });
  const tailR = sheet(px, py, pz, { y0: -0.1, y1: -0.245, cx0: 0.01, cx1: 0.028, w0: 0.04, w1: 0.09, z0: 0.07, z1: 0.102, t: 0.0032, pleat: 0.0075, pleatF: 4.0, phase: 2.2, curl: -0.05 });
  const tailM = sheet(px, py, pz, { y0: -0.102, y1: -0.19, cx0: 0.0, cx1: 0.004, w0: 0.034, w1: 0.065, z0: 0.078, z1: 0.11, t: 0.003, pleat: 0.007, pleatF: 3.5, phase: 1.0, curl: -0.06 });
  d = smin(d, tailL, 0.006);
  d = smin(d, tailR, 0.005);
  d = smin(d, tailM, 0.004);
  return d;
}

// ------------------------------------------------------------------ COAT (frock coat + waistcoat)
export function coatSdf(px, py, pz) {
  const ax = Math.abs(px);
  // sloping shoulders and chest
  let d = ell(px, py, pz, 0, -0.2, -0.012, 0.18, 0.1, 0.105);
  d = smin(d, ell(px, py, pz, 0, -0.33, 0.0, 0.16, 0.19, 0.1), 0.07);
  d = smin(d, ell(ax, py, pz, 0.145, -0.22, -0.012, 0.06, 0.075, 0.07), 0.05);
  // open V at the front (the waistcoat shows)
  d = smax(d, -coatV(px, py, pz), 0.012);
  // lapels: raised folded slabs along the V edge, notched at the collar
  {
    const ly = clamp((-0.13 - py) / 0.2, 0, 1);
    const ex = 0.03 + 0.1 * ly;           // inner edge of the V at this height (approx)
    const lap = Math.max(Math.abs(ax - ex - 0.025) - 0.022, Math.abs(py + 0.22) - 0.1);
    const surf = ell(px, py, pz, 0, -0.2, -0.012, 0.185, 0.104, 0.112);
    let L = Math.max(lap, surf - 0.004, -surf - 0.012);
    // notch
    L = smax(L, -sph(ax, py, pz, 0.075, -0.15, 0.08, 0.014), 0.003);
    d = smin(d, L, 0.004);
  }
  // rolled collar standing behind the neck
  d = smin(d, len3(Math.hypot(px, pz + 0.006) - 0.064, (py + 0.11) * 0.7, 0) - 0.015 + Math.max(0, pz) * 0.45, 0.02);
  return d;
}
export function coatV(px, py, pz) {
  const vw = 0.04 + 0.13 * Math.max(0, -0.14 - py);
  return ell(px, py, pz, 0, -0.21, 0.1, vw, 0.14, 0.06);
}
// waistcoat in the V (separate part so it can be a different cloth)
export function waistcoatSdf(px, py, pz) {
  const ax = Math.abs(px);
  let d = ell(px, py, pz, 0, -0.3, 0.01, 0.13, 0.2, 0.09);
  d = smax(d, py + 0.11, 0.02);
  // shallow V neck of the waistcoat itself (shows the stock tails)
  d = smax(d, -ell(px, py, pz, 0, -0.14, 0.09, 0.035 + 0.06 * Math.max(0, -0.14 - py), 0.08, 0.05), 0.008);
  // buttons
  for (let k = 0; k < 4; k++) d = Math.min(d, sph(px, py, pz, 0, -0.245 - k * 0.04, 0.094 - k * 0.002, 0.0055));
  void ax;
  d = smax(d, coatV(px, py, pz) - 0.006, 0.004);
  return d;
}

// ------------------------------------------------------------------ PAINT (vertex colours, sRGB 0..1)
export function headColor(px, py, pz, region) {
  const ax = Math.abs(px);
  const n = fbm3(px * 220 + 7, py * 220, pz * 220, 4);
  if (region === 'hair' || region === 'brow') {
    const g = 0.42 + 0.22 * n;
    return [g, g * 0.98, g * 0.96];
  }
  if (region === 'cravat') { const g = 0.9 + 0.06 * n; return [g, g * 0.985, g * 0.95]; }
  if (region === 'coat') { const g = 0.17 + 0.06 * n; return [g * 1.0, g * 1.0, g * 1.06]; }
  if (region === 'waistcoat') {
    const btn = len3(px, ((py + 0.245) % 0.04 + 0.04) % 0.04 - 0.02, pz - 0.094) < 0.007 && py < -0.23;
    if (btn) return [0.55, 0.5, 0.42];
    const st = 0.5 + 0.5 * Math.sin(px * 600 + py * 600);   // faint brocade twill
    const g = 0.16 + 0.04 * n + 0.02 * st; return [g * 1.1, g, g * 0.9];
  }
  // skin: pale, slightly cool; mottled; ruddy nose and ear rims; liver spots on the dome
  let r = 0.78, g = 0.69, b = 0.63;
  const blotch = fbm3(px * 60 + 2, py * 60, pz * 60, 4);
  const sh = 0.9 + 0.14 * (n - 0.5) + 0.1 * (blotch - 0.5);
  r *= sh; g *= sh; b *= sh;
  // eyeballs (the old man looks a little down, toward the visitor)
  const ex = ax - EYE.x, ey = py - EYE.y, ez = pz - EYE.z;
  const er = len3(ex, ey, ez);
  if (er < EYE.r + 0.0006) {
    const fwd = ez / Math.max(er, 1e-6);
    const ey2 = ey + 0.0028; // gaze down
    const off = Math.sqrt(ex * ex + ey2 * ey2);
    if (fwd > 0.5 && off < 0.0024) return [0.025, 0.025, 0.03];                       // pupil
    if (fwd > 0.45 && off < 0.0056) { const k = 0.2 + 0.1 * n + 0.08 * Math.sin(Math.atan2(ey2, ex) * 24); return [k * 0.95, k * 1.08, k * 1.15]; } // iris
    if (fwd > 0.45 && off < 0.0062) return [0.12, 0.12, 0.13];                        // limbal ring
    const vein = smoothstep(0.75, 0.9, fbm3(px * 900, py * 900, pz * 900, 2)) * smoothstep(0.004, 0.009, off);
    return [0.74 + vein * 0.05, 0.69 - vein * 0.12, 0.64 - vein * 0.1];               // sclera (aged)
  }
  // shadowy sockets and lids (darker, a little violet)
  const sock = smoothstep(0.024, 0.01, len3(ex * 0.8, ey * 1.1, (pz - 0.09) * 0.5));
  r = mix(r, 0.48, sock * 0.5); g = mix(g, 0.38, sock * 0.55); b = mix(b, 0.42, sock * 0.5);
  // ruddy nose + cheeks, ear rims, broken capillaries
  const nose = smoothstep(0.02, 0.0, len3(px, py - 0.032, pz - 0.114));
  const cheek = smoothstep(0.03, 0.0, len3(ax - 0.045, py - 0.03, (pz - 0.072) * 0.7));
  const ear = smoothstep(0.066, 0.08, ax) * smoothstep(0.03, 0.06, py);
  const cap = smoothstep(0.78, 0.86, fbm3(px * 400, py * 400, pz * 400, 2)) * (cheek + nose);
  const red = Math.min(1, nose * 0.7 + cheek * 0.3 + ear * 0.45 + cap * 0.4);
  r = mix(r, 0.8, red * 0.5); g = mix(g, 0.52, red * 0.5); b = mix(b, 0.5, red * 0.5);
  // lips (pale, bluish)
  const lip = smoothstep(0.004, 0.0, Math.abs(py + 0.0015 + ax * ax * 9) - 0.007) * smoothstep(0.024, 0.016, ax) * smoothstep(0.088, 0.095, pz);
  r = mix(r, 0.58, lip * 0.6); g = mix(g, 0.44, lip * 0.6); b = mix(b, 0.46, lip * 0.6);
  // liver spots on the scalp and temples
  if (py > 0.09) {
    const sp = smoothstep(0.7, 0.8, fbm3(px * 90, py * 90, pz * 90, 3)) * smoothstep(0.09, 0.12, py);
    r = mix(r, 0.56, sp * 0.55); g = mix(g, 0.44, sp * 0.55); b = mix(b, 0.36, sp * 0.55);
  }
  // grey stubble shadow on the jaw and upper lip
  const jaw = smoothstep(0.02, -0.03, py) * smoothstep(0.06, 0.1, pz) * (1 - lip);
  const stub = jaw * (0.5 + 0.5 * vnoise3(px * 2500, py * 2500, pz * 2500));
  r = mix(r, 0.58, stub * 0.16); g = mix(g, 0.57, stub * 0.16); b = mix(b, 0.58, stub * 0.16);
  return [r, g, b];
}
