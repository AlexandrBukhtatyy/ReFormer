/**
 * Unit test for Defect 2: GroupNode.reset() должен очищать form-level ошибки.
 *
 * До фикса reset() итерировал только дочерние поля и не трогал _formIssues, поэтому после
 * form.setIssues([...]) + form.reset() форма оставалась invalid с устаревшей ошибкой уровня формы
 * (несогласованно с ModelArrayNode.reset(), который очищает _arrayIssues).
 */

import { describe, it, expect } from 'vitest';
import type { FormGroup, ValidationIssue } from '../../../src/form/types/index';
import { ComponentInstance } from '../../test-utils/types';
import { formFromFields } from '../../test-utils/form-from-fields';

interface TestForm {
  email: string;
  password: string;
}

const make = (): FormGroup<TestForm> =>
  formFromFields<TestForm>({
    email: { value: '', component: null as ComponentInstance },
    password: { value: '', component: null as ComponentInstance },
  });

const serverError: ValidationIssue = { code: 'server_error' };

describe('GroupNode.reset() — form-level issues (Defect 2)', () => {
  it('reset() очищает form-level ошибки → форма снова valid', () => {
    const form = make();
    form.setIssues([serverError]);
    expect(form.valid.value).toBe(false);
    expect(form.issues.value).toHaveLength(1);

    form.reset();

    expect(form.issues.value).toHaveLength(0);
    expect(form.valid.value).toBe(true);
    expect(form.invalid.value).toBe(false);
  });

  it('reset(value) очищает form-level ошибки', () => {
    const form = make();
    form.setIssues([serverError]);

    form.reset({ email: 'x@y.z', password: 'pw' });

    expect(form.issues.value).toHaveLength(0);
    expect(form.valid.value).toBe(true);
  });
});
