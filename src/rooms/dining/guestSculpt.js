/**
 * Sculpted spectral dinner guests (pure JS, no three.js dependency so the
 * offline baker can import it).
 *
 * Each guest is a signed-distance sculpt built from smooth-unioned primitives:
 * a seated 1890s figure, forearms resting on the table, with a modelled head
 * (cranium, brow ridge, eye sockets and lids, nose, lips, cheekbones, jaw, ears)
 * and period dress: a lady's bodice with leg-o'-mutton sleeves, pompadour and
 * topknot, choker, a seated skirt and bustle; a gentleman's tailcoat with rolled
 * lapels, wing collar and white tie, coat tails, side-parted hair, moustache,
 * beard, a top hat. The SDF is meshed with surface nets.
 *
 * Local frame: origin on the floor under the seat, +y up, +z toward the table
 * (whose edge is ~0.26 m in front, top at y = 0.76).
 */

// ------------------------------------------------------------------ SDF primitives
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const smax = (a, b, k) => -smin(-a, -b, k);
const sph = (x, y, z, cx, cy, cz, r) => len3(x - cx, y - cy, z - cz) - r;
/** ellipsoid (iq's bound-corrected approximation) */
function ell(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
  const k0 = len3(px, py, pz);
  const k1 = len3(px / rx, py / ry, pz / rz);
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
/** round cone from a (radius ra) to b (radius rb) — iq */
function rcone(x, y, z, a, b, ra, rb) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = x - a[0], pay = y - a[1], paz = z - a[2];
  const yy = pax * bax + pay * bay + paz * baz;
  const zz = yy - l2;
  const cx = pax * l2 - bax * yy, cy = pay * l2 - bay * yy, cz = paz * l2 - baz * yy;
  const x2 = cx * cx + cy * cy + cz * cz;
  const y2 = yy * yy * l2, z2 = zz * zz * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
  if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
  return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
}
/** rounded box, axis aligned */
function rbox(x, y, z, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
  return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}
/** vertical capped cylinder */
function cyl(x, y, z, cx, cy0, cy1, cz, r, round = 0) {
  const dx = Math.hypot(x - cx, z - cz) - r + round;
  const dy = Math.abs(y - (cy0 + cy1) / 2) - (cy1 - cy0) / 2 + round;
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - round;
}
/** torus in the xz plane */
const torus = (x, y, z, cx, cy, cz, R, r) => Math.hypot(Math.hypot(x - cx, z - cz) - R, y - cy) - r;

// ------------------------------------------------------------------ figure parts
const LEAN = 0.15;                       // forward lean of the torso (z per metre of height)
const lean = (y) => (y - 0.56) * LEAN;

