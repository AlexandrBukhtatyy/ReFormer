import { describe, it, expect } from 'vitest';
import { comboboxBasePropsSchema } from './variants/base/combobox-base.props';
import type { ComboboxProps } from './variants/base/combobox-base';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof comboboxBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof comboboxBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props Combobox (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof ComboboxProps ? true : false>;

describe('combobox props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(comboboxBasePropsSchema.properties);
    const runtimeKeys = Object.keys(comboboxBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = Combobox (на него смотрит алиас ComboboxField)', () => {
    expect(comboboxBasePropsSchema['x-registryName']).toBe('Combobox');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(comboboxBasePropsSchema.additionalProperties).toBe(false);
  });
});
