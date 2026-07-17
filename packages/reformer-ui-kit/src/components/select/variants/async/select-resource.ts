/**
 * Чистая (React-free) логика асинхронного источника опций для {@link Select}.
 *
 * Вынесена из компонента, чтобы стратегии загрузки, слияние страниц и
 * клиентская фильтрация были юнит-тестируемы без DOM (в монорепо тесты —
 * логические `.test.ts`, без jsdom/testing-library).
 *
 * @module ui/select-resource
 */

/** Параметры запроса к {@link ResourceConfig.load}. */
export interface ResourceLoadParams {
  /** Поисковый запрос (серверная фильтрация в стратегии `partial`). */
  search?: string;
  /** Номер страницы (1-based) для пагинации. */
  page?: number;
  /** Размер страницы. */
  pageSize?: number;
  /** Дополнительные пользовательские параметры. */
  [key: string]: unknown;
}

/** Один элемент, возвращаемый {@link ResourceConfig.load}. */
export interface ResourceItem<T> {
  /** Уникальный ключ элемента (для React `key` и дедупликации страниц). */
  id: string | number;
  /** Видимая подпись опции. */
  label: string;
  /** Значение, которое попадает в `onChange` (всегда приводится к строке). */
  value: T;
  /** Опциональное имя группы — варианты с одинаковым `group` объединяются в `SelectGroup`. */
  group?: string;
  /** Дополнительные поля бек-данных. */
  [key: string]: unknown;
}

/** Ответ {@link ResourceConfig.load}. */
export interface ResourceResult<T> {
  /** Список вариантов текущей страницы. */
  items: ResourceItem<T>[];
  /** Общее число доступных вариантов (для пагинации). */
  totalCount: number;
}

/**
 * Стратегия загрузки опций {@link Select}:
 * - `'static'` — один `load({})` при монтировании; без поиска и пагинации (снимок);
 * - `'preload'` — один `load({})` (сервер возвращает всё), поиск фильтрует
 *   загруженные опции на клиенте; пагинации нет;
 * - `'partial'` — серверные поиск и пагинация: `load({ search, page })`,
 *   догрузка следующих страниц при скролле до `totalCount`.
 */
export type ResourceStrategy = 'static' | 'preload' | 'partial';

/** Конфигурация асинхронного источника опций для {@link Select}. */
export interface ResourceConfig<T> {
  /** Стратегия загрузки. По умолчанию (если не задана) трактуется как `'static'`. */
  type: ResourceStrategy;
  /** Функция загрузки опций. Должна вернуть `{ items, totalCount }`. */
  load: (params?: ResourceLoadParams) => Promise<ResourceResult<T>>;
  /** Размер страницы для стратегии `partial`. По умолчанию 20. */
  pageSize?: number;
}

/** Нормализованная опция: `value` приведён к строке для Radix и `onChange`. */
export interface NormalizedOption {
  id: string | number;
  label: string;
  value: string;
  group?: string;
}

/** Поведенческие флаги стратегии. */
export interface StrategyFlags {
  /** Поиск уходит на сервер (`load({ search })`) vs фильтруется на клиенте. */
  serverSearch: boolean;
  /** Опции подгружаются постранично по мере скролла. */
  paginated: boolean;
  /** Показывать ли поле поиска в дропдауне. */
  searchable: boolean;
}

/**
 * Разложить {@link ResourceStrategy} в поведенческие флаги.
 *
 * @param type - стратегия (undefined трактуется как `'static'`)
 * @returns флаги {@link StrategyFlags}
 */
export function resolveStrategyFlags(type: ResourceStrategy | undefined): StrategyFlags {
  switch (type) {
    case 'partial':
      return { serverSearch: true, paginated: true, searchable: true };
    case 'preload':
      return { serverSearch: false, paginated: false, searchable: true };
    case 'static':
    default:
      return { serverSearch: false, paginated: false, searchable: false };
  }
}

/**
 * Привести «сырые» элементы ответа к {@link NormalizedOption} (`value` → строка).
 *
 * @param items - элементы из {@link ResourceResult.items}
 * @returns нормализованные опции
 */
export function normalizeItems<T>(items: ResourceItem<T>[]): NormalizedOption[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    value: String(item.value),
    group: item.group,
  }));
}

