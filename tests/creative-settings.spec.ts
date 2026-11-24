import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function finish(page: Page) {
  const d=page.getByRole('dialog'); await expect(d).toBeVisible({timeout:30000});
  await d.getByRole('button',{name:'Продолжить'}).click();
  await d.getByRole('button',{name:'Продолжить'}).click();
  await d.getByRole('checkbox').check();
  await d.getByRole('button',{name:'Продолжить'}).click();
  await d.getByRole('button',{name:'Войти в SHIFT'}).click();
  await expect(d).toBeHidden({timeout:20000});
}
async function chooseGpu(page:Page, name:string) {
  await page.getByRole('button',{name:'Видеокарта (GPU)'}).click();
  const d=page.getByRole('dialog',{name:'Видеокарта (GPU)'});
  await d.getByRole('textbox').fill(name);
  await d.getByRole('button',{name:new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).first().click();
}
test('hero foreground, echo collapse and light sculptures',async({page})=>{
  test.setTimeout(120000); const errors:string[]=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('/'); await finish(page);
  const front=page.locator('.hero-foreground'); await expect(front).toBeVisible();
  expect(await front.evaluate(el=>({z:getComputedStyle(el).zIndex,pointer:getComputedStyle(el).pointerEvents}))).toEqual({z:'5',pointer:'none'});
  await expect(page.locator('.title-echo')).toHaveCount(4);
  const phases=await page.locator('.stage-word').evaluate(el=>{
    const pour=el.querySelector<HTMLElement>('.title-pour')!;
    const anim=pour.getAnimations().find(a=>a instanceof CSSAnimation && a.animationName==='title-collapse')!;
    const echo=el.querySelector<HTMLElement>('.title-echo')!;
    const echoAnim=echo.getAnimations().find(a=>a instanceof CSSAnimation && a.animationName==='logo-echo')!;
    anim.pause(); echoAnim.pause(); anim.currentTime=0; echoAnim.currentTime=1300;
    const expanded=pour.getBoundingClientRect().width, displaced=new DOMMatrixReadOnly(getComputedStyle(echo).transform).m42;
    anim.currentTime=2600; const phase2=pour.getBoundingClientRect().width;
    anim.currentTime=4000; echoAnim.currentTime=2600; const end=pour.getBoundingClientRect().width;
    return {expanded,displaced,phase2,end,echoEnd:Number(getComputedStyle(echo).opacity)};
  });
  expect(phases.expanded).toBeGreaterThan(10); expect(phases.displaced).toBeLessThan(-20); expect(phases.phase2).toBeGreaterThan(10); expect(phases.end).toBeLessThan(1); expect(phases.echoEnd).toBe(0);
  await expect(page.getByRole('button',{name:'Скачать',exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Следующая сцена'}).click();
  const canvas=page.locator('[data-scene="cinematic"] canvas'); await expect(canvas).toHaveAttribute('data-form','obsidian-prisms');
  await page.waitForTimeout(1000);
  await expect(front).toBeHidden(); await page.getByRole('button',{name:'Следующая сцена'}).click();
  await expect(canvas).toHaveAttribute('data-form','obsidian-geodesic');
  expect(errors).toEqual([]);
});
test('GPU selection, texture rules, full Rust menu and cfg agree',async({page})=>{
  test.setTimeout(120000); await page.goto('/benchmark'); await finish(page);
  const ram=page.locator('.rig-slot').filter({hasText:'03 / RAM'}); await expect(ram).not.toContainText(/CL\s*\d/i); await expect(ram).toContainText(/DDR[45].*MT\/s/);
  await ram.getByRole('button',{name:'Оперативная память'}).click(); await expect(page.getByRole('dialog',{name:'Оперативная память'})).not.toContainText(/\bCL\s*\d/i); await page.getByRole('button',{name:'Закрыть'}).click();
  await chooseGpu(page,'GeForce GTX 1060 6GB'); await expect(page.locator('.rig-numbers')).toContainText('1/8');
  await page.getByRole('link',{name:/Пресеты/i}).first().click();
  const grid=page.locator('.rust-settings-grid'); await expect(grid.locator('article')).toHaveCount(4);
  await expect(grid).toContainText('1/8'); const code=page.locator('.code-panel pre'); await expect(code).toContainText('graphics.texturequality "3"'); await expect(code).toContainText('graphicssettings.globaltexturemipmaplimit "3"');
  const expected=['graphics.renderscale "1"','graphics.dlss "-1"','graphics.dlaa "0"','graphics.reflexmode "1"','graphics.reflexlatencymarker "False"','graphicssettings.pixellightcount "0"','graphicssettings.particleraycastbudget "4"','graphicssettings.softparticles "False"','graphics.volumetric_clouds "0"','ui.showinventoryplayer "True"','ui.inventoryplayerquality "0"','graphics.drawdistance "1500"','water.reflections "0"','water.quality "0"','grass.displacement "True"','graphicssettings.billboardsfacecameraposition "False"','graphicssettings.anisotropicfiltering "1"','graphics.af "8"','graphics.parallax "0"','graphics.shadowquality "0"','graphics.shadowlights "1"','decor.quality "25"','grass.quality "0"','terrain.quality "25"','tree.meshes "25"','tree.quality "100"','mesh.quality "50"','graphics.lodbias "1"','particle.quality "25"'];
  for(const line of expected) await expect(code).toContainText(line);
  const downloadPromise=page.waitForEvent('download'); await page.getByRole('button',{name:'Скачать .cfg ↓'}).click(); const downloaded=await downloadPromise;
  expect(await readFile((await downloaded.path())!, 'utf8')).toContain('graphics.texturequality "3"');
  await page.locator('.original-config summary').click(); await page.getByRole('textbox',{name:'Содержимое исходного client.cfg'}).fill('bind k kill\ngraphics.texturequality "0"\n');
  await expect(code).toContainText('bind k kill'); await expect(code).toContainText('graphics.texturequality "3"');
  await chooseGpu(page,'GeForce RTX 3060 Ti'); await expect(grid).toContainText('1/4'); await expect(code).toContainText('graphics.texturequality "2"');
  await page.getByRole('button',{name:'Видеокарта (GPU)'}).click(); const gpuDialog=page.getByRole('dialog',{name:'Видеокарта (GPU)'}); await gpuDialog.getByRole('textbox').fill('GeForce RTX 3060'); await gpuDialog.getByRole('button',{name:'NVIDIA GeForce GeForce RTX 3060 ↗',exact:true}).click(); await expect(page.locator('.rust-settings-note')).toContainText('12 ГБ'); await expect(grid).toContainText('1/4'); await expect(code).toContainText('graphics.texturequality "2"');
  await chooseGpu(page,'Radeon RX 6800'); await expect(grid).toContainText('1/2'); await expect(code).toContainText('graphics.texturequality "1"'); await expect(code).not.toContainText('graphics.reflexmode');
  await page.getByRole('button',{name:/ULTRA CLARITY/}).click(); await expect(grid).toContainText('Full'); await expect(code).toContainText('graphics.texturequality "0"');
  await page.getByRole('button',{name:'EN',exact:true}).click(); await expect(grid).toContainText('Texture Quality'); await expect(grid).toContainText('Inventory Player Model Quality'); for (const name of ['Render Scale','NVIDIA DLSS','NVIDIA DLAA','NVIDIA Reflex Mode','NVIDIA Reflex Latency Marker','Pixel Light Count','Particle Raycast Budget','Soft Particles','Volumetric Clouds','Inventory Player Model','Draw Distance','Water Reflections','Water Quality','Grass Displacement','Precise Terrain Billboards','Anisotropic Filtering Mode','Anisotropic Filtering Level','Parallax Mapping','Shadow Quality','Max Shadow Lights','Decor Quality','Grass Quality','Terrain Quality','Max Tree Meshes','Tree Quality','Object Quality','LOD Bias','Particle Quality']) await expect(grid).toContainText(name);
});
