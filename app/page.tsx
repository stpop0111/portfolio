'use client';

// GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
// THREE
import type { Group } from 'three';
import { useEnvironment, useGLTF } from '@react-three/drei';
import { useProgress } from '@react-three/drei';
// React
import { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
// コンポーネントのインポート
import Curtains from './_components/Curtains';
import { ReloadButton } from './hero/ReloadButton';
import { HeroText } from './hero/HeroText';
import { CanvasPC } from './hero/Canvas/CanvasPC';
import { CanvasNavKey } from './hero/Canvas/CanvasKey';
import CanvasTitle from './_components/CanvasTitle';

// 外側コンポーネント：マウント判定だけする
export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [skipIntro, setSkipIntro] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSkipIntro(params.get('from') === 'about');
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className='fixed inset-0 bg-zinc-50 z-9999' />;
  }

  return <Home skipIntro={skipIntro} />;
}

// 内側：本物の Home（skipIntro を props で受け取る）
function Home({ skipIntro }: { skipIntro: boolean }) {
  const [phase, setPhase] = useState<'loading' | 'changing' | 'title' | 'hero'>( skipIntro ? 'hero' : 'loading' );
  const [showCurtain, setShowCurtain] = useState<boolean>(true);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState<boolean>(false);
  const handleModelReady = useCallback(() => setModelReady(true), []);

  const keyCaps = [
    { label: 'ABOUT ME', x: -3, color: '#222222', textColor: '#222', path: '/about', paletteName:
      ['bg-aboutMe-800', 'bg-aboutMe-700', 'bg-aboutMe-600', 'bg-aboutMe-500', 'bg-aboutMe-400', 'bg-aboutMe-300'] 
    },
    { label: 'WORKS', x: -1, color: '#F5E7C6', textColor: '#f7f7f7', path: '/works', paletteName:
      ['bg-works-100', 'bg-works-200', 'bg-works-300', 'bg-works-400', 'bg-works-500', 'bg-works-600']
    },
    { label: 'CREATIVE', x: 1, color: '#FA8112', textColor: '#222', path: '/creative', paletteName:
      ['bg-creative-950', 'bg-creative-900', 'bg-creative-800', 'bg-creative-700', 'bg-creative-600', 'bg-creative-500']
    },
    { label: 'ORIGINAL WORKS', x: 3, color: '#FAF3E1', textColor: '#f7f7f7', path: '/original', paletteName:
      ['bg-originalWorks-500', 'bg-originalWorks-400', 'bg-originalWorks-300', 'bg-originalWorks-200', 'bg-originalWorks-100', 'bg-originalWorks-50']
    },
  ];

  // ----------------------------------------
  //　各ページへの遷移
  // ----------------------------------------
  const router = useRouter();
  const [transitionTo, setTransitionTo] = useState<string | null>(null);
  const [navPaletteColors, setNavPaletteColors] = useState<string[]>(['']);
  const handleClick = (path: string, paletteName: string[]) => {
    setNavPaletteColors(paletteName);
    setTransitionTo(`${path}?from=home`);  
  };

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
    if (!skipIntro && phase === 'loading' && progress === 100 && total > 0) {
      const timer = setTimeout(() => {
        setPhase('changing');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [progress, total, phase, skipIntro]);


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
          tl.to(char, { y: -2, duration: 0.1, ease: 'power2.out' }, '-=0.2').to(char, {
            y: 0,
            duration: 0.15,
            ease: 'power2.in',
          });
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
        if (!canvasPCRef.current || !canvasNavKeyRef.current || !canvasTitleRef.current) return;
        const tl = gsap.timeline();
        tl.from(canvasPCRef.current!.position, { y: -2, duration: 1.2, ease: 'power4.inOut' }, '<')
          .from(canvasNavKeyRef.current, { y: '+100%', duration: 1.2, ease: 'power2.inOut' }, '<')
          .to(canvasTitleRef.current, { y: '-120%', duration: 1.2, ease: 'power2.inOut' }, '<')
          .fromTo( '.gradientOverlay', { opacity: 0, y: '+100%' }, { opacity: 1, y: 0, duration: 1, ease: 'power2.out' }, '<', ); 
      }
    },
    { dependencies: [phase, skipIntro, modelReady] },
  );

  // ------------------------
  // ページ
  // ------------------------
  return (
    <main className='flex flex-1 items-center justify-center bg-zinc-50 text-zinc-50'>
      <Curtains
        show={!!transitionTo} anchor='bottom' baseZIndex={100} onComplete={() => transitionTo && router.push(transitionTo)}
        motion={'enter'}
        colors={navPaletteColors}
      />
      <Curtains
        show={showCurtain} anchor='top' onComplete={() => setShowCurtain(false)}
        motion={phase === 'hero' ? 'exit' : 'none'}
        colors={['bg-zinc-700', 'bg-zinc-600', 'bg-zinc-500', 'bg-zinc-400', 'bg-zinc-300', 'bg-zinc-200']}
      />
      <CanvasPC ref={canvasPCRef} hoveredKey={hoveredKey} onReady={handleModelReady} />
      <div
        className='gradientOverlay h-50vh fixed inset-0 pointer-events-none'
        style={{
          background: 'linear-gradient(0deg,rgba(250, 243, 225, 1) 0%, rgba(255, 255, 225, 0) 30%)',
          zIndex: 30,
        }}
      />
      <CanvasNavKey
        ref={canvasNavKeyRef}
        keyCaps={keyCaps}
        onKeyCapClick={handleClick}
        onKeyCapHover={setHoveredKey}
      />
      <div
        className='gradientOverlay fixed inset-0 pointer-events-none'
        style={{
          background: 'linear-gradient(0deg,rgba(250, 243, 225, 1) 0%, rgba(255, 255, 225, 0) 100%)',
          zIndex: 1,
        }}
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
        preText={{ 
          text: 'Port', 
          position: [-0.2, 0, -0.5], 
          anchorX: 'right' 
        }}
        postText={{ 
          text: 'olio', 
          position: [0.2, 0, -0.5], 
          anchorX: 'left' 
        }}
        enableHeroColorChange
        wrapperPreset='main'
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
