'use client';

import { useEffect, useRef } from 'react';
import { FluidSim, toSimCoords, createProgram, bindTex, blitToScreen, setupFullscreenTriangle, DISPLAY, FLUID_PARAMS } from './fluidSim';

const SIM_RES = 160;

// グリッド固有の見た目パラメータ(歪みの強さ自体はFLUID_PARAMSで背景・タイトル共通)
const GRID_PARAMS = {
  gridSpacing: 56,
  gridOpacity: 0.4,
};

export function FluidGridBackground({ active = true }: { active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    const extCBF = gl && gl.getExtension('EXT_color_buffer_float');
    if (!gl || !extCBF) return; // 非対応環境では何も描かず、既存の背景色のまま

    setupFullscreenTriangle(gl);
    const displayProg = createProgram(gl, DISPLAY);
    const sim = new FluidSim(gl);

    // ---- 背景の絵(幾何学グリッド)を2Dキャンバスに描いてテクスチャ化 ----
    const pageCanvas = document.createElement('canvas');
    const pctx = pageCanvas.getContext('2d')!;
    const pageTex = gl.createTexture()!;

    function drawGrid(w: number, h: number, dpr: number) {
      pageCanvas.width = w;
      pageCanvas.height = h;
      pctx.fillStyle = '#faf3e1';
      pctx.fillRect(0, 0, w, h);

      const spacing = GRID_PARAMS.gridSpacing * dpr;

      pctx.strokeStyle = `rgba(34,34,34,${GRID_PARAMS.gridOpacity * 0.5})`;
      pctx.lineWidth = Math.max(1, dpr);
      pctx.beginPath();
      for (let x = 0; x <= w; x += spacing) { pctx.moveTo(x, 0); pctx.lineTo(x, h); }
      for (let y = 0; y <= h; y += spacing) { pctx.moveTo(0, y); pctx.lineTo(w, y); }
      pctx.stroke();

      pctx.strokeStyle = `rgba(34,34,34,${Math.min(1, GRID_PARAMS.gridOpacity)})`;
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

    // ---- ポインター ----
    const pointer = { x: 0, y: 0 };
    const delta = { x: 0, y: 0 };
    let hasLast = false, lastX = 0, lastY = 0;

    function onMove(e: PointerEvent) {
      const [x, y] = toSimCoords(canvas!, sim.simW, sim.simH, e.clientX, e.clientY);
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
      const x = (0.15 + t * 0.6) * sim.simW;
      const y = (0.5 + Math.sin(t * Math.PI * 2) * 0.12) * sim.simH;
      if (hasLast) { delta.x += (x - lastX) * 0.6; delta.y += (y - lastY) * 0.6; }
      lastX = x; lastY = y; hasLast = true;
      pointer.x = x; pointer.y = y;
    }

    let raf = 0;
    let prevTime = performance.now();
    let running = false;

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min((now - prevTime) / 1000, 0.033);
      prevTime = now;
      intro(dt);

      sim.step(dt, pointer, delta, FLUID_PARAMS);
      delta.x = 0; delta.y = 0;

      gl!.useProgram(displayProg.p);
      gl!.uniform1i(displayProg.u.tDiffuse, bindTex(gl!, 0, pageTex));
      gl!.uniform1i(displayProg.u.uVelocity, bindTex(gl!, 1, sim.velocityTex));
      gl!.uniform2f(displayProg.u.uSimSize, sim.simW, sim.simH);
      gl!.uniform1f(displayProg.u.uDisplacementStrength, FLUID_PARAMS.strength);
      gl!.uniform1f(displayProg.u.uChromaticBoost, FLUID_PARAMS.chromatic);
      blitToScreen(gl!, canvas!.width, canvas!.height);

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
      sim.resize(canvas!.width, canvas!.height, SIM_RES);
      drawGrid(canvas!.width, canvas!.height, dpr);
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
    };
  }, [active]);

  return (
    <div className='fixed inset-0 z-0 pointer-events-none'>
      <canvas ref={canvasRef} className='block h-full w-full' />
    </div>
  );
}
