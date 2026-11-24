import { expect, test } from "@playwright/test";
import { GRAPHICS_PROFILES, graphicsCommands, profileCfg, textureMipForVram } from "../src/lib/graphics-profiles";
import { HARDWARE_PRESETS } from "../src/lib/models/preset";
import { projectPreset } from "../src/lib/models/preset-projection";
import { GAME_TWEAKS } from "../src/lib/tweaks/game";

test("profiles generate unique conservative commands and correct memory budgets", () => {
  for (const p of GRAPHICS_PROFILES) {
    for (const ram of [8, 16, 32, 64]) {
      const cfg = profileCfg(p.id, ram, 'graphics.drawdistance "2500"\ngrass.displacement "True"\ninput.sensitivity "0.5"', undefined, { backgroundLoad: "stream" });
      const keys = cfg.split("\n").map(line => line.split(/\s+/)[0]);
      expect(new Set(keys).size).toBe(keys.length);
      expect(cfg).toContain(`graphics.drawdistance "${p.draw}"`);
      expect(profileCfg(p.id, ram, '', undefined, { backgroundLoad: 'stream' })).toContain(`gc.buffer "${ram >= 32 ? 4096 : ram >= 16 ? 2048 : 1024}"`);
      expect(cfg).toContain(`grass.displacement "${p.id === 'potato' ? 'False' : 'True'}"`);
      expect(cfg).toContain('input.sensitivity "0.5"');
    }
  }
  expect(graphicsCommands("competitive", 16)).toMatchObject({ "graphics.drawdistance": 1500, "graphics.shaderlod": 200, "graphics.shadowdistance": 50, "grass.displacement": "True" });
  expect(graphicsCommands("balanced", 32)).toMatchObject({ "graphics.drawdistance": 1600, "graphics.shaderlod": 300 });
});

test("catalog and installer use the same profile commands", () => {
  for (const preset of HARDWARE_PRESETS) for (const profile of GRAPHICS_PROFILES) {
    const view = projectPreset(preset, profile.id);
    expect(view.cfgText).toBe(profileCfg(profile.id, preset.ramGb, "", textureMipForVram(preset.vramGb)));
    expect(view.settings.drawDistance).toBe(profile.draw);
    expect(view.settings.maxGibs).toBe(graphicsCommands(profile.id, preset.ramGb)["effects.maxgibs"]);
  }
  for (const [slug, id] of [["preset-competitive", "competitive"], ["preset-balanced", "balanced"], ["preset-quality", "quality"]] as const) {
    const tweak = GAME_TWEAKS.find(t => t.slug === slug)!;
    const commands = graphicsCommands(id, 16);
    expect(tweak.file.content).toContain(`'graphics.drawdistance'`);
    expect(tweak.manual?.content).toContain(`graphics.drawdistance ${commands["graphics.drawdistance"]}`);
    expect(tweak.file.content).toContain("Type YES to continue");
  }
});
