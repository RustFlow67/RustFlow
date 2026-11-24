"use client";
import { useLanguage } from './LanguageProvider';
import SwipeButton from './ui/SwipeButton';

// An installer must be supplied by a release process, never replaced with an unrelated ZIP.
function installerUrl() {
  const raw = process.env.NEXT_PUBLIC_SHIFT_WINDOWS_DOWNLOAD_URL;
  if (!raw) return null;
  try { const url = new URL(raw); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export default function DownloadAppButton({compact=false, version=false}: {compact?:boolean; version?:boolean}) {
  const {language}=useLanguage(); const en=language==='en'; const url=installerUrl();
  const label=compact ? (en?'Download':'Скачать') : version ? (en?'Download SHIFT for Windows':'Скачать SHIFT для Windows') : (en?'Download for Windows':'Скачать для Windows');
  return <span className={`app-download-wrap${compact ? ' compact' : ''}`}><SwipeButton type="button" className={`app-download${compact ? ' compact' : ''}`} disabled={!url} title={!url ? (en?'Windows installer is not published yet':'Установщик Windows пока не опубликован') : undefined} onClick={()=>{if(url) window.location.assign(url);}} trailing={<span aria-hidden="true">↗</span>}>{label}</SwipeButton>{!url && !compact && <small>{en?'Windows installer not published yet':'Установщик Windows пока не опубликован'}</small>}</span>;
}
