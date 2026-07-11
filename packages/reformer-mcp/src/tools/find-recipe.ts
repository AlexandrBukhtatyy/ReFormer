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

/**
 * Common user-typed keywords → canonical recipe filename stems.
 * Handles cases where the obvious search term doesn't match the actual
 * filename (e.g. user types "form-array" but file is "10-arrays.md").
 *
 * Add aliases here when sub-agents repeatedly hit "no recipe found" for
 * intuitive keywords. Each alias maps to a list of candidate stems
 * (without NN- prefix); first match wins.
 */
const RECIPE_ALIASES: Record<string, string[]> = {
  // computed fields
  'compute-from': ['compute-vs-watch'],
  computed: ['compute-vs-watch'],
  derived: ['compute-vs-watch'],
  // arrays
  'form-array': ['arrays', 'array-operations', 'array-cleanup'],
  array: ['arrays'],
  // multi-step / wizard
  'form-wizard': ['multi-step'],
  wizard: ['multi-step'],
  // async
  'async-validator': ['async-validator-debounce', 'async-watchfield', 'async-preload'],
  async: ['async-watchfield', 'async-preload'],
  // ui-kit form-field
  'form-field': ['form-field-integration'],
  'field-component': ['form-field-integration'],
  formfield: ['form-field-integration'],
  // cycles (behaviors / arrays)
  cycle: ['cycle-detection'],
  circular: ['cycle-detection', 'array-cleanup'],
  'cycle-detection': ['cycle-detection'],
  // copy / sync (value propagation between fields — NOT cross-field validation)
  sync: ['sync-fields'],
  copy: ['copy-from'],
  // conditional value ops
  reset: ['reset-when'],
  transform: ['transform-value'],
  revalidate: ['revalidate-when'],
  // submit lifecycle
  submit: ['submit-and-reset'],
  // async options / preload
  preload: ['async-preload'],
  options: ['async-options-loading'],
  // form directory / project layout. Canonical cross-target guide is
  // form-directory-layout (@reformer/mcp). @reformer/core keeps its own
  // project-structure section (core-only slice), kept consistent with the
  // guide — safe as a fallback for core-only consumers without the mcp package.
  'directory-layout': ['form-directory-layout', 'project-structure'],
  'directory-structure': ['form-directory-layout', 'project-structure'],
  'project-structure': ['form-directory-layout', 'project-structure'],
  'folder-structure': ['form-directory-layout', 'project-structure'],
  'file-organization': ['form-directory-layout', 'project-structure'],
  colocation: ['form-directory-layout', 'project-structure'],
  // conditional fields — visibility/availability (enableWhen, compute/copyFrom { when }),
  // conditional validation (branch node { when, children }), JSX hiding. Falls back to
  // api-signatures for the raw signatures if the recipe is somehow unavailable.
  conditional: ['conditional-fields', 'api-signatures'],
  'conditional-fields': ['conditional-fields', 'api-signatures'],
  'conditional-rendering': ['conditional-fields', 'api-signatures'],
  'enable-when': ['conditional-fields', 'api-signatures'],
  enablewhen: ['conditional-fields', 'api-signatures'],
  'branch-node': ['conditional-fields', 'api-signatures'],
  'when-children': ['conditional-fields', 'api-signatures'],
};

function resolveAliases(topic: string): string[] {
  const key = topic.toLowerCase();
  const aliases = RECIPE_ALIASES[key];
  return aliases && aliases.length > 0 ? [topic, ...aliases] : [topic];
}

