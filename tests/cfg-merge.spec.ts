import { expect, test } from "@playwright/test";
import { mergeGraphicsCfg } from "../src/lib/cfg-merge";
import { profileCfg } from "../src/lib/graphics-profiles";

test("existing configs retain protected values, comments, duplicates and line endings", () => {
  const original = '\ufeff// User settings\r\nbind q forward;sprint\r\ninput.sensitivity "0.5"\r\naudio.master "0.7"\r\ngraphics.fov "90"\r\nhud.visible "true"\r\nlerp.interpolation "0.2"\r\n  graphics.drawdistance  "2500" // kept\r\ngraphics.drawdistance "2000"\r\nunknown.command "value"';
  const merged = mergeGraphicsCfg(original, { "graphics.drawdistance": 1200, "graphics.fov": 60, "input.sensitivity": 1, "gc.buffer": 4096, "water.quality": 0 });
  expect(merged).toBe(original.replace('  graphics.drawdistance  "2500"', '  graphics.drawdistance  "1200"').replace('graphics.drawdistance "2000"', 'graphics.drawdistance "1200"') + '\r\nwater.quality "0"\r\n');
  const generated = profileCfg("competitive", 32, original);
  expect(generated).toContain('graphics.fov "90"');
  expect(generated).toContain('lerp.interpolation "0.2"');
  expect(generated).not.toContain('gc.buffer');
});
