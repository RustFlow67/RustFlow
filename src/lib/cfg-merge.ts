/** Only explicitly reviewed graphics convars may be edited during a graphics
 * operation. In particular graphics.fov, FPS limits, GC and network are not
 * implicitly changed when merging an existing user's config. */
export const GRAPHICS_CFG_KEYS = new Set([
  "graphics.drawdistance", "graphics.shaderlod", "graphics.shadowquality", "graphics.shadowmode",
  "graphics.shadowcascades", "graphics.shadowdistance", "graphics.shadowlights", "graphics.grassshadows",
  "graphics.contactshadows", "graphics.af", "graphics.parallax", "graphics.branding", "graphics.reflexmode",
  "graphics.vsync", "graphics.renderscale", "water.quality", "water.reflections", "grass.quality", "grass.displace",
  "tree.quality", "tree.meshes", "terrain.quality", "mesh.quality", "decor.quality", "particle.quality",
  "effects.maxgibs", "effects.ao", "effects.bloom", "effects.motionblur", "effects.antialiasing",
]);

/** Preserve every non-target line and its original line ending verbatim.
 * Duplicate target keys are all updated, never removed. */
export function mergeGraphicsCfg(existing: string, changes: Record<string, string | number>): string {
  const allowed = new Map(Object.entries(changes).filter(([key, value]) =>
    GRAPHICS_CFG_KEYS.has(key) && /^[\w.+-]+$/.test(String(value))).map(([key, value]) => [key, String(value)]));
  const seen = new Set<string>();
  const newline = existing.includes("\r\n") ? "\r\n" : existing.includes("\r") && !existing.includes("\n") ? "\r" : "\n";
  const lines = existing.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)?.filter(Boolean) ?? [];
  const merged = lines.map((line) => {
    const match = /^(\uFEFF?\s*)([A-Za-z0-9_.]+)(\s+)("[^"\r\n]*"|[^\s\r\n]+)([^\r\n]*)(\r\n|\r|\n|$)$/.exec(line);
    if (!match) return line;
    const key = match[2].toLowerCase();
    const value = allowed.get(key);
    if (value === undefined) return line;
    seen.add(key);
    return `${match[1]}${match[2]}${match[3]}"${value}"${match[5]}${match[6]}`;
  }).join("");
  const additions = [...allowed].filter(([key]) => !seen.has(key)).map(([key, value]) => `${key} "${value}"`);
  if (!additions.length) return merged;
  return merged + (merged && !/[\r\n]$/.test(merged) ? newline : "") + additions.join(newline) + newline;
}
