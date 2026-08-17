# ローディング → タイトル 実装ドキュメント

Home の冒頭「ローディング画面 → タイトル表示 → ヒーロー」を作り直したときの実装記録。
設計書（[hero-animation.md](./hero-animation.md)）が「何を作るか」なのに対し、
こちらは **実際に何をどう作ったか** と、その判断の根拠をまとめたもの。

対象ブランチ: `claude/loading-screen-implementation-lc3gvy`（16コミット）
元になった指示: PDF『ローディング⇨タイトル表示』の再設計版

**追加・変更したファイルの中身は [付録A](#付録a-全ソース) にすべて収録している。**
このドキュメント1枚でコードまで追える。

> **注意**: [hero-animation.md](./hero-animation.md) の Stage 1・2 は旧仕様
> （`Loading...` の点滅 → ブラーで `Port/olio` に変化）のままで、現状のコードと一致しない。
> 実装の正はこのドキュメント。設計書側の更新は未対応（末尾のタスク候補参照）。

---

## 1. 全体の流れ

```
[loading]  P[000]rtfolio がカウントアップ
              ↓ 100% 到達 → 1.4秒キープ
[changing] 文字が右から順に落ちて消える
              ↓ 0.35秒の間
[title]    3Dタイトル「Port/olio」がフェードイン ＋ 裏に seita のガラス
              ↓ 2.6秒 読ませる
[hero]     カーテンが上がる／PC が降りる／タイトルが上へ抜ける
```

`phase` の状態機械は `app/page.tsx` が持つ。各コンポーネントは `phase` を受け取って
自分の担当ぶんだけ動く、という既存の作りを踏襲している。

### 実測タイムライン（キャッシュ済み＝最短ケース、マウントからの秒数）

| 時刻 | 出来事 |
|---|---|
| 0.50s | 検知1 → `033` へロール（1.06秒） |
| 2.06s | 検知2 → `066` へロール |
| 3.62s | 検知3 → `100` へロール、4.68s に着地 |
| 6.08s | キープ 1.4 秒が明けて `changing` へ |
| 7.54s | 退場アニメーション完了（1.46秒） |
| 7.89s | 間を 0.35 秒おいて `title` へ |
| 10.49s | タイトルを読ませて `hero` へ |
| 〜13.1s | ヒーロー演出まで完了 |

1サイクルは `TICK 0.5 + ROLL_TIME 1.06 = 1.56秒`。
実ロードが遅いときは、検知3回で終わらず 100% に達するまでサイクルが続く。

---

## 2. 追加・変更したファイル

### 新規

| ファイル | 役割 |
|---|---|
| `app/_home/LoadingTitle/index.tsx` | ローディング画面本体。進捗検知・キープ・退場 |
| `app/_home/LoadingTitle/DigitReel.tsx` | 数字1桁ぶんのリール（オドメーター） |
| `app/_home/GlassWordmark/wordmarkPaths.ts` | seita ロゴのパスデータ＋焼き込み済み画像 |
| `app/_home/GlassWordmark/useGlassWordmark.ts` | ロゴを流体の元絵へ描き込む関数を返すフック |
| `public/fonts/Urbanist-Variable.woff2` | Urbanist 可変フォント（wght 100〜900）27KB |

### 変更

| ファイル | 変更内容 |
|---|---|
| `app/page.tsx` | 配線。旧 3000ms 待ちと点滅アニメを削除、リロードボタン 5秒→15秒、ヒーローの秒数調整 |
| `app/globals.css` | @font-face 差し替え、`.loadingTitle*` の幾何 |
| `app/_home/HeroText.tsx` | `Loading...` と進捗数字を削除（器だけ残置） |
| `app/_components/FluidEffect/FluidTitleWarp.tsx` | `underlay` プロップを追加 |
| `app/_components/CanvasTitle/Model.tsx` | タイトル表示の秒数・オーバーシュート調整 |

### 削除した挙動

- `Loading...` の点滅（`HeroText`）
- 右下の進捗数字（`HeroText`）
- 100% 到達後の `3000ms` 固定待ち（`page.tsx`）
- タイトル切り替え時のブラー演出（`page.tsx` の `phase === 'changing'` ブロック）

Curtains は残している。

---

## 3. 実装ポイント

### 3-1. 進捗の検知（`LoadingTitle/index.tsx`）

PDF 指定は「0.5秒ごとにローディングを検知」。素直に `setInterval` で組むと、
数字が回りきる前に次の検知が来てロールが切られる。そこで
**ロールの完了を待ってから次の検知を予約する** 自己再帰の `setTimeout` にした。

```
0.5秒 検知 → 0.9秒 ロール → 0.5秒 検知 → 0.9秒 ロール → …
```

回っている間は検知タイマーが止まる。ロールが途中で切られることがなくなる。

**最低表示時間の保証**：アセットがキャッシュ済みだと一瞬で 100% になり、
カウントアップが見えない。実進捗と「`MIN_DURATION` 秒かけて 0→100 に開く天井」の
低いほうを採用することで、最低3回はカウントが見える。

```ts
const ceiling = (detected / MIN_DURATION) * 100;
const next = Math.floor(Math.min(progressRef.current, ceiling, 100));
```

`detected` は**検知に使った時間の合計**で、ロール中は増えない。
実時間ではないので「検知3回ぶん」という意味が pacing を変えてもぶれない。

**注意点**
- `useProgress()` の `total` が 0 の間は進捗が当てにならないので 0 として扱う（`page.tsx`）
- 進捗が巻き戻ることがあるので、表示は減らさない
- 上限時間は設けていない。読み込みが詰まった場合の避難口は 15 秒後のリロードボタン

### 3-2. 数字のロール（`DigitReel.tsx`）

直前の値から新しい値までを **1枚ずつ積んだ列** を持ち、下端（＝直前の値）を
見せた状態から上端（＝新しい値）まで一気に回す。

```
0 → 3  … 3,2,1,0 の4枚（途中の 2 と 1 が流れて見える）
8 → 1  … 1,0,9,8 の4枚（9 をまたぐので 0 に巻き戻す）
```

列の高さは枚数で変わるので、待機位置は `-(n-1)/n * 100%`。

**描画のたびに列を待機位置へ戻してから回す**のがポイント。戻した瞬間に見えるのは
`prevChar` ＝ 直前に画面に出ていた数字そのものなので、リセットしても表示は途切れない。
paint 前に確定させるため `useLayoutEffect` を使う。値が変わらない桁は動かさない。

> **ハマったところ**: 列を包む `span` にクラスを付け忘れて `display: inline` のままだった。
> **インライン要素には transform が適用されない**ため、GSAP が `yPercent` を書いても
> 位置が動かず「数値が瞬間的に入れ替わる」だけになっていた。`display: block` が必須。

### 3-3. 文字組みの幾何（`globals.css`）

**文字は素の span。** 掛かっているのは `display: inline-block` だけで、
これも `transform` を効かせるため（インライン要素には効かない）であって、
位置をずらす指定はひとつも無い。普通のテキストとして1行に流れる。

```
.loadingTitle              ← font-size / letter-spacing / em の解決基準
  └ h1.loadingTitle__line     ← height: --clip-h + overflow: hidden（切り取り線）
      ├ span.loadingGlyph  P
      ├ span.loadingGlyph.loadingTitle__reel  [087]
      └ span.loadingGlyph  r t f o l i o
```

**マスクが要る理由は退場だけ。** 文字が下へ落ちてベースラインの線の裏に
潜って消える、あの見え方のために `overflow: hidden` が要る。
PDF のモックアップを実測したとき、`rtfolio` の各文字の下端がすべて同じ
y 座標で切れていたので、切り取り線は行にひとつで足りる。

**文字を動かさずに切り取り位置を合わせる**のがポイント。当初は行を負マージンで
持ち上げてベースラインをマスク下端に寄せていたが、それだと文字が端数の位置に乗る。
クリップ位置のほうを「行ボックス上端から 0.865em」に取れば、文字は一切動かさずに
同じ場所で切れる。

数値は Urbanist Bold (wght 700, unitsPerEm 2000) のメトリクスから算出。

| 変数 | 値 | 根拠 |
|---|---|---|
| `--clip-h` | `0.865em` | 行ボックス上端からの切り取り位置。ベースライン（0.85em）の 0.015em 下 |
| `--rect-h` | `0.79em` | 白矩形の高さ。アセンダ上端（`f` = 0.762em）〜ベースライン |
| `--slot-w` | `0.61em` | いちばん広い数字「0」の送り幅 0.6045em |
| `--bleed` | `0.08em` | 字面が送り幅からはみ出すぶんの逃げ |

`--clip-h` の余り 0.015em は、`o` や `0` のオーバーシュート（ベースラインの
0.013em 下）が切り取り線に触れないための逃げ。

**em の解決基準に注意**：`--clip-h` などを `em` で書いているので、`font-size` は
切り取る箱より**外側**（`.loadingTitle`）に置く必要がある。内側に置くと
高さが本文サイズ基準（16px）で解決されて潰れる。

**片側だけ overflow を visible にできない問題**：CSS の仕様上、片方を `visible` に
すると他方が `auto` に化けてスクロールバーが出る。左右にパディングを足して
クリップ範囲を横に広げ、同じ量のネガティブマージンで見た目の幅を戻している。

```css
.loadingTitle__line {
  height: var(--clip-h);
  overflow: hidden;
  padding-inline: var(--bleed);
  margin-inline: calc(var(--bleed) * -1);
  white-space: nowrap;
}
```

字間は素直に `letter-spacing: -0.04em`。`inline-block` の間にも効く。
この値で P が白矩形に接し、PDF のモックアップと同じ組みになる。

**白矩形のベースライン合わせ**：`overflow: hidden` を持つ `inline-block` は
ベースラインが下端になるという CSS の規定を使っている。`vertical-align: -0.015em` で
オーバーシュートぶんだけ沈めると、矩形の下端が切り取り線と揃う。
中の数字も `line-height: 0.85` だけで位置が決まり、マージンを使わない。

**フォントスムージング**：`<html>` に Tailwind の `antialiased`
（`-webkit-font-smoothing: antialiased`）が付いている。macOS ではグレースケール
描画になって字が細くやわらかく出るため、250px 級の太字だと輪郭が甘く見える。
この画面だけ `subpixel-antialiased` に戻している。

### 3-4. フォント

Google Fonts の Urbanist 可変フォント（wght 100〜900）を woff2 で取得し、
`public/fonts/` に置いて**セルフホスト**している。ローディング画面は最速で
出したい画面なので、CDN への外部リクエストを挟まない。

```css
@font-face {
  font-family: "Urbanist";
  src: url("/fonts/Urbanist-Variable.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}
```

3Dタイトル側は従来どおり `Urbanist-MediumItalic.ttf`（drei の `<Text>` が直接読む）を
使っているため、その ttf は残してある。

### 3-5. seita のガラス（`GlassWordmark/`）

タイトルの裏に敷くロゴ。**タイトルと同じ流体（`FluidTitleWarp`）で歪ませる**ために、
DOM ではなく流体の元絵（2Dキャンバス）へ描き込んでいる。

```
FluidTitleWarp
  └ drawSource（元絵の2Dキャンバス）
      ├ seita のガラス   ← underlay で先に描く＝奥
      └ タイトルの3D     ← あとから重ねる
  → 流体で歪ませて表示
```

`FluidTitleWarp` に `underlay` プロップを足した。タイトルより先に描いたものは
そのまま同じ歪みを受ける。

**位置合わせが不要**：描画位置をタイトルの矩形（`sourceRef.getBoundingClientRect()`）から
出しているので、ヒーローでタイトルが上へ動くとガラスも自動で付いていく。
タイムライン側でガラスを動かす必要がない。

**ガラスの見た目は焼き込み**：キャンバスには `backdrop-filter` を掛けられないので、
白い薄膜とふちの光を SVG 側に持たせている。背景がほぼ真っ黒でぼかす対象が
ほとんど無いため、実測でも見た目の差はほぼ出ない。

パスデータは `wordmarkPaths.ts` を唯一の出処にして、そこから画像を生成している。

### 3-6. `page.tsx` の配線

```tsx
const { progress, total } = useProgress();
const loadProgress = total > 0 ? progress : 0;
const drawGlassWordmark = useGlassWordmark(phase, skipIntro);

{!skipIntro && (
  <LoadingTitle
    phase={phase}
    progress={loadProgress}
    onCountComplete={() => setPhase('changing')}
    onExitComplete={() => setPhase('title')}
  />
)}
<FluidTitleWarp ... underlay={drawGlassWordmark} />
```

**z-index**（ローディング画面はカーテンより前に出す必要がある）

| レイヤー | z |
|---|---|
| リロードボタン | 96 |
| LoadingTitle / HeroText | 95 |
| FluidTitleWarp（＝見えているタイトル） | 92 |
| CanvasTitle ラッパー（透明。テクスチャ供給元） | 92 |
| Curtains | 85〜90 |
| CanvasPC / グラデーション | 30 |

---

## 4. モーション設計の根拠

Material の motion ガイドラインに沿って秒数とイージングを組んでいる。

- ブランドの見せ場には emphasized イージング。汎用の standard より止まり際が長く伸びる
- 動く距離が大きいほど長く。大きな移動は extra-long トークン 700〜1000ms の領域
- 入るものは decelerate、去るものは accelerate
- ビートは重ねる。「前の要素が終わってから次が動く」完全な逐次は機械的に見える
- stagger は duration より短くする

### GSAP 組み込みイージングとの対応

Material の各カーブと GSAP のイージングを 200 点サンプリングして誤差を測った結果。

| Material のトークン | 最も近い GSAP | RMS誤差 |
|---|---|---|
| emphasized accelerate | `power2.in` | 0.025 |
| M3 standard | `power2.out` | 0.039 |
| emphasized decelerate | `expo.out` | 0.051 |

**ただし機械的に当てはめないこと。** 減速の強い out 系は動きが前半に偏るため、
秒数を伸ばしても体感が変わらない。

```
              out系      power1.inOut
100ms          45%           4.5%
300ms          81%            28%
500ms          94%            68%
700ms          99%            94%
```

数字のロールのように**動き自体を見せたいもの**、ヒーローの PC 降下のように
**大きく動くもの**は inOut を使う。out 系は「一瞬で動いて残りは這う」形になり、
かえって慌ただしく見える。

### 現在の値

| 対象 | duration | ease | stagger |
|---|---|---|---|
| 桁のロール | 0.9s | `power1.inOut` | 0.08（100の位→1の位） |
| 退場 | 0.9s | `power2.in` | 0.07（右→左） |
| タイトル表示 | 1.8s | `power2.out` | 3Dスケールを 0.2 遅らせる |
| ヒーロー PC 降下 | 1.6s | `power4.inOut` | — |
| ヒーロー タイトル移動 | 1.6s | `power2.inOut` | PC から 0.15 遅らせる |
| グラデーション | 1.4s | `power2.inOut` | さらに 0.15 遅らせる |

---

## 5. ハマりどころ（他でも再発しうるもの）

### ベンダープレフィックスを手書きしない

`backdrop-filter` と `-webkit-backdrop-filter` を併記したところ、ビルド時に
Lightning CSS が片方へ潰して**標準プロパティのほうが落ちた**。実際に効いていなかった。

```
（修正前）.pane{-webkit-backdrop-filter:blur(...)}   ← 標準版が無い
（修正後）.pane{-webkit-backdrop-filter:...;backdrop-filter:...}
```

標準プロパティだけ書いて、プレフィックスはビルドに任せる。

### 常時 `will-change: transform` を付けない

数字のリールに付けていたところ、合成レイヤーに固定されてレイヤー側の解像度で
ラスタライズされ、輪郭が荒れる要因になっていた（実測で約1pxの位置ずれ）。
アニメーション中の昇格は GSAP がやるので、常時指定は不要。

### `overflow` のクリップ位置はピクセルに丸められる

`o` や `0` のオーバーシュート（ベースラインの 0.013em 下）とクリップ線の余裕が
0.5px しかなく、下端が削れて平らになっていた。`--baseline-drop` で余裕を作って解決。

### インライン要素に transform は効かない

3-2 参照。リールが動かなかった原因。`inline-block` にすれば解決する。

### 文字に位置指定を掛けない

当初は文字ごとに flex 箱を作り、端数の em でパディング・ネガティブマージン・
負の `margin-bottom` を重ねていた。結果、**9文字すべてが 0.08〜0.42px だけ
ピクセル格子から外れて**いた。1文字ずつ別の箱に入れると、その数だけ端数が
積み上がって字がにじむ。

行にまとめても、行そのものを負マージンで持ち上げていれば同じこと。
**動かすのは文字ではなく、切り取る箱のほう**。クリップ位置を計算で合わせれば、
文字は素のテキストのまま置いておける。

---

## 6. 調整ノブ

| 何を変えたい | どこ |
|---|---|
| カウントアップの各秒数 | `LoadingTitle/index.tsx` 冒頭の定数ブロック |
| イントロ全体を短く | 同 `MIN_DURATION`（1.5 → 1.0 で検知2回、約1.6秒短縮） |
| 文字の大きさ・字間・マスク | `globals.css` の `.loadingTitle` の CSS 変数 |
| ガラスの濃さ・ふちの光 | `GlassWordmark/wordmarkPaths.ts` の `WORDMARK_IMAGE_SRC` |
| ガラスの大きさ | `useGlassWordmark.ts` の `WIDTH` |
| タイトルを読ませる時間 | `page.tsx` の `setTimeout(..., 2600)` |

---

## 7. 未対応・要判断（タスク候補）

### A. Typekit 待ちでローディング画面が見えない 🔴

`globals.css` の `.wf-loading body { opacity: 0 }` により、Typekit の読み込み中は
body 全体が非表示になる。**ローディング画面が最初の数百ms〜最大3秒見えない。**
計測では Typekit に到達できない環境で 3 秒（`scriptTimeout` の上限）。

`opacity` は子要素で上書きできないため、ローディング画面だけ除外できない。選択肢:

1. この1行を削除 — 他ページの Typekit テキストに FOUT が出る
2. ゲートを Typekit を使う要素だけに絞る（例 `.wf-loading .font-futura { opacity: 0 }`）— **推奨**
3. そのまま

サイト全体に効くため未着手。

### B. 3Dタイトルがイタリックのまま 🟡

ローディングのタイトルは直立 Bold にしたが、`CanvasTitle` の「Port / olio」は
`Urbanist-MediumItalic.ttf` のまま。**同じ「Portfolio」なのに前後で書体が変わる。**

揃えるなら可変フォントから wght 700 の静的 TTF を書き出して差し替える。
字幅が変わるので `preText` / `postText` の `position` と、間に入る3Dレターとの
間隔を調整し直す必要がある。

### C. hero-animation.md が旧仕様のまま 🟡

Stage 1・2 の記述（`Loading...` の点滅、ブラー遷移）が現状と一致しない。
このドキュメントの内容を反映するか、設計書側から参照を張る。

### D. SP 未対応 🟡

`font-size: clamp(2rem, 17.5vw, 18rem)` で縮むだけ。スマホだと
`P[000]rtfolio` がかなり細くなる。ガラスも `43vw` 固定なので要確認。実機を見てから調整。

### E. HeroText が空の器 🟢

`Loading...` を削除した結果、中身が空になった。設計書 Stage 4 の名前タイポ
（seita / izaki）を入れる場所として残してある。不要なら削除。

### F. 既存の ESLint エラー 🟢

`FluidEffect/FluidCanvas.tsx` の `react-hooks/refs` 3件と、`layout.tsx` の
未使用 import 1件。今回の変更とは無関係だが残っている。

### G. ジャギーの再検証 🟢

「静止時の文字が少しジャギって見える」という指摘に対し、原因になりうる2点
（`will-change` の常時指定、クリップ線とオーバーシュートの接触）を修正済み。
ただし検証環境では症状を再現できなかったため、実機での確認が必要。

---

## 8. 検証について

3D と流体シミュレーションが動くため、ヘッドレス環境（swiftshader）では
実時間の挙動を追えない。カウントアップとロールの検証には、`LoadingTitle` だけを
描く一時ページを作って以下を確認した（確認後に削除済み）。

- 通常ロード時のサイクル間隔（1400 / 1410 / 1430 / 1370ms）
- 即100%時の最低表示保証（`000 → 033 → 066 → 100`）
- ロールが途中の数字を通ること（`048 → 058 → 059 → 050 → 060 → 061`）
- イージングの進み方（毎フレーム transform を記録）

同じ検証が必要になったら、`app/loading-preview/page.tsx` に `LoadingTitle` を
`progress` 固定で置くのが早い。


---

## 付録A: 全ソース
このドキュメントだけで内容を追えるよう、今回追加・変更したファイルの中身をそのまま収録する。
**基準コミット**: `cbac51e`（このコミットからの差分が今回の変更）

### `app/_home/LoadingTitle/index.tsx`（新規）

ローディング画面本体。進捗の検知・キープ・退場

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { DigitReel } from './DigitReel';

type Phase = 'loading' | 'changing' | 'title' | 'hero';

/* -------------------------------------------------
  タイミング（PDFに指定のない値は提案値。ここだけ見れば調整できる）
------------------------------------------------- */
const DIGIT_LENGTH = 3;
const PRE_TEXT = 'P';
const POST_TEXT = 'rtfolio';

/*
  秒数は Material の motion ガイドラインに寄せている。
  大きく動くもの・見せ場になるものは extra-long（0.7〜1.0秒）の領域を使う。
  stagger は必ず duration より短くして、要素同士の動きを重ねる
  （前の要素が止まってから次が動く並びは機械的に見えるため）。

  イージングは GSAP の組み込みを使う。Material の easing トークンに当てはめると
  だいたい次の対応になる（数値で近似を取った結果）。
    出てくるもの・止まるもの        … power2.out（強めに効かせたいときは expo.out）
    去っていくもの                  … power2.in
    位置を移すもの・動きを見せるもの … power1.inOut
  減速だけの out 系は前半に動きが偏るので、秒数を伸ばしても体感が変わらない。
  「ゆっくり見せたい」ものには inOut を当てる。
*/
const TICK = 0.5; // 進捗を検知する間隔（PDF指定）。数字が回っている間は進まない
const MIN_DURATION = 1.5; // 検知時間の合計がこれを下回らないようにする。TICK×3回分は必ず見せる
const HOLD = 1.4; // 100%到達後のキープ。落とす前の「ため」として PDF指定の0.7から伸ばしている
const AFTER_EXIT = 0.35; // 文字が消えてからタイトルを出すまでの間

// ロールは数字が流れるところを見せたいので inOut。out 系だと一瞬で流れてしまう
const DIGIT = { duration: 0.9, ease: 'power1.inOut', stagger: 0.08 }; // 100の位→1の位
const EXIT = { duration: 0.9, ease: 'power2.in', stagger: 0.07 }; // 退場。右→左

// 最後の桁まで回り終わるのにかかる時間。この間は検知を止める
const ROLL_TIME = DIGIT.duration + DIGIT.stagger * (DIGIT_LENGTH - 1);

type LoadingTitleProps = {
  phase: Phase;
  progress: number; // 0-100。drei の useProgress の値
  onCountComplete: () => void; // 100%キープまで終わった
  onExitComplete: () => void; // 退場アニメーションまで終わった
};

/**
 * ローディング画面。「P[000]rtfolio」の o の位置でカウントアップし、
 * 100% に達したら文字が右から順に下へ落ちて消える。
 */
export function LoadingTitle({ phase, progress, onCountComplete, onExitComplete }: LoadingTitleProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // タイマーを張り直さずに最新の進捗を読むための箱
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // 表示中の値と、その直前の値。リールが「途中に積む数字」を決めるのに両方いる
  const [count, setCount] = useState({ value: 0, prev: 0 });

  /* 0.5秒ローディングを検知 → その数値まで回す → 回り終わったらまた0.5秒検知…
     を繰り返す。数字が回っている間は検知を止めるので、ロールが途中で切られない
  --------------------------------------- */
  useEffect(() => {
    if (phase !== 'loading') return;

    let timer = 0;
    let detected = 0; // 検知に使った時間の合計。回っている間は増えない
    let shown = 0; // いま表示している値

    const sample = () => {
      detected += TICK;
      // 実ロードが速く終わってもカウントアップを見せたいので、検知時間で上限をかける。
      // MIN_DURATION 秒ぶん検知して 0→100 に開く天井と、実際の進捗の低い方を採用する
      const ceiling = (detected / MIN_DURATION) * 100;
      const next = Math.floor(Math.min(progressRef.current, ceiling, 100));
      // 進捗が巻き戻ることがあるので、表示は減らさない
      const rolls = next > shown;
      if (rolls) {
        setCount({ value: next, prev: shown });
        shown = next;
      }
      if (next >= 100) return; // 100 まで来たらここで打ち止め
      // 回したぶんだけ待ってから次の検知へ
      timer = window.setTimeout(sample, (rolls ? ROLL_TIME + TICK : TICK) * 1000);
    };

    timer = window.setTimeout(sample, TICK * 1000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  /* 100%到達 → 最後の桁が止まってから0.7秒キープ → 退場へ
  --------------------------------------- */
  useEffect(() => {
    if (phase !== 'loading' || count.value < 100) return;
    const id = window.setTimeout(onCountComplete, (ROLL_TIME + HOLD) * 1000);
    return () => window.clearTimeout(id);
  }, [phase, count.value, onCountComplete]);

  /* 退場：右の文字から順に、マスクの裏へ下降していく
  --------------------------------------- */
  useGSAP(
    () => {
      if (phase !== 'changing') return;
      gsap.to('.loadingGlyph', {
        yPercent: 110,
        duration: EXIT.duration,
        ease: EXIT.ease,
        stagger: { each: EXIT.stagger, from: 'end' },
        // 消えきってすぐタイトルを出すと詰まって見えるので、一拍おいてから次へ渡す
        onComplete: () => gsap.delayedCall(AFTER_EXIT, onExitComplete),
      });
    },
    { scope: rootRef, dependencies: [phase] },
  );

  if (phase !== 'loading' && phase !== 'changing') return null;

  const digits = String(count.value).padStart(DIGIT_LENGTH, '0');
  const prevDigits = String(count.prev).padStart(DIGIT_LENGTH, '0');

  // 背景はカーテンの最前面（bg-zinc-950）と同じ色にして、退場後に地色が変わらないようにする
  return (
    <div
      ref={rootRef}
      className='loadingTitle font-urbanist fixed inset-0 z-95 flex items-center justify-center bg-zinc-950'
    >
      {/* 文字は素の span。退場で消すための切り取り線として h1 の高さを詰めているだけ */}
      <h1 className='loadingTitle__line'>
        {PRE_TEXT.split('').map((char, i) => (
          <span key={`pre-${i}`} className='loadingGlyph'>
            {char}
          </span>
        ))}
        <span className='loadingGlyph loadingTitle__reel'>
          {digits.split('').map((digit, i) => (
            <DigitReel
              key={i}
              char={digit}
              prevChar={prevDigits[i]}
              delay={i * DIGIT.stagger}
              duration={DIGIT.duration}
              ease={DIGIT.ease}
            />
          ))}
        </span>
        {POST_TEXT.split('').map((char, i) => (
          <span key={`post-${i}`} className='loadingGlyph'>
            {char}
          </span>
        ))}
      </h1>
    </div>
  );
}
```

### `app/_home/LoadingTitle/DigitReel.tsx`（新規）

数字1桁ぶんのリール

```tsx
'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';

type DigitReelProps = {
  char: string; // いま表示したい数字
  prevChar: string; // 直前に表示していた数字
  delay: number; // 100の位から順にずらすための遅延
  duration: number;
  ease: string;
};

/**
 * 数字1桁分のリール。
 *
 * prevChar から char までの数字を上から下へ順に積んだ列を持ち、
 * 「いちばん下（＝直前の値）を見せている状態」から
 * 「いちばん上（＝新しい値）を見せる状態」まで一気に回す。
 * 0→3 なら 3,2,1,0 の4枚を積むので、途中の 2 と 1 が流れて見える。
 * 9 をまたぐときは 0 に巻き戻して数える（8→1 なら 1,0,9,8 の4枚）。
 *
 * 描画のたびに列を「下を見せる位置」へ戻してから回す。
 * 戻した瞬間に見えるのは prevChar ＝ 直前に画面に出ていた数字そのものなので、
 * リセットしても表示は途切れない。paint 前に確定させるため useLayoutEffect を使う。
 */
export function DigitReel({ char, prevChar, delay, duration, ease }: DigitReelProps) {
  const innerRef = useRef<HTMLSpanElement>(null);

  // 上から下へ char → …途中の数字… → prevChar と並べる
  const cells = useMemo(() => {
    const from = Number(prevChar);
    const steps = (Number(char) - from + 10) % 10;
    return Array.from({ length: steps + 1 }, (_, i) => (from + steps - i) % 10);
  }, [char, prevChar]);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    // いちばん下のマス（prevChar）を見せた位置に戻す
    const start = (-(cells.length - 1) / cells.length) * 100;
    gsap.set(inner, { yPercent: start });

    // 値が変わらない桁は動かさない
    if (cells.length === 1) return;

    const tween = gsap.to(inner, { yPercent: 0, duration, ease, delay });
    return () => {
      tween.kill();
    };
  }, [cells, duration, ease, delay]);

  return (
    <span className='loadingTitle__slot'>
      <span ref={innerRef} className='loadingTitle__slotInner'>
        {cells.map((digit, i) => (
          <span key={i} className='loadingTitle__digit'>
            {digit}
          </span>
        ))}
      </span>
    </span>
  );
}
```

### `app/_home/GlassWordmark/wordmarkPaths.ts`（新規）

seita ロゴのパスデータと焼き込み済み画像

```ts
/**
 * 「seita」のロゴ（Illustrator から書き出した SVG のパスデータ）。
 * 差し替えるときは viewBox とパスの d をまとめて入れ替える。
 */
export const WORDMARK_VIEWBOX = { width: 814, height: 206 } as const;

export const WORDMARK_PATHS = [
  'M0,0h186.3v21.7H57.8c0,1.2.2,1.9.6,2.2.4.2,2.2.2,5.3.2h122.7v152.3c0,5.9-.3,10.7-.9,14.5-.4,3.7-1.8,6.6-4,8.7-2.3,2.1-6.1,3.6-11.5,4.5-5.4.9-12.8,1.4-22.4,1.7-9.5.2-21.9.2-37.3.2H0v-36.2h122.7c3.1,0,4.9,0,5.3-.2.4-.2.6-1,.6-2.2H0V0Z',
  'M192.6,163.2c0-5.9.2-132.2.6-135.9.6-3.8,2.1-6.7,4.3-8.8,2.3-2.1,6.1-3.6,11.5-4.5,5.4-.9,12.8-1.4,22.4-1.6,9.7-.2,22.2-.4,37.3-.4h40.4c15.1,0,27.4.1,37,.4,9.7.2,17.3.7,22.7,1.6,5.4.9,9.2,2.4,11.5,4.5,2.3,2.1,3.6,5,4,8.7.6,3.7.9,130.1.9,136.1v28.3h-99.4v2.4h99.4v12.1h-146c-11.6-.3-20.6-.7-27-1.4-6.4-.8-11.1-2.2-14-4.2-2.7-2-4.3-4.9-5-8.7-.4-3.9-.6-8.9-.6-15.2v-13.3ZM285.8,36.2v133.6h6.2V38.6c0-1.2-.3-1.9-.9-2-.4-.2-2.2-.4-5.3-.4Z',
  'M391.2,0h93.2v9.6h-93.2V0ZM484.7,206h-17.1c-15.3,0-27.8,0-37.6-.2-9.5-.2-17-.8-22.4-1.7-5.2-.9-9-2.4-11.5-4.5-2.3-2.1-3.6-5-4-8.7-.4-3.8-.6-8.6-.6-14.5V12.1h93.2v193.9Z',
  'M567.1,206c-15.1,0-27.5,0-37.3-.2-9.5-.2-17-.8-22.4-1.7-5.4-.9-9.2-2.4-11.5-4.5-2.3-2.1-3.7-5-4.3-8.7-.4-3.8-.6-8.6-.6-14.5V0h93.2v12.1h31.1v157.8h-31.4c0,1,.1,1.7.3,1.9.4.3,2.3.5,5.6.5h25.5v33.8h-48.1Z',
  'M814,12.1v193.9h-93.2v-5.2h-6.2v5.2h-17.1c-15.1,0-27.5,0-37.3-.2-9.5-.2-17-.8-22.4-1.7-5.4-.9-9.2-2.4-11.5-4.5-2.3-2.1-3.7-5-4.3-8.7-.4-3.8-.6-8.6-.6-14.5v-13.3c0-5.9.2-132.2.6-135.9.6-3.8,2.1-6.7,4.3-8.8,2.3-2.1,6.1-3.6,11.5-4.5s12.8-1.4,22.4-1.6c9.7-.2,22.2-.4,37.3-.4h116.5ZM714.6,169.8h6.2V36.2c-3.1,0-5,.1-5.6.4-.4.2-.6.8-.6,2v131.2Z',
] as const;

/**
 * ガラスの見た目を焼き込んだ画像。
 *
 * タイトルと同じ波で歪ませるには、DOM ではなく流体の元絵（2Dキャンバス）へ
 * 描き込む必要がある。キャンバスには backdrop-filter を掛けられないので、
 * 背面をぼかす代わりに「白い薄膜」と「ふちの光」を絵として持たせている。
 * 背景がほぼ真っ黒なぶん、ぼかしの有無より膜の濃さのほうが見た目を決める。
 */
export const WORDMARK_IMAGE_SRC = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0.45" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0.20"/>` +
    `<stop offset="0.42" stop-color="#fff" stop-opacity="0.07"/>` +
    `<stop offset="1" stop-color="#fff" stop-opacity="0.13"/>` +
    `</linearGradient></defs>` +
    `<g fill="url(#g)" stroke="#fff" stroke-opacity="0.22" stroke-width="1.6">` +
    WORDMARK_PATHS.map((d) => `<path d="${d}"/>`).join('') +
    `</g></svg>`,
)}`;
```

### `app/_home/GlassWordmark/useGlassWordmark.ts`（新規）

ロゴを流体の元絵へ描き込む関数を返すフック

```ts
'use client';

import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { WORDMARK_IMAGE_SRC, WORDMARK_VIEWBOX } from './wordmarkPaths';

type Phase = 'loading' | 'changing' | 'title' | 'hero';

const ENTER = { duration: 1.6, ease: 'power2.out', delay: 0.2 }; // タイトルより少しだけ遅れて出す

// 画面幅に対する大きさ。CSS の clamp(18rem, 43vw, 58rem) と同じ意味
const WIDTH = { min: 288, ratio: 0.43, max: 928 };

/**
 * タイトルの裏に敷く「seita」のガラスを、流体の元絵へ描き込むための draw 関数を返す。
 *
 * DOM に置くとタイトルの波（FluidTitleWarp）を受けられないので、
 * タイトルと同じ 2D キャンバスに描いて同一の歪みを通す。
 * 位置はタイトルの矩形から出しているため、ヒーローでタイトルが上へ動くと
 * ガラスも自動で付いていく。
 */
export function useGlassWordmark(phase: Phase, skipIntro = false) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  // 登場アニメーションの進み具合。GSAP でこの箱の中身を動かす
  const enter = useRef({ opacity: skipIntro ? 1 : 0, scale: skipIntro ? 1 : 0.96 });

  useEffect(() => {
    const img = new Image();
    img.src = WORDMARK_IMAGE_SRC;
    img.decode?.().catch(() => {});
    imageRef.current = img;
  }, []);

  useEffect(() => {
    if (phase !== 'title') return;
    const tween = gsap.to(enter.current, {
      opacity: 1,
      scale: 1,
      duration: ENTER.duration,
      ease: ENTER.ease,
      delay: ENTER.delay,
    });
    return () => {
      tween.kill();
    };
  }, [phase]);

  return useMemo(
    () =>
      (ctx: CanvasRenderingContext2D, { dpr }: { dpr: number }, titleRect: DOMRect) => {
        const img = imageRef.current;
        const { opacity, scale } = enter.current;
        if (!img?.complete || opacity <= 0) return;

        const base = Math.min(Math.max(WIDTH.min, window.innerWidth * WIDTH.ratio), WIDTH.max);
        const w = base * scale;
        const h = (w * WORDMARK_VIEWBOX.height) / WORDMARK_VIEWBOX.width;
        // 画面中央、かつタイトルの箱の上下中央に置く
        const x = (window.innerWidth - w) / 2;
        const y = titleRect.top + titleRect.height / 2 - h / 2;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, x * dpr, y * dpr, w * dpr, h * dpr);
        ctx.restore();
      },
    [],
  );
}
```

### `app/_components/FluidEffect/FluidTitleWarp.tsx`（変更）

underlay を追加。タイトルより先に描いたものが同じ歪みを受ける

```tsx
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { FluidCanvas, type DrawSource } from './FluidCanvas';

