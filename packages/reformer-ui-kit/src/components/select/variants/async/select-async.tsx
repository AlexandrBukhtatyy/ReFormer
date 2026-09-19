import * as React from 'react';
import { XIcon } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';
import { type FieldHandle, makeElementFieldHandle } from '@/fields/field-handle';
import {
  useFieldTooltip,
  SELECT_VALUE_RESERVE,
  TRAILING_CLEAR,
  TRAILING_CLUSTER,
} from '@/fields/field-tooltip';
// Стратегии, поиск и пагинация живут в `use-resource-options` (React-обёртка над чистым
// редьюсером `select-resource`): их делит с мульти-вариантом, который Radix Select не использует.
import { useResourceOptions } from './use-resource-options';
import { isNearBottom, type ResourceConfig } from './select-resource';
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
  /** Подсказка-тултип у иконки (i) внутри поля: правее крестика очистки, левее шеврона. */
  tooltip?: string;
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
      tooltip,
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

    // Правая зона — кластер [крестик][(i)] левее шеврона (он flex-ребёнок триггера и остаётся у края).
    const hint = useFieldTooltip(tooltip, { id, describedBy: ariaDescribedBy, testId: dataTestId });
    const trailingCount = (showClearButton ? 1 : 0) + (hint.node ? 1 : 0);

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
            // Резерв под кластер — margin значения, а не padding: при overflow:hidden текст клипуется
            // по padding-box и залез бы под иконки. select-base.tsx (дословный порт) не трогаем.
            className={cn('w-full', className, SELECT_VALUE_RESERVE[trailingCount])}
            disabled={initialLoading}
            id={id}
            data-testid={dataTestId}
            aria-invalid={ariaInvalid}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={hint.describedBy}
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

        {trailingCount > 0 && (
          <div data-slot="select-trailing" className={TRAILING_CLUSTER}>
            {showClearButton && (
              <button
                type="button"
                className={TRAILING_CLEAR}
                onClick={handleClear}
                aria-label="Clear selection"
                tabIndex={-1}
              >
                <XIcon className="size-4" />
              </button>
            )}
            {hint.node}
          </div>
        )}
      </div>
    );
  }
);

SelectAsync.displayName = 'SelectAsync';

export { SelectAsync };
