/**
 * Unit tests for pastDate validator
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../../src/core/utils/create-form';
import { pastDate } from '../../../../src/core/validation/validators/past-date';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('pastDate validator', () => {
  interface DateForm {
    birthDate: string;
  }

  it('should fail for future date', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const form = createForm<DateForm>({
      birthDate: {
        value: futureDate.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      pastDate(path.birthDate);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.valid.value).toBe(false);
    expect(form.birthDate.errors.value[0].code).toBe('date_future');
  });

  it('should pass for past date', async () => {
    const pastDateValue = new Date();
    pastDateValue.setFullYear(pastDateValue.getFullYear() - 1);

    const form = createForm<DateForm>({
      birthDate: {
        value: pastDateValue.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      pastDate(path.birthDate);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.valid.value).toBe(true);
  });

  it('should pass for today', async () => {
    const today = new Date();

    const form = createForm<DateForm>({
      birthDate: {
        value: today.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      pastDate(path.birthDate);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.valid.value).toBe(true);
  });

  it('should pass for empty value', async () => {
    const form = createForm<DateForm>({
      birthDate: { value: '', component: null as ComponentInstance },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      pastDate(path.birthDate);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.valid.value).toBe(true);
  });

  it('should skip invalid dates', async () => {
    const form = createForm<DateForm>({
      birthDate: { value: 'not-a-date', component: null as ComponentInstance },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      pastDate(path.birthDate);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.valid.value).toBe(true);
  });

  it('should handle undefined fieldPath', () => {
    expect(() => pastDate(undefined)).not.toThrow();
  });

  it('should use custom message', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const form = createForm<DateForm>({
      birthDate: {
        value: futureDate.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      pastDate(path.birthDate, { message: 'Birth date cannot be in the future' });
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.errors.value[0].message).toBe('Birth date cannot be in the future');
  });
});
