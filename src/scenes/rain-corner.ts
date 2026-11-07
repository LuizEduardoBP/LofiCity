/* RAIN CORNER: a ramen stall on a futuristic street corner, with an elevated train,
   neon signs, a street lamp, a vending machine, a cat and a seasonal street tree.
   Authored on a 480 px wide world; the original 320 px composition sits in the middle. */
import { L, Lp, M, WW, blitLayer, getW, newLayer, put, rect, snowCaps, spr, sx, sy } from '../engine/gfx';
import { BAY, bay, mulberry32 } from '../engine/math';
import {
  AMB, AMBD, ASPH, BARK, BFAR, BMID, BNEAR, CYAN, CYAND, HALO, HALOOK, LEAFG, LEAFGD, LEAF1, LEAF2, LIGHT, MAG, MAGD,
  FARB, MOMIJI, PETAL, SAKURA, SAKURAD, SKY3, SKY4, SNOW, STEEL, STONE, STONEL, VOID, WCOOL, WDIM, WET, WHITE, WOOD, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { audio } from '../audio/audio';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSearchlights, drawSky, drawSnowCaps, drawStreet, groundSnow, type Street } from './common';
import type { Scene } from './types';

const X = 80; // offset of the original 320 px composition inside the 480 px world
const HORIZON = 100, STREET = 147;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const wr = mulberry32(20261107), er = mulberry32(0xa5a5a5), fxr = mulberry32(0x77);
const far = newLayer(), mid = newLayer(), front = newLayer();
interface Win { x: number; y: number; w: number; h: number; c: number; rank: number }
const farWindows: { x: number; y: number; on: boolean; c: number }[] = [];
const midWindows: Win[] = [];
let midCaps = new Float32Array(0), frontCaps = new Float32Array(0);
const SH = 180 - STREET;
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };

function win(x: number, y: number, w: number, h: number, q: number) {
  const c = q < 0.18 ? WWARM : q < 0.26 ? WCOOL : q < 0.55 ? WDIM : 255;
  if (c !== 255) midWindows.push({ x, y, w, h, c, rank: wr() });
}

