/* CAMPO DA RODOVIÁRIA (Esperança, PB): the dirt football pitch beside the bus station.
   Kids play pelada on weekday afternoons, amateur sides play with a referee and a crowd on
   the wall at weekends, and some evenings the floodlights come on for a late game. Next door
   the rodoviária's canopy shelters people waiting while buses come and go to Campina Grande,
   Remígio, Areia and João Pessoa. Rain turns the pitch to mud and stops play. */
import { G, L, Lp, WW, blitLayer, getW, newLayer, put, rect, sx, sy } from '../engine/gfx';
import { bay, clamp, mulberry32, vnoise } from '../engine/math';
import {
  AMB, ASPH, BFAR, BNEAR, CBEIGE, CBLUE, CGREEN, CRED, CYELL, FBLUE, HAIR1, HAIR2, HALO, LEAFG, LEAFGD, LEDW, LIGHT,
  SKIN1, SKIN2, SKIN3, SKIN4, STEEL, STONE, STONEL, TERRA, TILEW, VOID, WCOOL, WDIM, WHITE, WOOD, WWARM, FPINK, CHURCH, CHURCHD,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { casa, isNight, text, textW } from './br-kit';
import type { Scene } from './types';

const HORIZON = 110, STREET = 147, SH = 180 - STREET;
const PITCH = { x0: 10, x1: 290, y0: 150, y1: 178 }, MOUTH = { y0: 157, y1: 171 };
const wr = mulberry32(0xf007), rr = mulberry32(0xba11);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const farWins: { x: number; y: number; rank: number }[] = [];
const FLOODS = [18, 286];

function buildFar() {
  for (let x = -4; x < WW;) {
    const w = 12 + ((wr() * 20) | 0), top = 92 + ((wr() * 16) | 0);
    L(far, x, top, w, 130 - top, BFAR);
    for (let wy = top + 3; wy < 112; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (wr() < 0.14) farWins.push({ x: wx, y: wy, rank: wr() });
    x += w + ((wr() * 3) | 0);
  }
  for (const [cx, r] of [[40, 9], [120, 11], [210, 8], [262, 10]]) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j * 1.4 < r * r) Lp(far, cx + i, 106 + j, LEAFGD);
  const tx = 150; L(far, tx, 70, 6, 30, CHURCH); L(far, tx + 5, 70, 1, 30, CHURCHD); for (let y = 0; y < 8; y++) L(far, tx + 3 - Math.round(3 * (1 - y / 8)), 69 - y, Math.max(1, Math.round(6 * (1 - y / 8))), 1, TERRA);
}

function buildMid() {
  // houses behind the pitch, mostly hidden by the wall
  casa(mid, 0, 46, 36, 140, CBEIGE, WHITE, 'reta', false, wr); casa(mid, 96, 50, 40, 140, FPINK, WHITE, 'escada', false, wr); casa(mid, 196, 44, 34, 140, FBLUE, WHITE, 'frontao', false, wr);
  // pitch wall, whitewashed with a blue skirt and the town's name
  L(mid, 0, 122, 298, 18, TILEW); L(mid, 0, 122, 298, 1, STONEL); L(mid, 0, 135, 298, 5, CBLUE);
  for (let x = 0; x < 298; x += 37) L(mid, x, 122, 2, 18, STONEL);
  text(mid, 'ESPERANÇA PB', 100, 125, FBLUE, 2);
  // rodoviária: white block, blue band with the name, long canopy on pillars
  L(mid, 300, 98, 180, 42, TILEW); L(mid, 300, 98, 180, 8, FBLUE);
  text(mid, 'RODOVIARIA', 390 - (textW('RODOVIARIA', 1) >> 1), 99, WHITE);
  L(mid, 296, 112, 184, 3, STONEL); L(mid, 296, 115, 184, 1, BNEAR);
  for (const x of [312, 352, 392, 432, 472]) L(mid, x, 116, 3, 24, STONEL);
  L(mid, 318, 118, 26, 12, BNEAR); text(mid, 'PASSAGENS', 319, 131, CBLUE); // ticket windows
  L(mid, 438, 118, 30, 16, BNEAR); // lanchonete
  for (const x of [360, 400]) { L(mid, x, 133, 22, 2, STEEL); L(mid, x + 1, 135, 1, 5, STEEL); L(mid, x + 20, 135, 1, 5, STEEL); } // benches
  L(mid, 296, 139, 184, 1, STONEL);
}

function buildFront() {
  L(front, 0, 140, WW, 7, STONE); L(front, 0, 146, WW, 1, STONEL);
  for (const x of FLOODS) { L(front, x, 44, 3, 96, STEEL); L(front, x - 6, 42, 15, 5, STEEL); L(front, x - 6, 42, 15, 1, VOID); }
  L(front, 298, 128, 2, 19, STONEL); // corner post between pitch and station yard
}

function buildGround() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) {
    let c: number;
    if (x >= 300) c = wr() < 0.08 ? STONE : ASPH;
    else {
      // packed earth: broad reddish worn patches, grass surviving along the edges, a few dark specks
      const n = vnoise(3, x * 0.045 + d * 0.21) * 0.7 + vnoise(9, x * 0.13 - d * 0.4) * 0.3, edge = x < 10 || x > 290 || d < 2 || d > SH - 3, q = wr();
      c = q < 0.02 ? WOOD : edge && n > 0.45 ? LEAFG : n < 0.36 ? TERRA : n > 0.8 ? LEAFG : CBEIGE;
    }
    street.base[d * WW + x] = c;
  }
  // worn chalk: halfway line, centre circle, goal areas
  const chalk = (x: number, y: number) => { if (x >= 0 && x < 300 && y >= STREET && y < 180 && wr() < 0.55) street.base[(y - STREET) * WW + x] = TILEW; };
  for (let y = PITCH.y0; y <= PITCH.y1; y++) chalk(150, y);
  for (let a = 0; a < 6.28; a += 0.05) chalk(Math.round(150 + Math.cos(a) * 16), Math.round(164 + Math.sin(a) * 5));
  for (const [gx, dir] of [[PITCH.x0, 1], [PITCH.x1, -1]] as const) { for (let i = 0; i < 26; i++) { chalk(gx + i * dir, 154); chalk(gx + i * dir, 174); } for (let y = 154; y <= 174; y++) chalk(gx + 26 * dir, y); }
  for (let x = 306; x < WW; x += 30) for (let d = 2; d < 14; d++) street.base[d * WW + x] = CYELL;
  // the pitch puddles easily
  for (let p = 0; p < 7; p++) {
    const cx = 20 + wr() * 260, cy = 3 + wr() * (SH - 6), rx = 8 + wr() * 18, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < 300; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- the match ----------
type Mode = 'none' | 'kids' | 'match' | 'night';
interface Player { x: number; y: number; hx: number; hy: number; team: 0 | 1; ph: number; skin: number; hair: number; shirt: number; shorts: number; H: number; gk: boolean; ref: boolean; jump: number }
const ball = { x: 150, y: 164, z: 0, vx: 0, vy: 0, vz: 0 };
let players: Player[] = [], mode: Mode = 'none', kickCd = 0, celebrate = 0, lastTeam: 0 | 1 = 0, score = [0, 0];

function gameMode(): Mode {
  if (S.rain > 0.4 || S.storm > 0.2) return 'none';
  const h = S.cal.hour, wd = S.cal.weekday;
  if ((wd === 0 && hourIn(h, 15.5, 17.6)) || (wd === 6 && hourIn(h, 15, 17.5))) return 'match';
  if (wd >= 1 && wd <= 5 && hourIn(h, 15.5, 18)) return 'kids';
  if ((wd === 2 || wd === 4) && hourIn(h, 19, 21.5)) return 'night';
  return 'none';
}

function setupPlayers(m: Mode) {
  players = []; score = [0, 0];
  if (m === 'none') return;
  const n = m === 'kids' ? 4 : m === 'match' ? 6 : 5;
  const kits = m === 'match' ? [[CRED, WHITE], [CBLUE, WHITE]] : [[WHITE, CBLUE], [0, VOID]]; // kids/night: one side plays shirtless
  const skins = [SKIN1, SKIN2, SKIN2, SKIN3, SKIN3, SKIN4];
  for (const team of [0, 1] as const) for (let i = 0; i < n; i++) {
    const gk = i === 0 && m !== 'kids';
    const hx = team === 0 ? (gk ? PITCH.x0 + 6 : 40 + (i / n) * 100) : gk ? PITCH.x1 - 6 : 260 - (i / n) * 100;
    const hy = PITCH.y0 + 3 + ((i * 7 + team * 3) % 24);
    const skin = skins[(rr() * skins.length) | 0];
    players.push({
      x: hx, y: hy, hx, hy, team, ph: rr() * 6, skin, hair: rr() < 0.7 ? HAIR1 : HAIR2,
      shirt: gk ? CYELL : kits[team][0] || skin, shorts: kits[team][1], H: m === 'kids' ? 12 + ((rr() * 2) | 0) : 15, gk, ref: false, jump: 0,
    });
  }
  if (m === 'match') players.push({ x: 150, y: 168, hx: 150, hy: 168, team: 0, ph: 0, skin: SKIN2, hair: HAIR1, shirt: VOID, shorts: VOID, H: 15, gk: false, ref: true, jump: 0 });
  resetBall();
}
function resetBall() { ball.x = 150; ball.y = 164; ball.z = 0; ball.vx = ball.vy = ball.vz = 0; kickCd = 0.8; }

function kick(p: Player) {
  const goalX = p.team === 0 ? PITCH.x1 : PITCH.x0, dist = Math.abs(goalX - p.x);
  if (dist < 90 && rr() < 0.6) { // shoot
    const ty = MOUTH.y0 + rr() * (MOUTH.y1 - MOUTH.y0) + (rr() - 0.5) * 10, sp = 130 + rr() * 50, dx = goalX - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    ball.vx = (dx / d) * sp; ball.vy = (dy / d) * sp; ball.vz = 20 + rr() * 45;
  } else { // pass forward to a teammate, or punt it upfield
    const mates = players.filter((q) => !q.ref && q !== p && q.team === p.team && (p.team === 0 ? q.x > p.x - 10 : q.x < p.x + 10));
    const t = mates.length ? mates[(rr() * mates.length) | 0] : null;
    const tx = t ? t.x : goalX, ty = t ? t.y : 164, dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1, sp = 70 + rr() * 40;
    ball.vx = (dx / d) * sp; ball.vy = (dy / d) * sp; ball.vz = rr() < 0.3 ? 40 : 6;
  }
  lastTeam = p.team; kickCd = 0.35;
}

function updateMatch(dt: number) {
  const m = gameMode();
  if (m !== mode) { mode = m; setupPlayers(m); }
  if (mode === 'none') return;
  kickCd -= dt;
  if (celebrate > 0) {
    celebrate -= dt;
    for (const p of players) { p.jump = p.team === lastTeam && !p.ref && !p.gk ? Math.abs(Math.sin(celebrate * 9 + p.ph)) * 3 : 0; p.x += (p.hx - p.x) * dt * 0.8; p.y += (p.hy - p.y) * dt * 0.8; }
    if (celebrate <= 0) resetBall();
    return;
  }
  // ball physics: rolling friction, gravity, bounces; mud slows it down
  const drag = 1.1 + S.wet * 1.5;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.vx *= Math.exp(-drag * dt); ball.vy *= Math.exp(-drag * dt);
  ball.vz -= 160 * dt; ball.z += ball.vz * dt; if (ball.z < 0) { ball.z = 0; ball.vz = -ball.vz * 0.45; if (Math.abs(ball.vz) < 8) ball.vz = 0; }
  // goal or out of play
  if (ball.x < PITCH.x0 || ball.x > PITCH.x1) {
    if (ball.y > MOUTH.y0 && ball.y < MOUTH.y1 && ball.z < 13) { score[ball.x > 150 ? 0 : 1]++; lastTeam = ball.x > 150 ? 0 : 1; celebrate = 3; ball.vx = ball.vy = 0; return; }
    ball.x = clamp(ball.x, PITCH.x0 + 8, PITCH.x1 - 8); ball.vx = ball.vy = 0; ball.z = 0; kickCd = 0.6; // goal kick
  }
  if (ball.y < PITCH.y0 || ball.y > PITCH.y1) { ball.y = clamp(ball.y, PITCH.y0 + 1, PITCH.y1 - 1); ball.vx *= 0.2; ball.vy = 0; kickCd = 0.6; } // throw-in
  // players: the nearest of each side chases, keepers guard the line, the rest hold shape around the ball
  const chaser = [0, 1].map((team) => players.filter((p) => !p.ref && !p.gk && p.team === team).reduce((a, b) => (Math.hypot(a.x - ball.x, a.y - ball.y) < Math.hypot(b.x - ball.x, b.y - ball.y) ? a : b)));
  for (const p of players) {
    let tx: number, ty: number, sp = mode === 'kids' ? 34 : 30;
    if (p.ref) { tx = ball.x + 20; ty = clamp(ball.y + 8, PITCH.y0, PITCH.y1); sp = 24; }
    else if (p.gk) { tx = p.hx; ty = clamp(ball.y, MOUTH.y0, MOUTH.y1); sp = 22; }
    else if (p === chaser[p.team]) { tx = ball.x; ty = ball.y; sp *= 1.15; }
    else { tx = p.hx + (ball.x - 150) * 0.55; ty = p.hy + (ball.y - p.hy) * 0.25; }
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d > 1.5) { const k = Math.min(1, (sp * dt) / d); p.x += dx * k; p.y += dy * k; p.ph += sp * dt * 0.45; }
    p.jump = 0;
    if (!p.ref && kickCd <= 0 && ball.z < 6 && Math.hypot(p.x - ball.x, p.y - ball.y) < 3.5) kick(p);
  }
}

