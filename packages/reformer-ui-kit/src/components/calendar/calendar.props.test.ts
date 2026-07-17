import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { calendarBasePropsSchema } from './variants/base/calendar-base.props';
import { Calendar } from './variants/base/calendar-base';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof calendarBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof calendarBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/**
 * Field-контракт: props базового Calendar (DayPicker) + value/onChange — seam, который адаптер
 * маппит на `selected`/`onSelect` (их у DayPicker нет как value-based, поэтому добавляем вручную).
 */
type CalendarFieldProps = React.ComponentProps<typeof Calendar> & {
  value?: Date | null;
  onChange?: (value: Date | null) => void;
};

/** A: каждый ключ схемы существует в field-контракте (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof CalendarFieldProps ? true : false>;

describe('calendar props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(calendarBasePropsSchema.properties);
    const runtimeKeys = Object.keys(calendarBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = Calendar (на него смотрит алиас CalendarField)', () => {
    expect(calendarBasePropsSchema['x-registryName']).toBe('Calendar');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(calendarBasePropsSchema.additionalProperties).toBe(false);
  });

  it('mode enum = single (field — single-date)', () => {
    expect(calendarBasePropsSchema.properties.mode.enum).toEqual(['single']);
  });
});
