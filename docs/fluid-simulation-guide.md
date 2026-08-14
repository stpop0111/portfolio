# レッスン：波紋のヒーローを作る — GPU流体 × Three.js

> ポートフォリオのファーストビュー（GPU流体で歪む幾何学グリッド／ガラスのキーキャップ／伸縮するカーソル）を **ゼロから同じものを再現できる** ように解説する、フロントエンド中級者向けのレッスンです。
> 本文の解説に加え、末尾の「付録A：完全なソースコード」に **関係ファイルの全文** をそのまま収録しています。写経・移植の際はそちらを正とし、違うものにならないようにしてください。

---

## このレッスンについて

| 項目 | 内容 |
|---|---|
| 対象 | React / GSAP に慣れたフロント中級者。r3f・WebGL の流体シミュは初めてでもOK |
| 学ぶこと | GPU流体シミュレーション（速度場）の実装と、それを使って絵を歪ませる手法。r3fの描画横取り、カスタムカーソル、ガラスマテリアル、登場演出のタイミング設計、WebGLのデバッグ術 |
| 技術 | Next.js 16 (App Router) / React 19 / Three.js + @react-three/fiber / 生WebGL2シェーダー / GSAP + MorphSVG / leva |
| 成果物 | カーソルで波紋のように歪むヒーローセクション |
| 前提知識 | TypeScript / React hooks / GSAP timeline の基礎。線形代数は「隣を読んで引き算＝微分」程度の直感で読めます |

### 依存パッケージ

```
three @react-three/fiber @react-three/drei @react-three/postprocessing
gsap @gsap/react
lenis leva blobs
```

GSAP の `MorphSVGPlugin` は有料プラグイン（Club GreenSock）です。カーソルの旧実装で使っていましたが、**最終版のカーソルは MorphSVG 不要**（プレーンな円 + scale のみ）。ContactMe など他画面で使っている場合のみ必要です。

---

## 学習ゴール

1. 「流体シミュレーション」を **速度場（velocity field）という1枚のテクスチャ** として理解し、curl→vorticity→divergence→pressure→gradient→advect のパイプラインを自分で書ける
2. その速度場を使って、**任意の絵（2Dグリッド／3D文字）を歪ませる** DISPLAY シェーダーを共有し、見た目を1箇所で揃える
3. r3f の canvas を `preserveDrawingBuffer` で横取りし、3Dの描画結果を流体で歪ませる
4. WebGLの「エラーは出ないのに動かない」を、`readPixels` などで **段階的に切り分ける** 手を持つ

---

## 全体設計：1つの流体、2つの利用者

このヒーローの肝は「**WebGL2で流体（速度場）を毎フレーム計算し、その速度場で別の絵を歪ませる**」こと。歪ませる絵は2種類あります。

- **背景の幾何学グリッド** … 2Dキャンバスに線を描いてテクスチャ化し、流体で歪ませる
- **3Dタイトル「Port/olio」** … react-three-fiber で描いた文字を毎フレーム取り込み、同じ流体で歪ませる

流体計算そのものは共通化して `fluidSim.ts` に切り出し、背景（`FluidGridBackground`）とタイトル（`FluidTitleWarp`）が同じクラス・シェーダーを使い回します。歪みの強さなどは `FLUID_PARAMS` 一箇所で管理するので、両者の見た目が必ず揃います。

### ファイル構成（本レッスンの対象）

| パス | 役割 |
|---|---|
| `app/_home/FluidGridBackground/fluidSim.ts` | 流体シミュ本体。シェーダー群 + `FluidSim`クラス + WebGLヘルパー + `DISPLAY` |
| `app/_home/FluidGridBackground/index.tsx` | 背景グリッドを描いて歪ませる。leva・パララックスもここ |
| `app/_home/FluidGridBackground/FluidTitleWarp.tsx` | `CanvasTitle`の描画を取り込んで歪ませるオーバーレイ |
| `app/_components/CustomCursor/index.tsx` | 伸縮する・反転色のカスタムカーソル |
| `app/_home/Canvas/CanvasKey/{index,Model}.tsx` | ガラスのキーキャップ + ラベルのスクロール演出 |
| `app/_components/CanvasTitle/{index,Model}.tsx` | 3Dタイトル文字。歪ませる元絵になる |
| `app/page.tsx` | 全体のオーケストレーション。`phase`状態機械と登場アニメ |

（PCモデル `CanvasPC`、`HeroText`、`Curtains`、`ReloadButton`、`splitText`、`HexToRGB` も付録Aに全文収録しています。）

### フェーズ状態機械

ヒーローは `loading → changing → title → hero` の4段階の `phase` で進行します。流体エフェクトは重いので、**ヒーロー本編（`phase === 'hero'`）に入ってから起動**し、ローディングやカーテン演出中はGPUを回しません。

---

## 第2章：流体シミュの原理 — 速度場を育てる

「流体シミュレーション」と身構えるところですが、やっていることは **画面と同じ形をした低解像度テクスチャ（約160px）に、各ピクセルの「速度ベクトル(x,y)」を格納し、毎フレーム物理っぽく更新していく** だけです。この速度テクスチャを「速度場」と呼びます。

更新は毎フレーム、決まった順序でシェーダーを流します。Stam の "Stable Fluids" を GPU 向けに簡略化した、Navier–Stokes ソルバの定番パイプラインです。

```
curl → vorticity(+ポインタ入力) → divergence → pressure ×4 → gradient → advect
```

- **①②** で渦を作り（②でマウスの動きを速度として注入 = 波紋の発生源）
- **③④⑤** で水らしく整え（押すと周りへ逃げる＝非圧縮性の近似）
- **⑥** で流し＆薄める（なでるのをやめると波紋が消える）

### 2つの道具：texel と ピンポンFBO

- **texel（テクセル）** = `[1/simW, 1/simH]`。テクスチャ上で「1ピクセル隣」を表すUVの刻み幅。隣のセルの値を読む（＝微分をとる）ために全シェーダーが使います。
- **ピンポンFBO** … GPUでは同じテクスチャを読みながら書き込めません。「読み込み用」と「書き込み用」の2枚を用意し、書き終わったら役割を入れ替えます（`[read, write] = [write, read]`）。速度場と圧力場でこの手法を使います。

FBO（フレームバッファオブジェクト）は「画面ではなくテクスチャに描くための描画先」。全ステージは **画面いっぱいの三角形を1枚描く** ことでフラグメントシェーダーを全ピクセルに走らせ、結果を次のFBOへ書き込みます。

### 各ステージの読み方

すべてのシェーダーの骨格は「**中心の上下左右を読んで差をとる＝空間微分**」です。

- **curl** … 隣接セルの速度差で「渦度（回転の強さ）」を測る
- **vorticity** … 渦を自己強調（vorticity confinement）した上で、`uPointerDelta`（カーソル移動量）をマウス周辺にガウス状に足す。**ここが波紋の発生源**
- **divergence** … その点の「湧き出し／吸い込み」量を測る
- **pressure** … 湧き出しを打ち消す圧力を **ヤコビ反復4回** で解く（`PRESSURE_ITERATIONS`）。回数を増やすほど正確だが重い
- **gradient** … 圧力勾配を速度から引き、非圧縮に補正（押すと逃げる挙動）
- **advect** … 速度場自身を「その速度に沿って過去位置から運ぶ」（セミラグランジュ移流）。同時に `uDissipation` で割って減衰

> **Why 0.016** … 各所の `0.016` は「1フレーム ≒ 1/60秒」の固定タイムステップ。可変dtは不安定になりやすいので、演出用途では固定値で十分安定します。

これらのGLSLは付録Aの `fluidSim.ts` に全文あります。まず `VORTICITY` の後半（力の注入）と `ADVECT` の減衰行を読むと、「なでると出て、やめると消える」挙動が掴めます。

---

## 第3章：fluidSim.ts — 共通モジュールに束ねる

シェーダー群とそれを回すロジックを1ファイルに。ポイントは **Reactに一切依存しない純粋なWebGLモジュール** にすること。背景もタイトルも、このクラスを `new` して毎フレーム `step()` を呼ぶだけになります。

要点：

- `FLUID_PARAMS` … 背景・タイトル共通の歪みパラメータ。**生のオブジェクト**なので、シェーダー側は毎フレーム最新値を読むだけ → levaでライブ調整できる（後述）
- `createFBO` … 速度場は小数（マイナスも）を保持するため **RGBA16F（半精度浮動小数）**。これに WebGL2 + `EXT_color_buffer_float` が必須。非対応環境では起動を諦める
- `setupFullscreenTriangle` … 四角形（三角形2枚）ではなく **1枚の特大三角形** で画面を覆う定番テク（頂点3つ）
- `FluidSim` クラス … 8枚のFBO（速度×2・curl・vorticity・divergence・圧力×2・投影後）を持ち、`step()`でパイプラインを1周し、最後に速度FBOをスワップ
- `DISPLAY` シェーダー … シミュ本体とは別。**元絵（グリッド or タイトル）を速度場に沿ってずらして描き**、RGBで少しずつずらし量を変えて色ズレを出す

`DISPLAY` の色ズレ行だけ注意：虹ハイライトを **そのまま加算すると強めた時に白飛び** します。そこで「ハイライトから自身の平均輝度を引いて色相成分だけ足す」ようにしています（付録の該当行、第9章⑥も参照）。

外から見えるのは `step()` と `velocityTex`（現在の速度テクスチャ）だけ。この速度テクスチャを `DISPLAY` に渡して絵を歪ませます。

---

## 第4章：背景グリッド — 2Dで描いてGPUで歪ませる

`FluidGridBackground/index.tsx` は `'use client'` ですが、中身は `useEffect` 内で生WebGLを回す素のcanvasアプリです。

1. オフスクリーンの2Dキャンバスに **幾何学グリッド（細い線＋交点の十字）** を描く
2. それをWebGLテクスチャ `pageTex` にアップロード
3. 毎フレーム `sim.step()` → `DISPLAY` で `pageTex` を速度場で歪ませて画面に出す

要点：

- **グリッドの見た目** は `GRID_PARAMS`（間隔・線の濃さ・十字サイズ・余白・背景色）で調整。levaで変えたら `drawGrid` だけ再実行し、重いシミュ本体は作り直さない
- **ポインタ座標変換** `toSimCoords`：画面座標（左上原点・Y下向き）をシミュUV系（左下原点・Y上向き）へ。**Y反転を忘れると波紋が上下逆に出る**
- **負荷制御** … ①`active`（=`phase==='hero'`）で起動 ②`visibilitychange`でタブ非表示時に停止 ③ロード直後だけ自動で横一線をなぞる導入（`prefers-reduced-motion`で無効）
- **パララックス** … コンテナ全体をカーソル位置に応じて平行移動。**Y軸は反転**（カーソルが下ほどグリッドは上へ）。端が見えないようコンテナを画面より少し大きく（`-inset-14`）しておく

---

