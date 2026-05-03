import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { KNOWN_PACKAGES, type ReformerPackage, getSection } from '../utils/docs-parser.js';
import { findSymbol, getPublicSymbols } from '../utils/symbols-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const findRecipeToolDefinition = {
  name: 'find_recipe',
  description:
    'Find a recipe / how-to in the @reformer/* library docs (docs/llms/) or fall back to a JSDoc @example of a public symbol. Use it to look up a worked example for a topic before writing code: scenario keywords like "wizard", "form-array", "copy-from", "json-schema", "submit-and-reset" map to docs files; symbol names like "useFormControl" or "computeFrom" return their JSDoc example. Sources are limited to installed @reformer/* packages — no monorepo or playground assumptions.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      topic: {
        type: 'string',
        description:
          'Topic keyword. Matches docs/llms/ filenames (with or without NN- prefix), `## ` section headings inside those files, or a public symbol name across all @reformer/* packages.',
      },
      package: {
        type: 'string',
        description:
          'Optional package name like "@reformer/cdk". Without it, all known @reformer/* packages are searched.',
        enum: ['*', ...KNOWN_PACKAGES],
      },
    },
    required: ['topic'],
  },
};

export interface FindRecipeArgs {
  topic: string;
  package?: string;
}

export async function findRecipeTool(
  args: FindRecipeArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const topic = args.topic.trim();
  if (!topic) {
    return text('Argument "topic" is required and must be non-empty.');
  }
  const targets: ReformerPackage[] =
    args.package && args.package !== '*' ? [args.package as ReformerPackage] : [...KNOWN_PACKAGES];

  // 1. Match by docs/llms/ filename (with or without NN- prefix).
  for (const pkg of targets) {
    const file = findDocFile(pkg, topic);
    if (file) {
      const body = readFileSync(file.absPath, 'utf-8');
      return text(
        `# Recipe: ${file.title}\n\n` +
          `**Source:** ${pkg} · \`docs/llms/${file.fileName}\`\n\n` +
          body.trim()
      );
    }
  }

  // 2. Match by `## ` section heading.
  for (const pkg of targets) {
    const section = getSection(topic, pkg);
    if (!section.startsWith('Section "') /* "...not found" sentinel */) {
      return text(
        `# Recipe section: ${topic}\n\n` +
          `**Source:** ${pkg} · matched by section heading\n\n` +
          section
      );
    }
  }

  // 3. Match by public symbol — return its @example block(s).
  const sym = findSymbol(topic, args.package ?? '*');
  if (sym) {
    const examples = sym.tags.filter((t) => t.tag === 'example');
    if (examples.length > 0) {
      return text(
        `# Symbol example: ${sym.name} (${sym.kind}) — ${sym.package}\n\n` +
          `**Source:** ${sym.package} · \`${sym.sourcePath}\`\n\n` +
          examples.map((e) => e.text).join('\n\n---\n\n')
      );
    }
  }

  // 4. Fallback: list available recipes and a sample of public symbols.
  return text(buildFallbackHint(topic, targets));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}

interface DocFile {
  fileName: string;
  absPath: string;
  title: string;
}

/**
 * Map @reformer/<name> → directory name in monorepo packages/.
 */
function packageDirName(pkg: string): string {
  const tail = pkg.replace(/^@reformer\//, '');
  if (tail === 'core') return 'reformer';
  return `reformer-${tail}`;
}

/**
 * Return absolute path to the package's docs/llms directory if accessible.
 */
function locateDocsDir(pkg: string): string | null {
  const dir = packageDirName(pkg);
  const candidates = [
    resolve(process.cwd(), 'node_modules', pkg, 'docs', 'llms'),
    resolve(__dirname, '../../../', dir, 'docs', 'llms'),
    resolve(process.cwd(), 'packages', dir, 'docs', 'llms'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

/**
 * Find a markdown file inside docs/llms whose name matches the topic.
 * Accepts both raw and NN-prefixed forms ("recipes" → "05-recipes.md").
 */
function findDocFile(pkg: string, topic: string): DocFile | null {
  const docsDir = locateDocsDir(pkg);
  if (!docsDir) return null;

  const lower = topic.toLowerCase();
  let entries: string[];
  try {
    entries = readdirSync(docsDir).filter((f) => f.endsWith('.md'));
  } catch {
    return null;
  }

  for (const fileName of entries) {
    const stem = fileName.replace(/\.md$/, '').toLowerCase();
    const stripped = stem.replace(/^\d+-/, '');
    if (stem === lower || stripped === lower || stem.includes(lower) || stripped.includes(lower)) {
      const absPath = resolve(docsDir, fileName);
      const raw = readFileSync(absPath, 'utf-8');
      const titleMatch = raw.match(/^#\s+(.+)$/m);
      return {
        fileName,
        absPath,
        title: titleMatch ? titleMatch[1].trim() : stripped,
      };
    }
  }
  return null;
}

function buildFallbackHint(topic: string, targets: ReformerPackage[]): string {
  const recipes: string[] = [];
  for (const pkg of targets) {
    const docsDir = locateDocsDir(pkg);
    if (!docsDir) continue;
    try {
      for (const f of readdirSync(docsDir)) {
        if (!f.endsWith('.md')) continue;
        const stripped = f.replace(/\.md$/, '').replace(/^\d+-/, '');
        recipes.push(`${pkg.replace('@reformer/', '')}/${stripped}`);
      }
    } catch {
      /* skip */
    }
  }

  const symbols = targets.flatMap((p) => getPublicSymbols(p).map((s) => s.name)).slice(0, 20);

  return (
    `No recipe found for "${topic}".\n\n` +
    `Available recipes (${recipes.length}):\n` +
    recipes.map((r) => `  - ${r}`).join('\n') +
    '\n\n' +
    `Or pass a public symbol name. Sample symbols: ${symbols.join(', ')}, ...`
  );
}
