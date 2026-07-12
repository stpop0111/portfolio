'use client';

// React
import { Suspense } from 'react';
// THREE
import { Canvas } from '@react-three/fiber';
import { Environment, Preload } from '@react-three/drei';
import type { Group } from 'three';
// コンポーネント
import { PC } from './Model';
import { Bloom, EffectComposer } from '@react-three/postprocessing';

export function CanvasPC({
  ref,
  hoveredKey,
  onReady
}: {
  ref?: React.RefObject<Group | null>;
  hoveredKey: string | null;
  onReady?: () => void;
}) {
  return (
    <div className='fixed inset-0 z-30 pointer-events-none'>
      <Canvas
        orthographic
        camera={{ position: [3, -0.4, 3], zoom: 400 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}
        shadows='soft'
      >
        {/* 環境光 */}
        <Environment preset='studio' environmentIntensity={0.2} />

        {/* メインライト */}
        <directionalLight
          position={[0, 8, 6]}
          intensity={1.8}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
          shadow-camera-near={0.1}
          shadow-camera-far={50}
        />

        <Suspense fallback={null}>
          <PC groupRef={ref} hoveredKey={hoveredKey} onReady={onReady} />
          <Preload all />
        </Suspense>

        <EffectComposer>
          <Bloom intensity={0.8} luminanceThreshold={1}   radius={0.4} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
