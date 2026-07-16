import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';

import { withFormControl } from '@/fields/with-form-control';
import { valueChangeAdapter } from '@/fields/adapters';
import { toggleVariants } from '@/components/toggle';
import { ToggleGroup, ToggleGroupItem } from './toggle-group-base';

/** Один вариант выбора для {@link ToggleGroupField}. */
export interface ToggleGroupOption {
  /** Значение, попадающее в `onChange`. Radix ToggleGroup оперирует строками. */
  value: string;
  /** Подпись на кнопке-переключателе. */
  label: string;
}

/** Props презентационной обёртки {@link ToggleGroupOptions}. */
export interface ToggleGroupOptionsProps {
  /** Список вариантов. Каждый рендерится как `ToggleGroupItem` (кнопка `role=radio`). */
  options?: ToggleGroupOption[];
  /** Выбранное значение (single-режим Radix: `value: string`). */
  value?: string;
  /** Radix `onValueChange(string)` — сюда `valueChangeAdapter` кладёт эмиттер. */
  onValueChange?: (value: string) => void;
  /** Визуальный стиль кнопок (`default` — плоские, `outline` — с рамкой). */
  variant?: VariantProps<typeof toggleVariants>['variant'];
  /** Размер кнопок. */
  size?: VariantProps<typeof toggleVariants>['size'];
  /** Доп. CSS-класс контейнера группы. */
  className?: string;
  /** id контейнера (seam — форма связывает подпись). */
  id?: string;
  /** Префикс `data-testid`; на контейнер + `-<value>` на каждый Item. */
  'data-testid'?: string;
}

/**
 * Презентационная обёртка над base ToggleGroup/ToggleGroupItem: рендерит опции из массива
 * `options` в single-режиме (`type="single"` → Radix эмитит выбранную строку). Контракт
 * `value` / `onValueChange` совпадает с Radix Root — поэтому field-версия =
 * `withFormControl(ToggleGroupOptions, valueChangeAdapter)` (без ручного маппинга событий).
 *
 * Контейнер — Radix Root (`role="group"`); каждый Item получает per-option
 * `data-testid = <data-testid>-<value>`: FormField передаёт контролу `data-testid="input-<field>"`,
 * поэтому в форме выходит `input-<field>-<value>` (POM ждёт именно этот идентификатор).
 * aria-атрибуты и id приходят через spread `...props` и ложатся на контейнер (seam-контракт).
 */
function ToggleGroupOptions({
  options = [],
  value,
  onValueChange,
  variant,
  size,
  'data-testid': dataTestId,
  ...props
}: ToggleGroupOptionsProps) {
  return (
    <ToggleGroup
      type="single"
      value={value ?? ''}
      onValueChange={onValueChange}
      variant={variant}
      size={size}
      data-testid={dataTestId}
      {...props}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          data-testid={dataTestId ? `${dataTestId}-${option.value}` : undefined}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

ToggleGroupOptions.displayName = 'ToggleGroupOptions';

/**
 * Value-based контракт field-версии ToggleGroup. Значение — `string` (`option.value`); форма
 * резолвит `value`/`onChange`/`onBlur`/`disabled`, автор задаёт `options`/`variant`/`className`
 * в `componentProps`. Служит типом для стража props-схемы (base — Radix `value`/`onValueChange`).
 */
export interface ToggleGroupFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  options?: ToggleGroupOption[];
  variant?: VariantProps<typeof toggleVariants>['variant'];
  className?: string;
}

/**
 * Field-версия ToggleGroup: value-based (`value: string | null`, `onChange(value)`), рендерит
 * `options`. Привязка через {@link valueChangeAdapter} (`value` / `onValueChange`, string).
 * НЕ inline-label — подпись группы рисует FormField сверху. Экспортируется как алиас `ToggleGroupField`.
 */
export const ToggleGroupBaseField = withFormControl(ToggleGroupOptions, valueChangeAdapter);

export { ToggleGroupOptions };
