/* RUA PRES. EPITÁCIO PESSOA · BR-104 (Esperança, PB), drawn from the owner's photo (a Street View
   capture from Feb 2025, used as reference only; it is not in the repo). Looking down the urban
   stretch of BR-104 in one-point perspective: on the left the house clad in diagonal diamond tiles
   (number 57, round wall sign and ornate wrought-iron grille), the orange-and-cream tiled house with
   its two terracotta stripes and rust-red roll-up garage door over a white-tiled sidewalk, the narrow
   dark-tiled and exposed-brick front, the two-storey house with overhanging eaves, and pastel and
   ochre facades down the street; on the right the two-storey tiled building with its wide barred
   upper window over a deep navy-blue tiled porch and iron-grille door, a raised metal mesh trash
   basket on the sidewalk, a concrete utility pole carrying a street light and a 30 km/h speed-limit
   sign, and white and pale-green houses beyond. "BR-104" is stencilled in white along the asphalt in
   the foreground, with a white line along the right kerb and cars and motorcycles parked along the
   left kerb.

   No zebra crossing is visible, so none is wired up: pedestrians stay on the two sidewalks, and
   vehicles run one-way away from the viewer (following the parked cars and the 30 km/h sign). */
import { L, Lp, WW, blitLayer, newLayer, put } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  ASPH, BFAR, BMID, BNEAR, CBEIGE, CBLUE, CHURCH, CHURCHL, CNAVY, CRED, FBLUE, FGREEN, FORNG, FPINK,
  LIGHT, STEEL, STONE, STONEL, TERRA, TILEW, VOID, WDIM, WOOD, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { setLanes } from '../actors/people';
import { setCarLanes } from '../actors/cars';
import type { DepthRoad } from '../actors/persp-rules';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { bandeirolas, isNight, text, textBit, textW, wire, wireCurve } from './br-kit';
import {
  type Facade, type Opening, type PCar, type PKind, type PLamp, type View, type Walker, type WalkCfg, OPEN,
  drawByDepth, drawCarP, drawOpeningsP, drawWalker, lampLightP, lampPostP, makeCars, makeWalkers,
  paintFacades, paintFront, paintGround, projX, projY, tapCarP, tapWalker, updateCarsP, updateWalkers,
} from './persp-kit';
import type { Scene } from './types';

// Camera matched to the photo: wide-angle perspective looking straight down BR-104.
const V: View = { vx: 278, vy: 80, f: 210, camH: 2.15 };
const HORIZON = V.vy, Y0 = V.vy + 1, SH = 180 - Y0;
// Lateral layout, metres: left building line, left kerb, right kerb, right building line.
const XBL = -5.4, XKL = -3.7, XKR = 3.5, XBR = 5.4;
const wr = mulberry32(0x104b);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: Y0, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const opens: Opening[] = [];
const LAMPS: PLamp[] = [
  { X: 3.75, z: 14.6, h: 6.8, arm: -2.35 },
  { X: 3.75, z: 36, h: 6.4, arm: -2.15 },
  { X: -3.9, z: 50, h: 6.2, arm: 2.05 },
];

const open = (kind: 'win' | 'shop', base = WDIM) => { opens.push({ kind, rank: wr(), px: [], base }); return OPEN + opens.length - 1; };
const grain = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5; return v - Math.floor(v); };
const band = (h: number, a: number, b: number) => h >= a && h < b;

// ---------- left side ----------
/** Near-left house (nº 57): cream tiles in a 45° diamond lattice, stone plinth, and a recessed opening
    with an ornate wrought-iron security grille. */
