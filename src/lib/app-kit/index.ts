import { CLOUD_AND_DEPLOY_FILES } from "./cloud-and-deploy";
import { DESKTOP_KIT_FILES, type AppKitFile, type AppKitGroup } from "./desktop";

export type { AppKitFile, AppKitGroup };

export interface AppKitGroupMeta {
  id: AppKitGroup;
  title: string;
  shortTitle: string;
  description: string;
}

export const APP_KIT_GROUPS: AppKitGroupMeta[] = [
  {
    id: "guide",
    title: "Главное руководство",
    shortTitle: "Гайд",
    description: "Пошаговый план от локального запуска сайта до .exe, облака и подписи кода.",
  },
  {
    id: "tauri",
    title: "Tauri v2 + Rust (.exe)",
    shortTitle: "Tauri .exe",
    description: "Флагманское нативное Windows-приложение (~8 МБ): детект железа, client.cfg, UAC и мост.",
  },
  {
    id: "electron",
    title: "Electron + Node.js (.exe)",
    shortTitle: "Electron .exe",
    description: "Альтернативная сборка Setup.exe и Portable.exe на чистом JavaScript без Rust.",
  },
  {
    id: "cloud",
    title: "Облако и БД (Этап 2)",
    shortTitle: "Облако / БД",
    description: "SQL-схема PostgreSQL/Supabase с RLS, offline-first CloudStorageAdapter и /api/sync.",
  },
  {
    id: "deploy",
    title: "Деплой на VPS / Nginx",
    shortTitle: "VPS / Nginx",
    description: "Конфигурация Nginx с HTTPS/кэшем и systemd-сервис (Docker уже в корне сайта).",
  },
];

export const APP_KIT_FILES: AppKitFile[] = [...CLOUD_AND_DEPLOY_FILES.filter((f) => f.group === "guide"), ...DESKTOP_KIT_FILES, ...CLOUD_AND_DEPLOY_FILES.filter((f) => f.group !== "guide")];

const KIT_BY_PATH = new Map(APP_KIT_FILES.map((f) => [f.path, f]));

export function getAppKitFile(path: string): AppKitFile | undefined {
  return KIT_BY_PATH.get(path);
}
