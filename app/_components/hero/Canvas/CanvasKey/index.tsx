'use client';

import { Canvas } from '@react-three/fiber';
import { KeyCap } from './Model';
import { Suspense } from 'react';
import { Environment, Preload } from '@react-three/drei';
import type { ThemeName } from '../../../Curtains/curtainPalettes'; 

type KeyCapType = { label: string; x: number; color: string; textColor: string; path: string; theme: ThemeName; };

export function CanvasNavKey({
  ref,
  keyCaps,
  onKeyCapClick,
  onKeyCapHover,
}: {
  ref?: React.RefObject<HTMLDivElement | null>;
  keyCaps: KeyCapType[];
  onKeyCapClick: (path: string, theme: ThemeName) => void;   
  onKeyCapHover: (label: string | null) => void;
}) {
  return (
    <div ref={ref} className='fixed bottom-0 w-full h-[30vh] z-45 pointer-events-auto'>
      <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 100 }}>
        <Suspense fallback={null}>
          <Environment preset='studio' environmentIntensity={1} />
          <ambientLight intensity={0.5} />
          {keyCaps.map((keyCap, i) => (
            <KeyCap key={i} keyCap={keyCap} onClick={onKeyCapClick} onHover={onKeyCapHover} />
          ))}
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}

export type { KeyCapType };
