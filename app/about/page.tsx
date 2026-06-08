'use client';

// GSAP
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
// React
import { useRef, useState } from 'react';
// コンポーネント
import { CanvasTitle } from './Canvas/CanvasTitle';

export default function About() {
  const [phase, setPhase] = useState<'curtain' | 'title' | 'reveal'>('curtain');
  const canvasTitleRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.set('.aboutBg', { y: '100%' });
    const tl = gsap.timeline({ onComplete: () => setPhase('title') });
    tl.to('.aboutBg', { y: '0%', duration: 1.4, ease: 'power2.inOut' })
    .to(canvasTitleRef.current, {
      y: '-40vh',
      ease: "power2.inOut",
      scrollTrigger: {
        trigger: '.titleSection',
        start: 'top top',
        end: '+=300vh',
        scrub: true,
        onLeave: () => {
          gsap.to('.aboutBg', { backgroundColor: '#222222', duration: 0.4, ease: 'power2.inOut', });
        },
        onEnterBack: () => {
          gsap.to('.aboutBg', { backgroundColor: '#FAF3E1', duration: 0.4, ease: 'power2.inOut', });
        },
      },
    });
  }, []);

  return (
    <main>
      {/* z-10: クリーム幕②（兼 背景）下から上がってきて停止 → そのまま背景 */}
      <div className='aboutBg fixed inset-0 z-10' style={{ backgroundColor: '#FAF3E1' }} />
      {/* z-20: タイトルロゴ（クリーム幕より上に表示） */}
      <section className='titleSection relative z-20 h-screen'>
      <CanvasTitle phase={phase} ref={canvasTitleRef} />
      </section>

      {/* z-auto: スクロール用コンテンツ */}
      <section className='aboutContent relative h-[400vh]'>{/* 本編 */}</section>
    </main>
  );
}
