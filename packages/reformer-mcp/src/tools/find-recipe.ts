import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  KNOWN_PACKAGES,
  type ReformerPackage,
  getSection,
  getSectionBySlug,
  packageRoot,
  normalizeTopic,
  normalizePackage,
} from '../utils/docs-parser.js';
import { findOneSymbol, publicSymbols } from '../index/symbols.js';
import { searchSections, renderSectionHits } from './search-docs.js';
import { rankSymbolsForQuery, renderSymbolHits } from '../index/search.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const findRecipeToolDefinition = {
  name: 'find_recipe',
  description:
    'A worked recipe for a scenario keyword ("wizard", "form-array", "copy-from", "json-schema") or the @example of a symbol. An unknown topic falls through to full-text search, so it returns candidates rather than nothing.',
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
          'Restrict to one package: core | cdk | ui-kit | renderer-react | renderer-json (full name or short). Omit for all.',
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
  // conditional validation (validateWhen), JSX hiding. Falls back to
  // api-signatures for the raw signatures if the recipe is somehow unavailable.
  conditional: ['conditional-fields', 'api-signatures'],
  'conditional-fields': ['conditional-fields', 'api-signatures'],
  'conditional-rendering': ['conditional-fields', 'api-signatures'],
  'enable-when': ['conditional-fields', 'api-signatures'],
  enablewhen: ['conditional-fields', 'api-signatures'],
  'validate-when': ['validation', 'conditional-fields'],
  'conditional-validation': ['validation', 'conditional-fields'],
  // validation contract (@reformer/core/validation): validate/validateAsync/validateWhen/cross/each/apply
  // + external runner validateModel(model, schema). Maps to the renderer 06-validation recipe and
  // core multi-step; async → async-validator-debounce; cross-field → common-patterns.
  validation: ['validation', 'multi-step'],
  validate: ['validation', 'multi-step'],
  validator: ['validation'],
  'validate-model': ['validation', 'multi-step'],
  'validate-async': ['validation', 'async-validator-debounce'],
  'async-validation': ['validation', 'async-validator-debounce'],
  cross: ['validation', 'common-patterns'],
  'cross-field': ['validation', 'common-patterns'],
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
  const only = normalizePackage(args.package);
  const targets: ReformerPackage[] = only ? [only] : [...KNOWN_PACKAGES];

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
        // Рецепт возвращался ЦЕЛИКОМ, без потолка: замерено 17 130 символов (~4 283 токена)
        // у `cookbook`. Это ответ инструмента, а не явный `resources/read`, — агент получает
        // его не глядя, поэтому потолок обязателен. Обрезка всегда помечена и говорит, где
        // дочитать: молча усечённый рецепт агент дописал бы сам.
        const { text: bodyText, truncated } = capRecipe(body.trim(), RECIPE_MAX_CHARS);
        const more = truncated
          ? `\n\n> _Рецепт обрезан по бюджету. Полный текст — \`reformer://docs/${pkg.replace(/^@reformer\//, '')}\` ` +
            `или \`docs/llms/${file.fileName}\` в пакете._`
          : '';
        return text(
          `# Recipe: ${file.title}\n\n` +
            `**Source:** ${pkg} · \`docs/llms/${file.fileName}\`${aliasNote}\n\n` +
            bodyText +
            more
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
  const sym = await findOneSymbol(topic, args.package ?? '*');
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

  // 4. Каскад в полнотекстовый поиск. Раньше здесь был сразу шаг 5 (список алиасов), и
  //    это был тупик: замерено на 25 естественных формулировках («dependent field»,
  //    «hide field», «phone mask», «server validation», …) — 17 из 25 (68%) не резолвились
  //    ни файлом, ни секцией, ни символом, и агент платил ~693 токена за подсказку без
  //    ответа. Те же 17 из 17 находит `search_docs` — соседний tool ЭТОГО ЖЕ сервера.
  //    Поэтому промах алиасов больше не терминален: отдаём ранжированных кандидатов.
  const hits = searchSections(topic, args.package, 5);
  if (hits.length > 0) {
    const top = hits[0];
    // Инлайним тело только при попадании в ЗАГОЛОВОК секции: там скоринг надёжен
    // (совпадение в title весит 10×), а тело — обозримого размера. В остальных случаях
    // отдаём кандидатов с URI, чтобы не потратить 4k токенов на секцию мимо задачи.
    // (Полноценное ранжирование — отдельная работа, см. план v7, фаза «индекс».)
    const body =
      top.titleMatch && top.bodyLength <= INLINE_SECTION_LIMIT
        ? getSectionBySlug(top.pkg, top.slug)
        : null;

    if (body) {
      const rest = hits.slice(1);
      return text(
        `# Recipe section: ${top.title}\n\n` +
          `**Source:** ${top.pkg} · \`${top.uri}\` · matched by full-text search for \`${topic}\`\n\n` +
          body +
          (rest.length > 0
            ? `\n\n---\n\n_Other candidates:_\n${rest.map((h) => `- \`${h.uri}\` — ${h.title}`).join('\n')}`
            : '')
      );
    }

    // Плюс канонические имена API из найденных секций — то, ради чего агент и спрашивал.
    const symbols = rankSymbolsForQuery(topic, hits, args.package, 4);
    const apiBlock = symbols.length > 0 ? `\n\n## Relevant API\n${renderSymbolHits(symbols)}` : '';
    return text(
      `No curated recipe is registered for "${topic}", but full-text search found related sections:\n\n` +
        renderSectionHits(hits) +
        apiBlock +
        `\n\n_Read one via resources/read on its \`reformer://docs/…\` URI._`
    );
  }

  // 5. Fallback: list available recipes and a sample of public symbols.
  return text(await buildFallbackHint(topic, targets));
}

/**
 * Максимальный размер секции, которую каскад отдаёт телом, а не ссылкой (~1.5k токенов).
 * Выше порога дешевле вернуть URI: секции доходят до 149k символов (`## API Reference` cdk).
 */
const INLINE_SECTION_LIMIT = 6000;

/** Потолок для файлового рецепта (~2.5k токенов). Крупнейший — `cookbook`, 17 130 символов. */
const RECIPE_MAX_CHARS = 10000;

/**
 * Обрезать рецепт по границе раздела, а не посреди строки.
 *
 * Режем по последнему заголовку, поместившемуся в лимит: обрывок раздела вводит в
 * заблуждение сильнее, чем его отсутствие. Незакрытый код-фенс закрываем — иначе у клиента
 * поедет вся остальная разметка ответа.
 */
function capRecipe(body: string, maxChars: number): { text: string; truncated: boolean } {
  if (body.length <= maxChars) return { text: body, truncated: false };
  const lines = body.split('\n');
  const kept: string[] = [];
  let used = 0;
  let lastHeading = -1;
  let inFence = false;
  for (const line of lines) {
    if (used + line.length + 1 > maxChars) break;
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence && /^#{2,4}\s/.test(line)) lastHeading = kept.length;
    kept.push(line);
    used += line.length + 1;
  }
  // Отрезаем хвост до последнего целого раздела, если он не в самом начале.
  const cut = lastHeading > 5 ? kept.slice(0, lastHeading) : kept;
  const fences = cut.filter((l) => /^\s*```/.test(l)).length;
  if (fences % 2 === 1) cut.push('```');
  return { text: cut.join('\n').trimEnd(), truncated: true };
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
  const root = packageRoot(pkg);
  const candidates = [
    // Резолв через package.json пакета — работает под npx/pnpm/hoisting, где плоского
    // `<cwd>/node_modules/<pkg>` может не быть.
    ...(root ? [resolve(root, 'docs', 'llms')] : []),
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
  // Совпадение без учёта дефисов: «form-field» ↔ «form-field.md», «formfield» ↔ «form-field.md».
  const nz = normalizeTopic(lower);
  const nzStem = normalizeTopic(stripped);
  if (nzStem === nz) return 90;
  if (nzStem.includes(nz)) return 35;
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

async function buildFallbackHint(topic: string, targets: ReformerPackage[]): Promise<string> {
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

  const symbols = (await Promise.all(targets.map((p) => publicSymbols(p))))
    .flat()
    .map((s) => s.name)
    .slice(0, 20);

  // Список алиасов — только фактически резолвящиеся против доступных пакетов: раньше
  // печатались все ключи RECIPE_ALIASES, и сервер рекламировал темы, которых у потребителя
  // нет (docs/llms не был опубликован). Хвост алиаса резолвится → это и есть «известная тема».
  const resolvableAliases = Object.keys(RECIPE_ALIASES)
    .filter((key) =>
      resolveAliases(key).some((cand) =>
        targets.some((pkg) => {
          const dir = locateDocsDir(pkg);
          if (dir) {
            try {
              if (
                pickBestDocFile(
                  readdirSync(dir).filter((f) => f.endsWith('.md')),
                  cand
                )
              )
                return true;
            } catch {
              /* skip */
            }
          }
          return !getSection(cand, pkg).startsWith('Section "');
        })
      )
    )
    .sort();

  const aliasLine = resolvableAliases.length
    ? `Known topic aliases: ${resolvableAliases.join(', ')}.\n\n`
    : '';

  // `recipes.length === 0` означает, что файловый источник пуст (под npx без опубликованных
  // docs/llms) — но ресурсы (`resources/list`) всё равно отдают весь llms.txt по секциям.
  const noFilesNote =
    recipes.length === 0
      ? 'No file-based recipes are reachable here (docs/llms not published in this install). ' +
        'The full documentation is still available as MCP resources — call `resources/list` ' +
        '(reformer://docs/{core,cdk,ui-kit,renderer-react,renderer-json}[/section]).\n\n'
      : `Available recipes (${recipes.length}):\n${recipes.map((r) => `  - ${r}`).join('\n')}\n\n`;

  return (
    `No recipe found for "${topic}".\n\n` +
    noFilesNote +
    aliasLine +
    `Or pass a public symbol name. Sample symbols: ${symbols.join(', ')}, ...`
  );
}
