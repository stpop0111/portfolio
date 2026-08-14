'use client';

import { useCallback, useEffect, useRef } from 'react';
import { FluidCanvas, type DrawSource } from './FluidCanvas';

/**
 * CanvasTitle（3Dタイトル）の描画結果を毎フレーム取り込んで、
 * 背景と同じ流体で歪ませるオーバーレイ。
 *
 * 元の CanvasTitle は visuallyHidden で透明にしたまま描画だけ継続させ、
 * その絵をここで歪ませて表示する二段構え。
 */
/** タイトルの後ろに敷く絵の描き方。タイトルと同じ流体で歪む */
export type TitleUnderlay = (
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number; dpr: number },
  titleRect: DOMRect,
) => void;

export function FluidTitleWarp({
  active = true,
  sourceRef,
  underlay,
  className = 'fixed inset-0 z-80 h-full w-full pointer-events-none',
}: {
  active?: boolean;
  /** 取り込み元（CanvasTitle のラッパー div） */
  sourceRef: React.RefObject<HTMLDivElement | null>;
  /** タイトルより先に描いて、同じ歪みを掛けたいもの */
  underlay?: TitleUnderlay;
  className?: string;
}) {
  // useCallback を作り直さずに最新の underlay を参照するための箱
  const underlayRef = useRef(underlay);
  useEffect(() => {
    underlayRef.current = underlay;
  }, [underlay]);

  // 3Dキャンバスの中身を、画面上の位置を合わせてオフスクリーンに焼き込む
  const drawSource = useCallback<DrawSource>(
    (ctx, size) => {
      const source = sourceRef.current;
      const titleCanvas = source?.querySelector('canvas');
      if (!source || !titleCanvas) return;

      // オフスクリーンキャンバスの原点は画面左上と一致するので、
      // タイトルの画面座標をそのまま dpr 倍すればよい
      const titleRect = source.getBoundingClientRect();
      const { dpr } = size;

      // 裏に敷くものが先。あとからタイトルを重ねる
      underlayRef.current?.(ctx, size, titleRect);

      ctx.drawImage(
        titleCanvas,
        titleRect.left * dpr,
        titleRect.top * dpr,
        titleRect.width * dpr,
        titleRect.height * dpr,
      );
    },
    [sourceRef],
  );

  return (
    <FluidCanvas active={active} simRes={96} alpha redrawOnEveryFrame drawSource={drawSource} className={className} />
  );
}
