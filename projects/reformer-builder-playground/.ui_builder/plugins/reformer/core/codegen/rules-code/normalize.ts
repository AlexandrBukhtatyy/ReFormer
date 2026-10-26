/**
 * Каноническая форма правил — та, в которой их возвращает читатель кода (`./read`).
 *
 * Код несёт меньше, чем словарь правил: одна проверка — один оператор, источники большинства
 * связей не печатаются, выражения по умолчанию не отличить от отсутствующих. Нормализация сводит
 * правила к тому, что переживает печать и чтение, — и только к этому. На ней держится главное
 * свойство читателя: `read(print(R))` совпадает с `normalizeRules(R)`, а печать прочитанного —
 * байт в байт с печатью исходного.
 *
 * Что теряется (и закреплено тестом):
 *
 * - правило из нескольких проверок без условия режется на правила по проверке;
 * - источники связей, у которых их нет в коде, выводятся из выражения ({@link inferSources});
 * - код асинхронной проверки и код обычного правила, не вписанный в его единственную проверку;
 * - опции у связей, которые их не печатают.
 *
 * @module plugins/reformer/core/codegen/rules-code/normalize
 */

import type {
  BehaviorIntent,
  FormRules,
  RenderRuleIntent,
  ValidationRuleIntent,
} from '../../form-model/rules';
import { DEFAULT_EXPR } from './behavior';
import { literalOf } from './syntax';
import { codeOfChecks, DEFAULT_CROSS_CODE } from './validation';

/** Проверка — вызов: `required` → `required()`, как её печатает генерация. */
export function callValidator(check: string): string {
  const trimmed = check.trim();
  return /[()]/.test(trimmed) ? trimmed : `${trimmed}()`;
}

/** Путь строки — полным путём от формы: `qty` при `each: 'items'` → `items.qty`. */
function full(path: string, each: string | undefined): string {
  if (each === undefined || path === each || path.startsWith(`${each}.`)) return path;
  return `${each}.${path}`;
}

const trimmed = (text: string | undefined): string | undefined => {
  const t = text?.trim();
  return t === undefined || t === '' ? undefined : t;
};

/** Правило валидации → правила по проверке, как их прочтёт код. */
function validationAtoms(rule: ValidationRuleIntent): ValidationRuleIntent[] {
  const each = trimmed(rule.each);
  const when = trimmed(rule.when);
  const base = {
    target: full(rule.target.trim(), each),
    ...(each === undefined ? {} : { each }),
    ...(when === undefined ? {} : { when }),
  };
  const atoms: ValidationRuleIntent[] = [];
  const checks = rule.rules
    .map((check) => check.trim())
    .filter(Boolean)
    .map(callValidator);
  if (checks.length > 0) {
    const code = codeOfChecks(checks);
    // Текст словарь формы держит под кодом правила: код в проверке и код правила — один код.
    const message = code !== undefined && rule.code === code ? trimmed(rule.message) : undefined;
    atoms.push({
      ...base,
      rules: checks,
      ...(code === undefined ? {} : { code }),
      ...(message === undefined ? {} : { message }),
    });
  }
  const async = trimmed(rule.async);
  if (async !== undefined) atoms.push({ ...base, rules: [], async });
  const cross = trimmed(rule.cross);
  if (cross !== undefined) {
    const code = trimmed(rule.code) ?? DEFAULT_CROSS_CODE;
    const message = trimmed(rule.message);
    atoms.push({
      ...base,
      rules: [],
      cross,
      ...(code === DEFAULT_CROSS_CODE ? {} : { code }),
      ...(message === undefined ? {} : { message }),
    });
  }
  return atoms;
}

