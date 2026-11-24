"use client";

import { AnimatedNumber } from "@/components/fx/AnimatedNumber";
import { Radar } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { presetBuildInput } from "@/lib/addons/build-tools";
import { evaluateBuild10, type BreakdownKey, type BuildEvaluation, type BuildInput, type UserBuild } from "@/lib/models/build";
import { formatBuildResolution, getResolutionSize } from "@/lib/models/build-resolution";
import type { PresetView } from "@/lib/models/preset-projection";
import Panel from "./Panel";
import styles from "./addons.module.css";

export type RadarBuild = { id: string; input: BuildInput; label?: string; evaluation?: BuildEvaluation };

const AXES: { key: BreakdownKey; label: string; short?: string }[] = [
  { key: "cpuSingle", label: "CPU" },
  { key: "ramLatency", label: "ОЗУ", short: "RAM" },
  { key: "ssdRandom", label: "SSD / HDD", short: "SSD" },
  { key: "gpuTier", label: "GPU" },
  { key: "vramHeadroom", label: "VRAM" },
];

function axisTip(axis: BreakdownKey, build: BuildInput, evaluation: BuildEvaluation): string {
  switch (axis) {
    case "cpuSingle": return evaluation.bottleneck === "cpu" ? "Проверьте дальность" : "Сравните 1% low";
    case "ramLatency": return `${build.ramGb} ГБ · ${build.ramMhz} МТ/с · CL${build.ramCl}`;
    case "ssdRandom": return build.storage === "nvme" ? "NVMe уже используется" : "Перенесите игру на NVMe";
    case "gpuTier": {
      const size = getResolutionSize(build);
      return size ? `${size.width}×${size.height} · сравните пресеты` : "Сравните пресеты";
    }
    case "vramHeadroom": return `${evaluation.vramGb} ГБ · подберите текстуры`;
  }
}
const PALETTES = [styles.series1, styles.series2, styles.series3, styles.series4];
const DASHES = [undefined, "7 4", "2 4", "10 4 2 4"];
const center = { x: 170, y: 138 };
const radius = 92;

function point(i: number, r: number) {
  const angle = Math.PI * 2 * i / AXES.length - Math.PI / 2;
  return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r };
}
const polygon = (scale: (axis: BreakdownKey) => number) => AXES.map(({ key }, i) => {
  const { x, y } = point(i, radius * scale(key));
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}).join(" ");

