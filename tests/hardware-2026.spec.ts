import { expect, test } from "@playwright/test";
import { CPUS, GPUS, getCpu, getGpu } from "../src/lib/hardware";
import { graphicsCommands } from "../src/lib/graphics-profiles";

test("current hardware and memory variants are selectable without duplicate IDs", () => {
  for (const id of ["ryzen-9-9950x3d2", "ryzen-7-9850x3d", "ryzen-7-7700x3d", "ryzen-5-7500x3d", "core-ultra-7-270k-plus", "core-ultra-5-250k-plus", "core-i9-14900kf"]) {
    expect(CPUS.some(item => item.id === id)).toBe(true);
    expect(getCpu(id)).toBeDefined();
  }
  expect(getCpu("core-ultra-9-290k-plus")).toBeUndefined();
  expect(getGpu("geforce-rtx-5060-ti-8gb")?.vram).toBe(8);
  expect(getGpu("geforce-rtx-5060-ti")?.vram).toBe(16);
  expect(getGpu("radeon-rx-9070-gre")?.vram).toBe(12);
  expect(getGpu("radeon-rx-9060-xt-8gb")?.vram).toBe(8);
  expect(getGpu("arc-a580")?.vram).toBe(8);
  expect(new Set(CPUS.map(c => c.id)).size).toBe(CPUS.length);
  expect(new Set(GPUS.map(g => g.id)).size).toBe(GPUS.length);
});

test("safe profile bounds and memory budgets are consistent", () => {
  for (const ram of [8, 12, 16, 32, 64]) {
    const p = graphicsCommands("competitive", ram);
    expect(p["graphics.drawdistance"]).toBeGreaterThanOrEqual(1200);
    expect(p["graphics.shadowdistance"]).toBeGreaterThanOrEqual(50);
    expect(p["gc.buffer"]).toBe(ram >= 32 ? 4096 : ram >= 16 ? 2048 : 1024);
  }
});
