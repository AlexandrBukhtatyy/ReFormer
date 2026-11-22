import { describe, it, expect } from 'vitest';
import {
  multiValueAdapter,
  valueChangeAdapter,
  nativeInputAdapter,
  dateRangeAdapter,
} from './adapters';

/**
 * Контракт мультивыборного адаптера. Проверяется именно он, а не соседи: у остальных
 * адаптеров поведение зафиксировано их компонентными тестами, а этот — общий для четырёх
 * контролов, и любое расхождение разъедется сразу по всем.
 */
describe('multiValueAdapter', () => {
  it('пустой выбор эмитит null, а не [] (как его хранить, решает поле модели)', () => {
    expect(multiValueAdapter.fromEmit([], {})).toBeNull();
  });

  it('непустой выбор эмитит НОВЫЙ массив (сигнал бэйлится по !==)', () => {
    const emitted = ['a', 'b'];
    const result = multiValueAdapter.fromEmit(emitted, {});
    expect(result).toEqual(['a', 'b']);
    expect(result).not.toBe(emitted);
  });

  it('не-массив на выходе контрола считается пустым выбором', () => {
    expect(multiValueAdapter.fromEmit(undefined, {})).toBeNull();
    expect(multiValueAdapter.fromEmit(null, {})).toBeNull();
    expect(multiValueAdapter.fromEmit('a', {})).toBeNull();
  });

  it('null из формы приходит в контрол пустым массивом, а не пустой строкой', () => {
    expect(multiValueAdapter.toValue(null)).toEqual([]);
    expect(multiValueAdapter.toValue(undefined)).toEqual([]);
  });

  it('массив из формы доходит до контрола как есть (без копии — читать безопасно)', () => {
    const stored = ['x'];
    expect(multiValueAdapter.toValue(stored)).toBe(stored);
  });

  it('штатные адаптеры для мультивыбора непригодны — фиксируем причину', () => {
    // valueChangeAdapter отдал бы контролу '' вместо [] → .map/.includes упадут.
    expect(valueChangeAdapter.toValue(null)).toBe('');
    // nativeInputAdapter читает e.target.value, что у <select multiple> = только первый выбранный.
    expect(nativeInputAdapter.fromEmit({ target: { value: 'a' } }, {})).toBe('a');
  });
});

/**
 * Адаптер периода (`DatePickerRange`): кортеж `[from, to]` в форме, `undefined` в контроле.
 * Поле-кортеж хранит сброс как `[]` — на входе это тоже «период не выбран».
 */
describe('dateRangeAdapter', () => {
  const from = new Date(2024, 0, 15);
  const to = new Date(2024, 0, 20);

  it('полный период эмитит НОВЫЙ кортеж (сигнал бэйлится по !==)', () => {
    const emitted = [from, to];
    const result = dateRangeAdapter.fromEmit(emitted, {});
    expect(result).toEqual([from, to]);
    expect(result).not.toBe(emitted);
  });

  it('сброс и неполный период эмитят null', () => {
    expect(dateRangeAdapter.fromEmit(undefined, {})).toBeNull();
    expect(dateRangeAdapter.fromEmit([from], {})).toBeNull();
    expect(dateRangeAdapter.fromEmit([from, null], {})).toBeNull();
  });

  it('null, [] и не-кортеж из формы приходят в контрол как undefined', () => {
    expect(dateRangeAdapter.toValue(null)).toBeUndefined();
    expect(dateRangeAdapter.toValue([])).toBeUndefined();
    expect(dateRangeAdapter.toValue([from])).toBeUndefined();
    expect(dateRangeAdapter.toValue(['2024-01-15', '2024-01-20'])).toBeUndefined();
  });

  it('кортеж из формы доходит до контрола как есть', () => {
    const stored = [from, to];
    expect(dateRangeAdapter.toValue(stored)).toBe(stored);
  });
});
