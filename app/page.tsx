'use client';

import gsap from 'gsap';
import { useRef, useState, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import { RefreshCw } from 'lucide-react';

export default function Home() {
  const [phase, setPhase] = useState<'loading' | 'changing' | 'title'>('loading');

  // ------------------------
  // リロードボタン
  // ------------------------
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  /* タイムアウト秒数後に変数を更新 */
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRefreshing(true);
    }, 5000); //TODO: 15000秒にする
    return () => clearTimeout(timer);
  }, []);

  /* ホバー時に矢印回転 */
  const iconRef = useRef<SVGSVGElement>(null);
  const handleHover = () => {
    gsap.to(iconRef.current, { rotation: '+=180', duration: 0.5, ease: 'power4.inOut' });
  };

  // ------------------------
  // テキストのアニメーション
  // ------------------------
  const titleTextRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      /* 点滅アニメーション */
      if (phase === 'loading') {
        gsap.to('.textLoading', {
          opacity: 0.3,
          duration: 0.8,
          repeat: -1,
          yoyo: true,
          ease: 'power1.inOut',
        });
      }
      /* フェードアウトアニメーション */
      if (phase === 'changing') {
        const tl = gsap.timeline({
          onComplete: () => setPhase('title'),
        });

        tl.to('.loading', {
          opacity: 0,
          filter: 'blur(20px)',
          duration: 0.8,
          stagger: {
            amount: 0.5,
            from: 'center',
          },
          ease: 'power2.in',
        });

        tl.to(
          '.title',
          {
            opacity: 1,
            filter: 'blur(0px)',
            duration: 0.8,
            stagger: {
              amount: 0.5,
              from: 'random',
            },
            ease: 'power2.out',
          },
          '-=0.3',
        );
      }
    },
    { dependencies: [phase], scope: titleTextRef },
  );

  useEffect(() => {
    const timer = setTimeout(() => setPhase('changing'), 3000);
    return () => clearTimeout(timer);
  }, []);

  // ------------------------
  // ページ
  // ------------------------
  return (
    <main className='flex flex-1 items-center justify-center bg-zinc-600 text-zinc-50'>
      <div ref={titleTextRef} className='relative'>
        {phase !== 'title' && (
          <span className='textLoading absolute inset-0 flex items-center justify-center'>
            {'Loading...'.split('').map((char, i) => (
              <span key={i} className='loading'>
                {char}
              </span>
            ))}
          </span>
        )}
        {phase !== 'loading' && (
          <span className='textTitle text-5xl absolute inset-0 flex items-center justify-center'>
            {'Portfolio'.split('').map((char, i) => (
              <span key={i} className='title opacity-0 blur-[20px]'>
                {char}
              </span>
            ))}
          </span>
        )}
      </div>
      {isRefreshing &&
        phase === 'loading' && ( // 15秒後：ページリロードボタンの出現
          <button
            onClick={() => window.location.reload()}
            className='cursor-pointer bg-zinc-50 px-4 py-2 text-zinc-800 rounded-xl flex items-center gap-2 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-500 ease-in-out'
            onMouseEnter={handleHover}
            onMouseLeave={handleHover}
          >
            Reload <RefreshCw ref={iconRef} className='w-4 h-4' />
          </button>
        )}
    </main>
  );
}
