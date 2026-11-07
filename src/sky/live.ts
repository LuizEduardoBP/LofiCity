/* Live weather from Open-Meteo (free, no key, CORS enabled). One request every 10 minutes
   brings the current conditions plus the last and next 12 hours, so the streets can already
   be wet from rain that fell before the page opened. Codes follow the WMO table. When the
   network fails the procedural climate takes over, and the last answer is cached so a reload
   starts on the real sky. */
import { clamp } from '../engine/math';
import type { City } from './cities';
import type { Wx } from './climate';

export type LiveWx = Pick<Wx, 'temp' | 'rain' | 'snow' | 'storm' | 'cloud' | 'fog' | 'wind'>;
interface Sample extends LiveWx { t: number }
interface Feed { city: string; fetched: number; now: Sample & { code: number; feels: number; humidity: number }; hours: Sample[] }

const REFRESH = 10 * 60e3, STALE = 3 * 3.6e6, KEY = 'loficity:live:';
const feeds = new Map<string, Feed>();
let timer = 0, current: City | null = null;

/** Rain / snow / storm / fog intensities for a WMO weather code. */
function fromCode(code: number) {
  const r = { rain: 0, snow: 0, storm: 0, fog: 0 };
  const L: Record<number, Partial<typeof r>> = {
    45: { fog: 0.8 }, 48: { fog: 0.9 },
    51: { rain: 0.12 }, 53: { rain: 0.22 }, 55: { rain: 0.32 }, 56: { rain: 0.2 }, 57: { rain: 0.32 },
    61: { rain: 0.35 }, 63: { rain: 0.6 }, 65: { rain: 0.85 }, 66: { rain: 0.4 }, 67: { rain: 0.75 },
    71: { snow: 0.3 }, 73: { snow: 0.55 }, 75: { snow: 0.85 }, 77: { snow: 0.2 },
    80: { rain: 0.4 }, 81: { rain: 0.65 }, 82: { rain: 0.95 }, 85: { snow: 0.5 }, 86: { snow: 0.8 },
    95: { rain: 0.75, storm: 0.75 }, 96: { rain: 0.85, storm: 0.9 }, 99: { rain: 0.95, storm: 1 },
  };
  return { ...r, ...L[code] };
}

function sample(t: number, code: number, temp: number, precipMm: number, cloudPct: number, windKmh: number, windDir: number): Sample {
  const c = fromCode(code);
  // measured precipitation can only strengthen what the code says
  const mm = clamp(precipMm / 6, 0, 1);
  if (c.snow > 0) c.snow = Math.max(c.snow, mm); else if (mm > 0.02 || c.rain > 0) c.rain = Math.max(c.rain, mm);
  const dir = -Math.sin((windDir * Math.PI) / 180); // blowing west → east is positive
  return {
    t, temp, rain: c.rain, snow: c.snow, storm: c.storm, fog: c.fog,
    cloud: clamp(cloudPct / 100, 0, 1), wind: clamp(windKmh / 55, 0, 1.2) * (dir >= 0 ? 1 : -1) * 0.9 + 0.05,
  };
}

async function fetchFeed(city: City): Promise<Feed> {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  const hourly = 'temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m';
  Object.entries({
    latitude: String(city.lat), longitude: String(city.lon), timeformat: 'unixtime', past_hours: '12', forecast_hours: '12',
    current: `${hourly},apparent_temperature,relative_humidity_2m`, hourly,
  }).forEach(([k, v]) => u.searchParams.set(k, v));
  const res = await fetch(u, { cache: 'no-store' });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const j = await res.json();
  const c = j.current, h = j.hourly;
  const now = sample(c.time * 1000, c.weather_code, c.temperature_2m, c.precipitation, c.cloud_cover, c.wind_speed_10m, c.wind_direction_10m);
  const hours: Sample[] = h.time.map((t: number, i: number) =>
    sample(t * 1000, h.weather_code[i], h.temperature_2m[i], h.precipitation[i], h.cloud_cover[i], h.wind_speed_10m[i], h.wind_direction_10m[i]));
  return { city: city.id, fetched: Date.now(), now: { ...now, code: c.weather_code, feels: c.apparent_temperature, humidity: c.relative_humidity_2m }, hours };
}

async function refresh(city: City) {
  try {
    const f = await fetchFeed(city);
    feeds.set(city.id, f);
    try { localStorage.setItem(KEY + city.id, JSON.stringify(f)); } catch { /* storage unavailable */ }
  } catch { /* offline: keep the cache or fall back to the model */ }
}

/** Start following a city; refreshes every 10 minutes and when the tab comes back. */
export function followLive(city: City) {
  current = city;
  if (!feeds.has(city.id)) {
    try { const raw = localStorage.getItem(KEY + city.id); if (raw) feeds.set(city.id, JSON.parse(raw)); } catch { /* ignore */ }
  }
  clearInterval(timer);
  const f = feeds.get(city.id);
  if (!f || Date.now() - f.fetched > REFRESH) void refresh(city);
  timer = window.setInterval(() => { if (current) void refresh(current); }, REFRESH);
}
document.addEventListener('visibilitychange', () => {
  const f = current && feeds.get(current.id);
  if (current && document.visibilityState === 'visible' && (!f || Date.now() - f.fetched > REFRESH)) void refresh(current);
});

const mix = (a: Sample, b: Sample, k: number): LiveWx => {
  const o = {} as LiveWx;
  for (const key of ['temp', 'rain', 'snow', 'storm', 'cloud', 'fog', 'wind'] as const) o[key] = a[key] + (b[key] - a[key]) * k;
  return o;
};

/** Live weather at a moment, or null when there is no recent data covering it. */
export function liveAt(cityId: string, ms: number): LiveWx | null {
  const f = feeds.get(cityId);
  if (!f || Date.now() - f.fetched > STALE) return null;
  const n = f.now;
  // around now, trust the current observation; further away, interpolate the hourly series
  if (Math.abs(ms - n.t) < 45 * 60e3) return n;
  const H = f.hours;
  if (!H.length || ms < H[0].t || ms > H[H.length - 1].t) return null;
  let i = 0;
  while (i < H.length - 2 && H[i + 1].t <= ms) i++;
  return mix(H[i], H[i + 1], clamp((ms - H[i].t) / (H[i + 1].t - H[i].t), 0, 1));
}

/** What the HUD shows: the live reading, or null while offline. */
export function liveNow(cityId: string) {
  const f = feeds.get(cityId);
  if (!f || Date.now() - f.fetched > STALE) return null;
  return { temp: f.now.temp, feels: f.now.feels, humidity: f.now.humidity, code: f.now.code, age: Date.now() - f.fetched };
}
