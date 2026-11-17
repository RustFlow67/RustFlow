import { OS_ALL, STEP } from "./common";
import { adminBat, userBat } from "./helpers";
import type { Tweak } from "./types";

const HARDWARE_TXT = `RustFlow — чек-лист железа
==========================

Эти пункты не лечатся файлами, но дают больше, чем любой твик реестра.

МОНИТОР
[ ] Кабель монитора подключён к видеокарте, а не к материнской плате.
[ ] Параметры → Система → Дисплей → Расширенные параметры дисплея:
    выбрана максимальная частота обновления (144 / 165 / 240 Гц).
    Очень частая ошибка: монитор на 144 Гц годами работает на 60 Гц.

ОПЕРАТИВНАЯ ПАМЯТЬ
[ ] Диспетчер задач → Производительность → Память → «Скорость».
    Если там 2133 или 2400 МГц, а на планках написано 3200+ —
    профиль XMP / DOCP / EXPO в BIOS не включён.
[ ] В BIOS включён профиль XMP (Intel), DOCP или EXPO (AMD).
    Rust очень чувствителен к скорости памяти.
[ ] Две планки стоят в двухканальном режиме: слоты A2 и B2
    (второй и четвёртый от процессора), см. инструкцию к плате.

BIOS
[ ] Включены Above 4G Decoding и Resizable BAR
    (для RTX 3000+, RX 6000+ и Intel Arc).
[ ] BIOS обновлён до актуальной версии — по инструкции производителя платы.

ОХЛАЖДЕНИЕ
[ ] Температура процессора в игре ниже 85–90 °C, видеокарты ниже 80–85 °C.
    Проверить можно в HWiNFO или MSI Afterburner.
[ ] Системный блок и радиаторы очищены от пыли.

НАКОПИТЕЛЬ
[ ] Rust установлен на SSD, на диске свободно не менее 15–20 %.

КАК ОТКАТИТЬ
Профиль памяти отключается в том же меню BIOS. Если ПК перестал запускаться
после включения XMP / EXPO — сбросьте BIOS кнопкой или перемычкой Clear CMOS.
`;

const NVIDIA_TXT = `RustFlow — чек-лист: Панель управления NVIDIA
==============================================

ГДЕ
Правый клик по рабочему столу → Панель управления NVIDIA → Параметры 3D →
Управление параметрами 3D → вкладка «Программные настройки» →
Добавить → RustClient.exe.

ПАРАМЕТРЫ ДЛЯ RUST
[ ] Режим управления электропитанием (Power management mode)
        Предпочтителен режим максимальной производительности
[ ] Режим низкой задержки (Low Latency Mode)
        Выкл. — в Rust есть NVIDIA Reflex, он работает лучше (см. ниже)
[ ] Вертикальный синхроимпульс (Vertical sync)
        Выкл.
[ ] Макс. частота кадров (Max Frame Rate)
        Выкл. — лимит удобнее задавать в игре командой fps.limit
[ ] Фильтрация текстур — качество (Texture filtering — Quality)
        Высокая производительность
[ ] Потоковая оптимизация (Threaded optimization)
        Авто
[ ] Предпочтительная частота обновления (Preferred refresh rate)
        Максимально доступная

ГЛОБАЛЬНЫЕ ПАРАМЕТРЫ
[ ] Размер кэша шейдеров (Shader Cache Size)
        10 ГБ или «Без ограничений» — меньше подгрузок после обновлений

ЕСЛИ МОНИТОР С G-SYNC
[ ] Дисплей → Настройка G-SYNC: включить для полноэкранного режима.
[ ] Вертикальный синхроимпульс в панели: Вкл.
[ ] В игре: fps.limit на 3–4 кадра ниже частоты монитора (например 141 для 144 Гц).

В САМОЙ ИГРЕ
[ ] Настройки → Графика → NVIDIA Reflex: «Вкл. + Boost».
[ ] DLSS: «Качество» или «Баланс», если узкое место — видеокарта.
    Если FPS ограничивает процессор, DLSS кадров не добавит.

ДРАЙВЕР
[ ] Установлен актуальный драйвер. При установке выберите
    «Выборочная установка» → «Выполнить чистую установку».

КАК ОТКАТИТЬ
Вкладка «Программные настройки» → RustClient.exe → кнопка «Восстановить».
`;

