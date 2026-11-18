import { getCpu, getGpu } from "@/lib/hardware";
import type { GraphicsProfileId } from "@/lib/graphics-profiles";
import type { BuildInput } from "./build";
import { getResolutionSize } from "./build-resolution";
import { avgFps, calibratedFps, type RustScenario } from "./fps-calibration";

export function bestUpgrade(input: BuildInput, mode: GraphicsProfileId, scenario: RustScenario) {
  const cpu = getCpu(input.cpuId), gpu = getGpu(input.gpuId), size = getResolutionSize(input);
  if (!cpu || !gpu || !size) return null;
  const pixels = size.width * size.height;
  const baseline = calibratedFps(input, cpu, gpu, pixels, mode, scenario).official;
  const changes: { title: string; detail: string; patch?: Partial<BuildInput>; textureLimit?: number }[] = [];
  // Same platform only. Never infer motherboard/BIOS support from a CPU model alone.
  if (/^ryzen-[3579]-[1-5]\d{3}/.test(cpu.id)) {
    const id = cpu.idx < 57 ? "ryzen-5-5600" : cpu.idx < 78 ? "ryzen-7-5700x3d" : "ryzen-7-5800x3d";
    const target = getCpu(id);
    if (target && target.idx > cpu.idx) changes.push({ title: `Процессор: ${target.name}`, detail: "Кандидат для AM4. Сверьте поддержку платы и версию BIOS.", patch: { cpuId: id } });
  } else if (/^ryzen-[3579]-[79]\d{3}/.test(cpu.id) && cpu.idx < 100) {
    changes.push({ title: "Процессор: Ryzen 7 9800X3D", detail: "Кандидат для AM5. Проверьте BIOS и охлаждение.", patch: { cpuId: "ryzen-7-9800x3d" } });
  } else if (/^core-i[3579]-1[234]\d{3}/.test(cpu.id) && cpu.idx < 81) {
    changes.push({ title: "Процессор: Core i5-13600KF", detail: "Кандидат для LGA1700. Проверьте BIOS, питание и охлаждение.", patch: { cpuId: "core-i5-13600kf" } });
  }
  if (input.ramGb < 32) changes.push({ title: "ОЗУ: 32 ГБ", detail: "Две совместимые планки в двухканальном режиме, того же поколения DDR.", patch: { ramGb: 32 } });
  if (input.storage === "hdd") changes.push({ title: "Перенести Rust на SSD", detail: "Если плата поддерживает NVMe, он сократит паузы подгрузки. SATA SSD тоже подойдёт.", patch: { storage: "nvme" } });
  const nextGpu = getGpu(gpu.idx < 50 ? "geforce-rtx-5060" : gpu.idx < 80 ? "geforce-rtx-4070-super" : "geforce-rtx-5080");
  if (nextGpu && nextGpu.idx > gpu.idx && gpu.idx < 106) changes.push({ title: `Видеокарта: ${nextGpu.name}`, detail: "Сверьте блок питания, габариты и цену. Сравнение при том же разрешении.", patch: { gpuId: nextGpu.id } });
  if (gpu.vram <= 4) changes.push({ title: "Снизить качество текстур", detail: "Для 4 ГБ VRAM проверьте низкие текстуры до покупки комплектующих.", textureLimit: 3 });
  return changes.map((change) => {
    const afterInput = { ...input, ...change.patch };
    const after = calibratedFps(afterInput, getCpu(afterInput.cpuId) ?? cpu, getGpu(afterInput.gpuId) ?? gpu, pixels, mode, scenario, change.textureLimit).official;
    return { ...change, avg: Math.round(100 * (avgFps(after) / avgFps(baseline) - 1)), low: Math.round(100 * (after.low1 / baseline.low1 - 1)) };
  }).filter(({ avg, low }) => avg >= 3 || low >= 5)
    .sort((a, b) => b.avg - a.avg || b.low - a.low)[0] ?? null;
}
