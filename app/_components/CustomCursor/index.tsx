'use client';
// React
import { useRef, useEffect } from 'react';
// GSAP
import gsap from 'gsap';

const STRETCH_SPEED_REF = 2.5; // px/ms これくらいで最大まで伸びる

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const stretchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cursorRef.current || !stretchRef.current) return;
    gsap.set(cursorRef.current, { xPercent: -50, yPercent: -50 });
    // 原点を進行方向側(前寄り)に置き、伸びた時に後ろへ引っ張られているように見せる
    gsap.set(stretchRef.current, { transformOrigin: '65% 50%' });
    const xTo = gsap.quickTo(cursorRef.current, 'x', { duration: 0.4, ease: 'power3.out' });
    const yTo = gsap.quickTo(cursorRef.current, 'y', { duration: 0.4, ease: 'power3.out' });
    const rotTo = gsap.quickTo(stretchRef.current, 'rotation', { duration: 0.25, ease: 'power2.out' });

    // 移動方向への伸び縮み(常時rAFで1に向かって戻り続け、動くたびに引っ張る)
    const stretch = { x: 1, y: 1 };
    let stretchRaf = 0;
    function tickStretch() {
      stretch.x += (1 - stretch.x) * 0.12;
      stretch.y += (1 - stretch.y) * 0.12;
      gsap.set(stretchRef.current, { scaleX: stretch.x, scaleY: stretch.y });
      stretchRaf = requestAnimationFrame(tickStretch);
    }
    stretchRaf = requestAnimationFrame(tickStretch);

    let lastX = 0, lastY = 0, lastT = 0, hasLast = false;

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);

      const now = performance.now();
      if (hasLast) {
        const dt = Math.max(now - lastT, 1);
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const dist = Math.hypot(dx, dy);
        const speed = dist / dt;
        const speedNorm = Math.min(speed / STRETCH_SPEED_REF, 1);

        if (dist > 0.5) {
          rotTo((Math.atan2(dy, dx) * 180) / Math.PI);
          stretch.x = 1 + speedNorm * 0.55;
          stretch.y = 1 - speedNorm * 0.28;
        }
      }
      lastX = e.clientX; lastY = e.clientY; lastT = now; hasLast = true;
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(stretchRaf);
    };
  }, [cursorRef]);

  return (
    // backdrop-filterを使うためSVGではなくdivで描く(グラスモーフィズム)
    <div ref={cursorRef} className='fixed top-0 left-0 w-8 h-8 pointer-events-none z-9999'>
      <div
        ref={stretchRef}
        className='h-full w-full rounded-full'
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        }}
      />
    </div>
  );
}
