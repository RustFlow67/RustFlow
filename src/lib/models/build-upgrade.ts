import { BUILD_CPU_TIERS, getCpu, getGpu, type Cpu, type Gpu } from "@/lib/hardware";
import type { GraphicsProfileId } from "@/lib/graphics-profiles";
import type { BuildInput } from "./build";
import { driveEstimate } from "./drive";
import { getMemoryType } from "./build-settings";
import { getResolutionSize } from "./build-resolution";
import { avgFps, calibratedFps, frameMs, type RustScenario } from "./fps-calibration";
import { PLAY_OPTIONS, gcBudget } from "./play-settings";

// An index is a model input, not a price list or a motherboard support list.
const sockets = [
  [/^ryzen-[3579]-[1-5]\d{3}/, "AM4"],
  [/^ryzen-[3579]-[79]\d{3}/, "AM5"],
  [/^core-i[3579]-1[234]\d{3}/, "LGA1700"],
  [/^core-ultra-/, "LGA1851"],
  [/^core-i[3579]-1[01]\d{3}/, "LGA1200"],
  [/^core-i[3579]-[89]\d{3}/, "LGA1151 · серия 300"],
  [/^core-i[3579]-[67]\d{3}/, "LGA1151 · серии 100/200"],
  [/^core-i[3579]-4\d{3}/, "LGA1150"],
] as const;
const SCENES = { coast: "Соло / Фарм (Берег)", pvp: "Активное PvP / Монументы", raid: "Клан-рейд / 300+ онлайн (Official High Pop)" } as const;
type Kind = "cpu" | "gpu" | "ram" | "ssd" | "textures" | "keep";
interface Option { kind: Kind; title: string; patch: Partial<BuildInput>; tier: number; textureLimit?: number }
const keep: Option = { kind: "keep", title: "Оставить текущую сборку", patch: {}, tier: 0 };

function candidates(input: BuildInput, cpu: Cpu, gpu: Gpu) {
  const mobile = cpu.group === "Ноутбуки" || gpu.group === "Ноутбуки";
  const socket = !mobile && sockets.find(([pattern]) => pattern.test(cpu.id));
  const platform = mobile ? "Ноутбук" : socket ? socket[1] : "Текущая плата";
  const choices: Option[] = [];
  if (socket) for (const [id,tier] of Object.entries(BUILD_CPU_TIERS[socket[1]]??{})) {
    const target = getCpu(id);
    if (target && target.idx > cpu.idx) choices.push({ kind: "cpu", title: target.name, patch: { cpuId: id }, tier });
  }
  if (!mobile) {
    const ids = gpu.vendor === "amd" ? ["radeon-rx-6600", "radeon-rx-7800-xt", "radeon-rx-9070-xt", "radeon-rx-7900-xtx"]
      : ["geforce-rtx-5060", "geforce-rtx-4070-super", "geforce-rtx-5070-ti", "geforce-rtx-5080", "geforce-rtx-5090"];
    for (const [i, id] of ids.entries()) {
      const target = getGpu(id);
      if (target && target.idx > gpu.idx && target.vram >= gpu.vram) choices.push({ kind: "gpu", title: target.name, patch: { gpuId: id }, tier: i + 1 });
    }
  }
  if (input.ramGb < 32) choices.push({ kind: "ram", title: "Комплект ОЗУ 32 ГБ", patch: { ramGb: 32 }, tier: 1 });
  if (input.storage === "hdd") choices.push({ kind: "ssd", title: "Перенос Rust на SATA SSD", patch: { storage: "sata" }, tier: 1 },
    { kind: "ssd", title: "Перенос Rust на NVMe SSD", patch: { storage: "nvme" }, tier: 2 });
  if (gpu.vram <= 6) choices.push({ kind: "textures", title: "Сначала снизить качество текстур", patch: {}, textureLimit: 3, tier: 0 });
  return { choices, platform, mobile };
}

