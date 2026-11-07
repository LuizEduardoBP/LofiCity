/* CAPELINHA DAS PEDRAS (Esperança, PB): the tiny chapel of Nossa Senhora do Perpétuo Socorro
   (1925), a slender white tower with terracotta trim, an arched door, the blue mosaic of the
   Virgin on its side, little balconies, a balustrade and a bulb dome with a cross. It stands on
   the Lajedo do Araçá, the bare rock at the highest point of town, next to the rock pool that
   mirrors it. The town lies below with a radio mast, palms and the Matriz tower far off. */
import { L, Lp, WW, blitLayer, getW, newLayer, put, sx, sy, G } from '../engine/gfx';
import { bay, mulberry32, vnoise } from '../engine/math';
import {
  AMB, AMBD, BFAR, CHURCHL, BMID, BNEAR, BRIGHT, CBEIGE, CBLUE, CHURCH, CHURCHD, GOLD, LEAFGD, LIGHT, MAG, MANTO, REFL, SKIN2,
  STEEL, STONE, STONEL, TERRA, TILEW, VOID, WET, WHITE, WOOD, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { S } from '../sky/state';
import { doyOf } from '../sky/time';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { isNight, wire } from './br-kit';
import type { Scene } from './types';

const HORIZON = 116, STREET = 147, SH = 180 - STREET, CX = 250;
const wr = mulberry32(0xca9e);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const farWins: { x: number; y: number; rank: number }[] = [];
const POOL = { cx: 112, cy: 162, rx: 50, ry: 7 };

/** Top of the rock for a column: a broad hump peaking under the chapel. */
const rockTop = (x: number) => Math.round(124 - 9 * Math.exp(-(((x - CX) / 120) ** 2)) + Math.sin(x * 0.045) * 2.5 + Math.sin(x * 0.13 + 1) * 1.2);

/** Smooth weathered granite: broad bands that follow the slope, a few lighter patches and lichen. */
function rockPixel(x: number, y: number): number {
  const band = vnoise(7, y * 0.16 + Math.sin(x * 0.012) * 3) * 0.55 + vnoise(19, x * 0.025 + y * 0.05) * 0.45;
  const n = band + (bay(x, y) - 0.5) * 0.12;
  if (wr() < 0.004) return wr() < 0.6 ? LEAFGD : CBEIGE;
  return n < 0.3 ? BNEAR : n < 0.46 ? BMID : n < 0.7 ? STONE : n < 0.8 ? STEEL : STONEL;
}

function buildFar() {
  // town below the lajedo: low houses, palms, the Matriz tower far away
  for (let x = -4; x < WW;) {
    const w = 8 + ((wr() * 14) | 0), top = 106 + ((wr() * 8) | 0);
    L(far, x, top, w, 126 - top, BFAR);
    for (let wy = top + 2; wy < 118; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 3) if (wr() < 0.18) farWins.push({ x: wx, y: wy, rank: wr() });
    x += w + ((wr() * 3) | 0);
  }
  for (const px of [40, 64, 330, 352, 420]) { L(far, px, 98, 1, 14, BFAR); for (let i = -4; i <= 4; i++) Lp(far, px + i, 98 + Math.abs(i) / 2, LEAFGD); }
  const tx = 404; L(far, tx, 88, 6, 24, CHURCH); L(far, tx + 5, 88, 1, 24, CHURCHD); for (let y = 0; y < 8; y++) L(far, tx + 3 - Math.round(3 * (1 - y / 8)), 87 - y, Math.max(1, Math.round(6 * (1 - y / 8))), 1, TERRA);
  // radio mast and a utility pole on the rock
  for (let y = 36; y < 120; y++) { Lp(far, 186 - Math.round((y - 36) / 40), y, STEEL); Lp(far, 190 + Math.round((y - 36) / 40), y, STEEL); if (y % 6 === 0) L(far, 186, y, 5, 1, STEEL); }
  L(mid, 150, 70, 2, 54, STONEL); L(mid, 146, 73, 10, 1, STONE);
  wire(mid, 151, 72, -10, 84, 6); wire(mid, 151, 75, -10, 88, 6);
}

function arch(x: number, y: number, w: number, h: number, c: number) {
  const r = w / 2;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const dy = j - r; if (j < r && (i + 0.5 - r) ** 2 + dy * dy > r * r) continue; Lp(mid, x + i, y + j, c); }
}

