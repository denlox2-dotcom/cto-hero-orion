# Разработка и проверки

## Окружение

Используйте Node.js 24 и npm. Сервер и серверные тесты используют встроенный `node:sqlite`. Устанавливайте зависимости командой `npm ci`: она следует зафиксированному `package-lock.json`.

```sh
npm ci
npm run dev
```

Vite напечатает локальный адрес. В dev-режиме подключается API рейтинга; без отдельной настройки он использует ту же базу `data/leaderboard.sqlite`, что и `npm start`. Для изоляции ручных экспериментов можно задать другой путь:

```sh
LEADERBOARD_DB_PATH=test-results/manual/leaderboard.sqlite npm run dev
```

Открывать `index.html` через `file://` не следует: клиент рассчитан на HTTP и API того же origin.

## Команды

| Команда | Назначение |
|---|---|
| `npm run dev` | Vite с обновлением клиента при изменениях |
| `npm run typecheck` | Проверка TypeScript без сборки |
| `npm run build` | Проверка типов, затем сборка в `dist/` |
| `npm start` | Node-сервер для уже созданной `dist/` |
| `npm run preview` | Локальный просмотр сборки через Vite с API |
| `npm test` | Vitest: правила и серверные функции |
| `npm run test:e2e` | Playwright: `tests/browser/` против dev-сервера |
| `npm run test:production` | Playwright: `tests/production/` против собранной игры |

Перед production-проверками выполните `npm run build`. Серверы браузерных тестов запускаются настройками Playwright; обычный dev-набор использует порт 4175, production — 4174. Другие `playwright.*.config.ts` выделяют отдельные группы сценариев.

## Браузер для Playwright

По умолчанию используется установленный Google Chrome. Для Chromium, загруженного Playwright:

```sh
npx playwright install chromium
PLAYWRIGHT_CHROMIUM_CHANNEL=chromium npm run test:e2e
PLAYWRIGHT_CHROMIUM_CHANNEL=chromium npm run test:production
```

Примеры выборочной проверки:

```sh
npm test -- tests/rules.test.ts
npm run test:e2e -- tests/browser/registration.spec.ts
npm run test:e2e -- --config=playwright.room-retry.config.ts
```

Тестовые базы, снимки, трассировки и прочие артефакты находятся в `test-results/`. Это локальные результаты проверки; они не входят в репозиторий. Закройте посторонний сервер на нужном тестовом порту, чтобы сценарии проверяли ожидаемое окружение.

## Что проверять после изменений

Выбирайте проверки по затронутому поведению, затем проверяйте сборку. Для баланса и правил есть тесты `tests/*.test.ts`. Для клавиатуры, форм, паузы, переходов, рейтинга и отображения есть браузерные сценарии. Production-сценарии проверяют самостоятельный Node-сервер и собранный клиент без dev-диагностики.

При изменении игрового маршрута проверьте обе темы и три сложности. При изменении серверных данных — повторную отправку, приватность публичного ответа, скрытие записей и экспорт паспортов. Используйте вымышленные имена и контакты.

Успешный автоматический прогон относится к выполненным сценариям. Он не заменяет пробное прохождение людьми и отдельную проверку условий реального мероприятия.

## Где менять поведение

- Баланс и сложность: `src/core/balance.ts`, `src/core/difficulty.ts`.
- Геометрия и цели комнат: `src/core/rooms.ts`.
- Условия завершения, награды и ресурсы: `src/core/rules.ts`.
- Столкновения и визуальные действия: `src/game/RoomScene.ts`.
- Форма и её проверка: `src/ui/PlayerEntry.ts`, `src/core/registration.ts`.
- Серверное хранение и API: `server/leaderboard.mjs`.

Общий обзор модулей — в [ARCHITECTURE.md](ARCHITECTURE.md); запуск сервера и данные — в [DEPLOYMENT.md](DEPLOYMENT.md).
