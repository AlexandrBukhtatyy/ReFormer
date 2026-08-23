/**
 * Tool `list_symbols` — перечислить публичные символы @reformer/* пакетов,
 * опционально фильтруя по виду (function/class/interface/type/const/enum) и
 * пакету. Даёт агенту обзор доступного API без угадывания имён
 * (например, «все функции @reformer/core» покрывают валидаторы и behaviors).
 * После — `get_symbol_docs <name>` за полной сигнатурой и примером.
 */

import type { PublicSymbol } from '../index/public-symbol.js';
import { publicSymbols, indexCoverageWarning } from '../index/symbols.js';
import { KNOWN_PACKAGES, normalizePackage } from '../docs/packages.js';
import type { Knowledge } from '../knowledge.js';

const KINDS = ['function', 'class', 'interface', 'type', 'const', 'enum'] as const;
type SymbolKind = (typeof KINDS)[number];

export const listSymbolsToolDefinition = {
  name: 'list_symbols',
  description:
    'List public symbols, filtered by kind, package or nameContains. Output is capped — narrow the filter. To find API by TASK rather than by name, choose_api and search_docs answer instead of listing.',
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
          'Restrict to one package: core | cdk | ui-kit | renderer-react | renderer-json (full name or short). Omit for all.',
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
  args: ListSymbolsArgs,
  k: Knowledge
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const only = normalizePackage(args.package);
  const targets = only ? [only] : [...KNOWN_PACKAGES];
  const needle =
    typeof args.nameContains === 'string' && args.nameContains.trim()
      ? args.nameContains.trim().toLowerCase()
      : null;

  const sections: string[] = [];
  let total = 0;
  let listed = 0;
  let capped = false;

  for (const pkg of targets) {
    let symbols = await publicSymbols(k, pkg);
    if (args.kind) symbols = symbols.filter((s) => s.kind === args.kind);
    if (needle) symbols = symbols.filter((s) => s.name.toLowerCase().includes(needle));
    if (symbols.length === 0) continue;
    total += symbols.length;

    // Потолок на выдачу. Замерено: `list_symbols({})` отдавал 82 364 символа ≈ 20 591 токен —
    // крупнейший единичный ответ во всём сервере, дороже подключения к нему. Описание честно
    // предупреждало «800+ symbols», но предупреждение не мешает модели вызвать без фильтра.
    // Показываем префикс и говорим, сколько осталось и чем сузить.
    const room = Math.max(0, MAX_LISTED_SYMBOLS - listed);
    const shown = symbols.slice(0, room);
    if (shown.length < symbols.length) capped = true;
    listed += shown.length;
    if (shown.length === 0) continue;
    sections.push(
      `## ${pkg} (${shown.length}${shown.length < symbols.length ? ` из ${symbols.length}` : ''})\n\n` +
        shown.map(renderRow).join('\n')
    );
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

  // Обрезка ВСЕГДА видима и всегда говорит, чем сузить: молча усечённый список агент примет
  // за полный и решит, что символа не существует.
  const cappedNote = capped
    ? `\n\n> ⚠️ Показано ${listed} из ${total}. Сузьте выдачу: \`nameContains\` (подстрока имени), ` +
      `\`kind\` (function/class/interface/type/const/enum) или \`package\`. ` +
      `Если ищете API под задачу, а не по имени — \`choose_api\` или \`search_docs\` дадут ответ, а не список.`
    : '';

  return text(
    `# Public symbols${kindLabel}${nameLabel} (${total})\n\n` +
      sections.join('\n\n') +
      cappedNote +
      `\n\n_Use \`get_symbol_docs <name>\` for full signature and examples._` +
      // Пакет без индекса даёт неполный список — агент не должен решить, что символа нет.
      indexCoverageWarning(k)
  );
}

/**
 * Сколько символов помещается в один ответ. 120 строк — около 2 000 токенов: обзор
 * поверхности такой размер даёт, а бюджет диалога не съедает.
 */
const MAX_LISTED_SYMBOLS = 120;

function renderRow(sym: PublicSymbol): string {
  const firstLine = sym.description.split('\n')[0].trim();
  const desc = firstLine ? ` — ${firstLine}` : '';
  return `- \`${sym.name}\` (${sym.kind})${desc}`;
}

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}
