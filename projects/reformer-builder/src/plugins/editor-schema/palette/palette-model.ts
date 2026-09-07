/**
 * Модель палитры: разделы, подписи и поиск — всё, что в палитре является правилом.
 *
 * Отрисовка живёт в `ui/PalettePanel`, а здесь чистые функции над каталогом активного кита.
 * Разделение проходит по проверяемости: «HTML идёт первым, незнакомая категория уезжает
 * в хвост, поиск не различает регистр» — правила, и проверяются они в окружении `node`.
 *
 * Группировку и порядок разделов даёт домен (`lib/catalog/grouping`): тем же порядком
 * пользуется модалка быстрого добавления, и второй список категорий разошёлся бы с первым.
 *
 * @module plugins/editor-schema/palette/palette-model
 */

import type { JsonNode } from '@reformer/renderer-json';
import { displayName, groupByCategory, htmlTag } from '@/lib/catalog/grouping';
import type { CatalogEntry, CatalogRole } from '@/lib/catalog/types';

/** Пункт палитры — запись каталога вместе с тем, что показывает строка. */
export interface PaletteEntry {
  /** Каталожное имя: `Input`, `$html(div)`. Служит ключом и адресом вставки. */
  readonly name: string;
  /** Подпись: у html-элементов — тег без обёртки оператора. */
  readonly label: string;
  readonly role: CatalogRole;
  /** Метка варианта (`Пароль` у `InputPassword`), если запись — член группы вариантов. */
  readonly variant?: string;
  readonly entry: CatalogEntry;
}

/** Раздел палитры. */
export interface PaletteSection {
  readonly category: string;
  readonly items: readonly PaletteEntry[];
}

/**
 * Разделы, свёрнутые при первом открытии.
 *
 * Это не настройка вкуса: `HTML` и `Типографика` — самые длинные разделы каталога и самые
 * редкие в работе. Развёрнутыми они отодвигают поля ввода за нижний край панели.
 */
export const DEFAULT_COLLAPSED_CATEGORIES: readonly string[] = Object.freeze([
  'HTML',
  'Типографика',
]);

export interface PaletteOptions {
  /** Порядок разделов из конфига клиента; без него — умолчание домена. */
  readonly order?: readonly string[];
  /** Строка поиска. Пустая означает «всё». */
  readonly query?: string;
}

/**
 * Разделы палитры для каталога.
 *
 * Поиск не различает регистр и ищет по подписи И по каталожному имени: человек ищет `div`,
 * зная тег, и `Input`, зная компонент, — а это разные строки у одной записи.
 * Пустые после отбора разделы не показываются вовсе: заголовок без содержимого читается
 * как «здесь ничего нет», хотя означает «здесь ничего не нашлось».
 */
export function paletteSections(
  catalog: readonly CatalogEntry[],
  options: PaletteOptions = {}
): readonly PaletteSection[] {
  const query = (options.query ?? '').trim().toLowerCase();
  const matched = query === '' ? catalog : catalog.filter((entry) => matches(entry, query));
  return groupByCategory(matched, options.order)
    .map(([category, entries]) => ({ category, items: entries.map(toItem) }))
    .filter((section) => section.items.length > 0);
}

/** Совпадает ли запись со строкой поиска (подпись, имя, тег, метка варианта). */
export function matches(entry: CatalogEntry, query: string): boolean {
  const haystack = [displayName(entry), entry.name, htmlTag(entry.name) ?? '', entry.variant ?? ''];
  return haystack.some((value) => value.toLowerCase().includes(query));
}

/**
 * Узел по умолчанию для записи палитры.
 *
 * Фабрика принадлежит записи каталога (`makeNode`), а не палитре: что такое «пустой визард»
 * или «поле ввода по умолчанию», знает тот, кто описал компонент. Идентификаторы узел
 * получит при вставке — операция выдаёт их всему поддереву заново.
 */
export function paletteNode(item: PaletteEntry): JsonNode {
  return item.entry.makeNode();
}

function toItem(entry: CatalogEntry): PaletteEntry {
  return {
    name: entry.name,
    label: displayName(entry),
    role: entry.role,
    variant: entry.variant,
    entry,
  };
}
