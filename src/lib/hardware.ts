/**
 * PC rating model for Rust.
 *
 * The indexes below are approximate relative gaming-performance figures
 * (CPU: Ryzen 7 9800X3D = 100; GPU: relative raster performance at 1080p).
 * They are estimates used to rank hardware and to produce a ballpark FPS
 * range. They are not measurements of a specific PC.
 */

export type StorageId = "hdd" | "sata" | "nvme";
export type ResolutionId = "1080p" | "1440p" | "4k";
export type TierId = "S" | "A" | "B" | "C" | "D";
export type Bottleneck = "cpu" | "gpu" | "ram" | "balanced";

export const RAM_OPTIONS = [8, 12, 16, 24, 32, 64] as const;

export const STORAGE_OPTIONS: { id: StorageId; label: string }[] = [
  { id: "hdd", label: "HDD" },
  { id: "sata", label: "SATA SSD" },
  { id: "nvme", label: "NVMe SSD" },
];

export const RESOLUTION_OPTIONS: { id: ResolutionId; label: string }[] = [
  { id: "1080p", label: "1080p" },
  { id: "1440p", label: "1440p" },
  { id: "4k", label: "4K" },
];

export interface Cpu {
  id: string;
  name: string;
  group: string;
  idx: number;
}

export interface Gpu {
  id: string;
  name: string;
  group: string;
  idx: number;
  vram: number;
  vendor: "nvidia" | "amd" | "intel";
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const cpus = (group: string, rows: [string, number][]): Cpu[] =>
  rows.map(([name, idx]) => ({ id: slug(name), name, group, idx }));

const gpus = (group: string, vendor: Gpu["vendor"], rows: [string, number, number][]): Gpu[] =>
  rows.map(([name, idx, vram]) => ({
    id: slug(name),
    name,
    group,
    idx,
    vram,
    vendor,
  }));

// Full scoring index: older presets and saved rigs remain readable without pretending
// the player owns a different processor. Only the curated list is selectable.
const CPU_INDEX: Cpu[] = [
  ...cpus("AMD Ryzen", [
    ["Ryzen 9 9950X3D2", 101], ["Ryzen 7 9850X3D", 103], ["Ryzen 9 9900X3D", 97],
    ["Ryzen 7 7700X3D", 91], ["Ryzen 5 7500X3D", 88], ["Ryzen 9 7900X3D", 92],
    ["Ryzen 5 9600", 78], ["Ryzen 9 7900", 78], ["Ryzen 7 5700", 58], ["Ryzen 5 3600X", 46],
    ["Ryzen 7 9800X3D", 100],
    ["Ryzen 9 9950X3D", 100],
    ["Ryzen 7 7800X3D", 95],
    ["Ryzen 9 7950X3D", 94],
    ["Ryzen 5 7600X3D", 90],
    ["Ryzen 9 9950X", 85],
    ["Ryzen 9 9900X", 83],
    ["Ryzen 7 9700X", 82],
    ["Ryzen 5 9600X", 80],
    ["Ryzen 7 5800X3D", 82],
    ["Ryzen 9 7950X", 82],
    ["Ryzen 9 7900X", 81],
    ["Ryzen 7 7700X", 80],
    ["Ryzen 7 7700", 79],
    ["Ryzen 5 7600X", 78],
    ["Ryzen 7 5700X3D", 78],
    ["Ryzen 5 7600", 76],
    ["Ryzen 5 7500F", 76],
    ["Ryzen 5 5600X3D", 76],
    ["Ryzen 9 5950X", 66],
    ["Ryzen 9 5900X", 66],
    ["Ryzen 7 5800X", 65],
    ["Ryzen 7 5700X", 63],
    ["Ryzen 5 5600X", 62],
    ["Ryzen 5 5600", 61],
    ["Ryzen 5 5600G", 52],
    ["Ryzen 5 5500", 52],
    ["Ryzen 9 3900X", 48],
    ["Ryzen 7 3700X", 47],
    ["Ryzen 5 3600", 45],
    ["Ryzen 3 3100", 38],
    ["Ryzen 7 2700X", 35],
    ["Ryzen 5 2600", 32],
    ["Ryzen 7 1700", 28],
    ["Ryzen 5 1600", 27],
    ["Ryzen 5 1400", 22],
    ["Ryzen 3 1200", 20],
    ["FX-8350", 14],
  ]),
  ...cpus("Intel Core", [
    ["Core Ultra 7 270K Plus", 89], ["Core Ultra 5 250K Plus", 83],
    ["Core Ultra 7 265KF", 84], ["Core Ultra 7 265", 81], ["Core Ultra 5 245KF", 80],
    ["Core Ultra 5 235", 76], ["Core Ultra 5 225F", 73], ["Core Ultra 5 225", 73],
    ["Core i9-14900KF", 92], ["Core i9-14900F", 87], ["Core i7-14700F", 84],
    ["Core i5-14500", 70], ["Core i5-14400", 69], ["Core i3-14100F", 62],
    ["Core i9-13900KF", 90], ["Core i7-12700KF", 75], ["Core i5-12600KF", 70],
    ["Core i9-14900KS", 93],
    ["Core i9-14900K", 92],
    ["Core i9-13900K", 90],
    ["Core i7-14700K", 88],
    ["Core i7-14700KF", 88],
    ["Core i7-13700K", 86],
    ["Core i7-13700KF", 86],
    ["Core Ultra 9 285K", 86],
    ["Core Ultra 7 265K", 84],
    ["Core i5-14600K", 83],
    ["Core i5-14600KF", 83],
    ["Core i5-13600K", 81],
    ["Core i5-13600KF", 81],
    ["Core Ultra 5 245K", 80],
    ["Core i9-12900K", 78],
    ["Core i7-12700K", 75],
    ["Core i5-12600K", 70],
    ["Core i5-14400F", 69],
    ["Core i5-13400F", 68],
    ["Core i5-12400F", 64],
    ["Core i7-11700K", 62],
    ["Core i9-10900K", 61],
    ["Core i3-13100F", 60],
    ["Core i3-12100F", 58],
    ["Core i7-10700K", 58],
    ["Core i9-9900K", 57],
    ["Core i7-9700K", 55],
    ["Core i5-11400F", 54],
    ["Core i5-10600K", 52],
    ["Core i7-8700K", 50],
    ["Core i5-9600K", 48],
    ["Core i5-10400F", 47],
    ["Core i5-9400F", 43],
    ["Core i5-8400", 41],
    ["Core i7-7700K", 41],
    ["Core i3-10100F", 40],
    ["Core i7-6700K", 37],
    ["Core i7-4790K", 33],
    ["Core i3-8100", 30],
    ["Core i7-4770K", 30],
    ["Core i5-7400", 29],
    ["Core i5-6500", 28],
    ["Core i5-4460", 24],
  ]),
  ...cpus("Ноутбуки", [
    ["Core i7-13700H", 70],
    ["Ryzen 7 7840HS", 68],
    ["Core i7-12700H", 66],
    ["Core i5-12500H", 60],
    ["Ryzen 7 6800H", 58],
    ["Ryzen 7 5800H", 54],
    ["Ryzen 5 5600H", 50],
    ["Core i5-11400H", 48],
    ["Core i7-10750H", 44],
    ["Core i5-10300H", 38],
  ]),
];

// Same inventory for the picker and the upgrade model. Tiers are relative
// comparisons within a socket, not live prices or a claim of stock.
export const BUILD_CPU_TIERS:Record<string,Record<string,number>> = {
  AM4:{"ryzen-5-5600":1,"ryzen-5-5600x":1,"ryzen-7-5700x3d":2,"ryzen-7-5800x3d":3},
  AM5:{"ryzen-5-7500f":1,"ryzen-5-7600":1,"ryzen-5-7600x":1,"ryzen-7-7700":2,"ryzen-7-7800x3d":2,"ryzen-7-9800x3d":3},
  LGA1700:{"core-i5-12400f":1,"core-i5-13400f":1,"core-i5-13600kf":2,"core-i5-14600kf":2,"core-i7-14700kf":3},
};
export const CPUS = CPU_INDEX;
export const GPUS: Gpu[] = [
  ...gpus("NVIDIA GeForce", "nvidia", [
    ["GeForce RTX 5090", 160, 32],
    ["GeForce RTX 5080", 118, 16],
    ["GeForce RTX 5070 Ti", 104, 16],
    ["GeForce RTX 5070", 86, 12],
    ["GeForce RTX 5060 Ti", 66, 16],
    ["GeForce RTX 5060 Ti 8GB", 66, 8],
    ["GeForce RTX 5060", 58, 8],
    ["GeForce RTX 5050", 50, 8],
    ["GeForce RTX 4090", 132, 24],
    ["GeForce RTX 4080 Super", 106, 16],
    ["GeForce RTX 4080", 104, 16],
    ["GeForce RTX 4070 Ti Super", 93, 16],
    ["GeForce RTX 4070 Ti", 86, 12],
    ["GeForce RTX 4070 Super", 80, 12],
    ["GeForce RTX 4070", 70, 12],
    ["GeForce RTX 4060 Ti", 56, 8],
    ["GeForce RTX 4060 Ti 16GB", 56, 16],
    ["GeForce RTX 4060", 48, 8],
    ["GeForce RTX 3090 Ti", 94, 24],
    ["GeForce RTX 3090", 86, 24],
    ["GeForce RTX 3080 Ti", 84, 12],
    ["GeForce RTX 3080", 76, 10],
    ["GeForce RTX 3070 Ti", 63, 8],
    ["GeForce RTX 3070", 59, 8],
    ["GeForce RTX 3060 Ti", 52, 8],
    ["GeForce RTX 3060", 40, 12],
    ["GeForce RTX 3060 8GB", 36, 8],
    ["GeForce RTX 3050", 28, 8],
    ["GeForce RTX 2080 Ti", 58, 11],
    ["GeForce RTX 2080 Super", 50, 8],
    ["GeForce RTX 2080", 48, 8],
    ["GeForce RTX 2070 Super", 45, 8],
    ["GeForce RTX 2070", 40, 8],
    ["GeForce RTX 2060 Super", 39, 8],
    ["GeForce RTX 2060", 34, 6],
    ["GeForce GTX 1660 Ti", 29, 6],
    ["GeForce GTX 1660 Super", 28, 6],
    ["GeForce GTX 1660", 25, 6],
    ["GeForce GTX 1650 Super", 22, 4],
    ["GeForce GTX 1650", 16, 4],
    ["GeForce GTX 1630", 9, 4],
    ["GeForce GTX 1080 Ti", 45, 11],
    ["GeForce GTX 1080", 35, 8],
    ["GeForce GTX 1070 Ti", 32, 8],
    ["GeForce GTX 1070", 28, 8],
    ["GeForce GTX 1060 6GB", 21, 6],
    ["GeForce GTX 1060 3GB", 19, 3],
    ["GeForce GTX 1050 Ti", 13, 4],
    ["GeForce GTX 1050", 10, 2],
    ["GeForce GTX 980 Ti", 26, 6],
    ["GeForce GTX 980", 20, 4],
    ["GeForce GTX 970", 17, 4],
    ["GeForce GTX 960", 11, 2],
    ["GeForce GTX 750 Ti", 7, 2],
  ]),
  ...gpus("AMD Radeon", "amd", [
    ["Radeon RX 9070 XT", 102, 16],
    ["Radeon RX 9070", 90, 16],
    ["Radeon RX 9070 GRE", 78, 12],
    ["Radeon RX 9060 XT", 67, 16],
    ["Radeon RX 9060 XT 8GB", 67, 8],
    ["Radeon RX 7900 XTX", 108, 24],
    ["Radeon RX 7900 XT", 94, 20],
    ["Radeon RX 7900 GRE", 83, 16],
    ["Radeon RX 7800 XT", 77, 16],
    ["Radeon RX 7700 XT", 65, 12],
    ["Radeon RX 7600 XT", 48, 16],
    ["Radeon RX 7600", 45, 8],
    ["Radeon RX 6950 XT", 88, 16],
    ["Radeon RX 6900 XT", 84, 16],
    ["Radeon RX 6800 XT", 78, 16],
    ["Radeon RX 6800", 68, 16],
    ["Radeon RX 6750 XT", 57, 12],
    ["Radeon RX 6700 XT", 55, 12],
    ["Radeon RX 6650 XT", 46, 8],
    ["Radeon RX 6600 XT", 45, 8],
    ["Radeon RX 6600", 39, 8],
    ["Radeon RX 6500 XT", 20, 4],
    ["Radeon RX 5700 XT", 42, 8],
    ["Radeon RX 5700", 37, 8],
    ["Radeon RX 5600 XT", 33, 6],
    ["Radeon RX 5500 XT", 23, 8],
    ["Radeon RX 590", 21, 8],
    ["Radeon RX 580", 19, 8],
    ["Radeon RX 570", 16, 4],
    ["Radeon RX 560", 9, 4],
    ["Radeon RX 550", 6, 4],
  ]),
  ...gpus("Intel Arc", "intel", [
    ["Arc B580", 50, 12],
    ["Arc B570", 44, 10],
    ["Arc A770", 42, 16],
    ["Arc A750", 38, 8],
    ["Arc A580", 32, 8],
    ["Arc A380", 14, 6],
  ]),
  ...gpus("Ноутбуки", "nvidia", [
    ["GeForce RTX 4070 Laptop", 52, 8],
    ["GeForce RTX 4060 Laptop", 46, 8],
    ["GeForce RTX 4050 Laptop", 38, 6],
    ["GeForce RTX 3060 Laptop", 36, 6],
    ["GeForce RTX 3050 Laptop", 24, 4],
    ["GeForce GTX 1650 Laptop", 14, 4],
  ]),
  ...gpus("Встроенная графика", "amd", [
    ["Radeon 780M", 15, 2],
    ["Radeon 680M", 12, 2],
    ["Radeon Vega 8", 6, 2],
  ]),
  ...gpus("Встроенная графика", "intel", [
    ["Intel Iris Xe", 6, 2],
    ["Intel UHD Graphics", 3, 1],
  ]),
];

const CPU_BY_ID = new Map(CPU_INDEX.map((c) => [c.id, c]));
const GPU_BY_ID = new Map(GPUS.map((g) => [g.id, g]));

export const getCpu = (id: string) => CPU_BY_ID.get(id);
export const getGpu = (id: string) => GPU_BY_ID.get(id);

export const BOTTLENECK_LABEL: Record<Bottleneck, string> = {
  cpu: "Процессор",
  gpu: "Видеокарта",
  ram: "Оперативная память",
  balanced: "Сбалансировано",
};
