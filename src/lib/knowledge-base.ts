export const KNOWLEDGE_CATEGORIES = [
  { id: "windows", title: "Windows", lead: "Версия ОС, фоновые службы и параметры Windows. Системные изменения не входят в автоматические пакеты." },
  { id: "rust", title: "Настройки Rust", lead: "Графические настройки и значения gc.buffer. Сравнивайте изменения на своей сцене." },
  { id: "drivers", title: "NVIDIA / AMD", lead: "Профили драйвера, кэш и упомянутые версии. Они не гарантируют стабильность на других GPU." },
  { id: "binds", title: "Бинды и запуск", lead: "Подставьте свою клавишу вместо «КНОПКА». Номера потоков зависят от процессора." },
  { id: "fixes", title: "Решение проблем", lead: "Что проверить при конкретном симптоме. Один симптом может иметь разные причины." },
] as const;

export type KnowledgeCategory = typeof KNOWLEDGE_CATEGORIES[number]["id"];
export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  risk: "safe" | "caution";
  type: "tweak" | "bind" | "fix";
  title: string;
  question: string;
  answer: string;
  keywords: readonly string[];
  example?: string;
  note?: string;
}

export const knowledgeHref = (id: string) => `/guide#kb-${id}`;
export const KNOWLEDGE_TYPE_LABEL: Record<KnowledgeEntry["type"], string> = {
  tweak: "Настройка", bind: "Бинд", fix: "Диагностика",
};

