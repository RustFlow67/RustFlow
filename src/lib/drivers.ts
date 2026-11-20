import { GPUS } from "./hardware";

/** Catalogue of device families, not a benchmark or a mirror of installers.
 * A series shares a publisher package; never invent a per-GPU FPS ranking. */
export const DRIVER_FAMILIES = [
  { id: "nvidia", title: "NVIDIA RTX/GTX", note: "GeForce" },
  { id: "radeon", title: "AMD Radeon", note: "Radeon RX" },
  { id: "arc", title: "Intel Arc", note: "Arc A и B" },
  { id: "network-drivers", title: "Сетевые адаптеры", note: "Realtek и Intel" },
  { id: "chipset", title: "Чипсет и аудио DPC Latency", note: "Плата и звук" },
] as const;
export type FamilyId = (typeof DRIVER_FAMILIES)[number]["id"];
export const DDU = "https://www.wagnardsoft.com/display-driver-uninstaller-ddu";
export const NVCLEANSTALL = "https://www.techpowerup.com/download/techpowerup-nvcleanstall/";
export const OEM_LINKS = [
  ["ASUS: поддержка по модели платы", "https://www.asus.com/support/download-center/"],
  ["Lenovo: поддержка по модели ноутбука", "https://pcsupport.lenovo.com/"],
] as const;
const nv = "https://www.nvidia.com/en-us/drivers/",
  amd = "https://www.amd.com/en/support/download/drivers.html";
