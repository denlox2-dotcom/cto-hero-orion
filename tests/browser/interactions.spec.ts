import { test, expect, type Page } from '@playwright/test';
import { registerPlayer } from '../helpers/registration';
import { completeBoothRoute, completeKeyboardRoute, moveTo, snapshot, stomp } from './keyboard-route';

const artifacts = () => test.info().outputPath('screenshots');
const floor = [{ x: 0, y: 508, width: 960, height: 16 }];
const pending = { id: 'pending', kind: 'backlog', x: 900, y: 100 };
const levels = ['easy', 'standard', 'hardcore'] as const;

async function fixture(page: Page, difficulty: typeof levels[number], config: Record<string, unknown>) {
  await page.goto('/tests/browser/interactions.html');
  await page.waitForFunction(() => typeof (window as any).startInteractionCase === 'function');
  await page.evaluate(options => (window as any).startInteractionCase(options), { difficulty, config });
  await page.waitForFunction(() => (window as any).__uptime?.room?.status === 'playing' && (window as any).__uptime.room.grounded);
}

async function launchShell(page: Page, direction: number) {
  await stomp(page, 'debt', true);
  const shell = (await snapshot(page)).room.actors.find((actor: any) => actor.id === 'debt');
  await moveTo(page, shell.x - direction * 58);
  await page.waitForFunction(() => (window as any).__uptime.room.grounded);
  await page.keyboard.down(direction > 0 ? 'KeyD' : 'KeyA');
  await page.waitForFunction(() => (window as any).__uptime.room.actors.find((actor: any) => actor.id === 'debt').movingShell, {}, { timeout: 1500 });
  await page.keyboard.up(direction > 0 ? 'KeyD' : 'KeyA');
}

for (const difficulty of levels) {
  test(`${difficulty} closes every backlog block with a normal head strike and charges once`, async ({ page }) => {
    const positions = difficulty === 'easy' ? [[174, 508]] : [[174, 508], [334, 422], [754, 422]];
    const penalty = { easy: 0, standard: 2, hardcore: 3 }[difficulty];
    for (const [x, support] of positions) {
      await fixture(page, difficulty, { spawn: { x, y: support - 8 }, onlyBacklogX: x });
      // Use the configured room's real entities and platform heights.
      const before = await snapshot(page);
      const block = before.room.actors.find((actor: any) => actor.kind === 'backlog' && actor.x === x);
      expect(block.active).toBe(true);
      expect(before.room.gpu).toBe(0);
      await page.keyboard.press('Space');
      await page.waitForFunction(id => !(window as any).__uptime.room.actors.find((actor: any) => actor.id === id).active, block.id, { timeout: 1200 });
      const after = await snapshot(page);
      expect(after.run.budget - before.run.budget).toBe(100);
      expect(before.room.remaining - after.room.remaining).toBeGreaterThanOrEqual(penalty);
      expect(before.room.remaining - after.room.remaining).toBeLessThan(penalty + 0.9);
      await page.waitForFunction(() => (window as any).__uptime.room.grounded);
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
      expect((await snapshot(page)).run.budget).toBe(after.run.budget);
    }
  });

  for (const direction of [-1, 1]) {
    test(`${difficulty} shell travels ${direction > 0 ? 'right' : 'left'} once, closes incidents and exits fully`, async ({ page }) => {
      await fixture(page, difficulty, {
        platforms: floor, spawn: { x: direction > 0 ? 350 : 490, y: 500 },
        entities: [
          { id: 'debt', kind: 'debt', x: 420, y: 508, patrol: [418, 422] },
          { id: 'first', kind: 'incident', x: direction > 0 ? 550 : 290, y: 508, patrol: direction > 0 ? [546, 554] : [286, 294] },
          { id: 'second', kind: 'incident', x: direction > 0 ? 660 : 180, y: 508, patrol: direction > 0 ? [656, 664] : [176, 184] }, pending,
        ],
      });
      await launchShell(page, direction);
      const kicked = await snapshot(page);
      expect(kicked.room.objectives.find((objective: any) => objective.id === 'debt').done).toBe(true);
      await page.waitForTimeout(40);
      expect((await snapshot(page)).room.actors.find((actor: any) => actor.id === 'debt').vx).toBe(direction * 240);
      await page.waitForFunction(() => ['first', 'second'].every(id => !(window as any).__uptime.room.actors.find((actor: any) => actor.id === id).active), {}, { timeout: 1800 });
      const solved = await snapshot(page);
      expect(solved.run.budget).toBe(500);
      expect(solved.room.actors.find((actor: any) => actor.id === 'debt').shellHits).toBe(2);
      await page.waitForFunction(dir => {
        const shell = (window as any).__uptime.room.actors.find((actor: any) => actor.id === 'debt');
        return shell.active && (dir > 0 ? shell.x > 960 : shell.x < 0);
      }, direction, { timeout: 3000 });
      const atEdge = (await snapshot(page)).room.actors.find((actor: any) => actor.id === 'debt');
      expect(atEdge.visible).toBe(true);
      expect(direction > 0 ? atEdge.bounds.x < 960 : atEdge.bounds.x + atEdge.bounds.width > 0).toBe(true);
      await page.waitForFunction(() => !(window as any).__uptime.room.actors.find((actor: any) => actor.id === 'debt').active, {}, { timeout: 500 });
      const exited = await snapshot(page);
      expect(exited.room.actors.find((actor: any) => actor.id === 'debt').visible).toBe(false);
      await page.waitForTimeout(300);
      expect((await snapshot(page)).run.budget).toBe(500);
    });
  }

  test(`${difficulty} moving shell remains safe during prolonged player contact`, async ({ page }) => {
    await fixture(page, difficulty, {
      platforms: floor, spawn: { x: 230, y: 500 },
      entities: [{ id: 'debt', kind: 'debt', x: 300, y: 508, patrol: [298, 302] }, { id: 'boost', kind: 'gpu', x: 230, y: 500, required: false }, pending],
    });
    expect((await snapshot(page)).room.gpu).toBeGreaterThan(13);
    await launchShell(page, 1);
    const sla = (await snapshot(page)).room.sla;
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyD');
    const after = await snapshot(page);
    const shell = after.room.actors.find((actor: any) => actor.id === 'debt');
    expect(Math.abs(after.room.x - shell.x)).toBeLessThan(28);
    expect(after.room.sla).toBe(sla);
  });
}

