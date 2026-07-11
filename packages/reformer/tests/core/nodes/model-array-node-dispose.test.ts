/**
 * Unit tests: ModelArrayNode lifecycle — детерминированный dispose форм элементов.
 *
 * Регрессия для утечки: removeAt/clear/setValue/dispose должны диспозить форму отброшенного
 * элемента (эффекты/поведения/вложенные подписки), а reorder (move/swap) — НЕ должен, т.к.
 * набор элементов не меняется. Также проверяется вытеснение из identity-кэша.
 */

import { describe, it, expect } from 'vitest';
import { createModel } from '../../../src/core/model';
import { ModelArrayNode } from '../../../src/core/nodes/model-array-node';
import { createForm } from '../../../src/core/utils/create-form';
import type { FormModel } from '../../../src/core/model';
import type { FormProxy } from '../../../src/core/types/form-proxy';

interface Row {
  name: string;
  qty: number;
}
interface Form {
  rows: Row[];
}

const itemSchema = (item: FormModel<Row>) => ({
  children: [{ value: item.$.name }, { value: item.$.qty }],
});

/**
 * Строит ModelArrayNode, чей buildItem инструментирует dispose каждой формы элемента,
 * записывая её имя в `disposed` при вызове. Реальный dispose всё равно выполняется.
 */
const build = () => {
  const model = createModel<Form>({ rows: [] });
  const disposed: string[] = [];
  const arr = new ModelArrayNode<Row>(model.rows as never, (m) => {
    const form = createForm<Row>({
      model: m as FormModel<Row>,
      schema: itemSchema(m as FormModel<Row>),
    }) as FormProxy<Row>;
    const label = () => (form.name.value.value as string) || '<empty>';
    const orig = (form as unknown as { dispose: () => void }).dispose.bind(form);
    (form as unknown as { dispose: () => void }).dispose = () => {
      disposed.push(label());
      orig();
    };
    return form;
  });
  return { model, arr, disposed };
};

describe('ModelArrayNode — dispose форм элементов (lifecycle)', () => {
  it('removeAt диспозит форму удалённого элемента и НЕ трогает остальные', () => {
    const { arr, disposed } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.push({ name: 'B', qty: 2 });

    arr.removeAt(0); // удаляем A

    expect(disposed).toEqual(['A']);
    // Выживший B по-прежнему привязан и работоспособен.
    expect(arr.at(0)!.name.value.value).toBe('B');
  });

  it('clear диспозит формы всех элементов', () => {
    const { arr, disposed } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.push({ name: 'B', qty: 2 });
    arr.push({ name: 'C', qty: 3 });

    arr.clear();

    expect(disposed.sort()).toEqual(['A', 'B', 'C']);
    expect(arr.length.value).toBe(0);
  });

  it('setValue диспозит старые формы перед заменой', () => {
    const { arr, disposed } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.push({ name: 'B', qty: 2 });

    arr.setValue([{ name: 'X', qty: 9 }]);

    expect(disposed.sort()).toEqual(['A', 'B']);
    expect(arr.map((i) => i.name.value.value)).toEqual(['X']);
  });

  it('move НЕ диспозит элементы (реордер сохраняет набор)', () => {
    const { arr, disposed } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.push({ name: 'B', qty: 2 });
    arr.push({ name: 'C', qty: 3 });

    arr.move(0, 2);

    expect(disposed).toEqual([]);
    expect(arr.map((i) => i.name.value.value)).toEqual(['B', 'C', 'A']);
  });

  it('swap НЕ диспозит элементы', () => {
    const { arr, disposed } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.push({ name: 'B', qty: 2 });

    arr.swap(0, 1);

    expect(disposed).toEqual([]);
  });

  it('dispose() диспозит все смонтированные формы элементов и останавливает синхронизацию', () => {
    const { model, arr, disposed } = build();
    arr.push({ name: 'A', qty: 1 });
    arr.push({ name: 'B', qty: 2 });

    arr.dispose();

    expect(disposed.sort()).toEqual(['A', 'B']);
    // Синхронизация остановлена: мутация массива модели больше не пересобирает itemNodes.
    const before = arr.length.value;
    model.get().rows.push({ name: 'C', qty: 3 });
    expect(arr.length.value).toBe(before);
  });

  it('удалённый элемент вытеснен из кэша: повторное добавление даёт свежую (не диспознутую) форму', () => {
    const { arr } = build();
    arr.push({ name: 'A', qty: 1 });
    const first = arr.at(0)!;
    arr.removeAt(0);
    arr.push({ name: 'A', qty: 1 });
    const second = arr.at(0)!;

    expect(second).not.toBe(first); // не вернулся диспознутый proxy из кэша
    second.qty.setValue(7); // свежая форма работоспособна
    expect(second.qty.value.value).toBe(7);
  });
});
