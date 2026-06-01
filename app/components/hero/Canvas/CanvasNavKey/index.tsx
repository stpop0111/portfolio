'use client';

import { Canvas } from '@react-three/fiber';
import { KeyCap } from './Keycap';
import { Suspense } from 'react';
import { Environment } from '@react-three/drei';

type KeyCapType = { label: string; x: number; color: string; textColor: string };

export function CanvasNavKey({
  ref,
  keyCaps,
}: {
  ref?: React.RefObject<HTMLDivElement | null>;
  keyCaps: KeyCapType[];
}) {
  return (
    <div ref={ref} className='fixed bottom-0 w-full h-[30vh] z-45 pointer-events-auto'>
      <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 100 }}>
        <Suspense fallback={null}>
          <Environment preset='studio' />
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          {keyCaps.map((keyCap, i) => (
            <KeyCap key={i} keyCap={keyCap} />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}

export type { KeyCapType };
