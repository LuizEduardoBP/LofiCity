/* Props shared by the Esperança scenes: casario facades with platibandas, white LED street
   lights, concrete poles with sagging wires, palms that sway in the wind, bandeirolas for the
   festa and São João, the Christmas star on the lamp posts, a street-food cart and a bonfire. */
import { L, Lp, type Layer, getW, put, rect, sx, sy } from '../engine/gfx';
import { bay, type Rng } from '../engine/math';
import {
  AMB, AMBD, BARK, BMID, BNEAR, CBEIGE, CBLUE, CGREEN, CRED, CYELL, FOG, HALO, HALOOK, LEAFG, LEAFGD,
  LEDW, LIGHT, STEEL, STONE, STONEL, VOID, WCOOL, WDIM, WHITE, WOOD, WWARM, FPINK,
} from '../engine/palette';
import { S } from '../sky/state';

const night = () => S.dayK < 0.45 || (S.cloud > 0.9 && S.dayK < 0.65);

// ---------- static pieces (drawn into layers) ----------

export interface Opening { x: number; y: number; w: number; h: number; kind: 'win' | 'door' | 'shop'; rank: number; tv: boolean }
export type Plat = 'reta' | 'deco' | 'frontao' | 'escada' | 'balaustre';

/**
 * A casario facade standing on `ground`: platibanda on top, painted wall, tiled skirting,
 * doors and shuttered windows (homes) or roll-up steel doors (shops). Returns the openings
 * so the scene can light windows at night.
 */
export function casa(ly: Layer, x: number, w: number, h: number, ground: number, wall: number, trim: number, plat: Plat, shop: boolean, rng: Rng): Opening[] {
  const top = ground - h, out: Opening[] = [];
  L(ly, x, top, w, h, wall);
  L(ly, x, ground - 3, w, 3, trim); // barrado
  // platibanda
  const ph = plat === 'escada' || plat === 'frontao' ? 7 : 5;
  L(ly, x, top - ph + 2, w, ph - 2, wall);
  L(ly, x - 1, top + 2, w + 2, 1, trim);
  L(ly, x, top - ph + 2, w, 1, trim);
  const mid = x + (w >> 1);
  if (plat === 'deco') for (let gx = x + 3; gx < x + w - 2; gx += 4) L(ly, gx, top - ph + 3, 1, ph - 2, trim);
  if (plat === 'escada') { L(ly, mid - 8, top - ph - 1, 16, 3, wall); L(ly, mid - 8, top - ph - 1, 16, 1, trim); L(ly, mid - 4, top - ph - 3, 8, 2, wall); L(ly, mid - 4, top - ph - 3, 8, 1, trim); }
  if (plat === 'frontao') for (let i = 0; i < 9; i++) { L(ly, mid - 9 + i, top - ph + 1 - Math.round(i * 0.5), 18 - i * 2, 1, wall); Lp(ly, mid - 9 + i, top - ph + 1 - Math.round(i * 0.5), trim); Lp(ly, mid + 8 - i, top - ph + 1 - Math.round(i * 0.5), trim); }
  if (plat === 'balaustre') { L(ly, x, top - ph + 2, w, ph - 2, 255); L(ly, x, top - ph + 2, w, 1, trim); for (let bx = x + 1; bx < x + w - 1; bx += 2) L(ly, bx, top - ph + 3, 1, ph - 3, trim); L(ly, x, top + 1, w, 2, trim); }
  // openings
  if (shop) {
    const n = w > 34 ? 2 : 1, dw = Math.floor((w - 6 - (n - 1) * 4) / n);
    for (let i = 0; i < n; i++) {
      const dx = x + 3 + i * (dw + 4), dh = Math.min(h - 8, 18);
      L(ly, dx - 1, ground - dh - 1, dw + 2, dh + 1, trim);
      out.push({ x: dx, y: ground - dh, w: dw, h: dh, kind: 'shop', rank: rng(), tv: false });
    }
    L(ly, x + 2, top + 4, w - 4, 4, trim); // sign board
  } else {
    const dx = rng() < 0.5 ? x + 3 : x + w - 10;
    L(ly, dx - 1, ground - 16, 8, 16, trim); L(ly, dx, ground - 15, 6, 15, rng() < 0.5 ? WOOD : trim === WHITE ? CBLUE : WOOD);
    out.push({ x: dx, y: ground - 15, w: 6, h: 15, kind: 'door', rank: rng(), tv: false });
    for (let wx = x + 3; wx + 8 <= x + w - 2; wx += 11) {
      if (wx + 8 > dx - 1 && wx < dx + 8) continue;
      L(ly, wx - 1, ground - 16, 9, 10, trim);
      out.push({ x: wx, y: ground - 15, w: 7, h: 8, kind: 'win', rank: rng(), tv: rng() < 0.3 });
    }
  }
  return out;
}

