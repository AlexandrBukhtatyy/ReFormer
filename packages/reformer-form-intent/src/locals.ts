/**
 * Константы выражения.
 *
 * Выражение правила или формулы в intent — одна строка кода. Подвыражение, которое в нём читается
 * несколько раз, записывается константой — немедленно применённой стрелкой:
 *
 * ```ts
 * ((digits) => digits.length === 10 && digits.charAt(0) !== '0')(String(values.inn ?? ''))
 * ```
 *
 * Это по-прежнему одно выражение: его принимает всё, что читает intent. Печать кода разворачивает
 * его в строки `const digits = …;` и выражение-результат ({@link unfoldLocals}), а чтение кода
 * собирает обратно ({@link foldLocals}) — оба преобразования обратны друг другу.
 *
 * @module form-intent/locals
 */

/** Константа выражения: имя и выражение, которым она задана. */
export interface ExpressionLocal {
  name: string;
  init: string;
}

/** Выражение, разложенное на константы и результат. */
export interface UnfoldedExpression {
  /** Константы в порядке объявления; пусто — выражение констант не объявляет. */
  locals: ExpressionLocal[];
  result: string;
}

/**
 * Имена, занятые в местах печати выражения: значение поля, снимок формы, модель формы и строки,
 * параметры схем. Константу с таким именем строкой `const` не объявить — она закрыла бы то, что
 * читают остальные константы.
 */
export const RESERVED_LOCAL_NAMES: ReadonlySet<string> = new Set([
  'value',
  'values',
  'model',
  'item',
  'schema',
  'cross',
]);

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Знаки, после которых `/` начинает регулярное выражение, а не деление. */
const BEFORE_REGEX = new Set('(,=:[!&|?{};+-*%<>~^'.split(''));

const OPENING: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}' };
const CLOSING = new Set([')', ']', '}']);

/** Индекс за концом строки в кавычках, открытой на `start`. */
function afterString(text: string, start: number): number {
  const quote = text[start];
  let index = start + 1;
  while (index < text.length && text[index] !== quote) index += text[index] === '\\' ? 2 : 1;
  return index + 1;
}

/** Индекс за концом шаблонной строки, открытой на `start`; подстановки `${…}` — со вложенностью. */
function afterTemplate(text: string, start: number): number {
  let index = start + 1;
  while (index < text.length && text[index] !== '`') {
    if (text[index] === '\\') {
      index += 2;
    } else if (text[index] === '$' && text[index + 1] === '{') {
      const close = closeOf(text, index + 1);
      if (close < 0) return text.length;
      index = close + 1;
    } else {
      index += 1;
    }
  }
  return index + 1;
}

/** Индекс за концом регулярного выражения (с флагами), открытого на `start`. */
function afterRegex(text: string, start: number): number {
  let index = start + 1;
  let inClass = false;
  while (index < text.length) {
    const char = text[index];
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) break;
    index += 1;
  }
  index += 1;
  while (index < text.length && /[a-z]/i.test(text[index] as string)) index += 1;
  return index;
}

/**
 * Пройти код посимвольно, пропуская строки, шаблоны и регулярные выражения. `visit` получает знак
 * вне литералов и его индекс; `false` останавливает обход.
 */
function walk(text: string, start: number, visit: (char: string, index: number) => boolean): void {
  let previous = '';
  let index = start;
  while (index < text.length) {
    const char = text[index] as string;
    if (char === "'" || char === '"') {
      index = afterString(text, index);
      previous = char;
      continue;
    }
    if (char === '`') {
      index = afterTemplate(text, index);
      previous = char;
      continue;
    }
    if (char === '/' && (previous === '' || BEFORE_REGEX.has(previous))) {
      index = afterRegex(text, index);
      previous = '/';
      continue;
    }
    if (!visit(char, index)) return;
    if (!/\s/.test(char)) previous = char;
    index += 1;
  }
}

/** Индекс скобки, закрывающей открытую на `open`; `-1` — пары нет. */
function closeOf(text: string, open: number): number {
  const stack: string[] = [];
  let close = -1;
  walk(text, open, (char, index) => {
    const pair = OPENING[char];
    if (pair !== undefined) {
      stack.push(pair);
    } else if (CLOSING.has(char)) {
      if (stack.pop() !== char) return false;
      if (stack.length === 0) {
        close = index;
        return false;
      }
    }
    return true;
  });
  return close;
}

/** Части кода между запятыми верхнего уровня; `null` — скобки не сходятся. */
function splitTop(text: string): string[] | null {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  let balanced = true;
  walk(text, 0, (char, index) => {
    if (OPENING[char] !== undefined) depth += 1;
    else if (CLOSING.has(char)) depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(text.slice(from, index).trim());
      from = index + 1;
    }
    balanced = depth >= 0;
    return balanced;
  });
  if (!balanced || depth !== 0) return null;
  parts.push(text.slice(from).trim());
  return parts;
}

/** Код читает имя `name`: идентификатором, а не свойством и не частью другого имени. */
function reads(code: string, name: string): boolean {
  return new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(code);
}