## 第5章：タイトルを歪ませる — r3fの描画を横取りする

背景は「自分で描いた2Dグリッド」を歪ませました。タイトルは **r3fが描いた3D文字の描画結果を毎フレームコピーして** 同じ流体で歪ませます。`FluidTitleWarp.tsx` の役目です。

- **3D側の下準備** … r3fのcanvasは既定で描画バッファを毎フレーム破棄するため `drawImage` で読めない。`gl={{ preserveDrawingBuffer: true }}` を付けて保持させる（`CanvasTitle/index.tsx`）
- **毎フレーム合成** … タイトルの実キャンバスを、位置合わせして自分のオフスクリーン2Dキャンバスに焼き込み、テクスチャ化して `DISPLAY` に渡す。歪ませる元絵が「動画」になっただけで背景と同じ流れ
- **透過合成** … 重ねるのでコンテキストは `{ alpha:true, premultipliedAlpha:true }`。`DISPLAY` の premultiplied 出力とここで噛み合う

> このタイトル歪みは実装後まったく効かず、原因究明に丸1日溶かしました。犯人は「非表示ラッパーが3D文字の位置計算を壊していた」件と「速度テクスチャを毎フレーム誤って消していた `gl.clear`」の2つ。第9章に詳細。

---

## 第6章：カーソル — 進行方向に伸び、背景の反転色になる

カスタムカーソルは「線だけの円」。GSAPの `quickTo` で滑らかに追従し、**動いた方向に伸縮** して、色は **背景の反転色** で描きます。

- **方向への伸縮** … 速度に応じて進行方向へ `scaleX` を伸ばし `scaleY` を縮める。伸びは常に1へ戻り続ける減衰付き。`rotate` で伸びる向きを進行方向に合わせる
- **反転色** … `mix-blend-mode: difference` + 白ストローク → 背後の色の反転色で描画される（クリーム上では濃色、暗い要素上では白っぽく）
- **見切れ対策** … `overflow-visible` + `vector-effect: non-scaling-stroke` → 伸びてviewBoxをはみ出しても切れず、線の太さは画面上一定

> **SVGが切れる理由**：SVGは既定で `overflow:hidden`。中身をscaleで拡大するとviewBoxの外がクリップされて欠けます。カーソルが「伸ばすと切れる」ならまずここを疑う。

---

## 第7章：キーキャップ — ガラス質感とラベルのスクロール

4つのナビは3Dのガラスキーキャップ。ホバーでラベルが **1文字ずつ上へスクロールしてオレンジに切り替わり** ます。

- **ガラス質感には「背景」が要る** … drei の `MeshTransmissionMaterial` は透過の先に何もないと **真っ黒**。`background` に色を渡して初めてガラスらしく見える（第9章④）
- **ホバーで色をじわっと（GSAP不使用）** … `useFrame` の中でマテリアル色を毎フレーム `lerp`。r3fは値が変わらないpropsを再適用しないため、**初期色だけpropsで与え、以降はrefで直接動かす**のが安定
- **ラベルのスクロール切り替え** … 各文字を `overflow:hidden` の枠に入れ、中に「通常色／オレンジ」の2段を縦に積む。ホバーで列全体を高さの半分（`yPercent:-50`）動かすと下段のオレンジがせり上がる。1文字ずつ `stagger` でずらすのが味付け

---

## 第8章：登場演出 — カーテンと同期させる

`page.tsx` が全体の指揮者。`phase` 状態機械で「ローディング → 文字がブラーで Port/olio に → カーテンが上へ抜ける → PC・キーキャップ・タイトルがせり上がる」を組みます。

> **症状**：カーテン（140vhの幕）が上へ抜けて画面下端が見え始めるのは開始から約0.5秒後。ところが登場アニメは0秒から始まり先に終わっていたため、「幕が上がったらもう全部並んでいる」状態でした。

**対策**：登場タイムラインに **幕が見え始めるぶんの遅延（`delay: 0.5`）** を足す。`.from()` は `immediateRender` で開始前から初期状態（画面外）を適用するので、遅延中に完成形がチラ見えすることはありません。`'<'` は「直前のトゥイーンと同時開始」の指定で、4つを同時に走らせつつ全体を遅らせています。

---

## 第9章：ハマりどころ — どう切り分けたか

**本レッスンで一番の学び所**。実際に踏んだバグを「症状 → 切り分け → 原因」で残します。WebGLは「エラーは出ないのに何も起きない」ことが多く、切り分けの型を持っているかで解決速度が変わります。

### ① 速度テクスチャを消していた `gl.clear`
- **症状**：背景グリッドは歪むのにタイトルだけ歪まない。エラーなし
- **切り分け**：`checkFramebufferStatus`でFBO正常を確認 → カーソル位置の速度を`readPixels`で数値表示 → 「動いている！」→ **表示の直前で壊れている**と判明
- **原因**：`sim.step()`直後は内部の速度FBOがバインドされたまま。その状態の`gl.clear()`が、画面ではなく**計算したての速度テクスチャをゼロで消していた**。全画面三角形が全ピクセルを上書きするので`clear`自体が不要だった
- **教訓**：「エラーは出ないが結果がゼロ」は、パイプラインのどの段まで正しいかを`readPixels`で1点ずつ覗く。GPUは黙って失敗するので **可視化＝デバッグ**

### ② タイトルが画面上部に張り付く
- **症状**：3Dタイトルを非表示にするため`<div class="fixed inset-0 opacity-0">`で包んだら、中央からズレて最上部へ
- **原因**：ラッパーが、`position:fixed`だがtop/left未指定だった中身の「静的位置の基準」を変え、flexの中央寄せを無効化した
- **対策**：ラッパーをやめ、コンポーネント自身に`visuallyHidden`プロパティを足して本来のクラスに`opacity-0`を付けるだけにした。**DOM構造を足すと位置計算が変わる**の典型例

### ③ SSRハイドレーション不一致（ランダム生成）
- カーソル初期形状を`blobs`のランダム生成で作ったらSSR/CSRで食い違い hydration mismatch。**初期状態は固定文字列**にして一致させ、ゆらぎは`useEffect`（クライアントのみ）で後付け

### ④ ガラスマテリアルが真っ黒
- `MeshTransmissionMaterial`が黒く潰れる → `background`未指定で透過の先に何もないから。色を渡せば解決（第7章）

### ⑤ levaパネルが操作できない
- 調整パネルを`pointer-events-none`なコンテナの中に置き、クリックを継承で殺していた。パネルはコンテナの外に出す。**操作できないUIはまず祖先の`pointer-events`を疑う**

### ⑥ 色ズレを強めると白飛び
- 虹ハイライトを単純加算していたため白へ飽和。**ハイライトから自身の平均輝度を引き、色相成分だけ**足すよう変更（`DISPLAY`の該当行）

### ⑦ 大文字小文字とビルド環境
- `import ... from './SplitText'`なのに実体は`splitText.tsx`。macOSでは通るがVercel（Linux・大小区別）では*Module not found*でビルド全体が落ちる。**ローカルで通ってCIで落ちる定番**。ファイル名の大小は必ず一致させる

---

## 第10章：調整パネル(leva)とまとめ

`leva` を付けると **コードを触らずブラウザ上で波紋の強さ・グリッドの見た目をライブ調整** できます。`FLUID_PARAMS`・`GRID_PARAMS` は生オブジェクトなので、levaの値を `Object.assign` で流し込むだけ。シミュ側は毎フレーム最新値を読むので即反映。

> 本番では leva を隠す／外す前提。**祖先に `pointer-events-none` を持たせない**のだけ忘れずに（第9章⑤）。

### 再現の最短ルート（おさらい）

1. `fluidSim.ts` を作る：シェーダー群 + `FluidSim` + `DISPLAY` + WebGLヘルパー（付録A）
2. `FluidGridBackground`：2Dグリッドを描き、`sim.step()`→`DISPLAY`で歪ませる
3. r3fタイトルに `preserveDrawingBuffer`、`FluidTitleWarp` で取り込んで歪ませる
4. カーソル・キーキャップを足す
5. `page.tsx` の `phase` と登場アニメで束ねる
6. 詰まったら第9章の切り分け型を使う

### 発展課題

- シミュ解像度 `SIM_RES` を上げ下げして負荷と質感の関係を体感する
- `PRESSURE_ITERATIONS` を1〜8で変えて水らしさの違いを見る
- タイトルのガラスに実際のページ背景を映り込ませる（現状は固定色。`MeshTransmissionMaterial` の作り替えが必要な発展テーマ）

---

# 付録A：完全なソースコード

> 以下は実リポジトリのファイルを **そのまま** 収録したものです。写経・移植の際はこれを正としてください。パスは `app/` からの相対です。


## `app/_home/FluidGridBackground/fluidSim.ts`

```ts
// 背景グリッドとタイトルの歪みで共有する流体シミュレーション本体。
// curl → vorticity(+ポインタ入力) → divergence → pressure×4 → gradient → advect

export type FBO = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };
export type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
export type FluidParams = { curlStrength: number; radius: number; dissipation: number };

// 背景グリッドとタイトルで共通の歪みパラメータ(見た目の強さを統一するため一箇所で管理)
export const FLUID_PARAMS = {
  strength: 0.27,
  radius: 0.7,
  dissipation: 1.2,
  curlStrength: 21,
  chromatic: 1.3,
};

export const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const CURL = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
in vec2 vUv;
out vec4 fragColor;
void main(){
  float left   = texture(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).y;
  float right  = texture(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).y;
  float top    = texture(uVelocity, vUv + vec2(0.0, uTexelSize.y)).x;
  float bottom = texture(uVelocity, vUv - vec2(0.0, uTexelSize.y)).x;
  fragColor = vec4(0.5 * (right - left - top + bottom), 0.0, 0.0, 1.0);
}`;

const VORTICITY = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexelSize;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform vec2 uPointerDelta;
uniform float uCurlStrength;
uniform float uSplatRadius;
uniform float uSplatForce;
in vec2 vUv;
out vec4 fragColor;
void main(){
  float left   = abs(texture(uCurl, vUv - vec2(uTexelSize.x, 0.0)).x);
  float right  = abs(texture(uCurl, vUv + vec2(uTexelSize.x, 0.0)).x);
  float top    = abs(texture(uCurl, vUv + vec2(0.0, uTexelSize.y)).x);
  float bottom = abs(texture(uCurl, vUv - vec2(0.0, uTexelSize.y)).x);
  float center = texture(uCurl, vUv).x;

  vec2 force = vec2(top - bottom, right - left);
  float len = length(force);
  force = len > 0.0001 ? force / len : vec2(0.0);
  force *= uCurlStrength * center;
  force.y *= -1.0;

  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity += force * 0.016;
  velocity = clamp(velocity, vec2(-1000.0), vec2(1000.0));

  vec2 mouseUv = uPointer / max(uResolution, vec2(0.0001));
  vec2 diff = vUv - mouseUv;
  diff.x *= uResolution.x / max(uResolution.y, 0.0001);
  float mask = exp(-dot(diff, diff) / max(uSplatRadius, 0.0001));
  velocity += (uPointerDelta / max(uResolution, vec2(0.0001))) * mask * uSplatForce;

  fragColor = vec4(velocity, 0.0, 1.0);
}`;

const DIVERGENCE = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
in vec2 vUv;
out vec4 fragColor;
void main(){
  float left   = texture(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
  float right  = texture(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
  float top    = texture(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
  float bottom = texture(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
  fragColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
}`;

