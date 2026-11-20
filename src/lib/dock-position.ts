export const DOCK_KEY = "rustflow:dock-position:v1";
export const DOCK_POSITIONS = [
  { value: "bottom", label: "Снизу (стандарт)" },
  { value: "left", label: "Сбоку слева (компактный)" },
] as const;
export type DockPosition = (typeof DOCK_POSITIONS)[number]["value"];
export const readDock = (value: unknown): DockPosition => (value === "left" ? value : "bottom");
