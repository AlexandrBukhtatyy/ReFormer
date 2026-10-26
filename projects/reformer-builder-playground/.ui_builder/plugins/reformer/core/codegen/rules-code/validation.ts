/**
 * Правила валидации из файла `validation/*.ts` модуля.
 *
 * Узнаются объявления `export const <имя> = defineValidation<T>((…) => { … })` — `formRules`,
 * `crossStepRules`, `stepRules` — и в их теле ровно то, что печатает генерация
 * (`buildValidationSchemaTs` `@reformer/mcp`):
 *
 * - `validate(model.$.path, [required(), minLength(2)])`;
 * - `validateAsync(model.$.path, [выражение])`;
 * - `cross(model.$.path, (values) => (условие ? null : { code: 'код' }))`;
 * - `applyEach(model.$.массив, ({ model: item }) => { … })` — правила строки, пути от `item`;
 * - `validateWhen(() => условие, () => { … })`.
 *
 * Правило собирается «атомом»: одна проверка — одно правило. Генерация печатает правило с
 * несколькими проверками без условия теми же отдельными операторами, и различить «одно правило
 * из двух проверок» и «два правила» по коду нельзя — поэтому читатель и нормализация
 * (`./normalize`) режут одинаково.
 *
 * Оператор, которого читатель не знает, — чужой: он возвращается текстом и строкой, а не
 * отбрасывается молча.
 *
 * @module plugins/reformer/core/codegen/rules-code/validation
 */

import type { ValidationRuleIntent } from '../../form-model/rules';
import {
  arrayItems,
  arrowOf,
  callOf,
  closeOf,
  conditionalOf,
  lineAt,
  objectProperties,
  statementsOf,
  stringOf,
  stripParens,
  withoutComments,
  type Statement,
} from './syntax';

/**
 * Пометка заготовки: первая строка тела объявления, напечатанного не из правил формы, а из
 * флагов «обязательное» схемы. Нетронутую заготовку читатель правилами не считает — иначе
 * обязательность перестала бы следовать за схемой, как только модуль сгенерирован.
 */
export const SCAFFOLD_NOTE = 'Заготовка: обязательные поля схемы — правила формы заменят её.';

/** Оператор, которого читатель не знает: текст как есть и строка в файле. */
export interface ForeignCode {
  readonly text: string;
  readonly line: number;
}

/** Что нашлось в файле валидации. */
export interface ValidationFileRead {
  readonly rules: ValidationRuleIntent[];
  readonly foreign: ForeignCode[];
  /** Все объявления файла — заготовки из флагов схемы. */
  readonly scaffold: boolean;
}

/** Путь модели в ручке: `model.$.contacts.email` → `contacts.email`. */
const PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

