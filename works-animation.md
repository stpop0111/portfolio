# Works ページ アニメーション設計書

ポートフォリオサイトの Works ページの全体設計。
Hero → Works への遷移、PC モニター内でのフォルダ展開、Mac OS 9 風モーダルまで。

**ステータス**: 初稿。実装前の設計確定版。
**参照**: PDF 設計書（works.pdf）

---

## 設計のコアコンセプト

> 「PC モニターの中に入り込む体験」

- Works ページは**全てが PC モニターの中で完結**する
- 一覧表示、ホバー演出、詳細モーダルすべてが**スクリーン内のエクスプローラ**として表現される
- 世界観：Hero の PC モデル世界観を継承、Mac OS 9 風レトロ UI で技術系の遊び心

---

## 全体の流れ（5フェーズ）

```
[Phase 1] Home でキーキャップ「WORKS」クリック
   ↓ 白幕①が下から上スライド（Hero 既存）
[Phase 2] /works に遷移、白幕①が上に抜ける
   ↓
[Phase 3] クリーム幕②③④ が下から登場（3 枚ずらし、キーキャップ色シェード）
   ↓
[Phase 4] 「Works」3D ガラス文字タイトル登場（W が 3D）
   ↓ スクロール
[Phase 5] タイトル縮小・上部固定、PC モデルが下から拡大登場
   ↓
[Phase 6] PC スクリーンに 4 つのフォルダ表示（横並び）
   ↓ ホバー
[Phase 7] フォルダ変形 + ジャンルアイコン出現
   ↓ クリック
[Phase 8] Mac OS 9 風モーダルが開く（カテゴリ内ドキュメント一覧）
   ↓ ドキュメントクリック
[Phase 9] 詳細モーダル展開（プロジェクト概要・期間・スクショ・スタック等）
```

---

## Phase 1〜2: 遷移開始（Home → Works）

About と同じパターン踏襲。`.whiteCurtain` を共有。

| 項目 | 内容 |
|---|---|
| 動き | Hero の白幕がスライドアップ → `/works` 遷移 → Works ページの白幕がスライドアウト |
| 共通化 | About で確立したパターンを再利用 |

---

## Phase 3: クリーム幕の登場（3枚ずらし）

| 項目 | 内容 |
|---|---|
| 枚数 | 3 枚（リッチな演出のため） |
| 色 | キーキャップ色 `#F5E7C6`（Works のキーキャップ色）の**シェードちれ** |
| 動き | 下から上に**スタッガー**でスライドイン |
| 最終位置 | 一番奥の幕は背景化、上 2 枚は退場 or 階層的に残る（要検討） |

### シェード案
- 幕①（一番奥）：`#F5E7C6`（ベース色、最も明るい）
- 幕②（中段）：`#E8D9B0`（中間）
- 幕③（手前）：`#D9C594`（最も濃い）

→ 後ろから濃淡で奥行きを演出。GSAP の stagger で 0.1〜0.15s ずらして登場。

---

## Phase 4: 「Works」タイトル登場

| パーツ | 種類 | 内容 |
|---|---|---|
| **W** | 3D メッシュ（ガラス） | `/public/models/letter_w.glb`（新規作成） |
| **orks** | drei `<Text>` | Adobe Fonts または既存フォント |

### マテリアル
F（Hero）、A（About）と同じ `MeshTransmissionMaterial` 系。
- iridescence あり / なしは要検討

### 登場アニメ
- W: scale 0 → 通常サイズに pop up（`back.out`）
- orks: opacity 0 → 1 にフェードイン

---

## Phase 5: スクロール演出（タイトル縮小 + PC 登場）

About と異なり、**PC モデルが下からせり上がってくる**のがポイント。

| 要素 | スクロール開始 | スクロール完了 |
|---|---|---|
| Worksタイトル | 中央、大きいサイズ | 画面上部に固定、小さくなる |
| PC モデル | 画面外（下） | 中央〜下に大きく表示 |
| クリーム幕 | 残っている | 背景として固定 |

### 実装方針
- ScrollTrigger（scrub）でタイトル位置・サイズと PC モデル位置を**同時に補間**
- `.titleSection` の高さは 200〜300vh 想定（要調整）

---

## Phase 6: PC スクリーンにフォルダ表示

### 表現の手法（要検討）
スクリーンの中身は以下のいずれか：

#### 案A：Canvas テクスチャ（推奨・第一候補）
- Hero と同じ手法。PC モニター素材を Canvas テクスチャに
- フォルダの 2D 図形を Canvas API で描画
- メリット：シーン内に完結、世界観統一
- デメリット：ホバー検知・SVG 演出が複雑

#### 案B：2D HTML/SVG オーバーレイ（フォールバック）
- PC モデル位置に合わせて HTML 要素を絶対配置
- フォルダは SVG/Img でホバー演出簡単
- メリット：実装楽、リッチな表現可能
- デメリット：3D モデルとの位置同期が必要、ウィンドウサイズ依存

### 採用方針
**まず案A（Canvas）でトライ**、ホバー演出が複雑すぎる場合は **案B にフォールバック**。

### フォルダの基本データ構造（コンポーネント化）

```ts
type WorkCategory = {
  id: string;
  label: string;       // 'Direction' | 'Design' | 'Code' | TBD
  icon: string;        // ジャンルを象徴するアイコン
  documents: Document[];
};

type Document = {
  id: string;
  title: string;
  // common
  overview: string;
  period: string;
  // free-form
  detail: ReactNode;   // 自由に設計可能
};
```

カテゴリ・ファイル数は**全てデータ駆動で拡張可能**。

---

## Phase 7: フォルダのホバー演出

