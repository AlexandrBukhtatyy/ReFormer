import { describe, it, expect } from 'vitest';
import { comboboxBasePropsSchema } from './variants/base/combobox-base.props';
import type { ComboboxProps } from './variants/base/combobox-base';
import { comboboxMultiPropsSchema } from './variants/multi/combobox-multi.props';
import type { ComboboxMultiFieldProps } from './variants/multi/combobox-multi.field';

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

/**
 * Страж мульти-варианта. Отдельная запись каталога (`x-registryName: 'ComboboxMulti'`).
 */
type MultiPropKeys = keyof typeof comboboxMultiPropsSchema.properties;
type MultiRuntimeKeys = keyof (typeof comboboxMultiPropsSchema)['x-runtimeProps'];
type MultiKeys = MultiPropKeys | MultiRuntimeKeys;

/** A: каждый ключ мульти-схемы существует в props мульти-контракта. */
type _A_MultiNoStrayKeys = Assert<MultiKeys extends keyof ComboboxMultiFieldProps ? true : false>;

describe('combobox-multi props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(comboboxMultiPropsSchema.properties);
    const runtimeKeys = Object.keys(comboboxMultiPropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = ComboboxMulti (на него смотрит экспорт ComboboxMultiField)', () => {
    expect(comboboxMultiPropsSchema['x-registryName']).toBe('ComboboxMulti');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(comboboxMultiPropsSchema.additionalProperties).toBe(false);
  });

  it('значение объявлено массивом с пустым выбором null — контракт всех мультивыборов кита', () => {
    expect(comboboxMultiPropsSchema['x-runtimeProps'].value.type).toBe('string[] | null');
  });
});

describe('группа вариантов Combobox', () => {
  it('обе схемы состоят в группе Combobox', () => {
    expect(comboboxBasePropsSchema['x-variantGroup']).toBe('Combobox');
    expect(comboboxMultiPropsSchema['x-variantGroup']).toBe('Combobox');
  });

  it('дефолт группы ровно один — тот, чьё имя совпало с именем группы', () => {
    const members = [comboboxBasePropsSchema, comboboxMultiPropsSchema];
    const defaults = members.filter((m) => m['x-registryName'] === m['x-variantGroup']);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]['x-registryName']).toBe('Combobox');
  });
});
