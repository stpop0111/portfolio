export type FBO = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };
export type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
export type FluidParams = { curlStrength: number; radius: number; dissipation: number };

// 見た目パラメータは fluidParams.ts に分離（調整はそちらのファイルで行う）
export { FLUID_PARAMS } from './fluidParams';

export const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const CURL = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
in vec2 vUv;
out vec4 fragColor;
void main(){
  float left   = texture(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).y;
  float right  = texture(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).y;
  float top    = texture(uVelocity, vUv + vec2(0.0, uTexelSize.y)).x;
  float bottom = texture(uVelocity, vUv - vec2(0.0, uTexelSize.y)).x;
  fragColor = vec4(0.5 * (right - left - top + bottom), 0.0, 0.0, 1.0);
}`;

const VORTICITY = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexelSize;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform vec2 uPointerDelta;
uniform float uCurlStrength;
uniform float uSplatRadius;
uniform float uSplatForce;
in vec2 vUv;
out vec4 fragColor;
void main(){
  float left   = abs(texture(uCurl, vUv - vec2(uTexelSize.x, 0.0)).x);
  float right  = abs(texture(uCurl, vUv + vec2(uTexelSize.x, 0.0)).x);
  float top    = abs(texture(uCurl, vUv + vec2(0.0, uTexelSize.y)).x);
  float bottom = abs(texture(uCurl, vUv - vec2(0.0, uTexelSize.y)).x);
  float center = texture(uCurl, vUv).x;

  vec2 force = vec2(top - bottom, right - left);
  float len = length(force);
  force = len > 0.0001 ? force / len : vec2(0.0);
  force *= uCurlStrength * center;
  force.y *= -1.0;

  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity += force * 0.016;
  velocity = clamp(velocity, vec2(-1000.0), vec2(1000.0));

  vec2 mouseUv = uPointer / max(uResolution, vec2(0.0001));
  vec2 diff = vUv - mouseUv;
  diff.x *= uResolution.x / max(uResolution.y, 0.0001);
  float mask = exp(-dot(diff, diff) / max(uSplatRadius, 0.0001));
  velocity += (uPointerDelta / max(uResolution, vec2(0.0001))) * mask * uSplatForce;

  fragColor = vec4(velocity, 0.0, 1.0);
}`;