/** A head centred at H, yaw (rad, + turns toward +x), pitch (+ looks down). Returns signed distance. */
function head(x, y, z, H, o) {
  // into head space
  let px = x - H[0], py = y - H[1], pz = z - H[2];
  const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw);
  [px, pz] = [px * cy - pz * sy, px * sy + pz * cy];
  const cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
  [py, pz] = [py * cp + pz * sp, -py * sp + pz * cp];
  const X = px, Y = py, Z = pz;
  let d = ell(X, Y, Z, 0, 0.02, -0.012, 0.077, 0.094, 0.097);                     // cranium
  d = smin(d, ell(X, Y, Z, 0, -0.04, 0.03, o.lady ? 0.054 : 0.06, 0.062, 0.07), 0.03);              // face mass
  d = smin(d, ell(X, Y, Z, 0, -0.084, 0.066, 0.026, 0.022, 0.022), 0.025);          // chin
  const jw = o.lady ? 0.045 : 0.052, jr = o.lady ? 0.017 : 0.02;
  d = smin(d, rcone(X, Y, Z, [-jw, -0.06, 0.0], [0, -0.09, 0.06], jr, 0.014), 0.02);   // jaw line
  d = smin(d, rcone(X, Y, Z, [jw, -0.06, 0.0], [0, -0.09, 0.06], jr, 0.014), 0.02);
  for (const s of [-1, 1]) d = smin(d, sph(X, Y, Z, s * 0.041, -0.012, 0.062, 0.022), 0.02);  // cheekbones
  d = smin(d, rcone(X, Y, Z, [-0.036, 0.028, 0.083], [0.036, 0.028, 0.083], 0.014, 0.014), 0.016);  // brow ridge
  // eye sockets, then the eyeballs and lids back in
  for (const s of [-1, 1]) d = smax(d, -sph(X, Y, Z, s * 0.03, 0.006, 0.1, 0.0175), 0.012);
  for (const s of [-1, 1]) {
    // eyeballs set back under the brow, heavy half-closed lids (a sleeper's calm, not a cartoon stare)
    d = smin(d, sph(X, Y, Z, s * 0.03, 0.003, 0.073, 0.0128), 0.006);
    d = smin(d, ell(X, Y, Z, s * 0.03, 0.009, 0.08, 0.0155, 0.0055, 0.0075), 0.006);   // upper lid
    d = smin(d, ell(X, Y, Z, s * 0.03, -0.006, 0.079, 0.014, 0.004, 0.006), 0.006);   // lower lid
    d = smin(d, ell(X, Y, Z, s * 0.034, -0.018, 0.078, 0.02, 0.008, 0.012), 0.012);   // under-eye / cheek plane
  }
  // temple hollows and a nasolabial fold give the face planes
  for (const s of [-1, 1]) d = smax(d, -ell(X, Y, Z, s * 0.07, 0.02, 0.055, 0.012, 0.02, 0.016), 0.012);
  // nose: bridge, tip and wings
  d = smin(d, rcone(X, Y, Z, [0, 0.022, 0.094], [0, -0.024, 0.117], 0.0085, 0.0115), 0.01);
  d = smin(d, sph(X, Y, Z, 0, -0.027, 0.11, 0.013), 0.008);
  for (const s of [-1, 1]) d = smin(d, sph(X, Y, Z, s * 0.012, -0.03, 0.103, 0.008), 0.006);
  // lips with a parting line, philtrum
  d = smin(d, ell(X, Y, Z, 0, -0.049, 0.094, 0.021, 0.0065, 0.01), 0.008);
  d = smin(d, ell(X, Y, Z, 0, -0.06, 0.09, 0.018, 0.0075, 0.01), 0.008);
  d = smax(d, -rbox(X, Y, Z, 0, -0.0545, 0.102, 0.015, 0.0008, 0.008, 0.0008), 0.003);
  // ears
  for (const s of [-1, 1]) d = smin(d, ell(X, Y, Z, s * 0.077, -0.005, -0.002, 0.012, 0.03, 0.019), 0.01);

  // ---- hair
  if (o.hair === 'pompadour') {
    let hd = ell(X, Y, Z, 0, 0.026, -0.014, 0.082, 0.1, 0.103);
    hd = smax(hd, Math.min(0.075 - 1.1 * Math.max(0, 0.07 - Z) - Y, Z + 0.05), 0.012);   // swept up off the forehead, low at the nape
    hd = smin(hd, ell(X, Y, Z, 0, 0.108, 0.012, 0.083, 0.042, 0.075), 0.035);           // rolled pompadour
    hd = smin(hd, ell(X, Y, Z, 0, 0.125, -0.03, 0.05, 0.035, 0.05), 0.03);            // crown
    hd = smin(hd, torus(X, Y - 0.15, Z + 0.035, 0, 0, 0, 0.022, 0.013), 0.012);        // topknot coil
    hd += 0.0022 * Math.sin(Math.atan2(Z + 0.02, X) * 9 + Y * 22);                     // soft Marcel waves
    d = smin(d, hd, 0.006);
  } else if (o.hair) {
    let hd = ell(X, Y, Z, 0.004, 0.03, -0.014, 0.084, 0.1, 0.104);
    hd = Math.max(hd, Math.min(0.045 - 0.8 * Math.max(0, 0.05 - Z) - Y, Z + 0.04));
    hd = smin(hd, ell(X, Y, Z, -0.025, 0.08, 0.03, 0.06, 0.035, 0.06), 0.03);         // swept side part
    hd += 0.0012 * Math.sin(X * 45 + Z * 20);
    d = smin(d, hd, 0.008);
    for (const s of [-1, 1]) d = smin(d, rcone(X, Y, Z, [s * 0.074, 0.01, 0.01], [s * 0.068, -0.045, 0.03], 0.011, 0.008), 0.008);   // sideburns
  }
  if (o.moustache) for (const s of [-1, 1]) d = smin(d, rcone(X, Y, Z, [s * 0.004, -0.038, 0.112], [s * 0.034, -0.05, 0.096], 0.008, 0.0035), 0.006);
  if (o.beard) {
    let bd = ell(X, Y, Z, 0, -0.085, 0.05, 0.06, 0.05, 0.05);
    bd = smin(bd, ell(X, Y, Z, 0, -0.115, 0.07, 0.035, 0.04, 0.03), 0.03);
    bd = Math.max(bd, -(-0.052 - Y));
    bd += 0.003 * Math.sin(X * 160) * Math.sin(Y * 90);
    d = smin(d, bd, 0.012);
  }
  if (o.topHat) {
    const crown = cyl(X, Y, Z, 0, 0.07, 0.25, -0.005, 0.083 + Math.max(0, Y - 0.07) * 0.06, 0.006);
    const brim = cyl(X, Y, Z, 0, 0.07, 0.08, -0.005, 0.135, 0.004) - Math.abs(X) * 0.0;
    let hd = smin(crown, brim, 0.012);
    hd = smin(hd, torus(X, Y - 0.085, Z + 0.005, 0, 0, 0, 0.086, 0.007), 0.004);     // hat band
    d = Math.min(d, hd);
  }
  return d;
}

