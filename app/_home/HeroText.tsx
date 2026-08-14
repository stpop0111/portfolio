/**
 * ヒーロー画面のテキストレイヤー。
 * ローディングの表示は LoadingTitle に移したので、いまは空の器。
 * Stage 4 の名前（seita / izaki）のタイポアニメーションをここに入れる想定。
 */
export function HeroText({ ref }: { ref?: React.RefObject<HTMLDivElement | null> }) {
  return <div ref={ref} className='fixed inset-0 z-95 pointer-events-none flex items-center justify-center' />;
}
