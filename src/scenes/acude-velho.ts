/* AÇUDE VELHO (Campina Grande, PB): the old reservoir in the middle of the city. On the far
   shore the dark glass drums of the Museu de Arte Popular da Paraíba (Niemeyer's last work in
   the state, the "Museu dos Três Pandeiros") stand over the water on a white ramp, royal palms
   line the bank and the high-rises of Campina rise behind, all mirrored in the water. Joggers
   and cyclists circle the lake; in June the city of the Maior São João lights up. */
import { L, Lp, WW, blitLayer, newLayer, put, rect } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  ASPH, BFAR, BNEAR, CBEIGE, CRED, CYAN, CYELL, FBLUE, FPINK, GOLD, LEAFGD, STEEL, STONE, STONEL, TILEW, VOID, WOOD, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { S } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { type Lamp, type Palm, type TowerWin, bandeirolas, drawPalm, drawTowerWins, isNight, lampLight, lampPost, tower, water } from './br-kit';
import type { Scene } from './types';

const HORIZON = 110, STREET = 150, SH = 180 - STREET, SHORE = 116, BANK = 140;
const wr = mulberry32(0xcafe);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const wins: TowerWin[] = [];
const LAMPS: Lamp[] = [{ x: 90, top: 92, ground: 147, arms: 1 }, { x: 250, top: 92, ground: 147, arms: 1 }, { x: 410, top: 92, ground: 147, arms: 1 }];
const PALMS: Palm[] = [70, 104, 300, 330, 362, 448].map((x, i) => ({ x, ground: SHORE, h: 34 + (i % 3) * 4, lean: 0, ph: i * 1.3, imperial: true }));

function buildFar() {
  // Campina's skyline: slabs of different heights, one white with a red band
  const spec: [number, number, number, number, number | null][] = [
    [8, 26, 44, TILEW, null], [40, 18, 70, STONEL, null], [62, 22, 18, TILEW, CRED], [92, 16, 60, CBEIGE, null], [114, 20, 36, STONEL, null],
    [196, 18, 54, TILEW, null], [218, 24, 6, TILEW, CRED], [248, 16, 40, STONEL, null], [270, 20, 24, CBEIGE, null],
    [340, 22, 30, TILEW, null], [368, 18, 58, STONEL, null], [392, 26, 14, TILEW, CRED], [424, 18, 48, CBEIGE, null], [448, 24, 66, STONEL, null],
  ];
  for (const [x, w, top, c, band] of spec) tower(far, x, w, top, SHORE, c, band, wr, wins);
  for (let x = -4; x < WW;) { const w = 10 + ((wr() * 16) | 0), top = 98 + ((wr() * 10) | 0); L(far, x, top, w, SHORE - top, BFAR); x += w + 2; }
}

/** The museum: three dark glass drums on stilts over the water, joined by a white ramp. */
function buildMuseum() {
  const drums: [number, number][] = [[150, 30], [186, 26], [218, 22]];
  for (const [cx, w] of drums) {
    const top = 86, bot = 106;
    for (let y = top; y < bot; y++) for (let x = cx - w / 2; x < cx + w / 2; x++) {
      const u = (x - (cx - w / 2)) / w; // glass reflects the sky in vertical bands
      Lp(mid, Math.round(x), y, u < 0.12 || u > 0.9 ? VOID : (Math.floor(u * 9) % 3 === 0 ? FBLUE : BNEAR));
    }
    L(mid, cx - w / 2, top - 1, w, 1, TILEW); L(mid, cx - w / 2, bot, w, 2, TILEW);
    for (const px of [cx - w / 3, cx, cx + w / 3]) L(mid, Math.round(px), bot + 2, 1, SHORE - bot - 2, TILEW); // stilts
  }
  // ramp and walkway along the shore
  for (let i = 0; i < 70; i++) Lp(mid, 222 + i, 110 + Math.round(i * 0.08), TILEW);
  L(mid, 134, 108, 100, 2, TILEW); for (let x = 134; x < 292; x += 3) Lp(mid, x, 107 + (x > 222 ? Math.round((x - 222) * 0.08) : 0), STEEL);
}