function diamondTileHouse(): Facade {
  return {
    X: XBL, z0: 4.0, z1: 7.1, h: 4.55,
    end: (h) => (h > 4.3 ? STONE : TILEW),
    paint: (_s, h, Z) => {
      // Narrow adjacent wall and dark awning at the far-left edge of the frame
      if (Z < 4.32) return band(h, 1.95, 2.35) ? VOID : h < 0.6 ? STONE : STONEL;
      if (h > 4.35) return h > 4.46 ? STONE : STONEL; // coping
      if (h < 0.52) return h > 0.44 ? STONEL : (Math.floor(Z * 5) + Math.floor(h * 6)) % 3 === 0 ? STONE : STONEL; // plinth
      // House number "57" on the left pier
      if (Z > 4.42 && Z < 4.82 && band(h, 1.48, 1.78)) {
        if (textBit('57', ((Z - 4.42) / 0.4) * textW('57'), ((1.78 - h) / 0.3) * 5)) return VOID;
      }
      // Large recessed opening with wrought-iron security grille (diamond & scroll lattice)
      if (Z > 4.95 && Z < 6.82 && h < 3.18) {
        if (Z < 5.06 || Z > 6.72 || h > 3.06) return STONE; // reveal
        const u = (Z - 5.06) * 4.8, v = (h - 0.52) * 3.6;
        const vBar = Math.abs((u % 1) - 0.5) < 0.11;
        const hRail = Math.abs(h - 0.62) < 0.04 || Math.abs(h - 1.48) < 0.04 || Math.abs(h - 2.02) < 0.04 || Math.abs(h - 2.88) < 0.04;
        const diamond = band(h, 1.48, 2.02) && (Math.abs(((u + v) % 1) - 0.5) < 0.12 || Math.abs(((u - v + 20) % 1) - 0.5) < 0.12);
        const scroll = band(h, 0.72, 1.38) && Math.abs(Math.hypot((u % 1) - 0.5, (h - 1.05) / 0.3) - 0.34) < 0.09;
        if (vBar || hRail || diamond || scroll) return STONEL;
        return grain(Math.floor(Z * 12), Math.floor(h * 10)) < 0.25 ? BMID : BNEAR;
      }
      // 45° diagonal ceramic tile grid
      const d1 = ((Z * 1.4 + h) * 2.9) % 1, d2 = (((Z * 1.4 - h) % 10 + 10) * 2.9) % 1;
      if (d1 < 0.1 || d2 < 0.1) return STONEL;
      return grain(Math.floor((Z + h) * 3), Math.floor((Z - h) * 3)) < 0.22 ? CHURCHL : TILEW;
    },
  };
}

/** Orange and cream-yellow tiled house: terracotta lower wall with brass mailbox and round plaque,
    rust-red roll-up garage door, barred window, and cream upper wall with two terracotta stripes. */
function orangeTileHouse(): Facade {
  const win = open('win');
  return {
    X: XBL, z0: 7.1, z1: 14.2, h: 4.95,
    end: (h) => (h < 1.98 || band(h, 3.25, 3.65) || band(h, 4.18, 4.48) || h > 4.76 ? TERRA : CHURCHL),
    paint: (_s, h, Z) => {
      if (h > 4.76) return TERRA; // terracotta coping
      // Recessed rust-red corrugated roll-up garage door
      if (Z > 8.15 && Z < 11.15 && h < 2.68) {
        if (Z < 8.34 || h > 2.58) return TILEW; // white tiled reveal
        return Math.floor(h * 11) % 2 ? CRED : TERRA;
      }
      // Recessed barred window on the right
      if (Z > 11.85 && Z < 13.55 && band(h, 0.72, 2.68)) {
        if (Z < 12.02 || Z > 13.42 || h < 0.82 || h > 2.58) return TILEW;
        if (Math.abs(((Z - 12.02) * 3.5) % 1 - 0.5) < 0.1 || Math.abs(((h - 0.82) * 3) % 1 - 0.5) < 0.08) return STONEL;
        return win;
      }
      // Brass mailbox on the left pier
      if (Z > 7.42 && Z < 7.88 && band(h, 1.1, 1.5)) {
        if (Z < 7.48 || Z > 7.82 || h < 1.15 || h > 1.45) return WOOD;
        if (band(h, 1.33, 1.38) && Z > 7.53 && Z < 7.77) return VOID;
        return CHURCH;
      }
      // Small round blue-and-white plaque above the mailbox
      const pd = Math.hypot((Z - 7.65) * 1.1, h - 2.2);
      if (pd < 0.2) return pd > 0.13 ? TILEW : CBLUE;
      // Horizontal brick-tile courses
      const mortar = (h * 7.5) % 1 < 0.12 || ((Z * 3.2 + (Math.floor(h * 7.5) % 2) * 0.5) % 1) < 0.08;
      const stripe = h < 1.98 || band(h, 3.25, 3.65) || band(h, 4.18, 4.48);
      if (stripe) return mortar ? WOOD : grain(Math.floor(Z * 4), Math.floor(h * 8)) < 0.25 ? FORNG : TERRA;
      return mortar ? CBEIGE : CHURCHL;
    },
  };
}

