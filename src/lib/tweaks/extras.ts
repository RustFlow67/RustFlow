import { OS_ALL, STEP } from "./common";
import { adminBat, reg } from "./helpers";
import type { Tweak } from "./types";

const XMP_TXT = `RustFlow — настройка RAM: XMP / EXPO, двухканал и тайминги
==========================================================

ПОЧЕМУ ЭТО КРИТИЧНО В RUST
Главный поток Unity постоянно обращается к структурам построек и сущностей.
При промахе L3-кэша процессор ждёт оперативную память: переход с JEDEC 2133/2400
на XMP 3200–3600 CL16–18 (или DDR5-6000 CL30) даёт +12–22% к avg FPS и до +30% к 1% low.

ШАГ 1 — ПРОВЕРКА ТЕКУЩЕГО РЕЖИМА
[ ] Диспетчер задач → Производительность → Память:
    проверьте «Скорость» (МТ/с) и «Использовано гнёзд» (должно быть 2 из 2 или 2 из 4).
[ ] В CPU-Z (вкладка Memory): Channel = Dual (или 2x 64-bit / 4x 32-bit на DDR5),
    CAS# Latency (CL) совпадает с паспортом модулей.

ШАГ 2 — ПРАВИЛЬНЫЕ СЛОТЫ (ДВУХКАНАЛ)
[ ] На плате с 4 слотами две планки ставятся в A2 и B2 (2-й и 4-й от CPU).
    Одна планка или слоты A1+A2 режут пропускную способность вдвое.

ШАГ 3 — ВКЛЮЧЕНИЕ ПРОФИЛЯ В BIOS
[ ] Перезагрузите ПК → Del или F2 → найдите XMP (Intel) / DOCP (AMD AM4) / EXPO (AMD AM5).
[ ] Выберите Profile 1, сохраните (F10).
[ ] Для Ryzen 5000 (DDR4-3600): убедитесь, что FCLK = 1800 МГц (режим 1:1 с MCLK).
[ ] Для Ryzen 7000/9000 (DDR5-6000): UCLK = MEMCLK (режим 1:1).

ШАГ 4 — ПРОВЕРКА СТАБИЛЬНОСТИ И EAC
[ ] Профиль XMP/EXPO и ручная настройка таймингов в BIOS на 100% безопасны для EAC.
[ ] При вылетах или BSOD проверьте память в TestMem5 / OCCT Memory; при ошибках
    снизьте частоту на шаг (например 3600 → 3466) или сбросьте Clear CMOS.
`;

const MYTH_LAUNCH_TXT = `RustFlow — разбор мифа: -maxMem, -malloc=system, -cpuCount, -exThreads
======================================================================

СТАТУС: МИФ (ПЛАЦЕБО)

ЧТО ОБЫЧНО КОПИРУЮТ ИЗ СТАРЫХ ГАЙДОВ
-high -maxMem=16384 -malloc=system -cpuCount=8 -exThreads=16 -force-d3d11-no-singlethreaded

ПОЧЕМУ ЭТО НЕ РАБОТАЕТ В RUST
1. -maxMem, -malloc=system, -cpuCount, -exThreads — аргументы движка Real Virtuality
   (Arma 2 / Arma 3 / DayZ). Движок Unity в Rust их не парсит.
2. -force-d3d11-no-singlethreaded — устаревший флаг ранних версий Unity.
3. В слепых замерах (3 прогона по 60 сек на одной сцене) разница по avg FPS и 1% low
   составляет ±1 FPS — чистая погрешность сервера.

ЧТО ДЕЛАТЬ ВМЕСТО ЭТОГО
1. Откройте Steam → Rust → Свойства → Общие → Параметры запуска.
2. Удалите старые флаги и оставьте только рабочий:
   -window-mode exclusive
3. Буфер сборщика мусора пропишите в cfg\\client.cfg:
   gc.buffer "2048"   (для 16 ГБ RAM)
   gc.buffer "4096"   (для 32+ ГБ RAM)
`;

