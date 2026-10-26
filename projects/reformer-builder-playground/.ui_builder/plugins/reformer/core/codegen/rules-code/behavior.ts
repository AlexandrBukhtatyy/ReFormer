/**
 * Связи и правила узлов из `behavior/index.ts` модуля.
 *
 * Области, в которых лежат правила, — те, что печатает генерация (`../view/behavior`):
 *
 * - функция `export function behaviorRules(scope): void { … }` — область формы;
 * - `const <имя> = defineFormBehavior<T>((…) => { … })` — область строки массива или части.
 *   Объявление поведения формы над функцией (`defineFormBehavior<T>(behaviorRules)`) — каркас.
 *
 * В области узнаются:
 *
 * - двенадцать видов связей — ровно в той записи, что у `renderBehavior` `@reformer/mcp`; связи
 *   строк массива — внутри `applyEach(model.$.массив, defineFormBehavior(({ model: item }) => …))`;
 * - правила узлов: `hideWhen(schema.node('s'), () => условие)`,
 *   `schema.node('s').patchProps({ … })`, `onComponentEvent(schema.node('s'), 'событие', …)`;
 * - каркас, а не правила: `apply(…, <поведение части>)` и `applyEach(…, <поведение строки>)`.
 *
 * Значения по умолчанию, которые печатает генерация за отсутствующее выражение (`() => undefined`
 * у `compute`, `() => true` у `enableWhen`…), читаются обратно отсутствием выражения.
 *
 * @module plugins/reformer/core/codegen/rules-code/behavior
 */

import type { BehaviorIntent, RenderRuleIntent } from '../../form-model/rules';
import {
  arrayItems,
  arrowOf,
  callOf,
  closeOf,
  dedent,
  lineAt,
  literalOf,
  objectProperties,
  statementsOf,
  stringOf,
  withoutComments,
  type Statement,
} from './syntax';
import type { ForeignCode } from './validation';

/** Что нашлось в файле поведения. */
export interface BehaviorFileRead {
  readonly behavior: BehaviorIntent[];
  readonly render: RenderRuleIntent[];
  readonly foreign: ForeignCode[];
}

type Kind = BehaviorIntent['kind'];

/** Выражение, которое генерация печатает за отсутствующее, — по виду связи. */
export const DEFAULT_EXPR: Partial<Record<Kind, string>> = {
  compute: 'undefined',
  computeFrom: 'undefined',
  onChange: '/* эффект */',
  enableWhen: 'true',
  disableWhen: 'true',
  resetWhen: 'false',
  transformValue: 'value',
  revalidateWhen: '/* перепроверка */',
  aggregateInto: '[]',
};

const KINDS: ReadonlySet<string> = new Set<Kind>([
  'compute',
  'computeFrom',
  'copyFrom',
  'syncFields',
  'onChange',
  'enableWhen',
  'disableWhen',
  'resetWhen',
  'transformValue',
  'revalidateWhen',
  'exclusiveFlag',
  'aggregateInto',
]);

const PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

/** Область связей: форма (`model`) либо строка массива (`item`, путь массива). */
interface Scope {
  readonly each?: string;
}

/** Ручка поля → путь в модели формы; `null` — не ручка этой области. */
function pathOf(ref: string, scope: Scope): string | null {
  const t = ref.trim();
  const prefix = scope.each === undefined ? 'model.$.' : 'item.$.';
  if (!t.startsWith(prefix)) return null;
  const path = t.slice(prefix.length);
  if (!PATH.test(path)) return null;
  return scope.each === undefined ? path : `${scope.each}.${path}`;
}

/** Выражение стрелки без блока с ожидаемыми параметрами; иначе `null`. */
function expressionOf(text: string, params: string): string | null {
  const arrow = arrowOf(text);
  if (arrow === null || arrow.block || arrow.async) return null;
  if (arrow.params.replace(/\s+/g, '') !== params.replace(/\s+/g, '')) return null;
  return arrow.body.trim();
}

