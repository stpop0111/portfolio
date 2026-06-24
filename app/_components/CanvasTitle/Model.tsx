'use client';

import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Text, useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { Color, DoubleSide, MeshStandardMaterial, type Group, type Mesh } from 'three';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

type TextConfig = {
  text: string;
  position: [number, number, number];
  anchorX?: 'left' | 'right';
  fontSize?: number;
};

export type TitleSceneProps = {
  phase: string;
  skipIntro?: boolean;

  // モデル
  modelPath: string;
  modelName: string;
  modelPosition?: [number, number, number];
  modelScale?: number;
  bgColor?: string;

  // テキスト
  preText?: TextConfig;
  postText?: TextConfig;
  textColor?: string;

  // hero phase で文字色変化させるか
  enableHeroColorChange?: boolean;

  // テキストのグループ
  groupRef?: React.RefObject<Group | null>;
};

export function TitleScene({
  phase,
  skipIntro = false,
  modelPath,
  modelName,
  modelPosition = [0, 0, 0],
  modelScale = 2,
  bgColor = '#fafafa',
  preText,
  postText,
  textColor = '#fafafa',
  enableHeroColorChange = false,
  groupRef
}: TitleSceneProps) {

  /* 初期設定
  --------------------------------------- */
  const { nodes } = useGLTF(modelPath);
  const transmissionBackground = useMemo(() => new Color(bgColor), [bgColor]);
  const geometry = useMemo(() => {
    const source = (nodes[modelName] as Mesh).geometry;
    const cloned = source.clone();
    cloned.computeVertexNormals();
    return cloned;
  }, [modelName, nodes]);
  const internalGroupRef = useRef<Group>(null);
  const finalGroupRef = groupRef ?? internalGroupRef;
  const text3DRef = useRef<Mesh>(null);
  const textFrontRef = useRef<Mesh>(null);
  const textBackRef = useRef<Mesh>(null);
  const selfTimeRef = useRef(0);

  /* 表示アニメーション
  --------------------------------------- */
  useGSAP(() => {
    /* 【フェーズ：タイトル】テキストの表示 */
    if (phase === 'title') {
      const tl = gsap.timeline();
      if (textFrontRef.current?.material) {
        tl.to(textFrontRef.current.material, { opacity: 1, duration: 1.4, ease: 'power2.out' });
      }
      if (textBackRef.current?.material) {
        tl.to(textBackRef.current.material, { opacity: 1, duration: 1.4, ease: 'power2.out' }, '<');
      }
      if (text3DRef.current) {
        tl.to(text3DRef.current.scale, { x: modelScale, y: modelScale, z: modelScale, duration: 1.4, ease: 'back.out(2)' }, '<');
      }
    }
    /* 【フェーズ：ヒーロー表示】テキストの色変更 */
    if (phase === 'hero' && enableHeroColorChange && !skipIntro) {
      const tl = gsap.timeline();
      if (textFrontRef.current?.material) { 
        tl.to((textFrontRef.current.material as MeshStandardMaterial).color, { r: 0.1, g: 0.1, b: 0.1, duration: 1.2, ease: 'power2.inOut' }); 
      }
      if (textBackRef.current?.material) { 
        tl.to((textBackRef.current.material as MeshStandardMaterial).color, { r: 0.1, g: 0.1, b: 0.1, duration: 1.2, ease: 'power2.inOut' }, '<'); 
      }
    }
  }, { dependencies: [phase, skipIntro, enableHeroColorChange] });

  /* 浮遊アニメーション
  --------------------------------------- */
  const float = { // 浮遊オプション
    yPhase: 1.2,
    ySpeed: 0.82,
    yAmp: 0.1,
    rotYPhase: 2.1,
    rotYSpeed: 0.68,
    rotYAmp: 0.12,
    rotZPhase: 3,
    rotZSpeed: 1.46,
    rotZAmp: 0.09,
  };

  /* アニメーション */
  useFrame((_, delta) => {
    selfTimeRef.current += delta;
    const t = selfTimeRef.current;
    if (text3DRef.current) {
      const y = Math.sin(t * float.ySpeed + float.yPhase) * float.yAmp;
      const rotY = Math.sin(t * float.rotYSpeed + float.rotYPhase) * float.rotYAmp;
      const rotZ = Math.sin(t * float.rotZSpeed + float.rotZPhase) * float.rotZAmp;
      text3DRef.current.position.y = y;
      text3DRef.current.rotation.y = rotY;
      text3DRef.current.rotation.z = rotZ;
    }
  });

  return (
    <>
      <group ref={finalGroupRef}>
        {preText && (
          <Text
            ref={textFrontRef}
            font='/fonts/Urbanist-MediumItalic.ttf'
            position={preText.position}
            fontSize={preText.fontSize ?? 1.6} 
            color={textColor}
            anchorX={preText.anchorX ?? 'right'} 
            anchorY='middle'
            material-transparent
            material-opacity={skipIntro ? 1 : 0}
            onSync={skipIntro ? (t: Mesh) => (t.material as MeshStandardMaterial).color.setRGB(0.1, 0.1, 0.1) : undefined}
          >
            {preText.text}
          </Text>
        )}
        <mesh ref={text3DRef} geometry={geometry} position={modelPosition} scale={skipIntro ? modelScale : 0}>
          <MeshTransmissionMaterial
            samples={12}
            resolution={1024}
            transmission={1}
            roughness={0}
            metalness={0}
            thickness={1.8}
            ior={1.5}
            chromaticAberration={0.08}
            anisotropy={0}
            distortion={0}
            distortionScale={0}
            temporalDistortion={0}
            background={transmissionBackground}
            side={DoubleSide}
            backside={true}
            color='#ffffff'
          />
        </mesh>
        {postText && (
          <Text
            ref={textBackRef}
            font='/fonts/Urbanist-MediumItalic.ttf'
            position={postText.position}
            fontSize={postText.fontSize ?? 1.6} 
            color={textColor}
            anchorX={postText.anchorX ?? 'left'} 
            anchorY='middle'
            material-transparent
            material-opacity={skipIntro ? 1 : 0}
            onSync={skipIntro ? (t: Mesh) => (t.material as MeshStandardMaterial).color.setRGB(0.1, 0.1, 0.1) : undefined}
          >
            {postText.text}
          </Text>
        )}
      </group>
    </>
  );
}
