/**
 * Публичные типы уровня таблицы.
 *
 * @module table/types
 */

import type { ReadonlySignal, Signal } from '@preact/signals-core';
import type { Model } from '../model/types';
import type { AsyncStatus } from '../resource/machine';

/**
 * Ключ строки: `String(getRowKey(row))`, ключ под-модели или индекс.
 *
 * @group Table
 */
export type RowKey = string;

/**
 * Под-модель строки: у строки-объекта массива модели — её модель, у примитива — нет.
 *
 * @group Table
 */
export type RowModel<Row> = Row extends object ? Model<Row> : never;

/**
 * Направление сортировки.
 *
 * @group Table
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Элемент сортировки: колонка и направление. Порядок элементов — приоритет.
 *
 * @group Table
 */
export interface SortEntry {
  id: string;
  desc: boolean;
}

/**
 * Активные фильтры: id колонки → значение фильтра. Пустой фильтр (`''`, `null`, `undefined`) в
 * карту не попадает.
 *
 * @group Table
 */
export type TableFilters = Record<string, unknown>;

/**
 * Запрос страницы — ключ загрузки серверного режима и источник для синхронизации с адресом.
 * Совпадает с `TableQuery` DataGrid из `@reformer/ui-kit/table`.
 *
 * @group Table
 */
export interface TableQuery {
  /** Активные фильтры колонок. */
  filters: TableFilters;
  /** Текущая страница (с 0) и размер страницы. */
  pagination: { pageIndex: number; pageSize: number };
  /** Сортировка; порядок — приоритет. */
  sorting: SortEntry[];
}

/**
 * Ответ провайдера серверного режима: строки страницы и общее число строк.
 *
 * @group Table
 */
export interface TablePage<Row> {
  rows: Row[];
  total: number;
}

/**
 * Режим выбора строк.
 *
 * @group Table
 */
export type SelectionMode = 'none' | 'single' | 'multiple';

/**
 * Колонка таблицы — состояние, а не отрисовка: заголовок и ячейку рисует вид.
 *
 * @typeParam Row - Тип строки.
 * @typeParam Id - Id колонки (литерал — из него типизирован `table.columns`).
 *
 * @group Table
 */
export interface ColumnDef<Row, Id extends string = string> {
  /** Уникальный id: ключ в `table.columns`, `sorting[].id` и `filters`. */
  id: Id;
  /** Значение для сортировки и фильтра. По умолчанию — `row[id]`. */
  value?: (row: Row) => unknown;
  /** Разрешить сортировку по колонке. По умолчанию `false`. */
  sortable?: boolean;
  /** Разрешить фильтр по колонке. По умолчанию `false`. */
  filterable?: boolean;
  /**
   * Сравнение значений клиентского режима. По умолчанию: пустые — в конце, числа и даты — по
   * величине, остальное — коллацией языка таблицы (`numeric: true`).
   */
  compare?: (a: unknown, b: unknown, collator: Intl.Collator) => number;
  /**
   * Проверка фильтра клиентского режима. По умолчанию: строковый фильтр — подстрока без учёта
   * регистра, массив — значение из списка, прочее — равенство.
   */
  match?: (value: unknown, filter: unknown) => boolean;
  /** Фильтр на старте. */
  initialFilter?: unknown;
  /** Колонка видна на старте. По умолчанию `true`. */
  visible?: boolean;
  /** Данные для вида (заголовок, выравнивание); ядро их не читает. */
  meta?: Readonly<Record<string, unknown>>;
}

/**
 * Состояние таблицы, которое можно привязать к полям модели (адрес, настройки пользователя).
 *
 * @group Table
 */
export interface TableStateBindings {
  sorting?: Signal<readonly SortEntry[]>;
  filters?: Signal<TableFilters>;
  pageIndex?: Signal<number>;
  pageSize?: Signal<number>;
  selected?: Signal<ReadonlySet<RowKey>>;
  hidden?: Signal<ReadonlySet<string>>;
}

/**
 * Общие настройки обоих режимов.
 *
 * @group Table
 */
export interface TableCommonOptions<Row, Id extends string> {
  /** Колонки. Состав фиксируется при создании, как ключи модели. */
  columns: readonly ColumnDef<Row, Id>[];
  /**
   * Стабильный ключ строки: выбор переживает сортировку, страницы и перезагрузку. Без него в
   * клиентском режиме над массивом модели ключ — ключ под-модели строки, иначе — индекс.
   */
  getRowKey?: (row: Row) => string | number;
  /** Размер страницы. По умолчанию `10`. */
  pageSize?: number;
  /** Режим выбора. По умолчанию `'none'`. */
  selection?: SelectionMode;
  /** Разрешить сортировку по нескольким колонкам (`toggleSort({ multi: true })`). По умолчанию `true`. */
  multiSort?: boolean;
  /** Язык коллации клиентской сортировки — реактивно: смена языка пересортирует таблицу. */
  locale?: () => string | undefined;
  /** Привязка состояния к полям модели. */
  state?: TableStateBindings;
}

/**
 * Клиентский режим: строки — массив модели, сигнал массива или массив.
 *
 * @group Table
 */
export interface ClientTableOptions<Row, Id extends string> extends TableCommonOptions<Row, Id> {
  /** Строки. Массив модели (`model.$.users`) даёт строкам под-модель (`row.model`). */
  data: ReadonlySignal<readonly Row[]> | readonly Row[];
}

/**
 * Серверный режим: страницу отдаёт провайдер.
 *
 * @group Table
 */
