/**
 * Правила раскладки каталогов — общие для билдера и для доменов-плагинов проекта.
 *
 * Сами проверки живут тестами рядом с тем, что проверяют: `src/structure.test.ts` — исходники
 * билдера, `integration/structure.test.ts` домена — пакеты его плагинов. Здесь то, что у них
 * одно на всех: что считать модулем, сколько их терпит каталог, что вправе лежать в корне
 * плагина. Правило, записанное дважды, разошлось бы на первой же правке порога — и домен,
 * уехавший из билдера, тихо перестал бы ему подчиняться.
 *
 * Обоснования порогов — в шапке `src/structure.test.ts`.
 *
 * @module testing/structure
 */

import { readdirSync, statSync } from 'node:fs';

/** Сколько модулей в одном каталоге ещё читается списком. */
export const MODULE_LIMIT = 15;

/**
 * Сколько доменных модулей корень плагина терпит, прежде чем их пора разложить.
 *
 * Ноль здесь был бы догмой: у валидатора схемы шесть чистых модулей без состояния, и шесть
 * каталогов по одному файлу — это шум вместо навигации. Планка отделяет «маленький плагин
 * живёт плоско» от «плагин пора разбирать».
 */
export const DOMAIN_IN_ROOT_LIMIT = 6;

/** Служебные имена контракта: их место — корень плагина, и только их. */
export const SERVICE_NAMES: ReadonlySet<string> = new Set([
  'index.ts',
  'plugin.ts',
  'host.ts',
  'contract.ts',
  'messages.ts',
  'testing.ts',
]);

/**
 * Каталог, которому порог не писан, и почему.
 *
 * Планка исключения — не «сколько там сейчас», а «сколько допустимо»: она обязана оставлять
 * запас на рост, но падать, если каталог поедет дальше без разговора.
 */
export interface LayoutException {
  readonly limit: number;
  readonly why: string;
}

export type LayoutExceptions = Readonly<Record<string, LayoutException>>;

/**
 * Тест рядом с кодом каталогу сущностей не добавляет: `ops.test.ts` ищут не сам по себе,
 * а вместе с `ops.ts`. Считать файлы значило бы наказывать за покрытие.
 */
export const isModule = (name: string): boolean =>
  /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.browser\.test\.tsx?$/.test(name);

/**
 * Каталоги, которые не про исходники: снимки, голдены, фикстуры, словари, выход генераторов —
 * и то, что рядом с исходниками пакета плагина кладут npm и сборка.
 */
const SKIP = new Set([
  '__golden__',
  '__fixtures__',
  '__snapshots__',
  'locales',
  'generated',
  'node_modules',
  'dist',
]);

const trimmed = (path: string): string => path.replace(/[\\/]$/, '');

const isDirectory = (path: string): boolean => statSync(path).isDirectory();

/**
 * Число модулей в каждом каталоге под `root`.
 *
 * Ключ — путь каталога от `root`; сам `root` записан под именем `rootLabel`.
 */
export function moduleCounts(root: string, rootLabel = '.'): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (absolute: string, relative: string): void => {
    let modules = 0;
    for (const name of readdirSync(absolute)) {
      const child = `${absolute}/${name}`;
      if (isDirectory(child)) {
        if (SKIP.has(name)) continue;
        walk(child, relative === '' ? name : `${relative}/${name}`);
      } else if (isModule(name)) {
        modules += 1;
      }
    }
    counts.set(relative === '' ? rootLabel : relative, modules);
  };
  walk(trimmed(root), '');
  return counts;
}

/** Каталоги сверх своей планки — строками, готовыми к показу в отказе теста. */
export function overLimit(
  counts: ReadonlyMap<string, number>,
  exceptions: LayoutExceptions = {}
): string[] {
  return [...counts]
    .filter(([dir, modules]) => modules > (exceptions[dir]?.limit ?? MODULE_LIMIT))
    .map(
      ([dir, modules]) =>
        `${dir}: ${modules} модулей (порог ${exceptions[dir]?.limit ?? MODULE_LIMIT})`
    );
}

/**
 * Исключения, переставшие быть нужными.
 *
 * Список исключений — храповик в обе стороны: каталог сверх порога без записи роняет тест,
 * но и запись, которой каталог уже не требует, роняет его тоже. Иначе список копил бы мёртвые
 * строки, а через год никто не знал бы, какие из них ещё что-то значат.
 */
export function staleExceptions(
  counts: ReadonlyMap<string, number>,
  exceptions: LayoutExceptions
): string[] {
  return Object.keys(exceptions).filter((dir) => (counts.get(dir) ?? 0) <= MODULE_LIMIT);
}

/**
 * Доменные модули прямо в корне плагина: всё, что там лежит сверх служебных имён.
 *
 * `service` — служебные имена этого вида плагина: у пакета плагина проекта к общему списку
 * добавляется вход сборки.
 */
export function domainModulesInRoot(
  pluginRoot: string,
  service: ReadonlySet<string> = SERVICE_NAMES
): string[] {
  const root = trimmed(pluginRoot);
  return readdirSync(root)
    .filter((entry) => isModule(entry) && !service.has(entry))
    .filter((entry) => statSync(`${root}/${entry}`).isFile());
}

/**
 * Словарь плагина уехал из корня в подкаталог.
 *
 * Проверка полноты словарей ищет их по именам `locales` и `messages.ts` В КОРНЕ плагина.
 * Уехавший в подкаталог словарь не сломает приложение — он просто выпадет из проверки, и его
 * локали разъедутся молча.
 */
export function dictionaryMisplaced(pluginRoot: string): boolean {
  const root = trimmed(pluginRoot);
  const entries = readdirSync(root);
  if (entries.includes('locales') || entries.includes('messages.ts')) return false;
  return entries.some(
    (entry) =>
      isDirectory(`${root}/${entry}`) &&
      readdirSync(`${root}/${entry}`).some(
        (inner) => inner === 'locales' || inner === 'messages.ts'
      )
  );
}
