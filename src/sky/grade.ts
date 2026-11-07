/* Palette grading: turns the 64 indices into RGBA for the current moment. */
import { lerp } from '../engine/math';
import { BFAR, CLOUD, CLOUDD, DAY_RGB, FARB, EMISSIVE, GLOWI, GLOWO, NIGHT_RGB, NPAL, PAL32, SKY1, SKYIDX } from '../engine/palette';
import { S } from './state';

type C5 = number[][];
const hx = (list: string[]): C5 => list.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

// Sky ramp (5 colors top→horizon) + glow (outer, inner) for each elevation key.
const K_E = [-16, -9, -2, 5, 14];
const SKY_M = [
  hx(['#0d0b1f', '#141634', '#1e1e4a', '#34285e', '#4a3366', '#241e48', '#3a3060']),
  hx(['#141c44', '#22306a', '#38488c', '#5c5e9c', '#9a7aa6', '#6a5c9a', '#b48aa8']),
  hx(['#2c4282', '#4a64a8', '#8a8cbc', '#d6a2a6', '#ffbf94', '#f0a8a0', '#ffd2a0']),
  hx(['#3a6cb4', '#5f8fcc', '#93b2d8', '#d8cbbe', '#ffdcae', '#f8dcc0', '#fff0d8']),
  hx(['#3f7fc4', '#5b97d3', '#7aaede', '#a6c6e4', '#c6dcec', '#dfe9f2', '#fff8ea']),
];
const SKY_E = [
  SKY_M[0],
  hx(['#141238', '#24205a', '#3e2e78', '#6e3a7e', '#a8526e', '#7a3e7a', '#c0606a']),
  hx(['#26306e', '#4a4a94', '#8a5a92', '#d8706a', '#ffa25a', '#f08a68', '#ffc070']),
  hx(['#3a64aa', '#6884c0', '#a89cb8', '#eeb08a', '#ffc078', '#ffc090', '#ffe0a8']),
  SKY_M[4],
];
const GREY_D = hx(['#7a8290', '#8a929e', '#9aa2ac', '#aab0b8', '#b8bec4', '#c4c8cc', '#d0d2d4']);
const GREY_N = hx(['#15141e', '#1d1b28', '#262232', '#33283a', '#40303e', '#3a2c3a', '#4a3640']);
const SKY_SLOTS = [SKY1, SKY1 + 1, SKY1 + 2, SKY1 + 3, SKY1 + 4, GLOWO, GLOWI];

const sky = Array.from({ length: 7 }, () => [0, 0, 0]);
function skyColors() {
  const e = S.sunElev, keys = S.morning ? SKY_M : SKY_E;
  let i = 0;
  while (i < K_E.length - 2 && e > K_E[i + 1]) i++;
  const t = Math.max(0, Math.min(1, (e - K_E[i]) / (K_E[i + 1] - K_E[i])));
  const ov = Math.min(1, Math.pow(S.cloud, 1.3) * 0.95), dark = 1 - 0.35 * S.storm;
  for (let s = 0; s < 7; s++)
    for (let c = 0; c < 3; c++) {
      const v = lerp(keys[i][s][c], keys[i + 1][s][c], t);
      const g = lerp(GREY_N[s][c], GREY_D[s][c], S.dayK);
      sky[s][c] = lerp(v, g, ov) * dark;
    }
}

export function gradePalette() {
  skyColors();
  const d = S.dayK, gold = S.golden, tw = S.twilight, ov = S.cloud * d, n = S.deep * (1 - d);
  const fs = S.flashSky, fa = S.flashAll;
  for (let i = 0; i < NPAL; i++) {
    let r: number, g: number, b: number;
    const slot = SKY_SLOTS.indexOf(i);
    if (slot >= 0) { [r, g, b] = sky[slot]; }
    else if (i === FARB) {
      // haze between mid-sky and far buildings, a touch darker than the sky behind it
      const bf = [lerp(NIGHT_RGB[BFAR][0], DAY_RGB[BFAR][0], d), lerp(NIGHT_RGB[BFAR][1], DAY_RGB[BFAR][1], d), lerp(NIGHT_RGB[BFAR][2], DAY_RGB[BFAR][2], d)];
      const k = 0.35 + 0.2 * d;
      r = lerp(sky[2][0], bf[0], k) * 0.92; g = lerp(sky[2][1], bf[1], k) * 0.92; b = lerp(sky[2][2], bf[2], k) * 0.94;
    }
    else {
      r = lerp(NIGHT_RGB[i][0], DAY_RGB[i][0], d); g = lerp(NIGHT_RGB[i][1], DAY_RGB[i][1], d); b = lerp(NIGHT_RGB[i][2], DAY_RGB[i][2], d);
      if (!EMISSIVE[i] || d > 0.5) {
        r *= 1 + 0.12 * gold; g *= 1 - 0.02 * gold; b *= 1 - 0.18 * gold;
        r *= 1 - 0.1 * tw; g *= 1 - 0.1 * tw; b *= 1 + 0.06 * tw;
        const lum = 0.3 * r + 0.59 * g + 0.11 * b, k = 0.45 * ov;
        r = lerp(r, lum, k) * (1 - 0.2 * ov); g = lerp(g, lum, k) * (1 - 0.2 * ov); b = lerp(b, lum, k) * (1 - 0.2 * ov);
      }
      r *= 1 - 0.08 * n; g *= 1 - 0.04 * n; b *= 1 + 0.05 * n;
    }
    const f = SKYIDX[i] ? fs * 0.35 : i === CLOUD || i === CLOUDD ? fs * 0.5 : fa * (0.08 - 0.05 * d);
    r += (200 - r) * f; g += (195 - g) * f; b += (255 - b) * f;
    const e = S.exposure;
    const R = Math.min(255, r * e) | 0, Gc = Math.min(255, g * e) | 0, B = Math.min(255, b * e) | 0;
    PAL32[i] = (255 << 24) | (B << 16) | (Gc << 8) | R;
  }
}
