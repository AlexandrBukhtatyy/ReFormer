import { describe, it, expect } from 'vitest';
import { parseNumberInput, resolveEmittedNumber, deriveNumberDisplay } from './input-number-buffer';

describe('parseNumberInput', () => {
  it('пустая строка → empty', () => {
    expect(parseNumberInput('')).toEqual({ kind: 'empty' });
  });

  it('незавершённый ввод (NaN) → partial', () => {
    expect(parseNumberInput('-')).toEqual({ kind: 'partial' });
    expect(parseNumberInput('.')).toEqual({ kind: 'partial' });
    expect(parseNumberInput('1e')).toEqual({ kind: 'partial' });
  });

  it('валидные / неканонические числовые строки → number', () => {
    expect(parseNumberInput('1.')).toEqual({ kind: 'number', value: 1 });
    expect(parseNumberInput('1.50')).toEqual({ kind: 'number', value: 1.5 });
    expect(parseNumberInput('0.05')).toEqual({ kind: 'number', value: 0.05 });
    expect(parseNumberInput('01')).toEqual({ kind: 'number', value: 1 });
  });
});

describe('resolveEmittedNumber', () => {
  it('пустая строка эмитит null', () => {
    expect(resolveEmittedNumber('', undefined)).toEqual({ emit: true, value: null });
  });

  it('частичный ввод не эмитит', () => {
    expect(resolveEmittedNumber('-', undefined)).toEqual({ emit: false });
    expect(resolveEmittedNumber('.', undefined)).toEqual({ emit: false });
  });

  it('валидное число эмитится как есть', () => {
    expect(resolveEmittedNumber('42', undefined)).toEqual({ emit: true, value: 42 });
    expect(resolveEmittedNumber('1.50', undefined)).toEqual({ emit: true, value: 1.5 });
  });

  it('отрицательное зажимается к 0 при min>=0', () => {
    expect(resolveEmittedNumber('-5', 0)).toEqual({ emit: true, value: 0 });
    expect(resolveEmittedNumber('-5', 10)).toEqual({ emit: true, value: 0 });
  });

  it('отрицательное проходит, если min не задан или отрицателен', () => {
    expect(resolveEmittedNumber('-5', undefined)).toEqual({ emit: true, value: -5 });
    expect(resolveEmittedNumber('-5', -100)).toEqual({ emit: true, value: -5 });
  });
});

describe('deriveNumberDisplay', () => {
  it('без буфера показывает каноническое значение', () => {
    expect(deriveNumberDisplay(null, 5)).toBe('5');
    expect(deriveNumberDisplay(null, 0)).toBe('0');
    expect(deriveNumberDisplay(null, null)).toBe('');
    expect(deriveNumberDisplay(null, undefined)).toBe('');
    expect(deriveNumberDisplay(null, NaN)).toBe('');
  });

  it('сохраняет хвостовые нули, пока буфер согласован с value', () => {
    // Именно этот кейс ломался раньше: value === 1.5, но пользователь набрал "1.50".
    // Наивное value.toString() дало бы "1.5" и стёрло бы набранный ноль.
    expect(deriveNumberDisplay('1.50', 1.5)).toBe('1.50');
    expect(deriveNumberDisplay('100.00', 100)).toBe('100.00');
    expect(deriveNumberDisplay('0.05', 0.05)).toBe('0.05');
    expect(deriveNumberDisplay('01', 1)).toBe('01');
  });

  it('удерживает завершающую точку и промежуточные состояния', () => {
    expect(deriveNumberDisplay('1.', 1)).toBe('1.');
    expect(deriveNumberDisplay('0.', 0)).toBe('0.');
  });

  it('удерживает частичный ввод даже без совпадения value', () => {
    expect(deriveNumberDisplay('-', null)).toBe('-');
    expect(deriveNumberDisplay('.', null)).toBe('.');
    expect(deriveNumberDisplay('1e', 1)).toBe('1e');
  });

  it('внешнее изменение value выигрывает у устаревшего буфера', () => {
    // Буфер "1.50" (парсится в 1.5), но извне value сброшено/пересчитано.
    expect(deriveNumberDisplay('1.50', 42)).toBe('42');
    expect(deriveNumberDisplay('1.50', null)).toBe('');
    expect(deriveNumberDisplay('123', null)).toBe('');
  });

  it('пустой буфер согласован только с пустым значением', () => {
    expect(deriveNumberDisplay('', null)).toBe('');
    expect(deriveNumberDisplay('', 5)).toBe('5'); // value пришло извне
  });
});

/**
 * Интеграционная симуляция контролируемого round-trip компонента:
 * на каждый «keystroke» (полное значение input.target.value) прогоняем
 * resolveEmittedNumber → обновляем value → deriveNumberDisplay(buffer, value),
 * ровно как это делает {@link Input}. Проверяем, что финальное отображение
 * совпадает с набранным пользователем — то, что ломалось до появления буфера.
 */
function typeSequence(
  keystrokes: string[],
  min?: number
): { display: string; value: number | null } {
  let value: number | null = null;
  let buffer: string | null = null;
  for (const raw of keystrokes) {
    buffer = raw;
    const result = resolveEmittedNumber(raw, min);
    if (result.emit) value = result.value;
    // partial (emit:false) — value не меняется, но buffer сохранил ввод
  }
  return { display: deriveNumberDisplay(buffer, value), value };
}

describe('контролируемый round-trip (симуляция набора)', () => {
  it('десятичное с хвостовым нулём набирается целиком', () => {
    // Набор "1.50": ["1","1.","1.5","1.50"]
    const { display, value } = typeSequence(['1', '1.', '1.5', '1.50']);
    expect(display).toBe('1.50');
    expect(value).toBe(1.5);
    // Регресс-стража: наивный round-trip (без буфера) схлопнул бы это в "1.5".
    expect((1.5).toString()).toBe('1.5');
  });

  it('денежная сумма с двумя нулями', () => {
    const { display, value } = typeSequence(['1', '10', '100', '100.', '100.0', '100.00']);
    expect(display).toBe('100.00');
    expect(value).toBe(100);
  });

  it('ставка меньше единицы через ведущий ноль', () => {
    const { display, value } = typeSequence(['0', '0.', '0.0', '0.05']);
    expect(display).toBe('0.05');
    expect(value).toBe(0.05);
  });

  it('минус в начале удерживается, затем формируется отрицательное число', () => {
    const { display, value } = typeSequence(['-', '-5']);
    expect(display).toBe('-5');
    expect(value).toBe(-5);
  });

  it('минус с min>=0 удерживается при вводе, но число зажимается к 0', () => {
    const { display, value } = typeSequence(['-', '-5'], 0);
    expect(value).toBe(0);
    expect(display).toBe('0');
  });

  it('очистка поля даёт пустое отображение и null', () => {
    const { display, value } = typeSequence(['5', '']);
    expect(display).toBe('');
    expect(value).toBeNull();
  });
});
