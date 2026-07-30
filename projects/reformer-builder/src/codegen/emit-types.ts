/**
 * Эмиттер `types.ts` — тип формы из type-дерева ({@link Collected}). Вложенные объекты — инлайн,
 * массивы — `Array<…>`, select с известными опциями — string-union.
 *
 * @module reformer-builder/codegen/emit-types
 */

import type { Collected, TsNode } from './collect';
import type { Names } from './naming';

function safeKey(k: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
}

function render(node: TsNode, indent: number): string {
  if (node.t === 'leaf') return node.ts;
  if (node.t === 'arr') return `Array<${render(node.elem, indent)}>`;
  const keys = Object.keys(node.fields);
  if (!keys.length) return 'Record<string, unknown>';
  const pad = '  '.repeat(indent + 1);
  const close = '  '.repeat(indent);
  const lines = keys.map((k) => `${pad}${safeKey(k)}: ${render(node.fields[k], indent + 1)};`);
  return `{\n${lines.join('\n')}\n${close}}`;
}

export function emitTypes(c: Collected, n: Names): string {
  return `// types.ts — тип формы (выведен из схемы + мока). Регенерируется.

export type SelectOption = { value: string; label: string };

export type ${n.TypeName} = ${render(c.root, 0)};
`;
}
