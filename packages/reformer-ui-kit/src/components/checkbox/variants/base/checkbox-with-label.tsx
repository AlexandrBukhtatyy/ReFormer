import * as React from 'react';

import { defineFieldControl } from '@/fields/field-control';
import { checkedAdapter } from '@/fields/adapters';
import { useFieldTooltip, type FieldTooltipProps } from '@/fields/field-tooltip';
import { Checkbox } from './checkbox-base';

/** Props враппера {@link CheckboxWithLabel}: pure Checkbox + опциональная подпись справа. */
export interface CheckboxWithLabelProps
  extends React.ComponentProps<typeof Checkbox>, FieldTooltipProps {
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
function CheckboxWithLabelBase({
  label,
  tooltip,
  id,
  className,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'data-testid': dataTestId,
  ...props
}: CheckboxWithLabelProps & { 'data-testid'?: string }) {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  const resolvedAriaLabelledBy = label ? undefined : ariaLabelledBy;
  const hint = useFieldTooltip(tooltip, {
    id: inputId,
    describedBy: ariaDescribedBy,
    testId: dataTestId,
  });

  const labelled = (
    <label
      htmlFor={inputId}
      className="flex w-fit items-center gap-2 text-sm leading-none font-medium select-none has-[button:disabled]:cursor-not-allowed has-[button:disabled]:opacity-70"
    >
      <Checkbox
        id={inputId}
        className={className}
        aria-labelledby={resolvedAriaLabelledBy}
        aria-describedby={hint.describedBy}
        data-testid={dataTestId}
        {...props}
      />
      {label}
    </label>
  );

  if (!hint.node) return labelled;

  // Иконка — СНАРУЖИ <label>: внутри него клик по ней переключал бы чекбокс.
  return (
    <div data-slot="field-tooltip" className="flex w-fit items-center gap-2">
      {labelled}
      {hint.node}
    </div>
  );
}

CheckboxWithLabelBase.displayName = 'CheckboxWithLabel';

/**
 * Чекбокс с подписью справа — компонент для формы (`component: CheckboxWithLabel`, registry
 * `Checkbox`). Диалект `checked`/`onCheckedChange` (boolean) — статика {@link checkedAdapter};
 * маркер `inline-label` — FormField НЕ рендерит верхнюю подпись (иначе задвоится с внутренней).
 */
const CheckboxWithLabel = defineFieldControl(CheckboxWithLabelBase, {
  adapter: checkedAdapter,
  layout: 'inline-label',
});

export { CheckboxWithLabel };
