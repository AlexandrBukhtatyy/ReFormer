import * as React from 'react';
import { XIcon } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';
import { type FieldHandle, makeElementFieldHandle } from '@/fields/field-handle';
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
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../base/select-base';

// Публичные типы источника опций реэкспортируются отсюда.
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

interface UseResourceOptionsResult {
  options: NormalizedOption[];
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
  searchInput: string;
  setSearchInput: (v: string) => void;
  flags: ReturnType<typeof resolveStrategyFlags>;
}

/**
 * Хук управления асинхронным источником опций по стратегии {@link ResourceConfig.type}.
 * Тонкая React-обёртка над чистым reducer из `select-resource.ts` (вся логика стратегий — там).
 */
function useResourceOptions<T>(resource?: ResourceConfig<T>): UseResourceOptionsResult {
  const flags = React.useMemo(() => resolveStrategyFlags(resource?.type), [resource?.type]);
  const [state, dispatch] = React.useReducer(resourceReducer<T>, undefined, initialResourceState);
  const [searchInput, setSearchInput] = React.useState('');
  const [reloadNonce, setReloadNonce] = React.useState(0);
  const reload = React.useCallback(() => setReloadNonce((n) => n + 1), []);

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
  }, [resource, flags.serverSearch, reloadNonce]);

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
  }, [resource, flags.serverSearch, searchInput, reloadNonce]);

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

  const options = flags.serverSearch ? state.options : filterClient(state.options, searchInput);

  return {
    options,
    loading: state.loading,
    loadingMore: state.loadingMore,
    error: state.error,
    hasMore: hasMore(state),
    loadMore,
    reload,
    searchInput,
    setSearchInput,
    flags,
  };
}

/** Props компонента {@link SelectAsync}. */
export interface SelectAsyncProps extends Omit<
  React.ComponentProps<typeof SelectPrimitive.Root>,
  'value' | 'onValueChange'
> {
  className?: string;
  /** Выбранное значение (строка из `option.value`). `null` — ничего не выбрано. */
  value?: string | null;
  /** Обработчик выбора. При нажатии на крестик (`clearable`) приходит `null`. */
  onChange?: (value: string | null) => void;
  /** Срабатывает при закрытии дропдауна (через `onOpenChange(false)`). */
  onBlur?: () => void;
  /** Асинхронный источник опций. Если задан вместе с `options`, приоритет у `options`. */
  resource?: ResourceConfig<unknown>;
  /** Inline-варианты. Опции с одинаковым `group` объединяются в `SelectGroup` с `SelectLabel`. */
  options?: Array<{ value: string | number; label: string; group?: string }>;
  /** Подсказка в триггере. По умолчанию `'Select an option...'`. */
  placeholder?: string;
  disabled?: boolean;
  /** Показывать ли кнопку очистки (X) справа от значения. По умолчанию `false`. */
  clearable?: boolean;
}

/**
 * Императивный handle {@link SelectAsync}: baseline {@link FieldHandle} (focus/blur/scrollIntoView/
 * getElement на кнопке-триггере) + управление дропдауном и асинхронным источником. Достаётся из схемы:
 * `schema.node('city').getRef<SelectAsyncHandle>().current?.reload()`.
 */
export interface SelectAsyncHandle extends FieldHandle {
  /** Открыть дропдаун. */
  open(): void;
  /** Закрыть дропдаун (эмитит `onBlur`, как обычное закрытие). */
  close(): void;
  /** Сбросить выбранное значение в `null`. */
  clear(): void;
  /** Перезагрузить источник опций с первой страницы. */
  reload(): void;
  /** Догрузить следующую страницу (стратегия `partial`). */
  loadMore(): void;
}

/**
 * Высокоуровневый Select (вариант `async`): inline `options` ИЛИ асинхронный `resource`
 * (`static` / `preload` / `partial`) с поиском, пагинацией и очисткой. Value-based контракт
 * (`value` / `onChange(string|null)` / `onBlur`) — пригоден для формы напрямую (см. `SelectAsyncField`).
 */
