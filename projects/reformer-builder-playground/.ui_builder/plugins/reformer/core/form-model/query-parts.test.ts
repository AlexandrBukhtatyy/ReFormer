/**
 * Именованные части документа: чтение разметки частей анализом и её невидимость для редактора.
 *
 * @module plugins/reformer/core/form-model/query-parts.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { ensureNodeIds, nodeIdOf } from './node-id';
import {
  collectOperatorNames,
  collectPartMounts,
  documentParts,
  indexNodePaths,
  partNameOf,
  partOfPath,
  partRefOf,
  rowTemplateOf,
  walkDocumentNodes,
  walkNodes,
} from './query';

const node = (value: unknown): JsonNode => value as JsonNode;
const input = (path: string): JsonNode =>
  node({ model: `$model(${path})`, component: '$component(Input)' });
const box = (...children: JsonNode[]): JsonNode => node({ component: '$component(Box)', children });

/** Часть `address` под двумя группами, часть `guest` — шаблон строки, часть `orphan` — ничья. */
function sample(): JsonFormSchema {
  return {
    format: 2,
    version: '1.0',
    parts: {
      address: box(input('city'), input('street')),
      guest: box(input('name'), node({ model: '$model(address)', part: '$part(address)' })),
      orphan: box(input('note')),
    },
    root: box(
      node({ model: '$model(home)', part: '$part(address)' }),
      node({ model: '$model(work)', part: '$part(address)' }),
      node({ model: '$model(guests)', item: '$part(guest)' }),
      node({ model: '$model(tags)', item: { $template: box(input('label')) } })
    ),
  } as JsonFormSchema;
}

describe('ссылка на часть', () => {
  it('имя части читается из оператора `$part(имя)`, а не из любого значения', () => {
    expect(partNameOf('$part(address)')).toBe('address');
    expect(partNameOf('$model(address)')).toBeUndefined();
    expect(partNameOf({ $template: {} })).toBeUndefined();
    expect(partNameOf(undefined)).toBeUndefined();
  });

  it('узел берёт разметку из части: подформа — ключом `part`, массив — ключом `item`', () => {
    expect(partRefOf(node({ model: '$model(home)', part: '$part(address)' }))).toBe('address');
    expect(partRefOf(node({ model: '$model(guests)', item: '$part(guest)' }))).toBe('guest');
    expect(partRefOf(node({ model: '$model(tags)', item: { $template: box() } }))).toBeUndefined();
    expect(partRefOf(input('city'))).toBeUndefined();
  });

  it('части документа — только записи, похожие на узел', () => {
    const schema = { format: 2, parts: { ok: box(), broken: 'текст' }, root: box() };
    expect([...documentParts(schema as unknown as JsonFormSchema).keys()]).toEqual(['ok']);
    expect(documentParts({ format: 2, root: box() } as JsonFormSchema).size).toBe(0);
  });

  it('шаблон строки: вписанный в узел либо разметка части; неизвестная часть — шаблона нет', () => {
    const parts = documentParts(sample());
    const inline = box(input('label'));
    expect(
      rowTemplateOf(node({ model: '$model(tags)', item: { $template: inline } }), parts)
    ).toEqual({ node: inline, part: null });
    expect(rowTemplateOf(node({ model: '$model(guests)', item: '$part(guest)' }), parts)).toEqual({
      node: parts.get('guest'),
      part: 'guest',
    });
    expect(
      rowTemplateOf(node({ model: '$model(guests)', item: '$part(nobody)' }), parts)
    ).toBeUndefined();
    expect(rowTemplateOf(input('city'), parts)).toBeUndefined();
  });

  it('часть места по его пути: `parts/<имя>/…` — часть, остальное — дерево корня', () => {
    expect(partOfPath(['parts', 'address', 'children', 0])).toBe('address');
    expect(partOfPath(['parts', 'address'])).toBe('address');
    expect(partOfPath(['root', 'children', 0])).toBeNull();
    expect(partOfPath(['parts'])).toBeNull();
  });
});

describe('обход документа для анализа', () => {
  it('посещает дерево корня, затем разметку КАЖДОЙ части по одному разу', () => {
    const seen: string[] = [];
    walkDocumentNodes(sample(), (visited, path, origin) => {
      const model = (visited as { model?: string }).model;
      if (model !== undefined) seen.push(`${origin.part ?? 'root'}:${model}@${path.join('/')}`);
    });
    expect(seen).toEqual([
      'root:$model(home)@root/children/0',
      'root:$model(work)@root/children/1',
      'root:$model(guests)@root/children/2',
      'root:$model(tags)@root/children/3',
      // Шаблон, вписанный в узел, — часть дерева корня.
      'root:$model(label)@root/children/3/item/$template/children/0',
      // Часть обходится как записана: `address` подключена трижды, посещена один раз.
      'address:$model(city)@parts/address/children/0',
      'address:$model(street)@parts/address/children/1',
      'guest:$model(name)@parts/guest/children/0',
      'guest:$model(address)@parts/guest/children/1',
      // Часть, которую никто не подключил, — тоже текст документа.
      'orphan:$model(note)@parts/orphan/children/0',
    ]);
  });

  it('места подключения: кто, откуда и под каким путём модели', () => {
    expect(
      collectPartMounts(sample()).map(
        (mount) => `${mount.origin.part ?? 'root'}:${mount.kind}:${mount.model}→${mount.part}`
      )
    ).toEqual([
      'root:group:home→address',
      'root:group:work→address',
      'root:rows:guests→guest',
      'guest:group:address→address',
    ]);
  });

  it('ссылка на часть, которой нет, — тоже место подключения: решает вызывающий', () => {
    const schema = {
      format: 2,
      root: box(node({ model: '$model(home)', part: '$part(nobody)' })),
    } as JsonFormSchema;
    expect(collectPartMounts(schema).map((mount) => mount.part)).toEqual(['nobody']);
    expect(documentParts(schema).has('nobody')).toBe(false);
  });
});

describe('редактор разметку частей не видит', () => {
  it('обход дерева редактора в части не заходит', () => {
    const models: string[] = [];
    walkNodes(sample(), (visited) => {
      const model = (visited as { model?: string }).model;
      if (model !== undefined) models.push(model);
    });
    expect(models).toEqual([
      '$model(home)',
      '$model(work)',
      '$model(guests)',
      '$model(tags)',
      '$model(label)',
    ]);
  });

  it('узлам частей идентификаторы не выдаются, и текст частей при этом не меняется', () => {
    const before = sample();
    const after = ensureNodeIds(before);
    expect(after.parts).toEqual(before.parts);
    walkDocumentNodes(after, (visited, _path, origin) => {
      expect(nodeIdOf(visited) === undefined).toBe(origin.part !== null);
    });
    // Указатель узлов редактора строится по дереву корня: частей в нём нет.
    for (const path of indexNodePaths(after).values()) expect(path[0]).toBe('root');
  });

  it('имена операторов собираются со всего документа — рендерер строит части теми же компонентами', () => {
    const schema = sample();
    (schema.parts as Record<string, JsonNode>).orphan = node({
      model: '$model(kind)',
      component: '$component(Select)',
      componentProps: { options: '$dataSource(KINDS)' },
    });
    const names = collectOperatorNames(schema);
    expect(names.components).toContain('Select');
    expect(names.dataSources).toEqual(['KINDS']);
  });
});