/**
 * CanvasTitle（3Dタイトル）の描画結果を毎フレーム取り込んで、
 * 背景と同じ流体で歪ませるオーバーレイ。
 *
 * 元の CanvasTitle は visuallyHidden で透明にしたまま描画だけ継続させ、
 * その絵をここで歪ませて表示する二段構え。
 */
/** タイトルの後ろに敷く絵の描き方。タイトルと同じ流体で歪む */
export type TitleUnderlay = (
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number; dpr: number },
  titleRect: DOMRect,
) => void;

export function FluidTitleWarp({
  active = true,
  sourceRef,
  underlay,
  className = 'fixed inset-0 z-80 h-full w-full pointer-events-none',
}: {
  active?: boolean;
  /** 取り込み元（CanvasTitle のラッパー div） */
  sourceRef: React.RefObject<HTMLDivElement | null>;
  /** タイトルより先に描いて、同じ歪みを掛けたいもの */
  underlay?: TitleUnderlay;
  className?: string;
}) {
  // useCallback を作り直さずに最新の underlay を参照するための箱
  const underlayRef = useRef(underlay);
  useEffect(() => {
    underlayRef.current = underlay;
  }, [underlay]);

  // 3Dキャンバスの中身を、画面上の位置を合わせてオフスクリーンに焼き込む
  const drawSource = useCallback<DrawSource>(
    (ctx, size) => {
      const source = sourceRef.current;
      const titleCanvas = source?.querySelector('canvas');
      if (!source || !titleCanvas) return;

      // オフスクリーンキャンバスの原点は画面左上と一致するので、
      // タイトルの画面座標をそのまま dpr 倍すればよい
      const titleRect = source.getBoundingClientRect();
      const { dpr } = size;

      // 裏に敷くものが先。あとからタイトルを重ねる
      underlayRef.current?.(ctx, size, titleRect);

      ctx.drawImage(
        titleCanvas,
        titleRect.left * dpr,
        titleRect.top * dpr,
        titleRect.width * dpr,
        titleRect.height * dpr,
      );
    },
    [sourceRef],
  );

  return (
    <FluidCanvas active={active} simRes={96} alpha redrawOnEveryFrame drawSource={drawSource} className={className} />
  );
}
```

### `app/_home/HeroText.tsx`（変更）

Loading... と進捗数字を削除。器だけ残置

```tsx
/**
 * ヒーロー画面のテキストレイヤー。
 * ローディングの表示は LoadingTitle に移したので、いまは空の器。
 * Stage 4 の名前（seita / izaki）のタイポアニメーションをここに入れる想定。
 */
