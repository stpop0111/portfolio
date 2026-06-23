export function Curtains({ show, colors }: { show: boolean; colors: string[] }) {
  if (!show) return null;
  return (
    <>
      {colors.map((cls, i) => {
        // 手前(i=0)=緩い → 奥(iが大きい)=急。深さを線形に増やす
        const depth = 6 + i * 3; // vw。base=6, step=3 はお好みで調整
        const radius = `50% ${depth}vw`;
        return (
          <div
            key={i}
            className={`${cls} curtain fixed inset-0`}
            style={{
              zIndex: 90 - i,
              borderBottomLeftRadius: radius,
              borderBottomRightRadius: radius,
            }}
          />
        );
      })}
    </>
  );
}