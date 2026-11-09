import * as React from 'react';
import type { PropsBase, PropsSingle, RootProps } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { defineFieldControl } from '@/fields/field-control';
import { dateAdapter } from '@/fields/adapters';
import { withFieldTooltip, OUTSIDE_START } from '@/fields/field-tooltip';
import { Calendar } from './calendar-base';

/**
 * Props single-date обёртки: база DayPicker (`className`, `captionLayout`, `showOutsideDays`,
 * `disabled`…) + single-selection (`selected`/`onSelect`). `mode`/`required` убраны — зашиты.
 * Плоская интерсекция (а не union `React.ComponentProps<typeof Calendar>`) осознанно: спред union
 * с discriminated `mode` в `<Calendar mode="single" …>` не сужается и падает на tsc.
 */
export type CalendarSingleProps = Omit<PropsBase, 'mode' | 'required'> &
  Omit<PropsSingle, 'mode'> & {
    buttonVariant?: React.ComponentProps<typeof Calendar>['buttonVariant'];
    /** Описание поля (id подсказки, пояснения, сообщения об ошибке) — на корень-группу. */
    'aria-describedby'?: string;
    /** Ошибка поля — на корень-группу. */
    'aria-invalid'?: boolean | 'true' | 'false';
    /** id сообщения об ошибке — на корень-группу. */
    'aria-errormessage'?: string;
    /** Принимается от обёртки поля, но в DOM не идёт: у `role="group"` нет `aria-required`. */
    'aria-required'?: boolean | 'true' | 'false';
  };

/** a11y-атрибуты поля, которые DayPicker сам до корня не доносит. */
type CalendarFieldAria = Pick<
  CalendarSingleProps,
  'aria-describedby' | 'aria-invalid' | 'aria-errormessage'
>;

const CalendarFieldAriaContext = React.createContext<CalendarFieldAria>({});

/**
 * Корень календаря поля: как у shadcn-`Calendar` (`data-slot="calendar"`) + `role="group"` и
 * a11y-атрибуты поля. DayPicker передаёт корню только `id`/`aria-label(ledby)`/`data-*` — описание
 * и ошибка терялись. Значения идут контекстом, а не замыканием: компонент `Root` должен быть
 * стабильным, иначе смена `aria-invalid` пересоздала бы весь календарь и сбросила фокус дня.
 */
function CalendarFieldRoot({ className, rootRef, role, ...props }: RootProps) {
  const aria = React.useContext(CalendarFieldAriaContext);
  return (
    <div
      data-slot="calendar"
      ref={rootRef}
      className={cn(className)}
      role={role ?? 'group'}
      {...props}
      {...aria}
    />
  );
}

/**
 * Single-date вариант Calendar: `mode='single'` зашит; остальные props DayPicker проходят как есть.
 * Селект одной даты (`selected` / `onSelect(Date | undefined)`) — контракт, который {@link dateAdapter}
 * сводит к value-based `value: Date | null` + `onChange(Date | null)`. Корень — `role="group"`,
 * подписанный полем (`aria-labelledby`) и несущий его описание и ошибку.
 */
function CalendarSingleBase({
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-errormessage': ariaErrorMessage,
  'aria-required': _ariaRequired,
  components,
  ...props
}: CalendarSingleProps) {
  const aria = React.useMemo<CalendarFieldAria>(
    () => ({
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      'aria-errormessage': ariaErrorMessage,
    }),
    [ariaDescribedBy, ariaInvalid, ariaErrorMessage]
  );
  return (
    <CalendarFieldAriaContext.Provider value={aria}>
      <Calendar mode="single" components={{ Root: CalendarFieldRoot, ...components }} {...props} />
    </CalendarFieldAriaContext.Provider>
  );
}

/**
 * Календарь одной даты — компонент для формы (`component: CalendarSingle`, registry `Calendar`):
 * `selected`/`onSelect` ↔ `value: Date | null` через {@link dateAdapter} (статика) + проп `tooltip`.
 */
// OUTSIDE_START, а не OUTSIDE_START_GROUP: описание (с id подсказки) несёт уже корень календаря,
// вторая группа-обёртка с тем же описанием озвучивалась бы дважды.
const CalendarSingle = defineFieldControl(withFieldTooltip(CalendarSingleBase, OUTSIDE_START), {
  adapter: dateAdapter,
});
CalendarSingle.displayName = 'CalendarSingle';

export { CalendarSingle };
