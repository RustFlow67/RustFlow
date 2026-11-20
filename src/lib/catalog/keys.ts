export type Collection = "presets" | "guide" | "faq";
/** Stable across filtering, localisation of controls and array reordering. Only
 * these opaque catalogue keys (not search terms or hardware) leave the client. */
export function readingKey(group: string, title: string) {
  let hash = 2166136261;
  for (const char of title) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${group}-${(hash >>> 0).toString(36)}`;
}
