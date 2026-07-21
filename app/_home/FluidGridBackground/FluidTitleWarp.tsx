'use client';

import { useEffect, useRef } from 'react';
import { FluidSim, toSimCoords, createProgram, bindTex, blitToScreen, setupFullscreenTriangle, DISPLAY } from './fluidSim';

const SIM_RES = 96;

const PARAMS = {
  strength: 0.6,
  radius: 1.2,
  dissipation: 4,
  curlStrength: 0,
  chromatic: 0.2,
};

/** CanvasTitle(3Dタイトル)の描画結果を毎フレーム取り込んで、背景と同じ流体で歪ませるオーバーレイ。 */
export function FluidTitleWarp({
  active = true,
  sourceRef,
  className = 'fixed inset-0 z-80 h-full w-full pointer-events-none',
}: {
  active?: boolean;
  sourceRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true });
    const extCBF = gl && gl.getExtension('EXT_color_buffer_float');
    if (!gl || !extCBF) return;

    setupFullscreenTriangle(gl);
    const displayProg = createProgram(gl, DISPLAY);
    const sim = new FluidSim(gl);

    const pageCanvas = document.createElement('canvas');
    const pctx = pageCanvas.getContext('2d')!;
    const pageTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, pageTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // タイトルの実キャンバスを毎フレーム自分のcanvasへ位置合わせして焼き込む
    function composite(dpr: number) {
      pctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      const titleCanvas = sourceRef.current?.querySelector('canvas') ?? null;
      if (titleCanvas && sourceRef.current) {
        const wrapRect = canvas!.getBoundingClientRect();
        const titleRect = sourceRef.current.getBoundingClientRect();
        pctx.drawImage(
          titleCanvas,
          (titleRect.left - wrapRect.left) * dpr,
          (titleRect.top - wrapRect.top) * dpr,
          titleRect.width * dpr,
          titleRect.height * dpr,
        );
      }
      gl!.bindTexture(gl!.TEXTURE_2D, pageTex);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, true);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, pageCanvas);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, false);
    }

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

    let raf = 0;
    let prevTime = performance.now();
    let running = false;
    let dpr = 1;

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min((now - prevTime) / 1000, 0.033);
      prevTime = now;

      composite(dpr);
      sim.step(dt, pointer, delta, PARAMS);
      delta.x = 0; delta.y = 0;

      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.useProgram(displayProg.p);
      gl!.uniform1i(displayProg.u.tDiffuse, bindTex(gl!, 0, pageTex));
      gl!.uniform1i(displayProg.u.uVelocity, bindTex(gl!, 1, sim.velocityTex));
      gl!.uniform2f(displayProg.u.uSimSize, sim.simW, sim.simH);
      gl!.uniform1f(displayProg.u.uDisplacementStrength, PARAMS.strength);
      gl!.uniform1f(displayProg.u.uChromaticBoost, PARAMS.chromatic);
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
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = Math.max(1, Math.round(rect.width * dpr));
      canvas!.height = Math.max(1, Math.round(rect.height * dpr));
      pageCanvas.width = canvas!.width;
      pageCanvas.height = canvas!.height;
      sim.resize(canvas!.width, canvas!.height, SIM_RES);
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
  }, [active, sourceRef]);

  return <canvas ref={canvasRef} className={className} />;
}
