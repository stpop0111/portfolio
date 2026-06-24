'use client';

// THREE
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Suspense, useRef } from 'react';
import { type Group } from 'three';
// GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
// コンポーネント
import { TitleScene } from './Model';
import type { TitleSceneProps } from './Model';

/** -------------------------------------------------
  型定義
------------------------------------------------- **/
// 共通パラメータ
type CommonAnimParams = {
  scaleTarget?: number;
  yTarget?: string;
  ease?: string;
};

// パターン1: phase 自動
type AutoAnimConfig = CommonAnimParams & {
  type: 'auto';
  triggerPhase: string;
  duration?: number;
};

// パターン2: scroll scrub
type ScrubAnimConfig = CommonAnimParams & {
  type: 'scrub';
  triggerSelector: string;
  start?: string;
  end?: string;
  onLeave?: () => void;
  onEnterBack?: () => void;
};

// Union
type ShrinkMoveConfig = AutoAnimConfig | ScrubAnimConfig;

/* タイトルシーンのプロップスを受け取る */
type CanvasTitleProps = TitleSceneProps & {
  ref?: React.RefObject<HTMLDivElement | null>;
  shrinkMoveAnim?: ShrinkMoveConfig;
};

/** ------------------------ 型定義 ------------------------ **/

export function CanvasTitle({ 
  ref: wrapperRef,
  shrinkMoveAnim,
  ...sceneProps }
  : CanvasTitleProps) {
  const { skipIntro = false } = sceneProps;
  const groupRef = useRef<Group>(null);

  /* 縮小+移動 アニメ */
  useGSAP( () => {
      if (!shrinkMoveAnim) return;

      const scale = shrinkMoveAnim.scaleTarget ?? 0.5;
      const y = shrinkMoveAnim.yTarget ?? '-40vh';
      const ease = shrinkMoveAnim.ease ?? 'power2.inOut';

      if (shrinkMoveAnim.type === 'auto') {
        // phase 自動再生
        if (sceneProps.phase === shrinkMoveAnim.triggerPhase) {
          const duration = shrinkMoveAnim.duration ?? 1.2;
          gsap.to(wrapperRef?.current, { y, duration, ease });
          if (groupRef.current) {
            gsap.to(groupRef.current.scale, { x: scale, y: scale, z: scale, duration, ease });
          }
        }
      } else {
        // scroll scrub
        const config = {
          trigger: shrinkMoveAnim.triggerSelector,
          start: shrinkMoveAnim.start ?? 'top top',
          end: shrinkMoveAnim.end ?? '60% top',
          scrub: true,
          onLeave: shrinkMoveAnim.onLeave,
          onEnterBack: shrinkMoveAnim.onEnterBack,
        };
        gsap.to(wrapperRef?.current, { y, ease, scrollTrigger: config });
        if (groupRef.current) {
          gsap.to(groupRef.current.scale, {
            x: scale,
            y: scale,
            z: scale,
            ease,
            scrollTrigger: config,
          });
        }
      }
    },
    { dependencies: [shrinkMoveAnim, sceneProps.phase] },
  );
  return (
    <div ref={wrapperRef} className={`fixed w-full h-[30vh] ${skipIntro ? 'z-80' : 'z-92'} pointer-events-auto`}>
      <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 100 }}>
        <Suspense fallback={null}>
          <Environment preset='warehouse' environmentIntensity={2} />
          <ambientLight intensity={0.5} />
          <TitleScene {...sceneProps} groupRef={groupRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}
