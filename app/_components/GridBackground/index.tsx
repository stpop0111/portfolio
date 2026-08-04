'use client';

import { useCallback, useRef } from 'react';
import { FluidCanvas, type DrawSource } from '../FluidEffect/FluidCanvas';
import { drawGrid } from './drawGrid';

/** カーソル追従でコンテナが動く幅（±40px）。-inset-14(56px) の範囲内に収める */
const PARALLAX_RANGE = 80;

/**
 * 背景の幾何学グリッド。
 * 絵を描くのはこのコンポーネント、歪ませるのは FluidCanvas という役割分担。
 * あわせてカーソル追従のパララックス（コンテナごとの平行移動）も担当する。
 */
export function GridBackground({ active = true }: { active?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 目標位置(t)へ現在位置をなめらかに追従させる
  const parallax = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const drawSource = useCallback<DrawSource>((ctx, { width, height, dpr }) => {
    drawGrid(ctx, width, height, dpr);
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    parallax.current.tx = (e.clientX / window.innerWidth - 0.5) * PARALLAX_RANGE;
    // Y軸は反転（カーソルが下ほどグリッドは上へ動く）
    parallax.current.ty = -(e.clientY / window.innerHeight - 0.5) * PARALLAX_RANGE;
  }, []);

  const handleFrame = useCallback(() => {
    const p = parallax.current;
    p.x += (p.tx - p.x) * 0.06;
    p.y += (p.ty - p.y) * 0.06;
    if (containerRef.current) {
      containerRef.current.style.transform =
        `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0)`;
    }
  }, []);

  return (
    // パララックスで動かす分だけ画面より大きくして、端が見えないようにする
    <div ref={containerRef} className='fixed -inset-14 z-0 pointer-events-none'>
      <FluidCanvas
        active={active}
        simRes={160}
        drawSource={drawSource}
        onPointerMove={handlePointerMove}
        onFrame={handleFrame}
        className='block h-full w-full'
      />
    </div>
  );
}
