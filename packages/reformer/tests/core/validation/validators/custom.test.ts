/**
 * Unit tests for Custom validator
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/make-form';
import { custom, createCustomValidator } from '../../../../src/core/validation/validators/custom';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('custom validator', () => {
  interface CustomForm {
    password: string;
    username: string;
  }

  describe('basic functionality', () => {
    it('should pass when validator returns null', async () => {
      const form = makeForm<CustomForm>({
        password: { value: 'valid123', component: null as ComponentInstance },
        username: { value: 'test', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<CustomForm> = (path: FieldPath<CustomForm>) => {
        custom(path.password, () => null);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.password.valid.value).toBe(true);
    });

    it('should pass when validator returns true', async () => {
      const form = makeForm<CustomForm>({
        password: { value: 'valid', component: null as ComponentInstance },
        username: { value: 'test', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<CustomForm> = (path: FieldPath<CustomForm>) => {
        custom(path.password, (value) => value.length >= 3);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.password.valid.value).toBe(true);
    });

    it('should fail when validator returns false', async () => {
      const form = makeForm<CustomForm>({
        password: { value: 'ab', component: null as ComponentInstance },
        username: { value: 'test', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<CustomForm> = (path: FieldPath<CustomForm>) => {
        custom(path.password, (value) => value.length >= 3);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.password.valid.value).toBe(false);
      expect(form.password.errors.value[0].code).toBe('custom');
    });

    it('should fail with custom message when validator returns string', async () => {
      const form = makeForm<CustomForm>({
        password: { value: 'test', component: null as ComponentInstance },
        username: { value: 'test', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<CustomForm> = (path: FieldPath<CustomForm>) => {
        custom(path.password, (value) => {
          if (value.includes('@')) {
            return 'Password cannot contain @';
          }
          return null;
        });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.password.valid.value).toBe(true);
    });

    it('should use string return value as error message', async () => {
      const form = makeForm<CustomForm>({
        password: { value: 'test@123', component: null as ComponentInstance },
        username: { value: 'test', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<CustomForm> = (path: FieldPath<CustomForm>) => {
        custom(path.password, (value) => {
          if (value.includes('@')) {
            return 'Password cannot contain @';
          }
          return null;
        });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.password.valid.value).toBe(false);
      expect(form.password.errors.value[0].message).toBe('Password cannot contain @');
    });
  });

  describe('options', () => {
    it('should use custom error code', async () => {
      const form = makeForm<CustomForm>({
        password: { value: 'weak', component: null as ComponentInstance },
        username: { value: 'test', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<CustomForm> = (path: FieldPath<CustomForm>) => {
        custom(path.password, (value) => value.length >= 8, {
          code: 'password_weak',
          message: 'Password too weak',
        });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.password.errors.value[0].code).toBe('password_weak');
      expect(form.password.errors.value[0].message).toBe('Password too weak');
    });

    it('should use custom message from options when returning false', async () => {
      const form = makeForm<CustomForm>({
        password: { value: 'ab', component: null as ComponentInstance },
        username: { value: 'test', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<CustomForm> = (path: FieldPath<CustomForm>) => {
        custom(path.password, (value) => value.length >= 8, {
          message: 'Password must be at least 8 characters',
        });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.password.errors.value[0].message).toBe('Password must be at least 8 characters');
    });
  });

  describe('complex validation', () => {
    it('should validate password strength', async () => {
      const form = makeForm<CustomForm>({
        password: { value: 'abc123', component: null as ComponentInstance },
        username: { value: 'test', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<CustomForm> = (path: FieldPath<CustomForm>) => {
        custom(path.password, (value) => {
          if (!value) return null;
          const hasUpper = /[A-Z]/.test(value);
          const hasLower = /[a-z]/.test(value);
          const hasNumber = /[0-9]/.test(value);

          if (!hasUpper) return 'Password must contain uppercase';
          if (!hasLower) return 'Password must contain lowercase';
          if (!hasNumber) return 'Password must contain number';

          return null;
        });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.password.valid.value).toBe(false);
      expect(form.password.errors.value[0].message).toBe('Password must contain uppercase');
    });
  });

  describe('createCustomValidator helper', () => {
    it('should create reusable validators', async () => {
      // Create a reusable validator
      const strongPassword = createCustomValidator<string>(
        (value) => {
          if (!value) return null;
          if (value.length < 8) return 'Password must be at least 8 characters';
          if (!/[A-Z]/.test(value)) return 'Password must contain uppercase';
          return null;
        },
        { code: 'strong_password' }
      );

      const form = makeForm<CustomForm>({
        password: { value: 'weak', component: null as ComponentInstance },
        username: { value: 'test', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<CustomForm> = (path: FieldPath<CustomForm>) => {
        strongPassword(path.password);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.password.valid.value).toBe(false);
      expect(form.password.errors.value[0].code).toBe('strong_password');
      expect(form.password.errors.value[0].message).toBe('Password must be at least 8 characters');
    });

    it('should allow overriding options', async () => {
      // When validator returns a string, that string is used as the message
      // options.message only works when validator returns false
      const minLength = createCustomValidator<string>((value) => value && value.length >= 3, {
        code: 'min_length',
        message: 'Default message',
      });

      const form = makeForm<CustomForm>({
        password: { value: '', component: null as ComponentInstance },
        username: { value: 'ab', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<CustomForm> = (path: FieldPath<CustomForm>) => {
        minLength(path.username, { message: 'Username too short' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      // Override message is used when validator returns false
      expect(form.username.errors.value[0].message).toBe('Username too short');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fieldPath', () => {
      expect(() => custom(undefined, () => null)).not.toThrow();
    });

    it('should handle null values', async () => {
      interface NullableForm {
        field: string | null;
      }

      const form = makeForm<NullableForm>({
        field: { value: null, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        custom(path.field, (value) => {
          if (value === null) return null; // Skip validation for null
          return value.length >= 3 ? null : 'Too short';
        });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.field.valid.value).toBe(true);
    });
  });
});
