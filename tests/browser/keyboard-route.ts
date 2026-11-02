import { registerPlayer } from '../helpers/registration';
import { test, expect, type Page } from '@playwright/test';

// Real keyboard input only. The dev snapshot is read-only: no teleportation,
// timer overrides, synthetic objective completions or altered resources.
export const snapshot=(page:Page)=>page.evaluate(()=>(window as any).__uptime);
async function direction(page:Page,dir:number){
  await page.keyboard.up(dir<0?'KeyD':'KeyA');
  if(dir)await page.keyboard.down(dir<0?'KeyA':'KeyD');
  else await page.keyboard.up('KeyD');
}
export async function moveTo(page:Page,x:number,timeout=3500){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    const s=await snapshot(page);if(s.screen!=='playing')break;
    const dx=x-s.room.x;
    if(Math.abs(dx)<7){await direction(page,0);return;}
    await direction(page,Math.sign(dx));await page.waitForTimeout(35);
  }
  await direction(page,0);
  const s=await snapshot(page);expect(Math.abs(s.room.x-x),'walk to '+x+' / '+JSON.stringify(s.room)).toBeLessThan(16);
}
export async function jumpTo(page:Page,x:number){
  await page.waitForFunction(()=>(window as any).__uptime.room.grounded,{},{timeout:2000});
  await page.keyboard.press('Space');
  await moveTo(page,x);
  await page.waitForFunction(()=>(window as any).__uptime.room.grounded,{},{timeout:1800});
}
export async function spray(page:Page,seconds=0.9,facing=1){
  await page.keyboard.down(facing>0?'KeyD':'KeyA');await page.waitForTimeout(20);await page.keyboard.up(facing>0?'KeyD':'KeyA');
  await page.keyboard.down('KeyE');await page.waitForTimeout(seconds*1000);await page.keyboard.up('KeyE');
}
export async function stomp(page:Page,id:string,debt=false){
  const end=Date.now()+6000;
  while(Date.now()<end){
    const s=await snapshot(page),actor=s.room.actors.find((a:any)=>a.id===id);
    if(!actor?.active||(debt&&actor.shell)){await direction(page,0);return;}
    const dx=actor.x-s.room.x;
    await direction(page,Math.abs(dx)>5?Math.sign(dx):0);
    if(Math.abs(dx)<112&&Math.abs(s.room.vy)<5)await page.keyboard.press('Space');
    await page.waitForTimeout(35);
  }
  await direction(page,0);throw new Error('Could not stomp '+id+': '+JSON.stringify(await snapshot(page)));
}
export async function hitBacklog(page:Page,id:string){
  const block=(await snapshot(page)).room.actors.find((actor:any)=>actor.id===id);
  if(!block?.active)return;
  await moveTo(page,block.x);
  await page.waitForFunction(()=>(window as any).__uptime.room.grounded);
  await page.keyboard.press('Space');
  await page.waitForFunction(id=>!(window as any).__uptime.room.actors.find((actor:any)=>actor.id===id).active,id,{timeout:1500});
  await page.waitForFunction(()=>(window as any).__uptime.room.grounded||(window as any).__uptime.screen!=='playing');
}
async function waitRoom(page:Page,id:string,screenshots=test.info().outputPath('screenshots')){
  await page.waitForFunction(id=>(window as any).__uptime?.screen==='playing'&&(window as any).__uptime.room?.room===id,id,{timeout:6000});
  await page.waitForFunction(()=>(window as any).__uptime.room.status==='playing');
  await page.screenshot({path:screenshots+'/room-'+id+'.png',fullPage:true});
}
export async function approachBoothBoss(page:Page){
  // Cross above the central boss from the left step, then collect PRO on its right.
  await moveTo(page,146);await jumpTo(page,300);
  await moveTo(page,367);await jumpTo(page,600);
  await moveTo(page,680);
  expect((await snapshot(page)).room.pro).toBeGreaterThan(25);
}
export async function completeKeyboardRoute(page:Page,difficulty:'standard'|'hardcore'='standard',screenshots=test.info().outputPath('screenshots')){
  await registerPlayer(page);
  const hardcore=difficulty==='hardcore';
  await page.getByRole('radio',{name:hardcore?'Сложная':'Средняя',exact:true}).click();
  await page.getByRole('button',{name:'Начать смену'}).click();
  await waitRoom(page,'server',screenshots);
  await moveTo(page,122);await spray(page);
  if(hardcore){
    await moveTo(page,146);await jumpTo(page,285);await stomp(page,'s-i3');
    await moveTo(page,368);await jumpTo(page,465);await spray(page);
    await moveTo(page,620);
    await page.waitForFunction(()=>(window as any).__uptime.room.grounded);
  }
  await stomp(page,'s-i1');await stomp(page,'s-i2');
  await moveTo(page,628);await jumpTo(page,732);await spray(page);
  await page.waitForFunction(()=>(window as any).__uptime.run.tokens.includes('server'),{},{timeout:2500});
  await waitRoom(page,'office',screenshots);
  await spray(page);await moveTo(page,174);
  await hitBacklog(page,'o-b1');
  await stomp(page,'o-debt',true);
  let s=await snapshot(page);let debt=s.room.actors.find((a:any)=>a.id==='o-debt');
  await moveTo(page,debt.x-58);await page.waitForTimeout(450);
  await moveTo(page,debt.x+30);await page.waitForTimeout(1100);
  for(const id of ['o-i1','o-i2']){
    s=await snapshot(page);if(s.room.actors.find((a:any)=>a.id===id).active)await stomp(page,id);
  }
  if(hardcore){await moveTo(page,540);await spray(page);}
  await moveTo(page,146);await jumpTo(page,334);
  await hitBacklog(page,'o-b2');
  await moveTo(page,368);await jumpTo(page,465);await spray(page);
  await moveTo(page,560);await jumpTo(page,757);
  await hitBacklog(page,'o-b3');
  if(hardcore)await stomp(page,'o-i3');
  await moveTo(page,912);await page.waitForTimeout(400);
  await spray(page,0.9,-1);
  await page.waitForFunction(()=>(window as any).__uptime.run.tokens.includes('office'),{},{timeout:2500});
  await waitRoom(page,'perimeter',screenshots);
  await moveTo(page,126);
  expect((await snapshot(page)).room.wrench).toBe(true);
  await spray(page);
  await moveTo(page,237);await spray(page);
  expect((await snapshot(page)).room.actors.find((a:any)=>a.id==='p-l1').active).toBe(false);
  await moveTo(page,461);await spray(page,hardcore?1.8:0.9);
  if(hardcore)expect((await snapshot(page)).room.actors.find((a:any)=>a.id==='p-l3').active).toBe(false);
  await moveTo(page,146);await jumpTo(page,300);
  if(hardcore)await stomp(page,'p-i1');
  await moveTo(page,368);await jumpTo(page,465);await spray(page);
  await moveTo(page,560);await jumpTo(page,747);await spray(page);
  if(hardcore){await moveTo(page,912);await page.waitForTimeout(400);await spray(page,0.9,-1);}
  await page.waitForFunction(()=>(window as any).__uptime.run.tokens.includes('perimeter'),{},{timeout:2500});
  await waitRoom(page,'production',screenshots);
  await spray(page);
  await moveTo(page,146);await jumpTo(page,300);
  await moveTo(page,367);await jumpTo(page,600);await spray(page);
  // Check the locked pickup on standard; the hardcore route avoids two
  // unnecessary crossings through the debt patrol before dealing with its guard.
  if(!hardcore){
    await moveTo(page,680);
    expect((await snapshot(page)).room.shieldOpen).toBe(false);
    expect((await snapshot(page)).room.pro).toBe(0);
  }
  await moveTo(page,590);await jumpTo(page,hardcore?700:732);
  if(hardcore){
    await stomp(page,'b-i2');
    await moveTo(page,700);
  }
  await spray(page);
  await page.waitForFunction(()=>(window as any).__uptime.room.shieldOpen,{},{timeout:1500});
  // Descend on the open right side and walk below the platform to PRO.
  // The left edge is above the debt shell and can repeatedly bounce the hero.
  await moveTo(page,900);
  await page.waitForFunction(()=>(window as any).__uptime.room.grounded&&(window as any).__uptime.room.y>490,{},{timeout:2000});
  await moveTo(page,680);
  expect((await snapshot(page)).room.pro).toBeGreaterThan(25);
  if(!hardcore){
    await page.waitForTimeout(5250);
    expect((await snapshot(page)).room.pro).toBeGreaterThan(29);
  }
  await spray(page,2.7,-1);
  await page.waitForFunction(()=>(window as any).__uptime.screen==='final',{},{timeout:9000});
  const final=await snapshot(page);
  expect(final.run.tokens,JSON.stringify(final)).toEqual(['server','office','perimeter','production']);
  expect(final.run.amulets).toEqual(['server','office','perimeter','production']);
  expect(final.run.pakAssistUsed).toBe(true);
}

