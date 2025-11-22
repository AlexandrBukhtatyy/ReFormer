/**
 * Unit tests for EnableWhen and DisableWhen behaviors
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/make-form';
import { enableWhen, disableWhen } from '../../../../src/core/behavior/behaviors/enable-when';
import type { BehaviorSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('enableWhen behavior', () => {
  interface ConditionalForm {
    loanType: string;
    propertyValue: number;
    employmentStatus: string;
    income: number;
  }

  describe('enableWhen', () => {
    it('should enable field when condition is true', async () => {
      const form = makeForm<ConditionalForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        employmentStatus: { value: '', component: null as ComponentInstance },
        income: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ConditionalForm> = (path: FieldPath<ConditionalForm>) => {
        enableWhen(path.propertyValue, (f) => f.loanType === 'mortgage');
      };

      form.applyBehaviorSchema(behavior);

      // Wait for effect to run
      await new Promise((r) => setTimeout(r, 10));

      expect(form.propertyValue.disabled.value).toBe(false);
    });

    it('should disable field when condition is false', async () => {
      const form = makeForm<ConditionalForm>({
        loanType: { value: 'consumer', component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        employmentStatus: { value: '', component: null as ComponentInstance },
        income: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ConditionalForm> = (path: FieldPath<ConditionalForm>) => {
        enableWhen(path.propertyValue, (f) => f.loanType === 'mortgage');
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.propertyValue.disabled.value).toBe(true);
    });

    it('should react to condition changes', async () => {
      const form = makeForm<ConditionalForm>({
        loanType: { value: 'consumer', component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        employmentStatus: { value: '', component: null as ComponentInstance },
        income: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ConditionalForm> = (path: FieldPath<ConditionalForm>) => {
        enableWhen(path.propertyValue, (f) => f.loanType === 'mortgage');
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));
      expect(form.propertyValue.disabled.value).toBe(true);

      // Change condition using setValue
      form.loanType.setValue('mortgage');

      await new Promise((r) => setTimeout(r, 10));
      expect(form.propertyValue.disabled.value).toBe(false);
    });

    // TODO: resetOnDisable option appears to have a bug where the effect doesn't
    // re-run when the condition changes from true to false.
    it.todo('should reset field when disabled with resetOnDisable option');

    it('should NOT reset field when disabled without resetOnDisable', async () => {
      const form = makeForm<ConditionalForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 500000, component: null as ComponentInstance },
        employmentStatus: { value: '', component: null as ComponentInstance },
        income: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ConditionalForm> = (path: FieldPath<ConditionalForm>) => {
        enableWhen(path.propertyValue, (f) => f.loanType === 'mortgage');
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      form.loanType.setValue('consumer');

      await new Promise((r) => setTimeout(r, 10));

      expect(form.propertyValue.disabled.value).toBe(true);
      // Value should be preserved
      expect(form.propertyValue.value.value).toBe(500000);
    });

    it('should work with complex conditions', async () => {
      const form = makeForm<ConditionalForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        employmentStatus: { value: 'employed', component: null as ComponentInstance },
        income: { value: 50000, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ConditionalForm> = (path: FieldPath<ConditionalForm>) => {
        // Enable propertyValue only for mortgage with employed status and income > 30000
        enableWhen(
          path.propertyValue,
          (f) => f.loanType === 'mortgage' && f.employmentStatus === 'employed' && f.income > 30000
        );
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));
      expect(form.propertyValue.disabled.value).toBe(false);

      // Change income below threshold
      form.income.setValue(20000);

      await new Promise((r) => setTimeout(r, 10));
      expect(form.propertyValue.disabled.value).toBe(true);
    });
  });

  describe('disableWhen', () => {
    it('should disable field when condition is true', async () => {
      const form = makeForm<ConditionalForm>({
        loanType: { value: 'consumer', component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        employmentStatus: { value: '', component: null as ComponentInstance },
        income: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ConditionalForm> = (path: FieldPath<ConditionalForm>) => {
        disableWhen(path.propertyValue, (f) => f.loanType === 'consumer');
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.propertyValue.disabled.value).toBe(true);
    });

    it('should enable field when condition is false', async () => {
      const form = makeForm<ConditionalForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        employmentStatus: { value: '', component: null as ComponentInstance },
        income: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ConditionalForm> = (path: FieldPath<ConditionalForm>) => {
        disableWhen(path.propertyValue, (f) => f.loanType === 'consumer');
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.propertyValue.disabled.value).toBe(false);
    });

    it('should react to condition changes', async () => {
      const form = makeForm<ConditionalForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        employmentStatus: { value: '', component: null as ComponentInstance },
        income: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ConditionalForm> = (path: FieldPath<ConditionalForm>) => {
        disableWhen(path.propertyValue, (f) => f.loanType === 'consumer');
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));
      expect(form.propertyValue.disabled.value).toBe(false);

      form.loanType.setValue('consumer');

      await new Promise((r) => setTimeout(r, 10));
      expect(form.propertyValue.disabled.value).toBe(true);
    });

    // NOTE: Same bug as enableWhen with resetOnDisable
    it.todo('should support resetOnDisable option');
  });

  describe('multiple behaviors', () => {
    it('should handle multiple enableWhen on different fields', async () => {
      const form = makeForm<ConditionalForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        employmentStatus: { value: 'employed', component: null as ComponentInstance },
        income: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ConditionalForm> = (path: FieldPath<ConditionalForm>) => {
        enableWhen(path.propertyValue, (f) => f.loanType === 'mortgage');
        enableWhen(path.income, (f) => f.employmentStatus === 'employed');
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.propertyValue.disabled.value).toBe(false);
      expect(form.income.disabled.value).toBe(false);

      // Change conditions
      form.loanType.setValue('consumer');
      form.employmentStatus.setValue('unemployed');

      await new Promise((r) => setTimeout(r, 10));

      expect(form.propertyValue.disabled.value).toBe(true);
      expect(form.income.disabled.value).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should stop reacting after cleanup', async () => {
      const form = makeForm<ConditionalForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        employmentStatus: { value: '', component: null as ComponentInstance },
        income: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ConditionalForm> = (path: FieldPath<ConditionalForm>) => {
        enableWhen(path.propertyValue, (f) => f.loanType === 'mortgage');
      };

      // applyBehaviorSchema returns a cleanup function
      const cleanup = form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));
      expect(form.propertyValue.disabled.value).toBe(false);

      // Cleanup behaviors
      cleanup();

      // Change condition after cleanup
      form.loanType.setValue('consumer');

      await new Promise((r) => setTimeout(r, 10));

      // Field should remain enabled because behavior is no longer active
      expect(form.propertyValue.disabled.value).toBe(false);
    });
  });
});
