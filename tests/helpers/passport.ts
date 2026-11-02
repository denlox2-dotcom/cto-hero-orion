import type { Page } from '@playwright/test';

/** Isolated public GameUI component with synthetic run data and a stubbed API. */
export async function setupPassport(page: Page, theme = 'k2'): Promise<void> {
  await page.route('**/api/runs**', route => route.fulfill({ json: { entries: [], current: null, total: 0 } }));
  await page.goto(`/?theme=${theme}`);
  await page.waitForFunction(() => !!(window as any).__uptime);
  await page.evaluate(async () => {
    const { GameUI } = await import('/src/ui/GameUI.ts');
    const { createRun } = await import('/src/core/rules.ts');
    const { getRooms } = await import('/src/core/rooms.ts');
    const root = document.createElement('div'); root.id = 'passport-fixture';
    document.body.replaceChildren(root);
    const noop = () => {};
    const ui = new GameUI(root, {
      start: noop, resume: noop, retryRoom: noop, restart: () => ui.showPlaying(getRooms('easy')[0], 0, 'easy'),
      menu: () => ui.showMenu(), leaderboard: () => ui.openLeaderboard(), sound: noop, fullscreen: noop,
    });
    (window as any).__renderPassportFixture = (fixture: { rooms: string[]; modules: string[]; fires: number; budget?: number }) => {
      const ids = ['server', 'office', 'perimeter', 'production'];
      const run = createRun('easy'), budget = fixture.budget ?? 12345;
      Object.assign(run, {
        amulets: [...fixture.modules], tokens: [...fixture.rooms], firesExtinguished: fixture.fires, budget,
        results: ids.map(id => ({ id, reason: fixture.rooms.includes(id) ? 'success' : 'timeout',
          completed: fixture.rooms.includes(id) ? 2 : 0, total: 2, remaining: 0, budget })),
      });
      ui.showFinal(run, 'fffe1234-aaaa-4444-aaaa-000000000001');
    };
  });
}
