/**
 * Тесты правила размещения: «в выделенный контейнер — внутрь, к выделенному полю — следом».
 *
 * @module plugins/reformer/editor/editing/placement.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { sampleSchema } from '../../../core/testing';
import { ensureNodeIds, type NodeIdFactory } from '../../../core/form-model';
import { indexNodes } from '../model/node-index';
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

/** Форма без визарда: корень — обычный контейнер. */
const PLAIN: JsonFormSchema = ensureNodeIds(
  {
    format: 2,
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [{ model: '$model(name)', component: '$component(Input)' }],
    },
  } as JsonFormSchema,
  sequentialIds()
);

describe('placementFor', () => {
  it('без выделения кладёт в конец корня', () => {
    expect(placementFor(PLAIN, [])).toEqual({ slot: 'children' });
    // Корень-визард: его `children` — слот шагов, другого слота у него нет.
    expect(placementFor(SCHEMA, [])).toEqual({ slot: 'steps' });
  });

  it('в выделенный контейнер — последним ребёнком', () => {
    const step = idAt(['root', 'children', 0]);
    expect(placementFor(SCHEMA, [step])).toEqual({ parent: step, slot: 'children' });
  });

  it('в визард — шагом: его `children` и есть слот шагов', () => {
    const root = idAt(['root']);
    expect(placementFor(SCHEMA, [root])).toEqual({ parent: root, slot: 'steps' });
  });

  it('к выделенному шагу — следующим шагом в слоте шагов визарда', () => {
    // Шаг — контейнер, поэтому выделенный шаг принимает внутрь; «следом» проверяется на узле,
    // который внутрь не принимает, но лежит среди шагов.
    const withLeaf = ensureNodeIds(
      {
        format: 2,
        version: '1.0',
        root: {
          component: '$component(Wizard)',
          children: [
            { component: '$component(Step)', componentProps: { title: 'A' }, children: [] },
            { component: '$component(Separator)', componentProps: {} },
          ],
        },
      } as JsonFormSchema,
      sequentialIds()
    );
    const index = indexNodes(withLeaf);
    const leaf = index.idAt(['root', 'children', 1]);
    const root = index.idAt(['root']);
    expect(placementFor(withLeaf, [leaf!])).toEqual({ parent: root, slot: 'steps', index: 2 });
  });

  it('к выделенному полю — следующим соседом в его слоте', () => {
    const field = idAt(['root', 'children', 0, 'children', 0]);
    const step = idAt(['root', 'children', 0]);
    expect(placementFor(SCHEMA, [field])).toEqual({ parent: step, slot: 'children', index: 1 });
  });

  it('множественное выделение решается первым узлом', () => {
    const first = idAt(['root', 'children', 0, 'children', 0]);
    const second = idAt(['root', 'children', 0, 'children', 1]);
    expect(placementFor(SCHEMA, [first, second]).index).toBe(1);
  });

  it('шаблон элемента массива — контейнер, значит внутрь него', () => {
    const template = idAt(['root', 'children', 1, 'children', 0, 'item', '$template']);
    expect(placementFor(SCHEMA, [template])).toEqual({ parent: template, slot: 'children' });
  });

  it('исчезнувшее выделение не мешает добавить: кладём в корень', () => {
    expect(placementFor(PLAIN, ['zzzzzzzz'])).toEqual({ slot: 'children' });
    expect(placementFor(SCHEMA, ['zzzzzzzz'])).toEqual({ slot: 'steps' });
  });
});
