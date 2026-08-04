import { GRID_PARAMS } from './gridParams';

/**
 * 幾何学グリッド（細い格子線＋交点の十字）を 2D キャンバスに描く。
 * 交点の周りだけ線を切って ---- 十 ---- の見た目にしている。
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
) {
  ctx.fillStyle = GRID_PARAMS.bgColor;
  ctx.fillRect(0, 0, w, h);

  const spacing = GRID_PARAMS.gridSpacing * dpr;
  const crossSize = GRID_PARAMS.crossSize * dpr;
  const gap = Math.min(GRID_PARAMS.crossGap * dpr, spacing / 2 - 1);
  const lineWidth = Math.max(1, dpr);

  // 格子線（交点の手前で切る）
  ctx.strokeStyle = `rgba(${GRID_PARAMS.lineColor},${GRID_PARAMS.lineOpacity})`;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (let y = 0; y <= h; y += spacing) {
    for (let x = 0; x < w; x += spacing) {
      ctx.moveTo(x + gap, y);
      ctx.lineTo(x + spacing - gap, y);
    }
  }
  for (let x = 0; x <= w; x += spacing) {
    for (let y = 0; y < h; y += spacing) {
      ctx.moveTo(x, y + gap);
      ctx.lineTo(x, y + spacing - gap);
    }
  }
  ctx.stroke();

  // 交点の十字マーク
  ctx.strokeStyle = `rgba(${GRID_PARAMS.crossColor},${GRID_PARAMS.crossOpacity})`;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (let x = 0; x <= w; x += spacing) {
    for (let y = 0; y <= h; y += spacing) {
      ctx.moveTo(x - crossSize, y); ctx.lineTo(x + crossSize, y);
      ctx.moveTo(x, y - crossSize); ctx.lineTo(x, y + crossSize);
    }
  }
  ctx.stroke();
}
