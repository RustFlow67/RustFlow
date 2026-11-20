export type ResolvedTheme = "dark" | "light";

/** Текущий резолв темы без подписки (для canvas-рендера). */
export function getResolvedTheme(): ResolvedTheme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}
