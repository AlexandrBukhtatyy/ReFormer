/**
 * Тесты провайдера модели: разбор, печать, круговой обход и выбор «моё — не моё».
 *
 * Круговой обход здесь главный: на нём стоит и сравнение с буфером, и переживание
 * перезагрузки выделением. Если печать перестанет хранить адреса, тест упадёт именно тут,
 * а не в редакторе через неделю.
 *
 * @module plugins/editor-schema/provider.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { nodeIdOf, type NodeIdFactory } from '@/lib/form-model/node-id';
import { getAt } from '@/lib/form-model/paths';
import { walkNodes } from '@/lib/form-model/query';
import type { EditorProbe, ResourceRef } from '@/sdk';
import { indexNodes } from './node-index';
import { insertOp } from './ops';
import {
  createSchemaModelProvider,
  isFormSchemaResource,
  looksLikeFormSchema,
  parseFormSchema,
  printFormSchema,
  SCHEMA_MODEL_PROVIDER_ID,
} from './provider';

function sequentialIds(prefix = 'n'): NodeIdFactory {
  let counter = 0;
  return () => `${prefix}${String((counter += 1)).padStart(7, '0')}`;
}

const SCHEMA_TEXT = JSON.stringify(sampleSchema());

function ref(mediaType = 'application/json'): ResourceRef {
  return {
    id: 'fs:form.json',
    sourceId: 'fs',
    path: 'form.json',
    name: 'form.json',
    kind: 'file',
    mediaType,
  };
}

/** Проба над известным текстом — та, что достаётся кандидатам на пути открытия документа. */
function syncProbe(text: string): EditorProbe {
  return { text: () => Promise.resolve(text), peek: () => text } as EditorProbe;
}

/** Проба без `peek`: содержимое ещё не прочитано (дерево ресурсов даёт именно такую). */
function lazyProbe(text: string): EditorProbe {
  return { text: () => Promise.resolve(text) };
}

describe('parse', () => {
  it('выдаёт адрес каждому узлу схемы', () => {
    const model = parseFormSchema(SCHEMA_TEXT, sequentialIds());
    const missing: string[] = [];
    walkNodes(model, (node, path) => {
      if (nodeIdOf(node) === undefined) missing.push(path.join('/'));
    });
    expect(missing).toEqual([]);
  });

  it('отказывается разбирать не схему', () => {
    expect(() => parseFormSchema('{"name":"пакет"}')).toThrow();
    expect(() => parseFormSchema('нет')).toThrow();
  });

  it('файл с двумя узлами под одним адресом ОТКРЫВАЕТСЯ, а адрес чинится', () => {
    // Так выглядит копипаста поддерева в редакторе текста или склейка двух файлов.
    const twins = JSON.stringify({
      version: '1.0',
      root: {
        $nodeId: 'rrrrrrrr',
        component: '$html(div)',
        children: [
          { $nodeId: 'aaaaaaaa', value: '$model(a)', component: '$component(Input)' },
          { $nodeId: 'aaaaaaaa', value: '$model(b)', component: '$component(Input)' },
        ],
      },
    });

    const model = parseFormSchema(twins, sequentialIds('n'));
    const ids: string[] = [];
    walkNodes(model, (node) => {
      const id = nodeIdOf(node);
      if (id !== undefined) ids.push(id);
    });
    expect(new Set(ids).size).toBe(ids.length);
    // Первый носитель адрес сохранил: правка, уже нацеленная на него, попадёт куда целилась.
    expect(nodeIdOf(getAt(model, ['root', 'children', 0]) as JsonNode)).toBe('aaaaaaaa');
  });

  it('после починки указатель узлов ведёт к РАЗНЫМ узлам, а не к одному дважды', () => {
    const twins = JSON.stringify({
      version: '1.0',
      root: {
        $nodeId: 'rrrrrrrr',
        component: '$html(div)',
        children: [
          { $nodeId: 'aaaaaaaa', value: '$model(a)', component: '$component(Input)' },
          { $nodeId: 'aaaaaaaa', value: '$model(b)', component: '$component(Input)' },
        ],
      },
    });
    const model = parseFormSchema(twins, sequentialIds('n'));
    const index = indexNodes(model);
    const first = index.idAt(['root', 'children', 0]);
    const second = index.idAt(['root', 'children', 1]);
    expect(first).not.toBe(second);
    // Именно это и ломал двойник: адрес второго вёл на первый.
    expect(index.find(second!)?.path).toEqual(['root', 'children', 1]);
  });
});

