import { describe, expect, it } from 'vitest';
import { limitsFrom } from './keys';

describe('limitsFrom', () => {
  it('пустые поля не заводят ключей — это «без предела», а не ноль', () => {
    // Ключ со значением 0 прочитался бы как «ноль шагов»: ход остановился бы, не начавшись, а
    // ответ оборвался бы на первом токене. Отсутствие ключа и ноль здесь — противоположности.
    expect(limitsFrom('', '')).toEqual({});
  });

  it('ноль и отрицательное значение — тоже «без предела»', () => {
    expect(limitsFrom('0', '0')).toEqual({});
    expect(limitsFrom('-5', '-100')).toEqual({});
  });

  it('нечисловой ввод не превращается в NaN в настройках', () => {
    expect(limitsFrom('много', 'не знаю')).toEqual({});
  });

  it('заданные пределы доходят числами', () => {
    expect(limitsFrom('40', '8192')).toEqual({ maxSteps: 40, maxOutputTokens: 8192 });
  });

  it('поля независимы: одно задано, другое нет', () => {
    expect(limitsFrom('12', '')).toEqual({ maxSteps: 12 });
    expect(limitsFrom('', '4096')).toEqual({ maxOutputTokens: 4096 });
  });

  it('пробелы вокруг числа не мешают', () => {
    expect(limitsFrom(' 24 ', ' 2048 ')).toEqual({ maxSteps: 24, maxOutputTokens: 2048 });
  });
});
