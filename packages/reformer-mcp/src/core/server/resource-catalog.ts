/**
 * Каталог ресурсов сервера — `resources/list` и `resources/read`, общие для всех платформ.
 *
 * Схема адресов:
 *
 *   reformer://guide                        — вводная: один путь к форме и указатели (≤ 6 КБ)
 *   reformer://catalog                      — машиночитаемая карта пакетов → секции
 *   reformer://status                       — что сервер нашёл: пакеты, индексы, проверка типов
 *   reformer://docs/<pkg-short>             — полный llms.txt одного пакета
 *   reformer://docs/<pkg-short>/<section>   — одна секция уровня 2, по слагу
 *
 * Читается всё из корпуса знания (`knowledge.docs`), а не с диска: под Node корпус собран над
 * файлами, в воркере — над вшитым артефактом, а адреса и тексты одни и те же. Раньше обработчики
 * жили в `src/index.ts` поверх Node-фасада `utils/docs-parser` — и в браузер не годились.
 *
 * Слаги секций дают `sections()` корпуса (разбор заголовков `llms.txt` + `slugify`); они стабильны,
 * пока не меняются сами заголовки.
 *
 * ## Почему секции НЕ перечисляются в `resources/list`
 *
 * Замерено на этом сервере — `resources/list` отдавал 350 записей ≈ 20 900 токенов, и это платил
 * КАЖДЫЙ клиент при подключении, до первого полезного действия (для сравнения: tools/list ≈ 2 291,
 * prompts/list ≈ 1 564). 350 × 200-символьный preview — самая большая единичная статья расхода во
 * всём сервере. Теперь список — несколько записей, а полный перечень секций доступен по требованию
 * через `reformer://catalog` (компактный JSON без preview) и через `search_docs`, который и так
 * возвращает готовые `reformer://docs/…` URI. Сами URI секций читаются как раньше.
 *
 * @module reformer-mcp/core/server/resource-catalog
 */

import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { OWN_PACKAGE } from '../docs/packages.js';
import { listRecipeNames } from '../docs/recipes.js';
import type { Knowledge } from '../knowledge.js';
import { describeKnowledge } from '../status.js';

/** Запись `resources/list`. */
export interface ResourceEntry {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType: string;
}

export interface ResourceCatalogOptions {
  /** Отладочный ресурс `reformer://debug`. */
  readonly debug?: boolean;
}

/** Запись `resources/templates/list`. */
export interface ResourceTemplateEntry {
  readonly uriTemplate: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType: string;
}

export interface ResourceCatalog {
  list(): ResourceEntry[];
  /** Шаблоны адресов — схема `reformer://docs/{package}/{slug}`. */
  templates(): ResourceTemplateEntry[];
  /** Прочитать ресурс. Неизвестный адрес — исключение с перечнем того, что есть. */
  read(uri: string): ReadResourceResult;
}

/**
 * Раздел самодокументации, который отдаёт `reformer://guide`: первый раздел `docs/llms/01-guide.md`.
 *
 * Раньше гайдом был весь `llms.txt` пакета (~100 тыс. символов): он не называл `form_build` и не
 * помещался в контекст малой локальной модели — Ollama отрезала начало переписки вместе с заданием
 * (аудит 2026-11, A5; ReFormer-qo9b.36). Теперь гайд — контракт и указатели, а полный текст отдаёт
 * `reformer://docs/mcp`.
 */
export const GUIDE_SECTION = 'start-here-one-path-to-a-form';

/** Потолок гайда в байтах: его читает любая модель, включая малые. */
export const GUIDE_LIMIT_BYTES = 6 * 1024;

/** Гайд, когда самодокументация не найдена: путь к форме важнее, чем её отсутствие. */
const GUIDE_FALLBACK = [
  '# ReFormer MCP — guide',
  '',
  'Write `<dir>/form.intent.json`, then `form_build {"dir":"<dir>"}` compiles, checks and writes the',
  'module. The grammar: `form_build {"grammar":"base"}`. The self-doc of this server was not found —',
  'see `reformer://status`.',
].join('\n');

