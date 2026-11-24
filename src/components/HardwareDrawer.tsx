"use client";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, X } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import type { ComboItem } from './Combobox';

export default function HardwareDrawer({ label, placeholder, items, value, onChange, icon }: {label:string; placeholder:string; items:ComboItem[]; value:string; onChange:(id:string)=>void; icon?:ReactNode}) {
  const {language}=useLanguage(); const en=language==='en';
  const [open,setOpen]=useState(false), [query,setQuery]=useState('');
  const trigger=useRef<HTMLButtonElement>(null), panel=useRef<HTMLDivElement>(null), id=useId();
  const filtered=useMemo(() => { const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean); return items.filter(item=>words.every(word=>item.name.toLowerCase().includes(word))); },[items,query]);
  useEffect(() => {
    if (!open) return;
    function key(e:KeyboardEvent) { if(e.key==='Escape') { e.preventDefault(); setOpen(false); trigger.current?.focus(); } if(e.key==='Tab' && panel.current) { const nodes=[...panel.current.querySelectorAll<HTMLElement>('input,button:not([disabled])')]; const first=nodes[0], last=nodes.at(-1); if(e.shiftKey && document.activeElement===first) { e.preventDefault(); last?.focus(); } else if(!e.shiftKey && document.activeElement===last) { e.preventDefault(); first?.focus(); } } }
    document.addEventListener('keydown',key); return()=>document.removeEventListener('keydown',key);
  },[open]);
  function close() {setOpen(false);trigger.current?.focus();}
  return <div className="hardware-trigger-row">
    <span className="hardware-label">{label}</span>
    <button ref={trigger} type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setQuery('');setOpen(true);}}><span>{icon}{items.find(item=>item.id===value)?.name ?? placeholder}</span><ArrowUpRight size={18}/></button>
    {open && createPortal(<div className="hardware-scrim" onPointerDown={e=>{if(e.target===e.currentTarget)close();}}><div ref={panel} className="hardware-drawer" role="dialog" aria-modal="true" aria-labelledby={id}>
      <header><div><small>{en ? 'CHOOSE COMPONENT' : 'ВЫБОР КОМПЛЕКТУЮЩЕГО'}</small><h2 id={id}>{label}</h2></div><button type="button" onClick={close} aria-label={en ? "Close" : "Закрыть"}><X/></button></header>
      <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={en ? "Search models" : "Поиск модели"} aria-label={`${label}: ${en ? "search" : "поиск"}`} />
      <p className="hardware-count">{filtered.length} {en ? "MODELS" : "МОДЕЛЕЙ"}</p><div className="hardware-list">{filtered.length===0 && <p>{en ? 'No matching model. Choose the closest equivalent.' : 'Такой модели нет в списке. Выберите ближайшую по классу.'}</p>}{filtered.map(item=><button type="button" key={item.id} aria-pressed={value===item.id} onClick={()=>{onChange(item.id);close();}}><span><small>{en ? ({'Ноутбуки':'Laptops','Встроенная графика':'Integrated graphics'}[item.group] ?? item.group) : item.group}</small>{item.name}</span><b>{value===item.id?'✓':'↗'}</b></button>)}</div>
    </div></div>,document.body)}
  </div>;
}
