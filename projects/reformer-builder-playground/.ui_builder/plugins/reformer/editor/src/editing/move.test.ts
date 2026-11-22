/**
 * Тесты перемещения узла клавишами.
 *
 * Проверяется по МОДЕЛИ после применения, а не по форме операции: во что превратился ход —
 * деталь, а «поле уехало вниз и Ctrl+Z вернул его» — обещание пользователю.
 *
 * Главное здесь — проекция стрелки на ось: в столбце вниз означает соседа, а в ряду —
 * то же самое делает стрелка вправо. Разойдись это с раскладкой, клавиши работали бы
 * поперёк того, что человек видит.
 *
 * @module plugins/reformer/editor/editing/move.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { sampleSchema } from '../../../core/testing';
import { DEFAULT_COL_CLASS, DEFAULT_ROW_CLASS } from '../../../core/form-model';
import { ensureNodeIds, type NodeIdFactory } from '../../../core/form-model';
import { getAt, type JsonPath } from '../../../core/form-model';
import { planMove } from './move';
import { indexNodes } from '../model/node-index';
import { applyEditOp } from '../model/ops';
import type { EditOp, NodeId } from '../host';

function sequentialIds(prefix = 'a'): NodeIdFactory {
  let counter = 0;
  return () => `${prefix}${String((counter += 1)).padStart(7, '0')}`;
}

function wizard(): JsonFormSchema {
  return ensureNodeIds(sampleSchema(), sequentialIds('a'));
}

/** Столбец из трёх полей, среднее из которых — ряд из двух. */
function column(): JsonFormSchema {
  return ensureNodeIds(
    {
      format: 2,
      version: '1.0',
      root: {
        component: '$html(div)',
        componentProps: { className: DEFAULT_COL_CLASS },
        children: [
          { model: '$model(first)', component: '$component(Input)' },
          {
            component: '$html(div)',
            componentProps: { className: DEFAULT_ROW_CLASS },
            children: [
              { model: '$model(city)', component: '$component(Input)' },
              { model: '$model(zip)', component: '$component(Input)' },
            ],
          },
          { model: '$model(last)', component: '$component(Input)' },
        ],
      },
    } as unknown as JsonFormSchema,
    sequentialIds('b')
  );
}

const FIRST: JsonPath = ['root', 'children', 0];
const ROW: JsonPath = ['root', 'children', 1];
const CITY: JsonPath = ['root', 'children', 1, 'children', 0];
const ZIP: JsonPath = ['root', 'children', 1, 'children', 1];
const LAST: JsonPath = ['root', 'children', 2];
const STEP_0_CHILD_0: JsonPath = ['root', 'children', 0, 'children', 0];
const STEP_0_CHILD_1: JsonPath = ['root', 'children', 0, 'children', 1];

function idAt(model: JsonFormSchema, path: JsonPath): NodeId {
  const id = indexNodes(model).idAt(path);
  if (id === undefined) throw new Error(`нет адреса по пути ${path.join('/')}`);
  return id;
}

function bindings(model: JsonFormSchema, slotPath: JsonPath): (string | undefined)[] {
  const list = getAt(model, slotPath);
  if (!Array.isArray(list)) throw new Error(`по пути ${slotPath.join('/')} не массив`);
  return (list as { model?: string; component?: string }[]).map(
    (node) => node.model ?? node.component
  );
}

function apply(model: JsonFormSchema, op: EditOp) {
  return applyEditOp(model, op, { newId: sequentialIds('z') });
}

function requireOp(op: EditOp | null): EditOp {
  if (op === null) throw new Error('планировщик отказал, а перемещение ожидалось');
  return op;
}

describe('planMove — вдоль оси раскладки', () => {
  it('в столбце «вниз» меняет узел местами со следующим соседом', () => {
    const model = column();
    const op = requireOp(planMove(model, [idAt(model, FIRST)], 'down'));
    const { model: next } = apply(model, op);

    expect(bindings(next, ['root', 'children'])).toEqual([
      '$html(div)',
      '$model(first)',
      '$model(last)',
    ]);
  });

  it('в ряду то же делает стрелка «вправо», а «вниз» уже ничего не двигает', () => {
    const model = column();
    const city = idAt(model, CITY);
    const moved = apply(model, requireOp(planMove(model, [city], 'right'))).model;
    expect(bindings(moved, ['root', 'children', 1, 'children'])).toEqual([
      '$model(zip)',
      '$model(city)',
    ]);

    // «Вниз» в горизонтальном родителе означает не соседа, а вложение — а вкладывать
    // в поле нечего, поэтому хода нет.
    expect(planMove(model, [city], 'down')).toBeNull();
  });

  it('у края слота двигать некуда', () => {
    const model = column();
    expect(planMove(model, [idAt(model, FIRST)], 'up')).toBeNull();
    expect(planMove(model, [idAt(model, LAST)], 'down')).toBeNull();
  });

  it('перемещение отменяется одним шагом', () => {
    const model = column();
    const applied = apply(model, requireOp(planMove(model, [idAt(model, FIRST)], 'down')));
    expect(apply(applied.model, applied.inverse).model).toEqual(model);
  });

  it('непрерывный блок едет целиком', () => {
    const model = column();
    const op = requireOp(planMove(model, [idAt(model, FIRST), idAt(model, ROW)], 'down'));
    const { model: next } = apply(model, op);
    // Оба выделенных остались рядом и в прежнем порядке, а сосед перепрыгнул через них.
    expect(bindings(next, ['root', 'children'])).toEqual([
      '$model(last)',
      '$model(first)',
      '$html(div)',
    ]);
  });

  it('разрозненное выделение не двигается: какое перемещение имелось в виду — неизвестно', () => {
    const model = column();
    expect(planMove(model, [idAt(model, FIRST), idAt(model, LAST)], 'down')).toBeNull();
  });
});

