import { OS_ALL, STEP } from "./common";
import { cfgInstaller, cfgInstallerDynamic, cfgRestore, consoleList } from "./helpers";
import type { Tweak, TweakFile } from "./types";

/* Convars below are the same keys the game itself writes to cfg\client.cfg. */

const COMPETITIVE: Record<string, string> = {
  "fps.limit": "0",
  "graphics.vsync": "0",
  "graphics.shadowmode": "1",
  "graphics.shadowquality": "0",
  "graphics.shadowcascades": "1",
  "graphics.shadowdistance": "50",
  "graphics.shadowlights": "0",
  "graphics.drawdistance": "1500",
  "graphics.lodbias": "1",
  "graphics.shaderlod": "100",
  "graphics.af": "1",
  "graphics.parallax": "0",
  "graphics.dof": "False",
  "graphics.contactshadows": "False",
  "graphics.grassshadows": "False",
  "graphics.impostorshadows": "False",
  "grass.displacement": "False",
  "grass.quality": "0",
  "tree.quality": "0",
  "tree.meshes": "50",
  "terrain.quality": "0",
  "water.quality": "0",
  "water.reflections": "0",
  "effects.antialiasing": "0",
  "effects.ao": "False",
  "effects.bloom": "False",
  "effects.lensdirt": "False",
  "effects.motionblur": "False",
  "effects.shafts": "False",
  "effects.sharpen": "True",
  "effects.vignet": "False",
  "effects.maxgibs": "0",
};

const BALANCED: Record<string, string> = {
  "fps.limit": "0",
  "graphics.vsync": "0",
  "graphics.shadowmode": "2",
  "graphics.shadowquality": "1",
  "graphics.shadowcascades": "1",
  "graphics.shadowdistance": "150",
  "graphics.shadowlights": "1",
  "graphics.drawdistance": "2000",
  "graphics.lodbias": "2",
  "graphics.shaderlod": "300",
  "graphics.af": "4",
  "graphics.parallax": "0",
  "graphics.dof": "False",
  "graphics.contactshadows": "False",
  "graphics.grassshadows": "False",
  "graphics.impostorshadows": "False",
  "grass.displacement": "False",
  "grass.quality": "50",
  "tree.quality": "100",
  "tree.meshes": "100",
  "terrain.quality": "50",
  "water.quality": "1",
  "water.reflections": "0",
  "effects.antialiasing": "3",
  "effects.ao": "False",
  "effects.bloom": "False",
  "effects.lensdirt": "False",
  "effects.motionblur": "False",
  "effects.shafts": "False",
  "effects.sharpen": "True",
  "effects.vignet": "False",
  "effects.maxgibs": "0",
};

const QUALITY: Record<string, string> = {
  "fps.limit": "0",
  "graphics.vsync": "0",
  "graphics.shadowmode": "2",
  "graphics.shadowquality": "2",
  "graphics.shadowdistance": "400",
  "graphics.shadowlights": "3",
  "graphics.drawdistance": "2500",
  "graphics.lodbias": "3",
  "graphics.shaderlod": "600",
  "graphics.af": "16",
  "graphics.parallax": "2",
  "graphics.dof": "False",
  "graphics.contactshadows": "True",
  "graphics.grassshadows": "True",
  "grass.displacement": "True",
  "grass.quality": "100",
  "tree.quality": "200",
  "tree.meshes": "100",
  "terrain.quality": "100",
  "water.quality": "2",
  "water.reflections": "2",
  "effects.antialiasing": "3",
  "effects.ao": "True",
  "effects.bloom": "True",
  "effects.lensdirt": "False",
  "effects.motionblur": "False",
  "effects.shafts": "True",
  "effects.sharpen": "True",
  "effects.vignet": "False",
};

const RESTORE_FILE: TweakFile = {
  name: "rustflow-restore-client-cfg.bat",
  kind: "bat",
  content: cfgRestore(),
};

const PRESET_REVERT = [
  "Закройте Rust и запустите файл отката: он восстановит client.cfg из резервной копии client.cfg.rustflow-backup, созданной при первой установке.",
  "Либо просто верните значения вручную в меню «Настройки → Графика».",
];

