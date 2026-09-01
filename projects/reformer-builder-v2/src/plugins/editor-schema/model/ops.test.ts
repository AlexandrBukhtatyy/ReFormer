/**
 * Тесты операций правки.
 *
 * Проверяется то, ради чего модуль устроен именно так: чистота, structural sharing и точная
 * обратимость. Идентификаторы выдаются подставным генератором — иначе ожидание пришлось бы
 * подсматривать в результате, а не писать.
 *
 * @module plugins/editor-schema/model/ops.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { ensureNodeIds, nodeIdOf, type NodeIdFactory } from '@/lib/form-model/node-id';
import { getAt } from '@/lib/form-model/paths';
import { walkNodes } from '@/lib/form-model/query';
import {
  applyEditOp,
  batchOp,
  duplicateOp,
  flipOp,
  groupOp,
  insertOp,
  mergeKeyOf,
  moveOp,
  removeOp,
  renamePropOp,
  SchemaOpError,
  setBindingOp,
  setComponentOp,
  setPropOp,
  setTextOp,
  slotPositionOf,
  unwrapOp,
} from './ops';
import { indexNodes } from './node-index';

/** Детерминированный генератор: восемь символов `[0-9a-z]`, как требует форма адреса. */
function sequentialIds(prefix = 'n'): NodeIdFactory {
  let counter = 0;
  return () => `${prefix}${String((counter += 1)).padStart(7, '0')}`;
}

/** Схема-фикстура с выданными адресами. */
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

describe('slotPositionOf', () => {
  it('различает три вида вложенности', () => {
    expect(slotPositionOf(['root', 'children', 2])).toEqual({
      parentPath: ['root'],
      slot: 'children',
      index: 2,
    });
    expect(slotPositionOf(['root', 'componentProps', 'steps', 1])).toEqual({
      parentPath: ['root'],
      slot: 'steps',
      index: 1,
    });
    // Шаблон элемента массива — одиночный слот: соседей у него нет, вставки он не принимает.
    expect(slotPositionOf(['root', 'children', 0, 'item', '$template'])).toBeNull();
  });
});

describe('insert', () => {
  it('вставляет узел, выдаёт ему новый адрес и возвращает обратную операцию', () => {
    const model = schema();
    const step = idAt(model, STEP_0);
    const result = applyEditOp(model, insertOp(newField(), { parent: step, index: 0 }), {
      newId: sequentialIds('b'),
    });

    const inserted = getAt(result.model, [...STEP_0, 'children', 0]) as JsonNode;
    expect(nodeIdOf(inserted)).toBe('b0000001');
    expect(result.focus).toBe('b0000001');
    expect(result.inverse).toEqual(removeOp('b0000001'));
    // Исходная модель не тронута: правка чистая.
    expect((getAt(model, [...STEP_0, 'children']) as unknown[]).length).toBe(2);
  });

  it('сохраняет нетронутые ветки по ссылке', () => {
    const model = schema();
    const step = idAt(model, STEP_0);
    const before = getAt(model, STEP_1);
    const result = applyEditOp(model, insertOp(newField(), { parent: step }), {
      newId: sequentialIds('b'),
    });
    expect(getAt(result.model, STEP_1)).toBe(before);
  });

  it('перевыдаёт адреса всему вставляемому поддереву', () => {
    const model = schema();
    const step = idAt(model, STEP_0);
    const donor = getAt(model, [...STEP_1, 'children', 0]) as JsonNode;
    const result = applyEditOp(model, insertOp(donor, { parent: step, index: 0 }), {
      newId: sequentialIds('b'),
    });

    const copy = getAt(result.model, [...STEP_0, 'children', 0]) as JsonNode;
    const copied: string[] = [];
    walkNodes({ ...result.model, root: copy } as JsonFormSchema, (node) => {
      const id = nodeIdOf(node);
      if (id !== undefined) copied.push(id);
    });
    expect(copied.length).toBeGreaterThan(1);
    expect(copied.every((id) => id.startsWith('b'))).toBe(true);
  });

  it('с `keepIds` оставляет адреса как есть — так возвращается удалённое', () => {
    const model = schema();
    const step = idAt(model, STEP_0);
    const node = getAt(model, [...STEP_1, 'children', 0]) as JsonNode;
    const result = applyEditOp(model, insertOp(node, { parent: step, index: 0, keepIds: true }), {
      newId: sequentialIds('b'),
    });
    expect(nodeIdOf(getAt(result.model, [...STEP_0, 'children', 0]) as JsonNode)).toBe(
      nodeIdOf(node)
    );
  });

  it('отказывается вставлять в лист', () => {
    const model = schema();
    const leaf = idAt(model, [...STEP_0, 'children', 1]);
    expect(() => applyEditOp(model, insertOp(newField(), { parent: leaf }))).toThrow(SchemaOpError);
  });
});

