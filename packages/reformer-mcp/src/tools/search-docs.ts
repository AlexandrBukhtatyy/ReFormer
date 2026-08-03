/**
 * Tool `search_docs` — полнотекстовый поиск по прозе ВСЕХ секций документации
 * (~233 ресурса: level-2 секции llms.txt каждого @reformer/*-пакета).
 *
 * Ниша между уже существующими инструментами:
 *   - find_recipe(topic)     — курируемый рецепт по ключевому топику (маппится на doc-файл/пример);
 *   - get_symbol_docs(name)  — JSDoc одного символа;
 *   - list_symbols           — перечислить API-поверхность;
 *   - search_docs(query)     — когда имени символа/топика НЕ знаешь, а есть слова, описывающие
 *                              задачу («reset form after submit», «conditional required»): ищем
 *                              по тексту секций и возвращаем ранжированные попадания с их
 *                              resource-URI, чтобы затем прочитать секцию целиком.
 *
 * Индекс строится один раз (ленивая кэш-переменная) поверх docs-parser: slug'и берём из
 * listSections (те же, что в reformer://docs/<pkg>/<slug>), тело — getSectionBySlug. Так
 * URI в выдаче гарантированно резолвится через ReadResource.
 */

import {
  listAvailablePackages,
  listSections,
  getSectionBySlug,
  KNOWN_PACKAGES,
  type SectionMeta,
} from '../utils/docs-parser.js';

export const searchDocsToolDefinition = {
  name: 'search_docs',
  description:
    'Full-text search across every documentation section of all @reformer/* packages. Use it when you do NOT know the exact symbol or recipe topic but can describe the task in words (e.g. "reset form after submit", "make a field required conditionally", "debounce async validation"). Returns ranked sections with their reformer://docs/<pkg>/<slug> resource URI and a matched snippet — read the URI via resources/read for the full section. Complements find_recipe (curated topic → recipe) and get_symbol_docs (one symbol\'s JSDoc); reach for those when you already know the topic or symbol name.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description:
          'Words describing what you are looking for (e.g. "conditional required validation", "wizard step guard"). Matched case-insensitively against section titles and bodies; multiple words are AND-preferred but not required.',
      },
      package: {
        type: 'string',
        description:
          'Restrict the search to one package (e.g. "@reformer/core"). Omit or "*" to search across all packages.',
        enum: ['*', ...KNOWN_PACKAGES],
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 10, max 25).',
      },
    },
    required: ['query'],
  },
};

export interface SearchDocsArgs {
  query?: string;
  package?: string;
  limit?: number;
}

interface IndexedSection {
  pkg: string;
  short: string;
  section: SectionMeta;
  body: string;
  titleLower: string;
  bodyLower: string;
}

// Индекс кэшируется на всё время жизни процесса: docs на диске не меняются, а перестройка
// (233 секции × getSectionBySlug) не бесплатна. getFullDocs внутри уже кэширован.
let cachedIndex: IndexedSection[] | null = null;

function shortName(pkg: string): string {
  return pkg.replace(/^@reformer\//, '');
}

function buildIndex(): IndexedSection[] {
  if (cachedIndex) return cachedIndex;
  const index: IndexedSection[] = [];
  for (const pkg of listAvailablePackages()) {
    const short = shortName(pkg);
    for (const section of listSections(pkg)) {
      const body = getSectionBySlug(pkg, section.slug) ?? '';
      index.push({
        pkg,
        short,
        section,
        body,
        titleLower: section.title.toLowerCase(),
        bodyLower: body.toLowerCase(),
      });
    }
  }
  cachedIndex = index;
  return index;
}

/** Число непересекающихся вхождений подстроки (needle гарантированно непустой). */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    count++;
    from = at + needle.length;
  }
  return count;
}

interface Scored {
  entry: IndexedSection;
  score: number;
}

