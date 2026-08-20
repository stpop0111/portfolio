/**
 * 実機のカメラ・レンズの数値から three.js のパースペクティブカメラを組み立てるヘルパー。
 *
 * three.js の `fov` は「垂直画角（度）」なので、センサーの縦寸と焦点距離から
 *   vFOV = 2 * atan(センサー縦 / (2 * 焦点距離))
 * で求まる。焦点距離だけを見て「望遠だから狭い」と決め打ちすると、
 * 中判とフルサイズで画角が倍近く変わるので必ずセンサー込みで計算する。
 */

/** センサーの実寸（mm） */
export const sensors = {
  /** 中判：Phase One XF IQ4 / Hasselblad H 系 */
  mediumFormat: { width: 53.4, height: 40.0 },
  /** フルサイズ：Canon EOS R5 / Sony α7R V */
  fullFrame: { width: 36.0, height: 24.0 },
} as const;

export type SensorName = keyof typeof sensors;

/** センサー名と焦点距離（mm）から three.js に渡す fov（垂直画角・度）を出す */
export function verticalFov(sensor: SensorName, focalLength: number): number {
  const half = Math.atan(sensors[sensor].height / (2 * focalLength));
  return (2 * half * 180) / Math.PI;
}

/**
 * その画角で「被写体の位置に縦 frameHeight ワールド単位を収める」ために
 * 必要な、被写体からカメラまでの距離を出す。
 * 直交投影から移すときは frameHeight に `画面の高さ(px) / zoom` を入れると
 * 被写体の見た目の大きさがそのまま揃う。
 */
export function distanceForFrameHeight(fovDeg: number, frameHeight: number): number {
  return frameHeight / (2 * Math.tan(((fovDeg * Math.PI) / 180) * 0.5));
}

type ProductShotConfig = {
  sensor: SensorName;
  /** 焦点距離（mm） */
  focalLength: number;
  /** 被写体（カメラが見る点） */
  target: [number, number, number];
  /** 被写体から見たカメラの方向。長さは無視して向きだけ使う */
  direction: [number, number, number];
  /** 基準面で画面の縦に収めたいワールド単位量 */
  frameHeight: number;
  /**
   * 画角を合わせる基準面が、注視点よりどれだけカメラ側にあるか。
   * パースでは手前ほど大きく写るので、注視点で合わせると被写体の前面は
   * その分だけ大きくなる。ピントを置く面＝被写体の前面をここに入れると、
   * その面が直交投影とまったく同じ位置・大きさに乗る（既定は 0 ＝注視点）。
   */
  subjectDepth?: number;
};

/**
 * 物撮りのカメラ位置と fov をまとめて返す。
 * アングル（＝ direction）は変えずに、画角に合う距離まで引くだけなので、
 * 直交投影からの差し替えでも構図は動かない。
 */
export function productShot({
  sensor,
  focalLength,
  target,
  direction,
  frameHeight,
  subjectDepth = 0,
}: ProductShotConfig) {
  const fov = verticalFov(sensor, focalLength);
  const distance = distanceForFrameHeight(fov, frameHeight) + subjectDepth;
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  const position: [number, number, number] = [
    target[0] + (direction[0] / length) * distance,
    target[1] + (direction[1] / length) * distance,
    target[2] + (direction[2] / length) * distance,
  ];
  return { fov, distance, position };
}

/**
 * 許容錯乱円（mm）。「これ以上ボケたら人の目に分かる」というしきい値で、
 * 写真では慣用的にセンサー対角 / 1500 を使う。被写界深度の計算に要る。
 */
export function circleOfConfusion(sensor: SensorName): number {
  const { width, height } = sensors[sensor];
  return Math.hypot(width, height) / 1500;
}

/**
 * 被写界深度（ピントが合って見える手前〜奥の範囲）を実寸 mm で返す。
 * subjectDistance も mm。3D 側はワールド単位なので、呼ぶ側で
 * 「1 ワールド単位 = 何 mm か」を決めて換算する必要がある。
 *
 * 絞るほど（F 値が大きいほど）範囲は広がり、過焦点距離を超えると
 * 奥は無限遠までピントが合う＝ far は Infinity になる。
 */
export function depthOfField(sensor: SensorName, focalLength: number, fNumber: number, subjectDistance: number) {
  const c = circleOfConfusion(sensor);
  const f = focalLength;
  const s = subjectDistance;
  const hyperfocal = (f * f) / (fNumber * c) + f;
  const near = (s * (hyperfocal - f)) / (hyperfocal + s - 2 * f);
  const behind = hyperfocal - s;
  const far = behind <= 0 ? Infinity : (s * (hyperfocal - f)) / behind;
  return { hyperfocal, near, far };
}
