# Portfolio — Izaki Seita

Izaki Seita のポートフォリオサイト。
EC領域でのコンテンツ制作・分析・改善の実績、自主制作のデザイン／3D 作品、
コードを書きながら考えてきたことをまとめるサイト。

公開URL: （デプロイ後に追記）

---

## このサイトについて

- **目的**: 転職活動で「考え方」と「アウトプット」をまとめて見せるため
- **見どころ**:
  - **Works** — 実案件の課題・施策・結果を記事的にまとめたケーススタディ
  - **Designs** — 2D / 3D の制作物ライブラリ
  - **Original Work** — 個人で組んでいるサイト・アプリ（コードメモ付き）

---

## 技術スタック

| 領域 | 使うもの |
|---|---|
| フレームワーク | Next.js（App Router） |
| 言語 | TypeScript |
| スタイル | Tailwind CSS |
| アニメーション | GSAP / @gsap/react |
| 3D | Three.js / @react-three/fiber / drei |
| アイコン | lucide-react |
| ホスティング | Vercel |

---

## ローカル開発

```bash
npm install
npm run dev
# → http://localhost:3000
```

### 主要スクリプト

```bash
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド
npm run start    # 本番サーバー起動
npm run lint     # ESLint チェック
```

---

## ディレクトリ構成（予定）

```
portfolio/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx
│  └─ globals.css
├─ components/
│  ├─ sections/    # Hero, About, Works, Designs, Original, Contact
│  └─ ui/          # ArticleCard, LibraryCard, Modal, LockedArea ...
├─ data/           # works.ts / designs-2d.ts / designs-3d.ts / original-works.ts
├─ lib/            # animations.ts ほか
└─ public/         # 画像・OGP
```

---

## 制作メモ

- 開始: 2026年5月
- 制作タスクリスト: `portfolio-tasks.md`
- 原稿（Works 6案件の文言）: `works-content.md`

### 設計の軸

- **言葉選びを最優先**: 実装に引っ張られず、コンテンツの文章を磨く
- **8割で公開→育てる**: 完璧主義の罠を避ける
- **数字は誇張せず正確に**: 信頼を損なわないため

---

## ライセンス

個人のポートフォリオ用途のため、コード・コンテンツの転載・流用はご遠慮ください。
