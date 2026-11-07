/* PRAÇA DA CULTURA (Praça da Cultura Francisco Souto Neto, Esperança, PB): the town's
   postcard square. Pink block paving, wide blue steps down to the street, the lit
   "EU ♥ ESPERANÇA" letters, round trees with yellow-painted beds, LED lamp posts, and behind
   it the yellow front of the old Ginásio Diocesano with its curved gable, next to colourful
   geometric tile panels. Craft fairs fill it with white tents; in Holy Week it hosts the
   Paixão de Cristo; at Christmas the trees and the gable are outlined with lights. */
import { L, Lp, WW, blitLayer, newLayer, put, rect } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  ASPH, BFAR, BNEAR, CBEIGE, CBLUE, CGREEN, CRED, CYELL, FBLUE, FPINK, LEAFG, LEDW, LIGHT, AMB, MAG, STEEL,
  STONE, STONEL, VOID, WHITE, WOOD, WWARM, TILEW, SKIN2, HAIR1,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { type Tree, drawTree, makeTree } from '../actors/trees';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import {
  type Lamp, type Opening, type Palm, bandeirolas, bulbs, casa, drawOpenings, drawPalm, easterDoy, isNight, lampLight,
  lampPost, text, textW,
} from './br-kit';
import type { Scene } from './types';

const HORIZON = 112, STREET = 147, SH = 180 - STREET, CX = 240;
const wr = mulberry32(0xc017);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const farWins: { x: number; y: number; rank: number }[] = [];
const LAMPS: Lamp[] = [{ x: 132, top: 70, ground: 140, arms: 2 }, { x: 318, top: 70, ground: 140, arms: 2 }];
const PALMS: Palm[] = [{ x: 30, ground: 140, h: 66, lean: 4, ph: 1 }, { x: 470, ground: 140, h: 72, lean: -5, ph: 3 }];
const LETTERS = { str: 'EU ♥ ESPERANÇA', x: 346, y: 124, s: 2 };
let trees: Tree[] = [], opens: Opening[] = [];
const ginasioWins: { x: number; y: number }[] = [];

function buildFar() {
  for (let x = -4; x < WW;) {
    const w = 14 + ((wr() * 22) | 0), top = 88 + ((wr() * 18) | 0);
    L(far, x, top, w, 140 - top, BFAR);
    for (let wy = top + 3; wy < 112; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (wr() < 0.14) farWins.push({ x: wx, y: wy, rank: wr() });
    x += w + ((wr() * 3) | 0);
  }
}

/** The old Ginásio Diocesano: long yellow front, white trim, curved central gable. */
function buildGinasio() {
  const x0 = 164, x1 = 316, top = 100;
  L(mid, x0, top, x1 - x0, 40, CYELL);
  L(mid, x0 - 1, top - 2, x1 - x0 + 2, 3, TILEW); L(mid, x0, top + 18, x1 - x0, 1, TILEW); L(mid, x0, 137, x1 - x0, 3, TILEW);
  for (const px of [x0, x0 + 34, CX - 18, CX + 16, x1 - 36, x1 - 2]) L(mid, px, top, 2, 40, TILEW);
  // central bay rising into a rounded gable with an oculus
  L(mid, CX - 16, top - 14, 32, 14, CYELL);
  for (let i = -18; i <= 18; i++) { const y = Math.round(top - 14 - Math.sqrt(Math.max(0, 1 - (i / 18) ** 2)) * 9); L(mid, CX + i, y, 1, top - 14 - y + 1, CYELL); Lp(mid, CX + i, y, TILEW); }
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (i * i + j * j <= 9) Lp(mid, CX + i, top - 15 + j, i * i + j * j > 4 ? TILEW : BNEAR);
  L(mid, CX - 18, top - 14, 36, 1, TILEW);
  // arched door with steps
  for (let j = 0; j < 22; j++) for (let i = 0; i < 12; i++) { const r = 6, dy = j - r; if (j < r && (i + 0.5 - r) ** 2 + dy * dy > r * r) continue; Lp(mid, CX - 6 + i, 115 + j, j < 1 || i < 1 || i > 10 ? TILEW : WOOD); }
  // windows (two rows)
  for (const row of [104, 122]) for (let wx = x0 + 6; wx < x1 - 6; wx += 9) {
    if (wx > CX - 22 && wx < CX + 18) continue;
    L(mid, wx - 1, row - 1, 6, 11, TILEW); ginasioWins.push({ x: wx, y: row });
  }
}

/** Geometric tile panels (multicoloured diamonds) like the ones flanking the old school. */
function tilePanel(x: number, y: number, w: number, h: number) {
  const C = [CRED, CYELL, CBLUE, CGREEN, TILEW, FPINK];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = (i % 8) - 4, v = (j % 8) - 4, cell = ((i >> 3) + (j >> 3) * 3) % C.length;
    Lp(mid, x + i, y + j, Math.abs(u) + Math.abs(v) <= 3 ? C[cell] : Math.abs(u) + Math.abs(v) === 4 ? TILEW : C[(cell + 3) % C.length]);
  }
  L(mid, x - 1, y - 1, w + 2, 1, TILEW); L(mid, x - 1, y + h, w + 2, 1, TILEW);
}

