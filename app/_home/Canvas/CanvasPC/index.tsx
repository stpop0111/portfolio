'use client';

// React
import { Suspense, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
// THREE
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, Preload } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
import type { DepthOfFieldEffect } from 'postprocessing';
// Leva（開発時のカメラ調整パネル）
import { Leva } from 'leva';
// コンポーネント
import { PC } from './Model';
import { Bloom, DepthOfField, EffectComposer, N8AO } from '@react-three/postprocessing';
import { depthOfField, type SensorName } from '../../../_utils/cameraPresets';
import {
  CAMERA_FAR,
  CAMERA_INITIAL,
  CAMERA_NEAR,
  FOCUS_NODES,
  useProductCamera,
  type FocusMode,
} from './useProductCamera';

// ---------------------------
// カメラ：中判 + 80mm の物撮りを想定した設定
// ---------------------------
// 直交投影は面がまったく収束しないので図面寄りに見える。実機の物撮りに寄せるため
// パースペクティブへ。標準〜中望遠なので収束は控えめで、
// プロダクトカタログのような「立体が素直に回り込む」程度に収まる。
//   ・中判（Phase One XF IQ4 / Hasselblad, 53.4 x 40mm）@80mm → 垂直画角 28.07°
//     （参考：同じ中判の @100mm なら 22.62°、@135mm なら 16.85°）
//   ・フルサイズ（EOS R5 / α7R V, 36 x 24mm）@80mm なら 17.06°
// ISO 100 / 三脚なので粒子ノイズもカメラの揺れも足さない（動くのは被写体側だけ）。
// 注意：望遠にするほどカメラは後ろへ下がり、視線が 10.2° 上向きなので同時に沈む。
// この中判構成では約 116mm を超えるとカメラの y が Model.tsx の影受け平面
// （y=-1.6）より下に来る。80mm では y=-1.12 なので平面より上に収まっている。
//
// 数値の実体と Leva パネルの中身は ./useProductCamera.ts にある。
// パネルはあくまで調整用で、既定値＝いま公開している見た目。

// Canvas 生成時のカメラ。毎回同じ参照を渡さないと R3F がカメラを作り直すので
// モジュールスコープに固定しておく（実際の制御は下の ProductCamera 側）
const INITIAL_CAMERA = {
  fov: CAMERA_INITIAL.fov,
  position: CAMERA_INITIAL.position,
  near: CAMERA_NEAR,
  far: CAMERA_FAR,
};

/**
 * Leva の値でカメラを動かす。
 * drei の PerspectiveCamera に makeDefault を付けるとカメラが二つになり、
 * EffectComposer の RenderPass がどちらを掴むかで絵がずれる。
 * Canvas が最初に作ったカメラをそのまま書き換えるほうが確実。
 */
function ProductCamera({
  fov,
  position,
  target,
  near,
  far,
}: {
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
  near: number;
  far: number;
}) {
  const get = useThree((state) => state.get);
  // リサイズ時は R3F が aspect を入れ直すので、そのあとで向きを取り直す
  const size = useThree((state) => state.size);
  const [px, py, pz] = position;
  const [tx, ty, tz] = target;

  useLayoutEffect(() => {
    const camera = get().camera as THREE.PerspectiveCamera;
    camera.fov = fov;
    camera.near = near;
    camera.far = far;
    camera.position.set(px, py, pz);
    camera.lookAt(tx, ty, tz);
    camera.updateProjectionMatrix();
  }, [get, size, fov, near, far, px, py, pz, tx, ty, tz]);

  return null;
}

/**
 * ピント面を対象メッシュに合わせる。
 *
 * モニターはポインターに合わせて回るので距離が毎フレーム変わる。
 * focusDistance を React の prop で渡すと DepthOfField が作り直されてしまうので、
 * 効果の cocMaterial を直接書き換える。
 */
