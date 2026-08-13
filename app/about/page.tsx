'use client';
// React
import { useRef, useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
// Lenis
import { useLenis } from 'lenis/react';
// コンポーネント(描画)
import CanvasTitle from '../_components/CanvasTitle';
import Curtains from '../_components/Curtains/Curtains';
// 機能性
import useResetScrollPosition from '../_utils/useResetScrollPosition';
import useScrollLocker from '../_utils/useScrollLocker'
// ページ固有（AboutMe）
import ContactMe from './_components/ContactMe';
import Scrollhint from './_components/ScrollHint';
import { Accent } from './_components/ParagraphStyle';
import { Paragraph } from './_components/ParagraphStyle';
import { curtainPalettes } from '../_components/Curtains/curtainPalettes';

function PageInner() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  return <About from={from}/>;
}

export default function Page() {
  return (
    <Suspense fallback={<div className='fixed inset-0 bg-[#FAF3E1] z-9999' />}>
      <PageInner />
    </Suspense>
  );
}

function About({ from }: { from: string | null}) {
  const canvasTitleRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'curtain' | 'title'>(from === 'home' ? 'curtain' : 'title');
  const [showEntryCurtain, setShowEntryCurtain] = useState(from === 'home');
  const [showCurtain, setShowCurtain] = useState<boolean>(false);
  const [scrollLocked, setScrollLocked] = useState<boolean>(true);
  const [showHint, setShowHint] = useState<boolean>(false);
  const router = useRouter();
  const lenis = useLenis();
  useResetScrollPosition(lenis); // ページのマウント時に毎回スクロール位置をリセット
  useScrollLocker(lenis, scrollLocked); // スクロール制御するためにcss＋lenisをリセット

  // 4秒停止後、スクロールヒントを表示＋スクロールロックの解除
  // ---------------------------
  useEffect(() => {
    if (phase !== 'title') return;
    const timer = setTimeout(() => {
      setScrollLocked(false);
      setShowHint(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [phase]);
  // ---------------------------
  
  return (
    <main>
      {/* カーテン遷移（Homeから） */}
      <Curtains show={showEntryCurtain} anchor='top' motion='exit' colors={curtainPalettes.zinc} onComplete={() => {setShowEntryCurtain(false); setPhase('title')}} /> 
      {/* カーテン遷移（Homeへ） */}
      <Curtains show={showCurtain} anchor='top' motion='enter' colors={curtainPalettes.zinc} onComplete={() => router.push('/?from=about')} /> 
      {/* 3Dタイトル */}
      <section className='titleSection h-[200vh] pointer-events-none'>
        <CanvasTitle bgColor='#FAF3E1' wrapperPreset='sub' ref={canvasTitleRef} phase={phase} modelPath='/models/model__letter-a.glb' modelName='letter_a' modelPosition={[-2.8, 0, 0]} postText={{ text: 'Bout Me', position: [-1.9, 0, -0.5], anchorX: 'left', textColor: '#222' }} shrinkMoveAnim={{ type: 'scrub', triggerSelector: '.titleSection', bgTarget: '.aboutBg', bgColorOnLeave: '#222', bgColorOnEnterBack: '#FAF3E1', textColorOnLeave: '#FAF3E1', textColorOnEnterBack: '#222', transmissionColorOnLeave: '#222', transmissionColorOnEnterBack: '#FAF3E1', }} />
      </section> 
      {/* スクロールヒント */}
      <Scrollhint show={showHint} /> 

      {/* 背景 */}
      <section className='aboutBg fixed inset-0 z-10' style={{ backgroundColor: '#FAF3E1' }} />

      {/* パララックステキスト */}
      <section className='aboutContent relative z-20'>
        <div className='introBlock space-y-[20vh]'>
          <div>
            <Paragraph>こんにちは、<Accent>Seita</Accent>です。</Paragraph>
            <Paragraph>Webの仕事に</Paragraph>
            <Paragraph>小さく挑戦している</Paragraph>
            <Paragraph><Accent>Junior Web Developer</Accent>です。</Paragraph>
          </div>

          <div>
            <Paragraph>電子工業科で<Accent>C</Accent>や<Accent>Python</Accent>に触れ、</Paragraph>
            <Paragraph>国際教養学部で言葉を学び、</Paragraph>
            <Paragraph>今はコードに戻ってきました。</Paragraph>
          </div>

          <div>
            <Paragraph><Accent fontFamily='font-kozuka-mincho'>小さなチームのリード</Accent>として、</Paragraph>
            <Paragraph><Accent fontFamily='font-kozuka-mincho'>ECサイト</Accent>の企画から実装まで、</Paragraph>
            <Paragraph>ひとつの頭で考えています。</Paragraph>
          </div>

          <div>
            <Paragraph>企画もデザインも、</Paragraph>
            <Paragraph>コードも分析も、</Paragraph>
            <Paragraph>すべて<Accent fontFamily='font-kozuka-mincho'>地続き</Accent>の仕事として。</Paragraph>
          </div>

          <div>
            <Paragraph>つくるものは、</Paragraph>
            <Paragraph>次に触る誰かにも、</Paragraph>
            <Paragraph><Accent fontFamily='font-kozuka-mincho'>やさしくありたい</Accent>。</Paragraph>
          </div>

          <div>
            <Paragraph>ひとりでできることを増やすことより、</Paragraph>
            <Paragraph><Accent fontFamily='font-kozuka-mincho'>チーム</Accent>でできることを増やす方が、</Paragraph>
            <Paragraph>わたしは好きです。</Paragraph>
          </div>

          <div>
            <Paragraph>いつも<Accent fontFamily='font-kozuka-mincho'>好奇心</Accent>を持って、</Paragraph>
            <Paragraph>いつも<Accent fontFamily='font-kozuka-mincho'>学び</Accent>ながら、</Paragraph>
            <Paragraph>いつも、<Accent fontFamily='font-kozuka-mincho'>細部</Accent>に。</Paragraph>
          </div>
        </div>
      </section>
      <ContactMe onScrollComplete={() => setShowCurtain(true)} />
    </main>
  );
}