/** Цепочка поля в выражении: `model.price`, `item.qty`; `model.$.x` — ручка, её путь — `x`. */
const CHAIN = /(?<![\w$.])(model|item)\.((?:\$\.)?[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)/g;

/**
 * Источники связи, которых нет в коде, — по полям, которые читает выражение.
 *
 * Выражение пишет человек, и путь в нём — цепочка до первого не-имени: `model.items.length`
 * даст `items.length`. Точнее без схемы не сказать; для проверки циклов и затравки хода этого
 * хватает.
 */
export function inferSources(expr: string | undefined, each: string | undefined): string[] {
  if (expr === undefined) return [];
  const found: string[] = [];
  for (const match of expr.matchAll(CHAIN)) {
    const path = (match[2] as string).replace(/^\$\./, '');
    const source = match[1] === 'item' && each !== undefined ? `${each}.${path}` : path;
    if (!found.includes(source)) found.push(source);
  }
  return found;
}

/** Связи, источники которых печатаются: их источники — из кода, а не из выражения. */
const PRINTED_SOURCES = new Set<BehaviorIntent['kind']>([
  'computeFrom',
  'copyFrom',
  'syncFields',
  'revalidateWhen',
]);

/** Связи, чьи опции печатаются. */
const PRINTED_OPTIONS = new Set<BehaviorIntent['kind']>([
  'copyFrom',
  'syncFields',
  'onChange',
  'enableWhen',
  'disableWhen',
  'resetWhen',
]);

/** Связи над массивом целиком: в `applyEach` они не заворачиваются. */
const WHOLE_ARRAY = new Set<BehaviorIntent['kind']>(['exclusiveFlag', 'aggregateInto']);

function normalizeLink(link: BehaviorIntent): BehaviorIntent {
  const kind = link.kind;
  const target = link.target.trim();
  if (kind === 'exclusiveFlag') {
    const each = trimmed(link.each) ?? target.split('.').slice(0, -1).join('.');
    const flag = target.startsWith(`${each}.`) ? target.slice(each.length + 1) : target;
    return { kind, target: `${each}.${flag}`, each, sources: [] };
  }
  const each = WHOLE_ARRAY.has(kind) ? undefined : trimmed(link.each);
  const given = link.sources.map((source) => source.trim()).filter(Boolean);
  const exprText = trimmed(link.expr);
  const expr = exprText !== undefined && exprText !== DEFAULT_EXPR[kind] ? exprText : undefined;

  let sources: string[];
  if (kind === 'copyFrom') sources = [full(given[0] ?? 'source', each)];
  else if (kind === 'syncFields') sources = [full(given[0] ?? 'other', each)];
  else if (PRINTED_SOURCES.has(kind)) sources = given.map((source) => full(source, each));
  else sources = inferSources(expr, each);

  const fullTarget = kind === 'revalidateWhen' ? (sources[0] ?? '') : full(target, each);
  const options =
    PRINTED_OPTIONS.has(kind) && link.options !== undefined ? { ...link.options } : undefined;
  return {
    kind,
    target: fullTarget,
    ...(each === undefined ? {} : { each }),
    sources,
    ...(expr === undefined ? {} : { expr }),
    ...(options === undefined ? {} : { options }),
  };
}

/** Порядок печати связей: связи формы — по одной, связи строк массива — группой на месте первой. */
function inPrintOrder(links: readonly BehaviorIntent[]): BehaviorIntent[] {
  const parts: (BehaviorIntent | BehaviorIntent[])[] = [];
  const groups = new Map<string, BehaviorIntent[]>();
  for (const link of links) {
    if (link.each === undefined || WHOLE_ARRAY.has(link.kind)) {
      parts.push(link);
      continue;
    }
    const group = groups.get(link.each);
    if (group !== undefined) {
      group.push(link);
      continue;
    }
    const created = [link];
    groups.set(link.each, created);
    parts.push(created);
  }
  return parts.flat();
}

/** Значение пропса: `$expr(литерал)` печатается литералом — и читается им же. */
function propValue(value: unknown): unknown {
  if (typeof value !== 'string' || !value.startsWith('$expr(') || !value.endsWith(')')) {
    return value;
  }
  const expr = value.slice('$expr('.length, -1).trim();
  const literal = literalOf(expr);
  return literal.ok ? literal.value : `$expr(${expr})`;
}

/** Снять общий отступ строк, края — пустыми не оставлять. */
function dedentBody(body: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  while (lines.length > 0 && (lines[0] as string).trim() === '') lines.shift();
  while (lines.length > 0 && (lines[lines.length - 1] as string).trim() === '') lines.pop();
  const pads = lines
    .filter((line) => line.trim() !== '')
    .map((l) => l.length - l.trimStart().length);
  const pad = pads.length === 0 ? 0 : Math.min(...pads);
  return lines.map((line) => line.slice(Math.min(pad, line.length)).trimEnd()).join('\n');
}

function normalizeRender(rule: RenderRuleIntent): RenderRuleIntent {
  switch (rule.kind) {
    case 'hideWhen':
      return { kind: 'hideWhen', selector: rule.selector, condition: rule.condition.trim() };
    case 'onEvent':
      return {
        kind: 'onEvent',
        selector: rule.selector,
        event: rule.event,
        body: dedentBody(rule.body),
        ...(rule.async === true ? { async: true } : {}),
      };
    case 'patchProps':
      return {
        kind: 'patchProps',
        selector: rule.selector,
        props: Object.fromEntries(
          Object.entries(rule.props).map(([key, value]) => [key, propValue(value)])
        ),
      };
  }
}

/** Правила в канонической форме — той, в которой их вернёт чтение напечатанного кода. */
export function normalizeRules(rules: FormRules): FormRules {
  const dataSources = rules.dataSources ?? {};
  return {
    validation: rules.validation.flatMap(validationAtoms),
    behavior: inPrintOrder(rules.behavior.map(normalizeLink)),
    render: rules.render.map(normalizeRender),
    ...(Object.keys(dataSources).length > 0 ? { dataSources: { ...dataSources } } : {}),
  };
}
