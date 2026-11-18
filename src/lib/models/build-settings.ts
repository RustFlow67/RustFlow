export type MemoryType = "DDR4" | "DDR5";

export const BIOS_PROFILES = [
  { value: "stock", label: "Сток (без XMP)", cpu: .98, ram: .95, low: .91 },
  { value: "xmp", label: "XMP / EXPO включён", cpu: 1, ram: 1, low: 1 },
  { value: "tuned", label: "Тюнинг (PBO / Андервольтинг)", cpu: 1.045, ram: 1.035, low: 1.05 },
] as const;
export type BiosProfile = typeof BIOS_PROFILES[number]["value"];
export const getBiosProfile = (profile: unknown) => BIOS_PROFILES.find(({ value }) => value === profile);

export const REFRESH_RATES = [60, 144, 165, 240, 360] as const;
export type MonitorHz = typeof REFRESH_RATES[number];
export const DEFAULT_MONITOR_HZ: MonitorHz = 144;
export const isMonitorHz = (hz: unknown): hz is MonitorHz => REFRESH_RATES.some((rate) => rate === hz);
export const parseMonitorHz = (hz: unknown) => REFRESH_RATES.find((rate) => String(rate) === hz);
export const formatMonitorHz = (hz: MonitorHz) => hz === 360 ? "360+ Гц" : `${hz} Гц`;
export const monitorPotential = (fps: number, hz: MonitorHz) => Math.round(Math.max(0, Math.min(100, fps * 100 / hz)));

// Client-side position interpolation only. These settings do not change ping or tick rate.
export const CONNECTION_PROFILES = [
  { value: "cable", label: "Кабель / Низкий пинг", interpolation: .10, smoothing: .10 },
  { value: "wifi", label: "Wi-Fi / Средний пинг", interpolation: .13, smoothing: .12 },
  { value: "unstable", label: "Нестабильный канал", interpolation: .17, smoothing: .15 },
] as const;
export type ConnectionProfile = typeof CONNECTION_PROFILES[number]["value"];
export const getConnectionProfile = (profile: unknown) => CONNECTION_PROFILES.find(({ value }) => value === profile);
export const DEFAULT_CONNECTION: ConnectionProfile = "cable";

export interface BuildSettings {
  memoryType?: MemoryType;
  biosProfile?: BiosProfile;
  monitorHz?: MonitorHz;
  connection?: ConnectionProfile;
}
export type ConfigTuning = Pick<BuildSettings, "monitorHz" | "connection">;

/** Only lock known desktop platforms. LGA1700 can use either generation, depending on the board. */
export function requiredMemory(cpuId: string): MemoryType | null {
  if (/^ryzen-[3579]-[789]\d{3}/.test(cpuId) || cpuId.startsWith("core-ultra-")) return "DDR5";
  if (/^ryzen-[3579]-[1-5]\d{3}/.test(cpuId) || /^core-i[3579]-1[01]\d{3}/.test(cpuId)) return "DDR4";
  return null;
}

export function getMemoryType(input: Pick<BuildSettings, "memoryType"> & { cpuId: string; ramMhz: number }): MemoryType {
  // Known platforms take precedence over the frequency heuristic for old saves.
  return requiredMemory(input.cpuId) ?? input.memoryType ?? (input.ramMhz >= 4400 ? "DDR5" : "DDR4");
}

export const defaultMemoryKit = (memoryType: MemoryType) => ({
  memoryType, ...(memoryType === "DDR5" ? { ramMhz: 6000, ramCl: 30 } : { ramMhz: 3600, ramCl: 16 }),
});

export const RAM_MHZ_BOUNDS = { min: 1600, max: 9600 } as const;
export const RAM_CL_BOUNDS = { min: 10, max: 60 } as const;
export const isRamValue = (value: unknown, { min, max }: { min: number; max: number }): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

export function isValidBuildSettings(input: BuildSettings, cpuId: string) {
  const fixed = requiredMemory(cpuId);
  return (input.memoryType === undefined || ((input.memoryType === "DDR4" || input.memoryType === "DDR5") && (!fixed || fixed === input.memoryType))) &&
    (input.biosProfile === undefined || !!getBiosProfile(input.biosProfile)) &&
    (input.monitorHz === undefined || isMonitorHz(input.monitorHz)) &&
    (input.connection === undefined || !!getConnectionProfile(input.connection));
}
