'use client';
// React
import { useRef, useEffect } from 'react';
// GSAP
import gsap from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
gsap.registerPlugin(MorphSVGPlugin);
// その他
import * as blobs from 'blobs/v2';

const SIZE = 100;
// blobsのsvgPathはシードを与えても環境によって結果が変わりハイドレーション不一致の
// 原因になるため、初期形状は固定文字列にしてサーバー/クライアントで確実に一致させる
const BASE_BLOB = 'M50 4 C74 4 96 26 96 50 C96 74 74 96 50 96 C26 96 4 74 4 50 C4 26 26 4 50 4 Z';

function randomBlobPath(randomness = 1.7, extraPoints = 6) {
  return blobs.svgPath({ seed: Math.random().toString(), extraPoints, randomness, size: SIZE });
}

// 速く動かした時にちぎれて飛んでいく小さなblob
function spawnChip(x: number, y: number, dirX: number, dirY: number) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const size = 6 + Math.random() * 10;
  const el = document.createElementNS(svgNS, 'svg');
  el.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  el.setAttribute('width', `${size}`);
  el.setAttribute('height', `${size}`);
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '9998';

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', randomBlobPath(1.1, 5));
  path.setAttribute('fill', '#222');
  el.appendChild(path);
  document.body.appendChild(el);

  const spread = 18;
  const offsetX = dirX * spread + (Math.random() - 0.5) * spread;
  const offsetY = dirY * spread + (Math.random() - 0.5) * spread;
  gsap.set(el, { x: x - size / 2, y: y - size / 2, opacity: 1, scale: 1 });
  gsap.to(el, {
    x: `+=${offsetX}`,
    y: `+=${offsetY}`,
    scale: 0,
    opacity: 0,
    duration: 0.45 + Math.random() * 0.25,
    ease: 'power2.out',
    onComplete: () => el.remove(),
  });
}

const SPEED_THRESHOLD = 1.1; // px/ms 目安。これを超えたら「ちぎれる」
const CHIP_COOLDOWN_MS = 70;

export default function CustomCursor() {
  const cursorRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!cursorRef.current) return;
    gsap.set(cursorRef.current, { xPercent: -50, yPercent: -50 });
    const xTo = gsap.quickTo(cursorRef.current, 'x', { duration: 0.4, ease: 'power3.out' });
    const yTo = gsap.quickTo(cursorRef.current, 'y', { duration: 0.4, ease: 'power3.out' });

    // 待機中のゆらぎモーフィング
    const idleTl = gsap.timeline({ repeat: -1 });
    Array.from({ length: 4 }).forEach(() => {
      idleTl.to(pathRef.current, { morphSVG: randomBlobPath(), duration: 1.6, ease: 'sine.inOut' });
    });
    idleTl.to(pathRef.current, { morphSVG: BASE_BLOB, duration: 1.6, ease: 'sine.inOut' });

    let lastX = 0, lastY = 0, lastT = 0, hasLast = false, lastChipTime = 0;

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);

      const now = performance.now();
      if (hasLast) {
        const dt = Math.max(now - lastT, 1);
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const speed = Math.hypot(dx, dy) / dt;
        if (speed > SPEED_THRESHOLD && now - lastChipTime > CHIP_COOLDOWN_MS) {
          lastChipTime = now;
          const len = Math.hypot(dx, dy) || 1;
          spawnChip(e.clientX, e.clientY, -dx / len, -dy / len);
        }
      }
      lastX = e.clientX; lastY = e.clientY; lastT = now; hasLast = true;
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      idleTl.kill();
    };
  }, [cursorRef]);

  return (
    <svg ref={cursorRef} viewBox={`0 0 ${SIZE} ${SIZE}`} className='fixed top-0 left-0 w-8 h-8 pointer-events-none z-9999'>
      <path ref={pathRef} d={BASE_BLOB} fill='#222'></path>
    </svg>
  );
}
