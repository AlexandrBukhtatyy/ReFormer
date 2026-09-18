import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  type ChangeEvent,
  type FocusEvent,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useResourceOptions, type NormalizedOption } from '../option-source';
import {
  autocompleteReducer,
  initialAutocompleteState,
  isSuggestionResource,
  matchSuggestions,
  normalizeSuggestions,
  type AutocompleteFilter,
  type AutocompleteSuggestionList,
  type AutocompleteSuggestions,
} from './autocomplete-core';

/** Опции {@link useAutocomplete}. Совпадают с props `Autocomplete.Root`. */
export interface UseAutocompleteOptions {
  /** Текущий текст поля. Он же — значение: подсказки только помогают его набрать. */
  value: string;
  /** Изменение текста: на каждый ввод и при выборе подсказки (приходит её `value`). */
  onChange: (value: string) => void;
  /** Потеря фокуса полем ввода (клик по подсказке фокус не забирает). */
  onBlur?: () => void;
  /** Статический список или асинхронный `ResourceConfig`. Без него — обычное поле ввода. */
  suggestions?: AutocompleteSuggestions | null;
  /** Минимальная длина текста, с которой показываются подсказки. @default 0 */
  minChars?: number;
  /** Раскрывать список при фокусе, не дожидаясь ввода. @default false */
  openOnFocus?: boolean;
  /** Свой предикат совпадения (для статики и `static`/`preload`-ресурса). */
  filter?: AutocompleteFilter;
  /** Поле выключено: список не раскрывается. */
  disabled?: boolean;
  /** Явный префикс для генерируемых id (иначе `useId`). */
  id?: string;
}

/** id элементов автокомплита — для связки ARIA. */
export interface AutocompleteIds {
  input: string;
  listbox: string;
  /** id пункта списка по индексу. */
  option: (index: number) => string;
}

/** Возвращаемое значение {@link useAutocomplete}. */
export interface UseAutocompleteReturn {
  /** Список раскрыт И в нём есть что показать (подсказки или индикатор первичной загрузки). */
  open: boolean;
  /** Подсказки для текущего текста. */
  items: NormalizedOption[];
  /** Индекс подсвеченной подсказки, `-1` — нет. */
  activeIndex: number;
  /** Идёт первичная загрузка ресурса. */
  loading: boolean;
  /** Догружается следующая страница ресурса. */
  loadingMore: boolean;
  /** Последняя загрузка ресурса упала. */
  error: boolean;
  /** У ресурса есть непогруженные страницы. */
  hasMore: boolean;
  /** Догрузить следующую страницу (`partial`-ресурс). */
  loadMore: () => void;
  /** Раскрыть / закрыть список программно. */
  setOpen: (open: boolean) => void;
  /** Выбрать подсказку: `onChange(item.value)` и закрыть список. */
  select: (item: NormalizedOption) => void;
  ids: AutocompleteIds;
  /** Пропсы поля ввода: роль `combobox`, ARIA-связки и обработчики. Свои обработчики — через аргумент. */
  getInputProps: (
    props?: InputHTMLAttributes<HTMLInputElement>
  ) => InputHTMLAttributes<HTMLInputElement>;
  /** Пропсы контейнера списка (`role="listbox"`). */
  getListboxProps: (props?: HTMLAttributes<HTMLElement>) => HTMLAttributes<HTMLElement>;
  /** Пропсы пункта списка (`role="option"`). */
  getOptionProps: (
    item: NormalizedOption,
    index: number,
    props?: HTMLAttributes<HTMLElement>
  ) => HTMLAttributes<HTMLElement> & { 'data-active'?: true };
}

const EMPTY: NormalizedOption[] = [];

