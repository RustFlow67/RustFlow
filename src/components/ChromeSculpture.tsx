"use client";
import { useRef } from 'react';
import { useLanguage } from './LanguageProvider';

/** The invisible grab area is limited to the sculpture; navigation remains above it. */
export default function ChromeSculpture() {
  const {language}=useLanguage();
  const last = useRef<{ x: number; y: number } | null>(null);
  function send(dx: number, dy: number, end = false) { window.dispatchEvent(new CustomEvent('shift:scene-drag', { detail: { dx, dy, end } })); }
  return <div className="cinema-grab" role="img" tabIndex={0} aria-label={language === "en" ? "Rotate the SHIFT sculpture: drag or use arrow keys" : "Вращение скульптуры SHIFT: перетащите или используйте стрелки"} onPointerDown={e => { last.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (!last.current) return; send(e.clientX - last.current.x, e.clientY - last.current.y); last.current = { x: e.clientX, y: e.clientY }; }} onPointerUp={() => { last.current = null; send(0, 0, true); }} onPointerCancel={() => { last.current = null; send(0, 0, true); }} onKeyDown={e => { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return; e.preventDefault(); send(e.key === 'ArrowLeft' ? -18 : e.key === 'ArrowRight' ? 18 : 0, e.key === 'ArrowUp' ? -18 : e.key === 'ArrowDown' ? 18 : 0); }} />;
}
