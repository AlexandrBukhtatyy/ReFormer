import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';

import { toggleVariants } from '@/components/toggle';
import { ToggleGroup, ToggleGroupItem } from '../base/toggle-group-base';
import type { ToggleGroupOption } from '../base/toggle-group-base.field';

/** Props презентационного {@link ToggleGroupMulti}. */
export interface ToggleGroupMultiProps {
  /** Список вариантов. Каждый рендерится как `ToggleGroupItem` (кнопка `role=checkbox`). */
  options?: ToggleGroupOption[];
  /**
   * Выбранные значения. Приходит массивом всегда: `multiValueAdapter` разворачивает `null` в `[]`,
   * потому что рендер ходит по значению `.includes`/`.length`.
   */
  value?: string[];
  /** Изменение выбора. Всегда получает НОВЫЙ массив — см. `multiValueAdapter`. */
  onChange?: (value: string[]) => void;
  onBlur?: () => void;
  /**
   * Потолок числа выбранных: по достижении невыбранные кнопки выключаются.
   *
   * Это affordance, а НЕ правило формы: авторитетное ограничение задаётся `maxLength(n)` в схеме
   * валидации. Держать здесь единственный источник истины нельзя — контрол не участвует в submit.
   */
  maxItems?: number;
  variant?: VariantProps<typeof toggleVariants>['variant'];
  size?: VariantProps<typeof toggleVariants>['size'];
  className?: string;
  disabled?: boolean;
  /** id контейнера (seam — форма связывает подпись). */
  id?: string;
  /** Префикс `data-testid`; на контейнер + `-<value>` на каждый Item. */
  'data-testid'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
  'aria-required'?: boolean | 'true' | 'false';
}

/**
 * ToggleGroup в режиме множественного выбора (вариант `multi`).
 *
 * Отдельный компонент, а не проп `multiple` у базового: Radix типизирует `type="single"` и
 * `type="multiple"` разными ветками union'а Root'а (`value: string` против `string[]`), а
 * `ToggleGroupOptions` вдобавок жёстко зашивает `type="single"` и `value={value ?? ''}`. Главное же
 * — тип значения поля входит в контракт записи каталога: `x-runtimeProps.value` у записи один, и
 * «строка ИЛИ массив в зависимости от соседнего пропа» там невыразимо. Тот же приём и по той же
 * причине — у `FileUpload` / `FileUploadAvatar`.
 *
 * Наружу выставлен value-based контракт (`value`/`onChange`), а не Radix-shape
 * (`onValueChange`), чтобы field-версия собиралась общим `multiValueAdapter` — тем же, что у
 * трёх остальных мультивыборов кита.
 */
function ToggleGroupMulti({
  options = [],
  value,
  onChange,
  maxItems,
  variant,
  size,
  'data-testid': dataTestId,
  ...props
}: ToggleGroupMultiProps) {
  const selected = value ?? [];
  const atLimit = maxItems !== undefined && selected.length >= maxItems;

  return (
    <ToggleGroup
      type="multiple"
      value={selected}
      onValueChange={(next: string[]) => onChange?.(next)}
      variant={variant}
      size={size}
      data-testid={dataTestId}
      {...props}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          // Потолок гасит только НЕвыбранные: иначе снять лишнее стало бы нечем.
          disabled={atLimit && !selected.includes(option.value)}
          data-testid={dataTestId ? `${dataTestId}-${option.value}` : undefined}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

ToggleGroupMulti.displayName = 'ToggleGroupMulti';

export { ToggleGroupMulti };
