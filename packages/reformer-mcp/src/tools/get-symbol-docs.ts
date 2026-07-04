import { findAllSymbols, type PublicSymbol } from '../utils/symbols-parser.js';
import { KNOWN_PACKAGES } from '../utils/docs-parser.js';

export const getSymbolDocsToolDefinition = {
  name: 'get_symbol_docs',
  description:
    'Get JSDoc documentation for a public symbol of any @reformer/* package. Returns description, signature, parameters, return type, all @example blocks, and source location. Use it to look up exact behavior of a function/class/hook before writing code that uses it.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      symbol: {
        type: 'string',
        description:
          'Symbol name (e.g. "useFormControl", "getReformerForm", "FormArray", "createRenderSchema").',
      },
      package: {
        type: 'string',
        description:
          'Optional package name like "@reformer/cdk". Without it, all known @reformer/* packages are searched.',
        enum: ['*', ...KNOWN_PACKAGES],
      },
    },
    required: ['symbol'],
  },
};

export interface GetSymbolDocsArgs {
  symbol: string;
  package?: string;
}

export async function getSymbolDocsTool(
  args: GetSymbolDocsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const matches = findAllSymbols(args.symbol, args.package ?? '*');
  if (matches.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `Symbol "${args.symbol}" not found in ${args.package && args.package !== '*' ? args.package : 'any @reformer/* package'}.`,
        },
      ],
    };
  }
  let text = renderSymbol(matches[0]);
  // Cross-package name collision (e.g. FormField in both cdk and ui-kit): the
  // first match wins by KNOWN_PACKAGES order, which can hide the variant the
  // consumer actually wants. Surface the alternatives so they can re-query.
  if (matches.length > 1) {
    const others = matches
      .slice(1)
      .map((m) => `\`${m.package}\``)
      .join(', ');
    text +=
      `\n\n> ⚠️ Name collision: \`${args.symbol}\` is also exported by ${others}. ` +
      `This doc is for \`${matches[0].package}\`. To read another variant, pass \`package\` — ` +
      `e.g. \`get_symbol_docs(symbol="${args.symbol}", package="${matches[1].package}")\`.`;
  }
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

function renderSymbol(sym: PublicSymbol): string {
  const lines: string[] = [];
  lines.push(`# ${sym.name} (${sym.kind}) — ${sym.package}`);
  lines.push('');
  if (sym.description) {
    lines.push(sym.description);
    lines.push('');
  }
  lines.push('## Signature');
  lines.push('');
  lines.push('```typescript');
  lines.push(sym.signature);
  lines.push('```');
  lines.push('');

  const params = sym.tags.filter((t) => t.tag === 'param' && t.name);
  if (params.length > 0) {
    lines.push('## Parameters');
    for (const p of params) lines.push(`- \`${p.name}\` — ${p.text}`);
    lines.push('');
  }

  const typeParams = sym.tags.filter((t) => t.tag === 'typeParam' && t.name);
  if (typeParams.length > 0) {
    lines.push('## Type Parameters');
    for (const p of typeParams) lines.push(`- \`${p.name}\` — ${p.text}`);
    lines.push('');
  }

  const ret = sym.tags.find((t) => t.tag === 'returns' || t.tag === 'return');
  if (ret) {
    lines.push(`**Returns:** ${ret.text}`);
    lines.push('');
  }

  const examples = sym.tags.filter((t) => t.tag === 'example');
  if (examples.length > 0) {
    lines.push('## Examples');
    lines.push('');
    for (const ex of examples) {
      lines.push(ex.text);
      lines.push('');
    }
  }

  const deprecated = sym.tags.find((t) => t.tag === 'deprecated');
  if (deprecated) {
    lines.push(`**Deprecated:** ${deprecated.text || '(no message)'}`);
    lines.push('');
  }

  const sees = sym.tags.filter((t) => t.tag === 'see');
  if (sees.length > 0) {
    lines.push('## See also');
    for (const s of sees) lines.push(`- ${s.text}`);
    lines.push('');
  }

  lines.push(`_Source: ${sym.sourcePath}_`);
  return lines.join('\n');
}
