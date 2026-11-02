import { describe, expect, it } from 'vitest';
import { touchesPickup } from '../src/core/collisions';
const rect = (x: number, y = 0) => ({ x, y, width: 24, height: 44 });
const target = { x: 60, y: 0, width: 36, height: 36 };
describe('continuous touch pickups', () => {
  it('collects when a fast frame crosses the entire item', () => {
    expect(touchesPickup(rect(0), rect(120), target)).toBe(true);
  });
  it('works in either direction and while jumping', () => {
    expect(touchesPickup(rect(120), rect(0), target)).toBe(true);
    expect(touchesPickup(rect(60, 80), rect(60, -80), target)).toBe(true);
  });
  it('allows a small edge touch and stationary overlap', () => {
    expect(touchesPickup(rect(30), rect(30), target)).toBe(true);
    expect(touchesPickup(rect(60), rect(60), target)).toBe(true);
  });
  it('does not collect merely because an item lies inside the diagonal bounding box', () => {
    expect(touchesPickup(rect(0, 100), rect(120, 220), target)).toBe(false);
    expect(touchesPickup(rect(0, -100), rect(120, 100), { x: 110, y: -90, width: 10, height: 10 })).toBe(false);
  });
});
