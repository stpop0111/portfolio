'use client';

import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Text, useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { Color, DoubleSide, MeshStandardMaterial, type Group, type Mesh } from 'three';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export function TitleScene({ phase }: { phase: string }) {
  const { nodes } = useGLTF('/models/model__letter-f.glb');
  const transmissionBackground = useMemo(() => new Color('#fafafa'), []);

  const geometry = useMemo(() => {
    const source = (nodes.letter_f as Mesh).geometry;
    const cloned = source.clone();
    cloned.computeVertexNormals();
    return cloned;
  }, [nodes]);

  const groupRef = useRef<Group>(null);
  const fRef = useRef<Mesh>(null);
  const portRef = useRef<Mesh>(null);
  const olioRef = useRef<Mesh>(null);
  const selfTimeRef = useRef(0);

  useGSAP(() => {
  if (phase === 'title') {
    const tl = gsap.timeline();
    tl.to(portRef.current!.material, { opacity: 1, duration: 1.4, ease: 'power2.out' })
      .to(olioRef.current!.material, { opacity: 1, duration: 1.4, ease: 'power2.out' }, '<')
      .to(fRef.current!.scale, { x: 2, y: 2, z: 2, duration: 1.4, ease: 'back.out(2)' }, '<');
  }
  if (phase === 'hero') {
    const tl = gsap.timeline();
    tl.to((portRef.current!.material as MeshStandardMaterial).color, { r: 0.1, g: 0.1, b: 0.1, duration: 1.2, ease: 'power2.inOut' }, '<')
      .to((olioRef.current!.material as MeshStandardMaterial).color, { r: 0.1, g: 0.1, b: 0.1, duration: 1.2, ease: 'power2.inOut' }, '<');
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

    if (fRef.current) {
      const y = Math.sin(t * float.ySpeed + float.yPhase) * float.yAmp;
      const rotY = Math.sin(t * float.rotYSpeed + float.rotYPhase) * float.rotYAmp;
      const rotZ = Math.sin(t * float.rotZSpeed + float.rotZPhase) * float.rotZAmp;
      fRef.current.position.y = y;
      fRef.current.rotation.y = rotY;
      fRef.current.rotation.z = rotZ;
    }
  });

  return (
    <>
      <group ref={groupRef}>
        <Text
          ref={portRef}
          font='/fonts/Urbanist-MediumItalic.ttf'
          position={[-0.05, 0, -0.5]}
          fontSize={1.6}
          color='#fafafa'
          anchorX='right'
          anchorY='middle'
          material-transparent
          material-opacity={0}
        >
          Port
        </Text>
        <mesh ref={fRef} geometry={geometry} position={[0, 0, 0]} scale={0}>
          <MeshTransmissionMaterial
            samples={12}
            resolution={1024}
            transmission={1}
            metalness={0}
            roughness={0}
            thickness={0.5}
            ior={2.0}
            chromaticAberration={0.6}
            backside={true}
            background={transmissionBackground}
            side={DoubleSide}
            color='#ffffff'
            iridescence={1}
            iridescenceIOR={1.33}
            iridescenceThicknessRange={[100, 800]}
          />
        </mesh>
        <Text
          ref={olioRef}
          font='/fonts/Urbanist-MediumItalic.ttf'
          position={[0.05, 0, -0.5]}
          fontSize={1.6}
          color='#fafafa'
          anchorX='left'
          anchorY='middle'
          material-transparent
          material-opacity={0}
        >
          olio
        </Text>
      </group>
    </>
  );
}
