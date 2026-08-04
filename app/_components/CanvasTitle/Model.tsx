'use client';

import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Text, useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { Color, DoubleSide, MeshStandardMaterial, type Group, type Mesh } from 'three';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

type TextConfig = {
  text: string;
  position: [number, number, number];
  anchorX?: 'left' | 'right';
  fontSize?: number;
  textColor?: string;
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

  // hero phase で文字色変化させるか
  enableHeroColorChange?: boolean;

  // テキストのグループ
  groupRef?: React.RefObject<Group | null>;
  textFrontRef?: React.RefObject<Mesh | null>;
  textBackRef?: React.RefObject<Mesh | null>;
  transmissionBgRef?: React.MutableRefObject<Color | null>;
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
  enableHeroColorChange = false,
  groupRef,
  textFrontRef,
  textBackRef,
  transmissionBgRef,
}: TitleSceneProps) {
  /* 初期設定
  --------------------------------------- */
  const { nodes } = useGLTF(modelPath);
  const geometry = useMemo(() => {
    const source = (nodes[modelName] as Mesh).geometry;
    const cloned = source.clone();
    cloned.computeVertexNormals();
    return cloned;
  }, [modelName, nodes]);
  const internalGroupRef = useRef<Group>(null);
  const finalGroupRef = groupRef ?? internalGroupRef;
  const text3DRef = useRef<Mesh>(null);
  const selfTimeRef = useRef(0);

  // 既存の内部 refs と統合
  const internalTextFrontRef = useRef<Mesh>(null);
  const finalTextFrontRef = textFrontRef ?? internalTextFrontRef;

  const internalTextBackRef = useRef<Mesh>(null);
  const finalTextBackRef = textBackRef ?? internalTextBackRef;

  // transmissionBackground は外部に公開
  const transmissionBackground = useMemo(() => new Color(bgColor), [bgColor]);

  // 外部 ref に Color インスタンスを保存
  useEffect(() => {
    if (transmissionBgRef) {
      transmissionBgRef.current = transmissionBackground;
    }
  }, [transmissionBackground, transmissionBgRef]);

  /* 表示アニメーション
  --------------------------------------- */
  useGSAP(
    () => {
      /* 【フェーズ：タイトル】テキストの表示 */
      if (phase === 'title') {
        const tl = gsap.timeline();
        if (finalTextFrontRef.current?.material) {
          tl.to(finalTextFrontRef.current.material, { opacity: 1, duration: 1.4, ease: 'power2.out' });
        }
        if (finalTextBackRef.current?.material) {
          tl.to(finalTextBackRef.current.material, { opacity: 1, duration: 1.4, ease: 'power2.out' }, '<');
        }
        if (text3DRef.current) {
          tl.to( text3DRef.current.scale, { x: modelScale, y: modelScale, z: modelScale, duration: 1.4, ease: 'back.out(2)' }, '<');
        }
      }
      /* 【フェーズ：ヒーロー表示】テキストの色変更 */
      if (phase === 'hero' && enableHeroColorChange && !skipIntro) {
        const tl = gsap.timeline();
        if (finalTextFrontRef.current?.material) {
          tl.to((finalTextFrontRef.current.material as MeshStandardMaterial).color, {
            r: 0.98,
            g: 0.98,
            b: 0.98,
            duration: 1.2,
            ease: 'power2.inOut',
          });
        }
        if (finalTextBackRef.current?.material) {
          tl.to(
            (finalTextBackRef.current.material as MeshStandardMaterial).color,
            { r: 0.98, g: 0.98, b: 0.98, duration: 1.2, ease: 'power2.inOut' },
            '<',
          );
        }
      }
    },
    { dependencies: [phase, skipIntro, enableHeroColorChange] },
  );

  /* 浮遊アニメーション
  --------------------------------------- */
  const float = {
    // 浮遊オプション
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
            ref={finalTextFrontRef}
            font='/fonts/Urbanist-MediumItalic.ttf'
            position={preText.position}
            fontSize={preText.fontSize ?? 1.6}
            color={ preText.textColor ?? '#fafafa' }
            anchorX={preText.anchorX ?? 'right'}
            anchorY='middle'
            material-transparent
            material-opacity={skipIntro ? 1 : 0}
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
            ref={finalTextBackRef}
            font='/fonts/Urbanist-MediumItalic.ttf'
            position={postText.position}
            fontSize={postText.fontSize ?? 1.6}
            color={ postText.textColor ?? '#fafafa' }
            anchorX={postText.anchorX ?? 'left'}
            anchorY='middle'
            material-transparent
            material-opacity={skipIntro ? 1 : 0}
          >
            {postText.text}
          </Text>
        )}
      </group>
    </>
  );
}
