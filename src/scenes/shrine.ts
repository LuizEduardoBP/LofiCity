/* SHRINE: a Shinto shrine on the edge of the city. A vermilion torii, a hall with a
   curved roof and shimenawa rope, stone lanterns, pines on the hill, cherry and
   maple trees, fireflies on summer nights, lantern strings at festivals and crowds
   for hatsumode (first shrine visit) on New Year. The skyline glows behind it. */
import { L, Lp, WW, blitLayer, getW, newLayer, put, rect, snowCaps, sx, sy } from '../engine/gfx';
import { bay, mulberry32 } from '../engine/math';
import {
  AMB, AMBD, BFAR, BMID, BNEAR, CBEIGE, CRED, FARB, FWG, HALO, HALOOK, LEAFGD, LIGHT, SKY4, STEEL, STONE,
  STONEL, VOID, WCOOL, WHITE, WOOD, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { type Tree, drawTree, makeTree } from '../actors/trees';
import { S } from '../sky/state';
import { doyOf, inDoy } from '../sky/time';
import { drawFog, drawSky, drawSnowCaps, drawStreet, groundSnow, type Street } from './common';
import { director } from './director';
import { glyph } from './signs';
import type { Scene } from './types';

const HORIZON = 100, STREET = 147, SH = 180 - STREET;
const wr = mulberry32(0x5417), er = mulberry32(0x5418);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const farWins: { x: number; y: number; c: number; rank: number }[] = [];
let midCaps = new Float32Array(0), frontCaps = new Float32Array(0);
let backTrees: Tree[] = [], frontTrees: Tree[] = [];
let clock = 0;

function buildFar() {
  for (let x = -4; x < WW;) {
    const w = 12 + ((wr() * 22) | 0), top = -40 - ((wr() * 150) | 0);
    L(far, x, top, w, 140 - top, FARB);
    for (let wy = top + 4; wy < HORIZON; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (wr() < 0.25) Lp(far, wx, wy, SKY4);
    x += w + 6 + ((wr() * 10) | 0);
  }
  for (let x = -6; x < WW;) {
    const w = 10 + ((wr() * 22) | 0), top = 34 + ((wr() * 46) | 0);
    L(far, x, top, w, 140 - top, BFAR);
    for (let wy = top + 3; wy < HORIZON + 8; wy += 3) for (let wx = x + 2; wx < x + w - 1; wx += 2)
      if (wr() < 0.16) farWins.push({ x: wx, y: wy, c: wr() < 0.7 ? WWARM : WCOOL, rank: wr() });
    x += w + 1;
  }
}

function buildMid() {
  // wooded hill behind the hall
  for (let x = 200; x < WW; x++) {
    const top = Math.round(74 + Math.sin((x - 200) * 0.02) * -8 + Math.sin(x * 0.11) * 2);
    L(mid, x, top, 1, 140 - top, LEAFGD);
  }
  // hall (haiden): platform, walls, posts
  L(mid, 276, 122, 128, 6, WOOD); L(mid, 272, 128, 136, 4, STONE); L(mid, 268, 132, 144, 8, STONEL);
  L(mid, 284, 100, 112, 22, WOOD);
  for (let x = 290; x < 394; x += 6) L(mid, x, 104, 1, 16, BNEAR); // lattice doors
  L(mid, 284, 110, 112, 1, BNEAR);
  for (const px of [282, 302, 324, 356, 378, 396]) L(mid, px, 98, 3, 26, CRED);
  // curved roof: concave sides, eave at y 98, ridge at y 74
  for (let y = 74; y <= 98; y++) {
    const t = (y - 74) / 24, half = Math.round(34 + 38 * t * t);
    L(mid, 340 - half, y, half * 2, 1, y === 74 ? STEEL : y >= 97 ? VOID : BMID);
  }
  for (let y = 75; y < 97; y += 3) for (let x = 300; x < 380; x += 4) Lp(mid, x + ((y / 3) & 1) * 2, y, BNEAR);
  Lp(mid, 267, 96, VOID); Lp(mid, 266, 95, VOID); Lp(mid, 412, 96, VOID); Lp(mid, 413, 95, VOID); // upturned tips
  L(mid, 300, 72, 80, 2, STEEL); L(mid, 296, 70, 4, 4, STEEL); L(mid, 380, 70, 4, 4, STEEL);
  // offering box and bell rope
  L(mid, 328, 116, 24, 6, WOOD); L(mid, 328, 116, 24, 1, BNEAR);
  for (let y = 104; y < 118; y++) Lp(mid, 340, y, y % 3 ? CRED : WHITE);
}

function buildFront() {
  L(front, 0, 140, WW, 7, STONE); L(front, 0, 140, WW, 1, STONEL);
  for (let x = 4; x < WW; x += 14) L(front, x, 141, 10, 5, STONEL); // stone path slabs
  // torii
  const T0 = 150, T1 = 216;
  for (const px of [158, 205]) { L(front, px, 86, 4, 54, CRED); L(front, px - 1, 134, 6, 6, VOID); }
  L(front, T0 + 2, 93, T1 - T0 - 4, 3, CRED);
  L(front, T0 - 4, 84, T1 - T0 + 8, 3, CRED); L(front, T0 - 6, 82, T1 - T0 + 12, 2, VOID);
  Lp(front, T0 - 7, 81, VOID); Lp(front, T0 - 8, 80, VOID); Lp(front, T1 + 6, 81, VOID); Lp(front, T1 + 7, 80, VOID);
  L(front, 180, 87, 8, 6, VOID);
  // stone lanterns
  for (const lx of [112, 238, 430]) {
    L(front, lx - 4, 136, 9, 4, STONE); L(front, lx - 1, 126, 3, 10, STONEL); L(front, lx - 3, 124, 7, 2, STONE);
    L(front, lx - 3, 118, 7, 6, STONEL); L(front, lx - 5, 116, 11, 2, STONE); L(front, lx - 3, 115, 7, 1, STONE); Lp(front, lx, 113, STONE); Lp(front, lx, 114, STONE);
  }
  // shimenawa posts at the hall
  L(front, 278, 100, 2, 40, WOOD); L(front, 400, 100, 2, 40, WOOD);
}

function buildGround() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const q = wr(); street.base[d * WW + x] = q < 0.12 ? STONEL : q < 0.16 ? BMID : STONE; }
  for (let p = 0; p < 6; p++) {
    const cx = wr() * WW, cy = 3 + wr() * (SH - 6), rx = 10 + wr() * 22, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic passes ----------
const PLAQUE = glyph(mulberry32(0x7071));
function festival() {
  const { doy, hour, month } = S.cal;
  const newYear = inDoy(doy, doyOf(0, 0), doyOf(0, 6));
  const summer = (month === 6 || month === 7) && hour >= 17 && hour < 23;
  return { strings: newYear || month === 6 || month === 7, lit: newYear || summer || S.fireworks, crowd: inDoy(doy, doyOf(0, 0), doyOf(0, 2)) ? 3 : summer ? 2 : 0.5 };
}

function drawPlaque() {
  for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (PLAQUE[j * 5 + i]) put(181 + i, 86 + j, S.dayK < 0.5 ? AMB : CBEIGE);
}

function stoneLight(lx: number) {
  const on = S.dayK < 0.5;
  rect(lx - 2, 119, 5, 4, on ? (((clock * 3 + lx) | 0) % 7 ? LIGHT : AMB) : VOID);
  if (!on) return;
  for (let j = -8; j < 10; j++) for (let i = -9; i < 10; i++) {
    const d = Math.hypot(i, j * 1.2) / 10, c = getW(lx + i, 120 + j);
    if (d < 1 && c !== 255 && HALOOK[c] && bay(sx(lx + i), sy(120 + j)) < 0.35 * (1 - d)) put(lx + i, 120 + j, d < 0.4 ? HALO : AMBD);
  }
}

function drawShimenawa() {
  for (let x = 280; x < 400; x++) {
    const y = Math.round(101 + Math.sin(((x - 280) / 120) * Math.PI) * 4);
    put(x, y, CBEIGE); put(x, y + 1, CBEIGE); if (x % 3 === 0) put(x, y + 1, WOOD);
    if ((x - 286) % 16 === 0) for (let k = 0; k < 5; k++) put(x + (k & 1), y + 2 + k, WHITE);
  }
  // hanging lanterns at the eaves
  for (const lx of [292, 384]) {
    const on = S.dayK < 0.5;
    rect(lx, 99, 1, 2, VOID); rect(lx - 2, 101, 5, 7, on ? LIGHT : WHITE); rect(lx - 2, 103, 5, 1, CRED); rect(lx - 2, 106, 5, 1, CRED);
  }
}

function drawLanternStrings(lit: boolean) {
  const runs: [number, number][] = [[0, 150], [216, 280]];
  for (const [a, b] of runs) {
    for (let x = a; x < b; x++) put(x, Math.round(96 + Math.sin(((x - a) / (b - a)) * Math.PI) * 6), VOID);
    for (let x = a + 6; x < b - 4; x += 10) {
      const y = Math.round(97 + Math.sin(((x - a) / (b - a)) * Math.PI) * 6);
      rect(x - 1, y, 3, 4, lit ? (x % 20 === 6 ? LIGHT : AMB) : x % 20 === 6 ? WHITE : CRED);
      put(x, y + 4, lit ? AMBD : CRED);
    }
  }
}

// fireflies on early-summer nights near the trees
const FF = Array.from({ length: 44 }, () => ({ x: wr() * WW, y: 104 + wr() * 38, ph: wr() * 6.28, sp: 0.5 + wr() }));
function drawFireflies() {
  const { doy } = S.cal;
  if (!inDoy(doy, doyOf(5, 1), doyOf(6, 20)) || S.dayK > 0.25 || S.rain > 0.1) return;
  for (const f of FF) {
    f.ph += 0.016 * f.sp;
    const x = f.x + Math.sin(f.ph * 1.3) * 14, y = f.y + Math.sin(f.ph * 0.9) * 8;
    const b = Math.sin(f.ph * 3 + f.x);
    if (b > 0.1) {
      put(x, y, b > 0.6 ? LIGHT : FWG);
      if (b > 0.6) { put(x + 1, y, FWG); put(x - 1, y, FWG); put(x, y - 1, FWG); put(x, y + 1, FWG); }
    }
  }
}

function drawWindows() {
  const lit = S.dayK > 0.5 ? 1 : S.cal.hour >= 17 || S.cal.hour < 1 ? 0.75 : 0.3;
  for (const f of farWins) put(f.x, f.y, f.rank < lit ? f.c : BFAR);
}

const ev = director([{ id: 'window', cd: 3, w: () => 2, run: () => { const w = farWins[(er() * farWins.length) | 0]; if (w) w.rank = er(); } }], er);

function update(dt: number) {
  clock += dt;
  ev.tick(dt);
  tickSpawns(dt, festival().crowd); updatePeople(dt);
}

const FOG = [{ y: 90, h: 10, sp: 0.6 }, { y: 124, h: 7, sp: -0.5 }, { y: 155, h: 5, sp: 1.2 }];
function render() {
  const fest = festival();
  drawSky(HORIZON); drawLightning();
  blitLayer(far); drawWindows(); drawFireworks();
  blitLayer(mid); for (const t of backTrees) drawTree(t);
  drawShimenawa(); drawSnowCaps(midCaps); drawFarPrecip();
  blitLayer(front); drawPlaque(); drawSnowCaps(frontCaps);
  for (const lx of [112, 238, 430]) stoneLight(lx);
  if (fest.strings) drawLanternStrings(fest.lit && S.dayK < 0.6);
  for (const t of frontTrees) drawTree(t);
  drawPeople(); drawFireflies();
  drawStreet(street); groundSnow(140, 147); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const shrine: Scene = {
  id: 'shrine',
  name: 'Santuário',
  build() {
    if (!built) {
      buildFar(); buildMid(); buildFront(); buildGround();
      backTrees = [makeTree(250, 112, 1.1, wr, 'pine'), makeTree(430, 104, 1.25, wr, 'pine'), makeTree(460, 120, 0.9, wr, 'pine'), makeTree(226, 128, 0.8, wr, 'maple')];
      frontTrees = [makeTree(100, 140, 1.15, wr, 'sakura'), makeTree(440, 140, 1.0, wr, 'sakura'), makeTree(30, 140, 1.2, wr, 'maple')];
      midCaps = snowCaps(mid, wr); frontCaps = snowCaps(front, wr);
      built = true;
    }
    setLanes([{ y: 143 }, { y: 145 }]);
    configure({ roofs: [{ x0: 268, x1: 412, y: 98 }, { x0: 144, x1: 222, y: 82 }], tips: [{ x: 268, y: 98, end: 140 }, { x: 411, y: 98, end: 140 }], lamps: [], ground0: 140, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { const f = festival(); return `active  people x${peopleCount()}  crowd ${f.crowd}  strings ${f.strings}\nrecent  ${ev.recent.join(' | ')}`; },
};
