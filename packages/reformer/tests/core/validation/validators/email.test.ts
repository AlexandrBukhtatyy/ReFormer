/**
 * Unit tests for Email validator
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../../src/core/utils/create-form';
import { email } from '../../../../src/core/validation/validators/email';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('email validator', () => {
  interface EmailForm {
    email: string;
  }

  describe('valid emails', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.com',
      'user+tag@example.com',
      'user@sub.domain.com',
      'test@mail.co.uk',
      '123@numbers.com',
    ];

    it.each(validEmails)('should pass for valid email: %s', async (validEmail) => {
      const form = createForm<EmailForm>({
        email: { value: validEmail, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<EmailForm> = (path: FieldPath<EmailForm>) => {
        email(path.email);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.email.valid.value).toBe(true);
    });
  });

  describe('invalid emails', () => {
    const invalidEmails = [
      'plainaddress',
      '@no-local.com',
      'no-at-sign',
      'missing@domain',
      'spaces in@email.com',
      'double@@at.com',
    ];

    it.each(invalidEmails)('should fail for invalid email: %s', async (invalidEmail) => {
      const form = createForm<EmailForm>({
        email: { value: invalidEmail, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<EmailForm> = (path: FieldPath<EmailForm>) => {
        email(path.email);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.email.valid.value).toBe(false);
      expect(form.email.errors.value[0].code).toBe('email');
    });
  });

  describe('empty values', () => {
    it('should pass for empty string (use required for mandatory)', async () => {
      const form = createForm<EmailForm>({
        email: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<EmailForm> = (path: FieldPath<EmailForm>) => {
        email(path.email);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      // Empty should pass - use required() for mandatory
      expect(form.email.valid.value).toBe(true);
    });

    it('should pass for null (use required for mandatory)', async () => {
      interface NullableForm {
        email: string | null;
      }

      const form = createForm<NullableForm>({
        email: { value: null, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        email(path.email);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.email.valid.value).toBe(true);
    });
  });

  describe('custom message', () => {
    it('should use custom error message', async () => {
      const form = createForm<EmailForm>({
        email: { value: 'invalid', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<EmailForm> = (path: FieldPath<EmailForm>) => {
        email(path.email, { message: 'Please enter a valid email address' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.email.errors.value[0].message).toBe('Please enter a valid email address');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fieldPath', () => {
      expect(() => email(undefined)).not.toThrow();
    });

    it('should validate after value change', async () => {
      const form = createForm<EmailForm>({
        email: { value: 'invalid', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<EmailForm> = (path: FieldPath<EmailForm>) => {
        email(path.email);
      };

      form.applyValidationSchema(validation);

      await form.validate();
      expect(form.email.valid.value).toBe(false);

      form.email.setValue('valid@email.com');
      form.email.clearErrors();
      await form.validate();

      expect(form.email.valid.value).toBe(true);
    });
  });
});