/** Shutters, roll-up doors and lit rooms, drawn every frame. */
export function drawOpenings(list: Opening[], openShops: boolean) {
  const lateness = S.cal.hour >= 22 || S.cal.hour < 5 ? 0.25 : 0.65, n = night(), t = S.ms / 1000;
  for (const o of list) {
    if (o.kind === 'shop') {
      const open = openShops && o.rank < 0.75;
      if (open) {
        rect(o.x, o.y, o.w, o.h, n ? WWARM : BNEAR);
        if (n) for (let i = 0; i < o.w; i += 5) rect(o.x + i, o.y + 2, 2, o.h - 2, LIGHT);
        rect(o.x, o.y, o.w, 2, STEEL);
      } else {
        rect(o.x, o.y, o.w, o.h, STEEL);
        for (let j = o.y + 1; j < o.y + o.h; j += 2) rect(o.x, j, o.w, 1, BMID);
      }
      continue;
    }
    if (o.kind === 'door') continue;
    const lit = n && o.rank < lateness;
    if (!lit) { rect(o.x, o.y, o.w, o.h, n ? BNEAR : WDIM); for (let j = o.y; j < o.y + o.h; j += 2) rect(o.x, j, o.w, 1, n ? VOID : BMID); continue; }
    const tv = o.tv && Math.sin(t * 7 + o.x) + Math.sin(t * 3.1 + o.y) > 0.3;
    rect(o.x, o.y, o.w, o.h, tv ? WCOOL : WWARM);
    rect(o.x + (o.w >> 1), o.y, 1, o.h, BNEAR); // window bars
  }
}

/** Concrete utility pole. */
export function pole(ly: Layer, x: number, ground: number, h: number) {
  L(ly, x, ground - h, 3, h, STONEL); L(ly, x + 2, ground - h, 1, h, STONE);
  L(ly, x - 4, ground - h + 3, 11, 1, STONE);
  L(ly, x - 3, ground - h + 8, 2, 3, BMID); L(ly, x + 4, ground - h + 8, 2, 3, BMID); // transformer
}

/** Sagging wire between two points. */
export function wire(ly: Layer, x0: number, y0: number, x1: number, y1: number, sag: number, c = VOID) {
  const n = Math.abs(x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    Lp(ly, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)), c);
  }
}

// ---------- LED street light ----------
export interface Lamp { x: number; top: number; ground: number; arms: 1 | 2 }

export function lampPost(ly: Layer, l: Lamp) {
  L(ly, l.x, l.top, 2, l.ground - l.top, WHITE); L(ly, l.x + 1, l.top, 1, l.ground - l.top, STEEL);
  L(ly, l.x - 1, l.ground - 4, 4, 4, STEEL);
  const sides = l.arms === 2 ? [-1, 1] : [1];
  for (const s of sides) {
    for (let i = 0; i < 12; i++) Lp(ly, l.x + (s > 0 ? 2 : -1) + i * s, l.top + 3 - Math.round(Math.sqrt(i) * 1.2), WHITE);
    L(ly, l.x + (s > 0 ? 11 : -16), l.top - 2, 7, 2, STEEL);
  }
}

