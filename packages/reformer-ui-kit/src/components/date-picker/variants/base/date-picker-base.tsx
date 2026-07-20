import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { type FieldHandle, makeElementFieldHandle } from '@/fields/field-handle';
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
  /** Текст кнопки-триггера, когда дата не выбрана. */
  placeholder?: string;
  /** Формат отображения выбранной даты — токены `date-fns` (по умолчанию `PPP`). */
  dateFormat?: string;
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
const DatePicker = React.forwardRef<DatePickerHandle, DatePickerProps>(function DatePicker(
  {
    value,
    onChange,
    placeholder = 'Выберите дату',
    dateFormat = 'PPP',
    className,
    disabled,
    ...props
  },
  ref
) {
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
          {value ? format(value, dateFormat) : <span>{placeholder}</span>}
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
DatePicker.displayName = 'DatePicker';

export { DatePicker };
