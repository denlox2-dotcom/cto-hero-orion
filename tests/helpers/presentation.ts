import type { Page } from '@playwright/test';

/** Observe only public screen/pause attributes, including in the built game. */
export async function observeResult(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('.game-app')!;
    const events: Array<{ screen: string; paused: boolean; at: number }> = [];
    (window as any).__resultPresentationEvents = events;
    const record = () => {
      const current = { screen: root.dataset.screen!, paused: root.dataset.paused === 'true', at: performance.now() };
      const previous = events.at(-1);
      if (!previous || previous.screen !== current.screen || previous.paused !== current.paused) events.push(current);
    };
    record();
    new MutationObserver(record).observe(root, { attributes: true, attributeFilter: ['data-screen', 'data-paused'] });
  });
}

export async function activeResultMilliseconds(page: Page): Promise<number> {
  return page.evaluate(() => {
    const events = (window as any).__resultPresentationEvents as Array<{ screen: string; paused: boolean; at: number }>;
    const start = events.findIndex(event => event.screen === 'result');
    if (start < 0) throw new Error('No result screen was observed');
    let active = 0;
    for (let i = start; i < events.length - 1; i++) {
      const event = events[i], next = events[i + 1];
      if (event.screen !== 'result') break;
      if (!event.paused) active += next.at - event.at;
      if (next.screen !== 'result') return active;
    }
    throw new Error('The result screen has not ended');
  });
}