function packageShortName(pkg: string): string {
  return pkg.replace(/^@reformer\//, '');
}

/**
 * Собрать каталог ресурсов.
 *
 * @param knowledge - Знание сервера; функция — корпус разбирается на первое чтение.
 */
export function createResourceCatalog(
  knowledge: () => Knowledge,
  options: ResourceCatalogOptions = {}
): ResourceCatalog {
  const docs = () => knowledge().docs;

  /** `<pkg-short>` (например, `core`) → полное имя пакета; `null` — неизвестен или без llms.txt. */
  const resolvePackage = (short: string): string | null => {
    if (!short) return null;
    const full = `@reformer/${short}`;
    return (docs().packages() as readonly string[]).includes(full) ? full : null;
  };

  /**
   * Файл рецепта по имени без номера (`cdk/field-array` → `02-field-array.md`). Секции
   * адресуются слагом заголовка, а `find_recipe` в строке Source печатает имя файла, и документ
   * ресурсов приводит адреса файлов: без этого они отвечали «Unknown section» (ReFormer-pihy).
   * Совпадение только точное: близкие имена подбирает `find_recipe`, а не чтение по адресу.
   */
  const recipeFile = (pkg: string, name: string): string | null => {
    const recipes = knowledge().recipes;
    const stem = name.replace(/\.md$/i, '').toLowerCase();
    const fileName = recipes.list(pkg).find((file) => {
      const own = file.replace(/\.md$/i, '').toLowerCase();
      return own === stem || own.replace(/^\d+-/, '') === stem;
    });
    return fileName ? recipes.read(pkg, fileName) : null;
  };

  /**
   * Компактная карта всего, что читается под `reformer://docs/…`.
   *
   * Заменяет посекционные записи, раздувавшие `resources/list`: та же находимость, но платит
   * только тот, кто спросил (~22k символов на все 343 секции против ~84k у прежнего листинга,
   * который платил каждый клиент при подключении).
   */
  const buildCatalog = (): string =>
    // Компактно и без отступов: 343 секции — уже ~30k символов одними заголовками, а
    // pretty-print добавляет к ним ещё треть. Секция описывается парой [slug, title],
    // потому что больше для сборки URI ничего не нужно.
    //
    // Именно МАССИВ пар, а не объект `{ slug: title }`: слаг может оказаться числовым
    // (`"1"` ← «61. Путь 1 — строковые пропы» — кириллица вырезается slugify), а JS
    // поднимает целочисленные ключи объекта в начало, ломая порядок документа.
    JSON.stringify({
      readSection: 'reformer://docs/<package>/<slug>',
      sectionShape: '[slug, title]',
      hint: 'Prefer search_docs(query) — it returns ready URIs. Scan this catalog only when you need the full map.',
      packages: docs()
        .packages()
        .map((pkg) => ({
          id: packageShortName(pkg),
          sections: docs()
            .sections(pkg)
            .map((section) => [section.slug, section.title]),
        })),
    });

  return {
    templates() {
      const packages = docs().packages().map(packageShortName).join(', ');
      return [
        {
          uriTemplate: 'reformer://docs/{package}/{slug}',
          name: 'ReFormer docs section',
          description: `One documentation section. package: ${packages}; slug: from reformer://catalog or search_docs.`,
          mimeType: 'text/markdown',
        },
      ];
    },

    list() {
      const resources: ResourceEntry[] = [
        {
          uri: 'reformer://guide',
          name: 'ReFormer MCP — start-here guide',
          description:
            'Start here: the one path to a form (form.intent.json → form_build), what the build writes, the contract for your own code, and which tool or resource to use. Under 6 KB; the full self-doc is reformer://docs/mcp.',
          mimeType: 'text/markdown',
        },
        {
          uri: 'reformer://catalog',
          name: 'ReFormer docs catalog',
          description:
            'JSON map of every package → its documentation sections (slug + title). Read it to discover reformer://docs/<pkg>/<slug> URIs; use search_docs when you can describe the task in words.',
          mimeType: 'application/json',
        },
      ];

      if (knowledge().status) {
        resources.push({
          uri: 'reformer://status',
          name: 'ReFormer MCP — environment status',
          description:
            'JSON: which @reformer/* packages the server found (where, version, index, docs), whether form type-checking is available, the ui-kit catalog, and what failed to load. Read it when docs come back empty or a tool reports an environment problem.',
          mimeType: 'application/json',
        });
      }

      for (const pkg of docs().packages()) {
        const short = packageShortName(pkg);
        resources.push({
          uri: `reformer://docs/${short}`,
          name: `${pkg} (full docs)`,
          description: `Full llms.txt for ${pkg} — ${docs().sections(pkg).length} sections concatenated. Individual sections: reformer://docs/${short}/<slug> (see reformer://catalog).`,
          mimeType: 'text/markdown',
        });
      }

      if (options.debug) {
        resources.push({
          uri: 'reformer://debug',
          name: 'Debug Info',
          description: 'Debug information for MCP server development',
          mimeType: 'text/markdown',
        });
      }
      return resources;
    },

    read(uri) {
      // Вводная — первый раздел самодокументации; полный текст — reformer://docs/mcp.
      if (uri === 'reformer://guide') {
        const section = docs().sectionBySlug(OWN_PACKAGE, GUIDE_SECTION);
        const text = section ? section.replace(/^## \d+\.\s*/, '# ') : GUIDE_FALLBACK;
        return { contents: [{ uri, mimeType: 'text/markdown', text }] };
      }

      if (uri === 'reformer://catalog') {
        return { contents: [{ uri, mimeType: 'application/json', text: buildCatalog() }] };
      }

      if (uri === 'reformer://status') {
        const k = knowledge();
        if (!k.status) throw new Error(`Unknown resource: ${uri}`);
        const text = JSON.stringify(describeKnowledge(k, k.status()), null, 2);
        return { contents: [{ uri, mimeType: 'application/json', text }] };
      }

      if (uri === 'reformer://debug') {
        if (!options.debug) throw new Error(`Unknown resource: ${uri}`);
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: `# Debug Info\n\nAvailable packages: ${docs().packages().join(', ')}`,
            },
          ],
        };
      }

      // reformer://docs/<pkg-short>[/<section-slug>]
      const match = uri.match(/^reformer:\/\/docs\/([^/]+)(?:\/(.+))?$/);
      if (!match) {
        throw new Error(
          `Unknown resource: ${uri}. Expected reformer://docs/<package>[/<section-slug>].`
        );
      }
      const [, short, slug] = match;
      const pkg = resolvePackage(short);
      if (!pkg) {
        const known = docs().packages().map(packageShortName).join(', ');
        throw new Error(`Unknown package "${short}". Available: ${known}.`);
      }

      if (!slug) {
        return { contents: [{ uri, mimeType: 'text/markdown', text: docs().full(pkg) }] };
      }

      const text = docs().sectionBySlug(pkg, slug) ?? recipeFile(pkg, slug);
      if (text === null) {
        const available = docs()
          .sections(pkg)
          .map((section) => section.slug)
          .join(', ');
        const files = listRecipeNames(knowledge().recipes, pkg);
        throw new Error(
          `Unknown section "${slug}" in ${pkg}. Available: ${available}.` +
            (files.length > 0 ? ` Files: ${files.join(', ')}.` : '')
        );
      }
      return { contents: [{ uri, mimeType: 'text/markdown', text }] };
    },
  };
}
