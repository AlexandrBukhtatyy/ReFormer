/**
 * Тесты правила размещения: «в выделенный контейнер — внутрь, к выделенному полю — следом».
 *
 * @module plugins/editor-schema/placement.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { ensureNodeIds, type NodeIdFactory } from '@/lib/form-model/node-id';
import { indexNodes } from './node-index';
import { placementFor } from './placement';

function sequentialIds(): NodeIdFactory {
  let counter = 0;
  return () => `a${String((counter += 1)).padStart(7, '0')}`;
}

const SCHEMA: JsonFormSchema = ensureNodeIds(sampleSchema(), sequentialIds());

function idAt(path: readonly (string | number)[]): string {
  const id = indexNodes(SCHEMA).idAt(path);
  if (id === undefined) throw new Error(`нет адреса по пути ${path.join('/')}`);
  return id;
}

describe('placementFor', () => {
  it('без выделения кладёт в конец корня', () => {
    expect(placementFor(SCHEMA, [])).toEqual({ slot: 'children' });
  });

  it('в выделенный контейнер — последним ребёнком', () => {
    const step = idAt(['root', 'componentProps', 'steps', 0]);
    expect(placementFor(SCHEMA, [step])).toEqual({ parent: step, slot: 'children' });
  });

  it('в визард — шагом, а не ребёнком: `children` он не рендерит вовсе', () => {
    const root = idAt(['root']);
    expect(placementFor(SCHEMA, [root])).toEqual({ parent: root, slot: 'steps' });
  });

  it('к выделенному полю — следующим соседом в его слоте', () => {
    const field = idAt(['root', 'componentProps', 'steps', 0, 'children', 0]);
    const step = idAt(['root', 'componentProps', 'steps', 0]);
    expect(placementFor(SCHEMA, [field])).toEqual({ parent: step, slot: 'children', index: 1 });
  });

  it('множественное выделение решается первым узлом', () => {
    const first = idAt(['root', 'componentProps', 'steps', 0, 'children', 0]);
    const second = idAt(['root', 'componentProps', 'steps', 0, 'children', 1]);
    expect(placementFor(SCHEMA, [first, second]).index).toBe(1);
  });

  it('шаблон элемента массива — контейнер, значит внутрь него', () => {
    const template = idAt([
      'root',
      'componentProps',
      'steps',
      1,
      'children',
      0,
      'item',
      '$template',
    ]);
    expect(placementFor(SCHEMA, [template])).toEqual({ parent: template, slot: 'children' });
  });

  it('исчезнувшее выделение не мешает добавить: кладём в корень', () => {
    expect(placementFor(SCHEMA, ['zzzzzzzz'])).toEqual({ slot: 'children' });
  });
});
