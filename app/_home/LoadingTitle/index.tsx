'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { DigitReel } from './DigitReel';

type Phase = 'loading' | 'changing' | 'title' | 'hero';

/* -------------------------------------------------
  タイミング（PDFに指定のない値は提案値。ここだけ見れば調整できる）
------------------------------------------------- */
const TICK = 0.5; // 進捗を検知する間隔（PDF指定）
const MIN_DURATION = 1.5; // カウントアップの最低表示時間。TICK×3回分は必ず見せる
const HOLD = 0.7; // 100%到達後のキープ（PDF指定）
const DIGIT = { duration: 0.4, ease: 'power2.out', stagger: 0.05 }; // 桁のスライド。100の位→1の位
const EXIT = { duration: 0.6, ease: 'power2.in', stagger: 0.04 }; // 退場。右→左

const DIGIT_LENGTH = 3;
const PRE_TEXT = 'P';
const POST_TEXT = 'rtfolio';

type LoadingTitleProps = {
  phase: Phase;
  progress: number; // 0-100。drei の useProgress の値
  onCountComplete: () => void; // 100%キープまで終わった
  onExitComplete: () => void; // 退場アニメーションまで終わった
};

/**
 * ローディング画面。「P[000]rtfolio」の o の位置でカウントアップし、
 * 100% に達したら文字が右から順に下へ落ちて消える。
 */
export function LoadingTitle({ phase, progress, onCountComplete, onExitComplete }: LoadingTitleProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);

  // interval を張り直さずに最新の進捗を読むための箱
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // 表示中の値と、その直前の値。リールが「上に用意する数字」を決めるのに両方いる
  const [count, setCount] = useState({ value: 0, prev: 0 });

  /* 0.5秒に一回ローディングを検知し、その数値を各要素で準備する
  --------------------------------------- */
  useEffect(() => {
    if (phase !== 'loading') return;
    startedAt.current = performance.now();

    const id = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt.current) / 1000;
      // 実ロードが速く終わってもカウントアップを見せたいので、経過時間で上限をかける。
      // MIN_DURATION 秒かけて 0→100 に開く天井と、実際の進捗の低い方を採用する
      const ceiling = (elapsed / MIN_DURATION) * 100;
      const next = Math.floor(Math.min(progressRef.current, ceiling, 100));
      // 進捗が巻き戻ることがあるので、表示は減らさない
      setCount((current) => (next <= current.value ? current : { value: next, prev: current.value }));
    }, TICK * 1000);

    return () => window.clearInterval(id);
  }, [phase]);

  /* 100%到達 → 最後の桁が着地してから0.7秒キープ → 退場へ
  --------------------------------------- */
  useEffect(() => {
    if (phase !== 'loading' || count.value < 100) return;
    const settle = DIGIT.duration + DIGIT.stagger * (DIGIT_LENGTH - 1);
    const id = window.setTimeout(onCountComplete, (settle + HOLD) * 1000);
    return () => window.clearTimeout(id);
  }, [phase, count.value, onCountComplete]);

  /* 退場：右の文字から順に、マスクの裏へ下降していく
  --------------------------------------- */
  useGSAP(
    () => {
      if (phase !== 'changing') return;
      gsap.to('.loadingGlyph', {
        yPercent: 110,
        duration: EXIT.duration,
        ease: EXIT.ease,
        stagger: { each: EXIT.stagger, from: 'end' },
        onComplete: onExitComplete,
      });
    },
    { scope: rootRef, dependencies: [phase] },
  );

  if (phase !== 'loading' && phase !== 'changing') return null;

  const digits = String(count.value).padStart(DIGIT_LENGTH, '0');
  const prevDigits = String(count.prev).padStart(DIGIT_LENGTH, '0');

  return (
    <div
      ref={rootRef}
      className='loadingTitle font-urbanist fixed inset-0 z-95 flex items-center justify-center bg-[#0d0d0d]'
    >
      <h1 className='loadingTitle__line'>
        {PRE_TEXT.split('').map((char, i) => (
          <span key={`pre-${i}`} className='loadingTitle__cell'>
            <span className='loadingGlyph loadingTitle__ink'>{char}</span>
          </span>
        ))}

        <span className='loadingTitle__cell'>
          <span className='loadingGlyph loadingTitle__reel'>
            {digits.split('').map((digit, i) => (
              <DigitReel
                key={i}
                char={digit}
                prevChar={prevDigits[i]}
                delay={i * DIGIT.stagger}
                duration={DIGIT.duration}
                ease={DIGIT.ease}
              />
            ))}
          </span>
        </span>

        {POST_TEXT.split('').map((char, i) => (
          <span key={`post-${i}`} className='loadingTitle__cell'>
            <span className='loadingGlyph loadingTitle__ink'>{char}</span>
          </span>
        ))}
      </h1>
    </div>
  );
}
