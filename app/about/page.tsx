'use client';

// GSAP
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
// React
import { useRef } from 'react';
// コンポーネント
import { CanvasTitle } from './Canvas/CanvasTitle';

export default function About() {
  /* タイトル表示アニメーション */
  const canvasTitleRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.set('.aboutBg', { y: '100%' });

    const tl = gsap.timeline();
    tl.to('.aboutBg', {
      y: '0%',
      duration: 0.6,
      ease: 'power2.inOut',
    });
  }, []);

  return (
    <main>
      {/* z-10: クリーム幕②（兼 背景）下から上がってきて停止 → そのまま背景 */}
      <div className='aboutBg fixed inset-0 z-10' style={{ backgroundColor: '#FAF3E1' }} />
      <CanvasTitle phase={''} ref={canvasTitleRef} />
      {/* z-20: タイトルロゴ（クリーム幕より上に表示） */}
      <section className='titleSection relative z-20 h-screen'>{/* CanvasAboutTitle はここ */}</section>

      {/* z-auto: スクロール用コンテンツ */}
      <section className='aboutContent relative h-[200vh]'>{/* 本編 */}</section>
    </main>
  );
}
