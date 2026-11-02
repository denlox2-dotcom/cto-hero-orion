import { registerPlayer } from '../helpers/registration';
import { test, expect } from '@playwright/test';
import { completeBoothRoute, completeKeyboardRoute, snapshot, moveTo, jumpTo } from './keyboard-route';

test('registered players choose difficulty and always include the production room', async ({ page }) => {
  await page.goto('/');await registerPlayer(page);
  await expect(page.getByRole('radiogroup',{name:'Режим игры'})).toHaveCount(0);
  await expect(page.getByRole('radio',{name:'Сложная',exact:true})).toBeVisible();
  await expect(page.getByTestId('token-production')).not.toContainText('Не входит в режим');
  await page.getByRole('button',{name:'Начать смену'}).click();
  const run = (await snapshot(page)).run;
  expect(run).not.toHaveProperty('mode');
  expect(run.difficulty).toBe('easy');
});

test('booth difficulty completes all four rooms with real keyboard input', async ({ page }) => {
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await registerPlayer(page);
  await expect(page.getByRole('radio',{name:'Легкая',exact:true})).toHaveAttribute('aria-checked','true');
  await completeBoothRoute(page);
  await expect(page.getByText('RELEASE!',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({path: test.info().outputPath('screenshots', 'booth-victory.png'),fullPage:true});
});

test('difficulty is keyboard accessible and preserved on restart', async ({ page }) => {
  await page.goto('/');await registerPlayer(page);
  await page.getByRole('radio',{name:'Легкая',exact:true}).focus();
  await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio',{name:'Сложная',exact:true})).toHaveAttribute('aria-checked','true');
  await page.getByRole('button',{name:'Начать смену'}).click();
  await page.waitForFunction(()=>(window as any).__uptime?.room?.status==='playing');
  let s=await snapshot(page);
  expect(s.run).toMatchObject({difficulty:'hardcore'});
  expect(s.run).not.toHaveProperty('mode');
  expect(s.room.actors.filter((a:any)=>a.kind==='incident')).toHaveLength(3);
  expect(s.room.actors.filter((a:any)=>a.kind==='fire')).toHaveLength(3);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Начать заново'}).click();
  s=await snapshot(page);expect(s.run).toMatchObject({difficulty:'hardcore'});
  expect(s.run.results).toEqual([]);
});

for(const [difficulty,label] of [['easy','Легкая'],['standard','Средняя'],['hardcore','Сложная']] as const){
  test(`${difficulty} extinguishes the first fire in under one second`,async({page})=>{
    await page.goto('/');await registerPlayer(page);await page.getByRole('radio',{name:label,exact:true}).click();
    await page.getByRole('button',{name:'Начать смену'}).click();
    await page.waitForFunction(()=>(window as any).__uptime?.room?.status==='playing');
    await moveTo(page,122);
    const start=(await snapshot(page)).room.remaining;
    await page.keyboard.down('KeyE');
    await page.waitForFunction(()=>(window as any).__uptime.room.actors.find((a:any)=>a.id==='s-f1').active===false,{},{timeout:1100});
    await page.keyboard.up('KeyE');
    const elapsed=start-(await snapshot(page)).room.remaining;
    expect(elapsed).toBeGreaterThan(0.7);expect(elapsed).toBeLessThan(1);
  });
}

test('hardcore rooms remain winnable through normal keyboard controls',async({page})=>{
  await page.goto('/');await registerPlayer(page);await completeKeyboardRoute(page,'hardcore');
  expect((await snapshot(page)).run.difficulty).toBe('hardcore');
});

test('touch pickups work on the first pass with slow rendering',async({page})=>{
  await page.addInitScript(()=>{
    window.requestAnimationFrame=callback=>window.setTimeout(()=>callback(performance.now()),100);
    window.cancelAnimationFrame=id=>clearTimeout(id);
  });
  await page.goto('/');await registerPlayer(page);await page.getByRole('button',{name:'Начать смену'}).click();
  await page.waitForFunction(()=>(window as any).__uptime?.room?.status==='playing');
  await moveTo(page,146);await jumpTo(page,344);
  const s=await snapshot(page);
  expect(s.room.gpu).toBeGreaterThan(12);
  expect(s.room.actors.find((a:any)=>a.id==='s-gpu').active).toBe(false);
  expect(s.run.budget).toBeGreaterThanOrEqual(20);
});
