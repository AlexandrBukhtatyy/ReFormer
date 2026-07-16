import { describe, it, expect } from 'vitest';
import { selectAsyncPropsSchema } from './variants/async/select-async.props';
import type { SelectAsyncProps } from './variants/async/select-async';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof selectAsyncPropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof selectAsyncPropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props варианта (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof SelectAsyncProps ? true : false>;

describe('select-async props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(selectAsyncPropsSchema.properties);
    const runtimeKeys = Object.keys(selectAsyncPropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = Select (на него смотрит алиас SelectField)', () => {
    expect(selectAsyncPropsSchema['x-registryName']).toBe('Select');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(selectAsyncPropsSchema.additionalProperties).toBe(false);
  });
});
