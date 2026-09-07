/**
 * Тесты указателя «адрес → путь».
 *
 * @module plugins/editor-schema/model/node-index.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { ensureNodeIds, type NodeIdFactory } from '@/lib/form-model/node-id';
import { indexNodes } from './node-index';

function sequentialIds(): NodeIdFactory {
  let counter = 0;
  return () => `a${String((counter += 1)).padStart(7, '0')}`;
}

const SCHEMA: JsonFormSchema = ensureNodeIds(sampleSchema(), sequentialIds());

describe('indexNodes', () => {
  it('видит все узлы: детей, шаги мастера и шаблон элемента массива', () => {
    const paths = indexNodes(SCHEMA)
      .entries()
      .map((entry) => entry.path.join('/'));
    expect(paths[0]).toBe('root');
    expect(paths).toContain('root/componentProps/steps/1');
    expect(paths).toContain('root/componentProps/steps/1/children/0/item/$template');
  });

  it('переводит адрес в путь и обратно', () => {
    const index = indexNodes(SCHEMA);
    const id = index.idAt(['root', 'componentProps', 'steps', 0, 'children', 1]);
    expect(id).toBeDefined();
    expect(index.find(id!)?.path).toEqual(['root', 'componentProps', 'steps', 0, 'children', 1]);
  });

  it('не знает того, чего в модели нет', () => {
    const index = indexNodes(SCHEMA);
    expect(index.find('zzzzzzzz')).toBeUndefined();
    expect(index.idAt(['root', 'children', 42])).toBeUndefined();
  });

  it('узел без адреса в указатель не попадает', () => {
    const index = indexNodes({
      version: '1.0',
      root: { component: '$component(Box)', children: [] },
    });
    expect(index.entries()).toEqual([]);
  });

  it('при совпадении адресов выигрывает первый по обходу', () => {
    const twin = { $nodeId: 'aaaaaaaa', component: '$component(Box)', children: [] };
    const index = indexNodes({
      version: '1.0',
      root: { $nodeId: 'bbbbbbbb', component: '$component(Box)', children: [twin, { ...twin }] },
    } as unknown as JsonFormSchema);
    expect(index.find('aaaaaaaa')?.path).toEqual(['root', 'children', 0]);
  });
});
