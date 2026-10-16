import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { datePickerBasePropsSchema } from './variants/base/date-picker-base.props';
import { DatePicker } from './variants/base/date-picker-base';
import { datePickerRangePropsSchema } from './variants/range/date-picker-range.props';
import type { DatePickerRangeFormProps } from './variants/range/date-picker-range';
import { datePickerMultiPropsSchema } from './variants/multi/date-picker-multi.props';
import type { DatePickerMultiFormProps } from './variants/multi/date-picker-multi';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof datePickerBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof datePickerBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/**
 * Field-контракт: props базового DatePicker (placeholder/dateFormat/className) + value/onChange —
 * seam (Date | null), который адаптер маппит на `selected`/`onSelect` Calendar.
 */
type DatePickerFieldProps = React.ComponentProps<typeof DatePicker> & {
  value?: Date | null;
  onChange?: (value: Date | null) => void;
};

/** A: каждый ключ схемы существует в field-контракте (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof DatePickerFieldProps ? true : false>;

describe('date-picker props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(datePickerBasePropsSchema.properties);
    const runtimeKeys = Object.keys(datePickerBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = DatePicker (на него смотрит алиас DatePicker)', () => {
    expect(datePickerBasePropsSchema['x-registryName']).toBe('DatePicker');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(datePickerBasePropsSchema.additionalProperties).toBe(false);
  });
});

/** Стражи вариантов периода и нескольких дат — отдельные записи каталога. */
type RangeKeys =
  | keyof typeof datePickerRangePropsSchema.properties
  | keyof (typeof datePickerRangePropsSchema)['x-runtimeProps'];
type MultiKeys =
  | keyof typeof datePickerMultiPropsSchema.properties
  | keyof (typeof datePickerMultiPropsSchema)['x-runtimeProps'];

/** A: каждый ключ схем существует в props контракта формы варианта. */
type _A_RangeNoStrayKeys = Assert<RangeKeys extends keyof DatePickerRangeFormProps ? true : false>;
type _A_MultiNoStrayKeys = Assert<MultiKeys extends keyof DatePickerMultiFormProps ? true : false>;

describe.each([
  ['DatePickerRange', datePickerRangePropsSchema, '[Date, Date] | null'],
  ['DatePickerMulti', datePickerMultiPropsSchema, 'Date[] | null'],
] as const)('%s props-схема — страж от дрейфа', (name, schema, valueType) => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(schema.properties);
    const runtimeKeys = Object.keys(schema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = имя экспорта, вариант в группе DatePicker', () => {
    expect(schema['x-registryName']).toBe(name);
    expect(schema['x-variantGroup']).toBe(datePickerBasePropsSchema['x-variantGroup']);
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(schema.additionalProperties).toBe(false);
  });

  it('тип значения — контракт варианта', () => {
    expect(schema['x-runtimeProps'].value.type).toBe(valueType);
  });
});
