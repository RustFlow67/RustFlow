"use client";
import { useLanguage } from "./LanguageProvider";
import Link from "./RouteLink";
import ShiftLogo from "./ShiftLogo";

export default function Footer() {
  const {language}=useLanguage();
  return <footer className="rf-footer-wrap w-full"><div className="rf-footer">
    <Link href="/" scrollHome className="shift-brand" aria-label={language === "en" ? "SHIFT — home" : "SHIFT — на главную"}><ShiftLogo className="shift-logo" />SHIFT</Link>
    <p>{language === 'en' ? 'SHIFT is an independent project, not affiliated with Facepunch Studios or Easy Anti-Cheat. Check game rules and keep backups.' : 'SHIFT — независимый проект; не связан с Facepunch Studios или Easy Anti-Cheat. Проверяйте правила игры и создавайте резервные копии.'}</p>
  </div></footer>;
}