/**
 * Слить ранее загруженные опции со страницей новых, отбрасывая дубли по `id`
 * (сервер может вернуть пересечение при гонке страниц).
 *
 * @param prev - уже загруженные опции
 * @param next - опции новой страницы
 * @returns объединённый список без повторов `id`
 */
export function mergeOptions(
  prev: NormalizedOption[],
  next: NormalizedOption[]
): NormalizedOption[] {
  const seen = new Set(prev.map((o) => o.id));
  const merged = [...prev];
  for (const opt of next) {
    if (!seen.has(opt.id)) {
      seen.add(opt.id);
      merged.push(opt);
    }
  }
  return merged;
}

/**
 * Клиентская фильтрация опций по подстроке `label` (case-insensitive).
 * Используется стратегией `preload`; пустой запрос возвращает исходный список.
 *
 * @param options - загруженные опции
 * @param query - строка поиска
 * @returns отфильтрованные опции
 */
export function filterClient(options: NormalizedOption[], query: string): NormalizedOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.label.toLowerCase().includes(q));
}

/** Состояние загрузки асинхронного источника. */
export interface ResourceState {
  /** Накопленные (по страницам) опции — уже нормализованные. */
  options: NormalizedOption[];
  /** Последняя загруженная страница (1-based). */
  page: number;
  /** Общее число опций по данным сервера. */
  totalCount: number;
  /** Первичная загрузка (маунт или смена запроса). */
  loading: boolean;
  /** Догрузка следующей страницы. */
  loadingMore: boolean;
  /** Последняя загрузка завершилась ошибкой. */
  error: boolean;
  /** Активный (применённый) поисковый запрос. */
  search: string;
}

export type ResourceAction<T> =
  | { kind: 'load-start'; search: string }
  | { kind: 'load-success'; result: ResourceResult<T>; page: number }
  | { kind: 'load-more-start' }
  | { kind: 'load-more-success'; result: ResourceResult<T>; page: number }
  | { kind: 'load-error'; more?: boolean }
  | { kind: 'reset' };

/** Начальное состояние источника. */
export function initialResourceState(): ResourceState {
  return {
    options: [],
    page: 0,
    totalCount: 0,
    loading: false,
    loadingMore: false,
    error: false,
    search: '',
  };
}

/**
 * Чистый reducer состояния асинхронного источника опций.
 *
 * - `load-start` сбрасывает список (новый запрос/маунт) и поднимает `loading`;
 * - `load-success` заменяет опции первой страницей;
 * - `load-more-*` аппендит следующую страницу (с дедупликацией по `id`);
 * - `load-error` гасит флаги загрузки и ставит `error`.
 *
 * @param state - текущее состояние
 * @param action - действие {@link ResourceAction}
 * @returns новое состояние
 */
export function resourceReducer<T>(state: ResourceState, action: ResourceAction<T>): ResourceState {
  switch (action.kind) {
    case 'load-start':
      return {
        ...initialResourceState(),
        loading: true,
        search: action.search,
      };
    case 'load-success':
      return {
        ...state,
        options: normalizeItems(action.result.items),
        totalCount: action.result.totalCount,
        page: action.page,
        loading: false,
        error: false,
      };
    case 'load-more-start':
      return { ...state, loadingMore: true };
    case 'load-more-success':
      return {
        ...state,
        options: mergeOptions(state.options, normalizeItems(action.result.items)),
        totalCount: action.result.totalCount,
        page: action.page,
        loadingMore: false,
        error: false,
      };
    case 'load-error':
      return { ...state, loading: false, loadingMore: false, error: true };
    case 'reset':
      return initialResourceState();
    default:
      return state;
  }
}

/**
 * Есть ли ещё непогруженные страницы (для infinite-scroll в стратегии `partial`).
 *
 * @param state - состояние источника
 * @returns `true`, если загружено меньше опций, чем `totalCount`
 */
export function hasMore(state: ResourceState): boolean {
  return state.options.length < state.totalCount;
}

/**
 * Достигнут ли порог подгрузки при прокрутке контейнера опций.
 *
 * @param el - метрики скролла контейнера
 * @param threshold - запас в пикселях до низа (по умолчанию 48)
 * @returns `true`, если пора грузить следующую страницу
 */
export function isNearBottom(
  el: { scrollTop: number; clientHeight: number; scrollHeight: number },
  threshold = 48
): boolean {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
}
