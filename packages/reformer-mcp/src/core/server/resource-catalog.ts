/**
 * Каталог ресурсов сервера — `resources/list` и `resources/read`, общие для всех платформ.
 *
 * Схема адресов:
 *
 *   reformer://guide                        — вводная: правило раскладки + llms.txt самого MCP
 *   reformer://catalog                      — машиночитаемая карта пакетов → секции
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
import type { Knowledge } from '../knowledge.js';

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

export interface ResourceCatalog {
  list(): ResourceEntry[];
  /** Прочитать ресурс. Неизвестный адрес — исключение с перечнем того, что есть. */
  read(uri: string): ReadResourceResult;
}

/**
 * Сводка правила раскладки файлов — печатается ПЕРЕД полным текстом гайда.
 *
 * `reformer://guide` отдаёт весь llms.txt пакета (~47 КБ), и замер
 * (`docs/plans/mcp-layout-authority.md`) показал: имена файлов формы доезжали до агента ровно
 * одним способом — чтением этого документа целиком. Прогон точечными запросами получил 5/10
 * совпадений с каноном, прогон, начавший с guide, — 8/9. Правило, стоящее первым абзацем,
 * доезжает и до тех, кто читает только начало; полный per-target список остаётся ниже по тексту
 * и в `find_recipe directory-layout`.
 */
export const FORM_LAYOUT_ENTRY = [
  '> **Form file layout — read this even if you read nothing else here.**',
  '>',
  '> A form module is FLAT: no role folders (a large form uses the `folders` layout). Wizard steps live',
  '> in the root schema OR one folder per step `steps/<slug>/` (kebab slug of the step title, no',
  '> number) with the aggregator `steps/index.ts`; inside a step folder the names are the same.',
  '> Naming rule and file set, identical for every target: `form.<role>` is a form artifact whose',
  '> suffix names the role; every other file is plain-named (`index.tsx`, `types.ts`, `model.ts`,',
  '> `data-sources.ts`, `api.ts`):',
  '>',
  '> - **schema** — `form.schema.ts` (`.tsx` when the schema contains JSX): ONE tree for the form',
  '>   and its layout. For renderer-json a plain `form.schema.json` is an accepted variant, but it',
  '>   loses compile-time checking of `$model(...)` paths that `defineJsonSchema<T>` gives.',
  '> - **behavior** — `form.behavior.ts`: the ONLY behavior of the form — links over the model and',
  "> rules for schema nodes (`hideWhen(schema.node('selector'), …)`).",
  '> - **validation** — `form.validation.ts` (rules over the model; wizard step key = step',
  '>   `selector`).',
  '>',
  '> renderer-json also has `registry.ts`. There is no `form.render.ts` and no `wizard.tsx` shim:',
  '> node rules live in `form.behavior.ts`, the wizard is the library `FormWizard` with steps in',
  '> `children`. Files of the former contract (`form.render.ts`, `wizard.tsx`, `renderer.*`,',
  '> `validation.ts`) still work but are reported as outdated.',
  '> File names are not a free choice. Full per-target list: `find_recipe directory-layout`, or',
  '> the "Form directory layout" section below. Check the names you picked with',
  '> `validate_form kind="layout"` — before writing, not after.',
  '',
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
    list() {
      const resources: ResourceEntry[] = [
        {
          uri: 'reformer://guide',
          name: 'ReFormer MCP — start-here guide',
          description:
            'Entry point: the canonical form-building workflow, the mandatory flat form file layout (`form.<role>` files: schema, behavior, validation, optional flow and messages), and a map of which MCP tool/resource to use at each step; the layout rule is in the opening lines.',
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
      // Вводная → полная самодокументация MCP-сервера.
      if (uri === 'reformer://guide') {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: `${FORM_LAYOUT_ENTRY}\n${docs().full(OWN_PACKAGE)}`,
            },
          ],
        };
      }

      if (uri === 'reformer://catalog') {
        return { contents: [{ uri, mimeType: 'application/json', text: buildCatalog() }] };
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

      const text = docs().sectionBySlug(pkg, slug);
      if (text === null) {
        const available = docs()
          .sections(pkg)
          .map((section) => section.slug)
          .join(', ');
        throw new Error(`Unknown section "${slug}" in ${pkg}. Available: ${available}.`);
      }
      return { contents: [{ uri, mimeType: 'text/markdown', text }] };
    },
  };
}
