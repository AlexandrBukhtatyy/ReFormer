import { describe, expect, it } from 'vitest';
import { getAt, updateAt, removeAt, toPointer, fromPointer, pathEquals, isPrefix } from './paths';
import { sampleSchema, P } from './__fixtures__/sample-schema';

describe('getAt', () => {
  it('возвращает узел по пути', () => {
    const s = sampleSchema();
    const field = getAt(s, P.step0field0) as { value?: string };
    expect(field.value).toBe('$model(loanType)');
  });

  it('undefined для пути «в никуда»', () => {
    const s = sampleSchema();
    expect(getAt(s, ['root', 'nope', 3])).toBeUndefined();
  });
});

describe('updateAt', () => {
  it('иммутабельно правит лист, не трогая оригинал', () => {
    const s = sampleSchema();
    const next = updateAt(s, [...P.step0field1, 'componentProps', 'label'], () => 'Сумма, ₽');
    expect(getAt(next, [...P.step0field1, 'componentProps', 'label'])).toBe('Сумма, ₽');
    // оригинал не изменился
    expect(getAt(s, [...P.step0field1, 'componentProps', 'label'])).toBe('Сумма');
    expect(next).not.toBe(s);
  });

  it('structural sharing: нетронутый сосед сохраняет ссылку', () => {
    const s = sampleSchema();
    const step1Before = getAt(s, P.step1);
    const next = updateAt(s, [...P.step0field1, 'componentProps', 'label'], () => 'x');
    // изменённая ветка — новый объект
    expect(getAt(next, P.step0)).not.toBe(getAt(s, P.step0));
    // нетронутый шаг 1 — та же ссылка
    expect(getAt(next, P.step1)).toBe(step1Before);
  });

  it('создаёт отсутствующий промежуточный объект', () => {
    const s = sampleSchema();
    const next = updateAt(s, [...P.step0field0, 'componentProps', 'testId'], () => 'loanType');
    expect(getAt(next, [...P.step0field0, 'componentProps', 'testId'])).toBe('loanType');
  });
});

describe('removeAt', () => {
  it('вырезает элемент массива (сдвиг индексов)', () => {
    const s = sampleSchema();
    const next = removeAt(s, P.step0field0);
    const children = getAt(next, P.step0children) as Array<{ value?: string }>;
    expect(children).toHaveLength(1);
    expect(children[0].value).toBe('$model(loanAmount)');
    // оригинал цел
    expect(getAt(s, P.step0children) as unknown[]).toHaveLength(2);
  });

  it('удаляет ключ объекта', () => {
    const s = sampleSchema();
    const next = removeAt(s, [...P.array, 'selector']);
    expect(getAt(next, [...P.array, 'selector'])).toBeUndefined();
    expect(getAt(next, [...P.array, 'array'])).toBe('$model(properties)');
  });

  it('бросает на пустом пути', () => {
    expect(() => removeAt(sampleSchema(), [])).toThrow();
  });
});

describe('JSON Pointer', () => {
  it('toPointer/fromPointer round-trip', () => {
    const path = ['root', 'componentProps', 'steps', 0, 'children', 1];
    expect(toPointer(path)).toBe('/root/componentProps/steps/0/children/1');
    expect(fromPointer(toPointer(path)).map(String)).toEqual(path.map(String));
  });

  it('экранирует ~ и /', () => {
    expect(toPointer(['a/b', 'c~d'])).toBe('/a~1b/c~0d');
    expect(fromPointer('/a~1b/c~0d')).toEqual(['a/b', 'c~d']);
  });

  it('пустой путь ↔ пустой pointer', () => {
    expect(toPointer([])).toBe('');
    expect(fromPointer('')).toEqual([]);
  });
});

