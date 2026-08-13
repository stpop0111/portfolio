'use client';

// React
import { Suspense } from 'react';
// THREE
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, Preload } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
// コンポーネント
import { PC } from './Model';
import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing';

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
        orthographic camera={{ position: [0, -0.3, 2], zoom: 300 }}
        shadows='soft'
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        onCreated={({ camera, gl }) => { camera.lookAt(0, 0.06, 0); gl.outputColorSpace = THREE.SRGBColorSpace; gl.setPixelRatio(1); }}
      >

        <Environment resolution={512} background={false}>
          {/* 背景*/}
          <color attach='background' args={['#050505']} />

          {/* 主光源のソフトボックス：左手前・大きく縦長 */}
          <Lightformer form='rect' intensity={4.5} position={[-6, 2, 2.5]} rotation={[0, Math.PI / 2.6, 0]} scale={[6, 8, 1]} color='#ffffff' />
          {/* 天井のトップライト：上面をなだらかに起こす横長の板 */}
          <Lightformer form='rect' intensity={7} position={[-1, 7, 0.5]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 8, 1]} color='#f2f6ff' />

          {/* 右側のごく弱い板：影側が完全に潰れないための最小限の反射 */}
          <Lightformer form='rect' intensity={0.12} position={[5.5, 1, 2]} rotation={[0, -Math.PI / 2.6, 0]} scale={[5, 6, 1]} color='#9fb0c6' />

          {/* 背後のリム用ストリップ：エッジに細い光の線を作る */}
          <Lightformer form='rect' intensity={6} position={[3, 2.5, -5]} rotation={[0, Math.PI, 0]} scale={[0.6, 8, 1]} color='#ffffff' />
          <Lightformer form='rect' intensity={3} position={[-3.5, 2, -5]} rotation={[0, Math.PI, 0]} scale={[0.5, 7, 1]} color='#dfe8f5' />
        </Environment>

        <spotLight
          position={[-5, 4, 3.5]}
          angle={1.0}   
          penumbra={0.1}
          decay={2}
          distance={40}
          intensity={190}
          color='#ffffff'
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={35}
          shadow-bias={-0.0004}
          shadow-normalBias={0.015}
          shadow-radius={1}
        />

        <ambientLight intensity={0.02} />

        <Suspense fallback={null}>
          <PC groupRef={ref} hoveredKey={hoveredKey} onReady={onReady} />
          <ContactShadows position={[0, -1.5, 0]} opacity={0.7} scale={12} blur={1.6} far={4} resolution={512} color='#000000' />
          <Preload all />
        </Suspense>

        <EffectComposer>
          <N8AO aoRadius={0.35} intensity={2.4} distanceFalloff={0.8} quality='medium' color='#000000' />
          <Bloom intensity={0.1} luminanceThreshold={1} luminanceSmoothing={1} radius={0.1} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
