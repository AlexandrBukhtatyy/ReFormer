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
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSymbol } from '../src/utils/symbols-parser';

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

  it('каждое имя, импортируемое из @reformer/*, резолвится через findSymbol', () => {
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
  });
});
