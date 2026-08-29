/**
 * Тесты истории: патчи для текста, снимки для модели.
 *
 * Проверяются свойства, а не вызовы:
 *
 * - патч обратим — применение прямого и обратного пакета возвращает исходную строку,
 *   в том числе на суррогатных парах, где ошибка в единицах измерения только и вылезает;
 * - патч, приложенный не к своему основанию, отвергается, а не даёт правдоподобный мусор;
 * - снимки схлопываются по ключу и НЕ схлопываются через границу;
 * - выделение едет вместе со снимком, потому что входит в него.
 *
 * @module host/workspace/model/history.test
 */

import { describe, expect, it } from 'vitest';

import {
  applyTextEdits,
  createModelHistory,
  createTextHistory,
  diffText,
  invertTextEdits,
  mergeKeyOf,
  type ModelSnapshot,
  type TextEdit,
} from './history';

/** Прогон туда-обратно: свойство обратимости на конкретной паре строк. */
function roundTrip(before: string, after: string): void {
  const edits = diffText(before, after);
  expect(applyTextEdits(before, edits)).toBe(after);
  expect(applyTextEdits(after, invertTextEdits(edits))).toBe(before);
}

describe('патчи текста', () => {
  it('применяет пакет так, будто все смещения отсчитаны от текста до пакета', () => {
    const edits: TextEdit[] = [
      { offset: 0, removed: 'aa', inserted: 'X' },
      { offset: 4, removed: '', inserted: 'YY' },
    ];

    // Наивная реализация «слева направо» сдвинула бы вторую правку на длину первой.
    expect(applyTextEdits('aabbcc', edits)).toBe('XbbYYcc');
  });

  it('обращает пакет с пересчётом смещений', () => {
    const edits: TextEdit[] = [
      { offset: 0, removed: 'aa', inserted: 'X' },
      { offset: 4, removed: '', inserted: 'YY' },
    ];

    const restored = applyTextEdits(applyTextEdits('aabbcc', edits), invertTextEdits(edits));

    expect(restored).toBe('aabbcc');
  });

  it('отвергает патч, приложенный не к своему основанию', () => {
    // Тихая порча хуже отказа: текст получился бы правдоподобным, а несоответствие вскрылось
    // бы через день и не связалось бы с историей.
    expect(() => applyTextEdits('привет', [{ offset: 0, removed: 'пока', inserted: 'X' }])).toThrow(
      /не соответствует основанию/
    );
  });

  it('отвергает пересекающиеся правки и выход за пределы', () => {
    expect(() =>
      applyTextEdits('abcdef', [
        { offset: 0, removed: 'abc', inserted: '' },
        { offset: 1, removed: 'b', inserted: '' },
      ])
    ).toThrow(/пересекаются/);

    expect(() => applyTextEdits('abc', [{ offset: 2, removed: 'cd', inserted: '' }])).toThrow(
      /за пределы/
    );
  });

  it('считает смещения в кодовых единицах UTF-16', () => {
    // Эмодзи — две кодовые единицы. Потребитель, решивший, что это кодовые точки, поставит
    // смещение 1 и разрежет пару пополам.
    expect(applyTextEdits('😀ok', [{ offset: 2, removed: 'ok', inserted: 'да' }])).toBe('😀да');
  });

  it('обратим на вставке, удалении, замене и пустом изменении', () => {
    roundTrip('', 'первый');
    roundTrip('первый', '');
    roundTrip('abc', 'abXc');
    roundTrip('abc', 'ac');
    roundTrip('n1 alpha\nn2 beta', 'n1 alpha\nn2 gamma');
    expect(diffText('одинаково', 'одинаково')).toEqual([]);
  });

  it('не разрезает суррогатную пару ни на префиксе, ни на суффиксе', () => {
    roundTrip('😀', '😁');
    roundTrip('a😀b', 'a😁b');
    roundTrip('a😀', 'a😀😀');

    // Обе половины пары уходят в правку целиком: одинокий суррогат в `removed` — мусор
    // для любого потребителя, который покажет патч человеку или измерит его в кодовых точках.
    const [edit] = diffText('😀', '😁');
    expect(edit.removed).toBe('😀');
    expect(edit.inserted).toBe('😁');

    // Символы с ОДИНАКОВОЙ младшей половиной: общий суффикс наивно захватил бы её, оставив
    // в правке одинокую старшую.
    roundTrip('\u{1F200}', '\u{1F600}');
    const [same] = diffText('\u{1F200}', '\u{1F600}');
    expect(same.removed).toBe('\u{1F200}');
  });

  it('стек патчей ходит назад и вперёд', () => {
    const history = createTextHistory();
    const first = diffText('a', 'ab');
    const second = diffText('ab', 'abc');
    history.record(first);
    history.record(second);

    expect(history.undo('abc')).toBe('ab');
    expect(history.undo('ab')).toBe('a');
    expect(history.undo('a')).toBeUndefined();
    expect(history.redo('a')).toBe('ab');
    expect(history.canRedo()).toBe(true);
  });

  it('новая запись обрезает ветку «вперёд»', () => {
    const history = createTextHistory();
    history.record(diffText('a', 'ab'));
    history.undo('ab');

    history.record(diffText('a', 'aZ'));

    expect(history.canRedo()).toBe(false);
  });

  it('держит глубину стека в пределах предела', () => {
    const history = createTextHistory({ limit: 2 });
    history.record(diffText('a', 'ab'));
    history.record(diffText('ab', 'abc'));
    history.record(diffText('abc', 'abcd'));

    expect(history.depth()).toBe(2);
  });
});