function drawPlayer(p: Player) {
  const x = Math.round(p.x) - 1, feet = Math.round(p.y - p.jump), H = p.H, step = Math.sin(p.ph);
  const legH = Math.round(H * 0.36), bodyH = Math.round(H * 0.34), headH = 3, top = feet - H;
  rect(x - 1, Math.round(p.y), 5, 1, BNEAR); // shadow on the ground
  // legs scissor with the stride; boots dark
  const a = Math.round(step * 1.5), b = -a;
  rect(x + a, feet - legH, 1, legH, p.skin); rect(x + 2 + b, feet - legH, 1, legH, p.skin);
  put(x + a, feet - 1, VOID); put(x + 2 + b, feet - 1, VOID);
  rect(x, feet - legH - 2, 3, 3, p.shorts);
  rect(x, top + headH, 3, bodyH, p.shirt);
  put(x + (step > 0 ? 3 : -1), top + headH + 1, p.skin); put(x + (step > 0 ? -1 : 3), top + headH + 2, p.skin); // arms swing
  rect(x, top, 3, headH, p.skin); rect(x, top, 3, 1, p.hair);
}

function drawGoal(gx: number, dir: number) {
  // side view: near post low on screen, far post higher up, crossbar between, netting behind
  const nearY = MOUTH.y1, farY = MOUTH.y0, h = 13;
  const back = gx - dir * 5;
  for (let y = farY; y <= nearY; y++) for (let j = 0; j < h; j++) if ((y + j) % 2 === 0) put(back, y - h + j, WHITE);
  rect(gx, nearY - h, 1, h, WHITE); rect(gx, farY - h, 1, h, STONEL);
  for (let y = farY; y <= nearY; y++) put(gx, y - h, WHITE);
  for (let i = 0; i < 5; i++) { put(gx - dir * i, nearY - h, WHITE); put(gx - dir * i, farY - h, STONEL); }
}

