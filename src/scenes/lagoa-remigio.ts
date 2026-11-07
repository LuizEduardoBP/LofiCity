/* LAGOA DE REMÍGIO (Remígio, PB): the round lagoon in the middle of town. Across the water a
   promenade with white stepped terraces and a row of tall royal palms, houses climbing the
   hill behind and the matriz of Nossa Senhora do Patrocínio on top; ducks paddle about and
   everything is mirrored in the lagoon. The church is drawn from general descriptions. */
import { L, Lp, WW, blitLayer, newLayer, put, rect } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  ASPH, BNEAR, CBEIGE, CHURCH, CHURCHD, CHURCHL, CORNG, CYELL, FBLUE, FGREEN, FLILAC, FORNG, FPINK, LEAFGD,
  STEEL, STONE, STONEL, TERRA, TILEW, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { S } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { type Lamp, type Palm, bandeirolas, christmasStar, drawPalm, isNight, lampLight, lampPost, water } from './br-kit';
import type { Scene } from './types';

const HORIZON = 100, SHORE = 112, BANK = 140, STREET = 148, SH = 180 - STREET, CX = 250;
const wr = mulberry32(0x7e3);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const houseWins: { x: number; y: number; rank: number }[] = [];
const LAMPS: Lamp[] = [{ x: 70, top: 96, ground: BANK + 6, arms: 2 }, { x: 250, top: 96, ground: BANK + 6, arms: 2 }, { x: 420, top: 96, ground: BANK + 6, arms: 2 }];
const PALMS: Palm[] = Array.from({ length: 11 }, (_, i) => ({ x: 24 + i * 42 + ((i * 7) % 9), ground: SHORE - 6, h: 40 + ((i * 5) % 9), lean: 0, ph: i * 0.9, imperial: true }));

/** Hill rising behind the lagoon, highest under the church. */
const hill = (x: number) => Math.round(78 + 10 * (1 - Math.exp(-(((x - CX) / 150) ** 2))) + Math.sin(x * 0.03) * 2);

function buildHill() {
  for (let x = 0; x < WW; x++) L(far, x, hill(x), 1, SHORE - hill(x), LEAFGD);
  // houses stacked up the slope
  const colors = [TILEW, FPINK, CYELL, FBLUE, FGREEN, FLILAC, FORNG, CBEIGE];
  for (let row = 0; row < 3; row++) for (let x = -4 + row * 7; x < WW;) {
    const w = 10 + ((wr() * 10) | 0), base = SHORE - 8 - row * 7, top = Math.max(hill(x) + 2, base - 7 - ((wr() * 3) | 0));
    if (Math.abs(x - CX) > 22 || row > 0) {
      L(far, x, top, w, base - top, colors[(wr() * colors.length) | 0]);
      L(far, x - 1, top - 2, w + 2, 2, TERRA); // tile roof
      for (let wx = x + 2; wx < x + w - 2; wx += 4) houseWins.push({ x: wx, y: top + 2, rank: wr() });
    }
    x += w + 2 + ((wr() * 4) | 0);
  }
  // matriz of Nossa Senhora do Patrocínio on the crest: twin-tower front
  const b = hill(CX) + 4;
  L(far, CX - 14, b - 22, 28, 22, CHURCH); L(far, CX - 14, b - 22, 28, 2, CHURCHL);
  for (const tx of [CX - 14, CX + 8]) { L(far, tx, b - 34, 6, 12, CHURCH); L(far, tx + 5, b - 34, 1, 12, CHURCHD); L(far, tx + 1, b - 40, 4, 6, CHURCHL); Lp(far, tx + 2, b - 42, STEEL); Lp(far, tx + 3, b - 42, STEEL); Lp(far, tx + 2, b - 43, STEEL); }
  for (let i = 0; i < 6; i++) L(far, CX - 6 + i, b - 22 - i, 12 - i * 2, 1, CHURCHL);
  L(far, CX - 2, b - 10, 5, 10, BNEAR); L(far, CX - 1, b - 30, 2, 2, BNEAR);
}