describe('pathEquals / isPrefix', () => {
  it('pathEquals сравнивает по значению с приведением сегментов', () => {
    expect(pathEquals(['a', 0], ['a', '0'])).toBe(true);
    expect(pathEquals(['a', 0], ['a', 1])).toBe(false);
  });

  it('isPrefix ловит вложенность (нельзя бросить узел в самого себя)', () => {
    expect(isPrefix(P.step0, P.step0field0)).toBe(true);
    expect(isPrefix(P.step0field0, P.step0)).toBe(false);
  });
});

/**
 * Structural sharing — не оптимизация, а КОНТРАКТ: на нём стоит сравнение `!==` вместо глубокого
 * обхода (перерисовка канваса, снимки отмены, «изменился ли документ»). Стоит `updateAt` начать
 * клонировать лишнее — всё это станет молча пересчитывать всё дерево на каждый нажатый символ,
 * а тест, проверяющий только значение, останется зелёным. Поэтому проверка отдельная и явная.
 */
describe('structural sharing (контракт updateAt/removeAt)', () => {
  it('правка листа: незатронутыми по ссылке остаются ВСЕ ветки, кроме пути до правки', () => {
    const s = sampleSchema();
    const before = {
      step1: getAt(s, P.step1),
      step1children: getAt(s, P.step1children),
      array: getAt(s, P.array),
      arrayTemplate: getAt(s, P.arrayTemplate),
      step0field0: getAt(s, P.step0field0),
    };

    const next = updateAt(s, [...P.step0field1, 'componentProps', 'label'], () => 'Сумма, ₽');

    for (const [name, ref] of Object.entries(before)) {
      expect(getAt(next, P[name as keyof typeof before])).toBe(ref);
    }
    // А путь до правки клонирован целиком — от корня до узла.
    expect(next).not.toBe(s);
    expect(getAt(next, P.steps)).not.toBe(getAt(s, P.steps));
    expect(getAt(next, P.step0)).not.toBe(getAt(s, P.step0));
    expect(getAt(next, P.step0children)).not.toBe(getAt(s, P.step0children));
    expect(getAt(next, P.step0field1)).not.toBe(getAt(s, P.step0field1));
  });

  it('правка в глубине массива не трогает соседний шаг', () => {
    const s = sampleSchema();
    const step0Before = getAt(s, P.step0);
    const next = updateAt(s, [...P.arrayTemplate, 'component'], () => '$html(div)');
    expect(getAt(next, P.step0)).toBe(step0Before);
    expect(getAt(next, P.arrayTemplate)).not.toBe(getAt(s, P.arrayTemplate));
  });

  it('removeAt делит те же ветки: вырезание соседа не клонирует чужой шаг', () => {
    const s = sampleSchema();
    const step1Before = getAt(s, P.step1);
    const arrayBefore = getAt(s, P.array);
    const next = removeAt(s, P.step0field0);
    expect(getAt(next, P.step1)).toBe(step1Before);
    expect(getAt(next, P.array)).toBe(arrayBefore);
    // Уцелевший сосед в изменённом массиве переезжает ССЫЛКОЙ, а не копией.
    const survivor = (getAt(s, P.step0children) as unknown[])[1];
    expect((getAt(next, P.step0children) as unknown[])[0]).toBe(survivor);
  });

  it('updater, вернувший то же значение, всё равно клонирует путь — сравнивать надо по ссылке', () => {
    // Свойство обратной стороны контракта: `updateAt` не «умный», он не сравнивает значения.
    // Тот, кто решает «менялось ли», обязан сравнивать РЕЗУЛЬТАТ, а не полагаться на no-op.
    const s = sampleSchema();
    const same = getAt(s, [...P.step0field1, 'componentProps', 'label']);
    const next = updateAt(s, [...P.step0field1, 'componentProps', 'label'], () => same);
    expect(getAt(next, [...P.step0field1, 'componentProps', 'label'])).toBe(same);
    expect(next).not.toBe(s);
    expect(getAt(next, P.step1)).toBe(getAt(s, P.step1));
  });
});
