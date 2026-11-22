/**
 * Внутреннее дерево модели — листья, сравнение со снимком, шаблон элемента и индексы мутаций
 * массива (`src/model/model-nodes.ts`).
 *
 * Дерево наружу не отдаётся, поэтому проверяется через фасад: `isDirty()` — это `deepEqual`
 * значения со снимком `initial`, `reset()` — восстановление снимка, `push`/`insertAt` — шаблон
 * элемента и слияние частичного значения (`fillFromBlank`), `removeAt`/`move`/`swap` — работа с
 * индексами. Отдельно — зонды краёв: отрицательные индексы, индексы за концом, `Date` в снимке.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  arrayOf,
  createModel,
  eachLeafSignal,
  isModelContainerSignal,
} from '../../../src/model/index';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Сколько раз подписчик ручки получил уведомление после подписки. */
const notifications = (handle: { subscribe(fn: (value: unknown) => void): () => void }) => {
  let count = -1; // preact вызывает подписчика сразу при подписке
  const stop = handle.subscribe(() => count++);
  return { count: () => count, stop };
};

describe('model-nodes — Date, File и Blob — листья', () => {
  it('ручка — сигнал, а не контейнер; значение отдаётся той же ссылкой', () => {
    const when = new Date(2024, 1, 29);
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    const blob = new Blob(['y']);
    const model = createModel({ when, file, blob });
    const leaves: string[] = [];

    eachLeafSignal(model, (signal) => leaves.push(signal.__path));

    expect(leaves).toEqual(['when', 'file', 'blob']);
    for (const handle of [model.$.when, model.$.file, model.$.blob]) {
      expect(isModelContainerSignal(handle)).toBe(false);
    }
    expect(model.when).toBe(when);
    expect(model.$.file.value).toBe(file);
    expect(model.get().blob).toBe(blob);
  });

  it('массив файлов — массив листьев: элемент — сам файл', () => {
    const files = [new File(['1'], '1.txt'), new File(['2'], '2.txt')];
    const model = createModel({ files });

    model.files.push(new File(['3'], '3.txt'));

    expect(model.files.at(0)).toBe(files[0]);
    expect(model.$.files[1].value).toBe(files[1]);
    expect(model.get().files.map((file) => file.name)).toEqual(['1.txt', '2.txt', '3.txt']);
  });

  it('без глобального Blob файл узнаёт отдельная проверка — он всё равно лист', () => {
    const file = new File(['x'], 'a.txt');
    vi.stubGlobal('Blob', undefined);

    const model = createModel({ file });

    expect(model.file).toBe(file);
    expect(isModelContainerSignal(model.$.file)).toBe(false);
  });

  it('лист из начального null хранит объект целиком — под-модели у него нет', () => {
    const model = createModel<{ spouse: { name: string } | null }>({ spouse: null });

    model.patch({ spouse: { name: 'Анна' } });

    expect(model.get().spouse).toEqual({ name: 'Анна' });
    expect(isModelContainerSignal(model.$.spouse)).toBe(false);
  });
});

describe('model-nodes — сравнение со снимком (isDirty)', () => {
  it('массив другой длины — грязный; вернулась прежняя длина и значения — чистый', () => {
    const model = createModel({ tags: ['a', 'b'] });

    model.tags.push('c');
    expect(model.isDirty()).toBe(true);
    model.tags.removeAt(2);
    expect(model.isDirty()).toBe(false);
    model.tags.clear();
    expect(model.isDirty()).toBe(true);
  });

  it('строки, пересобранные с теми же значениями, — чистые; правка поля строки — грязная', () => {
    const model = createModel({ rows: [{ title: 'x', qty: 1 }] });

    model.$.rows.value = [{ title: 'x', qty: 1 }];
    expect(model.isDirty()).toBe(false);
    model.rows.at(0).qty = 2;
    expect(model.isDirty()).toBe(true);
  });

  it('строка с другим набором ключей — грязная, даже если общие поля равны', () => {
    const model = createModel<{ rows: Array<{ title: string; note?: string }> }>({
      rows: [{ title: 'x' }],
    });

    model.$.rows.value = [{ title: 'x', note: '' }];

    expect(model.isDirty()).toBe(true);
  });

  it('объект в листе: те же ключи и значения — чистый, другое число ключей — грязный', () => {
    const model = createModel<{ meta: Record<string, number> | null }>({ meta: null });
    model.patch({ meta: { a: 1 } });
    model.captureInitial();

    model.patch({ meta: { a: 1 } });
    expect(model.isDirty()).toBe(false);
    model.patch({ meta: { a: 1, b: 2 } });
    expect(model.isDirty()).toBe(true);
  });

  it('вложенные массивы сравниваются по уровням', () => {
    const model = createModel({ matrix: [[1, 2], [3]] });

    model.$.matrix.value = [[1, 2], [3]];
    expect(model.isDirty()).toBe(false);
    model.$.matrix.value = [
      [1, 2],
      [3, 4],
    ];
    expect(model.isDirty()).toBe(true);
    model.$.matrix.value = [[1, 2], [4]];
    expect(model.isDirty()).toBe(true);
  });

  it('новая Date с тем же временем — не изменение: isDirty() === false [ReFormer-x6ox]', () => {
    const model = createModel({ when: new Date(2024, 0, 1) });

    model.when = new Date(2024, 0, 1);

    expect(model.isDirty()).toBe(false);
  });
});