const AMD_TXT = `RustFlow — чек-лист: AMD Software Adrenalin
============================================

ГДЕ
AMD Software: Adrenalin Edition → вкладка «Игры» → Rust.
Если игры нет в списке: «Добавить игру» → RustClient.exe.

ПАРАМЕТРЫ ДЛЯ RUST
[ ] Radeon Anti-Lag ................................ Вкл.
[ ] Radeon Chill ................................... Выкл.
[ ] Radeon Boost ................................... Выкл.
[ ] Radeon Enhanced Sync ........................... Выкл.
[ ] Ждать вертикального обновления ................. Всегда выключено
[ ] Сглаживание .................................... Использовать настройки приложения
[ ] Качество фильтрации текстур .................... Производительность
[ ] Оптимизация формата поверхности ................ Вкл.
[ ] Режим тесселяции ............................... Оптимизировано AMD

ЕСЛИ МОНИТОР С FREESYNC
[ ] Дисплей → AMD FreeSync: Вкл.
[ ] В игре: fps.limit на 3–4 кадра ниже частоты монитора (например 141 для 144 Гц).

ПОСЛЕ ОБНОВЛЕНИЯ ДРАЙВЕРА
[ ] Графика → Дополнительно → «Сбросить кэш шейдеров».

ДРАЙВЕР
[ ] Установлен актуальный драйвер Adrenalin. При проблемах выберите
    при установке «Сброс настроек» (Factory Reset).

КАК ОТКАТИТЬ
Вкладка «Игры» → Rust → «Сбросить» в правом верхнем углу профиля.
`;

