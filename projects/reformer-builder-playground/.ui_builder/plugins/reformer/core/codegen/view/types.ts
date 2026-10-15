/**
 * Тип формы, отрисованный из дерева типов, — уже строкой.
 *
 * ## Почему рекурсия осталась в TypeScript
 *
 * Она алгоритмическая: узел бывает листом, массивом или объектом, и отступ вложенного уровня
 * считается арифметикой глубины. Шаблон это выразил бы рекурсивным включением себя в себя, где
 * глубину пришлось бы протаскивать параметром, — то есть тем же алгоритмом, но без типов,
 * без тестов и с сообщением об ошибке вида «слишком глубокая рекурсия».
 *
 * Правило раздела соблюдено: РЕШЕНИЕ «как выглядит тип» принимается здесь, шаблон получает
 * готовую строку и ставит её в объявление.
 *
 * ## Раскладка — под ширину строки
 *
 * Тип листа со списком опций — объединение строковых литералов, и длина его не ограничена: у
 * списка из десяти значений оно длиннее строки. Поэтому тип собирается документом раскладки
 * (`../print/doc`) в тех же формах, какими его печатает prettier: объединение, не поместившись,
 * уходит под имя поля столбиком `| 'a'`, а внутри `Array<…>` рвётся список аргументов типа.
 *
 * @module plugins/reformer/core/codegen/view/types
 */

import type { TsNode, TsObject } from '../collect';
import type { EmitContext } from '../context';
import {
  group,
  hardline,
  ifBreak,
  indent,
  join,
  line,
  printDoc,
  softline,
  type Doc,
} from '../print/doc';
import { propertyKey } from '../print/js';

/**
 * Разрезать текст типа по `|` верхнего уровня: вне кавычек и вне `<…>`.
 *
 * Значение опции — произвольная строка, и `|` либо `>` внутри литерала границей не являются.
 */
function splitUnion(type: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoteChar = '';
  let from = 0;
  for (let i = 0; i < type.length; i += 1) {
    const char = type[i] as string;
    if (quoteChar !== '') {
      if (char === '\\') i += 1;
      else if (char === quoteChar) quoteChar = '';
      continue;
    }
    if (char === "'" || char === '"') quoteChar = char;
    else if (char === '<') depth += 1;
    else if (char === '>') depth -= 1;
    else if (char === '|' && depth === 0) {
      parts.push(type.slice(from, i).trim());
      from = i + 1;
    }
  }
  parts.push(type.slice(from).trim());
  return parts;
}

/** Объединение: в строку через ` | ` либо столбиком с ведущей чертой. */
function unionDoc(members: readonly string[], indented: boolean): Doc {
  const printed = members.map((member) => indent(memberDoc(member)));
  if (printed.length === 1) return memberDoc(members[0] as string);
  const code: Doc = [ifBreak([indented ? line : '', '| ']), join([line, '| '], printed)];
  return group(indented ? indent(code) : code);
}

/** Член объединения: `Array<…>` рвётся по аргументу типа, остальное — текст как есть. */
function memberDoc(member: string): Doc {
  const match = /^Array<(.*)>$/s.exec(member);
  if (match === null) return member;
  const inner = splitUnion(match[1] as string);
  // Единственный простой аргумент остаётся в скобках как есть — рвать там нечего.
  if (inner.length === 1) return member;
  return ['Array', group(['<', indent([softline, unionDoc(inner, false)]), softline, '>'])];
}

function render(node: TsNode): Doc {
  if (node.t === 'leaf') return unionDoc(splitUnion(node.ts), true);
  if (node.t === 'arr') return ['Array<', render(node.elem), '>'];
  const keys = Object.keys(node.fields);
  if (keys.length === 0) return 'Record<string, unknown>';
  const members = keys.map(
    (key): Doc => [propertyKey(key), ': ', render(node.fields[key] as TsNode), ';']
  );
  return ['{', indent([hardline, join(hardline, members)]), hardline, '}'];
}

/** Тип формы глазами шаблона. */
export interface TypesView {
  /** Тело объявления типа: `{ … }`, `Record<string, unknown>` или лист. */
  readonly text: string;
}

export function typesView(ctx: EmitContext): TypesView {
  const root: TsObject = ctx.collected.root;
  return { text: printDoc(render(root)) };
}
