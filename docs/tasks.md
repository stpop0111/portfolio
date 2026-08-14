# タスク管理

このファイルがタスクの**正**。セッションをまたいでも残るよう、ここに記録する。

- 着手したら `- [ ]` → 作業中は本文にメモを追記
- 完了したら `- [x]` にして「完了ログ」へ移す
- 新しく気づいたことは、そのタスクの本文に書き足す

---

## 🎬 ローディング演出の実装

設計書: [loading-intro.md](./loading-intro.md)（Claude Code で作成した実装案。付録Aに全ソース）

### - [ ] 【Loading】本体の実装

`P[000]rtfolio` の数字がロールしながらカウントアップする演出。以下は**まだ未作成**。

- `app/_home/LoadingTitle/index.tsx` — 進捗の検知とサイクル制御
- `app/_home/LoadingTitle/DigitReel.tsx` — 数字のロール
- `app/_home/GlassWordmark/wordmarkPaths.ts` / `useGlassWordmark.ts` — seita のガラス文字
- `public/fonts/Urbanist-Variable.woff2` — 可変フォントのセルフホスト
- `globals.css` の文字組み（クリップ、字間）
- `page.tsx` / `HeroText.tsx` / `FluidTitleWarp.tsx` / `CanvasTitle/Model.tsx` の変更

> 付録Aに全ソースがあるので、写経ベースで移植 → 動作を見ながら調整、という進め方になる。

### - [ ] 【Loading】🟡 3Dタイトルの書体をローディングと揃える

ローディングのタイトルは直立 Bold にしたが、`CanvasTitle` の「Port / olio」は `Urbanist-MediumItalic.ttf` のまま。**同じ「Portfolio」なのに前後で書体が変わる。**

可変フォントから wght 700 の静的 TTF を書き出して差し替える。字幅が変わるため `preText` / `postText` の `position` と、間に入る3Dレターとの間隔を調整し直す必要がある。

> 「タイトルを大きく出して hero で縮小」と同じ CanvasTitle を触るので、まとめてやると効率的。

### - [ ] 【Loading】🟡 SP（スマホ）表示の調整

`font-size: clamp(2rem, 17.5vw, 18rem)` で縮むだけなので、スマホだと `P[000]rtfolio` がかなり細くなる。ガラスの seita も `43vw` 固定なので要確認。実機を見てから調整。

> 「モバイル実機で FPS チェック」と同じタイミングでやると効率的。

### - [ ] 【Loading】🟢 HeroText の扱い / ESLint / ジャギー検証

小粒な残タスク。

- **HeroText が空の器** — `Loading...` を削除して中身が空に。設計書 Stage 4 の名前タイポ（seita / izaki）を入れる場所として残してある。使わないなら削除
- **既存の ESLint エラー** — `FluidEffect/FluidCanvas.tsx` の `react-hooks/refs` 3件、`layout.tsx` の未使用 import 1件
- **ジャギーの再検証** — 原因になりうる2点（`will-change` の常時指定、クリップ線とオーバーシュートの接触）は修正済みだが、検証環境で再現できなかったため実機確認が必要

### - [ ] 【ドキュメント】home-animation.md を現状に合わせて更新

Stage 1・2 の記述（`Loading...` の点滅、ブラー遷移）が現状と一致しない。loading-intro.md の内容を反映するか、設計書側から参照を張る（重複を避けるなら後者）。

---

## 🏗️ 次に着手：Works ページ

### - [ ] 【Works】① 静的な土台（3Dタイトル + カーテン）

設計書: [works-animation.md](./works-animation.md) / 原稿: [works-content.md](./works-content.md)

`works/page.tsx` を作成し、About と同じ構造（CanvasTitle + Curtains）で初期表示まで作る。

- Home からの遷移でカーテンが上へ抜ける
- クリーム幕（キーキャップ色 `#F5E7C6` のシェード3枚）が下から stagger で登場
- 「Works」3Dタイトル（W が `letter_w.glb`、orks は drei の Text）
- W は scale 0 → `back.out` で pop up、orks はフェードイン

準備済み: `public/models/model__letter-w.glb`

### - [ ] 【Works】② スクロールでタイトル縮小 + PC登場

works-animation.md の Phase 5。

