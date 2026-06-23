type Phase = 'loading' | 'changing' | 'title' | 'hero';

export function HeroText({
  ref,
  phase,
  progressCount,
  hideLoading = false,
}: {
  ref?: React.RefObject<HTMLDivElement | null>;
  phase: Phase;
  progressCount: number;
  hideLoading?: boolean;
}) {
  return (
    <div ref={ref} className='fixed inset-0 z-95 pointer-events-none flex items-center justify-center'>
      {/* ローディング */}
      {!hideLoading && (phase === 'loading' || phase === 'changing') && (
        <div className='loadingBlock'>
          <h2 className='loadingText font-futura absolute inset-0 flex items-center justify-center text-5xl'>
            {'Loading...'.split('').map((char, i) => (
              <span key={i} className='loading'>
                {char}
              </span>
            ))}
          </h2>
            <p className='progressText font-futura fixed bottom-0 right-0 leading-64 text-[256px] font-bold -tracking-widest text-zinc-950'>{progressCount}</p>
        </div>
      )}
    </div>
  );
}
