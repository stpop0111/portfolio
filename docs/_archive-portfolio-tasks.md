# Portfolio Site — 制作タスクリスト

Izaki Seita のポートフォリオサイト制作のタスクリスト。
週単位の縛りはなし、順番に消化していくスタイル。

**開始**: 2026年5月
**ゴール**: 公開して転職活動に投入できる状態

---

## 🌱 Phase 1: 準備

実装に入る前に、迷子にならないための土台作り。

### コンテンツ確定

- [ ] Works（6案件）の最終文言を確定
  - [ ] W-01 メルマガ改善
  - [ ] W-02 スイーツ特集
  - [ ] W-03 グルメ特集
  - [ ] W-04 ギフト特集（+500%）
  - [ ] W-05 GTM活用
  - [ ] W-06 ジャンルTOP改修
- [ ] 機密ロックする箇所を最終決定
- [ ] 効果数値の最終チェック（誇張せず正確に）
- [ ] Designs 2D 9件の最終リスト
- [ ] Designs 3D 7件の最終リスト
- [ ] Original Work 6作品のリスト確定

### デザイン素材集め

- [ ] 参考サイト10件をブックマーク（Huaban / Awwwards 等）
- [ ] 参考サイトから「色」「レイアウト」「タイポ」「動き」を別々にメモ
- [ ] 好みの色パレットを3案ピックアップ
- [ ] フォントの組み合わせを2-3案検討

### Figma カンプ作成

- [ ] デザイントークン定義（Variables機能で色・フォント・サイズ）
- [ ] Hero セクションのデザイン
- [ ] About セクションのデザイン
- [ ] Works（記事的）のデザイン
- [ ] Designs（ライブラリ的、2D/3D）のデザイン
- [ ] Original Work（コードメモ付き）のデザイン
- [ ] Contact セクションのデザイン
- [ ] PC版完成
- [ ] SP版（モバイル）完成

### 環境準備

- [ ] GitHub リポジトリ作成（`portfolio`）
- [ ] README 作成（プロジェクト概要）
- [ ] Vercel アカウント準備（連携用）
- [ ] 独自ドメインを取るか決める（あとでもOK）

---

## 🏗️ Phase 2: 構築

実際に Next.js で実装するフェーズ。

### Next.js セットアップ

- [ ] `npx create-next-app@latest portfolio` 実行
  - TypeScript: Yes
  - ESLint: Yes
  - Tailwind CSS: Yes
  - App Router: Yes
- [ ] ローカル起動確認（`npm run dev` で見える）
- [ ] 依存ライブラリ追加
  - [ ] `npm install gsap @gsap/react`
  - [ ] `npm install three @react-three/fiber @react-three/drei`
  - [ ] `npm install -D @types/three`
  - [ ] `npm install lucide-react clsx`
- [ ] Prettier 設定（任意）
- [ ] GitHub に push

### 共通基盤

- [ ] `tailwind.config.ts` にデザイントークン定義
  - [ ] カラーパレット（cream, ink, accent等）
  - [ ] フォントファミリー
  - [ ] スペーシング・コンテナサイズ
- [ ] `app/globals.css` でCSS変数・基本スタイル設定
- [ ] フォント読み込み（Zen Old Mincho 等）
- [ ] `app/layout.tsx` でメタデータ初期設定
- [ ] Nav コンポーネント作成
- [ ] Footer コンポーネント作成

### Hero セクション

- [ ] `components/sections/Hero.tsx` 作成
- [ ] タイポグラフィ実装
- [ ] タグライン表示
- [ ] スクロール誘導アイコン
- [ ] レスポンシブ調整

### About me

- [ ] `components/sections/About.tsx`
- [ ] 引用文の表現
- [ ] 本文配置（2カラム）
- [ ] レスポンシブ調整

### Works（記事的）

- [ ] `data/works.ts` を TypeScript で型定義 + データ
- [ ] `components/ui/ArticleCard.tsx` 作成
- [ ] `components/ui/StoryBlock.tsx`（戦略/分析/結果用）
- [ ] `components/ui/MetricsGrid.tsx`（数字表示用）
- [ ] 6案件の表示
- [ ] レスポンシブ調整

