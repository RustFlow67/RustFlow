import LiquidGlass from "@/components/LiquidGlass";
import { Flame } from "lucide-react";
import Link from "./RouteLink";

export default function Footer() {
  return <footer className="rf-footer-wrap mx-auto mt-10 w-full max-w-6xl px-3.5 sm:px-6"><div className="rf-footer">
    <LiquidGlass as={Link} href="/" scrollHome className="glass footer-brand" aria-label="RustFlow — на главную"><Flame size={20} aria-hidden="true" />RustFlow</LiquidGlass>
    <p>© 2026 RustFlow. Все права защищены авторским правом. Независимый проект, не связан с Facepunch Studios и Easy Anti-Cheat.</p>
  </div></footer>;
}
