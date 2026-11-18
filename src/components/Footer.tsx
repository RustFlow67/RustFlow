import { Flame } from "lucide-react";

export default function Footer() {
  return <footer className="rf-footer-wrap mx-auto mt-10 w-full max-w-6xl px-3.5 sm:px-6">
    <div className="rf-footer">
      <span className="inline-flex items-center gap-2 self-center font-extrabold">
        <Flame className="h-4 w-4 text-accent-hi" aria-hidden="true" />Rust<span className="-ml-2 text-accent-hi">Flow</span>
      </span>
      <p className="text-xs leading-relaxed text-ink-3">Независимый проект, не связан с Facepunch Studios и Easy Anti-Cheat.</p>
    </div>
  </footer>;
}
