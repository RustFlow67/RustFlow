import type { AppKitFile } from "./desktop";

export const CLOUD_AND_DEPLOY_FILES: AppKitFile[] = [
  /* ------------------------ CLOUD / STAGE 2 ------------------------ */
  {
    path: "app-kit/cloud/schema.sql",
    title: "cloud/schema.sql — БД профилей, сборок и твиков (RLS)",
    description:
      "Полная схема PostgreSQL / Supabase для Этапа 2: аккаунты, облачные сборки, применённые твики и пользовательские пресеты с политиками Row-Level Security по owner_id.",
    group: "cloud",
    language: "sql",
    content: `-- RustFlow — полная SQL-схема Этапа 2 (PostgreSQL 16+ / Supabase)
-- Совместима 1-в-1 с моделями src/lib/models/* и полем owner_id

create extension if not exists "pgcrypto";

-- 1. Профиль пользователя и настройки мастера полной настройки
create table if not exists user_profiles (
  owner_id uuid primary key,
  display_name varchar(64) not null default 'Игрок Rust',
  steam_id varchar(32),
  setup_profile varchar(24) not null default 'recommended',
  setup_preset varchar(24) not null default 'balanced',
  setup_gpu varchar(16) not null default 'all',
  protocol_checks jsonb not null default '[]'::jsonb,
  active_build_id uuid,
  bundle_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Сохранённые сборки ПК
create table if not exists user_builds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references user_profiles(owner_id) on delete cascade,
  name varchar(80) not null,
  cpu_id varchar(64) not null,
  gpu_id varchar(64) not null,
  ram_gb integer not null check (ram_gb between 4 and 256),
  ram_mhz integer not null check (ram_mhz between 1600 and 10000),
  ram_cl integer not null check (ram_cl between 10 and 60),
  storage varchar(16) not null,
  resolution varchar(16) not null,
  score_10 numeric(3,1) not null check (score_10 between 0 and 10),
  fps_modded_min integer not null,
  fps_modded_max integer not null,
  fps_official_min integer not null,
  fps_official_max integer not null,
  low1_official integer not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_builds_owner_idx on user_builds(owner_id);

-- 3. Применённые твики и личные замеры FPS до/после
create table if not exists user_tweaks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references user_profiles(owner_id) on delete cascade,
  slug varchar(64) not null,
  applied boolean not null default false,
  fps_before numeric(6,1),
  fps_after numeric(6,1),
  note varchar(280) not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);
create index if not exists user_tweaks_owner_idx on user_tweaks(owner_id);

-- 4. Счётчики сайта (уже используются в src/db/schema.ts)
create table if not exists tweak_stats (
  slug varchar(64) primary key,
  downloads integer not null default 0
);

create table if not exists tweak_votes (
  id serial primary key,
  slug varchar(64) not null,
  voter varchar(64) not null,
  created_at timestamptz not null default now(),
  unique (slug, voter)
);

-- 5. Row-Level Security (для Supabase / PostgREST: раскомментируйте при подключении auth.uid())
-- alter table user_profiles enable row level security;
-- alter table user_builds enable row level security;
-- alter table user_tweaks enable row level security;
--
-- create policy "own_profile" on user_profiles for all using (auth.uid() = owner_id);
-- create policy "own_builds"  on user_builds   for all using (auth.uid() = owner_id or is_public);
-- create policy "own_tweaks"  on user_tweaks   for all using (auth.uid() = owner_id);
`,
  },
  {
    path: "app-kit/cloud/cloud-storage-adapter.ts",
    title: "cloud/cloud-storage-adapter.ts — облачный адаптер (offline-first)",
    description:
      "Обёртка над существующим LocalStorageAdapter из src/lib/storage/adapter.ts: мгновенно работает локально и автоматически синхронизирует ExportBundle с вашим /api/sync или Supabase после входа пользователя.",
    group: "cloud",
    language: "typescript",
    content: `import { storage, type ExportBundle, type StorageAdapter } from "@/lib/storage/adapter";

export interface CloudSyncConfig {
  /** URL вашего эндпоинта синхронизации (например, "/api/sync"). */
  endpoint: string;
  /** Функция получения актуального токена сессии (JWT / Cookie / Supabase access_token). */
  getAuthToken?: () => Promise<string | null>;
  /** Задержка дебаунса фоновой отправки, мс (по умолчанию 1200). */
  debounceMs?: number;
}

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

/**
 * Offline-first облачный синхронизатор:
 * UI продолжает работать с тем же StorageAdapter без единой правки компонентов,
 * а изменения автоматически сохраняются в облако и подтягиваются на других ПК / в .exe.
 */
export class CloudSyncController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;
  private suppressNextPush = false;
  private status: SyncStatus = "idle";
  private readonly listeners = new Set<(s: SyncStatus) => void>();

  constructor(
    private readonly adapter: StorageAdapter,
    private readonly config: CloudSyncConfig,
  ) {}

  getStatus(): SyncStatus {
    return this.status;
  }

  onStatus(fn: (s: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setStatus(next: SyncStatus) {
    this.status = next;
    this.listeners.forEach((fn) => fn(next));
  }

  private async headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const token = await this.config.getAuthToken?.();
    if (token) h.Authorization = \`Bearer \${token}\`;
    return h;
  }

  /** Подключает автосинхронизацию и подтягивает облачный профиль (merge с локальным). */
  async start(): Promise<void> {
    await this.pull("merge");
    this.unsubscribe?.();
    this.unsubscribe = this.adapter.subscribe(() => {
      if (this.suppressNextPush) return;
      this.schedulePush();
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedulePush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.push();
    }, this.config.debounceMs ?? 1200);
  }

  async pull(mode: "merge" | "replace" = "merge"): Promise<boolean> {
    try {
      this.setStatus("syncing");
      const res = await fetch(this.config.endpoint, {
        method: "GET",
        headers: await this.headers(),
        credentials: "include",
      });
      if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
      const data = (await res.json()) as { bundle?: ExportBundle | null };
      if (data.bundle) {
        const checked = this.adapter.validateImport(JSON.stringify(data.bundle));
        if (checked.ok) {
          this.suppressNextPush = true;
          try {
            this.adapter.applyImport(checked.preview.bundle, mode);
          } finally {
            this.suppressNextPush = false;
          }
        }
      }
      this.setStatus("synced");
      return true;
    } catch {
      this.setStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
      return false;
    }
  }

  async push(): Promise<boolean> {
    try {
      this.setStatus("syncing");
      const bundle = this.adapter.exportBundle();
      const res = await fetch(this.config.endpoint, {
        method: "PUT",
        headers: await this.headers(),
        credentials: "include",
        body: JSON.stringify({ bundle }),
      });
      if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
      this.setStatus("synced");
      return true;
    } catch {
      this.setStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
      return false;
    }
  }
}

export function createCloudSync(config: CloudSyncConfig): CloudSyncController {
  return new CloudSyncController(storage, config);
}
`,
  },
  {
    path: "app-kit/cloud/api-sync-route.ts",
    title: "cloud/api-sync-route.ts — серверный API синхронизации (Next.js + Drizzle)",
    description:
      "Положите в src/app/api/sync/route.ts после подключения авторизации (Auth.js / Better Auth / Lucia / Steam OpenID). Хранит и отдаёт облачный профиль пользователя в PostgreSQL.",
    group: "cloud",
    language: "typescript",
    content: `import { getDb } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Замените getAuthenticatedOwnerId() на проверку реальной сессии
 * (например, Better Auth / Auth.js / Steam OpenID / JWT).
 */
async function getAuthenticatedOwnerId(req: Request): Promise<string | null> {
  const header = req.headers.get("x-demo-user-uuid");
  if (header && /^[0-9a-f-]{36}$/i.test(header)) return header;
  return null;
}

export async function GET(req: Request) {
  const ownerId = await getAuthenticatedOwnerId(req);
  if (!ownerId) return Response.json({ error: "Требуется авторизация" }, { status: 401 });

  const rows = await getDb().execute(
    sql\`select bundle_json from user_profiles where owner_id = \${ownerId}::uuid limit 1\`,
  );
  const row = rows.rows[0] as { bundle_json?: unknown } | undefined;
  return Response.json({ bundle: row?.bundle_json ?? null });
}

export async function PUT(req: Request) {
  const ownerId = await getAuthenticatedOwnerId(req);
  if (!ownerId) return Response.json({ error: "Требуется авторизация" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { bundle?: Record<string, unknown> } | null;
  if (!body?.bundle || body.bundle.app !== "RustFlow") {
    return Response.json({ error: "Некорректный формат пакета" }, { status: 400 });
  }

  const stamped = JSON.stringify({ ...body.bundle, ownerId, syncedAt: new Date().toISOString() });
  await getDb().execute(sql\`
    insert into user_profiles (owner_id, bundle_json, updated_at)
    values (\${ownerId}::uuid, \${stamped}::jsonb, now())
    on conflict (owner_id)
    do update set bundle_json = excluded.bundle_json, updated_at = now()
  \`);

  return Response.json({ ok: true });
}
`,
  },

  /* --------------------------- DEPLOY / VPS --------------------------- */
  {
    path: "app-kit/deploy/nginx.conf",
    title: "deploy/nginx.conf — Nginx + SSL + кэш для своего домена",
    description:
      "Готовый конфиг обратного прокси для Ubuntu/Debian VPS: HTTP/2, бесплатный сертификат Let's Encrypt (Certbot), долгое кэширование шрифтов и статики, защита заголовков.",
    group: "deploy",
    language: "nginx",
    content: `server {
    listen 80;
    listen [::]:80;
    server_name your-domain.ru www.your-domain.ru;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.ru www.your-domain.ru;

    # Сертификаты выпускаются командой: sudo certbot --nginx -d your-domain.ru -d www.your-domain.ru
    ssl_certificate     /etc/letsencrypt/live/your-domain.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.ru/privkey.pem;

    client_max_body_size 4m;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    add_header X-Content-Type-Options "nosniff" always;
    # По умолчанию запрещаем чужие iframe. При встраивании замените на
    # Content-Security-Policy с frame-ancestors для конкретных доверенных хостов.
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /fonts/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Host $host;
        # Доверяем только адресу, который установил прокси.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Чат RustFlow отдаёт ответы потоком, включая при префиксе /backend/api.
        proxy_buffering off;
    }
}
`,
  },
  {
    path: "app-kit/deploy/rustflow.service",
    title: "deploy/rustflow.service — автозапуск systemd (VPS без Docker)",
    description:
      "Положите в /etc/systemd/system/rustflow.service и выполните sudo systemctl enable --now rustflow для автозапуска сайта при перезагрузке сервера.",
    group: "deploy",
    language: "ini",
    content: `[Unit]
Description=RustFlow Next.js Production Server
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rustflow
EnvironmentFile=/var/www/rustflow/.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`,
  },

  /* ----------------------- FULL DEVELOPER GUIDE ----------------------- */
  {
    path: "app-kit/GUIDE-FULL-APP.md",
    title: "GUIDE-FULL-APP.md — Полный гайд: от сайта до .exe и облака",
    description:
      "Главное пошаговое руководство на русском языке: запуск и ребрендинг сайта, деплой на хостинг, сборка Windows-приложения (.exe) на Tauri v2 и Electron, подпись кода, правила EAC и облако аккаунтов.",
    group: "guide",
    language: "markdown",
    content: `# Полное руководство: Свой сайт + Windows-приложение (.exe) на базе RustFlow

Этот архив содержит **100% исходного кода сайта RustFlow** (Minimalistic Liquid Glass, тёмная и светлая темы, Твикер, 43 пресета железа, Сборка и генератор ZIP) плюс **полный App Kit** для превращения его в настоящее десктопное приложение Windows и облачный сервис.

---

## Часть 1. Запуск и настройка своего сайта

### Шаг 1. Установка программ
1. Установите **Node.js 22 LTS** с https://nodejs.org
2. Установите **VS Code** с https://code.visualstudio.com
3. Для базы данных — **Docker Desktop** или локальный **PostgreSQL 16** (либо бесплатная облачная БД **Neon** / **Supabase**).

### Шаг 2. Первый запуск на своём ПК
\`\`\`bash
# Распакуйте архив RustFlow-Complete-Edition.zip и откройте папку в терминале:
npm ci
cp -n .env.example .env
# Впишите в .env ваш DATABASE_URL (PostgreSQL)
npm run db:push
npm run dev
\`\`\`
Откройте \`http://localhost:3000\` — ваш сайт полностью работает!

### Шаг 3. Как переделать под свой бренд и добавить материал
- **Название, описание, домен**: \`src/app/layout.tsx\`, \`public/manifest.json\`, \`src/components/Nav.tsx\`, \`src/components/Footer.tsx\`.
- **Цвета и Liquid Glass**: \`src/app/globals.css\` (секция \`:root\` — тёмная тема, \`:root[data-theme="light"]\` — светлая фарфоровая тема).
- **Добавить свой твик**: откройте \`src/lib/tweaks/windows.ts\`, \`game.ts\` или \`extras.ts\` и добавьте объект \`Tweak\` — он появится в соответствующей категории Твикера. Включение в ZIP зависит от риска, верификации и выбора пользователя.
- **Добавить процессор / видеокарту**: \`src/lib/hardware.ts\` (массивы \`CPUS\` и \`GPUS\`).
- **Добавить пресет железа**: \`src/lib/models/preset.ts\` (массив \`HARDWARE_PRESETS\`).

### Шаг 4. Публикация сайта в интернет
Укажите \`NEXT_PUBLIC_SITE_URL\` и при необходимости \`VITE_API_BASE_URL\` перед сборкой. Для обычного запуска оставьте префикс пустым (\`/api\` на домене сайта). Пример \`VITE_API_BASE_URL=/backend\` использует \`/backend/api\` с внутренним rewrite Next.js. HTTPS нужен для облачных аккаунтов и установки PWA. Шаблон Nginx перезаписывает X-Forwarded-For, X-Forwarded-Host и X-Forwarded-Proto; не открывайте порт Next.js напрямую в обход прокси. Секреты (в том числе \`GOOGLE_CLIENT_SECRET\`, \`RUSTFLOW_LLM_API_KEY\`, \`RUSTFLOW_ADMIN_TOKEN\`) задаются только при запуске. Google включается через \`VITE_GOOGLE_CLIENT_ID\` и секрет, с callback \`/api/auth/google/callback\`. Модель чата — gpt-4o-mini.

- **Вариант А — Vercel + Neon (бесплатно, за 5 минут)**:
  1. Залейте проект в приватный репозиторий GitHub (**не коммитьте \`.env\`!**).
  2. Создайте бесплатную PostgreSQL базу на Neon.tech и скопируйте \`DATABASE_URL\`.
  3. Импортируйте репозиторий в Vercel, добавьте переменную \`DATABASE_URL\` и нажмите Deploy. Примените схему к этой базе командой npm run db:push с DATABASE_URL в серверном окружении.
- **Вариант Б — Свой VPS (Ubuntu 24.04 + Docker + домен)**:
  1. Скопируйте проект на сервер в \`/opt/rustflow\`.
  2. Поменяйте пароль БД в \`docker-compose.yml\` и запустите \`docker compose up -d --build\` и примените схему: \`docker compose exec web npm run db:push\`.
  3. Поставьте Nginx + Certbot, подключите \`app-kit/deploy/nginx.conf\` и выпустите HTTPS: \`sudo certbot --nginx -d ваш-домен.ru\`.

---

## Часть 2. Сборка нативного Windows-приложения (\`.exe\`)

У вас есть **два готовых варианта** — выбирайте любой:

### Вариант А (Флагманский, рекомендуется): Tauri v2 + Rust
- Размер установщика \`RustFlow-Setup.exe\`: **~7–10 МБ** (вместо 150 МБ у Electron).
- Использует системный Edge WebView2 (уже встроен в Windows 10/11) — Liquid Glass и преломление работают идеально.
- Нативный Rust-бэкенд в \`src-tauri/src/lib.rs\` умеет:
  - автоматически определять реальный CPU, GPU, объём/частоту RAM и тип диска (NVMe/SATA/HDD);
  - сам находить папку установки Rust во всех библиотеках Steam;
  - делать бэкап и применять настройки прямо в \`cfg/client.cfg\` + откатывать в 1 клик;
  - создавать точку восстановления Windows;
  - запускать проверенные \`.reg\` и \`.bat\` твики с системным окном UAC;
  - хранить профиль пользователя в \`%APPDATA%\\RustFlow\\profile-v1.json\`.

**Как собрать \`.exe\` на Windows 10/11:**
\`\`\`powershell
# 1. Установите Rust (https://rustup.rs) и Visual Studio C++ Build Tools
# 2. Скопируйте файлы из app-kit/tauri/ в корень проекта:
Copy-Item -Recurse app-kit\\tauri\\src-tauri .\\src-tauri
Copy-Item app-kit\\tauri\\desktop-bridge.ts .\\src\\lib\\desktop-bridge.ts

# 3. Установите Tauri CLI
npm install -D @tauri-apps/cli

# 4. Сгенерируйте все размеры иконок Windows (.ico / .png) из вашего icon.svg
npx tauri icon src/app/icon.svg

# 5. Запустите приложение в режиме разработки (откроется нативное окно!)
npx tauri dev

# 6. Для автономной сборки .exe:
#    - либо укажите в tauri.conf.json адрес вашего задеплоенного сайта,
#    - либо используйте app-kit/tauri/next.desktop.config.ts (статический экспорт в out/)
npx tauri build
\`\`\`
Готовые установщики появятся в:
- \`src-tauri/target/release/bundle/nsis/RustFlow_1.0.0_x64-setup.exe\`
- \`src-tauri/target/release/bundle/msi/RustFlow_1.0.0_x64_ru-RU.msi\`

---

### Вариант Б (Простой, без Rust): Electron + Node.js
Если не хотите ставить компилятор Rust:
\`\`\`powershell
Copy-Item -Recurse app-kit\\electron .\\electron
Copy-Item app-kit\\tauri\\desktop-bridge.ts .\\src\\lib\\desktop-bridge.ts
npm install -D electron electron-builder

# Проверка локально (при запущенном npm run dev):
npx electron electron/main.cjs

# Сборка установщика Setup.exe и Portable.exe (после сборки out/):
npx electron-builder --config electron/electron-builder.yml --win
\`\`\`
Готовые \`.exe\` появятся в папке \`dist-desktop/\`.

---

## Часть 3. Как подключить нативные кнопки в UI приложения

В \`src/lib/desktop-bridge.ts\` уже готовы все функции:
- \`isDesktopApp()\` — возвращает \`true\` внутри Tauri/Electron и \`false\` на сайте;
- \`nativeDetectHardware()\` — вызывайте на кнопке «Автоопределение» в \`BenchmarkTool.tsx\`, чтобы автоматически подставлять CPU, GPU, ГБ, МТ/с и NVMe;
- \`nativeApplyClientCfg(entries)\` и \`nativeRestoreClientCfg()\` — вызывайте в \`PresetsExplorer.tsx\` и твиках игры для применения конфига в 1 клик;
- \`nativeCreateRestorePoint()\` — кнопка создания точки восстановления на Этапе 1;
- \`nativeApplyTweak(name, kind, content, admin)\` — кнопка «Применить в 1 клик» рядом с «Скачать файл» на карточке твика.

---

## Часть 4. Аккаунты и облачная синхронизация (Этап 2)

Все данные в RustFlow уже разделены на модели (\`builds\`, \`tweaks\`, \`presets\`) и содержат поле \`ownerId\`:
1. Выполните \`app-kit/cloud/schema.sql\` в вашей PostgreSQL или Supabase.
2. Подключите авторизацию (**Better Auth**, **Auth.js** или **Supabase Auth** — удобно включить вход через **Steam**, **Discord** и **Google**).
3. Положите \`app-kit/cloud/api-sync-route.ts\` в \`src/app/api/sync/route.ts\` и подставьте ID пользователя из сессии.
4. Запустите \`createCloudSync({ endpoint: "/api/sync" }).start()\` после входа — локальная сборки, отметки и настройки Твикера автоматически сольются с облаком и синхронизируются между сайтом и \`.exe\`!

---

## Часть 5. Безопасность Easy Anti-Cheat (EAC) и подпись \`.exe\`

**Золотые правила, чтобы ваше приложение НИКОГДА не вызывало бан EAC:**
1. **Никогда** не вызывайте \`OpenProcess\` с правами чтения/записи памяти (\`PROCESS_VM_READ\` / \`PROCESS_VM_WRITE\`) на \`RustClient.exe\` или \`EasyAntiCheat_EOS.exe\`.
2. **Никогда** не внедряйте DLL, оверлеи DirectX/Vulkan, хуки мыши/клавиатуры (отдача/макросы) и кастомные kernel-драйверы.
3. **Никогда** не модифицируйте игровые архивы/бандлы Rust — меняйте только штатный текстовый \`cfg/client.cfg\` **при закрытой игре**.
4. **Разрешено и полностью безопасно**: настройки Windows и электропитания, профили драйвера GPU, \`client.cfg\`, параметры запуска Steam, проверка факта запуска игры и чтение характеристик железа через WMI/CIM.

**Как убрать синее окно Windows SmartScreen у вашего \`.exe\`:**
- Подпишите установщик сертификатом Code Signing (например, **Azure Trusted Signing** или OV/EV Code Signing через \`signtool.exe\` в Tauri/electron-builder).
- Публикуйте исходный код твиков открыто (как это уже сделано в RustFlow) и прикладывайте SHA-256 хэши релизов на GitHub Releases.
`,
  },
];
