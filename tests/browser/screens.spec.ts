import { test, expect } from '@playwright/test';
import { openRegistration, registerPlayer } from '../helpers/registration';
import { activeResultMilliseconds, observeResult } from '../helpers/presentation';
import { completeBoothRoute, moveTo, snapshot, spray, stomp } from './keyboard-route';

const shots = () => test.info().outputPath('screenshots');
const levels = { easy: 'Легкая', standard: 'Средняя', hardcore: 'Сложная' } as const;

for (const theme of ['k2', 'aihub']) {
  for (const difficulty of ['easy', 'standard', 'hardcore'] as const) {
    test(`${theme} ${difficulty} pause has one title and preserves focus, actions and frozen events`, async ({ page }) => {
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      const size = difficulty === 'hardcore' ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
      await page.setViewportSize(size); await page.goto(`/?theme=${theme}`); await registerPlayer(page);
      await page.getByRole('radio', { name: levels[difficulty], exact: true }).click();
      await page.getByRole('button', { name: 'Начать смену' }).click();
      await page.waitForFunction(() => (window as any).__uptime?.room.status === 'playing');
      await page.keyboard.press('Escape');
      const panel = page.locator('.pause-panel');
      await expect(panel.getByRole('heading', { name: 'Смена на паузе', exact: true })).toBeVisible();
      await expect(panel.getByRole('heading')).toHaveCount(1);
      await expect(panel.locator('.panel-eyebrow, p')).toHaveCount(0);
      await expect(panel.locator('.pause-shortcut kbd')).toHaveText('Esc');
      await expect(page.locator('.room-journey')).toBeVisible();
      const frozen = await snapshot(page);
      await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
      expect(await snapshot(page)).toEqual(frozen);
      await expect(panel.getByRole('button', { name: 'Продолжить', exact: true })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(panel.getByRole('button', { name: 'В меню', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(panel.getByRole('button', { name: 'Продолжить', exact: true })).toBeFocused();
      const panelBox = (await panel.boundingBox())!;
      for (const selector of ['h2', '.primary-button', '.pause-secondary', '.pause-shortcut']) {
        const box = (await panel.locator(selector).boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(panelBox.x);
        expect(box.x + box.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(panelBox.y + panelBox.height);
      }
      await page.screenshot({ path: `${shots()}/${theme}-pause-${difficulty}-${size.width}.png` });
      await panel.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await expect(panel).not.toBeVisible();
      await page.waitForTimeout(250);
      expect((await snapshot(page)).room.remaining).toBeLessThan(frozen.room.remaining);
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      expect((await snapshot(page)).paused).toBe(false);
      await page.keyboard.press('Escape'); await page.keyboard.press('Enter');
      expect((await snapshot(page)).paused).toBe(false);
      await page.keyboard.press('Escape');
      await panel.getByRole('button', { name: 'Начать заново', exact: true }).click();
      await page.waitForFunction(() => (window as any).__uptime?.room.status === 'playing' && !(window as any).__uptime.paused);
      const restarted = await snapshot(page);
      expect(restarted.run).toMatchObject({ difficulty, budget: 0, tokens: [], amulets: [], results: [], pakAssistUsed: false });
      expect(restarted.room.remaining).toBeGreaterThan(frozen.room.remaining - 0.1);
      await expect(page.locator('.room-journey')).toBeVisible();
      await page.keyboard.press('Escape');
      await panel.getByRole('button', { name: 'В меню', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Начать игру', exact: true })).toBeVisible();
      await openRegistration(page);
      await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('');
      await expect(page.locator('.room-journey')).toBeVisible();
      expect((await snapshot(page)).screen).toBe('menu');
      expect(errors).toEqual([]);
    });
  }

  test(`${theme} pause on the room result preserves its five-second interval`, async ({ page }) => {
    await page.goto(`/?theme=${theme}`); await registerPlayer(page); await observeResult(page);
    await page.getByRole('button', { name: 'Начать смену' }).click();
    await page.waitForFunction(() => (window as any).__uptime?.room.status === 'playing');
    await moveTo(page, 122); await spray(page); await stomp(page, 's-i1');
    await expect(page.locator('[data-countdown]')).toHaveText('5');
    await expect(page.locator('.room-journey')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Смена на паузе', exact: true })).toBeVisible();
    const frozen = await snapshot(page), countdown = await page.locator('[data-countdown]').textContent();
    await page.waitForTimeout(650);
    expect(await snapshot(page)).toEqual(frozen);
    expect(await page.locator('[data-countdown]').textContent()).toBe(countdown);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('room-title')).toHaveText('Опенспейс', { timeout: 6000 });
    const duration = await activeResultMilliseconds(page);
    expect(duration).toBeGreaterThanOrEqual(4950); expect(duration).toBeLessThan(5300);
    await expect(page.locator('.room-journey')).toBeVisible();
  });

  test(`${theme} real keyboard victory hides the lower journey and restores it for a new shift`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/?theme=${theme}`); await completeBoothRoute(page, `${shots()}/route-${theme}`);
    await expect(page.locator('.room-journey')).not.toBeVisible();
    await expect(page.locator('.controls-strip')).toBeVisible();
    await expect(page.locator('.passport-badge[data-earned="true"][data-closed="true"]')).toHaveCount(4);
    await expect(page.locator('.passport-module-status')).toHaveText(Array(4).fill('✓ МОДУЛЬ ПОЛУЧЕН'));
    await expect(page.locator('.passport-room-status')).toHaveText(Array(4).fill('✓ КОМНАТА ЗАКРЫТА'));
    await expect(page.locator('.passport-save-status')).toContainText('Результат сохранён');
    await page.screenshot({ path: `${shots()}/${theme}-real-passport.png`, fullPage: true });
    await page.getByRole('button', { name: 'Перейти к лидерборду' }).click();
    await expect(page.locator('.leaderboard-row.is-current')).toContainText('4/4');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Ещё одна смена', exact: true }).click();
    await page.waitForFunction(() => (window as any).__uptime?.room.status === 'playing');
    await expect(page.locator('.room-journey')).toBeVisible();
    await expect(page.locator('.journey-step.is-earned, .journey-step.is-failed')).toHaveCount(0);
    expect((await snapshot(page)).run).toMatchObject({ amulets: [], results: [], pakAssistUsed: false });
    expect(errors).toEqual([]);
  });
}