- ScrollTrigger（scrub）でタイトルの位置・サイズと PC モデルの位置を同時に補間
- タイトル: 中央の大きいサイズ → 画面上部に固定して縮小
- PC モデル: 画面外（下）→ 中央〜下に大きく表示（Hero の `model__pc.glb` を再利用）
- `.titleSection` の高さは 200〜300vh 想定

### - [ ] 【Works】③ PCスクリーンに4つのフォルダ表示

works-animation.md の Phase 6。

- `works/data/categories.ts` でデータ定義（`WorkCategory` / `Document` 型。カテゴリ・ファイル数はデータ駆動で拡張可能に）
- 表示手法は **案A（Canvas テクスチャ、Hero の液晶と同じ手法）を第一候補**、ホバー検知が複雑すぎる場合は案B（HTML/SVG オーバーレイ）へフォールバック
- フォルダ色 `#F0C03E`、スクリーン背景は LCD グリーン `#1a3a1a` を検討

### - [ ] 【Works】④ ホバー演出とモーダル

works-animation.md の Phase 7〜9。

- ホバー: フォルダが浮き上がる + 上端が開く変形、ジャンルアイコンが出現
- クリック: Mac OS 9 風モーダル（横ストライプのタイトルバー、レトロフォント、ドット柄、3Dシャドウ、`#C0C0C0`）。drei の `Html` + `transform` で WebGL シーン内に配置
- ドキュメントクリック: 詳細モーダル（プロジェクト名 / 期間 / 概要 + `detail: ReactNode` で任意の JSX）
- 複数モーダルの z-index 設計、戻り遷移も要検討

---

## 📄 他のページ

### - [ ] 【Creative】ページ実装
Works の構造が固まってから着手。

### - [ ] 【Original】ページ実装
Works の構造が固まってから着手。

---

## ✨ 演出の追加

### - [ ] 【Home演出】キーキャップ ラベルの1文字スクロール

[fluid-simulation-guide.md](./fluid-simulation-guide.md) 第7章。

現状は `{hovered && <Html>}` で出し入れするだけ。チュートリアル版は：

- 各文字を `overflow:hidden` の枠に入れ、中に「通常色 / オレンジ」の2段を縦に積む
- ホバーで列全体を `yPercent:-50` 動かすと下段のオレンジがせり上がる
- 1文字ずつ `stagger` でずらすのが味付け

> `<Html>` は常時マウントしておく。`hovered &&` で出し入れすると GSAP の対象が消える。既存の `SplitText` が使えるかもしれない。

### - [ ] 【Home演出】ホバー/クリックでカメラを寄りにする

キーキャップに反応して PC モデルのカメラが寄る演出。

1. `CanvasNavKey` / `KeyCap` の hovered / clicked を `page.tsx` へ持ち上げる（clicked は現在 KeyCap 内部の state なので通知経路が必要）
2. `page.tsx` から `CanvasPC` へ props で渡す
3. `CanvasPC/index.tsx` で `hovered || clicked` の時にカメラを寄りにする（GSAP のイージングで制御）

**注意**
- orthographic カメラなので「寄り」は position より `zoom` を動かす方が自然かもしれない
- `CanvasPC/Model.tsx` の useFrame にポインタ追従の lerp があるため、GSAP と同じプロパティを触ると打ち消し合う。キーキャップ登場で使った「オフセットを別の箱に持って加算合成」のパターンが応用できる
- 複数キーを素早く行き来した時にトゥイーンが重ならないよう `overwrite` を検討

### - [ ] 【Home演出】タイトルを大きく出して hero で縮小

- `phase === 'changing'`（Port/olio が現れる段階）ではタイトルを今より大きく表示
- `phase === 'hero'`（カーテンが上へ抜ける）で現在のサイズへ縮小

**実装の手がかり**
- `page.tsx` の hero タイムライン（delay 0.7）で `canvasTitleRef` を `y:'-75%'` へ移動させている。縮小も同じタイムラインに `'<'` で並べれば足並みが揃う
- サイズの変え方2通り：(a) wrapper の `h-[40vh]` など CSS を変える → FluidTitleWarp の取り込み位置も追従する / (b) `groupRef` の scale を変える → CanvasTitle の `shrinkMoveAnim`（`type:'auto'`）が既に scale を扱っているので流用できるかも

