import { optics as materialOptics } from "./material-optics";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { QUICK_SAMPLE_BUILDS, evaluateBuild10, isValidBuildInput } from "@/lib/models/build";
import { DRIVES, changeDrive, driveEstimate } from "@/lib/models/drive";
import { profileBuild } from "@/lib/auth/profile-build";

const activate = (el: Locator) => test.info().project.use.hasTouch ? el.tap() : el.click();
const sample = QUICK_SAMPLE_BUILDS[0].input;
const profile = (page: Page) => page.getByRole("dialog", { name: "Профиль игрока" });
const pickDrive = async (p: Page, label: string) => {
  await activate(p.getByRole("combobox", { name: "Интерфейс и поколение" })); await activate(p.getByRole("option", { name: label,exact: true }));
};

test("disk model separates map I/O from rendering and accepts old builds without upgrading their claims", () => {
  let previous = Infinity;
  const baseline = evaluateBuild10(sample,"competitive")!;
  for (const {value} of DRIVES) {
    const input = { ...sample, ...changeDrive(sample,value) };
    const d = driveEstimate(input), e = evaluateBuild10(input,"competitive")!;
    expect(d.warmupMax).toBeLessThan(previous); previous = d.warmupMax;
    expect(e.fpsModded.min).toBe(baseline.fpsModded.min); expect(e.fpsOfficial.max).toBe(baseline.fpsOfficial.max);
    expect(driveEstimate({...input,diskFill:"high"}).warmupMax).toBeGreaterThan(d.warmupMax);
  }
  const input = {...sample, storage:"nvme" as const, nvmeGen:4 as const};
  const normal = driveEstimate(input), hmb = driveEstimate({...input,diskCache:"hmb"}), none = driveEstimate({...input,diskCache:"none"});
  expect(normal.warmupMax).toBeLessThan(hmb.warmupMax); expect(hmb.warmupMax).toBeLessThan(none.warmupMax);
  const full = {...input,diskFill:"high" as const,diskCache:"none" as const};
  expect(driveEstimate(full).risk).toBe("Повышенный"); expect(evaluateBuild10(full)!.fpsOfficial.low1).toBeLessThan(evaluateBuild10(input)!.fpsOfficial.low1);
  expect(profileBuild({...full,owner:"discard"})).toMatchObject(full); expect(profileBuild(full)).not.toHaveProperty("owner");
  for (const bad of [{storage:"sata",diskCache:"hmb"},{nvmeGen:6},{diskFill:95},{diskCache:"yes"}]) expect(profileBuild({...input,...bad})).toBeNull();
  expect(isValidBuildInput(sample)).toBe(true); expect(driveEstimate({storage:"nvme"}).label).toBe("NVMe SSD");
});

