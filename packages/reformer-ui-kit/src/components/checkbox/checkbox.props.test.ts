import { describe, it, expect } from 'vitest';
import { checkboxBasePropsSchema } from './variants/base/checkbox-base.props';
import type { CheckboxWithLabelProps } from './variants/base/checkbox-base.field';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof checkboxBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof checkboxBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props варианта (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof CheckboxWithLabelProps ? true : false>;

describe('checkbox props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(checkboxBasePropsSchema.properties);
    const runtimeKeys = Object.keys(checkboxBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = Checkbox (на него смотрит алиас CheckboxField)', () => {
    expect(checkboxBasePropsSchema['x-registryName']).toBe('Checkbox');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(checkboxBasePropsSchema.additionalProperties).toBe(false);
  });
});
