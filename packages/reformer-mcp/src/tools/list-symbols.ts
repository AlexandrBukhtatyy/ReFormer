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
    'List public symbols of @reformer/* packages, optionally filtered by kind (function/class/interface/type/const/enum), package, and a case-insensitive substring of the name (`nameContains`). Without filters the full surface is ~800+ symbols — pass `nameContains` (e.g. "validate", "FileUpload", "Async") or a `kind`/`package` to narrow it. Use it to discover the API surface, then call get_symbol_docs for a specific name to get its full signature and @example.',
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
      nameContains: {
        type: 'string',
        description:
          'Case-insensitive substring the symbol name must contain (e.g. "validate", "FileUpload"). Strongly recommended: the unfiltered list is 800+ symbols in one response.',
      },
    },
    required: [],
  },
};

export interface ListSymbolsArgs {
  kind?: SymbolKind;
  package?: string;
  nameContains?: string;
}

export async function listSymbolsTool(
  args: ListSymbolsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const targets = args.package && args.package !== '*' ? [args.package] : [...KNOWN_PACKAGES];
  const needle =
    typeof args.nameContains === 'string' && args.nameContains.trim()
      ? args.nameContains.trim().toLowerCase()
      : null;

  const sections: string[] = [];
  let total = 0;

  for (const pkg of targets) {
    let symbols = getPublicSymbols(pkg);
    if (args.kind) symbols = symbols.filter((s) => s.kind === args.kind);
    if (needle) symbols = symbols.filter((s) => s.name.toLowerCase().includes(needle));
    if (symbols.length === 0) continue;
    total += symbols.length;
    sections.push(`## ${pkg} (${symbols.length})\n\n` + symbols.map(renderRow).join('\n'));
  }

  const kindLabel = args.kind ? ` of kind \`${args.kind}\`` : '';
  const nameLabel = needle ? ` matching \`${args.nameContains!.trim()}\`` : '';
  if (total === 0) {
    return text(
      `No public symbols${kindLabel}${nameLabel} found in ${
        args.package && args.package !== '*' ? args.package : 'any @reformer/* package'
      }.`
    );
  }

  return text(
    `# Public symbols${kindLabel}${nameLabel} (${total})\n\n` +
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
