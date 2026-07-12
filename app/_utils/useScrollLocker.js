// React
import { useEffect } from 'react';

export default function useScrollLocker(lenis, scrollLocked) {
  useEffect(() => {
    if (!lenis) return;
    if (scrollLocked) {
      lenis.stop();
    } else {
      lenis.start();
    }
    document.body.style.overflow = scrollLocked ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [lenis, scrollLocked]);
}