const DEFENDER_WARNING_TXT = `RustFlow — АНТИ-ТВИК: отключение Windows Defender и Windows Update
==================================================================

СТАТУС: ВРЕДНО — НЕ ПРИМЕНЯТЬ!

ПОЧЕМУ НЕЛЬЗЯ ВЫРЕЗАТЬ DEFENDER И ОБНОВЛЕНИЯ
1. Прирост FPS в Rust при вырезании Defender на современном ПК с SSD: 0–1%
   (в пределах шума замера). Defender сам снижает активность в полноэкранной игре.
2. Отключение Windows Update и «урезанные игровые сборки» ломают корневые сертификаты,
   обновления планировщика CPU и запуск Easy Anti-Cheat (EAC).
3. Аккаунты Steam с инвентарём Rust — главная цель стиллеров. Отключённый SmartScreen
   и Defender многократно повышают риск потери аккаунта.

КАК ВЕРНУТЬ ЗАЩИТУ, ЕСЛИ ВЫ ОТКЛЮЧАЛИ ЕЁ РАНЕЕ
[ ] Win + I → Конфиденциальность и защита → Безопасность Windows →
    Защита от вирусов и угроз → Управление настройками → включите
    «Защита в режиме реального времени» и «Облачная защита».
[ ] Проверьте службы: Win + R → services.msc → «Центр обновления Windows» (wuauserv) —
    тип запуска «Вручную».
[ ] Если использовалась сторонняя «вырезанная» сборка ОС — надёжнее всего чистая
    установка официального образа Windows 11/10 с сайта Microsoft.
`;

