import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  resolveStrategyFlags,
  resourceReducer,
  initialResourceState,
  filterClient,
  hasMore,
  isNearBottom,
  type ResourceConfig,
  type NormalizedOption,
} from './select-resource';

// Публичные типы источника опций реэкспортируются отсюда для обратной
// совместимости (index.ts исторически берёт `ResourceConfig` из этого модуля).
export type {
  ResourceConfig,
  ResourceLoadParams,
  ResourceItem,
  ResourceResult,
  ResourceStrategy,
  NormalizedOption,
} from './select-resource';

/** Задержка debounce (мс) для серверного поиска в стратегии `partial`. */
const SEARCH_DEBOUNCE_MS = 300;

/** Результат хука {@link useResourceOptions}. */
interface UseResourceOptionsResult {
  /** Опции к показу (с учётом клиентской фильтрации для `preload`). */
  options: NormalizedOption[];
  /** Первичная загрузка (маунт или смена поискового запроса). */
  loading: boolean;
  /** Догрузка следующей страницы (пагинация). */
  loadingMore: boolean;
  /** Есть ли ещё непогруженные страницы. */
  hasMore: boolean;
  /** Подгрузить следующую страницу (стратегия `partial`). */
  loadMore: () => void;
  /** Текущее значение поля поиска. */
  searchInput: string;
  /** Изменить поле поиска (клиентская фильтрация или серверный запрос). */
  setSearchInput: (v: string) => void;
  /** Флаги стратегии (searchable / paginated / serverSearch). */
  flags: ReturnType<typeof resolveStrategyFlags>;
}

/**
 * Хук управления асинхронным источником опций {@link Select} по стратегии
 * {@link ResourceConfig.type}. Тонкая React-обёртка над чистым reducer из
 * `select-resource.ts` (вся логика стратегий/пагинации/фильтрации — там).
 *
 * @typeParam T - тип «сырого» значения опции
 * @param resource - конфигурация источника (или `undefined`, если опции inline)
 * @returns состояние и колбэки {@link UseResourceOptionsResult}
 */
