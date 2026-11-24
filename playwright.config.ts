import { defineConfig } from "@playwright/test";

const IS_DESKTOP_APP = process.env.NEXT_PUBLIC_IS_DESKTOP_APP === "true";

const port = IS_DESKTOP_APP ? 3001 : 3000;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  // Historical specs target retired routes and the old onboarding. Keep them available
  // via playwright.legacy.config.ts, but run current showcase and shared-logic coverage by default.
  testMatch: IS_DESKTOP_APP ? ["**/native-mode.spec.ts"] : [
    "**/showcase.spec.ts", "**/cfg-merge.spec.ts", "**/graphics-profiles.spec.ts",
    "**/play-settings.spec.ts", "**/native-hardware.spec.ts", "**/hardware-2026.spec.ts",
  ],
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL,
    browserName: "chromium",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 860 } } },
    { name: "touch", use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: {
    command: `npm run dev -- --hostname 0.0.0.0 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
