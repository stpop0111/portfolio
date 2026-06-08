# About ページ アニメーション設計書

ポートフォリオサイトの About ME ページ、「Home からの遷移 → タイトル登場 → スクロール演出」までのアニメーション設計。
Hero 完成後、サブページの基本パターンとして他ページ（Works / Creative / Original）にも転用予定。

**ステータス**: 初稿。実装前の設計確定版。

---

## 全体の流れ（5フェーズ）

```
[Phase 1] Home でキーキャップクリック → 白幕①が下から上にスライド（既存 .whiteCurtain）
   ↓
[Phase 2] /about に遷移、白幕①が上に抜けて消える
   ↓
[Phase 3] クリーム幕②が下から登場 → 画面全体を覆い切って停止（背景化）
   ↓
[Phase 4] タイトル「A」「bout Me」が中央に登場（Portfolio と同じ演出）
   ↓
[Phase 5] ユーザーが半画面スクロール → 背景色がフェード変化 + タイトル縮小・上部固定
   ↓
[Phase 6] 本編の7セクション（原稿）スクロール表示（後で設計）
```

---

## Phase 1: 遷移開始（Home → About）

既存のホーム側の挙動なので変更不要。

| 項目 | 内容 |
|---|---|
| 動き | `.whiteCurtain` が `y: 100%` → `y: 0%` にスライド |
| 時間 | 0.6s |
| イージング | `power2.inOut` |
| 完了時 | `router.push('/about')` |

**実装メモ**
- `app/page.tsx` の `useGSAP` 内、既存ロジックそのまま使用
- 遷移先で「白幕が上に抜けるアニメ」を引き継ぐ必要あり

---

## Phase 2: About 入場・白幕①退場

| 項目 | 内容 |
|---|---|
| 動き | 白幕①（`.whiteCurtain`）が `y: 0%` → `y: -100%` に上スライド |
| 時間 | 0.6s |
| イージング | `power2.inOut` |
| トリガー | ページマウント直後（`useGSAP` or `useEffect`） |

**実装メモ**
- About ページの一番上に同じ `.whiteCurtain` の div を配置
- 初期位置 `y: 0%`（画面を覆ってる状態）
- マウント時に上にスライドアウト

---

## Phase 3: クリーム幕②の登場

| 項目 | 内容 |
|---|---|
| 色 | `rgba(250, 243, 225, 1)` (= `#FAF3E1`) |
| 動き | 下から上にスライドイン → 画面を覆い切って停止 |
| 開始位置 | `y: 100%` |
| 終了位置 | `y: 0%`（画面全体を覆う） |
| 時間 | 0.6s |
| イージング | `power2.inOut` |
| トリガー | 白幕①が消え切ったタイミング（Timeline で `>` 連結） |
| 退場 | しない（背景として残る） |

**実装メモ**
- `<div className='creamCurtain fixed inset-0 z-90' style={{ backgroundColor: 'rgba(250, 243, 225, 1)', transform: 'translateY(100%)' }} />`
- アニメ完了後はそのまま背景として機能
- z-index 設計に注意：タイトルロゴはこれより上に配置

---

## Phase 4: タイトルロゴ登場

「A」を 3D ガラス文字、「bout Me」を drei `<Text>` で構成。
Portfolio タイトルと同じ演出パターン。

### ロゴ構成

| パーツ | 種類 | 内容 |
|---|---|---|
| 「A」 | 3D メッシュ（ガラス） | `/public/models/letter_a.glb` の `Curve` ノード |
| 「bout Me」 | drei `<Text>` | Urbanist-MediumItalic.ttf、初期色 `#fafafa` |

### マテリアル設定（A の 3D 文字）

Portfolio の F と同じ `MeshTransmissionMaterial`：

```tsx
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
background={new Color('#FAF3E1')}
side={DoubleSide}
backside={true}
color='#ffffff'
```

### 登場アニメ（Portfolio と同じ）

| アクション | 時間 | イージング |
|---|---|---|
| 「A」が scale 0 → 元のサイズ に pop up | 0.8s | `back.out(2)` |
| 「bout Me」が opacity 0 → 1 に fade-in | 0.8s | `power2.out` |

