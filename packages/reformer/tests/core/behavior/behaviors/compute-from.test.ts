/**
 * Unit tests for ComputeFrom behavior
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/make-form';
import { computeFrom } from '../../../../src/core/behavior/behaviors/compute-from';
import type { BehaviorSchemaFn } from '../../../../src/core/behavior/types';
import type { FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('computeFrom behavior', () => {
  type CalculatorForm = {
    price: number;
    quantity: number;
    discount: number;
    total: number;
    propertyValue: number;
    initialPayment: number;
  };

  describe('basic functionality', () => {
    it('should compute value from single source', async () => {
      const form = makeForm<CalculatorForm>({
        price: { value: 100, component: null as ComponentInstance },
        quantity: { value: 1, component: null as ComponentInstance },
        discount: { value: 0, component: null as ComponentInstance },
        total: { value: 0, component: null as ComponentInstance },
        propertyValue: { value: 1000000, component: null as ComponentInstance },
        initialPayment: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<CalculatorForm> = (path: FieldPath<CalculatorForm>) => {
        computeFrom(
          [path.propertyValue],
          path.initialPayment,
          (values: CalculatorForm) => values.propertyValue * 0.2 // 20% down payment
        );
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.initialPayment.value.value).toBe(200000);
    });

    it('should compute value from multiple sources', async () => {
      const form = makeForm<CalculatorForm>({
        price: { value: 100, component: null as ComponentInstance },
        quantity: { value: 5, component: null as ComponentInstance },
        discount: { value: 0, component: null as ComponentInstance },
        total: { value: 0, component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        initialPayment: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<CalculatorForm> = (path: FieldPath<CalculatorForm>) => {
        computeFrom(
          [path.price, path.quantity],
          path.total,
          (values: CalculatorForm) => values.price * values.quantity
        );
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.total.value.value).toBe(500);
    });

    it('should recompute when source changes', async () => {
      const form = makeForm<CalculatorForm>({
        price: { value: 100, component: null as ComponentInstance },
        quantity: { value: 5, component: null as ComponentInstance },
        discount: { value: 0, component: null as ComponentInstance },
        total: { value: 0, component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        initialPayment: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<CalculatorForm> = (path: FieldPath<CalculatorForm>) => {
        computeFrom(
          [path.price, path.quantity],
          path.total,
          (values: CalculatorForm) => values.price * values.quantity
        );
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));
      expect(form.total.value.value).toBe(500);

      // Change quantity
      form.quantity.setValue(10);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.total.value.value).toBe(1000);
    });

    it('should react to any source change', async () => {
      const form = makeForm<CalculatorForm>({
        price: { value: 100, component: null as ComponentInstance },
        quantity: { value: 5, component: null as ComponentInstance },
        discount: { value: 0, component: null as ComponentInstance },
        total: { value: 0, component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        initialPayment: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<CalculatorForm> = (path: FieldPath<CalculatorForm>) => {
        computeFrom(
          [path.price, path.quantity],
          path.total,
          (values: CalculatorForm) => values.price * values.quantity
        );
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));
      expect(form.total.value.value).toBe(500);

      // Change price
      form.price.setValue(200);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.total.value.value).toBe(1000);
    });
  });

  describe('complex calculations', () => {
    it('should handle calculations with multiple sources and discount', async () => {
      const form = makeForm<CalculatorForm>({
        price: { value: 100, component: null as ComponentInstance },
        quantity: { value: 10, component: null as ComponentInstance },
        discount: { value: 10, component: null as ComponentInstance },
        total: { value: 0, component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        initialPayment: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<CalculatorForm> = (path: FieldPath<CalculatorForm>) => {
        computeFrom(
          [path.price, path.quantity, path.discount],
          path.total,
          (values: CalculatorForm) => {
            const subtotal = values.price * values.quantity;
            const discountAmount = subtotal * (values.discount / 100);
            return subtotal - discountAmount;
          }
        );
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // 100 * 10 = 1000, 10% discount = 100, total = 900
      expect(form.total.value.value).toBe(900);
    });

    it('should handle null values gracefully', async () => {
      type NullableForm = {
        a: number | null;
        b: number | null;
        result: number | null;
      };

      const form = makeForm<NullableForm>({
        a: { value: null, component: null as ComponentInstance },
        b: { value: 10, component: null as ComponentInstance },
        result: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        computeFrom([path.a, path.b], path.result, (values: NullableForm) => {
          if (values.a === null || values.b === null) return null;
          return values.a + values.b;
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // a is null, so result should be null
      expect(form.result.value.value).toBe(null);

      // Set a
      form.a.setValue(5);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.result.value.value).toBe(15);
    });
  });

  describe('condition option', () => {
    it('should only compute when condition is true', async () => {
      type ConditionalForm = {
        mode: string;
        input: number;
        output: number;
      };

      const form = makeForm<ConditionalForm>({
        mode: { value: 'disabled', component: null as ComponentInstance },
        input: { value: 100, component: null as ComponentInstance },
        output: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<ConditionalForm> = (path: FieldPath<ConditionalForm>) => {
        computeFrom([path.input], path.output, (values: ConditionalForm) => values.input * 2, {
          condition: (f) => f.mode === 'enabled',
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Condition is false, so output should not be computed
      expect(form.output.value.value).toBe(0);

      // Enable condition and change input to trigger recompute
      form.mode.setValue('enabled');
      form.input.setValue(50);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.output.value.value).toBe(100);
    });
  });

  describe('cleanup', () => {
    it('should stop computing after cleanup', async () => {
      const form = makeForm<CalculatorForm>({
        price: { value: 100, component: null as ComponentInstance },
        quantity: { value: 5, component: null as ComponentInstance },
        discount: { value: 0, component: null as ComponentInstance },
        total: { value: 0, component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        initialPayment: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<CalculatorForm> = (path: FieldPath<CalculatorForm>) => {
        computeFrom(
          [path.price, path.quantity],
          path.total,
          (values: CalculatorForm) => values.price * values.quantity
        );
      };

      const cleanup = form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));
      expect(form.total.value.value).toBe(500);

      // Cleanup
      cleanup();

      // Change source after cleanup
      form.price.setValue(200);

      await new Promise((r) => setTimeout(r, 10));

      // Total should NOT be recomputed after cleanup
      expect(form.total.value.value).toBe(500);
    });
  });
});
