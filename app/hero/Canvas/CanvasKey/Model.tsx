// React
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
// GSAP
import gsap from 'gsap';
// THREE
import { Html, MeshTransmissionMaterial, useGLTF } from '@react-three/drei';
import type { Group } from 'three';
import type { Mesh } from 'three';
// コンポーネント
import type { KeyCapType } from './index';
import type { ThemeName } from '../../../_components/utilities/curtainPalettes';  // ← 追加

export function KeyCap({ 
  keyCap, 
  onClick,
  onHover,
} : { 
  keyCap: KeyCapType; 
  onClick: (path: string, theme: ThemeName) => void;
  onHover: (label: string | null) => void;
  }) {
  const groupRef = useRef<Group>(null);
  const { nodes } = useGLTF('/models/model__keycap.glb');
  const geometry = (nodes.key as Mesh).geometry;
  const selfTimeRef = useRef(0);

  // ----------------------------------------
  // クリック時
  // ----------------------------------------
  const [clicked, setClicked] = useState<boolean>(false);

  const handleClick = () => {
    if (clicked) return;
    setClicked(true);
    const tl = gsap.timeline();

    tl.to(groupRef.current!.position, {
      y: -0.2,
      duration: 0.15,
      ease: 'power4.in',
    }).to(groupRef.current!.position, {
      y: 0,
      duration: 0.1,
      ease: 'power4.out',
      onComplete: () => onClick(keyCap.path, keyCap.theme),
    });
  };

  // ----------------------------------------
  // ホバー時
  // ----------------------------------------
  const [hovered, setHovered] = useState<boolean>(false);

  // ----------------------------------------
  // アイドルモーション
  // ----------------------------------------

  /* ランダムアニメーションの数値設定
  速度：[最小値, ばらつき幅], 振れ幅[最小値, ばらつき幅]
  最小値を上げる→全体的に速く/大きく, ばらつき幅を上げる→キーごとの個性が増す */
  const FLOAT_CONFIG = {
    y: { speed: [0.6, 0.4], amp: [0.05, 0.1] }, // Y軸方向の浮遊アニメーション設定（上下動）
    rotY: { speed: [0.5, 0.5], amp: [0.15, 0.3] }, // Y軸周りの回転アニメーション設定（左右回転）
    rotZ: { speed: [0.1, 0.15], amp: [0.1, 0.2] }, // Z軸周りの回転アニメーション設定
  };

  /* マウント時の数値計算 
  ランダムな数値（Math.random）を使用して設定した数値の中で動かす */
  const [offsets] = useState(() => ({
    // 高さ
    yPhase: Math.random() * Math.PI * 2,
    ySpeed: FLOAT_CONFIG.y.speed[0] + Math.random() * FLOAT_CONFIG.y.speed[1],
    yAmp: FLOAT_CONFIG.y.amp[0] + Math.random() * FLOAT_CONFIG.y.amp[1],
    // Y軸
    rotYPhase: Math.random() * Math.PI * 2,
    rotYSpeed: FLOAT_CONFIG.rotY.speed[0] + Math.random() * FLOAT_CONFIG.rotY.speed[1],
    rotYAmp: FLOAT_CONFIG.rotY.amp[0] + Math.random() * FLOAT_CONFIG.rotY.amp[1],
    // Z軸
    rotZPhase: Math.random() * Math.PI * 2,
    rotZSpeed: FLOAT_CONFIG.rotZ.speed[0] + Math.random() * FLOAT_CONFIG.rotZ.speed[1],
    rotZAmp: FLOAT_CONFIG.rotZ.amp[0] + Math.random() * FLOAT_CONFIG.rotZ.amp[1],
  }));

  /* フローティングアニメーション 
  計算式：((経過時間*速度の値)＋初期開始)*波の幅 */

  useFrame((state, delta) => {
    if (!groupRef.current || clicked) return;
    if (!hovered) {
      selfTimeRef.current += delta;
    }

    const t = selfTimeRef.current;

    // 基準の値
    const baseY = Math.sin(t * offsets.ySpeed + offsets.yPhase) * offsets.yAmp;
    const baseRotY = Math.sin(t * offsets.rotYSpeed + offsets.rotYPhase) * offsets.rotYAmp;
    const baseRotZ = Math.sin(t * offsets.rotZSpeed + offsets.rotZPhase) * offsets.rotZAmp;

    const initRotX = 0.3; // 通常時の前傾
    const hoverBaseRotX = 0.3; // ホバー時の基準ピッチ（少し前傾）
    const POS_FOLLOW = 0.6;
    const ROT_FOLLOW = 0.4; 

    // 追従オフセット
    const hoverPosX = hovered ? state.pointer.x * POS_FOLLOW : 0;
    const hoverPosY = hovered ? state.pointer.y * POS_FOLLOW : 0;
    const hoverRotX = hovered ? -state.pointer.y * ROT_FOLLOW : 0;
    const hoverRotY = hovered ? state.pointer.x * ROT_FOLLOW : 0;

    // 目標値（ホバー時の基準値 + 追従）
    const targetRotX = hovered ? hoverBaseRotX + hoverRotX : initRotX; // 基準0.3 + 追従
    const targetRotY = hovered ? 0 + hoverRotY : baseRotY; // 基準0 + 追従
    const targetRotZ = hovered ? 0 : baseRotZ; // 0固定

    // lerp で滑らかに
    const lerpFactor = 0.1;
    groupRef.current.position.x += (keyCap.x + hoverPosX - groupRef.current.position.x) * lerpFactor;
    groupRef.current.position.y += (baseY + hoverPosY - groupRef.current.position.y) * lerpFactor;
    groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * lerpFactor;
    groupRef.current.rotation.y += (targetRotY - groupRef.current.rotation.y) * lerpFactor;
    groupRef.current.rotation.z += (targetRotZ - groupRef.current.rotation.z) * lerpFactor;
  });

  return (
    <group
      ref={groupRef}
      position={[keyCap.x, 0, 0]}
      rotation-x={0.3}
      onPointerOver={(e) => {
        setHovered(true);
        e.stopPropagation();
        onHover(keyCap.label);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null)
      }}
      onClick={(e) => {
        e.stopPropagation();
        handleClick();
        onHover(null);
      }}
    >
      <mesh geometry={geometry}>
        <MeshTransmissionMaterial
          samples={6}
          resolution={512}
          transmission={0.85}
          roughness={0.1}
          thickness={0.6}
          ior={1.45}
          chromaticAberration={0.2}
          backside={true}
          color={keyCap.color}
        />
      </mesh>
      {hovered && (
        <Html position={[0, 1, 0]} center>
          <div
            className='text-zinc-950 relative rounded-full whitespace-nowrap text-4xl font-corporate-a italic font-medium'
          >
            {keyCap.label}
          </div>
        </Html>
      )}
    </group>
  );
}
