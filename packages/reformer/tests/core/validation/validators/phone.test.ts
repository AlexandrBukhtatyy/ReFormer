/**
 * Unit tests for Phone validator
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/create-form';
import { phone } from '../../../../src/core/validation/validators/phone';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('phone validator', () => {
  interface PhoneForm {
    phoneNumber: string;
  }

  describe('format: any (default)', () => {
    const validPhones = ['+1234567890', '1234567890', '(123) 456-7890'];

    it.each(validPhones)('should pass for valid phone: %s', async (validPhone) => {
      const form = makeForm<PhoneForm>({
        phoneNumber: { value: validPhone, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<PhoneForm> = (path: FieldPath<PhoneForm>) => {
        phone(path.phoneNumber);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.phoneNumber.valid.value).toBe(true);
    });

    it('should fail for invalid phone', async () => {
      const form = makeForm<PhoneForm>({
        phoneNumber: { value: 'not-a-phone', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<PhoneForm> = (path: FieldPath<PhoneForm>) => {
        phone(path.phoneNumber);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.phoneNumber.valid.value).toBe(false);
      expect(form.phoneNumber.errors.value[0].code).toBe('phone');
    });
  });

  describe('format: ru', () => {
    const validRuPhones = ['+7 900 123-45-67', '8 (900) 123-45-67', '+79001234567', '89001234567'];

    it.each(validRuPhones)('should pass for valid RU phone: %s', async (validPhone) => {
      const form = makeForm<PhoneForm>({
        phoneNumber: { value: validPhone, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<PhoneForm> = (path: FieldPath<PhoneForm>) => {
        phone(path.phoneNumber, { format: 'ru' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.phoneNumber.valid.value).toBe(true);
    });
  });

  describe('format: us', () => {
    // US format requires area code starting with 2-9
    const validUsPhones = ['(212) 456-7890', '212-456-7890', '2124567890', '+1 212-456-7890'];

    it.each(validUsPhones)('should pass for valid US phone: %s', async (validPhone) => {
      const form = makeForm<PhoneForm>({
        phoneNumber: { value: validPhone, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<PhoneForm> = (path: FieldPath<PhoneForm>) => {
        phone(path.phoneNumber, { format: 'us' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.phoneNumber.valid.value).toBe(true);
    });
  });

  describe('format: international', () => {
    const validIntlPhones = ['+12345678901', '+442071234567', '+33123456789'];

    it.each(validIntlPhones)(
      'should pass for valid international phone: %s',
      async (validPhone) => {
        const form = makeForm<PhoneForm>({
          phoneNumber: { value: validPhone, component: null as ComponentInstance },
        });

        const validation: ValidationSchemaFn<PhoneForm> = (path: FieldPath<PhoneForm>) => {
          phone(path.phoneNumber, { format: 'international' });
        };

        form.applyValidationSchema(validation);
        await form.validate();

        expect(form.phoneNumber.valid.value).toBe(true);
      }
    );
  });

  describe('empty values', () => {
    it('should pass for empty string (use required for mandatory)', async () => {
      const form = makeForm<PhoneForm>({
        phoneNumber: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<PhoneForm> = (path: FieldPath<PhoneForm>) => {
        phone(path.phoneNumber);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.phoneNumber.valid.value).toBe(true);
    });

    it('should pass for null', async () => {
      interface NullableForm {
        mobile: string | null;
      }

      const form = makeForm<NullableForm>({
        mobile: { value: null, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        phone(path.mobile);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.mobile.valid.value).toBe(true);
    });
  });

  describe('error params', () => {
    it('should include format in error params', async () => {
      const form = makeForm<PhoneForm>({
        phoneNumber: { value: 'invalid', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<PhoneForm> = (path: FieldPath<PhoneForm>) => {
        phone(path.phoneNumber, { format: 'ru' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.phoneNumber.errors.value[0].params?.format).toBe('ru');
    });

    it('should use custom message', async () => {
      const form = makeForm<PhoneForm>({
        phoneNumber: { value: 'invalid', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<PhoneForm> = (path: FieldPath<PhoneForm>) => {
        phone(path.phoneNumber, { message: 'Please enter a valid phone number' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.phoneNumber.errors.value[0].message).toBe('Please enter a valid phone number');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fieldPath', () => {
      expect(() => phone(undefined)).not.toThrow();
    });
  });
});