function FocusRig({
  mode,
  offset,
  manual,
  showMarker,
  distanceRef,
  dofRef,
  aperture,
}: {
  mode: FocusMode;
  offset: number;
  manual: number;
  showMarker: boolean;
  distanceRef: React.RefObject<number>;
  dofRef: React.RefObject<DepthOfFieldEffect | null>;
  aperture: { sensor: SensorName; focalLength: number; fNumber: number; unitMM: number };
}) {
  const get = useThree((state) => state.get);
  const markerRef = useRef<THREE.Mesh>(null);
  // 毎フレーム new しないよう使い回す
  const [center] = useState(() => new THREE.Vector3());
  const [size] = useState(() => new THREE.Vector3());
  const [localCamera] = useState(() => new THREE.Vector3());
  const [inverse] = useState(() => new THREE.Matrix4());
  const [point] = useState(() => new THREE.Vector3());

  useFrame(() => {
    const { camera, scene } = get();
    const nodeName = mode === 'manual' ? null : FOCUS_NODES[mode];
    const mesh = nodeName ? (scene.getObjectByName(nodeName) as THREE.Mesh | undefined) : undefined;

    if (mesh?.geometry) {
      // geometry.boundingBox はジオメトリ空間（＝メッシュのローカル）。
      // 一度計算すれば three.js が持ち続けるので毎フレームの頂点走査は起きない
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const localBox = mesh.geometry.boundingBox!;
      localBox.getCenter(center);
      localBox.getSize(size);
      point.copy(center);

      // 液晶のような板なら、板の表面のまんなかを狙いたい。
      // いちばん薄い軸が板の厚み方向なので、その面へ中心をずらす。
      // 「6面のうちカメラに近いもの」で選ぶと、首を振ったとき横に長い面の中心が
      // 先に近づいて画面の端へ飛ぶので、軸は形から決める
      const extents = [size.x, size.y, size.z];
      const thin = extents.indexOf(Math.min(...extents));
      const others = extents.filter((_, i) => i !== thin);
      const isPlate = extents[thin] * 2 < Math.min(...others);

      if (isPlate) {
        // 板の裏表どちらを向いているかはカメラ位置をローカルへ移して判断する
        localCamera.copy(camera.position).applyMatrix4(inverse.copy(mesh.matrixWorld).invert());
        const half = extents[thin] / 2;
        const towardCamera = localCamera.getComponent(thin) > center.getComponent(thin) ? half : -half;
        point.setComponent(thin, point.getComponent(thin) + towardCamera);
      }
      point.applyMatrix4(mesh.matrixWorld);
    } else {
      // 手動：視線方向に指定距離だけ進んだ点
      camera.getWorldDirection(point).multiplyScalar(manual).add(camera.position);
    }

    const distance = Math.max(camera.position.distanceTo(point) + offset, 0.05);
    distanceRef.current = distance;
    if (markerRef.current) markerRef.current.position.copy(point);

    const dof = dofRef.current;
    if (dof) {
      const { sensor, focalLength, fNumber, unitMM } = aperture;
      const limits = depthOfField(sensor, focalLength, fNumber, distance * unitMM);
      // focusRange は「そこまで離れると完全にボケる」半幅。被写界深度の
      // 手前側と奥側の狭いほうを採るので、絞るほど素直に効きが弱くなる
      const nearSide = distance * unitMM - limits.near;
      const farSide = limits.far === Infinity ? Infinity : limits.far - distance * unitMM;
      dof.cocMaterial.focusDistance = distance;
      dof.cocMaterial.focusRange = Math.max(Math.min(nearSide, farSide) / unitMM, 0.001);
    }
  });

  if (!showMarker) return null;
  return (
    <mesh ref={markerRef} renderOrder={999}>
      <sphereGeometry args={[0.03, 16, 16]} />
      <meshBasicMaterial color='#00e5ff' depthTest={false} toneMapped={false} />
    </mesh>
  );
}

/**
 * 調整パネルを出すかどうか。
 * ローカルの開発サーバーでは常に出す。ビルド済み（Vercel のプレビューなど）では
 * URL に ?leva を付けたときだけ出すので、公開ページには出てこない。
 *
 * useSyncExternalStore を使うのは、サーバー側で描いた HTML と食い違わせないため。
 * サーバーでは必ず false、クライアントでは URL を見た結果を返す。
 */
const noopSubscribe = () => () => {};
const readLevaVisible = () =>
  process.env.NODE_ENV !== 'production' || new URLSearchParams(window.location.search).has('leva');
const levaHiddenOnServer = () => false;

function useLevaVisible() {
  return useSyncExternalStore(noopSubscribe, readLevaVisible, levaHiddenOnServer);
}

