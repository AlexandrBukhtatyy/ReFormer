import { describe, it, expect } from 'vitest';
import { toggleGroupBasePropsSchema } from './variants/base/toggle-group-base.props';
import type { ToggleGroupFieldProps } from './variants/base/toggle-group-base.field';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 *
 * Тип варианта — value-based `ToggleGroupFieldProps` (base — Radix `value`/`onValueChange`,
 * не `onChange`; поэтому страж смотрит на field-контракт, а не на примитив).
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof toggleGroupBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof toggleGroupBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props field-контракта (нет опечаток/чужих ключей). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof ToggleGroupFieldProps ? true : false>;

describe('toggle-group props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(toggleGroupBasePropsSchema.properties);
    const runtimeKeys = Object.keys(toggleGroupBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = ToggleGroup (на него смотрит алиас ToggleGroupField)', () => {
    expect(toggleGroupBasePropsSchema['x-registryName']).toBe('ToggleGroup');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(toggleGroupBasePropsSchema.additionalProperties).toBe(false);
  });
});
