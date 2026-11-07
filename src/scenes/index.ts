import type { CityId } from '../sky/cities';
import { konbini } from './konbini';
import { neonAlley } from './neon-alley';
import { praca } from './praca-matriz';
import { rainCorner } from './rain-corner';
import { ruaComercio } from './rua-comercio';
import { shrine } from './shrine';
import type { Scene } from './types';

export const SCENES: Record<CityId, Scene[]> = {
  tokyo: [rainCorner, neonAlley, konbini, shrine],
  esperanca: [praca, ruaComercio],
};

const LAST_KEY = 'loficity:lastScene:';

/** #scene=<id> pins a scene; otherwise every load picks a random one, never the previous. */
export function pickScene(city: CityId): Scene {
  const list = SCENES[city];
  const want = /scene=([\w-]+)/.exec(location.hash)?.[1];
  const pinned = list.find((s) => s.id === want);
  if (pinned) return pinned;
  let last: string | null = null;
  try { last = localStorage.getItem(LAST_KEY + city); } catch { /* storage unavailable */ }
  const pool = list.length > 1 ? list.filter((s) => s.id !== last) : list;
  const scene = pool[Math.floor(Math.random() * pool.length)];
  try { localStorage.setItem(LAST_KEY + city, scene.id); } catch { /* storage unavailable */ }
  return scene;
}

export function nextScene(city: CityId, current: Scene): Scene {
  const list = SCENES[city];
  return list[(list.indexOf(current) + 1) % list.length];
}
