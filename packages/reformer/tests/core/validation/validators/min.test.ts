/**
 * Unit tests for Min validator
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/make-form';
import { min } from '../../../../src/core/validation/validators/min';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('min validator', () => {
  interface NumberForm {
    age: number;
  }

  describe('basic functionality', () => {
    it('should return error when value is below minimum', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 15, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        min(path.age, 18);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(false);
      expect(form.age.errors.value).toHaveLength(1);
      expect(form.age.errors.value[0].code).toBe('min');
    });

    it('should pass when value equals minimum (boundary included)', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 18, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        min(path.age, 18);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(true);
    });

    it('should pass when value is above minimum', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 25, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        min(path.age, 18);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(true);
    });
  });

  describe('nullable values', () => {
    interface NullableForm {
      amount: number | null;
    }

    it('should pass for null (use required for mandatory)', async () => {
      const form = makeForm<NullableForm>({
        amount: { value: null, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        min(path.amount, 10);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      // null should pass - use required() for mandatory fields
      expect(form.amount.valid.value).toBe(true);
    });
  });

  describe('negative numbers', () => {
    it('should work with negative minimum', async () => {
      const form = makeForm<NumberForm>({
        age: { value: -15, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        min(path.age, -10);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(false);
      expect(form.age.errors.value[0].code).toBe('min');
    });

    it('should pass when negative value is above minimum', async () => {
      const form = makeForm<NumberForm>({
        age: { value: -5, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        min(path.age, -10);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(true);
    });
  });

  describe('error params', () => {
    it('should include min value in error params', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 5, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        min(path.age, 18);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.errors.value[0].params?.min).toBe(18);
      expect(form.age.errors.value[0].params?.actual).toBe(5);
    });

    it('should use custom message', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 10, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        min(path.age, 18, { message: 'Must be at least 18 years old' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.errors.value[0].message).toBe('Must be at least 18 years old');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fieldPath', () => {
      expect(() => min(undefined, 10)).not.toThrow();
    });

    it('should handle zero as minimum', async () => {
      const form = makeForm<NumberForm>({
        age: { value: -1, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        min(path.age, 0);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(false);
    });

    it('should pass zero when minimum is zero', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 0, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        min(path.age, 0);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(true);
    });
  });
});
