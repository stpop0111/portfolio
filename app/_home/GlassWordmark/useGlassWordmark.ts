'use client';

import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { WORDMARK_IMAGE_SRC, WORDMARK_VIEWBOX } from './wordmarkPaths';

type Phase = 'loading' | 'changing' | 'title' | 'hero';

const ENTER = { duration: 1.6, ease: 'power2.out', delay: 0.2 }; // タイトルより少しだけ遅れて出す

// 画面幅に対する大きさ。CSS の clamp(18rem, 43vw, 58rem) と同じ意味
const WIDTH = { min: 288, ratio: 0.43, max: 928 };

/**
 * タイトルの裏に敷く「seita」のガラスを、流体の元絵へ描き込むための draw 関数を返す。
 *
 * DOM に置くとタイトルの波（FluidTitleWarp）を受けられないので、
 * タイトルと同じ 2D キャンバスに描いて同一の歪みを通す。
 * 位置はタイトルの矩形から出しているため、ヒーローでタイトルが上へ動くと
 * ガラスも自動で付いていく。
 */
export function useGlassWordmark(phase: Phase, skipIntro = false) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  // 登場アニメーションの進み具合。GSAP でこの箱の中身を動かす
  const enter = useRef({ opacity: skipIntro ? 1 : 0, scale: skipIntro ? 1 : 0.96 });

  useEffect(() => {
    const img = new Image();
    img.src = WORDMARK_IMAGE_SRC;
    img.decode?.().catch(() => {});
    imageRef.current = img;
  }, []);

  useEffect(() => {
    if (phase !== 'title') return;
    const tween = gsap.to(enter.current, {
      opacity: 1,
      scale: 1,
      duration: ENTER.duration,
      ease: ENTER.ease,
      delay: ENTER.delay,
    });
    return () => {
      tween.kill();
    };
  }, [phase]);

  return useMemo(
    () =>
      (ctx: CanvasRenderingContext2D, { dpr }: { dpr: number }, titleRect: DOMRect) => {
        const img = imageRef.current;
        const { opacity, scale } = enter.current;
        if (!img?.complete || opacity <= 0) return;

        const base = Math.min(Math.max(WIDTH.min, window.innerWidth * WIDTH.ratio), WIDTH.max);
        const w = base * scale;
        const h = (w * WORDMARK_VIEWBOX.height) / WORDMARK_VIEWBOX.width;
        // 画面中央、かつタイトルの箱の上下中央に置く
        const x = (window.innerWidth - w) / 2;
        const y = titleRect.top + titleRect.height / 2 - h / 2;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, x * dpr, y * dpr, w * dpr, h * dpr);
        ctx.restore();
      },
    [],
  );
}