const PRESET_WARNINGS = [
  "Имена и допустимые диапазоны настроек меняются с обновлениями игры. Значения вне диапазона Rust сам приводит к ближайшему допустимому, неизвестные строки игнорирует.",
  "Пресет не трогает чувствительность мыши, бинды, звук и разрешение экрана.",
];

const MANUAL_NOTE =
  "Если не хотите запускать скрипт: откройте консоль клавишей F1 и вводите команды по одной строке. В конце выполните writecfg, чтобы игра сохранила их.";

const GC_CODE = String.raw`$ramGb = 16
try { $ramGb = [int][math]::Round((Get-CimInstance -ClassName Win32_ComputerSystem).TotalPhysicalMemory / 1GB) } catch { }
if ($env:RUSTFLOW_RAM_GB) { $ramGb = [int]$env:RUSTFLOW_RAM_GB }
if ($ramGb -ge 30) { $buf = '4096' } elseif ($ramGb -ge 15) { $buf = '2048' } elseif ($ramGb -ge 11) { $buf = '1024' } else { $buf = '256' }
Write-Host ('  Detected RAM: ' + $ramGb + ' GB, gc.buffer will be set to ' + $buf)
$Settings = [ordered]@{ 'gc.buffer' = $buf }`;

const LAUNCH_TXT = `RustFlow — параметры запуска Rust
=================================

КУДА ВСТАВЛЯТЬ
Steam → Библиотека → правый клик по Rust → Свойства → Общие → «Параметры запуска».

РЕКОМЕНДУЕМАЯ СТРОКА

-window-mode exclusive

ЧТО ОНА ДЕЛАЕТ
-window-mode exclusive   Документированный параметр движка Unity: игра стартует
                         в эксклюзивном полноэкранном режиме, минуя композитор
                         рабочего стола. Обычно это минимальная задержка ввода.

ДОПОЛНИТЕЛЬНО, ЕСЛИ НУЖНО
-monitor 2                               Запуск на втором мониторе (нумерация с 1).
-screen-width 1920 -screen-height 1080   Принудительное разрешение, если игра
                                         стартует не в том.

ЧЕГО В СТРОКЕ НЕТ И ПОЧЕМУ
-maxMem=...  -malloc=system  -cpuCount=...  -exThreads=...
    Параметры из игр серии Arma. В документации Unity и Facepunch их нет,
    подтверждённого влияния на Rust нет — мы их не добавляем.
-high
    Параметр движка Source. Для Rust приоритет надёжнее задать твиком
    «Высокий приоритет процесса Rust».
-gc.buffer ...
    Сборщик мусора настраивается твиком «gc.buffer»: значение сохраняется
    в client.cfg и применяется при каждом запуске.

КАК ОТКАТИТЬ
Очистите поле «Параметры запуска».
`;

const BINDS_TXT = `RustFlow — полезные бинды Rust
==============================

КАК ПРИМЕНИТЬ
1. В игре нажмите F1 — откроется консоль.
2. Вводите команды по одной строке и нажимайте Enter.
3. В конце введите: writecfg

БИНДЫ

bind q forward;sprint
    Автобег: нажали Q — персонаж бежит сам. Отмена: W или Shift.

bind z attack;duck
    Автодобыча сидя: нажали Z — персонаж приседает и бьёт сам.
    Отмена: левая кнопка мыши и Ctrl.

bind f1 consoletoggle;combatlog
    Консоль сразу открывается с журналом боя — видно, кто и откуда попал.

bind f5 kill
    Быстрый респаун. Ставьте только на клавишу, которую не заденете случайно.

bind f6 client.connect 127.0.0.1:28015
    Подключение к любимому серверу одной клавишей.
    Замените адрес и порт на данные своего сервера.

ПОЛЕЗНЫЕ КОМАНДЫ КОНСОЛИ

perf 1          Счётчик FPS. Значения выше добавляют память, пинг и другие данные.
fps.limit 0     Снять ограничение FPS. Или укажите число, например fps.limit 141.
combatlog       Журнал последних попаданий.

КАК ОТКАТИТЬ
unbind q
unbind z
unbind f5
unbind f6
bind f1 consoletoggle
writecfg
`;