/** Narrow dark-brown tiled front with two tall narrow glass/grille bays and exposed brick rising above. */
function brickAndTileHouse(): Facade {
  const w0 = open('win'), w1 = open('win');
  return {
    X: XBL, z0: 14.2, z1: 19.2, h: 5.55,
    end: (h) => (h > 4.55 ? TERRA : WOOD),
    paint: (_s, h, Z) => {
      if (h > 4.55) {
        const slope = 5.55 - Math.abs(Z - 16.2) * 0.22;
        if (h > slope) return 255;
        return (Math.floor(h * 9) + Math.floor(Z * 5)) % 3 === 0 ? WOOD : grain(Math.floor(Z * 7), Math.floor(h * 9)) < 0.4 ? TERRA : CRED;
      }
      if (h > 4.42) return STONEL;
      const bay0 = Z > 14.75 && Z < 16.25, bay1 = Z > 16.85 && Z < 18.35;
      if ((bay0 || bay1) && h < 4.15) {
        if (Math.abs(h - 2.35) < 0.12 || Math.abs(((Z * 4) % 1) - 0.5) < 0.09) return STONEL;
        return h > 2.35 ? (bay0 ? w0 : w1) : BNEAR;
      }
      return (Math.floor(h * 8) + Math.floor(Z * 4)) % 4 === 0 ? BNEAR : WOOD;
    },
  };
}

/** Two-storey cream/white house with overhanging sloped eaves and upper windows. */
function eaveHouse(): Facade {
  const w0 = open('win'), w1 = open('win'), shop = open('shop');
  return {
    X: XBL, z0: 19.2, z1: 27.2, h: 6.1,
    end: (h) => (h > 5.65 ? WOOD : CBEIGE),
    paint: (_s, h, Z) => {
      if (h > 5.65) return h > 5.88 ? TERRA : WOOD; // overhanging eave
      if (band(h, 3.0, 3.22)) return STONEL; // floor band
      if (h >= 3.22) {
        if (Z > 20.2 && Z < 22.2 && band(h, 3.65, 4.95)) return w0;
        if (Z > 23.6 && Z < 25.6 && band(h, 3.65, 4.95)) return w1;
        return grain(Math.floor(Z * 4), Math.floor(h * 4)) < 0.2 ? CHURCHL : CBEIGE;
      }
      if (Z > 20.6 && Z < 25.0 && h < 2.55) return shop;
      return Z < 20.0 || Z > 26.0 ? STONEL : TILEW;
    },
  };
}

function simpleLeft(z0: number, z1: number, h: number, wall: number, trim: number): Facade {
  const s = open('shop'), w = open('win');
  return {
    X: XBL, z0, z1, h, end: () => wall,
    paint: (_s, hh, Z) => {
      if (hh > h - 0.28) return trim;
      const midZ = (z0 + z1) * 0.5;
      if (hh < 2.35 && Math.abs(Z - midZ) < (z1 - z0) * 0.24) return s;
      if (h > 4.8 && band(hh, 3.3, 4.4) && Math.abs(Z - midZ) < (z1 - z0) * 0.22) return w;
      return hh < 0.75 ? trim : wall;
    },
  };
}

