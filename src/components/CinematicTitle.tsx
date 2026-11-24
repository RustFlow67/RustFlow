"use client";
import { useEffect, useRef, useState } from 'react';

/** Remount the lettering after a replayed onboarding, without remounting the page. */
export default function CinematicTitle() {
  const [sequence, setSequence] = useState(0);
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const replay = () => setSequence(value => value + 1);
    window.addEventListener('shift:hero-replay', replay);
    return () => window.removeEventListener('shift:hero-replay', replay);
  }, []);
  useEffect(() => {
    const element = inner.current, container = outer.current;
    if (!element || !container) return;
    const measure = () => container.style.setProperty('--pour-width', `${element.getBoundingClientRect().width}px`);
    const observer = new ResizeObserver(measure); observer.observe(element); measure();
    return () => observer.disconnect();
  }, [sequence]);
  return <h1 id="shift-home-title" className={`stage-word${sequence > 0 ? " title-replay" : ""}`} aria-label="SHIFT." key={sequence}><span className="title-solid">SHI</span><span ref={outer} className="title-pour" aria-hidden="true"><span ref={inner} className="title-pour-inner"><i>I</i><i>I</i><i>I</i></span></span><span className="title-solid">FT.</span>{sequence > 0 && [-96, -48, 48, 96].map(offset => <span key={offset} className="title-echo" aria-hidden="true" style={{'--echo-y': `${offset}px`, '--echo-alpha': Math.abs(offset) === 48 ? .55 : .25} as React.CSSProperties}><span>SHI</span><span>III</span><span>FT.</span></span>)}</h1>;
}
