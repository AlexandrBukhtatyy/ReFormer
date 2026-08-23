/**
 * Поиск по СИМВОЛАМ поверх `llms-index.json`.
 *
 * Зачем он вообще нужен, кроме поиска по секциям. Замерено на корпусе eval: в каждой задаче,
 * которая не бралась с первой формулировки, срабатывал ПОСЛЕДНИЙ запрос — а он буквально
 * равнялся имени символа (`resetWhen`, `syncFields`, `hideWhen`). То есть знание в
 * документации есть, не хватает ровно перехода «естественная формулировка → каноническое имя».
 * Секции этот разрыв не закрывают: у запроса «conditional required validation» нет секции с
 * таким заголовком, а есть символ `validateWhen`, чьё описание про это и написано.
 *
 * Ранжирование — по описанию и имени, с двумя поправками, которых у чистого текстового
 * совпадения нет:
 *  - имя весит больше описания: запрос часто и есть имя;
 *  - популярность (`usage` — сколько раз символ встречается в эталонных формах монорепо)
 *    разводит близкие варианты. Это замена телеметрии из внешних рекомендаций: корпус
 *    реальных форм честнее и уже лежит в репозитории (`validate` — 357 употреблений,
 *    `cross` — 65, `compute` — 55, а `applyEach`/`aggregateInto`/`exclusiveFlag` — ноль).
 */

import { memoize, type Knowledge } from '../knowledge.js';
import type { IndexedSymbol } from './types.js';

export interface SymbolHit {
  symbol: IndexedSymbol;
  score: number;
}

/** Токенизация с разбором camelCase — та же, что у поиска по секциям. */
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

interface SymbolDoc {
  symbol: IndexedSymbol;
  nameTokens: Set<string>;
  textTokens: Map<string, number>;
}

interface SymbolCorpus {
  docs: SymbolDoc[];
  /** В скольких ИМЁНАХ встречается терм. */
  dfName: Map<string, number>;
  /** В скольких ОПИСАНИЯХ встречается терм. */
  dfText: Map<string, number>;
}

/**
 * Поисковый корпус строится один раз на знание, а не на модуль: два разных `Knowledge`
 * (вшитый артефакт и папка проекта) обязаны иметь независимые корпуса, иначе второй молча
 * отвечал бы символами первого.
 */
function corpus(k: Knowledge): SymbolCorpus {
  return memoize(k, 'search:symbol-corpus', () => buildCorpus(k));
}

function buildCorpus(k: Knowledge): SymbolCorpus {
  const docs = k.index.symbols.map((symbol) => {
    const nameTokens = new Set(tokenize(symbol.name));
    // Описание + сигнатура + темы: всё, что описывает НАЗНАЧЕНИЕ символа своими словами.
    const text = [
      symbol.summary,
      symbol.description ?? '',
      symbol.signature,
      (symbol.topics ?? []).join(' '),
    ].join(' ');
    const textTokens = new Map<string, number>();
    for (const t of tokenize(text)) textTokens.set(t, (textTokens.get(t) ?? 0) + 1);
    return { symbol, nameTokens, textTokens };
  });

  const dfName = new Map<string, number>();
  const dfText = new Map<string, number>();
  for (const d of docs) {
    for (const t of d.nameTokens) dfName.set(t, (dfName.get(t) ?? 0) + 1);
    for (const t of d.textTokens.keys()) dfText.set(t, (dfText.get(t) ?? 0) + 1);
  }

  return { docs, dfName, dfText };
}

/**
 * Обратная документная частота. Без неё поиск разваливается: токены `form` и `field` входят в
 * сотни имён, поэтому `FormField` выигрывал ЛЮБОЙ вопрос про формы — и «computed field from
 * other fields», и «reset dependent field on change». Редкие токены (`validate`, `sync`,
 * `reset`) обязаны весить несопоставимо больше частых.
 */
function idf(df: Map<string, number>, term: string, total: number): number {
  const n = df.get(term) ?? 0;
  return Math.log(1 + (total - n + 0.5) / (n + 0.5));
}

/** Популярность → небольшой множитель. Логарифм, чтобы 357 не задавили всё остальное. */
function popularityBoost(usage: number | undefined): number {
  if (!usage || usage <= 0) return 1;
  return 1 + Math.log10(1 + usage) / 4; // usage=357 → ×1.64, usage=6 → ×1.21
}

/**
 * Найти символы, релевантные запросу.
 *
 * @param query - Слова запроса; может быть и точным именем символа, и описанием задачи.
 * @param pkg   - Ограничить пакетом; `'*'`/undefined — искать везде.
 * @param limit - Максимум результатов.
 */
