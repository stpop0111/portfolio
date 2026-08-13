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
      monitor.rotation.set(0, 0, 0);
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
            // ---- PBR：射出成形プラスチックの実測値に寄せる ----
            // roughness 0.35 前後が「サラサラした樹脂」。低すぎると鏡、高すぎるとゴム
            roughness: 0.34,
            metalness: 0,
            // 誘電体（非金属）の垂直入射反射率は物理定数で 0.5 が基準。
            // ここを盛ると「高級感」ではなく安っぽい光沢になる
            reflectivity: 0.5,
            // 成形品の表面に薄く残るコート層。わずかに入れると製品感が出る
            clearcoat: 0.35,
            clearcoatRoughness: 0.35,
            // 微細な起伏（金型のシボ）。完璧に平らな面は現実に存在しない
            sheen: 0.05,
            sheenRoughness: 0.9,
            sheenColor: new Color('#ffffff'),
            // 縁で光が回り込む量。実写のプラは輪郭がわずかに明るい
            iridescence: 0,
            envMapIntensity: 1.15,
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
  
    const ROT_BASE_Y = 0;
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
  });

  return (
    <group ref={groupRef}>１
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial opacity={1} />
      </mesh>

      <mesh position={[1.2, -1.6, -1.8]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, 1, 3]} />
        <meshPhysicalMaterial
          color='#5c5c5c'
          roughness={0.82}
          metalness={0}
          reflectivity={0.35}
          clearcoat={0}
          envMapIntensity={0.6}
        />
      </mesh>
      <primitive object={scene} position={[0, -1.1, 0]} scale={1} />
    </group>
  );
}