/** hand resting flat on the table (or gripping), wrist w, forward direction f (unit xz) */
function hand(x, y, z, w, f, o = {}) {
  const r = [f[1], -f[0]];         // right of forward in xz
  const P = (a, s, h) => [w[0] + f[0] * a + r[0] * s, w[1] + h, w[2] + f[1] * a + r[1] * s];
  let d = rcone(x, y, z, P(0.0, 0, 0.006), P(0.06, 0, 0.0), 0.024, 0.026);     // palm
  d = smax(d, -(y - (w[1] + 0.02)), 0.01);                                       // flatten the back of the hand
  if (o.grip) {
    // fist around a stem
    d = smin(d, sph(x, y, z, ...P(0.07, 0, 0.012), 0.028), 0.02);
    return d;
  }
  const fingers = [[-0.026, 0.05, 0.036], [-0.009, 0.06, 0.04], [0.008, 0.058, 0.038], [0.024, 0.048, 0.03]];
  for (const [s, L, L2] of fingers) {
    const a = P(0.06, s * 1.0, 0.002), b = P(0.06 + L, s * 1.25, -0.006), c = P(0.06 + L + L2 * 0.6, s * 1.35, -0.016);
    d = smin(d, rcone(x, y, z, a, b, 0.0085, 0.0075), 0.008);
    d = smin(d, rcone(x, y, z, b, c, 0.0075, 0.0062), 0.004);
  }
  // thumb
  const side = o.left ? 1 : -1;
  d = smin(d, rcone(x, y, z, P(0.01, side * 0.026, 0.0), P(0.055, side * 0.045, -0.008), 0.011, 0.0075), 0.01);
  return d;
}

const norm2 = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };

/**
 * Build the SDF for one guest. opts: { lady, glass, hair, moustache, beard, topHat, yaw, pitch }
 */
