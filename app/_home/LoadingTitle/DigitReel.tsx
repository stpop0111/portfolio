'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

type DigitReelProps = {
  char: string; // いま表示したい数字
  prevChar: string; // 直前に表示していた数字
  delay: number; // 100の位から順にずらすための遅延
  duration: number;
  ease: string;
};

/**
 * 数字1桁分のリール。
 *
 * 上下2マス（上＝新しい値 / 下＝直前の値）を積んだ列を持ち、
 * 「下を見せている状態」から「上を見せる状態」へ1回だけスライドさせる。
 * 中間の数字は通さない（0→7 なら 7 を1枚だけ上に用意して落とす）。
 *
 * 描画のたびに列を -50%（＝下のマス）へ戻してから動かす。
 * 戻した瞬間に見えるのは prevChar ＝ 直前に画面に出ていた数字そのものなので、
 * リセットしても表示は途切れない。paint 前に確定させるため useLayoutEffect を使う。
 */
export function DigitReel({ char, prevChar, delay, duration, ease }: DigitReelProps) {
  const innerRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    // 下のマス（prevChar）を見せた状態に戻す
    gsap.set(inner, { yPercent: -50 });

    // 値が変わらない桁は動かさない
    if (char === prevChar) return;

    const tween = gsap.to(inner, { yPercent: 0, duration, ease, delay });
    return () => {
      tween.kill();
    };
  }, [char, prevChar, delay, duration, ease]);

  return (
    <span className='loadingTitle__slot'>
      <span ref={innerRef}>
        <span className='loadingTitle__digit'>
          <span className='loadingTitle__ink'>{char}</span>
        </span>
        <span className='loadingTitle__digit'>
          <span className='loadingTitle__ink'>{prevChar}</span>
        </span>
      </span>
    </span>
  );
}
