type Phase = 'loading' | 'changing' | 'title' | 'hero';

export function HeroText({
  ref,
  phase,
  progressCount,
}: {
  ref?: React.RefObject<HTMLDivElement | null>;
  phase: Phase;
  progressCount: number;
}) {
  return (
    <div ref={ref} className='fixed inset-0 z-50 pointer-events-none flex items-center justify-center'>
      {/* ローディング */}
      {(phase === 'loading' || phase === 'changing') && (
        <div className='loadingBlock'>
          <h2 className='loadingText absolute inset-0 flex items-center justify-center text-5xl'>
            {'Loading...'.split('').map((char, i) => (
              <span key={i} className='loading'>
                {char}
              </span>
            ))}
          </h2>
            <p className='progressText fixed bottom-0 right-0 leading-64 text-[256px] font-bold -tracking-widest text-zinc-950 font-righteous'>{progressCount}</p>
        </div>
      )}
    </div>
  );
}
