'use client';

import { useEffect, useRef } from 'react';
import { useControls, Leva } from 'leva';

type FBO = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };
type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

const VERT = `#version 300 es
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

const DISPLAY = `#version 300 es
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
    color.rgb += s.rgb * weight;
    weightSum += weight;
  }
  color.rgb /= max(weightSum, vec3(0.0001));

  vec3 highlight = spectrum(sin(mag * 2.0) * 0.4 + 0.6);
  color.rgb += highlight * smoothstep(0.2, 0.8, mag) * 0.25 * uChromaticBoost;

  fragColor = vec4(color.rgb, 1.0);
}`;

const SIM_RES = 160;
const PRESSURE_ITERATIONS = 4;
const SPLAT_FORCE = 3000;

export function FluidGridBackground({ active = true }: { active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const redrawGridRef = useRef<(() => void) | null>(null);

  const controls = useControls('Fluid Grid', {
    strength: { value: 0.45, min: 0, max: 1.5, step: 0.01 },
    radius: { value: 1.5, min: 0.3, max: 5, step: 0.1 },
    dissipation: { value: 4, min: 0.2, max: 10, step: 0.1 },
    curlStrength: { value: 0, min: 0, max: 40, step: 1 },
    chromatic: { value: 0.15, min: 0, max: 2, step: 0.05 },
    gridSpacing: { value: 56, min: 24, max: 160, step: 4 },
    gridOpacity: { value: 0.4, min: 0, max: 1, step: 0.02 },
  });
  const paramsRef = useRef(controls);
  paramsRef.current = controls;

  // グリッドの見た目だけを再描画(シミュレーション本体は再構築しない)
  useEffect(() => {
    redrawGridRef.current?.();
  }, [controls.gridSpacing, controls.gridOpacity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    const extCBF = gl && gl.getExtension('EXT_color_buffer_float');
    if (!gl || !extCBF) return; // 非対応環境では何も描かず、既存の背景色のまま

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
        const info = gl!.getShaderInfoLog(s);
        gl!.deleteShader(s);
        throw new Error(info ?? 'shader compile error');
      }
      return s;
    }
    function program(fragSrc: string): Prog {
      const p = gl!.createProgram()!;
      gl!.attachShader(p, compile(gl!.VERTEX_SHADER, VERT));
      gl!.attachShader(p, compile(gl!.FRAGMENT_SHADER, fragSrc));
      gl!.linkProgram(p);
      if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) {
        throw new Error(gl!.getProgramInfoLog(p) ?? 'program link error');
      }
      const uniforms: Record<string, WebGLUniformLocation | null> = {};
      const n = gl!.getProgramParameter(p, gl!.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl!.getActiveUniform(p, i)!;
        uniforms[info.name] = gl!.getUniformLocation(p, info.name);
      }
      return { p, u: uniforms };
    }
    function createFBO(w: number, h: number): FBO {
      const tex = gl!.createTexture()!;
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA16F, w, h, 0, gl!.RGBA, gl!.HALF_FLOAT, null);
      const fb = gl!.createFramebuffer()!;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fb);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
      return { fb, tex, w, h };
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const progs = {
      curl: program(CURL),
      vorticity: program(VORTICITY),
      divergence: program(DIVERGENCE),
      clear: program(CLEAR),
      pressure: program(PRESSURE),
      gradient: program(GRADIENT),
      advect: program(ADVECT),
      display: program(DISPLAY),
    };

    function blit(target: FBO | null) {
      if (target) {
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, target.fb);
        gl!.viewport(0, 0, target.w, target.h);
      } else {
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
        gl!.viewport(0, 0, canvas!.width, canvas!.height);
      }
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }
    function bindTex(unit: number, tex: WebGLTexture) {
      gl!.activeTexture(gl!.TEXTURE0 + unit);
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
      return unit;
    }

    // ---- 背景の絵(幾何学グリッド)を2Dキャンバスに描いてテクスチャ化 ----
    const pageCanvas = document.createElement('canvas');
    const pctx = pageCanvas.getContext('2d')!;
    const pageTex = gl.createTexture()!;

    function drawGrid(w: number, h: number, dpr: number) {
      pageCanvas.width = w;
      pageCanvas.height = h;
      pctx.fillStyle = '#faf3e1';
      pctx.fillRect(0, 0, w, h);

      const { gridSpacing, gridOpacity } = paramsRef.current;
      const spacing = gridSpacing * dpr;

      pctx.strokeStyle = `rgba(34,34,34,${gridOpacity * 0.5})`;
      pctx.lineWidth = Math.max(1, dpr);
      pctx.beginPath();
      for (let x = 0; x <= w; x += spacing) { pctx.moveTo(x, 0); pctx.lineTo(x, h); }
      for (let y = 0; y <= h; y += spacing) { pctx.moveTo(0, y); pctx.lineTo(w, y); }
      pctx.stroke();

      pctx.strokeStyle = `rgba(34,34,34,${Math.min(1, gridOpacity)})`;
      pctx.lineWidth = Math.max(1, dpr * 1.5);
      pctx.beginPath();
      const major = spacing * 4;
      for (let x = 0; x <= w; x += major) { pctx.moveTo(x, 0); pctx.lineTo(x, h); }
      for (let y = 0; y <= h; y += major) { pctx.moveTo(0, y); pctx.lineTo(w, y); }
      pctx.stroke();

      gl!.bindTexture(gl!.TEXTURE_2D, pageTex);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, true);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, pageCanvas);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, false);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    }
    redrawGridRef.current = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      drawGrid(canvas!.width, canvas!.height, dpr);
    };

    // ---- シミュレーション用ターゲット ----
    let simW = 0, simH = 0;
    let texel: [number, number] = [0, 0];
    let velRead: FBO, velWrite: FBO, curlT: FBO, vortT: FBO, divT: FBO, pressA: FBO, pressB: FBO, projT: FBO;

    function setupSim() {
      const aspect = canvas!.width / canvas!.height;
      if (aspect >= 1) { simW = Math.round(SIM_RES * aspect); simH = SIM_RES; }
      else { simW = SIM_RES; simH = Math.round(SIM_RES / aspect); }
      texel = [1 / simW, 1 / simH];
      [velRead, velWrite, curlT, vortT, divT, pressA, pressB, projT] =
        Array.from({ length: 8 }, () => createFBO(simW, simH));
    }

    // ---- ポインター ----
    const pointer = { x: 0, y: 0 };
    const delta = { x: 0, y: 0 };
    let hasLast = false, lastX = 0, lastY = 0;

    function toSim(clientX: number, clientY: number): [number, number] {
      const r = canvas!.getBoundingClientRect();
      return [
        (clientX - r.left) / r.width * simW,
        (1 - (clientY - r.top) / r.height) * simH,
      ];
    }
    function onMove(e: PointerEvent) {
      const [x, y] = toSim(e.clientX, e.clientY);
      if (hasLast) { delta.x += x - lastX; delta.y += y - lastY; }
      lastX = x; lastY = y; hasLast = true;
      pointer.x = x; pointer.y = y;
    }
    function onLeave() { hasLast = false; }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let introT = reducedMotion ? 999 : 0;
    function intro(dt: number) {
      if (introT > 1.4) return;
      introT += dt;
      const t = introT / 1.4;
      const x = (0.15 + t * 0.6) * simW;
      const y = (0.5 + Math.sin(t * Math.PI * 2) * 0.12) * simH;
      if (hasLast) { delta.x += (x - lastX) * 0.6; delta.y += (y - lastY) * 0.6; }
      lastX = x; lastY = y; hasLast = true;
      pointer.x = x; pointer.y = y;
    }

    // ---- 毎フレーム: curl → vorticity(+ポインタ入力) → divergence → pressure×4 → gradient → advect → 表示 ----
    let raf = 0;
    let prevTime = performance.now();
    let running = false;

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min((now - prevTime) / 1000, 0.033);
      prevTime = now;
      intro(dt);
      const p = paramsRef.current;

      let g = progs.curl;
      gl!.useProgram(g.p);
      gl!.uniform1i(g.u.uVelocity, bindTex(0, velRead.tex));
      gl!.uniform2fv(g.u.uTexelSize, texel);
      blit(curlT);

      g = progs.vorticity;
      gl!.useProgram(g.p);
      gl!.uniform1i(g.u.uVelocity, bindTex(0, velRead.tex));
      gl!.uniform1i(g.u.uCurl, bindTex(1, curlT.tex));
      gl!.uniform2fv(g.u.uTexelSize, texel);
      gl!.uniform2f(g.u.uResolution, simW, simH);
      gl!.uniform2f(g.u.uPointer, pointer.x, pointer.y);
      gl!.uniform2f(g.u.uPointerDelta, delta.x, delta.y);
      gl!.uniform1f(g.u.uCurlStrength, p.curlStrength);
      gl!.uniform1f(g.u.uSplatRadius, Math.max(0.002 * p.radius, 0.0005));
      gl!.uniform1f(g.u.uSplatForce, SPLAT_FORCE);
      blit(vortT);
      delta.x = 0; delta.y = 0;

      g = progs.divergence;
      gl!.useProgram(g.p);
      gl!.uniform1i(g.u.uVelocity, bindTex(0, vortT.tex));
      gl!.uniform2fv(g.u.uTexelSize, texel);
      blit(divT);

      gl!.useProgram(progs.clear.p);
      blit(pressA);
      let pIn = pressA, pOut = pressB;
      g = progs.pressure;
      gl!.useProgram(g.p);
      for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
        gl!.uniform1i(g.u.uPressure, bindTex(0, pIn.tex));
        gl!.uniform1i(g.u.uDivergence, bindTex(1, divT.tex));
        gl!.uniform2fv(g.u.uTexelSize, texel);
        blit(pOut);
        [pIn, pOut] = [pOut, pIn];
      }

      g = progs.gradient;
      gl!.useProgram(g.p);
      gl!.uniform1i(g.u.uVelocity, bindTex(0, vortT.tex));
      gl!.uniform1i(g.u.uPressure, bindTex(1, pIn.tex));
      gl!.uniform2fv(g.u.uTexelSize, texel);
      blit(projT);

      g = progs.advect;
      gl!.useProgram(g.p);
      gl!.uniform1i(g.u.uProjectedVelocity, bindTex(0, projT.tex));
      gl!.uniform2fv(g.u.uTexelSize, texel);
      gl!.uniform1f(g.u.uDissipation, p.dissipation);
      blit(velWrite);
      [velRead, velWrite] = [velWrite, velRead];

      g = progs.display;
      gl!.useProgram(g.p);
      gl!.uniform1i(g.u.tDiffuse, bindTex(0, pageTex));
      gl!.uniform1i(g.u.uVelocity, bindTex(1, velRead.tex));
      gl!.uniform2f(g.u.uSimSize, simW, simH);
      gl!.uniform1f(g.u.uDisplacementStrength, p.strength);
      gl!.uniform1f(g.u.uChromaticBoost, p.chromatic);
      blit(null);

      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (running) return;
      running = true;
      prevTime = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }
    function onVisibility() {
      if (document.hidden) stop(); else start();
    }
    document.addEventListener('visibilitychange', onVisibility);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(window.innerWidth * dpr);
      canvas!.height = Math.round(window.innerHeight * dpr);
      drawGrid(canvas!.width, canvas!.height, dpr);
      setupSim();
      hasLast = false;
    }
    window.addEventListener('resize', resize);
    resize();
    if (!document.hidden) start();

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      window.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      redrawGridRef.current = null;
    };
  }, [active]);

  return (
    <div className='fixed inset-0 z-0 pointer-events-none'>
      <canvas ref={canvasRef} className='block h-full w-full' />
      <Leva collapsed titleBar={{ title: 'Fluid Grid (確認用)' }} />
    </div>
  );
}
