import { expect, test } from "@playwright/test";

test("compares measured FPS and validates optional values in both languages", async ({ page }) => {
  await page.goto("/tools");
  const tool = page.locator("#measurement-compare");
  const before = tool.getByRole("group", { name: "До" });
  const after = tool.getByRole("group", { name: "После" });
  await before.getByLabel("Средний FPS").fill("80");
  await after.getByLabel("Средний FPS").fill("100");
  await before.getByLabel("1% low FPS (необязательно)").fill("50");
  await after.getByLabel("1% low FPS (необязательно)").fill("60");
  await tool.getByLabel("Частота монитора, Гц (необязательно)").fill("144");
  await expect(tool.getByText("+25.0%", { exact: true })).toBeVisible();
  await expect(tool.getByText("-20.0%", { exact: true })).toBeVisible();
  await expect(tool.getByText("+20.0%", { exact: true })).toBeVisible();
  await expect(tool.getByText("6.94 мс", { exact: true })).toBeVisible();
  await tool.getByLabel("Язык калькулятора").selectOption("en");
  await expect(tool.getByText("Monitor refresh interval")).toBeVisible();
  await tool.getByRole("group", { name: "Before" }).getByLabel("1% low FPS (optional)").fill("101");
  await expect(tool.getByText(/1% low must not exceed/)).toBeVisible();
  await expect(tool.getByText("+25.0%", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
