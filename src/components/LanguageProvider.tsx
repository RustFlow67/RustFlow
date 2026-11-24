"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
export type Language = 'ru' | 'en';
const LanguageContext = createContext<{language:Language; setLanguage:(value:Language)=>void} | null>(null);
export function LanguageProvider({children}:{children:ReactNode}) {
  const [language,setValue]=useState<Language>('ru');
  useEffect(()=>{ let alive=true; queueMicrotask(()=>{if(!alive)return;try{const v=localStorage.getItem('shift_locale');if(v==='en'||v==='ru')setValue(v);}catch{} });return()=>{alive=false;}; },[]);
  useEffect(()=>{document.documentElement.lang=language;},[language]);
  const setLanguage=useCallback((value:Language)=>{setValue(value);try{localStorage.setItem('shift_locale',value);}catch{}},[]);
  const value=useMemo(()=>({language,setLanguage}),[language,setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage(){const value=useContext(LanguageContext);if(!value)throw new Error('useLanguage requires LanguageProvider');return value;}
