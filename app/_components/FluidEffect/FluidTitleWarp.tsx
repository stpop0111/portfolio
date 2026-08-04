'use client';

import { useCallback } from 'react';
import { FluidCanvas, type DrawSource } from './FluidCanvas';

/**
 * CanvasTitle（3Dタイトル）の描画結果を毎フレーム取り込んで、
 * 背景と同じ流体で歪ませるオーバーレイ。
 *
 * 元の CanvasTitle は visuallyHidden で透明にしたまま描画だけ継続させ、
 * その絵をここで歪ませて表示する二段構え。
 */
export function FluidTitleWarp({
  active = true,
  sourceRef,
  className = 'fixed inset-0 z-80 h-full w-full pointer-events-none',
}: {
  active?: boolean;
  /** 取り込み元（CanvasTitle のラッパー div） */
  sourceRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  // 3Dキャンバスの中身を、画面上の位置を合わせてオフスクリーンに焼き込む
  const drawSource = useCallback<DrawSource>(
    (ctx, { dpr }) => {
      const source = sourceRef.current;
      const titleCanvas = source?.querySelector('canvas');
      if (!source || !titleCanvas) return;

      const wrapRect = ctx.canvas.getBoundingClientRect
        ? { left: 0, top: 0 } // オフスクリーンなので基準は自分の左上
        : { left: 0, top: 0 };
      const titleRect = source.getBoundingClientRect();

      ctx.drawImage(
        titleCanvas,
        (titleRect.left - wrapRect.left) * dpr,
        (titleRect.top - wrapRect.top) * dpr,
        titleRect.width * dpr,
        titleRect.height * dpr,
      );
    },
    [sourceRef],
  );

  return (
    <FluidCanvas
      active={active}
      simRes={96}
      alpha
      redrawOnEveryFrame
      drawSource={drawSource}
      className={className}
    />
  );
}