export default function BuildRadar({ builds, compact = false }: { builds: readonly RadarBuild[]; compact?: boolean }) {
  const reduced = useReducedMotion();
  const series = builds.slice(0, compact ? 1 : 4).flatMap(({ id, input, label, evaluation: calculated }) => {
    const evaluation = calculated ?? evaluateBuild10(input);
    return evaluation ? [{ id, title: label ?? input.name, input, evaluation }] : [];
  });
  if (!series.length) return <p className={styles.muted}>Пока нет сборок для радара.</p>;
  const value = (i: number, axis: BreakdownKey) => series[i].evaluation.breakdown.find((item) => item.key === axis)?.score ?? 0;

  return (
    <div className={compact ? styles.compactRadar : `${styles.chartGrid} ${styles.openRadar}`}>
      <svg className={styles.radarCanvas} viewBox={compact ? "0 7 340 302" : "0 0 340 248"}
        role={compact ? "group" : "img"} aria-label="Радар оценок: CPU, RAM, SSD, GPU и VRAM, от 0 до 10">
        <title>Радар оценки сборки</title>
        {[2, 4, 6, 8, 10].map((score) => <polygon key={score} className={styles.gridline} points={polygon(() => score / 10)} />)}
        {AXES.map(({ key, label, short }, i) => {
          const end = point(i, radius);
          const at = point(i, radius + 30);
          return <g key={key}>
            <line className={styles.gridline} x1={center.x} y1={center.y} x2={end.x} y2={end.y} />
            <text className={styles.chartText} x={at.x} y={at.y + 4} textAnchor="middle">{compact ? short ?? label : label}</text>
          </g>;
        })}
        {series.map((item, i) => <motion.polygon data-build-series="" key={item.id} className={`${styles.plot} ${PALETTES[i]}`}
          initial={false} animate={{ points: polygon((axis) => value(i, axis) / 10) }} transition={{ duration: reduced ? 0 : .65, ease: [0.22, 1, 0.36, 1] }} />)}
        {!compact && [2, 4, 6, 8, 10].map((score) => <text key={score} className={styles.chartTick} x={center.x + 5} y={center.y - radius * score / 10 + 3}>{score}</text>)}
        {compact && <>
          <text className={`${styles.chartTick} ${styles.radarGuide}`} x={center.x} y="266" textAnchor="middle">Точки: подсказки</text>
          {AXES.map(({ key, label, short }, i) => {
            const score = value(0, key);
            const at = point(i, radius * score / 10);
            const scoreLabel = `${short ?? label}: ${score.toFixed(1)} из 10`;
            const { input, evaluation } = series[0];
            const hint = axisTip(key, input, evaluation);
            const detail = evaluation.breakdown.find((item) => item.key === key)?.detail;
            const text = `${scoreLabel}. ${hint}.${detail ? ` ${detail}.` : ""}`;
            const position = { transform: `translate(${at.x}px, ${at.y}px)` };
            return <g key={key} className={styles.radarVertex} tabIndex={0} role="img" aria-label={text}>
              <title>{text}</title>
              <circle style={position} r="22" fill="transparent" />
              <circle className={styles.radarDot} style={position} r="5" />
              <g className={styles.radarHint} aria-hidden="true">
                <rect x="4" y="249" width="332" height="55" rx="7" />
                <text className={styles.chartText} x={center.x} y="271" textAnchor="middle">{scoreLabel}</text>
                <text className={styles.chartTick} x={center.x} y="294" textAnchor="middle">{hint}</text>
              </g>
            </g>;
          })}
        </>}
      </svg>
      {!compact && <div className={styles.spaced}>
        <ol aria-label="Сборки на радаре" className={styles.list}>
          {series.map(({ id, title, input, evaluation }, i) => (
            <li key={id} className={`${styles.inset} ${styles.spaced} ${PALETTES[i]}`}>
              <div className={styles.actions}>
                <svg width="27" height="10" aria-hidden="true"><line className={styles.swatch} x1="0" y1="5" x2="27" y2="5" strokeDasharray={DASHES[i]} /></svg>
                <strong>{i + 1}. {title || "Сборка"}</strong>
              </div>
              <span className={styles.muted}><AnimatedNumber value={evaluation.score10} digits={1} /> / 10 · {formatBuildResolution(input)}</span>
            </li>
          ))}
        </ol>
        <table className={styles.table}>
          <caption>Баллы по узлам (номера из легенды)</caption>
          <thead><tr><th scope="col">Узел</th>{series.map(({ id }, i) => <th scope="col" key={id}>№{i + 1}</th>)}</tr></thead>
          <tbody>{AXES.map(({ key, label }) => (
            <tr key={key}><th scope="row">{label}</th>{series.map(({ id }, i) => <td key={id}><AnimatedNumber value={value(i, key)} digits={1} /></td>)}</tr>
          ))}</tbody>
        </table>
      </div>}
    </div>
  );
}

export function PresetRadar({ presets, myBuild }: { presets: readonly PresetView[]; myBuild: UserBuild | null }) {
  const builds: RadarBuild[] = presets.map((preset) => ({ id: preset.id, input: { ...presetBuildInput(preset), ...preset.target }, label: preset.title }));
  if (myBuild) builds.unshift({ id: myBuild.id, input: myBuild.input, label: `Моя: ${myBuild.input.name}` });
  return <div className={styles.stack}>
    <Panel id="radar" title="Радар сравнения сборок" kicker="Пять узлов · шкала 0–10" icon={<Radar />}
      description="Баллы по пяти узлам в выбранном разрешении, не замеры FPS.">
      <BuildRadar builds={builds} />
    </Panel>
  </div>;
}