function scoreSection(entry: IndexedSection, terms: string[], phrase: string): number {
  let base = 0;
  let covered = 0;
  for (const term of terms) {
    const titleHits = countOccurrences(entry.titleLower, term);
    // Тело кэпируем: длинная секция иначе доминирует одним частым словом.
    const bodyHits = Math.min(countOccurrences(entry.bodyLower, term), 5);
    if (titleHits + bodyHits === 0) continue;
    covered++;
    base += titleHits * 10 + bodyHits;
  }
  if (base === 0) return 0;
  // Все термы присутствуют — сильнее, чем частичное совпадение.
  if (covered === terms.length && terms.length > 1) base *= 1.5;
  // Точная фраза целиком — редкий и сильный сигнал.
  if (terms.length > 1) {
    if (entry.titleLower.includes(phrase)) base += 25;
    else if (entry.bodyLower.includes(phrase)) base += 8;
  }
  return base;
}

/** Наиболее релевантная строка тела как сниппет (или preview, если совпал только заголовок). */
function bestSnippet(entry: IndexedSection, terms: string[]): string {
  const lines = entry.body.split('\n');
  let best = '';
  let bestHits = 0;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```')) continue;
    const lower = trimmed.toLowerCase();
    let hits = 0;
    for (const term of terms) if (lower.includes(term)) hits++;
    if (hits > bestHits) {
      bestHits = hits;
      best = trimmed;
    }
  }
  if (bestHits === 0) best = entry.section.preview || '';
  best = best.replace(/\s+/g, ' ').trim();
  return best.length > 180 ? best.slice(0, 177) + '…' : best;
}

export async function searchDocsTool(
  args: SearchDocsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) {
    return text(
      'Pass a non-empty `query` describing what you are looking for (e.g. "conditional required validation").'
    );
  }

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const phrase = query.toLowerCase();
  const limit = clampLimit(args.limit);

  const restrictTo =
    args.package && args.package !== '*'
      ? args.package.replace(/^@reformer\//, '@reformer/')
      : null;

  const scored: Scored[] = [];
  for (const entry of buildIndex()) {
    if (restrictTo && entry.pkg !== restrictTo) continue;
    const score = scoreSection(entry, terms, phrase);
    if (score > 0) scored.push({ entry, score });
  }

  if (scored.length === 0) {
    return text(
      `No documentation sections matched "${query}"${
        restrictTo ? ` in ${restrictTo}` : ''
      }.\n\nTry broader or different words, or use \`list_symbols\` (nameContains) / \`find_recipe\` if you have a symbol or topic name.`
    );
  }

  // Стабильный порядок при равном счёте: пакет (по KNOWN_PACKAGES), затем заголовок.
  const pkgOrder = new Map(KNOWN_PACKAGES.map((p, i) => [p as string, i]));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = pkgOrder.get(a.entry.pkg) ?? 99;
    const pb = pkgOrder.get(b.entry.pkg) ?? 99;
    if (pa !== pb) return pa - pb;
    return a.entry.section.title.localeCompare(b.entry.section.title);
  });

  const top = scored.slice(0, limit);
  const shown = top
    .map(({ entry }) => {
      const uri = `reformer://docs/${entry.short}/${entry.section.slug}`;
      const snippet = bestSnippet(entry, terms);
      const quote = snippet ? `\n> ${snippet}` : '';
      return `## ${entry.pkg}: ${entry.section.title}\n\`${uri}\`${quote}`;
    })
    .join('\n\n');

  const more = scored.length > top.length ? ` (showing top ${top.length} of ${scored.length})` : '';
  return text(
    `# search_docs: "${query}"${more}\n\n` +
      shown +
      `\n\n_Read a full section via resources/read on its \`reformer://docs/…\` URI. For a specific symbol use \`get_symbol_docs\`; for a curated recipe use \`find_recipe\`._`
  );
}

function clampLimit(limit: unknown): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return 10;
  return Math.max(1, Math.min(25, Math.floor(limit)));
}

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}

/** Только для тестов — сбросить кэш индекса. */
export function __resetSearchDocsIndex(): void {
  cachedIndex = null;
}