**注意**
- CanvasTitle は `visuallyHidden` のまま描画を続け FluidTitleWarp が歪ませて表示している。サイズ変更は取り込み側の位置合わせに影響する
- 大きくしすぎると上下が見切れる（`h-[40vh]` + zoom 130 で上が切れた経緯あり）

### - [ ] 【About演出】Accent ホバーで 3Dモデル＋詳細モーダル

About の Accent スパン（青いハイライト部分）にホバーで 3D モデルと詳細モーダルを表示する。

---

## 🔧 リファクタ

### - [ ] 【リファクタ】色操作の集約とアクセントカラー共通化

**① 色操作の場所がバラけている**

CanvasTitle の色変更が index.tsx と Model.tsx の2箇所に分散していて追いづらい。

- `Model.tsx` … `phase==='hero'` 時のテキスト色 / モデル色 / transmissionBackground
- `index.tsx` … スクロール（scrub の onLeave / onEnterBack）でのテキスト色 / transmissionBackground

同じ対象を2ファイルから触るため、Model が `textFrontRef` / `textBackRef` / `transmissionBgRef` を index に公開する構造になっている。

- 整理案A：色の操作を Model に集約し、index からは「どの状態か」だけを props で渡す
- 整理案B：`useTitleColors` のようなフックに色ロジックを切り出す

**② アクセントカラーの共通化**

`CanvasTitle/Model.tsx` が `_home/Canvas/CanvasKey/keyCapsPalettes.ts` の `KEYCAP_STYLE` を import している。共通コンポーネントがページ固有の定数に依存していて向きが逆。CanvasTitle は About でも使うため、Home 側の構成を変えると壊れる。

`#fa8112` はサイト共通のアクセントカラーなので `_utils/colors.ts` などに切り出す。

### - [ ] 【リファクタ】画面比率によるPCモデルのサイズ調整

CanvasPC は orthographic + `zoom={400}` の固定値のため、ウィンドウの縦横比によって PC が小さくなりすぎる。

対応候補：
1. `useThree` の viewport/size を監視して zoom を動的計算
2. アスペクト比のブレークポイントで切り替え
3. group の scale を viewport に応じて補正

CanvasNavKey / CanvasTitle も同じ問題を抱える可能性があるので合わせて確認。

---

## 🎨 仕上げ

### - [ ] 【仕上げ】デザイン最終調整（色HEX / フォント / 表記）
全ページ揃ってから統一感の微調整。

### - [ ] 【仕上げ】404 ページの実装
`not-found.tsx`。

---

## 📚 学習

### - [ ] ＜学習＞流体シミュ + グリッド背景の仕組み

実装は完了したが中身がブラックボックスなので、後日じっくり解説を受ける。

1. `fluidSim.ts` の6段階パイプライン（curl→vorticity→divergence→pressure×4→gradient→advect）が各々何を計算しているか
2. 速度場（RGBA16F テクスチャ）という考え方、texel とピンポンFBO
3. DISPLAY シェーダーが速度場を使って絵をずらす仕組み
4. FluidCanvas の `drawSource` による共通化設計
5. GLSL の読み方の基礎

> 進め方：パラメータを極端な値に振る → シェーダーの1行をコメントアウトして変化を見る → コードを読む、の順が有効。

---

## 🚀 公開準備

### - [ ] 【公開準備】SEO / メタデータ / OG画像
metadata API、OG 画像生成。

### - [ ] 【公開準備】WebGL パフォーマンス最適化

**第一段階は完了。** 全5枚の WebGL キャンバスを DPR=1 に固定し、描画ピクセル数が約940万→240万px（1/4）に。CanvasPC だけは `gl={{...}}` を渡していた影響で `dpr` プロパティが効かず、`onCreated` 内の `gl.setPixelRatio(1)` で解決した。

**残りの打ち手**
- MeshTransmissionMaterial の `resolution` / `samples` を下げる（キーキャップ4個＋タイトル1個）
- CanvasPC の `shadow-mapSize` 2048→1024
- FluidTitleWarp の `active` 条件を絞る（タイトル退場後も毎フレーム drawImage が走っている）
- N8AO の `quality` を low に
- 根本策：Canvas 5枚を1枚に統合して WebGL コンテキストを減らす（大手術）

### - [ ] 【公開準備】モバイル実機で FPS・電池消費チェック
3D 多用ページの実機パフォーマンス確認。

### - [ ] 【公開準備】Lighthouse / Core Web Vitals 計測と改善
全ページ実装後に計測。

