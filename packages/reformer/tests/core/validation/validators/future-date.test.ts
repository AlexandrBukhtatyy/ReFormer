/**
 * Unit tests for futureDate validator
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../../src/core/utils/create-form';
import { futureDate } from '../../../../src/core/validation/validators/future-date';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('futureDate validator', () => {
  interface DateForm {
    eventDate: string;
  }

  it('should fail for past date', async () => {
    const pastDateValue = new Date();
    pastDateValue.setFullYear(pastDateValue.getFullYear() - 1);

    const form = createForm<DateForm>({
      eventDate: {
        value: pastDateValue.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      futureDate(path.eventDate);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.eventDate.valid.value).toBe(false);
    expect(form.eventDate.errors.value[0].code).toBe('date_past');
  });

  it('should pass for future date', async () => {
    const futureDateValue = new Date();
    futureDateValue.setFullYear(futureDateValue.getFullYear() + 1);

    const form = createForm<DateForm>({
      eventDate: {
        value: futureDateValue.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      futureDate(path.eventDate);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.eventDate.valid.value).toBe(true);
  });

  it('should pass for today', async () => {
    const today = new Date();

    const form = createForm<DateForm>({
      eventDate: {
        value: today.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      futureDate(path.eventDate);
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
      futureDate(path.eventDate);
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
      futureDate(path.eventDate);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.eventDate.valid.value).toBe(true);
  });

  it('should handle undefined fieldPath', () => {
    expect(() => futureDate(undefined)).not.toThrow();
  });

  it('should use custom message', async () => {
    const pastDateValue = new Date();
    pastDateValue.setFullYear(pastDateValue.getFullYear() - 1);

    const form = createForm<DateForm>({
      eventDate: {
        value: pastDateValue.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      futureDate(path.eventDate, { message: 'Event date must be in the future' });
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.eventDate.errors.value[0].message).toBe('Event date must be in the future');
  });
});
