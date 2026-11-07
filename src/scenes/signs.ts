/* Neon signs: invented kana-like glyphs on dark plates, with on-hours, flicker and
   dead letters that sputter. Shared by every city scene. */
import { put, rect } from '../engine/gfx';
import { mulberry32, type Rng } from '../engine/math';
import { AMB, AMBD, CYAN, CYAND, FWG, CGREEN, MAG, MAGD, VOID, WCOOL, WDIM, LIGHT, WWARM } from '../engine/palette';
import { S, hourIn } from '../sky/state';

export interface Sign {
  x: number; y: number; w: number; h: number; col: number; dim: number; col2: number; dim2: number;
  on: [number, number]; px: number[]; gi: number[]; px2: number[]; border: number[];
  state: number; flick: number; dead: number; sput: number; plate: boolean; chase: boolean;
}

/** Neon color → its unlit tube color. */
export const DIM: Record<number, number> = { [MAG]: MAGD, [CYAN]: CYAND, [AMB]: AMBD, [FWG]: CGREEN, [WCOOL]: CYAND, [LIGHT]: AMBD, [WWARM]: AMBD };
export const NEONS = [MAG, CYAN, AMB, FWG, WCOOL, MAG, CYAN, AMB];

export function glyph(sr: Rng) {
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

export function signSet(seed: number) {
  const sr = mulberry32(seed), fx = mulberry32(seed ^ 0x77);
  const list: Sign[] = [];
  const border = (s: Sign) => {
    const b: number[] = [];
    for (let i = 0; i < s.w; i++) b.push(s.x + i, s.y, s.x + i, s.y + s.h - 1);
    for (let j = 1; j < s.h - 1; j++) b.push(s.x, s.y + j, s.x + s.w - 1, s.y + j);
    return b;
  };
  const base = (x: number, y: number, w: number, h: number, col: number, on: [number, number]): Sign => ({
    x, y, w, h, col, dim: DIM[col] ?? WDIM, col2: col, dim2: DIM[col] ?? WDIM, on, px: [], gi: [], px2: [], border: [],
    state: 1, flick: 0, dead: -1, sput: 0, plate: true, chase: false,
  });
  return {
    list,
    text(x: number, y: number, n: number, vertical: boolean, col: number, on: [number, number] = [17, 2]) {
      const s = base(x, y, vertical ? 9 : n * 7 + 3, vertical ? n * 9 + 1 : 11, col, on);
      for (let g = 0; g < n; g++) {
        const G7 = glyph(sr), gx = vertical ? x + 2 : x + 2 + g * 7, gy = vertical ? y + 2 + g * 9 : y + 2;
        for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (G7[j * 5 + i]) { s.px.push(gx + i, gy + j); s.gi.push(g); }
      }
      s.border = border(s); list.push(s); return s;
    },
    icon(x: number, y: number, rows: string[], col: number, col2: number, on: [number, number] = [17, 2]) {
      const s = base(x, y, rows[0].length + 4, rows.length + 4, col, on);
      s.col2 = col2; s.dim2 = DIM[col2] ?? WDIM;
      rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { if (r[i] === 'a') { s.px.push(x + 2 + i, y + 2 + j); s.gi.push(0); } else if (r[i] === 'b') s.px2.push(x + 2 + i, y + 2 + j); } });
      s.border = border(s); list.push(s); return s;
    },
    flicker(er: Rng) { const s = list[(er() * list.length) | 0]; if (!s) return; s.flick = 0.6 + er() * 1.8; if (er() < 0.25) s.dead = (er() * 6) | 0; },
    update(dt: number) {
      for (const s of list) {
        const lit = S.neonOn && hourIn(S.cal.hour, s.on[0], s.on[1]);
        let st = lit ? 1 : 0;
        if (s.flick > 0) { s.flick -= dt; if (lit) st = fx() < 0.55 ? 1 : 0; }
        s.state = st; s.sput = s.dead >= 0 && fx() < 0.06 ? 1 : 0;
      }
    },
    draw(t: number) {
      for (const s of list) {
        if (s.plate) rect(s.x + 1, s.y + 1, s.w - 2, s.h - 2, VOID);
        const lit = s.state, bc = lit ? s.col : s.dim;
        for (let i = 0; i < s.border.length; i += 2) {
          const c = s.chase && lit ? (((i >> 1) + ((t * 10) | 0)) % 3 === 0 ? s.col2 : s.col) : bc;
          put(s.border[i], s.border[i + 1], c);
        }
        for (let i = 0, k = 0; i < s.px.length; i += 2, k++) { const dead = s.gi[k] === s.dead && !s.sput; put(s.px[i], s.px[i + 1], lit && !dead ? s.col : s.dim); }
        for (let i = 0; i < s.px2.length; i += 2) put(s.px2[i], s.px2[i + 1], lit ? s.col2 : s.dim2);
      }
    },
  };
}
