import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Suspense } from 'react';
import { TitleScene } from './Model';

export function CanvasTitle({ phase, ref }: { phase: string; ref?: React.RefObject<HTMLDivElement | null> }) {
  
  return (
    <div ref={ref} className='fixed inset-0 flex items-center justify-center z-92'>
      <div className="w-full h-[40vh]">
        <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 100 }}>
          <Suspense fallback={null}>
            <Environment preset='studio' environmentIntensity={1} />
            <ambientLight intensity={0.5} />
            <TitleScene phase={phase} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}