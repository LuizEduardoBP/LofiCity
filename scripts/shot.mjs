// Screenshots of the built page at chosen moments and screen sizes.
// Usage: node scripts/shot.mjs [cases.json]  (writes PNGs into ./shots)
// cases.json: [["name", "2026-12-24T22:00", width, height], ...]
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const page = pathToFileURL(resolve('dist/index.html')).href;
const cases = (process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : [
  ['night-nov', '2026-11-07T21:30', 1280, 720],
  ['day-nov', '2026-11-07T13:00', 1280, 720],
  ['sunset-oct', '2026-10-25T17:10', 1280, 720],
  ['snow-dec', '2026-12-28T23:00', 1280, 720],
  ['sakura-apr', '2027-04-02T15:00', 1280, 720],
  ['fireworks-aug', '2026-08-08T20:00', 1280, 720],
  ['portrait-night', '2026-11-07T21:30', 390, 844],
  ['ultrawide', '2026-11-07T21:30', 2560, 1080],
]);

mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
for (const [name, at, w, h, extra = ''] of cases) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await p.goto(`${page}#at=${at}&${extra.includes('scene=') ? '' : 'scene=rain-corner&'}${extra}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await p.waitForTimeout(Number(process.env.WAIT ?? 2500));
  await p.keyboard.press('d');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `shots/${name}.png` });
  console.log(name, errors.length ? 'ERRORS: ' + errors.join(' | ') : 'ok');
  await ctx.close();
}
await browser.close();
