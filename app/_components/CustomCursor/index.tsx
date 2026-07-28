'use client';
// React
import { useRef, useEffect } from 'react';
// GSAP
import gsap from 'gsap';

export default function CustomCursor() {
  const cursorRef = useRef<SVGSVGElement>(null);
  const stretchRef = useRef<SVGGElement>(null);

  useEffect(() => {
    gsap.set(cursorRef.current, { xPercent: -50, yPercent: -50 });
    const xTo = gsap.quickTo(cursorRef.current, 'x', { duration: 0.4, ease: 'power3.out' });
    const yTo = gsap.quickTo(cursorRef.current, 'y', { duration: 0.4, ease: 'power3.out' });

    gsap.set(stretchRef.current, { transformOrigin: '50% 50%' });

    const stretch = { x: 1, y: 1 };
    let rafid = 0;

    function tick() {
      stretch.x += (1 - stretch.x) * 0.12;
      stretch.y += (1 - stretch.y) * 0.12;
      gsap.set(stretchRef.current, { scaleX: stretch.x, scaleY: stretch.y });

      rafid = requestAnimationFrame(tick);
    }

    rafid = requestAnimationFrame(tick);

    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let hasLast = false;

    const onMove = (e: MouseEvent) => {
      const t = performance.now();
      if (hasLast) {
        const dt = t - lastT;
        // マウスが何ピクセル動いたか
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const dist = Math.hypot(dx, dy);
        const speed = dist / dt;
        const speedNorm = Math.min(speed / 2.5, 1);

        if (dist > 1) {
          const horizontal = Math.abs(dx) >= Math.abs(dy) * 1.4;

          if (horizontal) {
            stretch.x = 1 + speedNorm * 0.55;
            stretch.y = 1 - speedNorm * 0.28;
          } else {
            stretch.x = 1 - speedNorm * 0.28;
            stretch.y = 1 + speedNorm * 0.55;
          }
        }
      }
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = t;
      hasLast = true;
      xTo(e.clientX);
      yTo(e.clientY);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafid);
    };
  }, []);

  return (
    <svg
      ref={cursorRef}
      viewBox='0 0 100 100'
      className='fixed top-0 left-0 w-8 h-8 pointer-events-none z-9999 overflow-visible mix-blend-difference'
    >
      <g ref={stretchRef}>
        <circle
          cx='50'
          cy='50'
          r='40'
          fill='none'
          stroke='#fff'
          strokeWidth={1.5}
          vectorEffect='non-scaling-stroke'
        ></circle>
      </g>
    </svg>
  );
}
