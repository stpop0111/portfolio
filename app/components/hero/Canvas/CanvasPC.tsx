'use client';

import { Canvas } from '@react-three/fiber';
import type { Mesh } from 'three';

export function CanvasPC({ ref }: { ref?: React.RefObject<Mesh | null> }) {
  return (
    <div className='fixed inset-0 z-30 pointer-events-none'>
      <Canvas
        orthographic
        camera={{ position: [3, -0.2, 3], zoom: 420 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.2, 0)}
      >
        <ambientLight intensity={0.5}/>
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <mesh ref={ref} position={[0, 0, 0]}>
          <boxGeometry args={[1, 1, 1]}/>
          <meshStandardMaterial color="#888"/>
        </mesh>
      </Canvas>
    </div>
  );
}