export async function completeBoothRoute(page:Page,screenshots=test.info().outputPath('screenshots')){
  await registerPlayer(page);
  await page.getByRole('button',{name:'Начать смену'}).click();
  await waitRoom(page,'server',screenshots);
  expect((await snapshot(page)).run.difficulty).toBe('easy');
  await moveTo(page,122);await spray(page);
  await stomp(page,'s-i1');
  await waitRoom(page,'office',screenshots);
  await spray(page);await moveTo(page,174);
  await hitBacklog(page,'o-b1');
  expect((await snapshot(page)).room.actors.find((a:any)=>a.id==='o-b1').active).toBe(false);
  await stomp(page,'o-debt',true);
  const debt=(await snapshot(page)).room.actors.find((a:any)=>a.id==='o-debt');
  await moveTo(page,debt.x-58);await page.waitForTimeout(450);
  // The last objective ends this room on contact, so don't wait for a further position.
  await page.keyboard.down('KeyD');
  await page.waitForFunction(()=>(window as any).__uptime.screen==='result',{},{timeout:2000});
  await page.keyboard.up('KeyD');
  await waitRoom(page,'perimeter',screenshots);
  await moveTo(page,126);
  expect((await snapshot(page)).room.wrench).toBe(true);
  await spray(page);await moveTo(page,237);await spray(page);
  await waitRoom(page,'production',screenshots);
  expect((await snapshot(page)).room.wrench).toBe(false);
  await spray(page);
  expect((await snapshot(page)).room.shieldOpen).toBe(true);
  await approachBoothBoss(page);await spray(page,2.7,-1);
  await page.waitForFunction(()=>(window as any).__uptime.screen==='final',{},{timeout:9000});
  expect((await snapshot(page)).run.tokens).toHaveLength(4);
}
