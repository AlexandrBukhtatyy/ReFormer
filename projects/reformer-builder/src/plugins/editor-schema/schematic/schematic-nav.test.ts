/**
 * Тесты навигации курсора в схематичном виде.
 *
 * Проверяется то, чего домен не знает: какие узлы вид сейчас РИСУЕТ. Скрытая обёртка —
 * законный узел модели и законная цель для `navTarget`, но курсор на ней выглядит как
 * несработавшая клавиша, поэтому шаг обязан идти дальше.
 *
 * @module plugins/editor-schema/schematic/schematic-nav.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { DEFAULT_COL_CLASS, DEFAULT_ROW_CLASS } from '@/lib/form-model/mutate';
import { ensureNodeIds, type NodeIdFactory } from '@/lib/form-model/node-id';
import type { JsonPath } from '@/lib/form-model/paths';
import { indexNodes } from '../model/node-index';
import { visibleTarget } from './schematic-nav';
import { buildSchematic, schematicOrder } from './schematic-tree';
import type { NodeId } from '../host';

function sequentialIds(prefix = 'b'): NodeIdFactory {
  let counter = 0;
  return () => `${prefix}${String((counter += 1)).padStart(7, '0')}`;
}

/** Столбец: поле, ряд-обёртка из двух полей, поле. */
function schema(): JsonFormSchema {
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
const LAST: JsonPath = ['root', 'children', 2];

function idAt(model: JsonFormSchema, path: JsonPath): NodeId {
  const id = indexNodes(model).idAt(path);
  if (id === undefined) throw new Error(`нет адреса по пути ${path.join('/')}`);
  return id;
}

/** Что рисует вид при заданной настройке скрытия. */
function shown(model: JsonFormSchema, hideWrappers: boolean): ReadonlySet<NodeId> {
  return new Set(schematicOrder(buildSchematic(model, { hideWrappers })));
}

describe('visibleTarget', () => {
  it('с видимыми обёртками ведёт себя как обычная навигация', () => {
    const model = schema();
    expect(visibleTarget(model, FIRST, 'down', shown(model, false))).toBe(idAt(model, ROW));
  });

  it('скрытую обёртку пропускает и идёт дальше в ТОМ ЖЕ направлении', () => {
    const model = schema();
    const visible = shown(model, true);
    // Обёртки в виде нет вовсе — курсор обязан оказаться на первой её колонке,
    // а не на самой обёртке.
    expect(visible.has(idAt(model, ROW))).toBe(false);
    expect(visibleTarget(model, FIRST, 'down', visible)).toBe(
      idAt(model, ['root', 'children', 1, 'children', 0])
    );
  });

  it('возвращается наверх тем же правилом', () => {
    const model = schema();
    const visible = shown(model, true);
    // Снизу вверх через ту же скрытую обёртку: следующая видимая — последняя её колонка.
    expect(visibleTarget(model, LAST, 'up', visible)).toBe(
      idAt(model, ['root', 'children', 1, 'children', 1])
    );
  });

  it('первый ребёнок «вверх» выходит к родителю — это правило домена, и оно сохранено', () => {
    const model = schema();
    expect(visibleTarget(model, FIRST, 'up', shown(model, false))).toBe(idAt(model, ['root']));
  });

  it('отвечает `null`, когда идти некуда', () => {
    const model = schema();
    // Корень соседей не имеет, и наружу из него не выйти.
    expect(visibleTarget(model, ['root'], 'up', shown(model, false))).toBeNull();
  });

  it('пустой вид означает, что идти некуда, а не бесконечный поиск', () => {
    const model = schema();
    expect(visibleTarget(model, FIRST, 'down', new Set())).toBeNull();
  });
});
