import { expect, test, type Locator } from "@playwright/test";
import { QUICK_SAMPLE_BUILDS, type BuildInput } from "@/lib/models/build";
import { bestUpgrade } from "@/lib/models/build-upgrade";
import { expectReceded } from "./hud";

const activate = (control: Locator) => test.info().project.use.hasTouch ? control.tap() : control.click();
const sample = QUICK_SAMPLE_BUILDS[0].input;
const top: BuildInput = { ...sample, cpuId: "ryzen-7-9800x3d", gpuId: "geforce-rtx-5090", ramMhz: 6000, ramCl: 30, ramGb: 64 };

test("upgrade model: socket, alternatives, single-change scenarios, tails and no-purchase paths", () => {
  const am4 = bestUpgrade(sample, "competitive", "coast")!;
  expect(am4.platform).toBe("AM4"); expect(am4.kind).toBe("cpu"); expect(am4.explanation).toContain("96 МБ");
  expect(am4.value?.title).toMatch(/5[78]00X3D/); expect(am4.reserve!.low).toBeGreaterThan(am4.value!.low);
  for (const [patch,kind] of [[{ramGb:8},"ram"],[{storage:"hdd"},"ssd"],[{gpuId:"geforce-gtx-1650",resolution:"4k"},"gpu"],[{},"keep"]] as const) {
    const report = bestUpgrade({...top,...patch}, "quality", "raid")!;
    expect(report.kind).toBe(kind); expect(report.perks).toHaveLength(3); expect(report.checklist).toHaveLength(3);
    expect(Object.keys(report.patch)).toHaveLength(kind === "keep" ? 0 : 1);
    for (const {before,after} of report.matrix) {
      for (const f of [before,after]) { expect(f.low01).toBeLessThanOrEqual(f.low); expect(f.low).toBeLessThanOrEqual(f.avg); expect(f.tailMs).toBe(Math.round(10000/f.low01)/10); }
      if (kind === "keep") expect(after).toEqual(before);
    }
    expect(report.selected.id).toBe("raid");
  }
  const laptop = bestUpgrade({...sample,cpuId:"core-i5-10300h"},"competitive","pvp")!;
  expect(laptop.platform).toBe("Ноутбук"); expect(laptop.kind).toBe("keep");
  expect(bestUpgrade({...sample,resolution:"custom"},"balanced","pvp")).toBeNull();
});

test("the live report follows the CPU, GPU, RAM, storage, timing, resolution and scene", async ({page}) => {
  await page.goto("/benchmark"); const form=page.locator("#build-config"), report=page.locator(".upgrade-verdict");
  await activate(page.locator(".upgrade-details > summary"));
  await activate(form.locator(".advanced-fields > summary"));
  await expect(report.locator(".upgrade-row")).toHaveCount(4); await expect(report.locator(".meter > i")).toHaveCount(8);
  await expect(report.locator(".upgrade-perks li")).toHaveCount(3); await expect(report.locator(".upgrade-alts strong")).toHaveCount(2);
  const base=report.locator(".report-baseline"), matrix=report.locator(".upgrade-matrix");
  const hardware=async (label:string, model:string) => {
    await activate(form.getByRole("button", {name:label,exact:true})); const search=form.getByRole("combobox", {name:`${label}: поиск`});
    await search.fill(model); await search.press("Enter"); await expect(base).toContainText(model);
  };
  await hardware("Процессор (CPU)","Core i5-12400F"); await expect(report.locator(".report-stamp")).toContainText("LGA1700");
  await hardware("Видеокарта (GPU)","GeForce GTX 1650");
  const prior=await matrix.innerText(); await activate(form.getByRole("radio",{name:"8 ГБ",exact:true}));
  await expect(base).toContainText("8 ГБ DDR4"); await expect(matrix).not.toHaveText(prior);
  await activate(form.getByRole("combobox",{name:"Интерфейс и поколение"})); await activate(page.getByRole("option",{name:"HDD (7200 RPM)"})); await expect(base).toContainText("HDD");
  const timing=form.getByRole("combobox",{name:"Первый тайминг (CAS)"}); await timing.focus(); await timing.press("End"); await timing.press("Enter");
  await form.getByLabel("Первый тайминг вручную, CL").fill("18"); await expect(base).toContainText("CL18");
  await activate(form.getByRole("combobox",{name:"Целевое разрешение"})); await activate(page.getByRole("option",{name:"4K",exact:true}));
  await expect(report.locator(".report-pick")).toContainText("3840×2160");
  await activate(form.getByRole("radio",{name:"Клан-рейд / 300+ онлайн",exact:true})); await expect(report.locator(".report-note").first()).toContainText("0.1% low для сцены «Клан-рейд");
});

