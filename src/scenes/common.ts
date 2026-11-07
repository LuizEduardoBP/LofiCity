/* Drawing passes shared by every scene: sky, sun and moon, clouds, searchlights,
   wet street with reflections, snow on surfaces, and fog bands. */
import { G, WW, put, putS, sy } from '../engine/gfx';
import { BAY, bay, mulberry32 } from '../engine/math';
import {
  BRIGHT, CLOUD, CLOUDD, FOG, FOGOK, GLOWI, GLOWO, GROUND, HAZE, MOON, REFL, SKY1, SKYIDX, SNOW, SNOWS, SUN, WDIM,
} from '../engine/palette';
import { S } from '../sky/state';

const rnd = mulberry32(0xc10d);
const STARS = Array.from({ length: 140 },() => ({ u: rnd(), v: rnd(), p: rnd() * 6.28 }));

// ---------- clouds: one tileable fbm field, scrolled and thresholded ----------
const CNW = 512, CNH = 64;
const CN = new Float32Array(CNW * CNH);
(function buildClouds() {
  const r = mulberry32(77);
  const lattice = (cell: number) => {
    const cw = CNW / cell, ch = Math.ceil(CNH / cell) + 2, g = new Float32Array(cw * ch);
    for (let i = 0; i < g.length; i++) g[i] = r();
    return (x: number, y: number) => {
      const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
      const at = (a: number, b: number) => g[b * cw + (((a % cw) + cw) % cw)];
      const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * u, bot = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * u;
      return top + (bot - top) * v;
    };
  };
  const oct = [lattice(64), lattice(32), lattice(16), lattice(8)], amp = [0.5, 0.26, 0.15, 0.09];
  for (let y = 0; y < CNH; y++)
    for (let x = 0; x < CNW; x++) {
      let n = 0;
      for (let o = 0; o < 4; o++) n += oct[o](x, y * 1.6) * amp[o];
      CN[y * CNW + x] = n;
    }
})();
let cloudX = 0;
export function updateSky(dt: number) { cloudX += (1.5 + S.wind * 30) * dt; }

/** Screen row where the sky band ends for a scene horizon (world y). */
export const skyBottom = (horizon: number) => Math.min(G.H, sy(horizon + 12));

export function drawSky(horizon: number) {
  const { W, buf } = G, top = skyBottom(horizon);
  buf.fill(HAZE, top * W); // never leave stale pixels below the sky band
  for (let y = 0; y < top; y++) {
    const v = y / top, o = y * W;
    for (let x = 0; x < W; x++) {
      let k = (v * v * 0.7 + v * 0.5) * 4.4 + BAY[((y & 3) << 2) | (x & 3)] - 0.5;
      k = k < 0 ? 0 : k > 4 ? 4 : k | 0;
      buf[o + x] = SKY1 + k;
    }
  }
  drawGlowAndStars(top);
  drawSun(top);
  drawMoon(top);
  drawClouds(top);
}

/** Sun/moon screen position from hours off transit and elevation. */
function bodyPos(hoursOff: number, elev: number, top: number) {
  return { x: G.W / 2 + (hoursOff / 7) * G.W * 0.46, y: top - 8 - (elev / 55) * top * 0.92 };
}

function glow(cx: number, cy: number, R: number, k0: number, top: number) {
  const { W, buf } = G;
  const x0 = Math.max(0, Math.floor(cx - R * 1.8)), x1 = Math.min(W, Math.ceil(cx + R * 1.8));
  const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(top, Math.ceil(cy + R));
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const dx = (x - cx) / (R * 1.8), dy = (y - cy) / R, d = Math.sqrt(dx * dx + dy * dy);
      if (d >= 1) continue;
      const i = y * W + x;
      if (!SKYIDX[buf[i]]) continue;
      const k = (1 - d) * (1 - d) * k0, b = bay(x, y);
      if (b < k * 0.45) buf[i] = GLOWI; else if (b < k) buf[i] = GLOWO;
    }
}

