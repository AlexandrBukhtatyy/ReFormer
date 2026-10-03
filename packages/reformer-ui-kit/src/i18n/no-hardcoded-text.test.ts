/**
 * Страж зашитого текста: всё, что кит показывает человеку сам, обязано идти через словарь
 * (`src/i18n/en.json` + `useKitMessages`), иначе строка не переведётся и не переключится вместе с
 * языком.
 *
 * Проверяется рантайм-код пакета на TypeScript AST, а не регулярками — комментарии и JSDoc с
 * русским текстом законны и в выборку не попадают. Ловится:
 *
 * - кириллица в строковом литерале или шаблонной строке (кроме диагностики разработчику —
 *   аргументов `console.*` и `new Error`);
 * - буквенный текст между JSX-тегами;
 * - литерал в атрибуте, который читает человек (`aria-label`, `title`, `placeholder`, `alt`), —
 *   и в JSX, и в объекте пропсов;
 * - литерал-запасной вариант в JSX: `{placeholder ?? 'Search...'}`, `{ok ? 'Yes' : 'No'}`;
 * - литерал-умолчание текстового пропа в деструктуризации: `emptyText = 'No results.'`.
 *
 * Вне проверки: `*.props.ts` (описания пропсов для инспектора билдера — метаданные каталога, а
 * умолчания в них стережёт `kit-locale.test.tsx`), словарь классов и сгенерированная бочка `meta.ts`.
 *
 * {@link NOT_YET_LOCALIZED} — компоненты, до которых локализация ещё не дошла (этапы 3б и 4 плана
 * docs/plans/i18n-runtime-locale.md). Список обязан сокращаться до нуля: файл из списка, в котором
 * находок уже нет, роняет тест так же, как находка вне списка.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

const CYRILLIC = /[А-Яа-яЁё]/;
const LETTER = /\p{L}/u;
const TEXT_ATTRIBUTES = new Set(['aria-label', 'title', 'placeholder', 'alt']);
/** Имя пропа, значение которого читает человек: `label`, `emptyText`, `searchPlaceholder`, … */
const TEXT_PROP = /(label|placeholder|title|text|message|description|hint)$/i;

/** Не рантайм-текст для пользователя: метаданные каталога, генерируемые файлы, тестовые утилиты. */
const OUT_OF_SCOPE = [/\.test\.tsx?$/, /\.props\.ts$/, /^styles\//, /^test-utils\//, /^meta\.ts$/];

/**
 * Каталоги компонентов, ещё не переведённые на словарь. Убирать запись, как только компонент
 * переведён; новых не добавлять.
 */
const NOT_YET_LOCALIZED: readonly string[] = [
  // этап 3б
  'components/breadcrumb/',
  'components/carousel/',
  'components/command/',
  'components/dialog/',
  'components/example-card/',
  'components/info-hint/',
  'components/input-password/',
  'components/message-scroller/',
  'components/pagination/',
  'components/radio-group/',
  'components/sheet/',
  'components/sidebar/',
  'components/spinner/',
  'components/table/',
  'components/tree/',
  // этап 4
  'components/date-picker/',
];

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* sourceFiles(full);
    else if (/\.tsx?$/.test(name)) yield full;
  }
}

const relOf = (file: string): string => relative(SRC, file).replaceAll('\\', '/');

/** Буквальный текст выражения: строка или шаблон (без подстановок); иначе `undefined`. */
function literalText(node: ts.Node | undefined): string | undefined {
  if (node === undefined) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => span.literal.text).join('');
  }
  return undefined;
}

/**
 * Литералы-«листья» выражения: сам литерал либо ветки `a ?? 'x'`, `a || 'x'`, `c ? 'x' : 'y'`.
 * Вызовы не раскрываются: `cn('flex gap-2')` и `t('kit.x')` — не текст для человека.
 */
function fallbackLiterals(node: ts.Expression | undefined): string[] {
  if (node === undefined) return [];
  const own = literalText(node);
  if (own !== undefined) return [own];
  if (ts.isParenthesizedExpression(node)) return fallbackLiterals(node.expression);
  if (ts.isConditionalExpression(node)) {
    return [...fallbackLiterals(node.whenTrue), ...fallbackLiterals(node.whenFalse)];
  }
  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return [...fallbackLiterals(node.left), ...fallbackLiterals(node.right)];
  }
  return [];
}

/** Диагностика разработчику: аргументы `console.*(…)` и `new Error(…)`. */
function isDevDiagnostic(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n !== undefined; n = n.parent) {
    if (ts.isNewExpression(n) && /Error$/.test(n.expression.getText())) return true;
    if (ts.isCallExpression(n) && /^console\./.test(n.expression.getText())) return true;
    if (ts.isFunctionLike(n) || ts.isSourceFile(n)) return false;
  }
  return false;
}