const STEAM_TXT = `RustFlow — чек-лист: Steam и оверлеи
====================================

STEAM
[ ] Библиотека → Rust → Свойства → Общие → «Включить оверлей Steam в игре»:
    выключить, если не пользуетесь им в Rust.
[ ] Настройки → Загрузки → «Разрешать загрузки во время игры»: выключить.
[ ] Настройки → Друзья и чат → анимированные аватары: выключить.
[ ] Настройки → Интерфейс → «Запускать Steam при включении компьютера»:
    по желанию, меньше процессов при старте системы.

RUST
[ ] Игра установлена на SSD.
    Свойства → Установленные файлы → «Переместить папку установки».
[ ] После крупного обновления или при вылетах:
    Свойства → Установленные файлы → «Проверить целостность файлов игры».

ОВЕРЛЕИ ДРУГИХ ПРОГРАММ
[ ] Discord → Настройки → Игровой оверлей: выключить.
[ ] Discord → Настройки → Расширенные → Аппаратное ускорение:
    выключить на слабых видеокартах.
[ ] NVIDIA App / GeForce Experience → Внутриигровой оверлей:
    выключить, если не записываете клипы.
[ ] Закройте браузер перед игрой: вкладки с видео занимают память и GPU.

ПРОВЕРКА
Диспетчер задач → Процессы: перед запуском Rust загрузка процессора в простое
не выше 5–10 %, свободно не менее 10 ГБ оперативной памяти.
`;

