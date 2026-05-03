/**
 * Unit tests for maxAge validator
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../../src/core/utils/create-form';
import { maxAge } from '../../../../src/core/validation/validators/max-age';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('maxAge validator', () => {
  interface DateForm {
    birthDate: string;
  }

  it('should fail when age exceeds maxAge', async () => {
    // Person born 70 years ago
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 70);

    const form = createForm<DateForm>({
      birthDate: {
        value: birthDate.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      maxAge(path.birthDate, 65);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.valid.value).toBe(false);
    expect(form.birthDate.errors.value[0].code).toBe('date_max_age');
    expect(form.birthDate.errors.value[0].params?.maxAge).toBe(65);
  });

  it('should pass when age is at maxAge', async () => {
    // Person born 65 years ago
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 65);

    const form = createForm<DateForm>({
      birthDate: {
        value: birthDate.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      maxAge(path.birthDate, 65);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.valid.value).toBe(true);
  });

  it('should pass when age is below maxAge', async () => {
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
      maxAge(path.birthDate, 65);
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
      maxAge(path.birthDate, 65);
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
      maxAge(path.birthDate, 65);
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.valid.value).toBe(true);
  });

  it('should handle undefined fieldPath', () => {
    expect(() => maxAge(undefined, 65)).not.toThrow();
  });

  it('should use custom message', async () => {
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 70);

    const form = createForm<DateForm>({
      birthDate: {
        value: birthDate.toISOString().split('T')[0],
        component: null as ComponentInstance,
      },
    });

    const validation: ValidationSchemaFn<DateForm> = (path: FieldPath<DateForm>) => {
      maxAge(path.birthDate, 65, { message: 'Maximum age is 65' });
    };

    form.applyValidationSchema(validation);
    await form.validate();

    expect(form.birthDate.errors.value[0].message).toBe('Maximum age is 65');
  });
});