function buildBanks() {
  // far promenade: white stepped terraces down to the water
  for (let k = 0; k < 4; k++) { L(mid, 0, SHORE - 6 + k * 2, WW, 1, TILEW); L(mid, 0, SHORE - 5 + k * 2, WW, 1, STONEL); }
  // near bank: rail and walkway
  L(front, 0, BANK, WW, 1, TILEW); for (let x = 0; x < WW; x += 5) L(front, x, BANK - 4, 1, 4, STEEL); L(front, 0, BANK - 4, WW, 1, STEEL);
  for (let y = BANK + 1; y < STREET; y++) for (let x = 0; x < WW; x++) Lp(front, x, y, (x + y) % 5 === 0 ? STONEL : STONE);
  L(front, 0, STREET - 1, WW, 1, STONEL);
  for (const l of LAMPS) lampPost(front, l);
}

function buildGround() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) street.base[d * WW + x] = wr() < 0.07 ? STONE : ASPH;
  for (let x = 6; x < WW; x += 24) for (let i = 0; i < 11; i++) street.base[14 * WW + x + i] = CYELL;
  for (let p = 0; p < 5; p++) {
    const cx = wr() * WW, cy = 2 + wr() * (SH - 4), rx = 8 + wr() * 16, ry = 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic ----------
const ducks = Array.from({ length: 5 }, (_, i) => ({ x: 60 + i * 80 + wr() * 30, y: 120 + ((i * 7) % 14), dir: i % 2 ? 1 : -1, sp: 2 + wr() * 3, t: wr() * 6, white: i % 3 !== 0 }));
function drawDucks(dt: number) {
  for (const d of ducks) {
    d.t += dt; d.x += d.dir * d.sp * dt;
    if (d.x < 10 || d.x > WW - 10 || Math.sin(d.t * 0.3) > 0.995) d.dir = -d.dir;
    const x = Math.round(d.x), y = d.y + (Math.sin(d.t * 2) > 0.7 ? 1 : 0), c = d.white ? TILEW : CBEIGE;
    rect(x - 2, y - 2, 5, 2, c); rect(x + 2 * d.dir, y - 4, 2, 2, c); put(x + 4 * d.dir, y - 3, CORNG);
    for (let i = 1; i < 6; i++) if ((i + Math.floor(d.t * 4)) % 2) { put(x - (2 + i) * d.dir, y + Math.floor(i / 2), TILEW); put(x - (2 + i) * d.dir, y - Math.floor(i / 2), STONEL); } // V wake
  }
}

function lights() {
  const n = isNight(), late = S.cal.hour >= 22 || S.cal.hour < 5 ? 0.2 : 0.55;
  for (const w of houseWins) put(w.x, w.y, n && w.rank < late ? WWARM : BNEAR);
  if (n) { const b = hill(CX) + 4; rect(CX - 1, b - 9, 3, 8, WWARM); for (let x = CX - 14; x < CX + 14; x += 3) put(x, b - 1, WWARM); }
}

function update(dt: number) {
  updateAnimals(dt);
  tickSpawns(dt, S.saoJoao && S.cal.hour >= 18 ? 2 : 1.1); updatePeople(dt); updateCars(dt, 0.7);
}

const FOG = [{ y: 100, h: 10, sp: 0.4 }, { y: 128, h: 7, sp: -0.3 }];
let lastT = 0;
function render() {
  const now = S.ms / 1000, dt = Math.min(0.1, Math.max(0, now - lastT)); lastT = now;
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); lights(); drawFireworks();
  blitLayer(mid);
  for (const p of PALMS) drawPalm(p);
  water(SHORE, BANK, 0, WW, FBLUE, BNEAR, 1.5);
  drawDucks(dt); drawFarPrecip();
  blitLayer(front);
  for (const l of LAMPS) lampLight(l);
  if (S.natal) for (const l of LAMPS) christmasStar(l.x + 1, l.top - 12, 1);
  if (S.saoJoao) { bandeirolas(70, 98, 250, 98, 10, 2); bandeirolas(250, 98, 420, 98, 10, 5); }
  drawAnimalsPerched(); drawPeople(); drawAnimalsGround();
  drawStreet(street); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const lagoaRemigio: Scene = {
  id: 'lagoa-remigio',
  name: 'Lagoa de Remígio',
  build() {
    if (!built) { buildHill(); buildBanks(); buildGround(); built = true; }
    setLanes([{ y: 143 }, { y: 146 }]);
    setupAnimals({ ground: [143, 146], dogs: 2, sleepSpots: [180], lamps: LAMPS.flatMap((l) => [{ x: l.x - 13, y: l.top }, { x: l.x + 14, y: l.top }]) });
    setCarLanes(162, 175, 'br');
    configure({ roofs: [], tips: [], lamps: LAMPS.map((l) => ({ x: l.x, y: l.top })), ground0: BANK, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}`; },
};