| 動き | 内容 |
|---|---|
| フォルダの変形 | やや浮き上がる + 上端が開くような変形 |
| アイコン出現 | フォルダから**ジャンルアイコン**が浮かび上がる |
| カーソル | フォルダ範囲で `cursor: pointer` |

### ジャンル別アイコン候補
- ディレクション → 指揮棒 / コンパス
- デザイン → パレット / ペン
- コード → `< />` タグ / 端末
- 4 つ目（未定） → 後で決定

---

## Phase 8: Mac OS 9 風モーダル（カテゴリ展開）

フォルダクリック → モーダルウィンドウが開く。

### 見た目（Mac OS 9 風）
- タイトルバー：横ストライプ、左に閉じる×・最小化□・全画面□
- フォント：レトロ系（Chicago 風 or DotGothic16 風）
- 背景：ドット柄 / 薄グレー
- 影：3D っぽいシャドウ

### 内容
- ヘッダー：カテゴリ名（例：「ORIGINAL」）
- 本体：ドキュメントアイコン格子表示（EXAMPLE × 8 個）
- 各ドキュメントクリック → 詳細モーダル

### 実装方針
**drei `<Html>` コンポーネント** で WebGL シーン内に HTML として表示。

```tsx
<Html position={[0, 0, 0.1]} transform>
  <div className="mac-os-9-modal">...</div>
</Html>
```

`transform` 指定で 3D 空間に追随、シーンとの一貫性保つ。

---

## Phase 9: 詳細モーダル（プロジェクト詳細）

### 共通項目
- プロジェクト名（仮名でも OK）
- 期間
- 概要

### 自由項目（ドキュメント毎にカスタム）
- スクリーンショット
- 技術スタック
- 課題と解決アプローチ
- 外部リンク（GitHub / 本番 URL）

### 拡張性
`detail: ReactNode` 型でドキュメント毎に**任意の JSX**を渡せる。

---

## 必要なアセット・ファイル

### 新規作成
- `/public/models/letter_w.glb` ← Blender で作成
- `/app/works/page.tsx` ← メインページ
- `/app/works/Canvas/CanvasWorksTitle/` ← Works タイトル 3D
  - `index.tsx`
  - `Model.tsx`
- `/app/works/components/FolderGrid.tsx` ← 4 フォルダ表示
- `/app/works/components/MacOS9Modal.tsx` ← レトロモーダル
- `/app/works/components/DetailModal.tsx` ← 詳細モーダル

### データ
- `/app/works/data/categories.ts` ← カテゴリ + ドキュメント定義

### 既存活用
- `/public/models/model__pc.glb`（Hero と同じ）
- `app/hero/Canvas/CanvasPC/` のロジック参考（再利用可能性検討）

---

## 共通化候補（再利用設計）

About で確立したパターンを Works でも使う：
- 白幕①の退場ロジック（既に共通）
- クリーム幕②の登場（カラー変えれば使い回せる）
- 3D 文字タイトルの構造（W に letter-w.glb を差し替えるだけ）
- ScrollTrigger ベースの縮小・移動

**「Rule of Three」原則**：Works 実装中に共通化したくなった部分を、汎用コンポーネントとして抽出する。

---

## 技術スタック（既存環境のみで OK）

- Next.js 16 App Router
- @react-three/fiber / drei（drei `<Html>` 必須）
- GSAP / ScrollTrigger / MorphSVGPlugin
- Lenis
- Adobe Fonts（既存 kit）

新規追加なし。

---

## カラーパレット

| 名前 | HEX | 用途 |
|---|---|---|
| キーキャップ色 (Works) | `#F5E7C6` | クリーム幕、テーマカラー |
| キーキャップシェード中 | `#E8D9B0` | クリーム幕中段 |
| キーキャップシェード濃 | `#D9C594` | クリーム幕手前 |
| PC ボディ | （Hero と同じ） | PC モデル |
| LCD グリーン | `#1a3a1a` | PC スクリーン背景（要検討） |
| フォルダ黄 | `#F0C03E` | フォルダアイコン |
| Mac OS 9 グレー | `#C0C0C0` | モーダル背景 |

---

## 実装ステップ（推奨順）

### 段階1: 静的な土台（Phase 1〜4）
1. `/app/works/page.tsx` 作成
2. 白幕②退場 + クリーム幕①②③ 登場アニメ
3. 「Works」3D タイトル（W モデル作成 → CanvasWorksTitle）
4. About と同じ構造で初期表示まで

### 段階2: PC 登場（Phase 5）
5. Hero PC モデル再利用 → Works 用に配置調整
6. ScrollTrigger でタイトル縮小 + PC 登場演出

### 段階3: フォルダ表示（Phase 6）
7. データ構造定義（categories.ts）
8. フォルダ描画（案A or B）
9. フォルダ配置・スタイリング

### 段階4: インタラクション（Phase 7〜9）
10. ホバー演出
11. クリックでモーダル表示
12. Mac OS 9 風モーダル UI
13. 詳細モーダル

### 段階5: 仕上げ
14. レスポンシブ対応
15. パフォーマンス最適化
16. 動作確認

---

## 未確定・要検討項目

- [ ] 4 つ目のカテゴリの内容（実装時に決定でOK）
- [ ] PC スクリーンが Canvas か HTML オーバーレイか（実装中に判断）
- [ ] フォルダのホバー時の正確な変形パターン
- [ ] Mac OS 9 風モーダルの正確なビジュアル
- [ ] PC モデルの最終的なサイズ・配置
- [ ] レスポンシブ：モバイルでの表示方法（PC モデル小さくする？モーダルフルスクリーン？）
- [ ] 詳細モーダルからの戻り遷移
- [ ] 複数モーダル開いた時の z-index 設計

---

## 参考

- About 設計書: `about-animation.md`
- Hero 設計書: `hero-animation.md`
- 設計 PDF: `works.pdf`（uploads）