両方同時実行（Timeline `<` 連結）。

**実装メモ**
- 中央配置：CanvasTitle と同じく `fixed inset-0` の中で flex 中央寄せ
- z-index：クリーム幕より上、ナビより下

---

## Phase 5: スクロール演出（色変化 + タイトル縮小）

### トリガー

| 項目 | 内容 |
|---|---|
| 発火位置 | スクロール量 = 画面半分（`50vh`） |
| ライブラリ | GSAP `ScrollTrigger` |
| 発火タイプ | 一度だけ（`onEnter` のみ） |

### 同時に走る2つのアニメ

#### ① 背景色フェード

| 項目 | 内容 |
|---|---|
| 開始色 | `#FAF3E1`（クリーム幕の色） |
| 終了色 | `Keycap.color`（このページでは `#FAF3E1` ＝同色、他ページで変化） |
| 時間 | 0.4s |
| イージング | `power2.inOut` |

**ページ別の Keycap.color 対応表**

| ページ | Keycap.color | 視覚的変化 |
|---|---|---|
| About ME | `#FAF3E1` | なし（クリームと同色） |
| Works | `#FA8112` | クリーム → オレンジ |
| Creative | `#F5E7C6` | クリーム → 薄い黄 |
| Original Works | `#222222` | クリーム → 黒 |

#### ② タイトル縮小・上部固定

| 項目 | 内容 |
|---|---|
| scale | `1` → `0.3`（目安、要調整） |
| 位置 | 中央 → 画面上部に固定 |
| 時間 | 0.4s（背景フェードと同期） |
| イージング | `power2.inOut` |
| 縮小後の表示位置 | 画面最上部、中央寄せ（要確認） |

**実装メモ**

```tsx
ScrollTrigger.create({
  trigger: '.aboutTitleSection',
  start: 'top -50vh',
  onEnter: () => {
    const tl = gsap.timeline();
    tl.to('.aboutBg', {
      backgroundColor: '#FAF3E1',
      duration: 0.4,
      ease: 'power2.inOut',
    })
    .to('.aboutTitleLogo', {
      scale: 0.3,
      y: '-40vh',
      duration: 0.4,
      ease: 'power2.inOut',
    }, '<');
  },
});
```

---

## Phase 6: 本編セクション（未設計）

原稿の7セクション。後で設計予定。詳細は別ドキュメントへ。

参考：原稿の構造（7セクション）

1. 自己紹介
2. バックグラウンド（電子工業 → 国際教養 → コード）
3. 現在のロール（小さなチームのリード）
4. 仕事観（すべて地続き）
5. 制作哲学（やさしくありたい）
6. チーム観（チームで増やす方が好き）
7. 締め（好奇心 / 学び / 細部に）

---

## 必要なアセット・ファイル

### 既存
- `/public/fonts/Urbanist-MediumItalic.ttf`

### 新規
- `/public/models/letter_a.glb`（配置済み）
- `/app/about/page.tsx`
- `/app/about/components/AboutTitle.tsx`
- `/app/about/components/CanvasAboutTitle.tsx`

### 共通化候補（将来）
- `/app/_components/PageTitleLogo.tsx`
- `/app/_components/PageEntry.tsx`
- `/app/_components/PageScrollReveal.tsx`

---

## 依存ライブラリ

### 追加導入
- `gsap/ScrollTrigger`（gsap に同梱）

```tsx
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
```

### 既存
- gsap / @gsap/react / @react-three/fiber / @react-three/drei / three / lenis

---

## カラーパレット

| 名前 | HEX | 用途 |
|---|---|---|
| クリーム | `#FAF3E1` | 背景・クリーム幕②・MTM background |
| キーキャップ色（About） | `#FAF3E1` | スクロール後の背景色 |
| タイトル初期色 | `#FAFAFA` | drei Text |
| タイトル終了色 | `#262626` | （Hero と統一する場合の候補） |

---

## 実装順番（推奨）

1. `gsap/ScrollTrigger` の登録
2. `/app/about/page.tsx` のベース作成
3. クリーム幕② の登場アニメ（Phase 2 + 3）
4. `CanvasAboutTitle` 実装（letter_a.glb 読み込み）
5. タイトル登場アニメ（Phase 4）
6. ScrollTrigger で色変化 + 縮小（Phase 5）
7. 動作確認・微調整
8. 共通コンポーネント化

