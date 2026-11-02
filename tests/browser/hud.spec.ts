import { test, expect, type Page } from '@playwright/test';
import { registerPlayer } from '../helpers/registration';
import { completeBoothRoute, moveTo } from './keyboard-route';
const production = process.env.HUD_TEST_MODE === 'production';
const mode = production ? 'built' : 'dev';
const shots = () => test.info().outputPath('screenshots');
async function start(page: Page, theme = 'k2') {
  await page.goto(`/?theme=${theme}`); await registerPlayer(page);
  await page.getByRole('button', { name: 'Начать смену', exact: true }).click();
  await expect(page.locator('.game-hud')).toBeVisible();
  await expect(page.getByTestId('room-title')).toHaveText('Серверная');
}
for (const theme of ['k2', 'aihub']) for (const [width, height] of [[960,720], [1280,640], [1280,680], [1280,720], [1440,900], [1920,1080]]) {
  test(`${theme} HUD is readable and leaves the full upper jump visible at ${width}×${height}`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height }); await start(page, theme);
    await expect(page.locator('.hud-heart')).toHaveCount(5);
    await expect(page.locator('[data-meter="ogn"] .hud-quarter')).toHaveCount(4);
    await expect(page.locator('[data-meter="energy"] .hud-quarter')).toHaveCount(4);
    await expect(page.getByRole('meter', { name: 'Угроза пожара', exact: true })).toBeVisible();
    const layout = await page.evaluate(() => {
      const stage = document.querySelector('.game-stage')!.getBoundingClientRect();
      const hud = document.querySelector('.game-hud')!.getBoundingClientRect();
      const rects = Array.from(document.querySelectorAll('.hud-resource')).map(el => {
        const box = el.getBoundingClientRect();
        const label = el.querySelector('.hud-resource-label > span')!;
        const note = el.querySelector('.hud-note')!;
        return { left: box.left, right: box.right, label: parseFloat(getComputedStyle(label).fontSize),
          meter: el.querySelector('.hud-meter')!.getBoundingClientRect().height,
          noteFits: note.scrollWidth <= note.clientWidth + 1,
          labelFits: el.querySelector('.hud-resource-label')!.scrollWidth <= box.width };
      });
      return { hudBottomWorld: (hud.bottom-stage.top)*960/stage.width, rects,
        pageFits: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1 };
    });
    for (const card of layout.rects) {
      expect(card.label).toBeGreaterThanOrEqual(14); expect(card.meter).toBeGreaterThanOrEqual(28);
      expect(card.noteFits).toBe(true); expect(card.labelFits).toBe(true);
    }
    // Highest platform 336, jump rise 560²/(2×1500), sprite height 56.
    expect(layout.hudBottomWorld).toBeLessThan(336 - 560**2/(2*1500) - 56);
    expect(layout.pageFits).toBe(true);
    await expect(page.locator('.controls-strip .room-hint')).toContainText('Два прыжка');
    await page.screenshot({ path: `${shots()}/${mode}-${theme}-hud-${width}x${height}.png` });
    await page.keyboard.press('Escape'); await expect(page.getByRole('heading', { name: 'Смена на паузе' })).toBeVisible();
    const timer = await page.getByTestId('timer').textContent(); await page.waitForTimeout(250);
    expect(await page.getByTestId('timer').textContent()).toBe(timer);
    expect(await page.evaluate(() => document.fonts.check('16px "IBM Plex Mono"', '0123456789'))).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('partial fills, text alerts and reset use the actual rendered component in both themes', async ({ page }) => {
  test.skip(production, 'Source component fixture is checked in development; the built game has keyboard checks.');
  for (const theme of ['k2', 'aihub']) {
    await start(page, theme);
    await page.clock.install();
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
    await page.evaluate(async () => {
      const { HudMeters } = await import('/src/ui/HudMeters.ts');
      (window as any)._hudTestView = new HudMeters(document.querySelector<HTMLElement>('.game-hud')!);
      (window as any)._hudTestView.update({ sla: 76, ogn: 45, energy: 64 });
    });
    const widths = await page.locator('[data-meter="sla"] [data-segment-fill]').evaluateAll(cells => cells.map(el => Number(el.getAttribute('width'))));
    expect(widths).toEqual([32,32,32,25.6,0]);
    await expect(page.locator('[data-value="sla"]')).toHaveText('76%');
    await expect(page.locator('[data-resource].is-critical')).toHaveCount(0);
    await page.screenshot({ path: `${shots()}/render-${theme}-partial.png` });
    await page.evaluate(() => (window as any)._hudTestView.update({ sla: 20, ogn: 84, energy: 16 }));
    await expect(page.locator('[data-resource].is-critical')).toHaveCount(3);
    await expect(page.locator('[data-meter-note="sla"]')).toContainText('избегай урона');
    await expect(page.locator('[data-meter-note="ogn"]')).toContainText('туши очаги');
    await expect(page.locator('[data-meter-note="energy"]')).toContainText('кофе');
    const criticalColors = await page.locator('[data-resource].is-critical').evaluateAll(cards => cards.map(el => getComputedStyle(el.querySelector('.hud-meter')!).color));
    expect(new Set(criticalColors).size).toBe(1);
    await page.screenshot({ path: `${shots()}/render-${theme}-critical.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.locator('[data-resource="sla"]').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await page.evaluate(() => (window as any)._hudTestView.reset());
    await expect(page.locator('[data-resource].is-critical')).toHaveCount(0);
    await expect(page.locator('.hud-pulse')).toHaveCount(0);
    await expect(page.locator('[data-value="energy"]')).toHaveText('100%');
    await page.clock.resume(); await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
});

test('keyboard spray drains the battery and coffee restores it with its help text', async ({ page }) => {
  await start(page);
  await page.waitForTimeout(1300);
  await page.keyboard.down('KeyE');
  await expect(page.locator('[data-resource="energy"]')).toHaveClass(/is-critical/, { timeout: 23000 });
  await page.keyboard.up('KeyE');
  await expect(page.locator('[data-meter-note="energy"]')).toContainText('кофе');
  await page.screenshot({ path: `${shots()}/${mode}-energy-critical.png` });
  if (!production) await moveTo(page, 34);
  else { await page.keyboard.down('KeyA'); await page.waitForTimeout(230); await page.keyboard.up('KeyA'); }
  await expect(page.locator('[data-resource="energy"]')).not.toHaveClass(/is-critical/);
  await expect(page.locator('[data-meter-note="energy"]')).toHaveText('E — тушить · кофе +60');
});

test('four-room keyboard route still reaches the victory passport with the new HUD', async ({ page }) => {
  test.skip(production, 'The route uses read-only development coordinates.');
  await page.goto('/');
  await completeBoothRoute(page, shots);
  await expect(page.locator('.passport')).toBeVisible();
  await expect(page.locator('.room-hint')).toHaveText('');
  await expect(page.locator('.passport-save-status')).toContainText('Результат сохранён');
});
