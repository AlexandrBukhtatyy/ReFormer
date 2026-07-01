/**
 * Tool `list_symbols` — перечислить публичные символы @reformer/* пакетов,
 * опционально фильтруя по виду (function/class/interface/type/const/enum) и
 * пакету. Даёт агенту обзор доступного API без угадывания имён
 * (например, «все функции @reformer/core» покрывают валидаторы и behaviors).
 * После — `get_symbol_docs <name>` за полной сигнатурой и примером.
 */

import { getPublicSymbols, type PublicSymbol } from '../utils/symbols-parser.js';
import { KNOWN_PACKAGES } from '../utils/docs-parser.js';

const KINDS = ['function', 'class', 'interface', 'type', 'const', 'enum'] as const;
type SymbolKind = (typeof KINDS)[number];

export const listSymbolsToolDefinition = {
  name: 'list_symbols',
  description:
    'List public symbols of @reformer/* packages, optionally filtered by kind (function/class/interface/type/const/enum) and package. Use it to discover the API surface — e.g. list all functions of @reformer/core to see every validator and behavior, or all types of @reformer/renderer-json. Then call get_symbol_docs for a specific name to get its full signature and @example.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      kind: {
        type: 'string',
        description: 'Filter by declaration kind. Omit to include all kinds.',
        enum: [...KINDS],
      },
      package: {
        type: 'string',
        description:
          'Restrict to one package (e.g. "@reformer/core"). Omit or "*" to list across all known @reformer/* packages.',
        enum: ['*', ...KNOWN_PACKAGES],
      },
    },
    required: [],
  },
};

export interface ListSymbolsArgs {
  kind?: SymbolKind;
  package?: string;
}

export async function listSymbolsTool(
  args: ListSymbolsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const targets = args.package && args.package !== '*' ? [args.package] : [...KNOWN_PACKAGES];

  const sections: string[] = [];
  let total = 0;

  for (const pkg of targets) {
    let symbols = getPublicSymbols(pkg);
    if (args.kind) symbols = symbols.filter((s) => s.kind === args.kind);
    if (symbols.length === 0) continue;
    total += symbols.length;
    sections.push(`## ${pkg} (${symbols.length})\n\n` + symbols.map(renderRow).join('\n'));
  }

  const kindLabel = args.kind ? ` of kind \`${args.kind}\`` : '';
  if (total === 0) {
    return text(
      `No public symbols${kindLabel} found in ${
        args.package && args.package !== '*' ? args.package : 'any @reformer/* package'
      }.`
    );
  }

  return text(
    `# Public symbols${kindLabel} (${total})\n\n` +
      sections.join('\n\n') +
      `\n\n_Use \`get_symbol_docs <name>\` for full signature and examples._`
  );
}

function renderRow(sym: PublicSymbol): string {
  const firstLine = sym.description.split('\n')[0].trim();
  const desc = firstLine ? ` — ${firstLine}` : '';
  return `- \`${sym.name}\` (${sym.kind})${desc}`;
}

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}
