import { registerPlayer } from '../helpers/registration';
import { test,expect } from '@playwright/test';
import { snapshot,moveTo,jumpTo } from './keyboard-route';

async function start(page:import('@playwright/test').Page){
  await page.goto('/');await registerPlayer(page);await page.getByRole('button',{name:'Начать смену'}).click();
  await page.waitForFunction(()=>(window as any).__uptime?.room?.status==='playing');
}
test('GPU is collected by touching it without pressing E',async({page})=>{
  await start(page);await moveTo(page,146);
  const gpuX=(await snapshot(page)).room.actors.find((a:any)=>a.kind==='gpu').x;
  await jumpTo(page,gpuX);
  expect((await snapshot(page)).room.gpu).toBeGreaterThan(13);
  expect((await snapshot(page)).room.actors.find((a:any)=>a.id==='s-gpu').active).toBe(false);
});
test('coffee is collected on the first touch even at full energy, then returns',async({page})=>{
  await start(page);await moveTo(page,34);
  expect((await snapshot(page)).room.energy).toBe(100);
  expect((await snapshot(page)).room.actors.find((a:any)=>a.kind==='coffee').active).toBe(false);
  await moveTo(page,110);
  await page.keyboard.down('KeyE');await page.waitForTimeout(5200);await page.keyboard.up('KeyE');
  expect((await snapshot(page)).room.energy).toBeLessThan(80);
  expect((await snapshot(page)).room.actors.find((a:any)=>a.kind==='coffee').active).toBe(true);
  await moveTo(page,34);
  expect((await snapshot(page)).room.energy).toBe(100);
  expect((await snapshot(page)).room.actors.find((a:any)=>a.kind==='coffee').active).toBe(false);
});
test('the edge of a flame is forgiving but its core still damages the player',async({page})=>{
  await start(page);
  await page.keyboard.down('KeyD');
  await page.waitForFunction(()=>(window as any).__uptime.room.x>=147);
  await page.keyboard.up('KeyD');
  const edge=await snapshot(page);
  expect(edge.room.x).toBeLessThan(156.4);
  await page.waitForTimeout(450);
  expect((await snapshot(page)).room.sla).toBe(100);
  await moveTo(page,181);await page.waitForTimeout(120);
  expect((await snapshot(page)).room.sla).toBe(96);
});
