import * as React from 'react';
import { format, type Locale } from 'date-fns';
import { useI18n } from '@reformer/core/react';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useKitMessages } from '@/i18n/messages';
import { type FieldHandle, makeElementFieldHandle } from '@/fields/field-handle';
import { defineFieldControl } from '@/fields/field-control';
import { datePickerAdapter } from '@/fields/adapters';
import { withFieldTooltip, INSIDE_BUTTON } from '@/fields/field-tooltip';
import { Button } from '@/components/button';
import { Calendar } from '@/components/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/popover';

// Не порт (у shadcn нет registry-элемента date-picker — это рецепт), а стандартная композиция
// зависимостей волны 1: кнопка-триггер (Button outline + CalendarIcon + отформатированная дата) в
// PopoverTrigger, а в PopoverContent — Calendar mode="single". Выбор даты закрывает поповер.

export interface DatePickerProps extends Omit<
  React.ComponentProps<typeof Button>,
  'value' | 'onChange'
> {
  /** Выбранная дата (управляемое значение). `undefined` — ничего не выбрано. */
  value?: Date;
  /** Колбэк выбора даты в календаре. Повторный клик по выбранной дате сбрасывает в `undefined`. */
  onChange?: (date: Date | undefined) => void;
  /**
   * Текст кнопки-триггера, когда дата не выбрана.
   * @defaultMessage kit.datePicker.placeholder
   */
  placeholder?: string;
  /**
   * Формат выбранной даты — токены `date-fns` (`dd.MM.yyyy`). По умолчанию — `dateFormat` локали,
   * а без него дата пишется по правилам языка (`Intl`, `dateStyle: 'long'`): «16 октября 2026 г.».
   */
  dateFormat?: string;
}

/**
 * Подпись выбранной даты: формат `date-fns` (с объектом локали `dateLocale`, если он есть) либо, без
 * формата, — по правилам языка локали через `Intl`.
 */
function formatDate(
  value: Date,
  pattern: string | undefined,
  i18n: ReturnType<typeof useI18n>
): string {
  if (pattern === undefined) return i18n.date(value, { dateStyle: 'long' });
  const locale = i18n.locale.dateLocale as Locale | undefined;
  return format(value, pattern, locale ? { locale } : undefined);
}

/**
 * Императивный handle {@link DatePicker}: baseline {@link FieldHandle} (focus/blur/scrollIntoView/
 * getElement на кнопке-триггере) + управление поповером календаря. Достаётся из схемы:
 * `schema.node('customDate').getRef<DatePickerHandle>().current?.open()`.
 */
export interface DatePickerHandle extends FieldHandle {
  /** Открыть поповер с календарём. */
  open(): void;
  /** Закрыть поповер. */
  close(): void;
}

/**
 * DatePicker — Popover c Calendar (single) и кнопкой-триггером, показывающей выбранную дату.
 * Управляемый контракт `value: Date | undefined` / `onChange(date)`. Поповер закрывается сам
 * при выборе даты. Стандартное standalone-использование:
 * `<DatePicker value={date} onChange={setDate} />`.
 */
const DatePickerBase = React.forwardRef<DatePickerHandle, DatePickerProps>(function DatePicker(
  { value, onChange, placeholder, dateFormat, className, disabled, ...props },
  ref
) {
  const t = useKitMessages();
  const i18n = useI18n();
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      ...makeElementFieldHandle(triggerRef),
      open: () => setOpen(true),
      close: () => setOpen(false),
    }),
    []
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          data-slot="date-picker-trigger"
          data-empty={value ? undefined : true}
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground',
            className
          )}
          {...props}
        >
          <CalendarIcon />
          {value ? (
            formatDate(value, dateFormat ?? i18n.locale.dateFormat, i18n)
          ) : (
            <span>{placeholder ?? t('kit.datePicker.placeholder')}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange?.(date);
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
});
/**
 * DatePicker кита + проп `tooltip` (иконка у правого края кнопки). В форме — `value: Date | null`:
 * {@link datePickerAdapter} (статика) сворачивает `undefined` сброса в `null`. Свой
 * {@link DatePickerHandle} композит отдаёт сам — обёртка поля публикует его как есть.
 */
const DatePicker = defineFieldControl(withFieldTooltip(DatePickerBase, INSIDE_BUTTON), {
  adapter: datePickerAdapter,
});
DatePicker.displayName = 'DatePicker';

export { DatePicker };