/** Дополнительные твики RAM/SSD и задокументированные мифы / вредные анти-твики. */
export const EXTRA_TWEAKS: Tweak[] = [
  {
    slug: "xmp-expo-timings",
    title: "Профиль RAM XMP / EXPO и двухканал",
    tagline: "Снижение задержки памяти и рост 1% low до +20–30%",
    category: "prep",
    group: "ram-ssd",
    riskLevel: "safe",
    evidence: "measured",
    gainPct: 18,
    gainLabel: "+12–22% FPS (оценка)",
    phase: 1,
    order: 4,
    risk: "safe",
    impact: { fps: 3, smooth: 3, latency: 2 },
    admin: false,
    restart: "reboot",
    time: "5 мин",
    os: "BIOS / любая ОС",
    featured: true,
    what: "Пошаговая проверка двухканального режима (слоты A2+B2), активация заводского профиля XMP / DOCP / EXPO в BIOS и контроль делителя FCLK/UCLK 1:1 на Ryzen.",
    why: "В Rust главный поток CPU постоянно упирается в задержку подсистемы памяти на застроенных серверах. Переход с базовых JEDEC 2133/2400 МТ/с на DDR4-3600 CL16–18 или DDR5-6000 CL30 — один из самых сильных подтверждённых приростов по avg и 1% low. Аппаратная настройка RAM в BIOS на 100% безопасна для EAC.",
    steps: [
      "Откройте Диспетчер задач → Производительность → Память и проверьте текущую скорость (МТ/с) и число занятых слотов.",
      "Убедитесь, что две планки установлены через слот — в A2 и B2 (2-й и 4-й от процессора).",
      "Перезагрузите ПК, войдите в BIOS (Del / F2), включите XMP / DOCP / EXPO Profile 1 и сохраните настройки (F10).",
      "После загрузки убедитесь, что частота выросла, и сделайте контрольный прогон в Rust.",
    ],
    check:
      "Диспетчер задач → Память: скорость соответствует паспорту модулей (например 3200 / 3600 / 6000 МТ/с), CPU-Z показывает Dual Channel.",
    revertSteps: [
      "Верните XMP / EXPO в положение Auto / Disabled в BIOS.",
      "Если ПК не стартует после нестабильного профиля — сбросьте настройки кнопкой или перемычкой Clear CMOS.",
    ],
    file: { name: "rustflow-ram-xmp-expo.txt", kind: "txt", content: XMP_TXT },
  },
  {
    slug: "ssd-trim-free-space",
    title: "SSD для Rust: проверка TRIM и свободного места",
    tagline: "Быстрый вход на сервер и ровная подгрузка монументов",
    category: "prep",
    group: "ram-ssd",
    riskLevel: "safe",
    evidence: "measured",
    gainPct: 12,
    gainLabel: "+15–30% 1% low с HDD",
    phase: 1,
    order: 5,
    risk: "safe",
    impact: { fps: 1, smooth: 3, latency: 0 },
    admin: true,
    restart: "none",
    time: "2 мин",
    os: OS_ALL,
    what: "Скрипт проверяет и включает команду TRIM для SSD (DisableDeleteNotify = 0) и запускает штатную оптимизацию ReTrim для системного тома.",
    why: "На HDD загрузка карты Rust длится 10–25 минут, а при беге к крупным базам кадр замирает на подгрузке префабов. На SSD (особенно NVMe) и при 15–20% свободного места контроллер держит высокую скорость случайного чтения 4K и работы файла подкачки.",
    steps: [
      "Убедитесь в Steam → Rust → Свойства → Установленные файлы, что игра стоит на SSD, и на нём свободно ≥15–20% объёма.",
      ...STEP.batAdmin,
      "Проверьте строку «DisableDeleteNotify = 0» (это означает, что TRIM активен).",
    ],
    check: "Команда fsutil behavior query DisableDeleteNotify выводит значение 0 (TRIM включён).",
    revertSteps: [
      "Откат не требуется: включённый TRIM — штатный и рекомендуемый режим Windows для всех SSD.",
    ],
    file: {
      name: "rustflow-ssd-trim-check.bat",
      kind: "bat",
      content: adminBat(
        "Enable and verify SSD TRIM",
        String.raw`echo  Checking NTFS TRIM state (0 = enabled)...
fsutil behavior set DisableDeleteNotify 0
fsutil behavior query DisableDeleteNotify
echo.
echo  Running standard Windows ReTrim on %SystemDrive%...
defrag %SystemDrive% /O`,
        "Done. Keep at least 15-20% free space on your Rust SSD.",
      ),
    },
  },
  {
    slug: "launch-myth-arma",
    title: "Флаги -maxMem, -malloc=system, -cpuCount",
    tagline: "Популярный миф из Arma 3 — движок Unity их игнорирует",
    category: "game",
    group: "launch-options",
    riskLevel: "caution",
    evidence: "myth",
    gainPct: 0,
    gainLabel: "0% · Плацебо",
    excludeFromPack: true,
    phase: 4,
    order: 215,
    risk: "moderate",
    impact: { fps: 0, smooth: 0, latency: 0 },
    admin: false,
    restart: "game",
    time: "1 мин",
    os: OS_ALL,
    what: "Разбор строки -maxMem=16384 -malloc=system -cpuCount=8 -exThreads=16 -force-d3d11-no-singlethreaded и инструкция по очистке параметров запуска Steam.",
    why: "Эти ключи принадлежат движку Real Virtuality (серия Arma / DayZ), а не Unity. В повторных замерах на одной сцене разница составляет 0% (±1 FPS шума сервера), зато лишние флаги мешают диагностировать реальные проблемы при обновлениях Rust.",
    steps: [
      "Откройте Steam → Библиотека → ПКМ по Rust → Свойства → Общие.",
      "Удалите -maxMem, -malloc=system, -cpuCount, -exThreads и -USEALLAVAILABLECORES из поля «Параметры запуска».",
      "Оставьте только документированный ключ -window-mode exclusive (или пустое поле).",
    ],
    check: "В поле «Параметры запуска» нет ключей из Arma; gc.buffer задан в cfg\\client.cfg.",
    revertSteps: ["Просто очистите поле «Параметры запуска» в свойствах Rust в Steam."],
    file: { name: "rustflow-myth-launch-options.txt", kind: "txt", content: MYTH_LAUNCH_TXT },
  },
  {
    slug: "nagle-tcp-myth",
    title: "Отключение алгоритма Нейгла (TCPNoDelay)",
    tagline: "Миф для Rust: игровой трафик идёт по UDP, а не по TCP",
    category: "network",
    group: "network",
    riskLevel: "caution",
    evidence: "myth",
    gainPct: 0,
    gainLabel: "0 мс · Миф (TCP≠UDP)",
    excludeFromPack: true,
    phase: 6,
    order: 420,
    risk: "moderate",
    impact: { fps: 0, smooth: 0, latency: 0 },
    admin: true,
    restart: "reboot",
    time: "2 мин",
    os: OS_ALL,
    what: "Разбор правок реестра TcpAckFrequency = 1 и TCPNoDelay = 1 в ветке Tcpip\\Parameters\\Interfaces и инструкция возврата к стандарту Windows.",
    why: "Алгоритм Нейгла буферизует мелкие пакеты только в протоколе TCP (помогает в старых MMO вроде WoW). Rust обменивается координатами и выстрелами по UDP (RakNet/Steam Networking), поэтому на пинг, регистрацию попаданий и FPS эти ключи не влияют вовсе, а пропускную способность TCP в системе немного снижают.",
    steps: [
      "Не добавляйте TcpAckFrequency и TCPNoDelay ради Rust — эффекта в игре не будет.",
      "Если уже добавляли их по чужому гайду: откройте regedit → HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces, найдите свой интерфейс и удалите параметры TcpAckFrequency, TCPNoDelay и TcpDelAckTicks.",
      "Перезагрузите компьютер. Для реального снижения задержек перейдите с Wi-Fi на кабель Ethernet.",
    ],
    check: "В разделе вашего сетевого интерфейса в реестре отсутствуют ручные параметры TcpAckFrequency и TCPNoDelay.",
    revertSteps: ["Удалите вручную созданные DWORD-ключи TcpAckFrequency и TCPNoDelay и перезагрузите ПК."],
    file: {
      name: "rustflow-nagle-default-info.reg",
      kind: "reg",
      content: reg(
        "Remove global MSMQ TCPNoDelay override (return to Windows default)",
        String.raw`[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\MSMQ\Parameters]
"TCPNoDelay"=-`,
      ),
    },
  },
  {
    slug: "disable-defender-update",
    title: "Отключение Windows Defender и Windows Update",
    tagline: "НЕ ПРИМЕНЯТЬ: 0% к FPS, поломка EAC и риск угона Steam",
    category: "windows",
    group: "cpu-windows",
    riskLevel: "harmful",
    evidence: "myth",
    gainPct: -5,
    gainLabel: "Вредно · Не применять",
    excludeFromPack: true,
    phase: 2,
    order: 900,
    risk: "advanced",
    impact: { fps: 0, smooth: 0, latency: 0 },
    admin: false,
    restart: "reboot",
    time: "3 мин",
    os: OS_ALL,
    what: "Анти-твик (памятка безопасности): полное вырезание Защитника Windows, SmartScreen и Центра обновления утилитами-деблоатерами или установкой «урезанных игровых сборок».",
    why: "В реальных замерах на ПК с SSD отключение Defender не даёт значимого прироста FPS в Rust (разница <1%). Зато сломанный Центр обновления приводит к ошибкам сертификатов Easy Anti-Cheat, отсутствию патчей планировщика CPU и высокому риску заражения стиллерами.",
    steps: [
      "НЕ отключайте Windows Defender, SmartScreen и службу Windows Update ради FPS.",
      "Если защита уже отключена — откройте «Безопасность Windows → Защита от вирусов и угроз» и верните защиту в реальном времени.",
      "Вместо вырезания обновлений просто настройте «Период активности» (Win + I → Центр обновления Windows), чтобы ПК не перезагружался во время игры.",
    ],
    check: "Безопасность Windows горит зелёной галочкой; Easy Anti-Cheat запускается без ошибок проверки подписи.",
    revertSteps: ["Включите защиту в реальном времени и службу wuauserv («Вручную») по скачиваемой памятке."],
    warnings: [
      "Анти-твик добавлен в каталог специально для предупреждения и восстановления системы после вредных советов.",
    ],
    file: { name: "rustflow-RESTORE-defender-guide.txt", kind: "txt", content: DEFENDER_WARNING_TXT },
  },
  {
    slug: "registry-cleaners-boosters",
    title: "Чистильщики реестра и закрытые .exe-твикеры",
    tagline: "НЕ ПРИМЕНЯТЬ: ломают ОС, несут трояны или вызывают бан EAC",
    category: "windows",
    group: "cpu-windows",
    riskLevel: "harmful",
    evidence: "myth",
    gainPct: -10,
    gainLabel: "Вредно · Риск бана EAC",
    excludeFromPack: true,
    phase: 2,
    order: 910,
    risk: "advanced",
    impact: { fps: 0, smooth: 0, latency: 0 },
    admin: true,
    restart: "reboot",
    time: "5 мин",
    os: OS_ALL,
    what: "Анти-твик + скрипт штатной проверки целостности Windows (DISM + sfc /scannow) на случай, если вы уже запускали «чистильщик реестра» или сомнительный FPS-бустер.exe.",
    why: "Размер реестра не влияет на FPS в Rust — «очистка тысяч ошибок реестра» удаляет нужные COM-связи и ломает приложения. А закрытые .exe-бустеры из Telegram/Discord нередко лезут в память процесса игры, подменяют DLL или ставят неподписанные драйверы — для Easy Anti-Cheat это прямой повод выдать перманентный бан.",
    steps: [
      "Никогда не запускайте закрытые .exe-оптимизаторы, DLL-инжекторы и утилиты, вмешивающиеся в процесс RustClient.exe.",
      "Удалите установленные «чистильщики реестра» и «ускорители игр» через «Приложения и возможности».",
      "Если после чужого твикера система работает нестабильно — скачайте и запустите наш скрипт проверки целостности Windows (sfc /scannow + DISM).",
    ],
    check: "В автозагрузке нет сторонних «бустеров»; sfc /scannow сообщает об отсутствии нарушений целостности.",
    revertSteps: ["Запустите скачанный скрипт восстановления системных файлов или откатитесь на точку восстановления (rstrui)."],
    warnings: [
      "EAC банит навсегда за инжекторы, подмену DLL, чтение/запись памяти Rust и макросы на отдачу. Снять такой бан нельзя.",
    ],
    file: {
      name: "rustflow-REPAIR-windows-integrity.bat",
      kind: "bat",
      content: adminBat(
        "Verify and repair Windows system files (DISM + SFC)",
        String.raw`echo  Step 1/2: DISM RestoreHealth (may take several minutes)...
DISM /Online /Cleanup-Image /RestoreHealth
echo.
echo  Step 2/2: System File Checker (sfc /scannow)...
sfc /scannow`,
        "Done. Reboot your PC if files were repaired.",
      ),
    },
  },
  {
    slug: "bcdedit-timers-harmful",
    title: "Правки таймера bcdedit (useplatformtick)",
    tagline: "НЕ ПРИМЕНЯТЬ: рост DPC-задержек и рваный frametime",
    category: "windows",
    group: "cpu-windows",
    riskLevel: "harmful",
    evidence: "myth",
    gainPct: -8,
    gainLabel: "Вредно · Статтеры",
    excludeFromPack: true,
    phase: 2,
    order: 920,
    risk: "advanced",
    impact: { fps: 0, smooth: 0, latency: 0 },
    admin: true,
    restart: "reboot",
    time: "2 мин",
    os: OS_ALL,
    what: "Анти-твик + скрипт возврата стандартного системного таймера Windows (удаляет принудительные useplatformclock, useplatformtick и disabledynamictick).",
    why: "Принудительное переключение Windows с быстрого процессорного счётчика TSC на медленный HPET (useplatformclock yes) резко снижает FPS в CPU-зависимых играх вроде Rust и увеличивает задержку кадра. Скачиваемый файл ниже НЕ включает эти флаги, а безопасно удаляет их, если они остались после чужих паков.",
    steps: [
      "Не выполняйте команды bcdedit /set useplatformclock yes и useplatformtick yes из старых гайдов.",
      "Чтобы проверить и вернуть заводской таймер TSC, скачайте и запустите скрипт сброса ниже от имени администратора.",
      "Перезагрузите ПК для применения стандартной конфигурации загрузчика.",
    ],
    check: "Команда bcdedit /enum не содержит строк useplatformclock, useplatformtick и disabledynamictick.",
    revertSteps: ["Скачанный файл сам является скриптом возврата к заводским параметрам Windows."],
    warnings: [
      "Анти-твик: файл ниже выполняет только очистку вредных параметров таймера (deletevalue).",
    ],
    file: {
      name: "rustflow-RESTORE-default-timers.bat",
      kind: "bat",
      content: adminBat(
        "Restore default Windows TSC timers",
        String.raw`echo  Removing forced timer overrides (missing-element notices are normal)...
bcdedit /deletevalue useplatformclock 2>nul
bcdedit /deletevalue useplatformtick 2>nul
bcdedit /deletevalue disabledynamictick 2>nul
bcdedit /deletevalue tscsyncpolicy 2>nul`,
        "Default Windows timer settings restored. Reboot to apply.",
      ),
    },
  },
];
