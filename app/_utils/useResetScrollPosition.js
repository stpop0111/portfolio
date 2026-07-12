import { useEffect } from "react";

export default function useResetScrollPosition(lenis) {
  /* リロード時に最上部から */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
  }, [lenis]);
}