### パスワードロック機能

- [ ] `components/ui/LockedArea.tsx` 作成
- [ ] blur フィルタ + オーバーレイの実装
- [ ] パスワード認証ロジック
- [ ] localStorage で認証状態保存（一度入れたら次回も解除）
- [ ] W-04 ギフト特集の機密部分に適用
- [ ] パスワードの管理方法を決める（環境変数 or 定数）

### Designs（ライブラリ的）

- [ ] `data/designs-2d.ts` データ作成
- [ ] `data/designs-3d.ts` データ作成
- [ ] タブ切替コンポーネント
- [ ] `components/ui/LibraryCard.tsx` 作成
- [ ] サムネ画像の準備（PNG書き出し）
- [ ] 2Dタブのグリッド表示
- [ ] 3Dタブのグリッド表示
- [ ] レスポンシブ調整

### モーダル

- [ ] `components/ui/Modal.tsx` 作成
- [ ] ライブラリカードクリックで開く
- [ ] Esc キーで閉じる
- [ ] 背景クリックで閉じる
- [ ] 関連ディレクションへのジャンプ機能
- [ ] アニメーション付き（GSAPでもCSS Transitionでも）

### Original Work（記事的）

- [ ] `data/original-works.ts` データ作成
- [ ] `components/ui/OriginalCard.tsx`（左右交互レイアウト）
- [ ] 状態バッジ（LIVE / WIP / DRAFT）
- [ ] サムネ表示
- [ ] 6作品の配置

### Code Memo アコーディオン

- [ ] `components/ui/CodeMemoPanel.tsx` 作成
- [ ] 開閉動作
- [ ] コードハイライト（`react-syntax-highlighter` or 自前）
- [ ] 各作品のコードメモを準備

### Contact

- [ ] `components/sections/Contact.tsx`
- [ ] ダーク背景の切替
- [ ] 連絡先リスト
- [ ] 実際の連絡先を反映（プレースホルダー差し替え）

---

## ✨ Phase 3: 装飾

完成したものに動きと深みを足す。

### GSAP セットアップ

- [ ] `@gsap/react` の `useGSAP` フック導入
- [ ] ScrollTrigger プラグイン登録
- [ ] 共通アニメーションプリセット作成（`lib/animations.ts`）

### スクロール演出

- [ ] 各セクションの入場時フェードイン
- [ ] セクションタイトルのスライドアップ
- [ ] Hero のテキスト出現（splitなど）
- [ ] 記事カード（Works / Original）の登場演出

### 数字・グラフ演出

- [ ] メトリクスの数字カウントアップアニメ
- [ ] 「+500%」の特別演出（グラフ or バーの伸び）
- [ ] スクロール連動でトリガー

### モーダル・アコーディオン演出

- [ ] モーダル開閉のスムーズ化
- [ ] Code Memo アコーディオン開閉
- [ ] タブ切替時のクロスフェード

### Three.js / 3D 統合

- [ ] React Three Fiber セットアップ
- [ ] Hero に控えめな3D要素（パーティクル or 波）
- [ ] 3D作品サムネを Spline iframe で埋め込み
  - もしくは静止画 PNG で代替
- [ ] モバイル時の3D無効化判定
- [ ] パフォーマンス計測（FPS確認）

### マイクロインタラクション

- [ ] hover時のカード浮き上がり
- [ ] ボタンの押下感
- [ ] リンクのアンダーラインアニメ
- [ ] カーソル変化（任意）

### レスポンシブの追い込み

- [ ] iPhone（Safari）で全画面確認
- [ ] Android（Chrome）で全画面確認
- [ ] iPad サイズで確認
- [ ] 横スクロール禁止の徹底
- [ ] タップ領域の確保（最低44×44px）

---

## 🚀 Phase 4: 仕上げ

公開と運用準備。

### SEO・OGP

