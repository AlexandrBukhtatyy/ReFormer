/**
 * Unit tests for minAge validator
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../../src/core/utils/create-form';
import { minAge } from '../../../../src/core/validation/validators/min-age';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('minAge validator', () => {
  interface DateForm {
    birthDate: string;
  }

  it('should fail when age is below minAge', async () => {
    // Person born 10 years ago
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 10);

    const form = createForm<DateForm>({
      birthDate: {
        value: birthDate.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      minAge(path.birthDate, 18);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.valid.value).toBe(false);
    expect(form.birthDate.errors.value[0].code).toBe('date_min_age');
    expect(form.birthDate.errors.value[0].params?.minAge).toBe(18);
  });

  it('should pass when age meets minAge', async () => {
    // Person born 20 years ago
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 20);

    const form = createForm<DateForm>({
      birthDate: {
        value: birthDate.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      minAge(path.birthDate, 18);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.valid.value).toBe(true);
  });

  it('should pass when age exceeds minAge', async () => {
    // Person born 30 years ago
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 30);

    const form = createForm<DateForm>({
      birthDate: {
        value: birthDate.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      minAge(path.birthDate, 18);
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
      minAge(path.birthDate, 18);
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
      minAge(path.birthDate, 18);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.valid.value).toBe(true);
  });

  it('should handle undefined fieldPath', () => {
    expect(() => minAge(undefined, 18)).not.toThrow();
  });

  it('should use custom message', async () => {
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 10);

    const form = createForm<DateForm>({
      birthDate: {
        value: birthDate.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      minAge(path.birthDate, 18, { message: 'You must be at least 18 years old' });
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.errors.value[0].message).toBe('You must be at least 18 years old');
  });
});
