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
 * @module lib/codegen/view/types
 */

import type { TsNode, TsObject } from '../collect';
import type { EmitContext } from '../context';

/** Ключ объекта: идентификатором, если можно, иначе строкой в кавычках. */
function safeKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function render(node: TsNode, indent: number): string {
  if (node.t === 'leaf') return node.ts;
  if (node.t === 'arr') return `Array<${render(node.elem, indent)}>`;
  const keys = Object.keys(node.fields);
  if (keys.length === 0) return 'Record<string, unknown>';
  const pad = '  '.repeat(indent + 1);
  const close = '  '.repeat(indent);
  const lines = keys.map((k) => `${pad}${safeKey(k)}: ${render(node.fields[k], indent + 1)};`);
  return `{\n${lines.join('\n')}\n${close}}`;
}

/** Тип формы глазами шаблона. */
export interface TypesView {
  /** Тело объявления типа: `{ … }`, `Record<string, unknown>` или лист. */
  readonly text: string;
}

export function typesView(ctx: EmitContext): TypesView {
  const root: TsObject = ctx.collected.root;
  return { text: render(root, 0) };
}
