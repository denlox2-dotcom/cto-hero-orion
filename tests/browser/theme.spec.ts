import { registerPlayer } from '../helpers/registration';
import { test, expect } from '@playwright/test';
import { completeBoothRoute } from './keyboard-route';

test('the main link opens K2 without a theme switch', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'k2');
  await expect(page.getByRole('radiogroup', { name: 'ОФОРМЛЕНИЕ' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'К2 НейроТех' })).toBeVisible();
  expect(await page.getByRole('img', { name: 'К2 НейроТех' }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'k2');

  await registerPlayer(page);
  await page.getByRole('button', { name: 'Начать смену' }).click();
  await expect(page.getByTestId('room-title')).toHaveText('Серверная');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'k2');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Смена на паузе' })).toBeVisible();
  await page.getByRole('button', { name: 'В меню' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'k2');
  expect(new URL(page.url()).searchParams.has('theme')).toBe(false);
});

test('only theme=aihub opens AI Hub, while unknown theme values keep K2', async ({ page }) => {
  for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    await page.goto('/?theme=aihub&from=colleagues');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'aihub');
    await expect(page.getByRole('radiogroup', { name: 'ОФОРМЛЕНИЕ' })).toHaveCount(0);
    await expect(page.locator('.brand-aihub-lockup')).toBeVisible();
    expect(new URL(page.url()).searchParams.get('from')).toBe('colleagues');
    const panel = await page.locator('.menu-panel').boundingBox();
    const start = await page.getByRole('button', { name: 'Начать игру', exact: true }).boundingBox();
    expect(panel).not.toBeNull();
    expect(start).not.toBeNull();
    expect(start!.y + start!.height).toBeLessThanOrEqual(panel!.y + panel!.height);
    await page.screenshot({ path: test.info().outputPath('screenshots', `theme-aihub-link-menu-${size.width}.png`), fullPage: true });
  }
  await page.goto('/?theme=other');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'k2');
  await page.goto('/?theme=k2');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'k2');
});

test('K2 menu, gameplay HUD, and pause remain visible at stand sizes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'k2');
    const panel = await page.locator('.menu-panel').boundingBox();
    const start = await page.getByRole('button', { name: 'Начать игру', exact: true }).boundingBox();
    expect(panel).not.toBeNull();
    expect(start).not.toBeNull();
    expect(start!.y + start!.height).toBeLessThanOrEqual(panel!.y + panel!.height);
    await page.screenshot({ path: test.info().outputPath('screenshots', `theme-k2-default-menu-${size.width}.png`), fullPage: true });

    await registerPlayer(page);
    await page.getByRole('button', { name: 'Начать смену' }).click();
    await expect(page.getByTestId('room-title')).toHaveText('Серверная');
    await page.screenshot({ path: test.info().outputPath('screenshots', `theme-k2-hud-${size.width}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Смена на паузе' })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('screenshots', `theme-k2-pause-${size.width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('K2 branding stays on the victory passport', async ({ page }) => {
  await page.goto('/');
  await completeBoothRoute(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'k2');
  const passport = page.locator('.passport');
  await expect(passport).toBeVisible();
  await expect(passport.getByRole('img', { name: 'Пиксельный CTO в каске с огнетушителем' })).toBeVisible();
  await expect(passport.getByRole('img', { name: 'Собранный ПАК-AI, все четыре модуля установлены' })).toBeVisible();
  const logo = page.getByRole('img', { name: 'К2 НейроТех' });
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: test.info().outputPath('screenshots', 'theme-k2-victory.png'), fullPage: true });
});
