import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

export function Accent({
  children,
  fontFamily = 'font-corporate-a italic',
}: {
  children: React.ReactNode;
  fontFamily?: string;
}) {
  /* 表示アニメーション
  --------------------------- */
  useGSAP(() => {
    gsap.utils.toArray<HTMLElement>('.rect').forEach((r) => {
      gsap.to(r, { scaleX: 0, ease: 'power3.inOut', duration: 0.4, scrollTrigger: { trigger: r, start: 'top 80%' } });
    });
  }, []);
  /* ----- 表示アニメーション ----- */
  return (
    <span className='relative inline-block px-4'>
      <span className={`${fontFamily} font-semibold text-[#1d4ed8] z-1`}>{children}</span>
      <span className='rect absolute inset-0 bg-[#1d4ed8] origin-right scale-x-100 z-2' />
    </span>
  );
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  /* 表示アニメーション
  --------------------------- */
  useGSAP(() => {
    gsap.utils.toArray<HTMLElement>('.paragraph').forEach((p) => {
      gsap.fromTo( p,
        { scale: 0.6, opacity: 0.2 },
        { scale: 1, opacity: 1, scrollTrigger: { trigger: p, start: 'top bottom', end: 'top 50%', scrub: true } },
      );
    });
  }, []);
  /* ----- 表示アニメーション ----- */
  return (
    <p className='paragraph text-center font-kozuka-gothic text-5xl leading-snug font-semibold text-[#FAF3E1]'>
      {children}
    </p>
  );
}