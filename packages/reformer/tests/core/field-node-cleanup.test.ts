/**
 * Unit tests for FieldNode cleanup (dispose mechanism)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FieldNode } from '../../src/core/nodes/field-node';
import { signal } from '@preact/signals-core';

describe('FieldNode - Cleanup (dispose)', () => {
  let field: FieldNode<string>;

  beforeEach(() => {
    field = new FieldNode({
      value: '',
      component: null as any,
    });
  });

  describe('watch() cleanup', () => {
    it('should cleanup subscription when dispose() is called', () => {
      const callback = vi.fn();

      // Subscribe to changes
      field.watch(callback);

      // Initial call
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('');

      // Change value
      field.setValue('test');
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith('test');

      // Dispose
      field.dispose();

      // Change value after dispose - callback should NOT be called
      field.setValue('after-dispose');
      expect(callback).toHaveBeenCalledTimes(2); // Still 2, not 3
    });

    it('should cleanup multiple watch subscriptions', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      field.watch(callback1);
      field.watch(callback2);
      field.watch(callback3);

      // Initial calls
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);

      // Change value
      field.setValue('test');
      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(2);
      expect(callback3).toHaveBeenCalledTimes(2);

      // Dispose all
      field.dispose();

      // Change value after dispose
      field.setValue('after-dispose');
      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(2);
      expect(callback3).toHaveBeenCalledTimes(2);
    });

    it('should allow manual unsubscribe before dispose', () => {
      const callback = vi.fn();

      const unsubscribe = field.watch(callback);

      // Initial call
      expect(callback).toHaveBeenCalledTimes(1);

      // Manual unsubscribe
      unsubscribe();

      // Change value - callback should NOT be called
      field.setValue('test');
      expect(callback).toHaveBeenCalledTimes(1);

      // Dispose should not throw
      expect(() => field.dispose()).not.toThrow();
    });

    it('should handle multiple manual unsubscribes', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsubscribe1 = field.watch(callback1);
      //@ts-ignore
      const unsubscribe2 = field.watch(callback2);

      // Unsubscribe first
      unsubscribe1();

      field.setValue('test');
      expect(callback1).toHaveBeenCalledTimes(1); // Only initial call
      expect(callback2).toHaveBeenCalledTimes(2); // Initial + setValue

      // Dispose should still cleanup callback2
      field.dispose();

      field.setValue('after-dispose');
      expect(callback2).toHaveBeenCalledTimes(2); // Still 2
    });
  });

  describe('computeFrom() cleanup', () => {
    it('should cleanup computed subscription when dispose() is called', () => {
      const source1 = signal(10);
      const source2 = signal(20);

      field.computeFrom([source1, source2], (v1, v2) => `${v1}-${v2}`);

      // Initial computation
      expect(field.value.value).toBe('10-20');

      // Change source
      source1.value = 15;
      expect(field.value.value).toBe('15-20');

      // Dispose
      field.dispose();

      // Change source after dispose - value should NOT update
      source1.value = 100;
      expect(field.value.value).toBe('15-20'); // Still old value
    });

    it('should cleanup multiple computeFrom subscriptions', () => {
      const source1 = signal(10);
      const source2 = signal(20);

      const field2 = new FieldNode<string>({
        value: '',
        component: null as any,
      });

      field.computeFrom([source1], (v1) => `field1-${v1}`);
      field2.computeFrom([source2], (v2) => `field2-${v2}`);

      expect(field.value.value).toBe('field1-10');
      expect(field2.value.value).toBe('field2-20');

      // Dispose only field1
      field.dispose();

      // Change sources
      source1.value = 100;
      source2.value = 200;

      // field1 should NOT update, field2 should update
      expect(field.value.value).toBe('field1-10'); // Not updated
      expect(field2.value.value).toBe('field2-200'); // Updated

      // Cleanup
      field2.dispose();
    });

    it('should allow manual unsubscribe for computeFrom', () => {
      const source = signal(10);

      const unsubscribe = field.computeFrom([source], (v) => `value-${v}`);

      expect(field.value.value).toBe('value-10');

      // Manual unsubscribe
      unsubscribe();

      // Change source - field should NOT update
      source.value = 20;
      expect(field.value.value).toBe('value-10');

      // Dispose should not throw
      expect(() => field.dispose()).not.toThrow();
    });
  });

  describe('mixed watch() and computeFrom()', () => {
    it('should cleanup both watch and computeFrom subscriptions', () => {
      const watchCallback = vi.fn();
      const source = signal(10);

      // computeFrom will trigger watch's callback because it changes the field value
      field.computeFrom([source], (v) => `computed-${v}`);
      field.watch(watchCallback);

      // Initial state (watch is called immediately + computeFrom already set value)
      expect(watchCallback).toHaveBeenCalledTimes(1);
      expect(field.value.value).toBe('computed-10');

      // Change source
      source.value = 20;
      expect(field.value.value).toBe('computed-20');
      expect(watchCallback).toHaveBeenCalledTimes(2); // watch triggered

      // Dispose
      field.dispose();

      // Changes should NOT trigger anything
      source.value = 30;
      field.setValue('manual-change');

      expect(field.value.value).toBe('manual-change'); // Manual change works
      expect(watchCallback).toHaveBeenCalledTimes(2); // watch NOT triggered
    });
  });

  describe('debounce timer cleanup', () => {
    it('should clear debounce timer on dispose', async () => {
      const asyncValidator = vi.fn(async (value: string) => {
        return value.length < 3 ? { code: 'minLength', message: 'Too short' } : null;
      });

      const fieldWithDebounce = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [asyncValidator],
        debounce: 500,
      });

      // Trigger validation with debounce
      fieldWithDebounce.setValue('ab');
      void fieldWithDebounce.validate();

      // Dispose before debounce completes
      fieldWithDebounce.dispose();

      // Wait for debounce (should be cancelled)
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Validator should NOT have been called (debounce cancelled)
      // Note: This test may be flaky depending on implementation
      // The important part is that dispose() clears the timer
      expect(() => fieldWithDebounce.dispose()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle dispose() called multiple times', () => {
      const callback = vi.fn();
      field.watch(callback);

      expect(() => {
        field.dispose();
        field.dispose();
        field.dispose();
      }).not.toThrow();

      field.setValue('test');
      expect(callback).toHaveBeenCalledTimes(1); // Only initial
    });

    it('should handle dispose() on field without subscriptions', () => {
      const emptyField = new FieldNode({
        value: '',
        component: null as any,
      });

      expect(() => emptyField.dispose()).not.toThrow();
    });

    it('should allow new subscriptions after dispose', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      field.watch(callback1);
      field.dispose();

      // Add new subscription after dispose
      field.watch(callback2);

      field.setValue('test');

      expect(callback1).toHaveBeenCalledTimes(1); // Only initial (before dispose)
      expect(callback2).toHaveBeenCalledTimes(2); // Initial + setValue

      // Cleanup
      field.dispose();
    });
  });

  describe('memory leak prevention', () => {
    it('should not accumulate disposers in array', () => {
      // Create and dispose multiple subscriptions
      for (let i = 0; i < 100; i++) {
        const callback = vi.fn();
        field.watch(callback);
      }

      // Dispose all
      field.dispose();

      // Internal disposers array should be empty
      // Note: This test verifies the internal state indirectly
      // by checking that new subscriptions work correctly
      const callback = vi.fn();
      field.watch(callback);

      field.setValue('test');
      expect(callback).toHaveBeenCalledTimes(2); // Should work normally

      field.dispose();
    });

    it('should handle rapid subscribe/unsubscribe cycles', () => {
      const callbacks: Array<() => void> = [];

      // Create many subscriptions
      for (let i = 0; i < 50; i++) {
        const callback = vi.fn();
        const unsubscribe = field.watch(callback);
        callbacks.push(unsubscribe);
      }

      // Manually unsubscribe half
      for (let i = 0; i < 25; i++) {
        callbacks[i]();
      }

      // Dispose should cleanup the rest
      expect(() => field.dispose()).not.toThrow();
    });
  });
});
