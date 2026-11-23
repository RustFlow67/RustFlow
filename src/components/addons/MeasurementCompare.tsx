"use client";

import { useState } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import Panel from "./Panel";
import styles from "./addons.module.css";

type Language = "ru" | "en";
const copy = {
  ru: {
    title: "Сравнение замеров", kicker: "Лаборатория · До / После",
    description: "Сравните собственные измерения в одинаковых условиях. Данные остаются на этой странице и никуда не отправляются.",
    language: "Язык калькулятора", before: "До", after: "После", avg: "Средний FPS", low: "1% low FPS (необязательно)", hz: "Частота монитора, Гц (необязательно)",
    invalid: "Введите средний FPS от 1 до 1000. Необязательные значения должны быть в том же диапазоне; 1% low не должен превышать средний FPS.",
    result: "Результат сравнения", avgChange: "Изменение среднего FPS", frameChange: "Изменение времени кадра", lowChange: "Изменение 1% low", interval: "Интервал обновления монитора", ms: "мс",
    explanation: "Время кадра рассчитывается как 1000 / средний FPS. Это обратная величина среднего FPS, а не среднее отдельных времён кадров. Интервал монитора — 1000 / Гц; это не измерение задержки ввода.",
    method: "Для честного сравнения используйте один сервер, маршрут, разрешение и настройки; прогрейте игру и повторите каждый тест несколько раз. FPS и 1% low могут меняться от сцены к сцене.",
    pending: "Введите оба средних значения, чтобы увидеть сравнение.",
  },
  en: {
    title: "Compare measurements", kicker: "Lab · Before / After",
    description: "Compare your own measurements under the same conditions. Data stays on this page and is not sent anywhere.",
    language: "Calculator language", before: "Before", after: "After", avg: "Average FPS", low: "1% low FPS (optional)", hz: "Monitor refresh rate, Hz (optional)",
    invalid: "Enter average FPS between 1 and 1000. Optional values must be in the same range; 1% low must not exceed average FPS.",
    result: "Comparison results", avgChange: "Average FPS change", frameChange: "Frame time change", lowChange: "1% low change", interval: "Monitor refresh interval", ms: "ms",
    explanation: "Frame time is calculated as 1000 / average FPS. This is the reciprocal of average FPS, not the average of individual frame times. The monitor interval is 1000 / Hz; it is not a measurement of input latency.",
    method: "For a fair comparison use the same server, route, resolution and settings; warm up the game and repeat each test several times. FPS and 1% low vary between scenes.",
    pending: "Enter both average values to see the comparison.",
  },
} as const;

function number(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 1000 ? parsed : null;
}
function change(before: number, after: number) {
  const delta = (after / before - 1) * 100;
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

export default function MeasurementCompare() {
  const [language, setLanguage] = useState<Language>("ru");
  const [values, setValues] = useState({ before: "", after: "", beforeLow: "", afterLow: "", hz: "" });
  const t = copy[language];
  const b = number(values.before), a = number(values.after), bl = number(values.beforeLow), al = number(values.afterLow), hz = number(values.hz);
  const invalid = Object.entries(values).some(([, value]) => value.trim() !== "" && number(value) === null)
    || (bl !== null && b !== null && bl > b) || (al !== null && a !== null && al > a);
  const input = (key: keyof typeof values, label: string) => <label className={styles.label}>{label}
    <input className={styles.input} type="number" min="1" max="1000" step="any" inputMode="decimal" value={values[key]}
      onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} />
  </label>;
  return <div lang={language}>
    <Panel id="measurement-compare" kicker={t.kicker} title={t.title} description={t.description} icon={<ChartNoAxesCombined />}>
      <label className={styles.label}>{t.language}
        <select className={styles.input} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
          <option value="ru">Русский</option><option value="en">English</option>
        </select>
      </label>
      <div className={styles.columns}>
        <fieldset className={`${styles.inset} ${styles.spaced}`}><legend>{t.before}</legend>{input("before", t.avg)}{input("beforeLow", t.low)}</fieldset>
        <fieldset className={`${styles.inset} ${styles.spaced}`}><legend>{t.after}</legend>{input("after", t.avg)}{input("afterLow", t.low)}</fieldset>
      </div>
      {input("hz", t.hz)}
      <div aria-live="polite" className={styles.inset}>
        {invalid ? <p className={styles.alert}>{t.invalid}</p> : b !== null && a !== null ? <>
          <h3>{t.result}</h3><div className={styles.metrics}>
            <div><span>{t.avgChange}</span><strong className={styles.metric}>{change(b, a)}</strong></div>
            <div><span>{t.frameChange}</span><strong className={styles.metric}>{change(1000 / b, 1000 / a)}</strong><span>{(1000 / b).toFixed(2)} → {(1000 / a).toFixed(2)} {t.ms}</span></div>
            {bl !== null && al !== null && <div><span>{t.lowChange}</span><strong className={styles.metric}>{change(bl, al)}</strong></div>}
            {hz !== null && <div><span>{t.interval}</span><strong className={styles.metric}>{(1000 / hz).toFixed(2)} {t.ms}</strong></div>}
          </div>
        </> : <p>{t.pending}</p>}
      </div>
      <p className={styles.muted}>{t.explanation}</p><p className={styles.muted}>{t.method}</p>
    </Panel>
  </div>;
}
