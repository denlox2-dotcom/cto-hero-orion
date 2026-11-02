import { registerPlayer } from '../helpers/registration';
import { test, expect } from '@playwright/test';
test('visual review at desktop and stand resolutions',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const size of [{width:1280,height:720},{width:1920,height:1080}]){
    await page.setViewportSize(size);await page.goto('/');await registerPlayer(page);
    await expect(page.getByRole('button',{name:'Начать смену'})).toBeVisible();
    await page.waitForTimeout(900);
    expect(await page.evaluate(()=>(window as any).__uptime.room.actors.some((a:any)=>a.kind==='fire'&&a.x>500))).toBe(true);
    for(const selector of ['.menu-panel','.start-button','.difficulty-switch','.difficulty-description']){
      const box=await page.locator(selector).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y+box!.height).toBeLessThanOrEqual(size.height);
    }
    await page.screenshot({path: test.info().outputPath('screenshots', `menu-${size.width}.png`),fullPage:true});
    await page.getByRole('button',{name:'Начать смену'}).click();await page.waitForTimeout(1300);
    const canvas=await page.locator('canvas').boundingBox();
    expect(canvas).not.toBeNull();
    expect(canvas!.x).toBeGreaterThanOrEqual(0);
    expect(canvas!.y).toBeGreaterThanOrEqual(0);
    expect(canvas!.x+canvas!.width).toBeLessThanOrEqual(size.width+1);
    expect(canvas!.y+canvas!.height).toBeLessThanOrEqual(size.height+1);
    await page.screenshot({path: test.info().outputPath('screenshots', `server-${size.width}.png`),fullPage:true});
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading',{name:'Смена на паузе'})).toBeVisible();
    await page.screenshot({path: test.info().outputPath('screenshots', `pause-${size.width}.png`),fullPage:true});
  }
  expect(errors).toEqual([]);
});
