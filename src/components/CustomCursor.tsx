"use client";
import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const ring = useRef<HTMLDivElement>(null), dot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
    let frame = 0, x = 0, y = 0, rx = 0, ry = 0, shown = false;
    function tick() {
      rx += (x - rx) * .18; ry += (y - ry) * .18;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      if (Math.abs(x-rx)+Math.abs(y-ry) > .15) frame = requestAnimationFrame(tick); else frame = 0;
    }
    function move(e: PointerEvent) {
      if (!media.matches || e.pointerType !== 'mouse' || document.documentElement.dataset.motion === 'reduced') { hide(); return; }
      x = e.clientX; y = e.clientY;
      if (!shown) { rx = x; ry = y; shown = true; document.documentElement.setAttribute('data-custom-cursor', ''); }
      if (dot.current) dot.current.style.transform = `translate3d(${x}px,${y}px,0)`;
      const interactive = e.target instanceof Element && !!e.target.closest('a,button,input,select,textarea,[role="button"],[role="switch"],[role="slider"],.cinema-grab,canvas[tabindex]');
      ring.current?.toggleAttribute('data-active', interactive);
      if (!frame) frame = requestAnimationFrame(tick);
    }
    function hide() { shown = false; document.documentElement.removeAttribute('data-custom-cursor'); cancelAnimationFrame(frame); frame = 0; }
    const changed = () => { if (!media.matches) hide(); };
    window.addEventListener('pointermove', move, { passive: true }); document.addEventListener('pointerleave', hide); window.addEventListener('blur', hide); media.addEventListener('change', changed);
    return () => { hide(); window.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', hide); window.removeEventListener('blur', hide); media.removeEventListener('change', changed); };
  }, []);
  return <div className="custom-cursor" aria-hidden="true"><div ref={ring} className="cursor-ring"><span /></div><div ref={dot} className="cursor-dot"><span /></div></div>;
}