### - [ ] 【公開準備】Vercel デプロイ設定

> デプロイ前に**大文字小文字の import 不一致チェック必須**。Linux は大小を区別するため macOS で通ってもビルドが落ちる。過去に `SplitText.tsx` で発生済み。

---

# 完了ログ

## Home / 共通コンポーネント

- [x] **letter_w.glb モデル作成**（Blender）
- [x] **カスタムカーソル**（縦横ストレッチ + 反転色）
  - svg=位置 / g=変形 の二重構造。rAF ループで stretch を常時 1 へ lerp し、mousemove が引き上げる綱引き構造
  - 速度 = 距離 ÷ 経過時間（`performance.now()`）を 2.5px/ms で正規化
  - 縦横どちらかにのみ伸縮（ヒステリシス 1.4 倍）。回転は不採用 — `atan2` の -180/180 循環で「ぐるっと回る」問題があったため
  - `mix-blend-difference` + 白ストロークで背景の反転色、`overflow-visible` + `vector-effect:non-scaling-stroke` で伸縮時の欠け・線幅変化を防止
- [x] **GPU流体エフェクト**（herofluidlesson チュートリアル）
  - `FluidCanvas` に共通化し、`drawSource` で「元絵の描き方」だけを注入する設計に
  - 背景グリッド（`GridBackground`）と 3Dタイトル歪み（`FluidTitleWarp`）が同じエンジンを使う
  - leva は除去し、パラメータは `fluidParams.ts` / `gridParams.ts` に集約
- [x] **登場アニメをカーテンと同期**（delay 0.7）
  - 幕が上がる前に演出が終わっていた問題を解消
- [x] **キーキャップ ランダム遅延での登場**
  - useFrame を止めるのではなく「オフセットを加算合成」する方式。`appearOffsetRef` を GSAP で動かし、useFrame 内の目標値に足し込む
  - フローティング・ホバー追従・登場アニメの3つが互いを壊さず共存
  - **学び**: GSAP と useFrame が同じプロパティを触ると競合する。片方を止めるか、別の箱をアニメーションさせて合成する
- [x] **キーキャップ ガラス質感とホバー色変化**
  - `Environment` に `Lightformer` を4枚配置してスタジオ照明を自作（preset='studio' から置換）
  - ホバー色は GSAP を使わず useFrame 内で `Color.lerp`
  - **学び**: drei の `MeshTransmissionMaterial` はインスタンス型が export されていないため、ref の型は `useRef<{ color: Color }>(null)` のように「触るプロパティだけ」を書く
  - **学び**: `transmission:1`（完全透過）だと `emissive` がほぼ効かない。ガラスは透過と発光がトレードオフ
  - **学び**: `background` に単色 Color を渡すと屈折しても像が変化せずプラスチックに見える。透明感は環境マップの映り込みで作る
- [x] **hero 移行時に 3Dモデル（F）もオレンジへ**
  - テキストの1.2秒後（`'<1.2'`）にモデル本体と transmissionBackground が色変化

## データ構造の整理

- [x] **theme の受け渡しを全撤去**
  - `curtainPalettes` が zinc 1つになった時点で theme を引き回す理由が消えた
  - `page.tsx` / `about/page.tsx` / `CanvasKey` 一式から削除、`navPaletteColors` state も不要に
  - **学び**: 使われない抽象は読む人のコストだけ残る
- [x] **キーキャップの色を `KEYCAP_STYLE` に集約**
- [x] **ディレクトリ整理**（コロケーション化）
  - `_components/`（共通）/ `_home/`（Home固有）/ `<page>/_components/`（ページ固有）の3層
  - `_` 始まりのフォルダは Next.js のルーティングから除外される（プライベートフォルダ）

## 品質

- [x] **3Dレンダリングの質感改善**（→ [3d-rendering.md](./3d-rendering.md)）
  - Lightformer / PBR値 / キアロスクーロ / ACESFilmic トーンマッピング / N8AO / ContactShadows
- [x] **WebGL パフォーマンス第一段階**（DPR=1 で描画ピクセル 1/4）
- [x] **Vercel ビルドエラー2件の解決**
  - `SplitText` の大文字小文字不一致（macOS では通るが Linux で落ちる）
  - `FluidTitleWarp` の無意味な三項演算子による型エラー
