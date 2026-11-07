/* Little pixel reactions ("!", a note, a heart) that float up from whatever you tapped. */
import { put } from '../engine/gfx';
import { CRED, CYELL, MAG, VOID, WHITE } from '../engine/palette';

export type EmoteKind = '!' | '♪' | '♥' | 'z';
const GLYPH: Record<EmoteKind, string[]> = {
  '!': ['X', 'X', 'X', '.', 'X'],
  '♪': ['.XX', '.X.', '.X.', 'XX.', 'XX.'],
  '♥': ['X.X', 'XXX', 'XXX', '.X.'],
  z: ['XXX', '..X', '.X.', 'X..', 'XXX'],
};
const COLOR: Record<EmoteKind, number> = { '!': CYELL, '♪': WHITE, '♥': MAG, z: WHITE };
const list: { x: number; y: number; k: EmoteKind; t: number }[] = [];

export function emote(x: number, y: number, k: EmoteKind) { list.push({ x, y, k, t: 0 }); if (list.length > 12) list.shift(); }

export function drawEmotes(dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]; e.t += dt;
    if (e.t > 1.2) { list.splice(i, 1); continue; }
    const g = GLYPH[e.k], y0 = Math.round(e.y - g.length - 2 - e.t * 10), c = e.k === '♥' && e.t > 0.8 ? CRED : COLOR[e.k];
    // drop shadow first, then the glyph, so it reads on any background
    for (const pass of [0, 1]) g.forEach((row, j) => [...row].forEach((ch, i2) => {
      if (ch !== 'X') return;
      const x = Math.round(e.x - 1 + i2), y = y0 + j;
      if (pass === 0) put(x + 1, y + 1, VOID); else put(x, y, c);
    }));
  }
}
