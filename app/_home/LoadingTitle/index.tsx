'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { DigitReel } from './DigitReel';

type Phase = 'loading' | 'changing' | 'title' | 'hero';

/* -------------------------------------------------
  タイミング（PDFに指定のない値は提案値。ここだけ見れば調整できる）
------------------------------------------------- */
const DIGIT_LENGTH = 3;
const PRE_TEXT = 'P';
const POST_TEXT = 'rtfolio';

/*
  秒数は Material の motion ガイドラインに寄せている。
  大きく動くもの・見せ場になるものは extra-long（0.7〜1.0秒）の領域を使う。
  stagger は必ず duration より短くして、要素同士の動きを重ねる
  （前の要素が止まってから次が動く並びは機械的に見えるため）。

  イージングは GSAP の組み込みを使う。Material の easing トークンに当てはめると
  だいたい次の対応になる（数値で近似を取った結果）。
    出てくるもの・止まるもの        … power2.out（強めに効かせたいときは expo.out）
    去っていくもの                  … power2.in
    位置を移すもの・動きを見せるもの … power1.inOut
  減速だけの out 系は前半に動きが偏るので、秒数を伸ばしても体感が変わらない。
  「ゆっくり見せたい」ものには inOut を当てる。
*/
const TICK = 0.5; // 進捗を検知する間隔（PDF指定）。数字が回っている間は進まない
const MIN_DURATION = 1.5; // 検知時間の合計がこれを下回らないようにする。TICK×3回分は必ず見せる
const HOLD = 1.4; // 100%到達後のキープ。落とす前の「ため」として PDF指定の0.7から伸ばしている
const AFTER_EXIT = 0.35; // 文字が消えてからタイトルを出すまでの間

// ロールは数字が流れるところを見せたいので inOut。out 系だと一瞬で流れてしまう
const DIGIT = { duration: 0.9, ease: 'power1.inOut', stagger: 0.08 }; // 100の位→1の位
const EXIT = { duration: 0.9, ease: 'power2.in', stagger: 0.07 }; // 退場。右→左

// 最後の桁まで回り終わるのにかかる時間。この間は検知を止める
const ROLL_TIME = DIGIT.duration + DIGIT.stagger * (DIGIT_LENGTH - 1);

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

  // タイマーを張り直さずに最新の進捗を読むための箱
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // 表示中の値と、その直前の値。リールが「途中に積む数字」を決めるのに両方いる
  const [count, setCount] = useState({ value: 0, prev: 0 });

  /* 0.5秒ローディングを検知 → その数値まで回す → 回り終わったらまた0.5秒検知…
     を繰り返す。数字が回っている間は検知を止めるので、ロールが途中で切られない
  --------------------------------------- */
  useEffect(() => {
    if (phase !== 'loading') return;

    let timer = 0;
    let detected = 0; // 検知に使った時間の合計。回っている間は増えない
    let shown = 0; // いま表示している値

    const sample = () => {
      detected += TICK;
      // 実ロードが速く終わってもカウントアップを見せたいので、検知時間で上限をかける。
      // MIN_DURATION 秒ぶん検知して 0→100 に開く天井と、実際の進捗の低い方を採用する
      const ceiling = (detected / MIN_DURATION) * 100;
      const next = Math.floor(Math.min(progressRef.current, ceiling, 100));
      // 進捗が巻き戻ることがあるので、表示は減らさない
      const rolls = next > shown;
      if (rolls) {
        setCount({ value: next, prev: shown });
        shown = next;
      }
      if (next >= 100) return; // 100 まで来たらここで打ち止め
      // 回したぶんだけ待ってから次の検知へ
      timer = window.setTimeout(sample, (rolls ? ROLL_TIME + TICK : TICK) * 1000);
    };

    timer = window.setTimeout(sample, TICK * 1000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  /* 100%到達 → 最後の桁が止まってから0.7秒キープ → 退場へ
  --------------------------------------- */
  useEffect(() => {
    if (phase !== 'loading' || count.value < 100) return;
    const id = window.setTimeout(onCountComplete, (ROLL_TIME + HOLD) * 1000);
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
        // 消えきってすぐタイトルを出すと詰まって見えるので、一拍おいてから次へ渡す
        onComplete: () => gsap.delayedCall(AFTER_EXIT, onExitComplete),
      });
    },
    { scope: rootRef, dependencies: [phase] },
  );

  if (phase !== 'loading' && phase !== 'changing') return null;

  const digits = String(count.value).padStart(DIGIT_LENGTH, '0');
  const prevDigits = String(count.prev).padStart(DIGIT_LENGTH, '0');

  // 背景はカーテンの最前面（bg-zinc-950）と同じ色にして、退場後に地色が変わらないようにする
  return (
    <div
      ref={rootRef}
      className='loadingTitle font-urbanist fixed inset-0 z-95 flex items-center justify-center bg-zinc-950'
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
