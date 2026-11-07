/* Two radio stations playing real recordings released under Creative Commons, streamed from
   the Internet Archive (no key, CORS open). Each station is a curated list of albums put
   online by their own netlabels; tracks are fetched live from archive.org's metadata API,
   shuffled across albums, and every track shows artist, album and license as attribution.
   - Rádio Lo-Fi City: Dusted Wax Kingdom, the lo-fi hip hop netlabel (CC BY-NC-ND).
   - Rádio Vaporwave: vaporwave, chillwave and synthwave from CC netlabels.
   The licenses are non-commercial: fine for this free app; check them before monetizing. */

interface Station { id: 'lofi' | 'vapor'; name: string; albums: string[] }
const STATIONS: Station[] = [
  {
    id: 'lofi', name: 'Rádio Lo-Fi City',
    albums: ['DWK123', 'DWK226', 'DWK301', 'DWK127', 'DWK315', 'DWK114', 'DWK117', 'DWK155', 'DWK044', 'DWK119', 'DWK107',
      'DWK137', 'DWK163', 'DWK138', 'DWK069', 'DWK145', 'DWK154', 'DWK383', 'DWK100', 'DWK382', 'DWK031'],
  },
  {
    id: 'vapor', name: 'Rádio Vaporwave',
    albums: ['SCL160', 'ca492_ai', 'Mam135-Evenings-NorthDormEp', 's27-100VariousArtists-SectionedV3.0', 'enrmp345_herr_doktor_-_199x',
      'enrcmp23_-_meet_me_at_kuiper_s', 'v-a-anime-compilation-ii', '2003-toyota-corolla'],
  },
];

interface Track { url: string; title: string; artist: string; album: string; license: string; page: string }

const LICENSE: [RegExp, string][] = [
  [/publicdomain\/zero/, 'CC0'], [/publicdomain/, 'domínio público'],
  [/licenses\/([a-z-]+)\/([\d.]+)/, ''],
];
function licenseName(url: string): string {
  for (const [re, name] of LICENSE) {
    const m = re.exec(url);
    if (m) return name || `CC ${m[1].toUpperCase()} ${m[2]}`;
  }
  return 'Creative Commons';
}

const albumCache = new Map<string, Track[]>();
async function loadAlbum(id: string): Promise<Track[]> {
  const hit = albumCache.get(id);
  if (hit) return hit;
  const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`archive ${res.status}`);
  const j = await res.json();
  const md = j.metadata ?? {}, files: { name: string; source?: string; format?: string; title?: string; artist?: string; creator?: string }[] = j.files ?? [];
  // archive.org's VBR derivatives are a fraction of the originals' size, so they start sooner
  const mp3 = files.filter((f) => /\.mp3$/i.test(f.name) && !/_64kb\.mp3$/i.test(f.name));
  const vbr = mp3.filter((f) => f.format === 'VBR MP3'), orig = mp3.filter((f) => f.source === 'original');
  const pick = vbr.length ? vbr : orig.length ? orig : mp3;
  const creator = Array.isArray(md.creator) ? md.creator[0] : md.creator ?? '';
  const tracks = pick.map((f) => ({
    url: `https://archive.org/download/${encodeURIComponent(id)}/${f.name.split('/').map(encodeURIComponent).join('/')}`,
    title: f.title || f.name.replace(/^.*\//, '').replace(/\.mp3$/i, '').replace(/_/g, ' '),
    artist: f.artist || f.creator || creator || 'artista desconhecido',
    album: String(md.title ?? id), license: licenseName(String(md.licenseurl ?? '')), page: `https://archive.org/details/${id}`,
  }));
  albumCache.set(id, tracks);
  return tracks;
}

// ---------- player ----------
// Two players: one plays while the other buffers the next track, so changes are near instant
// even when archive.org is slow to start a stream.
const players = [new Audio(), new Audio()];
for (const p of players) p.preload = 'auto';
let active = 0;
const audio = () => players[active], spare = () => players[1 - active];
let el: HTMLElement | null = null, playing = false, si = 0, volume = 0.7, loading = false;
let current: Track | null = null, preloaded: Track | null = null, queue: Track[] = [], recent: string[] = [];
let errors = 0, gen = 0, watchdog = 0;
try {
  si = Math.max(0, STATIONS.findIndex((s) => s.id === localStorage.getItem('loficity:station')));
  volume = Number(localStorage.getItem('loficity:volume') ?? 0.7);
} catch { /* storage unavailable */ }
if (!Number.isFinite(volume)) volume = 0.7;
for (const p of players) p.volume = volume;
const station = () => STATIONS[si];
const STALL_MS = 12000;

/** Refill the queue from an album not played recently, shuffled. */
async function refill() {
  const s = station(), pool = s.albums.filter((a) => !recent.includes(a));
  const id = (pool.length ? pool : s.albums)[(Math.random() * (pool.length || s.albums.length)) | 0];
  recent.push(id); if (recent.length > Math.min(6, s.albums.length - 1)) recent.shift();
  const tracks = [...(await loadAlbum(id))];
  for (let i = tracks.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [tracks[i], tracks[j]] = [tracks[j], tracks[i]]; }
  queue.push(...tracks.slice(0, 4)); // a few from this album, then move on
}

