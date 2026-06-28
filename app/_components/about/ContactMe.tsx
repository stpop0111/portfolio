'use client';

// GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
gsap.registerPlugin(ScrollTrigger, MorphSVGPlugin);
// その他
import * as blobs from 'blobs/v2';
import { useRef, useState, useEffect } from 'react';
import { useLenis } from 'lenis/react';
import SplitText from '../splitText';

export default function ContactMe({ onScrollComplete }: {onScrollComplete: () => void}) {

  const contactBlobRef = useRef<SVGPathElement>(null);
  const [endBlobAnimation, setEndBlobAnimation] = useState<boolean>(false);
  const lenis = useLenis();

  /* Lenis のスクロールを ScrollTrigger に同期 */
  useEffect(() => {
    if (!lenis) return;
    lenis.on('scroll', ScrollTrigger.update);
    return () => {
      lenis.off('scroll', ScrollTrigger.update);
    };
  }, [lenis]);

  /* contactSection の高さ変更を Lenis / ScrollTrigger に反映（次フレームで） */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      lenis?.resize();
      ScrollTrigger.refresh();
    });
    return () => cancelAnimationFrame(id);
  }, [endBlobAnimation, lenis]);

  /* 1. エントランス：blob + テキストが一度だけ表示される */
  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.contactSection',
        start: 'top 40%',
      },
      onComplete: () => setEndBlobAnimation(true),
    });

    tl.fromTo(
      contactBlobRef.current,
      { scale: 0, opacity: 0, transformOrigin: 'center center' },
      { scale: 1, opacity: 1, duration: 1, transformOrigin: 'center center', ease: 'power4.inOut' },
    ).fromTo(
      '.contactText',
      { y: '-100%' },
      { y: 0, duration: 0.4, stagger: { amount: 1.2 }, ease: 'power2.out' }, '-=0.5' );
  }, []);

  /* 2. 拡大 scrub：表示後 300vh で scale 1 → 3 */
  useGSAP(() => {
    gsap.fromTo(
      contactBlobRef.current,
      { scale: 1, transformOrigin: 'center center' }, // 明示的に from: 1
      {
        scale: 4,
        transformOrigin: 'center center',
        ease: 'none',
        scrollTrigger: {
          trigger: '.contactSection',
          start: '1% top', // sticky engage 時から
          end: 'bottom bottom', // 300vh の scrub
          scrub: true,
        },
      },
    );
  }, []);

  useGSAP(() => {
  if (!endBlobAnimation) return;
  
  ScrollTrigger.create({
    trigger: '.contactSection',
    start: 'bottom-=50 bottom',
    onEnter: () => onScrollComplete(),
  });
}, { dependencies: [endBlobAnimation] });

  
  /* Blob のうねうねモーフィング */
  const BASE_PATH = 'M363.275 0.0130943C455.847 0.699279 540.394 29.6867 605.639 71.3936C670.645 112.948 720.327 166.798 715.701 225.297C711.243 281.669 645.908 324.953 582.461 364.483C519.853 403.49 450.91 442.558 363.275 444.871C272.785 447.259 190.679 416.207 125.082 376.553C57.565 335.738 1.95118 284.48 0.054691 225.297C-1.87345 165.127 47.387 109.81 115.187 67.7581C182.131 26.2362 269.702 -0.680518 363.275 0.0130943Z';
  const makeBlob = (randomness: number = 2): string => {
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
  };

  // アニメーション（流体オブジェクトのうねうね）
  useGSAP(() => {
    const variations = Array.from({ length: 5 }, () => makeBlob(1));
    const tl = gsap.timeline({ repeat: -1 });
    variations.forEach((variant) => {
      tl.to(contactBlobRef.current, { morphSVG: variant, duration: 2, ease: 'sine.inOut' });
    });
    tl.to(contactBlobRef.current, { morphSVG: BASE_PATH, duration: 4, ease: 'sine.inOut' });
  }, []);

  return (
    <section className={`contactSection relative z-60 ${endBlobAnimation ? 'h-[300vh]' : 'h-screen'}`}>
      <div className='sticky top-0 h-screen flex items-center justify-center'>
        <a href='mailto:stpop0111@gmail.com' className='flex items-center justify-center group'>
          <svg viewBox='0 0 716 445' className='absolute w-[80vw] max-w-180 h-auto overflow-visible'>
            <path ref={contactBlobRef} id='contactBlob' d={BASE_PATH} fill='#C4C4C4' />
          </svg>
          {/* テキストオーバーレイ */}
          <div className='relative z-10 text-center px-12'>
            <div>
              <p className='overflow-hidden text-zinc-600 text-2xl font-futura'>
                <SplitText text='I wanna join your work with you' className='contactText' />
              </p>
              <h2 className='overflow-hidden text-zinc-900 text-3xl font-kozuka-gothic font-semibold'>
                <SplitText text='あなたのお仕事にご協力させてください' className='contactText' />
              </h2>
            </div>
            <p className='font-seasons overflow-hidden text-base text-zinc-900 mt-3 group-hover:underline'>
              <SplitText text='(send me mail)' className='contactText' />
            </p>
          </div>
        </a>
      </div>
    </section>
  );
}
