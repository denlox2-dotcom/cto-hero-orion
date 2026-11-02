import { test, expect } from '@playwright/test';
import { openRegistration, registerPlayer } from '../helpers/registration';

test('title, description and mandatory contacts appear together before difficulty', async ({ page }) => {
  await page.goto('/'); await openRegistration(page);
  await expect(page.locator('.game-title')).toBeVisible();
  await expect(page.getByText('Защити ЦОД и ИИ-инфраструктуру от серии угроз', { exact: true })).toBeVisible();
  await expect(page.getByText('Четыре комнаты. Соберите ПАК-AI — он поможет с боссом.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Старт', exact: true })).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'СЛОЖНОСТЬ' })).toHaveCount(0);
  for (const label of ['Фамилия', 'Имя', 'Компания', 'Телефон', 'Телеграм']) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByLabel('Фамилия', { exact: true }).press('Enter');
  await expect(page.getByRole('radiogroup', { name: 'СЛОЖНОСТЬ' })).toHaveCount(0);
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
});

test('identity fields, at least one usable contact, and explicit consent are required', async ({ page }) => {
  await page.goto('/'); await openRegistration(page);
  await page.keyboard.press('Enter');
  const fields = ['Фамилия', 'Имя', 'Компания', 'Телеграм'];
  const values = ['Тестовый', 'Участник', 'Компания', '@test_player'];
  for (let index = 0; index < fields.length; index++) {
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await expect(page.getByLabel(fields[index], { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.difficulty-switch')).toHaveCount(0);
    await page.getByLabel(fields[index], { exact: true }).fill(values[index]);
  }
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('checkbox').check();
  await page.getByLabel('Компания', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByLabel('Компания', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Компания', { exact: true }).fill('Компания');
  await page.getByLabel('Телеграм', { exact: true }).fill('');
  await page.getByLabel('Телефон', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByLabel('Телефон', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Телефон', { exact: true }).fill('+7 (900) 000-00-00');
  await page.getByLabel('Телефон', { exact: true }).press('Enter');
  await expect(page.locator('.difficulty-switch')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
});

test('consent links open separately without accepting consent or losing the form', async ({ page, context }) => {
  await page.goto('/'); await openRegistration(page);
  await page.getByLabel('Фамилия', { exact: true }).fill('Тестовый');
  await expect(page.getByText('Тестовая версия: используйте только вымышленные данные.', { exact: true })).toBeVisible();
  await expect(page.locator('.entry-purpose')).toContainText('Контакт нужен для связи по вопросам призов.');
  await expect(page.locator('.entry-consent')).toContainText('для регистрации в игре «CTO на страже инфраструктуры», учёта результатов и связи по вопросам призов.');
  await context.route('https://k2.tech/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Проверка ссылки</title>' }));
  for (const [name, href] of [
    ['Политикой обработки персональных данных', 'https://k2.tech/personal-data-processing-policy/'],
    ['согласие на обработку моих персональных данных', 'https://k2.tech/consent-to-personal-data-processing/'],
  ]) {
    const link = page.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    const popupPromise = page.waitForEvent('popup');
    await link.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(href);
    await popup.close();
    await expect(page.getByRole('checkbox')).not.toBeChecked();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Фамилия', { exact: true })).toHaveValue('Тестовый');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
});

test('contacts survive edit and replay but are cleared for the next participant', async ({ page }) => {
  await page.goto('/'); await openRegistration(page);
  await registerPlayer(page);
  await page.getByRole('button', { name: 'Изменить контакты' }).click();
  await expect(page.getByLabel('Фамилия', { exact: true })).toHaveValue('Тестовый');
  await page.getByLabel('Телеграм', { exact: true }).fill('https://t.me/test_player');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByRole('radio', { name: 'Сложная', exact: true }).click();
  await page.getByRole('button', { name: 'Начать смену' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'playing');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Начать заново' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'playing');
  await expect(page.locator('[data-playing-difficulty]')).toHaveText('Сложная');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'В меню' }).click(); await openRegistration(page);
  await expect(page.getByLabel('Фамилия', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Телеграм', { exact: true })).toHaveValue('');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
});

test('registration does not persist or expose contacts and renders input as text', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url() + (request.postData() ?? '')));
  await page.goto('/'); await openRegistration(page);
  await registerPlayer(page);
  await page.getByRole('button', { name: 'Изменить контакты' }).click();
  await page.getByLabel('Имя', { exact: true }).fill('<b>Тест</b>');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.locator('.entry-player')).toHaveText('<b>Тест</b>, всё готово к старту.');
  await expect(page.locator('.entry-player b')).toHaveCount(0);
  const state = await page.evaluate(() => ({
    local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie,
    diagnostic: JSON.stringify((window as any).__uptime),
  }));
  expect(JSON.stringify(state)).not.toContain('test_player');
  expect(requests.join('\n')).not.toContain('test_player');
  await page.reload(); await openRegistration(page);
  await expect(page.getByLabel('Телеграм', { exact: true })).toHaveValue('');
});

for (const theme of ['k2', 'aihub']) {
  test(`${theme} registration and difficulty fit the panel at stand resolutions`, async ({ page }) => {
    for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      await page.goto(`/?theme=${theme}`); await openRegistration(page);
      for (const selector of ['.game-title', '.game-subtitle', '.menu-description', '.player-field input', '.entry-consent', '.entry-actions']) {
        for (const item of await page.locator(selector).all()) {
          const box = (await item.boundingBox())!;
          const panel = (await page.locator('.menu-panel').boundingBox())!;
          expect(box.y).toBeGreaterThanOrEqual(panel.y);
          expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height);
        }
      }
      await page.screenshot({ path: test.info().outputPath('screenshots', `registration-${theme}-contacts-${size.width}.png`) });
      await page.getByLabel('Фамилия', { exact: true }).fill('Тестовый');
      await page.getByLabel('Имя', { exact: true }).fill('Участник');
      await page.getByLabel('Компания', { exact: true }).fill('Тестовая компания');
      await page.getByLabel('Телеграм', { exact: true }).fill('@test_player');
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Начать смену' })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath('screenshots', `registration-${theme}-difficulty-${size.width}.png`) });
    }
  });
}

test('contact rejects Cyrillic while names and company keep accepting it', async ({ page }) => {
  await page.goto('/'); await openRegistration(page);
  await page.getByLabel('Имя', { exact: true }).fill('Тестовый участник');
  await page.getByLabel('Компания', { exact: true }).fill('Тестовая компания');
  const contact = page.getByLabel('Телеграм', { exact: true });
  await contact.fill('@test_player');
  await contact.press('End');
  await contact.pressSequentially('Ж');
  await expect(contact).toHaveValue('@test_player');
  await expect(page.locator('.entry-error')).toContainText('латиницу');
  await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('Тестовый участник');
  await expect(page.getByLabel('Компания', { exact: true })).toHaveValue('Тестовая компания');
  await contact.pressSequentially('2');
  await expect(contact).toHaveValue('@test_player2');
  await expect(page.locator('.entry-error')).toBeHidden();
});

test('invalid paste is rejected as a whole and keeps the previous contact', async ({ page }) => {
  await page.goto('/'); await openRegistration(page);
  const contact = page.getByLabel('Телеграм', { exact: true });
  await contact.fill('@test_player');
  const prevented = await contact.evaluate((input: HTMLInputElement) => {
    input.setSelectionRange(0, input.value.length);
    const clipboard = new DataTransfer();
    clipboard.setData('text/plain', '@test_игрок');
    const event = new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true });
    return !input.dispatchEvent(event);
  });
  expect(prevented).toBe(true);
  await expect(contact).toHaveValue('@test_player');
  await expect(page.locator('.entry-error')).toContainText('латиницу');
});

