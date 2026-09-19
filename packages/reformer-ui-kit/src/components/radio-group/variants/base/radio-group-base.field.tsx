import * as React from 'react';

import { withFormControl } from '@/fields/with-form-control';
import { valueChangeAdapter } from '@/fields/adapters';
import { withFieldTooltip, tooltipText, OUTSIDE_FILL_START } from '@/fields/field-tooltip';
import { InfoHint } from '@/components/info-hint';
import { RadioGroup, RadioGroupItem } from './radio-group-base';

/** Один вариант выбора для {@link RadioGroupField}. */
export interface RadioOption {
  /** Значение, попадающее в `onChange`. DOM `value` всегда строка. */
  value: string;
  /** Подпись, отображаемая справа от radio. */
  label: string;
  /** Подсказка-тултип у иконки (i) после подписи этого варианта. */
  tooltip?: string;
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
        const hint = tooltipText(option.tooltip);
        // Хук в цикле нельзя — id скрытого текста подсказки выводим из id варианта.
        const hintId = hint ? `${itemId}-tooltip` : undefined;
        return (
          <div key={option.value} className="flex items-center gap-2">
            <RadioGroupItem
              value={option.value}
              id={itemId}
              aria-describedby={hintId}
              data-testid={dataTestId ? `${dataTestId}-${option.value}` : undefined}
              // peer — чтобы подпись варианта гасла вместе с radio. Без этого у выключенной группы
              // тускнеет только кружок, а яркая подпись с cursor-pointer выглядит как рабочая.
              className="peer"
            />
            <label
              htmlFor={itemId}
              className="text-sm leading-none font-medium select-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
            >
              {option.label}
            </label>
            {/* После текста варианта, соседом <label>: клик по иконке вариант не выбирает. */}
            {hint && (
              <InfoHint
                content={hint}
                descriptionId={hintId}
                aria-label={`Подсказка: ${option.label}`}
                data-testid={dataTestId ? `${dataTestId}-${option.value}-tooltip` : undefined}
              />
            )}
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
export const RadioGroupBaseField = withFormControl(
  withFieldTooltip(RadioGroupOptions, OUTSIDE_FILL_START),
  valueChangeAdapter
);

export { RadioGroupOptions };