export async function findRecipeTool(
  args: FindRecipeArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // MCP Server не валидирует args по inputSchema — обязательный `topic` может прийти
  // отсутствующим/не-строкой. Защищаемся до .trim(), иначе — необработанный TypeError
  // (ср. паттерн в check-behaviors.ts).
  if (typeof args.topic !== 'string') {
    return text('Argument "topic" is required and must be a non-empty string.');
  }
  const topic = args.topic.trim();
  if (!topic) {
    return text('Argument "topic" is required and must be non-empty.');
  }
  const targets: ReformerPackage[] =
    args.package && args.package !== '*' ? [args.package as ReformerPackage] : [...KNOWN_PACKAGES];

  const candidates = resolveAliases(topic);

  // 1. Match by docs/llms/ filename (with or without NN- prefix).
  //    Tries the original topic first, then registered aliases.
  for (const candidate of candidates) {
    for (const pkg of targets) {
      const file = findDocFile(pkg, candidate);
      if (file) {
        const body = readFileSync(file.absPath, 'utf-8');
        const aliasNote =
          candidate !== topic
            ? `\n\n> _Note: searched for \`${topic}\`, matched alias → \`${candidate}\`. ` +
              `Use \`${candidate}\` directly to suppress this hint._`
            : '';
        return text(
          `# Recipe: ${file.title}\n\n` +
            `**Source:** ${pkg} · \`docs/llms/${file.fileName}\`${aliasNote}\n\n` +
            body.trim()
        );
      }
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
 * Score how well a docs/llms filename matches a topic. Higher is better; 0 = no match.
 *
 * The `NN-` numeric prefix is stripped before matching so digits never contribute a
 * match (a degenerate topic like "05" no longer resolves a file by its file number).
 * Ranking, strongest first:
 *   100 — exact match on the human-readable stem, or on the full stem incl. NN- prefix
 *    75 — the topic is a whole hyphen-delimited segment of the stem ("api" in "api-signatures")
 *    60 — the stem starts with the topic ("recipe" → "recipes")
 *    40 — plain substring anywhere in the stem
 */
export function scoreDocFileMatch(fileName: string, topic: string): number {
  const lower = topic.trim().toLowerCase();
  if (!lower) return 0;
  const stem = fileName.replace(/\.md$/i, '').toLowerCase();
  const stripped = stem.replace(/^\d+-/, '');
  if (stripped === lower || stem === lower) return 100;
  if (stripped.split('-').includes(lower)) return 75;
  if (stripped.startsWith(lower)) return 60;
  if (stripped.includes(lower)) return 40;
  return 0;
}

/**
 * Pick the best-matching filename for a topic among candidates, by descending score.
 * Ties keep the first candidate — with the curated `NN-` numbering and alphabetical
 * readdir order this means the lower file number wins, which is the intended priority.
 * Crucially, an exact match beats an earlier loose substring match regardless of
 * position (the old first-match-wins loop shadowed it).
 */
export function pickBestDocFile(fileNames: string[], topic: string): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const fileName of fileNames) {
    const score = scoreDocFileMatch(fileName, topic);
    if (score > bestScore) {
      bestScore = score;
      best = fileName;
    }
  }
  return best;
}

/**
 * Find a markdown file inside docs/llms whose name matches the topic.
 * Accepts both raw and NN-prefixed forms ("recipes" → "05-recipes.md").
 */
function findDocFile(pkg: string, topic: string): DocFile | null {
  const docsDir = locateDocsDir(pkg);
  if (!docsDir) return null;

  let entries: string[];
  try {
    entries = readdirSync(docsDir).filter((f) => f.endsWith('.md'));
  } catch {
    return null;
  }

  const fileName = pickBestDocFile(entries, topic);
  if (!fileName) return null;

  const absPath = resolve(docsDir, fileName);
  const raw = readFileSync(absPath, 'utf-8');
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const stripped = fileName.replace(/\.md$/, '').toLowerCase().replace(/^\d+-/, '');
  return {
    fileName,
    absPath,
    title: titleMatch ? titleMatch[1].trim() : stripped,
  };
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
  const aliases = Object.keys(RECIPE_ALIASES).sort();

  return (
    `No recipe found for "${topic}".\n\n` +
    `Available recipes (${recipes.length}):\n` +
    recipes.map((r) => `  - ${r}`).join('\n') +
    '\n\n' +
    `Known topic aliases: ${aliases.join(', ')}.\n\n` +
    `Or pass a public symbol name. Sample symbols: ${symbols.join(', ')}, ...`
  );
}