const CLEAR = `#version 300 es
precision highp float;
out vec4 fragColor;
void main(){ fragColor = vec4(0.0); }`;

const PRESSURE = `#version 300 es
precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;
in vec2 vUv;
out vec4 fragColor;
void main(){
  float left   = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float right  = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float top    = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float bottom = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float div = texture(uDivergence, vUv).x;
  fragColor = vec4((left + right + top + bottom - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform sampler2D uPressure;
uniform vec2 uTexelSize;
in vec2 vUv;
out vec4 fragColor;
void main(){
  float left   = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float right  = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float top    = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float bottom = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity -= vec2(right - left, top - bottom);
  fragColor = vec4(velocity, 0.0, 1.0);
}`;

const ADVECT = `#version 300 es
precision highp float;
uniform sampler2D uProjectedVelocity;
uniform vec2 uTexelSize;
uniform float uDissipation;
in vec2 vUv;
out vec4 fragColor;
void main(){
  vec2 velocity = texture(uProjectedVelocity, vUv).xy;
  vec2 coord = clamp(vUv - velocity * uTexelSize * 0.016, 0.0, 1.0);
  vec2 advected = texture(uProjectedVelocity, coord).xy;
  advected /= 1.0 + uDissipation * 0.016;
  fragColor = vec4(advected, 0.0, 1.0);
}`;

// tDiffuse を速度マップで歪ませて表示する共通シェーダー(色ズレ付き)
export const DISPLAY = `#version 300 es
precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D uVelocity;
uniform vec2 uSimSize;
uniform float uDisplacementStrength;
uniform float uChromaticBoost;
in vec2 vUv;
out vec4 fragColor;

vec3 spectrum(float x){
  return cos((x - vec3(0.0, 0.5, 1.0)) * vec3(0.6, 1.0, 0.5) * 3.14);
}

void main(){
  vec2 velocity = texture(uVelocity, vUv).xy;
  vec2 displacement = velocity / max(uSimSize, vec2(1.0)) * uDisplacementStrength;
  float mag = length(displacement);

  const int SAMPLES = 4;
  vec4 color = vec4(0.0);
  vec3 weightSum = vec3(0.0);

  for (int i = 0; i < SAMPLES; i++) {
    float t = float(i) / float(SAMPLES - 1);
    vec3 weight = max(vec3(0.0), cos((t - vec3(0.0, 0.5, 1.0)) * 3.14159 * 0.5));
    vec4 s = texture(tDiffuse, clamp(vUv - displacement * 0.3 * (t + 0.3) * mag, 0.0, 1.0));
    color += s * vec4(weight, (weight.x + weight.y + weight.z) / 3.0);
    weightSum += weight;
  }
  color.rgb /= max(weightSum, vec3(0.0001));
  color.a /= max((weightSum.x + weightSum.y + weightSum.z) / 3.0, 0.0001);

  // 平均を引いて色相だけをずらす(そのまま足すと強めた時に白く飛んでしまう)
  vec3 highlight = spectrum(sin(mag * 2.0) * 0.4 + 0.6);
  vec3 tint = highlight - vec3(dot(highlight, vec3(0.3333)));
  color.rgb += tint * smoothstep(0.2, 0.8, mag) * 0.35 * uChromaticBoost;

  // 透過キャンバス合成のためにpremultiplied alphaで出力
  fragColor = vec4(color.rgb * color.a, color.a);
}`;

export function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(info ?? 'shader compile error');
  }
  return s;
}

export function createProgram(gl: WebGL2RenderingContext, fragSrc: string): Prog {
  const p = gl.createProgram()!;
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) ?? 'program link error');
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i)!;
    uniforms[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u: uniforms };
}

export function createFBO(gl: WebGL2RenderingContext, w: number, h: number): FBO {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { fb, tex, w, h };
}

export function setupFullscreenTriangle(gl: WebGL2RenderingContext) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}

export function bindTex(gl: WebGL2RenderingContext, unit: number, tex: WebGLTexture) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  return unit;
}

export function blitToFBO(gl: WebGL2RenderingContext, target: FBO) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
  gl.viewport(0, 0, target.w, target.h);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function blitToScreen(gl: WebGL2RenderingContext, w: number, h: number) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

const SPLAT_FORCE = 3000;
const PRESSURE_ITERATIONS = 4;

export class FluidSim {
  private gl: WebGL2RenderingContext;
  private progs: {
    curl: Prog; vorticity: Prog; divergence: Prog; clear: Prog; pressure: Prog; gradient: Prog; advect: Prog;
  };
  simW = 0;
  simH = 0;
  texel: [number, number] = [0, 0];
  private velRead!: FBO;
  private velWrite!: FBO;
  private curlT!: FBO;
  private vortT!: FBO;
  private divT!: FBO;
  private pressA!: FBO;
  private pressB!: FBO;
  private projT!: FBO;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.progs = {
      curl: createProgram(gl, CURL),
      vorticity: createProgram(gl, VORTICITY),
      divergence: createProgram(gl, DIVERGENCE),
      clear: createProgram(gl, CLEAR),
      pressure: createProgram(gl, PRESSURE),
      gradient: createProgram(gl, GRADIENT),
      advect: createProgram(gl, ADVECT),
    };
  }

  resize(canvasW: number, canvasH: number, simRes: number) {
    const aspect = canvasW / Math.max(canvasH, 1);
    if (aspect >= 1) { this.simW = Math.round(simRes * aspect); this.simH = simRes; }
    else { this.simW = simRes; this.simH = Math.round(simRes / aspect); }
    this.texel = [1 / this.simW, 1 / this.simH];
    const gl = this.gl;
    [this.velRead, this.velWrite, this.curlT, this.vortT, this.divT, this.pressA, this.pressB, this.projT] =
      Array.from({ length: 8 }, () => createFBO(gl, this.simW, this.simH));
  }

  get velocityTex(): WebGLTexture {
    return this.velRead.tex;
  }

  step(dt: number, pointer: { x: number; y: number }, delta: { x: number; y: number }, params: FluidParams) {
    const gl = this.gl;
    const texel = this.texel;

    let g = this.progs.curl;
    gl.useProgram(g.p);
    gl.uniform1i(g.u.uVelocity, bindTex(gl, 0, this.velRead.tex));
    gl.uniform2fv(g.u.uTexelSize, texel);
    blitToFBO(gl, this.curlT);

    g = this.progs.vorticity;
    gl.useProgram(g.p);
    gl.uniform1i(g.u.uVelocity, bindTex(gl, 0, this.velRead.tex));
    gl.uniform1i(g.u.uCurl, bindTex(gl, 1, this.curlT.tex));
    gl.uniform2fv(g.u.uTexelSize, texel);
    gl.uniform2f(g.u.uResolution, this.simW, this.simH);
    gl.uniform2f(g.u.uPointer, pointer.x, pointer.y);
    gl.uniform2f(g.u.uPointerDelta, delta.x, delta.y);
    gl.uniform1f(g.u.uCurlStrength, params.curlStrength);
    gl.uniform1f(g.u.uSplatRadius, Math.max(0.002 * params.radius, 0.0005));
    gl.uniform1f(g.u.uSplatForce, SPLAT_FORCE);
    blitToFBO(gl, this.vortT);

    g = this.progs.divergence;
    gl.useProgram(g.p);
    gl.uniform1i(g.u.uVelocity, bindTex(gl, 0, this.vortT.tex));
    gl.uniform2fv(g.u.uTexelSize, texel);
    blitToFBO(gl, this.divT);

    gl.useProgram(this.progs.clear.p);
    blitToFBO(gl, this.pressA);
    let pIn = this.pressA, pOut = this.pressB;
    g = this.progs.pressure;
    gl.useProgram(g.p);
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(g.u.uPressure, bindTex(gl, 0, pIn.tex));
      gl.uniform1i(g.u.uDivergence, bindTex(gl, 1, this.divT.tex));
      gl.uniform2fv(g.u.uTexelSize, texel);
      blitToFBO(gl, pOut);
      [pIn, pOut] = [pOut, pIn];
    }

    g = this.progs.gradient;
    gl.useProgram(g.p);
    gl.uniform1i(g.u.uVelocity, bindTex(gl, 0, this.vortT.tex));
    gl.uniform1i(g.u.uPressure, bindTex(gl, 1, pIn.tex));
    gl.uniform2fv(g.u.uTexelSize, texel);
    blitToFBO(gl, this.projT);

    g = this.progs.advect;
    gl.useProgram(g.p);
    gl.uniform1i(g.u.uProjectedVelocity, bindTex(gl, 0, this.projT.tex));
    gl.uniform2fv(g.u.uTexelSize, texel);
    gl.uniform1f(g.u.uDissipation, params.dissipation);
    blitToFBO(gl, this.velWrite);
    [this.velRead, this.velWrite] = [this.velWrite, this.velRead];
  }
}

export function toSimCoords(canvas: HTMLCanvasElement, simW: number, simH: number, clientX: number, clientY: number): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [
    (clientX - r.left) / r.width * simW,
    (1 - (clientY - r.top) / r.height) * simH,
  ];
}

