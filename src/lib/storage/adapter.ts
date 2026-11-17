import {
  defaultClForMhz,
  evaluateBuild10,
  isValidBuildInput,
  type BuildInput,
  type UserBuild,
} from "@/lib/models/build";
import { LOCAL_OWNER_ID, makeId, nowIso, SCHEMA_VERSION } from "@/lib/models/common";
import { SAMPLE_LOGS, type BenchmarkLog, type NewBenchmarkLog, type ServerKind } from "@/lib/models/log";
import type { UserTweakRecord } from "@/lib/models/tweak";
import type { GpuVendor, PresetId, ProfileId } from "@/lib/tweaks/meta";

/**
 * Единый модуль-адаптер клиентского хранилища (Этап 1: localStorage).
 * Подготовлен к Этапу 2: все сущности (builds / tweaks / logs) разделены,
 * содержат ownerId и работают через интерфейс StorageAdapter, который позже
 * заменяется на адаптер BaaS/auth без переписывания UI-компонентов.
 */

const STORE_KEY = "rustflow:store:v1";
const LEGACY_RATING_KEY = "rustflow:rating";
const LEGACY_SETUP_KEY = "rustflow:setup";
const CHANGE_EVENT = "rustflow:store-change";

export interface SetupPreferences {
  ownerId: string;
  profile: ProfileId;
  preset: PresetId;
  gpu: GpuVendor;
  protocolChecks: string[];
  updatedAt: string;
}

export interface PersistedState {
  schemaVersion: number;
  ownerId: string;
  activeBuildId: string | null;
  builds: UserBuild[];
  tweaks: Record<string, UserTweakRecord>;
  logs: BenchmarkLog[];
  setup: SetupPreferences;
  samplesDismissed: boolean;
}

/** Формат экспорта/импорта JSON «моя сборка + применённые твики + журнал». */
export interface ExportBundle {
  app: "RustFlow";
  schemaVersion: number;
  exportedAt: string;
  ownerId: string;
  activeBuildId: string | null;
  myBuild: UserBuild | null;
  builds: UserBuild[];
  appliedTweaks: UserTweakRecord[];
  logs: BenchmarkLog[];
  setup: SetupPreferences;
}

export interface ImportPreview {
  bundle: ExportBundle;
  buildsCount: number;
  appliedCount: number;
  measuredTweaksCount: number;
  logsCount: number;
  myBuildTitle: string | null;
}

export interface StorageAdapter {
  getOwnerId(): string;
  getState(): PersistedState;
  subscribe(listener: () => void): () => void;

  // Builds
  saveBuild(input: BuildInput, existingId?: string): UserBuild | null;
  setActiveBuild(id: string): void;
  deleteBuild(id: string): void;

  // Tweaks (applied + before/after FPS)
  setTweakApplied(slug: string, applied: boolean): UserTweakRecord;
  setTweakFps(slug: string, fpsBefore: number | null, fpsAfter: number | null, note?: string): UserTweakRecord;
  resetTweakProgress(): void;

  // Logs (benchmark journal)
  addLog(entry: NewBenchmarkLog): BenchmarkLog;
  updateLog(id: string, patch: Partial<NewBenchmarkLog>): BenchmarkLog | null;
  deleteLog(id: string): void;
  clearSampleLogs(): void;
  clearAllLogs(): void;
  restoreSampleLogs(): void;
  restoreLogs(entries: BenchmarkLog[]): void;

  // Setup & protocol
  updateSetup(patch: Partial<Pick<SetupPreferences, "profile" | "preset" | "gpu" | "protocolChecks">>): void;

  // JSON Export / Import / Reset
  exportBundle(): ExportBundle;
  validateImport(rawJson: string): { ok: true; preview: ImportPreview } | { ok: false; error: string };
  applyImport(bundle: ExportBundle, mode: "replace" | "merge"): void;
  resetAll(): void;
}

function defaultSetup(ownerId: string = LOCAL_OWNER_ID): SetupPreferences {
  return {
    ownerId,
    profile: "recommended",
    preset: "balanced",
    gpu: "all",
    protocolChecks: [],
    updatedAt: nowIso(),
  };
}