export const GAME_TWEAKS: Tweak[] = [
  {
    slug: "steam-checklist",
    title: "Steam и оверлеи",
    tagline: "Убираем всё, что рисуется поверх игры и качается в фоне",
    category: "game",
    phase: 4,
    order: 200,
    risk: "safe",
    impact: { fps: 1, smooth: 1, latency: 0 },
    admin: false,
    restart: "game",
    time: "5 мин",
    os: OS_ALL,
    what: "Чек-лист ручных настроек: оверлеи Steam, Discord и NVIDIA, фоновые загрузки, установка игры на SSD и проверка целостности файлов.",
    why: "Каждый оверлей внедряется в кадр игры и стоит нескольких кадров в секунду, а фоновая загрузка обновлений нагружает диск и сеть прямо во время рейда. Перенос Rust с HDD на SSD — самое заметное изменение для времени загрузки и подгрузки текстур. Автоматизировать эти настройки нельзя, поэтому это чек-лист.",
    steps: [
      ...STEP.txt,
      "Пройдите пункты сверху вниз, отмечая выполненные.",
      "Перезапустите Steam и Rust.",
    ],
    check: "В игре больше не открываются оверлеи по Shift + Tab и Alt + Z (если вы их отключили).",
    revertSteps: ["Верните переключатели в прежнее положение в тех же меню."],
    file: { name: "rustflow-steam-checklist.txt", kind: "txt", content: STEAM_TXT },
  },
  {
    slug: "launch-options",
    title: "Параметры запуска без плацебо",
    tagline: "Одна рабочая строка вместо десятка мифов",
    category: "game",
    phase: 4,
    order: 210,
    risk: "safe",
    impact: { fps: 0, smooth: 0, latency: 1 },
    admin: false,
    restart: "game",
    time: "1 мин",
    os: OS_ALL,
    featured: true,
    what: "Готовая строка параметров запуска Steam: -window-mode exclusive. Это документированный аргумент движка Unity, включающий эксклюзивный полноэкранный режим.",
    why: "По сети гуляют строки из десяти параметров: -maxMem, -malloc=system, -cpuCount, -exThreads, -high. Первые четыре пришли из гайдов по Arma, последний — из движка Source; в документации Unity и Facepunch их нет, и подтверждённого эффекта в Rust они не дают. Мы оставили только то, что действительно обрабатывается игрой, и объяснили остальное в файле.",
    steps: [
      "Скачайте файл и откройте его в Блокноте.",
      "Steam → Библиотека → правый клик по Rust → Свойства → Общие.",
      "Скопируйте рекомендуемую строку в поле «Параметры запуска» и закройте окно.",
      "Запустите игру.",
    ],
    check: "Настройки → Экран в игре: режим «Exclusive». При Alt + Tab экран кратко мигает — это признак эксклюзивного режима.",
    revertSteps: ["Очистите поле «Параметры запуска» в свойствах игры."],
    warnings: [
      "Если вы часто переключаетесь между игрой и другими окнами, эксклюзивный режим будет сворачиваться медленнее оконного без рамки.",
    ],
    file: { name: "rustflow-launch-options.txt", kind: "txt", content: LAUNCH_TXT },
    manual: {
      title: "Строка для Steam",
      note: "Вставьте в Steam → Rust → Свойства → Общие → Параметры запуска.",
      content: "-window-mode exclusive",
    },
  },
  {
    slug: "preset-competitive",
    title: "Пресет графики «Максимум FPS»",
    tagline: "Минимум эффектов, максимум кадров и читаемости",
    category: "game",
    phase: 5,
    order: 300,
    risk: "safe",
    impact: { fps: 3, smooth: 2, latency: 1 },
    admin: false,
    restart: "game",
    time: "1 мин",
    os: OS_ALL,
    featured: true,
    what: `Установщик записывает ${Object.keys(COMPETITIVE).length} настроек графики в файл cfg\\client.cfg: минимальные тени, вода и трава, отключённые постэффекты, дальность прорисовки 1500 и отключённые обломки (maxgibs 0). Остальные строки файла не меняются.`,
    why: "Настройки графики — самый сильный рычаг в Rust: именно здесь выигрываются десятки кадров, а не в реестре. Пресет рассчитан на слабые и средние ПК и на тех, кому важнее всего видимость противника. Картинка станет проще, зато кадры — выше и стабильнее, особенно в рейдах.",
    steps: [...STEP.cfg, "Запустите Rust и проверьте настройки в меню «Графика»."],
    check: "В игре: F1 → введите graphics.shadowdistance — консоль покажет значение 50.",
    revertSteps: PRESET_REVERT,
    warnings: PRESET_WARNINGS,
    file: {
      name: "rustflow-preset-max-fps.bat",
      kind: "bat",
      content: cfgInstaller("Preset Max FPS", COMPETITIVE),
    },
    revert: RESTORE_FILE,
    manual: { title: "Команды для консоли F1", note: MANUAL_NOTE, content: consoleList(COMPETITIVE) },
  },
  {
    slug: "preset-balanced",
    title: "Пресет графики «Баланс»",
    tagline: "Аккуратная картинка без дорогих эффектов",
    category: "game",
    phase: 5,
    order: 310,
    risk: "safe",
    impact: { fps: 2, smooth: 2, latency: 0 },
    admin: false,
    restart: "game",
    time: "1 мин",
    os: OS_ALL,
    what: `Установщик записывает ${Object.keys(BALANCED).length} настроек в cfg\\client.cfg: средние тени и растительность, сглаживание TSSAA, дальность 2000, отключены самые дорогие постэффекты (AO, bloom, лучи, размытие в движении).`,
    why: "Для средних и хороших ПК. Отключены эффекты, которые стоят много кадров и мешают видеть противника, но мир остаётся объёмным и приятным. Хорошая отправная точка: дальше можно поднимать отдельные настройки и смотреть на счётчик FPS.",
    steps: [...STEP.cfg, "Запустите Rust и проверьте настройки в меню «Графика»."],
    check: "В игре: F1 → введите graphics.drawdistance — консоль покажет значение 2000.",
    revertSteps: PRESET_REVERT,
    warnings: PRESET_WARNINGS,
    file: {
      name: "rustflow-preset-balanced.bat",
      kind: "bat",
      content: cfgInstaller("Preset Balanced", BALANCED),
    },
    revert: RESTORE_FILE,
    manual: { title: "Команды для консоли F1", note: MANUAL_NOTE, content: consoleList(BALANCED) },
  },
  {
    slug: "preset-quality",
    title: "Пресет графики «Красота»",
    tagline: "Высокая детализация для мощных видеокарт",
    category: "game",
    phase: 5,
    order: 320,
    risk: "safe",
    impact: { fps: 0, smooth: 1, latency: 0 },
    admin: false,
    restart: "game",
    time: "1 мин",
    os: OS_ALL,
    what: `Установщик записывает ${Object.keys(QUALITY).length} настроек в cfg\\client.cfg: высокие тени, вода с отражениями, максимальная растительность, AO, bloom и объёмные лучи. Отключены только размытие в движении, виньетка и «грязь» на линзе.`,
    why: "Этот пресет не про прирост FPS — он про красивую картинку без откровенно лишнего. Подходит, если по оценке ПК у вас большой запас по видеокарте. Мусорные эффекты, которые ухудшают видимость и ничего не дают картинке, всё равно отключены.",
    steps: [...STEP.cfg, "Запустите Rust и проверьте настройки в меню «Графика»."],
    check: "В игре: F1 → введите graphics.drawdistance — консоль покажет значение 2500.",
    revertSteps: PRESET_REVERT,
    warnings: PRESET_WARNINGS,
    file: {
      name: "rustflow-preset-quality.bat",
      kind: "bat",
      content: cfgInstaller("Preset Quality", QUALITY),
    },
    revert: RESTORE_FILE,
    manual: { title: "Команды для консоли F1", note: MANUAL_NOTE, content: consoleList(QUALITY) },
  },
  {
    slug: "gc-buffer",
    title: "gc.buffer — сборщик мусора Unity",
    tagline: "Главное средство от ритмичных фризов",
    category: "game",
    phase: 5,
    order: 330,
    risk: "safe",
    impact: { fps: 0, smooth: 3, latency: 0 },
    admin: false,
    restart: "game",
    time: "1 мин",
    os: OS_ALL,
    featured: true,
    what: "Установщик определяет объём оперативной памяти и записывает в client.cfg подходящее значение gc.buffer: 4096 для 32 ГБ и больше, 2048 для 16 ГБ, 1024 для 12 ГБ. При 8 ГБ остаётся значение по умолчанию 256.",
    why: "Короткие замирания раз в несколько десятков секунд — почти всегда сборщик мусора Unity: игра останавливается, чтобы очистить память. Чем больше буфер, тем реже происходят такие паузы. Средний FPS не изменится, но игра перестанет «икать» посреди перестрелки. Для большинства игроков это самый ощутимый твик после пресета графики.",
    steps: [...STEP.cfg, "Запустите Rust. Значение применяется при каждом запуске игры."],
    check: "В игре: F1 → введите gc.buffer — консоль покажет установленное значение.",
    revertSteps: [
      "Запустите файл отката — он восстановит client.cfg из резервной копии.",
      "Либо в консоли F1 введите gc.buffer 256 и затем writecfg.",
    ],
    warnings: [
      "Большой буфер увеличивает расход оперативной памяти. Поэтому при 8 ГБ скрипт оставляет значение по умолчанию: иначе фризы от подкачки будут хуже фризов от сборщика.",
    ],
    file: {
      name: "rustflow-gc-buffer.bat",
      kind: "bat",
      content: cfgInstallerDynamic("gc.buffer by RAM size", GC_CODE),
    },
    revert: RESTORE_FILE,
    manual: {
      title: "Команды для консоли F1",
      note: "Выберите значение под свой объём памяти: 4096 для 32 ГБ, 2048 для 16 ГБ, 1024 для 12 ГБ.",
      content: "gc.buffer 2048\nwritecfg",
    },
  },
  {
    slug: "binds",
    title: "Полезные бинды",
    tagline: "Автобег, автодобыча, журнал боя одной клавишей",
    category: "game",
    phase: 5,
    order: 340,
    risk: "safe",
    impact: { fps: 0, smooth: 0, latency: 0 },
    admin: false,
    restart: "none",
    time: "3 мин",
    os: "Любая ОС",
    what: "Набор команд bind для консоли Rust: автобег, автодобыча в приседе, консоль с журналом боя, быстрый респаун и подключение к серверу одной клавишей. Плюс команды отмены.",
    why: "На FPS бинды не влияют — они экономят руки и время. Автобег и автодобыча разгружают пальцы во время фарма, а combatlog сразу показывает, откуда и чем по вам попали. Это штатная функция консоли игры.",
    steps: [
      "Скачайте файл и откройте его в Блокноте.",
      "В игре нажмите F1, чтобы открыть консоль.",
      "Вводите нужные команды по одной строке, после каждой нажимайте Enter.",
      "В конце введите writecfg, чтобы бинды сохранились.",
    ],
    check: "Нажмите Q на сервере — персонаж должен побежать сам.",
    revertSteps: ["В консоли F1 введите команды unbind из конца файла, затем writecfg."],
    warnings: [
      "Если клавиши Q, Z, F5 или F6 у вас уже заняты, замените их в командах на свободные.",
    ],
    file: { name: "rustflow-binds.txt", kind: "txt", content: BINDS_TXT },
  },
];
