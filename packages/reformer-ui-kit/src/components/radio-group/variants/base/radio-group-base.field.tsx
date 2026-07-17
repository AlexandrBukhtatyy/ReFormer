import * as React from 'react';

import { withFormControl } from '@/fields/with-form-control';
import { valueChangeAdapter } from '@/fields/adapters';
import { RadioGroup, RadioGroupItem } from './radio-group-base';

/** Один вариант выбора для {@link RadioGroupField}. */
export interface RadioOption {
  /** Значение, попадающее в `onChange`. DOM `value` всегда строка. */
  value: string;
  /** Подпись, отображаемая справа от radio. */
  label: string;
}

/** Props презентационной обёртки {@link RadioGroupOptions}. */
export interface RadioGroupOptionsProps extends Omit<
  React.ComponentProps<typeof RadioGroup>,
  'children'
> {
  /** Список вариантов. Каждый рендерится как `RadioGroupItem` + связанная `<label>`. */
  options?: RadioOption[];
  /** Префикс `data-testid`; на контейнер + `-<value>` на каждый Item. */
  'data-testid'?: string;
}

/**
 * Презентационная обёртка над base RadioGroup/RadioGroupItem: рендерит опции из массива
 * `options`. Контракт `value` / `onValueChange` совпадает с Radix Root — поэтому field-версия
 * = `withFormControl(RadioGroupOptions, valueChangeAdapter)` (без ручного маппинга событий).
 *
 * Контейнер — `role="radiogroup"` (Radix Root). Каждый Item получает per-option
 * `data-testid = <data-testid>-<value>`: FormField передаёт контролу `data-testid="input-<field>"`,
 * поэтому в форме выходит `input-<field>-<value>` (POM ждёт именно этот идентификатор). `id` Item
 * связывает `<label htmlFor>`, чтобы клик по подписи выбирал вариант.
 */
function RadioGroupOptions({
  options = [],
  'data-testid': dataTestId,
  ...props
}: RadioGroupOptionsProps) {
  const generatedId = React.useId();
  const idBase = dataTestId ?? generatedId;

  return (
    <RadioGroup data-testid={dataTestId} {...props}>
      {options.map((option) => {
        const itemId = `${idBase}-${option.value}`;
        return (
          <div key={option.value} className="flex items-center gap-2">
            <RadioGroupItem
              value={option.value}
              id={itemId}
              data-testid={dataTestId ? `${dataTestId}-${option.value}` : undefined}
            />
            <label
              htmlFor={itemId}
              className="text-sm leading-none font-medium select-none cursor-pointer"
            >
              {option.label}
            </label>
          </div>
        );
      })}
    </RadioGroup>
  );
}

RadioGroupOptions.displayName = 'RadioGroupOptions';

/**
 * Field-версия RadioGroup: value-based (`value: string | null`, `onChange(value)`), рендерит
 * `options`. Привязка через {@link valueChangeAdapter} (`value` / `onValueChange`, string).
 * НЕ inline-label — подпись группы рисует FormField сверху. Экспортируется как алиас `RadioGroupField`.
 */
export const RadioGroupBaseField = withFormControl(RadioGroupOptions, valueChangeAdapter);

export { RadioGroupOptions };
