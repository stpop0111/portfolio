// React
import { useEffect, useRef } from 'react';
// THREE
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Color, DoubleSide, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';

export function PC({ groupRef, hoveredKey }: { groupRef?: React.RefObject<Group | null>; hoveredKey: string | null }) {
  const { scene, nodes } = useGLTF('/models/model__pc.glb');
  const monitorRef = useRef<Group | null>(null);

  /* 液晶表示用 */
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<CanvasTexture | null>(null);
  const screenMatRef = useRef<MeshStandardMaterial | null>(null);

  // ----------------------------------------
  // マテリアルの作成
  // ----------------------------------------

  useEffect(() => {
    // ============ canvas + texture + マテリアル準備 ============
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.floor(1024 * (2.49 / 2.92)); // ≒ 873
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new CanvasTexture(canvas);
    texture.flipY = false;
    textureRef.current = texture;

    const monitorMat = new MeshStandardMaterial({
      color: 0xf0000,
      map: texture,
      emissive: new Color(0xffffff),
      emissiveMap: texture,
      emissiveIntensity: 1,
      side: DoubleSide,
    });
    screenMatRef.current = monitorMat;

    // ============ scene から mesh__monitor_1 を探す ============
    let monitorScreen: Mesh | null = null;

    scene.traverse((obj) => {
      if (obj instanceof Mesh && obj.name === 'mesh__monitor_1') {
        monitorScreen = obj;
      }
    });

    console.log('monitorScreen found:', monitorScreen);

    // ============ 全 mesh を処理 ============
    scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;

        if (obj === monitorScreen) {
          // 液晶
          obj.material = monitorMat;
        } else if (obj.material) {
          // PC 本体

          const oldMat = obj.material as MeshStandardMaterial;
          obj.material = new MeshPhysicalMaterial({
            color: oldMat.color,
            map: oldMat.map,
            roughness: 0.1,
            metalness: 0,
            clearcoat: 0.8,
            clearcoatRoughness: 0.3,
          });
        }
      }
    });
  }, [scene]);

  // hoveredKey が変わったら描画更新
  useEffect(() => {
    if (!canvasRef.current || !textureRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    // 背景クリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (hoveredKey) {
      // テキスト描画（中央）
      const fontSize = Math.min(320, (canvas.width / hoveredKey.length) * 1);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(hoveredKey, canvas.width / 2, canvas.height / 2);
    }

    textureRef.current.needsUpdate = true;
  }, [hoveredKey]);

  // ----------------------------------------
  // マウスカーソルへの追従
  // ----------------------------------------
  useEffect(() => {
    const monitor = nodes.monitor as Group;
    if (monitor) {
      monitorRef.current = monitor;
      monitor.rotation.set(0, Math.PI / 4, 0);
    }
  }, [nodes]);

  useFrame((state) => {
    if (!monitorRef.current) return;
    const ROT_BASE_Y = Math.PI / 4;
    const ROT_FOLLOW_Y = Math.PI / 4;
    const lerpFactor = 0.1;
    const targetRotY = ROT_BASE_Y + state.pointer.x * ROT_FOLLOW_Y;
    monitorRef.current.rotation.y += (targetRotY - monitorRef.current.rotation.y) * lerpFactor;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, -1, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 1, 1.8]} />
        <meshPhysicalMaterial color='#888' roughness={0.4} clearcoat={0.3} clearcoatRoughness={0.2} />
      </mesh>
      <primitive object={scene} position={[0, -0.5, 0]} scale={1} />
    </group>
  );
}
