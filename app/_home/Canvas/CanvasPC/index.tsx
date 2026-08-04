'use client';

// React
import { Suspense } from 'react';
// THREE
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, Preload } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
// コンポーネント
import { PC } from './Model';
import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing';

export function CanvasPC({
  ref,
  hoveredKey,
  onReady
}: {
  ref?: React.RefObject<Group | null>;
  hoveredKey: string | null;
  onReady?: () => void;
}) {
  return (
    <div className='fixed inset-0 z-30 pointer-events-none'>
      <Canvas
        orthographic camera={{ position: [0, -0.2, 3], zoom: 450 }}
        shadows='soft'
        // ACESFilmic：ハイライトが白飛びせず滑らかに落ちる映画用のトーンカーブ。
        // これが無いと明部が真っ白に潰れて「CGっぽさ」の主因になる
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        onCreated={({ camera, gl }) => {
          camera.lookAt(0, 0.6, 0);
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        {/* ==== 環境（映り込みの素） ====================================
            プリセットHDRIをやめ、自分で組んだ「スタジオ」を環境として使う。
            Lightformer は HDRI に焼き込まれる発光板＝実際のソフトボックス。
            光沢面にこの板が映り込むことで、初めて「そこに照明がある」立体感が出る。
            environmentIntensity ではなく板の配置で明暗を作るのがポイント。 */}
        <Environment resolution={512} background={false}>
          {/* 背景は暗く保つ（黒ホリゾント） */}
          <color attach='background' args={['#050505']} />

          {/* 主光源のソフトボックス：左手前・大きく縦長。
              大きい面光源ほど影が柔らかく、ハイライトが帯状に伸びる */}
          <Lightformer
            form='rect'
            intensity={4.5}
            position={[-6, 2, 2.5]}
            rotation={[0, Math.PI / 2.6, 0]}
            scale={[6, 8, 1]}
            color='#ffffff'
          />

          {/* 天井のトップライト：上面をなだらかに起こす横長の板。
              真上に大きく置くことで、上面が均一に明るくなる */}
          <Lightformer
            form='rect'
            intensity={7}
            position={[-1, 7, 0.5]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[12, 8, 1]}
            color='#f2f6ff'
          />

          {/* 右側のごく弱い板：影側が完全に潰れないための最小限の反射 */}
          <Lightformer
            form='rect'
            intensity={0.12}
            position={[5.5, 1, 2]}
            rotation={[0, -Math.PI / 2.6, 0]}
            scale={[5, 6, 1]}
            color='#9fb0c6'
          />

          {/* 背後のリム用ストリップ：エッジに細い光の線を作る */}
          <Lightformer
            form='rect'
            intensity={6}
            position={[3, 2.5, -5]}
            rotation={[0, Math.PI, 0]}
            scale={[0.6, 8, 1]}
            color='#ffffff'
          />
          <Lightformer
            form='rect'
            intensity={3}
            position={[-3.5, 2, -5]}
            rotation={[0, Math.PI, 0]}
            scale={[0.5, 7, 1]}
            color='#dfe8f5'
          />
        </Environment>

        {/* ==== 影を落とすための実ライト ================================
            Lightformer は映り込みと拡散光は作るが影は落とさないため、
            影の方向を決める1灯だけを別に置く（多灯にすると影が濁る）。 */}
        <spotLight
          position={[-5, 4, 3.5]}
          angle={1.0}           // 照射範囲。狭いと影が途中で切れる
          penumbra={0.4}        // 下げるほど影の輪郭がはっきりする（0=完全にシャープ）
          decay={2}
          distance={40}
          intensity={190}
          color='#ffffff'
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={35}   // 範囲を絞るほど影の解像度が上がる
          shadow-bias={-0.0004}
          shadow-normalBias={0.015}
          shadow-radius={3}   // ぼかし半径。小さいほど影がくっきり
        />

        {/* 全体の底上げ。ゼロにすると暗部が「黒つぶれ」して情報が消える */}
        <ambientLight intensity={0.02} />

        <Suspense fallback={null}>
          <PC groupRef={ref} hoveredKey={hoveredKey} onReady={onReady} />

          {/* 接地影：床が無いと物体が「浮いて」見えるため、
              真下に落ちる柔らかい影だけを疑似的に敷いて接地感を作る */}
          <ContactShadows
            position={[0, -1.5, 0]}   // 台座の底面の高さに合わせる
            opacity={0.7}             // 接地部のにじみ担当。落ち影は床の shadowMaterial が描く
            scale={12}                // 影を計算する範囲
            blur={1.6}                // ぼかし。大きいほど柔らかい
            far={4}                   // この距離までの物体を影に含める
            resolution={512}
            color='#000000'
          />

          <Preload all />
        </Suspense>

        <EffectComposer>
          {/* 環境光遮蔽：継ぎ目やパネルの隙間に光が入り込まない暗がりを作る。
              これが無いと全面が均一に照らされ「模型っぽさ」が残る */}
          <N8AO
            aoRadius={0.35}
            intensity={2.4}
            distanceFalloff={0.8}
            quality='medium'
            color='#000000'
          />
          {/* ブルーム：画面の発光だけを軽く滲ませる。強いと安っぽくなる */}
          <Bloom intensity={0.35} luminanceThreshold={1.05} luminanceSmoothing={0.4} radius={0.5} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
