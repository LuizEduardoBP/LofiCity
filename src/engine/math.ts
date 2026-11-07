export type Rng = () => number;

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Smoothstep; works with a > b for falling edges. */
export const ss = (a: number, b: number, x: number) => {
  x = (x - a) / (b - a);
  x = x < 0 ? 0 : x > 1 ? 1 : x;
  return x * x * (3 - 2 * x);
};

/** mulberry32: tiny seeded PRNG returning floats in [0,1). */
export function mulberry32(a: number): Rng {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash32(x: number): number {
  x |= 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
export const hashf = (x: number) => hash32(x) / 4294967296;

/** Smooth 1D value noise in [0,1]. */
export function vnoise(seed: number, t: number): number {
  const i = Math.floor(t), f = t - i;
  const a = hashf(Math.imul(i, 374761393) ^ seed), b = hashf(Math.imul(i + 1, 374761393) ^ seed);
  return a + (b - a) * f * f * (3 - 2 * f);
}

/** 4x4 ordered dither thresholds. */
export const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bay = (x: number, y: number) => BAY[((y & 3) << 2) | (x & 3)];