function drawGlowAndStars(top: number) {
  const e = S.sunElev, c = 1 - S.cloud * 0.85;
  if (e > -10) {
    const p = bodyPos(S.cal.hour - 12, Math.max(e, -6), top);
    glow(p.x, Math.min(p.y, top - 2), 28 + 46 * S.golden + 18 * S.twilight, (0.9 * S.golden + 0.3 * S.dayK + 0.6 * S.twilight) * c, top);
  }
  const vis = (1 - S.dayK / 0.35) * (1 - S.cloud / 0.7);
  if (vis > 0) {
    const t = S.ms / 1000;
    for (const s of STARS) {
      const x = (s.u * G.W) | 0, y = (s.v * top * 0.7) | 0;
      if (bay(x, y) < vis && Math.sin(t * 0.7 + s.p * 9) > -0.3 && SKYIDX[G.buf[y * G.W + x]]) putS(x, y, s.p < 1 ? HAZE : WDIM);
    }
  }
}

function drawSun(top: number) {
  if (S.sunElev < -3) return;
  const p = bodyPos(S.cal.hour - 12, S.sunElev, top), r = 5;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + 1 && p.y + dy < top) putS(p.x + dx, p.y + dy, SUN);
}

function drawMoon(top: number) {
  if (S.moonElev < -2) return;
  const ph = S.moonPhase;
  if (ph < 0.03 || ph > 0.97) return;
  const p = bodyPos(S.moonHA, S.moonElev, top), r = 4;
  if (S.dayK < 0.3) glow(p.x, p.y, 16, 0.5 * (1 - S.dayK / 0.3) * (1 - S.cloud) * Math.sin(ph * Math.PI), top);
  const cth = Math.cos(2 * Math.PI * ph);
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.sqrt(Math.max(0, r * r - dy * dy));
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + 1) continue;
      const xn = half > 0 ? dx / half : 0;
      const lit = ph < 0.5 ? xn > cth : xn < -cth;
      if (lit && p.y + dy < top) putS(p.x + dx, p.y + dy, MOON);
    }
  }
}

function drawClouds(top: number) {
  if (S.cloud < 0.12) return;
  const { W, buf, camX } = G, cb = top - 2, t = 1.0 - S.cloud * 0.64;
  const rows = Math.min(CNH - 6, 34 + (G.oy >> 3));
  for (let y = 0; y < cb; y++) {
    const ny = Math.min(CNH - 6, Math.floor((y / cb) * rows)), o = y * W;
    for (let x = 0; x < W; x++) {
      const cx = ((x * 0.5 + camX * 0.3 + cloudX) | 0) & (CNW - 1);
      const n = CN[ny * CNW + cx];
      if (n < t) continue;
      const edge = (n - t) / 0.05;
      if (edge < 1 && BAY[((y & 3) << 2) | (x & 3)] > edge) continue;
      buf[o + x] = CN[(ny + 4) * CNW + cx] < t + 0.04 ? CLOUDD : CLOUD;
    }
  }
}

export function drawSearchlights(origins: number[], horizon: number) {
  const k = (1 - S.deep) * (S.neonOn ? 1 : 0) * (1 - S.cloud * 0.3);
  if (k < 0.05) return;
  const t = S.ms / 1000;
  origins.forEach((ox, b) => {
    const a = (b % 2 ? 0.35 : -0.3) + Math.sin(t * 0.05 + b * 2.3) * 0.35, dx = Math.sin(a), dy = -Math.cos(a);
    for (let s = 4; s < 95 + G.oy * 0.6; s++) {
      const cx = ox + dx * s, cy = horizon + dy * s, w = 1 + s * 0.06;
      for (let j = -w; j <= w; j++) {
        const x = Math.round(cx + j) - G.camX, y = Math.round(cy) + G.oy;
        if (x < 0 || x >= G.W || y < 0 || y >= G.H) continue;
        const i = y * G.W + x, c = G.buf[i];
        if (SKYIDX[c] && c <= HAZE && bay(x, y) < 0.28 * k * (1 - s / 130)) G.buf[i] = Math.min(HAZE, c + 1);
      }
    }
  });
}

// ---------- street ----------
export interface Street { y0: number; base: Uint8Array; pud: Uint8Array; jit: Int8Array; }