function leftSide(): Facade[] {
  return [
    diamondTileHouse(),
    orangeTileHouse(),
    brickAndTileHouse(),
    eaveHouse(),
    simpleLeft(27.2, 35.0, 4.4, FPINK, TILEW),
    simpleLeft(35.0, 44.0, 4.6, FBLUE, TILEW),
    simpleLeft(44.0, 54.5, 4.3, TILEW, STONE),
    simpleLeft(54.5, 65.5, 4.8, STONEL, TILEW),
    { // warm ochre two-storey building down the street
      X: XBL, z0: 65.5, z1: 95, h: 7.2, end: () => FORNG,
      paint: (_s, h, Z) => (h > 6.85 ? TERRA : band(h % 2.9, 1.1, 2.15) && Z % 4.5 < 2.2 ? BNEAR : h < 2.6 ? CHURCH : FORNG),
    },
    simpleLeft(95, 130, 4.5, CBEIGE, STONEL),
  ];
}

// ---------- right side ----------
/** Two-storey tiled building on the right: cantilevered beige-tiled upper floor with a wide barred
    window and ribbed cornice over a deep navy-blue tiled porch and iron-grille door. */
function navyAndTileBlock(): Facade[] {
  return [
    { // Ground floor (recessed porch and navy-blue tiles)
      X: XBR, z0: 5.0, z1: 13.8, h: 3.45,
      end: () => STONEL,
      paint: (_s, h, Z) => {
        // Near-right beige tiled pier with grey metal mailbox
        if (Z < 6.32) {
          if (Z > 5.75 && Z < 6.18 && band(h, 1.02, 1.42)) return h > 1.34 ? VOID : STONE;
          return ((Math.floor(Z * 4) + Math.floor(h * 4)) % 5 === 0) ? STONE : STONEL;
        }
        // Narrow iron-grille door framed by navy-blue tiles
        if (Z < 7.68) {
          if (Z < 6.46 || Z > 7.52 || h > 2.82) {
            if (Math.hypot(Z - 7.0, h - 3.12) < 0.16) return TILEW; // small relief medallion above the door
            return h > 2.98 ? STONEL : CNAVY;
          }
          const u = (Z - 6.46) * 4.8, v = h * 3.2;
          const bar = Math.abs((u % 1) - 0.5) < 0.13 || Math.abs((v % 1) - 0.5) < 0.1;
          const dia = band(h, 1.1, 1.9) && Math.abs(((u + v) % 1) - 0.5) < 0.13;
          return bar || dia ? STONEL : VOID;
        }
        if (Z < 8.0) return ((Math.floor(h * 5) % 4) === 0) ? STONE : STONEL; // middle pier
        // Recessed navy-blue tiled porch and inner cream/grey iron-grille double gate
        if (Z > 9.35 && Z < 13.15 && h < 2.85) {
          if (h < 0.18) return CBEIGE; // step
          const u = (Z - 9.35) * 3.6;
          if (Math.abs((u % 1) - 0.5) < 0.13 || Math.abs(h - 1.45) < 0.06 || Math.abs(h - 2.45) < 0.07) return STONEL;
          return BMID;
        }
        // Deep navy-blue tile wall
        const grid = (Z * 4.2) % 1 < 0.09 || (h * 4.5) % 1 < 0.09;
        return grid ? BNEAR : grain(Math.floor(Z * 5), Math.floor(h * 5)) < 0.25 ? CBLUE : CNAVY;
      },
    },
    { // Overhanging upper floor (projects slightly toward the street at X = 4.95)
      X: 4.95, z0: 5.0, z1: 13.8, h: 7.35,
      end: (h) => (h < 3.35 ? 255 : h > 6.8 ? WOOD : STONEL),
      paint: (_s, h, Z) => {
        if (h < 3.35) return 255;
        if (h > 6.85) return Math.floor(Z * 5) % 2 ? WOOD : STONE; // ribbed eave
        if (h > 6.62) return STONE; // cornice
        if (h < 3.55) return STONE; // soffit lip
        // Wide barred upper window / balcony
        if (Z > 6.35 && Z < 12.6 && band(h, 4.25, 6.32)) {
          if (Z < 6.55 || Z > 12.4 || h < 4.35 || h > 6.22) return STONE;
          const bar = Math.abs(((Z - 6.55) * 4.2) % 1 - 0.5) < 0.14 || Math.abs(h - 5.12) < 0.06;
          return bar ? STONEL : grain(Math.floor(Z * 8), Math.floor(h * 8)) < 0.3 ? BMID : BNEAR;
        }
        const grid = (Z * 3.2) % 1 < 0.08 || (h * 3.8) % 1 < 0.08;
        return grid ? STONE : grain(Math.floor(Z * 4), Math.floor(h * 4)) < 0.3 ? CBEIGE : STONEL;
      },
    },
  ];
}