function drawBall() {
  put(ball.x, ball.y, BNEAR); put(ball.x + 1, ball.y, BNEAR);
  rect(Math.round(ball.x), Math.round(ball.y - ball.z) - 2, 2, 2, WHITE); put(Math.round(ball.x) + 1, Math.round(ball.y - ball.z) - 1, VOID);
}

/** Crowd sitting on the wall during weekend matches. */
function wallCrowd() {
  if (mode !== 'match') return;
  const t = S.ms / 1000, cheer = celebrate > 0;
  for (let i = 0; i < 26; i++) {
    const x = 6 + ((i * 53) % 288), c = [CRED, CBLUE, WHITE, CYELL, CGREEN, VOID][i % 6], up = cheer && Math.sin(t * 10 + i) > 0 ? 1 : 0;
    rect(x, 116 - up, 2, 4, c); rect(x, 113 - up, 2, 3, [SKIN1, SKIN2, SKIN3, SKIN4][i % 4]); put(x, 120, BNEAR); put(x + 1, 121, BNEAR);
  }
}

// ---------- buses ----------
const DEST = ['CAMPINA GRANDE', 'REMIGIO', 'AREIA', 'JOAO PESSOA'];
const bus = { x: 340, state: 'parked' as 'parked' | 'leaving' | 'arriving' | 'away', t: 120, dest: 0, stripe: CGREEN };
function updateBus(dt: number) {
  const open = hourIn(S.cal.hour, 5.5, 23);
  bus.t -= dt;
  if (bus.state === 'parked' && bus.t <= 0) { bus.state = 'leaving'; }
  else if (bus.state === 'leaving') { bus.x += 26 * dt; if (bus.x > 500) { bus.state = 'away'; bus.t = 20 + rr() * 60; } }
  else if (bus.state === 'away' && bus.t <= 0 && open) { bus.state = 'arriving'; bus.x = 500; bus.dest = (rr() * DEST.length) | 0; bus.stripe = [CGREEN, CBLUE, CRED, CYELL][(rr() * 4) | 0]; }
  else if (bus.state === 'arriving') { bus.x -= 24 * dt; if (bus.x <= 340) { bus.x = 340; bus.state = 'parked'; bus.t = 90 + rr() * 240; } }
}
function drawBus() {
  if (bus.state === 'away') return;
  const x = Math.round(bus.x), y = 140, n = isNight();
  rect(x, y - 19, 62, 16, TILEW); rect(x, y - 9, 62, 2, bus.stripe); rect(x, y - 4, 62, 1, STEEL);
  for (let wx = x + 3; wx < x + 54; wx += 7) rect(wx, y - 17, 5, 5, n ? LIGHT : WDIM);
  rect(x + 55, y - 17, 6, 9, n ? WCOOL : WDIM); // windscreen at the front (right)
  rect(x + 2, y - 21, 58, 2, VOID); text(null, DEST[bus.dest], x + 31 - (textW(DEST[bus.dest]) >> 1) | 0, y - 26, n ? AMB : CYELL);
  for (const wx of [x + 8, x + 48]) { rect(wx, y - 4, 5, 4, VOID); put(wx + 2, y - 2, STEEL); }
  if (n) { put(x + 61, y - 6, LEDW); put(x, y - 6, CRED); }
}

