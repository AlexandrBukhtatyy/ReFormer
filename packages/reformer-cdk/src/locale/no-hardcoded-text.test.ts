/**
 * Страж зашитого текста: всё, что cdk произносит сам, обязано идти через словарь
 * (`src/i18n/en.json` + `useCdkMessages`), иначе строка не переведётся и не переключится вместе с
 * языком.
 *
 * Проверяется рантайм-код пакета на TypeScript AST, а не регулярками — комментарии и JSDoc с
 * русским текстом законны и в выборку не попадают. Ловится три вида утечек:
 *
 * - кириллица в строковом литерале или шаблонной строке;
 * - буквенный текст между JSX-тегами;
 * - литерал в атрибуте, который читает человек (`aria-label`, `title`, `placeholder`, `alt`), —
 *   и в JSX, и в объекте пропсов (prop-getters cdk отдают подписи именно так).
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

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* sourceFiles(full);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield full;
  }
}

/** Буквальный текст выражения: строка или шаблон (без подстановок); иначе `undefined`. */
function literalText(node: ts.Node | undefined): string | undefined {
  if (node === undefined) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => span.literal.text).join('');
  }
  return undefined;
}

/** Утечки в одном файле; `code` — его текст (у стража ниже — текст из памяти). */
function findings(file: string, code: string): string[] {
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const found: string[] = [];
  const report = (node: ts.Node, what: string, text: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    found.push(`${relative(SRC, file)}:${line + 1} — ${what}: «${text.trim()}»`);
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      if (CYRILLIC.test(node.text)) report(node, 'кириллица в строке', node.text);
    } else if (ts.isJsxText(node)) {
      if (LETTER.test(node.text)) report(node, 'текст в JSX', node.text);
    } else if (ts.isJsxAttribute(node) && TEXT_ATTRIBUTES.has(node.name.getText())) {
      const value = node.initializer;
      const literal = literalText(
        value !== undefined && ts.isJsxExpression(value) ? value.expression : value
      );
      if (literal !== undefined && LETTER.test(literal)) {
        report(node, `литерал в ${node.name.getText()}`, literal);
      }
    } else if (
      ts.isPropertyAssignment(node) &&
      (ts.isStringLiteral(node.name) || ts.isIdentifier(node.name)) &&
      TEXT_ATTRIBUTES.has(node.name.text)
    ) {
      const literal = literalText(node.initializer);
      if (literal !== undefined && LETTER.test(literal)) {
        report(node, `литерал в ${node.name.text}`, literal);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('страж зашитого текста', () => {
  it('в рантайм-коде cdk нет строк мимо словаря', () => {
    const files = [...sourceFiles(SRC)];
    // Обход не должен молча опустеть (переезд каталога, сменившийся шаблон имён).
    expect(files.length).toBeGreaterThan(50);
    expect(files.flatMap((file) => findings(file, readFileSync(file, 'utf8')))).toEqual([]);
  });

  it('сам страж видит все три вида утечек и не трогает комментарии', () => {
    const code = [
      'const a = "Удалить";',
      'const b = `Файл ${name} удалён`;',
      'const c = <button aria-label="Remove">Delete</button>;',
      'const d = <img alt={`Preview`} />;',
      '// Комментарий по-русски — не утечка',
      'const e = <span title={label}>{count} / {total}</span>;',
      "const f = { 'aria-label': `Remove file ${name}`, title: t('cdk.x'), alt: '' };",
    ].join('\n');

    expect(findings(join(SRC, 'probe.tsx'), code)).toEqual([
      'probe.tsx:1 — кириллица в строке: «Удалить»',
      'probe.tsx:2 — кириллица в строке: «Файл»',
      'probe.tsx:2 — кириллица в строке: «удалён»',
      'probe.tsx:3 — литерал в aria-label: «Remove»',
      'probe.tsx:3 — текст в JSX: «Delete»',
      'probe.tsx:4 — литерал в alt: «Preview»',
      'probe.tsx:7 — литерал в aria-label: «Remove file»',
    ]);
  });
});
