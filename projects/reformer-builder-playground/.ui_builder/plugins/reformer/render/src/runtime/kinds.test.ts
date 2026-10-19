/**
 * Виды мест модели по схеме: что переносу известно о поле, кроме пары значений.
 *
 * @module plugins/reformer/render/runtime/kinds.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { fieldKindsOf, fitsKind, type SlotKind } from './kinds';
import { synthMock } from './mock';

const SCHEMA = {
  format: 2,
  root: {
    component: '$component(Box)',
    children: [
      { model: '$model(name)', component: '$component(Input)' },
      { model: '$model(age)', component: '$component(InputNumber)' },
      { model: '$model(agree)', component: '$component(Checkbox)' },
      { model: '$model(birthDate)', component: '$component(DatePicker)' },
      {
        model: '$model(position)',
        component: '$component(Combobox)',
        componentProps: { options: '$dataSource(POSITIONS)' },
      },
      { model: '$model(skills)', component: '$component(ComboboxMulti)' },
      { model: '$model(documents)', component: '$component(FileUploadDropzone)' },
      {
        component: '$component(Section)',
        children: [
          'Текст секции',
          { model: '$model(person.city)', component: '$component(Input)' },
          // Второе поле на тот же путь: значение модели одно, и вид — первого объявления.
          { model: '$model(name)', component: '$component(InputNumber)' },
        ],
      },
      {
        model: '$model(references)',
        component: '$component(FieldArray)',
        item: {
          $template: {
            component: '$component(Box)',
            children: [{ model: '$model(phone)', component: '$component(InputNumber)' }],
          },
        },
      },
    ],
  },
} as unknown as JsonFormSchema;

describe('fieldKindsOf', () => {
  it('раскладывает вид значения каждого поля по пути модели', () => {
    expect(Object.fromEntries(fieldKindsOf(SCHEMA))).toEqual({
      name: 'string',
      age: 'number',
      agree: 'boolean',
      birthDate: 'date',
      position: 'select',
      skills: 'multi',
      documents: 'file',
      'person.city': 'string',
      references: 'array',
    });
  });

  it('в шаблон строки массива не спускается: пути там относительны строке', () => {
    expect(fieldKindsOf(SCHEMA).has('phone')).toBe(false);
  });

  it('покрывает те же пути, что синтез начальных значений', () => {
    // Сводка и синтез обходят схему одним правилом: разойдись они — у поля не нашлось бы вида.
    const paths = (value: unknown, prefix = ''): string[] =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? Object.entries(value).flatMap(([key, inner]) => paths(inner, `${prefix}${key}.`))
        : [prefix.slice(0, -1)];
    expect([...fieldKindsOf(SCHEMA).keys()].sort()).toEqual(paths(synthMock(SCHEMA).model).sort());
  });

  it('вид поля чужого кита — по типу значения из его каталога', () => {
    const schema = {
      format: 2,
      root: {
        component: '$component(Box)',
        children: [
          { model: '$model(days)', component: '$component(CheckboxGroup)' },
          { model: '$model(time)', component: '$component(TimeRange)' },
        ],
      },
    } as unknown as JsonFormSchema;
    const types: Readonly<Record<string, string>> = {
      CheckboxGroup: 'string[] | null',
      TimeRange: '[string, string] | null',
    };
    const valueTypeOf = (component: string): string | undefined => types[component];
    expect(Object.fromEntries(fieldKindsOf(schema, valueTypeOf))).toEqual({
      days: 'multi',
      time: 'raw',
    });
    // Без таблицы — как прежде: по пропсам, то есть строка.
    expect(Object.fromEntries(fieldKindsOf(schema))).toEqual({ days: 'string', time: 'string' });
  });

  it('схема без корня полей не называет', () => {
    expect(fieldKindsOf({ format: 2 } as unknown as JsonFormSchema).size).toBe(0);
  });
});

describe('fitsKind', () => {
  const date = new Date(0);
  const cases: readonly [SlotKind, unknown, boolean][] = [
    ['string', 'x', true],
    ['string', null, false],
    ['string', 5, false],
    ['boolean', false, true],
    ['boolean', null, false],
    ['number', 0, true],
    ['number', null, true],
    ['number', '5', false],
    ['date', date, true],
    ['date', null, true],
    ['date', '2020-01-01', false],
    ['dates', [date], true],
    ['dates', null, true],
    ['dates', ['a'], false],
    ['dateRange', [date, date], true],
    ['dateRange', [], true],
    ['dateRange', null, true],
    ['dateRange', [date], false],
    ['dateRange', date, false],
    ['multi', ['a'], true],
    ['multi', null, true],
    ['multi', 'a', false],
    ['file', [], true],
    ['file', null, true],
    ['select', 'a', true],
    ['select', 1, true],
    ['select', null, true],
    ['select', ['a'], false],
    ['array', [], true],
    ['array', null, false],
    ['raw', null, true],
    ['raw', ['10:00', '11:00'], false],
    ['raw', 'x', false],
  ];

  it.each(cases)('полю вида «%s» значение %j годится: %s', (kind, value, expected) => {
    expect(fitsKind(kind, value)).toBe(expected);
  });
});
