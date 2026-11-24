"use client";
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import WebGLScene from './three/WebGLScene';

export default function Backdrop() {
  const path = usePathname();
  const [scroll, setScroll] = useState({ chapter: 0, progress: 0 });
  const [homeScene, setHomeScene] = useState(0);
  const [details, setDetails] = useState({ profile: 1, selected: 0 });
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const chapter = path === '/' ? 0 : path === '/benchmark' ? 2 : path === '/presets' ? 3 : path === '/tweaker' ? 4 : 6;
      const progress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
      setScroll({ chapter, progress });
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    read(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); };
  }, [path]);
  useEffect(() => {
    function home(e: Event) { setHomeScene((e as CustomEvent<number>).detail); }
    window.addEventListener('shift:home-slide', home);
    function config(e: Event) { const detail = (e as CustomEvent<{ profile: number }>).detail; if (detail) setDetails(v => ({ ...v, profile: detail.profile })); }
    function tweak(e: Event) { const detail = (e as CustomEvent<{ selected: number }>).detail; if (detail) setDetails(v => ({ ...v, selected: detail.selected })); }
    window.addEventListener('shift:scene-config', config); window.addEventListener('shift:scene-tweaks', tweak);
    return () => { window.removeEventListener('shift:home-slide', home); window.removeEventListener('shift:scene-config', config); window.removeEventListener('shift:scene-tweaks', tweak); };
  }, []);
  const state = useMemo(() => ({ ...scroll, ...details, chapter: path === '/' ? 0 : scroll.chapter, homeScene: path === '/' ? homeScene : undefined }), [scroll, details, homeScene, path]);
  return <WebGLScene kind="cinematic" className={`cinematic-backdrop${path === "/" ? "" : " internal-backdrop"}`} state={state} />;
}