async function next() {
  const my = ++gen;
  clearTimeout(watchdog);
  audio().pause();
  loading = true; render();
  try {
    if (!queue.length) await refill();
    if (my !== gen) return; // superseded by a newer skip or a station change
    const t = queue.shift();
    if (!t) throw new Error('empty album');
    current = t;
    if (preloaded === t) active = 1 - active; else audio().src = t.url;
    preloaded = null;
    if (playing) audio().play().catch(() => {}); // failures surface as the 'error' event
    // a stream that has not started after a while is skipped
    watchdog = window.setTimeout(() => { if (my === gen && playing && audio().readyState < 3 && ++errors < 6) void next(); }, STALL_MS);
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: `${t.album} · ${station().name}` });
  } catch {
    if (my !== gen) return;
    loading = false;
    if (++errors < 5 && playing) { void next(); return; }
  }
  loading = false; render();
}

/** Start buffering the upcoming track in the idle player. */
async function preloadNext() {
  const my = gen;
  if (!queue.length) { try { await refill(); } catch { return; } }
  const t = queue[0];
  if (my !== gen || !t || preloaded === t) return;
  preloaded = t; spare().src = t.url; spare().load();
}

for (const p of players) {
  p.addEventListener('ended', () => { if (p === audio()) void next(); });
  p.addEventListener('playing', () => { if (p !== audio()) return; errors = 0; clearTimeout(watchdog); render(); void preloadNext(); });
  p.addEventListener('error', () => {
    if (p !== audio()) { preloaded = null; return; }
    if (playing && !loading) { if (++errors < 5) void next(); else stop(); }
  });
}

function start() {
  playing = true;
  if (!current) void next();
  else void audio().play().catch(() => {});
  render();
}
function stop() { playing = false; clearTimeout(watchdog); audio().pause(); render(); }
function toggle() { if (playing) stop(); else start(); }
function nextStation() {
  si = (si + 1) % STATIONS.length;
  try { localStorage.setItem('loficity:station', station().id); } catch { /* ignore */ }
  gen++; queue = []; recent = []; current = null; preloaded = null;
  for (const p of players) { p.pause(); p.removeAttribute('src'); p.load(); }
  if (playing) void next(); else render();
}
function skip() { playing = true; void next(); }

// ---------- panel ----------
function render() {
  if (!el) return;
  el.className = `radio${playing ? ' playing' : ''}${station().id === 'vapor' ? ' vapor' : ''}`;
  (el.querySelector('.station') as HTMLElement).textContent = station().name;
  const track = el.querySelector('.track') as HTMLElement, lic = el.querySelector('.lic') as HTMLAnchorElement;
  if (loading) track.textContent = 'sintonizando…';
  else if (current) track.textContent = `${current.artist} — ${current.title}`;
  else track.textContent = 'músicas reais com licença Creative Commons';
  if (current) { lic.hidden = false; lic.textContent = `${current.album} · ${current.license} · archive.org`; lic.href = current.page; lic.title = 'Ver o álbum e a licença no Internet Archive'; }
  else lic.hidden = true;
  const play = el.querySelector('[data-a=play]') as HTMLElement;
  play.textContent = playing ? 'Pausar' : 'Tocar';
  play.setAttribute('aria-pressed', String(playing));
}
function mount(e: HTMLElement) {
  el = e;
  el.innerHTML = `<div class="now"><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="meta"><span class="station"></span><span class="track"></span><a class="lic" target="_blank" rel="noopener" hidden></a></span></div>
<div class="ctl"><button data-a="play" title="Tocar / pausar (R)">Tocar</button><button data-a="skip" title="Próxima faixa (N)">Próxima</button><button data-a="station" title="Trocar estação (P)">Estação</button>
<input type="range" min="0" max="1" step="0.01" aria-label="Volume da rádio" title="Volume"></div>`;
  el.querySelector('[data-a=play]')!.addEventListener('click', toggle);
  el.querySelector('[data-a=skip]')!.addEventListener('click', skip);
  el.querySelector('[data-a=station]')!.addEventListener('click', nextStation);
  const vol = el.querySelector('input') as HTMLInputElement;
  vol.value = String(volume);
  vol.addEventListener('input', () => {
    volume = Number(vol.value); for (const p of players) p.volume = volume;
    try { localStorage.setItem('loficity:volume', String(volume)); } catch { /* ignore */ }
  });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', start);
    navigator.mediaSession.setActionHandler('pause', stop);
    navigator.mediaSession.setActionHandler('nexttrack', skip);
  }
  render();
}

export const radio = {
  mount, toggle, nextStation, skip,
  isPlaying: () => playing && !audio().paused,
  status: () => `${station().id} ${playing ? (current ? `"${current.title}" ${audio().currentTime.toFixed(0)}s` : 'loading') : 'off'}`,
};