export function HeroText({ ref }: { ref?: React.RefObject<HTMLDivElement | null> }) {
  return <div ref={ref} className='fixed inset-0 z-95 pointer-events-none flex items-center justify-center' />;
}
```

### `app/page.tsx`（変更）

phase の状態機械と全体の配線

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
import { ReloadButton } from './_home/ReloadButton';
import { HeroText } from './_home/HeroText';
import { LoadingTitle } from './_home/LoadingTitle';
import { useGlassWordmark } from './_home/GlassWordmark/useGlassWordmark';
import { CanvasPC } from './_home/Canvas/CanvasPC';
import { CanvasNavKey } from './_home/Canvas/CanvasKey';
import { GridBackground } from './_components/GridBackground';
import { FluidTitleWarp } from './_components/FluidEffect/FluidTitleWarp';
import { keyCapsPalettes } from './_home/Canvas/CanvasKey/keyCapsPalettes';
import { curtainPalettes } from './_components/Curtains/curtainPalettes';

// プリロード
useGLTF.preload('/models/model__keycap.glb');
useGLTF.preload('/models/model__pc.glb');
useGLTF.preload('/models/model__letter-f.glb');
useGLTF.preload('/models/model__letter-a.glb');
useEnvironment.preload({ preset: 'studio' });

function PageInner() {
  const searchParams = useSearchParams();
  const skipIntro = searchParams.get('from') === 'about';
  return <Home skipIntro={skipIntro} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className='fixed inset-0 bg-[#0d0d0d] z-9999' />}>
      <PageInner />
    </Suspense>
  );
}

function Home({ skipIntro }: { skipIntro: boolean }) {
  const [phase, setPhase] = useState<'loading' | 'changing' | 'title' | 'hero'>(skipIntro ? 'hero' : 'loading');
  const [showCurtain, setShowCurtain] = useState<boolean>(true);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState<boolean>(false);
  const handleModelReady = useCallback(() => setModelReady(true), []);
  const keyCaps = Object.values(keyCapsPalettes);

  // ---------------------------
  // 各ページへの遷移
  // ---------------------------
  const router = useRouter();
  const [transitionTo, setTransitionTo] = useState<string | null>(null);
  const handleClick = (path: string) => {
    setTransitionTo(`${path}?from=home`);
  };

  // ---------------------------
  // プリロード
  // ---------------------------
  // total が 0 の間は進捗が当てにならないので 0 として扱う
  const { progress, total } = useProgress();
  const loadProgress = total > 0 ? progress : 0;
  const handleCountComplete = useCallback(() => setPhase('changing'), []);
  const handleExitComplete = useCallback(() => setPhase('title'), []);

  // ---------------------------
  // リロードボタンの表示
  // ---------------------------
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false); // リロードボタン出現の管理
  useEffect(() => {
    // イントロが一通り終わる時間より後に出す。早いとローディング中に被る
    const timer = setTimeout(() => { setIsRefreshing(true); }, 15000);
    return () => clearTimeout(timer);
  }, []);

  // ---------------------------
  // テキストのアニメーション
  // ---------------------------
  const heroTextRef = useRef<HTMLDivElement>(null);

  // ---------------------------
  // タイトル画面の表示
  // ---------------------------
  const canvasPCRef = useRef<Group>(null);
  const canvasNavKeyRef = useRef<HTMLDivElement>(null);
  const canvasTitleRef = useRef<HTMLDivElement>(null);
  // タイトルの裏に敷く「seita」のガラス。タイトルと同じ流体で歪ませたいので
  // DOM ではなく FluidTitleWarp の元絵へ描き込む
  const drawGlassWordmark = useGlassWordmark(phase, skipIntro);

  // アニメーション；タイトル表示からヒーローコンテンツ表示
  // ---------------------------
  // タイトルが出きったあと、読ませる間をとってからヒーローへ
  useEffect(() => {
    if (phase === 'title') {
      const timer = setTimeout(() => setPhase('hero'), 2600);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useGSAP(
    () => {
      if (phase === 'hero') {
        if (!canvasPCRef.current || !canvasNavKeyRef.current || !canvasTitleRef.current) return;
        // 3つを完全に同時に動かすと一発の切り替えに見えるので、少しずつずらして重ねる。
        // 大きく動くものは out 系だと前半に偏って忙しく見えるので inOut のまま伸ばす
        const tl = gsap.timeline({ delay: 0.9 });
        tl.from(canvasPCRef.current!.position, { y: -1, duration: 1.6, ease: 'power4.inOut' }, '<')
          .to(canvasTitleRef.current, { y: '-75%', duration: 1.6, ease: 'power2.inOut' }, '<0.15')
          .fromTo('.gradientOverlay', { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'power2.inOut' }, '<0.15');
      }
    },
    { dependencies: [phase, skipIntro, modelReady] },
  );
  // ---------------------------

  return (
    <main className='flex flex-1 items-center justify-center bg-[#0d0d0d] text-zinc-50'>
      <GridBackground active={phase === 'hero'} />
      {/* カーテン遷移（各下層から） */}
      <Curtains
        show={!!transitionTo}
        anchor='bottom'
        baseZIndex={100}
        motion={'enter'}
        colors={curtainPalettes.zinc}
        onComplete={() => transitionTo && router.push(transitionTo)}
      />
      {/* カーテン遷移（各下層へ） */}
      <Curtains
        show={showCurtain}
        anchor='top'
        motion={phase === 'hero' ? 'exit' : 'none'}
        colors={['bg-zinc-950', 'bg-zinc-900', 'bg-zinc-800', 'bg-zinc-800', 'bg-zinc-900', 'bg-zinc-950']}
        onComplete={() => setShowCurtain(false)}
      />

      {/* パソコンとキーキャップ */}
      <CanvasPC ref={canvasPCRef} hoveredKey={hoveredKey} onReady={handleModelReady} />
      <CanvasNavKey
        ref={canvasNavKeyRef}
        keyCaps={keyCaps}
        onKeyCapClick={handleClick}
        onKeyCapHover={setHoveredKey}
        phase={phase}
      />

      {/* グラデーションのオーバーレイ */}
      <div
        className='gradientOverlay fixed inset-0 pointer-events-none'
        style={{ background: 'linear-gradient(0deg, rgba(13,13,13,1) 0%, rgba(13,13,13,0) 45%)', zIndex: 30 }}
      />

      {/* ローディング画面 */}
      {!skipIntro && (
        <LoadingTitle
          phase={phase}
          progress={loadProgress}
          onCountComplete={handleCountComplete}
          onExitComplete={handleExitComplete}
        />
      )}

      {/* タイトルテキスト */}
      <HeroText ref={heroTextRef} />
      <CanvasTitle
        ref={canvasTitleRef}
        phase={phase}
        skipIntro={skipIntro}
        modelPath='/models/model__letter-f.glb'
        modelName='letter_f'
        bgColor='#fafafa'
        visuallyHidden
        enableHeroColorChange
        wrapperPreset='main'
        preText={{ text: 'Port', position: [-0.2, 0, -0.5], anchorX: 'right', textColor: '#fafafa' }}
        postText={{ text: 'olio', position: [0.2, 0, -0.5], anchorX: 'left', textColor: '#fafafa' }}
      />
      <FluidTitleWarp
        active={phase === 'title' || phase === 'hero'}
        sourceRef={canvasTitleRef}
        underlay={drawGlassWordmark}
        className={`fixed inset-0 h-full w-full pointer-events-none ${skipIntro ? 'z-80' : 'z-92'}`}
      />
      {/* ページリロードボタン（ローディング画面の z-95 より前に出す） */}
      {isRefreshing && phase === 'loading' && (
        <div className='fixed z-96 bottom-8 left-1/2 -translate-x-1/2'>
          <ReloadButton />
        </div>
      )}
    </main>
  );
}
```

