import { expect, test, type Locator } from "@playwright/test";
import { sourceOutline } from "./source-outline";

/** Record the actual click rect, then verify the honest FLIP: the panel
 * grows from the click rect while the source button stays untouched —
 * same text, full opacity, its skin never leaving home. */
export async function openHeader(button: Locator, dialog: Locator, side: "left" | "right") {
  const capture = await button.evaluateHandle(el => {
    const data = {pressed: {left:0,right:0,top:0,bottom:0,width:0,height:0}, text: ""};
    el.addEventListener("click", () => {
      data.pressed = el.getBoundingClientRect().toJSON();
      data.text = el.textContent ?? "";
    }, {once:true});
    return data;
  });
  try {
    await (test.info().project.use.hasTouch ? button.tap() : button.click());
    await expect(dialog).not.toHaveAttribute("data-header-motion");
    await expect(dialog).toHaveCSS("transition", /transform 0\.38s cubic-bezier\(0\.32, 0\.72, 0, 1\)/);
    const {pressed, text} = await capture.evaluate(d => ({pressed:d.pressed,text:d.text}));
    // The source is never borrowed, hidden or restyled.
    await expect(button).toHaveCSS("opacity", "1");
    expect(await button.textContent()).toBe(text);
    await expect(button.locator(".island-skin")).toHaveCount(1);
    await expect(button).toHaveAttribute("data-flip-anchor", "");
    const start = await sourceOutline(dialog);
    for (const [i,v] of [pressed.left,pressed.top,pressed.width,pressed.height].entries()) expect(Math.abs(start[i] - v)).toBeLessThan(2);
    await dialog.evaluate(el => Promise.allSettled(el.getAnimations().map(a => a.finished)));
    const { edge, top, origin, width, blur, matte } = await dialog.evaluate((el, side) => {
      const r = el.getBoundingClientRect(), layer = el.closest(".modal-backdrop");
      const scrim = layer ? getComputedStyle(layer,"::before") : getComputedStyle(document.querySelector(".assistant-scrim")!);
      return {edge:r[side],top:r.top,width:r.width,origin:getComputedStyle(el).transformOrigin.split(" ").map(parseFloat),blur:scrim.backdropFilter,matte:scrim.backgroundColor};
    }, side);
    expect(Math.abs(top - pressed.bottom - 10)).toBeLessThan(.5);
    expect(Math.abs(edge - pressed[side])).toBeLessThan(.5);
    expect(Math.abs(origin[0] - (side === "left" ? 0 : width))).toBeLessThan(.5);
    expect(origin[1]).toBe(0);
    expect(blur).toBe("blur(12px)"); expect(matte).toBe("rgba(0, 0, 0, 0)");
  } finally { await capture.dispose(); }
}
