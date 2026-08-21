import { describe, it, expect } from 'vitest';
import { toggleGroupBasePropsSchema } from './variants/base/toggle-group-base.props';
import type { ToggleGroupFieldProps } from './variants/base/toggle-group-base.field';
import { toggleGroupMultiPropsSchema } from './variants/multi/toggle-group-multi.props';
import type { ToggleGroupMultiFieldProps } from './variants/multi/toggle-group-multi.field';

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

/**
 * Страж мульти-варианта. Отдельная запись каталога (`x-registryName: 'ToggleGroupMulti'`), поэтому
 * инварианты те же, но проверяются по своей схеме и своему field-контракту.
 */
type MultiPropKeys = keyof typeof toggleGroupMultiPropsSchema.properties;
type MultiRuntimeKeys = keyof (typeof toggleGroupMultiPropsSchema)['x-runtimeProps'];
type MultiKeys = MultiPropKeys | MultiRuntimeKeys;

/** A: каждый ключ мульти-схемы существует в props мульти-контракта. */
type _A_MultiNoStrayKeys = Assert<
  MultiKeys extends keyof ToggleGroupMultiFieldProps ? true : false
>;

describe('toggle-group-multi props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(toggleGroupMultiPropsSchema.properties);
    const runtimeKeys = Object.keys(toggleGroupMultiPropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = ToggleGroupMulti (на него смотрит экспорт ToggleGroupMultiField)', () => {
    expect(toggleGroupMultiPropsSchema['x-registryName']).toBe('ToggleGroupMulti');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(toggleGroupMultiPropsSchema.additionalProperties).toBe(false);
  });

  it('значение объявлено массивом с пустым выбором null — контракт всех мультивыборов кита', () => {
    expect(toggleGroupMultiPropsSchema['x-runtimeProps'].value.type).toBe('string[] | null');
  });
});

describe('группа вариантов ToggleGroup', () => {
  // variantGroupOf в билдере возвращает null при members.length < 2 (catalog/variants.ts),
  // поэтому x-variantGroup обязан стоять на ОБЕИХ схемах, иначе селектор варианта не появится.
  it('обе схемы состоят в группе ToggleGroup', () => {
    expect(toggleGroupBasePropsSchema['x-variantGroup']).toBe('ToggleGroup');
    expect(toggleGroupMultiPropsSchema['x-variantGroup']).toBe('ToggleGroup');
  });

  it('дефолт группы ровно один — тот, чьё имя совпало с именем группы', () => {
    const members = [toggleGroupBasePropsSchema, toggleGroupMultiPropsSchema];
    const defaults = members.filter((m) => m['x-registryName'] === m['x-variantGroup']);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]['x-registryName']).toBe('ToggleGroup');
  });

  it('метки вариантов различаются (иначе в палитре два одинаковых пункта)', () => {
    expect(toggleGroupBasePropsSchema['x-variant']).not.toBe(
      toggleGroupMultiPropsSchema['x-variant']
    );
  });
});
