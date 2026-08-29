/**
 * Тесты планировщика броска схематичного вида.
 *
 * Проверяется то, чего нет у дерева: обёрточные зоны. Главные вопросы здесь два — во что
 * превращается бросок на поперечный край и остаётся ли ход обратимым ОДНИМ шагом, потому что
 * составная правка из трёх операций отменяется целиком или не отменяется никак.
 *
 * Результат проверяется по МОДЕЛИ после применения, а не по форме операции: состав — деталь
 * реализации, а вот «поля встали в ряд, и отмена вернула как было» — обещание пользователю.
 *
 * @module plugins/editor-schema/schematic-drop.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { DEFAULT_COL_CLASS, DEFAULT_ROW_CLASS } from '@/lib/form-model/mutate';
import { ensureNodeIds, type NodeIdFactory } from '@/lib/form-model/node-id';
import { getAt, type JsonPath } from '@/lib/form-model/paths';
import { indexNodes } from './node-index';
import { applyEditOp } from './ops';
import { planSchematicDrop } from './schematic-drop';
import { planDrop } from './drag';
import type { EditOp, NodeId } from './host';

function sequentialIds(prefix = 'a'): NodeIdFactory {
  let counter = 0;
  return () => `${prefix}${String((counter += 1)).padStart(7, '0')}`;
}

/** Визард из фикстуры: шаг 0 держит два поля в `children`. */
function wizard(): JsonFormSchema {
  return ensureNodeIds(sampleSchema(), sequentialIds('a'));
}

/** Ряд из двух полей внутри корневого столбца — модель для случая «две колонки обёртки». */
function pairInRow(): JsonFormSchema {
  const schema = {
    version: '1.0',
    root: {
      component: '$html(div)',
      componentProps: { className: DEFAULT_COL_CLASS },
      children: [
        {
          component: '$html(div)',
          componentProps: { className: DEFAULT_ROW_CLASS },
          children: [
            { value: '$model(city)', component: '$component(Input)' },
            { value: '$model(zip)', component: '$component(Input)' },
          ],
        },
        { value: '$model(comment)', component: '$component(Input)' },
      ],
    },
  } as unknown as JsonFormSchema;
  return ensureNodeIds(schema, sequentialIds('b'));
}

const STEP_0_CHILD_0: JsonPath = ['root', 'componentProps', 'steps', 0, 'children', 0];
const STEP_0_CHILD_1: JsonPath = ['root', 'componentProps', 'steps', 0, 'children', 1];
const STEP_0: JsonPath = ['root', 'componentProps', 'steps', 0];
const ROW: JsonPath = ['root', 'children', 0];
const ROW_CHILD_0: JsonPath = ['root', 'children', 0, 'children', 0];
const ROW_CHILD_1: JsonPath = ['root', 'children', 0, 'children', 1];
const LOOSE: JsonPath = ['root', 'children', 1];

function idAt(model: JsonFormSchema, path: JsonPath): NodeId {
  const id = indexNodes(model).idAt(path);
  if (id === undefined) throw new Error(`нет адреса по пути ${path.join('/')}`);
  return id;
}

function newField(): JsonNode {
  return { value: '$model(phone)', component: '$component(Input)' } as JsonNode;
}

/** Применить операцию с детерминированными адресами. */
function apply(model: JsonFormSchema, op: EditOp) {
  return applyEditOp(model, op, { newId: sequentialIds('z') });
}

function nodeAt(model: JsonFormSchema, path: JsonPath): Record<string, unknown> {
  return getAt(model, path) as Record<string, unknown>;
}

function classNameAt(model: JsonFormSchema, path: JsonPath): unknown {
  const node = nodeAt(model, path) as { componentProps?: Record<string, unknown> };
  return node.componentProps?.className;
}

function childCount(model: JsonFormSchema, path: JsonPath): number {
  const kids = (nodeAt(model, path) as { children?: readonly unknown[] }).children;
  return Array.isArray(kids) ? kids.length : 0;
}

function requireOp(op: EditOp | null): EditOp {
  if (op === null) throw new Error('планировщик отказал, а бросок ожидался допустимым');
  return op;
}

