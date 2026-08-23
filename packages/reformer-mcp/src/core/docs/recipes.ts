/**
 * Рецепты — исходные файлы `docs/llms/NN-<topic>.md` пакетов, до склейки в `llms.txt`.
 *
 * Отдельный порт от {@link DocsSource}, потому что это другой носитель: `llms.txt` — один
 * агрегированный текст, а здесь каталог файлов, который надо ПЕРЕЧИСЛИТЬ, чтобы подобрать имя
 * по топику. В браузере каталога не будет, и это осознанная деградация: первая стадия
 * `find_recipe` отключится, а топик уйдёт в каскад по секциям `llms.txt` — он для того и
 * делался. Терять при этом нечего, кроме точного попадания по имени файла.
 *
 * @module reformer-mcp/core/docs/recipes
 */

import { normalizeTopic } from './sections.js';

/** Откуда берутся файлы `docs/llms`. Отсутствие каталога — пустой список, не ошибка. */
export interface RecipeSource {
  /** Имена `.md`-файлов в `docs/llms` пакета, в порядке каталога. */
  list(pkg: string): string[];
  /** Содержимое файла; `null` — недоступен. */
  read(pkg: string, fileName: string): string | null;
}

/** Источник-заглушка для сред без файлов рецептов (браузер). */
export const EMPTY_RECIPE_SOURCE: RecipeSource = {
  list: () => [],
  read: () => null,
};

export interface DocFile {
  fileName: string;
  title: string;
  /** Полный текст файла — читается один раз, вместе с заголовком. */
  body: string;
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
 * Файл рецепта, чьё имя лучше всего отвечает топику. Принимает и сырую форму, и с префиксом
 * («recipes» → «05-recipes.md»).
 */
export function findDocFile(source: RecipeSource, pkg: string, topic: string): DocFile | null {
  const entries = source.list(pkg).filter((f) => f.endsWith('.md'));
  const fileName = pickBestDocFile(entries, topic);
  if (!fileName) return null;

  const body = source.read(pkg, fileName);
  if (body === null) return null;

  const titleMatch = body.match(/^#\s+(.+)$/m);
  const stripped = fileName.replace(/\.md$/, '').toLowerCase().replace(/^\d+-/, '');
  return { fileName, title: titleMatch ? titleMatch[1].trim() : stripped, body };
}

/** Человекочитаемые имена рецептов пакета — для подсказки при промахе. */
export function listRecipeNames(source: RecipeSource, pkg: string): string[] {
  return source
    .list(pkg)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, '').replace(/^\d+-/, ''));
}