test('side contact leaves a backlog block active', async ({ page }) => {
  await fixture(page, 'standard', { platforms: floor, spawn: { x: 74, y: 500 }, entities: [{ id: 'block', kind: 'backlog', x: 174, y: 500 }, pending] });
  await moveTo(page, 174);
  expect((await snapshot(page)).room.actors.find((actor: any) => actor.id === 'block').active).toBe(true);
  expect((await snapshot(page)).run.budget).toBe(0);
});

test('falling onto a backlog block does not close it', async ({ page }) => {
  await fixture(page, 'standard', {
    platforms: [...floor, { x: 64, y: 336, width: 112, height: 16 }], spawn: { x: 140, y: 328 },
    entities: [{ id: 'block', kind: 'backlog', x: 240, y: 400 }, pending],
  });
  await moveTo(page, 240);
  await page.waitForFunction(() => (window as any).__uptime.room.grounded);
  expect((await snapshot(page)).room.actors.find((actor: any) => actor.id === 'block').active).toBe(true);
  expect((await snapshot(page)).run.budget).toBe(0);
});

test('shell bonuses are included when the second hit finishes the room', async ({ page }) => {
  await fixture(page, 'standard', {
    platforms: floor, spawn: { x: 350, y: 500 },
    entities: [{ id: 'debt', kind: 'debt', x: 420, y: 508, patrol: [418, 422] }, { id: 'first', kind: 'incident', x: 550, y: 508, patrol: [546, 554] }, { id: 'second', kind: 'incident', x: 660, y: 508, patrol: [656, 664] }],
  });
  await launchShell(page, 1);
  await page.waitForFunction(() => (window as any).__uptime.room.status === 'ended', {}, { timeout: 2000 });
  const result = await snapshot(page);
  expect(result.room.result).toMatchObject({ reason: 'success', completed: 3, budget: 500 });
  await page.waitForTimeout(350);
  expect((await snapshot(page)).run.budget).toBe(500);
});

test('pause freezes the shell and it resumes in the same direction', async ({ page }) => {
  await fixture(page, 'standard', { platforms: floor, spawn: { x: 350, y: 500 }, entities: [{ id: 'debt', kind: 'debt', x: 420, y: 508, patrol: [418, 422] }, pending] });
  await launchShell(page, 1);
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  const before = await snapshot(page);
  await page.waitForTimeout(450);
  const paused = await snapshot(page);
  expect(paused.room.actors.find((actor: any) => actor.id === 'debt').x).toBe(before.room.actors.find((actor: any) => actor.id === 'debt').x);
  expect(paused.room.remaining).toBe(before.room.remaining);
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.waitForTimeout(250);
  expect((await snapshot(page)).room.actors.find((actor: any) => actor.id === 'debt').x).toBeGreaterThan(before.room.actors.find((actor: any) => actor.id === 'debt').x);
});

test('backlog head strike remains reliable with slow rendering', async ({ page }) => {
  await page.addInitScript(() => {
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 100);
    window.cancelAnimationFrame = id => clearTimeout(id);
  });
  await fixture(page, 'standard', { platforms: floor, spawn: { x: 174, y: 500 }, entities: [{ id: 'block', kind: 'backlog', x: 174, y: 400 }, pending] });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !(window as any).__uptime.room.actors.find((actor: any) => actor.id === 'block').active, {}, { timeout: 1500 });
  expect((await snapshot(page)).run.budget).toBe(100);
});