/**
 * Headless-автокомплит со свободным вводом: поле хранит введённый текст, список подсказок
 * помогает его набрать. Реализует ARIA-паттерн combobox (list autocomplete): фокус всегда в
 * поле, подсветка — через `aria-activedescendant`.
 *
 * Клавиатура: ↓/↑ — навигация (раскрывает список), Enter — выбрать подсвеченную подсказку
 * (без подсветки Enter не перехватывается и отправляет форму), Esc — закрыть список.
 * Позиционирование списка — забота вызывающего (Popover, absolute и т.п.).
 *
 * @param options - {@link UseAutocompleteOptions}
 * @returns состояние, действия и prop-getters {@link UseAutocompleteReturn}
 *
 * @example Своя разметка без compound-дерева
 * ```tsx
 * import { useAutocomplete } from '@reformer/cdk/autocomplete';
 *
 * function CityInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
 *   const ac = useAutocomplete({ value, onChange, suggestions: ['Москва', 'Мурманск', 'Казань'] });
 *   return (
 *     <div className="relative">
 *       <input {...ac.getInputProps()} />
 *       {ac.open && (
 *         <ul {...ac.getListboxProps({ className: 'absolute' })}>
 *           {ac.items.map((item, i) => (
 *             <li key={item.id} {...ac.getOptionProps(item, i)}>{item.label}</li>
 *           ))}
 *         </ul>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAutocomplete(options: UseAutocompleteOptions): UseAutocompleteReturn {
  const {
    value,
    onChange,
    onBlur,
    suggestions,
    minChars = 0,
    openOnFocus = false,
    filter,
    disabled = false,
    id,
  } = options;

  const generatedId = useId();
  const baseId = id ?? `autocomplete${generatedId.replace(/:/g, '')}`;
  const ids = useMemo<AutocompleteIds>(
    () => ({
      input: baseId,
      listbox: `${baseId}-listbox`,
      option: (index: number) => `${baseId}-option-${index}`,
    }),
    [baseId]
  );

  const resource = isSuggestionResource(suggestions) ? suggestions : undefined;
  // `Array.isArray` не сужает readonly-массив в union — приводим явно.
  const staticList = Array.isArray(suggestions)
    ? (suggestions as AutocompleteSuggestionList)
    : undefined;
  const staticOptions = useMemo(
    () => (staticList ? normalizeSuggestions(staticList) : EMPTY),
    [staticList]
  );

  // Ресурс: `partial` ищет на сервере по введённому тексту (debounce внутри), `static`/`preload`
  // грузятся один раз и фильтруются здесь же, как статика, — чтобы работал свой `filter`.
  const source = useResourceOptions(resource);
  const { setSearchInput } = source;
  const serverSearch = source.flags.serverSearch;
  useEffect(() => {
    if (resource && serverSearch) setSearchInput(value);
  }, [resource, serverSearch, value, setSearchInput]);

  const allOptions = resource ? source.options : staticOptions;
  const items = useMemo(
    () => matchSuggestions(allOptions, value, { minChars, filter, clientFilter: !serverSearch }),
    [allOptions, value, minChars, filter, serverSearch]
  );

  const [state, dispatch] = useReducer(autocompleteReducer, undefined, initialAutocompleteState);

  useEffect(() => {
    dispatch({ type: 'items', count: items.length });
  }, [items.length]);

  useEffect(() => {
    if (disabled) dispatch({ type: 'close' });
  }, [disabled]);

  // Пустой список не раскрываем: предлагать нечего. Исключение — первичная загрузка ресурса,
  // чтобы было куда показать индикатор.
  const open = state.open && !disabled && (items.length > 0 || source.loading);
  const activeIndex = open ? state.activeIndex : -1;

  // Подсвеченный пункт держим в видимой области списка при навигации с клавиатуры.
  useEffect(() => {
    if (activeIndex < 0 || typeof document === 'undefined') return;
    const el = document.getElementById(ids.option(activeIndex));
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, ids]);

  const setOpen = useCallback((next: boolean) => dispatch({ type: next ? 'open' : 'close' }), []);

  const select = useCallback(
    (item: NormalizedOption) => {
      onChange(item.value);
      dispatch({ type: 'close' });
    },
    [onChange]
  );

  const getInputProps = useCallback<UseAutocompleteReturn['getInputProps']>(
    (props = {}) => ({
      ...props,
      id: props.id ?? ids.input,
      value,
      disabled: disabled || props.disabled,
      role: 'combobox',
      autoComplete: 'off',
      'aria-autocomplete': 'list',
      'aria-expanded': open,
      'aria-controls': open ? ids.listbox : undefined,
      'aria-activedescendant': activeIndex >= 0 ? ids.option(activeIndex) : undefined,
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        props.onChange?.(e);
        onChange(e.target.value);
        dispatch({ type: 'input' });
      },
      onFocus: (e: FocusEvent<HTMLInputElement>) => {
        props.onFocus?.(e);
        if (openOnFocus) dispatch({ type: 'open' });
      },
      onBlur: (e: FocusEvent<HTMLInputElement>) => {
        props.onBlur?.(e);
        dispatch({ type: 'close' });
        onBlur?.();
      },
      onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
        props.onKeyDown?.(e);
        if (e.defaultPrevented || e.nativeEvent.isComposing) return;
        switch (e.key) {
          case 'ArrowDown':
          case 'ArrowUp':
            if (items.length === 0) return;
            e.preventDefault();
            dispatch({ type: 'move', delta: e.key === 'ArrowDown' ? 1 : -1, count: items.length });
            return;
          case 'Enter':
            // Без подсветки Enter остаётся за формой (сабмит) — текст и так уже в значении.
            if (activeIndex < 0) return;
            e.preventDefault();
            select(items[activeIndex]);
            return;
          case 'Escape':
            if (!open) return;
            e.preventDefault();
            dispatch({ type: 'close' });
            return;
        }
      },
    }),
    [ids, value, disabled, open, activeIndex, items, openOnFocus, onChange, onBlur, select]
  );

  const getListboxProps = useCallback<UseAutocompleteReturn['getListboxProps']>(
    (props = {}) => ({
      ...props,
      id: ids.listbox,
      role: 'listbox',
      // Клик по списку (в т.ч. по скроллбару) не должен уводить фокус из поля.
      onMouseDown: (e: MouseEvent<HTMLElement>) => {
        props.onMouseDown?.(e);
        e.preventDefault();
      },
    }),
    [ids]
  );

  const getOptionProps = useCallback<UseAutocompleteReturn['getOptionProps']>(
    (item, index, props = {}) => ({
      ...props,
      id: ids.option(index),
      role: 'option',
      'aria-selected': index === activeIndex,
      'data-active': index === activeIndex ? true : undefined,
      onMouseDown: (e: MouseEvent<HTMLElement>) => {
        props.onMouseDown?.(e);
        e.preventDefault();
      },
      onMouseMove: (e: MouseEvent<HTMLElement>) => {
        props.onMouseMove?.(e);
        dispatch({ type: 'highlight', index });
      },
      onClick: (e: MouseEvent<HTMLElement>) => {
        props.onClick?.(e);
        select(item);
      },
    }),
    [ids, activeIndex, select]
  );

  return {
    open,
    items,
    activeIndex,
    loading: source.loading,
    loadingMore: source.loadingMore,
    error: source.error,
    hasMore: source.hasMore,
    loadMore: source.loadMore,
    setOpen,
    select,
    ids,
    getInputProps,
    getListboxProps,
    getOptionProps,
  };
}