describe('planSchematicDrop — плоские зоны отданы планировщику дерева', () => {
  it('before, after и into планируются тем же способом, что в дереве', () => {
    const model = wizard();
    const target = idAt(model, STEP_0_CHILD_1);
    const payload = { kind: 'new', node: newField() } as const;

    for (const [zone, position] of [
      ['before', 'before'],
      ['after', 'after'],
      ['into', 'inside'],
    ] as const) {
      expect(planSchematicDrop(model, payload, { target, zone })).toEqual(
        planDrop(model, payload, { target, position })
      );
    }
  });

  it('into в поле-лист остаётся запретом', () => {
    const model = wizard();
    const target = idAt(model, STEP_0_CHILD_0);
    expect(
      planSchematicDrop(model, { kind: 'new', node: newField() }, { target, zone: 'into' })
    ).toBeNull();
  });
});

describe('planSchematicDrop — обёрточные зоны с грузом палитры', () => {
  it('beside-after ставит новое поле в ряд справа от цели', () => {
    const model = wizard();
    const target = idAt(model, STEP_0_CHILD_1);
    const op = requireOp(
      planSchematicDrop(
        model,
        { kind: 'new', node: newField() },
        { target, zone: 'beside-after' },
        { newId: sequentialIds('n') }
      )
    );

    const { model: next } = apply(model, op);
    // На месте цели теперь ряд, а в нём цель и новое поле — именно в этом порядке.
    expect(classNameAt(next, STEP_0_CHILD_1)).toBe(DEFAULT_ROW_CLASS);
    expect(childCount(next, STEP_0_CHILD_1)).toBe(2);
    expect(nodeAt(next, [...STEP_0_CHILD_1, 'children', 0]).value).toBe('$model(loanAmount)');
    expect(nodeAt(next, [...STEP_0_CHILD_1, 'children', 1]).value).toBe('$model(phone)');
    // Соседей у шага не прибавилось: новое поле уехало внутрь ряда, а не встало рядом с ним.
    expect(childCount(next, STEP_0)).toBe(2);
  });

  it('beside-before ставит новое поле слева', () => {
    const model = wizard();
    const target = idAt(model, STEP_0_CHILD_1);
    const op = requireOp(
      planSchematicDrop(
        model,
        { kind: 'new', node: newField() },
        { target, zone: 'beside-before' },
        { newId: sequentialIds('n') }
      )
    );

    const { model: next } = apply(model, op);
    expect(nodeAt(next, [...STEP_0_CHILD_1, 'children', 0]).value).toBe('$model(phone)');
    expect(nodeAt(next, [...STEP_0_CHILD_1, 'children', 1]).value).toBe('$model(loanAmount)');
  });

  it('stack-* даёт столбец, а не ряд', () => {
    const model = wizard();
    const target = idAt(model, STEP_0_CHILD_1);
    const op = requireOp(
      planSchematicDrop(
        model,
        { kind: 'new', node: newField() },
        { target, zone: 'stack-after' },
        { newId: sequentialIds('n') }
      )
    );

    expect(classNameAt(apply(model, op).model, STEP_0_CHILD_1)).toBe(DEFAULT_COL_CLASS);
  });

  it('ход отменяется одним шагом и возвращает модель как была', () => {
    const model = wizard();
    const target = idAt(model, STEP_0_CHILD_1);
    const op = requireOp(
      planSchematicDrop(
        model,
        { kind: 'new', node: newField() },
        { target, zone: 'beside-after' },
        { newId: sequentialIds('n') }
      )
    );

    const applied = apply(model, op);
    const undone = apply(applied.model, applied.inverse);
    expect(undone.model).toEqual(model);
  });
});

