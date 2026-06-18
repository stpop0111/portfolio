'use client';

// GSAP
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
gsap.registerPlugin(ScrollTrigger, MorphSVGPlugin);
// React
import { useRef, useState, useEffect } from 'react';
// コンポーネント
import { CanvasTitle } from './Canvas/CanvasTitle';
// Lenis
import { useLenis } from 'lenis/react';
// Blob生成
import * as blobs from 'blobs/v2';
import { SplitText } from '../components/splitText';

export default function About() {
  const [phase, setPhase] = useState<'curtain' | 'title' | 'reveal'>('curtain');
  const [scrollLocked, setScrollLocked] = useState<boolean>(true);
  const [showScrollHint, setShowScrollHint] = useState<boolean>(false);
  const lenis = useLenis();

  /* lenisのスクロール制御&CSSにてネイティブスクロールの制御 */
  useEffect(() => {
    if (!lenis) return;
    if (scrollLocked) { lenis.stop(); } else { lenis.start(); }
    document.body.style.overflow = scrollLocked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lenis, scrollLocked]);

  /* タイトルに変化後何秒でスクロール可能にするか */
  useEffect(() => {
    if (phase !== 'title') return;
    const timer = setTimeout(() => { setScrollLocked(false); setShowScrollHint(true); }, 4000);
    return () => clearTimeout(timer);
  }, [phase]);

  /* スクロールヒントを何スクロールしたら消すか */
  useEffect(() => {
    if (!showScrollHint) return;
    const onScroll = () => { if (window.scrollY > 50) setShowScrollHint(false); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showScrollHint]);

  /* タイトルのアニメーション */
  const canvasTitleRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    /* タイトルの出現 */
    gsap.set('.aboutBg', { y: '100%' });
    const tl = gsap.timeline({ onComplete: () => setPhase('title') });
    tl.to('.aboutBg', 
        { y: '0%', duration: 1.4, ease: 'power2.inOut' })
      .to(canvasTitleRef.current, 
        { y: '-40vh', ease: 'power2.inOut',
      scrollTrigger: {
        trigger: '.titleSection',
        start: 'top top',
        end: '60% top',
        scrub: true,
        onLeave: () => { gsap.to('.aboutBg', { backgroundColor: '#222222', duration: 0.4, ease: 'power2.inOut' }); },
        onEnterBack: () => { gsap.to('.aboutBg', { backgroundColor: '#FAF3E1', duration: 0.4, ease: 'power2.inOut' }); },
      },
    });
  }, []);

  /* 行ごとの出現アニメーション */
  useGSAP(() => {
    /* 行ごとの変化 */
    gsap.utils.toArray<HTMLElement>('.paragraph').forEach((p) => {
      gsap.fromTo( p,
        { scale: 0.6, opacity: 0.2 },
        { scale: 1, opacity: 1,
          scrollTrigger: {
            trigger: p,
            start: 'top bottom',
            end: 'top 50%',
            scrub: true,
          },
        },
      );
    });
    /* 行のレクトを縮小 */
    gsap.utils.toArray<HTMLElement>('.rect').forEach((r) => {
      gsap.to(r, 
        { scaleX: 0, ease: 'power3.inOut', duration: 0.4,
        scrollTrigger: {
          trigger: r,
          start: 'top 80%',
        },
      });
    });
  }, []);

  /* Blob のうねうねモーフィング */
  const contactBlobRef = useRef<SVGPathElement>(null);
  const BASE_PATH = 'M363.275 0.0130943C455.847 0.699279 540.394 29.6867 605.639 71.3936C670.645 112.948 720.327 166.798 715.701 225.297C711.243 281.669 645.908 324.953 582.461 364.483C519.853 403.49 450.91 442.558 363.275 444.871C272.785 447.259 190.679 416.207 125.082 376.553C57.565 335.738 1.95118 284.48 0.054691 225.297C-1.87345 165.127 47.387 109.81 115.187 67.7581C182.131 26.2362 269.702 -0.680518 363.275 0.0130943Z';

  useGSAP(() => {
    const variations = Array.from({ length: 5 }, () => makeBlob(1));
    const tl = gsap.timeline({ repeat: -1 });
    variations.forEach((variant) => {
      tl.to(contactBlobRef.current, { morphSVG: variant, duration: 2, ease: 'sine.inOut' });
    });
    tl.to(contactBlobRef.current, { morphSVG: BASE_PATH, duration: 4, ease: 'sine.inOut' });

  }, []);



  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
          trigger: '.contactSection',
          start: 'top 40%',  // 画面下から 80% で発火
      }
    })
    tl.fromTo(contactBlobRef.current,
      {scale:0, opacity:0, transformOrigin: 'center center'},
      {scale:1, opacity:1, duration:1,transformOrigin: 'center center', ease:'power4.inOut'}
    )
      .fromTo('.contactText',
        { y: '-100%' },
        { y: 0, duration: 0.3, 
          stagger: { 
            amount: 1.6,
            from: 'start', 
          },
          ease: 'power2.out',
        }
      );
  })

  return (
    <main>
      {/* z-20: タイトルロゴ（クリーム幕より上に表示） */}
      <section className='titleSection h-[200vh] pointer-events-none'>
        <CanvasTitle ref={canvasTitleRef} phase={phase} />
      </section>

      {/* z-auto: スクロール用コンテンツ */}
      <section className='aboutContent relative z-20'>
        <div className='introBlock space-y-[20vh]'>
          {/* セクション1: 自己紹介 */}
          <div className=''>
            <Paragraph>こんにちは、<Accent>Seita</Accent>です。</Paragraph>
            <Paragraph>Webの仕事に</Paragraph>
            <Paragraph>小さく挑戦している</Paragraph>
            <Paragraph><Accent>Junior</Accent><Accent>Web</Accent><Accent>Developer</Accent>です。 </Paragraph>
          </div>

          {/* セクション2: バックグラウンド */}
          <div className=''>
            <Paragraph> 電子工業科で<Accent>C</Accent>や<Accent>Python</Accent>に触れ、
            </Paragraph>
            <Paragraph>国際教養学部で言葉を学び、</Paragraph>
            <Paragraph>今はコードに戻ってきました。</Paragraph>
          </div>

          {/* セクション3: 現在のロール */}
          <div className=''>
            <Paragraph><Accent fontFamily='font-kozuka-mincho normal'>小さなチームのリード</Accent>として、</Paragraph>
            <Paragraph><Accent fontFamily='font-kozuka-mincho'>ECサイト</Accent>の企画から実装まで、</Paragraph>
            <Paragraph>ひとつの頭で考えています。</Paragraph>
          </div>

          {/* セクション4: 仕事観 */}
          <div className=''>
            <Paragraph>企画もデザインも、</Paragraph>
            <Paragraph>コードも分析も、</Paragraph>
            <Paragraph>すべて<Accent fontFamily='font-kozuka-mincho'>地続き</Accent>の仕事として。</Paragraph>
          </div>

          {/* セクション5: 制作哲学 */}
          <div className=''>
            <Paragraph>つくるものは、</Paragraph>
            <Paragraph>次に触る誰かにも、</Paragraph>
            <Paragraph><Accent fontFamily='font-kozuka-mincho'>やさしくありたい</Accent>。
            </Paragraph>
          </div>

          {/* セクション6: チーム観 */}
          <div className=''>
            <Paragraph>ひとりでできることを増やすことより、</Paragraph>
            <Paragraph>
              <Accent fontFamily='font-kozuka-mincho'>チーム</Accent>でできることを増やす方が、
            </Paragraph>
            <Paragraph>わたしは好きです。</Paragraph>
          </div>

          {/* セクション7: 締め */}
          <div className=''>
            <Paragraph>
              いつも<Accent fontFamily='font-kozuka-mincho'>好奇心</Accent>を持って、
            </Paragraph>
            <Paragraph>
              いつも<Accent fontFamily='font-kozuka-mincho'>学び</Accent>ながら、
            </Paragraph>
            <Paragraph>
              いつも、<Accent fontFamily='font-kozuka-mincho'>細部</Accent>に。
            </Paragraph>
          </div>
        </div>
      </section>

      {/* コンタクト */}
      <section className='contactSection relative z-20 h-screen flex items-center justify-center'>
        <a
          href='mailto:stpop0111@gmail.com'
          className={`flex items-center justify-center group`}
        >
          
          {/* 背景のblob */}
          <svg viewBox='0 0 716 445' className='absolute w-[80vw] max-w-180 h-auto overflow-visible' >
            <path ref={contactBlobRef} id='contactBlob' d={BASE_PATH} fill='#C4C4C4' />
          </svg>
          {/* テキストオーバーレイ */}
          <div className='relative z-10 text-center px-12'>
            <div className=" font-noto-sans-jp">
              <p className='overflow-hidden text-zinc-600 text-2xl font-futura'><SplitText text='I wanna join your work with you' className='contactText'/></p>
              <h2 className='overflow-hidden text-zinc-900 text-3xl font-kozuka-gothic font-semibold'><SplitText text='あなたのお仕事にご協力させてください' className='contactText'/></h2>
            </div>
            <p className='font-seasons overflow-hidden text-base text-zinc-900 mt-3 group-hover:underline'><SplitText text='(send me mail)' className='contactText'/></p>
          </div>
        </a>

      </section>

      {/* z-10: クリーム幕②（兼 背景）下から上がってきて停止 → そのまま背景 */}
      <section className='aboutBg fixed inset-0 z-10' style={{ backgroundColor: '#FAF3E1' }} />

      <Scrollhint showScrollHint={showScrollHint} />
    </main>
  );
}

