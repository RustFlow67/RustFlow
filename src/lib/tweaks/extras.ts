import { OS_ALL, STEP } from "./common";
import { adminBat } from "./helpers";
import type { Tweak } from "./types";

const XMP_TXT = `RustFlow — настройка RAM: XMP / EXPO, двухканал и тайминги
==========================================================

ПОЧЕМУ ЭТО КРИТИЧНО В RUST
Главный поток Unity постоянно обращается к структурам построек и сущностей.
Если ограничение в CPU, режим каналов и задержка ОЗУ могут менять длительность кадра.
Если упор в GPU, средний FPS может не измениться. Запишите исходный профиль и сравните
по три прогона на одном сервере; не приравнивайте частоту памяти к приросту FPS.

ШАГ 1 — ПРОВЕРКА ТЕКУЩЕГО РЕЖИМА
[ ] Диспетчер задач → Производительность → Память:
    проверьте «Скорость» (МТ/с) и число занятых слотов; это не проверка числа каналов.
[ ] В CPU-Z (вкладка Memory): Channel = Dual (или 2x 64-bit / 4x 32-bit на DDR5),
    CAS# Latency (CL) совпадает с паспортом модулей.

ШАГ 2 — ПРАВИЛЬНЫЕ СЛОТЫ (ДВУХКАНАЛ)
[ ] Сверьте слоты с руководством конкретной платы (для пары модулей часто A2 и B2).

ШАГ 3 — ПРОФИЛЬ В BIOS, ЕСЛИ ЕГО ПОДДЕРЖИВАЮТ ПЛАТА И ПАМЯТЬ
[ ] Перезагрузите ПК → Del или F2 → найдите XMP (Intel) / DOCP (AMD AM4) / EXPO (AMD AM5).
[ ] Выберите Profile 1, сохраните (F10).
[ ] Не форсируйте FCLK, UCLK и напряжения по таблице из чужого теста.

ШАГ 4 — ПРОВЕРКА СТАБИЛЬНОСТИ
[ ] XMP/EXPO настраивается в BIOS, а не в процессе игры. Проверьте стабильность памяти.
[ ] При вылетах или BSOD проверьте память в TestMem5 / OCCT Memory; при ошибках
    верните записанный исходный профиль по инструкции платы.
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
3. Такие флаги не задают размер памяти или число рабочих потоков в Rust. Проверьте
   результат в своей версии клиента тремя прогонами в одной сцене.

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
1. Нет основания выключать защиту ради FPS. При совпадении просадок со сканированием
   выберите другое время для плановой проверки.
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
    tagline: "Частота, тайминги и режим каналов при ограничении CPU",
    category: "prep",
    group: "ram-ssd",
    riskLevel: "caution",
    evidence: "conditional",
    gainLabel: "Если ограничение в памяти",
    phase: 1,
    order: 4,
    risk: "moderate",
    impact: { fps: 3, smooth: 3, latency: 2 },
    admin: false,
    restart: "reboot",
    time: "5 мин",
    os: "BIOS / любая ОС",
    featured: true,
    what: "Пошаговая проверка двухканального режима (слоты A2+B2), активация заводского профиля XMP / DOCP / EXPO в BIOS и контроль делителя FCLK/UCLK 1:1 на Ryzen.",
    why: "При промахах кэша главный поток ждёт ОЗУ. Быстрая стабильная память может сократить эти паузы, но не ускорит упирающийся в видеокарту кадр. XMP/EXPO — разгон и не гарантируется на любой комбинации платы, контроллера и модулей.",
    warnings: [
      "Запишите исходные параметры BIOS. При ошибках теста памяти или вылетах верните штатный профиль; не увеличивайте напряжение по чужому гайду.",
    ],
    steps: [
      "Откройте Диспетчер задач → Производительность → Память и проверьте текущую скорость (МТ/с) и число занятых слотов.",
      "Сверьте слоты для пары модулей с руководством платы (часто A2 и B2).",
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
    evidence: "conditional",
    gainLabel: "Чтение и свободное место",
    phase: 1,
    order: 5,
    risk: "safe",
    impact: { fps: 1, smooth: 3, latency: 0 },
    admin: true,
    restart: "none",
    time: "2 мин",
    os: OS_ALL,
    what: "Показывает настройку уведомлений TRIM с помощью fsutil. Скрипт ничего не включает и не запускает оптимизацию тома.",
    why: "Свободное место и тип диска стоит проверить при долгой загрузке. Системный флаг TRIM сам по себе не измеряет скорость SSD или FPS и не проверяет, как устройство обрабатывает запросы.",
    steps: [
      "Убедитесь в Steam → Rust → Свойства → Установленные файлы, что игра стоит на SSD, и на нём свободно ≥15–20% объёма.",
      ...STEP.batAdmin,
      "Проверьте строку «DisableDeleteNotify = 0» (это означает, что TRIM активен).",
    ],
    check: "Команда fsutil behavior query DisableDeleteNotify выводит значение 0 (TRIM включён).",
    revertSteps: ["Откат не требуется: скрипт только читает настройку."],
    file: {
      name: "rustflow-ssd-trim-check.bat",
      kind: "bat",
      content: adminBat(
        "Check TRIM notifications",
        "fsutil behavior query DisableDeleteNotify",
        "Read-only check. Zero means delete notifications are enabled.",
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
    why: "Эти ключи принадлежат движку Real Virtuality (серия Arma / DayZ), а не Unity. Они не дают управлять рабочими потоками Rust, а лишние флаги мешают диагностировать реальные проблемы при обновлениях Rust.",
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
    check:
      "В разделе вашего сетевого интерфейса в реестре отсутствуют ручные параметры TcpAckFrequency и TCPNoDelay.",
    revertSteps: ["Удалите вручную созданные DWORD-ключи TcpAckFrequency и TCPNoDelay и перезагрузите ПК."],
    file: {
      name: "rustflow-nagle-readme.txt",
      kind: "txt",
      content:
        "Nagle относится к TCP, а не к игровым UDP-пакетам. Не меняйте параметры сетевых интерфейсов или MSMQ ради пинга в Rust. Если меняли их ранее, восстановите свой экспорт. При потерях сравните связь до шлюза по кабелю и Wi-Fi.",
    },
  },
  {
    slug: "disable-defender-update",
    title: "Отключение Windows Defender и Windows Update",
    tagline: "НЕ ПРИМЕНЯТЬ: потеря защиты системы и риск угона Steam",
    category: "windows",
    group: "cpu-windows",
    riskLevel: "harmful",
    evidence: "myth",
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
    why: "Отключённая защита и пропущенные исправления повышают риск заражения. Если просадки совпадают с плановой проверкой, перенесите время сканирования, не выключая защиту.",
    steps: [
      "НЕ отключайте Windows Defender, SmartScreen и службу Windows Update ради FPS.",
      "Если защита уже отключена — откройте «Безопасность Windows → Защита от вирусов и угроз» и верните защиту в реальном времени.",
      "Вместо вырезания обновлений просто настройте «Период активности» (Win + I → Центр обновления Windows), чтобы ПК не перезагружался во время игры.",
    ],
    check:
      "Безопасность Windows горит зелёной галочкой; Easy Anti-Cheat запускается без ошибок проверки подписи.",
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
    check:
      "В автозагрузке нет сторонних «бустеров»; sfc /scannow сообщает об отсутствии нарушений целостности.",
    revertSteps: [
      "Запустите скачанный скрипт восстановления системных файлов или откатитесь на точку восстановления (rstrui).",
    ],
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
    title: "HPET и Dynamic Tick в BCD: не форсировать таймеры",
    tagline: "НЕ ПРИМЕНЯТЬ: рост DPC-задержек и рваный frametime",
    category: "windows",
    group: "cpu-windows",
    riskLevel: "harmful",
    evidence: "myth",
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
    why: "Принудительное переключение Windows с быстрого процессорного счётчика TSC на медленный HPET (useplatformclock yes) резко снижает FPS в CPU-зависимых играх вроде Rust и увеличивает задержку кадра. Скачиваемый файл ниже НЕ включает эти флаги, а снимает переопределения, если они остались после чужих паков.",
    steps: [
      "Не выполняйте команды bcdedit /set useplatformclock yes и useplatformtick yes из старых гайдов.",
      "Чтобы проверить и вернуть заводской таймер TSC, скачайте и запустите скрипт сброса ниже от имени администратора.",
      "Перезагрузите ПК для применения стандартной конфигурации загрузчика.",
    ],
    check: "Команда bcdedit /enum не содержит строк useplatformclock, useplatformtick и disabledynamictick.",
    revertSteps: ["Скачанный файл сам является скриптом возврата к заводским параметрам Windows."],
    warnings: ["Анти-твик: файл ниже выполняет только очистку вредных параметров таймера (deletevalue)."],
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
