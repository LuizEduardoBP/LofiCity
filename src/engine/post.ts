/* Presents the indexed frame: palette → RGBA, then WebGL2 bloom, rain-on-glass, CRT and grain,
   scaled to cover the whole screen. Falls back to Canvas2D nearest-neighbour scaling. */
import { G } from './gfx';
import { PAL32 } from './palette';

const VS = `#version 300 es
out vec2 v; void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); v=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;
const FS_BRIGHT = `#version 300 es
precision mediump float; in vec2 v; out vec4 o; uniform sampler2D uS; uniform float uTh;
void main(){ vec3 c=texture(uS,v).rgb; float l=max(c.r,max(c.g,c.b)); o=vec4(c*smoothstep(uTh,.97,l),1.); }`;
const FS_BLUR = `#version 300 es
precision mediump float; in vec2 v; out vec4 o; uniform sampler2D uS; uniform vec2 uD;
void main(){ vec3 c=texture(uS,v).rgb*.227027;
 c+=(texture(uS,v+uD*1.3846).rgb+texture(uS,v-uD*1.3846).rgb)*.3162162;
 c+=(texture(uS,v+uD*3.2308).rgb+texture(uS,v-uD*3.2308).rgb)*.0702703; o=vec4(c,1.); }`;
const FS_FINAL = `#version 300 es
precision highp float; in vec2 v; out vec4 o;
uniform sampler2D uS, uB; uniform float uT, uCrt, uWin, uShake, uBloom, uAsp, uH;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
vec3 drops(vec2 uv, float t, vec2 g){
  vec2 a=vec2(uAsp,1.); vec2 st=uv*a*g; st.y+=t*.25;
  vec2 id=floor(st), f=fract(st)-.5; float n=h21(id);
  float tt=t*.9+n*6.2831; float y=-sin(tt+sin(tt+sin(tt)*.5))*.38;
  float x=(n-.5)*.7 + (fract(n*13.7)-.5)*.08*sin(f.y*8.);
  vec2 d=(f-vec2(x,y))*vec2(1.,1.3);
  float drop=smoothstep(.1,.04,length(d));
  float tr=smoothstep(.035,.0,abs(f.x-x))*smoothstep(y,y+.04,f.y)*(1.-smoothstep(y,.5,f.y));
  vec2 sid=floor(uv*a*g*3.5); vec2 sf=fract(uv*a*g*3.5)-.5; float sn=h21(sid+7.);
  float st2=step(.9,sn)*smoothstep(.22,.1,length(sf-(vec2(fract(sn*7.),fract(sn*13.))-.5)*.4));
  vec2 off=(-d*drop*.8 - sf*st2*.3/3.5)/(a*g); off.y+=tr*.002;
  return vec3(off, drop+tr*.35+st2*.5);
}
void main(){
  vec2 uv=v; vec2 c=v*2.-1.;
  if(uCrt>.5){ vec2 k=c*(1.+dot(c,c)*.045); uv=k*.5+.5; }
  float hi=0.;
  if(uWin>.5){ vec2 gs=vec2(9.,3.)*vec2(1.,uH/180.); vec3 a=drops(uv,uT,gs); vec3 b=drops(uv*1.6+.37,uT*.7,gs*1.45); uv+=a.xy+b.xy*.7; hi=(a.z+b.z*.7); }
  uv.y+=uShake/uH;
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.){ o=vec4(0.,0.,0.,1.); return; }
  vec3 col=texture(uS,uv).rgb; col+=texture(uB,uv).rgb*uBloom;
  if(uWin>.5){
    col=col*(1.+hi*.12)+hi*.015;
    col=mix(col, col*1.05+vec3(.02,.025,.04), (1.-smoothstep(0.,.28,v.y))*.55);
    float fx=min(v.x,1.-v.x), fy=min(v.y,1.-v.y);
    float fr=step(fx,.022/uAsp*1.78)+step(fy,.035)+step(abs(v.x-.5),.005/uAsp*1.78)+step(abs(v.y-.64),.008);
    if(fr>0.) col=vec3(.045,.035,.06)+vec3(.09,.05,.03)*smoothstep(.0,.02,fx)*step(.004,fx);
  }
  if(uCrt>.5){ float row=uv.y*uH; col*=.76+.24*sin(fract(row)*3.14159); col*=1.06; }
  vec2 vc=c*vec2(.85,1.); col*=1.-.2*dot(vc,vc);
  col+=(h21(gl_FragCoord.xy+fract(uT*7.)*311.)-.5)*.03;
  o=vec4(col,1.);
}`;

interface GLR {
  gl: WebGL2RenderingContext; pB: WebGLProgram; pBl: WebGLProgram; pF: WebGLProgram; vao: WebGLVertexArrayObject;
  scene?: WebGLTexture; t0?: WebGLTexture; t1?: WebGLTexture; t2?: WebGLTexture;
  f0?: WebGLFramebuffer; f1?: WebGLFramebuffer; f2?: WebGLFramebuffer; bw: number; bh: number; w: number; h: number;
  u: Record<string, WebGLUniformLocation | null>; uBlD: WebGLUniformLocation | null; uBlS: WebGLUniformLocation | null;
  uBS: WebGLUniformLocation | null; uTh: WebGLUniformLocation | null;
}

export const opts = { crt: false, win: false };
const view = document.getElementById('view') as HTMLCanvasElement;
let R: GLR | null = null, ctx2d: CanvasRenderingContext2D | null = null;
let low: HTMLCanvasElement | null = null, lowCtx: CanvasRenderingContext2D | null = null;
let img = new ImageData(G.W, G.H), out32 = new Uint32Array(img.data.buffer);
const vp = { x: 0, y: 0, w: 1, h: 1 };
export const backend = () => (R ? 'WebGL2' : 'Canvas2D');

function initGL(): GLR | null {
  const gl = view.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const prog = (fs: string) => {
    const p = gl.createProgram()!;
    for (const [t, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]] as const) {
      const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    return p;
  };
  try {
    const pF = prog(FS_FINAL), pBl = prog(FS_BLUR), pB = prog(FS_BRIGHT);
    const u: GLR['u'] = {};
    for (const n of ['uS', 'uB', 'uT', 'uCrt', 'uWin', 'uShake', 'uBloom', 'uAsp', 'uH']) u[n] = gl.getUniformLocation(pF, n);
    return {
      gl, pB, pBl, pF, vao: gl.createVertexArray()!, bw: 0, bh: 0, w: 0, h: 0, u,
      uBlD: gl.getUniformLocation(pBl, 'uD'), uBlS: gl.getUniformLocation(pBl, 'uS'), uBS: gl.getUniformLocation(pB, 'uS'), uTh: gl.getUniformLocation(pB, 'uTh'),
    };
  } catch (e) { console.warn('WebGL2 init failed, using Canvas2D', e); return null; }
}

function sizeTargets(r: GLR) {
  const { gl } = r, W = G.W, H = G.H;
  if (r.w === W && r.h === H) return;
  for (const t of [r.scene, r.t0, r.t1, r.t2]) if (t) gl.deleteTexture(t);
  for (const f of [r.f0, r.f1, r.f2]) if (f) gl.deleteFramebuffer(f);
  const tex = (w: number, h: number, filter: number) => {
    const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const fbo = (t: WebGLTexture) => { const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; };
  r.bw = Math.ceil(W / 2); r.bh = Math.ceil(H / 2);
  r.scene = tex(W, H, gl.NEAREST); r.t0 = tex(W, H, gl.LINEAR); r.t1 = tex(r.bw, r.bh, gl.LINEAR); r.t2 = tex(r.bw, r.bh, gl.LINEAR);
  r.f0 = fbo(r.t0); r.f1 = fbo(r.t1); r.f2 = fbo(r.t2); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  r.w = W; r.h = H;
}

export function initPost() {
  R = initGL();
  if (!R) { ctx2d = view.getContext('2d'); low = document.createElement('canvas'); lowCtx = low.getContext('2d'); }
  view.addEventListener('webglcontextlost', (e) => e.preventDefault());
  view.addEventListener('webglcontextrestored', () => { R = initGL(); });
}

/** Canvas fills the window; the frame is scaled to cover it (W,H already match the aspect). */
export function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.width = Math.floor(innerWidth * dpr); view.height = Math.floor(innerHeight * dpr);
  const s = Math.max(view.width / G.W, view.height / G.H);
  vp.w = Math.ceil(G.W * s); vp.h = Math.ceil(G.H * s);
  vp.x = Math.floor((view.width - vp.w) / 2); vp.y = Math.floor((view.height - vp.h) / 2);
  if (img.width !== G.W || img.height !== G.H) { img = new ImageData(G.W, G.H); out32 = new Uint32Array(img.data.buffer); }
  if (low) { low.width = G.W; low.height = G.H; }
}

export function present(t: number, shake: number, dayK: number) {
  const n = G.W * G.H, buf = G.buf;
  for (let i = 0; i < n; i++) out32[i] = PAL32[buf[i]];
  if (R) drawGL(R, t, shake, dayK); else draw2D(shake);
}

function drawGL(r: GLR, t: number, shake: number, dayK: number) {
  sizeTargets(r);
  const { gl } = r, W = G.W, H = G.H;
  gl.bindVertexArray(r.vao);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r.scene!);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(img.data.buffer));
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.f0!); gl.viewport(0, 0, W, H); gl.useProgram(r.pB);
  gl.uniform1i(r.uBS, 0); gl.uniform1f(r.uTh, 0.5 + 0.35 * dayK); gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.useProgram(r.pBl); gl.uniform1i(r.uBlS, 0); gl.viewport(0, 0, r.bw, r.bh);
  const pass = (src: WebGLTexture, dst: WebGLFramebuffer, dx: number, dy: number) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform2f(r.uBlD, dx, dy); gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  pass(r.t0!, r.f1!, 1 / r.bw, 0); pass(r.t1!, r.f2!, 0, 1 / r.bh); pass(r.t2!, r.f1!, 2 / r.bw, 0); pass(r.t1!, r.f2!, 0, 2 / r.bh);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, view.width, view.height);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.viewport(vp.x, view.height - vp.y - vp.h, vp.w, vp.h); gl.useProgram(r.pF);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r.scene!);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, r.t2!);
  const u = r.u;
  gl.uniform1i(u.uS, 0); gl.uniform1i(u.uB, 1); gl.uniform1f(u.uT, t);
  gl.uniform1f(u.uCrt, opts.crt ? 1 : 0); gl.uniform1f(u.uWin, opts.win ? 1 : 0);
  gl.uniform1f(u.uShake, shake); gl.uniform1f(u.uBloom, 0.95 - 0.6 * dayK);
  gl.uniform1f(u.uAsp, W / H); gl.uniform1f(u.uH, H);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function draw2D(shake: number) {
  if (!ctx2d || !lowCtx || !low) return;
  lowCtx.putImageData(img, 0, 0);
  ctx2d.imageSmoothingEnabled = false;
  ctx2d.drawImage(low, vp.x, vp.y + (shake * vp.h) / G.H, vp.w, vp.h);
}
