"use client";
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
export default function GlitchPulse(){
  const path=usePathname();
  useEffect(()=>{let timer=0; const pulse=()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion==='reduced')return;document.documentElement.removeAttribute('data-glitch'); void document.documentElement.offsetWidth;document.documentElement.setAttribute('data-glitch',''); window.dispatchEvent(new Event('shift:glitch-pulse')); clearTimeout(timer);timer=window.setTimeout(()=>document.documentElement.removeAttribute('data-glitch'),450);}; pulse();window.addEventListener('shift:home-slide',pulse); const ambient=window.setInterval(pulse,19000);return()=>{clearTimeout(timer);clearInterval(ambient);document.documentElement.removeAttribute('data-glitch');window.removeEventListener('shift:home-slide',pulse);};},[path]);
  return null;
}
