"use client";
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import DownloadAppButton from './DownloadAppButton';
import SwipeButton from './ui/SwipeButton';
import { useLanguage } from './LanguageProvider';

export function LanguageSwitch() {
  const {language,setLanguage}=useLanguage();
  return <div className="language-switch" role="group" aria-label={language==='en'?'Language':'Язык'}>{(['ru','en'] as const).map(id=><SwipeButton type="button" key={id} onClick={()=>setLanguage(id)} aria-pressed={language===id}>{id.toUpperCase()}</SwipeButton>)}</div>;
}
export default function Nav() {
  const {language}=useLanguage(); const en=language==='en'; const [active,setActive]=useState(0); const path=usePathname();
  useEffect(()=>{const update=(e:Event)=>setActive((e as CustomEvent<number>).detail);window.addEventListener('shift:home-slide',update);return()=>window.removeEventListener('shift:home-slide',update);},[]);
  const labels=en?['About Us','About Our Project','About the App','FAQ & Myths']:['О нас','О нашем проекте','О приложении','FAQ и мифы'];
  function navigate(index:number) { window.dispatchEvent(new CustomEvent('shift:home-goto',{detail:index})); }
  return <><header className="cinema-header"><Link href="/#scene-1" className="cinema-brand" aria-label={en?'SHIFT — home':'SHIFT — на главную'} onClick={e=>{if(path==='/'){e.preventDefault();navigate(0);}}}>{'// SHIFT'}<span>.</span></Link><div className="cinema-header-actions"><LanguageSwitch/><DownloadAppButton compact/></div></header>
    <nav className="chapter-nav" aria-label={en?'Sections':'Разделы'}><span className="chapter-progress" style={{'--chapter':active} as React.CSSProperties} aria-hidden="true"/>{labels.map((label,i)=><Link href={`/#scene-${i+1}`} key={label} aria-current={active===i?'page':undefined} onClick={e=>{if(path==='/'){e.preventDefault();navigate(i);}}}><span>{String(i+1).padStart(2,'0')}</span><b>{label}</b></Link>)}</nav></>;
}
