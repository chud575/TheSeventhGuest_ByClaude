// Deterministic seeded random utilities. Rooms MUST use these (never Math.random)
// so that `npm run shot` renders are reproducible.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG -> function returning [0,1) */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Random {
  constructor(seed = 7) {
    this.seed = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this._next = mulberry32(this.seed);
  }
  /** float in [0,1) */
  next() { return this._next(); }
  /** float in [min,max) */
  range(min, max) { return min + (max - min) * this._next(); }
  /** integer in [min,max] inclusive */
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  /** random element */
  pick(arr) { return arr[Math.floor(this._next() * arr.length)]; }
  /** true with probability p */
  chance(p = 0.5) { return this._next() < p; }
  /** approx gaussian (mean 0, sd 1) */
  gauss() {
    let u = 0, v = 0;
    while (u === 0) u = this._next();
    while (v === 0) v = this._next();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  /** signed float in [-1,1) */
  signed() { return this._next() * 2 - 1; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this._next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** independent child stream, stable for a given name */
  fork(name) { return new Random((this.seed ^ hashString(String(name))) >>> 0); }
}