function buildFar() {
  for (let x = -4; x < WW;) {
    const w = 14 + ((wr() * 26) | 0), top = 14 + ((wr() * 40) | 0);
    L(far, x, top, w, HORIZON + 12 - top, FARB);
    for (let wy = top + 4; wy < HORIZON; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (wr() < 0.22) Lp(far, wx, wy, SKY4);
    x += w + ((wr() * 7) | 0);
  }
  // very tall hazy towers, only revealed on portrait screens
  for (const [tx, tw, top] of [[30, 22, -120], [118, 18, -70], [205, 30, -170], [300, 20, -95], [372, 26, -140], [446, 18, -60]]) {
    L(far, tx, top, tw, 40 - top, FARB);
    L(far, tx + (tw >> 1) - 1, top - 8, 2, 8, FARB);
    for (let wy = top + 4; wy < 40; wy += 5) for (let wx = tx + 2; wx < tx + tw - 2; wx += 3) if (wr() < 0.3) Lp(far, wx, wy, SKY4);
  }
  // signature tower with antenna
  L(far, X + 150, 8, 26, 110, FARB); L(far, X + 156, 3, 14, 5, FARB); L(far, X + 162, -12, 2, 15, FARB);
  for (let wy = 12; wy < HORIZON; wy += 5) for (let wx = X + 152; wx < X + 174; wx += 2) if (wr() < 0.5) Lp(far, wx, wy, SKY4);
  for (let x = -6; x < WW;) {
    const w = 8 + ((wr() * 20) | 0), top = 42 + ((wr() * 44) | 0);
    L(far, x, top, w, HORIZON + 12 - top, BFAR);
    if (wr() < 0.35) L(far, x + (w >> 1), top - 5 - ((wr() * 6) | 0), 1, 8, BFAR);
    for (let wy = top + 3; wy < HORIZON + 8; wy += 3) for (let wx = x + 2; wx < x + w - 1; wx += 2) {
      const q = wr();
      if (q < 0.08) Lp(far, wx, wy, WDIM);
      else if (q < 0.12 && farWindows.length < 180) farWindows.push({ x: wx, y: wy, on: wr() < 0.6, c: wr() < 0.7 ? WWARM : WCOOL });
    }
    x += w + 1;
  }
}

function buildMid() {
  // back alley wall behind the stall
  L(mid, X + 86, 94, 156, 46, BMID); L(mid, X + 98, 116, 9, 24, BNEAR); Lp(mid, X + 102, 114, WWARM); L(mid, X + 106, 94, 1, 46, BNEAR);
  for (let y = 98; y < 140; y += 6) L(mid, X + 88, y, 8, 1, BNEAR);
  // left block (three masses)
  L(mid, X, 34, 42, 106, BNEAR); L(mid, X + 42, 22, 32, 118, BNEAR); L(mid, X + 74, 46, 20, 94, BNEAR);
  L(mid, X + 93, 46, 1, 94, SKY3); L(mid, X + 73, 22, 1, 24, SKY3);
  for (let wy = 40; wy < 106; wy += 9) for (let wx = 4; wx < 70; wx += 8) { win(X + wx, wy, 4, 3, wr()); L(mid, X + wx, wy + 3, 4, 1, BMID); }
  for (let fy = 50; fy < 110; fy += 15) { L(mid, X + 44, fy, 26, 1, BMID); for (let fx = 44; fx < 70; fx += 2) Lp(mid, X + fx, fy - 1, BMID); }
  for (let k = 0; k < 4; k++) { const ax = 4 + ((wr() * 30) | 0), ay = 44 + ((wr() * 50) | 0); L(mid, X + ax, ay, 5, 3, BMID); L(mid, X + ax, ay + 1, 5, 1, STONE); }
  L(mid, X + 6, 114, 48, 26, BMID); for (let y = 115; y < 140; y += 2) L(mid, X + 6, y, 48, 1, STEEL);
  L(mid, X + 49, 17, 1, 5, BMID); L(mid, X + 61, 17, 1, 5, BMID);
  // right block
  L(mid, X + 236, 16, 44, 124, BNEAR); L(mid, X + 280, 38, 40, 102, BNEAR); L(mid, X + 236, 16, 1, 124, CYAND);
  L(mid, X + 290, 26, 14, 10, BMID); L(mid, X + 292, 36, 1, 2, BMID); L(mid, X + 301, 36, 1, 2, BMID); L(mid, X + 290, 26, 14, 1, STEEL);
  for (let wy = 24; wy < 106; wy += 8) for (let wx = 252; wx < 316; wx += 7) { if (wx < 282 && wy < 20) continue; win(X + wx, wy, 3, 3, wr()); }
  L(mid, X + 286, 120, 10, 20, BMID); Lp(mid, X + 290, 118, WWARM); Lp(mid, X + 291, 118, WWARM);
  // left extension: older walk-up with balconies, and a utility pole with wires
  L(mid, 0, 66, 58, 74, BNEAR); L(mid, 0, 64, 60, 2, BMID);
  for (let fy = 84; fy < 134; fy += 16) { L(mid, 2, fy, 52, 1, STEEL); for (let fx = 2; fx < 54; fx += 3) Lp(mid, fx, fy - 1, STEEL); }
  for (let wy = 72; wy < 132; wy += 16) for (let wx = 6; wx < 52; wx += 12) win(wx, wy, 6, 6, wr());
  L(mid, 66, 38, 2, 102, BMID); L(mid, 60, 44, 14, 1, BMID); L(mid, 62, 50, 10, 1, BMID); L(mid, 69, 54, 4, 6, STEEL);
  for (let x = 0; x < 66; x++) Lp(mid, x, 45 + Math.round(4 * Math.sin((x / 66) * Math.PI)), BMID);
  for (let x = 68; x < 80; x++) Lp(mid, x, 45 + Math.round(((x - 68) / 12) * 2), BMID);
  // right extension: tall block with a fire escape
  L(mid, 400, 24, 80, 116, BNEAR); L(mid, 400, 24, 1, 116, CYAND);
  for (let wy = 32; wy < 112; wy += 9) for (let wx = 408; wx < 472; wx += 9) win(wx, wy, 4, 4, wr());
  for (let fy = 46; fy < 130; fy += 14) { L(mid, 452, fy, 22, 1, STEEL); for (let k = 0; k < 7; k++) Lp(mid, 454 + k * 2, fy + 1 + k * 2, STEEL); }
}

function buildFront() {
  L(front, 0, 140, WW, 6, STONE); L(front, 0, 140, WW, 1, STONEL); L(front, 0, 146, WW, 1, STONEL);
  for (let x = 9; x < WW; x += 18) L(front, x, 141, 1, 5, ASPH);
  // stall roof + striped awning with scalloped edge
  L(front, X + 108, 90, 108, 6, BNEAR); L(front, X + 108, 95, 108, 1, WOOD);
  for (let x = 108; x < 216; x++) {
    const c = ((x - 108) / 6) % 2 | 0 ? AMBD : MAGD;
    for (let y = 96; y < 102; y++) Lp(front, X + x, y, c);
    const m = (x - 108) % 6;
    if (m >= 1 && m <= 4) Lp(front, X + x, 102, c);
    if (m === 2 || m === 3) Lp(front, X + x, 103, c);
  }
  L(front, X + 110, 104, 2, 36, WOOD); L(front, X + 212, 104, 2, 36, WOOD);
  L(front, X + 110, 127, 104, 2, AMBD); L(front, X + 110, 129, 104, 11, WOOD);
  for (let x = 114; x < 212; x += 8) L(front, X + x, 129, 1, 11, BNEAR);
  for (const s of [124, 146, 168, 190]) { L(front, X + s, 133, 6, 2, STONEL); L(front, X + s + 2, 135, 2, 5, BMID); }
  // vending machine
  L(front, X + 217, 104, 16, 36, STEEL); L(front, X + 217, 104, 1, 36, BNEAR); L(front, X + 232, 104, 1, 36, BNEAR);
  L(front, X + 219, 124, 12, 6, BNEAR); L(front, X + 226, 125, 3, 1, STONEL); L(front, X + 220, 132, 10, 4, VOID);
  // street lamp
  L(front, X + 61, 70, 2, 75, BNEAR); L(front, X + 59, 142, 6, 3, BMID); L(front, X + 62, 69, 10, 1, BNEAR); L(front, X + 67, 70, 7, 3, BNEAR);
  // tree planter
  L(front, 94, 138, 13, 2, STONEL);
}

function buildStreet() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) {
    let c = wr() < 0.1 ? WET : ASPH;
    if (d === 0) c = BNEAR;
    if (d === 20 && x % 28 < 13) c = STONE;
    street.base[d * WW + x] = c;
  }
  for (let p = 0; p < 9; p++) {
    const cx = wr() * WW, cy = 3 + wr() * (SH - 6), rx = 14 + wr() * 30, ry = 2 + wr() * 3;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- tree (seasonal canopy) ----------
const TREE: number[] = []; // x, y, rank, pick, shade, top, texture
const BRANCHES = [[100, 100, 88, 86], [101, 98, 113, 84], [100, 96, 100, 74], [92, 90, 82, 91], [110, 88, 119, 90], [100, 84, 94, 74], [104, 82, 110, 72]];
function buildTree() {
  const circles = [[100, 82, 13], [88, 90, 10], [112, 90, 11], [96, 95, 9], [106, 75, 8]];
  const inside = (x: number, y: number) => circles.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
  for (let y = 60; y < 106; y++) for (let x = 74; x < 126; x++) {
    if (!inside(x, y)) continue;
    const shade = (y - 84) / 10 + (x - 96) / 30 + bay(x, y) * 0.8 > 0.9 ? 1 : 0;
    TREE.push(x, y, wr(), wr(), shade, inside(x, y - 1) ? 0 : 1, wr());
  }
}
function line(x0: number, y0: number, x1: number, y1: number, c: number, snowTop: boolean) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    put(x, y, c);
    if (snowTop && bay(x, y) < S.snowCover) put(x, y - 1, SNOW);
  }
}
function drawTree() {
  const T = S.tree, cov = S.snowCover;
  rect(99, 96, 3, 43, BARK);
  for (const [a, b, c, d] of BRANCHES) line(a, b, c, d, BARK, T.density < 0.3 && cov > 0.15);
  for (let i = 0; i < TREE.length; i += 7) {
    if (TREE[i + 2] >= T.density) continue;
    const pick = TREE[i + 3], sh = TREE[i + 4], tex = TREE[i + 6];
    let c: number;
    if (pick < T.pink) c = sh ? (tex < 0.25 ? SAKURA : SAKURAD) : tex < 0.2 ? PETAL : tex < 0.3 ? SAKURAD : SAKURA;
    else if (pick < T.red) c = sh ? (tex < 0.5 ? LEAF1 : MOMIJI) : tex < 0.3 ? LEAF2 : tex < 0.45 ? LEAF1 : MOMIJI;
    else c = sh ? (tex < 0.2 ? LEAFG : LEAFGD) : tex < 0.25 ? LEAFGD : LEAFG;
    if (TREE[i + 5] && cov > 0.1 && bay(TREE[i], TREE[i + 1]) < cov) c = SNOW;
    put(TREE[i], TREE[i + 1], c);
  }
}

