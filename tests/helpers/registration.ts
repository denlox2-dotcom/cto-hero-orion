import { expect, type Page } from '@playwright/test';

// Synthetic participant only; never use real contact data in browser tests.
export async function openRegistration(page: Page): Promise<void> {
  const start = page.getByRole('button', { name: 'Начать игру', exact: true });
  if (await start.isVisible()) await start.click();
}

export async function registerPlayer(page: Page): Promise<void> {
  await openRegistration(page);
  if (await page.getByRole('button', { name: 'Начать смену' }).isVisible()) return;
  await page.getByLabel('Фамилия', { exact: true }).fill('Тестовый');
  await page.getByLabel('Имя', { exact: true }).fill('Участник');
  await page.getByLabel('Компания', { exact: true }).fill('Тестовая компания');
  await page.getByLabel('Телеграм', { exact: true }).fill('@test_player');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Начать смену' })).toBeVisible();
}