export const KNOWLEDGE_BASE: readonly KnowledgeEntry[] = [
  {
    id: "windows-version", category: "windows", risk: "caution", type: "tweak",
    title: "Windows 10 22H2 или Windows 11", question: "Как выбрать версию Windows для Rust?",
    answer: "Выберите поддерживаемую версию Windows. Влияние ОС на Rust зависит от драйверов, фоновой нагрузки и конфигурации ПК.",
    note: "Не переходите на выпуск без обновлений безопасности ради FPS. Проверьте поддержку своего выпуска и наличие обновлений.",
    keywords: ["windows 10", "win 11", "22h2", "версия виндовс", "винда 10", "винда 11", "какая ос"],
  },
  {
    id: "background-services", category: "windows", risk: "caution", type: "tweak",
    title: "SysMain и Windows Search", question: "Нужно ли отключать SysMain и Windows Search?",
    answer: "Оставьте системные службы включёнными, если они не создают заметной нагрузки. Прежде чем менять одну из них, проверьте активность диска и CPU.",
    note: "Отключение Windows Search затрагивает индексацию и поиск. Запишите исходное состояние служб и меняйте их по одной.",
    keywords: ["sysmain", "superfetch", "windows search", "службы", "индексация", "поиск виндовс"],
  },
  {
    id: "hibernate", category: "windows", risk: "caution", type: "tweak",
    title: "Гибернация", question: "Как отключить гибернацию в Windows?",
    answer: "Команда powercfg /hibernate off отключает гибернацию. Не применяйте её, если пользуетесь гибернацией.",
    example: "powercfg /hibernate off",
    note: "Это изменение функции питания Windows, а не гарантированный прирост FPS.",
    keywords: ["гибернация", "гибернацию", "hibernate", "hiberfil", "powercfg"],
  },
  {
    id: "system-restore", category: "windows", risk: "caution", type: "tweak",
    title: "Восстановление системы", question: "Стоит ли отключать восстановление системы ради Rust?",
    answer: "Оставьте восстановление системы включённым. Без точек восстановления вы потеряете способ отката системных правок.",
    keywords: ["точка восстановления", "восстановление системы", "отключить восстановление", "system restore", "rstrui"],
  },
  {
    id: "pagefile", category: "windows", risk: "caution", type: "tweak",
    title: "Файл подкачки: 40 ГБ", question: "Нужен ли файл подкачки на 40 ГБ?",
    answer: "40 ГБ на системном диске — пример фиксированного размера, не требование Rust. Начните с автоматического управления.",
    note: "Проверьте свободное место. Не отключайте подкачку; если фиксированный размер не нужен, можно оставить управление системе.",
    keywords: ["подкачка", "подкачки", "pagefile", "виртуальная память", "40 гб", "40960"],
  },
  {
    id: "gpu-scheduling", category: "windows", risk: "caution", type: "tweak",
    title: "Аппаратное планирование GPU", question: "Что делать с HAGS?",
    answer: "Аппаратное планирование GPU (HAGS) переключается в настройках Windows. Если функция доступна, сравните 1% low с ней и без неё после перезапуска.",
    note: "Если после изменения появились статтеры, верните исходное состояние.",
    keywords: ["hags", "планирование gpu", "аппаратное ускорение планирования", "планировщик gpu"],
  },
  {
    id: "searchapp", category: "windows", risk: "caution", type: "tweak",
    title: "SearchApp.exe: правка системного файла", question: "Что за совет про переименование SearchApp.exe?",
    answer: "Не переименовывайте SearchApp.exe. Это файл защищённого компонента Windows, ручная правка может сломать поиск.",
    example: String.raw`C:\Windows\SystemApps\Microsoft.Windows.Search_...\SearchApp.exe → #SearchApp.exe`,
    note: "Путь сокращён («...»), это не команда. Изменение не входит в пакет RustFlow.",
    keywords: ["searchapp", "searchapp.exe", "systemapps", "переименовать поиск"],
  },
  {
    id: "clouds-model", category: "rust", risk: "safe", type: "tweak",
    title: "Облака и отображение модели", question: "Какие облака и отображение модели выставить в Rust?",
    answer: "Проверьте, помогает ли отключение объёмных облаков и отображения модели в вашей сцене.",
    keywords: ["объемные облака", "облака", "clouds", "отображение модели", "видимость модели"],
  },
  {
    id: "textures-vram", category: "rust", risk: "safe", type: "tweak",
    title: "Текстуры под объём VRAM", question: "Какие текстуры выбрать с 8 ГБ VRAM в 1440p?",
    answer: "Выбирайте текстуры по объёму видеопамяти. При 8 ГБ VRAM в 1440p начните со средних и проверьте 1% low.",
    keywords: ["текстуры 8 гб", "8gb", "1440p", "vram", "видеопамять", "medium", "качество текстур"],
  },
  {
    id: "filter-shadows", category: "rust", risk: "safe", type: "tweak",
    title: "Анизотропная фильтрация и тени", question: "Какие тени и фильтрацию ставят в базовом профиле?",
    answer: "В базовом профиле анизотропная фильтрация выключена, тени — «Низкое». Пиксельные тени на AMD разобраны отдельно как конкретный симптом.",
    keywords: ["фильтрация", "анизотропная", "anisotropic", "качество теней", "низкие тени", "тени"],
  },
  {
    id: "ssao", category: "rust", risk: "safe", type: "tweak",
    title: "Окклюзия (SSAO)", question: "Включать ли SSAO в Rust?",
    answer: "SSAO добавляет затенение в углах и стыках объектов. Выключите её для сравнения, если GPU не успевает рисовать кадры.",
    keywords: ["ssao", "окклюзия", "ambient occlusion"],
  },
  {
    id: "load-distribution", category: "rust", risk: "safe", type: "tweak",
    title: "Распределение нагрузки", question: "Как выставить распределение нагрузки?",
    answer: "Сравните «Распределение нагрузки» в обоих положениях, меняя только один параметр.",
    keywords: ["распределение нагрузки", "load distribution", "распределение"],
  },
  {
    id: "gc-buffer", category: "rust", risk: "safe", type: "tweak",
    title: "GC Buffer для 16 и 32 ГБ", question: "Какой gc.buffer ставить при 16 или 32 ГБ ОЗУ?",
    answer: "Начните с gc.buffer 4096 для 32 ГБ ОЗУ или gc.buffer 2048 для 16 ГБ. Выберите только одну строку под свой объём.",
    example: "gc.buffer 4096\ngc.buffer 2048",
    keywords: ["gc.buffer", "gc buffer", "гс буфер", "сборщик мусора", "4096", "2048"],
  },
  {
    id: "sampling", category: "rust", risk: "safe", type: "tweak",
    title: "Семплинг масштаба рендера", question: "Как проверить чёткость при смене масштаба рендера?",
    answer: "Начните с нативного разрешения. При изменении graphics.renderscalesampling сравните чёткость и время кадра в одной сцене.",
    example: "graphics.renderscalesampling 0",
    keywords: ["renderscalesampling", "семплинг", "сэмплинг", "sampling", "четкость", "мыло", "мыльная картинка"],
  },
  {
    id: "nvidia-app", category: "drivers", risk: "safe", type: "tweak",
    title: "Автооптимизация и Battery Boost", question: "Что отключают в NVIDIA App?",
    answer: "В NVIDIA App отключают «Автоматическую оптимизацию», а на ноутбуках — Battery Boost. Так приложение не заменяет выбранный профиль автоматически.",
    note: "На ноутбуке работа от батареи может сократиться.",
    keywords: ["nvidia app", "автоматическая оптимизация", "автооптимизация", "battery boost", "ноутбук"],
  },
  {
    id: "gpu-power", category: "drivers", risk: "caution", type: "tweak",
    title: "Питание GPU: максимальная производительность", question: "Какой режим электропитания указан для видеокарты?",
    answer: "В профиле видеодрайвера указана «Максимальная производительность». Проверяйте режим для Rust, а не для всех приложений сразу.",
    note: "Такой режим может увеличить нагрев и потребление энергии.",
    keywords: ["режим питания gpu", "электропитание", "максимальная производительность", "prefer maximum performance"],
  },
  {
    id: "shader-cache", category: "drivers", risk: "safe", type: "tweak",
    title: "Кэш шейдеров без ограничения", question: "Какой размер кэша шейдеров использовать для статтеров скинов?",
    answer: "При подгрузке скинов проверьте настройки кэша шейдеров. Режим «Без ограничений» требует свободного места на диске; сравните, меняется ли число статтеров.",
    keywords: ["кэш шейдеров", "shader cache", "статтеры скинов", "кеш шейдеров", "без ограничений"],
  },
  {
    id: "nvidia-driver", category: "drivers", risk: "caution", type: "tweak",
    title: "Версии драйверов NVIDIA 581.42 и 596.36", question: "Подойдут ли драйверы NVIDIA 581.42 и 596.36?",
    answer: "581.42 и 596.36 не подходят автоматически к любому GPU. Сверьте список совместимости и сравните стабильность в текущем патче.",
    note: "Проверяйте совместимость конкретной карты и актуальность исправлений безопасности перед откатом.",
    keywords: ["драйвер nvidia", "драйвер nvidia rust", "581.42", "596.36", "geforce driver"],
  },
  {
    id: "amd-driver", category: "drivers", risk: "caution", type: "tweak",
    title: "Версия драйвера AMD 23.12.1", question: "Стоит ли ставить AMD 23.12.1?",
    answer: "AMD 23.12.1 не является универсальным решением. Сверьте поддержку карты и сначала проверьте стабильность на актуальном драйвере.",
    note: "Проверьте, поддерживает ли эта версия ваш GPU, и не жертвуйте обновлениями безопасности ради непроверенного результата.",
    keywords: ["драйвер amd", "amd adrenalin драйвер", "radeon driver", "23.12.1", "стабильный amd"],
  },
  {
    id: "nvidia-cache-cleanup", category: "drivers", risk: "caution", type: "fix",
    title: "Очистка DXCache и GLCache", question: "Где находятся папки кэша NVIDIA из заметок?",
    answer: "Кэш NVIDIA может храниться в папках DXCache и GLCache в C:\\Users\\Имя\\AppData\\Local\\NVIDIA. Закройте игру перед очисткой и проверьте путь: папки зависят от драйвера.",
    example: String.raw`C:\Users\Имя\AppData\Local\NVIDIA\DXCache
C:\Users\Имя\AppData\Local\NVIDIA\GLCache`,
    note: "После очистки кэш создаётся заново; первые запуски могут сопровождаться статтерами.",
    keywords: ["dxcache", "glcache", "очистка кэша nvidia", "очищение кэша", "удалить кэш драйвера", "appdata nvidia"],
  },
  {
    id: "launch-affinity", category: "binds", risk: "caution", type: "tweak",
    title: "Параметры запуска: приоритет и affinity", question: "Какие параметры CPU указаны для запуска Rust?",
    answer: "Проверяйте параметры -system.cpu_priority high и -cpu_affinity по одному. Не ограничивайте потоки без измерений. Список 0,2,4,6,8,10 — пример для шестиядерной конфигурации, не готовая настройка для любого CPU.",
    example: "-system.cpu_priority high\n-cpu_affinity 0,2,4,6,8,10",
    note: "Проверьте реакцию клиента и нумерацию логических процессоров на своём ПК. Не выставляйте приоритет Realtime.",
    keywords: ["параметры запуска", "launch", "cpu_priority", "приоритет", "cpu_affinity", "аффинити", "6 ядер"],
  },
  {
    id: "bind-core-test", category: "binds", risk: "caution", type: "bind",
    title: "Бинд для теста двух групп потоков", question: "Как выглядит бинд теста ядер?",
    answer: "Пример system.cpu_affinity переключает две группы логических потоков: чётную 0–14 и нечётную 1–15. Списки подходят только под соответствующую топологию CPU.",
    example: 'bind КНОПКА "~system.cpu_affinity 0,2,4,6,8,10,12,14;system.cpu_affinity 1,3,5,7,9,11,13,15"',
    note: "Проверьте номера потоков, прежде чем переносить этот тест на другую сборку.",
    keywords: ["бинд ядер", "тест ядер", "bind affinity", "system.cpu_affinity", "четные ядра", "логические потоки"],
  },
  {
    id: "bind-textures", category: "binds", risk: "safe", type: "bind",
    title: "Бинд переключения текстур", question: "Как выглядит бинд двух уровней текстур?",
    answer: "Этот бинд переключает graphicssettings.globaltexturemipmaplimit между 0 и 3. Подставьте выбранную клавишу вместо «КНОПКА».",
    example: "bind КНОПКА graphicssettings.globaltexturemipmaplimit 0;graphicssettings.globaltexturemipmaplimit 3",
    keywords: ["бинд текстур", "bind texture", "globaltexturemipmaplimit", "переключение текстур"],
  },
  {
    id: "bind-audio", category: "binds", risk: "caution", type: "bind",
    title: "Бинд звука «Подслушка»", question: "Как работает бинд «Подслушка»?",
    answer: "Пример meta.exec переключает audio.ui, audio.game и audio.voices между «Подслушкой» и обычным профилем из примера.",
    example: String.raw`bind КНОПКА ~meta.exec "audio.ui 0" "audio.game 0.05" "audio.voices 7.00" "gametip.showtoast 3 \"Подслушка\"" ;meta.exec "audio.game 0.65" "audio.voices 2.72" "audio.ui 0.4" "gametip.showtoast 3 \"Дефолтный_Звук\""`,
    note: "Проверьте уровень громкости перед использованием: параметры второго профиля могут отличаться от ваших исходных настроек.",
    keywords: ["подслушка", "бинд звука", "звук", "громкость", "meta.exec", "audio.voices"],
  },
  {
    id: "mouse-polling", category: "fixes", risk: "safe", type: "fix",
    title: "Просадки при повороте мышью", question: "Что проверить, если FPS падает при движении мышью?",
    answer: "При просадках во время поворота попробуйте снизить частоту опроса мыши до 1000 Гц. Повторите тест на том же маршруте.",
    keywords: ["опрос мыши", "при повороте", "мышь", "мышью", "1000 гц", "polling rate"],
  },
  {
    id: "ram-capacity", category: "fixes", risk: "safe", type: "fix",
    title: "Объём ОЗУ", question: "Достаточно ли 16 ГБ ОЗУ для Rust?",
    answer: "16 ГБ — нижний практический ориентир; с 32 ГБ у игры и фона больше запаса. Это не официальные требования и не оценка FPS конкретного ПК.",
    keywords: ["сколько озу", "сколько ram", "объем озу", "16 гб озу", "32 гб озу", "оперативная память"],
  },
  {
    id: "amd-crosshair", category: "fixes", risk: "safe", type: "fix",
    title: "Двоение перекрестия на AMD", question: "Что делать, если перекрестие двоится на AMD?",
    answer: "При двоении перекрестия выключите «Плавное движение» в AMD Adrenalin и повторите проверку.",
    keywords: ["двоение", "двоится", "перекрестие", "перекрестия", "плавное движение", "fluid motion", "afmf"],
  },
  {
    id: "kernel-power", category: "fixes", risk: "caution", type: "fix",
    title: "Kernel-Power 41", question: "Что означают советы про 90 °C и 99% при Kernel-Power 41?",
    answer: "Событие 41 фиксирует аварийное выключение, но не определяет причину. Проверьте температуры, питание и стабильность памяти. Лимит температуры в BIOS сверяйте со спецификацией процессора.",
    note: "Перед изменением BIOS или схемы питания проверьте температуры, стабильность ПК и питание. Эти значения не являются универсальным исправлением.",
    keywords: ["kernel power", "kernel-power 41", "ошибка 41", "90 градусов", "cpu 99", "перезагрузка"],
  },
  {
    id: "amd-shadows", category: "fixes", risk: "caution", type: "fix",
    title: "Пиксельные тени на AMD", question: "Что попробовать при пиксельных тенях на AMD?",
    answer: "При пиксельных тенях для диагностики сравните низкое качество с High/Max. Если проблема остаётся, проверьте драйвер под свою карту.",
    note: "Высокие тени могут увеличить нагрузку. Понижение версии драйвера не должно быть первым шагом.",
    keywords: ["пиксельные тени", "пиксельные тени amd", "квадратные тени", "high max", "артефакты теней"],
  },
  {
    id: "stuck-done", category: "fixes", risk: "caution", type: "fix",
    title: "Зависание на «Done»", question: "Что делать, если Rust зависает на Done?",
    answer: "Сохраните копию cfg и запустите проверку целостности файлов в Steam, не удаляя исполняемый файл вручную.",
    note: "Сброс cfg может удалить настройки и бинды. Сохраните копию до сброса.",
    keywords: ["done", "зависает на done", "зависание при загрузке", "rust.exe", "папка cfg", "проверка файлов"],
  },
];