// ---------- neon signs ----------
const sr = mulberry32(20261107 ^ 0x51611);
function glyph() {
  const g = new Uint8Array(35); let n = 0;
  const strokes = 2 + ((sr() * 3) | 0);
  for (let s = 0; s < strokes; s++) {
    const t = sr();
    if (t < 0.36) { const row = (sr() * 7) | 0, c0 = (sr() * 2) | 0, c1 = 3 + ((sr() * 2) | 0); for (let c = c0; c <= c1; c++) { g[row * 5 + c] = 1; n++; } }
    else if (t < 0.72) { const col = (sr() * 5) | 0, r0 = (sr() * 3) | 0, r1 = 4 + ((sr() * 3) | 0); for (let r = r0; r <= r1; r++) { g[r * 5 + col] = 1; n++; } }
    else { let c = sr() < 0.5 ? 0 : 4; const dir = c ? -1 : 1, r0 = (sr() * 3) | 0; for (let k = 0; k < 5; k++) { g[(r0 + k) * 5 + c] = 1; c += dir; n++; } }
  }
  if (n < 4) for (let c = 0; c < 5; c++) g[15 + c] = 1;
  return g;
}
interface Sign {
  x: number; y: number; w: number; h: number; col: number; dim: number; col2: number; dim2: number;
  on: [number, number] | 'stall'; px: number[]; gi: number[]; px2: number[]; border: number[];
  state: number; flick: number; dead: number; sput: number; plate: boolean;
}
const signs: Sign[] = [];
function borderOf(s: Sign) {
  const b: number[] = [];
  for (let i = 0; i < s.w; i++) b.push(s.x + i, s.y, s.x + i, s.y + s.h - 1);
  for (let j = 1; j < s.h - 1; j++) b.push(s.x, s.y + j, s.x + s.w - 1, s.y + j);
  return b;
}
function textSign(x: number, y: number, n: number, vertical: boolean, col: number, dim: number, on: Sign['on']) {
  const s: Sign = { x, y, w: vertical ? 9 : n * 7 + 3, h: vertical ? n * 9 + 1 : 11, col, dim, col2: col, dim2: dim, on, px: [], gi: [], px2: [], border: [], state: 1, flick: 0, dead: -1, sput: 0, plate: true };
  for (let g = 0; g < n; g++) {
    const G7 = glyph(), gx = vertical ? x + 2 : x + 2 + g * 7, gy = vertical ? y + 2 + g * 9 : y + 2;
    for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (G7[j * 5 + i]) { s.px.push(gx + i, gy + j); s.gi.push(g); }
  }
  s.border = borderOf(s); signs.push(s); return s;
}
function iconSign(x: number, y: number, rows: string[], col: number, col2: number, on: Sign['on']) {
  const s: Sign = { x, y, w: rows[0].length + 4, h: rows.length + 4, col, dim: col === MAG ? MAGD : CYAND, col2, dim2: col2 === CYAN ? CYAND : MAGD, on, px: [], gi: [], px2: [], border: [], state: 1, flick: 0, dead: -1, sput: 0, plate: true };
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { if (r[i] === 'a') { s.px.push(x + 2 + i, y + 2 + j); s.gi.push(0); } else if (r[i] === 'b') s.px2.push(x + 2 + i, y + 2 + j); } });
  s.border = borderOf(s); signs.push(s); return s;
}
function buildSigns() {
  textSign(X + 77, 54, 5, true, MAG, MAGD, [17, 2]);
  textSign(X + 240, 26, 6, true, CYAN, CYAND, [18, 1]).dead = 3;
  textSign(X + 140, 79, 6, false, AMB, AMBD, 'stall');
  iconSign(X + 46, 6, ['..b..b..b...', '.b..b..b....', '..b..b..b...', 'aaaaaaaaaaaa', '.aaaaaaaaaa.', '..aaaaaaaa..', '....aaaa....'], MAG, CYAN, [17, 24]);
  iconSign(X + 259, 108, ['...a...', '....a..', 'aaaaaaa', '....a..', '...a...'], CYAN, CYAN, [0, 24]).plate = false;
  textSign(410, 40, 7, true, AMB, AMBD, [16, 3]);
  textSign(14, 100, 3, false, CYAN, CYAND, [17, 23]);
}

