/**
 * Реестр кодов диагностик полон (ReFormer-11oe.7.1).
 *
 * Коды — стабильная часть контракта: текст находки может меняться, а хост со своим языком выбирает
 * по коду. Реестр для модели — `docs/llms/08-diagnostic-codes.md`, его зеркало для людей — страница
 * сайта `projects/reformer-doc/docs/mcp/diagnostic-codes.md`. Тест берёт коды из исходников и падает,
 * если код появился без строки в реестре или строка осталась от удалённого кода.
 *
 * Коды чтения, судьи и кросс-проверок — объединения строковых литералов в типах; во время исполнения
 * их нет, поэтому они читаются из текста исходников.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CODE_TITLES } from '../src/core/validate/codes';
import { precondition } from './support/preconditions';

const pkgDir = resolve(__dirname, '..');
const repoRoot = resolve(pkgDir, '../..');
const source = (file: string) => readFileSync(resolve(pkgDir, 'src/core', file), 'utf8');

/** Строковые литералы объединения `export type <name> = … ;` — без комментариев. */
function unionLiterals(text: string, name: string): string[] {
  const start = text.indexOf(`export type ${name} =`);
  if (start < 0) throw new Error(`тип ${name} не найден`);
  // Комментарии — до поиска конца объявления: в них бывает `;`.
  const code = text
    .slice(start)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const body = code.slice(0, code.indexOf(';'));
  return [...body.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

const intent = source('generate/form-intent.ts');
const judge = source('generate/judge.ts');
const CODES: Record<string, string[]> = {
  RF: Object.keys(CODE_TITLES),
  'C (CrossCheckCode)': unionLiterals(source('generate/cross-check.ts'), 'CrossCheckCode'),
  IntentProblemCode: unionLiterals(intent, 'IntentProblemCode'),
  IntentWarningCode: unionLiterals(intent, 'IntentWarningCode'),
  JudgeCode: unionLiterals(judge, 'JudgeCode'),
  JudgeWarningCode: unionLiterals(judge, 'JudgeWarningCode'),
};
const ALL = [...new Set(Object.values(CODES).flat())].sort();

/** Коды из первого столбца таблиц документа: `| \`код\` |`. */
function documentedCodes(text: string): string[] {
  return [...text.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((match) => match[1]).sort();
}

describe('реестр кодов диагностик', () => {
  it('коды из исходников найдены: разбор типов не пуст', () => {
    expect(CODES.RF).toContain('RF016');
    expect(CODES['C (CrossCheckCode)']).toContain('C13');
    expect(CODES.IntentProblemCode).toContain('unknown-key');
    expect(CODES.IntentWarningCode).toContain('rule-empty-dropped');
    expect(CODES.JudgeCode).toContain('not-in-document');
    expect(CODES.JudgeWarningCode).toContain('not-kept');
  });

  it('docs/llms/08-diagnostic-codes.md — ровно коды исходников', () => {
    const text = readFileSync(resolve(pkgDir, 'docs/llms/08-diagnostic-codes.md'), 'utf8');
    const documented = documentedCodes(text);
    expect(
      ALL.filter((code) => !documented.includes(code)),
      'нет строки в реестре'
    ).toEqual([]);
    expect(
      documented.filter((code) => !ALL.includes(code)),
      'код удалён из исходников'
    ).toEqual([]);
    expect(new Set(documented).size, 'код записан дважды').toBe(documented.length);
    // Имя RF-кода — то, что печатает отчёт validate_form.
    for (const [code, title] of Object.entries(CODE_TITLES)) {
      expect(text, code).toMatch(new RegExp(`^\\|\\s*\`${code}\`\\s*\\|\\s*${title}\\s*\\|`, 'm'));
    }
  });

  const site = resolve(repoRoot, 'projects/reformer-doc/docs/mcp/diagnostic-codes.md');
  it.runIf(precondition('страница сайта', existsSync(site), 'projects/reformer-doc в монорепо'))(
    'зеркало на сайте — те же коды',
    () => {
      const mirror = documentedCodes(readFileSync(site, 'utf8'));
      const registry = documentedCodes(
        readFileSync(resolve(pkgDir, 'docs/llms/08-diagnostic-codes.md'), 'utf8')
      );
      expect(mirror).toEqual(registry);
    }
  );
});
