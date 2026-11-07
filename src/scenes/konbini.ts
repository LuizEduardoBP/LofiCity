/* KONBINI STREET: a quiet residential street with a 24h convenience store, wooden
   houses and a small apartment block, utility poles and sagging wires with crows,
   laundry on balconies, a crosswalk signal, vending machines, and mountains that
   turn white in winter. Low rooflines leave lots of sky for sunsets and fireworks. */
import { L, Lp, WW, blitLayer, getW, newLayer, put, rect, snowCaps, sx, sy } from '../engine/gfx';
import { bay, mulberry32 } from '../engine/math';
import {
  AMB, ASPH, BFAR, BMID, BNEAR, CBEIGE, CBLUE, CGREEN, CNAVY, CRED, CYAN, CYAND, CYELL, FARB, FWG, HALO, HALOOK,
  LIGHT, MAG, MAGD, SNOW, STEEL, STONE, STONEL, VOID, WCOOL, WDIM, WET, WHITE, WOOD, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { type Tree, drawTree, makeTree } from '../actors/trees';
import { S } from '../sky/state';
import { doyOf, inDoy } from '../sky/time';
import { drawFog, drawSky, drawSnowCaps, drawStreet, groundSnow, type Street } from './common';
import { director } from './director';
import type { Scene } from './types';

const HORIZON = 100, STREET = 147, SH = 180 - STREET;
const wr = mulberry32(0xc0b1), er = mulberry32(0xc0b2);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
interface Win { x: number; y: number; w: number; h: number; c: number; rank: number }
const wins: Win[] = [], farWins: { x: number; y: number; c: number; rank: number }[] = [];
const ridge = new Int16Array(WW);
const laundry: { x: number; y: number; c: number; ph: number }[] = [];
const corridor: [number, number][] = [];
let midCaps = new Float32Array(0), frontCaps = new Float32Array(0);
let trees: Tree[] = [];
let clock = 0;
const POLES = [40, 168, 316, 452];
const wireY = (x: number, k: number) => {
  for (let i = 0; i < POLES.length - 1; i++) if (x >= POLES[i] && x <= POLES[i + 1]) {
    const t = (x - POLES[i]) / (POLES[i + 1] - POLES[i]);
    return 44 + k * 5 + Math.sin(t * Math.PI) * (5 + k);
  }
  return 44 + k * 5;
};

function buildFar() {
  // mountain ridge
  for (let x = 0; x < WW; x++) {
    const y = 66 + Math.sin(x * 0.012 + 1) * 12 + Math.sin(x * 0.031) * 6 + Math.sin(x * 0.083) * 2;
    ridge[x] = Math.round(y);
    L(far, x, ridge[x], 1, 140 - ridge[x], FARB);
  }
  // distant lattice tower
  for (let y = 18; y < 96; y++) {
    const half = 1 + Math.round((y - 18) * 0.09);
    Lp(far, 404 - half, y, BFAR); Lp(far, 404 + half, y, BFAR);
    if (y % 6 === 0) for (let x = 404 - half; x <= 404 + half; x++) Lp(far, x, y, BFAR);
  }
  L(far, 400, 46, 9, 3, BFAR); L(far, 403, 10, 2, 8, BFAR);
  // low distant town
  for (let x = -4; x < WW;) {
    const w = 10 + ((wr() * 20) | 0), top = 80 + ((wr() * 16) | 0);
    L(far, x, top, w, 140 - top, BFAR);
    for (let wy = top + 3; wy < HORIZON + 8; wy += 3) for (let wx = x + 2; wx < x + w - 1; wx += 3)
      if (wr() < 0.2) farWins.push({ x: wx, y: wy, c: wr() < 0.7 ? WWARM : WCOOL, rank: wr() });
    x += w + 2;
  }
}

function roof(x: number, w: number, y: number, c: number) {
  for (let j = 0; j < 7; j++) L(mid, x - 4 + j, y - 7 + j, w + 8 - j * 2, 1, j === 6 ? BNEAR : c);
  L(mid, x - 5, y - 1, w + 10, 1, BNEAR);
}

function house(x: number, w: number, floors: number, wall: number, rc: number) {
  const top = 140 - floors * 18;
  L(mid, x, top, w, 140 - top, wall);
  roof(x, w, top, rc);
  for (let f = 0; f < floors; f++) {
    const fy = top + 5 + f * 18;
    for (let wx = x + 5; wx < x + w - 8; wx += 12) wins.push({ x: wx, y: fy, w: 7, h: 6, c: wr() < 0.8 ? WWARM : WCOOL, rank: wr() });
    if (f === 0 && floors > 1) {
      L(mid, x + 2, fy + 10, w - 4, 1, STEEL);
      for (let bx = x + 2; bx < x + w - 2; bx += 3) Lp(mid, bx, fy + 11, STEEL);
      for (let k = 0; k < 5; k++) laundry.push({ x: x + 6 + ((wr() * (w - 12)) | 0), y: fy + 11, c: [WHITE, CRED, CBLUE, CYELL, CBEIGE, WHITE][(wr() * 6) | 0], ph: wr() * 6 });
    }
  }
  L(mid, x + w - 10, 126, 6, 14, WOOD); Lp(mid, x + w - 6, 133, AMB);
  L(mid, x + 2, 120, 5, 4, STEEL); // AC unit
}

function buildMid() {
  house(0, 52, 2, CBEIGE, BMID);
  house(56, 48, 2, STONEL, CNAVY);
  house(108, 52, 1, WOOD, BMID);
  // concrete block wall in the gap
  L(mid, 160, 124, 26, 16, STONEL); L(mid, 160, 123, 26, 1, STEEL);
  for (let y = 127; y < 140; y += 4) for (let x = 160 + ((y >> 2) & 1) * 3; x < 186; x += 6) Lp(mid, x, y, STONE);
  // konbini block (flat roof)
  L(mid, 186, 94, 112, 46, STONEL); L(mid, 186, 94, 112, 2, STEEL);
  L(mid, 262, 86, 14, 8, STEEL); L(mid, 210, 88, 10, 6, STEEL);
  // apartment block with outdoor corridors
  L(mid, 326, 70, 90, 70, STONEL); L(mid, 326, 70, 90, 2, STEEL);
  for (let f = 0; f < 4; f++) {
    const fy = 74 + f * 17;
    L(mid, 326, fy + 12, 90, 2, STEEL);
    for (let dx = 332; dx < 410; dx += 13) { L(mid, dx, fy + 3, 6, 9, BMID); corridor.push([dx + 3, fy + 1]); }
    for (let wx = 335; wx < 410; wx += 13) wins.push({ x: wx + 5, y: fy + 4, w: 3, h: 4, c: WWARM, rank: wr() });
  }
  house(420, 60, 2, CBEIGE, WOOD);
}

function buildFront() {
  L(front, 0, 140, WW, 6, STONE); L(front, 0, 140, WW, 1, STONEL); L(front, 0, 146, WW, 1, STONEL);
  for (let x = 9; x < WW; x += 18) L(front, x, 141, 1, 5, ASPH);
  // utility poles
  for (const px of POLES) {
    L(front, px, 38, 3, 104, BMID); L(front, px - 6, 42, 15, 1, BMID); L(front, px - 4, 47, 11, 1, BMID);
    L(front, px + 3, 56, 4, 7, STEEL); Lp(front, px + 4, 55, STEEL);
  }
  // street lamps on two poles
  for (const px of [168, 452]) { L(front, px + 3, 62, 8, 1, BMID); L(front, px + 8, 63, 4, 2, BMID); }
  // vending machines + post box
  for (const vx of [300, 313]) { L(front, vx, 110, 12, 30, vx === 300 ? CRED : WHITE); L(front, vx + 2, 128, 8, 4, BNEAR); L(front, vx + 3, 134, 6, 2, VOID); }
  L(front, 160, 126, 6, 14, CRED); L(front, 159, 125, 8, 2, CRED); L(front, 161, 129, 4, 1, VOID);
  // parked bicycles in front of the konbini
  for (let b = 0; b < 4; b++) {
    const bx = 192 + b * 9;
    for (let a = 0; a < 10; a++) { const t = (a / 10) * 6.28; Lp(front, Math.round(bx + Math.cos(t) * 2), Math.round(137 + Math.sin(t) * 2), VOID); Lp(front, Math.round(bx + 6 + Math.cos(t) * 2), Math.round(137 + Math.sin(t) * 2), VOID); }
    L(front, bx + 1, 134, 5, 1, STEEL); Lp(front, bx + 5, 133, STEEL);
  }
  // crosswalk signal pole
  L(front, 346, 104, 2, 38, STEEL); L(front, 343, 100, 8, 12, VOID);
}

function buildStreet() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) {
    let c = wr() < 0.1 ? WET : ASPH;
    if (d === 0) c = BNEAR;
    if (d === 2 && (x < 330 || x > 372)) c = STONEL; // side line
    if (x >= 330 && x <= 372 && d > 2 && ((d >> 2) & 1) === 0) c = STONEL; // crosswalk
    street.base[d * WW + x] = c;
  }
  for (let p = 0; p < 7; p++) {
    const cx = wr() * WW, cy = 3 + wr() * (SH - 6), rx = 10 + wr() * 24, ry = 2 + wr() * 3;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic passes ----------
function drawMountainSnow() {
  const doy = S.cal.doy;
  const k = inDoy(doy, doyOf(10, 20), doyOf(3, 25)) ? (inDoy(doy, doyOf(11, 10), doyOf(2, 20)) ? 9 : 4) : 0;
  const kk = k + Math.round(S.snowCover * 6);
  if (!kk) return;
  for (let x = 0; x < WW; x++) {
    const depth = kk - Math.max(0, ridge[x] - 54) * 0.6;
    for (let j = 0; j < depth; j++) if (bay(x, ridge[x] + j) < 1 - j / (depth + 1)) put(x, ridge[x] + j, SNOW);
  }
}

function drawWindows() {
  const h = S.cal.hour, lit = S.dayK > 0.5 ? 1 : h >= 17.5 && h < 23 ? 0.7 : h >= 23 || h < 1 ? 0.35 : h < 5 ? 0.08 : 0.4;
  for (const f of farWins) put(f.x, f.y, f.rank < lit ? f.c : BFAR);
  for (const w of wins) rect(w.x, w.y, w.w, w.h, w.rank < lit ? w.c : WDIM);
  if (S.dayK < 0.5) for (const [cx, cy] of corridor) { put(cx, cy, LIGHT); put(cx - 1, cy + 1, HALO); put(cx + 1, cy + 1, HALO); }
}

function drawLaundry() {
  if (S.dayK < 0.5 || S.rain + S.snow > 0.05 || S.cal.hour < 8 || S.cal.hour > 17) return;
  for (const l of laundry) {
    const sway = Math.round(Math.sin(clock * 2 + l.ph) * S.wind * 8);
    rect(l.x, l.y, 3, 3, l.c); put(l.x + sway, l.y + 3, l.c); put(l.x + 1 + sway, l.y + 3, l.c);
  }
}

function drawKonbini() {
  const x0 = 192, x1 = 294, t = clock;
  // sign band (always lit, 24h)
  rect(186, 97, 112, 3, WCOOL); rect(186, 100, 112, 3, WHITE); rect(186, 103, 112, 3, FWG);
  // glass front with bright interior
  for (let y = 108; y < 139; y++) for (let x = x0; x < x1; x++) put(x, y, bay(sx(x), sy(y)) < 0.85 ? WHITE : LIGHT);
  for (const sy0 of [115, 123, 131]) {
    rect(x0, sy0 + 2, x1 - x0, 1, STEEL);
    for (let x = x0 + 2; x < x1 - 2; x += 2) put(x, sy0 + 1, [CRED, CYELL, CBLUE, CGREEN, MAGD, AMB][(x * 7 + sy0) % 6]);
  }
  rect(x0 + 4, 118, 18, 6, BMID); rect(x0 + 10, 112, 3, 6, VOID); rect(x0 + 10, 110, 3, 2, CGREEN);
  for (let k = 0; k < 2; k++) {
    const px = x0 + 40 + ((Math.sin(t * 0.13 + k * 2) * 0.5 + 0.5) * 40) | 0;
    rect(px, 120, 3, 12, VOID); rect(px, 117, 3, 3, VOID);
  }
  for (let x = x0; x <= x1; x += 25) rect(x, 108, 1, 31, STEEL);
  rect(x0, 108, x1 - x0, 1, STEEL);
  // spill on the sidewalk
  for (let y = 140; y < 147; y++) for (let x = x0 - 6; x < x1 + 6; x++) {
    const k = 0.4 * (1 - (y - 140) / 8);
    if (HALOOK[getW(x, y)] && bay(sx(x), sy(y)) < k) put(x, y, bay(sx(x), sy(y)) < k * 0.35 ? WHITE : STONEL);
  }
}

function drawVending() {
  for (const vx of [300, 313]) {
    for (let y = 112; y < 126; y++) for (let x = vx + 1; x < vx + 11; x++) {
      const c = (x - vx) % 3 === 1 && (y - 112) % 4 === 1 ? [CRED, CYAN, AMB, FWG][((x + y) >> 2) % 4] : S.dayK < 0.5 ? WCOOL : CYAND;
      put(x, y, c);
    }
  }
}

function drawSignal() {
  const ph = clock % 30, walk = ph < 12 || (ph < 15 && (clock * 3) % 1 < 0.5);
  rect(344, 101, 6, 4, ph < 15 ? BNEAR : MAG); rect(344, 106, 6, 4, walk ? FWG : BNEAR);
  if (ph >= 15) { put(346, 102, VOID); put(347, 102, VOID); }
}

function drawWires() {
  for (let k = 0; k < 3; k++) for (let x = POLES[0]; x <= POLES[POLES.length - 1]; x++) put(x, Math.round(wireY(x, k)), VOID);
  for (const px of [168, 452]) {
    const on = S.lampOn;
    for (let x = px + 8; x < px + 12; x++) put(x, 65, on ? WHITE : BNEAR);
    if (!on) continue;
    for (let y = 66; y < 140; y++) {
      const w = 1 + (y - 66) * 0.28, k = 0.07 * (1 - (y - 66) / 80);
      for (let x = Math.round(px + 10 - w); x <= Math.round(px + 10 + w); x++) { const c = getW(x, y); if (c !== 255 && HALOOK[c] && bay(sx(x), sy(y) + ((clock * 8) | 0)) < k) put(x, y, HALO); }
    }
    for (let x = px - 8; x < px + 28; x++) for (let y = 140; y < 146; y++) {
      const k = 0.35 * (1 - Math.abs(x - px - 10) / 18), c = getW(x, y);
      if (c !== 255 && HALOOK[c] && bay(sx(x), sy(y)) < k) put(x, y, bay(sx(x), sy(y)) < k * 0.4 ? HALO : STONEL);
    }
  }
}

// crows on the wires
const BIRDS = Array.from({ length: 6 }, (_, i) => ({ x: 60 + i * 61 + ((wr() * 20) | 0), k: (wr() * 3) | 0, fly: -1, fx: 0, fy: 0 }));
function updateBirds(dt: number) {
  for (const b of BIRDS) if (b.fly >= 0) {
    b.fly += dt; b.fx += 30 * dt; b.fy -= 18 * dt;
    if (b.fly > 40) b.fly = -1;
  }
}
function drawBirds() {
  if (S.dayK < 0.3 || S.rain > 0.4) return;
  for (const b of BIRDS) {
    if (b.fly < 0) { const y = Math.round(wireY(b.x, b.k)); put(b.x, y - 1, VOID); put(b.x + 1, y - 1, VOID); put(b.x, y - 2, VOID); }
    else if (b.fly < 8) { const x = b.x + b.fx, y = wireY(b.x, b.k) + b.fy, wing = ((clock * 8) | 0) & 1; put(x, y, VOID); put(x - 1, y - wing, VOID); put(x + 1, y - wing, VOID); }
  }
}

const ev = director([
  { id: 'birds', cd: 50, w: () => (S.dayK > 0.4 ? 1 : 0), run: () => { for (const b of BIRDS) if (er() < 0.6) { b.fly = 0; b.fx = 0; b.fy = 0; } } },
  { id: 'window', cd: 3, w: () => 2, run: () => { const w = wins[(er() * wins.length) | 0]; if (w) w.rank = er(); } },
], er);

function update(dt: number) {
  clock += dt;
  ev.tick(dt); updateBirds(dt);
  tickSpawns(dt, 0.8); updatePeople(dt);
  updateCars(dt, 0.8);
}

const FOG = [{ y: 88, h: 10, sp: 0.8 }, { y: 120, h: 6, sp: -0.6 }, { y: 154, h: 5, sp: 1.5 }];
function render() {
  drawSky(HORIZON); drawLightning();
  blitLayer(far); drawMountainSnow(); drawFireworks();
  if ((clock * 0.7) % 1 < 0.5) { put(403, 9, MAG); put(404, 45, MAG); }
  blitLayer(mid); drawWindows(); drawLaundry(); drawSnowCaps(midCaps); drawFarPrecip();
  drawKonbini(); drawTree(trees[0]); blitLayer(front); drawSnowCaps(frontCaps); drawVending(); drawSignal(); drawTree(trees[1]);
  drawPeople(); drawWires(); drawBirds();
  drawStreet(street); groundSnow(140, 147); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const konbini: Scene = {
  id: 'konbini',
  name: 'Rua do konbini',
  build() {
    if (!built) {
      buildFar(); buildMid(); buildFront(); buildStreet();
      trees = [makeTree(140, 140, 0.95, wr, 'sakura'), makeTree(430, 140, 0.8, wr, 'maple')];
      midCaps = snowCaps(mid, wr); frontCaps = snowCaps(front, wr);
      built = true;
    }
    setLanes([{ y: 143 }, { y: 145 }]);
    setCarLanes(161, 176);
    const tips = POLES.map((x) => ({ x: x + 1, y: 42, end: 143 }));
    configure({ roofs: [{ x0: 186, x1: 298, y: 96 }], tips, lamps: [{ x: 178, y: 64 }, { x: 462, y: 64 }], ground0: 140, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}\nrecent  ${ev.recent.join(' | ')}`; },
};