test('backlog head strike works on the first physics step after pause', async ({ page }) => {
  await fixture(page, 'standard', {
    platforms: floor, spawn: { x: 174, y: 500 }, pauseBeforeHeadStrike: true,
    entities: [{ id: 'block', kind: 'backlog', x: 174, y: 460 }, pending],
  });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => (window as any).__uptime.room.paused);
  const before = await snapshot(page);
  expect(before.room.playerBody.y).toBe(464);
  expect(before.room.vy).toBe(-560);
  expect(before.room.actors.find((actor: any) => actor.id === 'block').active).toBe(true);
  expect(before.run.budget).toBe(0);
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.waitForFunction(() => !(window as any).__uptime.room.actors.find((actor: any) => actor.id === 'block').active, {}, { timeout: 1200 });
  expect((await snapshot(page)).run.budget).toBe(100);
});

test('backlog head strike works when a 700 ms frame contains ascent and descent', async ({ page }) => {
  await page.addInitScript(() => {
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 700);
    window.cancelAnimationFrame = id => clearTimeout(id);
  });
  await fixture(page, 'standard', {
    platforms: floor, spawn: { x: 174, y: 500 },
    entities: [{ id: 'block', kind: 'backlog', x: 174, y: 400 }, pending],
  });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !(window as any).__uptime.room.actors.find((actor: any) => actor.id === 'block').active, {}, { timeout: 4000 });
  const after = await snapshot(page);
  expect(after.run.budget).toBe(100);
  expect(after.room.gpu).toBe(0);
});

test('room restart releases the physics listener and the new room accepts a head strike', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await fixture(page, 'standard', {
    platforms: floor, spawn: { x: 174, y: 500 },
    entities: [{ id: 'block', kind: 'backlog', x: 174, y: 400 }, pending],
  });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !(window as any).__uptime.room.actors.find((actor: any) => actor.id === 'block').active);
  await page.getByRole('button', { name: 'Перезапустить комнату', exact: true }).click();
  await page.waitForFunction(() => (window as any).__uptime?.starts === 2 && (window as any).__uptime.room.grounded, {}, { timeout: 1200 });
  expect((await snapshot(page)).room.actors.find((actor: any) => actor.id === 'block').active).toBe(true);
  expect(errors).toEqual([]);
  const before = (await snapshot(page)).run.budget;
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !(window as any).__uptime.room.actors.find((actor: any) => actor.id === 'block').active);
  expect((await snapshot(page)).run.budget).toBe(before + 100);
});

for (const difficulty of levels) {
  test(`${difficulty} correct incident stomps preserve SLA`, async ({ page }) => {
    await fixture(page, difficulty, { platforms: floor, spawn: { x: 350, y: 500 }, entities: [{ id: 'incident', kind: 'incident', x: 420, y: 508, patrol: [418, 422] }, pending] });
    await stomp(page, 'incident');
    expect((await snapshot(page)).room.sla).toBe(100);
  });
}

test('a render-only update after a correct incident stomp keeps SLA', async ({ page }) => {
  await fixture(page, 'standard', {
    platforms: floor, spawn: { x: 350, y: 500 }, renderAgainAfterStomp: true,
    entities: [{ id: 'incident', kind: 'incident', x: 420, y: 508, patrol: [418, 422] }, pending],
  });
  await stomp(page, 'incident');
  expect((await snapshot(page)).room.sla).toBe(100);
});

test('an incident still damages SLA on side contact', async ({ page }) => {
  await fixture(page, 'standard', { platforms: floor, spawn: { x: 350, y: 500 }, entities: [{ id: 'incident', kind: 'incident', x: 420, y: 508, patrol: [418, 422] }, pending] });
  await moveTo(page, 420);
  expect((await snapshot(page)).room.sla).toBeLessThan(100);
});

test('third shell hit keeps the refactoring bonus single', async ({ page }) => {
  await fixture(page, 'standard', {
    platforms: floor, spawn: { x: 350, y: 500 },
    entities: [{ id: 'debt', kind: 'debt', x: 420, y: 508, patrol: [418, 422] },
      ...[550, 660, 770].map((x, index) => ({ id: `incident-${index}`, kind: 'incident', x, y: 508, patrol: [x - 4, x + 4] })), pending],
  });
  await launchShell(page, 1);
  await page.waitForFunction(() => (window as any).__uptime.room.actors.find((actor: any) => actor.id === 'debt').shellHits === 3, {}, { timeout: 2500 });
  expect((await snapshot(page)).run.budget).toBe(700);
});

for (const difficulty of levels) {
  test(`${difficulty} real keyboard route completes all four rooms with the new interactions`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(difficulty === 'hardcore' ? '/?theme=aihub' : '/');
    await registerPlayer(page);
    const directory = `${artifacts()}/${difficulty}`;
    if (difficulty === 'easy') await completeBoothRoute(page, directory);
    else await completeKeyboardRoute(page, difficulty, directory);
    expect((await snapshot(page)).run.tokens).toHaveLength(4);
    await page.screenshot({ path: `${directory}/victory.png` });
    expect(errors).toEqual([]);
  });
}