const releases = {
  geforce: {
    name: "GeForce Game Ready WHQL",
    version: "596.21 WHQL",
    notes: "https://www.nvidia.com/en-us/drivers/details/267157/",
    url: nv,
    advice:
      "Выберите настольную GeForce, свою серию и версию Windows. Берите подписанный Game Ready, в списке продуктов которого есть ваша модель, а не пакет для ноутбука.",
  },
  pascal: {
    name: "GeForce Security Update · Pascal / Maxwell",
    version: "582.66 WHQL",
    notes: "https://www.nvidia.com/Download/driverResults.aspx/272768/en-us/1000/",
    url: nv,
    advice:
      "Эти карты обслуживаются в отдельной ветке обновлений безопасности. Не устанавливайте Game Ready для новых RTX; проверьте доступное исправление для своей серии.",
  },
  rdna: {
    name: "AMD Software: Adrenalin Edition · Recommended",
    version: "26.10.1",
    notes: "https://www.amd.com/en/resources/support-articles/release-notes/RN-RAD-WIN-26-10-1.html",
    url: amd,
    advice:
      "Выберите выпуск Recommended для своей карты и Windows. Optional нужен, если в нём описано исправление именно вашей проблемы.",
  },
  polaris: {
    name: "AMD Software для Polaris и Vega",
    version: "25.8.1 для Polaris / Vega",
    notes:
      "https://www.amd.com/en/resources/support-articles/release-notes/RN-RAD-WIN-25-8-1-POLARIS-VEGA.html",
    url: amd,
    advice: "Это отдельная ветка более старых Radeon. Пакет для RX 7000 или RX 9000 не является заменой.",
  },
  intel: {
    name: "Intel Arc Graphics · WHQL",
    version: "32.0.101.8991 WHQL",
    notes: "https://downloadmirror.intel.com/927121/ReleaseNotes_101.8991_WHQL.pdf",
    url: "https://www.intel.com/content/www/us/en/download/785597/intel-arc-graphics-windows.html",
    advice:
      "Сверьте свою Arc в списке поддерживаемых устройств. В разделе Known Issues перечислены известные проблемы. Пакет старой встроенной UHD не подходит.",
  },
  realtek: {
    name: "Realtek PCIe Ethernet",
    version: null,
    notes: null,
    url: "https://www.realtek.com/en/component/zoo/category/network-interface-controllers-10-100-1000m-gigabit-ethernet-pci-express-software?Itemid=890",
    advice:
      "Сначала проверьте сетевой драйвер на странице своей материнской платы. Для универсального пакета Realtek сверьте идентификатор устройства, ревизию и Windows. Не путайте PCIe с USB.",
  },
  ethernet: {
    name: "Intel Ethernet Adapter",
    version: null,
    notes: null,
    url: "https://www.intel.com/content/www/us/en/download/15084/intel-ethernet-adapter-complete-driver-pack.html",
    advice:
      "Нужен пакет Ethernet для вашего контроллера и Windows, а не Wi-Fi. Для встроенного сетевого порта сначала проверьте страницу платы.",
  },
  am4am5: {
    name: "AMD Chipset Drivers",
    version: null,
    notes: null,
    url: amd,
    advice:
      "Чипсет связывает процессор с устройствами платы. Выберите Chipsets, сокет и точное название чипсета. Драйвер RAID не нужен для ускорения игр.",
  },
  intelboard: {
    name: "Компоненты чипсета Intel",
    version: null,
    notes: null,
    url: "https://www.intel.com/content/www/us/en/download-center/home.html",
    advice:
      "Проверьте ревизию и модель платы. Начните с пакетов с её страницы поддержки. INF сообщает Windows имена устройств; сам по себе он не прибавляет FPS.",
  },
  audio: {
    name: "Аудиодрайвер производителя платы или ноутбука",
    version: null,
    notes: null,
    url: null,
    advice:
      "Одинаковое название аудиочипа не означает одинаковый пакет. Усилитель, разъёмы и микрофон зависят от модели устройства. Выберите точную модель на сайте её производителя.",
  },
} as const;
type Branch = keyof typeof releases;
export interface DriverSeries {
  title: string;
  branch: Branch;
  models: readonly string[];
}
const gpuSeries = (title: string, branch: Branch, group: string, prefix: string): DriverSeries => ({
  title,
  branch,
  models: GPUS.filter((g) => g.group === group && g.name.startsWith(prefix)).map((g) => g.name),
});
export const DRIVER_SERIES: Record<FamilyId, DriverSeries[]> = {
  nvidia: [
    ...["50", "40", "30", "20"].map((n) =>
      gpuSeries(`RTX ${n}`, "geforce", "NVIDIA GeForce", `GeForce RTX ${n}`),
    ),
    gpuSeries("GTX 16", "geforce", "NVIDIA GeForce", "GeForce GTX 16"),
    gpuSeries("GTX 10", "pascal", "NVIDIA GeForce", "GeForce GTX 10"),
    gpuSeries("GTX 900", "pascal", "NVIDIA GeForce", "GeForce GTX 9"),
  ],
  radeon: [
    ...["9", "7", "6", "5"]
      .map((n) => gpuSeries(`RX ${n}000`, "rdna", "AMD Radeon", `Radeon RX ${n}`))
      .map((s) => ({ ...s, models: s.models.filter((m) => /RX \d{4}/.test(m)) })),
    {
      title: "RX 500 · Polaris",
      branch: "polaris",
      models: ["Radeon RX 590", "Radeon RX 580", "Radeon RX 570", "Radeon RX 560", "Radeon RX 550"],
    },
  ],
  arc: [
    { title: "Arc B", branch: "intel", models: ["Arc B580", "Arc B570"] },
    { title: "Arc A", branch: "intel", models: ["Arc A770", "Arc A750", "Arc A580", "Arc A380"] },
  ],
  "network-drivers": [
    { title: "Realtek PCIe", branch: "realtek", models: ["RTL8111", "RTL8125"] },
    { title: "Intel Ethernet", branch: "ethernet", models: ["Intel I219", "Intel I225", "Intel I226"] },
  ],
  chipset: [
    {
      title: "AMD · AM4 / AM5",
      branch: "am4am5",
      models: ["B450", "B550", "X570", "B650", "X670", "B850", "X870"],
    },
    { title: "Intel · LGA1700", branch: "intelboard", models: ["B660", "Z690", "B760", "Z790"] },
    {
      title: "Аудио и задержки DPC",
      branch: "audio",
      models: [
        "Realtek ALC897",
        "Realtek ALC1220",
        "Встроенный звук платы",
        "Звук ноутбука",
        "Внешний USB-интерфейс",
      ],
    },
  ],
};
// Link to a product page only where we have a known publisher destination.
const productPages: Record<string, string> = {
  "Radeon RX 6600":
    "https://www.amd.com/en/support/downloads/drivers.html/graphics/radeon-rx/radeon-rx-6000-series/amd-radeon-rx-6600.html",
  "Radeon RX 9060 XT":
    "https://www.amd.com/en/support/downloads/drivers.html/graphics/radeon-rx/radeon-rx-9000-series/amd-radeon-rx-9060-xt.html",
  "Radeon RX 5700":
    "https://www.amd.com/en/support/downloads/drivers.html/graphics/radeon-rx/radeon-rx-5000-series/amd-radeon-rx-5700.html",
};
export function driverChoice(family: FamilyId, model: string) {
  const series = DRIVER_SERIES[family].find((s) => s.models.includes(model));
  if (!series) return null;
  const release = releases[series.branch];
  return { ...release, series: series.title, url: productPages[model] ?? release.url };
}
