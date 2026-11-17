"use client";

import {
  Check,
  Cloud,
  Code2,
  Copy,
  Cpu,
  Download,
  FileCode2,
  Fingerprint,
  FolderGit2,
  Globe,
  HardDrive,
  Image as ImageIcon,
  Laptop,
  Package,
  Rocket,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import CodeBlock from "@/components/CodeBlock";
import DownloadButton from "@/components/DownloadButton";
import Segmented from "@/components/Segmented";
import { useToast } from "@/components/ui/Toast";
import { APP_KIT_GROUPS, type AppKitGroup } from "@/lib/app-kit";
import type { AssetManifestRow, ProjectManifest, SiteFolderGroup } from "@/lib/source-bundle";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type ExplorerTab = "site" | "kit";
type GuideTab = "local" | "tauri" | "electron" | "deploy" | "eac";

const SITE_GROUPS: { value: "all" | SiteFolderGroup; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "root", label: "Корень / Docker" },
  { value: "app", label: "Страницы" },
  { value: "components", label: "Компоненты" },
  { value: "lib", label: "Модели / Lib" },
  { value: "tweaks", label: "Твики" },
  { value: "api", label: "API" },
  { value: "db", label: "БД Drizzle" },
  { value: "public", label: "Шрифты / Медиа" },
];

const KIT_GROUPS: { value: "all" | AppKitGroup; label: string }[] = [
  { value: "all", label: "Все" },
  ...APP_KIT_GROUPS.map((g) => ({ value: g.id, label: g.shortTitle })),
];

