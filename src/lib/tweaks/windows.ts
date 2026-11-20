import { applyPlan, revertPlan } from "./power-plan";
import { OS_ALL, STEP } from "./common";
import { adminBat, reg } from "./helpers";
import type { Tweak } from "./types";

export const WINDOWS_TWEAKS: Tweak[] = [
  {
    slug: "ultimate-power-plan",
    riskLevel: "caution",
    evidence: "conditional",
    title: "План «Максимальная производительность»",
    tagline: "Отдельный план питания для сравнительного теста от сети",
    category: "windows",
    phase: 2,
    order: 10,
    risk: "moderate",
    impact: { fps: 1, smooth: 2, latency: 1 },
    admin: true,
    restart: "none",
    time: "1 мин",
    os: OS_ALL,
    featured: true,
    what: "Создаёт отдельную схему электропитания «RustFlow Performance» на основе скрытой схемы Ultimate Performance и включает её. Для питания от сети: минимальное состояние процессора 100%, отключены парковка ядер, выборочная приостановка USB и энергосбережение PCI Express.",
    why: "Rust упирается в один-два потока процессора. В сбалансированной схеме Windows постоянно меняет частоту и паркует ядра, из-за чего в замесах проседает минимальный FPS. Меняются температура и энергопотребление; итог зависит от железа. Сравните штатный сбалансированный план с новым под длительной нагрузкой: выигрыш не гарантирован.",
    steps: [...STEP.batAdmin, "Дождитесь строки с активной схемой «RustFlow Performance» и закройте окно."],
    check: "Win + R → powercfg.cpl. Активной должна быть схема «RustFlow Performance».",
    revertSteps: [
      "Скачайте файл отката и запустите его: он вернёт активную до теста схему по сохранённому GUID и удалит только копию RustFlow.",
      "Вручную: Win + R → powercfg.cpl → выберите свой исходный план. Не удаляйте original-plan.txt до отката.",
    ],
    warnings: [
      "На ноутбуке схема увеличит нагрев и расход батареи — используйте её только при питании от сети.",
      "Если Ultimate Performance недоступна в вашей редакции Windows, скрипт возьмёт за основу «Высокую производительность».",
    ],
    file: {
      name: "rustflow-power-plan.bat",
      kind: "bat",
      content: applyPlan,
    },
    revert: {
      name: "rustflow-power-plan-REVERT.bat",
      kind: "bat",
      content: revertPlan,
    },
  },
  {
    slug: "game-mode-dvr",
    title: "Игровой режим и отключение Game DVR",
    tagline: "Windows отдаёт приоритет игре и не пишет видео в фоне",
    category: "windows",
    phase: 2,
    order: 20,
    risk: "safe",
    impact: { fps: 1, smooth: 1, latency: 1 },
    admin: true,
    restart: "relogin",
    time: "1 мин",
    os: OS_ALL,
    featured: true,
    what: "Включает «Режим игры» Windows и отключает фоновую запись Xbox Game Bar (Game DVR): параметры GameDVR_Enabled, AppCaptureEnabled, HistoricalCaptureEnabled и политику AllowGameDVR.",
    why: "Фоновая запись постоянно кодирует видео и отнимает ресурсы видеокарты и процессора. Если она у вас была включена, отключение даёт заметный прирост; если нет — твик просто гарантирует, что запись не включится сама после обновления Windows. Игровой режим снижает активность Центра обновления и фоновых задач во время игры.",
    steps: [...STEP.reg, "Выйдите из системы и войдите снова (или перезагрузите ПК)."],
    check: "Параметры → Игры → Режим игры: включён. Параметры → Игры → Записи: запись в фоне отключена.",
    revertSteps: [
      "Скачайте файл отката и примените его так же — двойным кликом.",
      "Выйдите из системы и войдите снова.",
    ],
    warnings: [
      "Запись клипов через Xbox Game Bar (Win + Alt + G) перестанет работать. Запись через NVIDIA App, AMD ReLive или OBS не затрагивается.",
    ],
    file: {
      name: "rustflow-game-mode-dvr.reg",
      kind: "reg",
      content: reg(
        "Game Mode ON, Game DVR background capture OFF",
        String.raw`[HKEY_CURRENT_USER\Software\Microsoft\GameBar]
"AutoGameModeEnabled"=dword:00000001
"AllowAutoGameMode"=dword:00000001

[HKEY_CURRENT_USER\System\GameConfigStore]
"GameDVR_Enabled"=dword:00000000

[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\GameDVR]
"AppCaptureEnabled"=dword:00000000
"HistoricalCaptureEnabled"=dword:00000000

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\GameDVR]
"AllowGameDVR"=dword:00000000`,
      ),
    },
    revert: {
      name: "rustflow-game-mode-dvr-REVERT.reg",
      kind: "reg",
      content: reg(
        "Restore Game DVR defaults",
        String.raw`[HKEY_CURRENT_USER\Software\Microsoft\GameBar]
"AutoGameModeEnabled"=-
"AllowAutoGameMode"=-

[HKEY_CURRENT_USER\System\GameConfigStore]
"GameDVR_Enabled"=dword:00000001

[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\GameDVR]
"AppCaptureEnabled"=dword:00000001
"HistoricalCaptureEnabled"=dword:00000000

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\GameDVR]
"AllowGameDVR"=-`,
      ),
    },
  },
  {
    slug: "hags",
    evidence: "conditional",
    title: "Аппаратное планирование GPU (HAGS)",
    tagline: "Видеокарта сама управляет своей очередью кадров",
    category: "windows",
    phase: 2,
    order: 30,
    risk: "moderate",
    impact: { fps: 1, smooth: 1, latency: 1 },
    admin: true,
    restart: "reboot",
    time: "2 мин",
    os: "Windows 10 2004+ / 11",
    what: "Включает «Планирование графического процессора с аппаратным ускорением»: параметр HwSchMode = 2 в разделе GraphicsDrivers.",
    why: "HAGS переносит планирование видеопамяти с процессора на видеокарту. Rust сильно нагружает процессор, поэтому разгрузка помогает, но результат зависит от видеокарты и драйвера: у одних кадры становятся ровнее, у других появляются микрофризы. Обязательно сравните до и после. HAGS также нужен для генерации кадров DLSS.",
    steps: [
      "Если штатный переключатель HAGS отсутствует, пропустите шаг. Запишите исходное положение.",
      ...STEP.reg,
      "Перезагрузите компьютер.",
      "Сыграйте 10–15 минут на привычном сервере и сравните плавность с тем, что было.",
    ],
    check:
      "Параметры → Система → Дисплей → Графика → Изменение стандартных параметров графики: переключатель «Планирование графического процессора с аппаратным ускорением» включён.",
    revertSteps: ["Примените файл отката (HwSchMode = 1) и перезагрузите компьютер."],
    warnings: [
      "Нужна видеокарта GTX 1000 / RX 5600 и новее с актуальным драйвером. На старых картах переключатель не появится, и твик ничего не изменит.",
      "Если после включения появились фризы или проблемы с записью видео — откатите.",
    ],
    file: {
      name: "rustflow-hags-on.reg",
      kind: "reg",
      content: reg(
        "Hardware-accelerated GPU scheduling ON",
        String.raw`[HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\GraphicsDrivers]
"HwSchMode"=dword:00000002`,
      ),
    },
    revert: {
      name: "rustflow-hags-REVERT.reg",
      kind: "reg",
      content: reg(
        "Hardware-accelerated GPU scheduling OFF",
        String.raw`[HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\GraphicsDrivers]
"HwSchMode"=dword:00000001`,
      ),
    },
  },
  {
    slug: "background-apps",
    riskLevel: "caution",
    evidence: "conditional",
    title: "Windows 10: общий фон приложений Store",
    tagline: "Пользовательский переключатель фона, не машинная политика",
    category: "windows",
    phase: 2,
    order: 40,
    risk: "moderate",
    impact: { fps: 1, smooth: 1, latency: 0 },
    admin: false,
    restart: "relogin",
    time: "1 мин",
    os: "Windows 10",
    windowsVersion: "10",
    what: "Выключает общий пользовательский переключатель фоновой работы поддерживаемых приложений в Windows 10. На службы, обычные настольные программы и политику организации не действует.",
    why: "Сначала проверьте нагрузку конкретного приложения. Если нужны уведомления или синхронизация, ограничьте отдельное приложение через Параметры, а не весь фон.",
    steps: [...STEP.reg, "Выйдите из системы и войдите снова."],
    check:
      "Параметры → Конфиденциальность → Фоновые приложения: проверьте переключатель. Если им управляет организация, пропустите этот шаг.",
    revertSteps: ["Примените файл отката и перезайдите в систему."],
    warnings: [
      "Уведомления Почты, Календаря и других приложений из Store будут приходить только при открытом приложении. Steam, Discord и браузеры не затрагиваются.",
    ],
    file: {
      name: "rustflow-background-apps-off.reg",
      kind: "reg",
      content: reg(
        "Background Store apps OFF",
        String.raw`[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications]
"GlobalUserDisabled"=dword:00000001

[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Search]
"BackgroundAppGlobalToggle"=dword:00000000`,
      ),
    },
    revert: {
      name: "rustflow-background-apps-REVERT.reg",
      kind: "reg",
      content: reg(
        "Background Store apps defaults",
        String.raw`[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications]
"GlobalUserDisabled"=dword:00000000

[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Search]
"BackgroundAppGlobalToggle"=dword:00000001`,
      ),
    },
  },
  {
    slug: "pagefile-auto",
    title: "Файл подкачки под управлением системы",
    tagline: "Лекарство от вылетов Rust из-за нехватки памяти",
    category: "windows",
    phase: 2,
    order: 50,
    risk: "safe",
    impact: { fps: 0, smooth: 3, latency: 0 },
    admin: true,
    restart: "reboot",
    time: "2 мин",
    os: OS_ALL,
    featured: true,
    what: "Включает автоматическое управление файлом подкачки (AutomaticManagedPagefile = True). Windows сама подбирает и увеличивает его размер по мере необходимости.",
    why: "Rust резервирует очень много виртуальной памяти. Если подкачка отключена или задана слишком маленькой («советы» из старых гайдов), игра вылетает с ошибкой памяти или зависает при загрузке в мир — даже при 16–32 ГБ ОЗУ. FPS твик не добавляет. Он поможет только при достижении предела выделенной памяти.",
    steps: [
      "Запишите текущий режим, диск и размеры подкачки в sysdm.cpl → Дополнительно → Быстродействие → Виртуальная память.",
      ...STEP.batAdmin,
      "Дождитесь сообщения «Automatic page file management is ON».",
      "Перезагрузите компьютер.",
    ],
    check:
      "Win + R → sysdm.cpl → Дополнительно → Быстродействие → Параметры → Дополнительно → Виртуальная память → Изменить: стоит галочка «Автоматически выбирать объём файла подкачки».",
    revertSteps: [
      "Файла отката нет: скрипт возвращает настройку Windows по умолчанию.",
      "Если раньше вы задавали размер вручную, верните его в том же окне «Виртуальная память» и перезагрузите ПК.",
    ],
    warnings: [
      "На системном диске должно быть свободно хотя бы 20–30 ГБ. Лучше всего, если системный диск — SSD.",
    ],
    file: {
      name: "rustflow-pagefile-auto.bat",
      kind: "bat",
      content: adminBat(
        "System managed page file",
        String.raw`powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $cs = Get-CimInstance -ClassName Win32_ComputerSystem; Set-CimInstance -InputObject $cs -Property @{AutomaticManagedPagefile=$true} -ErrorAction Stop; Write-Host '  Automatic page file management is ON.' -ForegroundColor Green } catch { Write-Host ('  Failed: ' + $_.Exception.Message) -ForegroundColor Red }"`,
        "Reboot the PC to apply.",
      ),
    },
  },
  {
    slug: "mouse-accel-off",
    title: "Отключение акселерации мыши",
    tagline: "Линейное движение курсора без «повышенной точности»",
    category: "windows",
    phase: 2,
    order: 60,
    risk: "safe",
    impact: { fps: 0, smooth: 0, latency: 1 },
    admin: false,
    restart: "relogin",
    time: "1 мин",
    os: OS_ALL,
    what: "Отключает «Повышенную точность установки указателя»: MouseSpeed, MouseThreshold1 и MouseThreshold2 = 0.",
    why: "С акселерацией путь курсора зависит от скорости движения руки, и мышечная память не вырабатывается. Сама Rust в бою читает «сырой» ввод, поэтому на отдачу твик влияет слабо, зато в инвентаре, при луте и крафте курсор начинает двигаться предсказуемо. На FPS не влияет.",
    steps: [
      "Скачайте файл и запустите его двойным кликом.",
      "Подтвердите добавление данных в реестр.",
      "Выйдите из системы и войдите снова.",
    ],
    check:
      "Win + R → main.cpl → Параметры указателя: галочка «Включить повышенную точность установки указателя» снята.",
    revertSteps: ["Примените файл отката и перезайдите в систему."],
    file: {
      name: "rustflow-mouse-accel-off.reg",
      kind: "reg",
      content: reg(
        "Mouse acceleration OFF",
        String.raw`[HKEY_CURRENT_USER\Control Panel\Mouse]
"MouseSpeed"="0"
"MouseThreshold1"="0"
"MouseThreshold2"="0"`,
      ),
    },
    revert: {
      name: "rustflow-mouse-accel-REVERT.reg",
      kind: "reg",
      content: reg(
        "Mouse acceleration defaults",
        String.raw`[HKEY_CURRENT_USER\Control Panel\Mouse]
"MouseSpeed"="1"
"MouseThreshold1"="6"
"MouseThreshold2"="10"`,
      ),
    },
  },
  {
    slug: "visual-effects",
    title: "Облегчённые визуальные эффекты Windows",
    tagline: "Меньше прозрачности и анимаций на слабых ПК",
    category: "windows",
    phase: 2,
    order: 70,
    risk: "safe",
    impact: { fps: 1, smooth: 0, latency: 0 },
    admin: false,
    restart: "relogin",
    time: "1 мин",
    os: OS_ALL,
    what: "Отключает эффекты прозрачности, анимацию сворачивания окон и анимации панели задач: EnableTransparency, MinAnimate, TaskbarAnimations.",
    why: "Имеет смысл только на встроенной графике и слабых видеокартах с 2–4 ГБ памяти: композитор рабочего стола освобождает немного видеопамяти и ресурсов GPU. На современных видеокартах разницы в Rust вы не увидите — в этом случае твик можно пропустить.",
    steps: [
      "Скачайте файл и запустите его двойным кликом.",
      "Подтвердите добавление данных в реестр.",
      "Выйдите из системы и войдите снова.",
    ],
    check: "Параметры → Персонализация → Цвета: «Эффекты прозрачности» выключены.",
    revertSteps: ["Примените файл отката и перезайдите в систему."],
    file: {
      name: "rustflow-visual-effects-light.reg",
      kind: "reg",
      content: reg(
        "Lightweight visual effects",
        String.raw`[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize]
"EnableTransparency"=dword:00000000

[HKEY_CURRENT_USER\Control Panel\Desktop\WindowMetrics]
"MinAnimate"="0"

[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced]
"TaskbarAnimations"=dword:00000000`,
      ),
    },
    revert: {
      name: "rustflow-visual-effects-REVERT.reg",
      kind: "reg",
      content: reg(
        "Visual effects defaults",
        String.raw`[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize]
"EnableTransparency"=dword:00000001

[HKEY_CURRENT_USER\Control Panel\Desktop\WindowMetrics]
"MinAnimate"="1"

[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced]
"TaskbarAnimations"=dword:00000001`,
      ),
    },
  },
  {
    slug: "mmcss-games",
    evidence: "conditional",
    excludeFromPack: true,
    title: "MMCSS: SystemResponsiveness и профиль Games",
    tagline: "Почему не стоит менять общесистемный приоритет ради Rust",
    category: "windows",
    phase: 2,
    order: 80,
    risk: "moderate",
    impact: { fps: 0, smooth: 0, latency: 0 },
    admin: false,
    restart: "none",
    time: "Только чтение",
    os: OS_ALL,
    what: "MMCSS обслуживает задачи мультимедиа, в том числе звук. Значение SystemResponsiveness не равно доле FPS, которую можно передать игре.",
    why: "Параметры категории Games не назначают каждому потоку Rust новый приоритет. Слепая замена SystemProfile может повлиять на другие программы.",
    steps: [
      "Не импортируйте профиль MMCSS из игрового пака. При обрывах звука сначала сравните нагрузку и версию драйвера.",
    ],
    check: "Сравните одну сцену с теми же звуковыми устройствами и программами в фоне.",
    revertSteps: [
      "Если значения уже менялись, восстановите свой экспорт или точку восстановления. Не удаляйте весь раздел SystemProfile.",
    ],
    file: {
      name: "rustflow-mmcss-readme.txt",
      kind: "txt",
      content:
        "MMCSS, SystemResponsiveness и NetworkThrottlingIndex: общие параметры Windows, не отдельный профиль Rust. Не приравнивайте значение к приросту FPS. При необходимости восстановите свою копию настроек, а не случайный REG-файл.",
    },
  },
  {
    slug: "rust-priority",
    evidence: "conditional",
    title: "Высокий приоритет процесса Rust",
    tagline: "RustClient.exe всегда стартует с приоритетом High",
    category: "windows",
    phase: 2,
    order: 90,
    risk: "moderate",
    impact: { fps: 1, smooth: 1, latency: 0 },
    admin: true,
    restart: "game",
    time: "1 мин",
    os: OS_ALL,
    what: "Добавляет в реестр правило Image File Execution Options: Windows сама назначает процессу RustClient.exe класс приоритета «Высокий» при каждом запуске.",
    why: "Когда в фоне работают браузер, Discord или запись, планировщик чаще отдаёт процессорное время игре. Если фон пустой — разницы не будет. Это системный аналог ручной смены приоритета в Диспетчере задач, только постоянный: файлы и память игры не затрагиваются.",
    steps: [...STEP.reg, "Перезапустите Rust, если игра была открыта."],
    check:
      "Запустите Rust → Диспетчер задач → Подробности → ПКМ по RustClient.exe → «Задать приоритет»: отмечен «Высокий».",
    revertSteps: ["Примените файл отката — он удаляет правило из реестра."],
    warnings: [
      "Не ставьте приоритет «Реального времени» вручную: игра начнёт отбирать время у драйверов мыши и звука.",
    ],
    file: {
      name: "rustflow-rust-priority-high.reg",
      kind: "reg",
      content: reg(
        "RustClient.exe CPU priority: High",
        String.raw`[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe\PerfOptions]
"CpuPriorityClass"=dword:00000003`,
      ),
    },
    revert: {
      name: "rustflow-rust-priority-REVERT.reg",
      kind: "reg",
      content: reg(
        "Remove RustClient.exe priority rule",
        String.raw`[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe\PerfOptions]
"CpuPriorityClass"=-`,
      ),
    },
  },
  {
    slug: "fso-gpu-pref",
    title: "Полноэкранные оптимизации Rust",
    tagline: "Сравните режим окна для одного приложения",
    category: "windows",
    phase: 2,
    order: 100,
    risk: "moderate",
    evidence: "conditional",
    impact: { fps: 1, smooth: 0, latency: 1 },
    admin: false,
    restart: "game",
    time: "2 мин",
    os: OS_ALL,
    what: "Проверка полноэкранных оптимизаций в свойствах RustClient.exe без перезаписи других параметров совместимости.",
    why: "Отключение оптимизаций не гарантирует эксклюзивный вывод. Сравните задержку и длительность кадров при одинаковых разрешении, герцовке и режиме игры.",
    steps: [
      "В Steam откройте локальные файлы Rust. В свойствах RustClient.exe → Совместимость запишите прежнее состояние «Отключить оптимизацию во весь экран».",
      "При проблеме с полноэкранным выводом сравните один маршрут с изменённым флажком. Не меняйте другие параметры одновременно.",
    ],
    check: "После перезапуска проверьте режим вывода, Alt+Tab и длительность кадров в той же сцене.",
    revertSteps: ["Верните записанный флажок в свойствах того же файла и перезапустите игру."],
    file: {
      name: "rustflow-fullscreen-check.txt",
      kind: "txt",
      content:
        "Для проверки полноэкранных оптимизаций запишите исходный флажок в свойствах RustClient.exe → Совместимость. Если проблема воспроизводится, сравните один маршрут с другим положением. Откат: верните исходный флажок. Адаптер проверяйте отдельно в параметрах графики Windows.",
    },
  },
];
