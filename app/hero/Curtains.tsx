export function Curtains({
  show,
  colors,
  edge = 'bottom',
}: {
  show: boolean;
  colors: string[];
  edge?: 'top' | 'bottom';
}) {
  if (!show) return null;
  // 曲げる辺の反対側を基準にして、楕円の裏(余白20vh)を画面外へ逃がす
  const anchor = edge === 'bottom' ? 'top-0' : 'bottom-0';
  return (
    <>
      {colors.map((cls, i) => {
        // 手前(i=0)=緩い → 奥(iが大きい)=急。深さを線形に増やす
        const depth = 6 + i * 3; // vw。base=6, step=3 はお好みで調整
        const radius = `50% ${depth}vw`;
        const radiusStyle =
          edge === 'bottom'
            ? { borderBottomLeftRadius: radius, borderBottomRightRadius: radius }
            : { borderTopLeftRadius: radius, borderTopRightRadius: radius };
        return (
          <div
            key={i}
            className={`${cls} curtain fixed inset-x-0 ${anchor} h-[120vh]`}
            style={{ zIndex: 90 - i, ...radiusStyle }}
          />
        );
      })}
    </>
  );
}