function buildChapel() {
  const base = rockTop(CX) + 1;
  // plinth on the rock
  L(mid, CX - 15, base - 4, 32, 5, TILEW); L(mid, CX + 11, base - 4, 6, 5, STONEL);
  // lower storey: front face + shaded side face
  const y1 = base - 4, y0 = y1 - 40;
  L(mid, CX - 11, y0, 20, 40, TILEW); L(mid, CX + 9, y0, 7, 40, STONEL);
  L(mid, CX + 8, y0, 1, 40, CHURCHD); // corner where the lit face meets the shaded one
  L(mid, CX - 12, y0 - 2, 29, 2, TERRA); L(mid, CX - 12, y0 + 2, 29, 1, TERRA); // cornice bands
  arch(CX - 5, y1 - 22, 9, 22, TERRA); arch(CX - 4, y1 - 21, 7, 21, WOOD); L(mid, CX - 4, y1 - 12, 7, 1, BNEAR);
  // side niche: blue mosaic of Our Lady of Perpetual Help
  arch(CX + 10, y1 - 22, 6, 18, TERRA); arch(CX + 11, y1 - 21, 4, 17, MANTO);
  Lp(mid, CX + 12, y1 - 16, SKIN2); Lp(mid, CX + 13, y1 - 16, SKIN2); L(mid, CX + 11, y1 - 14, 4, 1, GOLD); Lp(mid, CX + 12, y1 - 10, GOLD); Lp(mid, CX + 13, y1 - 18, GOLD);
  // upper storey, slightly narrower
  const u1 = y0 - 2, u0 = u1 - 24;
  L(mid, CX - 9, u0, 17, 24, TILEW); L(mid, CX + 8, u0, 6, 24, STONEL);
  arch(CX - 3, u0 + 5, 6, 12, TERRA); arch(CX - 2, u0 + 6, 4, 10, BNEAR);
  L(mid, CX - 5, u0 + 16, 10, 1, TERRA); for (let x = CX - 5; x < CX + 5; x += 2) Lp(mid, x, u0 + 17, TERRA); L(mid, CX - 5, u0 + 18, 10, 1, TERRA); // balcony
  arch(CX + 9, u0 + 6, 4, 10, TERRA); arch(CX + 10, u0 + 7, 2, 8, BNEAR);
  // top cornice and balustrade
  L(mid, CX - 11, u0 - 2, 27, 2, TERRA);
  L(mid, CX - 10, u0 - 8, 25, 1, TERRA); for (let x = CX - 10; x < CX + 15; x += 2) L(mid, x, u0 - 7, 1, 5, TILEW);
  for (const x of [CX - 10, CX + 13]) L(mid, x, u0 - 10, 2, 8, TILEW);
  // drum, bulb dome, ball and cross
  L(mid, CX - 4, u0 - 12, 10, 4, TILEW); L(mid, CX - 4, u0 - 12, 10, 1, TERRA);
  for (let j = 0; j < 12; j++) { const t = j / 11, half = Math.round(5.5 * Math.sin(Math.PI * (0.15 + 0.85 * t)) * (t < 0.3 ? 0.6 + t : 1)); L(mid, CX + 1 - half, u0 - 24 + j, half * 2, 1, j === 11 ? TERRA : TILEW); }
  L(mid, CX, u0 - 24, 2, 3, TERRA); L(mid, CX - 1, u0 - 28, 4, 4, TILEW);
  L(mid, CX, u0 - 37, 2, 9, STEEL); L(mid, CX - 3, u0 - 34, 8, 2, STEEL);
  // small white marker post beside the chapel
  L(mid, CX + 34, rockTop(CX + 34) - 12, 6, 13, TILEW); L(mid, CX + 39, rockTop(CX + 34) - 12, 1, 13, STONEL);
  return { base, top: u0 - 37 };
}