```


## `app/_home/FluidGridBackground/index.tsx`

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useControls, Leva } from 'leva';
import { FluidSim, toSimCoords, createProgram, bindTex, blitToScreen, setupFullscreenTriangle, DISPLAY, FLUID_PARAMS } from './fluidSim';

const SIM_RES = 160;
const PARALLAX_RANGE = 80; // カーソル追従でコンテナが動く幅(±40px)。-inset-14(56px)の範囲内に収める

// グリッド固有の見た目パラメータ(歪みの強さ自体はFLUID_PARAMSで背景・タイトル共通)
const GRID_PARAMS = {
  bgColor: '#faf3e1', // 背景色
  gridSpacing: 390,   // 交点の間隔(広め)
  lineOpacity: 0.07,  // 線そのものはごく薄く
  crossOpacity: 0.28, // 交点の十字だけ少しはっきり
  crossSize: 7,       // 十字の腕の長さ(px, dpr倍する前)
  crossGap: 18,       // 十字の周りに線を引かない余白(px, dpr倍する前)
};

export function FluidGridBackground({ active = true }: { active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const redrawGridRef = useRef<(() => void) | null>(null);

  const fluidControls = useControls('波紋', {
    strength: { value: FLUID_PARAMS.strength, min: 0, max: 3, step: 0.01 },
    radius: { value: FLUID_PARAMS.radius, min: 0.3, max: 5, step: 0.1 },
    dissipation: { value: FLUID_PARAMS.dissipation, min: 0.2, max: 10, step: 0.1 },
    curlStrength: { value: FLUID_PARAMS.curlStrength, min: 0, max: 40, step: 1 },
    chromatic: { value: FLUID_PARAMS.chromatic, min: 0, max: 2, step: 0.05 },
  });
  const gridControls = useControls('グリッド', {
    bgColor: { value: GRID_PARAMS.bgColor },
    gridSpacing: { value: GRID_PARAMS.gridSpacing, min: 100, max: 700, step: 10 },
    lineOpacity: { value: GRID_PARAMS.lineOpacity, min: 0, max: 1, step: 0.01 },
    crossOpacity: { value: GRID_PARAMS.crossOpacity, min: 0, max: 1, step: 0.01 },
    crossSize: { value: GRID_PARAMS.crossSize, min: 2, max: 24, step: 1 },
    crossGap: { value: GRID_PARAMS.crossGap, min: 0, max: 80, step: 1 },
  });

  // sim側は生JSオブジェクトを毎フレーム直接参照しているので、ここで値を反映するだけでよい
  Object.assign(FLUID_PARAMS, fluidControls);
  Object.assign(GRID_PARAMS, gridControls);

  // グリッドの見た目だけを再描画(シミュレーション本体は再構築しない)
  useEffect(() => {
    redrawGridRef.current?.();
  }, [gridControls.bgColor, gridControls.gridSpacing, gridControls.lineOpacity, gridControls.crossOpacity, gridControls.crossSize, gridControls.crossGap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    const extCBF = gl && gl.getExtension('EXT_color_buffer_float');
    if (!gl || !extCBF) return; // 非対応環境では何も描かず、既存の背景色のまま

    setupFullscreenTriangle(gl);
    const displayProg = createProgram(gl, DISPLAY);
    const sim = new FluidSim(gl);

    // ---- 背景の絵(幾何学グリッド)を2Dキャンバスに描いてテクスチャ化 ----
    const pageCanvas = document.createElement('canvas');
    const pctx = pageCanvas.getContext('2d')!;
    const pageTex = gl.createTexture()!;

    function drawGrid(w: number, h: number, dpr: number) {
      pageCanvas.width = w;
      pageCanvas.height = h;
      pctx.fillStyle = GRID_PARAMS.bgColor;
      pctx.fillRect(0, 0, w, h);

      const spacing = GRID_PARAMS.gridSpacing * dpr;
      const crossSize = GRID_PARAMS.crossSize * dpr;
      const gap = Math.min(GRID_PARAMS.crossGap * dpr, spacing / 2 - 1);

      // 交点の周りに余白を空けた格子線( ---- 十 ---- )
      pctx.strokeStyle = `rgba(34,34,34,${GRID_PARAMS.lineOpacity})`;
      pctx.lineWidth = Math.max(1, dpr);
      pctx.beginPath();
      for (let y = 0; y <= h; y += spacing) {
        for (let x = 0; x < w; x += spacing) {
          pctx.moveTo(x + gap, y);
          pctx.lineTo(x + spacing - gap, y);
        }
      }
      for (let x = 0; x <= w; x += spacing) {
        for (let y = 0; y < h; y += spacing) {
          pctx.moveTo(x, y + gap);
          pctx.lineTo(x, y + spacing - gap);
        }
      }
      pctx.stroke();

      // 交点だけ十字マーク
      pctx.strokeStyle = `rgba(34,34,34,${GRID_PARAMS.crossOpacity})`;
      pctx.lineWidth = Math.max(1, dpr);
      pctx.beginPath();
      for (let x = 0; x <= w; x += spacing) {
        for (let y = 0; y <= h; y += spacing) {
          pctx.moveTo(x - crossSize, y); pctx.lineTo(x + crossSize, y);
          pctx.moveTo(x, y - crossSize); pctx.lineTo(x, y + crossSize);
        }
      }
      pctx.stroke();

      gl!.bindTexture(gl!.TEXTURE_2D, pageTex);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, true);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, pageCanvas);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, false);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    }
    redrawGridRef.current = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      drawGrid(canvas!.width, canvas!.height, dpr);
    };

    // ---- ポインター ----
    const pointer = { x: 0, y: 0 };
    const delta = { x: 0, y: 0 };
    let hasLast = false, lastX = 0, lastY = 0;
    // カーソル位置に応じたパララックス(コンテナごと少し平行移動する)
    const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

    function onMove(e: PointerEvent) {
      const [x, y] = toSimCoords(canvas!, sim.simW, sim.simH, e.clientX, e.clientY);
      if (hasLast) { delta.x += x - lastX; delta.y += y - lastY; }
      lastX = x; lastY = y; hasLast = true;
      pointer.x = x; pointer.y = y;
      parallax.tx = (e.clientX / window.innerWidth - 0.5) * PARALLAX_RANGE;
      // Y軸は反転(カーソルが下ほどグリッドは上へ動く)
      parallax.ty = -(e.clientY / window.innerHeight - 0.5) * PARALLAX_RANGE;
    }
    function onLeave() { hasLast = false; }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let introT = reducedMotion ? 999 : 0;
    function intro(dt: number) {
      if (introT > 1.4) return;
      introT += dt;
      const t = introT / 1.4;
      const x = (0.15 + t * 0.6) * sim.simW;
      const y = (0.5 + Math.sin(t * Math.PI * 2) * 0.12) * sim.simH;
      if (hasLast) { delta.x += (x - lastX) * 0.6; delta.y += (y - lastY) * 0.6; }
      lastX = x; lastY = y; hasLast = true;
      pointer.x = x; pointer.y = y;
    }

    let raf = 0;
    let prevTime = performance.now();
    let running = false;

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min((now - prevTime) / 1000, 0.033);
      prevTime = now;
      intro(dt);

      sim.step(dt, pointer, delta, FLUID_PARAMS);
      delta.x = 0; delta.y = 0;

      // パララックス: 目標位置へなめらかに追従
      parallax.x += (parallax.tx - parallax.x) * 0.06;
      parallax.y += (parallax.ty - parallax.y) * 0.06;
      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${parallax.x.toFixed(2)}px, ${parallax.y.toFixed(2)}px, 0)`;
      }

      gl!.useProgram(displayProg.p);
      gl!.uniform1i(displayProg.u.tDiffuse, bindTex(gl!, 0, pageTex));
      gl!.uniform1i(displayProg.u.uVelocity, bindTex(gl!, 1, sim.velocityTex));
      gl!.uniform2f(displayProg.u.uSimSize, sim.simW, sim.simH);
      gl!.uniform1f(displayProg.u.uDisplacementStrength, FLUID_PARAMS.strength);
      gl!.uniform1f(displayProg.u.uChromaticBoost, FLUID_PARAMS.chromatic);
      blitToScreen(gl!, canvas!.width, canvas!.height);

      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (running) return;
      running = true;
      prevTime = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }
    function onVisibility() {
      if (document.hidden) stop(); else start();
    }
    document.addEventListener('visibilitychange', onVisibility);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // コンテナはパララックス移動の分だけビューポートより大きい(-inset)ので、実寸から取る
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = Math.max(1, Math.round(rect.width * dpr));
      canvas!.height = Math.max(1, Math.round(rect.height * dpr));
      sim.resize(canvas!.width, canvas!.height, SIM_RES);
      drawGrid(canvas!.width, canvas!.height, dpr);
      hasLast = false;
    }
    window.addEventListener('resize', resize);
    resize();
    if (!document.hidden) start();

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      window.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      redrawGridRef.current = null;
    };
  }, [active]);

  return (
    <>
      {/* パララックスで動かす分(±PARALLAX_RANGE/2)だけ画面より大きくして端が見えないようにする */}
      <div ref={containerRef} className='fixed -inset-14 z-0 pointer-events-none'>
        <canvas ref={canvasRef} className='block h-full w-full' />
      </div>
      {/* pointer-events-noneの外に出す(中に置くと継承されて操作できなくなる) */}
      <Leva collapsed titleBar={{ title: '波紋の調整(確認用)' }} />
    </>
  );
}

```


## `app/_home/FluidGridBackground/FluidTitleWarp.tsx`

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { FluidSim, toSimCoords, createProgram, bindTex, blitToScreen, setupFullscreenTriangle, DISPLAY, FLUID_PARAMS } from './fluidSim';

const SIM_RES = 96;

/** CanvasTitle(3Dタイトル)の描画結果を毎フレーム取り込んで、背景と同じ流体で歪ませるオーバーレイ。 */
export function FluidTitleWarp({
  active = true,
  sourceRef,
  className = 'fixed inset-0 z-80 h-full w-full pointer-events-none',
}: {
  active?: boolean;
  sourceRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true });
    const extCBF = gl && gl.getExtension('EXT_color_buffer_float');
    if (!gl || !extCBF) return;

    setupFullscreenTriangle(gl);
    const displayProg = createProgram(gl, DISPLAY);
    const sim = new FluidSim(gl);

    const pageCanvas = document.createElement('canvas');
    const pctx = pageCanvas.getContext('2d')!;
    const pageTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, pageTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // タイトルの実キャンバスを毎フレーム自分のcanvasへ位置合わせして焼き込む
    function composite(dpr: number) {
      pctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      const titleCanvas = sourceRef.current?.querySelector('canvas') ?? null;
      if (titleCanvas && sourceRef.current) {
        const wrapRect = canvas!.getBoundingClientRect();
        const titleRect = sourceRef.current.getBoundingClientRect();
        pctx.drawImage(
          titleCanvas,
          (titleRect.left - wrapRect.left) * dpr,
          (titleRect.top - wrapRect.top) * dpr,
          titleRect.width * dpr,
          titleRect.height * dpr,
        );
      }
      gl!.bindTexture(gl!.TEXTURE_2D, pageTex);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, true);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, pageCanvas);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, false);
    }

    const pointer = { x: 0, y: 0 };
    const delta = { x: 0, y: 0 };
    let hasLast = false, lastX = 0, lastY = 0;

    function onMove(e: PointerEvent) {
      const [x, y] = toSimCoords(canvas!, sim.simW, sim.simH, e.clientX, e.clientY);
      if (hasLast) { delta.x += x - lastX; delta.y += y - lastY; }
      lastX = x; lastY = y; hasLast = true;
      pointer.x = x; pointer.y = y;
    }
    function onLeave() { hasLast = false; }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);

    let raf = 0;
    let prevTime = performance.now();
    let running = false;
    let dpr = 1;

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min((now - prevTime) / 1000, 0.033);
      prevTime = now;

      composite(dpr);
      sim.step(dt, pointer, delta, FLUID_PARAMS);
      delta.x = 0; delta.y = 0;

      // sim.step()の最後はsim内部のFBOがバインドされたままなので、
      // ここでclearすると誤ってそのFBO(速度テクスチャ)を消してしまう。
      // 全画面三角形が全ピクセルを上書きするのでclear自体不要。
      gl!.useProgram(displayProg.p);
      gl!.uniform1i(displayProg.u.tDiffuse, bindTex(gl!, 0, pageTex));
      gl!.uniform1i(displayProg.u.uVelocity, bindTex(gl!, 1, sim.velocityTex));
      gl!.uniform2f(displayProg.u.uSimSize, sim.simW, sim.simH);
      gl!.uniform1f(displayProg.u.uDisplacementStrength, FLUID_PARAMS.strength);
      gl!.uniform1f(displayProg.u.uChromaticBoost, FLUID_PARAMS.chromatic);
      blitToScreen(gl!, canvas!.width, canvas!.height);

      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (running) return;
      running = true;
      prevTime = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }
    function onVisibility() {
      if (document.hidden) stop(); else start();
    }
    document.addEventListener('visibilitychange', onVisibility);

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = Math.max(1, Math.round(rect.width * dpr));
      canvas!.height = Math.max(1, Math.round(rect.height * dpr));
      pageCanvas.width = canvas!.width;
      pageCanvas.height = canvas!.height;
      sim.resize(canvas!.width, canvas!.height, SIM_RES);
      hasLast = false;
    }
    window.addEventListener('resize', resize);
    resize();
    if (!document.hidden) start();

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      window.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, sourceRef]);

  return <canvas ref={canvasRef} className={className} />;
}

```