describe('model-nodes — снимок initial', () => {
  it('исходный объект после createModel модели не принадлежит: его правка снимок не трогает', () => {
    const initial = { tags: ['a'], address: { city: 'Казань' } };
    const model = createModel(initial);

    initial.tags.push('b');
    initial.address.city = 'Москва';
    model.tags.push('c');
    model.reset();

    expect(model.get()).toEqual({ tags: ['a'], address: { city: 'Казань' } });
  });

  it('get() отдаёт новые объекты групп и массивов — правка снимка модель не трогает', () => {
    const model = createModel({ tags: ['a'], address: { city: 'Казань' } });
    const snapshot = model.get();

    snapshot.tags.push('b');
    snapshot.address.city = 'Москва';

    expect(model.get()).toEqual({ tags: ['a'], address: { city: 'Казань' } });
    expect(model.isDirty()).toBe(false);
  });

  it('правка Date на месте не портит снимок: reset() возвращает исходную дату [ReFormer-35eg]', () => {
    const model = createModel({ when: new Date(2024, 0, 1) });
    const original = model.when.getTime();

    model.when.setFullYear(1999);
    model.reset();

    expect(model.when.getTime()).toBe(original);
  });
});

describe('model-nodes — частичное значение поверх шаблона (fillFromBlank)', () => {
  const blankRow = () => ({ title: 'шаблон', address: { city: 'Казань', zip: '420000' } });

  it('undefined в частичном значении берётся из шаблона — и во вложенной группе', () => {
    const model = createModel({ rows: arrayOf(blankRow) });

    model.rows.push({ title: undefined, address: { city: undefined, zip: '101000' } } as never);

    expect(model.get().rows).toEqual([
      { title: 'шаблон', address: { city: 'Казань', zip: '101000' } },
    ]);
  });

  it('лист на месте группы шаблона заменяет группу целиком', () => {
    const model = createModel({ rows: arrayOf(blankRow) });

    model.rows.push({ address: 'без адреса' } as never);

    expect(model.get().rows).toEqual([{ title: 'шаблон', address: 'без адреса' }]);
    expect(isModelContainerSignal(model.$.rows[0].address)).toBe(false);
  });

  it('patch, как и частичное значение элемента, ключ с undefined не трогает [ReFormer-ix06]', () => {
    // `DeepPartial` допускает `{ ключ: undefined }` — это «нет значения», а не запись undefined.
    const model = createModel({ title: 'было', rows: arrayOf(blankRow) });

    model.patch({ title: undefined });
    model.rows.push({ title: undefined } as never);

    expect(model.title).toBe('было');
    expect(model.rows.at(0).title).toBe('шаблон');
  });

  it('set, в отличие от patch, пишет undefined в лист [ReFormer-ix06]', () => {
    const model = createModel({ title: 'было', rows: [] as Array<{ title: string }> });

    model.set({ title: undefined as never, rows: [] });

    expect(model.title).toBeUndefined();
  });

  it('значение не-объект кладётся как есть — шаблон не участвует', () => {
    const model = createModel({ rows: arrayOf(blankRow) });

    model.rows.insertAt(0, 'строка' as never);

    expect(model.get().rows).toEqual(['строка']);
  });
});