/** Свой код в опциях валидатора: `required({ code: 'phone.required' })`. */
const OPTION_CODE = /\bcode\s*:\s*(['"])((?:(?!\1).)+)\1/;

/** Код кросс-полевой проверки по умолчанию: правило без своего кода печатается с ним. */
export const DEFAULT_CROSS_CODE = 'cross';

/** Код правила с одной проверкой — из её опций; у нескольких проверок кода нет. */
export function codeOfChecks(checks: readonly string[]): string | undefined {
  if (checks.length !== 1) return undefined;
  return OPTION_CODE.exec(checks[0] as string)?.[2];
}

/** Область чтения: путь массива строки и условие, под которыми стоит оператор. */
interface Scope {
  readonly each?: string;
  readonly when?: string;
}

/** Ручка поля → путь в модели формы; `null` — не ручка этой области. */
function targetOf(ref: string, scope: Scope): string | null {
  const t = ref.trim();
  const prefix = scope.each === undefined ? 'model.$.' : 'item.$.';
  if (!t.startsWith(prefix)) return null;
  const path = t.slice(prefix.length);
  if (!PATH.test(path)) return null;
  return scope.each === undefined ? path : `${scope.each}.${path}`;
}

/** Правило с обёртками области. */
function atom(
  target: string,
  scope: Scope,
  rest: Partial<ValidationRuleIntent>
): ValidationRuleIntent {
  return {
    target,
    ...(scope.each === undefined ? {} : { each: scope.each }),
    ...(scope.when === undefined ? {} : { when: scope.when }),
    rules: [],
    ...rest,
  };
}

/** Тело `cross(…)`: условие и код из `(values) => (C ? null : { code: 'X' })`. */
function crossOf(text: string): { cross: string; code: string } | null {
  const arrow = arrowOf(text);
  if (arrow === null || arrow.block || stripParens(arrow.params) !== 'values') return null;
  const conditional = conditionalOf(stripParens(arrow.body));
  if (conditional === null || conditional.then !== 'null') return null;
  const props = objectProperties(conditional.otherwise);
  if (props === null || props.length !== 1 || props[0]?.key !== 'code') return null;
  const code = stringOf(props[0].value ?? '');
  if (code === null) return null;
  return { cross: stripParens(conditional.test), code };
}

/** Тело стрелки-блока без параметров либо с одним из ожидаемых списков параметров. */
function blockOf(text: string, params: (params: string) => boolean): string | null {
  const arrow = arrowOf(text);
  if (arrow === null || !arrow.block || !params(arrow.params.replace(/\s+/g, ' ').trim())) {
    return null;
  }
  return arrow.body;
}

/** Прочитать операторы тела в правила; непонятное — в `foreign`. */
function readStatements(
  statements: readonly Statement[],
  scope: Scope,
  file: string,
  out: ValidationFileRead
): void {
  for (const statement of statements) {
    if (!readStatement(statement, scope, file, out)) {
      out.foreign.push({ text: statement.text, line: statement.line });
    }
  }
}

function readStatement(
  statement: Statement,
  scope: Scope,
  file: string,
  out: ValidationFileRead
): boolean {
  const call = callOf(statement.text);
  if (call === null) return false;
  const [first = '', second = ''] = call.args;

  switch (call.callee) {
    case 'validate': {
      const target = targetOf(first, scope);
      const checks = arrayItems(second);
      if (target === null || checks === null || call.args.length !== 2) return false;
      const code = codeOfChecks(checks);
      out.rules.push(
        atom(target, scope, { rules: checks, ...(code === undefined ? {} : { code }) })
      );
      return true;
    }
    case 'validateAsync': {
      const target = targetOf(first, scope);
      const checks = arrayItems(second);
      if (target === null || checks === null || checks.length !== 1 || call.args.length !== 2) {
        return false;
      }
      out.rules.push(atom(target, scope, { async: checks[0] as string }));
      return true;
    }
    case 'cross': {
      const target = targetOf(first, scope);
      const cross = crossOf(second);
      if (target === null || cross === null || call.args.length !== 2) return false;
      out.rules.push(
        atom(target, scope, {
          cross: cross.cross,
          ...(cross.code === DEFAULT_CROSS_CODE ? {} : { code: cross.code }),
        })
      );
      return true;
    }
    case 'applyEach': {
      if (scope.each !== undefined || call.args.length !== 2) return false;
      const array = targetOf(first, scope);
      const body = blockOf(
        second,
        (params) => params === '({ model: item })' || params === '({ model: item, cross })'
      );
      if (array === null || body === null) return false;
      return readBlock(body, file, second, { ...scope, each: array }, out);
    }
    case 'validateWhen': {
      if (scope.when !== undefined || scope.each !== undefined || call.args.length !== 2) {
        return false;
      }
      const condition = arrowOf(first);
      const body = blockOf(second, (params) => params === '()');
      if (condition === null || condition.block || condition.params.trim() !== '()') return false;
      if (body === null) return false;
      return readBlock(body, file, second, { ...scope, when: condition.body.trim() }, out);
    }
    default:
      return false;
  }
}

/**
 * Прочитать тело вложенного блока. Его операторы — часть одного правила-обёртки: непонятный
 * внутри делает чужим весь оператор, а не половину блока.
 */
function readBlock(
  body: string,
  file: string,
  owner: string,
  scope: Scope,
  out: ValidationFileRead
): boolean {
  const statements = statementsOf(body, Math.max(0, file.indexOf(owner)), file);
  if (statements === null) return false;
  const inner: ValidationFileRead = { rules: [], foreign: [], scaffold: false };
  readStatements(statements, scope, file, inner);
  if (inner.foreign.length > 0) return false;
  out.rules.push(...inner.rules);
  return true;
}

/** Объявление `export const <имя> = defineValidation…(` — индекс открывающей скобки вызова. */
const DECLARATION = /export\s+const\s+[A-Za-z_$][\w$]*\s*(?::[^=]+)?=\s*defineValidation\b/g;

/**
 * Прочитать правила валидации из текста файла.
 *
 * @param options.scaffold - Читать ли заготовку правилами. Нетронутая заготовка правил не несёт;
 *   заготовку, которую правили руками, человек сделал своей — её операторы и есть правила.
 */
export function readValidationFile(
  text: string,
  options: { readonly scaffold?: boolean } = {}
): ValidationFileRead {
  const out: ValidationFileRead = { rules: [], foreign: [], scaffold: false };
  let declarations = 0;
  let scaffolds = 0;
  for (const match of withoutComments(text).matchAll(DECLARATION)) {
    const open = text.indexOf('(', (match.index ?? 0) + match[0].length);
    const close = open < 0 ? -1 : closeOf(text, open);
    const arrow = close < 0 ? null : arrowOf(text.slice(open + 1, close));
    if (arrow === null || !arrow.block) {
      out.foreign.push({ text: match[0], line: lineAt(text, match.index ?? 0) });
      continue;
    }
    declarations += 1;
    const bodyAt = text.indexOf(arrow.body, open);
    const statements = statementsOf(arrow.body, Math.max(0, bodyAt), text);
    if (statements === null) {
      out.foreign.push({ text: match[0], line: lineAt(text, match.index ?? 0) });
      continue;
    }
    if (options.scaffold !== true && statements[0]?.comments.includes(SCAFFOLD_NOTE) === true) {
      scaffolds += 1;
      continue;
    }
    readStatements(statements, {}, text, out);
  }
  return { ...out, scaffold: declarations > 0 && scaffolds === declarations };
}