export const OTHER_TWEAKS: Tweak[] = [
  /* ------------------------------ Подготовка ------------------------------ */
  {
    slug: "restore-point",
    title: "Точка восстановления",
    tagline: "Страховка перед любыми изменениями системы",
    category: "prep",
    phase: 1,
    order: 1,
    risk: "safe",
    impact: { fps: 0, smooth: 0, latency: 0 },
    admin: true,
    restart: "none",
    time: "2 мин",
    os: OS_ALL,
    featured: true,
    what: "Включает защиту системы на системном диске и создаёт точку восстановления Windows с именем «RustFlow - before tweaks».",
    why: "На FPS не влияет — это страховка. Если после любого твика что-то пойдёт не так, систему можно вернуть в исходное состояние за несколько минут, даже не разбираясь, какой именно параметр виноват. С этого шага начинается полная настройка.",
    steps: [
      ...STEP.batAdmin,
      "Дождитесь сообщения «Restore point created» — создание занимает до пары минут.",
    ],
    check:
      "Win + R → rstrui → «Выбрать другую точку восстановления»: в списке есть запись «RustFlow - before tweaks».",
    revertSteps: [
      "Откат не нужен: точка восстановления ничего не меняет в системе.",
      "Чтобы вернуться к ней: Win + R → rstrui → выберите точку «RustFlow - before tweaks».",
    ],
    warnings: [
      "Windows создаёт не более одной точки в сутки. Если точка уже создавалась за последние 24 часа, новая может не появиться — это нормально.",
    ],
    file: {
      name: "rustflow-restore-point.bat",
      kind: "bat",
      content: adminBat(
        "System Restore point",
        String.raw`echo  Creating a restore point, please wait...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Enable-ComputerRestore -Drive '%SystemDrive%\' -ErrorAction Stop; Checkpoint-Computer -Description 'RustFlow - before tweaks' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop; Write-Host '  Restore point created.' -ForegroundColor Green } catch { Write-Host ('  Failed: ' + $_.Exception.Message) -ForegroundColor Red }"`,
        "Finished.",
      ),
    },
  },
  {
    slug: "clean-temp-cache",
    title: "Очистка временных файлов и кэша шейдеров",
    tagline: "Чистый старт после обновления драйвера или игры",
    category: "prep",
    phase: 1,
    order: 2,
    risk: "safe",
    impact: { fps: 0, smooth: 1, latency: 0 },
    admin: false,
    restart: "none",
    time: "1 мин",
    os: OS_ALL,
    what: "Удаляет временные файлы пользователя (%TEMP%) и кэши шейдеров DirectX, NVIDIA и AMD в папке %LOCALAPPDATA%. Файлы игры и настройки не затрагиваются.",
    why: "Устаревший кэш шейдеров после обновления драйвера или крупного патча Rust — частая причина рывков при повороте камеры. Очистка заставляет драйвер собрать кэш заново. Делать это постоянно не нужно: только после обновлений или при появлении необъяснимых подёргиваний.",
    steps: [
      "Полностью закройте Rust.",
      ...STEP.batUser,
      "Дождитесь сообщения «Finished» и закройте окно.",
    ],
    check: "Win + R → %TEMP% — папка почти пуста (останутся только файлы, занятые запущенными программами).",
    revertSteps: [
      "Откат не нужен: временные файлы и кэши создаются заново автоматически.",
    ],
    warnings: [
      "Первые несколько минут после очистки в игре возможны короткие подгрузки, пока драйвер заново собирает шейдеры. Это нормально и проходит само.",
    ],
    file: {
      name: "rustflow-clean-temp-cache.bat",
      kind: "bat",
      content: userBat(
        "Clean temp files and shader caches",
        String.raw`tasklist /fi "imagename eq RustClient.exe" 2>nul | find /i "RustClient.exe" >nul
if not errorlevel 1 (
  echo  Rust is running. Close the game and run this file again.
  goto end
)
echo  Cleaning user temp files...
del /f /s /q "%TEMP%\*" >nul 2>&1
for /d %%D in ("%TEMP%\*") do rd /s /q "%%D" >nul 2>&1
echo  Cleaning DirectX, NVIDIA and AMD shader caches...
for %%P in ("%LOCALAPPDATA%\D3DSCache" "%LOCALAPPDATA%\NVIDIA\DXCache" "%LOCALAPPDATA%\NVIDIA\GLCache" "%LOCALAPPDATA%\AMD\DxCache" "%LOCALAPPDATA%\AMD\DxcCache") do (
  if exist "%%~P" del /f /s /q "%%~P\*" >nul 2>&1
)
:end`,
        "Finished.",
      ),
    },
  },
  {
    slug: "hardware-checklist",
    title: "Чек-лист железа: герцовка, XMP, температура",
    tagline: "Пять проверок, которые важнее любого твика реестра",
    category: "prep",
    phase: 1,
    order: 3,
    risk: "moderate",
    impact: { fps: 3, smooth: 3, latency: 2 },
    admin: false,
    restart: "reboot",
    time: "10 мин",
    os: "Любая ОС",
    featured: true,
    what: "Чек-лист проверок, которые нельзя сделать файлом: частота обновления монитора, профиль памяти XMP / DOCP / EXPO в BIOS, двухканальный режим, Resizable BAR и температуры.",
    why: "Самые большие потери производительности в Rust прячутся здесь. Память, работающая на 2133 МГц вместо паспортных 3200+, одна планка вместо двух, монитор 144 Гц в режиме 60 Гц, перегрев процессора — каждая из этих проблем отнимает больше, чем дают все системные твики вместе взятые.",
    steps: [
      ...STEP.txt,
      "Пройдите разделы «Монитор» и «Оперативная память» — они проверяются прямо из Windows.",
      "Для пунктов BIOS перезагрузите ПК и войдите в BIOS клавишей Del или F2.",
      "После включения профиля памяти убедитесь в Диспетчере задач, что «Скорость» выросла.",
    ],
    check: "Диспетчер задач → Производительность → Память: «Скорость» совпадает с паспортной частотой ваших планок.",
    revertSteps: [
      "Профиль памяти отключается в том же меню BIOS.",
      "Если компьютер не запускается после включения XMP / EXPO, сбросьте BIOS: кнопка или перемычка Clear CMOS на материнской плате.",
    ],
    warnings: [
      "Профили XMP / EXPO — заводские, но формально это разгон памяти. На редких связках плата + память он нестабилен: если появились синие экраны или вылеты, отключите профиль.",
    ],
    file: { name: "rustflow-hardware-checklist.txt", kind: "txt", content: HARDWARE_TXT },
  },

  /* ------------------------------ Видеокарта ------------------------------ */
  {
    slug: "nvidia-panel",
    title: "Панель управления NVIDIA",
    tagline: "Профиль драйвера для RustClient.exe",
    category: "gpu",
    phase: 3,
    order: 150,
    risk: "safe",
    impact: { fps: 1, smooth: 1, latency: 2 },
    admin: false,
    restart: "game",
    time: "5 мин",
    os: OS_ALL,
    what: "Чек-лист параметров 3D для RustClient.exe: режим электропитания, вертикальная синхронизация, фильтрация текстур, кэш шейдеров, а также настройки G-SYNC, Reflex и DLSS.",
    why: "Главное здесь — задержка ввода: связка Reflex в игре, отключённого V-Sync и режима максимальной производительности убирает лишние миллисекунды между движением мыши и выстрелом. Прирост FPS от самой панели небольшой. Профиль драйвера нельзя честно настроить одним файлом, поэтому это чек-лист с точными названиями пунктов.",
    steps: [
      ...STEP.txt,
      "Откройте Панель управления NVIDIA → Параметры 3D → Управление параметрами 3D.",
      "На вкладке «Программные настройки» добавьте RustClient.exe и выставьте пункты из чек-листа.",
      "Нажмите «Применить» и перезапустите игру.",
    ],
    check: "В панели NVIDIA на вкладке «Программные настройки» у RustClient.exe изменённые пункты выделены жирным.",
    revertSteps: [
      "Панель NVIDIA → Программные настройки → RustClient.exe → кнопка «Восстановить».",
    ],
    file: { name: "rustflow-nvidia-checklist.txt", kind: "txt", content: NVIDIA_TXT },
  },
  {
    slug: "amd-adrenalin",
    title: "AMD Software Adrenalin",
    tagline: "Профиль драйвера Radeon для Rust",
    category: "gpu",
    phase: 3,
    order: 160,
    risk: "safe",
    impact: { fps: 1, smooth: 1, latency: 2 },
    admin: false,
    restart: "game",
    time: "5 мин",
    os: OS_ALL,
    what: "Чек-лист игрового профиля Rust в AMD Software: Anti-Lag, Chill, Boost, Enhanced Sync, вертикальная синхронизация, фильтрация текстур, FreeSync и сброс кэша шейдеров.",
    why: "Anti-Lag сокращает задержку ввода, когда видеокарта загружена на 100%, а отключение Chill и Enhanced Sync убирает плавающий FPS и рывки. Как и у NVIDIA, прирост кадров от драйвера скромный — выигрыш в отклике и ровности.",
    steps: [
      ...STEP.txt,
      "Откройте AMD Software → вкладка «Игры» → Rust.",
      "Выставьте пункты из чек-листа и перезапустите игру.",
    ],
    check: "AMD Software → Игры → Rust: в профиле отображаются выставленные значения.",
    revertSteps: ["AMD Software → Игры → Rust → «Сбросить» в правом верхнем углу профиля."],
    file: { name: "rustflow-amd-checklist.txt", kind: "txt", content: AMD_TXT },
  },

  /* --------------------------------- Сеть --------------------------------- */
  {
    slug: "nic-power",
    title: "Энергосбережение сетевого адаптера",
    tagline: "Адаптер не засыпает и не теряет пакеты",
    category: "network",
    phase: 6,
    order: 400,
    risk: "moderate",
    impact: { fps: 0, smooth: 1, latency: 1 },
    admin: true,
    restart: "none",
    time: "1 мин",
    os: OS_ALL,
    what: "Отключает функции управления питанием на активных физических сетевых адаптерах командой Disable-NetAdapterPowerManagement.",
    why: "Энергосберегающие режимы адаптера могут давать редкие скачки пинга и короткие потери связи, особенно на Wi-Fi и ноутбуках. Если соединение у вас и так стабильное, разницы не будет. Средний пинг до сервера твик не снижает — он зависит от маршрута провайдера.",
    steps: [
      ...STEP.batAdmin,
      "Соединение может пропасть на 2–5 секунд, пока адаптер перезапускается — не запускайте скрипт во время игры.",
    ],
    check:
      "Диспетчер устройств → Сетевые адаптеры → ваш адаптер → Управление электропитанием: галочка «Разрешить отключение этого устройства для экономии энергии» снята.",
    revertSteps: ["Запустите файл отката — он снова включит управление питанием адаптера."],
    warnings: [
      "Отключается и пробуждение по сети (Wake-on-LAN). Если вы им пользуетесь, не применяйте твик.",
      "На ноутбуке немного вырастет расход батареи.",
    ],
    file: {
      name: "rustflow-nic-power-off.bat",
      kind: "bat",
      content: adminBat(
        "Network adapter power saving OFF",
        String.raw`powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Write-Host ('  Adapter: ' + $_.Name); Disable-NetAdapterPowerManagement -Name $_.Name -ErrorAction SilentlyContinue }"`,
        "Done.",
      ),
    },
    revert: {
      name: "rustflow-nic-power-REVERT.bat",
      kind: "bat",
      content: adminBat(
        "Network adapter power saving ON",
        String.raw`powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Write-Host ('  Adapter: ' + $_.Name); Enable-NetAdapterPowerManagement -Name $_.Name -ErrorAction SilentlyContinue }"`,
        "Done.",
      ),
    },
  },
  {
    slug: "network-reset",
    title: "Сброс DNS и Winsock",
    tagline: "Ремонтный набор при проблемах с подключением",
    category: "network",
    phase: 6,
    order: 410,
    risk: "moderate",
    impact: { fps: 0, smooth: 0, latency: 1 },
    admin: true,
    restart: "reboot",
    time: "2 мин",
    os: OS_ALL,
    what: "Очищает кэш DNS (ipconfig /flushdns) и сбрасывает каталог Winsock (netsh winsock reset) к состоянию по умолчанию.",
    why: "Это не ускоритель, а ремонт: помогает, если не грузится список серверов, игра не подключается или соединение обрывается после VPN, антивируса или «оптимизаторов». Если сеть работает нормально, применять не нужно — пинг твик не снизит.",
    steps: [...STEP.batAdmin, "Перезагрузите компьютер — сброс Winsock применяется после перезагрузки."],
    check: "После перезагрузки список серверов в Rust загружается, подключение проходит без ошибок.",
    revertSteps: [
      "Отката нет: команда возвращает сетевой стек к заводскому состоянию.",
      "Программы, встраивающиеся в сеть (VPN-клиенты, некоторые антивирусы), могут попросить переустановить их сетевой компонент.",
    ],
    warnings: [
      "Если вы пользуетесь VPN-клиентом или прокси-программой, после сброса проверьте, что они работают.",
    ],
    file: {
      name: "rustflow-network-reset.bat",
      kind: "bat",
      content: adminBat(
        "DNS cache and Winsock reset",
        String.raw`echo  Flushing DNS cache...
ipconfig /flushdns >nul
echo  Resetting Winsock catalog...
netsh winsock reset >nul`,
        "Done. Reboot the PC to apply.",
      ),
    },
  },
];
