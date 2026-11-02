import { test, expect, type Page } from '@playwright/test';
import { registerPlayer } from '../helpers/registration';
import { observeResult, activeResultMilliseconds } from '../helpers/presentation';
import { moveTo, snapshot, spray, stomp } from './keyboard-route';

const shots = () => test.info().outputPath('screenshots');
async function start(page: Page, theme = 'k2') {
  await page.goto(`/?theme=${theme}`); await registerPlayer(page);
  await page.getByRole('button', { name: 'Начать смену', exact: true }).click();
  await page.waitForFunction(() => (window as any).__uptime?.room?.status === 'playing');
}
async function fail(page: Page) {
  await page.waitForFunction(() => (window as any).__uptime?.screen === 'result', {}, { timeout: 49000 });
}
async function winServer(page: Page) {
  await moveTo(page, 122); await spray(page); await stomp(page, 's-i1');
  await expect(page.getByRole('heading', { name: 'Модуль получен', exact: true })).toBeVisible();
}
async function waitRoom(page: Page, id: string) {
  await page.waitForFunction(id => (window as any).__uptime?.screen === 'playing' && (window as any).__uptime.room?.room === id, id, { timeout: 7000 });
  await page.waitForFunction(() => (window as any).__uptime.room.status === 'playing');
}

test('failed room can be retried without keeping rewards or its old transition', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page); await moveTo(page, 122); await spray(page);
  await fail(page);
  const failed = await snapshot(page);
  expect(failed.run.budget).toBeGreaterThan(0); expect(failed.run.firesExtinguished).toBe(1);
  const retry = page.getByRole('button', { name: 'Повторить', exact: true });
  await expect(retry).toBeVisible(); await expect(retry).toBeFocused();
  await page.screenshot({ path: `${shots()}/k2-failure-retry.png` });
  // A failed room waits indefinitely; no old transition can consume the retry.
  await expect(page.locator('[data-countdown]')).toHaveCount(0);
  await page.waitForTimeout(6100);
  expect((await snapshot(page)).screen).toBe('result');
  expect((await snapshot(page)).run).toEqual(failed.run);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__uptime?.screen === 'playing' && (window as any).__uptime.room?.status === 'entering');
  const fresh = await snapshot(page);
  expect(fresh.run).toMatchObject({ difficulty: 'easy', budget: 0, firesExtinguished: 0, tokens: [], amulets: [], results: [], pakAssistUsed: false });
  expect(fresh.room).toMatchObject({ room: 'server', remaining: 45, sla: 100, energy: 100, ogn: 0, gpu: 0, pro: 0, wrench: false });
  await expect(page.locator('.journey-step.is-failed')).toHaveCount(0);
  await expect(retry).toHaveCount(0);
  await page.waitForTimeout(5500);
  expect((await snapshot(page)).screen).toBe('playing'); expect((await snapshot(page)).room.room).toBe('server');
  await winServer(page);
  const won = await snapshot(page);
  expect(won.run.results).toHaveLength(1); expect(won.run.results[0].reason).toBe('success');
  expect(won.run.tokens).toEqual(['server']); expect(won.run.firesExtinguished).toBe(1);
  await expect(retry).toHaveCount(0);
  await expect(page.locator('[data-countdown]')).toHaveText('5');
  await page.waitForTimeout(4100); expect((await snapshot(page)).screen).toBe('result');
  await waitRoom(page, 'office'); expect((await snapshot(page)).run.results).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('later room retry preserves previous progress and restores the room entry state', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page, 'aihub'); await winServer(page); await waitRoom(page, 'office');
  const checkpoint = (await snapshot(page)).run;
  await spray(page); await fail(page);
  expect((await snapshot(page)).run.budget).toBeGreaterThan(checkpoint.budget);
  await page.keyboard.press('Escape');
  const frozen = await snapshot(page);
  await page.waitForTimeout(1500); expect(await snapshot(page)).toEqual(frozen);
  await expect(page.locator('[data-countdown]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeFocused();
  await page.screenshot({ path: `${shots()}/aihub-failure-retry.png` });
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await page.waitForFunction(() => (window as any).__uptime.room?.room === 'office' && (window as any).__uptime.room.status === 'entering');
  expect((await snapshot(page)).run).toEqual(checkpoint);
  await expect(page.getByTestId('token-server')).toHaveAttribute('data-earned', 'true');
  await expect(page.locator('.journey-step.is-failed')).toHaveCount(0);
  await expect(page.getByTestId('timer')).toHaveText('00:45');
  await page.waitForTimeout(5500); expect((await snapshot(page)).room.room).toBe('office');
  expect(errors).toEqual([]);
});

test('failed final room shows the actual cause and keeps an already earned module', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.waitForFunction(() => !!(window as any).__uptime);
  await page.evaluate(async () => {
    const { GameUI } = await import('/src/ui/GameUI.ts');
    const { getRooms } = await import('/src/core/rooms.ts');
    const root = document.createElement('div'); root.id = 'result-fixture'; document.body.replaceChildren(root);
    const noop = () => {};
    const ui = new GameUI(root, { start: noop, resume: noop, retryRoom: noop, restart: noop, menu: noop, leaderboard: noop, sound: noop, fullscreen: noop });
    const room = getRooms('hardcore')[3]; ui.showPlaying(room, 3, 'hardcore');
    ui.update({ remaining: 0, sla: 0, energy: 50, ogn: 20, budget: 100, tokens: [], amulets: ['production'], pakPhase: 'idle', objectives: [], gpu: 0, pro: 0, wrench: false, combo: 0, comboRemaining: 0, entering: false });
    ui.showRoomResult({ id: 'production', reason: 'sla', completed: 3, total: 4, remaining: 0, budget: 100 }, room, []);
  });
  await expect(page.getByRole('heading', { name: 'SLA упал до нуля. Модуль сохранён. Босс не побеждён.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeFocused();
  await expect(page.locator('.result-symbol, .result-progress, .result-next, .result-panel .panel-eyebrow')).toHaveCount(0);
  await page.screenshot({ path: `${shots()}/last-room-module-kept.png` });
  expect(errors).toEqual([]);
});