---

## 未確定・要検討項目

- [ ] Phase 5 のタイトル縮小後の正確な位置（画面上部・中央寄せ・サイズ）
- [ ] Phase 5 の `y: -40vh` の数値（カメラ・キャンバスサイズに依存）
- [ ] スクロール戻り時の挙動（`onLeaveBack` で元に戻す？放置？）
- [ ] タイトル文字色のフェード（初期 `#FAFAFA` → 何色に？）
- [ ] クリーム幕②の z-index と他要素（ナビ・カーテン）との競合確認
- [ ] スマホでのスクロールトリガー位置（`50vh` で OK か）

---

## 参考

- Hero 設計書: `hero-animation.md`
- ホーム実装: `app/page.tsx`、`app/hero/Canvas/CanvasTitle/`

---

## 🔧 リファクタリングメモ（後で共通化する時に）

### 変数化したい値
- **スクロール距離**：現状 `'+=100vh'` ハードコード → `SCROLL_DISTANCE` 変数化
- **目的色（背景・マテリアル）**：`#222222` / `#FAF3E1` などハードコード → 各ページごとの設定オブジェクトに
- **アニメーション時間**：`duration: 0.4` などの値も統一して定数化
- **位置値**：`y: '-40vh'`、`scale: 0.5` も変数化

### 作るべきユーティリティ
- **RGB ⇔ HEX 変換関数**：
  - `hexToRgb01('#222222')` → `{ r: 0.133, g: 0.133, b: 0.133 }`
  - Three.js の `Color` は 0〜1 正規化値なので / 255 して使う
  - 各色で手動計算してるのを統一

### コンポーネント化候補
- **PageTitle3D**：A + bout Me の 3D シーン汎用化
  - props: `preText` / `postText` / `modelPath` / `targetColor`
- **PageEntry**：クリーム幕の登場アニメ汎用化
  - props: `keycapColor`
- **PageScrollReveal**：scrub + onLeave/onEnterBack の構造汎用化
  - props: `scrollDistance` / `fromColor` / `toColor` / `wrapperRef`

### Rule of Three
About → Works で 2回目 → Creative で 3回目使うタイミングで共通化するのがちょうどいい。
最初から完璧な汎用化は避ける。

---

## 🚀 今後の追加機能メモ

### 1. ページ最終部の演出（Contact）
- **リキッドシェイプがランダムに形を変えるアニメ**（メタボール風 / Three.js or shader）
- **Contact Me** セクション
- 7セクション読み終わった後の到達ポイント

### 2. 無限ループ的な戻り演出
- Contact のさらに下までスクロールしたら **カーテン演出が再発火**
- カーテン後にページの**一番上に戻る**（リフレッシュ感のあるリセット）
- 詩的な余韻 + UX 的に「終わりじゃないよ」のメッセージ

### 3. Accent ホバーで詳細モーダル
- `<Accent>` 各単語に**ホバーすると、そのキーワードの 3D モデル＋情報モーダル**が出る
- 例：
  - `Seita` ホバー → 出身地・誕生日などのプロフィール
  - `C` `Python` → そのプログラミング言語の 3D アイコン＋簡単な経歴説明
  - `ECサイト` → 実際の作品プレビュー
- Three.js でモデルロード、フレーマー的なモーダル表示

### 4. リロード・初回訪問時の挙動
- ページをリロードや初回訪問した時は**毎回ページの一番上から**スタート
- ブラウザのスクロール位置復元（`history.scrollRestoration`）を OFF にする
- `useEffect` で初回マウント時に `window.scrollTo(0, 0)` ＆ Lenis 初期化
- 体験の一貫性を保つために重要

### 実装優先度（ざっくり）
1. **#4 リロード時に最初から**（小さい変更で UX 大改善）
2. **#3 Accent ホバーモーダル**（コンテンツリッチ化、コアバリュー）
3. **#1 リキッドシェイプ + Contact**（ページ完成感アップ）
4. **#2 無限ループ演出**（こだわり仕上げ、最後でOK）

