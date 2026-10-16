import * as React from 'react';
import { isSameDay } from 'date-fns';
import { useI18n } from '@reformer/core/react';
import { CalendarIcon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useKitMessages } from '@/i18n/messages';
import { makeElementFieldHandle } from '@/fields/field-handle';
import { defineFieldControl } from '@/fields/field-control';
import { multiValueAdapter } from '@/fields/adapters';
import {
  useFieldTooltip,
  BUTTON_TRAILING_RESERVE,
  TRAILING_CLEAR,
  TRAILING_CLUSTER_EDGE,
} from '@/fields/field-tooltip';
import { Button } from '@/components/button';
import { Calendar } from '@/components/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/popover';
import type { DatePickerHandle } from '../base/date-picker-base';
import { formatDate } from '../base/date-picker-format';

/** Сколько дат перечислить в кнопке, прежде чем схлопнуть их в сводку «Dates selected: N». */
const DEFAULT_SUMMARY_THRESHOLD = 3;

export interface DatePickerMultiProps extends Omit<
  React.ComponentProps<typeof Button>,
  'value' | 'onChange'
> {
  /**
   * Выбранные даты (управляемое значение). Приходит массивом всегда: `multiValueAdapter`
   * разворачивает `null` в `[]`.
   */
  value?: Date[];
  /** Изменение выбора. Получает НОВЫЙ массив, отсортированный по возрастанию. */
  onChange?: (value: Date[]) => void;
  /** Закрытие календаря — момент, когда поле считается покинутым. */
  onBlur?: () => void;
  /**
   * Текст кнопки-триггера, когда даты не выбраны.
   * @defaultMessage kit.datePicker.placeholderMulti
   */
  placeholder?: string;
  /**
   * Формат дат — токены `date-fns` (`dd.MM.yyyy`). По умолчанию — `dateFormat` локали, а без него
   * даты пишутся по правилам языка (`Intl`, `dateStyle: 'medium'` — список короче).
   */
  dateFormat?: string;
  /** Сколько месяцев показывать рядом. По умолчанию 1. */
  numberOfMonths?: number;
  /**
   * Потолок числа выбранных дат: по достижении невыбранные дни выключаются.
   * Подсказка интерфейса, а НЕ правило формы — ограничение задавайте валидатором `maxLength(n)`.
   */
  maxItems?: number;
  /** Сколько дат перечислить в кнопке до схлопывания в сводку. По умолчанию 3. */
  summaryThreshold?: number;
  /** Крестик сброса всех дат у правого края кнопки. */
  clearable?: boolean;
  /** Подсказка-тултип у иконки (i) у правого края кнопки. */
  tooltip?: string;
  /** `data-testid` кнопки-триггера; крестик сброса получает `<testId>-clear`. */
  'data-testid'?: string;
}

/** Императивный handle {@link DatePickerMulti}: как у DatePicker + сброс выбора. */
export interface DatePickerMultiHandle extends DatePickerHandle {
  /** Сбросить все выбранные даты. */
  clear(): void;
}

/** Даты по возрастанию — новый массив; порядок кликов в значение не попадает. */
export function sortDates(dates: readonly Date[]): Date[] {
  return [...dates].sort((a, b) => a.getTime() - b.getTime());
}

/**
 * DatePickerMulti — выбор нескольких дат: Popover с Calendar (`mode="multiple"`) и кнопкой-
 * триггером со списком выбранных дат (сверх `summaryThreshold` — сводка с числом).
 *
 * Календарь между кликами не закрывается: клик по дню добавляет его, повторный — снимает.
 */
const DatePickerMulti = React.forwardRef<DatePickerMultiHandle, DatePickerMultiProps>(
  function DatePickerMulti(
    {
      value,
      onChange,
      onBlur,
      placeholder,
      dateFormat,
      numberOfMonths = 1,
      maxItems,
      summaryThreshold = DEFAULT_SUMMARY_THRESHOLD,
      clearable = false,
      tooltip,
      className,
      disabled,
      id,
      'data-testid': dataTestId,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) {
    const t = useKitMessages();
    const i18n = useI18n();
    const [open, setOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const selected = React.useMemo(() => value ?? [], [value]);

    React.useImperativeHandle(
      ref,
      () => ({
        ...makeElementFieldHandle(triggerRef),
        open: () => setOpen(true),
        close: () => setOpen(false),
        clear: () => onChange?.([]),
      }),
      [onChange]
    );

    const handleOpenChange = (next: boolean) => {
      setOpen(next);
      if (!next) onBlur?.();
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.([]);
    };

    // `max` react-day-picker на пределе заменяет выбор кликнутым днём — вместо этого гасим
    // невыбранные дни, как `maxItems` у SelectMulti.
    const atLimit = maxItems !== undefined && selected.length >= maxItems;
    const blockUnselected = React.useCallback(
      (day: Date) => !selected.some((date) => isSameDay(date, day)),
      [selected]
    );

    const pattern = dateFormat ?? i18n.locale.dateFormat;
    const showClear = clearable && selected.length > 0 && !disabled;
    const hint = useFieldTooltip(tooltip, { id, describedBy: ariaDescribedBy, testId: dataTestId });
    const trailingCount = (showClear ? 1 : 0) + (hint.node ? 1 : 0);

    return (
      <div className="relative w-full">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              ref={triggerRef}
              type="button"
              variant="outline"
              data-slot="date-picker-trigger"
              data-mode="multiple"
              data-empty={selected.length > 0 ? undefined : true}
              disabled={disabled}
              id={id}
              data-testid={dataTestId}
              aria-describedby={hint.describedBy}
              className={cn(
                'w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground',
                BUTTON_TRAILING_RESERVE[trailingCount],
                className
              )}
              {...props}
            >
              <CalendarIcon />
              <span className="min-w-0 truncate">
                {selected.length === 0
                  ? (placeholder ?? t('kit.datePicker.placeholderMulti'))
                  : selected.length > summaryThreshold
                    ? t('kit.datePicker.selected', { count: selected.length })
                    : selected.map((date) => formatDate(date, pattern, i18n, 'medium')).join(', ')}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="multiple"
              selected={selected}
              onSelect={(dates) => onChange?.(sortDates(dates ?? []))}
              disabled={atLimit ? blockUnselected : undefined}
              numberOfMonths={numberOfMonths}
              defaultMonth={selected[0]}
              autoFocus
            />
          </PopoverContent>
        </Popover>

        {trailingCount > 0 && (
          <div data-slot="date-picker-trailing" className={TRAILING_CLUSTER_EDGE}>
            {showClear && (
              <button
                type="button"
                className={TRAILING_CLEAR}
                onClick={handleClear}
                aria-label={t('kit.datePicker.clear')}
                data-testid={dataTestId ? `${dataTestId}-clear` : undefined}
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
DatePickerMulti.displayName = 'DatePickerMulti';

/**
 * Value-based контракт DatePickerMulti в форме. Значение — `Date[] | null`; форма резолвит
 * `value`/`onChange`/`onBlur`/`disabled`, автор задаёт остальное в `componentProps`.
 * Служит типом для стража props-схемы.
 */
export interface DatePickerMultiFormProps {
  value?: Date[] | null;
  onChange?: (value: Date[] | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  dateFormat?: string;
  numberOfMonths?: number;
  maxItems?: number;
  summaryThreshold?: number;
  clearable?: boolean;
  className?: string;
}

// Диалект формы: `Date[] | null` ↔ массив композита (пустой выбор → null) — статика.
defineFieldControl(DatePickerMulti, { adapter: multiValueAdapter });

export { DatePickerMulti };
