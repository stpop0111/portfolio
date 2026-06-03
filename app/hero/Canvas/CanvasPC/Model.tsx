// React
import { useEffect, useRef } from 'react';
// THREE
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Color, DoubleSide, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';

export function PC({ groupRef, hoveredKey }: { groupRef?: React.RefObject<Group | null>; hoveredKey: string | null }) {
  /* パソコン3Dモデル */
  const { scene, nodes } = useGLTF('/models/model__pc.glb');
  const monitorRef = useRef<Group | null>(null);

  useEffect(() => {
    const monitor = nodes.monitor as Group;
    if (monitor) {
      monitorRef.current = monitor;
      monitor.rotation.set(0, Math.PI / 4, 0);
    }
  }, [nodes]);

  /* 液晶表示用 */
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<CanvasTexture | null>(null);
  const screenMatRef = useRef<MeshStandardMaterial | null>(null);

  // ----------------------------------------
  // マテリアルの作成
  // ----------------------------------------

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.floor(1024 * (2.49 / 2.92));
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
    let monitorScreen: Mesh | null = null;
    scene.traverse((obj) => {
      if (obj instanceof Mesh && obj.name === 'mesh__monitor_1') {
        monitorScreen = obj;
      }
    });

    scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;

        if (obj === monitorScreen) {
          obj.material = monitorMat;
        } else if (obj.material) {
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

  // ----------------------------------------
  // アニメーション
  // ----------------------------------------
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = (e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const scrollXRef = useRef(0);
  useFrame((state, delta) => {
    /* モニターの首振り */
    if (!monitorRef.current) return;
    const ROT_BASE_Y = Math.PI / 4;
    const ROT_FOLLOW_Y = Math.PI / 4;
    const lerpFactor = 0.1;
    const targetRotY = ROT_BASE_Y + pointerRef.current.x * ROT_FOLLOW_Y;

    monitorRef.current.rotation.y += (targetRotY - monitorRef.current.rotation.y) * lerpFactor;

    /* モニターの表示 */
    if (!canvasRef.current || !textureRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (hoveredKey) {
      const SCROLL_SPEED = 300;
      const SPACING = 200;
      const FONT_SIZE = 300;

      /* フォントの書式設定 */
      ctx.font = `bold ${FONT_SIZE}px "Urbanist", sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';

      /* 一周したらスクロール位置リセット */
      const textWidth = ctx.measureText(hoveredKey).width;
      scrollXRef.current -= delta * SCROLL_SPEED;
      if (scrollXRef.current < -(textWidth + SPACING)) {
        scrollXRef.current = 0;
      }

      /* 画面いっぱいに繰り返秒後 */
      let x = scrollXRef.current;
      while (x < canvas.width) {
        ctx.fillText(hoveredKey, x, canvas.height / 2);
        x += textWidth + SPACING;
      }
    }

    /* スキャンラインの追加 */
    const LINE_SPACING = 8;
    const LINE_HEIGHT = 2;
    ctx.fillStyle = 'rgba(0, 0, 0.3)';
    for(let y = 0; y < canvas.height; y += LINE_SPACING) {
      ctx.fillRect(0, y , canvas.width, LINE_HEIGHT)
    }

    /* ノイズピクセル */
    const NOISE_COUNT = 100;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let i = 0; i < NOISE_COUNT; i++ ) {
      const nx = Math.random() * canvas.width;
      const ny = Math.random() * canvas.height;
      const size = Math.random() * 3 + 1;
      ctx.fillRect(nx, ny, size, size)
    }

    /* グリッチ */
    if (Math.random() < 0.05){
      const glitchY = Math.floor(Math.random() * canvas.height);
      const glitchHeight = Math.floor(Math.random() * 20 + 5);
      const glitchOffset = (Math.floor(Math.random() - 0.5) * 50);
      
      if (glitchY + glitchHeight < canvas.height) {
        const imageData = ctx.getImageData(0, glitchY, canvas.width, glitchHeight);
        ctx.clearRect(0, glitchY, canvas.width, glitchHeight);
        ctx.putImageData(imageData, glitchOffset, glitchY)
      }
    }

    textureRef.current.needsUpdate = true;
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
