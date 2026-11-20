import { expect, type Page } from "@playwright/test";

export async function expectReceded(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-popup-depth", "");
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("[data-hud]")].map((el) => {
          const css = getComputedStyle(el),
            pose = new DOMMatrixReadOnly(css.transform),
            box = el.getBoundingClientRect();
          const top = el.dataset.hud === "top",
            left = el.dataset.hud === "left";
          // A pinned source bar holds its press pose above the dialog: the
          // untouched source keeps its text and glass in place while every
          // sibling panel recedes. Unpinned bars retire entirely.
          if (el.hasAttribute("data-source-pinned")) {
            const src = el.querySelector("[data-flip-anchor]");
            const siblingsOut = [...el.querySelectorAll("[data-chrome-panel]:not([data-flip-anchor])")].every(
              (s) => getComputedStyle(s).opacity === "0",
            );
            return (
              el.inert && !!src && getComputedStyle(src).opacity === "1" && box.bottom > 0 && siblingsOut
            );
          }
          return (
            css.opacity === "0" &&
            css.pointerEvents === "none" &&
            Math.abs(pose.a - 0.95) < 0.0001 &&
            (left ? box.right <= 0 : top ? box.bottom <= 0 : box.top >= innerHeight) &&
            el.inert
          );
        }),
      ),
    )
    .toEqual([true, true]);
  for (const band of await page.locator(".chrome-veil").all()) await expect(band).toHaveCSS("opacity", "0");
  await expect(page.locator("main")).toHaveAttribute("inert", "");
}
