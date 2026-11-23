import { expect, test } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import { evaluateBuild10, isValidBuildInput, QUICK_SAMPLE_BUILDS } from "@/lib/models/build";
import { profileCfg } from "@/lib/graphics-profiles";
import { PLAY_DEFAULTS, readPlaySettings, type PlaySettings } from "@/lib/models/play-settings";
import { localPack } from "@/lib/local-pack";
import { personalPlanHref, packHref } from "@/lib/tweaker";

test("workload changes estimates without inventing unnecessary cfg commands", () => {
  const input = QUICK_SAMPLE_BUILDS[0].input;
  const base = evaluateBuild10(input)!;
  const cfg = (settings: PlaySettings) => profileCfg("competitive", input.ramGb, "", 1, settings, "nvidia");
  expect(evaluateBuild10({ ...input, ...PLAY_DEFAULTS })?.fpsOfficial).toEqual(base.fpsOfficial);
  for (const patch of [{ scenario: "raid" }, { latencyMode: "on" }, { backgroundLoad: "stream" }, { gcBuffer: "2048" }, { renderStyle: "clear" }] as const) {
    const modified = { ...PLAY_DEFAULTS, ...patch };
    const ev = evaluateBuild10({ ...input, ...modified })!;
    for (const key of ["fpsOfficial", "fpsModded"] as const) {
      expect(ev[key].max).not.toBe(base[key].max);
      expect(ev[key].low1).not.toBe(base[key].low1);
      expect(ev[key].low1).toBeLessThanOrEqual(ev[key].min);
    }
  }
  expect(cfg({ ...PLAY_DEFAULTS, latencyMode: "on" })).toContain('graphics.reflexmode "1"');
  expect(cfg({ ...PLAY_DEFAULTS, gcBuffer: "2048" })).toContain('gc.buffer "2048"');
  expect(cfg({ ...PLAY_DEFAULTS, backgroundLoad: "stream" })).toEqual(cfg(PLAY_DEFAULTS));
  expect(isValidBuildInput({ ...input, gcBuffer: "9999" } as unknown as typeof input)).toBe(false);
});

test("personal URL, server pack URL and browser ZIP preserve the same settings", () => {
  const tuning = { scenario: "raid", latencyMode: "boost", backgroundLoad: "apps", gcBuffer: "2048", renderStyle: "esports" } as const;
  for (const href of [personalPlanHref("balanced", "nvidia", 32, 8, "nvme", tuning), packHref([], "balanced", "nvidia", 32, 8, tuning)]) {
    const q = new URL(href, "https://rustflow.test").searchParams;
    expect(readPlaySettings(key => q.get(key))).toEqual(tuning);
    q.set("renderStyle", "unknown");
    expect(readPlaySettings(key => q.get(key))).toBeNull();
  }
  for (const gpu of ["nvidia", "amd"] as const) {
    const archive = unzipSync(localPack({ slugs: [], mode: "balanced", gpu, ram: 32, vram: 8, tuning })!);
    const cfg = strFromU8(archive["RustFlow-Pack/client.cfg"]).replaceAll("\r\n", "\n").trim();
    expect(cfg).toBe(profileCfg("balanced", 32, "", 1, tuning, gpu));
    expect(cfg).toContain(`graphics.reflexmode "${gpu === "nvidia" ? 2 : 0}"`);
    expect(cfg.match(/^gc\.buffer /gm)).toHaveLength(1);
    if (gpu === "amd") expect(strFromU8(archive["RustFlow-Pack/README.txt"])).toContain("Anti-Lag включите вручную");
  }
});
