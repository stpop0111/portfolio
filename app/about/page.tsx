'use client';
// GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
gsap.registerPlugin(ScrollTrigger, MorphSVGPlugin);
// React
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Lenis
import { useLenis } from 'lenis/react';
// コンポーネント
import CanvasTitle from '../_components/CanvasTitle';
import Curtains from '../_components/Curtains';
import ResetScrollPosition from "../_components/utilities/ResetScrollPosition";
import ContactMe from '../_components/about/ContactMe';
import Scrollhint from '../_components/about/ScrollHint';
import { Accent } from '../_components/about/ParagraphStyle';
import { Paragraph } from '../_components/about/ParagraphStyle';

export default function About() {
  // ----- 入場カーテン用の state -----
  const [fromHome, setFromHome] = useState(false);
  const [showEntryCurtain, setShowEntryCurtain] = useState(true);

  // URL チェック
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('from') !== 'home') { setShowEntryCurtain(false); }
    setFromHome(params.get('from') === 'home');
  }, []);

  const [phase, setPhase] = useState<'curtain' | 'title' | 'reveal'>('curtain');
  const [showCurtain, setShowCurtain] = useState<boolean>(false);
  const router = useRouter();
  const lenis = useLenis();
  ResetScrollPosition(lenis);
  

  const [scrollLocked, setScrollLocked] = useState<boolean>(true);
  const [showHint, setShowHint] = useState<boolean>(false)
  useEffect(() => {
    if (phase !== 'title') return;
    const timer = setTimeout(() => {
      setScrollLocked(false);
      setShowHint(true)
    }, 4000);
    return () => clearTimeout(timer);
  }, [phase]);

  /* lenisのスクロール制御&CSSにてネイティブスクロールの制御 */
  useEffect(() => {
    if (!lenis) return;
    if (scrollLocked) { lenis.stop(); } 
    else { lenis.start(); }
    document.body.style.overflow = scrollLocked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lenis, scrollLocked]);

  /* タイトルのアニメーション */
  const canvasTitleRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.set('.aboutBg', { y: '100%' });
    const tl = gsap.timeline({ onComplete: () => setPhase('title') });
    tl.to('.aboutBg', { y: '0%', duration: 1.4, ease: 'power2.inOut' });
  }, []);

  return (
    <main>
      <Curtains
        show={showEntryCurtain} anchor='top' motion='exit'
        onComplete={() => setShowEntryCurtain(false)}
        colors={['bg-aboutMe-800', 'bg-aboutMe-700', 'bg-aboutMe-600', 'bg-aboutMe-500', 'bg-aboutMe-400', 'bg-aboutMe-300']}
      />
      <section className='titleSection h-[200vh] pointer-events-none'>
        <CanvasTitle
          wrapperPreset='sub'
          ref={canvasTitleRef}
          phase={phase}
          modelPath='/models/model__letter-a.glb'
          modelName='letter_a'
          modelPosition={[-2.8, 0, 0]}
          postText={{
            text: 'Bout Me',
            position: [-1.9, 0, -0.5],
            anchorX: 'left',
            textColor: '#222',
          }}
          bgColor='#FAF3E1'
          shrinkMoveAnim={{
            type: 'scrub',
            triggerSelector: '.titleSection',
            bgTarget: '.aboutBg',
            bgColorOnLeave: '#222',
            bgColorOnEnterBack: '#FAF3E1',
            textColorOnLeave: '#FAF3E1',
            textColorOnEnterBack: '#222',
            transmissionColorOnLeave: '#222',
            transmissionColorOnEnterBack: '#FAF3E1',
          }}
        />
      </section>

      {/* z-auto: スクロール用コンテンツ */}
      <section className='aboutContent relative z-20'>
        <div className='introBlock space-y-[20vh]'>
          {/* セクション1: 自己紹介 */}
          <div className=''>
            <Paragraph>
              こんにちは、<Accent>Seita</Accent>です。
            </Paragraph>
            <Paragraph>Webの仕事に</Paragraph>
            <Paragraph>小さく挑戦している</Paragraph>
            <Paragraph>
              <Accent>Junior Web Developer</Accent>です。
            </Paragraph>
          </div>

          {/* セクション2: バックグラウンド */}
          <div className=''>
            <Paragraph>
              電子工業科で<Accent>C</Accent>や<Accent>Python</Accent>に触れ、
            </Paragraph>
            <Paragraph>国際教養学部で言葉を学び、</Paragraph>
            <Paragraph>今はコードに戻ってきました。</Paragraph>
          </div>

          {/* セクション3: 現在のロール */}
          <div className=''>
            <Paragraph>
              <Accent fontFamily='font-kozuka-mincho'>小さなチームのリード</Accent>として、
            </Paragraph>
            <Paragraph>
              <Accent fontFamily='font-kozuka-mincho'>ECサイト</Accent>の企画から実装まで、
            </Paragraph>
            <Paragraph>ひとつの頭で考えています。</Paragraph>
          </div>

          {/* セクション4: 仕事観 */}
          <div className=''>
            <Paragraph>企画もデザインも、</Paragraph>
            <Paragraph>コードも分析も、</Paragraph>
            <Paragraph>
              すべて<Accent fontFamily='font-kozuka-mincho'>地続き</Accent>の仕事として。
            </Paragraph>
          </div>

          {/* セクション5: 制作哲学 */}
          <div className=''>
            <Paragraph>つくるものは、</Paragraph>
            <Paragraph>次に触る誰かにも、</Paragraph>
            <Paragraph>
              <Accent fontFamily='font-kozuka-mincho'>やさしくありたい</Accent>。
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

      <ContactMe onScrollComplete={() => setShowCurtain(true)}/>

      <Curtains
        show={showCurtain}
        colors={['bg-zinc-700', 'bg-zinc-600', 'bg-zinc-500', 'bg-zinc-400', 'bg-zinc-300', 'bg-zinc-200']}
        anchor='top'
        motion='enter'
        onComplete={() => router.push('/?from=about')}
      />

      <section className='aboutBg fixed inset-0 z-10' style={{ backgroundColor: '#FAF3E1' }} />

      <Scrollhint show={showHint}/>
    </main>
  );
}



