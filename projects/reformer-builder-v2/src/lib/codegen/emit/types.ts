/**
 * Эмиттер `types.ts` — тип формы из дерева типов. Вложенные объекты инлайн, массивы `Array<…>`,
 * список с известными опциями — union строковых литералов.
 *
 * @module reformer-builder/lib/codegen/emit/types
 */

import type { TsNode, TsObject } from '../collect';
import type { EmitContext } from '../context';

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

export function emitTypes(ctx: EmitContext): string {
  const root: TsObject = ctx.collected.root;
  return `// types.ts — тип формы (выведен из схемы и мока). Регенерируется.

export type SelectOption = { value: string; label: string };

export type ${ctx.names.TypeName} = ${render(root, 0)};
`;
}