## `app/_components/CustomCursor/index.tsx`

```tsx
'use client';
// React
import { useRef, useEffect } from 'react';
// GSAP
import gsap from 'gsap';

const SIZE = 100;
const STRETCH_SPEED_REF = 2.5; // px/ms これくらいで最大まで伸びる

export default function CustomCursor() {
  const cursorRef = useRef<SVGSVGElement>(null);
  const stretchRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!cursorRef.current || !stretchRef.current) return;
    gsap.set(cursorRef.current, { xPercent: -50, yPercent: -50 });
    // 原点を進行方向側(前寄り)に置き、伸びた時に後ろへ引っ張られているように見せる
    gsap.set(stretchRef.current, { transformOrigin: '65% 50%' });
    const xTo = gsap.quickTo(cursorRef.current, 'x', { duration: 0.4, ease: 'power3.out' });
    const yTo = gsap.quickTo(cursorRef.current, 'y', { duration: 0.4, ease: 'power3.out' });
    const rotTo = gsap.quickTo(stretchRef.current, 'rotation', { duration: 0.25, ease: 'power2.out' });

    // 移動方向への伸び縮み(常時rAFで1に向かって戻り続け、動くたびに引っ張る)
    const stretch = { x: 1, y: 1 };
    let stretchRaf = 0;
    function tickStretch() {
      stretch.x += (1 - stretch.x) * 0.12;
      stretch.y += (1 - stretch.y) * 0.12;
      gsap.set(stretchRef.current, { scaleX: stretch.x, scaleY: stretch.y });
      stretchRaf = requestAnimationFrame(tickStretch);
    }
    stretchRaf = requestAnimationFrame(tickStretch);

    let lastX = 0, lastY = 0, lastT = 0, hasLast = false;

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);

      const now = performance.now();
      if (hasLast) {
        const dt = Math.max(now - lastT, 1);
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const dist = Math.hypot(dx, dy);
        const speed = dist / dt;
        const speedNorm = Math.min(speed / STRETCH_SPEED_REF, 1);

        if (dist > 0.5) {
          rotTo((Math.atan2(dy, dx) * 180) / Math.PI);
          stretch.x = 1 + speedNorm * 0.55;
          stretch.y = 1 - speedNorm * 0.28;
        }
      }
      lastX = e.clientX; lastY = e.clientY; lastT = now; hasLast = true;
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(stretchRaf);
    };
  }, [cursorRef]);

  return (
    // overflow-visible: 伸びた時にviewBoxの外へはみ出しても切れないようにする
    // mix-blend-difference + 白ストローク = 背後の色の反転色で描画される
    <svg ref={cursorRef} viewBox={`0 0 ${SIZE} ${SIZE}`} className='fixed top-0 left-0 w-8 h-8 pointer-events-none z-9999 overflow-visible mix-blend-difference'>
      <g ref={stretchRef}>
        {/* 塗りなし・線のみ。vector-effectで伸縮しても線の太さを画面上1.5pxに保つ */}
        <circle cx='50' cy='50' r='40' fill='none' stroke='#fff' strokeWidth='1.5' vectorEffect='non-scaling-stroke' />
      </g>
    </svg>
  );
}

```


## `app/_home/Canvas/CanvasKey/index.tsx`

```tsx
'use client';

import { Canvas } from '@react-three/fiber';
import { KeyCap } from './Model';
import { Suspense } from 'react';
import { Environment, Preload } from '@react-three/drei';
import type { ThemeName } from '../../../_components/Curtains/curtainPalettes'; 

type KeyCapType = { label: string; x: number; color: string; textColor: string; path: string; theme: ThemeName; };

export function CanvasNavKey({
  ref,
  keyCaps,
  onKeyCapClick,
  onKeyCapHover,
}: {
  ref?: React.RefObject<HTMLDivElement | null>;
  keyCaps: KeyCapType[];
  onKeyCapClick: (path: string, theme: ThemeName) => void;   
  onKeyCapHover: (label: string | null) => void;
}) {
  return (
    <div ref={ref} className='fixed bottom-0 w-full h-[30vh] z-45 pointer-events-auto'>
      <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 100 }}>
        <Suspense fallback={null}>
          <Environment preset='studio' environmentIntensity={1} />
          <ambientLight intensity={0.5} />
          {keyCaps.map((keyCap, i) => (
            <KeyCap key={i} keyCap={keyCap} onClick={onKeyCapClick} onHover={onKeyCapHover} />
          ))}
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}

export type { KeyCapType };

```


## `app/_home/Canvas/CanvasKey/Model.tsx`

```tsx
// React
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
// GSAP
import gsap from 'gsap';
// THREE
import { Html, MeshTransmissionMaterial, useGLTF } from '@react-three/drei';
import { Color } from 'three';
import type { Group, MeshPhysicalMaterial } from 'three';
import type { Mesh } from 'three';
// コンポーネント
import type { KeyCapType } from './index';
import type { ThemeName } from '../../../_components/Curtains/curtainPalettes';

// キーキャップ全体の高さオフセット(下寄せ)
const KEYCAP_BASE_Y = -0.35;

/** 常時表示のラベル。ホバーで1文字ずつ上にスクロールしてオレンジのテキストに切り替わる */
function KeyCapLabel({ label, hovered }: { label: string; hovered: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const cols = wrapRef.current.querySelectorAll('.labelCharCol');
    // 2段組(通常色/オレンジ)の列を自身の高さの半分だけ動かして表示段を切り替える
    gsap.to(cols, {
      yPercent: hovered ? -50 : 0,
      duration: 0.35,
      ease: 'power2.out',
      stagger: 0.03,
    });
  }, [hovered]);

  return (
    <div ref={wrapRef} className='pointer-events-none flex whitespace-nowrap text-4xl font-corporate-a italic font-medium leading-[1.15]'>
      {label.split('').map((char, i) => (
        <span key={i} className='inline-block overflow-hidden' style={{ height: '1.15em' }}>
          <span className='labelCharCol block'>
            <span className='block text-zinc-950'>{char === ' ' ? ' ' : char}</span>
            <span className='block text-[#fa8112]'>{char === ' ' ? ' ' : char}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

export function KeyCap({
  keyCap, 
  onClick,
  onHover,
  } : { 
    keyCap: KeyCapType; 
    onClick: (path: string, theme: ThemeName) => void;
    onHover: (label: string | null) => void;
  }) {
  const groupRef = useRef<Group>(null);
  const { nodes } = useGLTF('/models/model__keycap.glb');
  const geometry = (nodes.key as Mesh).geometry;
  const selfTimeRef = useRef(0);
  // MeshTransmissionMaterialは背景を指定しないと透過した先に何もなく黒く見えるため、
  // CanvasTitleと同様に色を渡してガラスの向こうに見える色にする
  const transmissionBackground = useMemo(() => new Color(keyCap.color), [keyCap.color]);
  // ホバー時の色変化(fの文字と同じアクセントオレンジへ、useFrameのlerpでじわっと)
  const matRef = useRef<ComponentRef<typeof MeshTransmissionMaterial>>(null);
  const baseColor = useMemo(() => new Color(keyCap.color), [keyCap.color]);
  const hoverColor = useMemo(() => new Color('#fa8112'), []);

  // ---------------------------
  // クリックアニメーション
  // ---------------------------
  const [clicked, setClicked] = useState<boolean>(false);

  const handleClick = () => {
    if (clicked) return;
    setClicked(true);
    const tl = gsap.timeline();
    tl.to(groupRef.current!.position, { y: -0.2, duration: 0.15, ease: 'power4.in', })
      .to(groupRef.current!.position, { y: 0, duration: 0.1, ease: 'power4.out', onComplete: () => onClick(keyCap.path, keyCap.theme), });
  };

  // ---------------------------
  // アイドルモーション＋ホバー
  // ---------------------------

  // ランダムアニメーションの数値設定
  // 速度：[最小値, ばらつき幅], 振れ幅[最小値, ばらつき幅]
  const FLOAT_CONFIG = {
    y: { speed: [0.6, 0.4], amp: [0.05, 0.1] }, // Y軸方向の浮遊アニメーション設定（上下動）
    rotY: { speed: [0.5, 0.5], amp: [0.15, 0.3] }, // Y軸周りの回転アニメーション設定（左右回転）
    rotZ: { speed: [0.1, 0.15], amp: [0.1, 0.2] }, // Z軸周りの回転アニメーション設定
  };

  // マウント時の数値計算 
  // ランダムな数値（Math.random）を使用して設定した数値の中で動かす
  const [offsets] = useState(() => ({
    // 高さ
    yPhase: Math.random() * Math.PI * 2,
    ySpeed: FLOAT_CONFIG.y.speed[0] + Math.random() * FLOAT_CONFIG.y.speed[1],
    yAmp: FLOAT_CONFIG.y.amp[0] + Math.random() * FLOAT_CONFIG.y.amp[1],
    // Y軸
    rotYPhase: Math.random() * Math.PI * 2,
    rotYSpeed: FLOAT_CONFIG.rotY.speed[0] + Math.random() * FLOAT_CONFIG.rotY.speed[1],
    rotYAmp: FLOAT_CONFIG.rotY.amp[0] + Math.random() * FLOAT_CONFIG.rotY.amp[1],
    // Z軸
    rotZPhase: Math.random() * Math.PI * 2,
    rotZSpeed: FLOAT_CONFIG.rotZ.speed[0] + Math.random() * FLOAT_CONFIG.rotZ.speed[1],
    rotZAmp: FLOAT_CONFIG.rotZ.amp[0] + Math.random() * FLOAT_CONFIG.rotZ.amp[1],
  }));

  // フローティングアニメーション 
  // 計算式：((経過時間*速度の値)＋初期開始)*波の幅
  const [hovered, setHovered] = useState<boolean>(false);

  useFrame((state, delta) => {
    // 色のじわっと変化(ホバー中はオレンジ、離れたら元の色へ)
    const mat = matRef.current as unknown as MeshPhysicalMaterial | null;
    if (mat) {
      const target = hovered ? hoverColor : baseColor;
      mat.color.lerp(target, 0.08);
      transmissionBackground.lerp(target, 0.08);
    }

    if (!groupRef.current || clicked) return;
    if (!hovered) { selfTimeRef.current += delta; }

    const t = selfTimeRef.current;
  
    // 基準の値
    const baseY = Math.sin(t * offsets.ySpeed + offsets.yPhase) * offsets.yAmp;
    const baseRotY = Math.sin(t * offsets.rotYSpeed + offsets.rotYPhase) * offsets.rotYAmp;
    const baseRotZ = Math.sin(t * offsets.rotZSpeed + offsets.rotZPhase) * offsets.rotZAmp;
    const baseRotX = 0.3;
    const hoverBaseRotX = 0.3;
    // 追従速度
    const POS_FOLLOW = 0.6;
    const ROT_FOLLOW = 0.4; 

    // hoverPos, Rot...追従オフセット
    const hoverPosX = hovered ? state.pointer.x * POS_FOLLOW : 0;
    const hoverPosY = hovered ? state.pointer.y * POS_FOLLOW : 0;
    const hoverRotX = hovered ? -state.pointer.y * ROT_FOLLOW : 0;
    const hoverRotY = hovered ? state.pointer.x * ROT_FOLLOW : 0;

    // targetRot...目標値（ホバー時の基準値 + 追従）
    const targetRotX = hovered ? hoverBaseRotX + hoverRotX : baseRotX;
    const targetRotY = hovered ? 0 + hoverRotY : baseRotY;
    const targetRotZ = hovered ? 0 : baseRotZ;

    // lerp...なめらかさ
    const lerpFactor = 0.1;
    groupRef.current.position.x += (keyCap.x + hoverPosX - groupRef.current.position.x) * lerpFactor;
    groupRef.current.position.y += (KEYCAP_BASE_Y + baseY + hoverPosY - groupRef.current.position.y) * lerpFactor;
    groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * lerpFactor;
    groupRef.current.rotation.y += (targetRotY - groupRef.current.rotation.y) * lerpFactor;
    groupRef.current.rotation.z += (targetRotZ - groupRef.current.rotation.z) * lerpFactor;
  });

  return (

    // 各キーキャップのメッシュ
    <group
      ref={groupRef} position={[keyCap.x, KEYCAP_BASE_Y, 0]} rotation-x={0.3}
      onPointerOver={(e) => { setHovered(true); e.stopPropagation(); onHover(keyCap.label); }}
      onPointerOut={() => { setHovered(false); onHover(null) }}
      onClick={(e) => { e.stopPropagation(); handleClick(); onHover(null); }}
    >
      <mesh geometry={geometry}>
        {/* colorは初期値のみ。以降はuseFrameのlerpで動かす(r3fは値が変わらないpropsを再適用しない) */}
        <MeshTransmissionMaterial
          ref={matRef}
          samples={10}
          resolution={768}
          transmission={0.95}
          roughness={0.06}
          thickness={0.9}
          ior={1.5}
          chromaticAberration={0.15}
          anisotropy={0}
          background={transmissionBackground}
          backside={true}
          color={keyCap.color}
        />
      </mesh>

      {/* キーキャップの上のラベル(常時表示、ホバーで文字が上にスクロールしてオレンジに切り替わる) */}
      <Html position={[0, 1, 0]} center style={{ pointerEvents: 'none' }}>
        <KeyCapLabel label={keyCap.label} hovered={hovered} />
      </Html>
    </group>
  );
}

```


