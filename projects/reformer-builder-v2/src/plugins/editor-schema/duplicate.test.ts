/**
 * Тесты дублирования в направлении.
 *
 * Проверяется по модели: где встала копия, сколько их и получила ли она СВОИ адреса.
 * Последнее важнее всего: копия с чужим адресом — это двойник, на которого сработают
 * правила и диагностики оригинала.
 *
 * @module plugins/editor-schema/duplicate.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { DEFAULT_COL_CLASS, DEFAULT_ROW_CLASS } from '@/lib/form-model/mutate';
import { ensureNodeIds, type NodeIdFactory } from '@/lib/form-model/node-id';
import { getAt, type JsonPath } from '@/lib/form-model/paths';
import { walkNodes } from '@/lib/form-model/query';
import { planDuplicate } from './duplicate';
import { indexNodes } from './node-index';
import { applyEditOp } from './ops';
import type { EditOp, NodeId } from './host';

function sequentialIds(prefix = 'b'): NodeIdFactory {
  let counter = 0;
  return () => `${prefix}${String((counter += 1)).padStart(7, '0')}`;
}

/** Столбец из трёх полей; среднее — ряд из двух. */
function column(): JsonFormSchema {
  return ensureNodeIds(
    {
      version: '1.0',
      root: {
        component: '$html(div)',
        componentProps: { className: DEFAULT_COL_CLASS },
        children: [
          { value: '$model(first)', component: '$component(Input)' },
          {
            component: '$html(div)',
            componentProps: { className: DEFAULT_ROW_CLASS },
            children: [
              { value: '$model(city)', component: '$component(Input)' },
              { value: '$model(zip)', component: '$component(Input)' },
            ],
          },
          { value: '$model(last)', component: '$component(Input)' },
        ],
      },
    } as unknown as JsonFormSchema,
    sequentialIds()
  );
}

const FIRST: JsonPath = ['root', 'children', 0];
const ROW: JsonPath = ['root', 'children', 1];
const CITY: JsonPath = ['root', 'children', 1, 'children', 0];

function idAt(model: JsonFormSchema, path: JsonPath): NodeId {
  const id = indexNodes(model).idAt(path);
  if (id === undefined) throw new Error(`нет адреса по пути ${path.join('/')}`);
  return id;
}

function bindings(model: JsonFormSchema, slotPath: JsonPath): (string | undefined)[] {
  const list = getAt(model, slotPath);
  if (!Array.isArray(list)) throw new Error('по этому пути не массив');
  return (list as { value?: string; component?: string }[]).map(
    (node) => node.value ?? node.component
  );
}

function apply(model: JsonFormSchema, op: EditOp) {
  return applyEditOp(model, op, { newId: sequentialIds('z') });
}

function requireOp(op: EditOp | null): EditOp {
  if (op === null) throw new Error('планировщик отказал, а дублирование ожидалось');
  return op;
}

describe('planDuplicate', () => {
  it('вниз кладёт копию после узла', () => {
    const model = column();
    const op = requireOp(
      planDuplicate(model, [idAt(model, FIRST)], 'down', { newId: sequentialIds('n') })
    );
    const { model: next } = apply(model, op);

    expect(bindings(next, ['root', 'children'])).toEqual([
      '$model(first)',
      '$model(first)',
      '$html(div)',
      '$model(last)',
    ]);
  });

  it('вверх кладёт копию перед узлом', () => {
    const model = column();
    const op = requireOp(
      planDuplicate(model, [idAt(model, ['root', 'children', 2])], 'up', {
        newId: sequentialIds('n'),
      })
    );
    expect(bindings(apply(model, op).model, ['root', 'children'])).toEqual([
      '$model(first)',
      '$html(div)',
      '$model(last)',
      '$model(last)',
    ]);
  });

  it('в ряду направление читается по его оси', () => {
    const model = column();
    const op = requireOp(
      planDuplicate(model, [idAt(model, CITY)], 'right', { newId: sequentialIds('n') })
    );
    expect(bindings(apply(model, op).model, ['root', 'children', 1, 'children'])).toEqual([
      '$model(city)',
      '$model(city)',
      '$model(zip)',
    ]);
  });

  it('поперёк оси не дублирует: там нет соседства, есть вложенность', () => {
    const model = column();
    expect(planDuplicate(model, [idAt(model, FIRST)], 'right')).toBeNull();
    expect(planDuplicate(model, [idAt(model, CITY)], 'down')).toBeNull();
  });

  it('блок копируется целиком, одним шагом отмены и в прежнем порядке', () => {
    const model = column();
    const op = requireOp(
      planDuplicate(model, [idAt(model, FIRST), idAt(model, ROW)], 'down', {
        newId: sequentialIds('n'),
      })
    );
    const applied = apply(model, op);

    expect(bindings(applied.model, ['root', 'children'])).toEqual([
      '$model(first)',
      '$html(div)',
      '$model(first)',
      '$html(div)',
      '$model(last)',
    ]);
    expect(apply(applied.model, applied.inverse).model).toEqual(model);
  });

  it('копия получает свои адреса всему поддереву', () => {
    const model = column();
    const op = requireOp(
      planDuplicate(model, [idAt(model, ROW)], 'down', { newId: sequentialIds('n') })
    );
    const next = apply(model, op).model;

    const copy = getAt(next, ['root', 'children', 2]) as JsonFormSchema['root'];
    const ids: string[] = [];
    walkNodes({ ...next, root: copy }, (node) => {
      const id = (node as { $nodeId?: string }).$nodeId;
      if (id !== undefined) ids.push(id);
    });
    expect(ids.length).toBe(3);
    expect(ids.every((id) => id.startsWith('n'))).toBe(true);
    // Оригинал не тронут: его адреса на месте.
    expect(idAt(next, ROW)).toBe(idAt(model, ROW));
  });

  it('разрозненное выделение не дублируется', () => {
    const model = column();
    expect(
      planDuplicate(model, [idAt(model, FIRST), idAt(model, ['root', 'children', 2])], 'down')
    ).toBeNull();
  });
});
