/**
 * Источники знания для браузера: всё берётся из уже загруженного артефакта.
 *
 * Порты ядра синхронные (см. обоснование в `core/docs/corpus.ts`), поэтому асинхронность
 * живёт СНАРУЖИ: артефакт скачивается и разбирается до создания знания, а источники потом
 * только читают из памяти. Это же делает поведение предсказуемым — ни один вызов инструмента
 * не может внезапно уйти в сеть посреди хода агента.
 *
 * @module reformer-mcp/platform/browser/sources
 */

import { isSupportedBundle, type DocsBundle, type IndexBundle } from '../../core/bundle.js';
import type { DocsSource } from '../../core/docs/corpus.js';
import type { RecipeSource } from '../../core/docs/recipes.js';
import type { IndexSource } from '../../core/index/merge.js';
import type { SpecSource } from '../../core/spec/source.js';

/** Документация из артефакта. Отсутствующий пакет — просто отсутствующий, не ошибка. */
export function createBundleDocsSource(bundle: DocsBundle | null): DocsSource {
  const packages = bundle && isSupportedBundle(bundle) ? bundle.packages : {};
  return {
    has: (pkg) => typeof packages[pkg] === 'string',
    read: (pkg) => packages[pkg] ?? null,
  };
}

/** Один файл `docs/llms`, восстановленный из `llms.txt`. */
interface RecoveredDoc {
  readonly fileName: string;
  readonly content: string;
}

/**
 * Файлы `docs/llms/*.md` пакета, восстановленные из его `llms.txt`.
 *
 * `llms.txt` — склейка этих файлов (`scripts/generate-llms-txt`): оглавление перечисляет
 * `- <файл> — <заголовок>` в порядке склейки, а первая секция каждого файла открывается строкой
 * `**<заголовок>**`. По этим двум меткам границы файлов находятся без потерь, и рецепт
 * собирается заново — заголовок, вводный текст, секции уровня 2.
 */
export function recoverDocFiles(llms: string): RecoveredDoc[] {
  const toc = [...llms.matchAll(/^- (\S+\.md) — (.+)$/gm)].map((m) => ({
    file: m[1],
    title: m[2].trim(),
  }));
  if (toc.length === 0) return [];
  const sections = [...llms.matchAll(/^## \d+\. (.+)$/gm)].map((m, i, all) => ({
    heading: m[1].trim(),
    body: llms.slice((m.index ?? 0) + m[0].length, all[i + 1]?.index ?? llms.length).trim(),
  }));

  const out: RecoveredDoc[] = [];
  let next = 0;
  let current: { file: string; title: string; parts: string[] } | null = null;
  const flush = () => {
    if (current) out.push({ fileName: current.file, content: current.parts.join('\n\n') + '\n' });
  };
  for (const section of sections) {
    if (section.heading === 'API Reference') break;
    const opener = next < toc.length ? `**${toc[next].title}**` : null;
    if (opener && section.body.startsWith(opener)) {
      flush();
      current = { file: toc[next].file, title: toc[next].title, parts: [`# ${toc[next].title}`] };
      next++;
      const lead = section.body.slice(opener.length).trim();
      // Вводный текст файла стоит в теле его первой секции ПЕРЕД самой секцией — отделить его
      // нельзя, поэтому он остаётся под заголовком секции, как в llms.txt.
      current.parts.push(`## ${section.heading}\n\n${lead}`);
      continue;
    }
    current?.parts.push(`## ${section.heading}\n\n${section.body}`);
  }
  flush();
  return out;
}

/**
 * Рецепты из артефакта документации — те же файлы `docs/llms`, что читает CLI с диска.
 *
 * Раньше профиль браузера рецептов не имел вовсе, и `find_recipe` (а с ним шаг рецепта в
 * `askReformer` ассистента) уходил в поиск по заголовкам секций: на `wizard` отвечал секцией
 * «FormWizard.Indicator» из cdk вместо рецепта визарда, на `directory-layout` — чужой секцией
 * renderer-json (калибровка, паритет каналов). Файлы восстанавливаются из того же `llms.txt`,
 * поэтому бандл не тяжелеет.
 */
export function createBundleRecipeSource(bundle: DocsBundle | null): RecipeSource {
  const packages = bundle && isSupportedBundle(bundle) ? bundle.packages : {};
  const cache = new Map<string, RecoveredDoc[]>();
  const files = (pkg: string): RecoveredDoc[] => {
    let docs = cache.get(pkg);
    if (!docs) {
      docs = typeof packages[pkg] === 'string' ? recoverDocFiles(packages[pkg]) : [];
      cache.set(pkg, docs);
    }
    return docs;
  };
  return {
    list: (pkg) => files(pkg).map((d) => d.fileName),
    read: (pkg, fileName) => files(pkg).find((d) => d.fileName === fileName)?.content ?? null,
  };
}

/** Индексы из артефакта. Проверку версии самого индекса делает ядро (`asPackageIndex`). */
export function createBundleIndexSource(bundle: IndexBundle | null): IndexSource {
  const packages = bundle && isSupportedBundle(bundle) ? bundle.packages : {};
  return {
    read: (pkg) => packages[pkg] ?? null,
  };
}

/**
 * Спеки, уже прочитанные хостом.
 *
 * В браузере файл приходит через drag&drop или файловый пикер, то есть его содержимое к
 * моменту вызова инструмента заведомо в памяти. Ключом служит имя файла — то же, что
 * пользователь видит в интерфейсе и что естественно передать в `specPath`.
 */
export function createMemorySpecSource(files: ReadonlyMap<string, string>): SpecSource {
  return {
    describe: () => 'загруженных файлов',
    read: (ref) => files.get(ref) ?? null,
  };
}
