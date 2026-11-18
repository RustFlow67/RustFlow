"use client";

import { Terminal } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { useMotion } from "@/lib/motion";

const LINES = [
  ["gc.buffer 4096", "Буфер сборщика мусора для ПК с 32+ ГБ ОЗУ."],
  ["graphics.vm_fov_scale 0", "Не масштабирует модель оружия по FOV."],
  ["effects.maxgibs -1", "Лимит обломков; проверьте эффект в своём патче."],
  ["graphics.shadowdistance 50", "Ограничивает дальность отрисовки теней."],
  ["fps.limit 0", "Снимает ограничение частоты кадров."],
  ["physics.steps 60", "Частота шагов физики; сравните нагрузку на CPU."],
  ["hitnotify.notification_level 2", "Выбирает уровень уведомлений о попадании."],
  ["client.lookatradius 0.2", "Радиус поиска объектов рядом с прицелом."],
  ["graphics.lodbias 1.5", "Сдвигает выбор уровня детализации объектов."],
  ["terrain.quality 40", "Уровень детализации рельефа."],
  ["water.quality 0", "Базовое качество воды для лёгкой графики."],
  ["global.perf 1", "Показывает счётчик FPS в клиенте."],
] as const;

const ROWS = 5;
const CHAR_MS = 40;
const REST_MS = 1200;
const SHIFT_MS = 280;
const lineAt = (index: number) => LINES[index % LINES.length];

export default function HomeConsole() {
  const { reduced } = useMotion();
  const [step, setStep] = useState(0);
  const [sliding, setSliding] = useState(false);
  const live = lineAt(step + ROWS - 1);

  useEffect(() => {
    if (reduced || document.documentElement.hasAttribute("data-lite")) return;
    let timer = 0;
    let start = 0;
    let left = sliding ? SHIFT_MS : live[0].length * CHAR_MS + REST_MS;
    function resume() {
      if (!document.hidden && !timer) {
        start = performance.now();
        timer = window.setTimeout(() => {
          timer = 0;
          if (sliding) { setStep((current) => current + 1); setSliding(false); }
          else setSliding(true);
        }, left);
      }
    }
    function visibility() {
      if (!document.hidden) resume();
      else if (timer) {
        window.clearTimeout(timer);
        timer = 0;
        left = Math.max(0, left - (performance.now() - start));
      }
    }
    resume();
    document.addEventListener("visibilitychange", visibility);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [step, sliding, live, reduced]);

  return <section className="glass liquid-glass-card rf-terminal" aria-label="Rust F1 Console · client.cfg">
    <div className="terminal-bar rf-page-content"><Terminal size={17} aria-hidden="true" /><span>Rust F1 Console <span className="text-ink-3">·</span> client.cfg</span><span className="terminal-indicator" aria-hidden="true" /></div>
    <div className="terminal-window rf-page-content" aria-hidden="true">
      <ol className="terminal-lines" data-slide={sliding && !reduced ? "" : undefined}
        style={{ "--terminal-shift": `${SHIFT_MS}ms` } as CSSProperties}>
        {Array.from({ length: ROWS + (sliding && !reduced ? 1 : 0) }, (_, i) => {
          const [command, note] = lineAt(step + i);
          const typing = i === ROWS - 1 && !sliding && !reduced;
          return <li key={step + i} data-typing={typing ? "" : undefined} data-next={i === ROWS ? "" : undefined}
            style={{ "--chars": command.length, "--type-time": `${command.length * CHAR_MS}ms` } as CSSProperties}>
            <div className="terminal-command"><span className="terminal-prompt">›</span><code className="terminal-type">{command}</code>
              {typing && <span className="terminal-caret">▋</span>}</div>
            <p>{note}</p>
          </li>;
        })}
      </ol>
    </div>
    {/* The carousel is decorative to assistive tech; expose the complete, stable list. */}
    <ol className="sr-only">{LINES.map(([command, note]) => <li key={command}><code>{command}</code> — {note}</li>)}</ol>
  </section>;
}