// ---------- actors ----------
const TR = { on: false, x: 0, dir: 1 };
const BL = { on: false, x: 0, dir: 1, ad: 0 };
const DR = { on: false, x: 0, y: 0, dir: 1, sp: 0, t: 0, box: false };
const CAT = { mode: 'sleep', t: 0, dur: 60, flip: false };
let lampFlick = 0, lampOn = true, vendFlash = 0, vendSlot = 0, steamAcc = 0, clock = 0, step = 0;
const recent: string[] = [];
const NST = 40;
const tX = new Float32Array(NST), tY = new Float32Array(NST), tV = new Float32Array(NST), tLf = new Float32Array(NST), tMx = new Float32Array(NST);

function startTrain() { if (TR.on) return; TR.on = true; TR.dir = er() < 0.5 ? 1 : -1; TR.x = TR.dir > 0 ? -160 : WW + 10; audio.rumble(0, 0.35, 6); }
function spawnDrone() { if (DR.on) return; DR.on = true; DR.dir = er() < 0.5 ? 1 : -1; DR.x = DR.dir > 0 ? -6 : WW + 6; DR.y = 30 + er() * 45; DR.sp = 20 + er() * 14; DR.t = 0; DR.box = er() < 0.6; }
function catNext() {
  if (CAT.mode === 'sleep') { CAT.mode = 'stretch'; CAT.t = 0; CAT.dur = 2.6; }
  else if (CAT.mode === 'sit') { CAT.mode = 'groom'; CAT.t = 0; CAT.dur = 5 + er() * 4; }
}
function updateCat(dt: number) {
  CAT.t += dt; if (CAT.t < CAT.dur) return;
  if (CAT.mode === 'stretch') { CAT.mode = 'sit'; CAT.t = 0; CAT.dur = 25 + er() * 70; }
  else if (CAT.mode === 'groom') { CAT.mode = 'sit'; CAT.t = 0; CAT.dur = 15 + er() * 30; }
  else if (CAT.mode === 'sit') { CAT.mode = 'sleep'; CAT.t = 0; CAT.dur = 1e9; if (er() < 0.5) CAT.flip = !CAT.flip; }
}

