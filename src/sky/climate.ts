/* Procedural climate models, used when live weather is unavailable and to fill the hours
   before the live data starts. Weather is a pure function of time, so a reload lands on the
   same sky. Japan: a northern Honshu city, cold enough for a white year end. Agreste:
   Esperança on the Borborema plateau, mild all year, rainy from March to July. */
import { clamp, hashf, ss, vnoise } from '../engine/math';
import type { Climate } from './cities';
import { type Cal, doyOf, inDoy } from './time';

// Monthly means at mid-month (°C), precipitation chance, summer storm and typhoon odds.
const TEMP = [0.2, 0.8, 4.2, 10, 15, 19, 23, 25, 21, 15, 8.5, 2.6];
const PRECIP = [0.3, 0.3, 0.36, 0.4, 0.4, 0.5, 0.45, 0.36, 0.48, 0.4, 0.3, 0.38];
const STORM = [0, 0, 0, 0.05, 0.1, 0.15, 0.5, 0.6, 0.45, 0.15, 0, 0];
const TYPHOON = [0, 0, 0, 0, 0, 0, 0.02, 0.05, 0.07, 0.04, 0, 0];

export interface Wx {
  temp: number; precip: number; rain: number; snow: number; storm: number;
  cloud: number; fog: number; wind: number; typhoon: boolean; tsuyu: boolean;
}

function monthTemp(doy: number): number {
  const m = doy / 30.44 - 0.5, i = Math.floor(m), f = m - i;
  return TEMP[(i + 12) % 12] + (TEMP[(i + 13) % 12] - TEMP[(i + 12) % 12]) * ss(0, 1, f);
}

function japan(ms: number, cal: Cal): Wx {
  const h = ms / 3.6e6, { month: m, doy, hour } = cal;
  const tsuyu = inDoy(doy, doyOf(5, 7), doyOf(6, 19));
  const yearEnd = inDoy(doy, doyOf(11, 15), doyOf(0, 10));

  let p = tsuyu ? 0.72 : PRECIP[m];
  if (yearEnd) p += 0.12;
  const pot = 0.65 * vnoise(11, h / 6) + 0.35 * vnoise(23, h / 1.7);
  const q = 0.5 + (0.5 - p) * 0.45;
  let precip = clamp(((pot - q) / (0.95 - q)) * 1.3, 0, 1);
  let cloud = clamp((pot - (q - 0.22)) / 0.3, 0, 1) * 0.95 + (tsuyu ? 0.3 : 0.04);
  if (tsuyu) precip = Math.min(precip, 0.55);

  const afternoon = ss(12, 15, hour) * (1 - ss(19, 23, hour));
  let storm = clamp(STORM[m] * ss(0.35, 0.8, precip) * (0.4 + 0.6 * afternoon) * 2, 0, 1);
  let wind = 0.05 + (vnoise(41, h / 2) - 0.5) * 0.16;

  const dayKey = cal.year * 400 + doy;
  const typhoonToday = hashf(dayKey * 7 + 3) < TYPHOON[m];
  let typhoon = false;
  if (typhoonToday) {
    const k = 1 - Math.abs(hour - (6 + hashf(dayKey) * 12)) / 7;
    if (k > 0) {
      typhoon = true;
      precip = Math.max(precip, 0.55 + 0.45 * k); storm = Math.max(storm, k); wind += 0.8 * k; cloud = 1;
    }
  }

  let temp = monthTemp(doy) + 4 * Math.cos((2 * Math.PI * (hour - 14)) / 24) * (1 - 0.6 * Math.min(1, cloud))
    + (vnoise(37, h / 40) - 0.5) * 6 - precip * 1.5;
  if (yearEnd) temp -= 1.5;
  const snowFrac = ss(2.2, -0.5, temp);
  const snow = precip * snowFrac, rain = precip - snow;
  if (snow > 0.6) wind += 0.1;
  wind += storm * 0.45;

  const morning = ss(3, 5, hour) * (1 - ss(7, 9.5, hour));
  const fog = clamp(0.12 + (tsuyu ? 0.3 : 0) + 0.3 * morning + 0.22 * rain * (1 - storm * 0.5) + 0.25 * snow, 0, 1);

  return { temp, precip, rain, snow, storm, cloud: clamp(cloud, 0, 1), fog, wind, typhoon, tsuyu };
}

// Esperança (PB): monthly means, rain odds and thunderstorm odds.
const A_TEMP = [23.5, 23.6, 23.4, 22.9, 21.9, 20.6, 19.8, 19.9, 21, 22.3, 23, 23.4];
const A_PRECIP = [0.24, 0.3, 0.42, 0.5, 0.5, 0.55, 0.5, 0.36, 0.2, 0.1, 0.1, 0.15];
const A_STORM = [0.25, 0.3, 0.4, 0.35, 0.15, 0.05, 0.03, 0.02, 0.02, 0.05, 0.1, 0.2];

function agreste(ms: number, cal: Cal): Wx {
  const h = ms / 3.6e6, { month: m, doy, hour } = cal;
  const p = A_PRECIP[m];
  const pot = 0.6 * vnoise(13, h / 5) + 0.4 * vnoise(29, h / 1.4);
  const q = 0.5 + (0.5 - p) * 0.5;
  // winter rain on the plateau is mostly drizzle; summer rain comes as afternoon showers
  const winter = m >= 4 && m <= 7;
  let precip = clamp(((pot - q) / (0.95 - q)) * (winter ? 0.8 : 1.3), 0, 1);
  const cloud = clamp((pot - (q - 0.25)) / 0.3, 0, 1) * 0.95 + (winter ? 0.15 : 0.02);
  const afternoon = ss(12, 15, hour) * (1 - ss(19, 23, hour));
  if (!winter) precip *= 0.5 + 0.7 * afternoon;
  const storm = clamp(A_STORM[m] * ss(0.4, 0.8, precip) * (0.3 + 0.7 * afternoon) * 2, 0, 1);
  const wind = 0.08 + (vnoise(43, h / 2) - 0.5) * 0.14 + storm * 0.4;
  const mi = doy / 30.44 - 0.5, i = Math.floor(mi), f = mi - i;
  const mean = A_TEMP[(i + 12) % 12] + (A_TEMP[(i + 13) % 12] - A_TEMP[(i + 12) % 12]) * ss(0, 1, f);
  const temp = mean + 4.2 * Math.cos((2 * Math.PI * (hour - 14)) / 24) * (1 - 0.5 * Math.min(1, cloud))
    + (vnoise(39, h / 40) - 0.5) * 3 - precip * 1.5;
  const dawn = ss(3, 5, hour) * (1 - ss(7, 9, hour));
  const fog = clamp(0.08 + (winter ? 0.45 : 0.1) * dawn + 0.2 * precip * (1 - storm), 0, 1);
  return { temp, precip, rain: precip, snow: 0, storm, cloud: clamp(cloud, 0, 1), fog, wind, typhoon: false, tsuyu: false };
}

export const weather = (ms: number, cal: Cal, climate: Climate): Wx => (climate === 'agreste' ? agreste(ms, cal) : japan(ms, cal));