describe('remove', () => {
  it('удаляет узел, а обратная операция возвращает его на место без изменений', () => {
    const model = schema();
    const target = idAt(model, [...STEP_0, 'children', 0]);
    const removed = applyEditOp(model, removeOp(target));

    expect((getAt(removed.model, [...STEP_0, 'children']) as unknown[]).length).toBe(1);
    expect(removed.focus).toBe(idAt(model, STEP_0));

    const restored = applyEditOp(removed.model, removed.inverse);
    expect(restored.model).toEqual(model);
  });

  it('переносит выделение на родителя', () => {
    const model = schema();
    const parent = idAt(model, STEP_1);
    const target = idAt(model, [...STEP_1, 'children', 0]);
    expect(applyEditOp(model, removeOp(target)).focus).toBe(parent);
  });

  it('отказывается удалять узел одиночного слота', () => {
    const model = schema();
    const template = idAt(model, [...STEP_1, 'children', 0, 'item', '$template']);
    expect(() => applyEditOp(model, removeOp(template))).toThrow(SchemaOpError);
  });
});

describe('move', () => {
  it('переносит узел в другой слот, обратная операция возвращает его', () => {
    const model = schema();
    const target = idAt(model, [...STEP_0, 'children', 0]);
    const parent = idAt(model, STEP_1);
    const moved = applyEditOp(model, moveOp(target, { parent, index: 0 }));

    expect((getAt(moved.model, [...STEP_0, 'children']) as unknown[]).length).toBe(1);
    expect(nodeIdOf(getAt(moved.model, [...STEP_1, 'children', 0]) as JsonNode)).toBe(target);
    expect(applyEditOp(moved.model, moved.inverse).model).toEqual(model);
  });

  it('компенсирует индекс при перестановке внутри одного слота', () => {
    const model = schema();
    const first = idAt(model, [...STEP_0, 'children', 0]);
    const parent = idAt(model, STEP_0);
    const moved = applyEditOp(model, moveOp(first, { parent, index: 2 }));
    expect(nodeIdOf(getAt(moved.model, [...STEP_0, 'children', 1]) as JsonNode)).toBe(first);
  });

  it('перестановка внутри слота отменяется точно в обе стороны', () => {
    // Обратная операция называет позицию в координатах ДО выреза, и для перестановки влево
    // эти координаты сдвинуты: без поправки отмена возвращала узел на то же место, где он
    // уже стоит, — то есть не отменяла ничего.
    const model = schema();
    const parent = idAt(model, STEP_0);

    const left = applyEditOp(
      model,
      moveOp(idAt(model, [...STEP_0, 'children', 1]), { parent, index: 0 })
    );
    expect(applyEditOp(left.model, left.inverse).model).toEqual(model);

    const right = applyEditOp(
      model,
      moveOp(idAt(model, [...STEP_0, 'children', 0]), { parent, index: 2 })
    );
    expect(applyEditOp(right.model, right.inverse).model).toEqual(model);
  });

  it('отказывается переместить узел внутрь самого себя', () => {
    const model = schema();
    const array = idAt(model, [...STEP_1, 'children', 0]);
    expect(() => applyEditOp(model, moveOp(array, { parent: array, index: 0 }))).toThrow(
      SchemaOpError
    );
  });
});

