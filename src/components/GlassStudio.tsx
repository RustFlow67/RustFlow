"use client";

import LiquidGlass from "@/components/LiquidGlass";
import type { CSSProperties } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { ANIMATIONS, DEFAULT_ENGINE, WALLPAPERS } from "@/lib/materials";
import { useAppearance } from "./GlassAppearance";
import { useAccount } from "./auth/AccountProvider";
import Segmented from "./Segmented";

export default function GlassStudio() {
  const { engine, tune } = useAppearance();
  const saved=Boolean(useAccount().session?.user);
  return <section className="studio" aria-label="Студия настройки Liquid Glass">
    <div className="studio-sample">
      <span className="studio-drop" aria-hidden="true" />
      <LiquidGlass className="glass studio-slide"><SlidersHorizontal size={17} aria-hidden="true" /><div><small>ОПТИЧЕСКИЙ СТЕНД</small><strong>Liquid Glass</strong></div><span>{saved ? "PRO" : "LIVE"}</span></LiquidGlass>
    </div>
    <p className="studio-note">{saved ? "Настройки сразу видны на стекле и запоминаются для вашего профиля в этом браузере." : "Предпросмотр до перезагрузки. После входа настройки запоминаются для вашего профиля."}</p>
    {([{ key: "blur", title: "Сила размытия стекла (Blur)", min: 8, max: 40, unit: "px" },
      { key: "shine", title: "Яркость стеклянных бликов и граней", min: 20, max: 100, unit: "%" }] as const).map(({ key, title, min, max, unit }) =>
      <label key={key} className="studio-range"><span>{title}</span><output>{engine[key]} {unit}</output>
        <input type="range" className="liquid-range" style={{ "--fill": `${100 * (engine[key] - min) / (max-min)}%` } as CSSProperties} aria-label={title} min={min} max={max} value={engine[key]} aria-valuetext={`${engine[key]} ${unit}`} onChange={e => tune({ [key]: e.currentTarget.valueAsNumber })} />
      </label>)}
    <h3>Режим анимаций</h3>
    <Segmented presentation="grid" className="studio-options" ariaLabel="Режим анимаций" options={ANIMATIONS} value={engine.motion} onChange={motion => tune({ motion })} />
    <h3>Живые обои</h3>
    <Segmented presentation="grid" className="studio-options" ariaLabel="Живые обои" options={WALLPAPERS} value={engine.wallpaper} onChange={wallpaper => tune({ wallpaper })} />
    <button className="btn btn-sm" type="button" onClick={() => tune(DEFAULT_ENGINE)}><RotateCcw aria-hidden="true" /> Вернуть по умолчанию</button>
  </section>;
}
