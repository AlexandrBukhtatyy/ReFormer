/**
 * Unit tests for maxDate validator
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../../src/core/utils/create-form';
import { maxDate } from '../../../../src/core/validation/validators/max-date';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('maxDate validator', () => {
  interface DateForm {
    eventDate: string;
  }

  it('should fail when date is after maxDate', async () => {
    const form = createForm<DateForm>({
      eventDate: { value: '2025-12-31', component: null as ComponentInstance },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      maxDate(path.eventDate, new Date('2025-01-01'));
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.eventDate.valid.value).toBe(false);
    expect(form.eventDate.errors.value[0].code).toBe('date_max');
  });

  it('should pass when date is on maxDate', async () => {
    const form = createForm<DateForm>({
      eventDate: { value: '2025-01-01', component: null as ComponentInstance },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      maxDate(path.eventDate, new Date('2025-01-01'));
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.eventDate.valid.value).toBe(true);
  });

  it('should pass when date is before maxDate', async () => {
    const form = createForm<DateForm>({
      eventDate: { value: '2024-01-01', component: null as ComponentInstance },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      maxDate(path.eventDate, new Date('2025-01-01'));
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.eventDate.valid.value).toBe(true);
  });

  it('should pass for empty value', async () => {
    const form = createForm<DateForm>({
      eventDate: { value: '', component: null as ComponentInstance },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      maxDate(path.eventDate, new Date('2025-01-01'));
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.eventDate.valid.value).toBe(true);
  });

  it('should skip invalid dates', async () => {
    const form = createForm<DateForm>({
      eventDate: { value: 'not-a-date', component: null as ComponentInstance },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      maxDate(path.eventDate, new Date('2025-01-01'));
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.eventDate.valid.value).toBe(true);
  });

  it('should handle undefined fieldPath', () => {
    expect(() => maxDate(undefined, new Date())).not.toThrow();
  });
});