function buildSides() {
  opens = [
    ...casa(mid, 0, 50, 40, 140, FBLUE, WHITE, 'reta', false, wr),
    ...casa(mid, 52, 60, 46, 140, TILEW, CBLUE, 'escada', true, wr),
    ...casa(mid, 352, 64, 44, 140, FBLUE, WHITE, 'balaustre', false, wr),
    ...casa(mid, 418, 62, 36, 140, CBEIGE, WHITE, 'deco', true, wr),
  ];
  text(mid, 'BIBLIOTECA', 82 - (textW('BIBLIOTECA') >> 1), 98, CBLUE);
  tilePanel(114, 112, 48, 24); tilePanel(318, 112, 32, 24);
}

function buildFront() {
  // pink block paving with a yellow-edged walkway
  for (let y = 140; y < 147; y++) for (let x = 0; x < WW; x++) Lp(front, x, y, (x + (y % 2) * 2) % 4 === 0 ? CRED : FPINK);
  L(front, 0, 140, WW, 1, CYELL);
  // blue steps down to the street in the middle
  for (let k = 0; k < 3; k++) { L(front, 170 + k * 3, 141 + k * 2, 140 - k * 6, 2, k % 2 ? FBLUE : CBLUE); L(front, 170 + k * 3, 141 + k * 2, 140 - k * 6, 1, TILEW); }
  // raised beds with yellow edges
  for (const [x, w] of [[64, 44], [200, 24], [258, 24], [380, 46]] as const) { L(front, x, 136, w, 4, LEAFG); L(front, x, 139, w, 1, CYELL); L(front, x - 1, 136, 1, 4, CYELL); L(front, x + w, 136, 1, 4, CYELL); }
  for (const x of [110, 284]) { L(front, x, 134, 18, 2, STONEL); L(front, x + 1, 136, 2, 4, STONE); L(front, x + 15, 136, 2, 4, STONE); } // benches
  for (const l of LAMPS) lampPost(front, l);
  // "EU ♥ ESPERANÇA" letters on little feet
  const { str, x, y, s } = LETTERS;
  text(front, str, x + 1, y + 1, BNEAR, s, BNEAR); text(front, str, x + 2, y + 2, VOID, s, VOID); // depth so the letters read over the beds
  text(front, str, x, y, WHITE, s, CRED);
  L(front, x - 2, y + 11, textW(str, s) + 4, 2, STONEL);
}

