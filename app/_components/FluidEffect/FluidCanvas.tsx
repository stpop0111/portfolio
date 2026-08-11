'use client';

import { useEffect, useRef } from 'react';
import {
  FluidSim, toSimCoords, createProgram, bindTex, blitToScreen,
  setupFullscreenTriangle, DISPLAY,
} from './fluidSim';
import { FLUID_PARAMS } from './fluidParams';

/**
 * 「元絵」を毎フレーム受け取り、流体（速度場）で歪ませて描画する汎用キャンバス。
 *
 * 元絵の作り方だけを drawSource で外から注入する設計。
 *   - 背景グリッド … 2D キャンバスに格子を描く
 *   - タイトル歪み … 3D キャンバスの描画結果を drawImage で焼き込む
 * どちらも「オフスクリーンの 2D キャンバスに絵を用意する」点は同じなので、
 * それ以降（テクスチャ化 → sim.step → DISPLAY）はここで共通化している。
 */
export type DrawSource = (
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number; dpr: number },
) => void;

export type FluidCanvasHandle = {
  /** 元絵を描き直したい時に呼ぶ（見た目の設定を変えた時など） */
  redraw: () => void;
};

export function FluidCanvas({
  active = true,
  simRes = 160,
  drawSource,
  redrawOnEveryFrame = false,
  alpha = false,
  className = '',
  onPointerMove,
  onFrame,
  handleRef,
}: {
  /** false の間は WebGL を一切動かさない（省エネ） */
  active?: boolean;
  /** シミュレーション解像度。低いほど軽く、大味な波紋になる */
  simRes?: number;
  /** 元絵の描画関数 */
  drawSource: DrawSource;
  /** true なら毎フレーム drawSource を呼ぶ（元絵が動画の場合） */
  redrawOnEveryFrame?: boolean;
  /** 背景を透過させるか（重ねて使う場合は true） */
  alpha?: boolean;
  className?: string;
  /** ポインタ移動時に追加でやりたい処理（パララックスなど） */
  onPointerMove?: (e: PointerEvent) => void;
  /** 毎フレーム追加でやりたい処理（パララックスの補間など） */
  onFrame?: (dt: number) => void;
  /** 外から redraw を呼ぶためのハンドル */
  handleRef?: React.RefObject<FluidCanvasHandle | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // props をコールバック内から最新の値で参照するための箱
  const drawSourceRef = useRef(drawSource);
  const onPointerMoveRef = useRef(onPointerMove);
  const onFrameRef = useRef(onFrame);
  drawSourceRef.current = drawSource;
  onPointerMoveRef.current = onPointerMove;
  onFrameRef.current = onFrame;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha,
      premultipliedAlpha: alpha,
    });
    // 速度場は小数（マイナスもある）を保持するため RGBA16F が必須。
    // 非対応環境では何も描かず、下地の背景色のままにする。
    const extCBF = gl && gl.getExtension('EXT_color_buffer_float');
    if (!gl || !extCBF) return;

    setupFullscreenTriangle(gl);
    const displayProg = createProgram(gl, DISPLAY);
    const sim = new FluidSim(gl);

    // ---- 元絵を用意するオフスクリーンキャンバス ----
    const sourceCanvas = document.createElement('canvas');
    const sctx = sourceCanvas.getContext('2d')!;
    const sourceTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, sourceTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    let dpr = 1;

    function updateSourceTexture() {
      sctx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
      drawSourceRef.current(sctx, {
        width: sourceCanvas.width,
        height: sourceCanvas.height,
        dpr,
      });
      gl!.bindTexture(gl!.TEXTURE_2D, sourceTex);
      // WebGL のテクスチャは左下原点、キャンバスは左上原点なので反転して読む
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, true);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, sourceCanvas);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, false);
    }

    if (handleRef) handleRef.current = { redraw: updateSourceTexture };

    // ---- ポインター（波紋の発生源） ----
    const pointer = { x: 0, y: 0 };
    const delta = { x: 0, y: 0 };
    let hasLast = false, lastX = 0, lastY = 0;

    function onMove(e: PointerEvent) {
      const [x, y] = toSimCoords(canvas!, sim.simW, sim.simH, e.clientX, e.clientY);
      if (hasLast) { delta.x += x - lastX; delta.y += y - lastY; }
      lastX = x; lastY = y; hasLast = true;
      pointer.x = x; pointer.y = y;
      onPointerMoveRef.current?.(e);
    }
    function onLeave() { hasLast = false; }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);

    // ---- 導入演出（ロード直後に横一線をなぞって波紋を見せる） ----
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

    // ---- メインループ ----
    let raf = 0;
    let prevTime = performance.now();
    let running = false;

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min((now - prevTime) / 1000, 0.033);
      prevTime = now;

      intro(dt);
      if (redrawOnEveryFrame) updateSourceTexture();

      sim.step(dt, pointer, delta, FLUID_PARAMS);
      delta.x = 0; delta.y = 0;

      onFrameRef.current?.(dt);

      // sim.step() 直後は内部の FBO がバインドされたままなので、
      // ここで gl.clear() すると計算したての速度テクスチャを消してしまう。
      // 全画面三角形が全ピクセルを上書きするので clear 自体が不要。
      gl!.useProgram(displayProg.p);
      gl!.uniform1i(displayProg.u.tDiffuse, bindTex(gl!, 0, sourceTex));
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
    // タブが非表示の間は回さない
    function onVisibility() {
      if (document.hidden) stop(); else start();
    }
    document.addEventListener('visibilitychange', onVisibility);

    function resize() {
      // 流体はボヤッとした表現なので等倍で十分。Retina で 2 にすると負荷が4倍になる
      dpr = 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = Math.max(1, Math.round(rect.width * dpr));
      canvas!.height = Math.max(1, Math.round(rect.height * dpr));
      sourceCanvas.width = canvas!.width;
      sourceCanvas.height = canvas!.height;
      sim.resize(canvas!.width, canvas!.height, simRes);
      updateSourceTexture();
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
      if (handleRef) handleRef.current = null;
    };
  }, [active, simRes, alpha, redrawOnEveryFrame, handleRef]);

  return <canvas ref={canvasRef} className={className} />;
}
