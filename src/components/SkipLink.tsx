"use client";
import { useLanguage } from './LanguageProvider';
export default function SkipLink(){const {language}=useLanguage();return <a href="#main-content" className="skip-link">{language==='en'?'Skip to content':'Перейти к содержимому'}</a>;}
