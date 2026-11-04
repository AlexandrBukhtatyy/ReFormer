/**
 * Массив, записанный полем: `fields: [{ name, type: 'array', itemFields }]`.
 *
 * Зачем. `readField` читал такую запись полем типа `array` и выбрасывал строки без отказа:
 * модуль собирался с массивом без строк и ✓ (ReFormer-gxv6, форма на 82 поля — три массива
 * без строк). Смысл записи однозначен, поэтому она читается массивом с предупреждением, а ссылка
 * на неё строкой в раскладке — узлом массива.
 */

import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/core/generate/builders';
import { crossCheckBundle, inspectLayoutRefs } from '../src/core/generate/cross-check';
import { readIntent } from '../src/core/generate/form-intent';

const properties = {
  name: 'properties',
  type: 'array',
  label: 'Имущество',
  itemFields: [{ name: 'type', type: 'string', component: 'Select' }],
};

describe('readIntent: массив в fields', () => {
  it('запись со строками читается массивом, подпись — заголовком FieldArray', () => {
    const { intent, problems } = readIntent({ formName: 'Анкета', fields: [properties] });
    expect(problems).toEqual([]);
    expect(intent.fields).toEqual([]);
    expect(intent.arrays).toHaveLength(1);
    expect(intent.arrays[0]).toMatchObject({
      name: 'properties',
      componentProps: { title: 'Имущество' },
      itemFields: [{ name: 'type', component: 'Select' }],
    });
    expect(intent.warnings.join('\n')).toContain('`properties` есть строки — прочитано как массив');
  });

  it('тип-синоним со строками под синонимом — тоже массив; тип array без строк — поле', () => {
    const { intent } = readIntent({
      formName: 'Анкета',
      fields: [
        { name: 'children', type: 'list', items: [{ name: 'age', type: 'number' }] },
        { name: 'tags', type: 'array', component: 'ComboboxMulti' },
      ],
    });
    expect(intent.arrays.map((a) => [a.name, a.itemFields.map((f) => f.name)])).toEqual([
      ['children', ['age']],
    ]);
    expect(intent.fields.map((f) => f.name)).toEqual(['tags']);
  });

  it('одноимённая запись в arrays побеждает', () => {
    const { intent } = readIntent({
      formName: 'Анкета',
      fields: [properties],
      arrays: [
        {
          name: 'properties',
          itemInterfaceName: 'Property',
          initialValue: [],
          itemFields: [{ name: 'value', type: 'number' }],
        },
      ],
    });
    expect(intent.arrays).toHaveLength(1);
    expect(intent.arrays[0].itemFields.map((f) => f.name)).toEqual(['value']);
    expect(intent.warnings.join('\n')).toContain('взята запись из arrays');
  });

  it('обязательная строка поднимается в правило строки массива', () => {
    const { intent } = readIntent({
      formName: 'Анкета',
      fields: [{ ...properties, itemFields: [{ name: 'type', required: true }] }],
    });
    expect(intent.validation).toEqual([
      { target: 'type', each: 'properties', rules: ['required()'] },
    ]);
  });
});

describe('ссылка раскладки на массив строкой', () => {
  it('становится узлом массива, и модуль собирается со строками', () => {
    const { intent, problems } = readIntent({
      formName: 'Анкета',
      target: 'renderer-json',
      fields: [{ name: 'fullName', type: 'string', component: 'Input' }, properties],
      layoutRoot: { kind: 'container', component: 'Box', children: ['fullName', 'properties'] },
    });
    expect(problems).toEqual([]);
    expect(intent.layoutRoot).toMatchObject({
      children: [
        { kind: 'field', ref: 'fullName' },
        { kind: 'array', ref: 'properties' },
      ],
    });
    expect(inspectLayoutRefs(intent)).toEqual({
      placed: new Set(['fullName', 'properties']),
      unknown: [],
    });

    const { files, layoutJson } = buildBundle(intent);
    expect(crossCheckBundle(intent, JSON.parse(layoutJson)).errors).toEqual([]);
    const model = files.find((file) => file.path === 'model.ts')?.content ?? '';
    expect(model).toMatch(/properties: PropertiesItem\[\]/);
    expect(model).toMatch(/type PropertiesItem = \{\s*type: string \| null;/);
  });

  it('имя поля остаётся ссылкой на поле', () => {
    const { intent } = readIntent({
      formName: 'Анкета',
      fields: [{ name: 'tags', type: 'array', component: 'ComboboxMulti' }],
      layoutRoot: { kind: 'container', component: 'Box', children: ['tags'] },
    });
    expect(intent.layoutRoot).toMatchObject({ children: [{ kind: 'field', ref: 'tags' }] });
  });
});
