import { describe, it, expect } from 'vitest';
import { switchBasePropsSchema } from './variants/base/switch-base.props';
import type { SwitchFieldProps } from './variants/base/switch-base.field';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 *
 * Тип варианта — value-based `SwitchFieldProps` (base — Radix `checked`/`onCheckedChange`,
 * не `value`; поэтому страж смотрит на field-контракт, а не на примитив).
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof switchBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof switchBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props field-контракта (нет опечаток/чужих ключей). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof SwitchFieldProps ? true : false>;

describe('switch props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(switchBasePropsSchema.properties);
    const runtimeKeys = Object.keys(switchBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = Switch (на него смотрит алиас SwitchField)', () => {
    expect(switchBasePropsSchema['x-registryName']).toBe('Switch');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(switchBasePropsSchema.additionalProperties).toBe(false);
  });
});
