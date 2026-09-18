/**
 * Чистая (React-free) логика автокомплита со свободным вводом.
 *
 * Значение поля — всегда введённый текст; подсказки лишь помогают его набрать. Поэтому состояние
 * здесь только навигационное (`open` / `activeIndex`), а не «выбранная опция»: выбрать подсказку —
 * значит подставить её `value` в текст.
 *
 * @module cdk/autocomplete
 */
import { filterClient, type NormalizedOption, type ResourceConfig } from '../option-source';

/** Подсказка в объектной форме: `value` уходит в поле, `label` — текст пункта (по умолчанию = `value`). */
export interface AutocompleteSuggestionItem {
  value: string;
  label?: string;
}

/** Статический список подсказок: строки или объекты {@link AutocompleteSuggestionItem}. */
export type AutocompleteSuggestionList = ReadonlyArray<string | AutocompleteSuggestionItem>;

/**
 * Источник подсказок: статический список или асинхронный {@link ResourceConfig}
 * (тот же контракт, что у Select). Различаются через `Array.isArray`.
 */
export type AutocompleteSuggestions = AutocompleteSuggestionList | ResourceConfig<unknown>;

/** Предикат совпадения подсказки с введённым текстом. */
export type AutocompleteFilter = (option: NormalizedOption, query: string) => boolean;

/** Навигационное состояние списка подсказок. */
export interface AutocompleteState {
  /** Список раскрыт (показывается, только если есть что показать). */
  open: boolean;
  /** Индекс подсвеченной подсказки, `-1` — ничего не подсвечено. */
  activeIndex: number;
}

export type AutocompleteAction =
  | { type: 'open' }
  | { type: 'close' }
  /** Пользователь изменил текст: список раскрывается, подсветка сбрасывается. */
  | { type: 'input' }
  /** ↓ / ↑. Закрытый список раскрывается с первой (↓) или последней (↑) подсказки. */
  | { type: 'move'; delta: 1 | -1; count: number }
  /** Подсветка наведением мыши. */
  | { type: 'highlight'; index: number }
  /** Список подсказок сменился — подсветка за его пределами сбрасывается. */
  | { type: 'items'; count: number };

/** Начальное состояние: список закрыт, подсветки нет. */
export function initialAutocompleteState(): AutocompleteState {
  return { open: false, activeIndex: -1 };
}

/**
 * Reducer навигации по подсказкам. Навигация циклическая: после последней — первая.
 *
 * @param state - текущее состояние
 * @param action - действие {@link AutocompleteAction}
 * @returns новое состояние
 */
export function autocompleteReducer(
  state: AutocompleteState,
  action: AutocompleteAction
): AutocompleteState {
  switch (action.type) {
    case 'open':
      return state.open ? state : { open: true, activeIndex: -1 };
    case 'close':
      return state.open || state.activeIndex !== -1 ? initialAutocompleteState() : state;
    case 'input':
      return { open: true, activeIndex: -1 };
    case 'move': {
      if (action.count <= 0) return { open: true, activeIndex: -1 };
      if (!state.open || state.activeIndex < 0) {
        return { open: true, activeIndex: action.delta > 0 ? 0 : action.count - 1 };
      }
      const next = (state.activeIndex + action.delta + action.count) % action.count;
      return { open: true, activeIndex: next };
    }
    case 'highlight':
      return state.activeIndex === action.index ? state : { ...state, activeIndex: action.index };
    case 'items':
      return state.activeIndex >= action.count ? { ...state, activeIndex: -1 } : state;
    default:
      return state;
  }
}

/**
 * Проверить, что источник — асинхронный {@link ResourceConfig}, а не статический список.
 *
 * @param suggestions - источник подсказок
 * @returns `true` для `ResourceConfig`
 */
export function isSuggestionResource(
  suggestions: AutocompleteSuggestions | null | undefined
): suggestions is ResourceConfig<unknown> {
  return suggestions != null && !Array.isArray(suggestions);
}

/**
 * Привести статический список к {@link NormalizedOption}. Строка `s` → `{ value: s, label: s }`.
 * Повторы по `value` отбрасываются (у каждой подсказки должен быть уникальный id для ARIA).
 *
 * @param list - строки и/или объекты подсказок
 * @returns нормализованные подсказки
 */
export function normalizeSuggestions(list: AutocompleteSuggestionList): NormalizedOption[] {
  const seen = new Set<string>();
  const result: NormalizedOption[] = [];
  for (const entry of list) {
    const value = typeof entry === 'string' ? entry : entry.value;
    if (seen.has(value)) continue;
    seen.add(value);
    const label = typeof entry === 'string' ? entry : (entry.label ?? entry.value);
    result.push({ id: value, value, label });
  }
  return result;
}

/** Опции {@link matchSuggestions}. */
export interface MatchSuggestionsOptions {
  /** Минимальная длина текста, с которой показываются подсказки. @default 0 */
  minChars?: number;
  /** Свой предикат совпадения. По умолчанию — подстрока `label` без учёта регистра. */
  filter?: AutocompleteFilter;
  /** Фильтровать ли на клиенте. `false` — список уже отфильтрован сервером. @default true */
  clientFilter?: boolean;
}

/**
 * Подсказки, которые стоит показать для введённого текста.
 *
 * Кроме фильтрации прячет список, когда предлагать нечего: единственная подсказка
 * совпадает с уже введённым текстом (обычно — сразу после её выбора).
 *
 * @param options - все подсказки источника
 * @param query - введённый текст
 * @param opts - {@link MatchSuggestionsOptions}
 * @returns подсказки для списка
 */
export function matchSuggestions(
  options: NormalizedOption[],
  query: string,
  opts: MatchSuggestionsOptions = {}
): NormalizedOption[] {
  const { minChars = 0, filter, clientFilter = true } = opts;
  if (query.trim().length < minChars) return [];
  let matched = options;
  if (clientFilter) {
    matched = filter ? options.filter((o) => filter(o, query)) : filterClient(options, query);
  }
  if (matched.length === 1 && matched[0].value === query) return [];
  return matched;
}
