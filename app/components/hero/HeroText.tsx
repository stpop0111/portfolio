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
            <p className='progressText fixed bottom-0 right-0 text-[256px] font-bold tracking-tighter text-zinc-950' style={{ fontFamily: 'var(--font-righteous)' }}>{progressCount}</p>
        </div>
      )}

      {/* タイトル */}
      {phase !== 'loading' && (
        <div className='titleBlock'>
          <h2 className='titleText text-9xl relative flex'>
            {'Portfolio'.split('').map((char, i) => (
              <span key={i} className='title opacity-0 blur-[20px]'>
                {char}
              </span>
            ))}
          </h2>
          <div className='nameBlock absolute inset-0 text-4xl text-amber-600'>
            <span className='absolute -top-7 left-2'>
              {'SEITA'.split('').map((char, i) => (
                <span key={i} className='nameFirst opacity-0 blur-[10px] scale-120'>
                  {char}
                </span>
              ))}
            </span>
            <span className='absolute -bottom-7 right-2'>
              {'IZAKI'.split('').map((char, i) => (
                <span key={i} className='nameLast opacity-0 blur-[10px] scale-120'>
                  {char}
                </span>
              ))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
