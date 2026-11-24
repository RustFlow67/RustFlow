import { WINDOWS_TAB_HREF } from "@/lib/tweaker-routes";
export const KNOWLEDGE_CATEGORIES = [
  { id: "windows", title: "Windows", lead: "Версия ОС, фоновые службы и параметры Windows. Пакет может содержать инструкции и выбранные файлы, но не применяет их за вас." },
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
  example?: string; // Literal command, path or config line.
  caseStudy?: string; // Worked example for the reading sheet.
  note?: string;
}

export type ReadingHome = "/windows" | "/presets" | "/faq" | "/tweaker";
export function readingHome(entry: KnowledgeEntry): ReadingHome {
  if (["searchapp", "system-restore"].includes(entry.id)) return "/faq";
  if (entry.category === "drivers" || ["amd-shadows", "amd-crosshair"].includes(entry.id)) return "/faq";
  if (entry.category === "windows" || entry.id === "kernel-power") return "/windows";
  return "/presets";
}
export function readingHref(home: ReadingHome, anchor: string) {
  return `${home === "/windows" ? WINDOWS_TAB_HREF : home}#${anchor}`;
}
export function knowledgeHref(id: string) {
  const entry = KNOWLEDGE_BASE.find(e => e.id === id);
  return entry ? readingHref(readingHome(entry), `kb-${entry.id}`) : "/guide";
}
export const KNOWLEDGE_TYPE_LABEL: Record<KnowledgeEntry["type"], string> = {
  tweak: "Настройка", bind: "Бинд", fix: "Диагностика",
};

