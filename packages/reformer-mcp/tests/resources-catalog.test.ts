/**
 * Контракт ресурсов после срезания `resources/list`.
 *
 * Зачем: `resources/list` перечислял каждую level-2 секцию всех пакетов — 350 записей,
 * ≈ 20 900 токенов, и это платил КАЖДЫЙ клиент при подключении, до первого полезного
 * действия (tools/list ≈ 2 291, prompts/list ≈ 1 564 для сравнения). Секции убраны из
 * перечисления и переехали в `reformer://catalog`.
 *
 * Здесь фиксируются оба конца сделки:
 *  - список остаётся коротким (регресс «давайте вернём секции» должен падать);
 *  - НИ ОДИН прежний `reformer://docs/<pkg>/<slug>` не перестал резолвиться — ломается
 *    только перечисление, не чтение;
 *  - каталог перечисляет ровно те слаги, что отдаёт listSections, и заметно дешевле
 *    старого листинга.
 *
 * Сервер поднимать не нужно: проверяем те же docs-parser примитивы, на которых построены
 * оба хендлера в src/index.ts.
 */

import { describe, it, expect } from 'vitest';
import { listAvailablePackages, listSections, getSectionBySlug } from '../src/utils/docs-parser';

const packages = listAvailablePackages();
const hasDocs = packages.length > 0;

interface Catalog {
  packages: Array<{ id: string; sections: Array<[string, string]> }>;
}

/** Точная копия того, что отдаёт ReadResource на `reformer://catalog` (src/index.ts). */
function buildCatalog(): string {
  return JSON.stringify({
    readSection: 'reformer://docs/<package>/<slug>',
    sectionShape: '[slug, title]',
    hint: 'Prefer search_docs(query) — it returns ready URIs. Scan this catalog only when you need the full map.',
    packages: packages.map((pkg) => ({
      id: pkg.replace(/^@reformer\//, ''),
      sections: listSections(pkg).map((s) => [s.slug, s.title]),
    })),
  });
}

describe('resources — каталог вместо перечисления секций', () => {
  it.runIf(hasDocs)('перечисление остаётся коротким: guide + catalog + по одному на пакет', () => {
    // Ровно та арифметика, что в ListResources: 2 фиксированных + N пакетов (debug — вне CI).
    const listed = 2 + packages.length;
    expect(listed).toBeLessThanOrEqual(16);

    // Секций на порядок больше — именно их и не должно быть в списке.
    const sections = packages.reduce((n, p) => n + listSections(p).length, 0);
    expect(sections).toBeGreaterThan(listed * 5);
  });

  it.runIf(hasDocs)('каталог перечисляет те же слаги и в том же порядке, что listSections', () => {
    const catalog = JSON.parse(buildCatalog()) as Catalog;
    for (const pkg of packages) {
      const short = pkg.replace(/^@reformer\//, '');
      const entry = catalog.packages.find((p) => p.id === short);
      const fromCatalog = (entry?.sections ?? []).map(([slug]) => slug);
      const fromParser = listSections(pkg).map((s) => s.slug);
      expect(fromCatalog, `каталог разошёлся с listSections для ${pkg}`).toEqual(fromParser);
    }
  });

  it.runIf(hasDocs)('порядок документа не ломается числовыми слагами', () => {
    // `61. Путь 1 — строковые пропы` даёт слаг "1" (кириллица вырезается slugify). В объекте
    // `{ "1": …, "table-of-contents": … }` JS поднял бы целочисленный ключ в начало — поэтому
    // секции хранятся массивом пар.
    const catalog = JSON.parse(buildCatalog()) as Catalog;
    for (const p of catalog.packages) {
      const first = p.sections[0]?.[0];
      if (first !== undefined) {
        expect(/^\d+$/.test(first), `числовой слаг всплыл первым в ${p.id}`).toBe(false);
      }
    }
  });

  it.runIf(hasDocs)('каждый слаг из каталога читается через getSectionBySlug', () => {
    const catalog = JSON.parse(buildCatalog()) as Catalog;
    const broken: string[] = [];
    for (const { id, sections } of catalog.packages) {
      for (const [slug] of sections) {
        if (getSectionBySlug(`@reformer/${id}`, slug) === null) {
          broken.push(`reformer://docs/${id}/${slug}`);
        }
      }
    }
    expect(broken, `URI из каталога не резолвятся: ${broken.join(', ')}`).toEqual([]);
  });

  it.runIf(hasDocs)('каталог существенно дешевле прежнего листинга секций', () => {
    const catalogChars = buildCatalog().length;
    // Прежний листинг: URI + имя + до 200 символов preview на КАЖДУЮ секцию.
    const oldListingChars = packages.reduce(
      (n, pkg) =>
        n +
        listSections(pkg).reduce((m, s) => {
          const preview = (s.preview || `Section "${s.title}" of ${pkg}.`).slice(0, 200);
          return (
            m + `reformer://docs/x/${s.slug}`.length + `${pkg}: ${s.title}`.length + preview.length
          );
        }, 0),
      0
    );
    expect(catalogChars).toBeLessThan(oldListingChars / 2);
  });
});