describe('planSchematicDrop — обёрточные зоны с узлом канваса', () => {
  it('соседа ставит в ряд с целью и убирает со старого места', () => {
    const model = wizard();
    const target = idAt(model, STEP_0_CHILD_1);
    const dragged = idAt(model, STEP_0_CHILD_0);
    const op = requireOp(
      planSchematicDrop(model, { kind: 'node', id: dragged }, { target, zone: 'beside-before' })
    );

    const { model: next } = apply(model, op);
    // Оба поля теперь внутри одного ряда, и он единственный ребёнок шага.
    expect(childCount(next, STEP_0)).toBe(1);
    expect(classNameAt(next, STEP_0_CHILD_0)).toBe(DEFAULT_ROW_CLASS);
    expect(nodeAt(next, [...STEP_0_CHILD_0, 'children', 0]).value).toBe('$model(loanType)');
    expect(nodeAt(next, [...STEP_0_CHILD_0, 'children', 1]).value).toBe('$model(loanAmount)');
  });

  it('перемещение соседа тоже отменяется одним шагом', () => {
    const model = wizard();
    const target = idAt(model, STEP_0_CHILD_1);
    const dragged = idAt(model, STEP_0_CHILD_0);
    const op = requireOp(
      planSchematicDrop(model, { kind: 'node', id: dragged }, { target, zone: 'beside-before' })
    );

    const applied = apply(model, op);
    expect(apply(applied.model, applied.inverse).model).toEqual(model);
  });

  it('опустевшая обёртка сворачивается тем же ходом', () => {
    const model = pairInRow();
    // Вынимаем одну из двух колонок ряда и ставим её в ряд с полем снаружи: прежний ряд
    // остаётся с одной колонкой и обязан свернуться, иначе в схеме копится пустая вложенность.
    const target = idAt(model, LOOSE);
    const dragged = idAt(model, ROW_CHILD_0);
    const op = requireOp(
      planSchematicDrop(model, { kind: 'node', id: dragged }, { target, zone: 'beside-after' })
    );

    const applied = apply(model, op);
    const next = applied.model;
    // Корень остался с двумя детьми: бывший ряд свернулся до поля, а рядом встал новый ряд.
    expect(childCount(next, ['root'])).toBe(2);
    expect(nodeAt(next, ['root', 'children', 0]).value).toBe('$model(zip)');
    expect(classNameAt(next, ['root', 'children', 1])).toBe(DEFAULT_ROW_CLASS);
    expect(apply(next, applied.inverse).model).toEqual(model);
  });
});

describe('planSchematicDrop — две колонки одной обёртки переворачивают её', () => {
  it('вместо вложенного ряда переворачивает сам контейнер', () => {
    const model = pairInRow();
    const target = idAt(model, ROW_CHILD_0);
    const dragged = idAt(model, ROW_CHILD_1);
    const op = requireOp(
      planSchematicDrop(model, { kind: 'node', id: dragged }, { target, zone: 'stack-after' })
    );

    const { model: next } = apply(model, op);
    // Ряд стал столбцом, вложенности не прибавилось, порядок колонок прежний.
    expect(classNameAt(next, ROW)).toBe(DEFAULT_COL_CLASS);
    expect(childCount(next, ROW)).toBe(2);
    expect(nodeAt(next, ROW_CHILD_0).value).toBe('$model(city)');
    expect(nodeAt(next, ROW_CHILD_1).value).toBe('$model(zip)');
  });

  it('переворот со сменой порядка переставляет колонки', () => {
    const model = pairInRow();
    const target = idAt(model, ROW_CHILD_0);
    const dragged = idAt(model, ROW_CHILD_1);
    const op = requireOp(
      planSchematicDrop(model, { kind: 'node', id: dragged }, { target, zone: 'stack-before' })
    );

    const applied = apply(model, op);
    expect(nodeAt(applied.model, ROW_CHILD_0).value).toBe('$model(zip)');
    expect(nodeAt(applied.model, ROW_CHILD_1).value).toBe('$model(city)');
    expect(apply(applied.model, applied.inverse).model).toEqual(model);
  });
});

describe('planSchematicDrop — отказы', () => {
  it('корень обернуть не с чем', () => {
    const model = wizard();
    const target = idAt(model, ['root']);
    expect(
      planSchematicDrop(model, { kind: 'new', node: newField() }, { target, zone: 'beside-after' })
    ).toBeNull();
  });

  it('шаг визарда в div не заворачивается', () => {
    const model = wizard();
    const target = idAt(model, STEP_0);
    expect(
      planSchematicDrop(model, { kind: 'new', node: newField() }, { target, zone: 'beside-after' })
    ).toBeNull();
  });

  it('узел не оборачивается сам с собой', () => {
    const model = wizard();
    const target = idAt(model, STEP_0_CHILD_0);
    expect(
      planSchematicDrop(model, { kind: 'node', id: target }, { target, zone: 'beside-after' })
    ).toBeNull();
  });

  it('узел не оборачивается со своим потомком', () => {
    const model = pairInRow();
    const target = idAt(model, ROW_CHILD_0);
    const dragged = idAt(model, ROW);
    expect(
      planSchematicDrop(model, { kind: 'node', id: dragged }, { target, zone: 'beside-after' })
    ).toBeNull();
  });
});