- [ ] メタタグ完備（title, description）
- [ ] OGP画像作成（1200×630）
  - もしくは `opengraph-image.tsx` で動的生成
- [ ] Twitter Card 設定
- [ ] favicon 作成（複数サイズ）
- [ ] 構造化データ（Person schema、任意）
- [ ] robots.txt / sitemap.xml

### パフォーマンス

- [ ] 画像最適化（Next/Image 使う、WebP変換）
- [ ] フォント最適化（subset、display: swap）
- [ ] Code Splitting 確認
- [ ] Lighthouse スコア計測
  - Performance: 目標 90+
  - Accessibility: 目標 95+
  - Best Practices: 目標 95+
  - SEO: 目標 95+

### アクセシビリティ

- [ ] キーボードのみで操作可能か確認
- [ ] フォーカススタイルが分かるか
- [ ] 画像にalt属性
- [ ] コントラスト比 WCAG AA以上
- [ ] スクリーンリーダー対応（最低限）
- [ ] `prefers-reduced-motion` 対応

### デプロイ

- [ ] Vercel にプロジェクト連携
- [ ] 環境変数設定（パスワードなど）
- [ ] 本番ビルド確認
- [ ] カスタムドメイン設定（取得した場合）
- [ ] 公開URLの動作確認

### ブラウザ・デバイス確認

- [ ] Chrome（PC）
- [ ] Safari（PC）
- [ ] Firefox（PC）
- [ ] Edge（PC、任意）
- [ ] iPhone Safari
- [ ] Android Chrome

### コンテンツ最終確認

- [ ] 誤字脱字チェック
- [ ] リンク切れチェック
- [ ] 数字・効果の正確性チェック
- [ ] 個人情報の出し方を再確認
- [ ] 機密情報の取り扱い確認

### 公開後

- [ ] Wantedly プロフィールに追加
- [ ] 履歴書・職務経歴書にURL記載
- [ ] X / 個人アカウントで告知（任意）
- [ ] 信頼できる人に見せてフィードバックもらう

---

## 並行タスク（時間あるときに）

メインタスクと別に、進めておくと相乗効果があるもの。

### 自主制作の充実

- [ ] バイクLP（WIP）の3Dモデル準備
- [ ] バイクLP の実装
- [ ] ATM LP（WIP）の3Dモデル準備
- [ ] ATM LP の実装
- [ ] シャンプー EC（WIP）の実装
- [ ] 競馬予想メモアプリの構築
- [ ] 犬用セミナーアプリの実装
- [ ] TODOアプリ（DRAFT）の構想整理

### 転職活動の準備

- [ ] 職務経歴書の更新（実績ベース）
- [ ] 応募する会社のリストアップ
- [ ] カジュアル面談の練習（想定問答）
- [ ] GitHub プロフィールの整理

---

## 詰まったときの対処

ハマったらこの順番で:

1. エラーメッセージで検索
2. Next.js 公式ドキュメント確認
3. ライブラリの公式 GitHub の Issues 確認
4. 30分悩んだら一旦離れる
5. Claude（私）に相談

## 大事なリマインダー

### 完璧主義の罠

「もっと良くしたい」が無限に湧くやつ。対策:

- [ ] 各 Phase の終わりで「ここで切り上げる」と決める
- [ ] 気になる部分は GitHub Issue に書いて後回し
- [ ] 「8割で公開 → 育てる」を口癖に

### 「考え方が好き」を忘れない

実装に集中するとデザインに引っ張られがちだが、**コンテンツの言葉選び**が一番大事。

- [ ] 週1で文章を読み返す習慣
- [ ] 「なぜそう書いたか」を自問する
- [ ] 設計判断の説明を磨く

### 進捗の共有

困ったとき・節目で Claude に相談すると、整理しやすい。

- [ ] Phase 1 終了時に相談
- [ ] Phase 2 終了時に相談
- [ ] Phase 3 終了時に相談
- [ ] 公開前に最終確認

---

**End of Task List**

頑張ってください！詰まったら呼んでください。
