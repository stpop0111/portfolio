import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Suspense } from 'react';
import { TitleScene } from './Model';

export function CanvasTitle({ phase, ref }: { phase: string; ref?: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={ref} className='fixed w-full h-[30vh] z-50 pointer-events-auto'>
      <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 100 }}>
        <Suspense fallback={null}>
          <Environment preset='studio' environmentIntensity={1} />
          <ambientLight intensity={0.5} />
          <TitleScene phase={phase} />
        </Suspense>
      </Canvas>
    </div>
  );
}
