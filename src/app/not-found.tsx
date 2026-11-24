"use client";
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
export default function NotFound() {
  const {language}=useLanguage(); const en=language==='en';
  return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:32,color:'#f5f5f7',background:'#050505'}}><div><p>404 / SHIFT</p><h1 style={{fontSize:'clamp(2rem,6vw,5rem)',margin:'24px 0'}}>{en?'Page not found.':'Страница не найдена.'}</h1><Link href="/">{en?'Back home ↗':'На главную ↗'}</Link></div></div>;
}