/** Тело стрелки-блока с ожидаемыми параметрами; иначе `null`. */
function blockBodyOf(text: string, params: string): string | null {
  const arrow = arrowOf(text);
  if (arrow === null || !arrow.block || arrow.async) return null;
  if (arrow.params.replace(/\s+/g, '') !== params.replace(/\s+/g, '')) return null;
  return dedent(arrow.body);
}

/** Опции связи — литерал объекта; `undefined` — их нет; `null` — не литерал. */
function optionsOf(text: string | undefined): Record<string, unknown> | undefined | null {
  if (text === undefined) return undefined;
  const read = literalOf(text);
  if (
    !read.ok ||
    read.value === null ||
    typeof read.value !== 'object' ||
    Array.isArray(read.value)
  ) {
    return null;
  }
  return read.value as Record<string, unknown>;
}

/** Связь с обёрткой области и выражением, если оно не по умолчанию. */
function link(
  kind: Kind,
  target: string,
  sources: readonly string[],
  scope: Scope,
  expr: string | undefined,
  options?: Record<string, unknown>
): BehaviorIntent {
  const own = expr !== undefined && expr !== DEFAULT_EXPR[kind] ? expr : undefined;
  return {
    kind,
    target,
    ...(scope.each === undefined ? {} : { each: scope.each }),
    sources: [...sources],
    ...(own === undefined ? {} : { expr: own }),
    ...(options === undefined ? {} : { options }),
  };
}

/** Прочитать одну связь; `null` — оператор не связь (либо связь в незнакомой записи). */
function linkOf(callee: string, args: readonly string[], scope: Scope): BehaviorIntent | null {
  if (!KINDS.has(callee)) return null;
  const kind = callee as Kind;
  const [a = '', b = '', c] = args;
  switch (kind) {
    case 'compute': {
      const target = pathOf(a, scope);
      const expr = expressionOf(b, '()');
      if (target === null || expr === null || args.length !== 2) return null;
      return link(kind, target, [], scope, expr);
    }
    case 'computeFrom': {
      const sources = arrayItems(a)?.map((item) => pathOf(item, scope));
      const target = pathOf(b, scope);
      const arrow = c === undefined ? null : arrowOf(c);
      if (sources === undefined || sources.some((s) => s === null) || target === null) return null;
      if (arrow === null || arrow.block || arrow.async || args.length !== 3) return null;
      return link(kind, target, sources as string[], scope, arrow.body.trim());
    }
    case 'copyFrom':
    case 'syncFields': {
      const [targetRef, sourceRef] = kind === 'copyFrom' ? [b, a] : [a, b];
      const target = pathOf(targetRef, scope);
      const source = pathOf(sourceRef, scope);
      const options = optionsOf(c);
      if (target === null || source === null || options === null || args.length > 3) return null;
      return link(kind, target, [source], scope, undefined, options);
    }
    case 'onChange': {
      const target = pathOf(a, scope);
      const body = blockBodyOf(b, '(value)');
      const options = optionsOf(c);
      if (target === null || body === null || options === null || args.length > 3) return null;
      return link(kind, target, [], scope, body.trim(), options);
    }
    case 'enableWhen':
    case 'disableWhen':
    case 'resetWhen': {
      const target = pathOf(a, scope);
      const expr = expressionOf(b, '()');
      const options = optionsOf(c);
      if (target === null || expr === null || options === null || args.length > 3) return null;
      return link(kind, target, [], scope, expr, options);
    }
    case 'transformValue': {
      const target = pathOf(a, scope);
      const expr = expressionOf(b, '(value)');
      if (target === null || expr === null || args.length !== 2) return null;
      return link(kind, target, [], scope, expr);
    }
    case 'revalidateWhen': {
      const sources = arrayItems(a)?.map((item) => pathOf(item, scope));
      const body = blockBodyOf(b, '()');
      if (sources === undefined || sources.some((s) => s === null) || body === null) return null;
      if (args.length !== 2) return null;
      // Цели у перепроверки в коде нет: ею считается первый источник.
      const list = sources as string[];
      return link(kind, list[0] ?? '', list, scope, body.trim());
    }
    case 'exclusiveFlag': {
      if (scope.each !== undefined || args.length !== 2) return null;
      const array = pathOf(a, scope);
      const flag = expressionOf(b, '(row)');
      if (array === null || flag === null || !flag.startsWith('row.$.')) return null;
      const field = flag.slice('row.$.'.length);
      if (!PATH.test(field)) return null;
      return { kind, target: `${array}.${field}`, each: array, sources: [] };
    }
    case 'aggregateInto': {
      if (scope.each !== undefined || args.length !== 2) return null;
      const target = pathOf(a, scope);
      const expr = expressionOf(b, '(rows)');
      if (target === null || expr === null) return null;
      return link(kind, target, [], scope, expr);
    }
  }
}

