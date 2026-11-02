import { registerPlayer } from '../helpers/registration';
import { test, expect } from '@playwright/test';

test('the built main link opens K2 with its local logo and starts gameplay', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const failed: string[] = [];
  const external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failed.push(request.url()));
  page.on('response', response => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (new URL(url).origin === new URL(baseURL!).origin) return route.continue();
    external.push(url);
    return route.abort();
  });

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'k2');
  await expect(page.getByRole('radiogroup', { name: 'ОФОРМЛЕНИЕ' })).toHaveCount(0);
  const logo = page.getByRole('img', { name: 'К2 НейроТех' });
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await registerPlayer(page);
  await page.getByRole('button', { name: 'Начать смену' }).click();
  await expect(page.getByTestId('room-title')).toHaveText('Серверная');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Смена на паузе' })).toBeVisible();
  expect(external).toEqual([]);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});

test('the built AI Hub link opens only with theme=aihub', async ({ page }) => {
  await page.goto('/?theme=aihub');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'aihub');
  await expect(page.locator('.brand-aihub-lockup')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'ОФОРМЛЕНИЕ' })).toHaveCount(0);
});
