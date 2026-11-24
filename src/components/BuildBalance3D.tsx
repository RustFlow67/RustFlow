"use client";
import type { BuildEvaluation, BreakdownKey } from "@/lib/models/build";
import WebGLScene from "./three/WebGLScene";

const axes: { key: BreakdownKey; label: string }[] = [
  { key: "cpuSingle", label: "CPU" },
  { key: "ramLatency", label: "RAM" },
  { key: "ssdRandom", label: "SSD" },
  { key: "gpuTier", label: "GPU" },
  { key: "vramHeadroom", label: "VRAM" },
];

/** Isometric columns encode the actual model scores; the bottleneck is calculated separately. */
export default function BuildBalance3D({ evaluation }: { evaluation: BuildEvaluation }) {
  return <figure className="balance-3d" aria-label="Объёмная диаграмма оценок компонентов от нуля до десяти">
    <div className="balance-3d-heading"><span className="tech-label">SYSTEM / 01—05</span><span>ОЦЕНКА УЗЛОВ / 10</span></div>
    <WebGLScene kind="balance" className="balance-webgl" state={{ values: axes.map(({key}) => evaluation.breakdown.find(item => item.key === key)?.score ?? 0) }} label="Трёхмерная диаграмма. Перетащите или используйте стрелки для вращения." fallback={<svg viewBox="0 0 600 300" aria-hidden="true" focusable="false">
      <defs><linearGradient id="balance-face" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#f6f6f6"/><stop offset="1" stopColor="#8b8b8b"/></linearGradient></defs>
      <path d="M28 250 L485 250 L572 201 L115 201 Z" fill="#171717" stroke="#777" />
      {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${42 + i * 92} 250 l87 -49`} stroke="#404040" />)}
      {[0, 1, 2, 3].map(i => <path key={i} d={`M${28 + i * 29} ${250 - i * 16.3} h457`} stroke="#333" />)}
      {axes.map(({ key, label }, i) => {
        const score = evaluation.breakdown.find(item => item.key === key)?.score ?? 0;
        const x = 53 + i * 92, base = 232, height = score * 15;
        const top = base - height;
        return <g key={key}>
          <path d={`M${x} ${top} l20 -12 h46 l-20 12 Z`} fill="#fafafa" />
          <path d={`M${x + 46} ${top} l20 -12 v${height} l-20 12 Z`} fill="#666" />
          <path d={`M${x} ${top} h46 v${height} h-46 Z`} fill="url(#balance-face)" />
          <text x={x + 23} y={top - 22} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700">{score.toFixed(1)}</text>
          <text x={x + 23} y="278" textAnchor="middle" fill="#bdbdbd" fontSize="12" fontFamily="monospace">{label}</text>
        </g>;
      })}
    </svg>} />
    <div className="balance-3d-values" aria-hidden="true">{axes.map(({key, label}) => <span key={key} data-balance-axis={key}><b>{(evaluation.breakdown.find(item => item.key === key)?.score ?? 0).toFixed(1)}</b><small>{label}</small></span>)}</div>
    <figcaption>Перетащите диаграмму для вращения. Расчёт по характеристикам · высота столбца — балл узла. Узкое место определяется отдельно.</figcaption>
  </figure>;
}
