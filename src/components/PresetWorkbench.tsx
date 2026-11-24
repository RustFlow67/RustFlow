"use client";

import { useEffect, useState } from "react";
import GraphicsPicker from "./GraphicsPicker";
import { useDownload } from "./fx/useDownload";
import { GRAPHICS_PROFILES, getGraphicsProfile, profileCfg, type GraphicsProfileId } from "@/lib/graphics-profiles";
import { mergeGraphicsCfg } from "@/lib/cfg-merge";

export default function PresetWorkbench() {
  const [mode, setMode] = useState<GraphicsProfileId>("competitive");
  const [draw, setDraw] = useState(1200);
  const [shadow, setShadow] = useState(50);
  const [original, setOriginal] = useState("");
  const download = useDownload();
  useEffect(() => { window.dispatchEvent(new CustomEvent("shift:scene-config", { detail: { profile: GRAPHICS_PROFILES.findIndex(p => p.id === mode) + draw / 2500 + shadow / 400 } })); }, [mode, draw, shadow]);
  const generated = mergeGraphicsCfg(profileCfg(mode, 16, original), { "graphics.drawdistance": draw, "graphics.shadowdistance": shadow });
  function select(id: GraphicsProfileId) {
    const preset = getGraphicsProfile(id) ?? GRAPHICS_PROFILES[0];
    setMode(id); setDraw(preset.draw); setShadow([50, 100, 300, 400][preset.shadows]);
  }
  return <section className="config-workbench" aria-labelledby="config-workbench-title">
    <div className="config-heading"><div><span className="tech-label">02 // CONFIG WORKBENCH</span><h2 id="config-workbench-title">Графика в деталях<span>.</span></h2></div><span className="tech-label">CLIENT.CFG / LOCAL</span></div>
    <p>Выберите профиль и отрегулируйте графику. Доступность команд зависит от установленной версии Rust; проверьте их в F1. Ползунки не меняют расчёт FPS карточек ниже.</p>
    <GraphicsPicker value={mode} onChange={select} label="Профиль редактора конфигурации" />
    <div className="config-lab">
    <div className="config-visual" aria-label={`Визуализация дальности прорисовки: ${draw}`}>
      <div className="config-visual-top"><span>VIEW DISTANCE / SIMULATION</span><span>{draw} M</span></div>
      <svg viewBox="0 0 600 230" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs><pattern id="lab-dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#fff" opacity=".3" /></pattern></defs>
        <rect width="600" height="230" fill="url(#lab-dots)" />
        <path d="M0 165 L90 99 L160 148 L260 57 L355 150 L450 78 L600 156 L600 230 L0 230 Z" fill="#1a1a1c" stroke="#777" />
        <path d="M0 192 L120 135 L205 181 L310 115 L414 180 L515 128 L600 164 L600 230 L0 230 Z" fill="#303034" stroke="#aaa" />
        <line x1={80 + (draw - 1200) / 1300 * 430} x2={80 + (draw - 1200) / 1300 * 430} y1="25" y2="218" stroke="#f2f0eb" strokeDasharray="4 5" />
        <circle cx={80 + (draw - 1200) / 1300 * 430} cy="25" r="4" fill="#f2f0eb" />
      </svg>
      <div className="config-visual-bottom"><span>1200 M</span><span>2500 M</span></div>
    </div>
    <div className="config-controls"><span className="tech-label">01 // GRAPHICS PARAMETERS</span>
    <div className="config-sliders">
      <label><span>ДАЛЬНОСТЬ ПРОРИСОВКИ <strong>{draw}</strong></span><input type="range" min="1200" max="2500" step="50" value={draw} onChange={e => setDraw(Number(e.target.value))} /></label>
      <label><span>ДИСТАНЦИЯ ТЕНЕЙ <strong>{shadow}</strong></span><input type="range" min="50" max="400" step="10" value={shadow} onChange={e => setShadow(Number(e.target.value))} /></label>
    </div>
    <p className="config-impact">{draw <= 1500 && shadow <= 100 ? "Меньшая дальность и тени могут снизить графическую нагрузку." : "Большая дальность или тени могут повысить графическую нагрузку."} Влияние на FPS зависит от сцены и ПК — проверьте замером.</p>
    </div></div>
    <details className="config-details"><summary>Добавить существующий client.cfg и сохранить остальные строки</summary><p>Вставьте содержимое файла. SHIFT изменит только графические команды, не трогая бинды, FOV, чувствительность, звук, HUD и сеть. Сначала сохраните независимую копию.</p><textarea aria-label="Содержимое исходного client.cfg" value={original} onChange={e => setOriginal(e.target.value)} spellCheck={false} placeholder={'bind q forward;sprint\ngraphics.fov "90"'} /></details>
    <details className="config-details"><summary>Предпросмотр client.cfg</summary><pre>{generated}</pre></details>
    <div className="config-actions"><button type="button" className="shift-outline-button" onClick={() => download(new Blob([generated], { type: "text/plain;charset=utf-8" }), original ? "client.cfg" : "shift-graphics-fragment.cfg")}>Скачать {original ? "client.cfg" : "фрагмент client.cfg"} <span>↗</span></button><span>ФАЙЛ НЕ ПРИМЕНЯЕТСЯ АВТОМАТИЧЕСКИ</span></div>
  </section>;
}
