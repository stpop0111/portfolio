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
import { LoadingTitle } from './_home/LoadingTitle';
import { GlassWordmark } from './_home/GlassWordmark';
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
  // total が 0 の間は進捗が当てにならないので 0 として扱う
  const { progress, total } = useProgress();
  const loadProgress = total > 0 ? progress : 0;
  const handleCountComplete = useCallback(() => setPhase('changing'), []);
  const handleExitComplete = useCallback(() => setPhase('title'), []);

  // ---------------------------
  // リロードボタンの表示
  // ---------------------------
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false); // リロードボタン出現の管理
  useEffect(() => {
    // イントロが一通り終わる時間より後に出す。早いとローディング中に被る
    const timer = setTimeout(() => { setIsRefreshing(true); }, 15000);
    return () => clearTimeout(timer);
  }, []);

  // ---------------------------
  // テキストのアニメーション
  // ---------------------------
  const heroTextRef = useRef<HTMLDivElement>(null);

  // ---------------------------
  // タイトル画面の表示
  // ---------------------------
  const canvasPCRef = useRef<Group>(null);
  const canvasNavKeyRef = useRef<HTMLDivElement>(null);
  const canvasTitleRef = useRef<HTMLDivElement>(null);

  // アニメーション；タイトル表示からヒーローコンテンツ表示
  // ---------------------------
  // タイトルが出きったあと、読ませる間をとってからヒーローへ
  useEffect(() => {
    if (phase === 'title') {
      const timer = setTimeout(() => setPhase('hero'), 2600);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useGSAP(
    () => {
      if (phase === 'hero') {
        if (!canvasPCRef.current || !canvasNavKeyRef.current || !canvasTitleRef.current) return;
        // 3つを完全に同時に動かすと一発の切り替えに見えるので、少しずつずらして重ねる。
        // 大きく動くものは out 系だと前半に偏って忙しく見えるので inOut のまま伸ばす
        const tl = gsap.timeline({ delay: 0.9 });
        tl.from(canvasPCRef.current!.position, { y: -1, duration: 1.6, ease: 'power4.inOut' }, '<')
          // 裏のガラスはタイトルと同じ tween にまとめて、ずれようがないようにする
          .to([canvasTitleRef.current, '.glassWordmark'], { y: '-75%', duration: 1.6, ease: 'power2.inOut' }, '<0.15')
          .fromTo('.gradientOverlay', { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'power2.inOut' }, '<0.15');
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

      {/* ローディング画面 */}
      {!skipIntro && (
        <LoadingTitle
          phase={phase}
          progress={loadProgress}
          onCountComplete={handleCountComplete}
          onExitComplete={handleExitComplete}
        />
      )}

      {/* タイトルテキスト */}
      <HeroText ref={heroTextRef} />
      {/* タイトルの裏のガラス。CanvasTitle と同じ箱に載せて位置を揃えている */}
      <GlassWordmark phase={phase} skipIntro={skipIntro} />
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
      {/* ページリロードボタン（ローディング画面の z-95 より前に出す） */}
      {isRefreshing && phase === 'loading' && (
        <div className='fixed z-96 bottom-8 left-1/2 -translate-x-1/2'>
          <ReloadButton />
        </div>
      )}
    </main>
  );
}