const EVENTS: { id: string; cd: number; w: () => number; run: () => void }[] = [
  { id: 'train', cd: 80, w: () => (S.trains ? 0.6 + 1.6 * S.busy : 0), run: startTrain },
  { id: 'drone', cd: 35, w: () => (0.6 + 1.2 * (1 - S.busy)) * (1 - S.storm), run: spawnDrone },
  { id: 'cat', cd: 40, w: () => 1, run: catNext },
  { id: 'flicker', cd: 12, w: () => (S.neonOn ? 1.5 : 0), run: () => { const s = signs[(er() * signs.length) | 0]; s.flick = 0.6 + er() * 1.8; if (er() < 0.25) s.dead = (er() * 6) | 0; } },
  { id: 'vend', cd: 40, w: () => 0.2 + 1.4 * S.busy, run: () => { vendFlash = 0.5; vendSlot = 2.5; } },
  { id: 'ad', cd: 90, w: () => 0.8, run: () => { BL.ad = (BL.ad + 1) % 3; } },
  { id: 'blimp', cd: 420, w: () => 0.5 * (1 - S.storm), run: () => { if (!BL.on) { BL.on = true; BL.dir = er() < 0.5 ? 1 : -1; BL.x = BL.dir > 0 ? -30 : WW + 30; } } },
  { id: 'window', cd: 4, w: () => 2.5, run: () => { const f = farWindows[(er() * farWindows.length) | 0]; if (f) f.on = S.deep > 0.5 ? er() < 0.3 : !f.on; } },
  { id: 'lamp', cd: 150, w: () => (S.lampOn ? 0.4 : 0), run: () => { lampFlick = 1.2 + er() * 1.5; } },
];
const lastRun = new Float32Array(EVENTS.length).fill(-1e6);
let nextEvent = 2;
function events(dt: number) {
  nextEvent -= dt; if (nextEvent > 0) return;
  let tot = 0;
  for (let i = 0; i < EVENTS.length; i++) if (clock - lastRun[i] >= EVENTS[i].cd) tot += EVENTS[i].w();
  if (tot > 0) {
    let r = er() * tot;
    for (let i = 0; i < EVENTS.length; i++) {
      if (clock - lastRun[i] < EVENTS[i].cd) continue;
      r -= EVENTS[i].w();
      if (r <= 0) { lastRun[i] = clock; EVENTS[i].run(); recent.push(EVENTS[i].id); if (recent.length > 5) recent.shift(); break; }
    }
  }
  nextEvent = (3 + er() * 9) / (0.6 + 0.6 * S.busy);
}

/** Fraction of apartment windows lit at night by hour. */
function litFrac() {
  if (S.dayK > 0.5) return 1;
  const h = S.cal.hour;
  return h >= 18 ? 0.75 : h < 1 ? 0.5 : h < 5 ? 0.15 : h < 7 ? 0.35 : 0.5;
}

function update(dt: number) {
  clock += dt; step++;
  events(dt);
  if (TR.on) { TR.x += TR.dir * 70 * dt; if ((TR.dir > 0 && TR.x > WW + 10) || (TR.dir < 0 && TR.x < -170)) TR.on = false; }
  const tc = TR.x + 75;
  S.shake = !REDUCED && TR.on && tc > X + 90 && tc < X + 240 && (step >> 2) & 1 ? 1 : 0;
  if (BL.on) { BL.x += BL.dir * 0.8 * dt; if (BL.x < -40 || BL.x > WW + 40) BL.on = false; }
  if (DR.on) { DR.t += dt; DR.x += DR.dir * DR.sp * dt; if (DR.x < -10 || DR.x > WW + 10) DR.on = false; }
  tickSpawns(dt); updatePeople(dt); updateCars(dt, 0.7);
  updateCat(dt);
  for (const s of signs) {
    const lit = S.neonOn && (s.on === 'stall' ? S.stallOpen : hourIn(S.cal.hour, s.on[0], s.on[1]));
    let st = lit ? 1 : 0;
    if (s.flick > 0) { s.flick -= dt; if (lit) st = fxr() < 0.55 ? 1 : 0; }
    s.state = st; s.sput = s.dead >= 0 && fxr() < 0.06 ? 1 : 0;
  }
  if (lampFlick > 0) { lampFlick -= dt; lampOn = fxr() < 0.6; } else lampOn = true;
  if (vendFlash > 0) vendFlash -= dt;
  if (vendSlot > 0) vendSlot -= dt;
  if (S.stallOpen) {
    steamAcc += dt * (2 + 5 * S.busy);
    while (steamAcc > 1) {
      steamAcc -= 1;
      for (let i = 0; i < NST; i++) if (tLf[i] <= 0) { tX[i] = X + 135 + fxr() * 6; tY[i] = 121; tV[i] = -6 - fxr() * 5; tMx[i] = tLf[i] = 2.5 + fxr() * 1.5; break; }
    }
  }
  for (let i = 0; i < NST; i++) if (tLf[i] > 0) { tLf[i] -= dt; tY[i] += tV[i] * dt; tX[i] += Math.sin(tY[i] * 0.25 + i) * dt * 4 + S.wind * dt * 18; }
}