function rightSide(): Facade[] {
  const s1 = open('shop'), s2 = open('shop'), s3 = open('shop');
  const w1 = open('win'), w2 = open('win'), w3 = open('win');
  return [
    ...navyAndTileBlock(),
    { // Clean white and light-grey house fronts behind the utility pole
      X: XBR, z0: 13.8, z1: 21.5, h: 4.65,
      end: () => TILEW,
      paint: (_s, h, Z) => {
        if (h > 4.4) return STONEL;
        if (Z > 14.8 && Z < 16.2 && h < 2.35) return BNEAR; // recessed doorway
        if (Z > 17.8 && Z < 21.0 && band(h, 2.48, 3.08)) return h < 2.6 ? STEEL : BNEAR; // dark shop sign / awning
        if (Z > 18.0 && Z < 20.8 && h < 2.45) return s1;
        return Z > 17.4 ? STONEL : TILEW;
      },
    },
    { // Pale green house
      X: XBR, z0: 21.5, z1: 31.0, h: 4.4,
      end: () => FGREEN,
      paint: (_s, h, Z) => {
        if (h > 4.15) return TILEW;
        if (Z > 23.0 && Z < 25.0 && h < 2.3) return WOOD;
        if (Z > 26.2 && Z < 28.8 && band(h, 1.05, 2.2)) return w1;
        return h < 0.7 ? STONE : FGREEN;
      },
    },
    { // Two-storey white house with terracotta roof
      X: XBR, z0: 31.0, z1: 45, h: 6.5,
      end: () => TILEW,
      paint: (_s, h, Z) => {
        if (h > 6.05) return TERRA;
        if (h < 2.6 && Z > 33.0 && Z < 38.5) return s2;
        if (band(h, 3.6, 4.9) && (Z - 31.5) % 5 < 2.4) return Z < 38 ? w2 : w3;
        return TILEW;
      },
    },
    { X: XBR, z0: 45, z1: 66, h: 5.0, end: () => CBEIGE, paint: (_s, h, Z) => (h > 4.7 ? STONEL : h < 2.4 && Z > 48 && Z < 55 ? s3 : CBEIGE) },
    { X: XBR, z0: 66, z1: 96, h: 5.6, end: () => TILEW, paint: (_s, h, Z) => (h > 5.3 ? TERRA : band(h, 3.2, 4.3) && Z % 5 < 2.2 ? BNEAR : TILEW) },
    { X: XBR, z0: 96, z1: 130, h: 4.6, end: () => STONEL, paint: (_s, h) => (h > 4.3 ? STONE : STONEL) },
  ];
}

// ---------- far skyline, poles, signs, trash basket & wires ----------
function buildFar() {
  for (let x = 235; x < 325;) {
    const w = 5 + ((wr() * 9) | 0), top = 68 + ((wr() * 10) | 0);
    L(far, x, top, w, 82 - top, BFAR);
    x += w;
  }
  paintFront(mid, V, XBL, XBR, 140, 4.8, (u, h) => (h > 4.5 ? STONEL : h < 2.1 && Math.abs((u * 1.2) % 3) < 0.9 ? WOOD : u < -1 ? FORNG : u < 2 ? TILEW : CBEIGE));
}