describe('круговой обход', () => {
  it('разобрать → напечатать → разобрать даёт ту же модель', () => {
    const once = parseFormSchema(SCHEMA_TEXT, sequentialIds());
    const twice = parseFormSchema(printFormSchema(once), sequentialIds('другой-'));
    expect(twice).toEqual(once);
  });

  it('печать детерминированна', () => {
    const model = parseFormSchema(SCHEMA_TEXT, sequentialIds());
    expect(printFormSchema(model)).toBe(printFormSchema(model));
  });

  it('печать сохраняет адреса: повторный разбор не выдаёт новых', () => {
    const model = parseFormSchema(SCHEMA_TEXT, sequentialIds('a'));
    const text = printFormSchema(model);
    expect(text).toContain('"$nodeId": "a0000001"');
    const again = parseFormSchema(text, sequentialIds('b'));
    expect(JSON.stringify(again)).not.toContain('"b0');
  });

  it('обход переживает и правку: напечатанное после операции разбирается в то же', () => {
    const provider = createSchemaModelProvider({ newId: sequentialIds('a') });
    const model = provider.parse(SCHEMA_TEXT);
    const root = nodeIdOf(model.root);
    const applied = provider.apply(model, {
      ...insertOp({ component: '$component(Box)', children: [] }, { parent: root }),
    });
    expect(provider.parse(provider.print(applied.model))).toEqual(applied.model);
  });
});

describe('«моё — не моё»', () => {
  it('узнаёт схему формы по содержимому', () => {
    expect(looksLikeFormSchema(SCHEMA_TEXT)).toBe(true);
  });

  it('не берётся за чужой JSON и за неразбираемый текст', () => {
    expect(looksLikeFormSchema('{"name":"reformer","version":"1.0"}')).toBe(false);
    expect(looksLikeFormSchema('[]')).toBe(false);
    expect(looksLikeFormSchema('{ не json }')).toBe(false);
  });

  it('решает по содержимому, а не по расширению', () => {
    expect(isFormSchemaResource(ref(), syncProbe(SCHEMA_TEXT))).toBe(true);
    expect(isFormSchemaResource(ref(), syncProbe('{"name":"пакет"}'))).toBe(false);
  });

  it('не берётся за двоичный и нетекстовый ресурс', () => {
    expect(isFormSchemaResource(ref('image/png'), syncProbe(SCHEMA_TEXT))).toBe(false);
  });

  it('не гадает, когда содержимого нет', () => {
    expect(isFormSchemaResource(ref(), lazyProbe(SCHEMA_TEXT))).toBe(false);
  });
});

describe('вклад', () => {
  it('называется видом ресурса, который оболочка кладёт в контекст применимости', () => {
    expect(createSchemaModelProvider().id).toBe(SCHEMA_MODEL_PROVIDER_ID);
  });

  it('применяет операции тем же генератором адресов, что и разбор', () => {
    const provider = createSchemaModelProvider({ newId: sequentialIds('a') });
    const model = provider.parse(SCHEMA_TEXT);
    const root = nodeIdOf(model.root);
    const result = provider.apply(
      model,
      insertOp({ component: '$component(Box)', children: [] }, { parent: root })
    );
    expect(result.focus).toMatch(/^a\d{7}$/);
  });
});
