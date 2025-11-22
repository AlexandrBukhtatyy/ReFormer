/**
 * Unit tests for WatchField behavior
 */

import { describe, it, expect, vi } from 'vitest';
import { makeForm } from '../../../../src/core/utils/make-form';
import { watchField } from '../../../../src/core/behavior/behaviors/watch-field';
import type { BehaviorSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('watchField behavior', () => {
  interface WatchForm {
    country: string;
    city: string;
    amount: number;
  }

  describe('basic functionality', () => {
    it('should call callback when field changes', async () => {
      const callback = vi.fn();

      const form = makeForm<WatchForm>({
        country: { value: 'Russia', component: null as ComponentInstance },
        city: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<WatchForm> = (path: FieldPath<WatchForm>) => {
        watchField(path.country, callback);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Initial call from effect
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('Russia', expect.anything());

      // Change value
      form.country.setValue('USA');

      await new Promise((r) => setTimeout(r, 10));

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith('USA', expect.anything());
    });

    it('should provide BehaviorContext to callback', async () => {
      let capturedContext: any = null;

      const form = makeForm<WatchForm>({
        country: { value: 'Russia', component: null as ComponentInstance },
        city: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<WatchForm> = (path: FieldPath<WatchForm>) => {
        watchField(path.country, (_value, ctx) => {
          capturedContext = ctx;
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(capturedContext).not.toBeNull();
      // BehaviorContext (FormContext) has `form` and `setFieldValue`
      expect(capturedContext.form).toBeDefined();
      expect(typeof capturedContext.setFieldValue).toBe('function');
    });

    it('should track multiple field changes', async () => {
      const callback = vi.fn();

      const form = makeForm<WatchForm>({
        country: { value: '', component: null as ComponentInstance },
        city: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<WatchForm> = (path: FieldPath<WatchForm>) => {
        watchField(path.country, callback);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Multiple changes
      form.country.setValue('Russia');
      await new Promise((r) => setTimeout(r, 10));

      form.country.setValue('USA');
      await new Promise((r) => setTimeout(r, 10));

      form.country.setValue('Germany');
      await new Promise((r) => setTimeout(r, 10));

      // Initial call + 3 changes
      expect(callback).toHaveBeenCalledTimes(4);
    });
  });

  describe('immediate option', () => {
    it('should call callback immediately when immediate is true', async () => {
      const callback = vi.fn();

      const form = makeForm<WatchForm>({
        country: { value: 'Russia', component: null as ComponentInstance },
        city: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<WatchForm> = (path: FieldPath<WatchForm>) => {
        watchField(path.country, callback, { immediate: true });
      };

      form.applyBehaviorSchema(behavior);

      // Without waiting - callback should be called immediately
      expect(callback).toHaveBeenCalledWith('Russia', expect.anything());
    });

    it('should call callback twice initially with immediate (sync + effect)', async () => {
      const callback = vi.fn();

      const form = makeForm<WatchForm>({
        country: { value: 'Initial', component: null as ComponentInstance },
        city: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<WatchForm> = (path: FieldPath<WatchForm>) => {
        watchField(path.country, callback, { immediate: true });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // immediate: true causes sync call + effect runs = 2 calls
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('watching multiple fields', () => {
    it('should watch multiple fields independently', async () => {
      const countryCallback = vi.fn();
      const amountCallback = vi.fn();

      const form = makeForm<WatchForm>({
        country: { value: 'Russia', component: null as ComponentInstance },
        city: { value: '', component: null as ComponentInstance },
        amount: { value: 100, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<WatchForm> = (path: FieldPath<WatchForm>) => {
        watchField(path.country, countryCallback);
        watchField(path.amount, amountCallback);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(countryCallback).toHaveBeenCalledWith('Russia', expect.anything());
      expect(amountCallback).toHaveBeenCalledWith(100, expect.anything());

      // Change only country
      form.country.setValue('USA');
      await new Promise((r) => setTimeout(r, 10));

      expect(countryCallback).toHaveBeenCalledTimes(2);
      expect(amountCallback).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('cleanup', () => {
    it('should stop watching after cleanup', async () => {
      const callback = vi.fn();

      const form = makeForm<WatchForm>({
        country: { value: 'Russia', component: null as ComponentInstance },
        city: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<WatchForm> = (path: FieldPath<WatchForm>) => {
        watchField(path.country, callback);
      };

      const cleanup = form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));
      const callCountBeforeCleanup = callback.mock.calls.length;

      cleanup();

      // Change value after cleanup
      form.country.setValue('USA');
      await new Promise((r) => setTimeout(r, 10));

      // Callback should not be called after cleanup
      expect(callback).toHaveBeenCalledTimes(callCountBeforeCleanup);
    });
  });

  describe('with async callbacks', () => {
    it('should handle async callbacks', async () => {
      const results: string[] = [];

      const form = makeForm<WatchForm>({
        country: { value: 'Russia', component: null as ComponentInstance },
        city: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<WatchForm> = (path: FieldPath<WatchForm>) => {
        watchField(path.country, async (value) => {
          await new Promise((r) => setTimeout(r, 5));
          results.push(value);
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 30));

      expect(results).toContain('Russia');
    });
  });
});
