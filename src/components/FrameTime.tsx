import LiquidGlass from "@/components/LiquidGlass";
import { Activity } from "lucide-react";

/** Illustration only: it is not a measurement or a promise of improvement. */
export default function FrameTime() {
  return <LiquidGlass as="figure" className="well frame-time">
    <figcaption><strong><Activity size={14} aria-hidden="true" /> Frame Time</strong><span>Иллюстрация · не измерение</span></figcaption>
    <svg viewBox="0 0 320 44" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="frame-grid" d="M0 8H320 M0 21H320 M0 35H320 M160 2V42" />
      <path className="frame-trace" d="M0 31 Q15 29 25 30 T45 24 T70 30 T95 20 T120 29 T150 25 T175 30 T205 27 T235 29 T270 26 T320 29" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="frame-legend"><span>Сравнивайте одинаковые сцены</span><span>Результат зависит от ПК</span></div>
  </LiquidGlass>;
}