// ---------- lights ----------
function lit() {
  const n = isNight();
  for (const f of farWins) put(f.x, f.y, n && f.rank < 0.45 ? WWARM : BFAR);
  const open = hourIn(S.cal.hour, 5.5, 23);
  rect(319, 119, 24, 10, open ? (n ? WWARM : WDIM) : BNEAR); rect(439, 119, 28, 14, open ? (n ? WWARM : WDIM) : BNEAR);
  if (n && open) for (let x = 300; x < 480; x += 20) put(x + 10, 115, LEDW); // canopy lights
}
function floodlights() {
  const on = mode === 'night' || (mode !== 'none' && S.dayK < 0.4);
  for (const x of FLOODS) for (let i = 0; i < 4; i++) rect(x - 5 + i * 3, 43, 2, 3, on ? LEDW : STONEL);
  if (!on) return;
  for (let y = 140; y < 180; y++) for (let x = 0; x < 300; x++) {
    const d = Math.min(Math.hypot((x - FLOODS[0]) / 190, (y - 165) / 40), Math.hypot((x - FLOODS[1]) / 190, (y - 165) / 40));
    const X = sx(x), Y = sy(y);
    if (X < 0 || X >= G.W || Y < 0 || Y >= G.H) continue;
    const c = getW(x, y);
    if (c !== CBEIGE && c !== TERRA && c !== LEAFG && c !== WOOD && c !== STONE) continue;
    if (bay(X, Y) < 0.16 * (1 - d)) put(x, y, HALO);
  }
}