// ---------- sprites ----------
const CATM = M({ o: AMBD, d: WOOD, e: AMB });
const CAT_SLEEP = [['...oo.....', '.oooooo...', 'ooodoooo.o', 'oooooooooo', '.ooooooood'], ['...oo.....', '.ooooooo..', 'ooodoooo.o', 'oooooooooo', '.ooooooood']];
const CAT_SIT = [['......o.o', '......ooo', '......oeo', '.....oooo', '....oooo.', '...ooooo.', '..oodooo.', 'o.oooooo.', '.ooooooo.'], ['......o.o', '......ooo', '......ooo', '.....oooo', '....oooo.', '...ooooo.', '..oodooo.', 'o.oooooo.', '.ooooooo.']];
const CAT_GROOM = ['.........', '......o.o', '......ooo', '.....oooo', '....ooooo', '...ooooo.', '..oodooo.', 'o.oooooo.', '.ooooooo.'];
const CAT_STRETCH = ['o.........o.o', '.o........ooo', '..ooooooooooe', '..ooooooooo..', '..o.o....o.o.', '..o.o....o.o.'];
const COOK_SPR = ['..hhh..', '..hhh..', '..kkk..', '..kkk..', '.kkkkk.', 'kkkkkkk', 'kkkkkkk', 'kkkkkkk', 'kkkkkkk', 'kkkkkkk', 'kkkkkkk', 'kkkkkkk', 'kkkkkkk', 'kkkkkkk'];
const COOKM = M({ h: WHITE, k: VOID });

