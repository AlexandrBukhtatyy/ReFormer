/**
 * Unit tests for validate-model M1 fixes:
 *  - Defect 14: FormSchemaNode.asyncValidators теперь исполняются движком (раньше walk() читал
 *    только `validators`, а `asyncValidators` молча игнорировались).
 *  - Defect 16: ValidationError.severity:'warning' не блокирует submit — `valid` выводится из
 *    наличия блокирующих ошибок, а не из общего количества ошибок.
 */

import { describe, it, expect } from 'vitest';
import { createModel } from '../../../src/core/model';
import { validateModel, validateModelSync } from '../../../src/core/model';
import type { ModelValidator } from '../../../src/core/model';

const InputStub = () => null;

describe('validate-model — asyncValidators (Defect 14)', () => {
  const asyncTaken: ModelValidator<string> = async (v) => {
    await new Promise((r) => setTimeout(r, 5));
    return v === 'taken' ? { code: 'taken', message: 'Занято' } : null;
  };

  it('исполняет asyncValidators узла схемы (validateModel await)', async () => {
    const model = createModel<{ login: string }>({ login: 'taken' });
    const schema = {
      children: [{ value: model.$.login, component: InputStub, asyncValidators: [asyncTaken] }],
    };
    const res = await validateModel(model, schema);
    expect(res.errors['login']?.[0]?.code).toBe('taken');
    expect(res.valid).toBe(false);
  });

  it('asyncValidators проходят, когда значение валидно', async () => {
    const model = createModel<{ login: string }>({ login: 'free' });
    const schema = {
      children: [{ value: model.$.login, component: InputStub, asyncValidators: [asyncTaken] }],
    };
    const res = await validateModel(model, schema);
    expect(res.valid).toBe(true);
    expect(res.errors['login']).toBeUndefined();
  });

  it('validateModelSync пропускает asyncValidators (async → skip)', () => {
    const model = createModel<{ login: string }>({ login: 'taken' });
    const schema = {
      children: [{ value: model.$.login, component: InputStub, asyncValidators: [asyncTaken] }],
    };
    const res = validateModelSync(model, schema);
    expect(res.valid).toBe(true);
    expect(res.errors['login']).toBeUndefined();
  });

  it('sync + async валидаторы комбинируются на одном узле', async () => {
    const model = createModel<{ login: string }>({ login: 'taken' });
    const requiredSync: ModelValidator<string> = (v) =>
      v ? null : { code: 'required', message: 'Обязательно' };
    const schema = {
      children: [
        {
          value: model.$.login,
          component: InputStub,
          validators: [requiredSync],
          asyncValidators: [asyncTaken],
        },
      ],
    };
    const res = await validateModel(model, schema);
    // требуемое заполнено, но занято async-валидатором
    expect(res.errors['login']?.some((e) => e.code === 'taken')).toBe(true);
    expect(res.valid).toBe(false);
  });
});

describe('validate-model — severity:warning не блокирует (Defect 16)', () => {
  const warnEmpty: ModelValidator<string> = (v) =>
    v === '' ? { code: 'soft', message: 'Желательно заполнить', severity: 'warning' } : null;
  const blockEmpty: ModelValidator<string> = (v) =>
    v === '' ? { code: 'required', message: 'Обязательно' } : null; // severity по умолчанию (error)

  it('warning показывается в errors, но valid=true', async () => {
    const model = createModel<{ nick: string }>({ nick: '' });
    const schema = {
      children: [{ value: model.$.nick, component: InputStub, validators: [warnEmpty] }],
    };
    const res = await validateModel(model, schema);
    expect(res.errors['nick']?.[0]?.severity).toBe('warning');
    expect(res.valid).toBe(true);
  });

  it('validateModelSync: warning тоже не блокирует', () => {
    const model = createModel<{ nick: string }>({ nick: '' });
    const schema = {
      children: [{ value: model.$.nick, component: InputStub, validators: [warnEmpty] }],
    };
    const res = validateModelSync(model, schema);
    expect(res.valid).toBe(true);
    expect(res.errors['nick']?.[0]?.code).toBe('soft');
  });

  it('блокирующая ошибка рядом с warning → valid=false', async () => {
    const model = createModel<{ nick: string }>({ nick: '' });
    const schema = {
      children: [
        { value: model.$.nick, component: InputStub, validators: [warnEmpty, blockEmpty] },
      ],
    };
    const res = await validateModel(model, schema);
    expect(res.valid).toBe(false);
    expect(res.errors['nick']?.length).toBe(2);
  });
});
