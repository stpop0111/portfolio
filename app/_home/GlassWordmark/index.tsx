'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { WORDMARK_MASK, WORDMARK_PATHS, WORDMARK_VIEWBOX } from './wordmarkPaths';

type Phase = 'loading' | 'changing' | 'title' | 'hero';

const ENTER = { duration: 1.6, ease: 'power2.out', delay: 0.2 }; // タイトルより少しだけ遅れて出す

/**
 * タイトルの裏に敷く「seita」のガラス。
 *
 * CanvasTitle のラッパーと同じ箱（fixed / w-full / h-40vh）に載せているので、
 * 画面のどこにいても常にタイトルの真後ろに来る。
 * ヒーローへ移動するときの動きは page.tsx のタイムラインでタイトルと同じ tween に
 * まとめているため、ここでは登場だけを持つ。
 */
export function GlassWordmark({ phase, skipIntro = false }: { phase: Phase; skipIntro?: boolean }) {
  const shapeRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (phase !== 'title') return;
      gsap.fromTo(
        shapeRef.current,
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: ENTER.duration, ease: ENTER.ease, delay: ENTER.delay },
      );
    },
    { dependencies: [phase] },
  );

  if (phase === 'loading' || phase === 'changing') return null;

  return (
    <div className='glassWordmark fixed w-full h-[40vh] z-91 flex items-center justify-center pointer-events-none'>
      {/* about から戻ってきたときは title フェーズを通らないので、最初から見えている状態にする */}
      <div ref={shapeRef} className={`glassWordmark__shape ${skipIntro ? '' : 'opacity-0'}`}>
        {/* ガラスの面。背面をぼかして彩度を上げ、白い薄膜を重ねる */}
        <div
          className='glassWordmark__pane'
          style={{ maskImage: WORDMARK_MASK, WebkitMaskImage: WORDMARK_MASK }}
        />
        {/* ふちの光。面と同じ形を線だけで描いて重ねる */}
        <svg
          className='glassWordmark__edge'
          viewBox={`0 0 ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}`}
          aria-hidden
        >
          {WORDMARK_PATHS.map((d) => (
            <path key={d} d={d} vectorEffect='non-scaling-stroke' />
          ))}
        </svg>
      </div>
    </div>
  );
}
