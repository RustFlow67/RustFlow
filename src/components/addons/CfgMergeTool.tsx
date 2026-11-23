"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { GRAPHICS_PROFILES, graphicsCommands, type GraphicsProfileId } from "@/lib/graphics-profiles";
import { mergeGraphicsCfg } from "@/lib/cfg-merge";
import Panel from "./Panel";
import styles from "./addons.module.css";

/** Browsers cannot write arbitrary local paths; export both files for review. */
export default function CfgMergeTool() {
  const [original, setOriginal] = useState<string | null>(null);
  const [mode, setMode] = useState<GraphicsProfileId>("competitive");
  const [message, setMessage] = useState("");
  function download(name: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  async function choose(file?: File) {
    setOriginal(null); setMessage("");
    if (!file) return;
    if (file.size > 1024 * 1024) { setMessage("Файл больше 1 МБ. Изменения не подготовлены."); return; }
    try {
      const content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
      if (content.includes("\0")) throw new Error();
      setOriginal(content);
    } catch { setMessage("Нужен текстовый client.cfg в UTF-8 без нулевых байтов."); }
  }
  return <Panel id="cfg-safety" kicker="Безопасная конфигурация" title="Обновить только графику" icon={<ShieldCheck />}
    description="Выберите существующий client.cfg. Браузер не меняет файлы игры: сначала скачайте резервную копию, затем проверьте и сохраните результат вручную при закрытом Rust.">
    <label className={styles.label}>Исходный client.cfg<input type="file" accept=".cfg,text/plain" className={styles.input} onChange={e => void choose(e.target.files?.[0])} /></label>
    <label className={styles.label}>Профиль<select className={styles.input} value={mode} onChange={e => setMode(e.target.value as GraphicsProfileId)}>
      {GRAPHICS_PROFILES.map(p => <option value={p.id} key={p.id}>{p.title}</option>)}
    </select></label>
    <p className={styles.muted}>Бинды, FOV, звук, интерфейс, сеть, лимит FPS и gc.buffer не изменяются. Приложение не гарантирует повышение FPS.</p>
    {message && <p role="alert" className={styles.alert}>{message}</p>}
    {original !== null && <>
      <div className={styles.actions}><button type="button" className={styles.action} onClick={() => download("client.cfg.bak", original)}>Скачать резервную копию</button>
        <button type="button" className={`${styles.action} ${styles.primary}`} onClick={() => download("client.cfg", mergeGraphicsCfg(original, graphicsCommands(mode, 16)))}>Скачать объединённый client.cfg</button></div>
      <details className={styles.dataDetails}><summary>Предпросмотр результата</summary><pre className={styles.inset} style={{ overflow: "auto", maxHeight: "18rem", whiteSpace: "pre" }}>{mergeGraphicsCfg(original, graphicsCommands(mode, 16))}</pre></details>
    </>}
  </Panel>;
}
