/**
 * Инварианты артефакта `llms-index.json`.
 *
 * Индекс собирается на билде (scripts/generate-llms-txt/index-builder.js) и публикуется
 * рядом с `llms.txt` в КАЖДОМ пакете — не внутри `@reformer/mcp`: сервер публикуется
 * отдельно от библиотек, и запечённый в нём снапшот разъезжался бы по версиям.
 *
 * Здесь проверяется то, что молча ломается и чего не видит ни tsc, ни линтер:
 *
 *  1. Слаги секций в индексе совпадают с тем, что сервер выводит из llms.txt. Расхождение
 *     означало бы URI, который ReadResource отвергнет. Первая версия сборщика ошиблась
 *     дважды: не учла секцию `Table of Contents` (её нет в docs-файлах, но она есть в
 *     llms.txt и занимает слаг первой) и не срезала ведущий числовой префикс заголовка.
 *  2. Индекс покрывает ВСЮ публичную поверхность. До починки генератор читал только
 *     `src/index.ts` и терял 62 символа `@reformer/core` — весь DSL behaviors и validation
 *     (`compute`, `validate`, `validateAsync`, `cross`, `each`, `defineFormBehavior`, …),
 *     то есть ровно то, что решает корректность формы. Их не было и в самом llms.txt.
 *  3. Ядро DSL (23 оператора) присутствует поимённо — это те API, вокруг которых строятся
 *     все рецепты, и потеря любого из них ломает генерацию.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSections, KNOWN_PACKAGES } from '../src/utils/docs-parser';
import { getPublicSymbols } from '../src/utils/symbols-parser';
import { AST_HEAVY_TIMEOUT_MS } from './timeouts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** @reformer/<name> → каталог в packages/. */
function packageDir(pkg: string): string {
  const tail = pkg.replace(/^@reformer\//, '');
  return tail === 'core' ? 'reformer' : `reformer-${tail}`;
}

interface Index {
  schemaVersion: number;
  package: string;
  version: string;
  topics: Array<{
    id: string;
    file: string;
    title: string;
    purpose: string;
    antiPatterns: Array<Record<string, string>>;
    sections: Array<{ heading: string; slug: string }>;
    terms: Array<[string, number]>;
  }>;
  symbols: Array<{ name: string; kind: string; signature: string; summary: string }>;
}

function loadIndex(pkg: string): Index | null {
  const p = resolve(repoRoot, 'packages', packageDir(pkg), 'llms-index.json');
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Index) : null;
}

const indexed = KNOWN_PACKAGES.map((pkg) => [pkg, loadIndex(pkg)] as const).filter(
  (e): e is readonly [string, Index] => e[1] !== null
);
const hasIndexes = indexed.length > 0;

describe('llms-index.json — артефакт билда', () => {
  it.runIf(hasIndexes)('есть у каждого пакета с документацией', () => {
    const missing = KNOWN_PACKAGES.filter(
      (pkg) => listSections(pkg).length > 0 && loadIndex(pkg) === null
    );
    expect(missing, `нет llms-index.json у: ${missing.join(', ')}`).toEqual([]);
  });

  it.runIf(hasIndexes)('версия схемы и имя пакета заполнены', () => {
    for (const [pkg, idx] of indexed) {
      expect(idx.schemaVersion, `${pkg}: schemaVersion`).toBe(1);
      expect(idx.package, `${pkg}: package`).toBe(pkg);
      expect(idx.version, `${pkg}: version`).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  it.runIf(hasIndexes)('каждый слаг секции резолвится у сервера', () => {
    for (const [pkg, idx] of indexed) {
      const known = new Set(listSections(pkg).map((s) => s.slug));
      const broken = idx.topics
        .flatMap((t) => t.sections.map((s) => s.slug))
        .filter((slug) => !known.has(slug));
      expect(broken, `${pkg}: слаги из индекса не резолвятся: ${broken.join(', ')}`).toEqual([]);
    }
  });

  it.runIf(hasIndexes)(
    'покрывает всю публичную поверхность пакета',
    () => {
      for (const [pkg, idx] of indexed) {
        const runtime = getPublicSymbols(pkg).map((s) => s.name);
        if (runtime.length === 0) continue; // у @reformer/mcp своих экспортов нет
        const inIndex = new Set(idx.symbols.map((s) => s.name));
        const missing = runtime.filter((n) => !inIndex.has(n));
        expect(
          missing,
          `${pkg}: в индексе нет ${missing.length} публичных символов: ${missing.slice(0, 10).join(', ')}`
        ).toEqual([]);
      }
    },
    AST_HEAVY_TIMEOUT_MS
  );

  it.runIf(hasIndexes)('ядро DSL присутствует поимённо', () => {
    const all = new Set(indexed.flatMap(([, idx]) => idx.symbols.map((s) => s.name)));
    const core = [
      // behaviors
      'compute',
      'computeFrom',
      'copyFrom',
      'onChange',
      'enableWhen',
      'disableWhen',
      'transformValue',
      'resetWhen',
      'syncFields',
      'revalidateWhen',
      'applyEach',
      'exclusiveFlag',
      'aggregateInto',
      'defineFormBehavior',
      // validation
      'validate',
      'validateAsync',
      'validateWhen',
      'cross',
      'each',
      'defineValidationSchema',
      'validateModel',
      // сборка
      'createForm',
      'useFormControl',
    ];
    const missing = core.filter((n) => !all.has(n));
    expect(missing, `ядро DSL потеряно в индексе: ${missing.join(', ')}`).toEqual([]);
  });

  it.runIf(hasIndexes)('у символов есть сигнатура и краткое описание', () => {
    for (const [pkg, idx] of indexed) {
      const noSignature = idx.symbols.filter((s) => !s.signature).map((s) => s.name);
      expect(noSignature, `${pkg}: символы без сигнатуры: ${noSignature.slice(0, 5)}`).toEqual([]);
    }
  });

  it.runIf(hasIndexes)('anti-patterns разобраны структурно там, где есть маркеры ❌/✅', () => {
    const structured = indexed
      .flatMap(([, idx]) => idx.topics)
      .flatMap((t) => t.antiPatterns)
      .filter((a) => 'why' in a);
    // Замерено: 25 из 25 код-блоков в секциях Anti-patterns несут оба маркера.
    expect(structured.length).toBeGreaterThan(10);
    for (const a of structured) {
      // Объяснения обязательны — ради них секция и пишется.
      expect(a.why, 'пустой why').toBeTruthy();
      expect(a.correctNote, 'пустой correctNote').toBeTruthy();
      // Правильный вариант бывает выражен только прозой в строке-маркере; но хоть что-то
      // конкретное — код неправильного варианта либо код правильного — быть обязано.
      expect(Boolean(a.bad) || Boolean(a.correct), `anti-pattern без кода вообще: ${a.why}`).toBe(
        true
      );
    }
  });

  it.runIf(hasIndexes)('топики адресуются стемом файла, а не заголовком', () => {
    // `slugify` вырезает кириллицу, поэтому id из заголовка выродился бы («61. Путь 1» → "1").
    for (const [pkg, idx] of indexed) {
      for (const t of idx.topics) {
        expect(t.id, `${pkg}/${t.file}: пустой id`).toMatch(/^[a-z0-9][a-z0-9-]*$/);
        expect(t.file, `${pkg}: ${t.id} без файла`).toMatch(/\.md$/);
      }
    }
  });
});