function Accent({ children, fontFamily = 'font-corporate-a italic' }: { children: React.ReactNode; fontFamily?: string }) {
  return (
    <span className='relative inline-block px-4'>
      <span className={`${fontFamily} font-semibold text-[#1d4ed8] z-1`}>{children}</span>
      <span className='rect absolute inset-0 bg-[#1d4ed8] origin-right scale-x-100 z-2' />
    </span>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className='paragraph text-center font-kozuka-gothic text-5xl leading-snug font-semibold text-[#FAF3E1]'>{children}</p>;
}

function Scrollhint({ showScrollHint }: { showScrollHint: boolean }) {
  return (
    <div
      className={`scrollHint fixed bottom-10 left-1/2 -translate-x-1/2 z-30 text-xs tracking-[0.4em] text-zinc-900 transition-opacity duration-700 ${
        showScrollHint ? 'opacity-60' : 'opacity-0'
      } pointer-events-none`}
    >
      SCROLL ↓
    </div>
  );
}

function makeBlob(randomness: number = 2): string {
  const path = blobs.svgPath({
    seed: Math.random().toString(),
    extraPoints: 4,
    randomness,
    size: 716,
  });
  let isX = true;
  return path.replace(/-?\d+(?:\.\d+)?/g, (num) => {
    const result = isX ? num : (parseFloat(num) * (445 / 716)).toFixed(3);
    isX = !isX;
    return result;
  });
}