import * as React from 'react';

import { withFormControl } from '@/fields/with-form-control';
import { checkedAdapter } from '@/fields/adapters';
import { Checkbox } from './checkbox-base';

/** Props враппера {@link CheckboxWithLabel}: pure Checkbox + опциональная подпись справа. */
export interface CheckboxWithLabelProps extends React.ComponentProps<typeof Checkbox> {
  /** Подпись справа от чекбокса (inline-раскладка). Берётся из `componentProps.label`. */
  label?: string;
}

/**
 * Inline-раскладка чекбокса: сам рисует подпись СПРАВА от контрола, обёрнутую в `<label htmlFor>`,
 * потому что `FormField` для inline-контролов верхнюю подпись подавляет (маркер `reformerLayout`).
 *
 * `data-testid`/`aria-*`/`checked`/`onCheckedChange` уходят на `CheckboxPrimitive.Root` (button
 * role=checkbox), НЕ на wrapper и НЕ на скрытый bubble-input. Доступное имя даёт связанная `<label>`
 * (htmlFor↔id), поэтому висячий `aria-labelledby` (ids.labelId от FormField — верхняя подпись не
 * рендерится) сбрасываем, когда подпись есть.
 */
function CheckboxWithLabel({
  label,
  id,
  className,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: CheckboxWithLabelProps) {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  const resolvedAriaLabelledBy = label ? undefined : ariaLabelledBy;

  return (
    <label
      htmlFor={inputId}
      className="flex w-fit items-center gap-2 text-sm leading-none font-medium select-none has-[button:disabled]:cursor-not-allowed has-[button:disabled]:opacity-70"
    >
      <Checkbox
        id={inputId}
        className={className}
        aria-labelledby={resolvedAriaLabelledBy}
        {...props}
      />
      {label}
    </label>
  );
}

CheckboxWithLabel.displayName = 'CheckboxWithLabel';

/**
 * Field-версия Checkbox: pure Checkbox + подпись справа, привязка через `checkedAdapter`
 * (`checked` / `onCheckedChange`, boolean). Экспортируется как алиас `CheckboxField`.
 */
export const CheckboxBaseField = withFormControl(CheckboxWithLabel, checkedAdapter);

// inline-label маркер: FormField НЕ рендерит верхнюю подпись (иначе задвоится с внутренней <label>).
// Неэнфорсимая конвенция (form-field.tsx:hasInlineLabel) — обязательна для Checkbox/Switch/Toggle.
(CheckboxBaseField as { reformerLayout?: string }).reformerLayout = 'inline-label';

export { CheckboxWithLabel };
