import { test, expect } from '@playwright/test';
import { registerPlayer, openRegistration } from '../helpers/registration';
import { setupPassport } from '../helpers/passport';

const shots = () => test.info().outputPath('screenshots');
const ids = ['server', 'office', 'perimeter', 'production'];
const states = [
  { name: 'empty', rooms: [], modules: [], fires: 0 },
  { name: 'partial', rooms: ['server', 'perimeter'], modules: ['server', 'perimeter'], fires: 3 },
  { name: 'pak-without-victory', rooms: ids.slice(0, 3), modules: ids, fires: 6 },
  { name: 'release', rooms: ids, modules: ids, fires: 9 },
];

// Synthetic component states exercise the passport. Native keyboard routes and
// the compiled server save are tested independently in screens.spec.ts.
for (const theme of ['k2', 'aihub']) {
  for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    test(`passport separates modules and room closure in ${theme} at ${size.width}`, async ({ page }) => {
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize(size); await setupPassport(page, theme); await registerPlayer(page);
      for (const state of states) {
        await page.evaluate(state => (window as any).__renderPassportFixture(state), state);
        await expect(page.locator('.passport-save-status')).toContainText('Результат сохранён');
        await expect(page.locator('.passport-badge')).toHaveCount(4);
        await expect(page.locator('.passport-paper-art')).toBeVisible();
        await expect(page.locator('[data-paper-passport-display]')).toHaveText('№ —');
        await expect(page.getByLabel('Введите номер вашего паспорта ИИ-зрелости', { exact: true })).toBeVisible();
        await expect(page.locator('.passport-number-copy')).toHaveText('Введите номер вашего паспорта ИИ-зрелости');
        await expect(page.locator('.passport-badge[data-earned="true"]')).toHaveCount(state.modules.length);
        await expect(page.locator('.passport-badge[data-closed="true"]')).toHaveCount(state.rooms.length);
        for (const id of ids) {
          const card = page.locator(`[data-badge="${id}"]`);
          await expect(card).toHaveAttribute('data-earned', String(state.modules.includes(id)));
          await expect(card).toHaveAttribute('data-closed', String(state.rooms.includes(id)));
          await expect(card.locator('.passport-module-status')).toHaveText(state.modules.includes(id) ? '✓ МОДУЛЬ ПОЛУЧЕН' : 'МОДУЛЬ НЕ ПОЛУЧЕН');
          await expect(card.locator('.passport-room-status')).toHaveText(state.rooms.includes(id) ? '✓ КОМНАТА ЗАКРЫТА' : 'КОМНАТА НЕ ЗАКРЫТА');
          expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        }
        await expect(page.locator('.room-journey')).not.toBeVisible();
        await expect(page.locator('.controls-strip')).toBeVisible();
        await expect(page.locator('.passport-progress i.is-complete')).toHaveCount(state.rooms.length);
        await expect(page.locator('[data-passport-budget]')).toHaveText('12 345 ₽');
        await expect(page.locator('[data-passport-fires]')).toHaveText(String(state.fires).padStart(2, '0'));
        await expect(page.locator('[data-passport-prod]')).toHaveText(state.rooms.includes('production') ? '01' : '00');
        await expect(page.locator('.passport-stamp')).toHaveText(state.rooms.length === 4 ? 'RELEASE!' : `${state.rooms.length} из 4 комнат пройдено`);
        if (state.name === 'pak-without-victory') {
          await expect(page.locator('.passport-description')).toHaveText('ПАК собран. Следующая цель — спасти прод.');
          await expect(page.locator('[data-badge="production"]')).toHaveAttribute('data-earned', 'true');
          await expect(page.locator('[data-badge="production"]')).toHaveAttribute('data-closed', 'false');
        }
        await expect(page.locator('.passport')).not.toContainText('Тестовый');
        await expect(page.locator('.passport')).not.toContainText('@test_player');
        await page.evaluate(() => document.fonts.ready);
        const bounds = await page.locator('.passport').evaluate(el => ({ height: el.clientHeight, scrollHeight: el.scrollHeight, width: el.clientWidth, scrollWidth: el.scrollWidth }));
        if (bounds.scrollHeight > bounds.height + 1) {
          const layout = await page.locator('.passport').evaluate(el => [el, ...el.children].map(node => {
            const box = node.getBoundingClientRect(), style = getComputedStyle(node);
            return { className: node.className, top: box.top, bottom: box.bottom, height: box.height,
              paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, gap: style.gap, minHeight: style.minHeight, flexShrink: style.flexShrink };
          }));
          await test.info().attach('passport-overflow', { body: JSON.stringify({ state, bounds, layout }), contentType: 'application/json' });
        }
        expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.height + 1);
        expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
        for (const selector of ['.passport-header', '.passport-summary', '.passport-badges', '.passport-metrics', '.passport-footer']) {
          const box = (await page.locator(selector).boundingBox())!;
          const stage = (await page.locator('.game-stage').boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(stage.x);
          expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
          expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height);
        }
        expect(await page.locator('.passport img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
        await page.screenshot({ path: `${shots()}/${theme}-passport-${state.name}-${size.width}.png` });
      }
      await page.getByRole('button', { name: 'Ещё одна смена', exact: true }).click();
      await expect(page.locator('.room-journey')).toBeVisible();
      await expect(page.locator('.journey-step')).toHaveCount(4);
      await expect(page.locator('.journey-step.is-earned, .journey-step.is-failed')).toHaveCount(0);
      await page.evaluate(state => (window as any).__renderPassportFixture(state), states[0]);
      await expect(page.locator('.room-journey')).not.toBeVisible();
      await page.getByRole('button', { name: 'В меню', exact: true }).click();
      await expect(page.locator('.room-journey')).toBeVisible();
      await openRegistration(page);
      await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('');
      expect(errors).toEqual([]);
    });
  }
}

test('passport safely renders long participant names and company without private fields', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 }); await setupPassport(page); await openRegistration(page);
  const firstName = 'Александр <img src=x onerror=alert(1)> & "Тест"';
  const company = 'Очень длинное название компании <b>Нейротехнологии</b> & партнёры '.repeat(2).slice(0, 100);
  await page.getByLabel('Фамилия', { exact: true }).fill('СекретнаяФамилия');
  await page.getByLabel('Имя', { exact: true }).fill(firstName);
  await page.getByLabel('Компания', { exact: true }).fill(company);
  await page.getByLabel('Телеграм', { exact: true }).fill('@private_test');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Начать смену' })).toBeVisible();
  await page.evaluate(state => (window as any).__renderPassportFixture(state), { rooms: ids, modules: ids, fires: 7 });
  await expect(page.locator('.passport-name')).toHaveText(firstName);
  await expect(page.locator('.passport-company')).toHaveText(company);
  await expect(page.locator('.passport-name img, .passport-company b')).toHaveCount(0);
  await expect(page.locator('.passport')).not.toContainText('СекретнаяФамилия');
  await expect(page.locator('.passport')).not.toContainText('private_test');
  expect(await page.locator('.passport').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: `${shots()}/passport-long-name.png` });
});