const SelectAsync = React.forwardRef<
  SelectAsyncHandle,
  SelectAsyncProps & {
    id?: string;
    'data-testid'?: string;
    'aria-invalid'?: boolean | 'true' | 'false';
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-errormessage'?: string;
    'aria-required'?: boolean | 'true' | 'false';
  }
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
      id,
      'data-testid': dataTestId,
      'aria-invalid': ariaInvalid,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-errormessage': ariaErrorMessage,
      'aria-required': ariaRequired,
      ...props
    },
    ref
  ) => {
    const ro = useResourceOptions(resource);
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    // `open` поднят в контролируемое состояние: Radix Root был неуправляемым, из-за чего
    // императивные open()/close() были невыразимы. onOpenChange по-прежнему эмитит onBlur.
    const [open, setOpen] = React.useState(false);
    // ro.loadMore меняет identity на каждом изменении состояния ресурса — держим его в ref,
    // чтобы handle оставался стабильным (deps [onChange]), но звал всегда актуальные reload/loadMore.
    const roRef = React.useRef(ro);
    roRef.current = ro;

    React.useImperativeHandle(
      ref,
      () => ({
        ...makeElementFieldHandle(triggerRef),
        open: () => setOpen(true),
        close: () => setOpen(false),
        clear: () => onChange?.(null),
        reload: () => roRef.current.reload(),
        loadMore: () => roRef.current.loadMore(),
      }),
      [onChange]
    );

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
    const loadError = !directOptions && ro.error && options.length === 0;

    const handleValueChange = (newValue: string) => {
      onChange?.(newValue);
    };

    const handleOpenChange = (next: boolean) => {
      setOpen(next);
      if (!next) onBlur?.();
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
      <div className="sticky top-0 z-10 border-b bg-popover p-1">
        <input
          type="text"
          value={ro.searchInput}
          onChange={(e) => ro.setSearchInput(e.target.value)}
          // Radix Select перехватывает клавиатуру для typeahead — гасим всплытие,
          // чтобы ввод шёл в поле, а не «прыгал» по опциям.
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Search..."
          className="w-full rounded-sm border border-input px-2 py-1 text-sm outline-none focus:border-ring"
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
          disabled={disabled || initialLoading}
          {...props}
          // open/onOpenChange — ПОСЛЕ {...props}: состояние дропдауна теперь принадлежит компоненту
          // (иначе стороннее props.open перетёрло бы контролируемое состояние и сломало handle).
          open={open}
          onOpenChange={handleOpenChange}
        >
          <SelectTrigger
            ref={triggerRef}
            className={cn('w-full', className, showClearButton && 'pr-14')}
            disabled={initialLoading}
            id={id}
            data-testid={dataTestId}
            aria-invalid={ariaInvalid}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-errormessage={ariaErrorMessage}
            aria-required={ariaRequired}
          >
            <SelectValue
              placeholder={initialLoading ? 'Loading...' : placeholder || 'Select an option...'}
            />
          </SelectTrigger>
          <SelectContent
            position="popper"
            header={searchHeader}
            onViewportScroll={ro.flags.paginated ? handleViewportScroll : undefined}
          >
            {initialLoading ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading...</div>
            ) : loadError ? (
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm text-destructive">
                <span>Failed to load options</span>
                <button
                  type="button"
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    ro.reload();
                  }}
                  className="rounded-sm px-2 py-0.5 text-xs font-medium text-foreground underline underline-offset-2 hover:text-destructive focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  Retry
                </button>
              </div>
            ) : options.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No options available</div>
            ) : (
              <>
                {(() => {
                  const groupedOptions = options.reduce(
                    (groups, option) => {
                      const group = option.group || 'default';
                      if (!groups[group]) groups[group] = [];
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

        {showClearButton && (
          <button
            type="button"
            className="absolute right-8 top-1/2 -translate-y-1/2 transform cursor-pointer border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground focus:outline-none z-10"
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

SelectAsync.displayName = 'SelectAsync';

export { SelectAsync };
