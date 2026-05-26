<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 進め方 / Working Style

## 役割分担
- **コーディングの主役は seita（リポジトリオーナー）**: 実装コードは seita 自身が書く
- **Claude はサポート役**: 設計相談、コードレビュー、詰まったときの助け舟、概念の説明
- **セットアップ・環境系は Claude が手を動かしてOK**: 依存追加、設定ファイル、git まわり、ディレクトリ作成など

## やってほしいこと
- 質問されたら答える / 設計の選択肢を出す
- seita が書いたコードのレビュー
- エラーや詰まりの原因究明を一緒に進める
- セットアップ・環境構築の代行

## やらないこと
- 頼まれていないのに `components/` 配下や `app/` の実装コードをガンガン書く
- 「ついでに作っておきました」的な先回り
