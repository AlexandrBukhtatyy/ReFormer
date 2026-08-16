import { describe, expect, it } from 'vitest';
import { limitsFrom } from './keys';

describe('limitsFrom', () => {
  it('пустые поля не заводят ключей — это «без предела», а не ноль', () => {
    // Ключ со значением 0 прочитался бы как «ноль шагов»: ход остановился бы, не начавшись, а
    // ответ оборвался бы на первом токене. Отсутствие ключа и ноль здесь — противоположности.
    expect(limitsFrom({ maxSteps: '', maxOutputTokens: '', maxInputTokens: '' })).toEqual({});
  });

  it('отсутствующее поле равносильно пустому', () => {
    expect(limitsFrom({})).toEqual({});
  });

  it('ноль и отрицательное значение — тоже «без предела»', () => {
    expect(limitsFrom({ maxSteps: '0', maxOutputTokens: '0', maxInputTokens: '0' })).toEqual({});
    expect(limitsFrom({ maxSteps: '-5', maxInputTokens: '-100' })).toEqual({});
  });

  it('нечисловой ввод не превращается в NaN в настройках', () => {
    expect(limitsFrom({ maxSteps: 'много', maxOutputTokens: 'не знаю' })).toEqual({});
  });

  it('заданные пределы доходят числами', () => {
    expect(
      limitsFrom({ maxSteps: '40', maxOutputTokens: '8192', maxInputTokens: '400000' })
    ).toEqual({ maxSteps: 40, maxOutputTokens: 8192, maxInputTokens: 400000 });
  });

  it('поля независимы: одно задано, другие нет', () => {
    expect(limitsFrom({ maxSteps: '12' })).toEqual({ maxSteps: 12 });
    expect(limitsFrom({ maxInputTokens: '250000' })).toEqual({ maxInputTokens: 250000 });
  });

  it('пробелы вокруг числа не мешают', () => {
    expect(limitsFrom({ maxSteps: ' 24 ', maxOutputTokens: ' 2048 ' })).toEqual({
      maxSteps: 24,
      maxOutputTokens: 2048,
    });
  });
});
