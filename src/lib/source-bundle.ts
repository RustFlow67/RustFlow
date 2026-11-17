import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { APP_KIT_FILES, getAppKitFile, type AppKitGroup } from "@/lib/app-kit";
import { createZip, type ZipEntry } from "@/lib/zip";

/**
 * Гарантированный белый список бинарных ассетов.
 * Эти файлы ОБЯЗАНЫ попасть в каждый архив (full / site): шрифты с кириллицей,
 * фоновое и hero-изображения, иконка и favicon. Пути совпадают 1-в-1 с
 * @font-face в src/app/globals.css и с разметкой страниц.
 */
export const REQUIRED_BINARY_ASSETS = [
  "public/fonts/manrope-cyrillic-wght-normal.woff2",
  "public/fonts/manrope-latin-wght-normal.woff2",
  "public/fonts/unbounded-cyrillic-wght-normal.woff2",
  "public/fonts/unbounded-latin-wght-normal.woff2",
  "public/fonts/jetbrains-mono-cyrillic-wght-normal.woff2",
  "public/fonts/jetbrains-mono-latin-wght-normal.woff2",
  "public/images/hero.jpg",
  "public/images/wallpaper.jpg",
  "public/icon.svg",
  "public/favicon.ico",
  "src/app/icon.svg",
] as const;

export interface AssetManifestRow {
  /** Путь в проекте и в архиве. */
  path: string;
  /** Публичный URL на работающем сайте (для ручного сохранения). */
  url: string;
  size: number;
  kind: "font" | "image" | "icon";
  exists: boolean;
}

/** Манифест бинарных ассетов: путь → размер → публичный URL. */
export function getAssetManifest(): AssetManifestRow[] {
  const rootDir = process.cwd();
  return REQUIRED_BINARY_ASSETS.map((rel) => {
    const abs = path.join(rootDir, rel);
    const exists = existsSync(abs) && statSync(abs).isFile();
    const ext = path.posix.extname(rel).toLowerCase();
    const isFont = ext === ".woff2" || ext === ".woff";
    const isIcon = ext === ".ico" || rel.includes("icon.svg");
    // public/x → /x ; src/app/icon.svg → /icon.svg
    const url = rel.startsWith("public/")
      ? `/${rel.slice("public/".length)}`
      : rel === "src/app/icon.svg"
        ? "/icon.svg"
        : `/${rel}`;
    return {
      path: rel,
      url,
      size: exists ? statSync(abs).size : 0,
      kind: isFont ? ("font" as const) : isIcon ? ("icon" as const) : ("image" as const),
      exists,
    };
  });
}

export type BundleMode = "full" | "site" | "app-kit";

export type SiteFolderGroup =
  | "root"
  | "app"
  | "api"
  | "components"
  | "lib"
  | "tweaks"
  | "db"
  | "public";

export interface SiteFileMeta {
  path: string;
  size: number;
  binary: boolean;
  group: SiteFolderGroup;
}

export interface KitFileMeta {
  path: string;
  title: string;
  description: string;
  language: string;
  size: number;
  group: AppKitGroup;
}

export interface ProjectManifest {
  siteFiles: SiteFileMeta[];
  kitFiles: KitFileMeta[];
  siteTotalBytes: number;
  siteTextFilesCount: number;
  kitTotalBytes: number;
}

const ROOT_ALLOWLIST = [
  "README.md",
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "drizzle.config.json",
  ".env.example",
  "Dockerfile",
  "docker-compose.yml",
] as const;

const DIR_ALLOWLIST = ["src", "public"] as const;

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".json",
  ".md",
  ".svg",
  ".sql",
  ".yml",
  ".yaml",
  ".toml",
  ".rs",
  ".example",
  ".txt",
]);

const BINARY_EXTENSIONS = new Set([".woff2", ".woff", ".ttf", ".jpg", ".jpeg", ".png", ".webp", ".ico"]);

const GITIGNORE_CONTENT = `# Dependencies & build
node_modules/
.next/
out/
dist-desktop/
src-tauri/target/
tsconfig.tsbuildinfo

# Secrets (NEVER commit)
.env
.env.local
.env.*.local

# OS
.DS_Store
Thumbs.db
`;

