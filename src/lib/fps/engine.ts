import { useSyncExternalStore } from "react";

/**
 * Единый rAF-движок страницы: FPS-мониторинг + тики для canvas-слоёв
 * (частицы, график FPS, cursor-glow). Один цикл на всё приложение,
 * автоматическая пауза при скрытой вкладке, защита от дублей слушателей.
 */

export interface FpsStats {
  /** Мгновенный FPS последнего кадра. */
  now: number;
  /** Средний FPS за окно 240 кадров. */
  avg: number;
  /** 1% low — средний FPS худшего 1% кадров окна. */
  low1: number;
  /** Среднее время кадра, мс. */
  frametime: number;
  /** Всего отрисованных кадров с запуска. */
  frames: number;
}

export type TickListener = (dtMs: number, nowMs: number) => void;
export type StatsListener = () => void;

const WINDOW = 240;
const GRAPH_LEN = 180;
const STATS_INTERVAL = 500;

const EMPTY_STATS: FpsStats = { now: 0, avg: 0, low1: 0, frametime: 0, frames: 0 };

class FpsEngine {
  private raf = 0;
  private last = 0;
  private running = false;
  private dts: number[] = [];
  private samples: number[] = [];
  private frames = 0;
  private ticks = new Set<TickListener>();
  private subs = new Set<StatsListener>();
  private stats: FpsStats = { ...EMPTY_STATS };
  private lastPush = 0;

  getStats(): FpsStats {
    return this.stats;
  }

  /** Последние значения мгновенного FPS для графика (старые → новые). */
  getSamples(): number[] {
    return this.samples;
  }

  /** Покадровый тик для canvas (частицы, график, свечение курсора). */
  onTick(fn: TickListener): () => void {
    this.ticks.add(fn);
    this.ensure();
    return () => {
      this.ticks.delete(fn);
    };
  }

  subscribe(fn: StatsListener): () => void {
    this.subs.add(fn);
    this.ensure();
    return () => {
      this.subs.delete(fn);
    };
  }

  private ensure() {
    if (typeof window === "undefined" || this.running) return;
    this.running = true;
    this.last = performance.now();
    document.addEventListener("visibilitychange", this.onVisibility, { passive: true });
    this.raf = requestAnimationFrame(this.loop);
  }

  private onVisibility = () => {
    if (typeof document === "undefined") return;
    if (document.hidden) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (this.running && !this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  };

  private loop = (now: number) => {
    if (!this.running) return;
    if (typeof document !== "undefined" && document.hidden) {
      this.raf = 0;
      return;
    }
    const dt = Math.min(120, Math.max(0.05, now - this.last));
    this.last = now;
    this.frames += 1;
    this.dts.push(dt);
    if (this.dts.length > WINDOW) this.dts.shift();
    const inst = Math.min(300, 1000 / dt);
    this.samples.push(inst);
    if (this.samples.length > GRAPH_LEN) this.samples.shift();

    this.ticks.forEach((fn) => {
      try {
        fn(dt, now);
      } catch {
        /* один слой не должен ронять цикл */
      }
    });

    if (now - this.lastPush >= STATS_INTERVAL) {
      this.lastPush = now;
      this.compute();
      this.subs.forEach((fn) => {
        try {
          fn();
        } catch {
          /* noop */
        }
      });
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private compute() {
    const n = this.dts.length;
    if (n === 0) return;
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += this.dts[i];
    const avgDt = sum / n;
    const sorted = [...this.dts].sort((a, b) => b - a);
    const k = Math.max(1, Math.floor(n * 0.01));
    let worst = 0;
    for (let i = 0; i < k; i += 1) worst += sorted[i];
    worst /= k;
    this.stats = {
      now: Math.round(Math.min(300, 1000 / this.dts[n - 1])),
      avg: Math.round(Math.min(300, 1000 / avgDt)),
      low1: Math.round(Math.min(300, 1000 / worst)),
      frametime: Math.round(avgDt * 10) / 10,
      frames: this.frames,
    };
  }
}

export const fpsEngine = new FpsEngine();

const subscribeStats = (fn: () => void) => fpsEngine.subscribe(fn);
const getStatsSnapshot = () => fpsEngine.getStats();

/** Реактивная подписка на FPS-статистику (обновление 2 раза в секунду). */
export function useFpsStats(): FpsStats {
  return useSyncExternalStore(subscribeStats, getStatsSnapshot, () => EMPTY_STATS);
}
