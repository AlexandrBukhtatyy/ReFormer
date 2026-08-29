/**
 * Каталог встроенного кита как ФИКСТУРА тестов.
 *
 * Прямой импорт конкретного кита в самом домене был бы ошибкой: `lib/catalog` умеет собирать
 * каталог из ЛЮБОГО источника, а какой источник взять — решает вызывающий (в v1 это решали
 * `config/state` и `kits/registry`, в v2 будет сервис плагина `plugins/kits/`). Поэтому
 * `@reformer/ui-kit/catalog` импортируется здесь и только здесь: тестам нужен настоящий каталог
 * реального кита, иначе проверки категорий, вариантов и compound-частей проверяли бы выдумку.
 *
 * @module reformer-builder/lib/catalog/__fixtures__/builtin-catalog
 */

import builtin from '@reformer/ui-kit/catalog';
import type { CatalogEntry, CatalogJson } from '../types';
import type { KitDescriptor } from '../../kits/types';
import { buildCatalog } from '../catalog';

/** Каталог-JSON `@reformer/ui-kit` — ровно то, что кит поставляет о себе. */
export const BUILTIN_CATALOG = builtin as unknown as CatalogJson;

let memo: { entries: CatalogEntry[]; descriptor: KitDescriptor; json: CatalogJson } | null = null;

/**
 * Собранный каталог встроенного кита (мемо на файл тестов): сборка пробегает 361 запись, и
 * повторять её на каждый `it` незачем — функция чистая, результат не меняется.
 */
export function builtinCatalog() {
  return (memo ??= buildCatalog(BUILTIN_CATALOG));
}

/** Только записи — самый частый вид обращения в тестах. */
export function builtinEntries(): CatalogEntry[] {
  return builtinCatalog().entries;
}