export function guestSDF(o) {
  const lady = !!o.lady;
  const H = [0, 1.295, lean(1.295) + 0.035];
  const shY = lady ? 1.095 : 1.105, shX = lady ? 0.165 : 0.19;
  // arm skeleton
  const arms = [-1, 1].map((s) => {
    const sh = [s * shX, shY, lean(shY) - 0.01];
    const raise = o.glass && s > 0;
    const el = raise ? [s * 0.25, 0.86, 0.22] : [s * 0.235, 0.84, 0.19];
    const wr = raise ? [s * 0.17, 1.0, 0.42] : [s * 0.11, 0.8, 0.42];
    const f = raise ? [0, 1] : norm2(wr[0] - el[0], wr[2] - el[2]);
    return { s, sh, el, wr, f, raise };
  });
  return (x, y, z) => {
    if (x < -0.5 || x > 0.5 || y > 1.75 || z < -0.5 || z > 0.75) return 0.05;
    const L = lean(y);
    let d;
    // ---------------------------------------------------------- legs / skirt
    if (lady) {
      // seated skirt: hip mass, lap over the thighs, fall from the knees to the floor, bustle
      let sk = ell(x, y, z, 0, 0.57, -0.02, 0.2, 0.13, 0.18);
      sk = smin(sk, rbox(x, y, z, 0, 0.53, 0.18, 0.19, 0.055, 0.22, 0.05), 0.08);
      const ang = Math.atan2(x, z - 0.2);
      const t = Math.max(0, Math.min(1, (0.5 - y) / 0.5));
      const fall = rcone(x, y, z, [0, 0.5, 0.36], [0, 0.04, 0.42], 0.15, 0.24) + 0.012 * Math.sin(ang * 13 + y * 3) * t;
      sk = smin(sk, fall, 0.1);
      sk = smin(sk, ell(x, y, z, 0, 0.64, -0.2, 0.19, 0.13, 0.13), 0.06);      // bustle
      d = sk;
    } else {
      d = ell(x, y, z, 0, 0.56, -0.02, 0.17, 0.11, 0.14);                      // pelvis
      for (const s of [-1, 1]) {
        d = smin(d, rcone(x, y, z, [s * 0.09, 0.54, 0.0], [s * 0.1, 0.53, 0.42], 0.085, 0.06), 0.04);   // thigh
        d = smin(d, rcone(x, y, z, [s * 0.1, 0.52, 0.43], [s * 0.1, 0.09, 0.47], 0.056, 0.042), 0.03);  // shin
        d = smin(d, ell(x, y, z, s * 0.1, 0.045, 0.53, 0.045, 0.035, 0.11), 0.03);                      // shoe
      }
      // tailcoat tails falling behind over the seat
      d = smin(d, rbox(x, y, z, 0, 0.56, -0.15, 0.14, 0.12, 0.018, 0.015), 0.05);
    }
    // ---------------------------------------------------------- torso
    let tor;
    if (lady) {
      tor = ell(x, y, z, 0, 0.71, L - 0.005, 0.115, 0.11, 0.085);                // wasp waist
      tor = smin(tor, ell(x, y, z, 0, 0.92, L + 0.005, 0.15, 0.15, 0.105), 0.07);
      tor = smin(tor, ell(x, y, z, 0, 0.95, L + 0.055, 0.135, 0.075, 0.075), 0.05);   // monobosom bodice
      tor = smin(tor, rcone(x, y, z, [0, 0.72, L + 0.07], [0, 0.6, L + 0.09], 0.035, 0.01), 0.04);   // basque point
      // pleated bertha falling over the shoulders
      // (a smooth lace fichu, no pleat ridges: under the rim shader they read as strings of beads)
      tor = smin(tor, torus(x, (y - 1.05) * 1.6, (z - L - 0.01) * 1.25, 0, 0, 0, 0.135, 0.022), 0.05);
    } else {
      tor = ell(x, y, z, 0, 0.72, L, 0.145, 0.12, 0.1);
      tor = smin(tor, ell(x, y, z, 0, 0.93, L + 0.01, 0.17, 0.17, 0.115), 0.07);
      tor = smin(tor, rbox(x, y, z, 0, shY - 0.02, lean(shY), shX, 0.04, 0.085, 0.04), 0.06);   // square shoulders
      if (o.stout) tor = smin(tor, ell(x, y, z, 0, 0.74, L + 0.05, 0.15, 0.13, 0.12), 0.06);     // a well-fed paunch
      const fz = o.stout ? 0.15 : 0.1;
      // white shirt front + waistcoat V, rolled lapels lying on the chest
      tor = smin(tor, ell(x, y, z, 0, 1.0, lean(1.0) + 0.085, 0.05, 0.1, 0.03), 0.02);
      {
        const xi = 0.028 + Math.max(0, y - 0.84) * 0.42, ax = Math.abs(x);
        const shell = ell(x, y, z, 0, 0.93, L + 0.012, 0.177, 0.177, 0.122 + (o.stout ? 0.02 : 0));
        const lap = Math.max(shell, xi - ax, ax - xi - 0.058, 0.84 - y, y - 1.08);
        tor = Math.min(tor, lap);
      }
      for (const s of [-1, 1]) tor = smin(tor, ell(x, y, z, s * 0.02, 1.175, lean(1.175) + 0.07, 0.022, 0.011, 0.01), 0.006);   // white tie
      // buttons
      for (let i = 0; i < 3; i++) tor = smin(tor, sph(x, y, z, 0, 0.8 + i * 0.06, lean(0.8 + i * 0.06) + (o.stout ? 0.16 : 0.1), 0.007), 0.004);
    }
    d = smin(d, tor, 0.06);
    // neck + collar
    const nb = [0, 1.08, lean(1.08) - 0.005], nt = [0, 1.24, lean(1.24) + 0.03];
    d = smin(d, rcone(x, y, z, nb, nt, lady ? 0.047 : 0.055, lady ? 0.04 : 0.045), 0.03);
    if (lady) d = smin(d, torus(x, y, z, 0, 1.17, lean(1.17) + 0.018, 0.044, 0.0075), 0.005);   // pearl choker
    else d = smin(d, cyl(x, y, z, 0, 1.12, 1.19, lean(1.16) + 0.015, 0.056, 0.006), 0.01);      // wing collar
    // ---------------------------------------------------------- arms
    for (const a of arms) {
      const up = lady ? 0.085 : 0.056;
      let ar;
      if (lady) {
        // leg-o'-mutton: big puff at the shoulder narrowing to a fitted forearm
        const mid = [(a.sh[0] * 0.55 + a.el[0] * 0.45) + a.s * 0.02, a.sh[1] * 0.55 + a.el[1] * 0.45, a.sh[2] * 0.55 + a.el[2] * 0.45];
        ar = ell(x, y, z, mid[0], mid[1], mid[2], 0.066, 0.09, 0.066) + 0.0015 * Math.sin((z - mid[2]) * 70 + (y - mid[1]) * 30);
        ar = smin(ar, rcone(x, y, z, a.sh, a.el, 0.06, 0.042), 0.04);
        ar = smin(ar, rcone(x, y, z, a.el, a.wr, 0.04, 0.028), 0.02);
      } else {
        ar = smin(rcone(x, y, z, a.sh, a.el, up, 0.047), rcone(x, y, z, a.el, a.wr, 0.046, 0.04), 0.02);
        // shirt cuff
        const cf = [a.wr[0] + (a.wr[0] - a.el[0]) * 0.06, a.wr[1] + (a.wr[1] - a.el[1]) * 0.06, a.wr[2] + (a.wr[2] - a.el[2]) * 0.06];
        ar = smin(ar, rcone(x, y, z, a.wr, cf, 0.043, 0.04), 0.006);
      }
      d = smin(d, ar, 0.05);
      const hw = [a.wr[0] + a.f[0] * 0.015, a.wr[1] - (a.raise ? 0 : 0.008), a.wr[2] + a.f[1] * 0.015];
      if (a.raise) {
        // fist round a goblet
        d = smin(d, ell(x, y, z, hw[0], hw[1] + 0.02, hw[2] + 0.01, 0.03, 0.045, 0.032), 0.02);
        const gx = hw[0] - a.s * 0.005, gz = hw[2] + 0.03;
        let gb = rcone(x, y, z, [gx, hw[1] - 0.03, gz], [gx, hw[1] + 0.09, gz], 0.005, 0.005);
        gb = Math.min(gb, cyl(x, y, z, gx, hw[1] - 0.04, hw[1] - 0.03, gz, 0.032, 0.003));
        let bowl = smax(sph(x, y, z, gx, hw[1] + 0.135, gz, 0.045), y - (hw[1] + 0.16), 0.004);
        bowl = smax(bowl, -sph(x, y, z, gx, hw[1] + 0.14, gz, 0.04), 0.003);
        gb = smin(gb, bowl, 0.01);
        d = Math.min(d, gb);
      } else {
        d = smin(d, hand(x, y, z, hw, a.f, { left: a.s < 0 }), 0.015);
      }
    }
    // ---------------------------------------------------------- head
    d = smin(d, head(x, y, z, H, o), 0.025);
    return d;
  };
}

