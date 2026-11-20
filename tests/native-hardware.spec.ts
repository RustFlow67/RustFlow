import { test, expect } from "@playwright/test";
import { detectedBuild } from "../src/lib/native-hardware";

const info = { cpu: "AMD Ryzen 5 5600X 6-Core Processor", gpu: "NVIDIA GeForce RTX 4070 Ti", ramGb: 32, ramMhz: 3600, storage: "nvme" as const, windowsVersion: "11" as const };
test("native build matches exact models without confusing GPU variants", () => {
  const rig = detectedBuild(info);
  expect(rig?.cpuId).toBe("ryzen-5-5600x");
  expect(rig?.gpuId).toBe("geforce-rtx-4070-ti");
  expect(rig?.storage).toBe("nvme");
  expect(rig?.ramMhz).toBe(3600);
  expect(rig?.windowsVersion).toBe("11");
});
test("unknown device, disk and frequency never produce an invented build", () => {
  expect(detectedBuild({ ...info, gpu: "NVIDIA GeForce RTX 4070 Ti Laptop GPU" })).toBeUndefined();
  expect(detectedBuild({ ...info, cpu: "unlisted CPU" })).toBeUndefined();
  expect(detectedBuild({ ...info, storage: null })).toBeUndefined();
  expect(detectedBuild({ ...info, ramMhz: 0 })).toBeUndefined();
});
