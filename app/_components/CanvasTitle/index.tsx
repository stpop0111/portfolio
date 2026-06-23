import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Suspense } from 'react';
import { TitleScene } from './Model';

export function CanvasTitle({
  phase,
  ref,
  skipIntro = false,
}: {
  phase: string;
  ref?: React.RefObject<HTMLDivElement | null>;
  skipIntro?: boolean;
}) {
  // 重ね順の出し分け：
  // - 通常ロード（skipIntro=false）: カーテン(zIndex 90)より上 → z-92
  // - About から復帰（skipIntro=true）: カーテンの下 → z-80（カーテンアップで奥から現れる）
  return (
    <div ref={ref} className={`fixed w-full h-[30vh] ${skipIntro ? 'z-80' : 'z-92'} pointer-events-auto`}>
      <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 100 }}>
        <Suspense fallback={null}>
          <Environment preset='warehouse' environmentIntensity={2} />
          <ambientLight intensity={0.5} />
          <TitleScene phase={phase} skipIntro={skipIntro} />
        </Suspense>
      </Canvas>
    </div>
  );
}
