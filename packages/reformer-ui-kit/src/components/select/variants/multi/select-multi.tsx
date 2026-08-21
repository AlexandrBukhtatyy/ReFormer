import * as React from 'react';
import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { type FieldHandle, makeElementFieldHandle } from '@/fields/field-handle';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/popover';
import { Spinner } from '@/components/spinner';
import { isNearBottom, type ResourceConfig, type NormalizedOption } from '../async/select-resource';
import { useResourceOptions } from '../async/use-resource-options';

/** Сколько чипов показать в триггере, прежде чем схлопнуть их в сводку «Выбрано: N». */
const DEFAULT_SUMMARY_THRESHOLD = 3;

/** Опция мультивыбора, заданная inline (сериализуемый источник для формы/DSL). */
export interface SelectMultiOption {
  value: string;
  label: string;
  group?: string;
}

/** Props компонента {@link SelectMulti}. */
export interface SelectMultiProps {
  className?: string;
  /**
   * Выбранные значения. Приходит массивом всегда: `multiValueAdapter` разворачивает `null` в `[]`.
   */
  value?: string[];
  /** Изменение выбора. Всегда получает НОВЫЙ массив — см. `multiValueAdapter`. */
  onChange?: (value: string[]) => void;
  /** Срабатывает при закрытии popover (снятие фокуса). */
  onBlur?: () => void;
  /** Inline-опции. Взаимоисключающи с `resource`: если заданы — источник не опрашивается. */
  options?: SelectMultiOption[];
  /**
   * Асинхронный источник опций (`static` / `preload` / `partial`). В JSON-форме недостижим:
   * требует функцию `load` — передаётся через реестр компонентов.
   */
  resource?: ResourceConfig<unknown>;
  /**
   * Лейблы для уже выбранных значений, которых может не быть в текущей странице опций.
   *
   * Нужен именно при `resource`: выбранное значение легко оказывается вне загруженной страницы
   * (сменили поисковый запрос, перезагрузили источник, выбрали на первой странице и пролистали
   * дальше). Без справочника чип показывал бы сырой `value`. Сериализуем — доступен и из JSON-DSL.
   */
  selectedOptions?: SelectMultiOption[];
  /** Подсказка в триггере, пока ничего не выбрано. */
  placeholder?: string;
  /** Подсказка в поле поиска. */
  searchPlaceholder?: string;
  /** Текст пустого состояния (ничего не найдено). */
  emptyText?: string;
  /** Показывать крестик сброса ВСЕГО выбора. */
  clearable?: boolean;
  /**
   * Потолок числа выбранных: по достижении невыбранные пункты выключаются.
   * Подсказка интерфейса, а НЕ правило формы — ограничение задавайте валидатором `maxLength(n)`.
   */
  maxItems?: number;
  /** Сколько чипов показать в триггере до схлопывания в сводку. По умолчанию 3. */
  summaryThreshold?: number;
  disabled?: boolean;
  /** id корневого элемента — по нему форма связывает подпись, описание и сообщение об ошибке. */
  id?: string;
  /** Префикс `data-testid`; на триггер + `-<value>` на каждый пункт списка. */
  'data-testid'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
  'aria-required'?: boolean | 'true' | 'false';
}

/**
 * Императивный handle {@link SelectMulti}: baseline {@link FieldHandle} на кнопке-триггере +
 * управление popover'ом и асинхронным источником.
 */
export interface SelectMultiHandle extends FieldHandle {
  /** Открыть popover со списком. */
  open(): void;
  /** Закрыть popover (эмитит `onBlur`, как обычное закрытие). */
  close(): void;
  /** Сбросить весь выбор. */
  clear(): void;
  /** Перезагрузить источник опций с первой страницы. */
  reload(): void;
  /** Догрузить следующую страницу (стратегия `partial`). */
  loadMore(): void;
}

