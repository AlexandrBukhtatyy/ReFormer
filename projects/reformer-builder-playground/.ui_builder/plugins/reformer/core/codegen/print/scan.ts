/**
 * Сканирование текста TypeScript без синтаксического разбора: скобки, строки, шаблонные строки,
 * комментарии и регулярные выражения — то, на чём держатся и печать (`./js`), и читатель правил
 * формы из кода модуля (`../rules-code`).
 *
 * Знаки внутри строк, комментариев и литералов регулярных выражений не считаются: запятая в
 * `'a,b'` или скобка в `/[(]/` не разделитель и не скобка.
 *
 * @module plugins/reformer/core/codegen/print/scan
 */

export const OPEN = '([{';
export const CLOSE = ')]}';

/** Знаки, после которых `/` начинает регулярное выражение, а не делит. */
const BEFORE_REGEX = '(,=:[!&|?{};+-*%<>~^';

/**
 * Конец литерала регулярного выражения, начатого по индексу `start` (индекс последнего флага),
 * либо `-1`, если литерал не закрыт в своей строке — тогда `/` считается делением.
 */
function regexEnd(text: string, start: number): number {
  let inClass = false;
  for (let i = start + 1; i < text.length; i += 1) {
    const char = text[i];
    if (char === '\n') return -1;
    if (char === '\\') i += 1;
    else if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) {
      let end = i;
      while (/[a-z]/.test(text[end + 1] ?? '')) end += 1;
      return end;
    }
  }
  return -1;
}

/**
 * Пройти текст, пропуская строки, шаблонные строки, комментарии и регулярные выражения.
 *
 * Регулярное выражение пропускается целиком: запятая или скобка внутри `/a,b/` — не разделитель
 * аргументов, и разрезанный по ней литерал уехал бы в файл испорченным.
 *
 * `visit` получает каждый значимый знак и глубину вложенности скобок ВОКРУГ него (у скобки —
 * глубину снаружи). Возвращает `false`, если скобки не сошлись.
 */
export function scan(
  text: string,
  visit: (char: string, index: number, depth: number) => void,
  onComment?: (depth: number) => void
): boolean {
  let depth = 0;
  let i = 0;
  // Последний значимый знак: по нему `/` отличается от деления.
  let last = '';
  const skipString = (quoteChar: string): boolean => {
    i += 1;
    while (i < text.length) {
      const char = text[i];
      if (char === '\\') i += 2;
      else if (char === quoteChar) return true;
      else if (char === '\n' && quoteChar !== '`') return false;
      else if (quoteChar === '`' && char === '$' && text[i + 1] === '{') {
        // Подстановка: до парной фигурной скобки, со своими вложенными строками.
        let braces = 1;
        i += 2;
        while (i < text.length && braces > 0) {
          const inner = text[i];
          if (inner === '{') braces += 1;
          else if (inner === '}') braces -= 1;
          else if (inner === "'" || inner === '"' || inner === '`') {
            if (!skipString(inner)) return false;
          }
          if (braces > 0) i += 1;
        }
        if (braces > 0) return false;
        i += 1;
      } else i += 1;
    }
    return false;
  };
  while (i < text.length) {
    const char = text[i] as string;
    if (char === "'" || char === '"' || char === '`') {
      const start = i;
      if (!skipString(char)) return false;
      visit(char, start, depth);
      last = char;
      i += 1;
      continue;
    }
    if (char === '/' && text[i + 1] === '/') {
      onComment?.(depth);
      const end = text.indexOf('\n', i);
      i = end < 0 ? text.length : end;
      continue;
    }
    if (char === '/' && text[i + 1] === '*') {
      onComment?.(depth);
      const end = text.indexOf('*/', i + 2);
      if (end < 0) return false;
      i = end + 2;
      continue;
    }
    if (char === '/' && (last === '' || BEFORE_REGEX.includes(last))) {
      const end = regexEnd(text, i);
      if (end > i) {
        visit(char, i, depth);
        last = char;
        i = end + 1;
        continue;
      }
    }
    if (!/\s/.test(char)) last = char;
    if (OPEN.includes(char)) {
      visit(char, i, depth);
      depth += 1;
    } else if (CLOSE.includes(char)) {
      depth -= 1;
      if (depth < 0) return false;
      visit(char, i, depth);
    } else {
      visit(char, i, depth);
    }
    i += 1;
  }
  return depth === 0;
}

/**
 * Есть ли комментарий на верхнем уровне текста — рядом с оператором, а не внутри его скобок.
 *
 * Такой оператор не укладывается заново: комментарий после `;` привязан к своей строке, и
 * перенос оператора унёс бы его в другое место.
 */
