/**
 * Unit tests for ResetWhen behavior
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../../src/core/utils/create-form';
import { resetWhen } from '../../../../src/core/behavior/behaviors/reset-when';
import type { BehaviorSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('resetWhen behavior', () => {
  interface ResetForm {
    loanType: string;
    propertyValue: number;
    carPrice: number;
    initialPayment: number;
  }

  describe('basic functionality', () => {
    it('should reset field when condition becomes true', async () => {
      const form = createForm<ResetForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 500000, component: null as ComponentInstance },
        carPrice: { value: 0, component: null as ComponentInstance },
        initialPayment: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ResetForm> = (path: FieldPath<ResetForm>) => {
        resetWhen(path.propertyValue, (f) => f.loanType !== 'mortgage');
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Initial state - condition is false, value should be unchanged
      expect(form.propertyValue.value.value).toBe(500000);

      // Change loan type to trigger reset
      form.loanType.setValue('consumer');

      await new Promise((r) => setTimeout(r, 10));

      // Value should be reset to null (default resetValue)
      expect(form.propertyValue.value.value).toBe(null);
    });

    it('should not reset field when condition is false', async () => {
      const form = createForm<ResetForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 500000, component: null as ComponentInstance },
        carPrice: { value: 0, component: null as ComponentInstance },
        initialPayment: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ResetForm> = (path: FieldPath<ResetForm>) => {
        resetWhen(path.propertyValue, (f) => f.loanType !== 'mortgage');
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Condition is false (loanType IS mortgage), value should remain unchanged
      expect(form.propertyValue.value.value).toBe(500000);
    });

    it('should reset dirty and touched flags', async () => {
      const form = createForm<ResetForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 500000, component: null as ComponentInstance },
        carPrice: { value: 0, component: null as ComponentInstance },
        initialPayment: { value: 0, component: null as ComponentInstance },
      });

      // Mark as dirty and touched
      form.propertyValue.markAsDirty();
      form.propertyValue.markAsTouched();

      expect(form.propertyValue.dirty.value).toBe(true);
      expect(form.propertyValue.touched.value).toBe(true);

      const behavior: BehaviorSchemaFn<ResetForm> = (path: FieldPath<ResetForm>) => {
        resetWhen(path.propertyValue, (f) => f.loanType !== 'mortgage');
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Trigger reset
      form.loanType.setValue('consumer');

      await new Promise((r) => setTimeout(r, 10));

      // dirty and touched should be reset
      expect(form.propertyValue.dirty.value).toBe(false);
      expect(form.propertyValue.touched.value).toBe(false);
    });
  });

  describe('resetValue option', () => {
    it('should reset to custom value', async () => {
      const form = createForm<ResetForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 500000, component: null as ComponentInstance },
        carPrice: { value: 0, component: null as ComponentInstance },
        initialPayment: { value: 50000, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ResetForm> = (path: FieldPath<ResetForm>) => {
        resetWhen(path.initialPayment, (f) => !f.propertyValue, {
          resetValue: 0,
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Set propertyValue to 0 (falsy) to trigger reset
      form.propertyValue.setValue(0);

      await new Promise((r) => setTimeout(r, 10));

      // Should reset to custom value (0), not null
      expect(form.initialPayment.value.value).toBe(0);
    });

    it('should reset to empty string', async () => {
      interface StringForm {
        trigger: boolean;
        text: string;
      }

      const form = createForm<StringForm>({
        trigger: { value: false, component: null as ComponentInstance },
        text: { value: 'Hello', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        resetWhen(path.text, (f) => f.trigger, {
          resetValue: '',
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      form.trigger.setValue(true);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.text.value.value).toBe('');
    });
  });

  describe('onlyIfDirty option', () => {
    it('should only reset dirty fields when onlyIfDirty is true', async () => {
      const form = createForm<ResetForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 500000, component: null as ComponentInstance },
        carPrice: { value: 100000, component: null as ComponentInstance },
        initialPayment: { value: 0, component: null as ComponentInstance },
      });

      // Mark carPrice as dirty
      form.carPrice.markAsDirty();

      const behavior: BehaviorSchemaFn<ResetForm> = (path: FieldPath<ResetForm>) => {
        resetWhen(path.carPrice, (f) => f.loanType !== 'car', {
          onlyIfDirty: true,
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Trigger reset (loanType is 'mortgage', not 'car')
      // carPrice is dirty, so it should be reset
      expect(form.carPrice.value.value).toBe(null);
    });

    it('should not reset pristine fields when onlyIfDirty is true', async () => {
      const form = createForm<ResetForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 500000, component: null as ComponentInstance },
        carPrice: { value: 100000, component: null as ComponentInstance },
        initialPayment: { value: 0, component: null as ComponentInstance },
      });

      // carPrice is NOT dirty (pristine)
      expect(form.carPrice.dirty.value).toBe(false);

      const behavior: BehaviorSchemaFn<ResetForm> = (path: FieldPath<ResetForm>) => {
        resetWhen(path.carPrice, (f) => f.loanType !== 'car', {
          onlyIfDirty: true,
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Condition is true (loanType !== 'car'), but field is not dirty
      // So it should NOT be reset
      expect(form.carPrice.value.value).toBe(100000);
    });
  });

  describe('multiple resetWhen behaviors', () => {
    it('should handle multiple resetWhen on different fields', async () => {
      const form = createForm<ResetForm>({
        loanType: { value: 'consumer', component: null as ComponentInstance },
        propertyValue: { value: 500000, component: null as ComponentInstance },
        carPrice: { value: 100000, component: null as ComponentInstance },
        initialPayment: { value: 50000, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ResetForm> = (path: FieldPath<ResetForm>) => {
        resetWhen(path.propertyValue, (f) => f.loanType !== 'mortgage', { resetValue: 0 });
        resetWhen(path.carPrice, (f) => f.loanType !== 'car', { resetValue: 0 });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // loanType is 'consumer', so both conditions are true
      // Both fields should be reset
      expect(form.propertyValue.value.value).toBe(0);
      expect(form.carPrice.value.value).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should stop resetting after cleanup', async () => {
      const form = createForm<ResetForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 500000, component: null as ComponentInstance },
        carPrice: { value: 0, component: null as ComponentInstance },
        initialPayment: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ResetForm> = (path: FieldPath<ResetForm>) => {
        resetWhen(path.propertyValue, (f) => f.loanType !== 'mortgage');
      };

      const cleanup = form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Cleanup the behavior
      cleanup();

      // Change loan type after cleanup
      form.loanType.setValue('consumer');

      await new Promise((r) => setTimeout(r, 10));

      // Value should NOT be reset because behavior is cleaned up
      expect(form.propertyValue.value.value).toBe(500000);
    });
  });
});