const CUSTOMIZE_MAP = [
  {
    what: "Название сайта, логотип, мета-теги и OG",
    where: "src/app/layout.tsx · src/components/Nav.tsx · src/components/Footer.tsx",
    openPath: "src/app/layout.tsx",
  },
  {
    what: "Дизайн Liquid Glass iOS 26, тёмная и светлая палитра",
    where: "src/app/globals.css",
    openPath: "src/app/globals.css",
  },
  {
    what: "Все 32 твика, .reg/.bat генераторы и пресеты client.cfg",
    where: "src/lib/tweaks/windows.ts · game.ts · other.ts · extras.ts",
    openPath: "src/lib/tweaks/game.ts",
  },
  {
    what: "Формула и веса оценки ПК /10 + база CPU и GPU",
    where: "src/lib/models/build.ts · src/lib/hardware.ts",
    openPath: "src/lib/models/build.ts",
  },
  {
    what: "Референсные пресеты железа (5600X + RTX 5060 и др.)",
    where: "src/lib/models/preset.ts",
    openPath: "src/lib/models/preset.ts",
  },
  {
    what: "Хранилище пользователя (localStorage → облако)",
    where: "src/lib/storage/adapter.ts",
    openPath: "src/lib/storage/adapter.ts",
  },
];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} КБ`;
  return `${(kb / 1024).toFixed(2)} МБ`;
}

export default function DevHub({
  manifest,
  assets,
  initialSiteFile,
  initialKitFile,
}: {
  manifest: ProjectManifest;
  assets: AssetManifestRow[];
  initialSiteFile: { path: string; content: string };
  initialKitFile: { path: string; content: string };
}) {
  const { toast } = useToast();

  // Explorer state
  const [tab, setTab] = useState<ExplorerTab>("site");
  const [siteGroup, setSiteGroup] = useState<"all" | SiteFolderGroup>("all");
  const [kitGroup, setKitGroup] = useState<"all" | AppKitGroup>("all");
  const [query, setQuery] = useState("");
  const [selectedSitePath, setSelectedSitePath] = useState(initialSiteFile.path);
  const [selectedKitPath, setSelectedKitPath] = useState(initialKitFile.path);
  const [cache, setCache] = useState<Record<string, string>>(() => ({
    [`site:${initialSiteFile.path}`]: initialSiteFile.content,
    [`kit:${initialKitFile.path}`]: initialKitFile.content,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copiedCode, setCopiedCode] = useState(false);

  // Roadmap tab
  const [guideTab, setGuideTab] = useState<GuideTab>("local");

  // PWA install & Service Worker
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration("/sw.js").then((reg) => {
        if (reg) setSwReady(true);
      }).catch(() => {});
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const activePath = tab === "site" ? selectedSitePath : selectedKitPath;
  const activeKey = `${tab}:${activePath}`;
  const activeContent = cache[activeKey];

  const activeKitMeta = useMemo(
    () => (tab === "kit" ? manifest.kitFiles.find((f) => f.path === selectedKitPath) : undefined),
    [tab, manifest.kitFiles, selectedKitPath],
  );
  const activeSiteMeta = useMemo(
    () => (tab === "site" ? manifest.siteFiles.find((f) => f.path === selectedSitePath) : undefined),
    [tab, manifest.siteFiles, selectedSitePath],
  );

  const isBinaryActive = tab === "site" && Boolean(activeSiteMeta?.binary);
  const loadError = errors[activeKey] ?? null;
  const isLoading = activeContent === undefined && !isBinaryActive && !loadError;

  // Загружает выбранный файл с сервера, если его ещё нет в кэше
  useEffect(() => {
    if (activeContent !== undefined || isBinaryActive || loadError) return;
    let cancelled = false;

    const url = `/api/source?source=${tab}&file=${encodeURIComponent(activePath)}`;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error("Не удалось загрузить файл");
        return (await res.json()) as { content: string };
      })
      .then((data) => {
        if (cancelled) return;
        setCache((prev) => ({ ...prev, [activeKey]: data.content }));
      })
      .catch(() => {
        if (cancelled) return;
        setErrors((prev) => ({
          ...prev,
          [activeKey]: "Не удалось загрузить содержимое файла. Попробуйте ещё раз.",
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [activeKey, activeContent, activePath, tab, isBinaryActive, loadError]);

  const filteredSiteFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return manifest.siteFiles.filter((f) => {
      if (siteGroup !== "all" && f.group !== siteGroup) return false;
      if (q && !f.path.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [manifest.siteFiles, siteGroup, query]);

  const filteredKitFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return manifest.kitFiles.filter((f) => {
      if (kitGroup !== "all" && f.group !== kitGroup) return false;
      if (
        q &&
        !f.path.toLowerCase().includes(q) &&
        !f.title.toLowerCase().includes(q) &&
        !f.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [manifest.kitFiles, kitGroup, query]);

  async function copyActiveFile() {
    if (!activeContent) return;
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopiedCode(true);
      toast({
        title: "Код файла скопирован",
        description: activePath,
        tone: "success",
      });
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      toast({ title: "Буфер обмена недоступен", tone: "error" });
    }
  }

  function jumpToFile(nextTab: ExplorerTab, filePath: string) {
    setTab(nextTab);
    setQuery("");
    if (nextTab === "site") {
      setSiteGroup("all");
      setSelectedSitePath(filePath);
    } else {
      setKitGroup("all");
      setSelectedKitPath(filePath);
    }
    document.getElementById("code-explorer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleInstallPwa() {
    try {
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw.js");
        setSwReady(true);
      }
      if (installPrompt) {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === "accepted") {
          toast({ title: "RustFlow установлен как приложение", tone: "success" });
          setInstallPrompt(null);
        }
      } else {
        toast({
          title: "Офлайн-кэш PWA активирован",
          description:
            "Нажмите иконку «Установить приложение» в адресной строке Chrome/Edge или «Поделиться → На экран Домой» в Safari.",
          tone: "info",
          durationMs: 5500,
        });
      }
    } catch {
      toast({
        title: "Откройте меню браузера → «Установить приложение»",
        tone: "info",
      });
    }
  }

  const totalFullCount = manifest.siteFiles.length + manifest.kitFiles.length + 1;
  const totalFullBytes = manifest.siteTotalBytes + manifest.kitTotalBytes;
  const lineCount = activeContent ? activeContent.replace(/\n$/, "").split("\n").length : 0;

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* ==================== 1. КАРТОЧКИ СКАЧИВАНИЯ ZIP ==================== */}
      <section aria-labelledby="bundles-heading">
        <h2 id="bundles-heading" className="sr-only">
          Скачать архивы с исходным кодом и App Kit
        </h2>
        <div className="grid gap-4 lg:grid-cols-3" data-stagger>
          {/* Главный полный архив */}
          <article className="glass glass-accent glass-hover tilt-3d sweep flex flex-col p-6" data-reveal data-tilt>
            <div className="flex items-start justify-between gap-3">
              <span
                className="icon-tile"
                style={{ "--c1": "#ffba6b", "--c2": "#ff5722" } as CSSProperties}
              >
                <Package aria-hidden="true" />
              </span>
              <span className="chip chip-accent">
                <Sparkles aria-hidden="true" />
                Вариант 1 · Всё в одном
              </span>
            </div>

            <h3 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
              Полный комплект: Сайт + Приложение
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Весь исходный код этого сайта (Liquid Glass iOS 26, тёмная и светлая темы, шрифты, все 32 твика, 7
              пресетов, Сборка /10, журнал, FPS-лаб, ZIP-генератор) <strong>плюс</strong> Tauri v2 (.exe), Electron
              (.exe), Docker, Nginx, SQL-схема облака и русский гайд.
            </p>

            <div className="well mt-4 grid grid-cols-2 gap-2 p-3 text-center text-xs">
              <div>
                <strong className="block text-base font-extrabold tabular-nums text-ink">
                  {totalFullCount}
                </strong>
                <span className="text-ink-3">файлов в архиве</span>
              </div>
              <div>
                <strong className="block text-base font-extrabold tabular-nums text-ink">
                  {fmtSize(totalFullBytes)}
                </strong>
                <span className="text-ink-3">исходников + ассетов</span>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-2">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-none text-ok" aria-hidden="true" />
                Распаковал → <code className="font-mono text-ink">npm install && npm run dev</code>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-none text-ok" aria-hidden="true" />
                Сборка Windows <code className="font-mono text-ink">Setup.exe</code> (Tauri / Electron)
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-none text-ok" aria-hidden="true" />
                Ноль секретов: <code className="font-mono text-ink">.env.example</code> и <code className="font-mono text-ink">.gitignore</code>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-none text-ok" aria-hidden="true" />
                Все бинарники внутри: 6 шрифтов, <code className="font-mono text-ink">hero.jpg</code>,{" "}
                <code className="font-mono text-ink">wallpaper.jpg</code>, <code className="font-mono text-ink">icon.svg</code>,{" "}
                <code className="font-mono text-ink">favicon.ico</code>
              </li>
            </ul>

            <div className="mt-auto pt-5">
              <DownloadButton
                href="/api/source?download=full"
                label="Скачать всё (Complete ZIP)"
                variant="primary"
                size="lg"
                className="w-full"
              />
            </div>
          </article>

          {/* Только код сайта */}
          <article className="glass glass-hover tilt-3d flex flex-col p-6" data-reveal data-tilt>
            <div className="flex items-start justify-between gap-3">
              <span
                className="icon-tile"
                style={{ "--c1": "#38bdf8", "--c2": "#2563eb" } as CSSProperties}
              >
                <Globe aria-hidden="true" />
              </span>
              <span className="chip chip-measured">Next.js 16 + TS</span>
            </div>

            <h3 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
              Исходный код этого сайта
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Чистый проект веб-сайта со всем материалом: 32 твика с инструкциями и откатами, оценщик ПК /10, база
              CPU/GPU, пресеты, журнал FPS, мифы/EAC, PWA-манифест, Dockerfile и docker-compose.yml.
            </p>

            <div className="well mt-4 grid grid-cols-2 gap-2 p-3 text-center text-xs">
              <div>
                <strong className="block text-base font-extrabold tabular-nums text-ink">
                  {manifest.siteFiles.length + 1}
                </strong>
                <span className="text-ink-3">файлов сайта</span>
              </div>
              <div>
                <strong className="block text-base font-extrabold tabular-nums text-ink">
                  {fmtSize(manifest.siteTotalBytes)}
                </strong>
                <span className="text-ink-3">включая шрифты и фото</span>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-2">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-none text-ok" aria-hidden="true" />
                Деплой на Vercel, Railway или свой VPS (Docker)
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-none text-ok" aria-hidden="true" />
                Кириллические шрифты Unbounded + Manrope + JB Mono
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-none text-ok" aria-hidden="true" />
                Готовый PWA (ставится на рабочий стол и телефон)
              </li>
            </ul>

            <div className="mt-auto flex flex-col gap-2 pt-5">
              <DownloadButton
                href="/api/source?download=site"
                label="Скачать код сайта (ZIP)"
                variant="glass"
                className="w-full"
              />
              <button
                type="button"
                onClick={handleInstallPwa}
                className="btn btn-sm btn-ghost w-full"
              >
                <Smartphone className="text-accent-hi" aria-hidden="true" />
                {installPrompt
                  ? "Установить сайт как PWA-приложение"
                  : swReady
                    ? "PWA готов · установить через браузер"
                    : "Включить PWA / Офлайн-режим"}
              </button>
            </div>
          </article>

          {/* Только App Kit */}
          <article className="glass glass-hover tilt-3d flex flex-col p-6" data-reveal data-tilt>
            <div className="flex items-start justify-between gap-3">
              <span
                className="icon-tile"
                style={{ "--c1": "#c084fc", "--c2": "#7c3aed" } as CSSProperties}
              >
                <Laptop aria-hidden="true" />
              </span>
              <span className="chip chip-safe">Windows .exe + Облако</span>
            </div>

            <h3 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
              App Kit для полного приложения
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Всё, чтобы превратить сайт в полноценный десктопный твикер Windows 10/11 и облачный сервис с аккаунтами
              — строго безопасно для Easy Anti-Cheat.
            </p>

            <div className="well mt-4 grid grid-cols-2 gap-2 p-3 text-center text-xs">
              <div>
                <strong className="block text-base font-extrabold tabular-nums text-ink">
                  {manifest.kitFiles.length}
                </strong>
                <span className="text-ink-3">модулей App Kit</span>
              </div>
              <div>
                <strong className="block text-base font-extrabold tabular-nums text-ink">
                  ~8 МБ
                </strong>
                <span className="text-ink-3">итоговый Tauri Setup.exe</span>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-2">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-none text-ok" aria-hidden="true" />
                Tauri v2 (Rust) + Electron (Node.js) на выбор
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-none text-ok" aria-hidden="true" />
                Автодетект железа, бэкап client.cfg, точка отката, UAC
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-none text-ok" aria-hidden="true" />
                SQL с RLS + CloudStorageAdapter + Nginx HTTPS
              </li>
            </ul>

            <div className="mt-auto flex flex-col gap-2 pt-5">
              <DownloadButton
                href="/api/source?download=app-kit"
                label="Скачать App Kit (ZIP)"
                variant="glass"
                className="w-full"
              />
              <button
                type="button"
                onClick={() => jumpToFile("kit", "app-kit/tauri/src-tauri/src/lib.rs")}
                className="btn btn-sm btn-ghost w-full"
              >
                <Code2 className="text-accent-hi" aria-hidden="true" />
                Смотреть Rust-ядро приложения
              </button>
            </div>
          </article>
        </div>
      </section>

      {/* ==================== 1.5 БИНАРНЫЕ АССЕТЫ ==================== */}
      <section aria-labelledby="assets-heading" className="glass p-5 sm:p-7" data-reveal>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Проверено и упаковано</p>
            <h2 id="assets-heading" className="headline mt-2 text-[clamp(1.4rem,3vw,2rem)]">
              Бинарные ассеты: шрифты, изображения, иконка
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
              Все {assets.filter((a) => a.exists).length} файлов лежат в архивах в папке{" "}
              <code className="font-mono text-ink">public/</code> байт-в-байт (метод store, без пережатия) и отдаются
              сайтом по прямым ссылкам ниже. Суммарно {fmtSize(assets.reduce((s, a) => s + a.size, 0))}. Если архив
              распаковался неполностью — сохраните файлы вручную по этим URL.
            </p>
          </div>
          <span className="chip chip-safe flex-none">
            <Check aria-hidden="true" />
            {assets.filter((a) => a.exists).length} из {assets.length} на месте
          </span>
        </div>

        <ul className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => {
            const Icon = asset.kind === "font" ? Fingerprint : asset.kind === "icon" ? ImageIcon : ImageIcon;
            return (
              <li key={asset.path} className="tile flex items-center gap-3 p-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white/10">
                  <Icon className="h-4 w-4 text-accent-hi" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-mono text-[12.5px] font-bold text-ink hover:text-accent-hi"
                    title={`Открыть ${asset.url}`}
                  >
                    {asset.url}
                  </a>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-3">
                    {asset.path} · {fmtSize(asset.size)}
                  </span>
                </span>
                <a
                  href={asset.url}
                  download
                  aria-label={`Скачать ${asset.url}`}
                  title="Скачать файл"
                  className="grid h-8 w-8 flex-none place-items-center rounded-full bg-white/10 text-ink-2 hover:bg-white/20 hover:text-ink"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>

        {assets.some((a) => !a.exists) && (
          <p role="alert" className="well mt-4 p-3.5 text-sm font-semibold text-danger">
            Не найдены на диске: {assets.filter((a) => !a.exists).map((a) => a.path).join(", ")}
          </p>
        )}
      </section>

      {/* ==================== 2. ДОРОЖНАЯ КАРТА СБОРКИ ==================== */}
      <section aria-labelledby="roadmap-heading" className="glass p-5 sm:p-8" data-reveal>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Пошаговая инструкция</p>
            <h2 id="roadmap-heading" className="headline mt-2 text-[clamp(1.5rem,3.4vw,2.2rem)]">
              <span className="text-glass">Как запустить свой сайт и собрать .exe приложение</span>
            </h2>
          </div>
          <Segmented
            ariaLabel="Этап инструкции разработчика"
            value={guideTab}
            onChange={setGuideTab}
            options={[
              { value: "local", label: "1. Свой сайт" },
              { value: "tauri", label: "2. Tauri .exe" },
              { value: "electron", label: "3. Electron .exe" },
              { value: "deploy", label: "4. Хостинг и БД" },
              { value: "eac", label: "5. EAC и подпись" },
            ]}
          />
        </div>

        <div className="hairline my-6" />

        {guideTab === "local" && (
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
                <Terminal className="h-5 w-5 text-accent-hi" aria-hidden="true" />
                Запуск сайта на своём компьютере за 3 минуты
              </h3>
              <p className="text-sm leading-relaxed text-ink-2">
                Поставьте <strong>Node.js 22 LTS</strong> (nodejs.org) и <strong>VS Code</strong>. Распакуйте
                скачанный архив <code className="font-mono text-ink">RustFlow-Complete-Edition.zip</code> и выполните в
                терминале:
              </p>
              <CodeBlock
                title="Терминал — локальный запуск"
                content={`# 1. Перейдите в распакованную папку
