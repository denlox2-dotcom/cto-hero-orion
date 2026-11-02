import { test, expect } from '@playwright/test';
import { registerPlayer } from '../helpers/registration';
import { approachBoothBoss, hitBacklog, moveTo, snapshot, spray, stomp } from './keyboard-route';

const shots = () => test.info().outputPath('screenshots');
async function waitRoom(page: import('@playwright/test').Page, id: string) {
  await page.waitForFunction(id => {
    const s = (window as any).__uptime;
    return s?.screen === 'playing' && s.room.room === id && s.room.status === 'playing';
  }, id, { timeout: 6000 });
}

test('HUD shows four module sockets and an empty chassis on a fresh run', async ({ page }) => {
  await page.goto('/'); await registerPlayer(page);
  await page.getByRole('button', { name: 'Начать смену' }).click();
  await expect(page.locator('.pak-assembly')).toContainText('0/4');
  await expect(page.locator('[data-amulet-slot]')).toHaveCount(4);
  await expect(page.locator('[data-amulet-slot][data-earned="true"]')).toHaveCount(0);
  await expect(page.locator('.pak-rack')).toBeVisible();
});

for (const theme of ['k2', 'aihub']) {
test(`${theme} keyboard run assembles PAK, pauses its fall, wins once, and resets`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/?theme=${theme}`); await registerPlayer(page);
  await page.getByRole('button', { name: 'Начать смену' }).click();
  await waitRoom(page, 'server'); await moveTo(page, 122); await spray(page); await stomp(page, 's-i1');
  await expect(page.locator('.pak-assembly')).toContainText('1/4');
  await waitRoom(page, 'office'); await spray(page); await hitBacklog(page, 'o-b1'); await stomp(page, 'o-debt', true);
  const debt = (await snapshot(page)).room.actors.find((a: any) => a.id === 'o-debt');
  await moveTo(page, debt.x - 58); await page.waitForTimeout(450); await page.keyboard.down('KeyD');
  await page.waitForFunction(() => (window as any).__uptime.screen === 'result', {}, { timeout: 2000 });
  await page.keyboard.up('KeyD'); await expect(page.locator('.pak-assembly')).toContainText('2/4');
  await waitRoom(page, 'perimeter'); await moveTo(page, 126); await spray(page); await moveTo(page, 237); await spray(page);
  await waitRoom(page, 'production');
  await expect(page.locator('.pak-assembly')).toContainText('3/4');
  await page.screenshot({ path: shots() + `/${theme}-hud-three.png`, fullPage: true });
  await spray(page);
  await expect(page.locator('.pak-assembly')).toContainText('4/4');
  expect((await snapshot(page)).run.tokens).toHaveLength(3);
  expect((await snapshot(page)).run.results).toHaveLength(3);
  await page.screenshot({ path: shots() + `/${theme}-pak-ready.png`, fullPage: true });
  await approachBoothBoss(page);
  const boss = (await snapshot(page)).room.actors.find((actor: any) => actor.kind === 'boss');
  expect(boss.x).toBe(480);
  await page.keyboard.down('KeyA'); await page.waitForTimeout(20); await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => (window as any).__uptime.room.pak.phase === 'warning', {}, { timeout: 2000 });
  expect((await snapshot(page)).room.pak.x).toBe(480);
  await page.screenshot({ path: shots() + `/${theme}-pak-call.png`, fullPage: true });
  await page.waitForFunction(() => (window as any).__uptime.room.pak.phase === 'falling', {}, { timeout: 2500 });
  await page.keyboard.up('KeyE');
  await page.waitForTimeout(100);
  const canvas = await page.locator('#game-canvas canvas').boundingBox();
  const hud = await page.locator('.mission-row').boundingBox();
  const emergence = await snapshot(page);
  expect(emergence.room.pak.x).toBe(480);
  const rackBottom = canvas!.y + emergence.room.pak.y / 540 * canvas!.height;
  expect(rackBottom, 'PAK must emerge inside the visible field below the opaque HUD').toBeGreaterThan(hud!.y + hud!.height + 30);
  await page.screenshot({ path: shots() + `/${theme}-pak-cloud.png`, fullPage: true });
  await page.waitForTimeout(450);
  await page.screenshot({ path: shots() + `/${theme}-pak-falling.png`, fullPage: true });
  // Losing focus exercises the same auto-pause used when the stand tab is hidden.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect((await snapshot(page)).paused).toBe(true);
  const frozen = (await snapshot(page)).room;
  await page.waitForTimeout(1100);
  const paused = (await snapshot(page)).room;
  expect(paused.pak.y).toBe(frozen.pak.y);
  expect(paused.pak.x).toBe(480);
  expect(paused.remaining).toBe(frozen.remaining);
  expect(paused.pak.phase).toBe('falling');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__uptime.room.pak.phase === 'impact', {}, { timeout: 2000 });
  expect((await snapshot(page)).room.pak).toMatchObject({x:480,y:508});
  await page.screenshot({ path: shots() + `/${theme}-pak-impact.png`, fullPage: true });
  await page.waitForFunction(() => (window as any).__uptime.screen === 'final', {}, { timeout: 9000 });
  const final = await snapshot(page);
  expect(final.run.amulets).toEqual(['server', 'office', 'perimeter', 'production']);
  expect(final.run.pakAssistUsed).toBe(true);
  expect(final.run.tokens).toHaveLength(4);
  expect(final.run.results).toHaveLength(4);
  expect(final.run.results[3].completed).toBe(final.run.results[3].total);
  await expect(page.getByText('RELEASE!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Перейти к лидерборду' }).click();
  await expect(page.locator('.leaderboard-row.is-current')).toContainText('4/4');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ещё одна смена' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pak-assembly')).toContainText('0/4');
  expect((await snapshot(page)).run).toMatchObject({ amulets: [], pakAssistUsed: false, results: [] });
  expect(errors).toEqual([]);
});
}

for (const theme of ['k2', 'aihub']) {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    test(`HUD component fits ${theme} at ${viewport.width} with all effects and assembly states`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/?theme=${theme}`);
      await page.waitForFunction(() => !!(window as any).__uptime);
      // Exercise the public UI component with fixture data, independently of gameplay.
      await page.evaluate(async () => {
        const { GameUI } = await import('/src/ui/GameUI.ts');
        const { getRooms } = await import('/src/core/rooms.ts');
        const root = document.createElement('div'); root.id = 'fixture';
        document.body.replaceChildren(root);
        const noop = () => {};
        const ui = new GameUI(root, { start: noop, resume: noop, restart: noop, retryRoom: noop, menu: noop, leaderboard: noop, sound: noop, fullscreen: noop });
        ui.showPlaying(getRooms('hardcore')[1], 1, 'hardcore');
        (window as any).__renderPakFixture = (count: number) => ui.update({
          remaining: 40, sla: 100, energy: 100, ogn: 10, budget: 1200, tokens: ['server', 'office', 'perimeter'].slice(0, Math.min(count, 3)),
          amulets: ['server', 'office', 'perimeter', 'production'].slice(0, count), pakPhase: 'idle',
          objectives: [{ kind: 'incident', done: 0, total: 3 }, { kind: 'debt', done: 0, total: 1 }, { kind: 'backlog', done: 0, total: 3 }, { kind: 'fire', done: 0, total: 4 }],
          gpu: 12, pro: 28, wrench: true, combo: 3, comboRemaining: 2, entering: false,
        });
      });
      for (let count = 0; count <= 4; count++) {
        await page.evaluate(count => (window as any).__renderPakFixture(count), count);
        await expect(page.locator('.pak-assembly')).toContainText(`${count}/4`);
        await expect(page.locator('[data-amulet-slot][data-earned="true"]')).toHaveCount(count);
        await expect(page.locator('.pak-assembly')).toHaveAttribute('data-ready', String(count === 4));
      }
      await page.waitForTimeout(850);
      const objectives = await page.locator('.objectives').boundingBox();
      const assembly = await page.locator('.pak-assembly').boundingBox();
      const status = await page.locator('.mission-status').boundingBox();
      expect(objectives!.x + objectives!.width).toBeLessThanOrEqual(assembly!.x);
      expect(assembly!.x + assembly!.width).toBeLessThanOrEqual(status!.x);
      expect(await page.locator('.pak-assembly img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
      await page.screenshot({ path: shots() + `/hud-${theme}-${viewport.width}.png`, fullPage: true });
    });
  }
}
