'use client';

import { Canvas } from '@react-three/fiber';
import { KeyCap } from './Model';
import { Suspense } from 'react';
import { Environment, Lightformer, Preload } from '@react-three/drei';
type KeyCapType = { label: string; x: number; path: string;};

export function CanvasNavKey({ ref, keyCaps, onKeyCapClick, onKeyCapHover, phase }: {
  ref?: React.RefObject<HTMLDivElement | null>;
  keyCaps: KeyCapType[];
  onKeyCapClick: (path: string) => void;
  onKeyCapHover: (label: string | null) => void;
  phase: string;
}) {
  return (
    <div ref={ref} className='fixed bottom-0 w-full h-[30vh] z-45 pointer-events-auto'>
      <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 100 }} dpr={1}>
        <Suspense fallback={null}>

          <Environment resolution={256}>
            <Lightformer form='rect' intensity={6} position={[0, 4, 3]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 3, 1]} color='#ffffff' />
            <Lightformer form='rect' intensity={4} position={[-5, 1, 2]} rotation={[0, Math.PI / 2, 0]} scale={[4, 5, 1]} color='#ffffff' />
            <Lightformer form='rect' intensity={3} position={[5, 1, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 5, 1]} color='#e8eef7' />
            <Lightformer form='rect' intensity={2.5} position={[0, 0.5, -5]} rotation={[0, Math.PI, 0]} scale={[10, 4, 1]} color='#ffffff' />
          </Environment>

          <ambientLight intensity={0.25} />
          {keyCaps.map((keyCap, i) => (
            <KeyCap key={i} keyCap={keyCap} onClick={onKeyCapClick} onHover={onKeyCapHover} phase={phase} />
          ))}
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}

export type { KeyCapType };
