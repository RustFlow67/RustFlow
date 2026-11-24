import { expect, test } from '@playwright/test';
const setup = { version: 1, language: 'ru', goal: 'smooth', accepted: true };
test('five scenes, navigation, HUD, cursor and direct links', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(value => localStorage.setItem('shift:setup:v1', JSON.stringify(value)), setup);
  await page.goto('/');
  await expect(page.locator('.home-deck')).toHaveAttribute('data-slide', '0');
  await expect(page.locator('[data-scene="cinematic"] canvas')).toHaveAttribute('data-webgl', 'ready', {timeout:30000});
  await expect.poll(() => page.locator('.title-pour').evaluate(el => el.getBoundingClientRect().width), {timeout:15000}).toBeGreaterThan(10);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBeTruthy();
  if (info.project.name === 'desktop') { await page.mouse.move(800, 300); await expect(page.locator('html')).toHaveAttribute('data-custom-cursor', ''); }
  for (let i=1; i<5; i++) {
    await page.getByRole('button', {name:'Следующая сцена'}).click();
    await expect(page.locator('.home-deck')).toHaveAttribute('data-slide', String(i));
    if (i===1) { const hud = page.getByRole('button', {name:/Вывести оверлей нагрузки в игру/}); await hud.scrollIntoViewIfNeeded(); await hud.click(); await expect(page.getByRole('status').filter({hasText:'Нативный модуль'})).toBeVisible(); }
    if (i===2 || i===3) await expect(page.locator('html')).toHaveAttribute('data-home-scene',String(i));
  }
  await page.goto('/#telemetry'); await expect(page.locator('.home-deck')).toHaveAttribute('data-slide','1');
  for (const path of ['/benchmark','/presets','/tweaker','/drivers','/base','/faq']) { await page.goto(path); await expect(page.locator('main')).toBeVisible(); await expect(page.locator('html')).not.toHaveAttribute('data-home-frame',''); }
  expect(errors).toEqual([]);
});
test('onboarding starts and can be replayed from the header', async ({page}, info) => {
  test.setTimeout(120000); await page.goto('/');
  const d=page.getByRole('dialog'); await expect(d).toBeVisible();
  await d.getByRole('button',{name:'Продолжить'}).click(); await d.getByRole('button',{name:'Продолжить'}).click();
  await d.getByRole('checkbox').check(); await d.getByRole('button',{name:'Продолжить'}).click();
  await d.getByRole('button',{name:'Войти в SHIFT'}).click(); await expect(d).toBeHidden();
  if (info.project.name==='desktop') await page.getByRole('button',{name:'Онбординг', exact:true}).click();
  else { await page.getByRole('button',{name:'Настройки'}).click(); await page.getByRole('button',{name:'Повторить первоначальную настройку'}).click(); }
  await expect(d).toBeVisible(); await expect(d).toContainText('Шаг 1 / 4');
});
test('hardware drawer searches and changes a component', async ({page})=>{
  test.setTimeout(90000); await page.addInitScript(value => localStorage.setItem('shift:setup:v1', JSON.stringify(value)), setup);
  await page.goto('/benchmark'); const trigger=page.getByRole('button',{name:'Процессор (CPU)',exact:true}); await trigger.click();
  const drawer=page.getByRole('dialog',{name:'Процессор (CPU)'}); await expect(drawer).toBeVisible();
  await drawer.getByRole('textbox',{name:'Процессор (CPU): поиск'}).fill('5600x'); const option=drawer.getByRole('button',{name:/5600x/i}).first(); await expect(option).toBeVisible(); await option.click();
  await expect(drawer).toBeHidden(); await expect(trigger).toContainText(/5600x/i);
});
test('wheel and touch gestures change scenes without scrolling the document', async ({page}, info)=>{
  test.setTimeout(90000); await page.addInitScript(value=>localStorage.setItem('shift:setup:v1',JSON.stringify(value)),setup); await page.goto('/');
  await expect(page.locator('.home-deck')).toHaveAttribute('data-slide','0');
  if(info.project.name==='desktop') { await page.mouse.move(20,700); await page.mouse.wheel(0,250); }
  else { const cdp=await page.context().newCDPSession(page); await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:20,y:700}]}); await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:20,y:450}]}); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); }
  await expect(page.locator('.home-deck')).toHaveAttribute('data-slide','1');
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
});