function update(dt: number) {
  updateMatch(dt); updateBus(dt);
  tickSpawns(dt, mode === 'match' ? 2 : 1); updatePeople(dt);
}

const FOG = [{ y: 104, h: 9, sp: 0.4 }, { y: 150, h: 6, sp: -0.3 }];
function render() {
  drawSky(HORIZON); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid); lit(); wallCrowd(); drawBus(); drawFarPrecip();
  blitLayer(front); drawPeople();
  drawStreet(street); floodlights();
  drawGoal(PITCH.x0, 1); drawGoal(PITCH.x1, -1);
  if (mode !== 'none') {
    const list = [...players].sort((a, b) => a.y - b.y);
    let drawn = false;
    for (const p of list) { if (!drawn && p.y > ball.y) { drawBall(); drawn = true; } drawPlayer(p); }
    if (!drawn) drawBall();
  }
  drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const campoRodoviaria: Scene = {
  id: 'campo-rodoviaria',
  name: 'Campo da Rodoviária',
  build() {
    if (!built) { buildFar(); buildMid(); buildFront(); buildGround(); built = true; }
    setLanes([{ y: 142 }, { y: 145 }]);
    configure({ roofs: [{ x0: 296, x1: 480, y: 112 }], tips: [{ x: 297, y: 114, end: 140 }], lamps: [], ground0: 140, horizon: HORIZON });
    mode = 'none';
    for (let i = 0; i < 120; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}  jogo ${mode}  placar ${score[0]}x${score[1]}  ônibus ${bus.state} ${DEST[bus.dest]}`; },
};
