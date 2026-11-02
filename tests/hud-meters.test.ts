import { describe, expect, it } from 'vitest';
import { meterState } from '../src/ui/HudMeters';

describe('HUD represents continuous resources without inventing extra lives', () => {
  it('shows 76 SLA as three full hearts and 80 percent of the fourth', () => {
    expect(meterState('sla', 76).fills).toEqual([100, 100, 100, 80, 0]);
    expect(meterState('sla', 12).fills).toEqual([60, 0, 0, 0, 0]);
  });
  it('keeps fractional values in the visual fill even when the label rounds up', () => {
    const state = meterState('energy', 25.2);
    expect(state.label).toBe('26%');
    expect(state.fills[0]).toBe(100);
    expect(state.fills[1]).toBeCloseTo(.8);
    expect(state.value).toBe(25.2);
  });
  it('distinguishes loss of resources from accumulating fire risk at the exact thresholds', () => {
    expect(meterState('sla', 25).critical).toBe(true);
    expect(meterState('energy', 25.01).critical).toBe(false);
    expect(meterState('ogn', 74.1).critical).toBe(false);
    expect(meterState('ogn', 75).critical).toBe(true);
    expect(meterState('ogn', 84).fills).toEqual([100, 100, 100, 36]);
    expect(meterState('energy', 0).note).toContain('кофе');
  });
  it('clamps out-of-range and invalid values so no cell exceeds its bounds', () => {
    expect(meterState('sla', 120).fills).toEqual([100, 100, 100, 100, 100]);
    expect(meterState('ogn', -5).fills).toEqual([0, 0, 0, 0]);
    expect(meterState('energy', Number.NaN).value).toBe(0);
  });
});
