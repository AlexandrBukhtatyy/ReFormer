/**
 * Unit tests for TransformValue behavior
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/create-form';
import {
  transformValue,
  transformers,
  createTransformer,
} from '../../../../src/core/behavior/behaviors/transform-value';
import type { BehaviorSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('transformValue behavior', () => {
  interface TransformForm {
    code: string;
    email: string;
    phone: string;
    amount: number;
  }

  describe('basic functionality', () => {
    it('should transform value to uppercase', async () => {
      const form = makeForm<TransformForm>({
        code: { value: 'abc', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
        phone: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<TransformForm> = (path: FieldPath<TransformForm>) => {
        transformValue(path.code, (value) => value?.toUpperCase());
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Initial value should be transformed
      expect(form.code.value.value).toBe('ABC');
    });

    it('should transform value when it changes', async () => {
      const form = makeForm<TransformForm>({
        code: { value: '', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
        phone: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<TransformForm> = (path: FieldPath<TransformForm>) => {
        transformValue(path.code, (value) => value?.toUpperCase());
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Set value
      form.code.setValue('hello');

      await new Promise((r) => setTimeout(r, 10));

      expect(form.code.value.value).toBe('HELLO');
    });

    it('should handle null values gracefully', async () => {
      interface NullableForm {
        text: string | null;
      }

      const form = makeForm<NullableForm>({
        text: { value: null, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        transformValue(path.text, (value) => value?.toUpperCase() ?? null);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Null should remain null
      expect(form.text.value.value).toBe(null);
    });

    it('should not apply transformation if value is unchanged', async () => {
      const form = makeForm<TransformForm>({
        code: { value: 'ABC', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
        phone: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<TransformForm> = (path: FieldPath<TransformForm>) => {
        transformValue(path.code, (value) => value?.toUpperCase());
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Already uppercase, should not change
      expect(form.code.value.value).toBe('ABC');
    });
  });

  describe('built-in transformers', () => {
    it('should use toLowerCase transformer', async () => {
      const form = makeForm<TransformForm>({
        code: { value: '', component: null as ComponentInstance },
        email: { value: 'TEST@EMAIL.COM', component: null as ComponentInstance },
        phone: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<TransformForm> = (path: FieldPath<TransformForm>) => {
        transformers.toLowerCase(path.email);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.email.value.value).toBe('test@email.com');
    });

    it('should use trim transformer', async () => {
      const form = makeForm<TransformForm>({
        code: { value: '', component: null as ComponentInstance },
        email: { value: '  test@email.com  ', component: null as ComponentInstance },
        phone: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<TransformForm> = (path: FieldPath<TransformForm>) => {
        transformers.trim(path.email);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.email.value.value).toBe('test@email.com');
    });

    it('should use digitsOnly transformer', async () => {
      const form = makeForm<TransformForm>({
        code: { value: '', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
        phone: { value: '+7 (900) 123-45-67', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<TransformForm> = (path: FieldPath<TransformForm>) => {
        transformers.digitsOnly(path.phone);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.phone.value.value).toBe('79001234567');
    });
  });

  describe('createTransformer helper', () => {
    it('should create reusable transformer', async () => {
      const capitalizeFirst = createTransformer<string>((value) => {
        if (!value) return value;
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      });

      const form = makeForm<TransformForm>({
        code: { value: 'hELLO', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
        phone: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<TransformForm> = (path: FieldPath<TransformForm>) => {
        capitalizeFirst(path.code);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.code.value.value).toBe('Hello');
    });
  });

  describe('cleanup', () => {
    it('should stop transforming after cleanup', async () => {
      const form = makeForm<TransformForm>({
        code: { value: '', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
        phone: { value: '', component: null as ComponentInstance },
        amount: { value: 0, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<TransformForm> = (path: FieldPath<TransformForm>) => {
        transformValue(path.code, (value) => value?.toUpperCase());
      };

      const cleanup = form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Set value before cleanup
      form.code.setValue('test');
      await new Promise((r) => setTimeout(r, 10));
      expect(form.code.value.value).toBe('TEST');

      // Cleanup
      cleanup();

      // Set value after cleanup - should NOT be transformed
      form.code.setValue('hello');
      await new Promise((r) => setTimeout(r, 10));

      // Value should remain as-is
      expect(form.code.value.value).toBe('hello');
    });
  });
});
