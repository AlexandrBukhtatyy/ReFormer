import { describe, it, expect } from 'vitest';
import { radioGroupBasePropsSchema } from './variants/base/radio-group-base.props';
import type { RadioGroupOptionsProps } from './variants/base/radio-group-base.field';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof radioGroupBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof radioGroupBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props варианта (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof RadioGroupOptionsProps ? true : false>;

describe('radio-group props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(radioGroupBasePropsSchema.properties);
    const runtimeKeys = Object.keys(radioGroupBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = RadioGroup (на него смотрит алиас RadioGroupField)', () => {
    expect(radioGroupBasePropsSchema['x-registryName']).toBe('RadioGroup');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(radioGroupBasePropsSchema.additionalProperties).toBe(false);
  });
});
