import { test, expect } from '@playwright/test';
import { registerPlayer } from '../helpers/registration';

const shots = () => test.info().outputPath('screenshots');
for (const [theme, width, height] of [['k2', 960, 720], ['aihub', 1920, 1080]] as const) {
  test(`${theme} built game waits for an explicit retry after failure`, async ({ page }) => {
    // Two real 45-second attempts plus the explicit pause and retry checks.
    test.setTimeout(140000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height }); await page.goto(`/?theme=${theme}`); await registerPlayer(page);
    await page.getByRole('button', { name: 'Начать смену', exact: true }).click();
    const retry = page.getByRole('button', { name: 'Повторить', exact: true });
    await expect(retry).toBeVisible({ timeout: 49000 });
    await expect(retry).toBeFocused(); await expect(page.locator('[data-countdown]')).toHaveCount(0);
    await page.waitForTimeout(6100);
    await expect(retry).toBeVisible();
    await expect(page.getByTestId('room-title')).toHaveText('Серверная');
    const panel = (await page.locator('.result-panel').boundingBox())!, button = (await retry.boundingBox())!;
    expect(button.x).toBeGreaterThanOrEqual(panel.x); expect(button.x + button.width).toBeLessThanOrEqual(panel.x + panel.width);
    expect(panel.y).toBeGreaterThanOrEqual(0); expect(panel.y + panel.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: `${shots()}/built-${theme}-retry-${width}.png` });
    await retry.click();
    await expect(page.locator('[data-screen="playing"]')).toBeVisible();
    await expect(page.getByTestId('room-title')).toHaveText('Серверная');
    await expect(page.getByTestId('timer')).toHaveText('00:45');
    for (const key of ['sla', 'energy']) await expect(page.locator(`[data-value="${key}"]`)).toHaveText('100%');
    await expect(page.locator('[data-value="ogn"]')).toHaveText('0%');
    await expect(page.locator('.journey-step.is-failed')).toHaveCount(0);
    await page.waitForTimeout(5500); await expect(page.getByTestId('room-title')).toHaveText('Серверная');
    await expect(page.locator('[data-screen="playing"]')).toBeVisible();
    await expect(retry).toBeVisible({ timeout: 43000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-countdown]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(retry).toBeFocused();
    await page.waitForTimeout(6100);
    await expect(retry).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-screen="playing"]')).toBeVisible();
    await expect(page.getByTestId('room-title')).toHaveText('Серверная');
    expect(await page.evaluate(() => '__uptime' in window)).toBe(false);
    expect(errors).toEqual([]);
  });
}