function isTextPath(relPath: string): boolean {
  const base = path.posix.basename(relPath);
  if (base === "Dockerfile" || base === ".env.example" || base === ".gitignore") return true;
  const ext = path.posix.extname(base).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function isAllowedExtension(relPath: string): boolean {
  if (isTextPath(relPath)) return true;
  const ext = path.posix.extname(relPath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function classifySiteGroup(relPath: string): SiteFolderGroup {
  if (relPath.startsWith("src/app/api/")) return "api";
  if (relPath.startsWith("src/app/")) return "app";
  if (relPath.startsWith("src/components/")) return "components";
  if (relPath.startsWith("src/lib/tweaks/")) return "tweaks";
  if (relPath.startsWith("src/lib/")) return "lib";
  if (relPath.startsWith("src/db/")) return "db";
  if (relPath.startsWith("public/")) return "public";
  return "root";
}

function walkAllowedDir(rootDir: string, relDir: string, out: SiteFileMeta[]): void {
  const absDir = path.join(rootDir, relDir);
  if (!existsSync(absDir)) return;
  const entries = readdirSync(absDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    // Никогда не включаем скрытые файлы, секреты и служебные каталоги
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules" || entry.name === "qa-shots") continue;
    const rel = `${relDir}/${entry.name}`;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      walkAllowedDir(rootDir, rel, out);
    } else if (entry.isFile() && isAllowedExtension(rel)) {
      const st = statSync(abs);
      out.push({
        path: rel,
        size: st.size,
        binary: !isTextPath(rel),
        group: classifySiteGroup(rel),
      });
    }
  }
}

/** Сканирует все разрешённые исходники сайта без секретов (.env исключён). */
export function collectSiteFiles(): SiteFileMeta[] {
  const rootDir = process.cwd();
  const files: SiteFileMeta[] = [];

  for (const name of ROOT_ALLOWLIST) {
    const abs = path.join(rootDir, name);
    if (existsSync(abs) && statSync(abs).isFile()) {
      files.push({
        path: name,
        size: statSync(abs).size,
        binary: false,
        group: "root",
      });
    }
  }

  for (const dir of DIR_ALLOWLIST) {
    walkAllowedDir(rootDir, dir, files);
  }

  return files;
}

export function getProjectManifest(): ProjectManifest {
  const siteFiles = collectSiteFiles();
  const kitFiles: KitFileMeta[] = APP_KIT_FILES.map((f) => ({
    path: f.path,
    title: f.title,
    description: f.description,
    language: f.language,
    size: Buffer.byteLength(f.content, "utf8"),
    group: f.group,
  }));

  return {
    siteFiles,
    kitFiles,
    siteTotalBytes: siteFiles.reduce((s, f) => s + f.size, 0),
    siteTextFilesCount: siteFiles.filter((f) => !f.binary).length,
    kitTotalBytes: kitFiles.reduce((s, f) => s + f.size, 0),
  };
}

/** Безопасное чтение текстового файла сайта (строго по белому списку) или App Kit. */
export function readInspectableFile(
  source: "site" | "kit",
  relPath: string,
): { path: string; content: string; size: number } | null {
  if (source === "kit") {
    const item = getAppKitFile(relPath);
    if (!item) return null;
    return {
      path: item.path,
      content: item.content,
      size: Buffer.byteLength(item.content, "utf8"),
    };
  }

  const allowed = collectSiteFiles().find((f) => f.path === relPath && !f.binary);
  if (!allowed) return null;
  const rootDir = process.cwd();
  const resolved = path.resolve(rootDir, allowed.path);
  if (!resolved.startsWith(path.resolve(rootDir) + path.sep)) return null;
  const content = readFileSync(resolved, "utf8");
  return { path: allowed.path, content, size: Buffer.byteLength(content, "utf8") };
}

/** Собирает готовый ZIP-архив: полный комплект, только сайт или только App Kit. */
export function buildSourceZip(mode: BundleMode): {
  filename: string;
  buffer: Buffer;
  fileCount: number;
  byteLength: number;
} {
  const rootDir = process.cwd();
  const entries: ZipEntry[] = [];

  const prefix =
    mode === "full"
      ? "RustFlow-Complete"
      : mode === "site"
        ? "RustFlow-Site"
        : "RustFlow-App-Kit";

  const pushFile = (rel: string, store: boolean) => {
    const abs = path.join(rootDir, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) return false;
    entries.push({ name: `${prefix}/${rel}`, data: readFileSync(abs), store });
    return true;
  };

  if (mode === "full" || mode === "site") {
    const siteFiles = collectSiteFiles();
    entries.push({
      name: `${prefix}/.gitignore`,
      data: Buffer.from(GITIGNORE_CONTENT, "utf8"),
    });
    for (const file of siteFiles) {
      // Бинарники (woff2/jpg/png/ico) кладём методом store — байты 1-в-1,
      // поэтому ни один распаковщик не сможет их повредить или потерять.
      pushFile(file.path, file.binary);
    }

    // Страховка: даже если обход каталога что-то пропустил, ассеты добавляются явно.
    const added = new Set(entries.map((e) => e.name));
    for (const rel of REQUIRED_BINARY_ASSETS) {
      if (!added.has(`${prefix}/${rel}`)) pushFile(rel, !isTextPath(rel));
    }
  }

  if (mode === "full" || mode === "app-kit") {
    if (mode === "app-kit") {
      for (const extra of ["README.md", ".env.example", "Dockerfile", "docker-compose.yml"]) {
        const abs = path.join(rootDir, extra);
        if (existsSync(abs)) {
          entries.push({
            name: `${prefix}/${extra}`,
            data: readFileSync(abs),
          });
        }
      }
    }
    for (const kit of APP_KIT_FILES) {
      entries.push({
        name: `${prefix}/${kit.path}`,
        data: Buffer.from(kit.content, "utf8"),
      });
    }
  }

  const filename =
    mode === "full"
      ? "RustFlow-Complete-Edition.zip"
      : mode === "site"
        ? "RustFlow-Site-Source.zip"
        : "RustFlow-Full-App-Kit.zip";

  const zip = createZip(entries, { includeDirs: true });

  return {
    filename,
    buffer: zip,
    fileCount: entries.length,
    byteLength: zip.length,
  };
}
