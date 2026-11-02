import type { Rect } from './types';

export function hitsBlockFromBelow(previous: Rect, current: Rect, target: Rect): boolean {
  const underside = target.y + target.height;
  if (current.y >= previous.y || previous.y < underside || current.y > underside) return false;
  const contact = (previous.y - underside) / (previous.y - current.y);
  const left = previous.x + (current.x - previous.x) * contact;
  return left < target.x + target.width && left + current.width > target.x;
}

export function isOutsideHorizontalField(bounds: Rect, width: number): boolean {
  return bounds.x + bounds.width <= 0 || bounds.x >= width;
}

// Sweep the hero centre through a pickup expanded by the hero's half-size.
// Segment clipping avoids collecting unrelated items inside a diagonal path's bounding box.
export function touchesPickup(previous: Rect, current: Rect, target: Rect, padding = 8): boolean {
  const halfWidth = current.width / 2, halfHeight = current.height / 2;
  const start = [previous.x + previous.width / 2, previous.y + previous.height / 2];
  const end = [current.x + halfWidth, current.y + halfHeight];
  const min = [target.x - halfWidth - padding, target.y - halfHeight - padding];
  const max = [target.x + target.width + halfWidth + padding, target.y + target.height + halfHeight + padding];
  let enter = 0, leave = 1;
  for (let axis = 0; axis < 2; axis++) {
    const delta = end[axis] - start[axis];
    if (Math.abs(delta) < 1e-8) {
      if (start[axis] < min[axis] || start[axis] > max[axis]) return false;
    } else {
      const a = (min[axis] - start[axis]) / delta, b = (max[axis] - start[axis]) / delta;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return false;
    }
  }
  return true;
}