export const KNOWLEDGE_BASE: readonly KnowledgeEntry[] = [
  {
    id: "windows-version", category: "windows", risk: "caution", type: "tweak",
    title: "Windows 10 22H2 или Windows 11", question: "Как выбрать версию Windows для Rust?",
    answer: "Выберите поддерживаемую версию Windows. Влияние ОС на Rust зависит от драйверов, фоновой нагрузки и конфигурации ПК.",
    note: "Не переходите на выпуск без обновлений безопасности ради FPS. Проверьте поддержку своего выпуска и наличие обновлений.",
    caseStudy: "Если после смены ОС FPS вырос, но одновременно был обновлён драйвер, прирост нельзя приписать только Windows. Сохраните версии ОС и драйвера рядом с записью замера.",
    keywords: ["windows 10", "win 11", "22h2", "версия виндовс", "винда 10", "винда 11", "какая ос"],
  },
  {
    id: "background-services", category: "windows", risk: "caution", type: "tweak",
    title: "SysMain и Windows Search", question: "Нужно ли отключать SysMain и Windows Search?",
    answer: "Оставьте системные службы включёнными, если они не создают заметной нагрузки. Прежде чем менять одну из них, проверьте активность диска и CPU.",
    note: "Отключение Windows Search затрагивает индексацию и поиск. Запишите исходное состояние служб и меняйте их по одной.",
    caseStudy: "В момент рывка откройте монитор ресурсов. Если диск занят чтением файлов Rust, а индексатор простаивает, отключение поиска не устранит это чтение.",
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
    caseStudy: "Перед настройкой Windows создайте точку с понятным именем. Если после правки пропал звук, исходное состояние системы можно восстановить, не сбрасывая игровые настройки.",
    keywords: ["точка восстановления", "восстановление системы", "отключить восстановление", "system restore", "rstrui"],
  },
  {
    id: "pagefile", category: "windows", risk: "caution", type: "tweak",
    title: "Файл подкачки: 40 ГБ", question: "Нужен ли файл подкачки на 40 ГБ?",
    answer: "40 ГБ на системном диске — пример фиксированного размера, не требование Rust. Начните с автоматического управления.",
    note: "Проверьте свободное место. Не отключайте подкачку; если фиксированный размер не нужен, можно оставить управление системе.",
    caseStudy: "При 16 ГБ ОЗУ закройте вкладки браузера и повторите вход на сервер. Если паузы исчезли, проверьте нехватку памяти; резервирование 40 ГБ файла само по себе не ускорит GPU.",
    keywords: ["подкачка", "подкачки", "pagefile", "виртуальная память", "40 гб", "40960"],
  },
  {
    id: "gpu-scheduling", category: "windows", risk: "caution", type: "tweak",
    title: "Аппаратное планирование GPU", question: "Что делать с HAGS?",
    answer: "Аппаратное планирование GPU (HAGS) переключается в настройках Windows. Если функция доступна, сравните 1% low с ней и без неё после перезапуска.",
    note: "Если после изменения появились статтеры, верните исходное состояние.",
    caseStudy: "Запишите два одинаковых прохода с HAGS, перезапустите ПК после переключения и повторите их без HAGS. Сравнивайте разброс длинных кадров, а не один удачный пик.",
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
    caseStudy: "На берегу с открытым небом сравните время кадра с объёмными облаками и без них. Затем повторите в помещении: выигрыш на открытом воздухе может исчезнуть.",
    keywords: ["объемные облака", "облака", "clouds", "отображение модели", "видимость модели"],
  },
  {
    id: "textures-vram", category: "rust", risk: "safe", type: "tweak",
    title: "Текстуры под объём VRAM", question: "Какие текстуры выбрать с 8 ГБ VRAM в 1440p?",
    answer: "Выбирайте текстуры по объёму видеопамяти. При 8 ГБ VRAM в 1440p начните со средних и проверьте 1% low.",
    caseStudy: "При 1440p на карте с 8 ГБ оставьте дальность прежней и снизьте только текстуры. Повторите подъезд к базе: если рывков меньше, а пик FPS почти тот же, важнее стало размещение ресурсов в VRAM.",
    keywords: ["текстуры 8 гб", "8gb", "1440p", "vram", "видеопамять", "medium", "качество текстур"],
  },
  {
    id: "filter-shadows", category: "rust", risk: "safe", type: "tweak",
    title: "Анизотропная фильтрация и тени", question: "Какие тени и фильтрацию ставят в базовом профиле?",
    answer: "В базовом профиле анизотропная фильтрация выключена, тени — «Низкое». Пиксельные тени на AMD разобраны отдельно как конкретный симптом.",
    caseStudy: "У одного и того же дерева измените только качество теней. Вернитесь к фильтрации текстур отдельным прогоном, иначе неясно, какая настройка изменила кадр.",
    keywords: ["фильтрация", "анизотропная", "anisotropic", "качество теней", "низкие тени", "тени"],
  },
  {
    id: "ssao", category: "rust", risk: "safe", type: "tweak",
    title: "Окклюзия (SSAO)", question: "Включать ли SSAO в Rust?",
    answer: "SSAO добавляет затенение в углах и стыках объектов. Выключите её для сравнения, если GPU не успевает рисовать кадры.",
    caseStudy: "Посмотрите на стык стены и пола при одинаковом освещении. Сравните затемнение и время кадра после отключения SSAO, оставив основные тени без изменений.",
    keywords: ["ssao", "окклюзия", "ambient occlusion"],
  },
  {
    id: "load-distribution", category: "rust", risk: "safe", type: "tweak",
    title: "Распределение нагрузки", question: "Как выставить распределение нагрузки?",
    answer: "Сравните «Распределение нагрузки» в обоих положениях, меняя только один параметр.",
    caseStudy: "Проедьте один маршрут рядом с большой базой. Если после переключения средний FPS тот же, сравните длинные кадры и стабильность; при отсутствии разницы оставьте исходное значение.",
    keywords: ["распределение нагрузки", "load distribution", "распределение"],
  },
  {
    id: "gc-buffer", category: "rust", risk: "safe", type: "tweak",
    title: "GC Buffer для 16 и 32 ГБ", question: "Какой gc.buffer ставить при 16 или 32 ГБ ОЗУ?",
    answer: "gc.buffer — запас памяти до следующей очистки. Больший запас может уменьшить частоту пауз, но отнимает ОЗУ. При свободной памяти попробуйте gc.buffer 4096 для 32 ГБ или gc.buffer 2048 для 16 ГБ. Выберите только одну строку под свой объём.",
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
    caseStudy: "Если после перезапуска качество теней снова высокое, проверьте автооптимизацию игры в приложении драйвера. Сохраните свой профиль и повторите запуск.",
    keywords: ["nvidia app", "автоматическая оптимизация", "автооптимизация", "battery boost", "ноутбук"],
  },
  {
    id: "gpu-power", category: "drivers", risk: "caution", type: "tweak",
    title: "Питание GPU: максимальная производительность", question: "Какой режим электропитания указан для видеокарты?",
    answer: "В профиле видеодрайвера указана «Максимальная производительность». Проверяйте режим для Rust, а не для всех приложений сразу.",
    note: "Такой режим может увеличить нагрев и потребление энергии.",
    caseStudy: "Сравните в профиле Rust частоты, температуры и время кадра до и после смены режима питания. Если частота и раньше была стабильной, дополнительный нагрев не оправдан.",
    keywords: ["режим питания gpu", "электропитание", "максимальная производительность", "prefer maximum performance"],
  },
  {
    id: "shader-cache", category: "drivers", risk: "safe", type: "tweak",
    title: "Кэш шейдеров без ограничения", question: "Какой размер кэша шейдеров использовать для статтеров скинов?",
    answer: "При подгрузке скинов проверьте настройки кэша шейдеров. Режим «Без ограничений» требует свободного места на диске; сравните, меняется ли число статтеров.",
    caseStudy: "Первый проход после обновления драйвера может дёргаться из-за компиляции. Повторите тот же маршрут с уже прогретым кэшем, прежде чем менять лимит его размера.",
    keywords: ["кэш шейдеров", "shader cache", "статтеры скинов", "кеш шейдеров", "без ограничений"],
  },
  {
    id: "nvidia-driver", category: "drivers", risk: "caution", type: "tweak",
    title: "Версии драйверов NVIDIA 581.42 и 596.36", question: "Подойдут ли драйверы NVIDIA 581.42 и 596.36?",
    answer: "581.42 и 596.36 не подходят автоматически к любому GPU. Сверьте список совместимости и сравните стабильность в текущем патче.",
    note: "Проверяйте совместимость конкретной карты и актуальность исправлений безопасности перед откатом.",
    caseStudy: "Появились артефакты после обновления? Запишите версию драйвера и проверьте список поддержанных GPU. Номер из чужого гайда не доказывает совместимость с вашей картой.",
    keywords: ["драйвер nvidia", "драйвер nvidia rust", "581.42", "596.36", "geforce driver"],
  },
  {
    id: "amd-driver", category: "drivers", risk: "caution", type: "tweak",
    title: "Версия драйвера AMD 23.12.1", question: "Стоит ли ставить AMD 23.12.1?",
    answer: "AMD 23.12.1 не является универсальным решением. Сверьте поддержку карты и сначала проверьте стабильность на актуальном драйвере.",
    note: "Проверьте, поддерживает ли эта версия ваш GPU, и не жертвуйте обновлениями безопасности ради непроверенного результата.",
    caseStudy: "Если артефакт виден только с одним профилем Adrenalin, сначала проверьте настройки по умолчанию для Rust. Старый драйвер для другой серии Radeon не является контрольным тестом.",
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
    caseStudy: "Если резкий поворот вызывает рывок, сравните два прохода с разной частотой опроса мыши, не меняя DPI. Убедитесь, что рывок связан именно с движением, а не с загрузкой базы.",
    keywords: ["опрос мыши", "при повороте", "мышь", "мышью", "1000 гц", "polling rate"],
  },
  {
    id: "ram-capacity", category: "fixes", risk: "safe", type: "fix",
    title: "Объём ОЗУ", question: "Достаточно ли 16 ГБ ОЗУ для Rust?",
    answer: "16 ГБ — нижний практический ориентир; с 32 ГБ у игры и фона больше запаса. Это не официальные требования и не оценка FPS конкретного ПК.",
    caseStudy: "Если при входе на сервер Windows активно обращается к диску, повторите тест без браузера. Сокращение пауз при меньшей фоновой нагрузке — повод проверить запас ОЗУ.",
    keywords: ["сколько озу", "сколько ram", "объем озу", "16 гб озу", "32 гб озу", "оперативная память"],
  },
  {
    id: "amd-crosshair", category: "fixes", risk: "safe", type: "fix",
    title: "Двоение перекрестия на AMD", question: "Что делать, если перекрестие двоится на AMD?",
    answer: "При двоении перекрестия выключите «Плавное движение» в AMD Adrenalin и повторите проверку.",
    caseStudy: "На неподвижном фоне плавно поверните камеру. Сравните контур прицела с генерацией промежуточных кадров и без неё при тех же настройках рендера.",
    keywords: ["двоение", "двоится", "перекрестие", "перекрестия", "плавное движение", "fluid motion", "afmf"],
  },
  {
    id: "kernel-power", category: "fixes", risk: "caution", type: "fix",
    title: "Kernel-Power 41", question: "Что означают советы про 90 °C и 99% при Kernel-Power 41?",
    answer: "Событие 41 фиксирует аварийное выключение, но не определяет причину. Проверьте температуры, питание и стабильность памяти. Лимит температуры в BIOS сверяйте со спецификацией процессора.",
    note: "Перед изменением BIOS или схемы питания проверьте температуры, стабильность ПК и питание. Эти значения не являются универсальным исправлением.",
    caseStudy: "После внезапной перезагрузки запишите время и условия нагрузки. Запись 41 говорит о некорректном завершении работы, но не доказывает неисправность конкретно БП или CPU.",
    keywords: ["kernel power", "kernel-power 41", "ошибка 41", "90 градусов", "cpu 99", "перезагрузка"],
  },
  {
    id: "amd-shadows", category: "fixes", risk: "caution", type: "fix",
    title: "Пиксельные тени на AMD", question: "Что попробовать при пиксельных тенях на AMD?",
    answer: "При пиксельных тенях для диагностики сравните низкое качество с High/Max. Если проблема остаётся, проверьте драйвер под свою карту.",
    note: "Высокие тени могут увеличить нагрузку. Понижение версии драйвера не должно быть первым шагом.",
    caseStudy: "Сделайте два снимка одной тени с одной точки. Если дефект исчез только на высоких тенях, запишите также потерю FPS: визуальный обходной путь не бесплатен.",
    keywords: ["пиксельные тени", "пиксельные тени amd", "квадратные тени", "high max", "артефакты теней"],
  },
  {
    id: "stuck-done", category: "fixes", risk: "caution", type: "fix",
    title: "Зависание на «Done»", question: "Что делать, если Rust зависает на Done?",
    answer: "Сохраните копию cfg и запустите проверку целостности файлов в Steam, не удаляя исполняемый файл вручную.",
    note: "Сброс cfg может удалить настройки и бинды. Сохраните копию до сброса.",
    caseStudy: "Если после проверки Steam клиент снова загружается, верните бинды из своей копии по одному. Не удаляйте всю папку настроек без резервной копии.",
    keywords: ["done", "зависает на done", "зависание при загрузке", "rust.exe", "папка cfg", "проверка файлов"],
  },
];
