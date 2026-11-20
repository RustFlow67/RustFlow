"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { Copy, Pause, Play, Terminal } from "lucide-react";
import { useState, type AnimationEvent, type CSSProperties } from "react";
import { copyText } from "@/lib/addons/share-text";
import { useAmbientPlayback } from "./fx/useAmbientPlayback";
import { useToast } from "./ui/Toast";

// Illustrative F1 replies, not execution, a save to disk or a live connection to Rust.
const LINES = [
  ["gc.buffer 4096", "Heap buffer set to 4096 MB", "Запас памяти между очистками для ПК с 32+ ГБ ОЗУ."],
  ["graphics.vm_fov_scale 0", "Viewmodel FOV scaling: off", "Не масштабирует модель оружия по FOV."],
  ["effects.maxgibs -1", "effects.maxgibs: -1", "Лимит обломков; проверьте эффект в своём патче."],
  ["graphics.shadowdistance 50", "Shadow distance set to 50", "Ограничивает дальность отрисовки теней."],
  ["fps.limit 0", "Frame rate cap: off", "Снимает ограничение частоты кадров."],
  ["physics.steps 60", "Physics steps: 60", "Частота шагов физики; сравните нагрузку на CPU."],
  [
    "hitnotify.notification_level 2",
    "Hit notification level: 2",
    "Выбирает уровень уведомлений о попадании.",
  ],
  ["client.lookatradius 0.2", "Look radius set to 0.2", "Радиус поиска объектов рядом с прицелом."],
  ["graphics.lodbias 1.5", "LOD bias set to 1.5", "Сдвигает выбор уровня детализации объектов."],
  ["terrain.quality 40", "Terrain quality: 40", "Уровень детализации рельефа."],
  ["water.quality 0", "Water quality: 0", "Базовое качество воды для лёгкой графики."],
  ["writecfg", "OK: saved to cfg/client.cfg", "Сохраняет конфигурацию клиента в игре."],
  ["global.perf 1", "Performance overlay: FPS", "Показывает счётчик FPS в клиенте."],
] as const;
const ROWS = 5;
type Phase = "writing" | "verified" | "sliding";

export default function HomeConsole() {
  const { ref, playback } = useAmbientPlayback<HTMLElement>();
  const { toast } = useToast();
  const [cursor, setCursor] = useState({ step: 0, phase: "writing" as Phase });
  const [held, setHeld] = useState(false);
  const phase = playback === "still" ? "verified" : cursor.phase;

  // The actual type/response/shift animations advance the reel. Pausing a
  // glyph halfway through never leaves an independent JS timeout running.
  function advance(e: AnimationEvent<HTMLOListElement>) {
    const name = e.animationName;
    if (playback === "still" || !["terminal-type", "terminal-confirm", "terminal-shift"].includes(name))
      return;
    setCursor((current) => {
      if (current.phase === "writing" && name === "terminal-type") return { ...current, phase: "verified" };
      if (current.phase === "verified" && name === "terminal-confirm")
        return { ...current, phase: "sliding" };
      if (current.phase === "sliding" && name === "terminal-shift")
        return { step: current.step + 1, phase: "writing" };
      return current;
    });
  }
  async function copy(command: string) {
    if (await copyText(command))
      toast({ title: "Команда скопирована", description: command, tone: "success" });
    else
      toast({
        title: "Не удалось скопировать команду",
        description: `Скопируйте вручную: ${command}`,
        tone: "error",
      });
  }

  return (
    <LiquidGlass as="section"
      ref={ref}
      className="glass liquid-glass-card rf-terminal"
      aria-label="Rust F1 Console · client.cfg"
      data-playback={playback}
      data-phase={phase}
      data-held={held || undefined}
    >
      <header className="terminal-bar">
        <Terminal size={18} aria-hidden="true" />
        <span className="terminal-file">
          <strong>Rust F1 Console</strong>
          <small>client.cfg</small>
        </span>
        <span className="terminal-status" aria-hidden="true">
          <i />
          {phase === "writing" ? "Writing..." : "Verified"}
        </span>
      </header>
      <div className="terminal-window">
        <ol className="terminal-lines" onAnimationEnd={advance} aria-label="Примеры команд" aria-live="off">
          {Array.from({ length: ROWS + Number(phase === "sliding") }, (_, i) => {
            const [command, reply, note] = LINES[(cursor.step + i) % LINES.length];
            const last = i === ROWS - 1,
              writing = last && phase === "writing";
            return (
              <li
                key={cursor.step + i}
                data-last={last || undefined}
                data-writing={writing || undefined}
                data-next={i === ROWS || undefined}
                inert={i === ROWS}
                title={note}
                style={
                  { "--chars": command.length, "--type-time": `${command.length * 52}ms` } as CSSProperties
                }
              >
                <div className="terminal-command">
                  <span className="terminal-prompt" aria-hidden="true">
                    ›
                  </span>
                  <span className="terminal-code">
                    <code className="terminal-type">
                      <span>{command}</span>
                    </code>
                    {writing && (
                      <span className="terminal-caret" aria-hidden="true">
                        ▏
                      </span>
                    )}
                  </span>
                </div>
                <LiquidGlass as="button" shape="pill"
                  type="button"
                  className="lg-surface terminal-copy"
                  aria-label={`Скопировать команду ${command}`}
                  title="Скопировать команду"
                  onClick={() => void copy(command)}
                >
                  <Copy size={13} aria-hidden="true" />
                </LiquidGlass>
                <p className="terminal-reply" aria-hidden={writing || undefined}>
                  <span aria-hidden="true">→</span> {reply}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
      {/* Keep the full command reference stable for screen-reader browse mode;
          the visible list separately exposes just the currently usable controls. */}
      <ol className="sr-only" aria-label="Все команды и пояснения">
        {LINES.map(([command, , note]) => (
          <li key={command}>
            <code>{command}</code> — {note}
          </li>
        ))}
      </ol>
      <footer className="terminal-footer">
        <span>Демо F1 · без записи в игру</span>
        {playback !== "still" && (
          <button
            type="button"
            className="terminal-transport"
            aria-label="Пауза вывода команд"
            aria-pressed={held}
            title={held ? "Продолжить вывод" : "Приостановить вывод"}
            onClick={() => setHeld((v) => !v)}
          >
            {held ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
          </button>
        )}
      </footer>
    </LiquidGlass>
  );
}
