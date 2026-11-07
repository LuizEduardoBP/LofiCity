/* Weighted random events with cooldowns; weights read the world state so the
   mood of the hour decides what happens next. */
import type { Rng } from '../engine/math';
import { S } from '../sky/state';

export interface Ev { id: string; cd: number; w: () => number; run: () => void }

export function director(events: Ev[], rng: Rng) {
  const last = new Float32Array(events.length).fill(-1e6);
  const recent: string[] = [];
  let next = 2, clock = 0;
  return {
    recent,
    tick(dt: number) {
      clock += dt; next -= dt;
      if (next > 0) return;
      let tot = 0;
      for (let i = 0; i < events.length; i++) if (clock - last[i] >= events[i].cd) tot += Math.max(0, events[i].w());
      if (tot > 0) {
        let x = rng() * tot;
        for (let i = 0; i < events.length; i++) {
          if (clock - last[i] < events[i].cd) continue;
          x -= Math.max(0, events[i].w());
          if (x <= 0) { last[i] = clock; events[i].run(); recent.push(events[i].id); if (recent.length > 5) recent.shift(); break; }
        }
      }
      next = (3 + rng() * 9) / (0.6 + 0.6 * S.busy);
    },
  };
}
