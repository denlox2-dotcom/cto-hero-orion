import { openRegistration } from '../helpers/registration';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { completeBoothRoute } from './keyboard-route';

const payload = (name: string, difficulty = 'easy') => ({
  id: randomUUID(), difficulty, budget: 1234,
  player: { firstName: name, company: 'Компания <b>Тест</b>', lastName: 'СекретнаяФамилия', contact: '@hidden_contact', consentVersion: 'draft-2026-09-26', consentAcceptedAt: new Date().toISOString() },
  results: ['server', 'office', 'perimeter', 'production'].map(id => ({ id, reason: 'success' })),
});

test('menu opens a shared leaderboard, safely renders names and preserves the contact form', async ({ page, browser, request }) => {
  const first = payload('Общий <img src=x onerror=alert(1)>');
  expect((await request.post('/api/runs', { data: first })).ok()).toBe(true);
  await page.goto('/');
  await openRegistration(page);
  await page.getByLabel('Фамилия', { exact: true }).fill('Черновик');
  await page.getByRole('button', { name: 'Таблица лидеров', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Таблица лидеров' });
  await expect(dialog.getByRole('cell', { name: first.player.firstName, exact: true })).toBeVisible();
  await expect(dialog.locator('tbody img, tbody b')).toHaveCount(0);
  await expect(dialog).not.toContainText('СекретнаяФамилия');
  await expect(dialog).not.toContainText('hidden_contact');
  const response = await request.get('/api/leaderboard?difficulty=easy');
  expect(await response.text()).not.toMatch(/lastName|contact|consent|СекретнаяФамилия/);
  const context = await browser.newContext(); const other = await context.newPage();
  await other.goto(page.url());
  await other.getByRole('button', { name: 'Таблица лидеров', exact: true }).click();
  await expect(other.getByRole('cell', { name: first.player.firstName, exact: true })).toBeVisible();
  await context.close();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel('Фамилия', { exact: true })).toHaveValue('Черновик');
});

test('leaderboard handles unavailable API and retries without leaving the menu', async ({ page }) => {
  await page.route('**/api/leaderboard?*', route => route.fulfill({ status: 503, json: { error: 'Недоступно' } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Таблица лидеров', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Таблица лидеров' }).getByRole('status')).toContainText('Не удалось загрузить');
  await page.unroute('**/api/leaderboard?*');
  await page.getByRole('dialog', { name: 'Таблица лидеров' }).getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByRole('dialog', { name: 'Таблица лидеров' }).getByRole('status')).toContainText('Ранов в рейтинге:');
});

test('completed run shows passport and saves; leaderboard retries and reopens without duplicate', async ({ page, request }) => {
  let fail = true;
  let submissions = 0;
  await page.route('**/api/runs', route => {
    submissions++;
    return fail ? route.fulfill({ status: 503, json: { error: 'Недоступно' } }) : route.continue();
  });
  await page.goto('/');
  await completeBoothRoute(page);
  await expect(page.locator('.passport')).toBeVisible();
  await expect(page.locator('.passport-save-status')).toContainText('Результат пока не сохранён');
  await expect(page.locator('[data-passport-fires]')).toHaveText('04');
  await expect(page.locator('[data-passport-prod]')).toHaveText('01');
  await expect(page.locator('.passport-badge[data-earned="true"]')).toHaveCount(4);
  const dialog = page.getByRole('dialog', { name: 'Таблица лидеров' });
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Перейти к лидерборду' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.leaderboard-status')).toContainText('Результат пока не сохранён');
  fail = false;
  await page.getByRole('dialog', { name: 'Таблица лидеров' }).getByRole('button', { name: 'Повторить' }).click();
  await expect(page.locator('.leaderboard-status')).toContainText('Результат сохранён');
  await expect(page.locator('.leaderboard-row.is-current')).toContainText('Участник');
  const id = await page.locator('.leaderboard-row.is-current').getAttribute('data-run-id');
  const before = await (await request.get('/api/leaderboard?difficulty=easy')).json();
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await expect(page.locator('.leaderboard-status')).toContainText('Результат сохранён');
  const after = await (await request.get('/api/leaderboard?difficulty=easy')).json();
  expect(after.total).toBe(before.total);
  expect(after.entries.filter((row: any) => row.id === id)).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.passport-save-status')).toContainText('Результат сохранён');
  await page.getByRole('button', { name: 'Перейти к лидерборду' }).click();
  await expect(page.locator('.leaderboard-row.is-current')).toHaveAttribute('data-run-id', id!);
  expect(submissions).toBe(2);
  await page.getByRole('button', { name: 'Закрыть ×' }).click();
  for (const theme of ['k2', 'aihub']) {
    await page.evaluate(theme => { history.replaceState(null, '', `/?theme=${theme}`); window.dispatchEvent(new PopStateEvent('popstate')); }, theme);
    for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      for (const selector of ['.passport-header', '.passport-summary', '.passport-badges', '.passport-metrics', '.passport-footer']) {
        const box = (await page.locator(selector).boundingBox())!;
        const stage = (await page.locator('.game-stage').boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(stage.y);
        expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height);
      }
      await page.screenshot({ path: test.info().outputPath('screenshots', `${theme}-victory-${size.width}.png`) });
    }
  }
  await page.getByRole('button', { name: 'Ещё одна смена', exact: true }).click();
  await expect(page.getByTestId('room-title')).toHaveText('Серверная');
  expect(await page.evaluate(() => (window as any).__uptime.run.firesExtinguished)).toBe(0);
});

for (const theme of ['k2', 'aihub']) test(`${theme} leaderboard fits both stand sizes and switches difficulty`, async ({ page, request }) => {
  const row = payload(`Игрок ${theme}`, 'hardcore'); await request.post('/api/runs', { data: row });
  for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size); await page.goto(`/?theme=${theme}`);
    await page.getByRole('button', { name: 'Таблица лидеров', exact: true }).click();
    await page.getByRole('dialog', { name: 'Таблица лидеров' }).getByRole('button', { name: 'Сложная', exact: true }).click();
    await expect(page.getByRole('cell', { name: row.player.firstName, exact: true })).toBeVisible();
    const box = (await page.locator('.leaderboard-dialog').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width); expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    expect(await page.locator('.leaderboard-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('screenshots', `leaderboard-${theme}-menu-${size.width}.png`) });
  }
});
