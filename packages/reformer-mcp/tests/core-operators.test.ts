/**
 * Операторы ядра из его `llms-index.json`: список фабрик правил, образцы вызова, группы.
 *
 * Своей таблицы у сервера нет: новая фабрика ядра попадает в грамматику `form_build` и в проверки
 * без правки MCP. Здесь — что разбор индекса выводит из сигнатуры, `@example` и `@appliesTo`.
 */

import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import {
  coreOperatorsFromIndex,
  NO_CORE_OPERATORS,
  renderRuleList,
} from '../src/core/generate/core-operators';
import type { IndexedSymbol, MergedIndex } from '../src/core/index/types';

const symbol = (part: Partial<IndexedSymbol> & { name: string }): IndexedSymbol => ({
  kind: 'function',
  signature: `export function ${part.name}(options?: RuleOptions): Rule<unknown>`,
  summary: '',
  params: [],
  examplesCount: 0,
  entries: ['./validators'],
  sourcePath: `src/form/validators/${part.name}.ts`,
  package: '@reformer/core',
  ...part,
});

const indexOf = (symbols: IndexedSymbol[]): MergedIndex => ({
  packages: new Map([['@reformer/core', '6.0.0']]),
  withoutIndex: [],
  symbols,
  topics: [],
  byName: new Map(symbols.map((s) => [s.name, [s]])),
});

describe('операторы ядра из индекса монорепо', () => {
  const { rules, names } = CATALOGS.core;

  it('27 фабрик правил; помощники файловых правил — не правила', () => {
    expect(rules.size).toBe(27);
    for (const helper of ['isFileLike', 'matchesFileAccept', 'toFileArray']) {
      expect(rules.has(helper)).toBe(false);
      expect(names.has(helper)).toBe(true);
    }
  });

  it('образцы вызова — обязательные аргументы из @example', () => {
    expect(rules.get('required')?.call).toBe('required');
    expect(rules.get('minAge')?.call).toBe('minAge(18)');
    expect(rules.get('fileType')?.call).toBe("fileType('image/*,.pdf')");
    // опции `{ format: 'ru' }` — необязательный аргумент, в образец не идут
    expect(rules.get('phone')?.call).toBe('phone');
  });

  it('группы — по тегу @appliesTo', () => {
    const groupOf = (name: string) => rules.get(name)?.group;
    expect(groupOf('required')).toBe('any');
    expect(groupOf('minLength')).toBe('text');
    expect(groupOf('integer')).toBe('number');
    expect(groupOf('pastDate')).toBe('date');
    expect(groupOf('maxFiles')).toBe('file');
  });

  it('имена операторов схемы валидации и поведения — тоже имена ядра', () => {
    for (const name of ['validate', 'applyEach', 'defineValidation', 'computeFrom', 'effect']) {
      expect(names.has(name)).toBe(true);
    }
  });

  it('строка грамматики: группы по порядку, у any подписи нет', () => {
    const line = renderRuleList(CATALOGS.core);
    expect(line.startsWith('required; строки и списки: ')).toBe(true);
    expect(line).toMatch(/; числа: .*; даты: .*; файлы: /);
  });
});

describe('разбор индекса', () => {
  it('нет индекса ядра — пустой справочник', () => {
    expect(coreOperatorsFromIndex(indexOf([]))).toBe(NO_CORE_OPERATORS);
  });

  it('нет вызова в примере — заглушки по типам обязательных параметров', () => {
    const core = coreOperatorsFromIndex(
      indexOf([
        symbol({
          name: 'between',
          signature:
            'export function between(\n  low: number,\n  high: Date,\n  re: RegExp,\n  label: string,\n  options?: RuleOptions\n): Rule<number>',
          example: 'validate(model.$.x, [other(1)]);',
        }),
      ])
    );
    expect(core.rules.get('between')?.call).toBe("between(n, new Date(…), /re/, '…')");
  });

  it('без тега группа — из типа значения правила', () => {
    const core = coreOperatorsFromIndex(
      indexOf([
        symbol({ name: 'a', signature: 'export function a(): Rule<number | null | undefined>' }),
        symbol({ name: 'b', signature: 'export function b(): Rule<string | Date | null>' }),
        symbol({ name: 'c', signature: 'export function c(): Rule<string | null | undefined>' }),
        symbol({ name: 'd', signature: 'export function d(): Rule<unknown>' }),
        symbol({ name: 'e', signature: 'export function e(): Rule<unknown>', appliesTo: 'file' }),
      ])
    );
    expect([...core.rules.values()].map((rule) => [rule.name, rule.group])).toEqual([
      ['d', 'any'],
      ['c', 'text'],
      ['a', 'number'],
      ['b', 'date'],
      ['e', 'file'],
    ]);
  });

  it('функция не из ./validators и не на Rule — не фабрика', () => {
    const core = coreOperatorsFromIndex(
      indexOf([
        symbol({ name: 'rule' }),
        symbol({ name: 'helper', signature: 'export function helper(value: unknown): boolean' }),
        symbol({ name: 'validate', entries: ['./validation'] }),
      ])
    );
    expect([...core.rules.keys()]).toEqual(['rule']);
    expect([...core.names].sort()).toEqual(['helper', 'rule', 'validate']);
  });
});