export function hasTopComment(text: string): boolean {
  let found = false;
  scan(
    text,
    () => undefined,
    (depth) => {
      if (depth === 0) found = true;
    }
  );
  return found;
}

/** Скобки, строки и комментарии текста сходятся. */
export function isBalanced(text: string): boolean {
  return scan(text, () => undefined);
}

/** Индекс скобки, закрывающей ту, что стоит по индексу `open`; `-1`, если не нашлась. */
export function matchingClose(text: string, open: number): number {
  let found = -1;
  let base = -1;
  const ok = scan(text, (char, index, depth) => {
    if (index === open) base = depth;
    else if (found < 0 && base >= 0 && index > open && depth === base && CLOSE.includes(char)) {
      found = index;
    }
  });
  return ok ? found : -1;
}

/** Разрезать текст по разделителю верхнего уровня. Пустой хвост (висячая запятая) отбрасывается. */
export function splitTop(text: string, separator: string): string[] | null {
  const cuts: number[] = [];
  const ok = scan(text, (char, index, depth) => {
    if (depth === 0 && char === separator) cuts.push(index);
  });
  if (!ok) return null;
  const parts: string[] = [];
  let from = 0;
  for (const cut of cuts) {
    parts.push(text.slice(from, cut));
    from = cut + 1;
  }
  parts.push(text.slice(from));
  const trimmed = parts.map((part) => part.trim());
  if (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') trimmed.pop();
  return trimmed;
}

/** Первое вхождение лексемы на верхнем уровне скобок; `-1`, если нет. */
export function topIndexOf(text: string, token: string): number {
  let found = -1;
  scan(text, (_char, index, depth) => {
    if (found < 0 && depth === 0 && text.startsWith(token, index)) found = index;
  });
  return found;
}

/** Заголовок стрелки: имя либо список параметров в скобках, возможно с типом результата. */
export function isArrowHead(head: string): boolean {
  const text = head.replace(/^async\s+/, '');
  if (/^[A-Za-z_$][\w$]*$/.test(text)) return true;
  if (!text.startsWith('(')) return false;
  const close = matchingClose(text, 0);
  if (close < 0) return false;
  const rest = text.slice(close + 1).trim();
  return rest === '' || rest.startsWith(':');
}

/** У стрелки нет параметров. */
export function hasNoParams(head: string): boolean {
  return /^(?:async\s+)?\(\s*\)$/.test(head);
}

/** Тернарный оператор на верхнем уровне: `?`, не являющийся `?.` и `??`, и `:` за ним. */
export function isConditional(text: string): boolean {
  let question = -1;
  let colon = false;
  scan(text, (char, index, depth) => {
    if (depth !== 0) return;
    if (char === '?' && question < 0) {
      const next = text[index + 1];
      const prev = text[index - 1];
      if (next !== '.' && next !== '?' && prev !== '?') question = index;
    } else if (char === ':' && question >= 0) colon = true;
  });
  return question >= 0 && colon;
}

/** Вызываемое — простой путь: `validate`, `model.items.push`, `defineValidation<Form>`. */
export const SIMPLE_CALLEE = /^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*(?:<[^()]*>)?$/;

/** Текст до списка аргументов похож на вызываемое выражение (цепочка без операторов). */
export function isCalleeLike(callee: string): boolean {
  if (callee === '' || /^(?:await|typeof|void|delete|new|yield)\b/.test(callee)) return false;
  if (/^[!~+-]/.test(callee)) return false;
  // Пробел или бинарный оператор на верхнем уровне — это выражение, а не вызываемое.
  let plain = true;
  scan(callee, (char, _index, depth) => {
    if (depth === 0 && (/\s/.test(char) || '+*/%=&|^~,'.includes(char))) plain = false;
  });
  return plain && /[\w$)\]>]$/.test(callee);
}

/** Индекс скобки, открывающей список аргументов, который закрывается последним знаком текста. */
export function trailingCallOpen(text: string): number {
  if (!text.endsWith(')')) return -1;
  let open = -1;
  const ok = scan(text, (char, index, depth) => {
    if (depth === 0 && char === '(') open = index;
  });
  return ok ? open : -1;
}

/** Целый текст — один строковый литерал в одинарных или двойных кавычках. */
export function wholeString(text: string): string | null {
  const first = text[0];
  if ((first !== "'" && first !== '"') || text.length < 2 || !text.endsWith(first)) return null;
  for (let i = 1; i < text.length - 1; i += 1) {
    if (text[i] === '\\') i += 1;
    else if (text[i] === first || text[i] === '\n') return null;
  }
  // Последний знак экранирован — литерал не закрыт.
  let slashes = 0;
  for (let i = text.length - 2; i > 0 && text[i] === '\\'; i -= 1) slashes += 1;
  return slashes % 2 === 0 ? text.slice(1, -1) : null;
}
