/**
 * Тесты развёртки канваса: неоднородная вложенность, свёрнутые ветки и подписи.
 *
 * @module plugins/reformer/editor/canvas/canvas-tree.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { sampleSchema } from '../../../core/testing';
import { ensureNodeIds, type NodeIdFactory } from '../../../core/form-model';
import { canvasOrder, findRow, flattenCanvas, nodeTitle } from './canvas-tree';
import { indexNodes } from '../model/node-index';

function sequentialIds(): NodeIdFactory {
  let counter = 0;
  return () => `a${String((counter += 1)).padStart(7, '0')}`;
}

const SCHEMA = ensureNodeIds(sampleSchema(), sequentialIds());

describe('flattenCanvas', () => {
  it('обходит шаги мастера (его `children`) и шаблон элемента массива', () => {
    const rows = flattenCanvas(SCHEMA);
    const paths = rows.map((row) => row.path.join('/'));
    expect(paths).toContain('root/children/0');
    expect(paths).toContain('root/children/1/children/0');
    expect(paths).toContain('root/children/1/children/0/item/$template');
  });

  it('считает глубину от корня', () => {
    const rows = flattenCanvas(SCHEMA);
    expect(rows[0].depth).toBe(0);
    expect(rows.find((row) => row.path.join('/') === 'root/children/0')?.depth).toBe(1);
    expect(rows.find((row) => row.path.join('/') === 'root/children/0/children/0')?.depth).toBe(2);
  });

  it('называет слот, в котором лежит узел', () => {
    const rows = flattenCanvas(SCHEMA);
    expect(rows[0].slot).toBeNull();
    expect(rows[1].slot).toBe('steps');
    expect(findRow(rows, rows[2].id)?.slot).toBe('children');
  });

  it('свёрнутую ветку не обходит вовсе', () => {
    const rootId = indexNodes(SCHEMA).idAt(['root']);
    const rows = flattenCanvas(SCHEMA, { collapsed: new Set([rootId!]) });
    expect(rows).toHaveLength(1);
    expect(rows[0].expandable).toBe(true);
    expect(rows[0].expanded).toBe(false);
  });

  it('помечает выделенные строки', () => {
    const rows = flattenCanvas(SCHEMA);
    const target = rows[2].id;
    const marked = flattenCanvas(SCHEMA, { selection: [target] });
    expect(marked.filter((row) => row.selected).map((row) => row.id)).toEqual([target]);
  });

  it('показывает привязку поля и его вид', () => {
    const rows = flattenCanvas(SCHEMA);
    const field = rows.find((row) => row.binding === 'loanAmount');
    expect(field?.kind).toBe('field');
    expect(field?.component).toBe('InputNumber');
    const array = rows.find((row) => row.binding === 'properties');
    expect(array?.kind).toBe('array');
  });

  it('порядок строк — то, вдоль чего расширяется выделение', () => {
    const rows = flattenCanvas(SCHEMA);
    expect(canvasOrder(rows)).toEqual(rows.map((row) => row.id));
  });

  it('узел без адреса не попадает в развёртку вместе с поддеревом', () => {
    const rows = flattenCanvas({
      format: 2,
      version: '1.0',
      root: { component: '$component(Box)', children: [] },
    });
    expect(rows).toEqual([]);
  });
});

describe('nodeTitle', () => {
  it('предпочитает подпись поля', () => {
    expect(nodeTitle({ model: '$model(a)', componentProps: { label: 'Сумма' } } as JsonNode)).toBe(
      'Сумма'
    );
  });

  it('затем селектор, которым узел адресуют правила', () => {
    expect(nodeTitle({ component: '$component(Box)', selector: 'итог' } as JsonNode)).toBe('итог');
  });

  it('html-узел называет тегом, а не оператором', () => {
    expect(nodeTitle({ component: '$html(div)', children: [] } as JsonNode)).toBe('div');
  });

  it('узел без всего этого остаётся названным', () => {
    expect(nodeTitle({ children: [] } as unknown as JsonNode)).toBe('узел');
  });

  it('подформу называет именем её части', () => {
    expect(nodeTitle({ model: '$model(home)', part: '$part(address)' } as JsonNode)).toBe(
      'address'
    );
  });
});

describe('подформа и массив с именованной частью', () => {
  /**
   * Документ с `parts`: подформа (`{ model, part }`) и массив, чей шаблон строки — часть
   * (`item: "$part(...)"`). Править части редактор пока не умеет, но открывать обязан.
   */
  const WITH_PARTS = ensureNodeIds(
    {
      format: 2,
      version: '1.0',
      parts: {
        address: {
          component: '$component(Box)',
          children: [{ model: '$model(city)', component: '$component(Input)' }],
        },
      },
      root: {
        component: '$component(Box)',
        children: [
          { model: '$model(home)', part: '$part(address)' },
          { model: '$model(offices)', item: '$part(address)' },
          { model: '$model(name)', component: '$component(Input)' },
        ],
      },
    } as JsonFormSchema,
    sequentialIds()
  );

  it('стоят в дереве привязанными листьями без детей', () => {
    const rows = flattenCanvas(WITH_PARTS);
    expect(rows.map((row) => [row.kind, row.binding, row.depth])).toEqual([
      ['container', null, 0],
      ['part', 'home', 1],
      ['array', 'offices', 1],
      ['field', 'name', 1],
    ]);

    const [, part, array] = rows;
    expect(part.title).toBe('address');
    expect(part.component).toBeNull();
    expect(part.expandable).toBe(false);
    // Шаблон строки лежит в `parts`, а не в узле: разворачивать у массива нечего.
    expect(array.component).toBe('FieldArray');
    expect(array.expandable).toBe(false);
  });

  it('разметка частей в дерево не попадает: она не под корнем', () => {
    const rows = flattenCanvas(WITH_PARTS);
    expect(rows.some((row) => row.binding === 'city')).toBe(false);
    expect(indexNodes(WITH_PARTS).entries()).toHaveLength(rows.length);
  });
});