// ---------- render passes ----------
function drawBlimp() {
  if (!BL.on) return;
  const x = Math.round(BL.x), y = 20;
  for (let j = -3; j <= 3; j++) { const half = Math.round(15 * Math.sqrt(Math.max(0, 1 - (j / 3.6) ** 2))); for (let i = -half; i < half; i++) put(x + i, y + j, j < -1 ? WDIM : BFAR); }
  const tail = BL.dir > 0 ? x - 16 : x + 15; put(tail, y - 2, BFAR); put(tail, y - 3, BFAR); put(tail, y + 2, BFAR);
  rect(x - 3, y + 4, 6, 2, BMID);
  const sh = (clock * 6) | 0;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 3; j++) {
    let c: number;
    if (BL.ad === 0) c = ((i + sh) & 7) < 4 ? MAG : CYAN;
    else if (BL.ad === 1) c = (i * 3 + j + sh) % 5 === 0 ? AMB : MAGD;
    else c = bay(i, j) < 0.5 + 0.4 * Math.sin(clock * 2) ? CYAN : CYAND;
    put(x - 8 + i, y - 1 + j, c);
  }
  if ((clock * 1.5) & 1) put(x + (BL.dir > 0 ? 14 : -15), y, MAG);
}
function drawFarDetail(ox: number) {
  const lit = litFrac();
  for (let i = 0; i < farWindows.length; i++) { const f = farWindows[i]; put(f.x + ox, f.y, f.on && (i % 100) / 100 < lit ? f.c : BFAR); }
  if ((clock / 1.2) & 1) put(X + 163 + ox, -12, MAG);
  rect(0, 63, WW, 2, STEEL); rect(0, 63, WW, 1, WDIM);
  for (const px of [20, 100, 200, 270, 380, 460]) rect(px, 65, 3, 40, BMID);
}
function drawMidWindows() {
  const lit = litFrac();
  for (const w of midWindows) rect(w.x, w.y, w.w, w.h, w.rank < lit ? w.c : WDIM);
}
function drawTrain() {
  if (!TR.on) return;
  const x0 = Math.round(TR.x);
  for (let c = 0; c < 4; c++) {
    const cx = x0 + c * 38; rect(cx, 57, 36, 6, STEEL); rect(cx, 57, 36, 1, WDIM);
    for (let w = cx + 3; w < cx + 33; w += 4) { put(w, 59, LIGHT); put(w + 1, 59, LIGHT); put(w, 60, WWARM); put(w + 1, 60, WWARM); }
  }
  const nose = TR.dir > 0 ? x0 + 150 : x0 - 3;
  rect(nose, 58, 3, 4, STEEL); put(TR.dir > 0 ? nose + 2 : nose, 61, WHITE);
  if (S.dayK < 0.6) for (let i = 1; i < 22; i++) for (let j = 59; j < 63; j++) { const x = TR.dir > 0 ? nose + 2 + i : nose - i; if (bay(x, j) < 0.35 * (1 - i / 22)) put(x, j, HALO); }
}
function drawSigns() {
  for (const s of signs) {
    if (s.plate) rect(s.x + 1, s.y + 1, s.w - 2, s.h - 2, VOID);
    const lit = s.state, bc = lit ? s.col : s.dim;
    for (let i = 0; i < s.border.length; i += 2) put(s.border[i], s.border[i + 1], bc);
    for (let i = 0, k = 0; i < s.px.length; i += 2, k++) { const dead = s.gi[k] === s.dead && !s.sput; put(s.px[i], s.px[i + 1], lit && !dead ? s.col : s.dim); }
    for (let i = 0; i < s.px2.length; i += 2) put(s.px2[i], s.px2[i + 1], lit ? s.col2 : s.dim2);
  }
}
function drawInterior() {
  const x0 = X + 112;
  if (!S.stallOpen) {
    // rolled-down shutter
    rect(x0, 104, 100, 23, STEEL);
    for (let y = 105; y < 127; y += 2) rect(x0, y, 100, 1, BMID);
    rect(x0, 104, 100, 1, BNEAR); rect(x0 + 46, 112, 8, 3, BNEAR);
    return;
  }
  const glow = 1 - 0.45 * S.deep;
  for (let y = 104; y < 127; y++) for (let x = 112; x < 212; x++) {
    const d = Math.min(Math.abs(x - 140) + Math.abs(y - 105) * 1.5, Math.abs(x - 182) + Math.abs(y - 105) * 1.5);
    const k = glow * (1 - d / 62), b = BAY[((y & 3) << 2) | (x & 3)];
    put(X + x, y, k > b + 0.25 ? LIGHT : k > b - 0.35 ? AMBD : WOOD);
  }
  rect(X + 114, 112, 96, 1, WOOD);
  for (let x = 116; x < 208; x += 8) { rect(X + x, 110, 4, 2, WHITE); put(X + x, 110, STONEL); }
  for (let i = 0; i < 4; i++) { rect(X + 152 + i * 6, 105, 4, 4, WHITE); put(X + 153 + i * 6, 106, WWARM); put(X + 153 + i * 6, 107, WWARM); }
  put(X + 140, 104, VOID); put(X + 140, 105, WHITE); put(X + 182, 104, VOID); put(X + 182, 105, WHITE);
  rect(X + 133, 122, 10, 5, STEEL); rect(X + 132, 122, 12, 1, STONEL);
  spr(COOK_SPR, X + 160, 113, COOKM);
  const busy = S.busy > 0.35 || ((clock / 40) | 0) % 3 === 0;
  if (busy && (clock * 2.5) & 1) { put(X + 159, 119, VOID); put(X + 158, 120, VOID); put(X + 157, 120, VOID); }
  for (let i = 0; i < NST; i++) if (tLf[i] > 0) {
    const a = (tLf[i] / tMx[i]) * 0.75, x = tX[i] | 0, y = tY[i] | 0;
    for (let j = 0; j < 2; j++) if (bay(x + j, y) < a) put(x + j, y, WHITE);
  }
}
function drawStallFront() {
  const scan = 109 + (((clock * 4) | 0) % 14);
  for (let y = 107; y < 122; y++) for (let x = 219; x < 231; x++) {
    let c = y === scan ? CYAN : CYAND;
    if (vendFlash > 0) c = WHITE; else if ((x - 219) % 3 === 1 && (y - 107) % 4 === 1) c = [WCOOL, AMB, MAG][((x + y) >> 2) % 3];
    put(X + x, y, c);
  }
  if (vendSlot > 0) rect(X + 221, 133, 8, 2, WWARM);
  for (const lx of [116, 207]) {
    const on = S.stallOpen ? MAG : MAGD;
    rect(X + lx - 1, 105, 3, 4, on); put(X + lx - 1, 107, MAGD); put(X + lx + 1, 107, MAGD); put(X + lx, 104, VOID);
  }
}
function drawCat() {
  const flip = CAT.flip, ox = flip ? 2 : 0;
  if (CAT.mode === 'sleep') spr(CAT_SLEEP[((clock / 1.3) | 0) & 1], X + 192, 141, CATM, flip);
  else if (CAT.mode === 'stretch') spr(CAT_STRETCH, X + 190 - ox, 140, CATM, flip);
  else if (CAT.mode === 'groom') spr((clock * 3) & 1 ? CAT_GROOM : CAT_SIT[1], X + 194, 137, CATM, flip);
  else spr(CAT_SIT[((clock * 10) | 0) % 37 === 0 ? 1 : 0], X + 194, 137, CATM, flip);
}
function drawLamp() {
  const on = lampOn && S.lampOn, lx = X + 71;
  for (let x = X + 68; x < X + 74; x++) put(x, 73, on ? WHITE : BNEAR);
  if (!on) return;
  for (let dy = -10; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy * 1.2) / 12;
    if (d >= 1) continue;
    const c = getW(lx + dx, 75 + dy);
    if (c === 255 || !HALOOK[c]) continue;
    const k = (1 - d) * (1 - d) * 0.7, b = bay(sx(lx + dx), sy(75 + dy));
    if (b < k * 0.45) put(lx + dx, 75 + dy, HALO); else if (b < k) put(lx + dx, 75 + dy, AMBD);
  }
  const t8 = (clock * 8) | 0;
  for (let y = 76; y < 140; y++) {
    const w = 2 + (y - 74) * 0.3, k = 0.06 * (1 - (y - 74) / 75);
    for (let x = Math.round(lx - w); x <= Math.round(lx + w); x++) { const c = getW(x, y); if (c !== 255 && HALOOK[c] && bay(sx(x), sy(y) + t8) < k) put(x, y, HALO); }
  }
  for (let x = X + 52; x < X + 90; x++) {
    const k = 0.35 * (1 - Math.abs(x - lx) / 19);
    for (let y = 140; y < 146; y++) { const c = getW(x, y); if (c !== 255 && HALOOK[c] && bay(sx(x), sy(y)) < k) put(x, y, bay(sx(x), sy(y)) < k * 0.4 ? HALO : STONEL); }
  }
}
function drawDrone() {
  if (!DR.on) return;
  const x = Math.round(DR.x), y = Math.round(DR.y + Math.sin(DR.t * 3));
  rect(x - 2, y, 5, 1, STEEL); const r = (step >> 1) & 1; put(x - 3, y - 1 + r, WDIM); put(x + 3, y - r, WDIM);
  put(x, y + 1, (DR.t * 2) & 1 ? MAG : CYAN); if (DR.box) rect(x - 1, y + 2, 3, 2, WWARM);
}

