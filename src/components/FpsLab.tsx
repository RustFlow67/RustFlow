"use client";
import LiquidGlass from "@/components/LiquidGlass";
import { useDownload } from "./fx/useDownload";

import {
  Activity,
  ChevronDown,
  Dices,
  Download,
  Flame,
  Gauge,
  RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useToast } from "@/components/ui/Toast";
import { fpsEngine, useFpsStats } from "@/lib/fps/engine";
import {
  LAB_DEFAULTS,
  LAB_LIMITS,
  randomizeLab,
  resetLab,
  setLab,
  useLab,
  type LabSettings,
} from "@/lib/fps/lab";
import { getResolvedTheme } from "@/lib/theme";

const OPEN_KEY = "rustflow:lab-open";

function readOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function statusColor(avg: number): string {
  if (avg >= 55) return "var(--ok)";
  if (avg >= 30) return "var(--warn)";
  return "var(--danger)";
}

const SLIDERS: {
  key: keyof Omit<LabSettings, "stress">;
  label: string;
  unit: string;
  hint: string;
}[] = [
  { key: "blur", label: "Blur стекла", unit: "px", hint: "Радиус размытия стеклянных поверхностей" },
  { key: "layers", label: "Слои стекла", unit: "", hint: "Дополнительные преломляющие слои фона" },
  { key: "particles", label: "Частицы", unit: "", hint: "Плотность поля частиц на canvas" },
  { key: "glow", label: "Glow / bloom", unit: "×", hint: "Интенсивность свечений и ореолов" },
  { key: "speed", label: "Скорость анимаций", unit: "×", hint: "Темп фоновых анимаций и частиц" },
  { key: "refraction", label: "Преломление", unit: "", hint: "Сила SVG-линзы Liquid Glass" },
  { key: "quality", label: "Качество / DPR", unit: "×", hint: "Разрешение canvas относительно экрана" },
];



function LabSlider({
  k,
  label,
  unit,
  hint,
  value,
}: {
  k: keyof Omit<LabSettings, "stress">;
  label: string;
  unit: string;
  hint: string;
  value: number;
}) {
  const lim = LAB_LIMITS[k];
  const fill = ((value - lim.min) / (lim.max - lim.min)) * 100;
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between gap-2">
        <label htmlFor={`lab-${k}`} className="text-[12px] font-semibold text-ink-2" title={hint}>
          {label}
        </label>
        <span className="text-[12px] font-bold tabular-nums text-ink">
          {value}
          {unit}
        </span>
      </div>
      <input
        id={`lab-${k}`}
        type="range"
        className="liquid-range"
        min={lim.min}
        max={lim.max}
        step={lim.step}
        value={value}
        aria-label={`${label} (${hint})`}
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
        onChange={(e) => setLab({ [k]: Number(e.target.value), stress: false })}
      />
    </div>
  );
}

/**
 * FPS-лаборатория: живой rAF-счётчик рендера страницы (сейчас / avg / 1% low /
 * frametime / кадры) + canvas-график с порогами + 8 живых контролов нагрузки.
 * График рисуется в общем цикле движка — без собственного rAF.
 */
