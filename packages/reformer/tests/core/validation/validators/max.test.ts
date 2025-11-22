/**
 * Unit tests for Max validator
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/make-form';
import { max } from '../../../../src/core/validation/validators/max';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('max validator', () => {
  interface NumberForm {
    age: number;
  }

  describe('basic functionality', () => {
    it('should return error when value exceeds maximum', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 25, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        max(path.age, 18);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(false);
      expect(form.age.errors.value).toHaveLength(1);
      expect(form.age.errors.value[0].code).toBe('max');
    });

    it('should pass when value equals maximum (boundary included)', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 18, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        max(path.age, 18);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(true);
    });

    it('should pass when value is below maximum', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 10, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        max(path.age, 18);
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
        max(path.amount, 100);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      // null should pass - use required() for mandatory fields
      expect(form.amount.valid.value).toBe(true);
    });
  });

  describe('negative numbers', () => {
    it('should work with negative maximum', async () => {
      const form = makeForm<NumberForm>({
        age: { value: -5, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        max(path.age, -10);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(false);
      expect(form.age.errors.value[0].code).toBe('max');
    });

    it('should pass when negative value is below maximum', async () => {
      const form = makeForm<NumberForm>({
        age: { value: -15, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        max(path.age, -10);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(true);
    });
  });

  describe('error params', () => {
    it('should include max value in error params', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 25, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        max(path.age, 18);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.errors.value[0].params?.max).toBe(18);
      expect(form.age.errors.value[0].params?.actual).toBe(25);
    });

    it('should use custom message', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 100, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        max(path.age, 65, { message: 'Must be at most 65 years old' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.errors.value[0].message).toBe('Must be at most 65 years old');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fieldPath', () => {
      expect(() => max(undefined, 10)).not.toThrow();
    });

    it('should handle zero as maximum', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 1, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        max(path.age, 0);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(false);
    });

    it('should pass zero when maximum is zero', async () => {
      const form = makeForm<NumberForm>({
        age: { value: 0, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        max(path.age, 0);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.age.valid.value).toBe(true);
    });
  });
});