test("six button-only home targets open six distinct briefs; guide and myth links keep their own action", async ({page},info) => {
  await page.goto("/"); const cards=page.locator(".reason-card"), examples=new Set<string>(); await expect(cards).toHaveCount(6);
  for (const c of await cards.all()) {
    const title=await c.locator("h3").innerText(), trigger=c.getByRole("button");
    await c.evaluate(el => el.scrollIntoView({block:"center",behavior:"instant"}));
    const box=await c.locator("h3").boundingBox(); const x=box!.x+12,y=box!.y+10;
    expect(await page.evaluate(([x,y]) => Boolean(document.elementFromPoint(x,y)?.closest('button')), [x,y])).toBe(false);
    if (info.project.use.hasTouch) await page.touchscreen.tap(x,y); else await page.mouse.click(x,y);
    await expect(page.getByRole("dialog")).toHaveCount(0); await activate(trigger);
    const sheet=page.getByRole("dialog",{name:title,exact:true}); await expect(sheet.getByText("Как это работает")).toBeVisible();
    examples.add(await sheet.locator(".brief-example p").innerText()); await expectReceded(page);
    await page.keyboard.press("Escape"); await expect(trigger).toBeFocused(); await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
  }
  expect(examples.size).toBe(6); await expect(page.locator("footer p")).toHaveText("© 2026 RustFlow. Все права защищены авторским правом. Независимый проект, не связан с Facepunch Studios и Easy Anti-Cheat.");
  await page.goto("/guide#files"); await activate(page.getByRole("button",{name:"Подробнее: REG: ключи реестра"})); await expect(page.locator(".brief-example")).toContainText("копия");
  await page.keyboard.press("Escape"); await page.goto("/faq#myths"); const myth=page.locator("#myths .info-card").filter({has:page.locator("a")}).first();
  await activate(myth.getByRole("button")); await expect(page.getByRole("dialog")).toContainText("Разбор мифа"); await page.keyboard.press("Escape");
  await activate(myth.getByRole("link")); await expect(page).toHaveURL(/\/tweaker\?/);
});

test("dock exits real painted surfaces before the incoming route, without fading glass ancestors", async ({page}) => {
  await page.goto("/"); await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  const frames=await page.evaluateHandle(() => ({out:new Promise<boolean[]>(resolve => {
    window.addEventListener("rustflow:chrome-pulse", () => queueMicrotask(() => {
      const pane=document.querySelector(".rf-page-enter")!;
      const effects=pane.getAnimations({subtree:true}).map(a=>a.effect as KeyframeEffect).filter(Boolean);
      const departure=effects.some(fx=>fx.target===pane && /22px.*0\.95/.test(String(fx.getKeyframes().at(-1)?.transform)));
      const fades=effects.filter(fx => fx.getTiming().fill==="forwards" && fx.getKeyframes().at(-1)?.opacity === "0");
      resolve([departure,fades.length>0,getComputedStyle(pane).opacity==="1",getComputedStyle(pane.querySelector(".glass")!).backdropFilter.includes("blur")]);
    }), {once:true});
  })}));
  await activate(page.locator('a.nav-item[href="/presets"]')); expect(await frames.evaluate(f=>f.out)).toEqual([true,true,true,true]); await frames.dispose();
  await expect(page).toHaveURL(/\/presets$/); await expect(page.locator(".rf-page-enter")).toHaveCSS("animation-name","pageArrival");
});
