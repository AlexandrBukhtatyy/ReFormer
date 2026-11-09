/**
 * Symbol-consistency guard (ReFormer-wk1, из рекомендации отчёта): промпты не должны
 * противоречить собственному резолверу символов сервера. Каждое имя, импортируемое из
 * `@reformer/*` в шаблонах промптов, обязано резолвиться через findSymbol — иначе промпт
 * учит API, которого в установленном пакете нет (так P0 учил `validateFormModel`).
 *
 * Почему именно @reformer-импорты: это единственный высокосигнальный маркер «настоящего»
 * API без ложных срабатываний — в отличие от произвольных слов в бэктиках или
 * пользовательских имён в примерах. Проверено: все 24 реальных импорта резолвятся.
 *
 * Ловит то, что tsc/ESLint не видят: снятый символ, оставшийся в прозе промпта.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { symbolsByName } from '../src/core/index/merge';
import { cliKnowledge } from '../src/platform/cli/knowledge';
import { findSymbol } from '../src/platform/cli/symbols-parser';
import { AST_HEAVY_TIMEOUT_MS } from './timeouts';

const templatesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/prompts/templates');

// `import { A, type B, C as D } from '@reformer/...'` (в т.ч. многострочный, и в прозе).
// `[^{}]*` (не `[\s\S]*?`) — иначе регекс перепрыгивает через соседний не-@reformer
// импорт (`import { useMemo } from 'react'; import { … } from '@reformer/…'`) и хватает
// чужие имена. `[^{}]*` включает переносы строк, но останавливается на первом `}`.
const IMPORT_RE = /import\s+(?:type\s+)?\{([^{}]*)\}\s*from\s*['"](@reformer\/[^'"]+)['"]/g;

/** Валидный JS-идентификатор — отсекает артефакты прозы вроде `…`. */
const IDENT_RE = /^[A-Za-z_$][\w$]*$/;

interface ImportedName {
  name: string;
  from: string;
  file: string;
}

/** Извлечь именованные импорты из @reformer/* по всем шаблонам. */
function collectReformerImports(): ImportedName[] {
  const out: ImportedName[] = [];
  for (const file of readdirSync(templatesDir).filter((f) => f.endsWith('.md'))) {
    const content = readFileSync(resolve(templatesDir, file), 'utf-8');
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(content)) !== null) {
      const [, names, from] = m;
      for (const raw of names.split(',')) {
        // `type X` → X; `X as Y` → импортируемое имя X (оно и должно существовать).
        const name = raw
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          .trim();
        if (IDENT_RE.test(name)) out.push({ name, from, file });
      }
    }
  }
  return out;
}

describe('промпты не противоречат резолверу символов (symbol-consistency)', () => {
  const imports = collectReformerImports();

  it('в шаблонах вообще есть @reformer-импорты для проверки', () => {
    expect(imports.length).toBeGreaterThan(0);
  });

  it(
    'каждое имя, импортируемое из @reformer/*, резолвится через findSymbol',
    () => {
      const seen = new Set<string>();
      const unresolved: string[] = [];
      for (const { name, from, file } of imports) {
        const key = `${name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!findSymbol(name, '*')) unresolved.push(`${name} (${from}, ${file})`);
      }
      expect(
        unresolved,
        `Промпты импортируют символы, которых нет в @reformer/* — вероятно, API снят из core, ` +
          `но остался в промпте (как validateFormModel в P0). Обнови шаблон на живой контракт ` +
          `или проверь имя.\nНе резолвятся:\n  ${unresolved.join('\n  ')}`
      ).toEqual([]);
    },
    AST_HEAVY_TIMEOUT_MS
  );
});

// ---------------------------------------------------------------------------------------------
// Рецепты docs/llms. `find_recipe` отдаёт их агенту целиком, как промпт, поэтому импорт в рецепте —
// такое же обещание API. Здесь проверяется и ПОДПУТЬ: `import { useFormControl } from
// '@reformer/core'` резолвится по имени, но у потребителя упадёт — хуки живут в
// `@reformer/core/react`. Спецификаторы берутся из индекса (`llms-index.json`), как у validate_form.

const packagesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Рецепты всех пакетов и шаблоны промптов. */
function recipeFiles(): string[] {
  const out: string[] = [];
  for (const dir of readdirSync(packagesDir)) {
    const llms = resolve(packagesDir, dir, 'docs/llms');
    if (!existsSync(llms)) continue;
    for (const file of readdirSync(llms).filter((f) => f.endsWith('.md'))) {
      out.push(resolve(llms, file));
    }
  }
  for (const file of readdirSync(templatesDir).filter((f) => f.endsWith('.md'))) {
    out.push(resolve(templatesDir, file));
  }
  return out;
}

/**
 * Импорт показан как ошибка: строка таблицы «нет → есть» или пометка `❌` / `NO!` / `WRONG` на
 * самой строке импорта либо на строке над ним (`// ❌ Импорт из главной бочки`).
 */
function isCounterExample(lines: string[], first: number, last: number): boolean {
  if (/^\s*\|/.test(lines[first])) return true;
  const context = lines.slice(Math.max(0, first - 1), last + 1).join('\n');
  return /❌|NO!|WRONG|не существует/i.test(context);
}

interface RecipeImport {
  name: string;
  from: string;
  where: string;
}

function collectRecipeImports(): RecipeImport[] {
  const out: RecipeImport[] = [];
  for (const file of recipeFiles()) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(content)) !== null) {
      const [, names, from] = m;
      // Глубокие пути в сборку MCP-сервера (`@reformer/mcp/dist/platform/worker/…`) публичного
      // входа не имеют и в индекс не попадают. Входы `@reformer/mcp/core`, `/intent` и др.
      // проверяются наравне с пакетами форм.
      if (from.startsWith('@reformer/mcp/dist/')) continue;
      const first = content.slice(0, m.index).split('\n').length - 1;
      const last = content.slice(0, m.index + m[0].length).split('\n').length - 1;
      if (isCounterExample(lines, first, last)) continue;
      const where = `${file.slice(packagesDir.length + 1)}:${first + 1}`;
      for (const raw of names.split(',')) {
        const name = raw
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          .trim();
        if (IDENT_RE.test(name)) out.push({ name, from, where });
      }
    }
  }
  return out;
}

describe('рецепты docs/llms импортируют существующее API с правильного входа', () => {
  const recipeImports = collectRecipeImports();

  it('в рецептах есть @reformer-импорты для проверки', () => {
    expect(recipeImports.length).toBeGreaterThan(50);
  });

  it(
    'каждое имя существует и экспортируется тем входом, из которого его импортируют',
    () => {
      const k = cliKnowledge();
      const problems: string[] = [];
      for (const { name, from, where } of recipeImports) {
        const base = from.split('/').slice(0, 2).join('/');
        const subpath = from.slice(base.length); // '' либо '/react'
        const hit = symbolsByName(k.index, name, base)[0];
        if (!hit) {
          if (!findSymbol(name, '*'))
            problems.push(`${where}: ${name} из ${from} — нет такого символа`);
          continue;
        }
        const entries = (hit.entries ?? []).map((e) => (e === '.' ? '' : e.replace(/^\./, '')));
        if (entries.length > 0 && !entries.includes(subpath)) {
          problems.push(
            `${where}: ${name} из ${from} — экспортируется из ${entries.map((e) => base + e).join(', ')}`
          );
        }
      }
      expect(problems, `Рецепты учат несуществующему импорту:\n  ${problems.join('\n  ')}`).toEqual(
        []
      );
    },
    AST_HEAVY_TIMEOUT_MS
  );
});
