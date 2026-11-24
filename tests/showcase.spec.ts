import { test, expect } from '@playwright/test';

test('first visit has three sculptures and consent; subsequent reload skips setup', async ({page}) => {
  test.setTimeout(120000); const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible({timeout:30000});
  await expect(dialog).toContainText('Шаг 1 / 3'); const canvas=page.locator('[data-scene="core"] canvas');
  await expect(canvas).toHaveAttribute('data-setup-form','orbit-sphere',{timeout:30000});
  await dialog.getByRole('button',{name:'Продолжить'}).click();await expect(canvas).toHaveAttribute('data-setup-form','titanium-torus-knot');
  await dialog.getByRole('button',{name:'English'}).click();await expect(dialog.getByRole('heading',{name:'Choose a language'})).toBeVisible();
  await dialog.getByRole('button',{name:'Continue'}).click();await expect(canvas).toHaveAttribute('data-setup-form','crystal-shield');
  await expect(dialog.getByRole('button',{name:'Enter SHIFT'})).toBeDisabled();
  await dialog.getByRole('checkbox').check();await expect.poll(async()=>Number(await canvas.getAttribute('data-facet-gap'))).toBeLessThan(1.03);
  await dialog.getByRole('button',{name:'Enter SHIFT'}).click();await expect(dialog).toBeHidden({timeout:30000});
  expect(await page.evaluate(()=>localStorage.getItem('shift_web_device_onboarded'))).toBe('true');
  await expect(page.locator('.title-echo')).toHaveCount(4); await expect(page.getByRole('navigation',{name:'Sections'}).getByRole('link')).toHaveCount(4);
  await page.reload(); await expect(page.getByRole('heading',{name:'SHIFT.'})).toBeVisible(); await expect(dialog).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  expect(errors).toEqual([]);
});

test('four translated scenes, menu navigation, FAQ and removed routes',async({page,request})=>{
  test.setTimeout(120000);await page.addInitScript(()=>localStorage.setItem('shift_web_device_onboarded','true')); await page.goto('/');
  const nav=page.getByRole('navigation',{name:'Разделы'});const items=nav.getByRole('link');await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText('О нас');await expect(items.nth(1)).toContainText('О нашем проекте');await expect(items.nth(2)).toContainText('О приложении');await expect(items.nth(3)).toContainText('FAQ и мифы');
  await items.nth(1).click(); await expect(page.locator('.home-deck')).toHaveAttribute('data-slide','1'); await expect(page.getByText(/Пиковый FPS в пустом поле/)).toBeVisible();

  await items.nth(2).click(); await expect(page.getByText(/Отдельное десктопное направление/)).toBeVisible();
  await items.nth(3).click();await expect(page.getByRole('button',{name:/За любые оптимизаторы/})).toBeVisible();
  const question=page.getByRole('button',{name:/За любые оптимизаторы/});await question.click();await expect(question).toHaveAttribute('aria-expanded','true');await expect(page.getByText(/Гарантировать совместимость/)).toBeVisible();
  await page.getByRole('button',{name:'EN',exact:true}).first().click();const english=page.getByRole('navigation',{name:'Sections'});await expect(english.getByRole('link')).toHaveCount(4);await expect(english.getByRole('link').nth(1)).toContainText('About Our Project');await expect(page.getByRole('button',{name:/Does EAC ban/})).toBeVisible();
  await english.getByRole('link').nth(0).click();await expect(page.getByText(/independent team of system engineers/)).toBeVisible();
  for(const path of ['/benchmark','/presets','/tweaker','/faq','/tools']) expect((await request.get(path)).status()).toBe(404);
});

test('keyboard and wheel navigate; reduced motion retains immediate setup state',async({page})=>{
  test.setTimeout(90000);await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>localStorage.setItem('shift_web_device_onboarded','true'));await page.goto('/');
  await expect(page.getByRole('heading',{name:'SHIFT.'})).toBeVisible({timeout:30000}); await expect(page.locator('.home-deck')).toHaveAttribute('data-slide','0');await page.keyboard.press('ArrowDown');await expect(page.locator('.home-deck')).toHaveAttribute('data-slide','1');
  await page.keyboard.press('ArrowDown');await expect(page.locator('.home-deck')).toHaveAttribute('data-slide','2');
});

test('wheel and touch gestures change scenes without document scrolling', async ({page},info)=>{
  test.setTimeout(90000); await page.addInitScript(()=>localStorage.setItem('shift_web_device_onboarded','true')); await page.goto('/');
  const deck=page.locator('.home-deck'); await expect(deck).toHaveAttribute('data-slide','0');
  if(info.project.name==='touch') {
    await page.evaluate(()=>{
      const target=document.querySelector('.home-hero')!;
      const finger=(y:number)=>new Touch({identifier:7,target,clientX:10,clientY:y});
      target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[finger(500)],changedTouches:[finger(500)]}));
      target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[finger(350)]}));
    });
  } else { await page.mouse.move(1000,120); await page.mouse.wheel(0,180); }
  await expect(deck).toHaveAttribute('data-slide','1');
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
});

test('scene content and FAQ span the available width and menu labels do not wrap', async ({page},info) => {
  await page.addInitScript(() => localStorage.setItem('shift_web_device_onboarded','true'));
  await page.goto('/');
  const nav=page.getByRole('navigation',{name:'Разделы'});
  await expect(nav.getByRole('link')).toHaveCount(4);
  for (const language of ['RU', 'EN']) {
    await page.getByRole('button',{name:language,exact:true}).first().click();
    for (const label of await page.locator('.chapter-nav a b').all()) {
      expect(await label.evaluate(el => getComputedStyle(el).whiteSpace)).toBe('nowrap');
      expect(await label.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
    }
    await page.locator('.chapter-nav a').first().click();
    const hero=await page.locator('.showcase-hero-copy').boundingBox();
    expect(hero).not.toBeNull();
    expect(page.viewportSize()!.width-(hero!.x+hero!.width)).toBeLessThanOrEqual(info.project.name==='touch'?21:65);
    for (let i=1;i<4;i++) {
      await page.locator('.chapter-nav a').nth(i).click();
      const content=page.locator(`#scene-${i+1} .showcase-content`);
      const bounds=await content.boundingBox(); expect(bounds).not.toBeNull();
      const right=page.viewportSize()!.width-(bounds!.x+bounds!.width);
      expect(right).toBeLessThanOrEqual(info.project.name==='touch'?21:65);
      if(i===3) {
        for(const selector of ['.showcase-faq-list','.faq-question','.showcase-footer']) {
          const box=await page.locator(selector).first().boundingBox();
          expect(box).not.toBeNull();expect(Math.abs(box!.width-bounds!.width)).toBeLessThan(2);
        }
      }
    }
  }
});
