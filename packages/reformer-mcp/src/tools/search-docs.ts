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
  normalizePackage,
} from '../utils/docs-parser.js';
import { rankSymbolsForQuery, renderSymbolHits } from '../index/search.js';

export const searchDocsToolDefinition = {
  name: 'search_docs',
  description:
    'Full-text search over all @reformer/* docs, for when you can describe the task but cannot name it. Returns ranked sections with their reformer://docs/… URI, a matched snippet, and the relevant API names.',
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
          'Restrict to one package: core | cdk | ui-kit | renderer-react | renderer-json (full name or short). Omit for all.',
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
  /** Частоты термов тела — основа BM25. */
  tf: Map<string, number>;
  /** Длина секции в термах (|D| в формуле BM25). */
  length: number;
}

interface SearchIndex {
  sections: IndexedSection[];
  /** В скольких секциях встречается терм (document frequency). */
  df: Map<string, number>;
  /** Средняя длина секции — нормировочная база BM25. */
  avgLength: number;
}

// Индекс кэшируется на всё время жизни процесса: docs на диске не меняются, а перестройка
// (343 секции × getSectionBySlug + токенизация) не бесплатна. getFullDocs внутри кэширован.
let cachedIndex: SearchIndex | null = null;

function shortName(pkg: string): string {
  return pkg.replace(/^@reformer\//, '');
}

/**
 * Токенизация: слова латиницы/кириллицы и идентификаторы, плюс разбор camelCase.
 *
 * camelCase обязателен. Прежний скоринг искал подстроку, поэтому запрос «currency» находил
 * `formatCurrency`, а «validation» — `defineValidationSchema`. Переход на честные термы это
 * ломает (в документации по коду половина знания живёт внутри идентификаторов), поэтому
 * `formatCurrency` индексируется сразу тремя термами: `formatcurrency`, `format`, `currency`.
 * Так сохраняется полнота подстрочного поиска без его главного порока — ложных совпадений
 * посреди слова.
 */
function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.match(/[a-zA-Zа-яёА-ЯЁ0-9_$]+/g) ?? []) {
    const lower = raw.toLowerCase();
    out.push(lower);
    const parts = raw
      .replace(/[_$]+/g, ' ')
      .replace(/([a-zа-яё0-9])([A-ZА-ЯЁ])/g, '$1 $2')
      .replace(/([A-ZА-ЯЁ]+)([A-ZА-ЯЁ][a-zа-яё])/g, '$1 $2')
      .split(/\s+/)
      .filter((p) => p.length > 2)
      .map((p) => p.toLowerCase());
    if (parts.length > 1) out.push(...parts);
  }
  return out;
}

/**
 * Понижение для собственной документации сервера.
 *
 * `@reformer/mcp` документирует САМ СЕРВЕР (его tools, промпты, ресурсы), а не то, как писать
 * формы. Его секции короткие, а BM25 короткие документы поощряет — после перехода на него
 * запросы «computed total», «dependent field», «server validation» стали выигрывать разделы
 * mcp-мануала вместо библиотечных. Для вопроса «как сделать X в ReFormer» правильный ответ
 * почти всегда в библиотечном пакете, поэтому mcp участвует, но уступает при прочих равных.
 */
const OWN_DOCS_PENALTY = 0.4;

function buildIndex(): SearchIndex {
  if (cachedIndex) return cachedIndex;
  const sections: IndexedSection[] = [];
  const df = new Map<string, number>();

  for (const pkg of listAvailablePackages()) {
    const short = shortName(pkg);
    for (const section of listSections(pkg)) {
      const body = getSectionBySlug(pkg, section.slug) ?? '';
      const tokens = tokenize(body);
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
      sections.push({
        pkg,
        short,
        section,
        body,
        titleLower: section.title.toLowerCase(),
        bodyLower: body.toLowerCase(),
        tf,
        length: tokens.length,
      });
    }
  }

  const avgLength =
    sections.length > 0 ? sections.reduce((n, s) => n + s.length, 0) / sections.length : 1;
  cachedIndex = { sections, df, avgLength };
  return cachedIndex;
}

interface Scored {
  entry: IndexedSection;
  score: number;
}

/** Параметры BM25. Значения стандартные: k1 гасит насыщение частотой, b — силу нормировки. */
const BM25_K1 = 1.2;
const BM25_B = 0.75;

/**
 * Релевантность секции запросу.
 *
 * Было: сумма вхождений термов с потолком 5 на тело. Такая формула не наказывает длину,
 * поэтому гигантская секция `## API Reference` (у `@reformer/cdk` — 149 196 символов)
 * выигрывала запросы, к которым не имеет отношения: «computed total», «touched», «dirty»,
 * «autocomplete». Агент читал её целиком — так и набирались 25-40k токенов на задачу при
 * медиане около 1k. Именно это был весь хвост стоимости в eval.
 *
 * Стало: BM25 по телу (насыщение частотой + нормировка на длину документа) плюс два сигнала,
 * которых у чистого BM25 нет, а для документации они решающие:
 *  - совпадение в ЗАГОЛОВКЕ секции: у документации заголовок — это имя API или сценария,
 *    и попадание в него надёжнее любой частоты в теле;
 *  - точная фраза целиком — редкий и сильный сигнал.
 */
