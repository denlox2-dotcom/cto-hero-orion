import { test, expect, type Page } from '@playwright/test';
import { openRegistration, registerPlayer } from '../helpers/registration';

const shots = () => test.info().outputPath('screenshots');

async function localOnly(page: Page, baseURL: string) {
  const errors: string[] = [], failures: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failures.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (new URL(url).origin === new URL(baseURL).origin) return route.continue();
    external.push(url); return route.abort();
  });
  return { errors, failures, external };
}

for (const theme of ['k2', 'aihub']) {
  test(`built ${theme} pause preserves keyboard, buttons and restart without diagnostics`, async ({ page, baseURL }) => {
    const traffic = await localOnly(page, baseURL!);
    await page.setViewportSize(theme === 'k2' ? { width: 1280, height: 720 } : { width: 1920, height: 1080 });
    await page.goto(`/?theme=${theme}`); await registerPlayer(page);
    expect(await page.evaluate(() => '__uptime' in window)).toBe(false);
    await page.getByRole('button', { name: 'Начать смену' }).click();
    await expect(page.getByTestId('room-title')).toHaveText('Серверная');
    // The room title precedes its existing intro. The first clock tick confirms
    // active play using public UI, without diagnostic access or artificial waits.
    await expect(page.getByTestId('timer')).not.toHaveText('00:45', { timeout: 5000 });
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    const panel = page.locator('.pause-panel');
    await expect(panel.getByRole('heading', { name: 'Смена на паузе', exact: true })).toBeVisible();
    await expect(panel.getByRole('heading')).toHaveCount(1);
    await expect(panel.locator('.panel-eyebrow, p')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Продолжить', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(panel.getByRole('button', { name: 'В меню', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('button', { name: 'Продолжить', exact: true })).toBeFocused();
    const timer = await page.getByTestId('timer').textContent();
    const metrics = await page.locator('.hud-main').textContent();
    await page.keyboard.down('KeyD'); await page.waitForTimeout(650); await page.keyboard.up('KeyD');
    expect(await page.getByTestId('timer').textContent()).toBe(timer);
    expect(await page.locator('.hud-main').textContent()).toBe(metrics);
    await expect(page.locator('.room-journey')).toBeVisible();
    await page.screenshot({ path: `${shots()}/production-${theme}-pause.png`, fullPage: true });
    await panel.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await expect(panel).not.toBeVisible();
    await expect(page.getByTestId('timer')).not.toHaveText(timer!, { timeout: 1500 });
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    await page.keyboard.press('Escape'); await page.keyboard.press('Enter');
    await expect(panel).not.toBeVisible();
    await page.keyboard.press('Escape');
    await panel.getByRole('button', { name: 'Начать заново', exact: true }).click();
    await expect(page.locator('.game-app')).toHaveAttribute('data-screen', 'playing');
    await expect(page.getByTestId('room-title')).toHaveText('Серверная');
    await expect(page.locator('.journey-step.is-earned, .journey-step.is-failed')).toHaveCount(0);
    await expect(page.locator('.pak-assembly')).toContainText('0/4');
    await page.keyboard.press('Escape');
    await panel.getByRole('button', { name: 'В меню', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Начать игру', exact: true })).toBeVisible();
    await openRegistration(page);
    await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('');
    await expect(page.locator('.room-journey')).toBeVisible();
    expect(traffic).toEqual({ errors: [], failures: [], external: [] });
  });
}