export function searchSymbols(k: Knowledge, query: string, pkg?: string, limit = 5): SymbolHit[] {
  const terms = [...new Set(tokenize(String(query ?? '')))];
  if (terms.length === 0) return [];
  const restrictTo = pkg && pkg !== '*' ? pkg : null;

  const { docs, dfName, dfText } = corpus(k);
  const total = docs.length;

  const hits: SymbolHit[] = [];
  for (const doc of docs) {
    if (restrictTo && doc.symbol.package !== restrictTo) continue;

    let score = 0;
    let covered = 0;
    for (const term of terms) {
      const inName = doc.nameTokens.has(term);
      const inText = doc.textTokens.get(term) ?? 0;
      if (!inName && inText === 0) continue;
      covered++;
      // Имя — сильнейший сигнал (запрос часто и есть имя), но взвешенный редкостью терма.
      if (inName) score += 3 * idf(dfName, term, total);
      // Насыщение по частоте: пятое упоминание в описании не вдвое ценнее второго.
      if (inText > 0) score += idf(dfText, term, total) * (1 - 1 / (1 + inText));
    }
    if (score === 0) continue;

    // Точное совпадение имени целиком — отдельный, решающий сигнал.
    if (doc.symbol.name.toLowerCase() === String(query).trim().toLowerCase()) score += 40;
    // Покрыты все термы запроса — сильнее частичного совпадения.
    if (covered === terms.length && terms.length > 1) score *= 1.6;
    score *= popularityBoost(doc.symbol.usage);
    // `@deprecated` не должен всплывать выше живого API.
    if (doc.symbol.deprecated) score *= 0.3;

    hits.push({ symbol: doc.symbol, score });
  }

  hits.sort((a, b) => b.score - a.score || a.symbol.name.localeCompare(b.symbol.name));
  return hits.slice(0, Math.max(1, limit));
}

/** Секция, найденная поиском по документации, — вход для «мостика» ниже. */
export interface SectionEvidence {
  title: string;
  body: string;
  score: number;
}

/**
 * Символы, релевантные запросу, с учётом НАЙДЕННЫХ секций документации.
 *
 * Ключевая идея. Одного поиска по символам мало: описания коротки (у `validateWhen` — 204
 * символа), и слов запроса «conditional required validation» в нём просто нет. Зато секции
 * документации по этому запросу находятся отлично — в них и написано, каким API это делается.
 * Документация и есть мост между формулировкой пользователя и каноническим именем, поэтому
 * символ получает вес от секций, которые его упоминают.
 *
 * Это ровно то, что показал eval: в каждой задаче, провалившей first-pass, срабатывал
 * последний запрос, равный имени символа, — то есть агенту не хватало именно этого перехода.
 *
 * @param query        - Исходный запрос пользователя.
 * @param sections     - Топ секций от полнотекстового поиска (обычно 5).
 * @param pkg          - Ограничение по пакету.
 * @param limit        - Сколько символов вернуть.
 */
export function rankSymbolsForQuery(
  k: Knowledge,
  query: string,
  sections: SectionEvidence[],
  pkg?: string,
  limit = 5
): SymbolHit[] {
  const direct = new Map<string, number>();
  for (const h of searchSymbols(k, query, pkg, 40)) direct.set(h.symbol.name, h.score);

  const { docs } = corpus(k);
  const restrictTo = pkg && pkg !== '*' ? pkg : null;
  const maxSectionScore = Math.max(1, ...sections.map((s) => s.score));
  const totalTopics = Math.max(1, k.index.topics.length);

  const fromDocs = new Map<string, number>();
  for (const section of sections) {
    // Нормируем: вклад секции пропорционален её релевантности, а не абсолютному счёту.
    const weight = section.score / maxSectionScore;
    const haystack = `${section.title}\n${section.body}`;
    for (const doc of docs) {
      if (restrictTo && doc.symbol.package !== restrictTo) continue;
      // Границы слова обязательны: иначе `compute` цепляется за `computeFrom`, `each` — за
      // `eachRow`, и выдача заполняется однокоренным шумом.
      const re = new RegExp(`\\b${doc.symbol.name.replace(/[$]/g, '\\$')}\\b`);
      if (!re.test(haystack)) continue;
      // Редкость упоминания решает. `FormField` встречается почти в каждой теме и потому не
      // говорит о запросе ничего — без этой поправки он выигрывал все запросы про формы.
      // `symbol.topics` посчитан на билде: в скольких темах документации символ вообще
      // упоминается. Один-две темы → сигнал сильный, тридцать → шум.
      const inTopics = Math.max(1, doc.symbol.topics?.length ?? 1);
      const specificity = Math.log(1 + (totalTopics - inTopics + 0.5) / (inTopics + 0.5));
      fromDocs.set(doc.symbol.name, (fromDocs.get(doc.symbol.name) ?? 0) + weight * specificity);
    }
  }

  const byName = new Map(docs.map((d) => [d.symbol.name, d.symbol]));
  const merged: SymbolHit[] = [];
  for (const name of new Set([...direct.keys(), ...fromDocs.keys()])) {
    const symbol = byName.get(name);
    if (!symbol) continue;
    if (restrictTo && symbol.package !== restrictTo) continue;
    // Упоминание в релевантной секции — сильный сигнал: там символ показан В КОНТЕКСТЕ задачи.
    const score =
      (direct.get(name) ?? 0) + (fromDocs.get(name) ?? 0) * 4 * popularityBoost(symbol.usage);
    merged.push({ symbol, score });
  }

  merged.sort((a, b) => b.score - a.score || a.symbol.name.localeCompare(b.symbol.name));
  return merged.slice(0, Math.max(1, limit));
}

/** Компактное представление символа для выдачи: имя, вид, пакет, одна фраза назначения. */
export function renderSymbolHits(hits: SymbolHit[]): string {
  return hits
    .map(({ symbol }) => {
      const summary = symbol.summary ? ` — ${symbol.summary}` : '';
      return `- \`${symbol.name}\` (${symbol.kind}, ${symbol.package})${summary}`;
    })
    .join('\n');
}

/** Только для тестов — сбросить кэш документов. */
export function __resetSymbolSearchCache(k: Knowledge): void {
  k.memo.delete('search:symbol-corpus');
}