function scoreSection(
  entry: IndexedSection,
  terms: string[],
  phrase: string,
  index: SearchIndex
): number {
  const N = index.sections.length;
  let score = 0;
  let covered = 0;

  for (const term of terms) {
    const inTitle = entry.titleLower.includes(term);
    const f = entry.tf.get(term) ?? 0;
    if (f === 0 && !inTitle) continue;
    covered++;

    if (f > 0) {
      const n = index.df.get(term) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const norm = f + BM25_K1 * (1 - BM25_B + (BM25_B * entry.length) / index.avgLength);
      score += idf * ((f * (BM25_K1 + 1)) / norm);
    }
    // Заголовок весит как сильный отдельный сигнал, не зависящий от длины тела.
    if (inTitle) score += 8;
  }

  if (score === 0) return 0;
  if (covered === terms.length && terms.length > 1) score *= 1.5;
  if (terms.length > 1) {
    if (entry.titleLower.includes(phrase)) score += 20;
    else if (entry.bodyLower.includes(phrase)) score += 4;
  }
  if (entry.pkg === '@reformer/mcp') score *= OWN_DOCS_PENALTY;
  return score;
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

/**
 * Один результат поиска в структурированном виде — то же ранжирование, что видит
 * `search_docs`, но без markdown-обёртки. Нужен второму потребителю: `find_recipe`
 * каскадирует сюда вместо тупика «No recipe found» (замерено: 68% естественных
 * формулировок не резолвились алиасами, и все 100% из них находятся этим поиском).
 */
export interface SectionHit {
  /** Полное имя пакета, напр. `@reformer/core`. */
  pkg: string;
  /** Короткое имя пакета для URI, напр. `core`. */
  short: string;
  /** Слаг секции — тот же, что в `reformer://docs/<short>/<slug>`. */
  slug: string;
  title: string;
  /** Готовый resource-URI, резолвится через `resources/read`. */
  uri: string;
  /** Наиболее релевантная строка тела (или preview, если совпал только заголовок). */
  snippet: string;
  score: number;
  /** Тело секции. Ссылка на уже закэшированную строку — нужна для связки «секция → символы». */
  body: string;
  /** Хотя бы один терм запроса встретился в ЗАГОЛОВКЕ — сильный сигнал точного попадания. */
  titleMatch: boolean;
  /** Длина тела секции в символах — потребитель решает, инлайнить её или отдать URI. */
  bodyLength: number;
}

/**
 * Ранжированный поиск по секциям. Общее ядро `search_docs` и каскада `find_recipe`.
 *
 * @param query - Слова, описывающие задачу.
 * @param pkg   - Ограничить одним пакетом; `'*'`/undefined — искать везде.
 * @param limit - Максимум результатов (1..25, по умолчанию 10).
 * @returns Отсортированные по убыванию релевантности попадания; пустой массив, если ничего.
 */
export function searchSections(query: string, pkg?: string, limit?: number): SectionHit[] {
  const trimmed = typeof query === 'string' ? query.trim() : '';
  if (!trimmed) return [];

  const terms = tokenize(trimmed);
  const phrase = trimmed.toLowerCase();
  const restrictTo = normalizePackage(pkg);

  const index = buildIndex();
  const scored: Scored[] = [];
  for (const entry of index.sections) {
    if (restrictTo && entry.pkg !== restrictTo) continue;
    const score = scoreSection(entry, terms, phrase, index);
    if (score > 0) scored.push({ entry, score });
  }
  if (scored.length === 0) return [];

  // Стабильный порядок при равном счёте: пакет (по KNOWN_PACKAGES), затем заголовок.
  const pkgOrder = new Map(KNOWN_PACKAGES.map((p, i) => [p as string, i]));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = pkgOrder.get(a.entry.pkg) ?? 99;
    const pb = pkgOrder.get(b.entry.pkg) ?? 99;
    if (pa !== pb) return pa - pb;
    return a.entry.section.title.localeCompare(b.entry.section.title);
  });

  return scored.slice(0, clampLimit(limit)).map(({ entry, score }) => ({
    pkg: entry.pkg,
    short: entry.short,
    slug: entry.section.slug,
    title: entry.section.title,
    uri: `reformer://docs/${entry.short}/${entry.section.slug}`,
    snippet: bestSnippet(entry, terms),
    body: entry.body,
    score,
    titleMatch: terms.some((t) => entry.titleLower.includes(t)),
    bodyLength: entry.body.length,
  }));
}

/** Общее для `search_docs` и каскада `find_recipe` markdown-представление попаданий. */
export function renderSectionHits(hits: SectionHit[]): string {
  return hits
    .map((h) => `## ${h.pkg}: ${h.title}\n\`${h.uri}\`${h.snippet ? `\n> ${h.snippet}` : ''}`)
    .join('\n\n');
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

  const restrictTo = normalizePackage(args.package);
  const hits = searchSections(query, args.package, args.limit);

  if (hits.length === 0) {
    return text(
      `No documentation sections matched "${query}"${
        restrictTo ? ` in ${restrictTo}` : ''
      }.\n\nTry broader or different words, or use \`list_symbols\` (nameContains) / \`find_recipe\` if you have a symbol or topic name.`
    );
  }

  // Каноническое имя API в том же ответе. Замерено на корпусе eval: в задачах, которые не
  // брались с первой формулировки, срабатывал последний запрос — и он был буквально именем
  // символа. Значит, агенту не хватало именно перехода «слова задачи → имя», и отдавать его
  // надо здесь же, а не заставлять угадывать следующим вызовом.
  const symbols = rankSymbolsForQuery(query, hits, args.package, 4);
  const apiBlock = symbols.length > 0 ? `\n\n## Relevant API\n${renderSymbolHits(symbols)}` : '';

  return text(
    `# search_docs: "${query}"\n\n` +
      renderSectionHits(hits) +
      apiBlock +
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
