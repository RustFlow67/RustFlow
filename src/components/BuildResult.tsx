import { ChevronDown, FileCode2 } from "lucide-react";
import { BOTTLENECK_LABEL } from "@/lib/hardware";
import { GRAPHICS_PROFILES, type GraphicsProfileId } from "@/lib/graphics-profiles";
import { RUST_SCORE_WEIGHTS, type BuildEvaluation, type BuildInput } from "@/lib/models/build";
import { formatBuildResolution } from "@/lib/models/build-resolution";
import { avgFps, frameMs } from "@/lib/models/fps-calibration";
import type { UpgradeReport } from "@/lib/models/build-upgrade";
import { PLAY_OPTIONS, PLAY_DEFAULTS } from "@/lib/models/play-settings";
import LiquidGlass from "@/components/LiquidGlass";
import { CountUp } from "./fx/CountUp";
import UpgradeVerdict from "./UpgradeVerdict";
import Segmented from "./Segmented";

const scoreLabels = {
  cpuSingle: "CPU",
  ramLatency: "RAM",
  ssdRandom: "SSD",
  gpuTier: "GPU",
  vramHeadroom: "VRAM",
} as const;
export default function BuildResult({
  input,
  evaluation: r,
  mode,
  upgrade,
  changeMode,
  preview,
}: {
  input: BuildInput;
  evaluation: BuildEvaluation;
  mode: GraphicsProfileId;
  upgrade: UpgradeReport | null;
  changeMode: (id: GraphicsProfileId) => void;
  preview: (from: HTMLButtonElement) => void;
}) {
  const scene = PLAY_OPTIONS.scenario.find(
    (s) => s.value === (input.scenario ?? PLAY_DEFAULTS.scenario),
  )!.label;
  return (
    <div className="result-sections">
      <div className="balance-overview">
        <div className="balance-model" aria-label={`Модель баланса: ${BOTTLENECK_LABEL[r.bottleneck]}`}><div className="balance-model-orbit"><span>СИСТЕМА</span><strong>{BOTTLENECK_LABEL[r.bottleneck]}</strong><small>ВЕРОЯТНОЕ ОГРАНИЧЕНИЕ</small></div></div>
        <div className="balance-score">
          <small>Общая оценка</small>
          <p>
            <strong>
              <CountUp value={r.score10} digits={1} />
            </strong>{" "}
            / 10
          </p>
          <b>{r.verdictLabel}</b>
          <p className="balance-bottleneck"><small>Вероятное узкое место</small><strong>{BOTTLENECK_LABEL[r.bottleneck]}</strong><span>Расчётная оценка, не измерение в игре.</span></p>
          <dl aria-label="Баллы по узлам">
            {(Object.keys(scoreLabels) as Array<keyof typeof scoreLabels>).map((key) => (
              <div key={key}>
                <dt>{scoreLabels[key]}</dt>
                <dd>
                  <CountUp value={r.breakdown.find((b) => b.key === key)!.score} digits={1} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <section aria-label="Ожидаемый диапазон FPS" className="fps-summary">
        <h3>Сколько кадров ожидать</h3>
        <p>
          Средний FPS — обычная скорость игры. <b>1% low</b> оценивает скорость в 1% самых медленных кадров:
          чем он ниже, тем заметнее рывки.
        </p>
        <table>
          <caption>
            {formatBuildResolution(input)} · {scene}
          </caption>
          <thead>
            <tr>
              <th scope="col">Сервер</th>
              <th scope="col">Средний FPS</th>
              <th scope="col">1% low</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: "MODDED 2X", label: "Modded 2×", online: "180–250 игроков", fps: r.fpsModded },
              { name: "OFFICIAL HIGH POP", label: "Official", online: "350–500 игроков", fps: r.fpsOfficial },
            ].map(({ name, label, online, fps }) => (
              <tr data-server={name} key={name}>
                <th scope="row">
                  {label}
                  <small>{online}</small>
                </th>
                <td>
                  <CountUp value={Math.round(avgFps(fps))} />
                </td>
                <td>
                  <CountUp value={fps.low1} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="result-mode">
        <h3>Режим графики</h3>
        <Segmented
          presentation="grid"
          ariaLabel="Режим графики сборки"
          className="build-modes"
          options={GRAPHICS_PROFILES.filter((p) => p.id !== "realistic" || mode === "realistic").map((p) => ({
            value: p.id,
            label: p.id === "competitive" ? p.title : p.short,
          }))}
          value={mode}
          onChange={changeMode}
        />
        <p>{GRAPHICS_PROFILES.find((p) => p.id === mode)?.hint}</p>
        <LiquidGlass
          as="button"
          island
          shape="pill"
          type="button"
          className="btn btn-primary"
          aria-haspopup="dialog"
          onClick={(e) => preview(e.currentTarget)}
        >
          <FileCode2 aria-hidden="true" /> Предпросмотр client.cfg
        </LiquidGlass>
      </section>
      {upgrade && (
        <section className="first-upgrade">
          <small className="rubric">Что проверить первым</small>
          <h3>{upgrade.title}</h3>
          <p>
            {upgrade.kind === "ssd"
              ? "Чтение с жёсткого диска может задерживать загрузку карты и вызывать рывки у базы."
              : upgrade.kind === "ram"
                ? "При нехватке оперативной памяти игра обращается к диску. Это растягивает самые медленные кадры."
                : upgrade.kind === "textures"
                  ? "Снижение качества текстур освобождает память видеокарты. Проверьте это до покупки железа."
                  : upgrade.kind === "keep"
                    ? "Заметного выигрыша от одной замены модель не ожидает. Проверьте результат в игре до покупки."
                    : `${r.bottleneck === "balanced" ? "Процессор и видеокарта близки по возможностям." : `Сейчас кадры ограничивает ${BOTTLENECK_LABEL[r.bottleneck].toLowerCase()}.`} По прогнозу, 1% low после одной замены: ${upgrade.selected.before.low} → ${upgrade.selected.after.low} FPS.`}
          </p>
        </section>
      )}
      <details className="build-disclosure">
        <summary>
          Как получился прогноз <ChevronDown size={16} />
        </summary>
        <div className="model-details">
          <p>{r.verdictSummary}</p>
          <p>
            Итоговая оценка — сумма баллов с учётом веса каждого узла. SSD здесь означает накопитель с игрой,
            даже если это HDD.
          </p>
          <ul>
            {r.breakdown.map((b) => (
              <li key={b.key}>
                <strong>
                  {b.label} · {Math.round(b.weight * 100)}%
                </strong>
                <p>
                  {b.detail} {RUST_SCORE_WEIGHTS[b.key].why}
                </p>
              </li>
            ))}
          </ul>
          <p>
            Расчётные диапазоны: Modded {r.fpsModded.min}–{r.fpsModded.max} FPS, Official {r.fpsOfficial.min}–
            {r.fpsOfficial.max} FPS. Средний кадр на Official: {frameMs(r.fpsOfficial)} мс.
          </p>
        </div>
      </details>
      {upgrade && (
        <details className="build-disclosure upgrade-details">
          <summary>
            Сравнить до и после апгрейда <ChevronDown size={16} />
          </summary>
          <UpgradeVerdict report={upgrade} />
        </details>
      )}
    </div>
  );
}
