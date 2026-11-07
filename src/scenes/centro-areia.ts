/* CENTRO HISTÓRICO DE AREIA (Areia, PB): the listed colonial town on top of the Brejo, cool and
   often wrapped in mist. Colourful two-storey casario with tall doors, arched windows, green
   shutters and iron balconies; the ornate Câmara Municipal in cream and red; the Teatro
   Minerva (1859, the first theatre in Paraíba); a cachaça shop, since the town is known for
   its engenhos; the white tower of the Matriz behind; green hills fading into fog; a cobbled
   street lit by colonial lanterns. */
import { L, Lp, type Layer, WW, blitLayer, newLayer, rect } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  BFAR, BNEAR, CBLUE, CGREEN, CHURCH, CHURCHD, CHURCHL, CRED, CYELL, FBLUE, FGREEN, FLILAC, FORNG, FPINK, GOLD,
  LEAFGD, STEEL, STONE, STONEL, TILEW, VOID, WCOOL, WOOD, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { type Tree, drawTree, makeTree } from '../actors/trees';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { bandeirolas, christmasStar, cobbles, isNight, lantern, text, textW } from './br-kit';
import type { Scene } from './types';

const HORIZON = 104, STREET = 147, SH = 180 - STREET;
const wr = mulberry32(0xa4e1a);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
interface Win { x: number; y: number; w: number; h: number; rank: number; door: boolean }
const wins: Win[] = [];
const LANTERNS: [number, number][] = [[44, 112], [150, 108], [262, 112], [372, 110], [452, 112]];
let trees: Tree[] = [];

function buildHills() {
  // layered Brejo hills, nearest darkest, with the Matriz tower on the town's crest
  for (const [base, amp, f, c] of [[78, 12, 0.012, BFAR], [92, 9, 0.02, LEAFGD]] as const)
    for (let x = 0; x < WW; x++) { const top = Math.round(base + Math.sin(x * f + base) * amp + Math.sin(x * f * 3.1) * amp * 0.3); L(far, x, top, 1, 130 - top, c); }
  const tx = 330; L(far, tx, 52, 10, 50, TILEW); L(far, tx + 9, 52, 1, 50, STONEL); L(far, tx + 3, 58, 4, 7, VOID);
  for (let y = 0; y < 10; y++) { const h = Math.round(5 * (1 - y / 10)); L(far, tx + 5 - h, 51 - y, h * 2, 1, TILEW); }
  L(far, tx + 4, 36, 2, 6, STEEL); L(far, tx + 2, 38, 6, 1, STEEL);
}

/** Arched window with green shutters; `balcony` adds a wrought-iron sacada. */
function window_(ly: Layer, x: number, y: number, frame: number, balcony: boolean, door = false) {
  const w = 6, h = door ? 18 : 12;
  L(ly, x - 1, y - 1, w + 2, h + 1, frame);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (j < 2 && (i === 0 || i === w - 1)) continue; Lp(ly, x + i, y + j, door ? WOOD : BNEAR); }
  if (!door) { L(ly, x - 2, y + 2, 1, h - 2, CGREEN); L(ly, x + w + 1, y + 2, 1, h - 2, CGREEN); } // shutters
  if (balcony) { L(ly, x - 3, y + h, w + 6, 1, VOID); for (let i = x - 3; i < x + w + 3; i += 2) L(ly, i, y + h - 3, 1, 3, VOID); L(ly, x - 3, y + h - 4, w + 6, 1, VOID); }
  wins.push({ x, y: y + 2, w, h: h - 2, rank: wr(), door });
}

/** A two-storey colonial house: plinth, cornice, ornate platibanda with urns. */
function sobrado(x: number, w: number, h: number, wall: number, frame: number, plat: 'urnas' | 'frontao' | 'reta') {
  const top = 140 - h;
  L(mid, x, top, w, h, wall); L(mid, x, 136, w, 4, frame === TILEW ? STONEL : frame);
  L(mid, x - 1, top, w + 2, 2, frame); L(mid, x, top + Math.round(h / 2), w, 1, frame);
  L(mid, x, top - 5, w, 5, wall); L(mid, x - 1, top - 6, w + 2, 1, frame);
  if (plat === 'urnas') for (let ux = x + 3; ux < x + w - 2; ux += Math.max(8, Math.floor(w / 4))) { L(mid, ux, top - 9, 3, 3, frame); Lp(mid, ux + 1, top - 10, frame); }
  if (plat === 'frontao') for (let i = 0; i < 8; i++) L(mid, x + w / 2 - 8 + i, top - 6 - i, 16 - i * 2, 1, i === 7 ? frame : wall);
  const n = Math.max(2, Math.floor((w - 4) / 11)), gap = (w - n * 6) / (n + 1);
  for (let i = 0; i < n; i++) {
    const wx = Math.round(x + gap + i * (6 + gap));
    window_(mid, wx, top + 6, frame, wr() < 0.6);
    window_(mid, wx, top + Math.round(h / 2) + 3, frame, false, i === Math.floor(n / 2));
  }
}