/** Round projecting wall sign on the near-left diamond-tiled house, and the 30 km/h sign on the pole. */
function buildSigns() {
  // Left projecting circular sign (gold/beige rim, cream face, non-specific calligraphic mark)
  const wx = Math.round(projX(V, XBL, 4.58)), sx0 = Math.round(projX(V, XBL + 0.62, 4.58)), sy0 = Math.round(projY(V, 2.88, 4.58));
  L(mid, wx, sy0 - 3, sx0 - wx, 2, WOOD);
  L(mid, wx, sy0 + 3, sx0 - wx, 2, WOOD);
  for (let dy = -11; dy <= 11; dy++) for (let dx = -9; dx <= 9; dx++) {
    const d = Math.hypot(dx / 8.5, dy / 10.5);
    if (d > 1) continue;
    const c = dx < -5 ? CHURCH : d > 0.78 ? CBEIGE : Math.abs(dy) <= 1 && Math.abs(dx) <= 4 ? CHURCH : (dy === 3 || dy === -3) && Math.abs(dx) <= 2 ? STONE : TILEW;
    Lp(mid, sx0 + dx, sy0 + dy, c);
  }
  // 30 km/h speed-limit sign on the right concrete pole (z = 14.6, h = 2.95)
  const px = Math.round(projX(V, 3.55, 14.6)), py = Math.round(projY(V, 2.95, 14.6));
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const d = Math.hypot(dx, dy);
    if (d <= 6.2) Lp(mid, px + dx, py + dy, d > 4.6 ? CRED : TILEW);
  }
  text(mid, '30', px - 3, py - 2, VOID);
}

/** Raised metal mesh trash basket (`lixeira`) on the right sidewalk in the foreground. */
function buildTrashBasket() {
  const z = 8.6, cx = Math.round(projX(V, 4.2, z)), yb = Math.round(projY(V, 0, z)), ym = Math.round(projY(V, 0.56, z)), yt = Math.round(projY(V, 1.0, z));
  L(front, cx - 1, ym, 3, yb - ym, BNEAR); // pedestal post
  L(front, cx - 3, yb - 1, 7, 2, STONE); // foot
  for (let y = yt; y <= ym; y++) {
    const u = (ym - y) / Math.max(1, ym - yt), hw = Math.round(3 + u * 6);
    for (let dx = -hw; dx <= hw; dx++) {
      const rim = y === yt || y === yt + 1 || y === ym || Math.abs(dx) === hw;
      const mesh = (dx + y) % 3 === 0 || (dx - y) % 3 === 0;
      if (rim || mesh) Lp(front, cx + dx, y, rim ? VOID : BNEAR);
    }
  }
}

function pole(X: number, z: number, h: number) {
  const x = Math.round(projX(V, X, z)), yb = Math.round(projY(V, 0, z)), yt = Math.round(projY(V, h, z)), w = Math.max(1, Math.round((V.f / z) * 0.28));
  L(mid, x, yt, w, yb - yt, STONEL); if (w > 2) L(mid, x + w - 1, yt, 1, yb - yt, STONE);
  const arm = Math.round((V.f / z) * 0.85); L(mid, x - arm, yt + 2, 2 * arm + w, 1, STONE);
  return { x: x + (w >> 1), y: yt + 2 };
}

const WIRES: [number, number, number, number, number][] = [];
function buildPoles() {
  const a = pole(3.75, 14.6, 8.8), b = pole(3.75, 36, 8.2), c = pole(-3.9, 50, 7.8), d = pole(3.75, 72, 7.8);
  for (const l of LAMPS) lampPostP(mid, V, l);
  WIRES.push(
    [a.x, a.y, b.x, b.y, 4], [a.x, a.y + 3, b.x, b.y + 2, 5],
    [b.x, b.y, d.x, d.y, 2], [a.x, a.y + 1, c.x, c.y, 4], [b.x, b.y, c.x, c.y, 2],
    // Service drops crossing from the foreground right pole to the left roofs and behind the camera
    [a.x, a.y, 65, 12, 6], [a.x, a.y + 3, 120, 28, 7], [a.x, a.y + 5, 165, 42, 5],
    [a.x, a.y, 355, -25, 3], [a.x, a.y + 3, 440, -10, 4],
  );
  for (const [x0, y0, x1, y1, s] of WIRES) wire(mid, x0, y0, x1, y1, s);
}

