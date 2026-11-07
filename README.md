# LoFi City

Lo-fi pixel-art scenes that follow each city's **real clock** and **live weather**. If it's raining there, it rains on screen; if it's night there, it's night here. Comes with two radio stations playing real music released under Creative Commons.

**Live:** https://loficity-lac.vercel.app

**Cities**

- **Tokyo** (default): `Esquina da chuva` (rain corner), `Beco neon` (neon alley), `Rua do konbini` (konbini street), `Santuário` (shrine). Japanese seasons: sakura, tsuyu, momiji, year-end snow, hanabi.
- **Esperança, Paraíba, Brazil** (Brasília time): `Praça da Matriz`, the square in front of the Nossa Senhora do Bom Conselho church, and `Rua do Comércio`, the main shopping street. Local calendar: the patron saint's festival in January, São João in June, Christmas.

Everything is drawn in code, with no image assets: an indexed framebuffer whose palette is graded for day, night, sunset and overcast skies.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # dist/index.html, a single self-contained file
pnpm shot       # screenshots into ./shots (needs a build)
```

## URL options

- `#city=esperanca` or `#city=tokyo`
- `#scene=praca-matriz`: pin a scene (`praca-matriz`, `rua-comercio`, `rain-corner`, `neon-alley`, `konbini`, `shrine`)
- `#at=2026-12-24T22:00`: freeze a moment in the city's time zone (for testing; the UI always uses real time)
- `#wx=rain`: force the weather (`clear`, `cloudy`, `rain`, `snow`, `storm`, `fog`)

## Keys

T city, S scene, R radio, N next track, P station, M ambient sound, W rain on glass, C CRT, L lightning, D details, Enter fullscreen.

## Layout

- `src/engine`: indexed framebuffer, palette, WebGL2 post-processing
- `src/sky`: cities, clock and astronomy, climate models (Japan and Brazil's Agreste), live weather, palette grading
- `src/fx`: rain, snow, petals and leaves, lightning, fireworks
- `src/actors`: pedestrians, cars and motorcycles, trees
- `src/scenes`: shared passes, the Esperança prop kit (`br-kit.ts`) and one file per scene
- `src/audio`: generative ambience and the radio

## Credits

- **Weather**: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). No API key; refreshes every 10 minutes and falls back to the simulated climate if the network fails.
- **Music**: streamed from the [Internet Archive](https://archive.org/), released by their labels under Creative Commons licenses. The radio shows each track's artist, album and license with a link to the original page.
  - Rádio Lo-Fi City: [Dusted Wax Kingdom](https://archive.org/search?query=identifier%3ADWK%2A) (CC BY-NC-ND).
  - Rádio Vaporwave: releases from netlabels such as Enough Records, Section 27, Internet Daemon and others (CC BY-NC-ND / BY-NC-SA / BY-SA).
  - The music is **not** part of this repository or its MIT license, and the NC licenses forbid commercial use.

## Privacy

The hosted site uses [Vercel Web Analytics](https://vercel.com/docs/analytics) and [Speed Insights](https://vercel.com/docs/speed-insights). Both are cookieless and only collect visit counts per city (`/tokyo`, `/esperanca`) and performance metrics. Nothing is sent when running locally.

## License

Code under the [MIT](LICENSE) license.