const FOG_BANDS = [{ y: 96, h: 8, sp: 1.3 }, { y: 118, h: 6, sp: -0.8 }, { y: 152, h: 5, sp: 2.1 }];

function render() {
  const ox = Math.round(Math.sin(clock / 240) * 0.7);
  drawSky(HORIZON); drawLightning(); drawSearchlights([X + 44, X + 268], HORIZON);
  blitLayer(far, ox); drawFireworks(); drawBlimp(); drawFarDetail(ox); drawTrain();
  blitLayer(mid); drawMidWindows(); drawSnowCaps(midCaps); drawFarPrecip();
  drawInterior(); blitLayer(front); drawSnowCaps(frontCaps); drawStallFront(); drawSigns(); drawTree();
  drawCat(); drawPeople(); drawLamp(); drawDrone();
  drawStreet(street); groundSnow(140, 147); drawCars(); drawRipples(); drawFog(FOG_BANDS); drawNearPrecip();
}

let built = false;
export const rainCorner: Scene = {
  id: 'rain-corner',
  name: 'Esquina da chuva',
  build() {
    if (!built) {
      buildFar(); buildMid(); buildFront(); buildStreet(); buildTree(); buildSigns();
      // windows are drawn dynamically, so caps come from the static masses only
      midCaps = snowCaps(mid, wr); frontCaps = snowCaps(front, wr);
      built = true;
    }
    const tips = Array.from({ length: 18 }, (_, k) => ({ x: X + 110 + 6 * k, y: 104, end: 143 }));
    tips.push({ x: X + 70, y: 74, end: 143 });
    setLanes([{ y: 143 }, { y: 145 }]);
    setCarLanes(162, 177);
    configure({ roofs: [{ x0: X + 107, x1: X + 216, y: 96 }], tips, lamps: [{ x: X + 71, y: 70 }], ground0: 140, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() {
    const act: string[] = [];
    if (TR.on) act.push('train');
    const wk = peopleCount(); if (wk) act.push('people x' + wk);
    if (DR.on) act.push('drone'); if (BL.on) act.push('blimp'); if (lampFlick > 0) act.push('lamp flicker');
    act.push('cat:' + CAT.mode);
    return `active  ${act.join(', ')}\nrecent  ${recent.join(' | ')}`;
  },
};