cd RustFlow-Complete

# 2. Установите зависимости (Next.js 16, React 19, Tailwind 4, Drizzle)
npm install

# 3. Создайте .env из шаблона и укажите DATABASE_URL (PostgreSQL)
cp .env.example .env
npx drizzle-kit push

# 4. Запустите сайт в режиме разработки -> http://localhost:3000
npm run dev

# Проверка и сборка для продакшена:
npm run typecheck && npm run lint && npm run build`}
              />
              <p className="text-xs leading-relaxed text-ink-3">
                Подсказка: Сборка /10, библиотека твиков, пресеты, журнал, бэкап JSON, скачивание .reg/.bat и сборка
                ZIP-пакетов работают даже без базы данных — PostgreSQL нужна только для общих счётчиков, лайков и
                облачной синхронизации.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
                <FolderGit2 className="h-5 w-5 text-accent-hi" aria-hidden="true" />
                Что редактировать под свой проект
              </h3>
              <ul className="space-y-2.5">
                {CUSTOMIZE_MAP.map((row) => (
                  <li key={row.openPath} className="tile flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold text-ink">{row.what}</p>
                      <p className="mt-0.5 truncate font-mono text-[11.5px] text-ink-3">{row.where}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => jumpToFile("site", row.openPath)}
                      className="btn btn-sm flex-none !h-8 !px-3 !text-xs"
                    >
                      Открыть
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {guideTab === "tauri" && (
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
                <Rocket className="h-5 w-5 text-accent-hi" aria-hidden="true" />
                Нативное Windows-приложение на Tauri v2 + Rust (рекомендуется)
              </h3>
              <p className="text-sm leading-relaxed text-ink-2">
                Даёт компактный установщик <code className="font-mono text-ink">RustFlow_1.0.0_x64-setup.exe</code>{" "}
                размером <strong>~8 МБ</strong> и минимальное потребление ОЗУ. Установите{" "}
                <strong>Rust (rustup.rs)</strong> и <strong>Visual Studio C++ Build Tools</strong>, затем выполните в
                PowerShell:
              </p>
              <CodeBlock
                title="PowerShell (Windows 10/11) — сборка Setup.exe"
                content={`# 1. Подключите готовые файлы Tauri из папки app-kit