/** Селектор узла из `schema.node('s')`; иначе `null`. */
function selectorOf(text: string): string | null {
  const call = callOf(text);
  if (call === null || call.callee !== 'schema.node' || call.args.length !== 1) return null;
  return stringOf(call.args[0] as string);
}

/** Значение пропса: литерал — значением, остальное — выражением `$expr(…)`. */
function propValue(text: string): unknown {
  const read = literalOf(text);
  return read.ok ? read.value : `$expr(${text.trim()})`;
}

/** Прочитать одно правило узла; `null` — оператор не правило узла. */
function renderOf(call: { callee: string; args: readonly string[] }): RenderRuleIntent | null {
  const [a = '', b = '', c = ''] = call.args;
  if (call.callee === 'hideWhen' && call.args.length === 2) {
    const selector = selectorOf(a);
    const condition = expressionOf(b, '()');
    return selector === null || condition === null
      ? null
      : { kind: 'hideWhen', selector, condition };
  }
  if (call.callee === 'onComponentEvent' && call.args.length === 3) {
    const selector = selectorOf(a);
    const event = stringOf(b);
    const arrow = arrowOf(c);
    if (selector === null || event === null || arrow === null || !arrow.block) return null;
    if (arrow.params.replace(/\s+/g, '') !== '(...args:unknown[])') return null;
    const lines = dedent(arrow.body).split('\n');
    // `void args;` генерация ставит сама (`noUnusedParameters`) — в правиле его нет.
    if ((lines[0] ?? '').trim() === 'void args;') lines.shift();
    return {
      kind: 'onEvent',
      selector,
      event,
      body: dedent(lines.join('\n')),
      ...(arrow.async ? { async: true } : {}),
    };
  }
  const patch = /^(.*)\.patchProps$/s.exec(call.callee);
  if (patch !== null && call.args.length === 1) {
    const selector = selectorOf(patch[1] as string);
    const props = objectProperties(a);
    if (selector === null || props === null || props.some((p) => p.value === null)) return null;
    return {
      kind: 'patchProps',
      selector,
      props: Object.fromEntries(props.map((p) => [p.key, propValue(p.value as string)])),
    };
  }
  return null;
}

/** Ссылка на поведение области по имени: `applyEach(model.$.x, row)`, `apply([…], part)`. */
function isScopeLink(call: { callee: string; args: readonly string[] }): boolean {
  if ((call.callee !== 'apply' && call.callee !== 'applyEach') || call.args.length !== 2) {
    return false;
  }
  return /^[A-Za-z_$][\w$]*$/.test((call.args[1] as string).trim());
}

