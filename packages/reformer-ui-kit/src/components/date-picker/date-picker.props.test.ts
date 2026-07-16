import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { datePickerBasePropsSchema } from './variants/base/date-picker-base.props';
import { DatePicker } from './variants/base/date-picker-base';

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

  it('x-registryName = DatePicker (на него смотрит алиас DatePickerField)', () => {
    expect(datePickerBasePropsSchema['x-registryName']).toBe('DatePicker');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(datePickerBasePropsSchema.additionalProperties).toBe(false);
  });
});