export function CanvasPC({
  ref,
  hoveredKey,
  onReady
}: {
  ref?: React.RefObject<Group | null>;
  hoveredKey: string | null;
  onReady?: () => void;
}) {
  const camera = useProductCamera();
  const levaVisible = useLevaVisible();
  const dofRef = useRef<DepthOfFieldEffect>(null);

  return (
    <>
      <Leva hidden={!levaVisible} titleBar={{ title: 'PC カメラ' }} />
      <div className='fixed inset-0 z-30 pointer-events-none'>
        <Canvas
          // near/far は被写体の周りだけに絞る。パースは深度バッファが非線形なので、
          // 既定の 0.1〜1000 のままだと精度が落ちて N8AO の陰りが荒れる
          camera={INITIAL_CAMERA}
          shadows='soft'
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
          onCreated={({ gl }) => { gl.outputColorSpace = THREE.SRGBColorSpace; gl.setPixelRatio(1); }}
        >
          <ProductCamera
            fov={camera.fov}
            position={camera.position}
            target={camera.target}
            near={camera.near}
            far={camera.far}
          />

          <Environment resolution={512} background={false}>
            {/* 背景*/}
            <color attach='background' args={['#050505']} />

            {/* 主光源のソフトボックス：左手前・大きく縦長 */}
            <Lightformer form='rect' intensity={4.5} position={[-6, 2, 2.5]} rotation={[0, Math.PI / 2.6, 0]} scale={[6, 8, 1]} color='#ffffff' />
            {/* 天井のトップライト：上面をなだらかに起こす横長の板 */}
            <Lightformer form='rect' intensity={7} position={[-1, 7, 0.5]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 8, 1]} color='#f2f6ff' />

            {/* 右側のごく弱い板：影側が完全に潰れないための最小限の反射 */}
            <Lightformer form='rect' intensity={0.12} position={[5.5, 1, 2]} rotation={[0, -Math.PI / 2.6, 0]} scale={[5, 6, 1]} color='#9fb0c6' />

            {/* 背後のリム用ストリップ：エッジに細い光の線を作る */}
            <Lightformer form='rect' intensity={6} position={[3, 2.5, -5]} rotation={[0, Math.PI, 0]} scale={[0.6, 8, 1]} color='#ffffff' />
            <Lightformer form='rect' intensity={3} position={[-3.5, 2, -5]} rotation={[0, Math.PI, 0]} scale={[0.5, 7, 1]} color='#dfe8f5' />
          </Environment>

          <spotLight
            position={[-5, 4, 3.5]}
            angle={1.0}   
            penumbra={0.1}
            decay={2}
            distance={40}
            intensity={190}
            color='#ffffff'
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.5}
            shadow-camera-far={35}
            shadow-bias={-0.0004}
            shadow-normalBias={0.015}
            shadow-radius={1}
          />

          <ambientLight intensity={0.02} />

          <Suspense fallback={null}>
            <PC groupRef={ref} hoveredKey={hoveredKey} onReady={onReady} />
            <ContactShadows position={[0, -1.5, 0]} opacity={0.7} scale={12} blur={1.6} far={4} resolution={512} color='#000000' />
            {/* モデルが出そろってからでないとモニターのノードを探せない */}
            <FocusRig
              mode={camera.focus.mode}
              offset={camera.focus.offset}
              manual={camera.focus.manual}
              showMarker={camera.focus.marker}
              distanceRef={camera.focus.distanceRef}
              dofRef={dofRef}
              aperture={camera.aperture}
            />
            <Preload all />
          </Suspense>

          {/*
            EffectComposer の children は JSX.Element しか受けないので、
            絞りによるボケ（F8〜F16 の想定では効かないため既定はオフ）は
            空フラグメントで出し入れする
          */}
          <EffectComposer>
            <N8AO aoRadius={0.35} intensity={2.4} distanceFalloff={0.8} quality='medium' color='#000000' />
            {/* focusDistance / focusRange は FocusRig が毎フレーム直接書き込む */}
            {camera.dof.enabled ? (
              <DepthOfField ref={dofRef} bokehScale={camera.dof.bokehScale} />
            ) : (
              <></>
            )}
            <Bloom intensity={0.1} luminanceThreshold={1} luminanceSmoothing={1} radius={0.1} mipmapBlur />
          </EffectComposer>
        </Canvas>
      </div>
    </>
  );
}