/** Wet street mirrors the scene above it; dry street is just asphalt; snow covers both. */
export function drawStreet(st: Street) {
  const { W, H, buf, camX, oy } = G, y0 = st.y0 + oy, SH = 180 - st.y0, t = S.ms / 1000;
  const wet = S.wet, amp = (0.5 + S.rain * 1.4) * Math.min(1, wet * 1.5), pudOn = wet > 0.25;
  const glare = Math.min(1, wet * 1.4) * (1 - 0.85 * S.dayK); // daylight washes out reflected lights
  for (let y = Math.max(0, y0); y < H; y++) {
    const d = y - y0, src = y0 - 2 - ((d * 2.4) | 0), fade = 1 - d / (SH + 4), o = y * W;
    const off = Math.round(Math.sin(y * 0.83 + t * 2.3) * amp + Math.sin(y * 2.1 - t * 1.3) * amp * 0.4) + st.jit[y];
    for (let x = 0; x < W; x++) {
      const wx = x + camX;
      let c = st.base[d * WW + wx];
      if (wet > 0.03 && src >= 0) {
        let sxx = x + off; sxx = sxx < 0 ? 0 : sxx >= W ? W - 1 : sxx;
        let s = buf[src * W + sxx];
        const s2 = buf[(src + 1) * W + sxx];
        if (BRIGHT[s2] && !BRIGHT[s]) s = s2;
        const b = BAY[((y & 3) << 2) | (x & 3)], pud = pudOn && st.pud[d * WW + wx], f = pud ? 1 : fade;
        if (BRIGHT[s] && !pud) { if (b < (f * 0.9 + 0.08) * glare) c = REFL[s]; }
        else if (pud && b < 0.5) c = REFL[s];
      }
      buf[o + x] = c;
    }
  }
  const cov = S.snowCover;
  if (cov > 0.01)
    for (let y = Math.max(0, y0); y < H; y++) {
      const d = y - y0, o = y * W, track = (d >= 7 && d <= 9) || (d >= 22 && d <= 24);
      for (let x = 0; x < W; x++) {
        const b = BAY[((y & 3) << 2) | (x & 3)];
        if (track) { if (cov > 0.45 && b < (cov - 0.45) * 1.6) buf[o + x] = SNOWS; }
        else if (b < cov * 1.15) buf[o + x] = (x * 7 + y * 13) % 23 === 0 ? SNOWS : SNOW;
      }
    }
}

/** Snow on sidewalks and other flat ground between two world rows. */
export function groundSnow(wy0: number, wy1: number) {
  const cov = S.snowCover;
  if (cov < 0.01) return;
  const { W, H, buf } = G;
  for (let y = Math.max(0, sy(wy0)); y < Math.min(H, sy(wy1)); y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (GROUND[buf[i]] && bay(x, y) < cov * 1.1) buf[i] = SNOW;
    }
}

/** Snow caps on top edges, built with snowCaps() from a static layer. */
export function drawSnowCaps(caps: Float32Array) {
  const cov = S.snowCover;
  if (cov < 0.02) return;
  for (let i = 0; i < caps.length; i += 3) {
    const r = caps[i + 2];
    if (r >= cov) continue;
    put(caps[i], caps[i + 1], SNOW);
    if (r < cov - 0.35) put(caps[i], caps[i + 1] - 1, SNOW);
    if (r < cov - 0.75) put(caps[i], caps[i + 1] - 2, SNOWS);
  }
}

export function drawFog(bands: { y: number; h: number; sp: number }[]) {
  const { W, H, buf } = G, t = S.ms / 1000;
  bands.forEach((bd, k) => {
    const yc = sy(Math.round(bd.y + Math.sin(t / 97 + k * 2) * 4)), sh = (t * bd.sp) | 0;
    for (let y = yc - bd.h; y <= yc + bd.h; y++) {
      if (y < 0 || y >= H) continue;
      const dens = S.fog * 0.45 * (1 - Math.abs(y - yc) / bd.h), o = y * W;
      for (let x = 0; x < W; x++) {
        const i = o + x;
        if (FOGOK[buf[i]] && BAY[((y & 3) << 2) | ((x + sh) & 3)] < dens) buf[i] = FOG;
      }
    }
  });
}
