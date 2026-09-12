import { describe, expect, it } from 'vitest';

import {
  compareVersions,
  formatVersion,
  parseRange,
  parseVersion,
  satisfies,
  satisfiesRange,
} from './semver';

describe('parseVersion', () => {
  it('разбирает полную и неполную версию, дополняя нулями', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseVersion('1.2')).toEqual({ major: 1, minor: 2, patch: 0 });
    expect(parseVersion(' 1 ')).toEqual({ major: 1, minor: 0, patch: 0 });
  });

  it('отвергает пререлиз и метаданные сборки, а не отбрасывает суффикс', () => {
    // Молчаливое отбрасывание дало бы плагин, объявивший бету, работающим против релиза.
    expect(parseVersion('1.0.0-beta.1')).toBeUndefined();
    expect(parseVersion('1.0.0+build.5')).toBeUndefined();
  });

  it('отвергает то, что версией не является', () => {
    const rejected = ['', '   ', '*', '1.x', 'v1.2.3', '1.2.3.4', 'один', '1..2', '-1.0.0'];

    expect(rejected.filter((text) => parseVersion(text) !== undefined)).toEqual([]);
  });
});

describe('compareVersions и formatVersion', () => {
  it('порядок — по мажору, затем минору, затем патчу', () => {
    const v = (text: string) => parseVersion(text) ?? { major: -1, minor: -1, patch: -1 };

    expect(compareVersions(v('1.0.0'), v('2.0.0'))).toBeLessThan(0);
    expect(compareVersions(v('1.2.0'), v('1.1.9'))).toBeGreaterThan(0);
    expect(compareVersions(v('1.2.3'), v('1.2.3'))).toBe(0);
  });

  it('печатает три компонента всегда', () => {
    expect(formatVersion({ major: 1, minor: 0, patch: 0 })).toBe('1.0.0');
  });
});

describe('parseRange — границы считаются разбором, а не проверкой', () => {
  /** Диапазон → пара границ в человекочитаемой записи. `undefined` — границы нет. */
  const bounds = (text: string): readonly [string | undefined, string | undefined] | undefined => {
    const range = parseRange(text);
    if (range === undefined) return undefined;
    return [
      range.min === undefined
        ? undefined
        : `${range.min.inclusive ? '>=' : '>'}${formatVersion(range.min.version)}`,
      range.max === undefined
        ? undefined
        : `${range.max.inclusive ? '<=' : '<'}${formatVersion(range.max.version)}`,
    ];
  };

  it.each([
    ['*', undefined, undefined],
    ['x', undefined, undefined],
    ['^1', '>=1.0.0', '<2.0.0'],
    ['^1.2', '>=1.2.0', '<2.0.0'],
    ['^1.2.3', '>=1.2.3', '<2.0.0'],
    // Карета на нулевом мажоре: минор ведёт себя как мажор — это правило npm, и расходиться
    // с ним нельзя, автор плагина приносит привычку из package.json.
    ['^0.2.3', '>=0.2.3', '<0.3.0'],
    ['^0.0.3', '>=0.0.3', '<0.0.4'],
    ['^0', '>=0.0.0', '<1.0.0'],
    ['^0.0', '>=0.0.0', '<0.1.0'],
    ['~1', '>=1.0.0', '<2.0.0'],
    ['~1.2', '>=1.2.0', '<1.3.0'],
    ['~1.2.3', '>=1.2.3', '<1.3.0'],
    ['>=1.2.3', '>=1.2.3', undefined],
    // Отступление от npm, названное в шапке: неполная версия дополняется нулями, а не
    // округляется вверх (у npm `>1.2` это `>=1.3.0`).
    ['>1.2', '>1.2.0', undefined],
    ['<=2.0.0', undefined, '<=2.0.0'],
    ['<2', undefined, '<2.0.0'],
    ['1.2.3', '>=1.2.3', '<=1.2.3'],
    ['=1.2.3', '>=1.2.3', '<=1.2.3'],
    ['1.2', '>=1.2.0', '<1.3.0'],
    ['1', '>=1.0.0', '<2.0.0'],
    ['1.x', '>=1.0.0', '<2.0.0'],
    ['1.2.x', '>=1.2.0', '<1.3.0'],
    ['>= 1.2.3', '>=1.2.3', undefined],
  ])('«%s» → %s %s', (text, min, max) => {
    expect(bounds(text)).toEqual([min, max]);
  });

  it('отвергает то, чего утилита не умеет, — и отвергает явно', () => {
    // Каждая строка здесь — названная в шапке граница, а не забытый случай.
    const rejected = [
      '', // пустой диапазон
      '>=1.2.0 <2.0.0', // конъюнкция
      '1.x || 2.x', // дизъюнкция
      '^1.0.0-beta', // пререлиз
      '1.0.0+build', // метаданные сборки
      '>=x', // сравнитель с подстановочным знаком не значит ничего
      '^', // сравнитель без версии
      'v1', // префикс пакетного менеджера
      '1.2.3.4', // четыре компонента
      '1.x.3', // подстановочный знак посередине
    ];

    expect(rejected.filter((text) => parseRange(text) !== undefined)).toEqual([]);
  });
});

describe('satisfies', () => {
  it.each([
    ['1.0.0', '^1', true],
    ['1.9.9', '^1', true],
    ['2.0.0', '^1', false],
    ['0.9.9', '^1', false],
    ['1.0.0', '^2', false],
    ['2.3.4', '^2.3', true],
    ['2.2.9', '^2.3', false],
    ['1.2.9', '~1.2', true],
    ['1.3.0', '~1.2', false],
    ['1.2.3', '1.2.3', true],
    ['1.2.4', '1.2.3', false],
    ['3.0.0', '*', true],
    ['1.2.3', '>=1.2.3', true],
    ['1.2.2', '>=1.2.3', false],
    ['1.2.3', '>1.2.3', false],
    ['0.1.0', '^0.1.0', true],
    ['0.2.0', '^0.1.0', false],
  ])('«%s» против «%s» → %s', (version, range, expected) => {
    expect(satisfies(version, range)).toBe(expected);
  });

  it('неразбираемая сторона даёт false, а не исключение', () => {
    // И ровно поэтому проверять ФОРМУ записи этой функцией нельзя: «не та версия»
    // и «так версия не пишется» здесь неразличимы — разбор манифеста зовёт parse* раздельно.
    expect(satisfies('1.0.0', '>=1 <2')).toBe(false);
    expect(satisfies('nonsense', '^1')).toBe(false);
  });
});

describe('satisfiesRange — границы включаются ровно так, как объявлены', () => {
  it('включающая граница пропускает саму версию, исключающая — нет', () => {
    const version = { major: 2, minor: 0, patch: 0 };

    expect(satisfiesRange(version, { source: '<=2.0.0', max: { version, inclusive: true } })).toBe(
      true
    );
    expect(satisfiesRange(version, { source: '<2.0.0', max: { version, inclusive: false } })).toBe(
      false
    );
    expect(satisfiesRange(version, { source: '>=2.0.0', min: { version, inclusive: true } })).toBe(
      true
    );
    expect(satisfiesRange(version, { source: '>2.0.0', min: { version, inclusive: false } })).toBe(
      false
    );
  });
});
