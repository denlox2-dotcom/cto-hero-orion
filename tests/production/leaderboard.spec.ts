import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('production server shares scores, rejects invalid writes and keeps private files inaccessible', async ({ page, request }) => {
  const data = {
    id: randomUUID(), difficulty: 'standard', budget: 120,
    player: { firstName: 'Мария', company: 'Проверка сервера', lastName: 'Скрытая', contact: '+79000000000', phone: '+79000000000', telegram: '@private_test', consentVersion: 'draft-2026-09-26', consentAcceptedAt: new Date().toISOString() },
    results: ['server', 'office', 'perimeter', 'production'].map(id => ({ id, reason: 'timeout' })),
  };
  expect((await request.post('/api/runs', { data })).status()).toBe(200);
  expect((await request.post('/api/runs', { data })).status()).toBe(200);
  const response = await request.get(`/api/leaderboard?difficulty=standard&current=${data.id}`);
  const board = await response.json();
  expect(board.current).toMatchObject({ firstName: 'Мария', rooms: 0, budget: 120 });
  expect(JSON.stringify(board)).not.toMatch(/Скрытая|private_test|79000000000|lastName|phone|telegram|contact|consent/);
  expect((await request.post('/api/runs', { data: { ...data, budget: 121 } })).status()).toBe(409);
  expect((await request.post('/api/runs', { data, headers: { Origin: 'https://other.example' } })).status()).toBe(403);
  expect((await request.post('/api/runs', { data: { ...data, results: [] } })).status()).toBe(400);
  expect((await request.post('/api/runs', { data: 'broken' })).status()).toBe(415);
  expect((await request.get('/api/leaderboard?difficulty=wrong')).status()).toBe(400);
  for (const path of ['/data/leaderboard.sqlite', '/server/leaderboard.mjs', '/test-results/production/db/leaderboard.sqlite', '/package.json']) {
    expect((await request.get(path)).status()).toBe(404);
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Таблица лидеров', exact: true }).click();
  await page.getByRole('dialog', { name: 'Таблица лидеров' }).getByRole('button', { name: 'Средняя', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Мария', exact: true })).toBeVisible();
});