## `app/_components/CanvasTitle/index.tsx`

```tsx
'use client';

// THREE
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Suspense, useRef } from 'react';
import { type Group, type Mesh, type Color, MeshStandardMaterial } from 'three';
// GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
// コンポーネント
import { TitleScene } from './Model';
import type { TitleSceneProps } from './Model';
import HexToRGB from '../../_utils/HexToRGB';

/** -------------------------------------------------
  型定義
------------------------------------------------- **/
// 共通パラメータ
type CommonAnimParams = {
  scaleTarget?: number;
  yTarget?: string;
  ease?: string;
};
// タイトルのアニメーション：フェーズ変化による自動縮小
type AutoShrink = CommonAnimParams & {
  type: 'auto';
  triggerPhase: string;
  duration?: number;
};
// タイトルのアニメーション：スクロールによる縮小
type ScrubShrink = CommonAnimParams & {
  type: 'scrub';
  triggerSelector: string;

  // コールバック関数
  onLeave?: () => void;
  onEnterBack?: () => void;

  // 変化する内容
  bgTarget?: string; 
  bgColorOnLeave?: string;
  bgColorOnEnterBack?: string;

  // テキスト色変化
  textColorOnLeave?: string;
  textColorOnEnterBack?: string;
  transmissionColorOnLeave?: string;
  transmissionColorOnEnterBack?: string;
};
type AnimateConfig = AutoShrink | ScrubShrink;

type WrapperPreset = 'main' | 'sub';

/* タイトルシーンのプロップスを受け取る */
type CanvasTitleProps = TitleSceneProps & {
  ref?: React.RefObject<HTMLDivElement | null>;
  shrinkMoveAnim?: AnimateConfig;
  wrapperPreset?: WrapperPreset;
  visuallyHidden?: boolean;
};

/** ------------------------ 型定義 ------------------------ **/

export default function CanvasTitle({
  ref: wrapperRef,
  shrinkMoveAnim,
  wrapperPreset = 'main',
  visuallyHidden = false,
  ...sceneProps
}: CanvasTitleProps) {
  const groupRef = useRef<Group>(null);
  const textFrontRef = useRef<Mesh>(null);
  const textBackRef = useRef<Mesh>(null);
  const transmissionBgRef = useRef<Color | null>(null);
  const { skipIntro = false } = sceneProps;
  
  /* ラッパーの表示内容定義
  --------------------------------------- */
  let wrapper!: string;
  let inner!: string;
  switch (wrapperPreset) {
    case 'main':
      wrapper = `fixed w-full h-[30vh] pointer-events-auto ${skipIntro ? 'z-80' : 'z-92'}`;
      inner = `w-full h-full`;
      break;
    case 'sub':
      wrapper = 'fixed inset-0 flex items-center justify-center z-50';
      inner = 'w-full h-[40vh]';
      break;
  }
  if (visuallyHidden) wrapper += ' opacity-0 pointer-events-none';

  /* 表示アニメーション
  --------------------------------------- */
  useGSAP( () => {
    if (!shrinkMoveAnim) return;
    const scale = shrinkMoveAnim.scaleTarget ?? 0.5;
    const y = shrinkMoveAnim.yTarget ?? '-40vh';
    const ease = shrinkMoveAnim.ease ?? 'power2.inOut';

    switch (shrinkMoveAnim.type) {
      case 'auto':{
        if (sceneProps.phase === shrinkMoveAnim.triggerPhase) {
          const duration = shrinkMoveAnim.duration ?? 1.2;
          gsap.to(wrapperRef!.current, { y, duration, ease });
          if (groupRef.current) { gsap.to(groupRef.current.scale, { x: scale, y: scale, z: scale, duration, ease }); }
        }}
        break;
      case 'scrub':{
        const config = {
          trigger: shrinkMoveAnim.triggerSelector,
          start: 'top top',
          end: '60% top',
          scrub: true,
          // スクロール時の挙動
          onLeave: () => {
            shrinkMoveAnim.onLeave?.();
            if (shrinkMoveAnim.bgTarget && shrinkMoveAnim.bgColorOnLeave) {
              gsap.to(shrinkMoveAnim.bgTarget, {
                backgroundColor: shrinkMoveAnim.bgColorOnLeave,
                duration: 0.4,
                ease: 'power2.inOut',
              });
            }
            if (shrinkMoveAnim.textColorOnLeave) {
              const [r, g, b] = HexToRGB(shrinkMoveAnim.textColorOnLeave);
              if (textFrontRef.current?.material) {
                gsap.to((textFrontRef.current.material as MeshStandardMaterial).color, {
                  r, g, b, duration: 0.4, ease: 'power2.inOut',
                });
              }
              if (textBackRef.current?.material) {
                gsap.to((textBackRef.current.material as MeshStandardMaterial).color, {
                  r, g, b, duration: 0.4, ease: 'power2.inOut',
                });
              }
            }
            if (shrinkMoveAnim.transmissionColorOnLeave && transmissionBgRef.current) {
              const [r, g, b] = HexToRGB(shrinkMoveAnim.transmissionColorOnLeave);
              gsap.to(transmissionBgRef.current, {
                r, g, b, duration: 0.4, ease: 'power2.inOut',
              });
            }
          },
          onEnterBack: () => {
            shrinkMoveAnim.onEnterBack?.();
            if (shrinkMoveAnim.bgTarget && shrinkMoveAnim.bgColorOnEnterBack) {
              gsap.to(shrinkMoveAnim.bgTarget, {
                backgroundColor: shrinkMoveAnim.bgColorOnEnterBack,
                duration: 0.4,
                ease: 'power2.inOut',
              });
            }
            if (shrinkMoveAnim.textColorOnEnterBack) {
              const [r, g, b] = HexToRGB(shrinkMoveAnim.textColorOnEnterBack);
              if (textFrontRef.current?.material) {
                gsap.to((textFrontRef.current.material as MeshStandardMaterial).color, {
                  r, g, b, duration: 0.4, ease: 'power2.inOut',
                });
              }
              if (textBackRef.current?.material) {
                gsap.to((textBackRef.current.material as MeshStandardMaterial).color, {
                  r, g, b, duration: 0.4, ease: 'power2.inOut',
                });
              }
            }
            if (shrinkMoveAnim.transmissionColorOnEnterBack && transmissionBgRef.current) {
              const [r, g, b] = HexToRGB(shrinkMoveAnim.transmissionColorOnEnterBack);
              gsap.to(transmissionBgRef.current, { r, g, b, duration: 0.4, ease: 'power2.inOut' });
            }
          },
        };

        gsap.to(wrapperRef!.current, { y, ease, scrollTrigger: config });
        if (groupRef.current) {
          gsap.to(groupRef.current.scale, {
            x: scale,
            y: scale,
            z: scale,
            ease,
            scrollTrigger: config,
          });
        }}
      break;
      default: break;
    }}, { dependencies: [shrinkMoveAnim, sceneProps.phase] }
  );
  return (
    <div ref={wrapperRef} className={wrapper}>
      <div className={inner}>
        <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 100 }} gl={{ preserveDrawingBuffer: true }}>
          <Suspense fallback={null}>
            <Environment preset='warehouse' environmentIntensity={2} />
            <ambientLight intensity={0.5} />
            <TitleScene 
              {...sceneProps} 
              groupRef={groupRef} 
              textFrontRef={textFrontRef}
              textBackRef={textBackRef}
              transmissionBgRef={transmissionBgRef}
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
```


