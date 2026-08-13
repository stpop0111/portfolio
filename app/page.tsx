'use client';

// GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
// THREE
import type { Group } from 'three';
import { useEnvironment, useGLTF } from '@react-three/drei';
import { useProgress } from '@react-three/drei';
// React
import { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
// コンポーネントのインポート
import Curtains from './_components/Curtains/Curtains';
import CanvasTitle from './_components/CanvasTitle';
import { ReloadButton } from './_home/ReloadButton';
import { HeroText } from './_home/HeroText';
import { CanvasPC } from './_home/Canvas/CanvasPC';
import { CanvasNavKey } from './_home/Canvas/CanvasKey';
import { GridBackground } from './_components/GridBackground';
import { FluidTitleWarp } from './_components/FluidEffect/FluidTitleWarp';
import { keyCapsPalettes } from './_home/Canvas/CanvasKey/keyCapsPalettes';
import { curtainPalettes } from './_components/Curtains/curtainPalettes';

// プリロード
useGLTF.preload('/models/model__keycap.glb');
useGLTF.preload('/models/model__pc.glb');
useGLTF.preload('/models/model__letter-f.glb');
useGLTF.preload('/models/model__letter-a.glb');
useEnvironment.preload({ preset: 'studio' });

function PageInner() {
  const searchParams = useSearchParams();
  const skipIntro = searchParams.get('from') === 'about';
  return <Home skipIntro={skipIntro} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className='fixed inset-0 bg-[#0d0d0d] z-9999' />}>
      <PageInner />
    </Suspense>
  );
}

function Home({ skipIntro }: { skipIntro: boolean }) {
  const [phase, setPhase] = useState<'loading' | 'changing' | 'title' | 'hero'>(skipIntro ? 'hero' : 'loading');
  const [showCurtain, setShowCurtain] = useState<boolean>(true);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState<boolean>(false);
  const handleModelReady = useCallback(() => setModelReady(true), []);
  const keyCaps = Object.values(keyCapsPalettes);

  // ---------------------------
  // 各ページへの遷移
  // ---------------------------
  const router = useRouter();
  const [transitionTo, setTransitionTo] = useState<string | null>(null);
  const handleClick = (path: string) => {
    setTransitionTo(`${path}?from=home`);
  };

  // ---------------------------
  // プリロード
  // ---------------------------
  const { progress, total } = useProgress();
  useEffect(() => {
    if (!skipIntro && phase === 'loading' && progress === 100 && total > 0) {
      const timer = setTimeout(() => { setPhase('changing'); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [progress, total, phase, skipIntro]);

  // ---------------------------
  // リロードボタンの表示
  // ---------------------------
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false); // リロードボタン出現の管理
  useEffect(() => {
    const timer = setTimeout(() => { setIsRefreshing(true); }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // ---------------------------
  // テキストのアニメーション
  // ---------------------------
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
        tl.to('.loading', { opacity: 0, filter: 'blur(20px)', duration: 0.8, stagger: { amount: 0.5, from: 'center' }, ease: 'power2.in', })
          .to('.progressText', { y: '100%', duration: 0.8, ease: 'bounce.out' }, '<');
      }
    },
    { dependencies: [phase] },
  );

  // ---------------------------
  // タイトル画面の表示
  // ---------------------------
  const canvasPCRef = useRef<Group>(null);
  const canvasNavKeyRef = useRef<HTMLDivElement>(null);
  const canvasTitleRef = useRef<HTMLDivElement>(null);

  // アニメーション；タイトル表示からヒーローコンテンツ表示
  // ---------------------------
  useEffect(() => {
    if (phase === 'title') {
      const timer = setTimeout(() => setPhase('hero'), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useGSAP(
    () => {
      if (phase === 'hero') {
        if (!canvasPCRef.current || !canvasNavKeyRef.current || !canvasTitleRef.current) return;
        const tl = gsap.timeline({ delay: 0.7 });
        tl.from(canvasPCRef.current!.position, { y: -1, duration: 1.2, ease: 'power4.inOut' }, '<')
          .to(canvasTitleRef.current, { y: '-75%', duration: 1.2, ease: 'power2.inOut' }, '<')
          .fromTo('.gradientOverlay', { opacity: 0 }, { opacity: 1, duration: 1, ease: 'power2.inOut' }, '<');
      }
    },
    { dependencies: [phase, skipIntro, modelReady] },
  );
  // ---------------------------

  return (
    <main className='flex flex-1 items-center justify-center bg-[#0d0d0d] text-zinc-50'>
      <GridBackground active={phase === 'hero'} />
      {/* カーテン遷移（各下層から） */}
      <Curtains
        show={!!transitionTo}
        anchor='bottom'
        baseZIndex={100}
        motion={'enter'}
        colors={curtainPalettes.zinc}
        onComplete={() => transitionTo && router.push(transitionTo)}
      />
      {/* カーテン遷移（各下層へ） */}
      <Curtains
        show={showCurtain}
        anchor='top'
        motion={phase === 'hero' ? 'exit' : 'none'}
        colors={['bg-zinc-950', 'bg-zinc-900', 'bg-zinc-800', 'bg-zinc-800', 'bg-zinc-900', 'bg-zinc-950']}
        onComplete={() => setShowCurtain(false)}
      />

      {/* パソコンとキーキャップ */}
      <CanvasPC ref={canvasPCRef} hoveredKey={hoveredKey} onReady={handleModelReady} />
      <CanvasNavKey
        ref={canvasNavKeyRef}
        keyCaps={keyCaps}
        onKeyCapClick={handleClick}
        onKeyCapHover={setHoveredKey}
        phase={phase}
      />

      {/* グラデーションのオーバーレイ */}
      <div
        className='gradientOverlay fixed inset-0 pointer-events-none'
        style={{ background: 'linear-gradient(0deg, rgba(13,13,13,1) 0%, rgba(13,13,13,0) 45%)', zIndex: 30 }}
      />

      {/* タイトルテキスト */}
      <HeroText ref={heroTextRef} phase={phase} progressCount={Math.floor(progress)} hideLoading={skipIntro} />
      <CanvasTitle
        ref={canvasTitleRef}
        phase={phase}
        skipIntro={skipIntro}
        modelPath='/models/model__letter-f.glb'
        modelName='letter_f'
        bgColor='#fafafa'
        visuallyHidden
        enableHeroColorChange
        wrapperPreset='main'
        preText={{ text: 'Port', position: [-0.2, 0, -0.5], anchorX: 'right', textColor: '#fafafa' }}
        postText={{ text: 'olio', position: [0.2, 0, -0.5], anchorX: 'left', textColor: '#fafafa' }}
      />
      <FluidTitleWarp
        active={phase === 'title' || phase === 'hero'}
        sourceRef={canvasTitleRef}
        className={`fixed inset-0 h-full w-full pointer-events-none ${skipIntro ? 'z-80' : 'z-92'}`}
      />
      {/* ページリロードボタン */}
      {isRefreshing && phase === 'loading' && (
        <div className='fixed z-50 bottom-8 left-1/2 -translate-x-1/2'>
          <ReloadButton />
        </div>
      )}
    </main>
  );
}