function buildGround() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) street.base[d * WW + x] = wr() < 0.08 ? STONE : ASPH;
  for (let x = 30; x < WW; x += 34) for (let d = 3; d < 13; d++) street.base[d * WW + x] = STONEL; // parking bays
  for (let p = 0; p < 5; p++) {
    const cx = wr() * WW, cy = 2 + wr() * (SH - 4), rx = 8 + wr() * 16, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- calendar ----------
const paixao = () => { const e = easterDoy(S.cal.year), d = S.cal.doy; return (d === e - 3 || d === e - 2) && hourIn(S.cal.hour, 18.5, 22); };
const feira = () => S.cal.weekday === 6 && S.cal.day <= 7 && hourIn(S.cal.hour, 8.5, 17);
const weekendNight = () => (S.cal.weekday === 5 || S.cal.weekday === 6) && hourIn(S.cal.hour, 19, 24);

// ---------- dynamic ----------
function lit() {
  const n = isNight(), t = S.ms / 1000;
  for (const f of farWins) put(f.x, f.y, n && f.rank < 0.45 ? WWARM : BFAR);
  for (const w of ginasioWins) rect(w.x, w.y, 4, 9, n && (w.x * 7 + w.y) % 5 < 2 ? WWARM : BNEAR);
  drawOpenings(opens, hourIn(S.cal.hour, 8, 18) && S.cal.weekday !== 0);
  // Christmas: lights along the gable and roofline
  if (S.natal && n) {
    for (let x = 164; x < 316; x += 3) put(x, 98, ((x + ((t * 3) | 0)) % 9) ? LIGHT : AMB);
    for (let i = -18; i <= 18; i += 2) put(CX + i, Math.round(86 - Math.sqrt(Math.max(0, 1 - (i / 18) ** 2)) * 9) - 1, LIGHT);
  }
}

/** Fairy lights wound round the tree trunks (festive nights). */
function trunkLights() {
  if (!isNight() || !(S.natal || S.festa || S.saoJoao || weekendNight())) return;
  const t = S.ms / 1000;
  for (const tr of trees) {
    const [tx, ty, tw, th] = tr.trunk;
    for (let y = ty; y < ty + th; y += 2) put(tx + (((y >> 1) & 1) ? tw - 1 : 0), y, ((y + ((t * 4) | 0)) % 6) ? AMB : LIGHT);
  }
}

function fair() {
  if (!feira()) return;
  for (const x of [56, 92, 128]) {
    for (let j = 0; j < 8; j++) { const half = Math.round(2 + j * 1.6); rect(x + 12 - half, 116 + j, half * 2, 1, WHITE); }
    rect(x, 124, 24, 2, WHITE); rect(x, 126, 1, 14, STEEL); rect(x + 23, 126, 1, 14, STEEL);
    rect(x + 3, 133, 18, 2, WOOD); for (let i = 0; i < 6; i++) rect(x + 4 + i * 3, 131, 2, 2, [CRED, CYELL, CBLUE, CGREEN, FPINK, WHITE][(i + x) % 6]);
  }
  // truss with the fair banner
  rect(160, 104, 1, 36, STEEL); rect(196, 104, 1, 36, STEEL); rect(160, 104, 37, 9, WHITE);
  text(null, 'ARTESANATO', 162, 106, CRED);
}

/** Holy Week: the Paixão de Cristo staged in front of the old school. */
function passion() {
  if (!paixao()) return;
  const n = isNight();
  rect(CX - 34, 132, 68, 8, VOID); rect(CX - 34, 132, 68, 1, STONEL);
  rect(CX - 1, 104, 3, 28, WOOD); rect(CX - 9, 110, 19, 3, WOOD);
  for (const [dx, robe] of [[-24, CRED], [-14, WHITE], [12, CBLUE], [22, WHITE]] as const) {
    rect(CX + dx, 120, 4, 12, robe); rect(CX + dx, 116, 4, 4, SKIN2); rect(CX + dx, 115, 4, 2, HAIR1);
  }
  if (n) for (let y = 104; y < 132; y++) for (let x = CX - 30; x < CX + 30; x++) if (((x * 3 + y * 7) & 7) === 0) put(x, y, LIGHT); // stage lights
}

function update(dt: number) {
  const k = paixao() ? 5 : feira() ? 2.6 : weekendNight() ? 2.2 : S.festa || S.saoJoao ? 2 : 1.2;
  tickSpawns(dt, k); updatePeople(dt); updateCars(dt, 0.7);
}

const FOG = [{ y: 106, h: 9, sp: 0.5 }, { y: 140, h: 6, sp: -0.4 }];
function render() {
  drawSky(HORIZON); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid); lit(); drawFarPrecip();
  for (const tr of trees) drawTree(tr);
  trunkLights();
  blitLayer(front);
  if (isNight()) { const { str, x, y, s } = LETTERS; text(null, str, x, y, LEDW, s, Math.sin(S.ms / 500) > -0.7 ? MAG : CRED); } // letters glow, heart in pink neon
  for (const p of PALMS) drawPalm(p);
  for (const l of LAMPS) lampLight(l);
  fair(); passion();
  if (S.festa || S.saoJoao) { bandeirolas(132, 72, 318, 72, 14, 2); bulbs(0, 80, 132, 72, 6); bulbs(318, 72, 480, 80, 6); }
  drawPeople();
  drawStreet(street); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const pracaCultura: Scene = {
  id: 'praca-cultura',
  name: 'Praça da Cultura',
  build() {
    if (!built) {
      buildFar(); buildGinasio(); buildSides(); buildFront(); buildGround();
      trees = [makeTree(86, 138, 1.05, wr, 'street'), makeTree(212, 138, 0.8, wr, 'street'), makeTree(270, 138, 0.8, wr, 'street'), makeTree(403, 138, 1.1, wr, 'street')];
      built = true;
    }
    setLanes([{ y: 142 }, { y: 144 }, { y: 146 }]);
    setCarLanes(160, 174, 'br');
    configure({ roofs: [{ x0: 164, x1: 316, y: 98 }], tips: [{ x: 165, y: 99, end: 140 }, { x: 315, y: 99, end: 140 }], lamps: LAMPS.map((l) => ({ x: l.x, y: l.top })), ground0: 140, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}  feira ${feira()}  paixão ${paixao()}  fim de semana ${weekendNight()}`; },
};

