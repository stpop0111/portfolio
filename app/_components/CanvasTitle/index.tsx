'use client';

// THREE
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Suspense, useRef } from 'react';
import { type Group, type Mesh, type Color, MeshStandardMaterial } from 'three';
// GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
// コンポーネント
import { TitleScene } from './Model';
import type { TitleSceneProps } from './Model';
import HexToRGB from '../../_utils/HexToRGB';

/** -------------------------------------------------
  型定義
------------------------------------------------- **/
// 共通パラメータ
type CommonAnimParams = {
  scaleTarget?: number;
  yTarget?: string;
  ease?: string;
};
// タイトルのアニメーション：フェーズ変化による自動縮小
type AutoShrink = CommonAnimParams & {
  type: 'auto';
  triggerPhase: string;
  duration?: number;
};
// タイトルのアニメーション：スクロールによる縮小
type ScrubShrink = CommonAnimParams & {
  type: 'scrub';
  triggerSelector: string;

  // コールバック関数
  onLeave?: () => void;
  onEnterBack?: () => void;

  // 変化する内容
  bgTarget?: string; 
  bgColorOnLeave?: string;
  bgColorOnEnterBack?: string;

  // テキスト色変化
  textColorOnLeave?: string;
  textColorOnEnterBack?: string;
  transmissionColorOnLeave?: string;
  transmissionColorOnEnterBack?: string;
};
type AnimateConfig = AutoShrink | ScrubShrink;

type WrapperPreset = 'main' | 'sub';

/* タイトルシーンのプロップスを受け取る */
type CanvasTitleProps = TitleSceneProps & {
  ref?: React.RefObject<HTMLDivElement | null>;
  shrinkMoveAnim?: AnimateConfig;
  wrapperPreset?: WrapperPreset;
  visuallyHidden?: boolean;
};

/** ------------------------ 型定義 ------------------------ **/

export default function CanvasTitle({
  ref: wrapperRef,
  shrinkMoveAnim,
  wrapperPreset = 'main',
  visuallyHidden = false,
  ...sceneProps
}: CanvasTitleProps) {
  const groupRef = useRef<Group>(null);
  const textFrontRef = useRef<Mesh>(null);
  const textBackRef = useRef<Mesh>(null);
  const transmissionBgRef = useRef<Color | null>(null);
  const { skipIntro = false } = sceneProps;
  
  /* ラッパーの表示内容定義
  --------------------------------------- */
  let wrapper!: string;
  let inner!: string;
  switch (wrapperPreset) {
    case 'main':
      wrapper = `fixed w-full h-[30vh] pointer-events-auto ${skipIntro ? 'z-80' : 'z-92'}`;
      inner = `w-full h-full`;
      break;
    case 'sub':
      wrapper = 'fixed inset-0 flex items-center justify-center z-50';
      inner = 'w-full h-[40vh]';
      break;
  }
  if (visuallyHidden) wrapper += ' opacity-0 pointer-events-none';

  /* 表示アニメーション
  --------------------------------------- */
  useGSAP( () => {
    if (!shrinkMoveAnim) return;
    const scale = shrinkMoveAnim.scaleTarget ?? 0.5;
    const y = shrinkMoveAnim.yTarget ?? '-40vh';
    const ease = shrinkMoveAnim.ease ?? 'power2.inOut';

    switch (shrinkMoveAnim.type) {
      case 'auto':{
        if (sceneProps.phase === shrinkMoveAnim.triggerPhase) {
          const duration = shrinkMoveAnim.duration ?? 1.2;
          gsap.to(wrapperRef!.current, { y, duration, ease });
          if (groupRef.current) { gsap.to(groupRef.current.scale, { x: scale, y: scale, z: scale, duration, ease }); }
        }}
        break;
      case 'scrub':{
        const config = {
          trigger: shrinkMoveAnim.triggerSelector,
          start: 'top top',
          end: '60% top',
          scrub: true,
          // スクロール時の挙動
          onLeave: () => {
            shrinkMoveAnim.onLeave?.();
            if (shrinkMoveAnim.bgTarget && shrinkMoveAnim.bgColorOnLeave) {
              gsap.to(shrinkMoveAnim.bgTarget, {
                backgroundColor: shrinkMoveAnim.bgColorOnLeave,
                duration: 0.4,
                ease: 'power2.inOut',
              });
            }
            if (shrinkMoveAnim.textColorOnLeave) {
              const [r, g, b] = HexToRGB(shrinkMoveAnim.textColorOnLeave);
              if (textFrontRef.current?.material) {
                gsap.to((textFrontRef.current.material as MeshStandardMaterial).color, {
                  r, g, b, duration: 0.4, ease: 'power2.inOut',
                });
              }
              if (textBackRef.current?.material) {
                gsap.to((textBackRef.current.material as MeshStandardMaterial).color, {
                  r, g, b, duration: 0.4, ease: 'power2.inOut',
                });
              }
            }
            if (shrinkMoveAnim.transmissionColorOnLeave && transmissionBgRef.current) {
              const [r, g, b] = HexToRGB(shrinkMoveAnim.transmissionColorOnLeave);
              gsap.to(transmissionBgRef.current, {
                r, g, b, duration: 0.4, ease: 'power2.inOut',
              });
            }
          },
          onEnterBack: () => {
            shrinkMoveAnim.onEnterBack?.();
            if (shrinkMoveAnim.bgTarget && shrinkMoveAnim.bgColorOnEnterBack) {
              gsap.to(shrinkMoveAnim.bgTarget, {
                backgroundColor: shrinkMoveAnim.bgColorOnEnterBack,
                duration: 0.4,
                ease: 'power2.inOut',
              });
            }
            if (shrinkMoveAnim.textColorOnEnterBack) {
              const [r, g, b] = HexToRGB(shrinkMoveAnim.textColorOnEnterBack);
              if (textFrontRef.current?.material) {
                gsap.to((textFrontRef.current.material as MeshStandardMaterial).color, {
                  r, g, b, duration: 0.4, ease: 'power2.inOut',
                });
              }
              if (textBackRef.current?.material) {
                gsap.to((textBackRef.current.material as MeshStandardMaterial).color, {
                  r, g, b, duration: 0.4, ease: 'power2.inOut',
                });
              }
            }
            if (shrinkMoveAnim.transmissionColorOnEnterBack && transmissionBgRef.current) {
              const [r, g, b] = HexToRGB(shrinkMoveAnim.transmissionColorOnEnterBack);
              gsap.to(transmissionBgRef.current, { r, g, b, duration: 0.4, ease: 'power2.inOut' });
            }
          },
        };

        gsap.to(wrapperRef!.current, { y, ease, scrollTrigger: config });
        if (groupRef.current) {
          gsap.to(groupRef.current.scale, {
            x: scale,
            y: scale,
            z: scale,
            ease,
            scrollTrigger: config,
          });
        }}
      break;
      default: break;
    }}, { dependencies: [shrinkMoveAnim, sceneProps.phase] }
  );
  return (
    <div ref={wrapperRef} className={wrapper}>
      <div className={inner}>
        <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 100 }} gl={{preserveDrawingBuffer: true}}>
          <Suspense fallback={null}>
            <Environment preset='warehouse' environmentIntensity={2} />
            <ambientLight intensity={0.5} />
            <TitleScene 
              {...sceneProps} 
              groupRef={groupRef} 
              textFrontRef={textFrontRef}
              textBackRef={textBackRef}
              transmissionBgRef={transmissionBgRef}
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}