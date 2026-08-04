/**
 * 背景グリッドの見た目パラメータ。
 * 歪みの強さ自体は FluidEffect/fluidParams.ts 側で管理している。
 */
export const GRID_PARAMS = {
  /** 背景色 */
  bgColor: '#0d0d0d',
  /** 交点の間隔（px） */
  gridSpacing: 390,
  /** 格子線の濃さ（0〜1）。線はごく薄くして交点だけ目立たせる */
  lineOpacity: 0.06,
  /** 交点の十字の濃さ（0〜1） */
  crossOpacity: 0.22,
  /** 十字の腕の長さ（px, dpr 倍する前） */
  crossSize: 7,
  /** 十字の周りに線を引かない余白（px, dpr 倍する前） */
  crossGap: 18,
  /** 格子線の色（rgb の3値をカンマ区切り） */
  lineColor: '255,255,255',
  /** 交点の十字の色（rgb）。格子線と別にすることでアクセントにできる */
  crossColor: '250,129,18',
};