function defaultState(withSamples = true): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    ownerId: LOCAL_OWNER_ID,
    activeBuildId: null,
    builds: [],
    tweaks: {},
    logs: withSamples ? SAMPLE_LOGS.map((l) => ({ ...l })) : [],
    setup: defaultSetup(LOCAL_OWNER_ID),
    samplesDismissed: !withSamples,
  };
}

function sanitizeFps(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 2000) return null;
  return Math.round(n * 10) / 10;
}

function sanitizeServerKind(v: unknown): ServerKind {
  return v === "modded" || v === "official" || v === "staging" ? v : "official";
}

function buildRecordFromInput(input: BuildInput, ownerId: string, existing?: UserBuild): UserBuild | null {
  const cleanName = (input.name || "").trim().slice(0, 80) || "Моя сборка";
  const normalized: BuildInput = { ...input, name: cleanName };
  const ev = evaluateBuild10(normalized);
  if (!ev) return null;
  const ts = nowIso();
  return {
    id: existing?.id ?? makeId("build"),
    ownerId: existing?.ownerId || ownerId,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
    input: normalized,
    score10: ev.score10,
    verdictLabel: ev.verdictLabel,
    fpsModded: [ev.fpsModded.min, ev.fpsModded.max],
    fpsOfficial: [ev.fpsOfficial.min, ev.fpsOfficial.max],
    recommendedPreset: ev.recommendedPreset,
    vendor: ev.vendor,
  };
}

/** Миграция данных из старых ключей rustflow:rating и rustflow:setup при первом запуске. */
function migrateLegacy(base: PersistedState): PersistedState {
  if (typeof window === "undefined") return base;
  const next: PersistedState = { ...base, tweaks: { ...base.tweaks }, builds: [...base.builds] };
  try {
    const rawRating = window.localStorage.getItem(LEGACY_RATING_KEY);
    if (rawRating) {
      const parsed = JSON.parse(rawRating) as {
        input?: { cpuId?: string; gpuId?: string; ram?: number; storage?: string; resolution?: string };
      };
      if (parsed?.input?.cpuId && parsed?.input?.gpuId) {
        const mhz = 3200;
        const candidate: BuildInput = {
          name: "Моя сборка",
          cpuId: parsed.input.cpuId,
          gpuId: parsed.input.gpuId,
          ramGb: Number(parsed.input.ram) || 16,
          ramMhz: mhz,
          ramCl: defaultClForMhz(mhz),
          storage:
            parsed.input.storage === "hdd" || parsed.input.storage === "nvme" ? parsed.input.storage : "sata",
          resolution:
            parsed.input.resolution === "1440p" || parsed.input.resolution === "4k"
              ? parsed.input.resolution
              : "1080p",
        };
        const built = buildRecordFromInput(candidate, next.ownerId);
        if (built) {
          next.builds = [built];
          next.activeBuildId = built.id;
          next.setup.preset = built.recommendedPreset;
          next.setup.gpu = built.vendor;
        }
      }
    }
  } catch {
    /* ignore malformed legacy rating */
  }
  try {
    const rawSetup = window.localStorage.getItem(LEGACY_SETUP_KEY);
    if (rawSetup) {
      const s = JSON.parse(rawSetup) as {
        profile?: ProfileId;
        preset?: PresetId;
        gpu?: GpuVendor;
        done?: unknown;
      };
      if (s.profile === "safe" || s.profile === "recommended" || s.profile === "max") {
        next.setup.profile = s.profile;
      }
      if (s.preset === "competitive" || s.preset === "balanced" || s.preset === "quality") {
        next.setup.preset = s.preset;
      }
      if (s.gpu === "nvidia" || s.gpu === "amd" || s.gpu === "all") {
        next.setup.gpu = s.gpu;
      }
      if (Array.isArray(s.done)) {
        const ts = nowIso();
        for (const slug of s.done) {
          if (typeof slug === "string" && slug.length > 0 && slug.length <= 64) {
            next.tweaks[slug] = {
              id: makeId("twk"),
              ownerId: next.ownerId,
              slug,
              applied: true,
              fpsBefore: null,
              fpsAfter: null,
              note: "",
              createdAt: ts,
              updatedAt: ts,
            };
          }
        }
      }
    }
  } catch {
    /* ignore malformed legacy setup */
  }
  return next;
}

