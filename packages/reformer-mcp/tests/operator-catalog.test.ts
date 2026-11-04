/**
 * Операторы ядра в MCP сверены с исходниками ядра.
 *
 * Два разных случая:
 * - ключи intent (`operator-catalog.ts`) — язык intent, за каждым стоит печать в генераторе. Новый
 *   оператор ядра без ключа агент не сможет записать, поэтому сверка с исходниками — красный тест;
 * - фабрики правил сервер читает из `llms-index.json` ядра. Сверка индекса с исходниками ловит
 *   индекс, не перегенерированный после новой фабрики: такую фабрику грамматика не назвала бы.
 *
 * Без этой сверки грамматика называла 7 правил из 27, а поведение `exclusiveFlag` описывала одним
 * словом. Экспорты читает компилятор по исходникам — собранный `dist` ядра для теста не нужен.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import {
  BEHAVIOR_KEY_OPERATORS,
  MODEL_BEHAVIOR_KINDS,
  NODE_BEHAVIOR_KINDS,
  VALIDATION_OPERATORS,
} from '../src/core/generate/operator-catalog';
import { intentGrammar } from '../src/core/generate/intent-grammar';
import { cliKnowledge } from '../src/platform/cli/knowledge';

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

/** Экспорты точки входа — функции, которые возвращают `Rule<…>`: фабрики правил. */
function ruleFactories(entry: string): string[] {
  const checker = programOf().getTypeChecker();
  const source = programOf().getSourceFile(entry);
  const module = source && checker.getSymbolAtLocation(source);
  if (!module) throw new Error(`не прочитан модуль ${entry}`);
  return checker
    .getExportsOfModule(module)
    .filter((symbol) => {
      const target =
        symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      const declaration = target.declarations?.[0];
      if (!declaration || !ts.isFunctionDeclaration(declaration)) return false;
      const signature = checker.getSignatureFromDeclaration(declaration);
      return !!signature && checker.typeToString(signature.getReturnType()).startsWith('Rule<');
    })
    .map((symbol) => symbol.name)
    .sort();
}

describe('операторы MCP совпадают с ядром', () => {
  it(
    'индекс ядра называет все фабрики правил @reformer/core/validators',
    () => {
      // Красный тест — индекс устарел: `npm run generate:llms` в packages/reformer.
      expect([...CATALOGS.core.rules.keys()].sort()).toEqual(ruleFactories(ENTRIES.validators));
    },
    SLOW
  );

  it('у каждой фабрики правила в индексе есть группа @appliesTo', () => {
    // Без тега группа выводится из `Rule<T>`, а у `Rule<unknown>` это «любые значения»: файловое
    // правило оказалось бы рядом с `required`. Новой фабрике ядра нужен тег в JSDoc.
    const untagged = cliKnowledge()
      .index.symbols.filter((symbol) => CATALOGS.core.rules.has(symbol.name))
      .filter((symbol) => symbol.package === '@reformer/core' && !symbol.appliesTo)
      .map((symbol) => symbol.name);
    expect(untagged).toEqual([]);
  });

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
      // `behaviors/context.ts` — основа своих операторов (`defineFormBehavior`, `effect`, …): в intent
      // их не пишут, ими написан оператор, который intent вызывает через `kind: "call"`.
      const exported = operatorsOf(ENTRIES.behaviors, [
        'behaviors/operators.ts',
        'behaviors/collections.ts',
        'behaviors/schema-operators.ts',
      ]);
      const tabled = [
        ...MODEL_BEHAVIOR_KINDS,
        ...NODE_BEHAVIOR_KINDS,
        ...Object.keys(BEHAVIOR_KEY_OPERATORS),
      ];
      expect(exported).toEqual([...new Set(tabled)].sort());
    },
    SLOW
  );
});

describe('грамматика называет каждый оператор', () => {
  const grammar = intentGrammar(CATALOGS);

  it('каждое правило ядра — образцом из индекса', () => {
    expect(CATALOGS.core.rules.size).toBeGreaterThan(0);
    for (const rule of CATALOGS.core.rules.values()) expect(grammar).toContain(rule.call);
  });

  it('каждый kind поведения — строкой примера', () => {
    for (const kind of [...MODEL_BEHAVIOR_KINDS, ...NODE_BEHAVIOR_KINDS, 'call']) {
      expect(grammar, kind).toContain(`"kind":"${kind}"`);
    }
  });
});