export const GUESTS = {
  // a lady in pearls raising her glass to the host
  pearls: { lady: true, glass: true, hair: 'pompadour', yaw: 0.25, pitch: -0.12 },
  // a stout gentleman, hands flat on the cloth, moustache
  stout: { lady: false, stout: true, hair: 'side', moustache: true, yaw: -0.1, pitch: 0.18 },
  // a thin lady, hands on the table, looking down at her plate
  thin: { lady: true, hair: 'pompadour', yaw: -0.2, pitch: 0.32 },
  // a bearded gentleman who never took off his hat
  hat: { lady: false, hair: 'side', beard: true, moustache: true, topHat: true, yaw: 0.3, pitch: 0.05 },
};

// ------------------------------------------------------------------ surface nets
/**
 * Mesh an SDF with naive surface nets on a uniform grid. Returns
 * { positions: Float32Array, normals: Float32Array, indices: Uint32Array }.
 */
export function surfaceNets(f, bmin, bmax, h) {
  const nx = Math.ceil((bmax[0] - bmin[0]) / h) + 1, ny = Math.ceil((bmax[1] - bmin[1]) / h) + 1, nz = Math.ceil((bmax[2] - bmin[2]) / h) + 1;
  const V = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) V[id(i, j, k)] = f(bmin[0] + i * h, bmin[1] + j * h, bmin[2] + k * h);
  const cid = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const vmap = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { cv[c] = V[id(i + corners[c][0], j + corners[c][1], k + corners[c][2])]; if (cv[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
      sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
      sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
      n++;
    }
    vmap[cid(i, j, k)] = pos.length / 3;
    pos.push(bmin[0] + (i + sx / n) * h, bmin[1] + (j + sy / n) * h, bmin[2] + (k + sz / n) * h);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = V[id(i, j, k)], b = V[id(i + 1, j, k)];
    if ((a < 0) === (b < 0)) continue;
    quad(vmap[cid(i, j - 1, k - 1)], vmap[cid(i, j, k - 1)], vmap[cid(i, j, k)], vmap[cid(i, j - 1, k)], a < 0);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = V[id(i, j, k)], b = V[id(i, j + 1, k)];
    if ((a < 0) === (b < 0)) continue;
    quad(vmap[cid(i - 1, j, k - 1)], vmap[cid(i - 1, j, k)], vmap[cid(i, j, k)], vmap[cid(i, j, k - 1)], a < 0);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = V[id(i, j, k)], b = V[id(i, j, k + 1)];
    if ((a < 0) === (b < 0)) continue;
    quad(vmap[cid(i - 1, j - 1, k)], vmap[cid(i, j - 1, k)], vmap[cid(i, j, k)], vmap[cid(i - 1, j, k)], a < 0);
  }
  // normals from the SDF gradient + one projection step onto the surface
  const P = new Float32Array(pos), N = new Float32Array(pos.length);
  const e = h * 0.5;
  for (let v = 0; v < P.length; v += 3) {
    const x = P[v], y = P[v + 1], z = P[v + 2];
    let gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
    const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
    const dd = f(x, y, z);
    if (Math.abs(dd) < h) { P[v] = x - gx * dd; P[v + 1] = y - gy * dd; P[v + 2] = z - gz * dd; }
    N[v] = gx; N[v + 1] = gy; N[v + 2] = gz;
  }
  // fix winding against the gradient normals
  const I = new Uint32Array(idx);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
    if (cx * (N[a] + N[b] + N[c]) + cy * (N[a + 1] + N[b + 1] + N[c + 1]) + cz * (N[a + 2] + N[b + 2] + N[c + 2]) < 0) { const tt = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tt; }
  }
  return { positions: P, normals: N, indices: I };
}

