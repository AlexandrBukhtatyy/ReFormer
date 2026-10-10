/**
 * `ownIssues` — собственные замечания ноды без замечаний детей.
 *
 * У группы и массива `issues` — агрегат (свои и всех детей), а `ownIssues` — только правила на их
 * ручке: так ошибка уровня массива (`minLength`) показывается отдельно от ошибок полей строк.
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../src/form/form-bundle';
import { arrayOf } from '../../../src/model/index';
import type { FormModel } from '../../../src/model/types';
import { applyEach, defineValidation, validate } from '../../../src/form/validation';
import { minLength, required } from '../../../src/form/validators';

interface Phone {
  number: string;
}
interface Shape {
  phones: Phone[];
  ownIssues: string;
}

const phoneRow = (model: FormModel<Phone>) => ({ children: [{ model: model.$.number }] });

const rules = defineValidation<Shape>(({ model }) => {
  validate(model.$.phones, [minLength(2, { code: 'phones.minLength' })]);
  applyEach(model.$.phones, ({ model: row }) => {
    validate(row.$.number, [required()]);
  });
});

const createShape = () =>
  createForm<Shape>({
    initial: { phones: arrayOf(() => ({ number: '' }), [{ number: '' }]), ownIssues: '' },
    schema: (model) => ({ children: [{ model: model.$.phones, item: phoneRow }] }),
    validation: rules,
  });

describe('ownIssues', () => {
  it('массив: issues — свои и строк, ownIssues — только правило массива', async () => {
    const bundle = createShape();

    await bundle.validate();

    const phones = bundle.form.phones;
    expect(phones.issues.value.map((issue) => issue.code)).toEqual([
      'phones.minLength',
      'required',
    ]);
    expect(phones.ownIssues.value.map((issue) => issue.code)).toEqual(['phones.minLength']);
  });

  it('поле: ownIssues совпадает с issues', async () => {
    const bundle = createShape();

    await bundle.validate();

    const number = bundle.form.phones.at(0)!.number;
    expect(number.ownIssues.value).toEqual(number.issues.value);
    expect(number.ownIssues.value).toEqual([{ code: 'required' }]);
  });

  it('группа: setIssues пишет в ownIssues, замечания полей туда не попадают', async () => {
    const bundle = createShape();
    await bundle.validate();

    bundle.form.setIssues([{ code: 'server' }]);

    expect(bundle.form.ownIssues.value).toEqual([{ code: 'server' }]);
    expect(bundle.form.issues.value.map((issue) => issue.code)).toContain('required');
  });

  it('поле данных с именем ownIssues затеняется членом ноды и доступно через $', () => {
    const bundle = createShape();

    expect(Array.isArray(bundle.form.ownIssues.value)).toBe(true);
    expect(bundle.form.$.ownIssues.value.value).toBe('');
  });
});
