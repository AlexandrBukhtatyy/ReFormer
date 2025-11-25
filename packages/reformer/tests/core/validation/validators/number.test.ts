/**
 * Unit tests for Number validator
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/create-form';
import { number } from '../../../../src/core/validation/validators/number';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('number validator', () => {
  interface NumberForm {
    amount: number;
  }

  describe('basic functionality', () => {
    it('should pass for valid number', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: 42, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(true);
    });

    it('should pass for zero', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: 0, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(true);
    });

    it('should pass for negative numbers', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: -10, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(true);
    });

    it('should pass for decimal numbers', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: 3.14, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(true);
    });
  });

  describe('integer option', () => {
    it('should fail for decimal when integer is required', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: 3.14, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount, { integer: true });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(false);
      expect(form.amount.errors.value[0].code).toBe('number_integer');
    });

    it('should pass for integer when integer is required', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: 42, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount, { integer: true });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(true);
    });
  });

  describe('min/max options', () => {
    it('should fail when value is below min', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: 5, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount, { min: 10 });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(false);
      expect(form.amount.errors.value[0].code).toBe('number_min');
    });

    it('should fail when value exceeds max', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: 150, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount, { max: 100 });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(false);
      expect(form.amount.errors.value[0].code).toBe('number_max');
    });

    it('should pass when value is within range', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: 50, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount, { min: 0, max: 100 });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(true);
    });
  });

  describe('multipleOf option', () => {
    it('should fail when value is not multiple of specified number', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: 7, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount, { multipleOf: 5 });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(false);
      expect(form.amount.errors.value[0].code).toBe('number_multiple');
    });

    it('should pass when value is multiple of specified number', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: 15, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount, { multipleOf: 5 });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(true);
    });
  });

  describe('allowNegative option', () => {
    it('should fail for negative when allowNegative is false', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: -5, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount, { allowNegative: false });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(false);
      expect(form.amount.errors.value[0].code).toBe('number_negative');
    });
  });

  describe('allowZero option', () => {
    it('should fail for zero when allowZero is false', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: 0, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount, { allowZero: false });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.valid.value).toBe(false);
      expect(form.amount.errors.value[0].code).toBe('number_zero');
    });
  });

  describe('empty values', () => {
    it('should pass for null (use required for mandatory)', async () => {
      interface NullableForm {
        quantity: number | null;
      }

      const form = makeForm<NullableForm>({
        quantity: { value: null, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        number(path.quantity);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.quantity.valid.value).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fieldPath', () => {
      expect(() => number(undefined)).not.toThrow();
    });

    it('should use custom message', async () => {
      const form = makeForm<NumberForm>({
        amount: { value: 5, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        number(path.amount, { min: 10, message: 'Amount must be at least 10' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.amount.errors.value[0].message).toBe('Amount must be at least 10');
    });
  });
});