describe('duplicate', () => {
  it('кладёт копию следом и выдаёт ей новые адреса', () => {
    const model = schema();
    const target = idAt(model, [...STEP_1, 'children', 0]);
    const result = applyEditOp(model, duplicateOp(target), { newId: sequentialIds('c') });

    const original = getAt(result.model, [...STEP_1, 'children', 0]) as JsonNode;
    const copy = getAt(result.model, [...STEP_1, 'children', 1]) as JsonNode;
    expect(nodeIdOf(original)).toBe(target);
    expect(nodeIdOf(copy)).toBe('c0000001');
    expect(result.focus).toBe('c0000001');

    // Двойника не остаётся ни на одном уровне: адреса поддерева тоже перевыданы.
    const ids = new Set<string>();
    walkNodes(result.model, (node) => {
      const id = nodeIdOf(node);
      if (id !== undefined) {
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    });
  });

  it('обратная операция убирает копию, а не оригинал', () => {
    const model = schema();
    const target = idAt(model, [...STEP_0, 'children', 0]);
    const result = applyEditOp(model, duplicateOp(target), { newId: sequentialIds('c') });
    expect(applyEditOp(result.model, result.inverse).model).toEqual(model);
  });
});

describe('group / ungroup', () => {
  it('заворачивает соседей в контейнер и разворачивает обратно', () => {
    const model = schema();
    const first = idAt(model, [...STEP_0, 'children', 0]);
    const second = idAt(model, [...STEP_0, 'children', 1]);

    const grouped = applyEditOp(model, groupOp([first, second]), { newId: sequentialIds('g') });
    const group = getAt(grouped.model, [...STEP_0, 'children', 0]) as JsonNode;
    expect((group as { component?: string }).component).toBe('$html(div)');
    expect((getAt(grouped.model, [...STEP_0, 'children']) as unknown[]).length).toBe(1);
    expect(grouped.focus).toBe('g0000001');

    const back = applyEditOp(grouped.model, grouped.inverse);
    expect(back.model).toEqual(model);
  });

  it('отказывается группировать узлы разных слотов', () => {
    const model = schema();
    const here = idAt(model, [...STEP_0, 'children', 0]);
    const there = idAt(model, [...STEP_1, 'children', 0]);
    expect(() => applyEditOp(model, groupOp([here, there]))).toThrow(SchemaOpError);
  });
});

describe('unwrap', () => {
  /**
   * Схема, в которой первое поле шага завёрнуто в ряд вместе с соседом — так выглядит результат
   * группировки двух полей или файл, набранный руками под drag-раскладку.
   */
  function withRow(): JsonFormSchema {
    const model = schema();
    const first = idAt(model, [...STEP_0, 'children', 0]);
    const second = idAt(model, [...STEP_0, 'children', 1]);
    return applyEditOp(model, groupOp([first, second], { className: 'flex gap-4' }), {
      newId: sequentialIds('w'),
    }).model;
  }

  it('сворачивает обёртку с одним ребёнком и возвращает обратную, восстанавливающую ЕЁ ЖЕ', () => {
    const model = withRow();
    const rowId = idAt(model, [...STEP_0, 'children', 0]);
    const inner = idAt(model, [...STEP_0, 'children', 0, 'children', 1]);
    // Вынимаем одну колонку: обёртка становится вырожденной.
    const after = applyEditOp(model, removeOp(inner)).model;

    const result = applyEditOp(after, unwrapOp(rowId));
    const survivor = getAt(result.model, [...STEP_0, 'children', 0]) as JsonNode;
    expect((survivor as { component?: string }).component).toBe('$component(Select)');
    expect(result.focus).toBe(nodeIdOf(survivor));

    const back = applyEditOp(result.model, result.inverse);
    expect(back.model).toEqual(after);
    // Адрес обёртки вернулся тот же — иначе правило, навешенное на неё, потеряло бы цель.
    expect(idAt(back.model, [...STEP_0, 'children', 0])).toBe(rowId);
  });

  it('отказывается трогать обёртку, в которой ещё двое', () => {
    const model = withRow();
    const rowId = idAt(model, [...STEP_0, 'children', 0]);
    expect(() => applyEditOp(model, unwrapOp(rowId))).toThrow(SchemaOpError);
  });

  it('отказывается сворачивать контейнер без flex/grid — это не авто-обёртка', () => {
    const model = schema();
    const first = idAt(model, [...STEP_0, 'children', 0]);
    const grouped = applyEditOp(model, groupOp([first], { className: 'rounded border' }), {
      newId: sequentialIds('w'),
    }).model;
    const boxId = idAt(grouped, [...STEP_0, 'children', 0]);
    expect(() => applyEditOp(grouped, unwrapOp(boxId))).toThrow(SchemaOpError);
  });

  it('отказывается, когда единственный ребёнок — текст: у него нет адреса для обратной', () => {
    const model = {
      version: '1.0',
      root: {
        $nodeId: 'rrrrrrrr',
        component: '$html(div)',
        children: [
          {
            $nodeId: 'wwwwwwww',
            component: '$html(div)',
            componentProps: { className: 'flex' },
            children: ['текст'],
          },
        ],
      },
    } as unknown as JsonFormSchema;
    expect(() => applyEditOp(model, unwrapOp('wwwwwwww'))).toThrow(SchemaOpError);
  });
});

describe('flip', () => {
  it('переворачивает направление контейнера, а обратной служит он сам', () => {
    const model = schema();
    const first = idAt(model, [...STEP_0, 'children', 0]);
    const second = idAt(model, [...STEP_0, 'children', 1]);
    const grouped = applyEditOp(model, groupOp([first, second], { className: 'flex gap-4' }), {
      newId: sequentialIds('w'),
    }).model;
    const rowId = idAt(grouped, [...STEP_0, 'children', 0]);

    const flipped = applyEditOp(grouped, flipOp(rowId));
    const props = (
      getAt(flipped.model, [...STEP_0, 'children', 0]) as JsonNode & {
        componentProps?: { className?: string };
      }
    ).componentProps;
    expect(props?.className).toContain('flex-col');
    expect(flipped.focus).toBe(rowId);

    // Обратная — тот же переворот, и он обязан вернуть исходную строку класса целиком,
    // а не «похожую»: класс правят руками, и лишний токен в нём заметен на превью.
    expect(applyEditOp(flipped.model, flipped.inverse).model).toEqual(grouped);
  });

  it('отказывается переворачивать поле: направления у него нет', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 0]);
    expect(() => applyEditOp(model, flipOp(field))).toThrow(SchemaOpError);
  });
});

