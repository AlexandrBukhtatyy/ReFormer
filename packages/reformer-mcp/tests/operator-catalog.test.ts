/**
 * Таблицы операторов ядра в MCP сверены с исходниками ядра.
 *
 * Сервер публикуется отдельно от `@reformer/core` и его экспортов в рантайме не видит, поэтому
 * таблицы продублированы в `operator-catalog.ts`. Без этой сверки новый оператор ядра не попадал
 * ни в грамматику `form_build`, ни в кросс-проверку: грамматика называла 7 правил из 27, а
 * поведение `exclusiveFlag` описывала одним словом. Экспорты читает компилятор по исходникам —
 * собранный `dist` ядра для теста не нужен.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  BEHAVIOR_AUTHORING,
  BEHAVIOR_KEY_OPERATORS,
  CORE_VALIDATORS,
  MODEL_BEHAVIOR_KINDS,
  NODE_BEHAVIOR_KINDS,
  VALIDATION_OPERATORS,
  VALIDATOR_HELPERS,
} from '../src/core/generate/operator-catalog';
import { INTENT_GRAMMAR } from '../src/core/generate/intent-grammar';

const formSrc = resolve(dirname(fileURLToPath(import.meta.url)), '../../reformer/src/form');
const ENTRIES = {
  validators: resolve(formSrc, 'validators/index.ts'),
  validation: resolve(formSrc, 'validation/index.ts'),
  behaviors: resolve(formSrc, 'behaviors/index.ts'),
};
/** Компилятор поднимает исходники ядра секунды: программа одна на все точки входа. */
const SLOW = 60_000;

let program: ts.Program | undefined;
const programOf = (): ts.Program =>
  (program ??= ts.createProgram(Object.values(ENTRIES), {
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  }));

/** Значения, которые экспортирует модуль ядра: имя → файл, где оно объявлено. */
function valueExports(entry: string): Map<string, string> {
  const checker = programOf().getTypeChecker();
  const source = programOf().getSourceFile(entry);
  const module = source && checker.getSymbolAtLocation(source);
  if (!module) throw new Error(`не прочитан модуль ${entry}`);
  const out = new Map<string, string>();
  for (const symbol of checker.getExportsOfModule(module)) {
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    if (!(target.flags & ts.SymbolFlags.Value)) continue;
    const file = target.declarations?.[0]?.getSourceFile().fileName ?? '';
    out.set(symbol.name, file.replace(/\\/g, '/'));
  }
  return out;
}

/** Экспорты точки входа, объявленные в одном из модулей операторов. */
function operatorsOf(entry: string, modules: readonly string[]): string[] {
  return [...valueExports(entry)]
    .filter(([, file]) => modules.some((module) => file.endsWith(module)))
    .map(([name]) => name)
    .sort();
}

describe('таблицы операторов совпадают с ядром', () => {
  it(
    'фабрики правил @reformer/core/validators',
    () => {
      const exported = [...valueExports(ENTRIES.validators).keys()].sort();
      expect(exported).toEqual([...Object.keys(CORE_VALIDATORS), ...VALIDATOR_HELPERS].sort());
    },
    SLOW
  );

  it(
    'операторы схемы валидации',
    () => {
      const exported = operatorsOf(ENTRIES.validation, ['validation/operators.ts']);
      // `cross` — параметр схемы, а не экспорт.
      const tabled = Object.keys(VALIDATION_OPERATORS).filter((name) => name !== 'cross');
      expect(exported).toEqual(tabled.sort());
    },
    SLOW
  );

  it(
    'операторы поведения: у каждого есть запись в intent',
    () => {
      const exported = operatorsOf(ENTRIES.behaviors, [
        'behaviors/operators.ts',
        'behaviors/collections.ts',
        'behaviors/schema-operators.ts',
        'behaviors/context.ts',
      ]);
      const tabled = [
        ...MODEL_BEHAVIOR_KINDS,
        ...NODE_BEHAVIOR_KINDS,
        ...Object.keys(BEHAVIOR_KEY_OPERATORS),
        ...BEHAVIOR_AUTHORING,
      ];
      expect(exported).toEqual([...new Set(tabled)].sort());
    },
    SLOW
  );
});

describe('грамматика называет каждый оператор', () => {
  it('каждое правило ядра', () => {
    for (const spec of Object.values(CORE_VALIDATORS)) expect(INTENT_GRAMMAR).toContain(spec.call);
  });

  it('каждый kind поведения — строкой примера', () => {
    for (const kind of [...MODEL_BEHAVIOR_KINDS, ...NODE_BEHAVIOR_KINDS, 'call']) {
      expect(INTENT_GRAMMAR, kind).toContain(`"kind":"${kind}"`);
    }
  });
});