/** Утечки в одном файле; `code` — его текст (у самопроверки ниже — текст из памяти). */
function findings(file: string, code: string): string[] {
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const found = new Set<string>();
  const report = (node: ts.Node, what: string, text: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    found.add(`${relOf(file)}:${line + 1} — ${what}: «${text.replace(/\s+/g, ' ').trim()}»`);
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      if (CYRILLIC.test(node.text) && !isDevDiagnostic(node)) {
        report(node, 'кириллица в строке', node.text);
      }
    } else if (ts.isJsxText(node)) {
      if (LETTER.test(node.text)) report(node, 'текст в JSX', node.text);
    } else if (ts.isJsxAttribute(node) && TEXT_ATTRIBUTES.has(node.name.getText())) {
      const value = node.initializer;
      const texts =
        value !== undefined && ts.isJsxExpression(value)
          ? fallbackLiterals(value.expression)
          : [literalText(value)];
      for (const text of texts) {
        if (text !== undefined && LETTER.test(text)) {
          report(node, `литерал в ${node.name.getText()}`, text);
        }
      }
    } else if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) {
      // Выражение-ребёнок JSX-элемента: `{placeholder ?? 'Search...'}`.
      for (const text of fallbackLiterals(node.expression)) {
        if (LETTER.test(text)) report(node, 'литерал в JSX-выражении', text);
      }
    } else if (
      ts.isPropertyAssignment(node) &&
      (ts.isStringLiteral(node.name) || ts.isIdentifier(node.name)) &&
      TEXT_ATTRIBUTES.has(node.name.text)
    ) {
      const text = literalText(node.initializer);
      if (text !== undefined && LETTER.test(text))
        report(node, `литерал в ${node.name.text}`, text);
    } else if (
      ts.isBindingElement(node) &&
      ts.isIdentifier(node.name) &&
      TEXT_PROP.test(node.name.text)
    ) {
      const text = literalText(node.initializer);
      if (text !== undefined && LETTER.test(text)) {
        report(node, `умолчание пропа ${node.name.text}`, text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...found];
}

describe('страж зашитого текста', () => {
  const files = [...sourceFiles(SRC)].filter(
    (file) => !OUT_OF_SCOPE.some((re) => re.test(relOf(file)))
  );
  const byFile = new Map(
    files.map((file) => [relOf(file), findings(file, readFileSync(file, 'utf8'))] as const)
  );
  const isExcepted = (rel: string) => NOT_YET_LOCALIZED.some((prefix) => rel.startsWith(prefix));

  it('в переведённых компонентах нет строк мимо словаря', () => {
    // Обход не должен молча опустеть (переезд каталога, сменившийся шаблон имён).
    expect(files.length).toBeGreaterThan(150);
    const leaks = [...byFile].filter(([rel]) => !isExcepted(rel)).flatMap(([, found]) => found);
    expect(leaks).toEqual([]);
  });

  it('список исключений не устарел: в каждом каталоге из него ещё есть что переводить', () => {
    const stale = NOT_YET_LOCALIZED.filter(
      (prefix) => ![...byFile].some(([rel, found]) => rel.startsWith(prefix) && found.length > 0)
    );
    expect(stale).toEqual([]);
  });

  it('сам страж видит все виды утечек и не трогает комментарии, классы и диагностику', () => {
    const code = [
      'const a = "Удалить";',
      'const b = `Файл ${name} удалён`;',
      'const c = <button aria-label="Remove">Delete</button>;',
      'const d = <img alt={`Preview`} />;',
      '// Комментарий по-русски — не утечка',
      'const e = <span title={label} className={cn("flex gap-2")}>{count} / {total}</span>;',
      "const f = { 'aria-label': `Remove file ${name}`, title: t('kit.x'), alt: '' };",
      "const g = <p>{placeholder ?? 'Search...'}</p>;",
      "const h = <input placeholder={hint || (busy ? 'Loading...' : t('kit.y'))} />;",
      "function I({ emptyText = 'No results.', size = 'sm', className = 'p-2 text-sm' }) {}",
      "console.error('[ui-kit] control не передан'); throw new Error('шаг не найден');",
      "const j = <i>{done ? '✓' : icon}</i>;",
    ].join('\n');

    expect(findings(join(SRC, 'probe.tsx'), code)).toEqual([
      'probe.tsx:1 — кириллица в строке: «Удалить»',
      'probe.tsx:2 — кириллица в строке: «Файл»',
      'probe.tsx:2 — кириллица в строке: «удалён»',
      'probe.tsx:3 — литерал в aria-label: «Remove»',
      'probe.tsx:3 — текст в JSX: «Delete»',
      'probe.tsx:4 — литерал в alt: «Preview»',
      'probe.tsx:7 — литерал в aria-label: «Remove file»',
      'probe.tsx:8 — литерал в JSX-выражении: «Search...»',
      'probe.tsx:9 — литерал в placeholder: «Loading...»',
      'probe.tsx:10 — умолчание пропа emptyText: «No results.»',
    ]);
  });
});