### `app/globals.css`（変更）

他ページと共用のファイルなので、今回関係する部分だけ抜粋する。

**自前フォントの読み込み**

```css
/* ローディング画面で使う自前フォント。
   Google Fonts の Urbanist（wght 100〜900 の可変フォント）を woff2 で取得して置いてある。
   ローディング画面は最速で出したいので、CDN からではなく自分のドメインから配る */
@font-face {
  font-family: "Urbanist";
  src: url("/fonts/Urbanist-Variable.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}
```

**Tailwind のテーマ変数（@theme inline 内）**

```css
--font-urbanist: "Urbanist", sans-serif;
```

**ローディング画面の文字組み**

```css
/* -------------------------------------------------
  ローディング画面（P[000]rtfolio）

  文字は素の span（transform を効かせるため inline-block にしているだけ）で、
  位置をずらす指定を一切持たない。普通のテキストと同じように1行で流れる。

  退場で文字が「ベースラインの線の裏に潜って消える」ためにマスクが要るが、
  それは h1 に overflow:hidden と高さを与えるだけ。文字側は動かさない。

  数値は Urbanist Bold (wght 700) のメトリクス（unitsPerEm 2000）から算出。
  - アセンダ上端（f）… ベースラインの 0.762em 上
  - o と一部の数字のオーバーシュート … ベースラインの 0.013em 下
  - line-height:1 のときベースラインは行ボックス上端から 0.85em の位置
------------------------------------------------- */
.loadingTitle {
  /* 行ボックス上端から数えたクリップ位置。ベースライン(0.85em)の 0.015em 下で切る。
     この 0.015em は o や 0 のオーバーシュートがクリップ線に触れないための逃げ */
  --clip-h: 0.865em;
  --rect-h: 0.79em;   /* 白矩形の高さ。アセンダ上端〜ベースライン */
  --slot-w: 0.61em;   /* 数字1桁の幅。いちばん広い「0」の送り幅 0.6045em に合わせて固定 */
  --bleed: 0.08em;    /* 字面が送り幅からはみ出すぶんの逃げ */

  /* 上の em はすべてこの font-size で解決される。マスクより外側に置かないと
     マスクの高さが本文サイズ基準になって潰れる */
  font-size: clamp(2rem, 17.5vw, 18rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  color: #fafafa;

  /* html に付いている Tailwind の antialiased（-webkit-font-smoothing: antialiased）を
     この画面だけ打ち消す。macOS ではグレースケール描画になって字が細く・やわらかく出るため、
     250px 級の太字だと「ボケている」ように見える。既定のサブピクセル描画に戻す */
  -webkit-font-smoothing: subpixel-antialiased;
  -moz-osx-font-smoothing: auto;
}

/* 退場で文字が消える線。高さを詰めて下を切っているだけで、中身は動かしていない。
   overflow は上下だけ効かせたいが、片方だけ visible にはできない
   （CSSの仕様上 auto に化ける）ので、左右にパディングを足してクリップ範囲を
   横に広げ、同じ量のネガティブマージンで見た目の幅を戻している */
.loadingTitle__line {
  height: var(--clip-h);
  overflow: hidden;
  padding-inline: var(--bleed);
  margin-inline: calc(var(--bleed) * -1);
  white-space: nowrap;
}

/* transform を掛けるためだけの箱。インライン要素は transform が効かないので
   inline-block にする。位置をずらす指定は持たせない */
.loadingGlyph {
  display: inline-block;
}

/* カウンタの白矩形。overflow:hidden の inline-block はベースラインが下端になるので、
   vertical-align でオーバーシュートぶんだけ沈めると下端がクリップ線と揃う */
.loadingTitle__reel {
  display: inline-flex;
  height: var(--rect-h);
  overflow: hidden;
  vertical-align: -0.015em;
  background-color: #fafafa;
  color: #111;
}

/* 数字1桁のリール。直前の値〜新しい値までを積んだ列を持ち、下端を見せた状態で待機する */
.loadingTitle__slot {
  width: var(--slot-w);
  height: var(--rect-h);
  overflow: hidden;
}

/* 実際に transform で回る列。
   will-change: transform は付けない。常時付けると合成レイヤーに固定され、
   数字がレイヤー側の解像度でラスタライズされて輪郭が荒れることがある
   （回っている間の昇格は GSAP が面倒を見てくれる） */
.loadingTitle__slotInner {
  display: block;
}

/* line-height でベースラインの位置を決める。0.85 なら枠上端から 0.775em に来て、
   矩形の下端（0.79em）の 0.015em 上に揃う。マージンでずらす必要がない */
.loadingTitle__digit {
  display: block;
  height: var(--rect-h);
  line-height: 0.85;
  text-align: center;
  letter-spacing: normal;
}
```

