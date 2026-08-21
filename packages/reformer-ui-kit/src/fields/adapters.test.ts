import { describe, it, expect } from 'vitest';
import { multiValueAdapter, valueChangeAdapter, nativeInputAdapter } from './adapters';

/**
 * Контракт мультивыборного адаптера. Проверяется именно он, а не соседи: у остальных
 * адаптеров поведение зафиксировано их компонентными тестами, а этот — общий для четырёх
 * контролов, и любое расхождение разъедется сразу по всем.
 */
describe('multiValueAdapter', () => {
  it('пустой выбор эмитит null, а не [] (иначе initial-массив создаст ArrayNode)', () => {
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
