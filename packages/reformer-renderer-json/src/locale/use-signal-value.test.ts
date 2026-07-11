import { describe, it, expect } from 'vitest';
import { signal } from '@reformer/core/signals';
import { unwrapSignalValues } from './use-signal-value';

describe('unwrapSignalValues (pure signal-reading core of <I18n>)', () => {
  it('unwraps signal values and leaves literals as-is', () => {
    const count = signal(3);
    expect(unwrapSignalValues({ count, name: 'Alex' })).toEqual({ count: 3, name: 'Alex' });
  });

  it('reflects the current signal value on each call', () => {
    const count = signal(1);
    expect(unwrapSignalValues({ count })).toEqual({ count: 1 });
    count.value = 5;
    expect(unwrapSignalValues({ count })).toEqual({ count: 5 });
  });

  it('returns the same reference when there are no signals (stable snapshot)', () => {
    const values = { count: 3, name: 'x' };
    expect(unwrapSignalValues(values)).toBe(values);
  });

  it('passes undefined through', () => {
    expect(unwrapSignalValues(undefined)).toBeUndefined();
  });
});