class LocalStorageAdapter implements StorageAdapter {
  private cache: PersistedState | null = null;
  private boundStorage = false;
  private listeners = new Set<() => void>();

  getOwnerId(): string {
    return this.getState().ownerId;
  }

  private ensureWindowListener() {
    if (this.boundStorage || typeof window === "undefined") return;
    this.boundStorage = true;
    window.addEventListener("storage", (e) => {
      if (e.key === STORE_KEY) {
        this.cache = null;
        this.emit();
      }
    });
    window.addEventListener(CHANGE_EVENT, () => {
      this.listeners.forEach((fn) => fn());
    });
  }

  private emit() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    } else {
      this.listeners.forEach((fn) => fn());
    }
  }

  subscribe(listener: () => void): () => void {
    this.ensureWindowListener();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): PersistedState {
    if (typeof window === "undefined") return defaultState(true);
    if (this.cache) return this.cache;
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) {
        const migrated = migrateLegacy(defaultState(true));
        this.persist(migrated, false);
        return migrated;
      }
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const ownerId =
        typeof parsed.ownerId === "string" && parsed.ownerId.trim() ? parsed.ownerId : LOCAL_OWNER_ID;
      const samplesDismissed = Boolean(parsed.samplesDismissed);
      const state: PersistedState = {
        schemaVersion: SCHEMA_VERSION,
        ownerId,
        activeBuildId: typeof parsed.activeBuildId === "string" ? parsed.activeBuildId : null,
        builds: Array.isArray(parsed.builds) ? parsed.builds : [],
        tweaks: parsed.tweaks && typeof parsed.tweaks === "object" ? parsed.tweaks : {},
        logs: Array.isArray(parsed.logs)
          ? parsed.logs
          : samplesDismissed
            ? []
            : SAMPLE_LOGS.map((l) => ({ ...l })),
        setup: {
          ...defaultSetup(ownerId),
          ...(parsed.setup && typeof parsed.setup === "object" ? parsed.setup : {}),
          ownerId,
        },
        samplesDismissed,
      };
      this.cache = state;
      return state;
    } catch {
      const fallback = defaultState(true);
      this.cache = fallback;
      return fallback;
    }
  }

  private persist(next: PersistedState, notify = true) {
    this.cache = next;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        /* quota exceeded or private mode — keep in-memory cache */
      }
    }
    if (notify) this.emit();
  }

  saveBuild(input: BuildInput, existingId?: string): UserBuild | null {
    const state = this.getState();
    const prev = existingId ? state.builds.find((b) => b.id === existingId) : undefined;
    const record = buildRecordFromInput(input, state.ownerId, prev);
    if (!record) return null;
    const others = state.builds.filter((b) => b.id !== record.id);
    const builds = [record, ...others].slice(0, 12);
    this.persist({
      ...state,
      activeBuildId: record.id,
      builds,
      setup: {
        ...state.setup,
        preset: record.recommendedPreset,
        gpu: record.vendor,
        updatedAt: nowIso(),
      },
    });
    return record;
  }

  setActiveBuild(id: string): void {
    const state = this.getState();
    const found = state.builds.find((b) => b.id === id);
    if (!found) return;
    this.persist({
      ...state,
      activeBuildId: found.id,
      setup: {
        ...state.setup,
        preset: found.recommendedPreset,
        gpu: found.vendor,
        updatedAt: nowIso(),
      },
    });
  }

  deleteBuild(id: string): void {
    const state = this.getState();
    const builds = state.builds.filter((b) => b.id !== id);
    const activeBuildId = state.activeBuildId === id ? (builds[0]?.id ?? null) : state.activeBuildId;
    this.persist({ ...state, builds, activeBuildId });
  }

  private getOrCreateTweak(state: PersistedState, slug: string): UserTweakRecord {
    const existing = state.tweaks[slug];
    if (existing) return existing;
    const ts = nowIso();
    return {
      id: makeId("twk"),
      ownerId: state.ownerId,
      slug,
      applied: false,
      fpsBefore: null,
      fpsAfter: null,
      note: "",
      createdAt: ts,
      updatedAt: ts,
    };
  }

  setTweakApplied(slug: string, applied: boolean): UserTweakRecord {
    const state = this.getState();
    const prev = this.getOrCreateTweak(state, slug);
    const updated: UserTweakRecord = { ...prev, applied, updatedAt: nowIso() };
    this.persist({
      ...state,
      tweaks: { ...state.tweaks, [slug]: updated },
    });
    return updated;
  }

  setTweakFps(slug: string, fpsBefore: number | null, fpsAfter: number | null, note?: string): UserTweakRecord {
    const state = this.getState();
    const prev = this.getOrCreateTweak(state, slug);
    const updated: UserTweakRecord = {
      ...prev,
      fpsBefore: sanitizeFps(fpsBefore),
      fpsAfter: sanitizeFps(fpsAfter),
      note: note !== undefined ? note.slice(0, 200) : prev.note,
      updatedAt: nowIso(),
    };
    this.persist({
      ...state,
      tweaks: { ...state.tweaks, [slug]: updated },
    });
    return updated;
  }

  resetTweakProgress(): void {
    const state = this.getState();
    this.persist({ ...state, tweaks: {} });
  }

  addLog(entry: NewBenchmarkLog): BenchmarkLog {
    const state = this.getState();
    const ts = nowIso();
    const record: BenchmarkLog = {
      id: makeId("log"),
      ownerId: state.ownerId,
      createdAt: ts,
      updatedAt: ts,
      title: entry.title.trim().slice(0, 120) || "Замер без названия",
      tweakSlug: entry.tweakSlug || null,
      serverKind: sanitizeServerKind(entry.serverKind),
      scene: entry.scene.trim().slice(0, 160) || "Обычная сцена",
      beforeAvg: Math.max(1, Math.round(entry.beforeAvg * 10) / 10),
      afterAvg: Math.max(1, Math.round(entry.afterAvg * 10) / 10),
      beforeLow1: Math.max(1, Math.round(entry.beforeLow1 * 10) / 10),
      afterLow1: Math.max(1, Math.round(entry.afterLow1 * 10) / 10),
      beforeFrametime: Math.max(0.5, Math.round(entry.beforeFrametime * 10) / 10),
      afterFrametime: Math.max(0.5, Math.round(entry.afterFrametime * 10) / 10),
      notes: (entry.notes || "").trim().slice(0, 260),
      isSample: false,
    };
    this.persist({
      ...state,
      logs: [record, ...state.logs].slice(0, 200),
    });
    return record;
  }

  updateLog(id: string, patch: Partial<NewBenchmarkLog>): BenchmarkLog | null {
    const state = this.getState();
    const idx = state.logs.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    const prev = state.logs[idx];
    const updated: BenchmarkLog = {
      ...prev,
      ...patch,
      id: prev.id,
      ownerId: prev.ownerId,
      createdAt: prev.createdAt,
      updatedAt: nowIso(),
      isSample: false,
    };
    const logs = [...state.logs];
    logs[idx] = updated;
    this.persist({ ...state, logs });
    return updated;
  }

  deleteLog(id: string): void {
    const state = this.getState();
    const remaining = state.logs.filter((l) => l.id !== id);
    const hasSamples = remaining.some((l) => l.isSample);
    this.persist({
      ...state,
      logs: remaining,
      samplesDismissed: state.samplesDismissed || !hasSamples,
    });
  }

  clearSampleLogs(): void {
    const state = this.getState();
    this.persist({
      ...state,
      logs: state.logs.filter((l) => !l.isSample),
      samplesDismissed: true,
    });
  }

  clearAllLogs(): void {
    const state = this.getState();
    this.persist({ ...state, logs: [], samplesDismissed: true });
  }

  restoreSampleLogs(): void {
    const state = this.getState();
    const custom = state.logs.filter((l) => !l.isSample);
    this.persist({
      ...state,
      logs: [...custom, ...SAMPLE_LOGS.map((l) => ({ ...l, ownerId: state.ownerId }))],
      samplesDismissed: false,
    });
  }

  /** Восстановление удалённых записей (undo) с сохранением исходных id. */
  restoreLogs(entries: BenchmarkLog[]): void {
    if (!Array.isArray(entries) || entries.length === 0) return;
    const state = this.getState();
    const ids = new Set(state.logs.map((l) => l.id));
    const fresh = entries.filter(
      (l): l is BenchmarkLog =>
        Boolean(l) && typeof l.id === "string" && !ids.has(l.id),
    );
    if (fresh.length === 0) return;
    const merged = [...state.logs, ...fresh].slice(0, 200);
    const hasSamples = merged.some((l) => l.isSample);
    this.persist({
      ...state,
      logs: merged,
      samplesDismissed: state.samplesDismissed && !hasSamples,
    });
  }

  updateSetup(patch: Partial<Pick<SetupPreferences, "profile" | "preset" | "gpu" | "protocolChecks">>): void {
    const state = this.getState();
    this.persist({
      ...state,
      setup: {
        ...state.setup,
        ...patch,
        ownerId: state.ownerId,
        updatedAt: nowIso(),
      },
    });
  }

  exportBundle(): ExportBundle {
    const state = this.getState();
    const myBuild =
      state.builds.find((b) => b.id === state.activeBuildId) ?? state.builds[0] ?? null;
    const appliedTweaks = Object.values(state.tweaks).filter(
      (t) => t.applied || t.fpsBefore !== null || t.fpsAfter !== null || Boolean(t.note),
    );
    return {
      app: "RustFlow",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      ownerId: state.ownerId,
      activeBuildId: myBuild?.id ?? null,
      myBuild,
      builds: state.builds,
      appliedTweaks,
      logs: state.logs,
      setup: state.setup,
    };
  }

  validateImport(rawJson: string): { ok: true; preview: ImportPreview } | { ok: false; error: string } {
    const trimmed = rawJson.trim();
    if (!trimmed) return { ok: false, error: "Вставьте JSON или выберите файл резервной копии." };
    if (trimmed.length > 1_500_000) {
      return { ok: false, error: "Файл слишком большой (максимум 1,5 МБ)." };
    }
    let parsed: Record<string, unknown>;
    try {
      const v = JSON.parse(trimmed);
      if (!v || typeof v !== "object" || Array.isArray(v)) {
        return { ok: false, error: "Корневой элемент JSON должен быть объектом." };
      }
      parsed = v as Record<string, unknown>;
    } catch {
      return { ok: false, error: "Синтаксическая ошибка JSON. Проверьте скобки и кавычки." };
    }

    if (parsed.app !== "RustFlow") {
      return { ok: false, error: "Это не файл RustFlow (ожидается поле \"app\": \"RustFlow\")." };
    }

    const ownerId =
      typeof parsed.ownerId === "string" && parsed.ownerId.trim()
        ? parsed.ownerId.trim().slice(0, 64)
        : LOCAL_OWNER_ID;

    // Валидируем и пересчитываем сборки
    const validBuilds: UserBuild[] = [];
    const rawBuilds = Array.isArray(parsed.builds)
      ? parsed.builds
      : parsed.myBuild
        ? [parsed.myBuild]
        : [];
    for (const item of rawBuilds.slice(0, 12)) {
      if (!item || typeof item !== "object") continue;
      const b = item as Partial<UserBuild>;
      if (!isValidBuildInput(b.input)) continue;
      const rebuilt = buildRecordFromInput(b.input, ownerId, {
        id: typeof b.id === "string" && b.id ? b.id.slice(0, 64) : makeId("build"),
        ownerId: typeof b.ownerId === "string" && b.ownerId ? b.ownerId.slice(0, 64) : ownerId,
        createdAt: typeof b.createdAt === "string" ? b.createdAt : nowIso(),
        updatedAt: nowIso(),
        input: b.input,
        score10: 0,
        verdictLabel: "",
        fpsModded: [0, 0],
        fpsOfficial: [0, 0],
        recommendedPreset: "balanced",
        vendor: "all",
      });
      if (rebuilt && !validBuilds.some((x) => x.id === rebuilt.id)) validBuilds.push(rebuilt);
    }

    // Валидируем твики
    const validTweaks: UserTweakRecord[] = [];
    if (Array.isArray(parsed.appliedTweaks)) {
      for (const item of parsed.appliedTweaks.slice(0, 100)) {
        if (!item || typeof item !== "object") continue;
        const t = item as Partial<UserTweakRecord>;
        if (typeof t.slug !== "string" || !/^[a-z0-9-]{1,64}$/.test(t.slug)) continue;
        const ts = nowIso();
        validTweaks.push({
          id: typeof t.id === "string" && t.id ? t.id.slice(0, 64) : makeId("twk"),
          ownerId: typeof t.ownerId === "string" && t.ownerId ? t.ownerId.slice(0, 64) : ownerId,
          slug: t.slug,
          applied: Boolean(t.applied),
          fpsBefore: sanitizeFps(t.fpsBefore),
          fpsAfter: sanitizeFps(t.fpsAfter),
          note: typeof t.note === "string" ? t.note.slice(0, 200) : "",
          createdAt: typeof t.createdAt === "string" ? t.createdAt : ts,
          updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : ts,
        });
      }
    }

    // Валидируем журнал
    const validLogs: BenchmarkLog[] = [];
    if (Array.isArray(parsed.logs)) {
      for (const item of parsed.logs.slice(0, 200)) {
        if (!item || typeof item !== "object") continue;
        const l = item as Partial<BenchmarkLog>;
        const bAvg = sanitizeFps(l.beforeAvg);
        const aAvg = sanitizeFps(l.afterAvg);
        const bLow = sanitizeFps(l.beforeLow1);
        const aLow = sanitizeFps(l.afterLow1);
        if (!bAvg || !aAvg || !bLow || !aLow) continue;
        const bFt = sanitizeFps(l.beforeFrametime) ?? Math.round((1000 / bAvg) * 10) / 10;
        const aFt = sanitizeFps(l.afterFrametime) ?? Math.round((1000 / aAvg) * 10) / 10;
        const ts = nowIso();
        validLogs.push({
          id: typeof l.id === "string" && l.id ? l.id.slice(0, 64) : makeId("log"),
          ownerId: typeof l.ownerId === "string" && l.ownerId ? l.ownerId.slice(0, 64) : ownerId,
          createdAt: typeof l.createdAt === "string" ? l.createdAt : ts,
          updatedAt: typeof l.updatedAt === "string" ? l.updatedAt : ts,
          title: typeof l.title === "string" && l.title.trim() ? l.title.trim().slice(0, 120) : "Замер",
          tweakSlug: typeof l.tweakSlug === "string" && l.tweakSlug ? l.tweakSlug.slice(0, 64) : null,
          serverKind: sanitizeServerKind(l.serverKind),
          scene: typeof l.scene === "string" ? l.scene.trim().slice(0, 160) : "Сцена не указана",
          beforeAvg: bAvg,
          afterAvg: aAvg,
          beforeLow1: bLow,
          afterLow1: aLow,
          beforeFrametime: bFt,
          afterFrametime: aFt,
          notes: typeof l.notes === "string" ? l.notes.slice(0, 260) : "",
          isSample: Boolean(l.isSample),
        });
      }
    }

    if (validBuilds.length === 0 && validTweaks.length === 0 && validLogs.length === 0) {
      return { ok: false, error: "В файле не найдено корректных сборок, отметок твиков или записей журнала." };
    }

    const rawSetup = (parsed.setup && typeof parsed.setup === "object"
      ? parsed.setup
      : {}) as Partial<SetupPreferences>;
    const setup: SetupPreferences = {
      ownerId,
      profile:
        rawSetup.profile === "safe" || rawSetup.profile === "recommended" || rawSetup.profile === "max"
          ? rawSetup.profile
          : "recommended",
      preset:
        rawSetup.preset === "competitive" || rawSetup.preset === "balanced" || rawSetup.preset === "quality"
          ? rawSetup.preset
          : "balanced",
      gpu: rawSetup.gpu === "nvidia" || rawSetup.gpu === "amd" || rawSetup.gpu === "all" ? rawSetup.gpu : "all",
      protocolChecks: Array.isArray(rawSetup.protocolChecks)
        ? rawSetup.protocolChecks.filter((x): x is string => typeof x === "string").slice(0, 20)
        : [],
      updatedAt: nowIso(),
    };

    const activeId =
      typeof parsed.activeBuildId === "string" && validBuilds.some((b) => b.id === parsed.activeBuildId)
        ? parsed.activeBuildId
        : (validBuilds[0]?.id ?? null);
    const myBuild = validBuilds.find((b) => b.id === activeId) ?? validBuilds[0] ?? null;

    const bundle: ExportBundle = {
      app: "RustFlow",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : nowIso(),
      ownerId,
      activeBuildId: activeId,
      myBuild,
      builds: validBuilds,
      appliedTweaks: validTweaks,
      logs: validLogs,
      setup,
    };

    return {
      ok: true,
      preview: {
        bundle,
        buildsCount: validBuilds.length,
        appliedCount: validTweaks.filter((t) => t.applied).length,
        measuredTweaksCount: validTweaks.filter((t) => t.fpsBefore !== null && t.fpsAfter !== null).length,
        logsCount: validLogs.length,
        myBuildTitle: myBuild ? `${myBuild.input.name} (${myBuild.score10}/10)` : null,
      },
    };
  }

  applyImport(bundle: ExportBundle, mode: "replace" | "merge"): void {
    const current = this.getState();
    const ownerId = current.ownerId || bundle.ownerId || LOCAL_OWNER_ID;

    if (mode === "replace") {
      const tweaksMap: Record<string, UserTweakRecord> = {};
      for (const t of bundle.appliedTweaks) {
        tweaksMap[t.slug] = { ...t, ownerId };
      }
      this.persist({
        schemaVersion: SCHEMA_VERSION,
        ownerId,
        activeBuildId: bundle.activeBuildId,
        builds: bundle.builds.map((b) => ({ ...b, ownerId })),
        tweaks: tweaksMap,
        logs: bundle.logs.map((l) => ({ ...l, ownerId })),
        setup: { ...bundle.setup, ownerId, updatedAt: nowIso() },
        samplesDismissed: true,
      });
      return;
    }

    // Режим merge: объединяем записи без потери существующих
    const mergedTweaks: Record<string, UserTweakRecord> = { ...current.tweaks };
    for (const t of bundle.appliedTweaks) {
      mergedTweaks[t.slug] = { ...t, ownerId };
    }
    const buildMap = new Map<string, UserBuild>();
    for (const b of [...bundle.builds, ...current.builds]) {
      if (!buildMap.has(b.id)) buildMap.set(b.id, { ...b, ownerId });
    }
    const logMap = new Map<string, BenchmarkLog>();
    for (const l of [...bundle.logs, ...current.logs]) {
      if (!logMap.has(l.id)) logMap.set(l.id, { ...l, ownerId });
    }
    const builds = Array.from(buildMap.values()).slice(0, 12);
    this.persist({
      ...current,
      builds,
      activeBuildId: bundle.activeBuildId ?? current.activeBuildId ?? builds[0]?.id ?? null,
      tweaks: mergedTweaks,
      logs: Array.from(logMap.values()).slice(0, 200),
      samplesDismissed: true,
    });
  }

  resetAll(): void {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LEGACY_RATING_KEY);
        window.localStorage.removeItem(LEGACY_SETUP_KEY);
      } catch {
        /* ignore */
      }
    }
    this.persist(defaultState(false));
  }
}

/** Единственный экземпляр адаптера хранилища (в Этапе 2 заменяется на BaaS-адаптер). */
export const storage: StorageAdapter = new LocalStorageAdapter();
