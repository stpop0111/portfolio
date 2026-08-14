import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

const bezier = (x1: number, y1: number, x2: number, y2: number) => `M0,0 C${x1},${y1} ${x2},${y2} 1,1`;

/**
 * Material Design 3 の easing トークン。
 *
 * M3 には standard と emphasized の2組があり、emphasized のほうは
 * 「ブランドの見せ場」向けに用意されている。standard より立ち上がりが鋭く、
 * 止まり際がぐっと長く伸びるので、同じ秒数でも動きにゆとりが出る。
 * イントロは実用性より印象が優先される場面なので emphasized を使う。
 *
 * 入ってくるもの・止まるものには decelerate、去っていくものには accelerate、
 * 画面内で位置を移すだけのものには standard を当てる。
 *
 * https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
 */
export const EASE = {
  decelerate: CustomEase.create('m3EmphasizedDecelerate', bezier(0.05, 0.7, 0.1, 1)),
  accelerate: CustomEase.create('m3EmphasizedAccelerate', bezier(0.3, 0, 0.8, 0.15)),
  standard: CustomEase.create('m3Standard', bezier(0.2, 0, 0, 1)),

  /**
   * Material の標準カーブ。「画面内のある位置から別の位置へ動くもの」用で、
   * 素早く加速してゆっくり減速する。上の3つは減速が強く、秒数を伸ばしても
   * 見えない尻尾が伸びるだけになるので、動き自体を見せたいものにはこちらを使う。
   * https://m1.material.io/motion/duration-easing.html
   */
  move: CustomEase.create('materialStandard', bezier(0.4, 0, 0.2, 1)),
} as const;
