'use client';

// GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
// THREE
import type { Group } from 'three';
import { useEnvironment, useGLTF } from '@react-three/drei';
import { useProgress } from '@react-three/drei';
// React
import { useRef, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// コンポーネントのインポート
import { Curtains } from './hero/Curtains';
import { ReloadButton } from './hero/ReloadButton';
import { HeroText } from './hero/HeroText';
import { CanvasPC } from './hero/Canvas/CanvasPC';
import { CanvasNavKey } from './hero/Canvas/CanvasKey';
import { CanvasTitle } from './hero/Canvas/CanvasTitle';

function HomeContent() {
  // About から戻ってきた場合は loading/changing/title を飛ばして hero から開始
  const searchParams = useSearchParams();
  const skipIntro = searchParams.get('from') === 'about';
  const [phase, setPhase] = useState<'loading' | 'changing' | 'title' | 'hero'>(skipIntro ? 'hero' : 'loading'); // アニメーションのフェーズ管理
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const keyCaps = [
    { label: 'ABOUT ME', x: -3, color: '#222222', textColor: '#222', path: '/about' },
    { label: 'WORKS', x: -1, color: '#F5E7C6', textColor: '#f7f7f7', path: '/works' },
    { label: 'CREATIVE', x: 1, color: '#FA8112', textColor: '#222', path: '/creative' },
    { label: 'ORIGINAL WORKS', x: 3, color: '#FAF3E1', textColor: '#f7f7f7', path: '/original' },
  ];

  // ----------------------------------------
  // 各ページへの遷移
  // ----------------------------------------
  const router = useRouter();
  const [transitionTo, setTransitionTo] = useState<string | null>(null);
  const handleClick = (path: string) => {
    setTransitionTo(path);
  };

  useGSAP(
    () => {
      if (transitionTo) {
        gsap.fromTo(
          '.whiteCurtain',
          { y: '100%' },
          { y: '0%', duration: 1.4, ease: 'power2.inOut', onComplete: () => router.push(transitionTo) },
        );
      }
    },
    { dependencies: [transitionTo] },
  );

  // ----------------------------------------
  // 3Dモデルのロードを待つ
  // ----------------------------------------
  // 3Dモデル
  useGLTF.preload('/models/model__keycap.glb');
  useGLTF.preload('/models/model__pc.glb');
  useGLTF.preload('/models/model__letter-y.glb');
  useEnvironment.preload({ preset: 'studio' });

  const { progress, total } = useProgress();
  useEffect(() => {
    if (phase === 'loading' && progress === 100 && total > 0) {
      const timer = setTimeout(() => {
        setPhase('changing');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [progress, total, phase]);

  // ----------------------------------------
  // リロードボタン
  // ----------------------------------------
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false); // リロードボタン出現の管理
  /* タイムアウト秒数後に変数を更新 */
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRefreshing(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // ----------------------------------------
  // テキストのアニメーション
  // ----------------------------------------
  const heroTextRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      /* アニメーション : ローディング */
      if (phase === 'loading') {
        const tl = gsap.timeline({ repeat: -1 });
        gsap.utils.toArray<Element>('.loading').forEach((char) => {
          tl.to(char, { y: -2, duration: 0.1, ease: 'power2.out' }, '-=0.2')
            .to(char, { y: 0, duration: 0.15, ease: 'power2.in', });
        });
      }
      /* アニメーション : タイトルの表示切り替え */
      if (phase === 'changing') {
        const tl = gsap.timeline({ onComplete: () => setPhase('title') });
        tl.to('.loading', {
          opacity: 0,
          filter: 'blur(20px)',
          duration: 0.8,
          stagger: { amount: 0.5, from: 'center' },
          ease: 'power2.in',
        }).to('.progressText', { y: '100%', duration: 0.8, ease: 'bounce.out' }, '<');
      }
    },
    { dependencies: [phase] },
  );

  // ----------------------------------------
  // タイトル画面の表示
  // ----------------------------------------
  const canvasPCRef = useRef<Group>(null);
  const canvasNavKeyRef = useRef<HTMLDivElement>(null);
  const canvasTitleRef = useRef<HTMLDivElement>(null);
  const [showCurtain, setShowCurtain] = useState<boolean>(true);

  /* title -> hero : タイトル画面に遷移してから*/
  useEffect(() => {
    if (phase === 'title') {
      const timer = setTimeout(() => setPhase('hero'), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useGSAP(
    () => {
      if (phase === 'hero') {
        const tl = gsap.timeline();
        tl.to('.curtain', {
          y: '-100%',
          duration: 0.5,
          stagger: 0.08,
          ease: 'power2.inOut',
          onComplete: () => setShowCurtain(false),
        }) // カーテンアップ => アニメーション終了後に状態変数を変更
          .from(canvasPCRef.current!.position, { y: -2, duration: 1.2, ease: 'power4.inOut' }, '<')
          .from(canvasNavKeyRef.current, { y: '+100%', duration: 1.2, ease: 'power2.inOut' }, '<')
          .to(canvasTitleRef.current, { y: '-120%', duration: 1.2, ease: 'power2.inOut' }, '<')
          .fromTo(
            '.gradientOverlay',
            { opacity: 0, y: '+100%' },
            { opacity: 1, y: 0, duration: 1, ease: 'power2.out' },
            '<',
          ); // グラデーションが下から広がる
      }
    },
    { dependencies: [phase] },
  );

  // ------------------------
  // ページ
  // ------------------------
  return (
    <main className='flex flex-1 items-center justify-center bg-zinc-50 text-zinc-50'>
      {/* 幕 */}
      <Curtains show={showCurtain} colors={['bg-zinc-700', 'bg-zinc-600', 'bg-zinc-500', 'bg-zinc-400', 'bg-zinc-300', 'bg-zinc-200']} />

      {/* PCモデルの配置 */}
      <CanvasPC ref={canvasPCRef} hoveredKey={hoveredKey} />

      {/* グラデーション（PCモデルより前に） */}
      <div className='gradientOverlay h-50vh[] fixed inset-0 pointer-events-none'
        style={{ background: 'linear-gradient(0deg,rgba(250, 243, 225, 1) 0%, rgba(255, 255, 225, 0) 30%)', zIndex: 30, }}
      />
      {phase === 'hero' && (
        <CanvasNavKey ref={canvasNavKeyRef} keyCaps={keyCaps} onKeyCapClick={handleClick} onKeyCapHover={setHoveredKey} />
      )}

      <div className='whiteCurtain fixed inset-0 z-100 bg-zinc-50' style={{ transform: 'translateY(100%)' }} />
      {/* グラデーション背景 */}
      <div
        className='gradientOverlay fixed inset-0 pointer-events-none'
        style={{
          background: 'linear-gradient(0deg,rgba(250, 243, 225, 1) 0%, rgba(255, 255, 225, 0) 100%)',
          zIndex: 1,
        }}
      />

      {/* タイトルテキスト */}
      <HeroText ref={heroTextRef} phase={phase} progressCount={Math.floor(progress)} />
      <CanvasTitle ref={canvasTitleRef} phase={phase} />

      {/* ページリロードボタン */}
      {isRefreshing && phase === 'loading' && (
        <div className='fixed z-50 bottom-8 left-1/2 -translate-x-1/2'>
          <ReloadButton />
        </div>
      )}
    </main>
  );
}

export default function Home() {
  // useSearchParams は Suspense 境界が必要
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
