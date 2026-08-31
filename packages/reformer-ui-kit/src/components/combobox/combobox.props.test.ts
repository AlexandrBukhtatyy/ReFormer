import { describe, it, expect } from 'vitest';
import { comboboxBasePropsSchema } from './variants/base/combobox-base.props';
import type { ComboboxProps } from './variants/base/combobox-base';
import { comboboxMultiPropsSchema } from './variants/multi/combobox-multi.props';
import type { ComboboxMultiFieldProps } from './variants/multi/combobox-multi.field';
import { comboboxTreePropsSchema } from './variants/tree/combobox-tree.props';
import type { ComboboxTreeFieldProps } from './variants/tree/combobox-tree.field';
import { comboboxTreeMultiPropsSchema } from './variants/tree-multi/combobox-tree-multi.props';
import type { ComboboxTreeMultiFieldProps } from './variants/tree-multi/combobox-tree-multi.field';

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

/**
 * Стражи вариантов с деревом. Список у них другой структуры (`nodes` вместо `options`),
 * поэтому это отдельные записи каталога, а не проп существующих вариантов.
 */
type TreeKeys =
  | keyof typeof comboboxTreePropsSchema.properties
  | keyof (typeof comboboxTreePropsSchema)['x-runtimeProps'];

/** A: каждый ключ схемы существует в контракте поля. */
type _A_TreeNoStrayKeys = Assert<TreeKeys extends keyof ComboboxTreeFieldProps ? true : false>;

type TreeMultiKeys =
  | keyof typeof comboboxTreeMultiPropsSchema.properties
  | keyof (typeof comboboxTreeMultiPropsSchema)['x-runtimeProps'];

type _A_TreeMultiNoStrayKeys = Assert<
  TreeMultiKeys extends keyof ComboboxTreeMultiFieldProps ? true : false
>;

describe('combobox-tree props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(comboboxTreePropsSchema.properties);
    const runtimeKeys = Object.keys(comboboxTreePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = ComboboxTree (на него смотрит экспорт ComboboxTreeField)', () => {
    expect(comboboxTreePropsSchema['x-registryName']).toBe('ComboboxTree');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(comboboxTreePropsSchema.additionalProperties).toBe(false);
  });

  it('значение — один адрес узла: контракт одиночного выбора', () => {
    expect(comboboxTreePropsSchema['x-runtimeProps'].value.type).toBe('string | null');
  });

  it('по умолчанию выбираются только листья — это выбор файла, а не каталога', () => {
    expect(comboboxTreePropsSchema.properties.selectable.default).toBe('leaf');
  });

  it('loadChildren объявлен рантайм-пропом: функцию в JSON-схеме формы не задать', () => {
    expect(comboboxTreePropsSchema['x-runtimeProps']).toHaveProperty('loadChildren');
    expect(Object.keys(comboboxTreePropsSchema.properties)).not.toContain('loadChildren');
  });
});

describe('combobox-tree-multi props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(comboboxTreeMultiPropsSchema.properties);
    const runtimeKeys = Object.keys(comboboxTreeMultiPropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = ComboboxTreeMulti', () => {
    expect(comboboxTreeMultiPropsSchema['x-registryName']).toBe('ComboboxTreeMulti');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(comboboxTreeMultiPropsSchema.additionalProperties).toBe(false);
  });

  it('значение объявлено массивом с пустым выбором null — контракт всех мультивыборов кита', () => {
    expect(comboboxTreeMultiPropsSchema['x-runtimeProps'].value.type).toBe('string[] | null');
  });
});

describe('группа вариантов Combobox', () => {
  const members = [
    comboboxBasePropsSchema,
    comboboxMultiPropsSchema,
    comboboxTreePropsSchema,
    comboboxTreeMultiPropsSchema,
  ];

  it('все четыре схемы состоят в группе Combobox', () => {
    for (const member of members) expect(member['x-variantGroup']).toBe('Combobox');
  });

  it('дефолт группы ровно один — тот, чьё имя совпало с именем группы', () => {
    const defaults = members.filter((m) => m['x-registryName'] === m['x-variantGroup']);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]['x-registryName']).toBe('Combobox');
  });

  it('метки вариантов различны — иначе переключатель варианта показал бы два одинаковых пункта', () => {
    const labels = members.map((m) => m['x-variant']);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