function buildTown() {
  sobrado(0, 40, 44, FBLUE, TILEW, 'urnas');
  sobrado(42, 46, 48, CYELL, TILEW, 'frontao');
  // Câmara Municipal: cream with red frames, ornate parapet with an emblem and its name
  const cx = 92, cw = 76, ct = 140 - 52;
  L(mid, cx, ct, cw, 52, CHURCHL); L(mid, cx, 136, cw, 4, CRED); L(mid, cx - 1, ct, cw + 2, 2, CRED); L(mid, cx, ct + 26, cw, 1, CRED);
  L(mid, cx, ct - 8, cw, 8, CHURCHL); L(mid, cx - 1, ct - 9, cw + 2, 1, CRED);
  for (let i = 0; i < 10; i++) L(mid, cx + cw / 2 - 10 + i, ct - 9 - i, 20 - i * 2, 1, i > 7 ? CRED : CHURCHL);
  L(mid, cx + cw / 2 - 2, ct - 15, 4, 4, GOLD); for (const ux of [cx + 2, cx + cw - 5]) { L(mid, ux, ct - 13, 3, 4, CRED); Lp(mid, ux + 1, ct - 14, CRED); }
  text(mid, 'CAMARA MUNICIPAL', cx + (cw - textW('CAMARA MUNICIPAL')) / 2, ct - 6, CRED);
  for (let i = 0; i < 5; i++) { const wx = cx + 6 + i * 14; window_(mid, wx, ct + 6, CRED, i % 2 === 0); window_(mid, wx, ct + 30, CRED, false, i === 2); }
  // Teatro Minerva: small neoclassical front with pilasters, pediment and three arched doors
  const tx = 172, tw = 64, tt = 140 - 46;
  L(mid, tx, tt, tw, 46, CHURCH); L(mid, tx, 136, tw, 4, CHURCHD);
  for (const px of [tx, tx + 20, tx + 42, tx + tw - 4]) L(mid, px, tt, 4, 46, CHURCHL);
  L(mid, tx - 2, tt - 2, tw + 4, 3, CHURCHL);
  for (let i = 0; i < 12; i++) L(mid, tx + 2 + i * 2.5, tt - 3 - i, tw - 4 - i * 5, 1, i === 0 ? CHURCHL : CHURCH);
  L(mid, tx + tw / 2 - 10, tt - 3 - 12, 20, 1, CHURCHL);
  text(mid, 'TEATRO MINERVA', tx + (tw - textW('TEATRO MINERVA')) / 2, tt + 4, WOOD);
  for (const dx of [8, 28, 49]) window_(mid, tx + dx, tt + 20, CHURCHL, false, true);
  sobrado(240, 44, 42, FGREEN, TILEW, 'reta');
  sobrado(286, 40, 46, FPINK, TILEW, 'urnas');
  // cachaça shop
  sobrado(328, 52, 40, FORNG, TILEW, 'frontao');
  L(mid, 334, 98, 40, 9, WOOD); text(mid, 'CACHAÇA', 354 - (textW('CACHAÇA') >> 1), 100, CYELL);
  sobrado(382, 46, 48, FLILAC, TILEW, 'urnas');
  sobrado(430, 50, 44, TILEW, CBLUE, 'reta');
}

function buildStreet() {
  L(front, 0, 140, WW, 7, STONE); L(front, 0, 140, WW, 1, STONEL); L(front, 0, 146, WW, 1, BNEAR);
  cobbles(street.base, SH, WW, wr);
  for (let p = 0; p < 6; p++) {
    const cx = wr() * WW, cy = 2 + wr() * (SH - 4), rx = 6 + wr() * 14, ry = 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic ----------
function lights() {
  const n = isNight(), late = S.cal.hour >= 22 || S.cal.hour < 5 ? 0.2 : 0.55, t = S.ms / 1000;
  for (const w of wins) {
    if (w.door) { if (n && w.rank < 0.25 && hourIn(S.cal.hour, 18, 22)) rect(w.x + 1, w.y + 4, w.w - 2, w.h - 4, WWARM); continue; }
    const lit = n && w.rank < late;
    if (lit) { const tv = w.rank < 0.1 && Math.sin(t * 6 + w.x) > 0; rect(w.x, w.y, w.w, w.h, tv ? WCOOL : WWARM); rect(w.x + 2, w.y, 1, w.h, WOOD); }
  }
  for (const [x, y] of LANTERNS) lantern(x, y);
}

function update(dt: number) {
  updateAnimals(dt);
  tickSpawns(dt, S.saoJoao && S.cal.hour >= 18 ? 2 : 1); updatePeople(dt); updateCars(dt, 0.6);
}

const FOG = [{ y: 90, h: 14, sp: 0.35 }, { y: 116, h: 10, sp: -0.3 }, { y: 142, h: 6, sp: 0.5 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid); lights(); drawFarPrecip();
  for (const tr of trees) drawTree(tr);
  blitLayer(front);
  if (S.saoJoao) { bandeirolas(0, 78, 240, 84, 14, 1); bandeirolas(240, 84, 480, 78, 14, 4); }
  if (S.natal) for (const [x, y] of LANTERNS) christmasStar(x, y - 12, 0.8);
  drawAnimalsPerched(); drawPeople(); drawAnimalsGround();
  drawStreet(street); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const centroAreia: Scene = {
  id: 'centro-areia',
  name: 'Centro Histórico',
  build() {
    if (!built) {
      buildHills(); buildTown(); buildStreet();
      trees = [makeTree(20, 140, 0.75, wr, 'street'), makeTree(238, 140, 0.7, wr, 'street'), makeTree(428, 140, 0.8, wr, 'street')];
      built = true;
    }
    setLanes([{ y: 143 }, { y: 145 }]);
    setupAnimals({ ground: [143, 145], dogs: 2, sleepSpots: [120, 300], lamps: LANTERNS.map(([x, y]) => ({ x, y })),
      walls: [{ x0: 0, x1: 40, y: 90 }, { x0: 240, x1: 284, y: 92 }, { x0: 430, x1: 480, y: 90 }] });
    setCarLanes(161, 174, 'br');
    configure({ roofs: [{ x0: 0, x1: WW, y: 86 }], tips: [{ x: 91, y: 88, end: 140 }, { x: 237, y: 94, end: 140 }], lamps: LANTERNS.map(([x, y]) => ({ x, y })), ground0: 140, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}`; },
};

