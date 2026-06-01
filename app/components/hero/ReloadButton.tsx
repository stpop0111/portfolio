'use client';

import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import gsap from 'gsap';

export function ReloadButton() {
  /* ホバー時に矢印回転 */
  const iconRef = useRef<SVGSVGElement>(null);
  const handleHover = () => {
    gsap.to(iconRef.current, { rotation: '+=180', duration: 0.5, ease: 'power4.inOut' });
  };

  const buttonRef = useRef<HTMLButtonElement>(null);

  useGSAP(() => {
    gsap.set(buttonRef.current, { y: 20 });
    gsap.to(buttonRef.current, {
      y: 0,
      duration: 1,
      ease: 'bounce.out',
    });
  }, []);

  return (
    <button
      onClick={() => window.location.reload()}
      className='cursor-pointer bg-zinc-50 px-4 py-2 text-zinc-800 rounded-xl flex items-center gap-2 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-500 ease-in-out'
      onMouseEnter={handleHover}
      onMouseLeave={handleHover}
      ref={buttonRef}
    >
      Reload <RefreshCw ref={iconRef} className='w-4 h-4' />
    </button>
  );
}