test("legacy local rig, drive edits, real cabinet counters and account-bound hardware survive reload", async ({page}) => {
  await page.addInitScript(input => {
    if (!localStorage.getItem("rustflow:store:v1")) localStorage.setItem("rustflow:store:v1",JSON.stringify({builds:[{id:"old-1",input}],activeBuildId:"old-1"}));
  }, {...sample,name:"Архивный ПК",storage:"nvme"});
  await page.goto("/benchmark"); const panel=profile(page), pill=page.locator(".profile-trigger");
  const drive=page.getByRole("combobox",{name:"Интерфейс и поколение"}), output=page.locator(".warmup-readout strong");
  await expect(drive).toHaveText(/PCIe 3.0/); const start=await output.innerText();
  await pickDrive(page,"NVMe PCIe 5.0"); await expect(output).not.toHaveText(start);
  await activate(page.locator(".advanced-fields > summary"));
  await activate(page.getByRole("radio",{name:"HMB",exact:true})); await activate(page.getByRole("radio",{name:"> 85% · мало места"}));
  const changed=await output.innerText(); await page.reload(); await expect(output).toHaveText(changed); await expect(drive).toHaveText(/PCIe 5.0/);
  await activate(page.locator(".advanced-fields > summary"));
  await expect(page.getByRole("radio",{name:"HMB",exact:true})).toHaveAttribute("aria-checked","true");
  await activate(pill); await activate(panel.getByRole("button",{name:/Продолжить через Google/}));
  await expect(panel.locator(".rig-parts")).toContainText(/NVMe PCIe 5\.0 · HMB · > 85%/); await expect(panel.locator(".cabinet-body > section")).toHaveCount(3);
  await expect(panel.locator(".cabinet-widgets dt")).toHaveText(["Создано сборок","Применено твиков","Расчётный прирост FPS","Уровень оптимизации ПК"]);
  const positions=await panel.locator(".cabinet-widget").evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y];}));
  expect(positions[0][0]).toBe(positions[2][0]);expect(positions[1][0]).toBe(positions[3][0]);expect(positions[0][1]).toBe(positions[1][1]);expect(positions[2][1]).toBe(positions[3][1]);
  await activate(panel.getByText("Сохранение и копии",{exact:true})); await expect(panel.locator(".cabinet-library")).toContainText(/\d+[.,]\d \/ 10/);
  const stat = (label:string) => panel.locator(".cabinet-widget").filter({hasText:label}).locator("b");
  await activate(panel.getByRole("button",{name:"Привязать локальную сборку"})); await expect(stat("Создано сборок")).toHaveText("1");
  await activate(panel.getByRole("button",{name:"Обновить из браузера"})); await expect(stat("Создано сборок")).toHaveText("1");
  await expect(panel.locator(".cabinet-person")).toContainText(/В RustFlow с .*\d{4}/);
  await activate(panel.getByText("Редактировать профиль",{exact:true})); await panel.getByLabel("Никнейм").fill("Astra");
  await activate(panel.getByRole("combobox",{name:"Цвет аватара"}));await activate(page.getByRole("option",{name:"Хвоя"}));
  await activate(panel.getByRole("combobox",{name:"Иконка аватара"}));await activate(page.getByRole("option",{name:"Кристалл"}));
  await panel.getByLabel("Discord или Steam").fill("https://steamcommunity.com/id/astra"); await activate(panel.getByRole("button",{name:"Сохранить изменения"}));
  await expect(panel.locator(".profile-identity a")).toHaveAttribute("href","https://steamcommunity.com/id/astra");
  await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0);
  // A package selection is not a completed tweak. Mark the real manual step
  // in its instructions, not on the hardware calculator.
  await page.goto("/tweaker?tweak=steam-checklist");
  await activate(page.getByRole("dialog").getByRole("switch",{name:/Отметить выполненным:/}).first());
  await page.goto("/benchmark");
  await expect(pill).toHaveAccessibleName("Профиль: Astra"); await expect(pill.locator(".profile-avatar")).toHaveAttribute("data-color","pine");
  await activate(pill); await expect(stat("Применено твиков")).toHaveText("1"); await expect(stat("Уровень оптимизации ПК")).not.toHaveText("0%");
  await expect(stat("Расчётный прирост FPS")).toHaveText(/[+-]?\d+ FPS/); await expect(panel.locator(".rig-name")).toHaveText("Архивный ПК");
  await activate(panel.getByRole("link",{name:"Настроить в Сборке ↗"})); await expect(panel).toHaveCount(0); await expect(page.getByLabel("Название профиля")).toHaveValue("Архивный ПК");
  await activate(page.locator(".advanced-fields > summary"));
  await pickDrive(page,"SATA SSD"); await expect(page.getByRole("radio",{name:"HMB",exact:true})).toHaveCount(0);
  await pickDrive(page,"HDD (7200 RPM)"); await expect(page.getByRole("radiogroup",{name:"Буфер контроллера"})).toHaveCount(0);
  await expect(page.locator(".warmup-readout")).toContainText("высокий");
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("rustflow:store:v1")!).builds); expect(saved).toHaveLength(1); expect(saved[0].input).not.toHaveProperty("nvmeGen"); expect(saved[0].input).not.toHaveProperty("diskCache");
  await page.goto("/benchmark?account=1#build-config"); await expect(drive).toHaveText(/PCIe 5.0/); await expect(output).toHaveText(changed);
  // Previewing an account seed has not replaced the newer local HDD rig.
  await activate(pill); await expect(panel.locator(".rig-parts")).toContainText("NVMe PCIe 5.0");
});

