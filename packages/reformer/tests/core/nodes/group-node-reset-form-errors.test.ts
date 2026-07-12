/**
 * Unit test for Defect 2: GroupNode.reset()/resetToInitial() должны очищать form-level ошибки.
 *
 * До фикса reset() итерировал только дочерние поля и не трогал _formErrors, поэтому после
 * form.setErrors([...]) + form.reset() форма оставалась invalid с устаревшей ошибкой уровня формы
 * (несогласованно с ArrayNode.reset()/ModelArrayNode.reset(), которые очищают _arrayErrors).
 */

import { describe, it, expect } from 'vitest';
import type { FormProxy, ValidationError } from '../../../src/form/types/index';
import { createForm } from '../../../src/form/create-form';
import { ComponentInstance } from '../../test-utils/types';

interface TestForm {
  email: string;
  password: string;
}

const make = (): FormProxy<TestForm> =>
  createForm<TestForm>({
    email: { value: '', component: null as ComponentInstance },
    password: { value: '', component: null as ComponentInstance },
  });

const serverError: ValidationError = { code: 'server_error', message: 'Server validation failed' };

describe('GroupNode.reset() — form-level errors (Defect 2)', () => {
  it('reset() очищает form-level ошибки → форма снова valid', () => {
    const form = make();
    form.setErrors([serverError]);
    expect(form.valid.value).toBe(false);
    expect(form.errors.value).toHaveLength(1);

    form.reset();

    expect(form.errors.value).toHaveLength(0);
    expect(form.valid.value).toBe(true);
    expect(form.invalid.value).toBe(false);
  });

  it('reset(value) очищает form-level ошибки', () => {
    const form = make();
    form.setErrors([serverError]);

    form.reset({ email: 'x@y.z', password: 'pw' });

    expect(form.errors.value).toHaveLength(0);
    expect(form.valid.value).toBe(true);
  });

  it('resetToInitial() тоже очищает form-level ошибки', () => {
    const form = make();
    form.setErrors([serverError]);
    expect(form.valid.value).toBe(false);

    form.resetToInitial();

    expect(form.errors.value).toHaveLength(0);
    expect(form.valid.value).toBe(true);
  });
});
