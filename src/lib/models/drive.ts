import type { StorageId } from "@/lib/hardware";

/** Keep v1 storage ids for old builds, packs and links. Optional modifiers
 * describe the drive for the simulator; they are never commands for the OS. */
export interface DriveSettings {
  storage: StorageId;
  nvmeGen?: 3 | 4 | 5;
  diskCache?: "dram" | "hmb" | "none";
  diskFill?: "normal" | "mid" | "high";
}
export const DRIVES = [
  { value: "hdd", label: "HDD (7200 RPM)", score: 2.5, readSec: 320, low: .80 },
  { value: "sata", label: "SATA SSD", score: 7.8, readSec: 67, low: .979 },
  { value: "gen3", label: "NVMe PCIe 3.0", score: 9.2, readSec: 44, low: .991 },
  { value: "gen4", label: "NVMe PCIe 4.0", score: 9.7, readSec: 37, low: .997 },
  { value: "gen5", label: "NVMe PCIe 5.0", score: 10, readSec: 33, low: 1 },
] as const;
export const DRIVE_CACHE = [{ value: "dram", label: "С DRAM" }, { value: "hmb", label: "HMB" }, { value: "none", label: "Без буфера" }] as const;
export const DRIVE_FILL = [{ value: "normal", label: "< 70% · норма" }, { value: "mid", label: "70–85%" }, { value: "high", label: "> 85% · мало места" }] as const;
export type DriveId = typeof DRIVES[number]["value"];
export const driveId = (d: DriveSettings): DriveId => d.storage === "nvme" ? `gen${d.nvmeGen ?? 3}` : d.storage;
export function changeDrive(d: DriveSettings, id: DriveId): Partial<DriveSettings> {
  const storage = id === "sata" || id === "hdd" ? id : "nvme";
  return { storage, nvmeGen: storage === "nvme" ? id === "gen5" ? 5 : id === "gen4" ? 4 : 3 : undefined,
    diskCache: storage === "hdd" || (storage === "sata" && d.diskCache === "hmb") ? undefined : d.diskCache };
}
export function validDrive(d: Partial<DriveSettings>): boolean {
  return (d.storage === "hdd" || d.storage === "sata" || d.storage === "nvme") &&
    (d.nvmeGen === undefined || (d.storage === "nvme" && [3,4,5].includes(d.nvmeGen))) &&
    (d.diskCache === undefined || (d.storage !== "hdd" && DRIVE_CACHE.some(c => c.value === d.diskCache) && (d.diskCache !== "hmb" || d.storage === "nvme"))) &&
    (d.diskFill === undefined || DRIVE_FILL.some(f => f.value === d.diskFill));
}
export function driveEstimate(d: DriveSettings) {
  const drive = DRIVES.find(item => item.value === driveId(d))!;
  const cache = d.diskCache ?? "dram", fill = d.diskFill ?? "normal", hdd = d.storage === "hdd";
  const cacheCost = hdd || cache === "dram" ? 0 : cache === "hmb" ? .035 : .10;
  const spaceCost = fill === "normal" ? 0 : fill === "mid" ? .025 : .14;
  // Illustrative cold-map workload. Reading is only ONE phase: allow fixed
  // time for decoding/initialisation so peak PCIe bandwidth never scales the whole load.
  const seconds = 36 + drive.readSec * (1 + cacheCost + spaceCost);
  const lowMultiplier = drive.low - cacheCost * .29 - spaceCost * .36;
  const score = Math.round(10 * drive.score / (1 + cacheCost + spaceCost)) / 10;
  const risk = hdd ? "Высокий" : lowMultiplier < .965 ? "Повышенный" : "Низкий";
  // Don't present fallback assumptions as hardware facts on a legacy profile.
  const label = [d.storage === "nvme" && !d.nvmeGen ? "NVMe SSD" : drive.label,
    d.diskCache && DRIVE_CACHE.find(c => c.value === cache)!.label, d.diskFill && DRIVE_FILL.find(f => f.value === fill)!.label].filter(Boolean).join(" · ");
  return { label, score, lowMultiplier, tailPenalty: (1 - lowMultiplier) * .8,
    warmupMin: Math.round(seconds * .76), warmupMax: Math.round(seconds * 1.32), risk };
}
export const warmupTime = (n: number) => `${Math.floor(n/60)}:${String(n%60).padStart(2,"0")}`;
