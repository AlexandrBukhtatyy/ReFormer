/**
 * Unit tests for Required validator
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/make-form';
import { required } from '../../../../src/core/validation/validators/required';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('required validator', () => {
  describe('with string fields', () => {
    interface StringForm {
      name: string;
    }

    it('should return error for empty string', async () => {
      const form = makeForm<StringForm>({
        name: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        required(path.name);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(false);
      expect(form.name.errors.value).toHaveLength(1);
      expect(form.name.errors.value[0].code).toBe('required');
    });

    it('should pass for non-empty string', async () => {
      const form = makeForm<StringForm>({
        name: { value: 'John', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        required(path.name);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(true);
      expect(form.name.errors.value).toHaveLength(0);
    });

    it('should pass for whitespace-only string', async () => {
      // Note: required does not trim whitespace
      const form = makeForm<StringForm>({
        name: { value: '   ', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        required(path.name);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      // Whitespace is considered a value by default
      expect(form.name.valid.value).toBe(true);
    });
  });

  describe('with nullable fields', () => {
    interface NullableForm {
      data: string | null;
    }

    it('should return error for null', async () => {
      const form = makeForm<NullableForm>({
        data: { value: null, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        required(path.data);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.data.valid.value).toBe(false);
      expect(form.data.errors.value[0].code).toBe('required');
    });
  });

  describe('with boolean fields', () => {
    interface BooleanForm {
      accepted: boolean;
    }

    it('should return error for false (checkbox must be checked)', async () => {
      const form = makeForm<BooleanForm>({
        accepted: { value: false, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<BooleanForm> = (path: FieldPath<BooleanForm>) => {
        required(path.accepted);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.accepted.valid.value).toBe(false);
      expect(form.accepted.errors.value[0].code).toBe('required');
    });

    it('should pass for true', async () => {
      const form = makeForm<BooleanForm>({
        accepted: { value: true, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<BooleanForm> = (path: FieldPath<BooleanForm>) => {
        required(path.accepted);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.accepted.valid.value).toBe(true);
    });
  });

  describe('with number fields', () => {
    interface NumberForm {
      count: number;
    }

    it('should pass for zero (0 is a valid value)', async () => {
      const form = makeForm<NumberForm>({
        count: { value: 0, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        required(path.count);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.count.valid.value).toBe(true);
    });

    it('should pass for negative numbers', async () => {
      const form = makeForm<NumberForm>({
        count: { value: -5, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NumberForm> = (path: FieldPath<NumberForm>) => {
        required(path.count);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.count.valid.value).toBe(true);
    });
  });

  describe('custom message', () => {
    interface SimpleForm {
      field: string;
    }

    it('should use custom error message', async () => {
      const form = makeForm<SimpleForm>({
        field: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<SimpleForm> = (path: FieldPath<SimpleForm>) => {
        required(path.field, { message: 'Custom required message' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.field.errors.value[0].message).toBe('Custom required message');
    });

    it('should include custom params in error', async () => {
      const form = makeForm<SimpleForm>({
        field: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<SimpleForm> = (path: FieldPath<SimpleForm>) => {
        required(path.field, { params: { fieldName: 'Email' } });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.field.errors.value[0].params?.fieldName).toBe('Email');
    });
  });

  describe('edge cases', () => {
    interface EdgeForm {
      field: string;
    }

    it('should handle undefined fieldPath gracefully', () => {
      // required(undefined) should not throw
      expect(() => required(undefined)).not.toThrow();
    });

    it('should validate correctly after value change', async () => {
      const form = makeForm<EdgeForm>({
        field: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<EdgeForm> = (path: FieldPath<EdgeForm>) => {
        required(path.field);
      };

      form.applyValidationSchema(validation);

      // Initially invalid
      await form.validate();
      expect(form.field.valid.value).toBe(false);

      // Set value and clear errors before re-validation
      form.field.setValue('now has value');
      form.field.clearErrors();
      await form.validate();

      expect(form.field.valid.value).toBe(true);
    });
  });
});
