export function Curtains({ show, colors }: { show: boolean; colors: string[] }) {
  if (!show) return null;
  return (
    <>
      {colors.map((cls, i) => (
        <div key={i} className={`${cls} curtain fixed inset-0`} style={{ zIndex: 40 - i }} />
      ))}
    </>
  );
}