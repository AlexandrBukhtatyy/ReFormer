/**
 * Шаблоны промптов: markdown с подстановками `{{имя}}` — и ничего больше. Ни условий, ни циклов,
 * ни хелперов: всё условное модуль промпта считает сам и передаёт готовой строкой.
 *
 * Почему не шаблонизатор. Раньше здесь был Handlebars, и от него использовалась только
 * подстановка. Зато его разделители совпадают с JSX: `settings={{ fieldWrapper: FormField }}` в
 * тексте промпта он разбирал как выражение, и `start-here` — точка входа сервера — отдавал
 * клиентам JSON-RPC -32603. Здесь подстановкой считается только точное `{{имя}}` (буквы, цифры и
 * `_`, без пробелов), а всё остальное — текст: JSX и примеры кода экранировать не нужно.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Подстановка — `{{имя}}` целиком, без пробелов внутри. Всё прочее с `{{` — текст шаблона. */
const PLACEHOLDER_RE = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

/**
 * Синтаксис Handlebars, которого больше нет: экранирование `\{{`, блоки `{{#…}}`/`{{/…}}`,
 * `{{else}}`, комментарии `{{!…}}`, партиалы `{{>…}}`, тройные скобки и `{{{{raw}}}}`. Такой
 * фрагмент ушёл бы клиенту буквальным текстом.
 */
const STALE_SYNTAX_RE = /\\\{\{|\{\{\{|\{\{\s*(?:[#/^!>]|else\b)/g;

const templateCache = new Map<string, string>();

function getTemplatePaths(name: string): string[] {
  return [
    // Runtime: dist/utils/ -> dist/prompts/templates/
    resolve(__dirname, '../prompts/templates', `${name}.md`),
    // Monorepo dev (tsc --watch): dist/utils/ -> src/prompts/templates/
    resolve(__dirname, '../../src/prompts/templates', `${name}.md`),
    // CWD fallback (running from repo root)
    resolve(process.cwd(), 'packages/reformer-mcp/src/prompts/templates', `${name}.md`),
  ];
}

function loadTemplate(name: string): string {
  const cached = templateCache.get(name);
  if (cached !== undefined) return cached;
  const candidates = getTemplatePaths(name);
  for (const p of candidates) {
    if (existsSync(p)) {
      const text = readFileSync(p, 'utf-8');
      templateCache.set(name, text);
      return text;
    }
  }
  throw new Error(
    `Prompt template "${name}.md" not found. Tried:\n${candidates.map((c) => `  - ${c}`).join('\n')}`
  );
}

/** Имена подстановок шаблона, без повторов, в порядке первого появления. */
export function templatePlaceholders(template: string): string[] {
  return [...new Set(Array.from(template.matchAll(PLACEHOLDER_RE), (match) => match[1]))];
}

/**
 * Остатки синтаксиса Handlebars в шаблоне, с номерами строк. Рендер на них не падает — фрагмент
 * просто уйдёт клиенту текстом, — поэтому ловит их проверка `check:mcp-render` и тест шаблонов.
 */
export function staleTemplateSyntax(template: string): Array<{ line: number; text: string }> {
  return Array.from(template.matchAll(STALE_SYNTAX_RE), (match) => {
    const start = match.index ?? 0;
    const line = template.slice(0, start).split('\n').length;
    const lineText = template.split('\n')[line - 1] ?? '';
    return { line, text: lineText.trim() };
  });
}

/**
 * Подставить значения в шаблон.
 *
 * Один проход: подставленное значение не разбирается повторно, поэтому `{{…}}` в коде
 * пользователя остаётся как есть. Замена идёт функцией, поэтому `$&` и `$1` в значении — текст,
 * а не шаблоны `String.replace`. Подстановка без значения — ошибка со списком недостающих и
 * переданных имён: иначе промпт молча ушёл бы клиенту с дырой. `null`/`undefined` под
 * переданным ключом — пустая строка.
 */
export function fillTemplate(
  template: string,
  vars: Record<string, unknown>,
  label = 'template'
): string {
  const missing = templatePlaceholders(template).filter((name) => !Object.hasOwn(vars, name));
  if (missing.length > 0) {
    throw new Error(
      `Prompt template "${label}" missing variables: ${missing.join(', ')}. ` +
        `Provided: ${Object.keys(vars).join(', ') || '(none)'}`
    );
  }
  return template.replace(PLACEHOLDER_RE, (_, name: string) => {
    const value = vars[name];
    return value === null || value === undefined ? '' : String(value);
  });
}

export function renderPromptTemplate(name: string, vars: Record<string, unknown>): string {
  return fillTemplate(loadTemplate(name), vars, `${name}.md`);
}
