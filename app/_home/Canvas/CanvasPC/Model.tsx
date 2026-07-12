// React
import { useEffect, useRef } from 'react';
// THREE
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Color, DoubleSide, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';

export function PC({
  groupRef,
  hoveredKey,
  onReady,
}: {
  groupRef?: React.RefObject<Group | null>;
  hoveredKey: string | null;
  onReady?: () => void;
}) {
  const { scene, nodes } = useGLTF('/models/model__pc.glb');
  const monitorRef = useRef<Group | null>(null);

  useEffect(() => { onReady?.(); }, [onReady]);

  useEffect(() => {
    const monitor = nodes.monitor as Group;
    if (monitor) {
      monitorRef.current = monitor;
      monitor.rotation.set(0, Math.PI / 4, 0);
    }
  }, [nodes]);


  // ---------------------------
  // 液晶用マテリアルの作成
  // ---------------------------
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<CanvasTexture | null>(null);
  const screenMatRef = useRef<MeshStandardMaterial | null>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');

    // 各マテリアルの設定
    // ---------------------------
    canvas.width = 1024;
    canvas.height = Math.floor(1024 * (2.49 / 2.92));
    canvasRef.current = canvas;

    /* CTX */
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    /* モニターのベースカラー */
    const texture = new CanvasTexture(canvas);
    texture.flipY = false;
    textureRef.current = texture;

    const monitorMat = new MeshStandardMaterial({
      map: texture,
      emissive: new Color(0xffffff),
      emissiveMap: texture,
      emissiveIntensity: 3,
      side: DoubleSide,
    });
  
    screenMatRef.current = monitorMat;
    let monitorScreen: Mesh | null = null;
    scene.traverse((obj) => {
      if (obj instanceof Mesh && obj.name === 'mesh__monitor_1') { monitorScreen = obj; }
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
  // ---------------------------

  // ---------------------------
  // アニメーション
  // ---------------------------
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const scrollXRef = useRef(0);
  useFrame((state, delta) => {
    if (!monitorRef.current) return;
  
    const ROT_BASE_Y = Math.PI / 4;
    const ROT_FOLLOW_Y = Math.PI / 4;
    const lerpFactor = 0.1;
    const targetRotY = ROT_BASE_Y + pointerRef.current.x * ROT_FOLLOW_Y;
    monitorRef.current.rotation.y += (targetRotY - monitorRef.current.rotation.y) * lerpFactor;

  
    if (!canvasRef.current || !textureRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 現在時刻を表示
    // ---------------------------
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `:${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    ctx.font = `bold 40px "dotgothic16", monospace`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(timeStr, 100, 120);
    // ---------------------------

    // ホバー時の表示
    // ---------------------------
    if (hoveredKey) {
      const SCROLL_SPEED = 300;
      const SPACING = 200;
      const FONT_SIZE = 300;

      /* フォントの書式設定 */
      ctx.font = `bold ${FONT_SIZE}px "dotgothic16", sans-serif`;
      ctx.fillStyle = '#f90';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

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
    } else {
      ctx.font = `bold 160px "dotgothic16", sans-serif`;
      ctx.font = `bold 160px "dotgothic16", sans-serif`;
      ctx.fillStyle = '#fafafa';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('(^o^)/', canvas.width / 2, canvas.height / 2);
      ctx.font = `bold 80px "dotgothic16", sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
    }
    // ---------------------------

    // 画面のノイズ
    // ---------------------------

    /* スキャンラインの追加 */
    const LINE_SPACING = 8;
    const LINE_HEIGHT = 2;
    ctx.fillStyle = 'rgba(0, 0, 0.3)';
    for (let y = 0; y < canvas.height; y += LINE_SPACING) {
      ctx.fillRect(0, y, canvas.width, LINE_HEIGHT);
    }

    /* ノイズピクセル */
    const NOISE_COUNT = 100;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let i = 0; i < NOISE_COUNT; i++) {
      const nx = Math.random() * canvas.width;
      const ny = Math.random() * canvas.height;
      const size = Math.random() * 3 + 1;
      ctx.fillRect(nx, ny, size, size);
    }

    /* グリッチ */
    if (Math.random() < 0.05) {
      const GLITCH_SETTINGS = {
        'Y' : Math.floor(Math.random() * canvas.height),
        'HEIGHT' : Math.floor(Math.random() * 20 + 5),
        'OFFSET' : Math.floor(Math.random() - 0.5) * 50
      }

      if (GLITCH_SETTINGS.Y + GLITCH_SETTINGS.HEIGHT < canvas.height) {
        const imageData = ctx.getImageData(0, GLITCH_SETTINGS.Y, canvas.width, GLITCH_SETTINGS.HEIGHT);
        ctx.clearRect(0, GLITCH_SETTINGS.Y, canvas.width, GLITCH_SETTINGS.HEIGHT);
        ctx.putImageData(imageData, GLITCH_SETTINGS.OFFSET, GLITCH_SETTINGS.Y);
      }
    }
    textureRef.current.needsUpdate = true;
    // ---------------------------

    // カメラのポインター追従
    // ---------------------------
    const CAMERA_SETTINGS = {
      'BASE_X': 3,
      'BASE_Y': -0.4,
      'FOLLOW_X': 1.5,
      'FOLLOW_Y': -0.5,
      'LERP':0.05
    }

    const targetCamX = CAMERA_SETTINGS.BASE_X + pointerRef.current.x * CAMERA_SETTINGS.FOLLOW_X;
    const targetCamY = CAMERA_SETTINGS.BASE_Y + pointerRef.current.y * CAMERA_SETTINGS.FOLLOW_Y;

    state.camera.position.x += (targetCamX - state.camera.position.x) * CAMERA_SETTINGS.LERP;
    state.camera.position.y += (targetCamY - state.camera.position.y) * CAMERA_SETTINGS.LERP;
    state.camera.lookAt(0, 0.6, 0);
    // ---------------------------

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
