/**
 * Тесты планировщика перетаскивания.
 *
 * Здесь проверяется то, ради чего планировщик отделён от отрисовки: во что превращается бросок,
 * какие броски запрещены и КОГДА заказывается сворачивание вырожденной обёртки. Всё это правила
 * над моделью, и мышь для них не нужна — она нужна только чтобы довести до них событие,
 * и это проверяет браузерный прогон.
 *
 * Главная проверка здесь — обратимость составного хода: перетаскивание, свернувшее обёртку,
 * обязано отменяться ОДНИМ шагом и возвращать модель байт в байт, включая адрес обёртки.
 *
 * @module plugins/editor-schema/editing/drag.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { ensureNodeIds, nodeIdOf, type NodeIdFactory } from '@/lib/form-model/node-id';
import { getAt } from '@/lib/form-model/paths';
import { canDropInside, dropPositionAt, planDrop } from './drag';
import { indexNodes } from '../model/node-index';
import { applyEditOp, groupOp } from '../model/ops';

function sequentialIds(prefix = 'n'): NodeIdFactory {
  let counter = 0;
  return () => `${prefix}${String((counter += 1)).padStart(7, '0')}`;
}

function schema(): JsonFormSchema {
  return ensureNodeIds(sampleSchema(), sequentialIds('a'));
}

const STEP_0 = ['root', 'componentProps', 'steps', 0] as const;
const STEP_1 = ['root', 'componentProps', 'steps', 1] as const;

function idAt(model: JsonFormSchema, path: readonly (string | number)[]): string {
  const id = indexNodes(model).idAt(path);
  if (id === undefined) throw new Error(`нет адреса по пути ${path.join('/')}`);
  return id;
}

function newField(): JsonNode {
  return { value: '$model(comment)', component: '$component(Input)' } as JsonNode;
}

describe('dropPositionAt', () => {
  const rect = { top: 100, height: 20 };

  it('края строки-контейнера означают «перед» и «после», середина — «внутрь»', () => {
    expect(dropPositionAt(rect, 102, true)).toBe('before');
    expect(dropPositionAt(rect, 110, true)).toBe('inside');
    expect(dropPositionAt(rect, 118, true)).toBe('after');
  });

  it('у строки, не принимающей вложение, середины нет вовсе — половина на половину', () => {
    expect(dropPositionAt(rect, 104, false)).toBe('before');
    expect(dropPositionAt(rect, 116, false)).toBe('after');
    // Ровно посередине — «после»: у половины должна быть одна граница, а не две.
    expect(dropPositionAt(rect, 110, false)).toBe('after');
  });

  it('координата за пределами строки зажимается, а не даёт третьего ответа', () => {
    expect(dropPositionAt(rect, -500, true)).toBe('before');
    expect(dropPositionAt(rect, 5000, true)).toBe('after');
  });

  it('нулевая высота не делит на ноль', () => {
    expect(dropPositionAt({ top: 0, height: 0 }, 0, true)).toBe('inside');
    expect(dropPositionAt({ top: 0, height: 0 }, 0, false)).toBe('after');
  });
});

describe('canDropInside', () => {
  it('контейнер принимает, поле — нет', () => {
    const model = schema();
    expect(canDropInside(model, idAt(model, STEP_0))).toBe(true);
    expect(canDropInside(model, idAt(model, [...STEP_0, 'children', 1]))).toBe(false);
  });
});

describe('бросок с палитры', () => {
  it('«внутрь» контейнера — вставка в его слот', () => {
    const model = schema();
    const step = idAt(model, STEP_0);
    const op = planDrop(
      model,
      { kind: 'new', node: newField() },
      { target: step, position: 'inside' }
    );
    expect(op).toEqual({
      type: 'insert',
      target: step,
      params: { node: newField(), slot: 'children' },
    });
  });

  it('«перед» полем — вставка в слот родителя на его позицию', () => {
    const model = schema();
    const second = idAt(model, [...STEP_0, 'children', 1]);
    const op = planDrop(
      model,
      { kind: 'new', node: newField() },
      { target: second, position: 'before' }
    );
    const applied = applyEditOp(model, op!, { newId: sequentialIds('b') });
    expect(nodeIdOf(getAt(applied.model, [...STEP_0, 'children', 1]) as JsonNode)).toBe('b0000001');
  });

  it('«после» полем — следующей позицией', () => {
    const model = schema();
    const first = idAt(model, [...STEP_0, 'children', 0]);
    const op = planDrop(
      model,
      { kind: 'new', node: newField() },
      { target: first, position: 'after' }
    );
    const applied = applyEditOp(model, op!, { newId: sequentialIds('b') });
    expect(nodeIdOf(getAt(applied.model, [...STEP_0, 'children', 1]) as JsonNode)).toBe('b0000001');
  });

  it('«внутрь» визарда попадает в СЛОТ ШАГОВ, а не в children', () => {
    const model = schema();
    const root = idAt(model, ['root']);
    const op = planDrop(
      model,
      { kind: 'new', node: newField() },
      { target: root, position: 'inside' }
    );
    expect((op as { params?: { slot?: string } }).params?.slot).toBe('steps');
  });

  it('«внутрь» поля запрещено: подсветки не будет, и бросок ничего не сделает', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 1]);
    expect(
      planDrop(model, { kind: 'new', node: newField() }, { target: field, position: 'inside' })
    ).toBeNull();
  });

  it('«перед» корнем запрещено: соседей у корня нет', () => {
    const model = schema();
    const root = idAt(model, ['root']);
    expect(
      planDrop(model, { kind: 'new', node: newField() }, { target: root, position: 'before' })
    ).toBeNull();
  });

  it('«после» шаблона элемента запрещено: в одиночном слоте одно место', () => {
    const model = schema();
    const template = idAt(model, [...STEP_1, 'children', 0, 'item', '$template']);
    expect(
      planDrop(model, { kind: 'new', node: newField() }, { target: template, position: 'after' })
    ).toBeNull();
  });

  it('исчезнувшая цель — отказ, а не бросок в корень', () => {
    expect(
      planDrop(
        schema(),
        { kind: 'new', node: newField() },
        { target: 'zzzzzzzz', position: 'inside' }
      )
    ).toBeNull();
  });
});

describe('бросок узла с канваса', () => {
  it('переносит узел в другой шаг', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 1]);
    const step1 = idAt(model, STEP_1);
    const op = planDrop(model, { kind: 'node', id: field }, { target: step1, position: 'inside' });
    const applied = applyEditOp(model, op!);
    expect(nodeIdOf(getAt(applied.model, [...STEP_1, 'children', 1]) as JsonNode)).toBe(field);
    expect(applyEditOp(applied.model, applied.inverse).model).toEqual(model);
  });

  it('бросок на своё же место — отказ: шаг отмены без изменения хуже, чем ничего', () => {
    const model = schema();
    const first = idAt(model, [...STEP_0, 'children', 0]);
    const second = idAt(model, [...STEP_0, 'children', 1]);
    expect(
      planDrop(model, { kind: 'node', id: first }, { target: first, position: 'before' })
    ).toBeNull();
    expect(
      planDrop(model, { kind: 'node', id: first }, { target: first, position: 'after' })
    ).toBeNull();
    // «Перед вторым» для первого — то же самое место: после выреза индекс схлопывается.
    expect(
      planDrop(model, { kind: 'node', id: first }, { target: second, position: 'before' })
    ).toBeNull();
  });

  it('узел внутрь самого себя и внутрь своего потомка — отказ', () => {
    const model = schema();
    const array = idAt(model, [...STEP_1, 'children', 0]);
    const template = idAt(model, [...STEP_1, 'children', 0, 'item', '$template']);
    expect(
      planDrop(model, { kind: 'node', id: array }, { target: array, position: 'inside' })
    ).toBeNull();
    expect(
      planDrop(model, { kind: 'node', id: array }, { target: template, position: 'inside' })
    ).toBeNull();
  });

  it('перестановка соседей внутри слота — обычное перемещение без починок', () => {
    const model = schema();
    const first = idAt(model, [...STEP_0, 'children', 0]);
    const second = idAt(model, [...STEP_0, 'children', 1]);
    const op = planDrop(model, { kind: 'node', id: first }, { target: second, position: 'after' });
    expect(op?.type).toBe('move');
    const applied = applyEditOp(model, op!);
    expect(nodeIdOf(getAt(applied.model, [...STEP_0, 'children', 1]) as JsonNode)).toBe(first);
  });
});

describe('сворачивание вырожденной обёртки', () => {
  /** Схема, где два поля первого шага завёрнуты в flex-ряд. */
  function withRow(): { model: JsonFormSchema; row: string; left: string; right: string } {
    const base = schema();
    const first = idAt(base, [...STEP_0, 'children', 0]);
    const second = idAt(base, [...STEP_0, 'children', 1]);
    const model = applyEditOp(base, groupOp([first, second], { className: 'flex gap-4' }), {
      newId: sequentialIds('w'),
    }).model;
    return {
      model,
      row: idAt(model, [...STEP_0, 'children', 0]),
      left: first,
      right: second,
    };
  }

  it('вынос одной колонки заказывает состав «переместить + свернуть»', () => {
    const { model, row, right } = withRow();
    const step1 = idAt(model, STEP_1);
    const op = planDrop(model, { kind: 'node', id: right }, { target: step1, position: 'inside' });

    expect(op?.type).toBe('batch');
    const steps = op?.params?.ops as { type: string; target?: string }[];
    expect(steps.map((s) => s.type)).toEqual(['move', 'unwrap']);
    expect(steps[1].target).toBe(row);
  });

  it('состав применяется как один шаг и отменяется ОДНИМ — модель возвращается точно', () => {
    const { model, row, left, right } = withRow();
    const step1 = idAt(model, STEP_1);
    const op = planDrop(model, { kind: 'node', id: right }, { target: step1, position: 'inside' })!;

    const applied = applyEditOp(model, op);
    // Ряд исчез: на его месте стоит оставшаяся колонка.
    expect(nodeIdOf(getAt(applied.model, [...STEP_0, 'children', 0]) as JsonNode)).toBe(left);
    expect(indexNodes(applied.model).find(row)).toBeUndefined();
    // Выделение осталось на перетащенном узле, а не на остатке обёртки.
    expect(applied.focus).toBe(right);

    const back = applyEditOp(applied.model, applied.inverse);
    expect(back.model).toEqual(model);
    // Адрес обёртки вернулся ТОТ ЖЕ: правило, навешенное на неё, не потеряло цель.
    expect(idAt(back.model, [...STEP_0, 'children', 0])).toBe(row);
  });

  it('перестановка ВНУТРИ ряда обёртку не вырождает и починки не заказывает', () => {
    const { model, left, right } = withRow();
    const op = planDrop(model, { kind: 'node', id: right }, { target: left, position: 'before' });
    expect(op?.type).toBe('move');
  });

  it('обёртка с тремя детьми после выноса одного остаётся: она не вырождается', () => {
    const base = schema();
    const step = idAt(base, STEP_0);
    const withThird = applyEditOp(
      base,
      { type: 'insert', target: step, params: { node: newField() } },
      { newId: sequentialIds('b') }
    ).model;
    const ids = [0, 1, 2].map((i) => idAt(withThird, [...STEP_0, 'children', i]));
    const model = applyEditOp(withThird, groupOp(ids, { className: 'flex gap-4' }), {
      newId: sequentialIds('w'),
    }).model;

    const step1 = idAt(model, STEP_1);
    const op = planDrop(model, { kind: 'node', id: ids[2] }, { target: step1, position: 'inside' });
    expect(op?.type).toBe('move');
  });

  it('обёртка без flex/grid не сворачивается: это обычный контейнер, а не авто-ряд', () => {
    const base = schema();
    const first = idAt(base, [...STEP_0, 'children', 0]);
    const second = idAt(base, [...STEP_0, 'children', 1]);
    const model = applyEditOp(base, groupOp([first, second], { className: 'rounded border' }), {
      newId: sequentialIds('w'),
    }).model;

    const step1 = idAt(model, STEP_1);
    const op = planDrop(model, { kind: 'node', id: second }, { target: step1, position: 'inside' });
    expect(op?.type).toBe('move');
  });

  it('обёртка, чей остаток текстовый, не сворачивается: обратной операции не из чего собраться', () => {
    const model = {
      version: '1.0',
      root: {
        $nodeId: 'rrrrrrrr',
        component: '$html(div)',
        children: [
          {
            $nodeId: 'wwwwwwww',
            component: '$html(div)',
            componentProps: { className: 'flex gap-4' },
            children: ['подпись', { $nodeId: 'ffffffff', component: '$html(span)', children: [] }],
          },
          { $nodeId: 'dddddddd', component: '$html(div)', children: [] },
        ],
      },
    } as unknown as JsonFormSchema;

    const op = planDrop(
      model,
      { kind: 'node', id: 'ffffffff' },
      { target: 'dddddddd', position: 'inside' }
    );
    expect(op?.type).toBe('move');
  });
});
