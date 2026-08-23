/**
 * Корпус документации: `llms.txt` всех установленных пакетов плюс разбор на секции.
 *
 * Порт {@link DocsSource} — единственное, что корпус знает о среде. В CLI за ним диск с
 * резолвом путей под npx/pnpm, в браузере — предзагруженный артефакт. Всё остальное (кэши,
 * слаги, поиск секций) одинаково везде.
 *
 * Почему источник СИНХРОННЫЙ, хотя браузер читает асинхронно. Асинхронность здесь заразна:
 * `getSectionBySlug` зовётся из `search_docs`, тот — из `find_recipe` и сборщика контекста, и
 * дальше async расползся бы по всему ядру ради одной операции, которая в CLI синхронна по
 * природе. Поэтому граница проведена раньше: браузерная реализация загружает артефакт ДО
 * создания корпуса и отдаёт из памяти. Асинхронно только создание источника, не чтение из него.
 *
 * @module reformer-mcp/core/docs/corpus
 */

import { DEFAULT_PACKAGE, KNOWN_PACKAGES, type ReformerPackage } from './packages.js';
import {
  extractSection,
  extractSectionByMeta,
  parseSections,
  type SectionMeta,
  type SectionName,
} from './sections.js';

/**
 * Откуда корпус берёт `llms.txt`.
 *
 * `has` отдельно от `read` не ради красоты: перечисление доступных пакетов вызывается на каждом
 * `resources/list` и на каждой сборке поискового индекса, а читать ради этого 1.2 МБ текста
 * незачем. На диске `has` — это `existsSync`, в браузере — наличие ключа в карте.
 */
export interface DocsSource {
  /** Доступен ли `llms.txt` пакета. Не должен читать содержимое. */
  has(pkg: string): boolean;
  /** Текст `llms.txt` пакета; `null` — недоступен или не читается. */
  read(pkg: string): string | null;
}

export interface DocsCorpus {
  /** Пакеты, у которых `llms.txt` реально доступен, в порядке {@link KNOWN_PACKAGES}. */
  packages(): ReformerPackage[];
  /** Полный текст `llms.txt` пакета; при отсутствии — объясняющая заглушка (не бросает). */
  full(pkg?: string): string;
  /** Все доступные `llms.txt`, склеенные с заголовками-разделителями. */
  all(): string;
  /** Секции уровня 2 пакета. Пустой массив, если документации нет. */
  sections(pkg: string): SectionMeta[];
  /** Тело секции по слагу; `null` — слаг неизвестен. */
  sectionBySlug(pkg: string, slug: string): string | null;
  /** Секция по имени заголовка (подстрочно, нормализованно); при промахе — объясняющий текст. */
  section(name: SectionName | string, pkg?: string): string;
}

/** Текст-заглушка вместо исключения: отсутствие одного пакета не должно ронять ответ целиком. */
export function docsNotFound(pkg: string): string {
  return `${pkg} documentation not found. Please ensure ${pkg} is installed or built (run npm run generate:llms).`;
}

/**
 * Собрать корпус поверх источника.
 *
 * Кэши живут в замыкании, а не на модуле: два корпуса (например, вшитый артефакт и папка
 * проекта) должны иметь независимое состояние, иначе второй увидит документацию первого.
 */
export function createDocsCorpus(source: DocsSource): DocsCorpus {
  const docsCache = new Map<string, string>();
  const sectionsCache = new Map<string, SectionMeta[]>();

  const full = (pkg: string = DEFAULT_PACKAGE): string => {
    const cached = docsCache.get(pkg);
    if (cached !== undefined) return cached;
    const content = source.read(pkg) ?? docsNotFound(pkg);
    docsCache.set(pkg, content);
    return content;
  };

  const sections = (pkg: string): SectionMeta[] => {
    const cached = sectionsCache.get(pkg);
    if (cached) return cached;
    const docs = full(pkg);
    const result = docs.startsWith(`${pkg} documentation not found`) ? [] : parseSections(docs);
    sectionsCache.set(pkg, result);
    return result;
  };

  const all = (): string => {
    const parts: string[] = [];
    for (const pkg of KNOWN_PACKAGES) {
      const docs = full(pkg);
      if (!docs.startsWith(`${pkg} documentation not found`)) {
        parts.push(`# ===== ${pkg} =====\n\n${docs}`);
      }
    }
    return parts.join('\n\n');
  };

  return {
    packages: () => KNOWN_PACKAGES.filter((pkg) => source.has(pkg)),
    full,
    all,
    sections,
    sectionBySlug: (pkg, slug) => {
      const meta = sections(pkg).find((s) => s.slug === slug);
      return meta ? extractSectionByMeta(full(pkg), meta) : null;
    },
    section: (name, pkg = DEFAULT_PACKAGE) => {
      const docs = pkg === '*' ? all() : full(pkg);
      return (
        extractSection(docs, name) ??
        `Section "${name}" not found in ${pkg === '*' ? 'any package' : pkg} documentation.`
      );
    },
  };
}
