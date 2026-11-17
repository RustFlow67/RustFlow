# RustFlow — Флагманский твикер и бенчмарк для Rust (Liquid Glass iOS 26)

Полноценный проект сайта и база для десктопного Windows-приложения:
- **Дизайн Liquid Glass iOS 26** с преломлением, спекулярными бликами, меш-авророй, объёмными лучами, полем частиц и плавным переключением **Тёмная ↔ Светлая тема** (View Transitions API).
- **Типографика с кириллицей**: `Unbounded Variable` (стеклянные заголовки), `Manrope Variable` (текст), `JetBrains Mono Variable` (конфиги и код).
- **Профиль сборки /10** (`/benchmark`): прозрачная формула с весами (CPU 35%, RAM 20%, SSD 10%, GPU 25%, VRAM 10%), расчёт FPS для Моддед 2x и Официала + 1% low, подбор персональных твиков.
- **Библиотека твиков** (`/tweaks` и `/tweaks/[slug]`): 32 позиции по 6 категориям, маркировка риска («Безопасно» / «Осторожно» / «Вредно») и статуса («Замерено» / «Миф»), пошаговые инструкции, открытые `.reg` / `.bat` / `.txt` файлы и файлы отката.
- **Пресеты железа** (`/presets`): 7 референсных сборок (включая Ryzen 5 5600X + RTX 5060 + 32 ГБ @ 3600 CL18), готовые `client.cfg` и сравнение до 3 конфигураций.
- **Журнал замеров** (`/journal`): таблица до/после (Avg FPS, 1% low, Frametime мс), авторасчёт дельты %, отмена удаления (Undo) и чек-лист протокола тестирования.
- **Полная настройка** (`/setup`): 6 этапов от точки восстановления до `client.cfg` и генерация персонального ZIP-архива на лету (`/api/pack`).
- **Мифы и безопасность EAC** (`/faq`) и **Руководство** (`/guide`).
- **Живая FPS-лаборатория**: реальный rAF-счётчик рендера страницы, canvas-график и 8 живых контролов нагрузки + экспорт снапшота.
- **PWA + App Kit** (`/dev`): установка как PWA, а также готовые наборы для сборки нативного Windows `.exe` (Tauri v2 на Rust и Electron на Node.js) и облачной синхронизации профилей.

---

## 1. Быстрый старт (локальный запуск сайта)

Требования: **Node.js 20+** (рекомендуется 22 LTS) и **PostgreSQL 15+** (либо Docker).

```bash
# 1. Установите зависимости
npm install

# 2. Создайте файл переменных окружения
cp .env.example .env
# Отредактируйте DATABASE_URL в .env под вашу базу PostgreSQL

# 3. Примените схему таблиц PostgreSQL
npx drizzle-kit push

# 4. Запустите в режиме разработки (http://localhost:3000)
npm run dev
```

Проверка и продакшен-сборка:
```bash
npm run typecheck
npm run lint
npm run build
npm run start
```

> **Совет:** Сборка /10, библиотека твиков, пресеты, журнал, бэкап JSON, скачивание `.reg`/`.bat` и генерация ZIP-пакета работают даже без активной БД! PostgreSQL используется для счётчиков скачиваний, лайков твиков, общей ленты бенчмарков и будущего облака аккаунтов.

---

## 2. Запуск в 1 команду через Docker

```bash
# Замените пароль в docker-compose.yml и выполните:
docker compose up -d --build
```
Сайт поднимется на `http://localhost:3000` вместе с PostgreSQL 16.

---

## 3. Что и где менять под свой сайт

| Что хотите изменить | Файл |
|---|---|
| Название бренда, SEO, OpenGraph | `src/app/layout.tsx`, `src/components/Nav.tsx`, `src/components/Footer.tsx`, `src/app/manifest.ts` |
| Палитра тёмной и светлой темы, Liquid Glass | `src/app/globals.css` (`:root` и `:root[data-theme="light"]`) |
| Твики Windows, игры, сети и мифы | `src/lib/tweaks/windows.ts`, `game.ts`, `other.ts`, `extras.ts` |
| База процессоров и видеокарт | `src/lib/hardware.ts` |
| Веса и формула оценки сборки /10 | `src/lib/models/build.ts` |
| Пресеты железа и их `client.cfg` | `src/lib/models/preset.ts` |
| FAQ, мифы, правила EAC, руководство | `src/lib/content.ts` |
| Хранилище пользователя (localStorage → облако) | `src/lib/storage/adapter.ts` |
| Схема базы данных PostgreSQL | `src/db/schema.ts` |
| Фоновые изображения и иконка | `public/images/wallpaper.jpg`, `public/images/hero.jpg`, `src/app/icon.svg` |

---

## 4. Как собрать полное Windows-приложение (`.exe`)

В папке `app-kit/` (доступна в полном архиве `RustFlow-Complete-Edition.zip` и на странице `/dev`) лежат все готовые файлы:
1. **`app-kit/tauri/`** — флагманское нативное приложение на **Tauri v2 + Rust** (установщик `.exe` ~8 МБ, минимум ОЗУ, автоопределение CPU/GPU/RAM/SSD, автопоиск Rust в Steam, бэкап/применение `client.cfg`, создание точки восстановления Windows, запуск `.reg`/`.bat` с UAC).
2. **`app-kit/electron/`** — альтернативная сборка `.exe` на **Electron** (только Node.js, без установки компилятора Rust).
3. **`app-kit/cloud/`** — SQL-схема с Row-Level Security, серверный роут синхронизации и `CloudStorageAdapter` для аккаунтов пользователей.
4. **`app-kit/deploy/`** — конфиг Nginx + HTTPS для своего домена на VPS.
5. **`app-kit/GUIDE-FULL-APP.md`** — подробное пошаговое руководство по сборке `.exe`, подписи кода и правилам безопасности Easy Anti-Cheat.