function buildShores() {
  // far bank: grass and a white path
  L(mid, 0, SHORE - 3, WW, 3, LEAFGD); L(mid, 0, SHORE - 1, WW, 1, TILEW);
  // Pioneiros da Borborema monument near the right shore: bronze figures on a pedestal
  L(mid, 384, 104, 26, 8, STONEL);
  for (const [dx, h] of [[3, 14], [10, 17], [18, 15]]) { L(mid, 384 + dx, 104 - h, 4, h, WOOD); L(mid, 384 + dx + 1, 104 - h - 3, 2, 3, GOLD); }
  // near bank: low wall, promenade
  L(front, 0, BANK, WW, 2, TILEW); L(front, 0, BANK + 2, WW, 8, STONE);
  for (let x = 0; x < WW; x += 6) Lp(front, x, BANK + 5, STONEL);
  L(front, 0, STREET - 1, WW, 1, STONEL);
  for (const l of LAMPS) lampPost(front, l);
}

function buildGround() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) street.base[d * WW + x] = wr() < 0.07 ? STONE : ASPH;
  for (let x = 4; x < WW; x += 24) for (let i = 0; i < 12; i++) street.base[15 * WW + x + i] = CYELL;
  for (let p = 0; p < 5; p++) {
    const cx = wr() * WW, cy = 2 + wr() * (SH - 4), rx = 8 + wr() * 18, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic ----------
function museumLights() {
  if (!isNight()) return;
  for (const [cx, w] of [[150, 30], [186, 26], [218, 22]] as const) {
    for (let x = cx - w / 2 + 3; x < cx + w / 2 - 3; x += 2) put(x, 104, CYAN); // light line under the glass
    rect(cx - 2, 92, 4, 8, WWARM);
  }
}

/** Little boats of the pedal-boat kind drift on the reservoir by day. */
const boats = [{ x: 60, sp: 3 }, { x: 330, sp: -2.4 }];
function drawBoats(dt: number) {
  if (isNight() || S.rain > 0.2) return;
  for (const b of boats) {
    b.x += b.sp * dt; if (b.x < -20) b.x = WW + 10; if (b.x > WW + 20) b.x = -10;
    const x = Math.round(b.x), y = 128;
    rect(x, y, 9, 2, b.sp > 0 ? CYELL : FPINK); rect(x + 2, y - 3, 5, 3, TILEW); put(x + 4, y - 4, VOID);
  }
}

function update(dt: number) {
  updateAnimals(dt);
  tickSpawns(dt, S.saoJoao && S.cal.hour >= 18 ? 2.4 : 1.4); updatePeople(dt); updateCars(dt, 1.2);
}

const FOG = [{ y: 100, h: 10, sp: 0.5 }, { y: 130, h: 6, sp: -0.4 }];
let lastT = 0;
function render() {
  const now = S.ms / 1000, dt = Math.min(0.1, Math.max(0, now - lastT)); lastT = now;
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawTowerWins(wins); drawFireworks();
  blitLayer(mid); museumLights();
  for (const p of PALMS) drawPalm(p);
  water(SHORE, BANK, 0, WW, FBLUE, BNEAR, 1.6);
  drawBoats(dt);
  drawFarPrecip();
  blitLayer(front);
  for (const l of LAMPS) lampLight(l);
  if (S.saoJoao) { bandeirolas(90, 96, 250, 96, 10, 0); bandeirolas(250, 96, 410, 96, 10, 3); }
  drawAnimalsPerched(); drawPeople(); drawAnimalsGround();
  drawStreet(street); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const acudeVelho: Scene = {
  id: 'acude-velho',
  name: 'Açude Velho',
  build() {
    if (!built) { buildFar(); buildMuseum(); buildShores(); buildGround(); built = true; }
    setLanes([{ y: 145 }, { y: 148 }]);
    setupAnimals({ ground: [145, 148], dogs: 1, lamps: LAMPS.map((l) => ({ x: l.x + 14, y: l.top })) });
    setCarLanes(162, 175, 'br');
    configure({ roofs: [], tips: [], lamps: LAMPS.map((l) => ({ x: l.x + 14, y: l.top })), ground0: 142, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}  são joão ${S.saoJoao}`; },
};

