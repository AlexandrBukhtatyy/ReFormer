/**
 * Unit tests for Pattern validator
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/make-form';
import { pattern } from '../../../../src/core/validation/validators/pattern';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('pattern validator', () => {
  interface StringForm {
    code: string;
  }

  describe('basic functionality', () => {
    it('should return error when value does not match pattern', async () => {
      const form = makeForm<StringForm>({
        code: { value: 'abc', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        pattern(path.code, /^[0-9]+$/);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.code.valid.value).toBe(false);
      expect(form.code.errors.value).toHaveLength(1);
      expect(form.code.errors.value[0].code).toBe('pattern');
    });

    it('should pass when value matches pattern', async () => {
      const form = makeForm<StringForm>({
        code: { value: '12345', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        pattern(path.code, /^[0-9]+$/);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.code.valid.value).toBe(true);
    });

    it('should pass for partial match with proper regex', async () => {
      const form = makeForm<StringForm>({
        code: { value: 'test123', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        pattern(path.code, /[0-9]+/); // Contains digits
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.code.valid.value).toBe(true);
    });
  });

  describe('empty values', () => {
    it('should pass for empty string (use required for mandatory)', async () => {
      const form = makeForm<StringForm>({
        code: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        pattern(path.code, /^[0-9]+$/);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.code.valid.value).toBe(true);
    });

    it('should pass for null', async () => {
      interface NullableForm {
        text: string | null;
      }

      const form = makeForm<NullableForm>({
        text: { value: null, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        pattern(path.text, /^[A-Z]+$/);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.text.valid.value).toBe(true);
    });
  });

  describe('common patterns', () => {
    it('should validate alphanumeric only', async () => {
      const form = makeForm<StringForm>({
        code: { value: 'abc123', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        pattern(path.code, /^[a-zA-Z0-9]+$/);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.code.valid.value).toBe(true);
    });

    it('should reject special characters when not allowed', async () => {
      const form = makeForm<StringForm>({
        code: { value: 'abc@123', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        pattern(path.code, /^[a-zA-Z0-9]+$/);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.code.valid.value).toBe(false);
    });

    it('should validate UUID format', async () => {
      const form = makeForm<StringForm>({
        code: { value: '550e8400-e29b-41d4-a716-446655440000', component: null as ComponentInstance },
      });

      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        pattern(path.code, uuidPattern);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.code.valid.value).toBe(true);
    });
  });

  describe('error params', () => {
    it('should include pattern in error params', async () => {
      const form = makeForm<StringForm>({
        code: { value: 'invalid', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        pattern(path.code, /^[0-9]+$/);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.code.errors.value[0].params?.pattern).toBe('^[0-9]+$');
    });

    it('should use custom message', async () => {
      const form = makeForm<StringForm>({
        code: { value: 'invalid', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        pattern(path.code, /^[0-9]+$/, { message: 'Code must contain only digits' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.code.errors.value[0].message).toBe('Code must contain only digits');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fieldPath', () => {
      expect(() => pattern(undefined, /test/)).not.toThrow();
    });

    it('should handle case-insensitive patterns', async () => {
      const form = makeForm<StringForm>({
        code: { value: 'ABC', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        pattern(path.code, /^abc$/i);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.code.valid.value).toBe(true);
    });
  });
});
