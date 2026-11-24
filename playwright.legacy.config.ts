import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

// Archived coverage for the removed web tools and pre-showcase UI. These tests
// are retained for reference and are not expected to pass against the current site.
export default defineConfig(config, {
  testMatch: "**/*.spec.ts",
  testIgnore: "**/native-mode.spec.ts",
});
