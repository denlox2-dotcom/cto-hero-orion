import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const staffKey = 'synthetic-browser-admin-key-1234567890';
async function seed(request: any, name: string) {
  const run = { id: randomUUID(), passportToken: randomUUID(), difficulty: 'easy', budget: 820,
    player: { firstName: name, lastName: 'Тестовый', company: 'Тестовый стенд', contact: '@test_contact', consentVersion: 'draft', consentAcceptedAt: new Date().toISOString() },
    results: ['server', 'office', 'perimeter', 'production'].map(id => ({ id, reason: 'success' })) };
  expect((await request.post('/api/runs', { data: run })).ok()).toBeTruthy(); return run;
}
async function openManager(page: any) {
  await page.getByRole('button', { name: 'Таблица лидеров', exact: true }).click();
  await page.getByRole('button', { name: 'Управление', exact: true }).click();
  return page.getByRole('dialog', { name: 'Управление лидербордом', exact: true });
}
async function login(dialog: any) {
  await dialog.getByLabel('Ключ сотрудника').fill(staffKey);
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(dialog.getByLabel('Показать скрытые')).toBeVisible();
}

test('staff can hide and restore a result without deleting it; public board refreshes and close clears access', async ({ page, request }) => {
  const run = await seed(request, 'ПроверкаСкрытия'); await page.goto('/');
  const dialog = await openManager(page);
  await dialog.getByLabel('Ключ сотрудника').fill('wrong-key'); await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Ключ сотрудника не подходит');
  await login(dialog);
  const row = dialog.locator(`tr[data-run-id="${run.id}"]`);
  await expect(row).toContainText('ПроверкаСкрытия');
  await row.getByRole('button', { name: 'Скрыть', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Данные сохранены в базе');
  await expect(row).toHaveCount(0);
  const publicResponse = await request.get('/api/leaderboard?current=' + run.id);
  expect((await publicResponse.json()).current).toBeNull();
  await dialog.getByLabel('Показать скрытые').check();
  await expect(row).toContainText('Скрыт');
  await expect(row.getByRole('button', { name: 'Вернуть в лидерборд' })).toBeVisible();
  await row.getByRole('button', { name: 'Вернуть в лидерборд' }).click();
  await expect(dialog.getByRole('status')).toContainText('Результат возвращён');
  await expect(row).toContainText('В рейтинге');
  await dialog.screenshot({ path: test.info().outputPath('screenshots', 'management-desktop.png') });
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect(page.locator(`.leaderboard-dialog tr[data-run-id="${run.id}"]`)).toBeVisible();
  await page.getByRole('button', { name: 'Управление', exact: true }).click();
  await expect(dialog.getByLabel('Ключ сотрудника')).toHaveValue('');
  await expect(dialog.locator('tbody')).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter(key => /admin|staff|leaderboard.*key/i.test(key)))).toEqual([]);
});

test('a failed save leaves the visible row available for retry and controls fit a small screen', async ({ page, request }) => {
  const run = await seed(request, 'ПроверкаПовтора'); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  const dialog = await openManager(page); await login(dialog);
  const row = dialog.locator(`tr[data-run-id="${run.id}"]`);
  await page.route('**/api/admin/runs/*/visibility', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Временный сбой. Повторите действие."}' }), { times: 1 });
  await row.getByRole('button', { name: 'Скрыть', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Временный сбой');
  await expect(row.getByRole('button', { name: 'Скрыть', exact: true })).toBeEnabled();
  expect((await (await request.get('/api/leaderboard?current=' + run.id)).json()).current).not.toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await row.getByRole('button', { name: 'Скрыть', exact: true }).click();
  await expect(row).toHaveCount(0); await dialog.getByLabel('Показать скрытые').check();
  await expect(row.getByRole('button', { name: 'Вернуть в лидерборд' })).toBeVisible();
  await dialog.screenshot({ path: test.info().outputPath('screenshots', 'management-mobile.png') });
});

test('closing while a staff request is pending cannot reopen an authenticated session', async ({ page }) => {
  await page.goto('/'); const dialog = await openManager(page);
  await page.route('**/api/admin/leaderboard?**', async route => {
    await new Promise(resolve => setTimeout(resolve, 350)); await route.continue();
  });
  await dialog.getByLabel('Ключ сотрудника').fill(staffKey);
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('button', { name: 'Управление', exact: true }).click();
  await page.waitForTimeout(500);
  await expect(dialog.getByLabel('Ключ сотрудника')).toHaveValue('');
  await expect(dialog.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await expect(dialog.locator('tbody')).toHaveCount(0);
});