Copy-Item -Recurse app-kit\\tauri\\src-tauri .\\src-tauri
Copy-Item app-kit\\tauri\\desktop-bridge.ts .\\src\\lib\\desktop-bridge.ts

# 2. Установите Tauri v2 CLI и сгенерируйте .ico/.png иконки из icon.svg
npm install -D @tauri-apps/cli
npx tauri icon src/app/icon.svg

# 3. Запустите десктоп-окно с живой перезагрузкой
npx tauri dev

# 4. Соберите финальные установщики .exe (NSIS) и .msi
# (для офлайн-сборки замените next.config.ts на app-kit/tauri/next.desktop.config.ts)
npx tauri build
# Результат: src-tauri\\target\\release\\bundle\\nsis\\RustFlow_1.0.0_x64-setup.exe`}
              />
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
                <Cpu className="h-5 w-5 text-accent-hi" aria-hidden="true" />
                Готовые нативные команды в src-tauri/src/lib.rs
              </h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {[
                  { cmd: "detect_hardware", desc: "Реальный CPU, ядра, ГБ и МТ/с RAM, GPU + VRAM и NVMe/SATA/HDD" },
                  { cmd: "find_rust_install", desc: "Автопоиск папки Rust по реестру Steam и libraryfolders.vdf" },
                  { cmd: "apply_client_cfg", desc: "Автобэкап и слияние пресета / gc.buffer прямо в cfg/client.cfg" },
                  { cmd: "restore_client_cfg", desc: "Мгновенный откат client.cfg из резервной копии в 1 клик" },
                  { cmd: "create_restore_point", desc: "Создание точки восстановления Windows с системным UAC" },
                  { cmd: "apply_tweak_script", desc: "Безопасное выполнение .reg и .bat твиков с запросом прав админа" },
                ].map((item) => (
                  <div key={item.cmd} className="tile p-3.5">
                    <code className="font-mono text-xs font-bold text-accent-hi">{item.cmd}()</code>
                    <p className="mt-1 text-xs leading-relaxed text-ink-2">{item.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => jumpToFile("kit", "app-kit/tauri/src-tauri/src/lib.rs")}
                >
                  Открыть lib.rs
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => jumpToFile("kit", "app-kit/tauri/desktop-bridge.ts")}
                >
                  Открыть desktop-bridge.ts
                </button>
              </div>
            </div>
          </div>
        )}

        {guideTab === "electron" && (
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
                <Laptop className="h-5 w-5 text-accent-hi" aria-hidden="true" />
                Альтернативная сборка .exe на Electron (без установки Rust)
              </h3>
              <p className="text-sm leading-relaxed text-ink-2">
                Если вам удобнее чистый JavaScript/Node.js, используйте готовый модуль{" "}
                <code className="font-mono text-ink">app-kit/electron/</code>. Он реализует ровно тот же интерфейс{" "}
                <code className="font-mono text-ink">desktop-bridge.ts</code> с включёнными{" "}
                <code className="font-mono text-ink">contextIsolation</code> и{" "}
                <code className="font-mono text-ink">sandbox</code>.
              </p>
              <CodeBlock
                title="PowerShell — сборка Setup.exe и Portable.exe через Electron"
                content={`# 1. Скопируйте папку electron и клиентский мост
Copy-Item -Recurse app-kit\\electron .\\electron
Copy-Item app-kit\\tauri\\desktop-bridge.ts .\\src\\lib\\desktop-bridge.ts

# 2. Установите Electron и сборщик установщиков
npm install -D electron electron-builder

# 3. Проверка локально (в соседнем терминале запущен npm run dev)
npx electron electron/main.cjs

# 4. Сборка установщика NSIS и портативного RustFlow-Portable.exe
npx electron-builder --config electron/electron-builder.yml --win
# Готовые .exe появятся в папке dist-desktop\\`}
              />
            </div>
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
                <HardDrive className="h-5 w-5 text-accent-hi" aria-hidden="true" />
                Tauri v2 или Electron — что выбрать?
              </h3>
              <div className="tile space-y-2 p-4 text-sm text-ink-2">
                <p>
                  <strong className="text-ink">Tauri v2 (рекомендуется для релиза):</strong> установщик ~8 МБ, быстрый
                  холодный старт, меньше расход памяти в фоне, встроенный Chromium WebView2 с поддержкой всех эффектов
                  Liquid Glass.
                </p>
                <p>
                  <strong className="text-ink">Electron (быстрый прототип на JS):</strong> не нужен компилятор Rust и
                  C++ Build Tools, собирается за пару минут, на выходе сразу и установщик, и{" "}
                  <code className="font-mono text-ink">Portable.exe</code> (~140 МБ).
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => jumpToFile("kit", "app-kit/electron/main.cjs")}
                >
                  Открыть electron/main.cjs
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => jumpToFile("kit", "app-kit/electron/electron-builder.yml")}
                >
                  Открыть electron-builder.yml
                </button>
              </div>
            </div>
          </div>
        )}

        {guideTab === "deploy" && (
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
                <Server className="h-5 w-5 text-accent-hi" aria-hidden="true" />
                Деплой сайта на свой домен (Docker / VPS / Vercel)
              </h3>
              <CodeBlock
                title="Ubuntu/Debian VPS — запуск с PostgreSQL 16 в 1 команду"
                content={`# На вашем VPS в папке проекта (предварительно смените пароль в docker-compose.yml):
docker compose up -d --build

# Привязка домена и бесплатный HTTPS-сертификат Let's Encrypt:
sudo cp app-kit/deploy/nginx.conf /etc/nginx/sites-available/rustflow
sudo ln -s /etc/nginx/sites-available/rustflow /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.ru -d www.your-domain.ru
sudo systemctl reload nginx`}
              />
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
                <Cloud className="h-5 w-5 text-accent-hi" aria-hidden="true" />
                Подключение аккаунтов и облака (Этап 2)
              </h3>
              <p className="text-sm leading-relaxed text-ink-2">
                Все сущности проекта (<code className="font-mono text-ink">builds</code>,{" "}
                <code className="font-mono text-ink">tweaks</code>, <code className="font-mono text-ink">logs</code>)
                уже содержат <code className="font-mono text-ink">ownerId</code> и работают через единый адаптер:
              </p>
              <ol className="space-y-2 text-[13.5px] text-ink-2">
                <li className="tile p-3">
                  <strong className="text-ink">1.</strong> Выполните{" "}
                  <code className="font-mono text-ink">app-kit/cloud/schema.sql</code> в PostgreSQL или Supabase.
                </li>
                <li className="tile p-3">
                  <strong className="text-ink">2.</strong> Подключите авторизацию (Steam OpenID / Discord / Google через
                  Better Auth, Auth.js или Supabase Auth).
                </li>
                <li className="tile p-3">
                  <strong className="text-ink">3.</strong> Скопируйте{" "}
                  <code className="font-mono text-ink">api-sync-route.ts</code> в{" "}
                  <code className="font-mono text-ink">src/app/api/sync/route.ts</code> и вызовите{" "}
                  <code className="font-mono text-ink">createCloudSync</code> — сайт и .exe начнут синхронизировать
                  сборку и журнал автоматически.
                </li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => jumpToFile("kit", "app-kit/cloud/schema.sql")}
                >
                  Открыть schema.sql
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => jumpToFile("kit", "app-kit/cloud/cloud-storage-adapter.ts")}
                >
                  Открыть CloudStorageAdapter
                </button>
              </div>
            </div>
          </div>
        )}

        {guideTab === "eac" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="tile space-y-2.5 p-5">
              <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                <ShieldCheck className="h-5 w-5 text-ok" aria-hidden="true" />
                Правила безопасности Easy Anti-Cheat для вашего .exe
              </h3>
              <ul className="space-y-2 text-sm leading-relaxed text-ink-2">
                <li>
                  • <strong>Никогда</strong> не открывайте дескриптор процесса{" "}
                  <code className="font-mono text-ink">RustClient.exe</code> на чтение/запись памяти и не инжектите DLL
                  или свои оверлеи поверх игры.
                </li>
                <li>
                  • <strong>Никогда</strong> не добавляйте макросы отдачи, автокликеры, перехват мыши/клавиатуры и
                  неподписанные kernel-драйверы.
                </li>
                <li>
                  • Меняйте только штатный <code className="font-mono text-ink">cfg/client.cfg</code> при{" "}
                  <strong>закрытом</strong> Rust (в нашем <code className="font-mono text-ink">lib.rs</code> эта
                  проверка уже встроена) и документированные параметры Windows.
                </li>
                <li>
                  • Всегда создавайте резервную копию и точку восстановления перед системными изменениями.
                </li>
              </ul>
            </div>

            <div className="tile space-y-2.5 p-5">
              <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                <Sparkles className="h-5 w-5 text-accent-hi" aria-hidden="true" />
                Релиз, автообновления и подпись кода Windows
              </h3>
              <ul className="space-y-2 text-sm leading-relaxed text-ink-2">
                <li>
                  • Чтобы Windows SmartScreen не показывал предупреждение «Неизвестный издатель», подпишите{" "}
                  <code className="font-mono text-ink">Setup.exe</code> через{" "}
                  <strong>Azure Trusted Signing</strong> или OV/EV Code Signing сертификат.
                </li>
                <li>
                  • Для автоматической сборки <code className="font-mono text-ink">.exe</code> на каждый релиз подключите
                  официальный GitHub Action <code className="font-mono text-ink">tauri-apps/tauri-action</code>.
                </li>
                <li>
                  • Для автообновлений приложения включите плагин{" "}
                  <code className="font-mono text-ink">tauri-plugin-updater</code> с криптографической подписью патчей.
                </li>
                <li>
                  • Публикуйте открытый список всех <code className="font-mono text-ink">.reg</code>/
                  <code className="font-mono text-ink">.bat</code> и SHA-256 суммы релизов — это даёт максимальное
                  доверие игроков.
                </li>
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* ==================== 3. ИНТЕРАКТИВНЫЙ ПРОВОДНИК КОДА ==================== */}
      <section id="code-explorer" aria-labelledby="explorer-heading" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Все файлы открыты</p>
            <h2 id="explorer-heading" className="headline mt-2 text-[clamp(1.5rem,3.4vw,2.2rem)]">
              <span className="text-glass">Просмотр и копирование любого файла</span>
            </h2>
          </div>
          <Segmented
            ariaLabel="Выбор набора исходников"
            value={tab}
            onChange={(next) => {
              setTab(next);
              setQuery("");
            }}
            options={[
              { value: "site", label: `Код сайта (${manifest.siteFiles.length})` },
              { value: "kit", label: `App Kit .exe + Облако (${manifest.kitFiles.length})` },
            ]}
          />
        </div>

        {/* Фильтры и поиск */}
        <div className="glass space-y-3 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="relative block flex-1">
              <span className="sr-only">Поиск файла по имени</span>
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === "site"
                    ? "Найти файл: globals.css, BenchmarkTool, preset.ts, game.ts…"
                    : "Найти модуль: lib.rs, tauri.conf, electron, schema.sql, nginx…"
                }
                className="field !h-11 !pl-10 !pr-9"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Очистить поиск"
                  className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-ink-2 hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Фильтр по папке">
            {tab === "site"
              ? SITE_GROUPS.map((g) => {
                  const active = siteGroup === g.value;
                  return (
                    <button
                      key={g.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSiteGroup(g.value)}
                      className={`chip !h-8 !px-3 transition-transform active:scale-95 ${
                        active ? "chip-accent font-bold" : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })
              : KIT_GROUPS.map((g) => {
                  const active = kitGroup === g.value;
                  return (
                    <button
                      key={g.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setKitGroup(g.value)}
                      className={`chip !h-8 !px-3 transition-transform active:scale-95 ${
                        active ? "chip-accent font-bold" : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
          </div>
        </div>

        {/* Две колонки: дерево файлов + код */}
        <div className="grid items-start gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="glass p-3" aria-label="Список файлов проекта">
            <div className="mb-2 flex items-center justify-between px-2 text-xs text-ink-3">
              <span>
                Файлов:{" "}
                <strong className="tabular-nums text-ink">
                  {tab === "site" ? filteredSiteFiles.length : filteredKitFiles.length}
                </strong>
              </span>
              <span>Нажмите для просмотра</span>
            </div>

            <div className="max-h-[560px] space-y-1 overflow-y-auto pr-1" role="listbox" aria-label="Файлы">
              {tab === "site" ? (
                filteredSiteFiles.length === 0 ? (
                  <p className="p-4 text-center text-sm text-ink-3">Файлы по запросу не найдены.</p>
                ) : (
                  filteredSiteFiles.map((file) => {
                    const selected = file.path === selectedSitePath;
                    return (
                      <button
                        key={file.path}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => setSelectedSitePath(file.path)}
                        className="option !py-2 !text-[12.5px]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FileCode2
                            className={`h-3.5 w-3.5 flex-none ${selected ? "text-accent-hi" : "text-ink-3"}`}
                            aria-hidden="true"
                          />
                          <span className="truncate font-mono">{file.path}</span>
                        </span>
                        <span className="flex-none text-[11px] tabular-nums text-ink-3">
                          {fmtSize(file.size)}
                        </span>
                      </button>
                    );
                  })
                )
              ) : filteredKitFiles.length === 0 ? (
                <p className="p-4 text-center text-sm text-ink-3">Модули по запросу не найдены.</p>
              ) : (
                filteredKitFiles.map((file) => {
                  const selected = file.path === selectedKitPath;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => setSelectedKitPath(file.path)}
                      className="option flex-col !items-start !gap-0.5 !py-2.5"
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-bold text-ink">{file.title}</span>
                        <span className="flex-none text-[11px] tabular-nums text-ink-3">
                          {fmtSize(file.size)}
                        </span>
                      </span>
                      <span className="w-full truncate font-mono text-[11px] text-ink-3">{file.path}</span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Панель просмотра кода */}
          <div className="glass min-w-0 overflow-hidden p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-all font-mono text-[13.5px] font-bold text-ink">{activePath}</p>
                {activeKitMeta && (
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{activeKitMeta.description}</p>
                )}
                {activeContent !== undefined && (
                  <p className="mt-1 text-xs tabular-nums text-ink-3">
                    {lineCount} строк · {fmtSize(activeKitMeta?.size ?? activeSiteMeta?.size ?? activeContent.length)}
                  </p>
                )}
              </div>

              {!(tab === "site" && activeSiteMeta?.binary) && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyActiveFile}
                    disabled={!activeContent}
                    className="btn btn-sm !h-9 !px-3.5"
                  >
                    {copiedCode ? (
                      <Check className="text-ok" aria-hidden="true" />
                    ) : (
                      <Copy aria-hidden="true" />
                    )}
                    {copiedCode ? "Скопировано" : "Копировать"}
                  </button>
                  <a
                    href={`/api/source?source=${tab}&file=${encodeURIComponent(activePath)}&raw=1`}
                    download
                    className="btn btn-sm btn-primary !h-9 !px-3.5"
                  >
                    <Download aria-hidden="true" />
                    Скачать файл
                  </a>
                </div>
              )}
            </div>

            <div className="hairline my-4" />

            {tab === "site" && activeSiteMeta?.binary ? (
              <div className="well p-6 text-center">
                <p className="text-sm font-bold text-ink">
                  Бинарный ассет ({fmtSize(activeSiteMeta.size)})
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
                  Файл <code className="font-mono text-ink">{activeSiteMeta.path}</code> (шрифт или изображение) уже
                  включён в архивы <strong>RustFlow-Complete-Edition.zip</strong> и{" "}
                  <strong>RustFlow-Site-Source.zip</strong>.
                </p>
                <a
                  href={`/${activeSiteMeta.path.replace(/^public\//, "")}`}
                  download
                  className="btn btn-sm mt-4"
                >
                  <Download aria-hidden="true" />
                  Скачать ассет отдельно
                </a>
              </div>
            ) : isLoading ? (
              <div className="space-y-2.5 p-2" role="status" aria-label="Загрузка кода файла">
                <div className="skeleton h-5 w-2/3" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-11/12" />
                <div className="skeleton h-4 w-4/5" />
                <div className="skeleton h-48 w-full" />
              </div>
            ) : loadError ? (
              <div className="well p-5 text-sm text-danger" role="alert">
                {loadError}
              </div>
            ) : (
              <div className="well overflow-hidden">
                <pre className="code max-h-[540px] overflow-auto p-4" tabIndex={0}>
                  {activeContent ?? ""}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