/** Прочитать операторы одной области. */
function readScope(
  statements: readonly Statement[],
  scope: Scope,
  file: string,
  out: BehaviorFileRead
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
  out: BehaviorFileRead
): boolean {
  const call = callOf(statement.text);
  if (call === null) return false;
  const linked = linkOf(call.callee, call.args, scope);
  if (linked !== null) {
    out.behavior.push(linked);
    return true;
  }
  const rule = renderOf(call);
  if (rule !== null) {
    out.render.push(rule);
    return true;
  }
  if (isScopeLink(call)) return true;
  // Связи строк массива: `applyEach(model.$.x, defineFormBehavior(({ model: item }) => { … }))`.
  if (call.callee === 'applyEach' && scope.each === undefined && call.args.length === 2) {
    const array = pathOf(call.args[0] as string, scope);
    const inner = callOf(call.args[1] as string);
    if (array === null || inner === null || inner.callee !== 'defineFormBehavior') return false;
    const body = blockBodyOf(inner.args[0] ?? '', '({ model: item })');
    if (body === null || inner.args.length !== 1) return false;
    const statements = statementsOf(body, 0, body);
    if (statements === null) return false;
    const rows: BehaviorFileRead = { behavior: [], render: [], foreign: [] };
    readScope(statements, { each: array }, file, rows);
    if (rows.foreign.length > 0 || rows.render.length > 0) return false;
    out.behavior.push(...rows.behavior);
    return true;
  }
  return false;
}

/** Тело области по индексу открывающей фигурной скобки; иначе `null`. */
function bodyAt(text: string, brace: number): { body: string; offset: number } | null {
  if (brace < 0 || text[brace] !== '{') return null;
  const close = closeOf(text, brace);
  return close < 0 ? null : { body: text.slice(brace + 1, close), offset: brace + 1 };
}

const ROOT_FUNCTION = /export\s+function\s+behaviorRules\s*\(/g;
const SCOPE_CONST = /(?:export\s+)?const\s+[A-Za-z_$][\w$]*\s*(?::[^=]+)?=\s*defineFormBehavior\b/g;

/** Прочитать связи и правила узлов из текста файла поведения. */
export function readBehaviorFile(text: string): BehaviorFileRead {
  const out: BehaviorFileRead = { behavior: [], render: [], foreign: [] };
  const bodies: { body: string; offset: number }[] = [];
  // Объявления ищутся вне комментариев: заготовка несёт закомментированный пример.
  const code = withoutComments(text);

  for (const match of code.matchAll(ROOT_FUNCTION)) {
    const open = (match.index ?? 0) + match[0].length - 1;
    const close = closeOf(text, open);
    const found = close < 0 ? null : bodyAt(text, text.indexOf('{', close));
    if (found === null) out.foreign.push({ text: match[0], line: lineAt(text, match.index ?? 0) });
    else bodies.push(found);
  }
  for (const match of code.matchAll(SCOPE_CONST)) {
    const open = text.indexOf('(', (match.index ?? 0) + match[0].length);
    const close = open < 0 ? -1 : closeOf(text, open);
    if (close < 0) continue;
    const inner = text.slice(open + 1, close);
    // `defineFormBehavior<T>(behaviorRules)` — объявление поведения формы над функцией.
    if (/^\s*[A-Za-z_$][\w$]*\s*$/.test(inner)) continue;
    const arrow = arrowOf(inner);
    if (arrow === null || !arrow.block) {
      out.foreign.push({ text: match[0], line: lineAt(text, match.index ?? 0) });
      continue;
    }
    const at = text.indexOf(arrow.body, open);
    bodies.push({ body: arrow.body, offset: Math.max(0, at) });
  }

  // Порядок файла: правила читаются так, как их видит человек сверху вниз.
  for (const { body, offset } of bodies.sort((a, b) => a.offset - b.offset)) {
    const statements = statementsOf(body, offset, text);
    if (statements === null) {
      out.foreign.push({ text: body.trim().split('\n')[0] ?? '', line: lineAt(text, offset) });
      continue;
    }
    readScope(statements, {}, text, out);
  }
  return out;
}