/** Heads glow at night and throw a cone of white light on the ground. */
export function lampLight(l: Lamp) {
  const on = night(), sides = l.arms === 2 ? [-1, 1] : [1];
  for (const s of sides) {
    const hx = l.x + (s > 0 ? 11 : -16);
    rect(hx + 1, l.top, 5, 1, on ? LEDW : STONEL);
    if (!on) continue;
    const cx = hx + 3;
    for (let y = l.top + 1; y < l.ground + 6; y++) {
      const d = (y - l.top) / (l.ground - l.top), half = 2 + d * 16;
      for (let x = Math.floor(cx - half); x <= cx + half; x++) {
        const c = getW(x, y);
        if (c === 255 || !HALOOK[c]) continue;
        const k = (1 - Math.abs(x - cx) / half) * (0.05 + 0.16 * d * d * d);
        if (bay(sx(x), sy(y)) < k) put(x, y, HALO);
      }
    }
    for (let j = -3; j <= 3; j++) for (let i = -5; i <= 7; i++) {
      const c = getW(hx + i, l.top + j);
      if (c !== 255 && HALOOK[c] && bay(sx(hx + i), sy(l.top + j)) < 0.3 * (1 - Math.hypot(i - 1, j * 1.6) / 7)) put(hx + i, l.top + j, HALO);
    }
  }
}

/** The shooting star the town hangs on its lamp posts at Christmas. */
export function christmasStar(cx: number, cy: number, s: number) {
  const on = night(), t = S.ms / 1000;
  for (let k = 0; k < 10; k++) {
    const a0 = (k / 10) * Math.PI * 2 - Math.PI / 2, a1 = ((k + 1) / 10) * Math.PI * 2 - Math.PI / 2;
    const r0 = k % 2 ? 2.2 * s : 5 * s, r1 = k % 2 ? 5 * s : 2.2 * s;
    for (let i = 0; i <= 6; i++) {
      const u = i / 6, x = cx + Math.cos(a0) * r0 * (1 - u) + Math.cos(a1) * r1 * u, y = cy + Math.sin(a0) * r0 * (1 - u) + Math.sin(a1) * r1 * u;
      put(x, y, on ? ((i + k + ((t * 4) | 0)) % 5 ? LIGHT : WHITE) : CBEIGE);
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = cx - 6 * s - i * 1.4, y = cy + 2 + Math.sin(i / 14 * Math.PI) * -3 + i * 0.6;
    if (i % 2 === 0) put(x, y, on ? ((i + ((t * 6) | 0)) % 4 ? AMB : LIGHT) : CBEIGE);
  }
}

// ---------- palms ----------
export interface Palm { x: number; ground: number; h: number; lean: number; ph: number }

export function drawPalm(p: Palm) {
  const t = S.ms / 1000, sway = Math.sin(t * 0.9 + p.ph) * (0.6 + Math.abs(S.wind) * 6);
  const tx = (u: number) => p.x + p.lean * u * u + sway * u * u * 0.5;
  for (let y = 0; y < p.h; y++) {
    const u = y / p.h, x = Math.round(tx(u)), yy = p.ground - y;
    put(x, yy, y % 4 === 0 ? WOOD : BARK); put(x + 1, yy, y % 4 === 1 ? BARK : WOOD);
  }
  const cx = tx(1), cy = p.ground - p.h;
  const fronds = [-2.9, -2.4, -1.9, -1.3, -0.7, -0.25, 0.25];
  fronds.forEach((a0, i) => {
    const a = a0 + Math.sin(t * 1.3 + i + p.ph) * 0.06 * (1 + Math.abs(S.wind) * 5) + S.wind * 0.3, len = 18 + (i % 3) * 3;
    for (let k = 1; k <= len; k++) {
      const u = k / len, x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k + u * u * 9;
      put(x, y, LEAFG);
      if (k > 3 && k % 2 === 0) { put(x, y + 1, LEAFGD); put(x + (Math.cos(a) > 0 ? -1 : 1), y + 2, u > 0.6 ? LEAFGD : LEAFG); }
    }
  });
  rect(cx - 1, cy - 1, 3, 3, LEAFGD); put(cx - 1, cy + 2, WOOD); put(cx + 1, cy + 2, WOOD); // coconuts
}

// ---------- festivities ----------
const FLAG = [CRED, CYELL, CBLUE, CGREEN, WHITE, FPINK];
/** A string of paper bandeirolas between two points, fluttering in the wind. */
export function bandeirolas(x0: number, y0: number, x1: number, y1: number, sag: number, seed: number) {
  const n = Math.abs(x1 - x0), t = S.ms / 1000;
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u + sag * 4 * u * (1 - u));
    put(x, y, BNEAR);
    if (i % 4 === 1) {
      const c = FLAG[(i / 4 + seed) % FLAG.length | 0], fl = Math.sin(t * 3 + i * 0.7) * Math.abs(S.wind) * 3 > 0.6 ? 1 : 0;
      rect(x, y + 1, 3, 2, c); put(x + 1 + fl, y + 3, c);
    }
  }
}

