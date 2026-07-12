'use client'
// React
import { useRef, useEffect } from "react"
// GSAP
import gsap from "gsap"

export default function CustomCursor () {
  const cursorRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    gsap.set(cursorRef.current, { 'xPercent' : '-50', 'yPercent' : '-50' })
    const xTo = gsap.quickTo(cursorRef.current, 'x', {duration:0.4, ease:'power3.out'})
    const yTo = gsap.quickTo(cursorRef.current, 'y', {duration:0.4, ease:'power3.out'})

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY)
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove)
  },[cursorRef])

  return (
    <svg ref={cursorRef} viewBox="0 0 100 100" className="fixed top-0 left-0 w-8 h-8 pointer-events-none z-9999" >
      <circle cx="50" cy='50' r='40' fill="#222"></circle>
    </svg>
  )
}