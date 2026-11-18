import type { PresetResolution, PresetTier } from "./preset";

const ddr4 = (stickGb: 8 | 16, rate: number, cl: number) => ["DDR4", 2, stickGb, rate, cl] as const;
const ddr5 = (stickGb: 16 | 32, rate: number, cl: number) => ["DDR5", 2, stickGb, rate, cl] as const;
const d4_3200 = ddr4(8, 3200, 16);
const d4_3600 = ddr4(16, 3600, 16);
const d5_6000 = ddr5(16, 6000, 30);
const d5_6400 = ddr5(16, 6400, 32);

export interface PresetEstimate {
  cpuId: string;
  gpuId: string;
  pbo?: true;
  ram: ReturnType<typeof ddr4> | ReturnType<typeof ddr5>;
  ssd: readonly [kind: "sata" | 3 | 4 | 5, gb: 500 | 1000 | 2000 | 4000];
  resolution: PresetResolution;
  graphics: readonly [profile: "low" | "balanced" | "quality", draw: number, shader: number, water: 0 | 1 | 2];
  bottleneck: string;
  driverNote?: string;
}

/**
 * Catalog inventory. Bench projections come from fps-calibration.ts.
 * SSD capacity is the size of the drive.
 */
export const PRESET_ESTIMATES: Record<PresetTier, readonly PresetEstimate[]> = {
  budget: [
    {
      cpuId: "ryzen-5-2600", gpuId: "geforce-gtx-1650",
      ram: ddr4(8, 3000, 16), ssd: ["sata", 500], resolution: "1080p",
      graphics: ["low", 1000, 100, 0],
      bottleneck: "4 ГБ VRAM — первый предел: оставьте лёгкие текстуры. У крупных баз Zen+ добавит отдельные пики времени кадра.",
    },
    {
      cpuId: "core-i3-10100f", gpuId: "geforce-gtx-1650-super",
      ram: ddr4(8, 2666, 16), ssd: ["sata", 500], resolution: "1080p",
      graphics: ["low", 1250, 100, 0],
      bottleneck: "Быстрая для своего класса 1650 Super всё ещё ограничена 4 ГБ. Не повышайте текстуры после входа в районы с большим числом скинов.",
    },
    {
      cpuId: "core-i5-10400f", gpuId: "geforce-gtx-1660-ti",
      ram: ddr4(8, 2933, 16), ssd: [3, 500], resolution: "1080p",
      graphics: ["low", 1500, 150, 0],
      bottleneck: "Дальность заметнее текстур нагружает Comet Lake при езде мимо баз; 6 ГБ VRAM хватает для низкого профиля.",
      driverNote: "2933 МТ/с на i5-10400F требует платы с настройкой памяти (например, B560/Z490). Если плата ограничивает частоту 2666, оставьте поддерживаемый режим.",
    },
    {
      cpuId: "core-i3-12100f", gpuId: "geforce-rtx-3050",
      ram: d4_3200, ssd: [3, 500], resolution: "1080p",
      graphics: ["low", 1600, 150, 0],
      bottleneck: "Alder Lake редко ограничивает эту связку на пустой дороге; при открытом виде на монумент сначала упирается RTX 3050.",
    },
    {
      cpuId: "ryzen-5-5500", gpuId: "geforce-gtx-1660-super",
      ram: d4_3200, ssd: [3, 1000], resolution: "1080p",
      graphics: ["low", 1500, 150, 0],
      bottleneck: "В чистых сценах предел задаёт GTX 1660 Super, а возле баз меньший L3 у 5500 заметен по 1% low.",
    },
    {
      cpuId: "ryzen-5-5500", gpuId: "radeon-rx-6600",
      ram: d4_3200, ssd: [3, 1000], resolution: "1080p",
      graphics: ["balanced", 1650, 200, 0],
      bottleneck: "RX 6600 подключается по PCIe 3.0 ×8 с Ryzen 5500; подгрузка при заполнении VRAM может давать пики даже при хорошем среднем FPS.",
    },
    {
      cpuId: "core-i5-11400f", gpuId: "geforce-rtx-2060-super",
      ram: d4_3200, ssd: [3, 1000], resolution: "1080p",
      graphics: ["balanced", 1750, 225, 0],
      bottleneck: "Плотный круг разворота в Outpost выявляет предел CPU раньше, чем заканчиваются 8 ГБ VRAM; проверьте стабильность памяти в Gear 1.",
    },
    {
      cpuId: "ryzen-5-3600", gpuId: "geforce-rtx-3060",
      ram: ddr4(16, 3200, 16), ssd: [3, 1000], resolution: "1080p",
      graphics: ["balanced", 1700, 250, 1],
      bottleneck: "32 ГБ уменьшают давление на подкачку, но не разгружают главный поток Zen 2; ожидайте меньший прирост Avg, чем 1% low.",
    },
    {
      cpuId: "core-i3-13100f", gpuId: "radeon-rx-6650-xt",
      ram: d4_3200, ssd: [4, 1000], resolution: "1080p",
      graphics: ["balanced", 1800, 250, 0],
      bottleneck: "Четыре ядра 13100F хорошо тянут обычный маршрут, но фоновые процессы и многолюдные рейды просаживают нижний 1%.",
    },
  ],
  sweetspot: [
    {
      cpuId: "ryzen-5-5600", gpuId: "geforce-rtx-3060", pbo: true,
      ram: d4_3600, ssd: [3, 1000], resolution: "1080p",
      graphics: ["balanced", 1800, 250, 0],
      bottleneck: "При плотной застройке лимит — ядро и L3 Zen 3. PBO зависит от охлаждения и не гарантирует прирост в каждом проходе.",
    },
    {
      cpuId: "core-i5-12400f", gpuId: "geforce-rtx-3060-ti",
      ram: ddr4(16, 3200, 16), ssd: [4, 1000], resolution: "1080p",
      graphics: ["balanced", 1850, 275, 1],
      bottleneck: "3060 Ti достаточно для 1080p; после смены района сильнее всего видны задержки CPU и памяти, а не пропускная способность SSD.",
    },
    {
      cpuId: "ryzen-5-5600", gpuId: "radeon-rx-6700-xt",
      ram: d4_3600, ssd: [3, 1000], resolution: "1440p",
      graphics: ["balanced", 1850, 275, 1],
      bottleneck: "В нативном 1440p тени и отражения загружают RX 6700 XT; низкие отражения оставляют запас при наведении вдоль берега.",
    },
    {
      cpuId: "core-i5-13400f", gpuId: "geforce-rtx-4060",
      ram: ddr5(16, 5600, 36), ssd: [4, 1000], resolution: "1080p",
      graphics: ["balanced", 1900, 300, 0],
      bottleneck: "С быстрым P-ядром 13400F упор на открытом воздухе смещается в RTX 4060; 8 ГБ не стоит перегружать текстурами.",
    },
    {
      cpuId: "ryzen-5-7500f", gpuId: "geforce-rtx-4060-ti", pbo: true,
      ram: d5_6000, ssd: [4, 1000], resolution: "1440p",
      graphics: ["balanced", 1950, 275, 0],
      bottleneck: "У 4060 Ti 8 ГБ в 1440p важнее лимит VRAM, чем ещё один шаг PBO; снижайте текстуры при повторяемых пиках на въезде в монумент.",
    },
    {
      cpuId: "ryzen-5-7500f", gpuId: "radeon-rx-7700-xt",
      ram: d5_6000, ssd: [4, 1000], resolution: "1440p",
      graphics: ["balanced", 2050, 300, 1],
      bottleneck: "12 ГБ VRAM оставляют запас под скины, поэтому на Official чаще замедляет обработка сущностей, а не загрузка текстур.",
    },
    {
      cpuId: "ryzen-5-7600x", gpuId: "geforce-rtx-4060-ti-16gb",
      ram: d5_6000, ssd: [4, 2000], resolution: "1440p",
      graphics: ["balanced", 2000, 325, 1],
      bottleneck: "16 ГБ дают запас по текстурам, но не ускоряют сам чип 4060 Ti. На воде следите за загрузкой GPU, а не только за VRAM.",
    },
    {
      cpuId: "core-i5-14400f", gpuId: "geforce-rtx-4070",
      ram: ddr5(16, 6000, 32), ssd: [4, 1000], resolution: "1440p",
      graphics: ["balanced", 2100, 325, 1],
      bottleneck: "4070 справляется с этим профилем, но стабильность 6000 CL32 и частоты P-ядер заметны в густой застройке.",
    },
    {
      cpuId: "ryzen-7-5700x", gpuId: "radeon-rx-6800", pbo: true,
      ram: d4_3600, ssd: [4, 2000], resolution: "1440p",
      graphics: ["balanced", 2050, 350, 1],
      bottleneck: "При 16 ГБ VRAM узким местом у клановых баз скорее станет L3 обычного 5700X; дополнительные ядра сами по себе не устранят просадки.",
    },
  ],
  "mid-high": [
    {
      cpuId: "ryzen-7-5700x3d", gpuId: "geforce-rtx-3070-ti",
      ram: d4_3600, ssd: [4, 1000], resolution: "1080p",
      graphics: ["balanced", 2050, 300, 1],
      bottleneck: "Кэш 5700X3D держит плотный маршрут, но 8 ГБ RTX 3070 Ti ограничивают текстуры; высокая мощность карты требует хорошего обдува.",
    },
    {
      cpuId: "ryzen-7-5700x3d", gpuId: "geforce-rtx-4070",
      ram: d4_3600, ssd: [4, 1000], resolution: "1440p",
      graphics: ["balanced", 2200, 350, 1],
      bottleneck: "На 1440p RTX 4070 может ограничить кадр на открытом ландшафте; возле кварталов баз главным снова становится CPU.",
    },
    {
      cpuId: "ryzen-7-5700x3d", gpuId: "radeon-rx-7800-xt",
      ram: d4_3600, ssd: [4, 2000], resolution: "1440p",
      graphics: ["quality", 2250, 375, 1],
      bottleneck: "Высокие текстуры помещаются в 16 ГБ; в населённых клетках потолок задаёт 5700X3D. Снижение рендера мало меняет эти просадки.",
    },
    {
      cpuId: "ryzen-7-5800x3d", gpuId: "geforce-rtx-4070-super",
      ram: ddr4(16, 3600, 14), ssd: [4, 2000], resolution: "1440p",
      graphics: ["quality", 2300, 400, 1],
      bottleneck: "Запас AM4 определяется стабильностью 2×16 CL14 и температурой CPU; агрессивные тайминги не компенсируют перегрев.",
    },
    {
      cpuId: "core-i5-13600kf", gpuId: "geforce-rtx-4070-super",
      ram: d5_6400, ssd: [4, 2000], resolution: "1440p",
      graphics: ["quality", 2200, 375, 1],
      bottleneck: "Без большого L3 этот Core чаще ограничен CPU на Official, даже когда 4070 Super загружена не полностью.",
    },
    {
      cpuId: "core-i5-14600kf", gpuId: "geforce-rtx-5070",
      ram: d5_6400, ssd: [4, 2000], resolution: "1440p",
      graphics: ["quality", 2300, 400, 1],
      bottleneck: "При резких поворотах между постройками важны стабильное питание и лимиты 14600KF. Генерация кадров не повышает базовый 1% low.",
    },
    {
      cpuId: "core-i7-13700kf", gpuId: "geforce-rtx-4070-ti-super",
      ram: d5_6400, ssd: [4, 2000], resolution: "1440p",
      graphics: ["quality", 2400, 425, 1],
      bottleneck: "16 ГБ VRAM не препятствуют детализации в 1440p. Длительные просадки обычно связаны с температурой 13700KF и плотностью симуляции.",
    },
    {
      cpuId: "ryzen-7-7700x", gpuId: "radeon-rx-7900-gre",
      ram: d5_6000, ssd: [4, 2000], resolution: "1440p",
      graphics: ["quality", 2300, 400, 1],
      bottleneck: "7900 GRE оставляет запас для 2K. В крупных кварталах преимущество быстрого Zen 4 ограничивает обычный L3, а не число ядер.",
    },
    {
      cpuId: "ryzen-7-7800x3d", gpuId: "radeon-rx-7900-xt",
      ram: d5_6000, ssd: [4, 2000], resolution: "1440p",
      graphics: ["quality", 2450, 450, 2],
      bottleneck: "20 ГБ позволяют держать чёткие текстуры, но высокое качество воды нагружает растеризацию у берега. У плотных баз лимит другой — CPU.",
    },
  ],
  flagship: [
    {
      cpuId: "ryzen-7-7800x3d", gpuId: "geforce-rtx-4070-ti-super",
      ram: d5_6000, ssd: [4, 2000], resolution: "1440p",
      graphics: ["quality", 2500, 450, 1],
      bottleneck: "На 2K с умеренными отражениями чаще всего ограничивает главный поток при входе в клановую зону, а не сама карта.",
    },
    {
      cpuId: "ryzen-7-7800x3d", gpuId: "geforce-rtx-4080-super",
      ram: ddr5(16, 6000, 28), ssd: [4, 2000], resolution: "4k",
      graphics: ["quality", 2450, 450, 1],
      bottleneck: "В нативном 4K лимит уже часто графический, даже на 4080 Super. Понижение отражений освобождает время кадра без смены текстур.",
    },
    {
      cpuId: "ryzen-7-7800x3d", gpuId: "radeon-rx-7900-xtx",
      ram: ddr5(32, 6000, 30), ssd: [4, 2000], resolution: "4k",
      graphics: ["quality", 2500, 500, 1],
      bottleneck: "Запас 24 ГБ помогает удержать текстуры в памяти, но не отменяет цену затенения в 4K. Сначала снижайте Shader и каскады, если GPU загружен полностью.",
    },
    {
      cpuId: "core-i7-14700kf", gpuId: "geforce-rtx-4080-super",
      ram: ddr5(16, 6800, 34), ssd: [4, 2000], resolution: "1440p",
      graphics: ["quality", 2450, 450, 2],
      bottleneck: "В 2K GPU обычно не мешает 14700KF. Просадки при рейдах зависят от охлаждения CPU и стабильности XMP 6800.",
    },
    {
      cpuId: "core-i9-14900ks", gpuId: "geforce-rtx-4090",
      ram: ddr5(32, 7200, 34), ssd: [5, 2000], resolution: "4k",
      graphics: ["quality", 2500, 550, 2],
      bottleneck: "Лимит может меняться между растеризацией 4K и тепловым лимитом 14900KS. 7200 с 2×32 ГБ требует проверки конкретной платы и контроллера памяти.",
    },
    {
      cpuId: "ryzen-9-7950x3d", gpuId: "geforce-rtx-4080-super",
      ram: ddr5(32, 6000, 30), ssd: [5, 2000], resolution: "4k",
      graphics: ["quality", 2400, 475, 1],
      bottleneck: "Нативный 4K чаще упирается в RTX 4080 Super. Для нижнего 1% на Official также важен корректный выбор CCD с 3D V-Cache.",
      driverNote: "Установите актуальный драйвер чипсета AMD и проверьте игровой режим Windows для выбора CCD. EXPO включайте только после проверки стабильности.",
    },
    {
      cpuId: "ryzen-7-9800x3d", gpuId: "radeon-rx-9070-xt",
      ram: d5_6000, ssd: [4, 2000], resolution: "1440p",
      graphics: ["quality", 2500, 500, 2],
      bottleneck: "В лесу с длинной линией обзора GPU тратит время на геометрию и воду, а среди построек ограничивает уже симуляция, даже с 9800X3D.",
    },
    {
      cpuId: "ryzen-7-9800x3d", gpuId: "geforce-rtx-4090",
      ram: ddr5(32, 6000, 30), ssd: [5, 2000], resolution: "4k",
      graphics: ["quality", 2500, 550, 2],
      bottleneck: "GPU ограничивает кадр на панорамах 4K, а на Official чаще видны скачки обработки игроков. Переход на PCIe 5.0 сам по себе не повысит Avg.",
    },
    {
      cpuId: "ryzen-9-9950x3d", gpuId: "geforce-rtx-5090",
      ram: ddr5(32, 6000, 30), ssd: [5, 4000], resolution: "4k",
      graphics: ["quality", 2500, 600, 2],
      bottleneck: "Даже с RTX 5090 в нативном 4K толпа и большая база ограничены главным игровым потоком. Следите за выбором CCD и температурой, а не только за загрузкой VRAM.",
      driverNote: "Актуальный драйвер чипсета AMD и игровой режим Windows помогают выбрать CCD. Не считайте кадры, добавленные генерацией, частью замера.",
    },
  ],
};