describe('batch', () => {
  it('применяет состав как один шаг и обращается составом обратных в обратном порядке', () => {
    const model = schema();
    const step1 = idAt(model, STEP_1);
    const field = idAt(model, [...STEP_0, 'children', 1]);

    const op = batchOp([
      moveOp(field, { parent: step1, index: 0 }),
      setPropOp(field, 'placeholder', 'сумма'),
    ]);
    const result = applyEditOp(model, op);

    expect((getAt(result.model, [...STEP_1, 'children', 0]) as { $nodeId?: string }).$nodeId).toBe(
      field
    );
    expect(applyEditOp(result.model, result.inverse).model).toEqual(model);
  });

  it('отказ на любом шаге не оставляет полуправки', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 1]);
    const op = batchOp([removeOp(field), removeOp('zzzzzzzz')]);
    expect(() => applyEditOp(model, op)).toThrow(SchemaOpError);
    // Модель у вызывающего осталась прежней: правки чистые, а состав собирается в стороне.
    expect((getAt(model, [...STEP_0, 'children']) as unknown[]).length).toBe(2);
  });

  it('смотрит на узел НАМЕРЕНИЯ, а не на последнюю починку', () => {
    const model = schema();
    const step1 = idAt(model, STEP_1);
    const field = idAt(model, [...STEP_0, 'children', 1]);
    const other = idAt(model, [...STEP_0, 'children', 0]);
    const result = applyEditOp(
      model,
      batchOp([moveOp(field, { parent: step1, index: 0 }), setPropOp(other, 'label', 'иначе')])
    );
    expect(result.focus).toBe(field);
  });

  it('состав не вкладывается в состав', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 1]);
    expect(() => applyEditOp(model, batchOp([batchOp([removeOp(field)])]))).toThrow(SchemaOpError);
  });

  it('пустой состав — отказ, а не тишина', () => {
    expect(() => applyEditOp(schema(), batchOp([]))).toThrow(SchemaOpError);
  });

  it('структурный состав в истории отдельной записью: ключа схлопывания у него нет', () => {
    expect(mergeKeyOf(batchOp([removeOp('abcdefgh')]))).toBeUndefined();
  });
});

