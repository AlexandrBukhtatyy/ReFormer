/**
 * Unit tests for minDate validator
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../../src/core/utils/create-form';
import { minDate } from '../../../../src/core/validation/validators/min-date';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('minDate validator', () => {
  interface DateForm {
    eventDate: string;
  }

  it('should fail when date is before minDate', async () => {
    const form = createForm<DateForm>({
      eventDate: { value: '2020-01-01', component: null as ComponentInstance },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      minDate(path.eventDate, new Date('2021-01-01'));
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.eventDate.valid.value).toBe(false);
    expect(form.eventDate.errors.value[0].code).toBe('date_min');
  });

  it('should pass when date is on minDate', async () => {
    const form = createForm<DateForm>({
      eventDate: { value: '2021-01-01', component: null as ComponentInstance },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      minDate(path.eventDate, new Date('2021-01-01'));
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.eventDate.valid.value).toBe(true);
  });

  it('should pass when date is after minDate', async () => {
    const form = createForm<DateForm>({
      eventDate: { value: '2022-01-01', component: null as ComponentInstance },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      minDate(path.eventDate, new Date('2021-01-01'));
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
      minDate(path.eventDate, new Date('2021-01-01'));
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
      minDate(path.eventDate, new Date('2021-01-01'));
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.eventDate.valid.value).toBe(true);
  });

  it('should handle undefined fieldPath', () => {
    expect(() => minDate(undefined, new Date())).not.toThrow();
  });
});