describe('planMove — поперёк оси', () => {
  it('выносит узел из ряда наружу, сразу после него', () => {
    const model = column();
    // Родитель горизонтален, поэтому «наружу» — это стрелка ВВЕРХ: поперёк оси назад.
    const op = requireOp(planMove(model, [idAt(model, CITY)], 'up'));
    const { model: next } = apply(model, op);

    expect(bindings(next, ['root', 'children'])).toEqual([
      '$model(first)',
      '$html(div)',
      '$model(city)',
      '$model(last)',
    ]);
  });

  it('вкладывает узел в предыдущего соседа-контейнер', () => {
    const model = column();
    // В столбце «вправо» — вложить; предыдущий сосед `last` не контейнер, поэтому берём
    // узел после ряда: у него предыдущий сосед как раз ряд.
    const op = requireOp(planMove(model, [idAt(model, LAST)], 'right'));
    const { model: next } = apply(model, op);

    expect(bindings(next, ['root', 'children', 1, 'children'])).toEqual([
      '$model(city)',
      '$model(zip)',
      '$model(last)',
    ]);
    expect(bindings(next, ['root', 'children'])).toEqual(['$model(first)', '$html(div)']);
  });

  it('в поле вложить нельзя', () => {
    const model = column();
    // Предыдущий сосед — поле `first`, детей оно не принимает.
    expect(planMove(model, [idAt(model, ROW)], 'right')).toBeNull();
  });

  it('вложение и вынос работают только для одиночного выделения', () => {
    const model = column();
    const both = [idAt(model, CITY), idAt(model, ZIP)];
    expect(planMove(model, both, 'down')).toBeNull();
  });
});

describe('planMove — шаги визарда', () => {
  it('поля шага переставляются между собой', () => {
    const model = wizard();
    const op = requireOp(planMove(model, [idAt(model, STEP_0_CHILD_0)], 'down'));
    const { model: next } = apply(model, op);

    expect(bindings(next, ['root', 'children', 0, 'children'])).toEqual([
      '$model(loanAmount)',
      '$model(loanType)',
    ]);
  });

  it('поле выносится из шага в соседний слот шагов', () => {
    const model = wizard();
    // «Вправо» в вертикальном шаге — вложить, а предыдущего соседа у первого поля нет.
    expect(planMove(model, [idAt(model, STEP_0_CHILD_0)], 'right')).toBeNull();
    // «Влево» — вынести: поле встаёт среди шагов, сразу после своего.
    const op = requireOp(planMove(model, [idAt(model, STEP_0_CHILD_1)], 'left'));
    const { model: next } = apply(model, op);
    expect(bindings(next, ['root', 'children'])).toEqual([
      '$component(Step)',
      '$model(loanAmount)',
      '$component(Step)',
    ]);
  });

  it('шаги переставляются между собой в слоте шагов — `children` визарда', () => {
    const model = wizard();
    const first = idAt(model, ['root', 'children', 0]);
    const op = requireOp(planMove(model, [first], 'down'));
    // Соседа переносят через выделенный шаг; слот назван шагами, хотя лежит в `children`.
    expect(op).toMatchObject({ type: 'move', params: { slot: 'steps', index: 0 } });

    const applied = apply(model, op);
    expect(idAt(applied.model, ['root', 'children', 1])).toBe(first);
    expect(getAt(applied.model, ['root', 'componentProps'])).toEqual({ className: 'bg-white' });
    expect(apply(applied.model, applied.inverse).model).toEqual(model);
  });

  it('узел вкладывается в предыдущего соседа-визард шагом, даже если шагов у него ещё нет', () => {
    const model = ensureNodeIds(
      {
        format: 2,
        version: '1.0',
        root: {
          component: '$html(div)',
          componentProps: { className: DEFAULT_COL_CLASS },
          children: [
            { component: '$component(Wizard)' },
            { component: '$component(Step)', componentProps: { title: 'Шаг' }, children: [] },
          ],
        },
      } as unknown as JsonFormSchema,
      sequentialIds('w')
    );
    const step = idAt(model, ['root', 'children', 1]);
    const op = requireOp(planMove(model, [step], 'right'));
    expect(op).toMatchObject({ type: 'move', params: { slot: 'steps', index: 0 } });

    const { model: next } = apply(model, op);
    expect(idAt(next, ['root', 'children', 0, 'children', 0])).toBe(step);
    expect(bindings(next, ['root', 'children'])).toEqual(['$component(Wizard)']);
  });
});