/** Один уровень: `((a, b) => BODY)(A, B)` → имена, выражения и тело; иначе `null`. */
function appliedArrow(text: string): { locals: ExpressionLocal[]; body: string } | null {
  if (!text.startsWith('(')) return null;
  const close = closeOf(text, 0);
  if (close < 0) return null;
  const call = text.slice(close + 1).trimStart();
  if (!call.startsWith('(') || closeOf(call, 0) !== call.length - 1) return null;

  const arrow = text.slice(1, close).trim();
  if (!arrow.startsWith('(')) return null;
  const paramsEnd = closeOf(arrow, 0);
  if (paramsEnd < 0) return null;
  const names = arrow
    .slice(1, paramsEnd)
    .split(',')
    .map((name) => name.trim());
  const head = /^\s*=>\s*/.exec(arrow.slice(paramsEnd + 1));
  if (head === null || names.some((name) => !IDENTIFIER.test(name))) return null;
  const body = arrow.slice(paramsEnd + 1 + head[0].length).trim();
  // Тело-блок (`=> { … }`) — не выражение: константами такое не раскладывается.
  if (body === '' || body.startsWith('{')) return null;

  const inits = splitTop(call.slice(1, -1));
  if (inits === null || inits.length !== names.length || inits.some((init) => init === '')) {
    return null;
  }
  if (new Set(names).size !== names.length) return null;
  // Аргумент вычисляется снаружи стрелки: имя её параметра в нём — чужое имя. Строками `const`
  // оно стало бы чтением соседней константы.
  if (inits.some((init) => names.some((name) => reads(init, name)))) return null;
  return { locals: names.map((name, index) => ({ name, init: inits[index] as string })), body };
}

/**
 * Разложить выражение на константы и результат: `((a) => ((b) => R)(B))(A)` → `a = A`, `b = B`, `R`.
 *
 * `reserved` — имена, которые в месте печати уже заняты (параметр правила `value`, снимок `values`):
 * константу с таким именем строкой `const` не объявить, и выражение остаётся как было. Так же — при
 * повторе имени на вложенном уровне и когда константа читает имя, объявленное глубже: строками
 * `const` это было бы чтение до объявления.
 */
export function unfoldLocals(
  expr: string,
  reserved: ReadonlySet<string> = RESERVED_LOCAL_NAMES
): UnfoldedExpression {
  const source = expr.trim();
  const locals: ExpressionLocal[] = [];
  let result = source;
  for (;;) {
    const level = appliedArrow(result);
    if (level === null) break;
    const taken = new Set(locals.map((local) => local.name));
    if (level.locals.some((local) => taken.has(local.name) || reserved.has(local.name))) {
      return { locals: [], result: source };
    }
    if (locals.some((outer) => level.locals.some((inner) => reads(outer.init, inner.name)))) {
      return { locals: [], result: source };
    }
    locals.push(...level.locals);
    result = level.body;
  }
  return { locals, result };
}

/**
 * Выражение в записи, которую возвращает чтение кода: константы — уровнями {@link foldLocals}.
 * Выражение без констант (и то, что константами не раскладывается) остаётся как было.
 */
export function canonicalLocals(
  expr: string,
  reserved: ReadonlySet<string> = RESERVED_LOCAL_NAMES
): string {
  const { locals, result } = unfoldLocals(expr, reserved);
  return locals.length === 0 ? expr : foldLocals(locals, result);
}

/**
 * Собрать константы и результат в одно выражение. Соседние константы, которые друг друга не
 * читают, — параметры одной стрелки; константа, читающая предыдущую, — уровень глубже.
 */
export function foldLocals(locals: readonly ExpressionLocal[], result: string): string {
  const levels: ExpressionLocal[][] = [];
  for (const local of locals) {
    const level = levels[levels.length - 1];
    if (level !== undefined && !level.some((earlier) => reads(local.init, earlier.name))) {
      level.push(local);
    } else {
      levels.push([local]);
    }
  }
  let expr = result.trim();
  for (const level of levels.reverse()) {
    // Объектный литерал в теле стрелки читался бы блоком.
    const body = expr.startsWith('{') ? `(${expr})` : expr;
    const names = level.map((local) => local.name).join(', ');
    const inits = level.map((local) => local.init.trim()).join(', ');
    expr = `((${names}) => ${body})(${inits})`;
  }
  return expr;
}

/**
 * Тело стрелки над выражением: само выражение либо блок со строками `const` и `return`.
 *
 * @param wrap - Как записать результат: `(result) => \`(${result}) ? null : …\``.
 * @returns Строки тела: одна — выражение (продолжение строки со стрелкой), несколько — блок, первая
 *   строка — `{`, последняя — `}`; строки между ними — с отступом в два пробела.
 */
export function arrowBodyLines(
  expr: string,
  wrap: (result: string) => string = (result) => result
): string[] {
  const { locals, result } = unfoldLocals(expr);
  if (locals.length === 0) return [wrap(expr)];
  return [
    '{',
    ...locals.map((local) => `  const ${local.name} = ${local.init};`),
    `  return ${wrap(result)};`,
    '}',
  ];
}
