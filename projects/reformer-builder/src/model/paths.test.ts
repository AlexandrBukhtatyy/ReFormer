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
