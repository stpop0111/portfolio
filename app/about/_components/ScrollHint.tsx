'use client';

import { useEffect, useState } from 'react';

type ScrollHintProps = {
  show: boolean; 
  hideAfter?: number;
};

export default function ScrollHint({ show, hideAfter = 50 }: ScrollHintProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!show) return;
    const onScroll = () => {
      if (window.scrollY > hideAfter) setScrolled(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [show, hideAfter]);

  const visible = show && !scrolled;

  return (
    <div
      className={`scrollHint fixed bottom-10 left-1/2 -translate-x-1/2 z-30 text-xs tracking-[0.4em] text-zinc-900 transition-opacity duration-700 ${
        visible ? 'opacity-60' : 'opacity-0'
      } pointer-events-none`}
    >
      SCROLL ↓
    </div>
  );
}