test('valid phone and Telegram paste remain usable', async ({ page }) => {
  await page.goto('/'); await openRegistration(page);
  for (const [label, value] of [['Телефон', '+7 (900) 000-00-00'], ['Телеграм', 'https://t.me/test_player']]) {
    const contact = page.getByLabel(label, { exact: true });
    const allowed = await contact.evaluate((input: HTMLInputElement, pasteValue: string) => {
      input.setSelectionRange(0, input.value.length);
      const clipboard = new DataTransfer();
      clipboard.setData('text/plain', pasteValue);
      const event = new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true });
      return input.dispatchEvent(event);
    }, value);
    expect(allowed).toBe(true);
    await contact.fill(value);
    await expect(contact).toHaveValue(value);
  }
  await page.getByLabel('Фамилия', { exact: true }).fill('Тестовый');
  await page.getByLabel('Имя', { exact: true }).fill('Участник');
  await page.getByLabel('Компания', { exact: true }).fill('Тестовая компания');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Начать смену' })).toBeVisible();
});

test('composition and fallback input restore a valid contact without silently changing it', async ({ page }) => {
  await page.goto('/'); await openRegistration(page);
  const contact = page.getByLabel('Телеграм', { exact: true });
  await contact.fill('@test_player');
  await contact.evaluate((input: HTMLInputElement) => {
    input.setSelectionRange(0, input.value.length);
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = '@test_игрок';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText', data: 'игрок' }));
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'игрок' }));
  });
  await expect(contact).toHaveValue('@test_player');
  await contact.fill('@other_участник');
  await expect(contact).toHaveValue('@test_player');
  await expect(page.locator('.entry-error')).toContainText('латиницу');
});

test('registration records the current consent version and acceptance time', async ({ page }) => {
  await page.goto('/'); await openRegistration(page);
  const registered = await page.evaluate(async () => {
    const { PlayerEntry } = await import('/src/ui/PlayerEntry.ts');
    const panel = document.createElement('section');
    const host = document.createElement('div');
    panel.append(host);
    document.body.append(panel);
    const entry = new PlayerEntry({ start() {}, difficulty() {} });
    entry.mount(host, panel);
    for (const [name, value] of Object.entries({ lastName: 'Тестовый', firstName: 'Участник', company: 'Тестовая компания', phone: '+79000000000', telegram: '@test_player' })) {
      host.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value = value;
    }
    const before = Date.now();
    host.querySelector<HTMLInputElement>('[name="consent"]')!.checked = true;
    host.querySelector<HTMLFormElement>('form')!.requestSubmit();
    const player = entry.registeredPlayer;
    panel.remove();
    return { player, before, after: Date.now() };
  });
  expect(registered.player).toMatchObject({ firstName: 'Участник', phone: '+79000000000', telegram: '@test_player', contact: '+79000000000', consentVersion: 'draft-game-registration-2026-10-04' });
  expect(Date.parse(registered.player!.consentAcceptedAt)).toBeGreaterThanOrEqual(registered.before);
  expect(Date.parse(registered.player!.consentAcceptedAt)).toBeLessThanOrEqual(registered.after);
});