export default function FpsLab() {
  const stats = useFpsStats();
  const { settings } = useLab();
  const download=useDownload();
  const { toast } = useToast();
  const [open, setOpen] = useState<boolean>(() => readOpen());
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const graphRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  /* График FPS в общем rAF-цикле движка (пауза при hidden — внутри движка). */
  useEffect(() => {
    const canvas = graphRef.current;
    if (!canvas || !open) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const ro = new ResizeObserver(() => setup());
    ro.observe(canvas);
    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    function setup() {
      const rect = canvas!.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const q = Math.min(2, Math.max(0.5, Number(getComputedStyle(document.documentElement).getPropertyValue("--lab-quality")) || 1));
      const dpr = Math.min(2.5, (window.devicePixelRatio || 1) * q);
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
    }
    setup();

    const root = document.documentElement;
    const palette = () => { const css = getComputedStyle(root); return {
      accent: css.getPropertyValue("--theme-accent").trim(), tip: css.getPropertyValue("--theme-tip").trim(),
      glow: css.getPropertyValue("--theme-glow").trim(), label: css.getPropertyValue("--ink-3").trim(),
    }; };
    let colors = palette();
    const observer = new MutationObserver(() => { colors = palette(); });
    observer.observe(root, { attributes: true, attributeFilter: ["data-material"] });
    const draw = () => {
      if (!visible || w < 2) return;
      const light = getResolvedTheme() === "light";
      const dpr = canvas.width / w;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const max = 130;
      const yOf = (fps: number) => h - 6 - (Math.min(max, Math.max(0, fps)) / max) * (h - 14);

      // Пороги 30 / 60 / 120
      ctx.font = "9px 'Inter Variable', 'Segoe UI', sans-serif";
      ctx.textBaseline = "middle";
      const grid = light ? "rgb(47 32 21 / 0.16)" : "rgb(255 255 255 / 0.14)";
      const gridTx = colors.label;
      for (const line of [30, 60, 120]) {
        const y = yOf(line);
        ctx.strokeStyle = line === 60 ? colors.glow : grid;
        ctx.lineWidth = line === 60 ? 1.4 : 1;
        ctx.setLineDash(line === 60 ? [] : [4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = gridTx;
        ctx.fillText(String(line), 4, y - 8);
      }

      const samples = fpsEngine.getSamples();
      const n = samples.length;
      if (n < 2) return;
      const step = w / 179;

      // Заливка под кривой
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, colors.glow); grad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < n; i += 1) {
        ctx.lineTo(i * step, yOf(samples[i]));
      }
      ctx.lineTo((n - 1) * step, h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Линия
      ctx.beginPath();
      for (let i = 0; i < n; i += 1) {
        const x = i * step;
        const y = yOf(samples[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = "round";
      ctx.stroke();

      // Точка текущего значения
      const lx = (n - 1) * step;
      const ly = yOf(samples[n - 1]);
      ctx.beginPath();
      ctx.arc(lx - 1, ly, 3, 0, Math.PI * 2);
      ctx.fillStyle = colors.tip;
      ctx.shadowBlur = 8;
      ctx.shadowColor = colors.glow;
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const unsub = fpsEngine.onTick(draw);
    return () => {
      unsub(); observer.disconnect();
      ro.disconnect();
      io.disconnect();
    };
  }, [open]);

  function exportSnapshot() {
    const s = fpsEngine.getStats();
    const payload = {
      app: "SHIFT FPS Lab",
      exportedAt: new Date().toISOString(),
      path: typeof window !== "undefined" ? window.location.pathname : "/",
      theme: getResolvedTheme(),
      settings,
      defaults: LAB_DEFAULTS,
      stats: {
        now: s.now,
        avg: s.avg,
        low1: s.low1,
        frametimeMs: s.frametime,
        frames: s.frames,
      },
      note: "FPS рендера страницы в браузере, не FPS игры Rust.",
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      if (!download(blob,`rustflow-fps-lab-${Date.now()}.json`)) return;
      toast({ title: "Снапшот лаборатории сохранён", description: `avg ${s.avg} · 1% low ${s.low1} · ${s.frametime} мс`, tone: "success" });
    } catch {
      toast({ title: "Не удалось сохранить снапшот", tone: "error" });
    }
  }

  if (!mounted) return null;

  /* ---------- Свёрнутое состояние: живой мини-бейдж ---------- */
  if (!open) {
    return (
      <div className="fps-lab-fab">
        <LiquidGlass as="button"
          type="button"
          onClick={() => setOpen(true)}
          className="glass glass-blur group flex h-12 items-center gap-2.5 rounded-full py-1.5 pl-2.5 pr-4"
          aria-label={`Открыть FPS-лабораторию. Текущий FPS страницы: ${stats.now}`}
          title="FPS-лаборатория: счётчик рендера страницы и контролы нагрузки"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-black/30">
            <Activity className="h-4 w-4 text-accent-hi" aria-hidden="true" />
          </span>
          <span className="text-left leading-none">
            <span className="block text-[15px] font-extrabold tabular-nums" style={{ color: statusColor(stats.avg) }}>
              {stats.avg}
              <span className="ml-1 text-[10.5px] font-semibold text-ink-3">FPS</span>
            </span>
            <span className="mt-0.5 block text-[10px] text-ink-3">FPS-лаб · открыть</span>
          </span>
        </LiquidGlass>
      </div>
    );
  }

  /* ---------- Полная панель ---------- */
  return (
    <section className="fps-lab" aria-label="FPS-лаборатория рендера страницы">
      <LiquidGlass className="glass glass-blur max-h-[calc(100dvh-120px)] overflow-y-auto p-4" style={{ "--r": "24px" } as React.CSSProperties}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[14px] font-extrabold tracking-tight">
            <Gauge className="h-4 w-4 text-accent-hi" aria-hidden="true" />
            FPS-лаборатория
            <span
              className="dot dot-pulse"
              style={{ color: statusColor(stats.avg), background: statusColor(stats.avg) }}
              aria-hidden="true"
            />
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-full bg-black/20 text-ink-2 hover:text-ink"
            aria-label="Свернуть FPS-лабораторию"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-ink-3">
          FPS <strong>рендера страницы</strong>, не игры. Игровой FPS — в оценщике сборки и журнале.
        </p>

        {/* Живые цифры */}
        <div className="mt-3 grid grid-cols-5 gap-1.5 text-center" role="status" aria-label={`Сейчас ${stats.now} FPS, средний ${stats.avg}, 1 процент low ${stats.low1}`}>
          {[
            { v: String(stats.now), l: "сейчас" },
            { v: String(stats.avg), l: "avg" },
            { v: String(stats.low1), l: "1% low" },
            { v: `${stats.frametime}`, l: "мс" },
            { v: stats.frames > 9999 ? `${(stats.frames / 1000).toFixed(1)}k` : String(stats.frames), l: "кадры" },
          ].map((c) => (
            <LiquidGlass key={c.l} className="well px-1 py-1.5">
              <span className="block text-[14px] font-extrabold tabular-nums" style={c.l === "avg" ? { color: statusColor(stats.avg) } : undefined}>
                {c.v}
              </span>
              <span className="block text-[9.5px] text-ink-3">{c.l}</span>
            </LiquidGlass>
          ))}
        </div>

        {/* График */}
        <LiquidGlass className="well mt-2.5 overflow-hidden p-1.5">
          <canvas
            ref={graphRef}
            className="block h-[86px] w-full"
            role="img"
            aria-label={`График FPS страницы за последние секунды. Средний ${stats.avg}, 1% low ${stats.low1}.`}
          />
        </LiquidGlass>

        {/* 7 слайдеров нагрузки */}
        <div className="mt-3 space-y-2">
          {SLIDERS.map((s) => (
            <LabSlider key={s.key} k={s.key} label={s.label} unit={s.unit} hint={s.hint} value={settings[s.key]} />
          ))}
        </div>

        {/* Действия */}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            aria-pressed={settings.stress}
            onClick={() => {
              setLab({ stress: !settings.stress });
              toast({
                title: settings.stress ? "Стресс-тест выключен" : "Стресс-тест включён",
                description: settings.stress ? "Нагрузка возвращена к вашим настройкам." : "Вся нагрузка на максимуме — смотрите на FPS.",
                tone: settings.stress ? "info" : "warning",
              });
            }}
            className={`flex h-10 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-bold transition-transform ${
              settings.stress ? "btn-danger" : "btn-primary"
            }`}
          >
            <Flame className="h-4 w-4" aria-hidden="true" />
            {settings.stress ? "Стоп стресс" : "Стресс-тест"}
          </button>
          <button
            type="button"
            onClick={exportSnapshot}
            className="btn btn-sm !h-10 w-full !text-[12.5px]"
          >
            <Download aria-hidden="true" />
            Снапшот JSON
          </button>
          <button
            type="button"
            onClick={() => {
              resetLab();
              toast({ title: "Настройки лаборатории сброшены", tone: "info" });
            }}
            className="btn btn-sm !h-9 w-full !text-[12px]"
          >
            <RotateCcw aria-hidden="true" />
            Сброс
          </button>
          <button
            type="button"
            onClick={() => {
              randomizeLab();
              toast({ title: "Случайная конфигурация применена", description: "Смотрите, как реагирует FPS.", tone: "info" });
            }}
            className="btn btn-sm !h-9 w-full !text-[12px]"
          >
            <Dices aria-hidden="true" />
            Рандом
          </button>
        </div>
      </LiquidGlass>
    </section>
  );
}
