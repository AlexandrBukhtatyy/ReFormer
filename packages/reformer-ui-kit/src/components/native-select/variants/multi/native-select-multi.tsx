import * as React from 'react';

import { cn } from '@/lib/utils';
import { NativeSelectOptGroup, NativeSelectOption } from '../base/native-select-base';
import type { NativeSelectOptionItem } from '../base/native-select-base.field';

/** Props презентационного {@link NativeSelectMulti}. */
export interface NativeSelectMultiProps {
  /** Опции списка. Одинаковый `group` объединяется в `<optgroup>`. */
  options?: NativeSelectOptionItem[];
  /**
   * Выбранные значения. Приходит массивом всегда: `multiValueAdapter` разворачивает `null` в `[]`.
   * Нативный `<select multiple>` в управляемом режиме требует именно массив.
   */
  value?: string[];
  /** Изменение выбора. Всегда получает НОВЫЙ массив — см. `multiValueAdapter`. */
  onChange?: (value: string[]) => void;
  onBlur?: () => void;
  /**
   * Число видимых строк (нативный атрибут `size`). По умолчанию браузер показывает 4.
   *
   * Проп называется `rows`, а не `size`: у остальных контролов кита `size` — это ступень шкалы
   * размеров (`'sm' | 'default'`), и одноимённый проп с другим смыслом читался бы как опечатка.
   */
  rows?: number;
  /**
   * Потолок числа выбранных: по достижении невыбранные опции выключаются.
   * Affordance, а НЕ правило формы — ограничение задавайте валидатором `maxLength(n)`.
   */
  maxItems?: number;
  className?: string;
  disabled?: boolean;
  /** id корневого элемента — по нему форма связывает подпись, описание и сообщение об ошибке. */
  id?: string;
  /** Префикс `data-testid`; на `<select>` + `-<value>` на каждый `<option>`. */
  'data-testid'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
  'aria-required'?: boolean | 'true' | 'false';
}

/**
 * Нативный `<select multiple>` (вариант `multi`).
 *
 * НЕ переиспользует примитив `NativeSelect`: тот — дословный порт shadcn под ОДНОСТРОЧНЫЙ select
 * (`h-9`, `pr-9` под абсолютно спозиционированный шеврон, а нативный атрибут `size` у него занят
 * под ступень шкалы размеров и вырезан `Omit`'ом). Листбоксу нужна принципиально другая геометрия,
 * поэтому вариант рисует свой `<select>` и переиспользует из порта только `<option>`/`<optgroup>` —
 * так порт остаётся без дрейфа от upstream.
 *
 * Честное ограничение, которое надо знать до выбора этого контрола: на тач-устройствах
 * множественный выбор в нативном листбоксе практически недоступен, аффорданса «можно несколько»
 * нет, и высота фиксирована. Для тач берите `ToggleGroupMulti` или `SelectMulti`;
 * `NativeSelectMulti` — путь для no-JS / legacy / киосков, где нужна нативная семантика и
 * клавиатура (Shift+стрелки, Ctrl+клик) без единой строки JS.
 *
 * `placeholder` здесь отсутствует намеренно: у одиночного варианта это `<option value="">` в начале
 * списка, а в multiple-листбоксе такая опция становится ВЫБИРАЕМЫМ мусорным пунктом.
 */
function NativeSelectMulti({
  options = [],
  value,
  onChange,
  rows,
  maxItems,
  className,
  'data-testid': dataTestId,
  ...props
}: NativeSelectMultiProps) {
  const selected = value ?? [];
  const atLimit = maxItems !== undefined && selected.length >= maxItems;

  const groups = new Map<string, NativeSelectOptionItem[]>();
  for (const opt of options) {
    const key = opt.group ?? '';
    const bucket = groups.get(key);
    if (bucket) bucket.push(opt);
    else groups.set(key, [opt]);
  }

  const renderOption = (opt: NativeSelectOptionItem) => {
    const optValue = String(opt.value);
    return (
      <NativeSelectOption
        key={optValue}
        value={optValue}
        // Потолок гасит только НЕвыбранные: иначе снять лишнее стало бы нечем.
        disabled={atLimit && !selected.includes(optValue)}
        data-testid={dataTestId ? `${dataTestId}-${optValue}` : undefined}
      >
        {opt.label}
      </NativeSelectOption>
    );
  };

  return (
    <select
      multiple
      data-slot="native-select-multi"
      value={selected}
      // Нативное событие в value-based контракт: `e.target.value` у multiple отдаёт только ПЕРВОЕ
      // выбранное — читать надо selectedOptions целиком.
      onChange={(e) => onChange?.(Array.from(e.currentTarget.selectedOptions, (o) => o.value))}
      {...(rows !== undefined ? { size: rows } : {})}
      data-testid={dataTestId}
      className={cn(
        'w-full min-w-0 rounded-md border border-input bg-transparent px-1 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className
      )}
      {...props}
    >
      {[...groups.entries()].map(([group, opts]) =>
        group === '' ? (
          <React.Fragment key="__ungrouped">{opts.map(renderOption)}</React.Fragment>
        ) : (
          <NativeSelectOptGroup key={group} label={group}>
            {opts.map(renderOption)}
          </NativeSelectOptGroup>
        )
      )}
    </select>
  );
}

NativeSelectMulti.displayName = 'NativeSelectMulti';

export { NativeSelectMulti };