function snapshot(input: BuildInput, mode: GraphicsProfileId, scene: RustScenario, pixels: number, limit?: number) {
  const estimate = calibratedFps(input, getCpu(input.cpuId)!, getGpu(input.gpuId)!, pixels, mode, scene, limit);
  const fps = estimate.official;
  // An explicit tail heuristic, NOT a measured percentile. Disk stalls, paging
  // and VRAM pressure hurt the slowest frames more than the average frame.
  const tail = .89 - driveEstimate(input).tailPenalty - (gcBudget(input.ramGb, input).available < 16 ? .10 : 0)
    - estimate.vramPressure * .15 - (scene === "raid" ? .07 : scene === "pvp" ? .03 : 0);
  const low01 = Math.max(1, Math.round(fps.low1 * tail));
  return { avg: Math.round(avgFps(fps)), low: fps.low1, low01, ms: frameMs(fps), tailMs: Math.round(10000 / low01) / 10 };
}
const gain = (after: number, before: number) => Math.round(100 * (after / before - 1));

export function bestUpgrade(input: BuildInput, mode: GraphicsProfileId, scene: RustScenario) {
  const cpu = getCpu(input.cpuId), gpu = getGpu(input.gpuId), size = getResolutionSize(input);
  if (!size || !cpu || !gpu) return null;
  const pixels = size.width * size.height, resolution = `${size.width}×${size.height}`;
  const { choices, platform, mobile } = candidates(input, cpu, gpu);
  const base = snapshot(input, mode, scene, pixels);
  const ranked = choices.map(option => {
    const after = snapshot({ ...input, ...option.patch }, mode, scene, pixels, option.textureLimit);
    const avg = gain(after.avg, base.avg), low = gain(after.low, base.low);
    const benefit = .45 * avg + .55 * low;
    return { ...option, avg, low, benefit, priority: benefit / ([.65, 1, 1.6, 2.5, 3.8, 6][option.tier]) };
  }).filter(c => c.avg >= 3 || c.low >= 5).sort((a,b) => b.priority - a.priority || a.tier - b.tier);
  const pick = ranked[0] ?? keep;
  const next = { ...input, ...pick.patch };
  const matrix = PLAY_OPTIONS.scenario.map(({ value: id }) => ({ id, label: SCENES[id], before: id === scene ? base : snapshot(input, mode, id, pixels), after: snapshot(next, mode, id, pixels, pick.textureLimit) }));
  const selected = matrix.find(r => r.id === scene)!;
  // Budget and headroom are two independent buying goals, not successive
  // upgrades. Don't hide the best socket-compatible part just because it won.
  const value = [...ranked].sort((a,b) => a.tier - b.tier || b.benefit - a.benefit)[0];
  const reserve = [...ranked].sort((a,b) => b.benefit - a.benefit || a.tier - b.tier)[0];
  const x3d = pick.kind === "cpu" && next.cpuId.endsWith("x3d"); // All the candidate X3Ds are single-CCD, 96 MiB L3 parts.
  const vram = getGpu(next.gpuId)!.vram;
  const explain: Record<Kind, [string, string[]]> = {
    cpu: [`В этой сцене ${cpu.name} ограничивает подготовку кадра: рядом с большой базой главный поток обрабатывает больше сущностей. ${x3d ? `У ${pick.title} суммарно 96 МБ L3 с 3D V-Cache. Часть повторных обращений к данным не уходит в ОЗУ — это может сократить длинные кадры, но не уберёт паузы чтения с диска.` : `Более быстрый игровой поток у ${pick.title} раньше передаёт работу драйверу. Когда пределом станет GPU, дальнейший рост среднего FPS замедлится.`}`, [x3d ? "96 МБ кэша L3" : "Быстрее главный поток", platform, "Без смены видеокарты"]],
    gpu: [`При ${resolution} ${gpu.name} должна закрасить ${(pixels / 1e6).toFixed(1)} млн пикселей на кадр. Тени и текстуры нагружают шейдеры и шину памяти; если набор ресурсов не помещается в ${gpu.vram} ГБ VRAM, обмен через системную память может добавить паузы. ${vram > gpu.vram ? `У кандидата ${vram} ГБ: больше места для ресурсов.` : "Объём VRAM тот же: модель ожидает выигрыш от растеризации, а не от ёмкости."} Ширину шины и пропускную способность конкретной карты сверяйте по спецификации.`, [`${vram} ГБ VRAM`, "Выше предел рендера", "Тот же процессор"]],
    ram: [`Из установленных ${input.ramGb} ГБ модель оставляет игре около ${gcBudget(input.ramGb, input).available} ГБ после фоновых задач. Если рабочие данные Unity не помещаются в ОЗУ, Windows чаще обращается к файлу подкачки. Переход на 32 ГБ разгружает этот путь при въезде в застройку, но не ускоряет сам GPU.`, ["32 ГБ ОЗУ", "Запас под фон", "Меньше подкачки"]],
    ssd: [`Сейчас Rust читает ресурсы с HDD. При подъезде к крупной базе нужны сразу многие небольшие файлы: время поиска на диске может растянуть отдельные кадры. SSD уменьшает задержку случайного чтения; на спокойном берегу прирост среднего FPS обычно скромнее.`, ["Быстрее загрузка", "Меньше задержка чтения", "Без смены CPU"]],
    textures: [`При ${resolution} видеокарте с ${gpu.vram} ГБ может не хватать локальной памяти. Более лёгкие mip-уровни снижают объём текстур и число пересылок. Сначала проверьте это в одной сцене: если паузы остались, причина может быть в CPU или ОЗУ.`, ["Без покупки", "Меньше нагрузка на VRAM", "Настройка обратима"]],
    keep: [`Для связки ${cpu.name} и ${gpu.name} при ${resolution} ни одна проверенная замена на этой платформе не прошла порог: +3% к среднему FPS или +5% к 1% low. Поэтому «после» равно «до». Запишите время кадра в проблемном месте, прежде чем покупать железо.`, ["Без лишних затрат", "Контрольный замер", "Та же платформа"]],
  };
  return { kind: pick.kind, title: pick.title, platform, resolution, patch: pick.patch, matrix, selected, explanation: explain[pick.kind][0], perks: explain[pick.kind][1],
    value, reserve, mobile,
    baseline: `${cpu.name} · ${gpu.name} (${gpu.vram} ГБ) · ${input.ramGb} ГБ ${getMemoryType(input)}-${input.ramMhz} CL${input.ramCl} · ${driveEstimate(input).label}`,
    checklist: [mobile ? "BIOS и плата: сверьте версию BIOS и сервисное руководство именно вашей модели. Распаянную память не заменить модулем." : `BIOS: проверьте точную модель и ревизию платы ${platform}, список поддерживаемых CPU и минимальную версию прошивки.`,
      mobile ? "Питание: проверьте штатную мощность адаптера в ваттах и отсутствие ограничения при работе от сети." : "БП: сложите паспортные пиковые мощности CPU, GPU и остальной системы в ваттах. Берите БП примерно на четверть мощнее расчётного пика (например, 400 Вт → 500 Вт), не ниже рекомендации производителя GPU; проверьте разъёмы.",
      pick.kind === "ssd" ? "Охлаждение и слот: проверьте интерфейс (M.2 не всегда NVMe), крепление и зазор для радиатора SSD." : pick.kind === "ram" ? "Охлаждение и память: сверьте высоту модулей под кулером, поколение DDR, свободные слоты и список совместимости платы." : "Охлаждение: сверьте крепление и возможности кулера, длину карты и зазор для притока воздуха."],
  };
}
export type UpgradeReport = NonNullable<ReturnType<typeof bestUpgrade>>;