test("navigation pulses only the controls, never the viewport or scroll bands; reduced motion skips the effect", async ({page}) => {
  await page.goto("/"); await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  await expect(page.locator(".route-edge-blur")).toHaveCount(0);
  const capture = await page.evaluateHandle(() => ({ frames:new Promise<boolean[]>(resolve => window.addEventListener("rustflow:chrome-pulse",() => queueMicrotask(() => {
    const frames=(el:Element)=>el.getAnimations().map(a=>a.effect).filter((e):e is KeyframeEffect=>e instanceof KeyframeEffect);
    resolve([ ...Array.from(document.querySelectorAll("[data-chrome-panel]"),el=>frames(el).some(f=>f.getKeyframes().some(k=>k.scale==="1.045" && !k.boxShadow))),
      ...Array.from(document.querySelectorAll(".dock-glyph-wrap"),(el,i)=>frames(el).some(f=>Number(f.getTiming().delay)===i*11 && f.getKeyframes().some(k=>k.rotate==="-6deg") && f.getKeyframes().some(k=>k.rotate==="5deg"))),
      ...Array.from(document.querySelectorAll(".dock-glyph-wrap"),(el,i)=>Array.from(el.querySelectorAll("[data-part],[data-dock-glyph=gear],[data-dock-glyph=shield]")).some(n=>frames(n).some(f=>Number(f.getTiming().duration)+Number(f.getTiming().delay)===350 && Number(f.getTiming().delay)>=i*11))),
      [...document.querySelectorAll(".chrome-veil")].every(el=>!frames(el).some(f=>f.getTiming().duration===350)) ]);
  }),{once:true})) }));
  await activate(page.locator('.nav-item[href="/drivers"]')); expect(await capture.evaluate(v=>v.frames)).toEqual(Array(16).fill(true)); await capture.dispose();
  await expect(page).toHaveURL(/\/drivers$/); await expect(page.locator(".route-edge-blur")).toHaveCount(0);
  await page.emulateMedia({reducedMotion:"reduce"}); await expect(page.locator("html")).toHaveAttribute("data-motion","reduced");
  expect(await page.evaluate(()=>{window.dispatchEvent(new Event("rustflow:chrome-pulse"));return document.querySelector(".tabbar-bottom")!.getAnimations().filter(a=>a instanceof Animation && a.effect instanceof KeyframeEffect && a.effect.getKeyframes().some(k=>k.scale==="1.045")).length})).toBe(0);
});

test("public crystal optics persist, favorite lenses keep keyboard semantics and badges use the body face", async ({page}) => {
  await page.goto("/presets"); const menu=page.getByRole("dialog",{name:"Настройки"});
  await activate(page.getByRole("button",{name:"Настройки",exact:true}));
  await activate(menu.getByRole("button",{name:/Полный Liquid/})); await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-material","liquid");
  for(const sel of [".tabbar-bottom",".segmented",".preset-card"]) {
    const pane=page.locator(sel).first(); await expect(pane).toHaveCSS("backdrop-filter",materialOptics(28,sel===".tabbar-bottom"?"rail":"pane"));
    await expect(pane).toHaveCSS("background-image",/^linear-gradient\(/); await expect(pane).toHaveCSS("border-top-color","rgba(255, 255, 255, 0.14)");
  }
  const star=page.locator(".favorite-drop").first(); await expect(star).toHaveCSS("backdrop-filter",materialOptics(28,"round")); await star.focus(); await page.keyboard.press("Space");
  await expect(star).toHaveAttribute("aria-pressed","true"); await expect(star.locator("svg")).toHaveAttribute("fill",/url\(#/); await expect(star.locator("svg")).toHaveCSS("animation-name","star-settle");
  await page.reload(); await expect(star).toHaveAttribute("aria-pressed","true"); await activate(star); await expect(star).toHaveAttribute("aria-pressed","false");
  await page.goto("/"); await expect(page.locator("h1")).toHaveCSS("font-family",/Unbounded/); for(const sel of [".reason-meta small",".terminal-command code"]) await expect(page.locator(sel).first()).toHaveCSS("font-family",/Inter Variable/);
});