## `app/_components/CanvasTitle/Model.tsx`

```tsx
'use client';

import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Text, useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { Color, DoubleSide, MeshStandardMaterial, type Group, type Mesh } from 'three';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

type TextConfig = {
  text: string;
  position: [number, number, number];
  anchorX?: 'left' | 'right';
  fontSize?: number;
  textColor?: string;
};

export type TitleSceneProps = {
  phase: string;
  skipIntro?: boolean;

  // モデル
  modelPath: string;
  modelName: string;
  modelPosition?: [number, number, number];
  modelScale?: number;
  bgColor?: string;

  // テキスト
  preText?: TextConfig;
  postText?: TextConfig;

  // hero phase で文字色変化させるか
  enableHeroColorChange?: boolean;

  // テキストのグループ
  groupRef?: React.RefObject<Group | null>;
  textFrontRef?: React.RefObject<Mesh | null>;
  textBackRef?: React.RefObject<Mesh | null>;
  transmissionBgRef?: React.MutableRefObject<Color | null>;
};

export function TitleScene({
  phase,
  skipIntro = false,
  modelPath,
  modelName,
  modelPosition = [0, 0, 0],
  modelScale = 2,
  bgColor = '#fafafa',
  preText,
  postText,
  enableHeroColorChange = false,
  groupRef,
  textFrontRef,
  textBackRef,
  transmissionBgRef,
}: TitleSceneProps) {
  /* 初期設定
  --------------------------------------- */
  const { nodes } = useGLTF(modelPath);
  const geometry = useMemo(() => {
    const source = (nodes[modelName] as Mesh).geometry;
    const cloned = source.clone();
    cloned.computeVertexNormals();
    return cloned;
  }, [modelName, nodes]);
  const internalGroupRef = useRef<Group>(null);
  const finalGroupRef = groupRef ?? internalGroupRef;
  const text3DRef = useRef<Mesh>(null);
  const selfTimeRef = useRef(0);

  // 既存の内部 refs と統合
  const internalTextFrontRef = useRef<Mesh>(null);
  const finalTextFrontRef = textFrontRef ?? internalTextFrontRef;

  const internalTextBackRef = useRef<Mesh>(null);
  const finalTextBackRef = textBackRef ?? internalTextBackRef;

  // transmissionBackground は外部に公開
  const transmissionBackground = useMemo(() => new Color(bgColor), [bgColor]);

  // 外部 ref に Color インスタンスを保存
  useEffect(() => {
    if (transmissionBgRef) {
      transmissionBgRef.current = transmissionBackground;
    }
  }, [transmissionBackground, transmissionBgRef]);

  /* 表示アニメーション
  --------------------------------------- */
  useGSAP(
    () => {
      /* 【フェーズ：タイトル】テキストの表示 */
      if (phase === 'title') {
        const tl = gsap.timeline();
        if (finalTextFrontRef.current?.material) {
          tl.to(finalTextFrontRef.current.material, { opacity: 1, duration: 1.4, ease: 'power2.out' });
        }
        if (finalTextBackRef.current?.material) {
          tl.to(finalTextBackRef.current.material, { opacity: 1, duration: 1.4, ease: 'power2.out' }, '<');
        }
        if (text3DRef.current) {
          tl.to( text3DRef.current.scale, { x: modelScale, y: modelScale, z: modelScale, duration: 1.4, ease: 'back.out(2)' }, '<');
        }
      }
      /* 【フェーズ：ヒーロー表示】テキストの色変更 */
      if (phase === 'hero' && enableHeroColorChange && !skipIntro) {
        const tl = gsap.timeline();
        if (finalTextFrontRef.current?.material) {
          tl.to((finalTextFrontRef.current.material as MeshStandardMaterial).color, {
            r: 0.1,
            g: 0.1,
            b: 0.1,
            duration: 1.2,
            ease: 'power2.inOut',
          });
        }
        if (finalTextBackRef.current?.material) {
          tl.to(
            (finalTextBackRef.current.material as MeshStandardMaterial).color,
            { r: 0.1, g: 0.1, b: 0.1, duration: 1.2, ease: 'power2.inOut' },
            '<',
          );
        }
      }
    },
    { dependencies: [phase, skipIntro, enableHeroColorChange] },
  );

  /* 浮遊アニメーション
  --------------------------------------- */
  const float = {
    // 浮遊オプション
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

  /* アニメーション */
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
      <group ref={finalGroupRef}>
        {preText && (
          <Text
            ref={finalTextFrontRef}
            font='/fonts/Urbanist-MediumItalic.ttf'
            position={preText.position}
            fontSize={preText.fontSize ?? 1.6}
            color={ skipIntro ? '#1a1a1a' : (preText.textColor ?? '#fafafa') }
            anchorX={preText.anchorX ?? 'right'}
            anchorY='middle'
            material-transparent
            material-opacity={skipIntro ? 1 : 0}
          >
            {preText.text}
          </Text>
        )}
        <mesh ref={text3DRef} geometry={geometry} position={modelPosition} scale={skipIntro ? modelScale : 0}>
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
            color='#fa8112'
          />
        </mesh>
        {postText && (
          <Text
            ref={finalTextBackRef}
            font='/fonts/Urbanist-MediumItalic.ttf'
            position={postText.position}
            fontSize={postText.fontSize ?? 1.6}
            color={ skipIntro ? '#1a1a1a' : (postText.textColor ?? '#fafafa') }
            anchorX={postText.anchorX ?? 'left'}
            anchorY='middle'
            material-transparent
            material-opacity={skipIntro ? 1 : 0}
          >
            {postText.text}
          </Text>
        )}
      </group>
    </>
  );
}

```


## `app/_home/Canvas/CanvasPC/index.tsx`

```tsx
'use client';

// React
import { Suspense } from 'react';
// THREE
import { Canvas } from '@react-three/fiber';
import { Environment, Preload } from '@react-three/drei';
import type { Group } from 'three';
// コンポーネント
import { PC } from './Model';
import { Bloom, EffectComposer } from '@react-three/postprocessing';

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
        orthographic
        camera={{ position: [3, -0.4, 3], zoom: 400 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}
        shadows='soft'
      >
        {/* 環境光 */}
        <Environment preset='studio' environmentIntensity={0.2} />

        {/* メインライト */}
        <directionalLight
          position={[0, 8, 6]}
          intensity={1.8}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
          shadow-camera-near={0.1}
          shadow-camera-far={50}
        />

        <Suspense fallback={null}>
          <PC groupRef={ref} hoveredKey={hoveredKey} onReady={onReady} />
          <Preload all />
        </Suspense>

        <EffectComposer>
          <Bloom intensity={0.8} luminanceThreshold={1}   radius={0.4} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

```


## `app/_home/Canvas/CanvasPC/Model.tsx`

```tsx
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

```


## `app/_home/HeroText.tsx`

```tsx
type Phase = 'loading' | 'changing' | 'title' | 'hero';

export function HeroText({
  ref,
  phase,
  progressCount,
  hideLoading = false,
}: {
  ref?: React.RefObject<HTMLDivElement | null>;
  phase: Phase;
  progressCount: number;
  hideLoading?: boolean;
}) {
  return (
    <div ref={ref} className='fixed inset-0 z-95 pointer-events-none flex items-center justify-center'>
      {/* ローディング */}
      {!hideLoading && (phase === 'loading' || phase === 'changing') && (
        <div className='loadingBlock'>
          <h2 className='loadingText font-futura absolute inset-0 flex items-center justify-center text-5xl'>
            {'Loading...'.split('').map((char, i) => (
              <span key={i} className='loading'>
                {char}
              </span>
            ))}
          </h2>
            <p className='progressText font-futura fixed bottom-0 right-0 leading-64 text-[256px] font-bold -tracking-widest text-zinc-950'>{progressCount}</p>
        </div>
      )}
    </div>
  );
}

```


## `app/_home/ReloadButton.tsx`

```tsx
'use client';

import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import gsap from 'gsap';

export function ReloadButton() {
  /* ホバー時に矢印回転 */
  const iconRef = useRef<SVGSVGElement>(null);
  const handleHover = () => {
    gsap.to(iconRef.current, { rotation: '+=180', duration: 0.5, ease: 'power4.inOut' });
  };

  const buttonRef = useRef<HTMLButtonElement>(null);

  useGSAP(() => {
    gsap.set(buttonRef.current, { y: 20 });
    gsap.to(buttonRef.current, {
      y: 0,
      duration: 1,
      ease: 'bounce.out',
    });
  }, []);

  return (
    <button
      onClick={() => window.location.reload()}
      className='cursor-pointer bg-zinc-50 px-4 py-2 text-zinc-800 rounded-xl flex items-center gap-2 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-500 ease-in-out'
      onMouseEnter={handleHover}
      onMouseLeave={handleHover}
      ref={buttonRef}
    >
      Reload <RefreshCw ref={iconRef} className='w-4 h-4' />
    </button>
  );
}

```


## `app/_components/Curtains/Curtains.tsx`

```tsx
'use client';

import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useId } from 'react';

type CurtainsProps = {
  show: boolean;
  colors: string[];
  anchor?: 'top' | 'bottom';
  motion?: 'enter' | 'exit' | 'none';
  onComplete?: () => void;
  baseZIndex?: number;
};

export default function Curtains({
  show,
  colors,
  anchor = 'top',
  motion = 'enter',
  onComplete,
  baseZIndex = 90,
}: CurtainsProps) {
  const id = useId();
  const curtainClass = `curtain${id.replace(/:/g, '_')}`;
  useGSAP(() => {
    if (!show) return;
    if (motion === 'none') return;

    const offscreen = anchor === 'top' ? '-100%' : '100%';
    const onscreen = '0%';
    const from = motion === 'enter' ? { y: offscreen } : { y: onscreen };
    const to = motion === 'enter' ? { y: onscreen } : { y: offscreen };

    gsap.fromTo(`.${curtainClass}`, from, 
      { ...to, duration: 1.6, stagger: motion === 'enter' ? { each: 0.1, from: 'end' } : 0.08, ease: 'power2.inOut', onComplete: () => onComplete?.(), });
  }, { dependencies: [show, motion] },
  );

  if (!show) return null;
  const positionClass = anchor === 'top' ? 'top-0' : 'bottom-0';

  return (
    <>
      {colors.map((cls, i) => {
        const depth = 6 + i * 3;
        const radius = `50% ${depth}vw`;
        const radiusStyle =
          anchor === 'top'
            ? { borderBottomLeftRadius: radius, borderBottomRightRadius: radius }
            : { borderTopLeftRadius: radius, borderTopRightRadius: radius };
        return (
          <div
            key={i}
            className={`${cls} ${curtainClass} fixed inset-x-0 ${positionClass} h-[140vh]`}
            style={{ zIndex: baseZIndex - i, ...radiusStyle }}
          />
        );
      })}
    </>
  );
}

```