/** A string of warm bulbs (festa nights). */
export function bulbs(x0: number, y0: number, x1: number, y1: number, sag: number) {
  const n = Math.abs(x1 - x0), on = night(), t = S.ms / 1000;
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u + sag * 4 * u * (1 - u));
    put(x, y, BNEAR);
    if (i % 6 === 3) put(x, y + 1, on ? ((i + ((t * 2) | 0)) % 3 ? LIGHT : AMB) : CBEIGE);
  }
}

/** Espetinho cart with a striped umbrella, a bulb and grill smoke. */
export function cart(x: number, ground: number, open: boolean) {
  const t = S.ms / 1000, on = night();
  rect(x, ground - 9, 18, 6, CRED); rect(x, ground - 9, 18, 1, WHITE); rect(x + 2, ground - 7, 14, 1, WHITE);
  rect(x + 2, ground - 3, 3, 3, VOID); rect(x + 13, ground - 3, 3, 3, VOID);
  rect(x + 8, ground - 26, 1, 17, STEEL);
  for (let i = -11; i <= 11; i++) {
    const y = ground - 27 + Math.round((i * i) / 30);
    put(x + 8 + i, y, ((i + 11) >> 2) % 2 ? CYELL : CRED); put(x + 8 + i, y - 1, Math.abs(i) < 9 ? (((i + 11) >> 2) % 2 ? CYELL : CRED) : 255);
  }
  if (!open) return;
  if (on) { put(x + 8, ground - 24, LIGHT); for (let j = -3; j <= 6; j++) for (let i = -8; i <= 8; i++) { const c = getW(x + 8 + i, ground - 20 + j); if (c !== 255 && HALOOK[c] && bay(sx(x + 8 + i), sy(ground - 20 + j)) < 0.25 * (1 - Math.hypot(i, j) / 9)) put(x + 8 + i, ground - 20 + j, HALO); } }
  rect(x + 3, ground - 10, 12, 1, on ? AMB : AMBD); // grill coals
  for (let k = 0; k < 6; k++) {
    const age = (t * 0.6 + k / 6) % 1, sx0 = x + 5 + k * 1.5 + Math.sin(t + k) * 2 + S.wind * age * 20, sy0 = ground - 11 - age * 18;
    if (bay(sx(sx0), sy(sy0)) < 0.7 * (1 - age)) put(sx0, sy0, age < 0.5 ? STONEL : FOG);
  }
}

/** São João bonfire. */
export function fogueira(x: number, ground: number) {
  const t = S.ms / 1000;
  rect(x - 7, ground - 2, 14, 2, WOOD); rect(x - 5, ground - 4, 10, 2, BARK);
  for (let i = -5; i <= 5; i++) {
    const h = 9 - Math.abs(i) * 1.4 + Math.sin(t * 9 + i * 1.7) * 2.5;
    for (let j = 0; j < h; j++) put(x + i, ground - 4 - j, j > h - 3 ? CRED : j > h * 0.5 ? AMB : LIGHT);
  }
  for (let k = 0; k < 5; k++) {
    const age = (t * 0.8 + k / 5) % 1;
    put(x + Math.sin(k * 7 + t) * 4, ground - 12 - age * 22, age < 0.6 ? AMB : AMBD);
  }
  if (night()) for (let j = -14; j <= 4; j++) for (let i = -18; i <= 18; i++) {
    const c = getW(x + i, ground + j), d = Math.hypot(i, j * 1.4) / 19;
    if (c !== 255 && HALOOK[c] && d < 1 && bay(sx(x + i), sy(ground + j)) < 0.35 * (1 - d) * (0.85 + 0.15 * Math.sin(t * 11))) put(x + i, ground + j, d < 0.4 ? HALO : AMBD);
  }
}

export const isNight = night;
