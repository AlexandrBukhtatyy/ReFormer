/**
 * Группировка вариантов компонентов: записи каталога с общим `variantGroup` — варианты одного
 * компонента. Дефолт группы — член, чей `name === variantGroup` (канон-имя). Используется палитрой
 * (коллапс до дефолта), QuickAdd (бейдж не-дефолтных) и инспектором (селектор variant + переключение).
 *
 * Собранный каталог приходит ПАРАМЕТРОМ (в v1 брался из синглтона `getCatalog()`): держать его —
 * работа сервиса плагина, домен только считает по нему производные.
 *
 * @module reformer-builder/lib/catalog/variants
 */

import type { CatalogEntry } from './types';

/** Дефолт-вариант группы (`name === variantGroup`). Записи без `variantGroup` — сами себе дефолт. */
export function isDefaultVariant(entry: CatalogEntry): boolean {
  return !entry.variantGroup || entry.name === entry.variantGroup;
}

/** Группа вариантов: имя группы, все члены (в порядке каталога) и дефолт. */
export interface VariantGroup {
  group: string;
  members: CatalogEntry[];
  default: CatalogEntry;
}

/**
 * Группа вариантов для компонента по имени. `null` — компонент не в группе или в группе один член
 * (тогда селектор variant не нужен).
 */
export function variantGroupOf(
  catalog: readonly CatalogEntry[],
  name: string
): VariantGroup | null {
  const group = catalog.find((e) => e.name === name)?.variantGroup;
  if (!group) return null;
  const members = catalog.filter((e) => e.variantGroup === group);
  if (members.length < 2) return null;
  const def = members.find((e) => e.name === group) ?? members[0];
  return { group, members, default: def };
}

/**
 * Свернуть список записей до одного дефолт-варианта на группу (для палитры). Не-групповые записи —
 * без изменений; порядок сохраняется по первому появлению группы.
 */
export function collapseToDefaults(entries: CatalogEntry[]): CatalogEntry[] {
  const seenGroups = new Set<string>();
  const out: CatalogEntry[] = [];
  for (const e of entries) {
    if (!e.variantGroup) {
      out.push(e);
      continue;
    }
    if (seenGroups.has(e.variantGroup)) continue;
    seenGroups.add(e.variantGroup);
    // дефолт группы (name === variantGroup), если он в списке; иначе первый встреченный член.
    out.push(
      entries.find((x) => x.name === e.variantGroup && x.variantGroup === e.variantGroup) ?? e
    );
  }
  return out;
}
