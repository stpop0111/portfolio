# 3Dレンダリングを「本物」に近づける設計ノート

React Three Fiber で Apple の製品CMのような質感を出すための知見をまとめたもの。
このプロジェクトの `app/_home/Canvas/CanvasPC/` に実装済み。

**きっかけ**: 3点ライティングを組んだが「Blender初心者がEeveeでレンダリングした画像」のようなチープさが残った。
原因を調べたところ、CGが偽物に見えるのは1つの致命的ミスではなく、**小さな手抜きの積み重ね**だと判明した。

---

## CGが「偽物」に見える5つの原因

出典: [Why Your 3D Product Renders Look Fake](https://www.360render.com/3d-rendering/why-your-3d-product-renders-look-fake-5-common-lighting-and-material-mistakes/)

### ① HDRIを置きっぱなしにする

HDRIの明るい領域（太陽・ソフトボックス・窓）が**実際のキーライト**になる。
その位置が影の落ち方・ハイライトの出方・映り込みを決める。

光沢面では**映り込みが物体の形を規定する**ため、無自覚に配置すると製品が「形なく」見える。

> HDRIだけに頼ることが、商業製品レンダーが「洗練されていない」最大の理由

**対策**: HDRIプリセットに頼らず、`Lightformer` で意図的に照明を配置する。

### ② 物理的に間違ったマテリアル値

PBRでは全マテリアルが実世界の光学特性で定義される。推測で値を決めると脳が拒否する。

| 症状 | 原因 |
|---|---|
| プラスチックがゴムに見える | roughness が高すぎ、スペキュラハイライトが未定義 |
| 金属がスプレー塗装に見える | 反射率MAXで表面のばらつきがゼロ |
| ガラスが水に見える | IOR が誤り、エッジの暗さがない |

**重要**: 誘電体（非金属）の垂直入射反射率は**物理定数**であって芸術的好みではない。
「高級感を出すため」にプラのスペキュラを盛ると、物理的整合性が壊れて即座に見抜かれる。

### ③ 接地影とAOの不足

影は装飾ではなく**物理的関係を伝える情報**。物体の重さ、床からの距離、光の質を示す。

- 小さな点光源 → 硬い縁の芝居がかった影
- 大きな面光源 → 実際の製品写真のような柔らかい減衰

**AOを切るのは目に見える失敗**。継ぎ目の奥、パーツの間に光が閉じ込められる現象が消えると、
現実には存在しない「均一に照らされた」状態になる。

### ④ 表面が完璧すぎる

実際の製品は完璧ではない。
- ブラシ仕上げのアルミには製造時の微細な傷
- 射出成形プラには金型由来の微細な質感
- ガラス画面には取り扱いの痕跡

これらは欠陥ではなく**物体が実在する証拠**。
狙いは「使い込まれた製品」ではなく「物理的にありえる製品」。通常の視距離で気づかない程度が正解。

### ⑤ 光源間の色温度の不一致

実際のスタジオでは全光源が色を合わせるか、意図的に対比させている。
暖色と寒色を無自覚に混ぜると、影に緑やマゼンタの妙な被りが出る。

**原則**: キーライトの色温度を決め、フィルをそれに合わせる。
対比させるなら「意図的なスタイライズ」として明示する。

---

## R3F での実装

### 1. トーンマッピング（最初にやる価値が高い）

```tsx
<Canvas
  gl={{
    antialias: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.15,
  }}
  onCreated={({ gl }) => { gl.outputColorSpace = THREE.SRGBColorSpace; }}
>
```

**ACESFilmic** は映画業界標準のトーンカーブ。ハイライトが白飛びせず滑らかに落ちる。
デフォルト（線形）だと明部が真っ白に潰れ、これが「CGっぽさ」の大きな要因になる。

`toneMappingExposure` が全体の露出。**明るさ調整はライトの intensity より先にここを触る**。

### 2. Lightformer でスタジオを組む

`Lightformer` は **HDRIに焼き込まれる発光板** = 仮想のソフトボックス。
光沢面にこの板が帯状に映り込むことで「照明が存在する空間」に見える。

```tsx
<Environment resolution={512} background={false}>
  <color attach='background' args={['#050505']} />

  {/* 主ソフトボックス：大きい面ほど影が柔らかく、ハイライトが帯状に伸びる */}
  <Lightformer form='rect' intensity={4.5}
    position={[-6, 2, 2.5]} rotation={[0, Math.PI / 2.6, 0]} scale={[6, 8, 1]} />

  {/* トップライト：上面をなだらかに起こす */}
  <Lightformer form='rect' intensity={4}
    position={[0, 6, 1]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 6, 1]} />

  {/* 影側の弱い板：完全に潰さないための最小限の反射 */}
  <Lightformer form='rect' intensity={0.7}
    position={[5.5, 1, 2]} rotation={[0, -Math.PI / 2.6, 0]} scale={[5, 6, 1]} />

  {/* リム用の細いストリップ：エッジに光の線を作る */}
  <Lightformer form='rect' intensity={6}
    position={[3, 2.5, -5]} rotation={[0, Math.PI, 0]} scale={[0.6, 8, 1]} />
</Environment>
```

**設計の考え方**
- 板の**大きさ** = 影の柔らかさ（大きいほど柔らかい）
- 板の**位置** = ハイライトがどこに乗るか
- 板の**intensity** = 明暗比

`environmentIntensity` で全体を上下させるのではなく、**板ごとの配置で明暗を作る**のが要点。

### 3. 影は1灯だけで作る

Lightformer は映り込みと拡散光を作るが**影は落とさない**。影の方向を決める1灯を別に置く。

```tsx
<spotLight
  position={[-6, 5.5, 2]}
  angle={0.9}
  penumbra={1}          // 1 = 面光源相当の完全にぼけた縁
  decay={2}             // 物理的に正しい逆二乗減衰
  distance={30}
  intensity={75}        // decay=2 では大きな値が必要
  castShadow
  shadow-mapSize-width={2048}
  shadow-mapSize-height={2048}
  shadow-bias={-0.0005}
  shadow-normalBias={0.02}
  shadow-radius={10}
/>
```

**多灯で castShadow すると影が濁る**。影を落とすのは1灯に絞る。

`decay={2}` は距離の逆二乗で減衰する物理挙動。光源から遠い側が自然に暗くなる
（キアロスクーロの「エンジン」）。ただし intensity は桁が変わる（3 → 100前後）。

### 4. マテリアルを物理値に寄せる

```tsx
new MeshPhysicalMaterial({
  roughness: 0.34,        // 0.35前後 = サラサラした樹脂。低すぎ=鏡、高すぎ=ゴム
  metalness: 0,           // 非金属は必ず 0（中間値は物理的にありえない）
  reflectivity: 0.5,      // 誘電体の基準値。盛ると安っぽい光沢になる
  clearcoat: 0.35,        // 成形品に残る薄いコート層
  clearcoatRoughness: 0.35,
  sheen: 0.05,            // 微細な起伏。完璧に平らな面は現実に存在しない
  sheenRoughness: 0.9,
  envMapIntensity: 1.15,  // 環境の映り込み量
})
```

**metalness は 0 か 1**。「両方の性質を少し」と中間値にするのは物理的破綻。

### 5. AO と接地影

```tsx
{/* 継ぎ目やパネルの隙間に暗がりを作る */}
<N8AO aoRadius={0.35} intensity={2.4} distanceFalloff={0.8} quality='medium' />

{/* 床メッシュを置かずに接地感だけ得る */}
<ContactShadows position={[0, -1.5, 0]} opacity={0.85} scale={12} blur={2.8} far={4} />
```

床が無いシーンでは、物体が「浮いて」見える。`ContactShadows` は真下に落ちる柔らかい影だけを
疑似的に描くので、暗い背景と相性がいい。

### 6. ブルームは控えめに

```tsx
<Bloom intensity={0.35} luminanceThreshold={1.05} luminanceSmoothing={0.4} radius={0.5} mipmapBlur />
```

強いブルームは安っぽさの元。`luminanceThreshold` を 1 以上にして
**本当に発光している部分（画面など）だけ**を滲ませる。`mipmapBlur` で滲みが自然になる。

---

## ライティングの基礎知識

### 3点ライティング

| ライト | 役割 | 位置 | 強さ |
|---|---|---|---|
| キー | 主光源。陰影の形を決める | 45度（15〜70度の範囲） | 全光量の約3/4 |
| フィル | 影を柔らかくする | キーの反対側、同程度の角度 | キーの1/2 |
| リム | 輪郭を光らせ背景から分離 | 被写体の真後ろ、やや上 | フィルと同程度 |

**キー:フィル比**が印象を決める。
- 2:1 → 明るく商業的
- 4:1 → やや劇的
- 8:1〜20:1 → キアロスクーロ（劇的・高級感）

### キアロスクーロ（明暗対比法）

伊: chiaro（明）+ scuro（暗）。ルネサンス絵画由来の技法で、
ラグジュアリーブランド・宝飾・香水・家電の撮影で定番。

**要点**
1. **光源をほぼ真横（90度）に置く** — 斜め前からだと全面が明るくなり左右差が出ない
2. **距離減衰を活かす** — 光源からの距離が2倍になると光量は75%失われる。この指数関数的減衰が対比の原動力
3. **環境光を絞る** — 環境光が強いと影が起き、対比が消える

> フラットな均一照明と違い、キアロスクーロは視覚的ノイズを取り除き、
> 製品のデザインそのものを主役にする

---

## 調整の指針

| したいこと | 触る値 |
|---|---|
| 全体の明るさ | `toneMappingExposure` |
| 映り込みを強く | 主 Lightformer の `intensity` / マテリアルの `envMapIntensity` |
| 影側を暗く | 影側 Lightformer の `intensity` を下げる |
| 影を柔らかく | spotLight の `penumbra` を 1 へ / Lightformer の `scale` を大きく |
| 質感をマットに | `roughness` を上げる（0.5〜0.7） |
| 隙間の暗がりを強く | `N8AO` の `intensity` |

---

## 品質チェックの基準

> このレンダーを印刷して実物の隣に置いたとき、見分けるのに二度見が必要か？

Yes なら物理的な不整合がどこかにある。最も目立つ違和感から遡ると、
上記5つの原因のどれかに必ず行き着く。

---

## 参考

- [Why Your 3D Product Renders Look Fake — 360 Render](https://www.360render.com/3d-rendering/why-your-3d-product-renders-look-fake-5-common-lighting-and-material-mistakes/)
- [Chiaroscuro Photography for Modern Product Design](https://elenavelsstudio.com/chiaroscuro-lighting-borrowing-renaissance-techniques-for-modern-products/)
- [Three-Point Lighting: Key, Fill & Rim — StudioBinder](https://www.studiobinder.com/blog/three-point-lighting-setup/)
- [DIY Low-Key Product Photography](https://www.davidhaydenphoto.com/post/diy-low-key-product-photography-engineer-dramatic-chiaroscuro-with-simple-light)
