import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import { useI18n } from '@reformer/core/react';
import { CalendarIcon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useKitMessages } from '@/i18n/messages';
import { makeElementFieldHandle } from '@/fields/field-handle';
import { defineFieldControl } from '@/fields/field-control';
import { dateRangeAdapter } from '@/fields/adapters';
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
import { formatDateRange } from '../base/date-picker-format';

/** Период: начало и конец включительно, `from <= to`. Однодневный период — две одинаковые даты. */
export type DateRangeValue = [from: Date, to: Date];

export interface DatePickerRangeProps extends Omit<
  React.ComponentProps<typeof Button>,
  'value' | 'onChange'
> {
  /** Выбранный период (управляемое значение). `undefined` — период не выбран. */
  value?: DateRangeValue;
  /**
   * Выбор периода. Зовётся только с полным периодом (оба конца выбраны) либо с `undefined` —
   * сброс. Пока выбрано одно начало, значение не меняется.
   */
  onChange?: (value: DateRangeValue | undefined) => void;
  /** Закрытие календаря — момент, когда поле считается покинутым. */
  onBlur?: () => void;
  /**
   * Текст кнопки-триггера, когда период не выбран.
   * @defaultMessage kit.datePicker.placeholderRange
   */
  placeholder?: string;
  /**
   * Формат дат периода — токены `date-fns` (`dd.MM.yyyy`). По умолчанию — `dateFormat` локали,
   * а без него даты пишутся по правилам языка (`Intl`, `dateStyle: 'long'`).
   */
  dateFormat?: string;
  /** Сколько месяцев показывать рядом. По умолчанию 2. */
  numberOfMonths?: number;
  /** Крестик сброса периода у правого края кнопки. */
  clearable?: boolean;
  /** Подсказка-тултип у иконки (i) у правого края кнопки. */
  tooltip?: string;
  /** `data-testid` кнопки-триггера; крестик сброса получает `<testId>-clear`. */
  'data-testid'?: string;
}

/** Императивный handle {@link DatePickerRange}: как у DatePicker + сброс периода. */
export interface DatePickerRangeHandle extends DatePickerHandle {
  /** Сбросить период. */
  clear(): void;
}

/** Итог клика по календарю периода. */
export type DateRangeStep =
  /** Выбрано только начало — черновик; в форму не уходит. */
  | { kind: 'draft'; from: Date }
  /** Период выбран полностью либо сброшен (`undefined`). */
  | { kind: 'commit'; value: DateRangeValue | undefined };

/**
 * Разбор выбора react-day-picker в режиме `range` с `resetOnSelect`: первый клик даёт
 * `{ from, to: undefined }` — черновик, второй — полный период, клик по однодневному периоду —
 * `undefined`.
 */
export function dateRangeStep(range: DateRange | undefined): DateRangeStep {
  if (!range?.from) return { kind: 'commit', value: undefined };
  if (!range.to) return { kind: 'draft', from: range.from };
  return { kind: 'commit', value: [range.from, range.to] };
}

/**
 * DatePickerRange — выбор периода: Popover с Calendar (`mode="range"`) и кнопкой-триггером,
 * показывающей период.
 *
 * Выбор идёт в два клика: первый задаёт начало (черновик, значение поля пока прежнее), второй —
 * конец, после чего период уходит в `onChange`, а календарь закрывается. Закрытие на черновике
 * черновик отбрасывает. Клик по уже выбранному однодневному периоду его сбрасывает.
 */
const DatePickerRange = React.forwardRef<DatePickerRangeHandle, DatePickerRangeProps>(
  function DatePickerRange(
    {
      value,
      onChange,
      onBlur,
      placeholder,
      dateFormat,
      numberOfMonths = 2,
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
    // Начало нового периода, пока конец не выбран. Живёт до закрытия календаря.
    const [draftFrom, setDraftFrom] = React.useState<Date | null>(null);
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);

    const changeOpen = React.useCallback((next: boolean) => {
      setOpen(next);
      setDraftFrom(null);
    }, []);

    React.useImperativeHandle(
      ref,
      () => ({
        ...makeElementFieldHandle(triggerRef),
        open: () => changeOpen(true),
        close: () => changeOpen(false),
        clear: () => onChange?.(undefined),
      }),
      [changeOpen, onChange]
    );

    const handleOpenChange = (next: boolean) => {
      changeOpen(next);
      if (!next) onBlur?.();
    };

    const handleSelect = (range: DateRange | undefined) => {
      const step = dateRangeStep(range);
      if (step.kind === 'draft') {
        setDraftFrom(step.from);
        return;
      }
      setDraftFrom(null);
      onChange?.(step.value);
      if (step.value) handleOpenChange(false);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(undefined);
    };

    const selected: DateRange | undefined = draftFrom
      ? { from: draftFrom, to: undefined }
      : value
        ? { from: value[0], to: value[1] }
        : undefined;

    const showClear = clearable && value !== undefined && !disabled;
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
              data-mode="range"
              data-empty={value ? undefined : true}
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
                {value
                  ? formatDateRange(value[0], value[1], dateFormat ?? i18n.locale.dateFormat, i18n)
                  : (placeholder ?? t('kit.datePicker.placeholderRange'))}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              resetOnSelect
              selected={selected}
              onSelect={handleSelect}
              numberOfMonths={numberOfMonths}
              defaultMonth={selected?.from}
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
DatePickerRange.displayName = 'DatePickerRange';

/**
 * Value-based контракт DatePickerRange в форме. Значение — `[Date, Date] | null`; форма резолвит
 * `value`/`onChange`/`onBlur`/`disabled`, автор задаёт остальное в `componentProps`.
 * Служит типом для стража props-схемы.
 */
export interface DatePickerRangeFormProps {
  value?: DateRangeValue | null;
  onChange?: (value: DateRangeValue | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  dateFormat?: string;
  numberOfMonths?: number;
  clearable?: boolean;
  className?: string;
}

// Диалект формы: `[Date, Date] | null` ↔ кортеж композита (сброс → null) — статика.
defineFieldControl(DatePickerRange, { adapter: dateRangeAdapter });

export { DatePickerRange };