describe('set-text', () => {
  function withText(children: unknown[]): JsonFormSchema {
    return {
      version: '1.0',
      root: {
        $nodeId: 'rrrrrrrr',
        component: '$html(div)',
        children: [{ $nodeId: 'tttttttt', component: '$html(b)', children }],
      },
    } as unknown as JsonFormSchema;
  }

  it('пишет текст, а обратная возвращает прежний', () => {
    const model = withText([' старый']);
    const result = applyEditOp(model, setTextOp('tttttttt', 'новый'));
    expect(
      (getAt(result.model, ['root', 'children', 0]) as { children: unknown[] }).children[0]
    ).toBe('новый');
    expect(result.inverse).toEqual(setTextOp('tttttttt', ' старый'));
    expect(applyEditOp(result.model, result.inverse).model).toEqual(model);
  });

  it('пустая строка убирает текстовую часть, и обратная её возвращает', () => {
    const model = withText(['есть']);
    const result = applyEditOp(model, setTextOp('tttttttt', ''));
    expect(
      (getAt(result.model, ['root', 'children', 0]) as { children: unknown[] }).children
    ).toEqual([]);
    expect(applyEditOp(result.model, result.inverse).model).toEqual(model);
  });

  it('узел БЕЗ текста получает его, а обратная снимает', () => {
    const model = withText([]);
    const result = applyEditOp(model, setTextOp('tttttttt', 'появился'));
    expect(result.inverse).toEqual(setTextOp('tttttttt', ''));
    expect(applyEditOp(result.model, result.inverse).model).toEqual(model);
  });

  it('отказывается, когда текстовых частей несколько: какую именно — операция не знает', () => {
    const model = withText(['раз', { component: '$html(i)' }, 'два']);
    expect(() => applyEditOp(model, setTextOp('tttttttt', 'три'))).toThrow(SchemaOpError);
  });

  it('схлопывается в истории по узлу: набор текста — одна запись', () => {
    expect(mergeKeyOf(setTextOp('abcdefgh', 'а'))).toBe(mergeKeyOf(setTextOp('abcdefgh', 'аб')));
    expect(mergeKeyOf(setTextOp('abcdefgh', 'а'))).not.toBe(mergeKeyOf(setTextOp('hgfedcba', 'а')));
  });
});

describe('set-prop', () => {
  it('пишет свойство, а обратная операция удаляет ключ, которого не было', () => {
    const model = schema();
    const target = idAt(model, [...STEP_0, 'children', 1]);
    const result = applyEditOp(model, setPropOp(target, 'placeholder', 'сумма'));

    expect(
      (getAt(result.model, [...STEP_0, 'children', 1, 'componentProps']) as Record<string, unknown>)
        .placeholder
    ).toBe('сумма');
    expect(result.inverse).toEqual({ type: 'set-prop', target, params: { key: 'placeholder' } });
    expect(applyEditOp(result.model, result.inverse).model).toEqual(model);
  });

  it('сохраняет нетронутые ветки по ссылке', () => {
    const model = schema();
    const target = idAt(model, [...STEP_0, 'children', 1]);
    const untouched = getAt(model, STEP_1);
    const neighbour = getAt(model, [...STEP_0, 'children', 0]);
    const result = applyEditOp(model, setPropOp(target, 'placeholder', 'сумма'));
    expect(getAt(result.model, STEP_1)).toBe(untouched);
    expect(getAt(result.model, [...STEP_0, 'children', 0])).toBe(neighbour);
  });

  it('схлопывается в истории по паре «свойство + узел»', () => {
    expect(mergeKeyOf(setPropOp('abcdefgh', 'label', 'а'))).toBe(
      mergeKeyOf(setPropOp('abcdefgh', 'label', 'аб'))
    );
    expect(mergeKeyOf(setPropOp('abcdefgh', 'label', 'а'))).not.toBe(
      mergeKeyOf(setPropOp('abcdefgh', 'placeholder', 'а'))
    );
    // Структурная операция отдельной записью всегда.
    expect(mergeKeyOf(removeOp('abcdefgh'))).toBeUndefined();
  });
});

describe('set-binding', () => {
  it('пишет `$model(...)` полю и возвращает прежнюю привязку обратной операцией', () => {
    const model = schema();
    const target = idAt(model, [...STEP_0, 'children', 1]);
    const result = applyEditOp(model, setBindingOp(target, 'amount'));

    expect((getAt(result.model, [...STEP_0, 'children', 1]) as { value?: string }).value).toBe(
      '$model(amount)'
    );
    expect(result.inverse).toEqual({
      type: 'set-binding',
      target,
      params: { model: 'loanAmount' },
    });
    expect(applyEditOp(result.model, result.inverse).model).toEqual(model);
  });

  it('пишет массиву в `array`, а не в `value`', () => {
    const model = schema();
    const target = idAt(model, [...STEP_1, 'children', 0]);
    const result = applyEditOp(model, setBindingOp(target, 'estates'));
    const node = getAt(result.model, [...STEP_1, 'children', 0]) as Record<string, unknown>;
    expect(node.array).toBe('$model(estates)');
    expect(node.value).toBeUndefined();
  });

  it('отказывает контейнеру: он к модели не привязывается', () => {
    const model = schema();
    const step = idAt(model, STEP_0);
    expect(() => applyEditOp(model, setBindingOp(step, 'anything'))).toThrow(SchemaOpError);
  });
});