/** Stencilled "BR-104" running along the lane (rotated 90° CCW, sampled in screen y so every stroke stays crisp). */
function br104Mark(X: number, y: number): number {
  const yTop = 117, yBot = 165;
  if (y < yTop || y > yBot || X < -0.75 || X > 0.7) return -1;
  const S0 = 'BR-104', W = textW(S0); // 23 cells long
  const u = ((yBot - y) / (yBot - yTop)) * W, v = ((X - -0.6) / 1.15) * 5;
  if (textBit(S0, u, v)) return TILEW;
  for (const [du, dv] of [[-0.45, 0], [0.45, 0], [0, -0.45], [0, 0.45], [-0.35, -0.35], [0.35, 0.35]]) {
    if (textBit(S0, u + du, v + dv)) return BNEAR;
  }
  return -1;
}

function groundAt(X: number, Z: number, y: number): number {
  if (X < XBL || X > XBR) return STONE;
  // Left sidewalk: white ceramic tiles in front of the orange/cream house, concrete slabs elsewhere
  if (X < XKL) {
    if (Z >= 7.1 && Z <= 14.2) return (Z % 0.45 < 0.05 || (X - XBL) % 0.45 < 0.05) ? STONEL : TILEW;
    return (Z % 1.2 < 0.08 || (X - XBL) % 1.1 < 0.06) ? STONE : STONEL;
  }
  if (X < XKL + 0.15) return Z >= 7.1 && Z <= 14.2 ? TILEW : STONEL; // left kerb
  // Right kerb and sidewalk
  if (X > XKR) {
    if (X < XKR + 0.14) return STONEL;
    return (Z % 1.1 < 0.08 || (X - XKR) % 1.0 < 0.06) ? STONE : Z < 13 && grain(Math.floor(X * 6), Math.floor(Z * 6)) < 0.35 ? CBEIGE : STONEL;
  }
  // White line along the right side of the roadway
  if (X > 2.98 && X < 3.12) return TILEW;
  // "BR-104" pavement stencil
  const mark = br104Mark(X, y);
  if (mark >= 0) return mark;
  // Subtle daytime shadow cast by the right-side buildings across the right edge of the road
  if (X > 1.25 + Z * 0.018 && grain(Math.floor(X * 14), Math.floor(Z * 8)) < 0.65) return BNEAR;
  return wr() < 0.07 ? STONE : ASPH;
}

function buildGround() {
  paintGround(street.base, Y0, V, (X, Z, _x, y) => groundAt(X, Z, y));
  for (let p = 0; p < 6; p++) {
    const cx = XKL + 0.9 + wr() * (XKR - XKL - 1.8), cz = 6 + wr() * 32, rx = 0.7 + wr() * 1.3, rz = 1.4 + wr() * 2.8;
    for (let y = Y0; y < 180; y++) {
      const Z = (V.f * V.camH) / (y + 0.5 - V.vy);
      for (let x = 0; x < WW; x++) {
        const X = ((x + 0.5 - V.vx) * Z) / V.f, a = (X - cx) / rx, b = (Z - cz) / rz;
        if (a * a + b * b < 1) street.pud[(y - Y0) * WW + x] = 1;
      }
    }
  }
}

// ---------- actors ----------
const CARS: PCar[] = makeCars(7);
const WALKERS: Walker[] = makeWalkers(8);
// One-way road away from the viewer (+1), no zebra crossing.
const ONE_WAY = 1 as const;
const ROAD: DepthRoad = { zNear: 3, zFar: 135, gap: 1.6, stopGap: 1.2, crossing: null };
const laneX = () => 0.8;
const WALK: WalkCfg = {
  walks: [
    { X0: XBL + 0.25, X1: XKL - 0.2, z0: 4.5 },
    { X0: XKR + 0.25, X1: XBR - 0.35, z0: 5.5 },
  ],
  zNear: 4.5,
  zFar: 75,
  zebra: null,
};

