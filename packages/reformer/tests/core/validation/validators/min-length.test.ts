/**
 * Unit tests for MinLength validator
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/make-form';
import { minLength } from '../../../../src/core/validation/validators/min-length';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('minLength validator', () => {
  interface StringForm {
    name: string;
  }

  describe('basic functionality', () => {
    it('should return error when string is too short', async () => {
      const form = makeForm<StringForm>({
        name: { value: 'ab', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        minLength(path.name, 3);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(false);
      expect(form.name.errors.value).toHaveLength(1);
      expect(form.name.errors.value[0].code).toBe('minLength');
    });

    it('should pass when string equals minimum length', async () => {
      const form = makeForm<StringForm>({
        name: { value: 'abc', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        minLength(path.name, 3);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(true);
    });

    it('should pass when string exceeds minimum length', async () => {
      const form = makeForm<StringForm>({
        name: { value: 'abcdef', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        minLength(path.name, 3);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(true);
    });
  });

  describe('empty values', () => {
    it('should pass for empty string (use required for mandatory)', async () => {
      const form = makeForm<StringForm>({
        name: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        minLength(path.name, 3);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      // Empty string should pass - use required() for mandatory fields
      expect(form.name.valid.value).toBe(true);
    });

    it('should pass for null (use required for mandatory)', async () => {
      interface NullableForm {
        text: string | null;
      }

      const form = makeForm<NullableForm>({
        text: { value: null, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        minLength(path.text, 5);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.text.valid.value).toBe(true);
    });
  });

  describe('error params', () => {
    it('should include length values in error params', async () => {
      const form = makeForm<StringForm>({
        name: { value: 'ab', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        minLength(path.name, 5);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.errors.value[0].params?.minLength).toBe(5);
      expect(form.name.errors.value[0].params?.actualLength).toBe(2);
    });

    it('should use custom message', async () => {
      const form = makeForm<StringForm>({
        name: { value: 'a', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        minLength(path.name, 3, { message: 'Name must be at least 3 characters' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.errors.value[0].message).toBe('Name must be at least 3 characters');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fieldPath', () => {
      expect(() => minLength(undefined, 3)).not.toThrow();
    });

    it('should handle minimum length of 0', async () => {
      const form = makeForm<StringForm>({
        name: { value: 'a', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        minLength(path.name, 0);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(true);
    });

    it('should handle minimum length of 1', async () => {
      const form = makeForm<StringForm>({
        name: { value: 'a', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        minLength(path.name, 1);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(true);
    });

    it('should handle whitespace-only string', async () => {
      const form = makeForm<StringForm>({
        name: { value: '   ', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        minLength(path.name, 3);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      // Whitespace counts as characters
      expect(form.name.valid.value).toBe(true);
    });
  });
});
