import { IS_DESKTOP_APP } from "@/lib/config";
import { planWindows, withHostWindows } from "@/lib/plan-windows";
import { useSystemPlan, PlanActions } from "./catalog/SystemPlan";
import { systemPlan, systemPlanHref } from "@/lib/catalog/system-plan";
import type { BuildEvaluation, BuildInput } from "@/lib/models/build";
import { formatBuildResolution } from "@/lib/models/build-resolution";
import type { GraphicsProfileId } from "@/lib/graphics-profiles";
import { driveEstimate } from "@/lib/models/drive";

/** Derived from the same valid input as the radar, weighted score and pack.
 * No remote prompt, saved nickname, made-up hardware telemetry or stale HTML. */
export default function BuildInsight({
  input,
  mode,
  evaluation: r,
  live,
}: {
  input: BuildInput;
  mode: GraphicsProfileId;
  evaluation: BuildEvaluation;
  live: boolean;
}) {
  const { index, hostWindows } = useSystemPlan();
  const rig = withHostWindows(input, hostWindows);
  // A host edition can add an OS-specific step; only reuse an evaluation of the same rig.
  const plan = systemPlan(rig, mode, index, rig === input ? r : undefined);
  if (!plan) return <p>Укажите комплектующие для подбора.</p>;
  const strengths = [...r.breakdown].sort((a, b) => b.score - a.score).slice(0, 2);
  const resolution = formatBuildResolution(input);
  const check = {
    cpu: `На ${r.cpuName} сравните два прогона у одной застроенной базы, уменьшив только дальность прорисовки. Если 1% low вырос, оставьте дальность ниже.`,
    gpu: `При ${resolution} сравните на ${r.gpuName} исходный и пониженный масштаб рендера. Если средний FPS не меняется, верните его обратно.`,
    ram: `При ${input.ramGb} ГБ ОЗУ закройте лишние фоновые приложения и проверьте системную подкачку. Сравните длинные кадры на прежнем маршруте.`,
    balanced: `Для пары ${r.cpuName} / ${r.gpuName} начните без покупки железа: сравните один и тот же маршрут при двух уровнях теней.`,
  }[r.bottleneck];
  const io = plan.slugs.includes("rust-library-ssd")
    ? `Rust на HDD: перенесите библиотеку на SSD, если он есть. Сравните время входа и рывки при движении, а не только средний FPS.`
    : plan.slugs.includes("ssd-trim-free-space")
      ? "Накопитель почти заполнен. Освободите место и повторите загрузку той же карты."
      : null;
  const os = rig.windowsVersion,
    osPath =
      os === "11"
        ? "Параметры → Система → Дисплей → Графика"
        : "Параметры → Система → Дисплей → Настройки графики";
  return (
    <div className="build-insight">
      <p className="rubric">Расчёт RustFlow · не замер на ПК</p>
      <p className="insight-rig">
        {r.cpuName} · {r.gpuName} · {input.ramGb} ГБ · {driveEstimate(input).label} ·{" "}
        {[planWindows(os), resolution].filter(Boolean).join(" · ")}
      </p>
      <section>
        <h3>Баланс сборки</h3>
        <p>
          {r.notes[0]} Оценка модели: <b>{r.score10.toLocaleString("ru-RU")} из 10</b>.
        </p>
      </section>
      <section>
        <h3>Сильные стороны</h3>
        <p>Два наиболее сильных узла относительно остальных компонентов:</p>
        <ul>
          {strengths.map((s) => (
            <li key={s.key}>
              <strong>
                {s.label} — {s.score.toLocaleString("ru-RU")}/10.
              </strong>{" "}
              {s.detail}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Что сделать по порядку</h3>
        <ol>
          <li>Сохраните копию client.cfg и запишите средний FPS и 1% low на одном сервере до изменений.</li>
          <li>{check}</li>
          {io && <li>{io}</li>}
          {(os || !IS_DESKTOP_APP) && <li>
            {os
              ? `В Windows ${os} откройте «${osPath}». Проверьте, что Rust использует ${r.gpuName}. Если адаптер верный, оставьте как есть.`
              : "Укажите версию Windows в конфигурации: путь к настройкам графики различается, поэтому системный шаг пока не добавлен."}
          </li>}
          <li>
            Для {input.ramGb} ГБ памяти выбран <code>gc.buffer {plan.gc}</code> — запас памяти между очистками, которые могут вызывать рывки. Протестируйте конфиг отдельно
            от системных шагов и верните копию, если результат хуже.
          </li>
        </ol>
      </section>
      <p>
        Ближайший пресет: <strong data-insight-preset>{plan.best.title}</strong>. Для пакета подобрано шагов:{" "}
        <b data-plan-count>{plan.slugs.length}</b>. Настройки не применяются автоматически.
      </p>
      <PlanActions plan={plan} href={systemPlanHref(rig, mode, live)} />
    </div>
  );
}
