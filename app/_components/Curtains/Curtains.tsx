'use client';

import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useId } from 'react';

type CurtainsProps = {
  show: boolean;
  colors: string[];
  anchor?: 'top' | 'bottom';
  motion?: 'enter' | 'exit' | 'none';
  onComplete?: () => void;
  baseZIndex?: number;
};

export default function Curtains({
  show,
  colors,
  anchor = 'top',
  motion = 'enter',
  onComplete,
  baseZIndex = 90,
}: CurtainsProps) {
  const id = useId();
  const curtainClass = `curtain${id.replace(/:/g, '_')}`;
  useGSAP(() => {
    if (!show) return;
    if (motion === 'none') return;

    const offscreen = anchor === 'top' ? '-100%' : '100%';
    const onscreen = '0%';
    const from = motion === 'enter' ? { y: offscreen } : { y: onscreen };
    const to = motion === 'enter' ? { y: onscreen } : { y: offscreen };

    gsap.fromTo(`.${curtainClass}`, from, 
      { ...to, duration: 1.6, stagger: motion === 'enter' ? { each: 0.1, from: 'end' } : 0.08, ease: 'power2.inOut', onComplete: () => onComplete?.(), });
  }, { dependencies: [show, motion] },
  );

  if (!show) return null;
  const positionClass = anchor === 'top' ? 'top-0' : 'bottom-0';

  return (
    <>
      {colors.map((cls, i) => {
        const depth = 6 + i * 3;
        const radius = `50% ${depth}vw`;
        const radiusStyle =
          anchor === 'top'
            ? { borderBottomLeftRadius: radius, borderBottomRightRadius: radius }
            : { borderTopLeftRadius: radius, borderTopRightRadius: radius };
        return (
          <div
            key={i}
            className={`${cls} ${curtainClass} fixed inset-x-0 ${positionClass} h-[140vh]`}
            style={{ zIndex: baseZIndex - i, ...radiusStyle }}
          />
        );
      })}
    </>
  );
}
