import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
const setup={version:1,language:'ru',goal:'smooth',accepted:true};
test('onboarding starts on a fresh device and restarts from the header',async({page})=>{
  test.setTimeout(120000); await page.addInitScript(v=>localStorage.setItem('shift:setup:v1',JSON.stringify(v)),setup); await page.goto('/'); const dialog=page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Продолжить'}).click(); await dialog.getByRole('button',{name:'Продолжить'}).click(); await dialog.getByRole('checkbox').check(); await dialog.getByRole('button',{name:'Продолжить'}).click(); await dialog.getByRole('button',{name:'Войти в SHIFT'}).click(); await expect(dialog).toBeHidden();
  expect(await page.evaluate(()=>localStorage.getItem('shift_onboarding_v5_completed'))).toBeTruthy(); await page.getByRole('button',{name:'Онбординг',exact:true}).click(); await expect(dialog).toBeVisible(); await expect(dialog).toContainText('Шаг 1 / 4');
});
test('four scenes and a visible GPU wave, five navigation links, removed routes',async({page},info)=>{
  test.setTimeout(120000); const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message)); await page.addInitScript(v=>localStorage.setItem('shift_onboarding_v5_completed',JSON.stringify(v)),setup); await page.goto('/');
  const canvas=page.locator('[data-scene="cinematic"] canvas'); await expect(canvas).toHaveAttribute('data-webgl','ready',{timeout:30000}); await expect(canvas).toHaveAttribute('data-wave','perspective');
  const nav=page.getByRole('navigation',{name:'Навигация по главам'}); await expect(nav.getByRole('link')).toHaveCount(5); await expect(page.getByRole('button',{name:'Настройки',exact:true})).toHaveCount(0); await expect(nav).not.toContainText(/Телеметрия|Драйверы|База/);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBeTruthy();
  if(info.project.name==='desktop'){await page.mouse.move(20,700);await page.mouse.wheel(0,250);}else{const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:20,y:700}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:20,y:450}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  await expect(page.locator('.home-deck')).toHaveAttribute('data-slide','1');
  for(let i=2;i<4;i++){await page.getByRole('button',{name:'Следующая сцена'}).click();await expect(page.locator('.home-deck')).toHaveAttribute('data-slide',String(i));}
  await expect(page.getByText('04 / YOUR SYSTEM, YOUR CHOICE')).toBeVisible();
  for(const path of ['/drivers','/base']) { const response=await page.goto(path);expect(response?.status()).toBe(404); }
  expect(errors).toEqual([]);
});
test('new configurator, cfg studio, tweak package and FAQ work',async({page})=>{
  test.setTimeout(120000); await page.addInitScript(v=>localStorage.setItem('shift_onboarding_v5_completed',JSON.stringify(v)),setup); const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/benchmark'); await expect(page.locator('.rig-slot')).toHaveCount(4); await expect(page.locator('select')).toHaveCount(0);await expect(page.locator('.build-workspace,.balance-3d')).toHaveCount(0);
  const trigger=page.getByRole('button',{name:'Процессор (CPU)',exact:true}); await trigger.click();const drawer=page.getByRole('dialog',{name:'Процессор (CPU)'}); await drawer.getByRole('textbox').fill('5800x3d'); await drawer.getByRole('button',{name:/5800x3d/i}).first().click();await expect(trigger).toContainText(/5800x3d/i);await page.reload();await expect(trigger).toContainText(/5800x3d/i);
  await page.goto('/presets'); await page.getByRole('button',{name:/POTATO/}).click(); await expect(page.locator('.code-panel pre')).toContainText('grass.displace');await expect(page.locator('.code-panel pre')).toContainText('graphics.shadowdistance "50"');await page.getByLabel('Дальность прорисовки').fill('2000'); await expect(page.locator('.code-panel pre')).toContainText('graphics.drawdistance "2000"'); await page.getByLabel('Лимит FPS (0 = без лимита)').fill('120'); await expect(page.locator('.code-panel pre')).toContainText('fps.limit "120"');
  const cfgDownload=page.waitForEvent('download');await page.getByRole('button',{name:/Скачать .cfg/}).click(); expect((await cfgDownload).suggestedFilename()).toMatch(/\.cfg$/);
  await page.goto('/tweaker');const sw=page.getByRole('switch').first();await expect(sw).toHaveAttribute('aria-checked','false');await sw.click();await expect(sw).toHaveAttribute('aria-checked','true');const zip=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать пакет ↓'}).click();const savedZip=await zip; expect(savedZip.suggestedFilename()).toMatch(/\.zip$/); const files=Object.keys(unzipSync(await readFile((await savedZip.path())!))); expect(files.some(f=>f.includes('Otkat/'))).toBeTruthy(); expect(files.some(f=>/README.txt$/.test(f))).toBeTruthy();await page.reload();await expect(page.getByRole('switch').first()).toHaveAttribute('aria-checked','true');
  await page.goto('/faq');const question=page.getByRole('button',{name:/SHIFT совместим с Easy Anti-Cheat/});await question.click();await expect(question).toHaveAttribute('aria-expanded','true');await expect(page.getByText(/гарантировать совместимость/)).toBeVisible();expect(errors).toEqual([]);
});
