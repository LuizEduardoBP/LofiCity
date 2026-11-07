/* NEON ALLEY: a dense nightlife street. Stacked vertical signs on every building,
   a giant animated holo billboard, a lit gateway arch, izakaya lanterns, an arcade
   with chasing bulbs, overhead cables, taxis and crowds that peak late at night. */
import { L, Lp, WW, blitLayer, newLayer, put, rect, snowCaps } from '../engine/gfx';
import { bay, mulberry32 } from '../engine/math';
import {
  AMB, AMBD, BFAR, BMID, BNEAR, CNAVY, CRED, CYAN, CYAND, FARB, FWG, HALO, HALOOK, LIGHT, MAG, MAGD, SKY4, STEEL, STONE,
  STONEL, VOID, WCOOL, WDIM, WET, WHITE, WOOD, WWARM, ASPH,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { S } from '../sky/state';
import { drawFog, drawSearchlights, drawSky, drawSnowCaps, drawStreet, groundSnow, type Street } from './common';
import { director } from './director';
import { NEONS, glyph, signSet } from './signs';
import type { Scene } from './types';
import { getW, sx, sy } from '../engine/gfx';

const HORIZON = 100, STREET = 147, SH = 180 - STREET;
const wr = mulberry32(0x4e0e), er = mulberry32(0xa11e);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const signs = signSet(0x5161);
interface Win { x: number; y: number; w: number; h: number; c: number; rank: number }
const wins: Win[] = [];
const farWins: { x: number; y: number; c: number; rank: number }[] = [];
const beacons: [number, number][] = [];
let midCaps = new Float32Array(0), frontCaps = new Float32Array(0);
let clock = 0;

// buildings: x, width, top
const BLD: [number, number, number][] = [[0, 70, 30], [70, 62, 10], [132, 54, 44], [186, 112, 4], [298, 70, 22], [368, 56, 40], [424, 56, 12]];
const BB = { x: 196, y: 12, w: 92, h: 50 }; // holo billboard screen

function buildFar() {
  for (let x = -4; x < WW;) {
    const w = 12 + ((wr() * 22) | 0), top = -30 - ((wr() * 170) | 0);
    L(far, x, top, w, HORIZON + 12 - top, FARB);
    for (let wy = top + 4; wy < HORIZON; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (wr() < 0.28) Lp(far, wx, wy, SKY4);
    if (wr() < 0.6) beacons.push([x + (w >> 1), top - 1]);
    x += w + ((wr() * 6) | 0);
  }
  for (let x = -6; x < WW;) {
    const w = 10 + ((wr() * 18) | 0), top = 20 + ((wr() * 50) | 0);
    L(far, x, top, w, HORIZON + 12 - top, BFAR);
    for (let wy = top + 3; wy < HORIZON + 8; wy += 3) for (let wx = x + 2; wx < x + w - 1; wx += 2)
      if (wr() < 0.14) farWins.push({ x: wx, y: wy, c: wr() < 0.6 ? WWARM : wr() < 0.5 ? WCOOL : MAGD, rank: wr() });
    x += w + 1;
  }
}

function buildMid() {
  for (const [x, w, top] of BLD) {
    L(mid, x, top, w, 140 - top, BNEAR);
    L(mid, x, top, 1, 140 - top, BMID); L(mid, x, top, w, 1, STEEL);
    // rooftop clutter: water tank, AC units, antenna
    if (wr() < 0.7) { L(mid, x + 6, top - 6, 8, 6, BMID); L(mid, x + 7, top - 7, 6, 1, BMID); }
    L(mid, x + w - 10, top - 3, 5, 3, BMID); L(mid, x + w - 18, top - 9, 1, 9, BMID);
    for (let wy = top + 6; wy < 96; wy += 8) for (let wx = x + 5; wx < x + w - 5; wx += 7) {
      if (x === 186 && wy < BB.y + BB.h + 4) continue;
      if (wr() < 0.7) wins.push({ x: wx, y: wy, w: 4, h: 4, c: wr() < 0.55 ? WWARM : wr() < 0.6 ? WCOOL : MAGD, rank: wr() });
    }
    // AC units hanging on the facade
    for (let k = 0; k < 3; k++) { const ay = top + 10 + ((wr() * 70) | 0), ax = x + 3 + ((wr() * (w - 10)) | 0); L(mid, ax, ay, 5, 3, STEEL); Lp(mid, ax + 2, ay + 1, BMID); }
  }
  // billboard frame
  L(mid, BB.x - 2, BB.y - 2, BB.w + 4, BB.h + 4, STEEL);
  // overhead cables sagging across the street gaps
  for (let k = 0; k < 7; k++) {
    const x0 = (wr() * WW) | 0, x1 = Math.min(WW - 1, x0 + 50 + ((wr() * 120) | 0)), y0 = 40 + ((wr() * 50) | 0), sag = 3 + wr() * 8;
    for (let x = x0; x <= x1; x++) Lp(mid, x, Math.round(y0 + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * sag), VOID);
  }
}

// shop fronts on the ground floor
type Shop = { x: number; w: number; kind: 'izakaya' | 'arcade' | 'ramen' | 'karaoke' | 'bar' };
const SHOPS: Shop[] = [
  { x: 4, w: 62, kind: 'bar' }, { x: 74, w: 54, kind: 'izakaya' }, { x: 136, w: 46, kind: 'karaoke' },
  { x: 192, w: 100, kind: 'arcade' }, { x: 302, w: 62, kind: 'ramen' }, { x: 372, w: 48, kind: 'izakaya' }, { x: 428, w: 48, kind: 'bar' },
];
const LANTERNS: number[] = [];

function buildFront() {
  L(front, 0, 140, WW, 6, STONE); L(front, 0, 140, WW, 1, STONEL); L(front, 0, 146, WW, 1, STONEL);
  for (let x = 9; x < WW; x += 18) L(front, x, 141, 1, 5, ASPH);
  for (const s of SHOPS) {
    L(front, s.x - 2, 102, s.w + 4, 2, STEEL); // canopy edge
    L(front, s.x, 104, 1, 36, BMID); L(front, s.x + s.w - 1, 104, 1, 36, BMID);
    if (s.kind === 'izakaya') for (let lx = s.x + 6; lx < s.x + s.w - 4; lx += 10) LANTERNS.push(lx, 105);
  }
  // gateway arch posts
  L(front, 150, 70, 2, 70, STEEL); L(front, 330, 70, 2, 70, STEEL); L(front, 148, 138, 6, 2, BMID); L(front, 328, 138, 6, 2, BMID);
  // trash bags and a parked bicycle
  for (const bx of [68, 296, 422]) { L(front, bx, 136, 4, 4, BMID); Lp(front, bx + 1, 135, BMID); }
}

function buildStreet() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) {
    let c = wr() < 0.1 ? WET : ASPH;
    if (d === 0) c = BNEAR;
    if (d === 18 && x % 24 < 12) c = STONE;
    street.base[d * WW + x] = c;
  }
  for (let p = 0; p < 10; p++) {
    const cx = wr() * WW, cy = 3 + wr() * (SH - 6), rx = 12 + wr() * 28, ry = 2 + wr() * 3;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

function buildSigns() {
  const sr = mulberry32(0x77a);
  const ons: [number, number][] = [[17, 5], [18, 4], [16, 2], [19, 5], [17, 1]];
  for (const [x, w, top] of BLD) {
    if (x === 186) continue;
    const n = 2 + ((sr() * 2) | 0);
    for (let k = 0; k < n; k++) {
      const left = k % 2 === 0, gl = 3 + ((sr() * 4) | 0), sx0 = left ? x + 2 : x + w - 11;
      const sy0 = top + 6 + ((sr() * Math.max(4, 90 - top - gl * 9)) | 0);
      if (sy0 + gl * 9 > 100) continue;
      signs.text(sx0, sy0, gl, true, NEONS[(sr() * NEONS.length) | 0], ons[(sr() * ons.length) | 0]);
    }
    if (sr() < 0.7) signs.text(x + 12, Math.min(92, top + 14 + ((sr() * 30) | 0)), Math.min(5, ((w - 26) / 7) | 0), false, NEONS[(sr() * NEONS.length) | 0], [17, 3]);
  }
  for (const s of SHOPS) {
    const n = Math.min(6, ((s.w - 6) / 7) | 0);
    const sg = signs.text(s.x + ((s.w - (n * 7 + 3)) >> 1), 90, n, false, s.kind === 'arcade' ? AMB : NEONS[(sr() * NEONS.length) | 0], s.kind === 'ramen' ? [11, 2] : [16, 4]);
    if (s.kind === 'arcade' || s.kind === 'karaoke') { sg.chase = true; sg.col2 = s.kind === 'arcade' ? MAG : CYAN; }
  }
  // the gateway arch band
  const arch = signs.text(156, 70, 24, false, AMB, [0, 24]);
  arch.chase = true; arch.col2 = WHITE;
}

// ---------- dynamic passes ----------
const BBG: Uint8Array[] = Array.from({ length: 10 }, () => glyph(mulberry32(0xb0 + (er() * 1e6) | 0)));
function drawBillboard() {
  const { x, y, w, h } = BB, t = clock, mode = ((t / 16) | 0) % 3;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let c = VOID;
    if (mode === 0) {
      const v = Math.sin(i * 0.14 + t * 1.8) + Math.sin(j * 0.21 - t * 1.2) + Math.sin((i + j) * 0.07 + t * 0.7);
      c = v > 1.3 ? CYAN : v > 0.5 ? MAG : v > -0.3 ? MAGD : v > -1.1 ? CNAVY : VOID;
    } else if (mode === 1) {
      c = j % 2 ? CNAVY : VOID;
      const gx = Math.floor((i + t * 18) / 12), lx = Math.floor(((i + t * 18) % 12) / 2), ly = Math.floor((j - 9) / 2);
      if (j >= 9 && j < 23 && lx < 5 && BBG[gx % 10][ly * 5 + lx]) c = AMB;
      const gx2 = Math.floor((i - t * 12 + 600) / 12), lx2 = Math.floor((((i - t * 12 + 600) % 12) + 12) % 12 / 2), ly2 = Math.floor((j - 29) / 2);
      if (j >= 29 && j < 43 && lx2 < 5 && BBG[(gx2 + 3) % 10][ly2 * 5 + lx2]) c = WHITE;
    } else {
      c = (Math.sin(i * 0.3 + Math.sin(j * 0.2 + t) * 2 + t) > 0.85) ? WCOOL : CNAVY;
      for (let k = 0; k < 2; k++) {
        const cx = w / 2 + Math.sin(t * 0.5 + k * 3) * w * 0.35, cy = h / 2 + Math.sin(t * 0.8 + k * 2) * h * 0.28;
        for (let s = 0; s < 7; s++) {
          const px = cx - Math.cos(t * 0.5 + k * 3) * s * 2.2 * (k ? -1 : 1), py = cy - Math.cos(t * 0.8 + k * 2) * s * 1.2 + Math.sin(t * 6 + s) * 0.6;
          const rr = 3.4 - s * 0.4;
          if ((i - px) ** 2 + (j - py) ** 2 < rr * rr) c = s % 3 === 1 ? AMB : WHITE;
        }
      }
    }
    if (j % 3 === 2 && bay(i, j) < 0.3) c = c === VOID ? CNAVY : c; // scan texture
    put(x + i, y + j, c);
  }
}

function drawWindows() {
  const lit = S.dayK > 0.5 ? 1 : S.cal.hour >= 17 || S.cal.hour < 3 ? 0.8 : 0.35;
  for (const f of farWins) put(f.x, f.y, f.rank < lit ? f.c : BFAR);
  for (const w of wins) rect(w.x, w.y, w.w, w.h, w.rank < lit ? w.c : WDIM);
  if ((clock * 0.7) % 1 < 0.5) for (const [bx, by] of beacons) put(bx, by, MAG);
}

function lantern(x: number, y: number, lit: boolean) {
  const body = lit ? AMBD : CRED, core = lit ? LIGHT : CRED;
  rect(x, y, 5, 1, VOID); rect(x, y + 8, 5, 1, VOID);
  rect(x + 1, y + 1, 3, 1, body); rect(x, y + 2, 5, 5, body); rect(x + 1, y + 7, 3, 1, body);
  rect(x + 1, y + 3, 3, 3, core); put(x + 2, y + 4, lit ? MAGD : VOID);
  if (lit) for (let j = -4; j < 13; j++) for (let i = -4; i < 9; i++) {
    const d = Math.hypot(i - 2, j - 4) / 7;
    if (d < 1 && HALOOK[getW(x + i, y + j)] && bay(sx(x + i), sy(y + j)) < 0.3 * (1 - d)) put(x + i, y + j, MAGD);
  }
}

function drawShops() {
  const open = S.cal.hour >= 16 || S.cal.hour < 4, t = clock;
  for (const s of SHOPS) {
    const shopOpen = s.kind === 'ramen' ? S.cal.hour >= 11 || S.cal.hour < 2 : open;
    const x0 = s.x + 1, w = s.w - 2;
    // interior glow
    for (let y = 104; y < 140; y++) for (let x = x0; x < x0 + w; x++) {
      const k = shopOpen ? 0.65 - (y - 104) / 90 : 0.05, b = bay(sx(x), sy(y));
      const warm = s.kind === 'arcade' ? (((x + y + ((t * 6) | 0)) >> 2) % 3 === 0 ? MAG : LIGHT) : s.kind === 'karaoke' ? WCOOL : LIGHT;
      put(x, y, k > b + 0.2 ? warm : k > b - 0.25 ? (s.kind === 'karaoke' ? CYAND : AMBD) : WOOD);
    }
    if (!shopOpen) { rect(x0, 104, w, 36, STEEL); for (let y = 105; y < 140; y += 2) rect(x0, y, w, 1, BMID); continue; }
    if (s.kind === 'izakaya' || s.kind === 'ramen') {
      // noren curtain
      const sway = Math.round(Math.sin(t * 1.3 + s.x) * S.wind * 6);
      for (let k = 0; k < 4; k++) {
        const nx = x0 + 6 + k * Math.floor((w - 12) / 4);
        for (let y = 104; y < 116; y++) for (let i = 0; i < Math.floor((w - 12) / 4) - 1; i++) put(nx + i + (y > 112 ? sway : 0), y, CNAVY);
        put(nx + 3, 108, WHITE); put(nx + 4, 108, WHITE); put(nx + 3, 109, WHITE);
      }
      // counter + silhouettes
      rect(x0 + 2, 126, w - 4, 2, WOOD);
      for (let k = 0; k < 3; k++) { const px = x0 + 10 + k * 14; if (((px * 7) % 5) < 3) { rect(px, 118, 3, 8, VOID); rect(px, 115, 3, 3, VOID); } }
    }
    if (s.kind === 'arcade') {
      for (let k = 0; k < 5; k++) { const mx = x0 + 6 + k * 19; rect(mx, 112, 10, 22, VOID); rect(mx + 1, 114, 8, 6, ((k + ((t * 2) | 0)) % 2) ? CYAN : FWG); }
    }
    if (s.kind === 'bar') { rect(x0 + 4, 108, w - 8, 3, VOID); for (let k = 0; k < (w - 10) / 4; k++) put(x0 + 6 + k * 4, 107, [AMB, FWG, MAG][k % 3]); }
    if (s.kind === 'karaoke') rect(x0 + (w >> 1) - 3, 110, 6, 30, CYAND);
    // light spill on the sidewalk
    for (let y = 140; y < 147; y++) for (let x = x0; x < x0 + w; x++) {
      const k = 0.25 * (1 - (y - 140) / 8);
      if (bay(sx(x), sy(y)) < k && HALOOK[getW(x, y)]) put(x, y, s.kind === 'arcade' ? MAGD : s.kind === 'karaoke' ? CYAND : HALO);
    }
  }
  for (let i = 0; i < LANTERNS.length; i += 2) lantern(LANTERNS[i], LANTERNS[i + 1] + Math.round(Math.sin(t * 2 + i) * S.wind * 3), S.neonOn || open);
}

const ev = director([
  { id: 'flicker', cd: 6, w: () => (S.neonOn ? 2 : 0), run: () => signs.flicker(er) },
  { id: 'window', cd: 3, w: () => 2, run: () => { const w = wins[(er() * wins.length) | 0]; if (w) w.rank = er(); } },
], er);

function update(dt: number) {
  clock += dt;
  ev.tick(dt); signs.update(dt);
  const lateNight = S.cal.hour >= 19 || S.cal.hour < 3 ? 1.6 : 1;
  tickSpawns(dt, 1.4 * lateNight); updatePeople(dt);
  updateCars(dt, 1.3);
}

const FOG = [{ y: 92, h: 8, sp: 1.1 }, { y: 120, h: 6, sp: -0.7 }, { y: 154, h: 5, sp: 1.9 }];
function render() {
  drawSky(HORIZON); drawLightning(); drawSearchlights([110, 380], HORIZON);
  blitLayer(far); drawFireworks();
  blitLayer(mid); drawWindows(); drawBillboard(); drawSnowCaps(midCaps); drawFarPrecip();
  drawShops(); blitLayer(front); drawSnowCaps(frontCaps); signs.draw(clock);
  drawPeople();
  drawStreet(street); groundSnow(140, 147); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const neonAlley: Scene = {
  id: 'neon-alley',
  name: 'Beco neon',
  build() {
    if (!built) {
      buildFar(); buildMid(); buildFront(); buildStreet(); buildSigns();
      midCaps = snowCaps(mid, wr); frontCaps = snowCaps(front, wr);
      built = true;
    }
    setLanes([{ y: 143 }, { y: 145 }]);
    setCarLanes(162, 177);
    const tips = SHOPS.flatMap((s) => [{ x: s.x, y: 104, end: 143 }, { x: s.x + s.w - 2, y: 104, end: 143 }]);
    configure({ roofs: SHOPS.map((s) => ({ x0: s.x - 2, x1: s.x + s.w + 2, y: 102 })), tips, lamps: [], ground0: 140, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}\nrecent  ${ev.recent.join(' | ')}`; },
};