interface Parked { z: number; dir: number; kind: PKind; body: number; rider: number; helmet: number; X: number }
/** Vehicles parked along the left kerb, all facing away (+1) as in the photo. */
const PARKED: Parked[] = [
  { z: 14.5, dir: 1, kind: 'car', body: STONEL, rider: 0, helmet: 0, X: -2.65 }, // silver sedan in the foreground
  { z: 20.8, dir: 1, kind: 'moto', body: VOID, rider: 0, helmet: 0, X: -2.75 },
  { z: 23.0, dir: 1, kind: 'moto', body: CRED, rider: 0, helmet: 0, X: -2.75 },
  { z: 31.0, dir: 1, kind: 'car', body: CRED, rider: 0, helmet: 0, X: -2.65 }, // red car
  { z: 42.5, dir: 1, kind: 'car', body: TILEW, rider: 0, helmet: 0, X: -2.65 },
  { z: 55.5, dir: 1, kind: 'car', body: TILEW, rider: 0, helmet: 0, X: -2.65 },
];

function update(dt: number) {
  updateAnimals(dt);
  updateCarsP(CARS, dt, ROAD, laneX, 1, ONE_WAY);
  updateWalkers(WALKERS, dt, WALK, () => false, 1);
}

const shopsOpen = () => S.cal.weekday !== 0 && hourIn(S.cal.hour, 7.5, 18.5);
const FOG = [{ y: HORIZON + 2, h: 7, sp: 0.5 }];

function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid);
  drawStreet(street);
  blitLayer(mid);
  drawOpeningsP(opens, shopsOpen());
  if (isNight()) {
    for (let x = 260; x < 296; x += 6) put(x, Math.round(projY(V, 2.4, 140)), (x / 6) % 3 ? WWARM : LIGHT);
  }
  drawFarPrecip();
  for (const l of LAMPS) lampLightP(V, l);
  if (S.festa || S.saoJoao) { const [x0, y0, x1, y1] = WIRES[3]; bandeirolas(x0, y0 + 4, x1, y1 + 4, 9, 3); }
  drawAnimalsPerched();
  drawByDepth([
    ...PARKED.map((p) => ({ z: p.z, draw: () => drawCarP(V, p, true) })),
    { z: 8.6, draw: () => blitLayer(front) },
    ...CARS.filter((c) => c.on).map((c) => ({ z: c.z, draw: () => drawCarP(V, c) })),
    ...WALKERS.filter((w) => w.on).map((w) => ({ z: w.z, draw: () => drawWalker(V, w) })),
  ]);
  drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const ruaEpitacioPessoa: Scene = {
  id: 'rua-epitacio-pessoa',
  name: 'Rua Pres. Epitácio Pessoa',
  build() {
    if (!built) {
      paintFacades(mid, V, [...leftSide(), ...rightSide()], opens);
      buildFar(); buildPoles(); buildSigns(); buildGround(); buildTrashBasket();
      built = true;
    }
    setLanes([{ y: 400 }], { bikes: false }); // clears side-on pedestrians: this scene uses depth walkers on the sidewalks
    setCarLanes(400, 400, 'br'); // clears side-on traffic: this scene uses depth traffic on the roadway
    for (const c of CARS) c.on = false;
    for (const w of WALKERS) w.on = false;
    setupAnimals({
      ground: [],
      dogs: 0,
      wires: WIRES.slice(0, 3).map(([a, b, c, d, s]) => wireCurve(a, b, c, d, s)),
      lamps: LAMPS.map((l) => ({ x: projX(V, l.X + l.arm, l.z), y: projY(V, l.h, l.z) })),
    });
    configure({
      roofs: [],
      tips: [],
      lamps: LAMPS.map((l) => ({ x: projX(V, l.X + l.arm, l.z), y: projY(V, l.h, l.z) })),
      ground0: HORIZON + 14,
      horizon: HORIZON,
    });
    for (let i = 0; i < 300; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  walkers x${WALKERS.filter((w) => w.on).length}  road x${CARS.filter((c) => c.on).length} (one-way +Z)`; },
  tap(x, y) { return tapWalker(V, WALKERS, x, y) ?? tapCarP(V, CARS, x, y); },
};
