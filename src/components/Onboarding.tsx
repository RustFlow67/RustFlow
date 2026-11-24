"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import ShiftLogo from "./ShiftLogo";
import WebGLScene from "./three/WebGLScene";


import { useLanguage } from './LanguageProvider';
import { useLockBody } from '@/hooks/useLockBody';
import SwipeButton from './ui/SwipeButton';
const OnboardingContext = createContext({ready:false, open:true});
export const useOnboardingStatus = () => useContext(OnboardingContext);
const spring = { type: "spring" as const, stiffness: 420, damping: 32, mass: .8 };
const text = {
  ru: {
    welcome: "Добро пожаловать в SHIFT", intro: "Привет от команды SHIFT. Мы создаём инструменты для осознанной настройки Rust: меньше догадок, больше контроля над плавностью.",
    next: "Продолжить", back: "Назад", language: "Выберите язык", languageNote: "Язык настройки можно изменить прямо сейчас.",
    terms: "Безопасность и условия", policy: "SHIFT хранит выбор настройки и данные о сборках локально. Не отправляйте файлы конфигурации, содержащие личные данные, незнакомым людям.",
    safe: "Приложение не должно внедряться в процесс игры или изменять память Rust. Проверяйте актуальные правила Facepunch и Easy Anti-Cheat: совместимость и отсутствие блокировки не гарантируются.",
    backup: "До изменений самостоятельно сохраните резервную копию. Наличие и полнота отката зависят от конкретной операции; проверяйте инструкции.",
    agree: "Я принимаю эти условия и ознакомился с правилами безопасности", finish: "Войти в SHIFT", progress: "Шаг",
  },
  en: {
    welcome: "Welcome to SHIFT", intro: "We build tools for thoughtful Rust optimisation: fewer guesses, more control over smoothness.",
    next: "Continue", back: "Back", language: "Choose a language", languageNote: "You can change the setup language here.",
    terms: "Safety and terms", policy: "SHIFT stores setup preferences and build information locally. Do not share configuration files containing personal information with strangers.",
    safe: "The application must not inject into the game or modify Rust's memory. Check the current Facepunch and Easy Anti-Cheat rules: compatibility and freedom from bans cannot be guaranteed.",
    backup: "Keep an independent backup before making changes. Rollback availability and completeness depend on each operation; review its instructions.",
    agree: "I accept these terms and have read the safety information", finish: "Enter SHIFT", progress: "Step",
  },
} as const;

export default function Onboarding({ children }: { children: ReactNode }) {
  const {language, setLanguage} = useLanguage();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [transition, setTransition] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const reduced = useReducedMotion();
  const dialog = useRef<HTMLDivElement>(null);
  const t = text[language];
  useLockBody(ready && open);
  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      let completed = false;
      try { completed = localStorage.getItem('shift_web_device_onboarded') === 'true'; } catch { /* storage may be unavailable */ }
      setOpen(!completed); setReady(true);
    });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!ready || !open) return;
    document.documentElement.setAttribute("data-onboarding", "");
    const previous = document.activeElement;
    requestAnimationFrame(() => dialog.current?.focus());
    function keyboard(e: KeyboardEvent) {
      if (e.key !== "Tab" || !dialog.current) return;
      const elements = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href]')];
      const first = elements[0], last = elements.at(-1);
      if (!first || !last) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keyboard);
    return () => { document.documentElement.removeAttribute("data-onboarding"); document.removeEventListener("keydown", keyboard); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [ready, open]);
  function changeStep(delta: number) {
    setTransition(value => value + 1);
    setStep(value => Math.max(0, Math.min(2, value + delta)));
  }
  function finish() {
    const complete = () => {
      try { localStorage.setItem('shift_web_device_onboarded', 'true'); } catch { /* next visit may show setup again */ }
      setOpen(false); setExiting(false);
      window.dispatchEvent(new Event('shift:hero-replay'));
    };
    if (reduced) { complete(); return; }
    setExiting(true); window.setTimeout(complete, 500);
  }
  return <OnboardingContext.Provider value={{ready,open}}>
    <div inert={!ready || open} aria-hidden={!ready || open || undefined} style={{visibility:ready && !open ? "visible" : "hidden"}}>{children}</div>
    {ready && open && <div className={`shift-setup-overlay${exiting ? " shift-setup-exiting" : ""}`}>
      <WebGLScene kind="core" className="setup-core" state={{ step, accepted }} />
      {transition > 0 && <div key={transition} className="setup-glitch" aria-hidden="true" />}
      <div className="setup-scene-meta" aria-hidden="true"><span>SHIFT SYSTEMS / 2026</span><span>0{step + 1} / 03</span></div>
      <motion.section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="shift-setup-title" tabIndex={-1} className="shift-setup"
        initial={reduced ? false : { opacity: 0, scale: .97, y: 12 }} animate={exiting ? { opacity: 0, scale: .94, y: 0 } : { opacity: 1, scale: 1, y: 0 }} transition={reduced ? { duration: 0 } : spring}>
        <div className="shift-setup-top"><ShiftLogo className="shift-setup-mark" /><span>SHIFT</span><small>{t.progress} {step + 1} / 3</small></div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={reduced ? false : { x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={reduced ? { opacity: 0 } : { x: -20, opacity: 0 }} transition={reduced ? { duration: 0 } : spring} className="shift-setup-content">
            {step === 0 && <><p className="shift-kicker">01 // {language === 'en' ? 'WELCOME' : 'ПРИВЕТСТВИЕ'} · SHIFT / RUST</p><h1 id="shift-setup-title">{t.welcome}</h1><p>{t.intro}</p></>}
            {step === 1 && <><p className="shift-kicker">02 // {language === 'en' ? 'LANGUAGE' : 'ЯЗЫК'}</p><h1 id="shift-setup-title">{t.language}</h1><p>{t.languageNote}</p><div className="shift-choices" role="group" aria-label={t.language}>
              {([['ru', 'Русский'], ['en', 'English']] as const).map(([id, label]) => <SwipeButton type="button" key={id} aria-pressed={language === id} onClick={() => setLanguage(id)} trailing={language === id ? <Check size={18} aria-hidden="true" /> : undefined}>{label}</SwipeButton>)}
            </div></>}
            {step === 2 && <><p className="shift-kicker">03 // {language === 'en' ? 'PROTOCOL' : 'ПРОТОКОЛ'} &amp; EAC</p><h1 id="shift-setup-title">{t.terms}</h1><div className="shift-terms"><p>{t.policy}</p><p>{t.safe}</p><p>{t.backup}</p></div><label className="shift-consent"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /> <span>{t.agree}</span></label></>}
          </motion.div>
        </AnimatePresence>
        <div className="shift-setup-actions">{step > 0 && <SwipeButton className="shift-back" type="button" onClick={() => changeStep(-1)}>{t.back}</SwipeButton>}
          <SwipeButton className="shift-next" type="button" disabled={exiting || (step === 2 && !accepted)} onClick={() => step === 2 ? finish() : changeStep(1)} trailing={<ChevronRight size={18} aria-hidden="true" />}>{step === 2 ? t.finish : t.next}</SwipeButton></div>
      </motion.section>
    </div>}
  </OnboardingContext.Provider>;
}
