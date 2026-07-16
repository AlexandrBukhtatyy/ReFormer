import { describe, it, expect } from 'vitest';
import { nativeSelectBasePropsSchema } from './variants/base/native-select-base.props';
import type { NativeSelectWithOptionsProps } from './variants/base/native-select-base.field';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof nativeSelectBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof nativeSelectBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props варианта (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof NativeSelectWithOptionsProps ? true : false>;

describe('native-select props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(nativeSelectBasePropsSchema.properties);
    const runtimeKeys = Object.keys(nativeSelectBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = NativeSelect (на него смотрит алиас NativeSelectField)', () => {
    expect(nativeSelectBasePropsSchema['x-registryName']).toBe('NativeSelect');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(nativeSelectBasePropsSchema.additionalProperties).toBe(false);
  });
});
