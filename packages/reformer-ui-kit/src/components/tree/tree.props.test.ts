import { describe, expect, it } from 'vitest';

import { treeBasePropsSchema } from './variants/base/tree-base.props';
import type { TreeProps } from './variants/base/tree-base';

/**
 * Страж от дрейфа схемы. Тип-левел часть (A) падает на `tsc`, НЕ на vitest (esbuild
 * транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof treeBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof treeBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props Tree (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof TreeProps ? true : false>;

describe('tree props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(treeBasePropsSchema.properties);
    const runtimeKeys = Object.keys(treeBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = Tree (каноническое имя в реестре renderer-json)', () => {
    expect(treeBasePropsSchema['x-registryName']).toBe('Tree');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(treeBasePropsSchema.additionalProperties).toBe(false);
  });

  it('в схеме НЕТ ключа value — иначе запись каталога стала бы полем и потребовала TreeField', () => {
    // Роль записи выводится генератором каталога из наличия `value` в x-runtimeProps.
    // Дерево — навигация, а не поле: одного значения у него нет.
    expect(treeBasePropsSchema['x-runtimeProps']).not.toHaveProperty('value');
  });

  it('функции живут в x-runtimeProps, а не в properties — их нечем задать в JSON-схеме формы', () => {
    const runtimeKeys = Object.keys(treeBasePropsSchema['x-runtimeProps']);
    for (const key of ['loadChildren', 'onActivate', 'renderIcon', 'getRowProps']) {
      expect(runtimeKeys).toContain(key);
    }
  });

  it('узлы описаны общим фрагментом: id и label обязательны', () => {
    const nodes = treeBasePropsSchema.properties.nodes;
    expect(nodes.items.required).toEqual(['id', 'label']);
    expect(nodes.items.additionalProperties).toBe(false);
  });
});
