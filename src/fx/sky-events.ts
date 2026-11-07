/* Lightning bolts and fireworks, both drawn in the sky behind the skyline. */
import { G, putS } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import { AMB, BOLT, CYAN, FWG, MAG, RAINB, WHITE, CLOUDD } from '../engine/palette';
import { S } from '../sky/state';
import { audio } from '../audio/audio';

const r = mulberry32(0xb017);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- lightning ----------
let timer = 8, boltT = -1, FLT = -1, thunderAt = -1, thunderAmt = 0.6;
let segs: number[] = [];
export const lightning = { active: () => FLT >= 0, strike };

function bolt(top: number) {
  segs = [];
  const grow = (x: number, y: number, steps: number, spread: number, depth: number) => {
    for (let s = 0; s < steps && y < top; s++) {
      const nx = x + (r() - 0.5) * spread * 2 + spread * 0.15, ny = y + 3 + r() * 5;
      segs.push(x, y, nx, ny, depth);
      if (depth < 2 && r() < 0.16) grow(nx, ny, 4 + ((r() * 8) | 0), spread * 1.2, depth + 1);
      x = nx; y = ny;
    }
  };
  grow(G.W * (0.12 + 0.76 * r()), 0, 60, 3.5, 0);
}

function strike() {
  if (FLT >= 0) return;
  FLT = 0; boltT = 0;
  bolt(Math.min(G.H, G.oy + 112));
  const close = r() < 0.25;
  thunderAt = close ? 0.4 + r() * 0.5 : 1.5 + r() * 2.5; thunderAmt = close ? 0.9 : 0.55;
}

const env = (t: number) => (t < 0 ? 0 : t < 0.06 ? t / 0.06 : Math.exp(-(t - 0.06) * 6));

export function updateSkyEvents(dt: number) {
  if (S.storm > 0.25) {
    timer -= dt * S.storm;
    if (timer <= 0) { strike(); timer = 5 + r() * 26; }
  }
  if (FLT >= 0) {
    FLT += dt; boltT += dt;
    const k = REDUCED ? 0.4 : 1;
    // two pulses at most (restrike), well under three flashes per second
    const pulse = env(FLT) + (REDUCED ? 0 : env(FLT - 0.24) * 0.6);
    S.flashSky = Math.min(1, pulse) * k; S.flashAll = env(FLT - 0.05) * 0.8 * k;
    if (thunderAt > 0 && FLT >= thunderAt) { audio.rumble(0, thunderAmt, 4); thunderAt = -1; }
    if (FLT > 5) { FLT = -1; S.flashSky = S.flashAll = 0; }
  }
  updateFireworks(dt);
}

function line(x0: number, y0: number, x1: number, y1: number, c: number, wide: boolean) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n || 1), y = y0 + ((y1 - y0) * i) / (n || 1);
    putS(x, y, c);
    if (wide) putS(x + 1, y, RAINB);
  }
}

export function drawLightning() {
  if (boltT < 0) return;
  const show = boltT < 0.1 || (!REDUCED && boltT > 0.22 && boltT < 0.3);
  if (boltT > 0.35) { boltT = -1; return; }
  if (!show) return;
  for (let i = 0; i < segs.length; i += 5) line(segs[i], segs[i + 1], segs[i + 2], segs[i + 3], segs[i + 4] ? RAINB : BOLT, segs[i + 4] === 0);
}

// ---------- fireworks ----------
const NSH = 6, NSP = 520;
const shX = new Float32Array(NSH), shY = new Float32Array(NSH), shV = new Float32Array(NSH), shB = new Float32Array(NSH), shC = new Uint8Array(NSH), shOn = new Uint8Array(NSH);
const spX = new Float32Array(NSP), spY = new Float32Array(NSP), spVX = new Float32Array(NSP), spVY = new Float32Array(NSP), spL = new Float32Array(NSP), spM = new Float32Array(NSP), spC = new Uint8Array(NSP);
const COLORS = [MAG, CYAN, AMB, FWG, WHITE];
let fwTimer = 1;

function updateFireworks(dt: number) {
  const top = Math.min(G.H, G.oy + 100);
  if (S.fireworks) {
    fwTimer -= dt;
    if (fwTimer <= 0) {
      fwTimer = 0.8 + r() * 3;
      for (let i = 0; i < NSH; i++) if (!shOn[i]) {
        shOn[i] = 1; shX[i] = G.W * (0.15 + 0.7 * r()); shY[i] = top; shV[i] = -(70 + r() * 35);
        shB[i] = G.oy * 0.7 + (top - G.oy) * (0.1 + 0.3 * r()); shC[i] = COLORS[(r() * COLORS.length) | 0]; break;
      }
    }
  }
  for (let i = 0; i < NSH; i++) if (shOn[i]) {
    shY[i] += shV[i] * dt; shV[i] += 22 * dt;
    if (shY[i] <= shB[i] || shV[i] > -10) {
      shOn[i] = 0;
      const n = 56, sp = 32 + r() * 18, c2 = r() < 0.4 ? COLORS[(r() * COLORS.length) | 0] : shC[i];
      for (let k = 0, j = 0; j < NSP && k < n; j++) if (spL[j] <= 0) {
        const a = (k / n) * 6.2832 + r() * 0.1, v = sp * (0.85 + r() * 0.3);
        spX[j] = shX[i]; spY[j] = shY[i]; spVX[j] = Math.cos(a) * v; spVY[j] = Math.sin(a) * v;
        spM[j] = spL[j] = 1.4 + r() * 0.9; spC[j] = k % 3 === 0 ? c2 : shC[i]; k++;
      }
      audio.boom(0.6 + r() * 0.6);
    }
  }
  for (let j = 0; j < NSP; j++) if (spL[j] > 0) {
    spL[j] -= dt; spVY[j] += 16 * dt; spVX[j] *= 1 - 1.2 * dt; spVY[j] *= 1 - 1.2 * dt;
    spX[j] += spVX[j] * dt; spY[j] += spVY[j] * dt;
  }
}

export function fireworksStats() {
  let s = 0, p = 0;
  for (let i = 0; i < NSH; i++) s += shOn[i];
  for (let j = 0; j < NSP; j++) if (spL[j] > 0) p++;
  return `shells ${s} sparks ${p}`;
}

export function drawFireworks() {
  for (let i = 0; i < NSH; i++) if (shOn[i]) { putS(shX[i], shY[i], AMB); putS(shX[i], shY[i] + 1, CLOUDD); }
  for (let j = 0; j < NSP; j++) if (spL[j] > 0) {
    const k = spL[j] / spM[j], x = spX[j] | 0, y = spY[j] | 0;
    if (x < 0 || x >= G.W || y < 0 || y >= G.H) continue;
    if (k > 0.35 || ((x + y + (j & 3)) & 3) < k * 8) putS(x, y, k < 0.2 ? AMB : spC[j]);
  }
}