/**
 * Select в режиме множественного выбора (вариант `multi`).
 *
 * Radix Select мультивыбора не поддерживает в принципе: его `Root` типизирован строго под одно
 * значение, `SelectValue` рисует одно, а `SelectItem` даёт `role=option` в listbox без
 * `aria-multiselectable`. Поэтому вариант НЕ переиспользует `select-base.tsx`, а строится на
 * `Popover` со своим listbox.
 *
 * На cmdk (как `ComboboxMulti`) он тоже построен быть не может, и это ограничение упаковки, а не
 * вкуса: каталоги `command` и `combobox` лежат в HEAVY и держат cmdk опциональным peer'ом, а
 * `select` — лёгкий и попадает в главный barrel. Импорт `Command` сюда протащил бы cmdk в
 * `dist/index.js` и сделал бы его обязательным для КАЖДОГО потребителя barrel'а. Отсюда свой
 * listbox и своё поле поиска — ровно такое же, как уже есть в `select-async.tsx`.
 *
 * Стратегии источника, поиск и пагинация переиспользуются из соседнего варианта без изменений
 * (`use-resource-options.ts` поверх чистого редьюсера `select-resource.ts`).
 */
const SelectMulti = React.forwardRef<SelectMultiHandle, SelectMultiProps>(function SelectMulti(
  {
    className,
    value,
    onChange,
    onBlur,
    options: directOptions,
    resource,
    selectedOptions,
    placeholder,
    searchPlaceholder,
    emptyText,
    clearable = false,
    maxItems,
    summaryThreshold = DEFAULT_SUMMARY_THRESHOLD,
    disabled,
    id,
    'data-testid': dataTestId,
    'aria-invalid': ariaInvalid,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-required': ariaRequired,
  },
  ref
) {
  const ro = useResourceOptions(resource);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);

  // loadMore/reload меняют identity на каждом изменении состояния ресурса — держим их в ref,
  // чтобы handle оставался стабильным, но звал всегда актуальные.
  const roRef = React.useRef(ro);
  roRef.current = ro;

  const selected = React.useMemo(() => value ?? [], [value]);

  const options: NormalizedOption[] = React.useMemo(() => {
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

  /**
   * Лейблы всех значений, которые когда-либо попадались в опциях этой сессии.
   *
   * Без кэша чип «слепнет» и показывает сырой `value` сразу же, как выбранное значение уходит из
   * текущей страницы: сменили поисковый запрос, догрузили следующую страницу, перезагрузили
   * источник. Кэш только пополняется — выбранные значения из `value` не выбрасываются никогда.
   */
  const labelCache = React.useRef<Map<string, string>>(new Map());
  React.useEffect(() => {
    for (const opt of options) labelCache.current.set(opt.value, opt.label);
  }, [options]);
  React.useEffect(() => {
    for (const opt of selectedOptions ?? []) labelCache.current.set(opt.value, opt.label);
  }, [selectedOptions]);

  /** Порядок резолва: текущие опции → кэш → справочник выбранных → сырой value. */
  const labelOf = React.useCallback(
    (v: string) =>
      options.find((o) => o.value === v)?.label ??
      labelCache.current.get(v) ??
      selectedOptions?.find((o) => o.value === v)?.label ??
      v,
    [options, selectedOptions]
  );

  React.useImperativeHandle(
    ref,
    () => ({
      ...makeElementFieldHandle(triggerRef),
      open: () => setOpen(true),
      close: () => setOpen(false),
      clear: () => onChange?.([]),
      reload: () => roRef.current.reload(),
      loadMore: () => roRef.current.loadMore(),
    }),
    [onChange]
  );

  const atLimit = maxItems !== undefined && selected.length >= maxItems;
  const showSearch = !directOptions && !!resource && ro.flags.searchable;
  const initialLoading = !directOptions && ro.loading;
  const loadError = !directOptions && ro.error && options.length === 0;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) onBlur?.();
    else setActiveIndex(0);
  };

  /** Тогл значения. Массив ВСЕГДА новый: сигнал бэйлится по `!==`. */
  const toggle = (optionValue: string) => {
    const has = selected.includes(optionValue);
    if (!has && atLimit) return;
    onChange?.(has ? selected.filter((v) => v !== optionValue) : [...selected, optionValue]);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.([]);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!ro.flags.paginated) return;
    if (isNearBottom(e.currentTarget)) ro.loadMore();
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (options.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case ' ':
      case 'Enter': {
        e.preventDefault();
        const opt = options[activeIndex];
        if (opt) toggle(opt.value);
        break;
      }
    }
  };

  const showClearButton = clearable && selected.length > 0 && !disabled && !initialLoading;
  const collapsed = selected.length > summaryThreshold;

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled || initialLoading}
            id={id}
            data-testid={dataTestId}
            aria-invalid={ariaInvalid}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-errormessage={ariaErrorMessage}
            aria-required={ariaRequired}
            className={cn(
              'h-auto min-h-9 w-full justify-between font-normal',
              showClearButton && 'pr-14',
              className
            )}
          >
            {initialLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Spinner className="size-4" />
                Загрузка...
              </span>
            ) : selected.length === 0 ? (
              <span className="truncate text-muted-foreground">
                {placeholder ?? 'Select options...'}
              </span>
            ) : collapsed ? (
              <span className="truncate" data-slot="select-multi-summary">
                Выбрано: {selected.length}
              </span>
            ) : (
              <span className="flex flex-wrap gap-1" data-slot="select-multi-chips">
                {selected.map((v) => (
                  <Badge key={v} variant="secondary" data-slot="select-multi-chip">
                    {labelOf(v)}
                  </Badge>
                ))}
              </span>
            )}
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          {showSearch && (
            <div className="sticky top-0 z-10 border-b bg-popover p-1">
              <input
                type="text"
                value={ro.searchInput}
                onChange={(e) => ro.setSearchInput(e.target.value)}
                placeholder={searchPlaceholder ?? 'Search...'}
                className="w-full rounded-sm border border-input px-2 py-1 text-sm outline-none focus:border-ring"
                aria-label="Search options"
              />
            </div>
          )}
          <div
            ref={listRef}
            role="listbox"
            aria-multiselectable="true"
            tabIndex={0}
            onKeyDown={handleListKeyDown}
            onScroll={handleScroll}
            className="max-h-60 overflow-y-auto p-1 outline-none"
            data-slot="select-multi-list"
          >
            {loadError && (
              <div className="px-2 py-1.5 text-sm text-destructive">
                Не удалось загрузить опции.
              </div>
            )}
            {!loadError && options.length === 0 && !ro.loadingMore && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {emptyText ?? 'No options found.'}
              </div>
            )}
            {options.map((option, index) => {
              const checked = selected.includes(option.value);
              const blocked = atLimit && !checked;
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={checked}
                  aria-disabled={blocked || undefined}
                  data-active={index === activeIndex ? '' : undefined}
                  data-testid={dataTestId ? `${dataTestId}-${option.value}` : undefined}
                  onClick={() => !blocked && toggle(option.value)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none',
                    'data-[active]:bg-accent data-[active]:text-accent-foreground',
                    blocked && 'pointer-events-none opacity-50'
                  )}
                >
                  <CheckIcon className={cn('size-4', checked ? 'opacity-100' : 'opacity-0')} />
                  {option.label}
                </div>
              );
            })}
            {ro.loadingMore && (
              <div className="flex justify-center py-2">
                <Spinner className="size-4" />
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {showClearButton && (
        <button
          type="button"
          className="absolute top-1/2 right-8 z-10 -translate-y-1/2 transform cursor-pointer border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
          onClick={handleClear}
          aria-label="Clear selection"
          tabIndex={-1}
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
});
SelectMulti.displayName = 'SelectMulti';

export { SelectMulti };