const DIVERGENCE = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
in vec2 vUv;
out vec4 fragColor;
void main(){
  float left   = texture(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
  float right  = texture(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
  float top    = texture(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
  float bottom = texture(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
  fragColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
}`;

const CLEAR = `#version 300 es
precision highp float;
out vec4 fragColor;
void main(){ fragColor = vec4(0.0); }`;

const PRESSURE = `#version 300 es
precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;
in vec2 vUv;
out vec4 fragColor;
void main(){
  float left   = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float right  = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float top    = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float bottom = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float div = texture(uDivergence, vUv).x;
  fragColor = vec4((left + right + top + bottom - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform sampler2D uPressure;
uniform vec2 uTexelSize;
in vec2 vUv;
out vec4 fragColor;
void main(){
  float left   = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float right  = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float top    = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float bottom = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity -= vec2(right - left, top - bottom);
  fragColor = vec4(velocity, 0.0, 1.0);
}`;

const ADVECT = `#version 300 es
precision highp float;
uniform sampler2D uProjectedVelocity;
uniform vec2 uTexelSize;
uniform float uDissipation;
in vec2 vUv;
out vec4 fragColor;
void main(){
  vec2 velocity = texture(uProjectedVelocity, vUv).xy;
  vec2 coord = clamp(vUv - velocity * uTexelSize * 0.016, 0.0, 1.0);
  vec2 advected = texture(uProjectedVelocity, coord).xy;
  advected /= 1.0 + uDissipation * 0.016;
  fragColor = vec4(advected, 0.0, 1.0);
}`;

// tDiffuse を速度マップで歪ませて表示する共通シェーダー(色ズレ付き)
export const DISPLAY = `#version 300 es
precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D uVelocity;
uniform vec2 uSimSize;
uniform float uDisplacementStrength;
uniform float uChromaticBoost;
in vec2 vUv;
out vec4 fragColor;

vec3 spectrum(float x){
  return cos((x - vec3(0.0, 0.5, 1.0)) * vec3(0.6, 1.0, 0.5) * 3.14);
}

void main(){
  vec2 velocity = texture(uVelocity, vUv).xy;
  vec2 displacement = velocity / max(uSimSize, vec2(1.0)) * uDisplacementStrength;
  float mag = length(displacement);

  const int SAMPLES = 4;
  vec4 color = vec4(0.0);
  vec3 weightSum = vec3(0.0);

  for (int i = 0; i < SAMPLES; i++) {
    float t = float(i) / float(SAMPLES - 1);
    vec3 weight = max(vec3(0.0), cos((t - vec3(0.0, 0.5, 1.0)) * 3.14159 * 0.5));
    vec4 s = texture(tDiffuse, clamp(vUv - displacement * 0.3 * (t + 0.3) * mag, 0.0, 1.0));
    color += s * vec4(weight, (weight.x + weight.y + weight.z) / 3.0);
    weightSum += weight;
  }
  color.rgb /= max(weightSum, vec3(0.0001));
  color.a /= max((weightSum.x + weightSum.y + weightSum.z) / 3.0, 0.0001);

  // 平均を引いて色相だけをずらす(そのまま足すと強めた時に白く飛んでしまう)
  vec3 highlight = spectrum(sin(mag * 2.0) * 0.4 + 0.6);
  vec3 tint = highlight - vec3(dot(highlight, vec3(0.3333)));
  color.rgb += tint * smoothstep(0.2, 0.8, mag) * 0.35 * uChromaticBoost;

  // 透過キャンバス合成のためにpremultiplied alphaで出力
  fragColor = vec4(color.rgb * color.a, color.a);
}`;

export function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(info ?? 'shader compile error');
  }
  return s;
}

export function createProgram(gl: WebGL2RenderingContext, fragSrc: string): Prog {
  const p = gl.createProgram()!;
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) ?? 'program link error');
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i)!;
    uniforms[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u: uniforms };
}

export function createFBO(gl: WebGL2RenderingContext, w: number, h: number): FBO {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { fb, tex, w, h };
}

export function setupFullscreenTriangle(gl: WebGL2RenderingContext) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}

export function bindTex(gl: WebGL2RenderingContext, unit: number, tex: WebGLTexture) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  return unit;
}

export function blitToFBO(gl: WebGL2RenderingContext, target: FBO) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
  gl.viewport(0, 0, target.w, target.h);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function blitToScreen(gl: WebGL2RenderingContext, w: number, h: number) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

const SPLAT_FORCE = 3000;
const PRESSURE_ITERATIONS = 4;

export class FluidSim {
  private gl: WebGL2RenderingContext;
  private progs: {
    curl: Prog; vorticity: Prog; divergence: Prog; clear: Prog; pressure: Prog; gradient: Prog; advect: Prog;
  };
  simW = 0;
  simH = 0;
  texel: [number, number] = [0, 0];
  private velRead!: FBO;
  private velWrite!: FBO;
  private curlT!: FBO;
  private vortT!: FBO;
  private divT!: FBO;
  private pressA!: FBO;
  private pressB!: FBO;
  private projT!: FBO;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.progs = {
      curl: createProgram(gl, CURL),
      vorticity: createProgram(gl, VORTICITY),
      divergence: createProgram(gl, DIVERGENCE),
      clear: createProgram(gl, CLEAR),
      pressure: createProgram(gl, PRESSURE),
      gradient: createProgram(gl, GRADIENT),
      advect: createProgram(gl, ADVECT),
    };
  }

  resize(canvasW: number, canvasH: number, simRes: number) {
    const aspect = canvasW / Math.max(canvasH, 1);
    if (aspect >= 1) { this.simW = Math.round(simRes * aspect); this.simH = simRes; }
    else { this.simW = simRes; this.simH = Math.round(simRes / aspect); }
    this.texel = [1 / this.simW, 1 / this.simH];
    const gl = this.gl;
    [this.velRead, this.velWrite, this.curlT, this.vortT, this.divT, this.pressA, this.pressB, this.projT] =
      Array.from({ length: 8 }, () => createFBO(gl, this.simW, this.simH));
  }

  get velocityTex(): WebGLTexture {
    return this.velRead.tex;
  }

  step(dt: number, pointer: { x: number; y: number }, delta: { x: number; y: number }, params: FluidParams) {
    const gl = this.gl;
    const texel = this.texel;

    let g = this.progs.curl;
    gl.useProgram(g.p);
    gl.uniform1i(g.u.uVelocity, bindTex(gl, 0, this.velRead.tex));
    gl.uniform2fv(g.u.uTexelSize, texel);
    blitToFBO(gl, this.curlT);

    g = this.progs.vorticity;
    gl.useProgram(g.p);
    gl.uniform1i(g.u.uVelocity, bindTex(gl, 0, this.velRead.tex));
    gl.uniform1i(g.u.uCurl, bindTex(gl, 1, this.curlT.tex));
    gl.uniform2fv(g.u.uTexelSize, texel);
    gl.uniform2f(g.u.uResolution, this.simW, this.simH);
    gl.uniform2f(g.u.uPointer, pointer.x, pointer.y);
    gl.uniform2f(g.u.uPointerDelta, delta.x, delta.y);
    gl.uniform1f(g.u.uCurlStrength, params.curlStrength);
    gl.uniform1f(g.u.uSplatRadius, Math.max(0.002 * params.radius, 0.0005));
    gl.uniform1f(g.u.uSplatForce, SPLAT_FORCE);
    blitToFBO(gl, this.vortT);

    g = this.progs.divergence;
    gl.useProgram(g.p);
    gl.uniform1i(g.u.uVelocity, bindTex(gl, 0, this.vortT.tex));
    gl.uniform2fv(g.u.uTexelSize, texel);
    blitToFBO(gl, this.divT);

    gl.useProgram(this.progs.clear.p);
    blitToFBO(gl, this.pressA);
    let pIn = this.pressA, pOut = this.pressB;
    g = this.progs.pressure;
    gl.useProgram(g.p);
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(g.u.uPressure, bindTex(gl, 0, pIn.tex));
      gl.uniform1i(g.u.uDivergence, bindTex(gl, 1, this.divT.tex));
      gl.uniform2fv(g.u.uTexelSize, texel);
      blitToFBO(gl, pOut);
      [pIn, pOut] = [pOut, pIn];
    }

    g = this.progs.gradient;
    gl.useProgram(g.p);
    gl.uniform1i(g.u.uVelocity, bindTex(gl, 0, this.vortT.tex));
    gl.uniform1i(g.u.uPressure, bindTex(gl, 1, pIn.tex));
    gl.uniform2fv(g.u.uTexelSize, texel);
    blitToFBO(gl, this.projT);

    g = this.progs.advect;
    gl.useProgram(g.p);
    gl.uniform1i(g.u.uProjectedVelocity, bindTex(gl, 0, this.projT.tex));
    gl.uniform2fv(g.u.uTexelSize, texel);
    gl.uniform1f(g.u.uDissipation, params.dissipation);
    blitToFBO(gl, this.velWrite);
    [this.velRead, this.velWrite] = [this.velWrite, this.velRead];
  }
}

export function toSimCoords(canvas: HTMLCanvasElement, simW: number, simH: number, clientX: number, clientY: number): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [
    (clientX - r.left) / r.width * simW,
    (1 - (clientY - r.top) / r.height) * simH,
  ];
}