describe('model-nodes — добавление без значения и без шаблона', () => {
  it('вложенный массив строки без шаблона: значение принимает, без значения — ошибка с путём', () => {
    const model = createModel({ rows: [{ phones: [] as string[] }] });
    const phones = model.rows.at(0).phones;

    phones.push('+7');

    expect(() => phones.push()).toThrow(
      /^\[@reformer\/core\] rows\.0\.phones: добавление элемента без значения/
    );
    expect(() => phones.insertAt(0)).toThrow(/rows\.0\.phones: .*arrayOf/s);
    expect(model.get().rows[0].phones).toEqual(['+7']);
  });

  it('массив под пустым ключом — единственный без пути: в ошибке слово «массив»', () => {
    const model = createModel<Record<string, string[]>>({ '': [] });

    expect(() => model[''].push()).toThrow(
      /^\[@reformer\/core\] массив: добавление элемента без значения/
    );
  });
});

describe('model-nodes — индексы мутаций массива', () => {
  const createItems = () => createModel({ items: ['a', 'b', 'c'] });

  it('swap вне диапазона и сам с собой — массив тот же, подписчики не будятся', () => {
    const model = createItems();
    const seen = notifications(model.$.items);

    model.items.swap(-1, 0);
    model.items.swap(0, -1);
    model.items.swap(3, 0);
    model.items.swap(0, 3);
    model.items.swap(1, 1);

    expect(model.items.toArray()).toEqual(['a', 'b', 'c']);
    expect(seen.count()).toBe(0);
    model.items.swap(0, 2);
    expect(model.items.toArray()).toEqual(['c', 'b', 'a']);
    expect(model.$.items[0].__path).toBe('items.0');
    expect(seen.count()).toBe(1);
    seen.stop();
  });

  it('removeAt с индексом за концом и move на место — без изменений и без уведомлений', () => {
    // Раньше узел записывал копию списка, и подписчики массива (нода FormArray, стратегии валидации)
    // получали лишнее уведомление; теперь такой индекс игнорируется, как в swap [ReFormer-m7jd].
    // `removeAt(list.findIndex(…))` без находки не должен удалять последний элемент.
    const model = createItems();
    const seen = notifications(model.$.items);

    model.items.removeAt(3);
    model.items.move(1, 1);

    expect([model.items.toArray(), seen.count()]).toEqual([['a', 'b', 'c'], 0]);
    seen.stop();
  });

  it('дробный индекс — не индекс: removeAt, insertAt и move ничего не делают', () => {
    const model = createItems();

    model.items.removeAt(0.5);
    model.items.insertAt(1.5, 'x');
    model.items.move(0, 1.5);

    expect(model.items.toArray()).toEqual(['a', 'b', 'c']);
  });

  it('insertAt и move с индексом за концом — RangeError с путём, массив прежний [ReFormer-ix06]', () => {
    // Раньше индекс за концом молча превращался в «в конец» (так работает splice).
    const model = createItems();
    const seen = notifications(model.$.items);

    expect(() => model.items.insertAt(10, 'x')).toThrowError(
      /^\[@reformer\/core\] model\.items\.insertAt\(10\): индекс 10 за концом массива \(длина 3/
    );
    expect(() => model.items.move(0, 10)).toThrowError(RangeError);
    expect(() => model.items.move(5, 0)).toThrowError(/move\(5, 0\): индекс 5 за концом/);
    expect([model.items.toArray(), seen.count()]).toEqual([['a', 'b', 'c'], 0]);
    seen.stop();
  });

  it('insertAt(length) — в конец, move на последний индекс — допустимы [ReFormer-ix06]', () => {
    const model = createItems();

    model.items.insertAt(3, 'x');
    model.items.move(0, 3);

    expect(model.items.toArray()).toEqual(['b', 'c', 'x', 'a']);
    expect(model.$.items[3].__path).toBe('items.3');
  });

  it('removeAt(-1) ничего не удаляет: индекса -1 нет [ReFormer-m7jd]', () => {
    const model = createItems();

    model.items.removeAt(-1);

    expect(model.items.toArray()).toEqual(['a', 'b', 'c']);
  });

  it('move(-1, 0) не переносит последний элемент [ReFormer-m7jd]', () => {
    const model = createItems();

    model.items.move(-1, 0);

    expect(model.items.toArray()).toEqual(['a', 'b', 'c']);
  });

  it('insertAt(-1) не вставляет перед последним элементом [ReFormer-m7jd]', () => {
    const model = createItems();

    model.items.insertAt(-1, 'x');

    expect(model.items.toArray()).toEqual(['a', 'b', 'c']);
  });
});