function useResourceOptions<T>(resource?: ResourceConfig<T>): UseResourceOptionsResult {
  const flags = React.useMemo(() => resolveStrategyFlags(resource?.type), [resource?.type]);
  const [state, dispatch] = React.useReducer(resourceReducer<T>, undefined, initialResourceState);
  const [searchInput, setSearchInput] = React.useState('');

  // static / preload: одна загрузка при монтировании (searchInput на сервер не влияет).
  React.useEffect(() => {
    if (!resource || flags.serverSearch) return;
    let cancelled = false;
    dispatch({ kind: 'load-start', search: '' });
    resource.load({}).then(
      (result) => {
        if (!cancelled) dispatch({ kind: 'load-success', result, page: 1 });
      },
      () => {
        if (!cancelled) dispatch({ kind: 'load-error' });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [resource, flags.serverSearch]);

  // partial: серверный поиск с debounce — перезагружает первую страницу.
  React.useEffect(() => {
    if (!resource || !flags.serverSearch) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      dispatch({ kind: 'load-start', search: searchInput });
      resource.load({ search: searchInput, page: 1, pageSize: resource.pageSize }).then(
        (result) => {
          if (!cancelled) dispatch({ kind: 'load-success', result, page: 1 });
        },
        () => {
          if (!cancelled) dispatch({ kind: 'load-error' });
        }
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [resource, flags.serverSearch, searchInput]);

  const loadMore = React.useCallback(() => {
    if (!resource || !flags.paginated) return;
    if (state.loading || state.loadingMore || !hasMore(state)) return;
    const nextPage = state.page + 1;
    dispatch({ kind: 'load-more-start' });
    resource.load({ search: state.search, page: nextPage, pageSize: resource.pageSize }).then(
      (result) => dispatch({ kind: 'load-more-success', result, page: nextPage }),
      () => dispatch({ kind: 'load-error', more: true })
    );
  }, [resource, flags.paginated, state]);

  // preload/static: поиск фильтрует загруженные опции на клиенте.
  // partial: сервер уже вернул отфильтрованную выборку.
  const options = flags.serverSearch ? state.options : filterClient(state.options, searchInput);

  return {
    options,
    loading: state.loading,
    loadingMore: state.loadingMore,
    hasMore: hasMore(state),
    loadMore,
    searchInput,
    setSearchInput,
    flags,
  };
}

/** Props компонента {@link Select}. */
export interface SelectProps<T> extends Omit<
  React.ComponentProps<typeof SelectPrimitive.Root>,
  'value' | 'onValueChange'
> {
  /** Дополнительный CSS-класс для триггера. */
  className?: string;
  /** Выбранное значение. Всегда строка из `option.value`. `null` — ничего не выбрано. */
  value?: string | null;
  /** Обработчик выбора. При нажатии на крестик (`clearable`) приходит `null`. */
  onChange?: (value: string | null) => void;
  /** Срабатывает при закрытии дропдауна (через `onOpenChange(false)`). */
  onBlur?: () => void;
  /** Асинхронный источник опций. Если задан вместе с `options`, приоритет у `options`. */
  resource?: ResourceConfig<T>;
  /**
   * Inline-варианты. `value` приводится к строке. Опции с одинаковым `group`
   * объединяются в `SelectGroup` с `SelectLabel` (см. рецепт grouped options).
   */
  options?: Array<{ value: string | number; label: string; group?: string }>;
  /** Подсказка в триггере. По умолчанию `'Select an option...'`. */
  placeholder?: string;
  /** Блокирует выбор. */
  disabled?: boolean;
  /** Показывать ли кнопку очистки (X) справа от значения. По умолчанию `false`. */
  clearable?: boolean;
}

/**
 * Выпадающий список на `@radix-ui/react-select`. Два источника данных: inline
 * `options` и асинхронный `resource` со стратегией загрузки
 * ({@link ResourceConfig.type}):
 *
 * - `static` — один `load({})` при маунте, без поиска;
 * - `preload` — грузит всё сразу, поиск фильтрует опции на клиенте;
 * - `partial` — серверные поиск (`load({ search })` с debounce) и пагинация
 *   (`load({ page })` по мере скролла до `totalCount`).
 *
 * Для `preload`/`partial` в дропдауне показывается поле поиска. При
 * `clearable=true` рядом со значением есть крестик сброса в `null`.
 *
 * @example Inline-options
 * ```tsx
 * import { Select } from '@reformer/ui-kit';
 *
 * <Select
 *   value={loanType}
 *   onChange={setLoanType}
 *   placeholder="Тип кредита"
 *   options={[
 *     { value: 'consumer', label: 'Потребительский' },
 *     { value: 'mortgage', label: 'Ипотека' },
 *   ]}
 * />
 * ```
 *
 * @example Серверные поиск и пагинация (resource type='partial')
 * ```tsx
 * import { Select, type ResourceConfig } from '@reformer/ui-kit';
 *
 * const users: ResourceConfig<string> = {
 *   type: 'partial',
 *   pageSize: 20,
 *   load: async ({ search = '', page = 1, pageSize = 20 }) => {
 *     const res = await fetch(`/api/users?q=${search}&page=${page}&size=${pageSize}`);
 *     const { rows, total } = await res.json();
 *     return {
 *       items: rows.map((u) => ({ id: u.id, label: u.name, value: u.id })),
 *       totalCount: total,
 *     };
 *   },
 * };
 *
 * <Select value={userId} onChange={setUserId} resource={users} clearable />
 * ```
 *
 * @example Предзагрузка с клиентским поиском (resource type='preload')
 * ```tsx
 * import { Select, type ResourceConfig } from '@reformer/ui-kit';
 *
 * const countries: ResourceConfig<string> = {
 *   type: 'preload',
 *   load: async () => {
 *     const res = await fetch('/api/countries');
 *     const items = await res.json();
 *     return {
 *       items: items.map((c) => ({ id: c.id, label: c.name, value: c.code })),
 *       totalCount: items.length,
 *     };
 *   },
 * };
 *
 * <Select value={country} onChange={setCountry} resource={countries} />
 * ```
 */
const Select = React.forwardRef<
  HTMLButtonElement,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SelectProps<any> & { 'data-testid'?: string; 'aria-invalid'?: boolean | 'true' | 'false' }
>(
  (
    {
      className,
      value,
      onChange,
      onBlur,
      resource,
      options: directOptions,
      placeholder,
      disabled,
      clearable = false,
      'data-testid': dataTestId,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) => {
    const ro = useResourceOptions(resource);

    // Прямые опции имеют приоритет над resource.
    const options = React.useMemo(() => {
      if (directOptions) {
        return directOptions.map((opt) => ({
          id: opt.value,
          label: opt.label,
          value: String(opt.value),
          group: opt.group,
        }));
      }
      return ro.options;
    }, [directOptions, ro.options]);

    const showSearch = !directOptions && !!resource && ro.flags.searchable;
    const initialLoading = !directOptions && ro.loading;

    const handleValueChange = (newValue: string) => {
      onChange?.(newValue);
    };

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        onBlur?.();
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(null);
    };

    const handleViewportScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (!ro.flags.paginated) return;
      if (isNearBottom(e.currentTarget)) ro.loadMore();
    };

    const showClearButton = clearable && value && !disabled && !initialLoading;

    const searchHeader = showSearch ? (
      <div className="sticky top-0 z-10 border-b bg-white p-1">
        <input
          type="text"
          value={ro.searchInput}
          onChange={(e) => ro.setSearchInput(e.target.value)}
          // Radix Select перехватывает клавиатуру для typeahead-навигации —
          // гасим всплытие, чтобы ввод шёл в поле, а не «прыгал» по опциям.
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Search..."
          className="w-full rounded-sm border border-gray-200 px-2 py-1 text-sm outline-none focus:border-ring"
          aria-label="Search options"
        />
      </div>
    ) : null;

    return (
      <div className="relative w-full">
        <SelectPrimitive.Root
          data-slot="select"
          value={value || ''}
          onValueChange={handleValueChange}
          onOpenChange={handleOpenChange}
          disabled={disabled || initialLoading}
          {...props}
        >
          <SelectTrigger
            ref={ref}
            className={cn(className, showClearButton && 'pr-8')}
            disabled={initialLoading}
            data-testid={dataTestId}
            aria-invalid={ariaInvalid}
          >
            <SelectValue
              placeholder={initialLoading ? 'Loading...' : placeholder || 'Select an option...'}
            />
          </SelectTrigger>
          <SelectContent
            header={searchHeader}
            onViewportScroll={ro.flags.paginated ? handleViewportScroll : undefined}
          >
            {initialLoading ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading...</div>
            ) : options.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No options available</div>
            ) : (
              <>
                {(() => {
                  const groupedOptions = options.reduce(
                    (groups, option) => {
                      const group = option.group || 'default';
                      if (!groups[group]) {
                        groups[group] = [];
                      }
                      groups[group].push(option);
                      return groups;
                    },
                    {} as Record<string, typeof options>
                  );

                  return Object.entries(groupedOptions).map(([groupName, groupOptions]) => (
                    <SelectGroup key={groupName}>
                      {groupName !== 'default' && <SelectLabel>{groupName}</SelectLabel>}
                      {groupOptions.map((option) => (
                        <SelectItem key={option.id} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ));
                })()}
                {ro.loadingMore && (
                  <div className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                    Loading more...
                  </div>
                )}
              </>
            )}
          </SelectContent>
        </SelectPrimitive.Root>

        {/* Clear button */}
        {showClearButton && (
          <button
            type="button"
            className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors bg-transparent border-none p-0 cursor-pointer focus:outline-none z-10"
            onClick={handleClear}
            aria-label="Clear selection"
            tabIndex={-1}
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

/**
 * Группа `<SelectItem>` с заголовком {@link SelectLabel}. Тонкая обёртка над
 * `Radix.Select.Group`. Используется при ручной сборке кастомного дропдауна
 * вместо `options`-проп `Select`.
 *
 * @example Группа с заголовком
 * ```tsx
 * import { SelectGroup, SelectLabel, SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectGroup>
 *   <SelectLabel>Фрукты</SelectLabel>
 *   <SelectItem value="apple">Яблоко</SelectItem>
 *   <SelectItem value="pear">Груша</SelectItem>
 * </SelectGroup>
 * ```
 *
 * @example Несколько групп подряд внутри SelectContent
 * ```tsx
 * import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@reformer/ui-kit/select';
 *
 * <Select value={city} onChange={setCity}>
 *   <SelectTrigger><SelectValue placeholder="Город" /></SelectTrigger>
 *   <SelectContent>
 *     <SelectGroup>
 *       <SelectLabel>Россия</SelectLabel>
 *       <SelectItem value="msk">Москва</SelectItem>
 *     </SelectGroup>
 *     <SelectGroup>
 *       <SelectLabel>Беларусь</SelectLabel>
 *       <SelectItem value="minsk">Минск</SelectItem>
 *     </SelectGroup>
 *   </SelectContent>
 * </Select>
 * ```
 */
function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

/**
 * Отображает выбранное значение внутри {@link SelectTrigger}. Обёртка над
 * `Radix.Select.Value`. Поддерживает `placeholder` для пустого состояния.
 *
 * @example Стандартный placeholder
 * ```tsx
 * import { SelectTrigger, SelectValue } from '@reformer/ui-kit/select';
 *
 * <SelectTrigger>
 *   <SelectValue placeholder="Выберите вариант" />
 * </SelectTrigger>
 * ```
 *
 * @example Кастомное представление выбранного значения через children
 * ```tsx
 * import { SelectTrigger, SelectValue } from '@reformer/ui-kit/select';
 *
 * <SelectTrigger>
 *   <SelectValue placeholder="Не выбрано">
 *     {value && <span className="font-bold">{value}</span>}
 *   </SelectValue>
 * </SelectTrigger>
 * ```
 */
function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

/**
 * Кнопка-открывалка списка для {@link Select}. Обёртка над
 * `Radix.Select.Trigger` с дефолтными стилями (h-9, rounded, border) и
 * `ChevronDown` справа.
 *
 * @example Дефолтный размер
 * ```tsx
 * import { SelectTrigger, SelectValue } from '@reformer/ui-kit/select';
 *
 * <SelectTrigger>
 *   <SelectValue placeholder="Выберите страну" />
 * </SelectTrigger>
 * ```
 *
 * @example Компактный (size='sm')
 * ```tsx
 * import { SelectTrigger, SelectValue } from '@reformer/ui-kit/select';
 *
 * <SelectTrigger size="sm" className="w-32">
 *   <SelectValue placeholder="Сорт." />
 * </SelectTrigger>
 * ```
 */
function SelectTrigger({
  className,
  size = 'default',
  children,
  'aria-label': ariaLabel,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'sm' | 'default';
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      aria-label={ariaLabel || 'Select an option'}
      className={cn(
        'h-9 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-xs transition-colors',
        '!bg-white !text-black',
        'placeholder:text-muted-foreground data-[placeholder]:text-gray-500',
        'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        'flex items-center justify-between gap-2',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-gray-500",
        className
      )}
      style={{ backgroundColor: 'white', color: 'black' }}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/**
 * Дропдаун-контent {@link Select} (попап со списком). Обёртка над
 * `Radix.Select.Content` с порталом, скролл-кнопками сверху/снизу и
 * `position='popper'` по умолчанию (растягивается под ширину триггера).
 *
 * Опционально принимает `header` (нескроллящаяся шапка, например поле поиска)
 * и `onViewportScroll` (для infinite-scroll — вешается на скроллящийся
 * viewport со списком опций).
 *
 * @example Popper-режим (default — ширина равна триггеру)
 * ```tsx
 * import { SelectContent, SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectContent>
 *   <SelectItem value="a">A</SelectItem>
 *   <SelectItem value="b">B</SelectItem>
 * </SelectContent>
 * ```
 *
 * @example Item-aligned (контент центрируется по выбранному элементу)
 * ```tsx
 * import { SelectContent, SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectContent position="item-aligned">
 *   {LONG_LIST.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}
 * </SelectContent>
 * ```
 */
function SelectContent({
  className,
  children,
  position = 'popper',
  header,
  onViewportScroll,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content> & {
  /** Нескроллящаяся шапка над списком (например, поле поиска). */
  header?: React.ReactNode;
  /** Обработчик прокрутки viewport-а со списком (для infinite-scroll). */
  onViewportScroll?: React.UIEventHandler<HTMLDivElement>;
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-white text-black shadow-md',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className
        )}
        style={position === 'popper' ? { width: 'var(--radix-select-trigger-width)' } : undefined}
        position={position}
        {...props}
      >
        {header}
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn('p-1', position === 'popper' && 'w-full')}
          onScroll={onViewportScroll}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

/**
 * Заголовок секции внутри {@link SelectGroup}. Обёртка над
 * `Radix.Select.Label`. Не выбирается; используется для визуального разделения
 * групп.
 *
 * @example Простая подпись группы
 * ```tsx
 * import { SelectGroup, SelectLabel, SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectGroup>
 *   <SelectLabel>Овощи</SelectLabel>
 *   <SelectItem value="potato">Картошка</SelectItem>
 * </SelectGroup>
 * ```
 *
 * @example Кастомный класс заголовка
 * ```tsx
 * import { SelectGroup, SelectLabel } from '@reformer/ui-kit/select';
 *
 * <SelectGroup>
 *   <SelectLabel className="text-blue-600 font-bold">Премиум</SelectLabel>
 * </SelectGroup>
 * ```
 */
function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn('text-muted-foreground px-2 py-1.5 text-xs', className)}
      {...props}
    />
  );
}

/**
 * Один пункт списка {@link Select}. Обёртка над `Radix.Select.Item` с
 * чекмарком-индикатором (`CheckIcon`) для выбранного варианта.
 *
 * @example Простой пункт
 * ```tsx
 * import { SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectItem value="apple">Яблоко</SelectItem>
 * ```
 *
 * @example Заблокированный пункт
 * ```tsx
 * import { SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectItem value="premium" disabled>
 *   Premium (требуется подписка)
 * </SelectItem>
 * ```
 */
function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-3 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

/**
 * Кнопка-стрелка для скролла вверх в дропдауне {@link SelectContent}.
 * `SelectContent` добавляет её автоматически, экспорт нужен для случаев
 * полностью кастомной сборки.
 *
 * @example Автоматическое добавление SelectContent
 * ```tsx
 * import { SelectContent, SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectContent>
 *   <SelectItem value="a">A</SelectItem>
 * </SelectContent>
 * ```
 *
 * @example Ручное использование (кастомная сборка дропдауна)
 * ```tsx
 * import { SelectScrollUpButton } from '@reformer/ui-kit/select';
 *
 * <SelectScrollUpButton className="bg-gray-50 text-gray-600" />
 * ```
 */
function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

/**
 * Кнопка-стрелка для скролла вниз в дропдауне {@link SelectContent}.
 * `SelectContent` добавляет её автоматически, экспорт нужен для случаев
 * полностью кастомной сборки.
 *
 * @example Автоматическое добавление SelectContent
 * ```tsx
 * import { SelectContent, SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectContent>
 *   <SelectItem value="a">A</SelectItem>
 * </SelectContent>
 * ```
 *
 * @example Ручное использование (кастомная сборка дропдауна)
 * ```tsx
 * import { SelectScrollDownButton } from '@reformer/ui-kit/select';
 *
 * <SelectScrollDownButton className="bg-gray-50 text-gray-600" />
 * ```
 */
function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectTrigger,
  SelectValue,
};
