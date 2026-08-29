/**
 * Тесты развёртки модели в коробки.
 *
 * Проверяется то, чем схематичный вид отличается от дерева строк: ось родителя у каждой
 * коробки, признак «можно обернуть с соседом» и судьба скрытых обёрток. Всё это считается
 * до отрисовки, поэтому и проверяется без неё.
 *
 * @module plugins/editor-schema/schematic-tree.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { DEFAULT_COL_CLASS, DEFAULT_ROW_CLASS } from '@/lib/form-model/mutate';
import { ensureNodeIds, type NodeIdFactory } from '@/lib/form-model/node-id';
import { buildSchematic, findBox, schematicOrder, type SchematicBox } from './schematic-tree';

function sequentialIds(prefix = 'a'): NodeIdFactory {
  let counter = 0;
  return () => `${prefix}${String((counter += 1)).padStart(7, '0')}`;
}

function wizard(): JsonFormSchema {
  return ensureNodeIds(sampleSchema(), sequentialIds('a'));
}

/** Корневой столбец: ряд из двух полей и поле рядом с ним. */
function pairInRow(): JsonFormSchema {
  return ensureNodeIds(
    {
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
    } as unknown as JsonFormSchema,
    sequentialIds('b')
  );
}

function root(schema: JsonFormSchema, hideWrappers = false): SchematicBox {
  const box = buildSchematic(schema, { hideWrappers });
  if (box === null) throw new Error('корень не построился');
  return box;
}

/** Единственный слот с таким именем. */
function slotOf(box: SchematicBox, kind: string) {
  const slot = box.slots.find((s) => s.kind === kind);
  if (slot === undefined) throw new Error(`нет слота ${kind}`);
  return slot;
}

function boxAt(items: readonly { shape: string }[], index: number): SchematicBox {
  const item = items[index];
  if (item === undefined || item.shape !== 'box') throw new Error(`в позиции ${index} не коробка`);
  return item as SchematicBox;
}

describe('buildSchematic — ось и её наследование', () => {
  it('коробка знает свою ось и ось родителя', () => {
    const box = root(pairInRow());
    expect(box.orientation).toBe('vertical');

    const row = boxAt(slotOf(box, 'children').items, 0);
    expect(row.orientation).toBe('horizontal');
    // Ряд лежит в вертикальном корне — зоны у него считаются по вертикали.
    expect(row.parentOrientation).toBe('vertical');

    const city = boxAt(slotOf(row, 'children').items, 0);
    // А поле лежит в РЯДУ, поэтому «перед» и «после» у него слева и справа.
    expect(city.parentOrientation).toBe('horizontal');
  });

  it('слоты, кроме children, рисуются столбцом независимо от оси узла', () => {
    const box = root(wizard());
    expect(slotOf(box, 'steps').orientation).toBe('vertical');
  });
});

describe('buildSchematic — признаки коробки', () => {
  it('поле внутрь не принимает, контейнер принимает', () => {
    const box = root(pairInRow());
    const row = boxAt(slotOf(box, 'children').items, 0);
    expect(row.acceptsInside).toBe(true);
    expect(boxAt(slotOf(row, 'children').items, 0).acceptsInside).toBe(false);
  });

  it('обернуть можно соседа из children, но не шаг визарда и не шаблон элемента', () => {
    const wiz = root(wizard());
    const step = boxAt(slotOf(wiz, 'steps').items, 0);
    expect(step.canWrap).toBe(false);
    expect(boxAt(slotOf(step, 'children').items, 0).canWrap).toBe(true);

    const second = boxAt(slotOf(wiz, 'steps').items, 1);
    const array = boxAt(slotOf(second, 'children').items, 0);
    const template = boxAt(slotOf(array, 'template').items, 0);
    expect(template.canWrap).toBe(false);
  });

  it('направление переворачивается только у div', () => {
    const box = root(pairInRow());
    expect(box.flippable).toBe(true);
    expect(boxAt(slotOf(box, 'children').items, 1).flippable).toBe(false);
  });

  it('корень отмечен корнем, остальные — нет', () => {
    const box = root(pairInRow());
    expect(box.isRoot).toBe(true);
    expect(box.slot).toBeNull();
    const row = boxAt(slotOf(box, 'children').items, 0);
    expect(row.isRoot).toBe(false);
    expect(row.slot).toBe('children');
  });
});

describe('buildSchematic — пустые слоты', () => {
  it('пустой массив-слот приглашает бросок, одиночный — нет', () => {
    const schema = ensureNodeIds(
      {
        version: '1.0',
        root: { component: '$html(div)', componentProps: { className: 'flex' }, children: [] },
      } as unknown as JsonFormSchema,
      sequentialIds('c')
    );
    expect(slotOf(root(schema), 'children').empty).toBe(true);

    const wiz = root(wizard());
    const second = boxAt(slotOf(wiz, 'steps').items, 1);
    const array = boxAt(slotOf(second, 'children').items, 0);
    expect(slotOf(array, 'template').empty).toBe(false);
  });
});

describe('buildSchematic — скрытые обёртки', () => {
  it('обёртка уступает место прозрачной группе, сохраняя раскладку', () => {
    const box = root(pairInRow(), true);
    const items = slotOf(box, 'children').items;
    const group = items[0];
    if (group.shape !== 'group') throw new Error('обёртка не свернулась в группу');

    expect(group.orientation).toBe('horizontal');
    expect(group.items).toHaveLength(2);
    const city = boxAt(group.items, 0);
    // Ось родителя у детей осталась осью скрытой обёртки — иначе колонки схлопнулись бы.
    expect(city.parentOrientation).toBe('horizontal');
    expect(city.canWrap).toBe(true);
  });

  it('корень не скрывается, даже будучи div', () => {
    const box = root(pairInRow(), true);
    expect(box.shape).toBe('box');
    expect(box.isRoot).toBe(true);
  });

  it('пустая обёртка остаётся коробкой: иначе её нельзя было бы ни увидеть, ни удалить', () => {
    const schema = ensureNodeIds(
      {
        version: '1.0',
        root: {
          component: '$html(div)',
          componentProps: { className: DEFAULT_COL_CLASS },
          children: [
            {
              component: '$html(div)',
              componentProps: { className: DEFAULT_ROW_CLASS },
              children: [],
            },
          ],
        },
      } as unknown as JsonFormSchema,
      sequentialIds('d')
    );
    expect(slotOf(root(schema, true), 'children').items[0].shape).toBe('box');
  });
});

describe('schematicOrder и findBox', () => {
  it('порядок совпадает с порядком отрисовки и не включает группы', () => {
    const schema = pairInRow();
    const box = root(schema);
    const order = schematicOrder(box);
    expect(order).toEqual(['b0000001', 'b0000002', 'b0000003', 'b0000004', 'b0000005']);

    // Скрытая обёртка выпадает из порядка: выбрать её нельзя, значит и в диапазоне ей не место.
    expect(schematicOrder(root(schema, true))).toEqual([
      'b0000001',
      'b0000003',
      'b0000004',
      'b0000005',
    ]);
  });

  it('находит коробку по адресу, включая спрятанную под группой', () => {
    const box = root(pairInRow(), true);
    expect(findBox(box, 'b0000004')?.binding).toBe('zip');
    expect(findBox(box, 'b0000002')).toBeUndefined();
    expect(findBox(box, 'нет такого')).toBeUndefined();
  });
});