let chapel = { base: 0, top: 0 };
function buildRock() {
  for (let x = 0; x < WW; x++) for (let y = rockTop(x); y < STREET; y++) Lp(front, x, y, y === rockTop(x) ? (wr() < 0.5 ? STONEL : STONE) : rockPixel(x, y));
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) street.base[d * WW + x] = rockPixel(x, STREET + d);
  // cracks
  for (let k = 0; k < 14; k++) {
    let x = wr() * WW, y = 126 + wr() * 50;
    for (let s = 0; s < 40; s++) {
      x += 1; y += (wr() - 0.5) * 1.6;
      const yi = Math.round(y);
      if (yi < STREET) { if (yi > rockTop(Math.round(x))) Lp(front, Math.round(x), yi, VOID); }
      else if (yi < 180 && x < WW) street.base[(yi - STREET) * WW + Math.round(x)] = BNEAR;
    }
  }
  // shallow hollows in the rock fill up when it rains
  for (let p = 0; p < 5; p++) {
    const cx = wr() * WW, cy = 4 + wr() * (SH - 8), rx = 6 + wr() * 14, ry = 1.5 + wr() * 1.5;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic ----------
/** The rock pool (Tanque do Araçá) mirrors the sky and the chapel, with a slow ripple. */
function pool() {
  const { buf, W } = G, t = S.ms / 1000, top = POOL.cy - POOL.ry;
  for (let y = POOL.cy - POOL.ry; y <= POOL.cy + POOL.ry; y++) for (let x = POOL.cx - POOL.rx; x <= POOL.cx + POOL.rx; x++) {
    const a = (x - POOL.cx) / POOL.rx, b = (y - POOL.cy) / POOL.ry, e = a * a + b * b;
    if (e > 1) continue;
    const X = sx(x), Y = sy(y);
    if (X < 0 || X >= W || Y < 0 || Y >= G.H) continue;
    if (e > 0.8) { buf[Y * W + X] = e > 0.92 ? STONEL : BNEAR; continue; }
    const srcY = sy(Math.round(top - (y - top) * 3.2 - 3)), off = Math.round(Math.sin(y * 1.3 + t * 1.7) * (0.6 + Math.abs(S.wind) * 2));
    const sX = Math.min(W - 1, Math.max(0, X + off)), src = srcY >= 0 ? buf[srcY * W + sX] : VOID;
    buf[Y * W + X] = BRIGHT[src] ? REFL[src] : bay(X, Y) < 0.55 ? src : WET;
  }
}

function lights() {
  const n = isNight(), t = S.ms / 1000;
  for (const f of farWins) put(f.x, f.y, n && f.rank < 0.5 ? (f.rank < 0.08 ? CBLUE : WWARM) : BFAR);
  if (((t * 0.8) | 0) % 2 === 0) put(188, 35, MAG); // mast beacon
  if (!n) return;
  // warm floodlight from the foot of the chapel: the whole tower takes a warm cast, brighter low down
  for (let y = chapel.top; y < chapel.base; y++) {
    const k = ((y - chapel.top) / (chapel.base - chapel.top)) ** 1.4;
    for (let x = CX - 13; x < CX + 18; x++) {
      const c = getW(x, y);
      if (c !== TILEW && c !== STONEL && c !== TERRA) continue;
      const b = bay(sx(x), sy(y));
      if (c === TERRA) put(x, y, b < k * 0.6 ? AMBD : TERRA);
      else if (c === STONEL) put(x, y, b < k * 0.5 ? CHURCH : CHURCHD);
      else put(x, y, b < k * 0.18 ? LIGHT : b < 0.35 + k * 0.6 ? CHURCHL : CHURCH);
    }
  }
  // candles left at the door
  const candles = festa() ? 9 : 4;
  for (let i = 0; i < candles; i++) {
    const x = CX - 9 + i * 2 + (i > 3 ? 4 : 0), y = chapel.base - 5;
    put(x, y, WHITE); if (Math.sin(t * 9 + i * 2.1) > -0.4) put(x, y - 1, Math.sin(t * 13 + i) > 0.3 ? LIGHT : AMB);
  }
}

/** Feast of Perpetual Help (27 June) and the chapel's anniversary on New Year's Day bring visitors. */
const festa = () => S.cal.doy === doyOf(5, 27) || S.cal.doy === 0;

function update(dt: number) {
  const h = S.cal.hour, sunday = S.cal.weekday === 0;
  const k = festa() && h >= 16 && h < 21 ? 2 : (sunday ? 0.8 : 0.4) * (h >= 6 && h < 19 ? 1 : 0.3);
  tickSpawns(dt, k); updatePeople(dt);
}

const FOG = [{ y: 112, h: 10, sp: 0.4 }, { y: 136, h: 6, sp: -0.3 }];
function render() {
  drawSky(HORIZON); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid); lights(); drawFarPrecip();
  blitLayer(front);
  drawPeople();
  drawStreet(street); pool(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const capelinha: Scene = {
  id: 'capelinha',
  name: 'Capelinha das Pedras',
  build() {
    if (!built) { buildFar(); chapel = buildChapel(); buildRock(); built = true; }
    setLanes([{ y: 141 }, { y: 145 }]);
    configure({ roofs: [{ x0: CX - 12, x1: CX + 17, y: chapel.top + 30 }], tips: [], lamps: [], ground0: 138, horizon: HORIZON });
    for (let i = 0; i < 90; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}  festa ${festa()}`; },
};

