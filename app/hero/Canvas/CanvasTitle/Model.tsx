'use client';

import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Text, useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { Color, DoubleSide, MeshStandardMaterial, type Group, type Mesh } from 'three';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export function TitleScene({ phase, skipIntro = false }: { phase: string; skipIntro?: boolean }) {
  const { nodes } = useGLTF('/models/model__letter-f.glb');
  const transmissionBackground = useMemo(() => new Color('#fafafa'), []);
  const geometry = useMemo(() => {
    const source = (nodes.letter_f as Mesh).geometry;
    const cloned = source.clone();
    cloned.computeVertexNormals();
    return cloned;
  }, [nodes]);
  const groupRef = useRef<Group>(null);
  const text3DRef = useRef<Mesh>(null);
  const textFrontRef = useRef<Mesh>(null);
  const textBackRef = useRef<Mesh>(null);
  const selfTimeRef = useRef(0);


  useGSAP(() => {
  if (phase === 'title') {
    const tl = gsap.timeline();
    tl.to(textFrontRef.current!.material, { opacity: 1, duration: 1.4, ease: 'power2.out' })
      .to(textBackRef.current!.material, { opacity: 1, duration: 1.4, ease: 'power2.out' }, '<')
      .to(text3DRef.current!.scale, { x: 2, y: 2, z: 2, duration: 1.4, ease: 'back.out(2)' }, '<');
  }
  if (phase === 'hero') {
    // About から復帰（skipIntro）時は初期 props と onSync で最終状態にしているため、
    // ここでの色アニメは不要。
    if (skipIntro) return;

    const tl = gsap.timeline();
    tl.to((textFrontRef.current!.material as MeshStandardMaterial).color, { r: 0.1, g: 0.1, b: 0.1, duration: 1.2, ease: 'power2.inOut' }, '<')
      .to((textBackRef.current!.material as MeshStandardMaterial).color, { r: 0.1, g: 0.1, b: 0.1, duration: 1.2, ease: 'power2.inOut' }, '<');
  }
}, { dependencies: [phase] });

  const float = {
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
      <group ref={groupRef}>
        <Text
          ref={textFrontRef}
          font='/fonts/Urbanist-MediumItalic.ttf'
          position={[-0.2, 0, -0.5]}
          fontSize={1.6}
          color='#fafafa'
          anchorX='right'
          anchorY='middle'
          material-transparent
          material-opacity={skipIntro ? 1 : 0}
          onSync={skipIntro ? (t: Mesh) => (t.material as MeshStandardMaterial).color.setRGB(0.1, 0.1, 0.1) : undefined}
        >
          Port
        </Text>
        <mesh ref={text3DRef} geometry={geometry} position={[0, 0, 0]} scale={skipIntro ? 2 : 0}>
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
        <Text
          ref={textBackRef}
          font='/fonts/Urbanist-MediumItalic.ttf'
          position={[0.2, 0, -0.5]}
          fontSize={1.6}
          color='#fafafa'
          anchorX='left'
          anchorY='middle'
          material-transparent
          material-opacity={skipIntro ? 1 : 0}
          onSync={skipIntro ? (t: Mesh) => (t.material as MeshStandardMaterial).color.setRGB(0.1, 0.1, 0.1) : undefined}
        >
          olio
        </Text>
      </group>
    </>
  );
}