describe('отказы', () => {
  it('неизвестная операция', () => {
    expect(() => applyEditOp(schema(), { type: 'teleport' })).toThrow(SchemaOpError);
  });

  it('исчезнувшая цель', () => {
    expect(() => applyEditOp(schema(), removeOp('zzzzzzzz'))).toThrow(SchemaOpError);
  });
});

/**
 * Операции быстрых исправлений.
 *
 * Проверяется то же, что и у остальных, плюс одно свойство, которого у соседей нет:
 * переименование обязано сохранять МЕСТО ключа. Печать детерминированна, и по её результату
 * сравнивают буфер с моделью, — ключ, уехавший в конец объекта, менял бы файл на отмене.
 */
describe('set-component', () => {
  it('ставит компонент каталога и возвращается ровно тем же', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 0]);
    const result = applyEditOp(model, setComponentOp(field, 'Input'));

    expect(
      (getAt(result.model, [...STEP_0, 'children', 0]) as { component: string }).component
    ).toBe('$component(Input)');
    expect(applyEditOp(result.model, result.inverse).model).toEqual(model);
  });

  it('свойства узла не трогает: опечатка в имени не должна терять чужую работу', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 1]);
    const result = applyEditOp(model, setComponentOp(field, 'Textarea'));

    expect(getAt(result.model, [...STEP_0, 'children', 1, 'componentProps'])).toEqual({
      label: 'Сумма',
      type: 'number',
    });
  });

  it('выделение переезжает на исправленный узел', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 0]);
    expect(applyEditOp(model, setComponentOp(field, 'Input')).focus).toBe(field);
  });

  it('отказывается менять узел разметки: обратная операция назвать `$html(div)` не может', () => {
    const model = schema();
    const first = idAt(model, [...STEP_0, 'children', 0]);
    const second = idAt(model, [...STEP_0, 'children', 1]);
    const grouped = applyEditOp(model, groupOp([first, second]));
    const wrapper = idAt(grouped.model, [...STEP_0, 'children', 0]);

    expect(() => applyEditOp(grouped.model, setComponentOp(wrapper, 'Input'))).toThrow(
      SchemaOpError
    );
  });

  it('пустое имя — отказ, а не узел без компонента', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 0]);
    expect(() => applyEditOp(model, setComponentOp(field, ''))).toThrow(SchemaOpError);
  });
});

describe('rename-prop', () => {
  it('переименовывает ключ, сохраняя его место в объекте', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 1]);
    const result = applyEditOp(model, renamePropOp(field, 'label', 'caption'));

    const props = getAt(result.model, [...STEP_0, 'children', 1, 'componentProps']) as object;
    expect(Object.keys(props)).toEqual(['caption', 'type']);
    expect(props).toEqual({ caption: 'Сумма', type: 'number' });
  });

  it('отмена возвращает и значение, и порядок ключей', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 1]);
    const result = applyEditOp(model, renamePropOp(field, 'label', 'caption'));
    const back = applyEditOp(result.model, result.inverse);

    expect(back.model).toEqual(model);
    // Сравнение по значению порядок ключей не ловит, а именно он тут и проверяется.
    expect(JSON.stringify(back.model)).toBe(JSON.stringify(model));
  });

  it('отказ, если старого ключа нет: переименовывать нечего', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 1]);
    expect(() => applyEditOp(model, renamePropOp(field, 'labell', 'label'))).toThrow(SchemaOpError);
  });

  it('отказ, если новый ключ занят: правка затёрла бы чужое значение', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 1]);
    expect(() => applyEditOp(model, renamePropOp(field, 'label', 'type'))).toThrow(SchemaOpError);
  });

  it('отказ на совпадающих именах: пустая запись в истории — тоже потеря', () => {
    const model = schema();
    const field = idAt(model, [...STEP_0, 'children', 1]);
    expect(() => applyEditOp(model, renamePropOp(field, 'label', 'label'))).toThrow(SchemaOpError);
  });

  it('исчезнувший узел — отказ, а не правка наугад', () => {
    expect(() => applyEditOp(schema(), renamePropOp('zzzzzzzz', 'label', 'caption'))).toThrow(
      SchemaOpError
    );
  });
});
