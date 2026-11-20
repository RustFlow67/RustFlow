import LiquidGlass from "@/components/LiquidGlass";
import { Check, ChevronsUp, ScanLine } from "lucide-react";
import type { UpgradeReport } from "@/lib/models/build-upgrade";
import { Meter } from "./ui";

const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
const signed = (n: number) => (n > 0 ? "+" : "") + n + "%";

/** One baseline and one change across the entire report. Never compare two
 * different scenes, resolutions or graphics presets to manufacture a gain. */
export default function UpgradeVerdict({ report: r }: { report: UpgradeReport }) {
  const { before, after } = r.selected;
  const max = Math.max(...r.matrix.flatMap(row => [row.before.avg, row.after.avg]));
  const rows = [...r.matrix.map(row => ({ id: row.id, label: row.label, a: row.before.avg, b: row.after.avg,
    note: `1% low: ${row.before.low} → ${row.after.low} FPS` })), { id: "tail", label: "Стабильность фреймтайма (0.1% low и время кадра в мс)", a: before.low01, b: after.low01,
    note: `Длинный кадр: ${fmt(before.tailMs)} → ${fmt(after.tailMs)} мс. Средний: ${fmt(before.ms)} → ${fmt(after.ms)} мс.` }];
  return <section className="upgrade-verdict py-4" aria-labelledby="upgrade-title" data-upgrade={r.kind}>
    <div className="report-stamp"><span><ScanLine size={15} /> ЛАБОРАТОРИЯ АПГРЕЙДА</span><small>{r.platform}</small></div>
    <h2 id="upgrade-title">Умный вердикт по апгрейду</h2>
    <LiquidGlass className="report-pick"><ChevronsUp aria-hidden="true" /><strong>{r.title}</strong><small>{r.resolution}</small></LiquidGlass>
    <p className="report-baseline"><small>Исходная сборка</small>{r.baseline}</p>
    <h3>Почему именно этот апгрейд</h3><p>{r.explanation}</p>
    <ul className="upgrade-perks">{r.perks.map(text => <li key={text}>{text}</li>)}</ul>
    <h3>Матрица прироста FPS</h3><p>Один профиль графики и разрешение. Меняется только предложенный параметр; длины полос сопоставимы во всех строках.</p>
    <div className="upgrade-matrix" aria-label="До и после апгрейда">{rows.map(row => <LiquidGlass key={row.id} data-scenario={row.id} className="upgrade-row">
      <div><h4>{row.label}</h4><span>{signed(Math.round(100*(row.b/row.a-1)))}</span></div>
      {([['До',row.a],['После',row.b]] as const).map(([label, n]) => <div key={label} className="upgrade-measure"><small>{label}</small><Meter percent={n*100/max} /><b>{n} FPS</b></div>)}
      <small>{row.note}</small>
    </LiquidGlass>)}</div>
    <p className="report-note">Оценка, не замер. 0.1% low для сцены «{r.selected.label}» приближённо выведен из 1% low с поправками на ОЗУ, накопитель и VRAM. Длительность кадра в мс = 1000 / FPS.</p>
    <h3>Альтернативы на вашей платформе</h3>
    <div className="upgrade-alts">{([['Оптимальный цена/качество',r.value],['Максимальный запас на годы вперед',r.reserve]] as const).map(([label,c], i) => <div key={label}>
      <small>0{i+1} / {label}</small><strong>{c?.title ?? (i ? "Отложить покупку" : "Настроить без покупки")}</strong>
      <p>{c ? `${signed(c.avg)} к среднему FPS · ${signed(c.low)} к 1% low в выбранной сцене.${c.title === r.title ? " Совпадает с вердиктом." : ""}` : i ? "Другой существенной замены не найдено. Смена платформы — отдельный бюджет, а не обещанный прирост." : "Сравните два прогона с разной дальностью и качеством текстур, не меняя сервер."}</p>
    </div>)}</div>
    <p className="report-note">Сравнение по классу затрат и прогнозу, без актуальных цен. Варианты независимы: проценты не складываются.</p>
    <h3>Перед покупкой</h3><ul className="upgrade-checks">{r.checklist.map(s => <li key={s}><Check size={15} aria-hidden="true" />{s}</li>)}</ul>
  </section>;
}
