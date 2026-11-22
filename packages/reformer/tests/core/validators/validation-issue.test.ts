/**
 * Сборка замечания `validationIssue(code, options, params)` — общая для всех правил каталога.
 *
 * Контракт: у замечания только `code` и (если есть) `params` — ни текста, ни `severity`. Свой код из
 * опций важнее встроенного; параметры правила и параметры из опций сливаются, из опций — главнее.
 * Если параметров нет ни там, ни там, ключа `params` у замечания нет вовсе.
 */

import { describe, expect, it } from 'vitest';
import { validationIssue } from '../../../src/form/validators/validation-issue';

describe('validationIssue — код', () => {
  it('без опций — встроенный код и ничего больше', () => {
    const issue = validationIssue('required', undefined);
    expect(issue).toEqual({ code: 'required' });
    expect(Object.keys(issue)).toEqual(['code']);
  });

  it('свой код заменяет встроенный', () => {
    expect(validationIssue('min', { code: 'age.min' })).toEqual({ code: 'age.min' });
  });

  it('опции без кода оставляют встроенный', () => {
    expect(validationIssue('min', {})).toEqual({ code: 'min' });
  });

  it('пустая строка кода — тоже свой код (подмена по ??, а не по истинности)', () => {
    expect(validationIssue('min', { code: '' })).toEqual({ code: '' });
  });
});

describe('validationIssue — параметры', () => {
  it('параметры правила без опций', () => {
    expect(validationIssue('min', undefined, { min: 1, actual: 0 })).toEqual({
      code: 'min',
      params: { min: 1, actual: 0 },
    });
  });

  it('параметры только из опций', () => {
    expect(validationIssue('required', { params: { field: 'Имя' } })).toEqual({
      code: 'required',
      params: { field: 'Имя' },
    });
  });

  it('параметры сливаются, из опций — главнее', () => {
    expect(
      validationIssue(
        'min',
        { params: { min: 'восемнадцать', unit: 'лет' } },
        { min: 18, actual: 16 }
      )
    ).toEqual({ code: 'min', params: { min: 'восемнадцать', actual: 16, unit: 'лет' } });
  });

  it('пустые params правила дают пустой объект params', () => {
    expect(validationIssue('x', undefined, {})).toEqual({ code: 'x', params: {} });
  });

  it('слияние не мутирует ни параметры правила, ни опции', () => {
    const ruleParams = { min: 18 };
    const options = { code: 'age.min', params: { unit: 'лет' } };
    validationIssue('min', options, ruleParams);
    expect([ruleParams, options]).toEqual([
      { min: 18 },
      { code: 'age.min', params: { unit: 'лет' } },
    ]);
  });

  it('свой код и параметры вместе', () => {
    expect(
      validationIssue('maxFiles', { code: 'docs.max', params: { hint: 1 } }, { maxFiles: 2 })
    ).toEqual({ code: 'docs.max', params: { maxFiles: 2, hint: 1 } });
  });
});

describe('validationIssue — замечание без текста и уровня', () => {
  it('нет message, messageKey и severity — ошибка блокирующая по умолчанию, текст даёт резолвер', () => {
    const issue = validationIssue('min', { code: 'c', params: { a: 1 } }, { min: 1 });
    expect(Object.keys(issue).sort()).toEqual(['code', 'params']);
  });
});
