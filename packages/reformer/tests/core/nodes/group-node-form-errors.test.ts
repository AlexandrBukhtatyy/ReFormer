/**
 * Unit tests for GroupNode form-level validation errors
 *
 * Tests setErrors(), clearErrors(), and computed errors/valid integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { GroupNodeWithControls, ValidationError } from '../../../src/core/types';
import { makeForm } from '../../../src/core/utils/make-form';

describe('GroupNode - Form-level Errors', () => {
  interface TestForm {
    email: string;
    password: string;
    confirmPassword: string;
  }

  let form: GroupNodeWithControls<TestForm>;

  beforeEach(() => {
    form = makeForm<TestForm>({
      email: { value: '', component: null as any },
      password: { value: '', component: null as any },
      confirmPassword: { value: '', component: null as any },
    });
  });

  describe('setErrors()', () => {
    it('should set form-level errors', () => {
      const errors: ValidationError[] = [
        { code: 'server_error', message: 'Server validation failed' },
      ];

      form.setErrors(errors);

      expect(form.errors.value).toHaveLength(1);
      expect(form.errors.value[0]).toEqual(errors[0]);
    });

    it('should set multiple form-level errors', () => {
      const errors: ValidationError[] = [
        { code: 'duplicate_email', message: 'Email already exists' },
        { code: 'rate_limit', message: 'Too many requests' },
      ];

      form.setErrors(errors);

      expect(form.errors.value).toHaveLength(2);
      expect(form.errors.value).toEqual(errors);
    });

    it('should replace previous form-level errors', () => {
      form.setErrors([{ code: 'error1', message: 'First error' }]);

      form.setErrors([{ code: 'error2', message: 'Second error' }]);

      expect(form.errors.value).toHaveLength(1);
      expect(form.errors.value[0].code).toBe('error2');
    });

    it('should set empty array to clear form-level errors', () => {
      form.setErrors([{ code: 'error', message: 'Some error' }]);

      form.setErrors([]);

      expect(form.errors.value).toHaveLength(0);
    });
  });

  describe('clearErrors()', () => {
    it('should clear form-level errors', () => {
      form.setErrors([{ code: 'server_error', message: 'Server error' }]);

      form.clearErrors();

      expect(form.errors.value).toHaveLength(0);
    });

    it('should clear both form-level and field-level errors', () => {
      // Set form-level error
      form.setErrors([{ code: 'form_error', message: 'Form error' }]);

      // Set field-level error
      form.email.setErrors([{ code: 'field_error', message: 'Field error' }]);

      expect(form.errors.value).toHaveLength(2);

      // Clear all errors
      form.clearErrors();

      expect(form.errors.value).toHaveLength(0);
      expect(form.email.errors.value).toHaveLength(0);
    });

    it('should clear errors from all fields', () => {
      form.email.setErrors([{ code: 'email_error', message: 'Email error' }]);
      form.password.setErrors([{ code: 'password_error', message: 'Password error' }]);
      form.setErrors([{ code: 'form_error', message: 'Form error' }]);

      form.clearErrors();

      expect(form.email.errors.value).toHaveLength(0);
      expect(form.password.errors.value).toHaveLength(0);
      expect(form.errors.value).toHaveLength(0);
    });
  });

  describe('computed errors', () => {
    it('should include form-level errors in computed errors', () => {
      const formError: ValidationError = {
        code: 'form_error',
        message: 'Form-level error',
      };

      form.setErrors([formError]);

      expect(form.errors.value).toContainEqual(formError);
    });

    it('should include both form-level and field-level errors', () => {
      const formError: ValidationError = {
        code: 'form_error',
        message: 'Form error',
      };

      const fieldError: ValidationError = {
        code: 'field_error',
        message: 'Field error',
      };

      form.setErrors([formError]);
      form.email.setErrors([fieldError]);

      expect(form.errors.value).toHaveLength(2);
      expect(form.errors.value).toContainEqual(formError);
      expect(form.errors.value).toContainEqual(fieldError);
    });

    it('should order form-level errors before field-level errors', () => {
      const formError: ValidationError = {
        code: 'form_error',
        message: 'Form error',
      };

      const fieldError: ValidationError = {
        code: 'field_error',
        message: 'Field error',
      };

      form.setErrors([formError]);
      form.email.setErrors([fieldError]);

      // Form-level errors должны быть первыми
      expect(form.errors.value[0]).toEqual(formError);
      expect(form.errors.value[1]).toEqual(fieldError);
    });

    it('should collect errors from multiple fields', () => {
      const formError: ValidationError = {
        code: 'form_error',
        message: 'Form error',
      };

      form.setErrors([formError]);
      form.email.setErrors([{ code: 'email_error', message: 'Email error' }]);
      form.password.setErrors([{ code: 'password_error', message: 'Password error' }]);

      expect(form.errors.value).toHaveLength(3);
      expect(form.errors.value[0].code).toBe('form_error');
    });
  });

  describe('computed valid', () => {
    it('should be invalid when form-level errors exist', () => {
      expect(form.valid.value).toBe(true);

      form.setErrors([{ code: 'error', message: 'Error' }]);

      expect(form.valid.value).toBe(false);
      expect(form.invalid.value).toBe(true);
    });

    it('should be valid when no form-level errors', () => {
      form.setErrors([{ code: 'error', message: 'Error' }]);

      expect(form.valid.value).toBe(false);

      form.setErrors([]);

      expect(form.valid.value).toBe(true);
    });

    it('should be invalid when field errors exist (without form-level errors)', () => {
      form.email.setErrors([{ code: 'field_error', message: 'Field error' }]);

      expect(form.valid.value).toBe(false);
    });

    it('should be invalid when both form-level and field-level errors exist', () => {
      form.setErrors([{ code: 'form_error', message: 'Form error' }]);
      form.email.setErrors([{ code: 'field_error', message: 'Field error' }]);

      expect(form.valid.value).toBe(false);
      expect(form.invalid.value).toBe(true);
    });

    it('should be valid when all errors cleared', () => {
      form.setErrors([{ code: 'form_error', message: 'Form error' }]);
      form.email.setErrors([{ code: 'field_error', message: 'Field error' }]);

      expect(form.valid.value).toBe(false);

      form.clearErrors();

      expect(form.valid.value).toBe(true);
      expect(form.invalid.value).toBe(false);
    });
  });

  describe('Nested GroupNode', () => {
    interface NestedForm {
      user: {
        name: string;
        email: string;
      };
    }

    it('should handle form-level errors in nested groups independently', () => {
      const nestedForm = makeForm<NestedForm>({
        user: {
          name: { value: '', component: null as any },
          email: { value: '', component: null as any },
        },
      });

      // Set error на root form
      nestedForm.setErrors([{ code: 'root_error', message: 'Root error' }]);

      // Set error на nested group
      nestedForm.user.setErrors([{ code: 'user_error', message: 'User error' }]);

      // Root form должен включать свои errors
      expect(nestedForm.errors.value.some((e: ValidationError) => e.code === 'root_error')).toBe(
        true
      );

      // Nested group должен включать свои errors
      expect(
        nestedForm.user.errors.value.some((e: ValidationError) => e.code === 'user_error')
      ).toBe(true);

      // Root form должен включать errors вложенных групп
      expect(nestedForm.errors.value.some((e: ValidationError) => e.code === 'user_error')).toBe(
        true
      );
    });

    it('should clear form-level errors recursively', () => {
      const nestedForm = makeForm<NestedForm>({
        user: {
          name: { value: '', component: null as any },
          email: { value: '', component: null as any },
        },
      });

      nestedForm.setErrors([{ code: 'root_error', message: 'Root error' }]);
      nestedForm.user.setErrors([{ code: 'user_error', message: 'User error' }]);

      nestedForm.clearErrors();

      // Root errors очищены
      expect(nestedForm.errors.value.every((e: ValidationError) => e.code !== 'root_error')).toBe(
        true
      );

      // Nested errors очищены
      expect(nestedForm.user.errors.value).toHaveLength(0);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle server-side validation error', async () => {
      // Simulate form submission
      form.email.setValue('test@mail.com');
      form.password.setValue('password123');

      // Simulate server response with validation error
      const serverError: ValidationError = {
        code: 'duplicate_email',
        message: 'This email is already registered',
      };

      form.setErrors([serverError]);

      expect(form.valid.value).toBe(false);
      expect(form.errors.value).toContainEqual(serverError);
    });

    it('should clear errors before retry submit', () => {
      // First submit failed
      form.setErrors([{ code: 'server_error', message: 'Server error' }]);

      expect(form.valid.value).toBe(false);

      // User fixes and retries
      form.clearErrors();
      form.email.setValue('new@mail.com');

      expect(form.valid.value).toBe(true);
    });

    it('should combine field validation with form-level errors', () => {
      // Client-side field validation
      form.email.setErrors([{ code: 'required', message: 'Email is required' }]);

      // Server-side form-level validation
      form.setErrors([{ code: 'captcha_failed', message: 'Captcha verification failed' }]);

      expect(form.errors.value).toHaveLength(2);
      expect(form.valid.value).toBe(false);
    });

    it('should handle cross-field validation errors', () => {
      // Passwords don't match - form-level error
      form.password.setValue('password123');
      form.confirmPassword.setValue('different');

      form.setErrors([{ code: 'passwords_mismatch', message: 'Passwords do not match' }]);

      expect(form.valid.value).toBe(false);
      expect(form.errors.value.some((e: ValidationError) => e.code === 'passwords_mismatch')).toBe(
        true
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle setErrors with undefined', () => {
      // Не должно упасть
      expect(() => form.setErrors([] as any)).not.toThrow();
    });

    it('should handle clearErrors on fresh form', () => {
      // Не должно упасть
      expect(() => form.clearErrors()).not.toThrow();
      expect(form.errors.value).toHaveLength(0);
    });

    it('should handle multiple setErrors calls', () => {
      form.setErrors([{ code: 'error1', message: 'Error 1' }]);
      form.setErrors([{ code: 'error2', message: 'Error 2' }]);
      form.setErrors([{ code: 'error3', message: 'Error 3' }]);

      expect(form.errors.value).toHaveLength(1);
      expect(form.errors.value[0].code).toBe('error3');
    });

    it('should handle setErrors after clearErrors', () => {
      form.setErrors([{ code: 'error1', message: 'Error 1' }]);
      form.clearErrors();
      form.setErrors([{ code: 'error2', message: 'Error 2' }]);

      expect(form.errors.value).toHaveLength(1);
      expect(form.errors.value[0].code).toBe('error2');
    });
  });
});
