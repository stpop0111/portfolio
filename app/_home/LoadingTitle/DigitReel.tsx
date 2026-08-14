'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';

type DigitReelProps = {
  char: string; // いま表示したい数字
  prevChar: string; // 直前に表示していた数字
  delay: number; // 100の位から順にずらすための遅延
  duration: number;
  ease: gsap.EaseFunction | string;
};

/**
 * 数字1桁分のリール。
 *
 * prevChar から char までの数字を上から下へ順に積んだ列を持ち、
 * 「いちばん下（＝直前の値）を見せている状態」から
 * 「いちばん上（＝新しい値）を見せる状態」まで一気に回す。
 * 0→3 なら 3,2,1,0 の4枚を積むので、途中の 2 と 1 が流れて見える。
 * 9 をまたぐときは 0 に巻き戻して数える（8→1 なら 1,0,9,8 の4枚）。
 *
 * 描画のたびに列を「下を見せる位置」へ戻してから回す。
 * 戻した瞬間に見えるのは prevChar ＝ 直前に画面に出ていた数字そのものなので、
 * リセットしても表示は途切れない。paint 前に確定させるため useLayoutEffect を使う。
 */
export function DigitReel({ char, prevChar, delay, duration, ease }: DigitReelProps) {
  const innerRef = useRef<HTMLSpanElement>(null);

  // 上から下へ char → …途中の数字… → prevChar と並べる
  const cells = useMemo(() => {
    const from = Number(prevChar);
    const steps = (Number(char) - from + 10) % 10;
    return Array.from({ length: steps + 1 }, (_, i) => (from + steps - i) % 10);
  }, [char, prevChar]);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    // いちばん下のマス（prevChar）を見せた位置に戻す
    const start = (-(cells.length - 1) / cells.length) * 100;
    gsap.set(inner, { yPercent: start });

    // 値が変わらない桁は動かさない
    if (cells.length === 1) return;

    const tween = gsap.to(inner, { yPercent: 0, duration, ease, delay });
    return () => {
      tween.kill();
    };
  }, [cells, duration, ease, delay]);

  return (
    <span className='loadingTitle__slot'>
      <span ref={innerRef} className='loadingTitle__slotInner'>
        {cells.map((digit, i) => (
          <span key={i} className='loadingTitle__digit'>
            <span className='loadingTitle__ink'>{digit}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
