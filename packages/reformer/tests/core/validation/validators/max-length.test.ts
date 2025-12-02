/**
 * Unit tests for MaxLength validator
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../../src/core/utils/create-form';
import { maxLength } from '../../../../src/core/validation/validators/max-length';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('maxLength validator', () => {
  interface StringForm {
    name: string;
  }

  describe('basic functionality', () => {
    it('should return error when string exceeds maximum length', async () => {
      const form = createForm<StringForm>({
        name: { value: 'abcdef', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        maxLength(path.name, 3);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(false);
      expect(form.name.errors.value).toHaveLength(1);
      expect(form.name.errors.value[0].code).toBe('maxLength');
    });

    it('should pass when string equals maximum length', async () => {
      const form = createForm<StringForm>({
        name: { value: 'abc', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        maxLength(path.name, 3);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(true);
    });

    it('should pass when string is shorter than maximum', async () => {
      const form = createForm<StringForm>({
        name: { value: 'ab', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        maxLength(path.name, 5);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(true);
    });
  });

  describe('empty values', () => {
    it('should pass for empty string', async () => {
      const form = createForm<StringForm>({
        name: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        maxLength(path.name, 3);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(true);
    });

    it('should pass for null', async () => {
      interface NullableForm {
        text: string | null;
      }

      const form = createForm<NullableForm>({
        text: { value: null, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        maxLength(path.text, 5);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.text.valid.value).toBe(true);
    });
  });

  describe('error params', () => {
    it('should include length values in error params', async () => {
      const form = createForm<StringForm>({
        name: { value: 'abcdefgh', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        maxLength(path.name, 5);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.errors.value[0].params?.maxLength).toBe(5);
      expect(form.name.errors.value[0].params?.actualLength).toBe(8);
    });

    it('should use custom message', async () => {
      const form = createForm<StringForm>({
        name: { value: 'very long name', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        maxLength(path.name, 5, { message: 'Name must be at most 5 characters' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.errors.value[0].message).toBe('Name must be at most 5 characters');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fieldPath', () => {
      expect(() => maxLength(undefined, 3)).not.toThrow();
    });

    it('should handle maximum length of 0', async () => {
      const form = createForm<StringForm>({
        name: { value: 'a', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        maxLength(path.name, 0);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(false);
    });

    it('should pass empty string when maximum is 0', async () => {
      const form = createForm<StringForm>({
        name: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        maxLength(path.name, 0);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.name.valid.value).toBe(true);
    });

    it('should count whitespace as characters', async () => {
      const form = createForm<StringForm>({
        name: { value: '    ', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<StringForm> = (path: FieldPath<StringForm>) => {
        maxLength(path.name, 3);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      // 4 spaces exceeds max of 3
      expect(form.name.valid.value).toBe(false);
    });
  });
});
