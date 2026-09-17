/**
 * Раскладка раздела «Плагины» по вкладкам: что где показывать и чего там ждать.
 *
 * Модуль чистый и без React — по той же причине, что и `./plugins-list`: это единственное
 * в разделе, что проверяется дёшево, и первое, что разъедется с интерфейсом. Здесь решается,
 * какая строка на какой вкладке, а не как она выглядит.
 *
 * ## Почему вкладки именно эти
 *
 * Они отвечают на четыре разных вопроса человека, и склеивать их в один список нельзя:
 *
 * - **Установленные** — «что у меня стоит и работает ли оно». Сюда попадает всё найденное:
 *   и приехавшее из npm, и лежащее в каталоге проекта, потому что вопрос про действующий
 *   состав, а не про происхождение. Происхождение показывается пометкой слоя.
 * - **Каталог** — «что вообще бывает». Это список реестра МИНУС то, что уже стоит: предлагать
 *   установить установленное значит делать кнопку, которая ничего не меняет.
 * - **Обновления** — «что стоит обновить». Список считается сверкой версий и пуст, пока
 *   сверка не выполнена: пустота здесь означает «нечего обновлять», и показывать её до
 *   проверки было бы враньём — поэтому состояние «ещё не проверяли» отдельное.
 * - **В разработке** — «над чем я работаю». Пометка `dev` человека, а не свойство плагина.
 *
 * @module shell/boot/settings/plugins-tabs
 */

import type { PluginRow } from './plugins-list';

/** Вкладки в порядке показа. */
export const PLUGIN_TABS = ['installed', 'marketplace', 'updates', 'development'] as const;

export type PluginTab = (typeof PLUGIN_TABS)[number];

/** Запись каталога реестра в объёме, нужном разделу. */
export interface MarketplaceRow {
  readonly id: string;
  readonly package: string;
  readonly name: string;
  readonly description?: string;
  readonly publisher?: string;
  /** Уже установлен: кнопка «поставить» такому не нужна. */
  readonly installed: boolean;
}

/** Строка вкладки обновлений: что стоит и что предлагает npm. */
export interface UpdateRow {
  readonly id: string;
  readonly package: string;
  readonly name: string;
  readonly current: string;
  readonly available: string;
}

/** Что известно об установленном из npm — то, чем раздел отличает слои. */
export interface InstalledInfo {
  readonly id: string;
  readonly package: string;
  readonly version: string;
  /** Скачанные версии: если их больше одной, откат имеет смысл. */
  readonly versions: readonly string[];
}

export interface PluginTabsInput {
  readonly rows: readonly PluginRow[];
  readonly installed: readonly InstalledInfo[];
  readonly marketplace: readonly {
    readonly id: string;
    readonly package: string;
    readonly name: string;
    readonly description?: string;
    readonly publisher?: string;
  }[];
  readonly updates: readonly UpdateRow[];
}

/**
 * Строки вкладки «Каталог»: всё из реестра, с пометкой «уже стоит».
 *
 * Установленное не выбрасывается, а помечается: человек ищет плагин по имени и должен найти
 * его там, где искал, — иначе «в каталоге его нет» прочитается как «его не существует».
 */
export function marketplaceRows(input: PluginTabsInput): readonly MarketplaceRow[] {
  const installed = new Set(input.installed.map((item) => item.id));
  return input.marketplace.map((entry) => ({
    ...entry,
    installed: installed.has(entry.id),
  }));
}

/** Строки вкладки «В разработке»: только помеченные человеком. */
export function developmentRows(input: PluginTabsInput): readonly PluginRow[] {
  return input.rows.filter((row) => row.dev);
}

/** Сколько записей на вкладке. Число рядом с названием — подсказка, куда смотреть. */
export function tabCount(tab: PluginTab, input: PluginTabsInput): number {
  switch (tab) {
    case 'installed':
      return input.rows.length;
    case 'marketplace':
      return marketplaceRows(input).length;
    case 'updates':
      return input.updates.length;
    case 'development':
      return developmentRows(input).length;
  }
}

/**
 * Есть ли у установленного плагина куда откатываться.
 *
 * Отдельная функция, а не поле строки: откат касается ТОЛЬКО установленных из npm, и добавить
 * `canRollback` в общую строку значило бы объяснять в интерфейсе, почему у плагина проекта
 * он всегда ложь.
 */
export function canRollback(id: string, installed: readonly InstalledInfo[]): boolean {
  const record = installed.find((item) => item.id === id);
  return record !== undefined && record.versions.length > 1;
}

/**
 * Считает список обновлений по ответам npm.
 *
 * Версии сравниваются СТРОКАМИ на неравенство, а не по старшинству: «новее» решает тот, кто
 * спрашивал реестр (он резолвит диапазон и знает правила semver), а здесь — только «то же
 * самое или нет». Дублировать сравнение версий значило бы завести второе место, где оно
 * может разойтись.
 */
export function updateRows(
  installed: readonly InstalledInfo[],
  latest: ReadonlyMap<string, string>,
  names: ReadonlyMap<string, string>
): readonly UpdateRow[] {
  const rows: UpdateRow[] = [];
  for (const record of installed) {
    const available = latest.get(record.id);
    if (available === undefined || available === record.version) continue;
    rows.push({
      id: record.id,
      package: record.package,
      name: names.get(record.id) ?? record.id,
      current: record.version,
      available,
    });
  }
  return rows;
}

/**
 * Что разделу нужно от установки из npm.
 *
 * Отдельный порт, а не расширение {@link PluginsSettingsPort}: список плагинов работает
 * и без установки (сборка без реестра, окружение без OPFS), и раздел обязан это переживать —
 * он и переживал до появления установки. Отсутствие порта означает не «пусто», а «вкладок
 * каталога и обновлений нет»: вкладка, которая ничего не может, хуже отсутствующей.
 */
export interface PluginsMarketplacePort {
  /** Настроен ли адрес каталога. Меняет пустое состояние вкладки, а не наличие вкладки. */
  configured(): boolean;
  /** Каталог реестра. */
  catalog(): Promise<
    { ok: true; entries: readonly MarketplaceEntryLike[] } | { ok: false; message: string }
  >;
  /** Что уже установлено из npm — с версиями, чтобы знать про откат. */
  installed(): Promise<readonly InstalledInfo[]>;
  /** Ставит пакет. Отказ — строкой для показа. */
  install(packageName: string): Promise<{ ok: boolean; message?: string }>;
  /** Спрашивает npm, есть ли версии новее установленных. */
  checkUpdates(): Promise<
    { ok: true; rows: readonly UpdateRow[] } | { ok: false; message: string }
  >;
  /** Ставит доступную версию поверх текущей. */
  update(row: UpdateRow): Promise<{ ok: boolean; message?: string }>;
  /** Переключает на другую скачанную версию; какую — спрашивает у человека сама. */
  rollback(id: string): Promise<void>;
  uninstall(id: string): Promise<void>;
}

/** Запись каталога в объёме, который показывает раздел. */
export interface MarketplaceEntryLike {
  readonly id: string;
  readonly package: string;
  readonly name: string;
  readonly description?: string;
  readonly publisher?: string;
}

/**
 * Какие вкладки показывать.
 *
 * Без порта установки остаются две: «что стоит» и «над чем работаю». Каталог и обновления
 * без него не показать честно — не у кого спросить.
 */
export function visibleTabs(hasMarketplace: boolean): readonly PluginTab[] {
  return hasMarketplace
    ? PLUGIN_TABS
    : PLUGIN_TABS.filter((tab) => tab === 'installed' || tab === 'development');
}