describe('снимки модели', () => {
  const snap = (model: string, selection: readonly string[] = []): ModelSnapshot<string> => ({
    model,
    selection,
  });

  it('возвращает состояние ДО правки вместе с выделением', () => {
    const history = createModelHistory<string>();
    history.record(snap('было', ['n1']));

    const restored = history.undo(snap('стало', ['n2']));

    // Выделение — часть модели правки, а не состояния вида: отмена, вернувшая модель без него,
    // оставила бы пользователя смотреть на узел, которого больше нет.
    expect(restored).toEqual({ model: 'было', selection: ['n1'] });
  });

  it('схлопывает соседние правки с одним ключом в один шаг', () => {
    const history = createModelHistory<string>();
    const key = mergeKeyOf('title', 'n1');
    history.record(snap('пусто'), { mergeKey: key });
    history.record(snap('п'), { mergeKey: key });
    history.record(snap('пр'), { mergeKey: key });

    expect(history.depth()).toBe(1);
    expect(history.undo(snap('при'))?.model).toBe('пусто');
  });

  it('не схлопывает правки разных свойств и разных узлов', () => {
    const history = createModelHistory<string>();
    history.record(snap('a'), { mergeKey: mergeKeyOf('title', 'n1') });
    history.record(snap('b'), { mergeKey: mergeKeyOf('title', 'n2') });
    history.record(snap('c'), { mergeKey: mergeKeyOf('label', 'n2') });

    expect(history.depth()).toBe(3);
  });

  it('не схлопывает через границу, даже если ключ тот же', () => {
    const history = createModelHistory<string>();
    const key = mergeKeyOf('title', 'n1');
    history.record(snap('было'), { mergeKey: key });

    history.breakMerge();
    history.record(snap('середина'), { mergeKey: key });

    expect(history.depth()).toBe(2);
    expect(history.undo(snap('стало'))?.model).toBe('середина');
  });

  it('правка без ключа не сливается ни с чем', () => {
    const history = createModelHistory<string>();
    history.record(snap('a'));
    history.record(snap('b'));

    expect(history.depth()).toBe(2);
  });

  it('шаг вперёд идёт по одному, даже если назад схлопывали', () => {
    const history = createModelHistory<string>();
    history.record(snap('первое'));
    history.record(snap('второе'));

    const back = history.undo(snap('третье'));
    const forward = history.redo(back as ModelSnapshot<string>);

    expect(forward?.model).toBe('третье');
    expect(history.canUndo()).toBe(true);
  });

  it('запись обрезает ветку «вперёд»', () => {
    const history = createModelHistory<string>();
    history.record(snap('первое'));
    history.undo(snap('второе'));

    history.record(snap('другое'));

    expect(history.canRedo()).toBe(false);
  });

  it('схлопывание тоже обрезает ветку «вперёд»', () => {
    const history = createModelHistory<string>();
    const key = mergeKeyOf('title', 'n1');
    history.record(snap('a'), { mergeKey: key });
    history.undo(snap('b'));
    history.record(snap('a'), { mergeKey: key });

    // Правка после отмены — новая ветка истории, независимо от того, записалась она
    // отдельным шагом или слилась с предыдущим.
    expect(history.canRedo()).toBe(false);
  });
});
