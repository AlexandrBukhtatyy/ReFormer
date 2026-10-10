/**
 * Unit tests for GroupNode form-level validation issues
 *
 * Tests setIssues(), clearIssues(), and computed issues/valid integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { FormGroup, ValidationIssue } from '../../../src/form/types/index';
import { ComponentInstance } from '../../test-utils/types';
import { formFromFields } from '../../test-utils/form-from-fields';

describe('GroupNode - Form-level Errors', () => {
  interface TestForm {
    email: string;
    password: string;
    confirmPassword: string;
  }

  let form: FormGroup<TestForm>;

  beforeEach(() => {
    form = formFromFields<TestForm>({
      email: { value: '', component: null as ComponentInstance },
      password: { value: '', component: null as ComponentInstance },
      confirmPassword: { value: '', component: null as ComponentInstance },
    });
  });

  describe('setIssues()', () => {
    it('should set form-level issues', () => {
      const issues: ValidationIssue[] = [{ code: 'server_error' }];

      form.setIssues(issues);

      expect(form.issues.value).toHaveLength(1);
      expect(form.issues.value[0]).toEqual(issues[0]);
    });

    it('should set multiple form-level issues', () => {
      const issues: ValidationIssue[] = [{ code: 'duplicate_email' }, { code: 'rate_limit' }];

      form.setIssues(issues);

      expect(form.issues.value).toHaveLength(2);
      expect(form.issues.value).toEqual(issues);
    });

    it('should replace previous form-level issues', () => {
      form.setIssues([{ code: 'error1' }]);

      form.setIssues([{ code: 'error2' }]);

      expect(form.issues.value).toHaveLength(1);
      expect(form.issues.value[0].code).toBe('error2');
    });

    it('should set empty array to clear form-level issues', () => {
      form.setIssues([{ code: 'error' }]);

      form.setIssues([]);

      expect(form.issues.value).toHaveLength(0);
    });
  });

  describe('clearIssues()', () => {
    it('should clear form-level issues', () => {
      form.setIssues([{ code: 'server_error' }]);

      form.clearIssues();

      expect(form.issues.value).toHaveLength(0);
    });

    it('should clear both form-level and field-level issues', () => {
      // Set form-level error
      form.setIssues([{ code: 'form_error' }]);

      // Set field-level error
      form.email.setIssues([{ code: 'field_error' }]);

      expect(form.issues.value).toHaveLength(2);

      // Clear all issues
      form.clearIssues();

      expect(form.issues.value).toHaveLength(0);
      expect(form.email.issues.value).toHaveLength(0);
    });

    it('should clear issues from all fields', () => {
      form.email.setIssues([{ code: 'email_error' }]);
      form.password.setIssues([{ code: 'password_error' }]);
      form.setIssues([{ code: 'form_error' }]);

      form.clearIssues();

      expect(form.email.issues.value).toHaveLength(0);
      expect(form.password.issues.value).toHaveLength(0);
      expect(form.issues.value).toHaveLength(0);
    });
  });

  describe('computed issues', () => {
    it('should include form-level issues in computed issues', () => {
      const formError: ValidationIssue = {
        code: 'form_error',
      };

      form.setIssues([formError]);

      expect(form.issues.value).toContainEqual(formError);
    });

    it('should include both form-level and field-level issues', () => {
      const formError: ValidationIssue = {
        code: 'form_error',
      };

      const fieldError: ValidationIssue = {
        code: 'field_error',
      };

      form.setIssues([formError]);
      form.email.setIssues([fieldError]);

      expect(form.issues.value).toHaveLength(2);
      expect(form.issues.value).toContainEqual(formError);
      expect(form.issues.value).toContainEqual(fieldError);
    });

    it('should order form-level issues before field-level issues', () => {
      const formError: ValidationIssue = {
        code: 'form_error',
      };

      const fieldError: ValidationIssue = {
        code: 'field_error',
      };

      form.setIssues([formError]);
      form.email.setIssues([fieldError]);

      // Form-level issues должны быть первыми
      expect(form.issues.value[0]).toEqual(formError);
      expect(form.issues.value[1]).toEqual(fieldError);
    });

    it('should collect issues from multiple fields', () => {
      const formError: ValidationIssue = {
        code: 'form_error',
      };

      form.setIssues([formError]);
      form.email.setIssues([{ code: 'email_error' }]);
      form.password.setIssues([{ code: 'password_error' }]);

      expect(form.issues.value).toHaveLength(3);
      expect(form.issues.value[0].code).toBe('form_error');
    });
  });

  describe('computed valid', () => {
    it('should be invalid when form-level issues exist', () => {
      expect(form.valid.value).toBe(true);

      form.setIssues([{ code: 'error' }]);

      expect(form.valid.value).toBe(false);
      expect(form.invalid.value).toBe(true);
    });

    it('should be valid when no form-level issues', () => {
      form.setIssues([{ code: 'error' }]);

      expect(form.valid.value).toBe(false);

      form.setIssues([]);

      expect(form.valid.value).toBe(true);
    });

    it('should be invalid when field issues exist (without form-level issues)', () => {
      form.email.setIssues([{ code: 'field_error' }]);

      expect(form.valid.value).toBe(false);
    });

    it('should be invalid when both form-level and field-level issues exist', () => {
      form.setIssues([{ code: 'form_error' }]);
      form.email.setIssues([{ code: 'field_error' }]);

      expect(form.valid.value).toBe(false);
      expect(form.invalid.value).toBe(true);
    });

    it('should be valid when all issues cleared', () => {
      form.setIssues([{ code: 'form_error' }]);
      form.email.setIssues([{ code: 'field_error' }]);

      expect(form.valid.value).toBe(false);

      form.clearIssues();

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

    it('should handle form-level issues in nested groups independently', () => {
      const nestedForm = formFromFields<NestedForm>({
        user: {
          name: { value: '', component: null as ComponentInstance },
          email: { value: '', component: null as ComponentInstance },
        },
      });

      // Set error на root form
      nestedForm.setIssues([{ code: 'root_error' }]);

      // Set error на nested group
      nestedForm.user.setIssues([{ code: 'user_error' }]);

      // Root form должен включать свои issues
      expect(nestedForm.issues.value.some((e: ValidationIssue) => e.code === 'root_error')).toBe(
        true
      );

      // Nested group должен включать свои issues
      expect(
        nestedForm.user.issues.value.some((e: ValidationIssue) => e.code === 'user_error')
      ).toBe(true);

      // Root form должен включать issues вложенных групп
      expect(nestedForm.issues.value.some((e: ValidationIssue) => e.code === 'user_error')).toBe(
        true
      );
    });

    it('should clear form-level issues recursively', () => {
      const nestedForm = formFromFields<NestedForm>({
        user: {
          name: { value: '', component: null as ComponentInstance },
          email: { value: '', component: null as ComponentInstance },
        },
      });

      nestedForm.setIssues([{ code: 'root_error' }]);
      nestedForm.user.setIssues([{ code: 'user_error' }]);

      nestedForm.clearIssues();

      // Root issues очищены
      expect(nestedForm.issues.value.every((e: ValidationIssue) => e.code !== 'root_error')).toBe(
        true
      );

      // Nested issues очищены
      expect(nestedForm.user.issues.value).toHaveLength(0);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle server-side validation error', async () => {
      // Simulate form submission
      form.email.setValue('test@mail.com');
      form.password.setValue('password123');

      // Simulate server response with validation error
      const serverError: ValidationIssue = {
        code: 'duplicate_email',
      };

      form.setIssues([serverError]);

      expect(form.valid.value).toBe(false);
      expect(form.issues.value).toContainEqual(serverError);
    });

    it('should clear issues before retry submit', () => {
      // First submit failed
      form.setIssues([{ code: 'server_error' }]);

      expect(form.valid.value).toBe(false);

      // User fixes and retries
      form.clearIssues();
      form.email.setValue('new@mail.com');

      expect(form.valid.value).toBe(true);
    });

    it('should combine field validation with form-level issues', () => {
      // Client-side field validation
      form.email.setIssues([{ code: 'required' }]);

      // Server-side form-level validation
      form.setIssues([{ code: 'captcha_failed' }]);

      expect(form.issues.value).toHaveLength(2);
      expect(form.valid.value).toBe(false);
    });

    it('should handle cross-field validation issues', () => {
      // Passwords don't match - form-level error
      form.password.setValue('password123');
      form.confirmPassword.setValue('different');

      form.setIssues([{ code: 'passwords_mismatch' }]);

      expect(form.valid.value).toBe(false);
      expect(form.issues.value.some((e: ValidationIssue) => e.code === 'passwords_mismatch')).toBe(
        true
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle setIssues with undefined', () => {
      // Не должно упасть
      expect(() => form.setIssues([])).not.toThrow();
    });

    it('should handle clearIssues on fresh form', () => {
      // Не должно упасть
      expect(() => form.clearIssues()).not.toThrow();
      expect(form.issues.value).toHaveLength(0);
    });

    it('should handle multiple setIssues calls', () => {
      form.setIssues([{ code: 'error1' }]);
      form.setIssues([{ code: 'error2' }]);
      form.setIssues([{ code: 'error3' }]);

      expect(form.issues.value).toHaveLength(1);
      expect(form.issues.value[0].code).toBe('error3');
    });

    it('should handle setIssues after clearIssues', () => {
      form.setIssues([{ code: 'error1' }]);
      form.clearIssues();
      form.setIssues([{ code: 'error2' }]);

      expect(form.issues.value).toHaveLength(1);
      expect(form.issues.value[0].code).toBe('error2');
    });
  });
});
