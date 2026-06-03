'use client';

// THREE
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import type { Group } from 'three';
// コンポーネント
import { PC } from './Model';
import { Bloom, EffectComposer, N8AO} from '@react-three/postprocessing';

export function CanvasPC({ 
  ref,
  hoveredKey
}: { 
  ref?: React.RefObject<Group | null>;
  hoveredKey: string | null
}) {
  return (
    <div className='fixed inset-0 z-30 pointer-events-none'>
      <Canvas
        orthographic
        camera={{ position: [3, -0.4, 3], zoom: 400 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}
        shadows='soft'
      >
        {/* 環境光（控えめに） */}
        <Environment preset='studio' environmentIntensity={0.2} />


        {/* メインライト（影あり） */}
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

        <PC groupRef={ref} hoveredKey={hoveredKey} />

        {/* Postprocessing（Bloom 弱め） */}
        <EffectComposer>
          <N8AO aoRadius={2} distanceFalloff={1} intensity={5} quality='medium' />
          <Bloom intensity={0.8} luminanceThreshold={0.1} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
