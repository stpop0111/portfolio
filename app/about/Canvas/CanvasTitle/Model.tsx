'use client';

import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Text, useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { Color, DoubleSide, MeshStandardMaterial, type Group, type Mesh } from 'three';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

export function TitleScene({ phase }: { phase: string }) {
  const { nodes } = useGLTF('/models/model__letter-a.glb');
  const transmissionBackground = useMemo(() => new Color('#FAF3E1'), []);

  const geometry = useMemo(() => {
    const source = (nodes.letter_a as Mesh).geometry;
    const cloned = source.clone();
    cloned.computeVertexNormals();
    return cloned;
  }, [nodes]);
  const groupRef = useRef<Group>(null);
  const text3dRef = useRef<Mesh>(null);
  const textRef = useRef<Mesh>(null);
  const selfTimeRef = useRef(0);

  useGSAP(
    () => {
      if (phase === 'title') {
        const tl = gsap.timeline();
        tl.to(textRef.current!.material, {
          opacity: 1, duration: 1.4, ease: 'power2.out' })
          .to(text3dRef.current!.scale, {
            x: 2, y: 2, z: 2, duration: 1.4, ease: 'back.out(2)' }, '<')
          .to((textRef.current!.material as MeshStandardMaterial).color, {
            r: 0.1, g: 0.1, b: 0.1, duration: 1.2, ease: 'power2.inOut' }, '<', )
          .to(groupRef.current!.scale, {
            x: 0.5, y: 0.5, z: 0.5, ease: 'power2.inOut',
            scrollTrigger: {
              trigger: '.titleSection',
              start: 'top top',
              end: '60% top',
              scrub: true,
              // マテリアルの変化
              onLeave: () => {
                gsap.to((textRef.current!.material as MeshStandardMaterial).color, { r: 1, g: 1, b: 1, duration: 0.4, ease: 'power2.inOut', });
                gsap.to(transmissionBackground, { r: 0.133, g: 0.133, b: 0.133, duration: 0.4, ease: 'power2.inOut', });
              },
              onEnterBack: () => {
                gsap.to((textRef.current!.material as MeshStandardMaterial).color, { r: 0.1, g: 0.1, b: 0.1, duration: 0.4, ease: 'power2.inOut', });
                gsap.to(transmissionBackground, { r: 0.98, g: 0.953, b: 0.882, duration: 0.4, ease: 'power2.inOut', });
              },
            },
          });
      }
    },
    { dependencies: [phase] },
  );

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

    if (text3dRef.current) {
      const y = Math.sin(t * float.ySpeed + float.yPhase) * float.yAmp;
      const rotY = Math.sin(t * float.rotYSpeed + float.rotYPhase) * float.rotYAmp;
      const rotZ = Math.sin(t * float.rotZSpeed + float.rotZPhase) * float.rotZAmp;
      text3dRef.current.position.y = y;
      text3dRef.current.rotation.y = rotY;
      text3dRef.current.rotation.z = rotZ;
    }
  });

  return (
    <>
      <group ref={groupRef}>
        <mesh ref={text3dRef} geometry={geometry} position={[-2.8, 0, 0]} scale={0}>
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
          ref={textRef}
          font='/fonts/Urbanist-MediumItalic.ttf'
          position={[-1.9, 0, -0.5]}
          fontSize={1.6}
          color='#fafafa'
          anchorX='left'
          anchorY='middle'
          material-transparent
          material-opacity={0}
        >
          Bout Me
        </Text>
      </group>
    </>
  );
}