## `app/_components/Curtains/curtainPalettes.ts`

```ts
export const curtainPalettes = {
  aboutMe      : [ 'bg-aboutme-950', 'bg-aboutme-770', 'bg-aboutme-590', 'bg-aboutme-410', 'bg-aboutme-230', 'bg-aboutme-50', ],
  works        : [ 'bg-works-950', 'bg-works-770', 'bg-works-590', 'bg-works-410', 'bg-works-230', 'bg-works-50', ],
  creative     : [ 'bg-creative-950', 'bg-creative-770', 'bg-creative-590', 'bg-creative-410', 'bg-creative-230', 'bg-creative-50', ],
  originalWorks: [ 'bg-original-950', 'bg-original-770', 'bg-original-590', 'bg-original-410', 'bg-original-230', 'bg-original-50', ],
  zinc         : [ 'bg-zinc-700', 'bg-zinc-600', 'bg-zinc-500', 'bg-zinc-400', 'bg-zinc-300', 'bg-zinc-200', ],
} satisfies Record<string, string[]>;

export type ThemeName = keyof typeof curtainPalettes;

```


## `app/_components/splitText.tsx`

```tsx
export default function SplitText({ text = 'example', className = '' }: { text: string; className?: string }) {
  return text.split('').map((char, i) => (
    <span key={i} className={`inline-block overflow-hidden ${className}`}>
      {char === ' ' ? '\u00A0' : char}
    </span>
  ));
}
```


## `app/_utils/HexToRGB.js`

```js
export default function HexToRGB(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

```


## `app/page.tsx`

```tsx
'use client';

// GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
// THREE
import type { Group } from 'three';
import { useEnvironment, useGLTF } from '@react-three/drei';
import { useProgress } from '@react-three/drei';
// React
import { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
// コンポーネントのインポート
import Curtains from './_components/Curtains/Curtains';
import CanvasTitle from './_components/CanvasTitle';
import { FluidGridBackground } from './_home/FluidGridBackground';
import { FluidTitleWarp } from './_home/FluidGridBackground/FluidTitleWarp';
import { curtainPalettes, type ThemeName } from './_components/Curtains/curtainPalettes';
import { ReloadButton } from './_home/ReloadButton';
import { HeroText } from './_home/HeroText';
import { CanvasPC } from './_home/Canvas/CanvasPC'
import { CanvasNavKey } from './_home/Canvas/CanvasKey';

useGLTF.preload('/models/model__keycap.glb');
useGLTF.preload('/models/model__pc.glb');
useGLTF.preload('/models/model__letter-f.glb');
useGLTF.preload('/models/model__letter-a.glb');
useEnvironment.preload({ preset: 'studio' });

function PageInner() {
  const searchParams = useSearchParams();
  const skipIntro = searchParams.get('from') === 'about';
  return <Home skipIntro={skipIntro} />
}

export default function Page() {
  return (
    <Suspense fallback={<div className='fixed inset-0 bg-zinc-50 z-9999' />} >
      <PageInner />
    </Suspense>
  )
}

function Home({ skipIntro }: { skipIntro: boolean }) {
  const [phase, setPhase] = useState<'loading' | 'changing' | 'title' | 'hero'>( skipIntro ? 'hero' : 'loading' );
  const [showCurtain, setShowCurtain] = useState<boolean>(true);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState<boolean>(false);
  const handleModelReady = useCallback(() => setModelReady(true), []);

  const keyCaps: { label: string; x: number; color: string; textColor: string; path: string; theme: ThemeName; }[]
  = [
      { label: 'ABOUT ME',       x: -3.75, color: '#FAF3E1', textColor: '#222',    path: '/about',    theme: 'aboutMe' },
      { label: 'WORKS',          x: -1.25, color: '#FAF3E1', textColor: '#f7f7f7', path: '/works',    theme: 'works' },
      { label: 'CREATIVE',       x:  1.25, color: '#FAF3E1', textColor: '#222',    path: '/creative', theme: 'creative' },
      { label: 'ORIGINAL WORKS', x:  3.75, color: '#FAF3E1', textColor: '#f7f7f7', path: '/original', theme: 'originalWorks' },
    ];

  // ---------------------------
  // 各ページへの遷移
  // ---------------------------
  const router = useRouter();
  const [transitionTo, setTransitionTo] = useState<string | null>(null);
  const [navPaletteColors, setNavPaletteColors] = useState<string[]>([]);
  const handleClick = (path: string, theme: ThemeName) => {
    setNavPaletteColors(curtainPalettes[theme]);
    setTransitionTo(`${path}?from=home&theme=${theme}`);
  }

  // ---------------------------
  // プリロード
  // ---------------------------
  const { progress, total } = useProgress();
  useEffect(() => {
    if (!skipIntro && phase === 'loading' && progress === 100 && total > 0) {
      const timer = setTimeout(() => {
        setPhase('changing');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [progress, total, phase, skipIntro]);

  // ---------------------------
  // リロードボタンの表示
  // ---------------------------
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false); // リロードボタン出現の管理
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRefreshing(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);


  // ---------------------------
  // テキストのアニメーション
  // ---------------------------
  const heroTextRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
      /* アニメーション : ローディング */
      if (phase === 'loading') {
        const tl = gsap.timeline({ repeat: -1 });
        gsap.utils.toArray<Element>('.loading').forEach((char) => {
          tl.to(char, { y: -2, duration: 0.1, ease: 'power2.out' }, '-=0.2')
            .to(char, { y: 0, duration: 0.15, ease: 'power2.in', });
        });
      }
      /* アニメーション : タイトルの表示切り替え */
      if (phase === 'changing') {
        const tl = gsap.timeline({ onComplete: () => setPhase('title') });
        tl.to('.loading', { opacity: 0, filter: 'blur(20px)', duration: 0.8, stagger: { amount: 0.5, from: 'center' }, ease: 'power2.in', })
          .to('.progressText', { y: '100%', duration: 0.8, ease: 'bounce.out' }, '<');
      }
    }, { dependencies: [phase] },
  );

  // ---------------------------
  // タイトル画面の表示
  // ---------------------------
  const canvasPCRef = useRef<Group>(null);
  const canvasNavKeyRef = useRef<HTMLDivElement>(null);
  const canvasTitleRef = useRef<HTMLDivElement>(null);

  // アニメーション；タイトル表示からヒーローコンテンツ表示
  // ---------------------------
  useEffect(() => {
    if (phase === 'title') {
      const timer = setTimeout(() => setPhase('hero'), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useGSAP(() => {
      if (phase === 'hero') {
        if (!canvasPCRef.current || !canvasNavKeyRef.current || !canvasTitleRef.current) return;
        // カーテン(exit)は140vhの幕が上へ抜けるため、画面下端が見え始めるのは約0.6秒後。
        // それに合わせて登場側を遅らせ、幕が上がるのと一緒に動いて見えるようにする。
        // .fromはimmediateRenderで開始前から初期状態(画面外)が適用されるので、遅延中に完成形が見えることはない
        const tl = gsap.timeline({ delay: 0.5 });
        tl.from(canvasPCRef.current!.position, { y: -2, duration: 1.6, ease: 'power4.inOut', immediateRender: true }, '<')
          .from(canvasNavKeyRef.current, { y: '+100%', duration: 1.6, ease: 'power2.inOut', immediateRender: true }, '<')
          .to(canvasTitleRef.current, { y: '-120%', duration: 1.6, ease: 'power2.inOut' }, '<')
          .fromTo( '.gradientOverlay', { opacity: 0, y: '+100%' }, { opacity: 1, y: 0, duration: 1.4, ease: 'power2.out' }, '<', );
      }
    }, { dependencies: [phase, skipIntro, modelReady] },
  );
  // ---------------------------

  return (
    <main className='flex flex-1 items-center justify-center bg-zinc-50 text-zinc-50'>
      {/* 背景の幾何学グリッド + 流体歪みエフェクト */}
      <FluidGridBackground active={phase === 'hero'} />

      {/* カーテン遷移（各下層から） */}
      <Curtains show={!!transitionTo} anchor='bottom' baseZIndex={100} motion={'enter'} colors={navPaletteColors} onComplete={() => transitionTo && router.push(transitionTo)} />
      {/* カーテン遷移（各下層へ） */}
      <Curtains show={showCurtain} anchor='top' motion={phase === 'hero' ? 'exit' : 'none'} colors={['bg-zinc-700', 'bg-zinc-600', 'bg-zinc-500', 'bg-zinc-400', 'bg-zinc-300', 'bg-zinc-200']} onComplete={() => setShowCurtain(false)} />
      
      {/* パソコンとキーキャップ */}
      <CanvasPC ref={canvasPCRef} hoveredKey={hoveredKey} onReady={handleModelReady} />
      <CanvasNavKey ref={canvasNavKeyRef} keyCaps={keyCaps} onKeyCapClick={handleClick} onKeyCapHover={setHoveredKey} />
      
      {/* グラデーションのオーバーレイ */}
      <div className='gradientOverlay fixed inset-0 pointer-events-none' style={{ background: 'linear-gradient(0deg, rgb(250, 243, 225) 10%, rgba(255, 255, 225, 0) 40%)', zIndex: 30, }} />

      {/* タイトルテキスト */}
      <HeroText ref={heroTextRef} phase={phase} progressCount={Math.floor(progress)} hideLoading={skipIntro} />
      {/* CanvasTitle自体は非表示のまま描画だけ継続し、FluidTitleWarpがその描画結果を歪ませて表示する */}
      <CanvasTitle ref={canvasTitleRef} phase={phase} skipIntro={skipIntro} visuallyHidden modelPath='/models/model__letter-f.glb' modelName='letter_f' bgColor='#fafafa' enableHeroColorChange wrapperPreset='main'
        preText={{ text: 'Port', position: [-0.2, 0, -0.5], anchorX: 'right' }}
        postText={{ text: 'olio', position: [0.2, 0, -0.5], anchorX: 'left' }}
      />
      {/* タイトルが画面に出ているtitleフェーズから(heroに切り替わると同時にスライドアウトが始まるため) */}
      <FluidTitleWarp active={phase === 'title' || phase === 'hero'} sourceRef={canvasTitleRef} className={`fixed inset-0 h-full w-full pointer-events-none ${skipIntro ? 'z-80' : 'z-92'}`} />
      {/* ページリロードボタン */}
      {isRefreshing && phase === 'loading' && ( <div className='fixed z-50 bottom-8 left-1/2 -translate-x-1/2'><ReloadButton /></div> )}
    </main>
  );
}

```
