import { OS_ALL, STEP } from "./common";
import { adminBat, reg, userBat } from "./helpers";
import type { Tweak } from "./types";

export const WINDOWS_TWEAKS: Tweak[] = [
  {
    slug: "ultimate-power-plan",
    title: "План «Максимальная производительность»",
    tagline: "Процессор не сбрасывает частоту и не паркует ядра",
    category: "windows",
    phase: 2,
    order: 10,
    risk: "safe",
    impact: { fps: 1, smooth: 2, latency: 1 },
    admin: true,
    restart: "none",
    time: "1 мин",
    os: OS_ALL,
    featured: true,
    what: "Создаёт отдельную схему электропитания «RustFlow Performance» на основе скрытой схемы Ultimate Performance и включает её. В схеме: минимальное состояние процессора 100%, отключены парковка ядер, выборочная приостановка USB и энергосбережение PCI Express.",
    why: "Rust упирается в один-два потока процессора. В сбалансированной схеме Windows постоянно меняет частоту и паркует ядра, из-за чего в замесах проседает минимальный FPS. Средний FPS вырастет незначительно, но кадры станут ровнее. На настольных ПК это один из самых заметных системных твиков.",
    steps: [
      ...STEP.batAdmin,
      "Дождитесь строки с активной схемой «RustFlow Performance» и закройте окно.",
    ],
    check: "Win + R → powercfg.cpl. Активной должна быть схема «RustFlow Performance».",
    revertSteps: [
      "Скачайте файл отката и запустите его: он вернёт схему «Сбалансированная» и удалит созданную.",
      "Вручную: Win + R → powercfg.cpl → выберите «Сбалансированная».",
    ],
    warnings: [
      "На ноутбуке схема увеличит нагрев и расход батареи — используйте её только при питании от сети.",
      "Если Ultimate Performance недоступна в вашей редакции Windows, скрипт возьмёт за основу «Высокую производительность».",
    ],
    file: {
      name: "rustflow-power-plan.bat",
      kind: "bat",
      content: adminBat(
        "Performance power plan",
        String.raw`set "GUID=77777777-7777-7777-7777-777777777777"
powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 %GUID% >nul 2>&1
powercfg -list | findstr /i "%GUID%" >nul
if errorlevel 1 (
  echo  Ultimate Performance is not available here. Using High performance instead.
  powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c %GUID% >nul 2>&1
)
powercfg -changename %GUID% "RustFlow Performance" "Maximum performance plan for gaming" >nul 2>&1
powercfg -setacvalueindex %GUID% SUB_PROCESSOR PROCTHROTTLEMIN 100 >nul 2>&1
powercfg -setacvalueindex %GUID% SUB_PROCESSOR PROCTHROTTLEMAX 100 >nul 2>&1
powercfg -setacvalueindex %GUID% SUB_PROCESSOR CPMINCORES 100 >nul 2>&1
powercfg -setacvalueindex %GUID% 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 >nul 2>&1
powercfg -setacvalueindex %GUID% SUB_PCIEXPRESS ASPM 0 >nul 2>&1
powercfg -setactive %GUID%
if errorlevel 1 (
  echo  Could not activate the plan. Nothing was changed.
) else (
  echo  Active power plan:
  powercfg -getactivescheme
)`,
        "Done.",
      ),
    },
    revert: {
      name: "rustflow-power-plan-REVERT.bat",
      kind: "bat",
      content: adminBat(
        "Restore Balanced power plan",
        String.raw`powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e
powercfg -delete 77777777-7777-7777-7777-777777777777 >nul 2>&1
echo  Active power plan:
powercfg -getactivescheme`,
        "Done. Balanced plan restored.",
      ),
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
        String.raw`[HKEY_CURRENT_USER\System\GameConfigStore]
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
    title: "Отключение фоновых приложений",
    tagline: "Приложения из Microsoft Store не работают в фоне",
    category: "windows",
    phase: 2,
    order: 40,
    risk: "safe",
    impact: { fps: 1, smooth: 1, latency: 0 },
    admin: true,
    restart: "relogin",
    time: "1 мин",
    os: OS_ALL,
    what: "Запрещает UWP-приложениям (Почта, Погода, Xbox, Фотографии и другие из Microsoft Store) работать в фоне: GlobalUserDisabled, BackgroundAppGlobalToggle и политика LetAppsRunInBackground.",
    why: "Rust занимает 10–16 ГБ оперативной памяти. На ПК с 8–16 ГБ каждый фоновый процесс приближает момент, когда Windows начнёт выгружать игру в файл подкачки, а это фризы. На 32 ГБ эффект минимален.",
    steps: [...STEP.reg, "Выйдите из системы и войдите снова."],
    check:
      "Диспетчер задач → Процессы: приложений из Store в разделе «Фоновые процессы» станет меньше.",
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
"BackgroundAppGlobalToggle"=dword:00000000

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\AppPrivacy]
"LetAppsRunInBackground"=dword:00000002`,
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
"BackgroundAppGlobalToggle"=dword:00000001

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\AppPrivacy]
"LetAppsRunInBackground"=-`,
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
    why: "Rust резервирует очень много виртуальной памяти. Если подкачка отключена или задана слишком маленькой («советы» из старых гайдов), игра вылетает с ошибкой памяти или зависает при загрузке в мир — даже при 16–32 ГБ ОЗУ. FPS твик не добавляет, но убирает самую частую причину вылетов.",
    steps: [
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
    title: "Профиль планировщика мультимедиа",
    tagline: "Меньше ресурсов в резерве для фоновых задач",
    category: "windows",
    phase: 2,
    order: 80,
    risk: "moderate",
    impact: { fps: 0, smooth: 1, latency: 1 },
    admin: true,
    restart: "reboot",
    time: "2 мин",
    os: OS_ALL,
    what: "Меняет параметры службы MMCSS: SystemResponsiveness = 10 (минимум, который реально применяет Windows), отключает сетевое троттлинг-ограничение NetworkThrottlingIndex и повышает приоритеты задачи «Games».",
    why: "По умолчанию Windows резервирует 20% процессорного времени для низкоприоритетных задач и ограничивает обработку сетевых пакетов во время воспроизведения мультимедиа. Твик популярен, но прирост скромный и заметен в основном на 4–6-ядерных процессорах под полной нагрузкой. Мы честно ставим ему низкую оценку влияния.",
    steps: [...STEP.reg, "Перезагрузите компьютер."],
    check:
      "Win + R → regedit → HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile: SystemResponsiveness = 0xa.",
    revertSteps: ["Примените файл отката (значения Windows по умолчанию) и перезагрузите ПК."],
    warnings: [
      "В интернете часто советуют SystemResponsiveness = 0. По документации Microsoft значение 0 всё равно трактуется как 10, поэтому мы ставим 10.",
    ],
    file: {
      name: "rustflow-mmcss-games.reg",
      kind: "reg",
      content: reg(
        "MMCSS gaming profile",
        String.raw`[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile]
"SystemResponsiveness"=dword:0000000a
"NetworkThrottlingIndex"=dword:ffffffff

[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games]
"GPU Priority"=dword:00000008
"Priority"=dword:00000006
"Scheduling Category"="High"
"SFIO Priority"="High"`,
      ),
    },
    revert: {
      name: "rustflow-mmcss-REVERT.reg",
      kind: "reg",
      content: reg(
        "MMCSS defaults",
        String.raw`[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile]
"SystemResponsiveness"=dword:00000014
"NetworkThrottlingIndex"=dword:0000000a

[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games]
"GPU Priority"=dword:00000008
"Priority"=dword:00000002
"Scheduling Category"="Medium"
"SFIO Priority"="Normal"`,
      ),
    },
  },
  {
    slug: "rust-priority",
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
        String.raw`[-HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe\PerfOptions]`,
      ),
    },
  },
  {
    slug: "fso-gpu-pref",
    title: "Полноэкранный режим и выбор видеокарты",
    tagline: "Без полноэкранных оптимизаций, всегда на дискретной GPU",
    category: "windows",
    phase: 2,
    order: 100,
    risk: "moderate",
    impact: { fps: 1, smooth: 0, latency: 1 },
    admin: false,
    restart: "game",
    time: "2 мин",
    os: OS_ALL,
    what: "Для RustClient.exe отключает «Оптимизацию во весь экран» (флаг DISABLEDXMAXIMIZEDWINDOWEDMODE) и задаёт в настройках графики Windows «Высокую производительность» (GpuPreference = 2).",
    why: "На ноутбуках и ПК со встроенной графикой Windows иногда запускает игру на слабой интегрированной видеокарте — второй параметр это исключает, и здесь выигрыш может быть огромным. Отключение полноэкранных оптимизаций даёт настоящий эксклюзивный режим; на части систем это снижает задержку ввода, на других разницы нет.",
    steps: [
      ...STEP.batUser,
      "Если игра установлена не в стандартную библиотеку Steam, скрипт попросит путь: Steam → Rust → Управление → Просмотреть локальные файлы → скопируйте полный путь к RustClient.exe.",
      "Перезапустите Rust.",
    ],
    check:
      "ПКМ по RustClient.exe → Свойства → Совместимость: стоит галочка «Отключить оптимизацию во весь экран». Параметры → Система → Дисплей → Графика: у Rust указано «Высокая производительность».",
    revertSteps: ["Запустите файл отката — он удалит оба параметра для RustClient.exe."],
    warnings: [
      "Запускайте файл от имени того пользователя Windows, под которым играете: параметры хранятся в профиле пользователя.",
    ],
    file: {
      name: "rustflow-fullscreen-gpu.bat",
      kind: "bat",
      content: userBat(
        "Fullscreen optimizations and GPU preference",
        String.raw`set "RUST=%ProgramFiles(x86)%\Steam\steamapps\common\Rust\RustClient.exe"
if exist "%RUST%" goto apply
echo  RustClient.exe was not found in the default Steam library.
echo  Steam - Rust - Manage - Browse local files, then copy the full path to RustClient.exe
set /p "RUST=  Path to RustClient.exe: "
set "RUST=%RUST:"=%"
if exist "%RUST%" goto apply
echo  File not found. Nothing was changed.
goto end
:apply
echo  Game: %RUST%
reg add "HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers" /v "%RUST%" /t REG_SZ /d "~ DISABLEDXMAXIMIZEDWINDOWEDMODE" /f >nul
reg add "HKCU\Software\Microsoft\DirectX\UserGpuPreferences" /v "%RUST%" /t REG_SZ /d "GpuPreference=2;" /f >nul
echo  Fullscreen optimizations: OFF
echo  GPU preference: High performance
:end`,
        "Finished.",
      ),
    },
    revert: {
      name: "rustflow-fullscreen-gpu-REVERT.bat",
      kind: "bat",
      content: userBat(
        "Remove fullscreen and GPU preference flags",
        String.raw`set "RUST=%ProgramFiles(x86)%\Steam\steamapps\common\Rust\RustClient.exe"
if exist "%RUST%" goto apply
set /p "RUST=  Path to RustClient.exe: "
set "RUST=%RUST:"=%"
:apply
reg delete "HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers" /v "%RUST%" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\DirectX\UserGpuPreferences" /v "%RUST%" /f >nul 2>&1
echo  Flags removed for: %RUST%`,
        "Finished.",
      ),
    },
  },
  {
    slug: "memory-integrity-off",
    title: "Отключение целостности памяти (HVCI)",
    tagline: "Реальный прирост на процессоре ценой уровня защиты",
    category: "windows",
    phase: 2,
    order: 110,
    risk: "advanced",
    impact: { fps: 2, smooth: 2, latency: 0 },
    admin: true,
    restart: "reboot",
    time: "3 мин",
    os: OS_ALL,
    what: "Отключает функцию «Целостность памяти» (изоляция ядра, HVCI): параметр Enabled = 0 в разделе DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity.",
    why: "Целостность памяти запускает проверку кода ядра через гипервизор, и в играх, упирающихся в процессор, это стоит нескольких процентов производительности. Microsoft сама описывает отключение этой функции как способ ускорить игры. В Rust прирост обычно заметнее на процессорах старше 2020 года.",
    steps: [
      "Сначала создайте точку восстановления (твик «Точка восстановления»).",
      ...STEP.reg,
      "Перезагрузите компьютер.",
    ],
    check:
      "Безопасность Windows → Безопасность устройства → Сведения об изоляции ядра: «Целостность памяти» выключена.",
    revertSteps: [
      "Примените файл отката (Enabled = 1) и перезагрузите ПК.",
      "Либо включите переключатель «Целостность памяти» в «Безопасности Windows».",
    ],
    warnings: [
      "Это осознанное снижение защиты: система становится уязвимее к вредоносным драйверам. Не применяйте на рабочем компьютере и там, где храните важные данные.",
      "Некоторые античиты других игр (например, Vanguard) требуют включённых функций защиты. Перед их запуском верните настройку.",
      "Windows будет показывать предупреждение в «Безопасности Windows» — это ожидаемо.",
    ],
    file: {
      name: "rustflow-memory-integrity-off.reg",
      kind: "reg",
      content: reg(
        "Memory Integrity (HVCI) OFF",
        String.raw`[HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity]
"Enabled"=dword:00000000`,
      ),
    },
    revert: {
      name: "rustflow-memory-integrity-REVERT.reg",
      kind: "reg",
      content: reg(
        "Memory Integrity (HVCI) ON",
        String.raw`[HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity]
"Enabled"=dword:00000001`,
      ),
    },
  },
];
