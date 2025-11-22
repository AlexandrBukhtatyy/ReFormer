/**
 * Unit tests for Date validator
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/make-form';
import { date } from '../../../../src/core/validation/validators/date';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('date validator', () => {
  interface DateForm {
    birthDate: string;
  }

  describe('basic functionality', () => {
    it('should pass for valid date string', async () => {
      const form = makeForm<DateForm>({
        birthDate: { value: '2000-01-15', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        date(path.birthDate);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(true);
    });

    it('should fail for invalid date string', async () => {
      const form = makeForm<DateForm>({
        birthDate: { value: 'not-a-date', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        date(path.birthDate);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(false);
      expect(form.birthDate.errors.value[0].code).toBe('date_invalid');
    });
  });

  describe('Date objects', () => {
    interface DateObjectForm {
      eventDate: Date;
    }

    it('should pass for valid Date object', async () => {
      const form = makeForm<DateObjectForm>({
        eventDate: { value: new Date('2025-06-15'), component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateObjectForm> = (path: FieldPath<DateObjectForm>) => {
        date(path.eventDate);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.eventDate.valid.value).toBe(true);
    });
  });

  describe('minDate option', () => {
    it('should fail when date is before minDate', async () => {
      const form = makeForm<DateForm>({
        birthDate: { value: '2020-01-01', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        date(path.birthDate, { minDate: new Date('2021-01-01') });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(false);
      expect(form.birthDate.errors.value[0].code).toBe('date_min');
    });

    it('should pass when date is on minDate', async () => {
      const form = makeForm<DateForm>({
        birthDate: { value: '2021-01-01', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        date(path.birthDate, { minDate: new Date('2021-01-01') });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(true);
    });
  });

  describe('maxDate option', () => {
    it('should fail when date is after maxDate', async () => {
      const form = makeForm<DateForm>({
        birthDate: { value: '2025-12-31', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        date(path.birthDate, { maxDate: new Date('2025-01-01') });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(false);
      expect(form.birthDate.errors.value[0].code).toBe('date_max');
    });
  });

  describe('noFuture option', () => {
    it('should fail for future date when noFuture is true', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const form = makeForm<DateForm>({
        birthDate: {
          value: futureDate.toISOString().split('T')[0],
          component: null as ComponentInstance,
        },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        date(path.birthDate, { noFuture: true });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(false);
      expect(form.birthDate.errors.value[0].code).toBe('date_future');
    });
  });

  describe('noPast option', () => {
    it('should fail for past date when noPast is true', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const form = makeForm<DateForm>({
        birthDate: {
          value: pastDate.toISOString().split('T')[0],
          component: null as ComponentInstance,
        },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        date(path.birthDate, { noPast: true });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(false);
      expect(form.birthDate.errors.value[0].code).toBe('date_past');
    });
  });

  describe('age options', () => {
    it('should fail when age is below minAge', async () => {
      // Person born 10 years ago
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 10);

      const form = makeForm<DateForm>({
        birthDate: {
          value: birthDate.toISOString().split('T')[0],
          component: null as ComponentInstance,
        },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        date(path.birthDate, { minAge: 18 });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(false);
      expect(form.birthDate.errors.value[0].code).toBe('date_min_age');
    });

    it('should pass when age meets minAge', async () => {
      // Person born 20 years ago
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 20);

      const form = makeForm<DateForm>({
        birthDate: {
          value: birthDate.toISOString().split('T')[0],
          component: null as ComponentInstance,
        },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        date(path.birthDate, { minAge: 18 });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(true);
    });
  });

  describe('empty values', () => {
    it('should pass for empty string (use required for mandatory)', async () => {
      const form = makeForm<DateForm>({
        birthDate: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        date(path.birthDate);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.valid.value).toBe(true);
    });

    it('should pass for null', async () => {
      interface NullableForm {
        eventDate: string | null;
      }

      const form = makeForm<NullableForm>({
        eventDate: { value: null, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        date(path.eventDate);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.eventDate.valid.value).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fieldPath', () => {
      expect(() => date(undefined)).not.toThrow();
    });

    it('should use custom message', async () => {
      const form = makeForm<DateForm>({
        birthDate: { value: 'invalid', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
        date(path.birthDate, { message: 'Please enter a valid date' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.birthDate.errors.value[0].message).toBe('Please enter a valid date');
    });
  });
});
