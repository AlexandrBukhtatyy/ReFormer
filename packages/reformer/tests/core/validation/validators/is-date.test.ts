/**
 * Unit tests for isDate validator
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../../src/core/utils/create-form';
import { isDate } from '../../../../src/core/validation/validators/is-date';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('isDate validator', () => {
  interface DateForm {
    birthDate: string;
  }

  describe('valid dates', () => {
    it('should pass for valid date string', async () => {
      const form = createForm<DateForm>({
        birthDate: { value: '2000-01-15', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        isDate(path.birthDate);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(true);
    });

    it('should pass for valid Date object', async () => {
      interface DateObjectForm {
        eventDate: Date;
      }

      const form = createForm<DateObjectForm>({
        eventDate: { value: new Date('2025-06-15'), component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateObjectForm> = (path: FieldPath<DateObjectForm>) => {
        isDate(path.eventDate);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.eventDate.valid.value).toBe(true);
    });
  });

  describe('invalid dates', () => {
    it('should fail for invalid date string', async () => {
      const form = createForm<DateForm>({
        birthDate: { value: 'not-a-date', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        isDate(path.birthDate);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(false);
      expect(form.birthDate.errors.value[0].code).toBe('date_invalid');
    });
  });

  describe('empty values', () => {
    it('should pass for empty string', async () => {
      const form = createForm<DateForm>({
        birthDate: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        isDate(path.birthDate);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(true);
    });

    it('should pass for null', async () => {
      interface NullableForm {
        eventDate: string | null;
      }

      const form = createForm<NullableForm>({
        eventDate: { value: null, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        isDate(path.eventDate);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.eventDate.valid.value).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fieldPath', () => {
      expect(() => isDate(undefined)).not.toThrow();
    });

    it('should use custom message', async () => {
      const form = createForm<DateForm>({
        birthDate: { value: 'invalid', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        isDate(path.birthDate, { message: 'Please enter a valid date' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.errors.value[0].message).toBe('Please enter a valid date');
    });
  });
});