### `app/_components/CanvasTitle/Model.tsx`（変更）

大きいファイルなので差分のみ。タイトル表示の秒数を伸ばし、3Dの立ち上がりを 0.2 秒ずらして重ねた。
オーバーシュートは 1.8 秒だと強すぎたため `back.out(2)` → `back.out(1.4)` に緩めている。

```diff
diff --git a/app/_components/CanvasTitle/Model.tsx b/app/_components/CanvasTitle/Model.tsx
index 83293d4..f156f3d 100644
--- a/app/_components/CanvasTitle/Model.tsx
+++ b/app/_components/CanvasTitle/Model.tsx
@@ -94,10 +94,11 @@ export function TitleScene({
   useGSAP( () => {
       /* 【フェーズ：タイトル】テキストの表示 */
       if (phase === 'title') {
+        // 文字のフェードと3Dの立ち上がりを少しずらして重ね、一枚で出てくる感じを避ける
         const tl = gsap.timeline();
-        if (finalTextFrontRef.current?.material) { tl.to(finalTextFrontRef.current.material, { opacity: 1, duration: 1.4, ease: 'power2.out' }); }
-        if (finalTextBackRef.current?.material) { tl.to(finalTextBackRef.current.material, { opacity: 1, duration: 1.4, ease: 'power2.out' }, '<'); }
-        if (text3DRef.current) { tl.to( text3DRef.current.scale, { x: modelScale, y: modelScale, z: modelScale, duration: 1.4, ease: 'back.out(2)' }, '<'); }
+        if (finalTextFrontRef.current?.material) { tl.to(finalTextFrontRef.current.material, { opacity: 1, duration: 1.8, ease: 'power2.out' }); }
+        if (finalTextBackRef.current?.material) { tl.to(finalTextBackRef.current.material, { opacity: 1, duration: 1.8, ease: 'power2.out' }, '<'); }
+        if (text3DRef.current) { tl.to( text3DRef.current.scale, { x: modelScale, y: modelScale, z: modelScale, duration: 1.8, ease: 'back.out(1.4)' }, '<0.2'); }
       }
       /* 【フェーズ：ヒーロー表示】テキストの色変更 */
       if (phase === 'hero' && enableHeroColorChange && !skipIntro) {
```

### `public/fonts/Urbanist-Variable.woff2`（新規・バイナリ）

Google Fonts の Urbanist 可変フォント（wght 100〜900、27,752 bytes）。
取得方法:

```bash
# CSS からダウンロードURLを引く（woff2 を得るにはモダンな UA が必要）
curl -A "Mozilla/5.0 ... Chrome/120.0 ..." \
  "https://fonts.googleapis.com/css2?family=Urbanist:wght@600;700&display=block"

# 返ってきた latin の URL を保存する
curl -A "Mozilla/5.0 ... Chrome/120.0 ..." \
  "https://fonts.gstatic.com/s/urbanist/v18/L0x-DF02iFML4hGCyMqlbS0.woff2" \
  -o public/fonts/Urbanist-Variable.woff2
```