export const GUEST_BOUNDS = { min: [-0.46, 0.24, -0.42], max: [0.46, 1.72, 0.7] };

/** pack a mesh: header u32 [nv, ni], bbox f32[6], positions u16*3, normals i8*4, indices u16|u32 */
export function packMesh({ positions, normals, indices }, bmin = GUEST_BOUNDS.min, bmax = GUEST_BOUNDS.max) {
  const nv = positions.length / 3, ni = indices.length;
  const big = nv > 65535;
  const pv = (nv * 6 + 3) & ~3;   // keep the index block 4-byte aligned
  const bytes = 8 + 24 + pv + nv * 4 + ni * (big ? 4 : 2);
  const buf = new ArrayBuffer(bytes + ((4 - (bytes % 4)) % 4));
  const dv = new DataView(buf);
  dv.setUint32(0, nv, true); dv.setUint32(4, ni, true);
  for (let i = 0; i < 3; i++) { dv.setFloat32(8 + i * 4, bmin[i], true); dv.setFloat32(20 + i * 4, bmax[i], true); }
  let o = 32;
  const p16 = new Uint16Array(buf, o, nv * 3);
  for (let v = 0; v < nv; v++) for (let i = 0; i < 3; i++) p16[v * 3 + i] = Math.round(Math.max(0, Math.min(1, (positions[v * 3 + i] - bmin[i]) / (bmax[i] - bmin[i]))) * 65535);
  o += pv;
  const n8 = new Int8Array(buf, o, nv * 4);
  for (let v = 0; v < nv; v++) for (let i = 0; i < 3; i++) n8[v * 4 + i] = Math.round(normals[v * 3 + i] * 127);
  o += nv * 4;
  if (big) new Uint32Array(buf, o, ni).set(indices); else new Uint16Array(buf, o, ni).set(indices);
  return buf;
}
export function unpackMesh(buf) {
  const dv = new DataView(buf);
  const nv = dv.getUint32(0, true), ni = dv.getUint32(4, true);
  const bmin = [0, 1, 2].map((i) => dv.getFloat32(8 + i * 4, true)), bmax = [0, 1, 2].map((i) => dv.getFloat32(20 + i * 4, true));
  let o = 32;
  const p16 = new Uint16Array(buf, o, nv * 3); o += (nv * 6 + 3) & ~3;
  const n8 = new Int8Array(buf, o, nv * 4); o += nv * 4;
  const indices = nv > 65535 ? new Uint32Array(buf, o, ni) : new Uint16Array(buf, o, ni);
  const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) for (let i = 0; i < 3; i++) {
    positions[v * 3 + i] = bmin[i] + (p16[v * 3 + i] / 65535) * (bmax[i] - bmin[i]);
    normals[v * 3 + i] = n8[v * 4 + i] / 127;
  }
  return { positions, normals, indices: indices.slice() };
}
