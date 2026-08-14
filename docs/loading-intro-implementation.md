# ローディング → タイトル 実装ドキュメント

Home の冒頭「ローディング画面 → タイトル表示 → ヒーロー」を作り直したときの実装記録。
設計書（[hero-animation.md](./hero-animation.md)）が「何を作るか」なのに対し、
こちらは **実際に何をどう作ったか** と、その判断の根拠をまとめたもの。

対象ブランチ: `claude/loading-screen-implementation-lc3gvy`（10コミット）
元になった指示: PDF『ローディング⇨タイトル表示』の再設計版

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

すべて Urbanist Bold (wght 700, unitsPerEm 2000) のメトリクスから算出している。

| 変数 | 値 | 根拠 |
|---|---|---|
| `--mask-h` | `0.79em` | アセンダ上端（`f` = 0.762em）＋ 余裕 |
| `--baseline-drop` | `0.125em` | `line-height:1` のときベースラインは行ボックス下端から 0.15em。そこから少し浮かせる |
| `--slot-w` | `0.61em` | いちばん広い数字「0」の送り幅 0.6045em |
| `--bleed` | `0.08em` | 字面が送り幅からはみ出すぶんの逃げ |
| `--tracking` | `0.04em` | 字間を詰める量。この値で P が白矩形に接し、モックアップと同じ組みになる |

**マスクの構造**：各文字を `overflow: hidden` の箱に入れ、退場時にその下端の裏へ
潜り込ませて消す。PDF のモックアップを実測したところ、`rtfolio` の各文字の下端が
すべて同じ y 座標で切れていたため、この構造が原案どおり。

**片側だけ overflow を visible にできない問題**：CSS の仕様上、片方を `visible` に
すると他方が `auto` に化けてスクロールバーが出る。そこで**左右にパディングを足して
クリップ範囲を横に広げ、同じ量のネガティブマージンで見た目の幅を戻す**方法を採った。

```css
padding-inline: var(--bleed);
margin-inline: calc((var(--bleed) + var(--tracking) / 2) * -1);
```

マージンには `--tracking` の半分も足してあり、左右で半分ずつ負担するので
文字間で詰まる量はちょうど `--tracking` になる。
（`letter-spacing` は文字ごとに箱を分けている関係で使えない）

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

3-2 参照。リールが動かなかった原因。

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
