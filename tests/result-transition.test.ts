import { describe, expect, it } from 'vitest';
import * as presentation from '../src/core/presentation';

describe('room result transitions', () => {
  it('gives successful rooms five seconds and leaves failures waiting for retry', () => {
    expect(presentation).toHaveProperty('resultCountdown');
    const countdown = (presentation as unknown as { resultCountdown: (reason: string) => number | null }).resultCountdown;
    expect(countdown('success')).toBe(5);
    for (const reason of ['sla', 'fire', 'timeout']) expect(countdown(reason)).toBeNull();
  });
});