export interface ServerTableOptions<Row, Id extends string> extends TableCommonOptions<Row, Id> {
  /**
   * Провайдер страницы. Вызывается на каждую смену запроса (одно действие — один вызов);
   * устаревший запрос отменяется через `signal`, его ответ не применяется.
   */
  dataProvider: (query: TableQuery, ctx: { signal: AbortSignal }) => Promise<TablePage<Row>>;
  /**
   * Загрузка включена — реактивно. Пока выключена, провайдер не вызывается, таблица — `idle`.
   * Например, вид включает загрузку после монтирования: на сервере (SSR) и в отброшенном рендере
   * запроса нет.
   */
  enabled?: () => boolean;
}

/**
 * Настройки {@link createTable}: `data` — клиентский режим, `dataProvider` — серверный.
 *
 * @group Table
 */
export type TableOptions<Row, Id extends string> =
  | ClientTableOptions<Row, Id>
  | ServerTableOptions<Row, Id>;

/**
 * Лицо колонки: `table.columns.<id>`.
 *
 * @group Table
 */
export interface TableColumnFace<Id extends string = string> {
  readonly id: Id;
  readonly sortable: boolean;
  readonly filterable: boolean;
  readonly meta: Readonly<Record<string, unknown>> | undefined;
  /** Направление сортировки колонки; `null` — не сортирует. */
  readonly sort: ReadonlySignal<SortDirection | null>;
  /** Приоритет в сортировке (с 0); `-1` — не сортирует. */
  readonly sortIndex: ReadonlySignal<number>;
  /** Фильтр колонки; `undefined` — нет фильтра. */
  readonly filter: ReadonlySignal<unknown>;
  readonly visible: ReadonlySignal<boolean>;
  /** Цикл «по возрастанию → по убыванию → без сортировки». `multi` — добавить к остальным. */
  toggleSort(options?: { multi?: boolean }): void;
  setSort(direction: SortDirection | null, options?: { multi?: boolean }): void;
  /** Задать фильтр и вернуться на первую страницу. Пустое значение снимает фильтр. */
  setFilter(value: unknown): void;
  clearFilter(): void;
  setVisible(visible: boolean): void;
}

/**
 * Лицо строки текущей страницы.
 *
 * @group Table
 */
export interface TableRow<Row> {
  readonly key: RowKey;
  readonly value: Row;
  /** Под-модель строки (клиентский режим над массивом модели) — шов для редактирования. */
  readonly model: RowModel<Row> | undefined;
  readonly selected: ReadonlySignal<boolean>;
  /** Выбрать (`true`, по умолчанию) или снять выбор. В режиме `single` выбор — только эта строка. */
  select(on?: boolean): void;
  toggle(): void;
}

/**
 * Выбор строк.
 *
 * @group Table
 */
export interface TableSelection<Row> {
  readonly mode: SelectionMode;
  readonly keys: ReadonlySignal<ReadonlySet<RowKey>>;
  /** Выбранные строки, в том числе с других страниц. */
  readonly rows: ReadonlySignal<readonly Row[]>;
  /** Выбраны все строки страницы (страница не пуста). */
  readonly allOnPage: ReadonlySignal<boolean>;
  /** Выбрана часть строк страницы — для неопределённого чекбокса шапки. */
  readonly someOnPage: ReadonlySignal<boolean>;
  /** Все строки страницы выбраны — снять их; иначе — выбрать все. Только режим `multiple`. */
  toggleAllOnPage(): void;
  clear(): void;
}

/**
 * Уровень таблицы.
 *
 * @typeParam Row - Тип строки.
 * @typeParam Id - Id колонок.
 *
 * @group Table
 */
export interface Table<Row, Id extends string = string> {
  /** `'client'` — строки в памяти, `'server'` — страницу отдаёт провайдер. */
  readonly mode: 'client' | 'server';
  readonly columns: { readonly [K in Id]: TableColumnFace<K> };
  /** Id видимых колонок в порядке объявления. */
  readonly visibleColumns: ReadonlySignal<readonly Id[]>;
  /** Строки текущей страницы. */
  readonly rows: ReadonlySignal<readonly TableRow<Row>[]>;
  /** Строка текущей страницы по ключу. */
  row(key: RowKey): TableRow<Row> | undefined;
  readonly sorting: ReadonlySignal<readonly SortEntry[]>;
  readonly filters: ReadonlySignal<TableFilters>;
  readonly pageIndex: ReadonlySignal<number>;
  readonly pageSize: ReadonlySignal<number>;
  /** Число страниц (не меньше 1). */
  readonly pageCount: ReadonlySignal<number>;
  /** Число строк после фильтра (серверный режим — `total` ответа). */
  readonly total: ReadonlySignal<number>;
  /** Запрос страницы: ключ загрузки, источник для адресной строки. */
  readonly query: ReadonlySignal<TableQuery>;
  readonly status: ReadonlySignal<AsyncStatus>;
  /** Идёт загрузка поверх показанной страницы. */
  readonly refreshing: ReadonlySignal<boolean>;
  readonly error: ReadonlySignal<unknown>;
  readonly selection: TableSelection<Row>;
  setPage(index: number): void;
  nextPage(): void;
  prevPage(): void;
  /** Задать размер страницы и вернуться на первую страницу. */
  setPageSize(size: number): void;
  setSorting(sorting: readonly SortEntry[]): void;
  /** Снять все фильтры и вернуться на первую страницу. */
  clearFilters(): void;
  /** Перезапросить страницу (серверный режим). */
  reload(): void;
  dispose(): void;
}
