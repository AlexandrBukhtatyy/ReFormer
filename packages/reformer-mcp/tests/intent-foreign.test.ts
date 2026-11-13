/**
 * Чужие форматы intent от малых моделей — в канон с предупреждением (ReFormer-f2fs.5). Фрагменты —
 * минимальные копии классов из корпуса прогонов qwen3.5:4b, без сырья.
 */

import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { readIntent, ruleFromRecord } from '../src/core/generate/form-intent';
import { judgeIntent } from '../src/core/generate/judge';

const codes = (raw: unknown) => readIntent(raw).notices.map((warning) => warning.code);

describe('правила объектами', () => {
  it.each([
    [{ min: 50000 }, 'min(50000)'],
    [{ required: true }, 'required()'],
    [{ code: 'required' }, 'required()'],
    [{ name: 'minLength', args: [2] }, 'minLength(2)'],
    [{ code: 'maxLength(100)' }, 'maxLength(100)'],
    [{ pattern: '^\\d+$' }, 'pattern(/^\\d+$/)'],
  ])('%j → %s', (record, call) => {
    expect(ruleFromRecord(record)).toBe(call);
  });

  it('неоднозначная запись остаётся отказом', () => {
    expect(ruleFromRecord({ min: 1, max: 2 })).toBeNull();
    expect(ruleFromRecord({ name: 'min', message: 'x' })).toBeNull();
  });

  it('строка правил читается с предупреждением и проходит судью', () => {
    const raw = {
      formName: 'Займ',
      target: 'renderer-react',
      fields: [{ name: 'amount', type: 'number', component: 'InputNumber' }],
      layoutRoot: { kind: 'container', component: 'Box', children: ['amount'] },
      validation: [{ target: 'amount', rules: [{ required: true }, { min: 50000 }] }],
    };
    const verdict = judgeIntent(raw, CATALOGS);
    expect(verdict.ok).toBe(true);
    expect(verdict.intent.validation[0].rules).toEqual(['required()', 'min(50000)']);
    expect(codes(raw)).toContain('value-coerced');
  });
});

describe('чужие форматы корня', () => {
  it('JSON Schema вместо полей: поля, правила и порядок из `intent`', () => {
    const raw = {
      schema: {
        type: 'object',
        properties: {
          email: { type: 'string', title: 'Email', format: 'email' },
          age: { type: 'integer', title: 'Age', minimum: 18 },
          city: { type: 'string', enum: ['Moscow', 'Kazan'] },
        },
        required: ['email'],
      },
      intent: { name: 'profile', fields: ['city', 'email', 'age'] },
    };
    const { intent, notices: warnings } = readIntent(raw);
    expect(intent.formName).toBe('profile');
    expect(intent.fields.map((field) => field.name)).toEqual(['city', 'email', 'age']);
    expect(intent.fields[0].component).toBe('Select');
    expect(intent.validation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'email', rules: ['required()', 'email()'] }),
        expect.objectContaining({ target: 'age', rules: ['integer()', 'min(18)'] }),
      ])
    );
    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['json-schema-lifted', 'meta-dropped'])
    );
  });

  it('метаключи и пустой `components` отброшены, `wizard` списком — шаги', () => {
    const raw = {
      version: '1.0.0',
      $schema: 'x',
      components: {},
      formName: 'Мастер',
      target: 'renderer-react',
      fields: [
        { name: 'a', type: 'string', component: 'Input' },
        { name: 'b', type: 'string', component: 'Input' },
      ],
      wizard: [
        { title: 'Один', fields: ['a'] },
        { title: 'Два', fields: ['b'] },
      ],
    };
    const verdict = judgeIntent(raw, CATALOGS);
    expect(verdict.errors).toEqual([]);
    expect(verdict.intent.wizard?.steps.map((step) => step.title)).toEqual(['Один', 'Два']);
    expect(codes(raw)).toEqual(expect.arrayContaining(['meta-dropped', 'wizard-as-list']));
  });

  it('`pattern` и `minLength` на поле — правила валидации', () => {
    const { intent } = readIntent({
      fields: [
        { name: 'code', type: 'string', component: 'Input', pattern: '^[0-9]{6}$', minLength: 6 },
      ],
    });
    expect(intent.validation).toEqual([
      expect.objectContaining({ target: 'code', rules: ['minLength(6)', 'pattern(/^[0-9]{6}$/)'] }),
    ]);
  });
});
