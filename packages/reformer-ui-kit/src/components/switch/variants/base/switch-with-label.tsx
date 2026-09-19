import * as React from 'react';

import { defineFieldControl } from '@/fields/field-control';
import { checkedAdapter } from '@/fields/adapters';
import { useFieldTooltip, type FieldTooltipProps } from '@/fields/field-tooltip';
import { Label } from '@/components/label';
import { Switch } from './switch-base';

/**
 * Презентационная обёртка: shadcn Switch + подпись справа (event-shape Radix: `checked`/
 * `onCheckedChange`). Подпись связывается с контролом через `htmlFor` — доступное имя даёт
 * связанный `<Label>`. Поэтому висячий `aria-labelledby` (FormField для inline-раскладки НЕ
 * рендерит верхнюю метку — IDREF указывал бы в пустоту) сбрасываем, когда рисуем свою подпись.
 */
export interface SwitchWithLabelProps
  extends React.ComponentProps<typeof Switch>, FieldTooltipProps {
  /** Подпись справа от переключателя. Если опущена — рендерится только сам контрол. */
  label?: string;
}

function SwitchWithLabelBase({
  label,
  tooltip,
  id,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'data-testid': dataTestId,
  ...props
}: SwitchWithLabelProps & { 'data-testid'?: string }) {
  const reactId = React.useId();
  const switchId = id ?? reactId;
  const hasLabel = label != null && label !== '';
  const hint = useFieldTooltip(tooltip, {
    id: switchId,
    describedBy: ariaDescribedBy,
    testId: dataTestId,
  });
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={switchId}
        aria-labelledby={hasLabel ? undefined : ariaLabelledBy}
        aria-describedby={hint.describedBy}
        data-testid={dataTestId}
        {...props}
      />
      {hasLabel && (
        <Label htmlFor={switchId} className="cursor-pointer font-normal">
          {label}
        </Label>
      )}
      {/* После подписи, соседом <Label>: клик по иконке переключатель не трогает. */}
      {hint.node}
    </div>
  );
}

/**
 * Value-based контракт Switch в форме. Значение — `boolean`; форма резолвит
 * `value`/`onChange`/`onBlur`/`disabled`, автор задаёт `label`/`className` в `componentProps`.
 * Служит типом для стража props-схемы (сам компонент — Radix `checked`/`onCheckedChange`).
 */
export interface SwitchFormProps {
  value?: boolean;
  onChange?: (value: boolean) => void;
  onBlur?: () => void;
  disabled?: boolean;
  label?: string;
  tooltip?: string;
  className?: string;
}

SwitchWithLabelBase.displayName = 'SwitchWithLabel';

/**
 * Переключатель с подписью справа — компонент для формы (`component: SwitchWithLabel`, registry
 * `Switch`). Диалект `checked`/`onCheckedChange` — статика {@link checkedAdapter}
 * (`'indeterminate'` → `false`); маркер `inline-label` — FormField НЕ рисует верхнюю подпись.
 */
const SwitchWithLabel = defineFieldControl(SwitchWithLabelBase, {
  adapter: checkedAdapter,
  layout: 'inline-label',
});

export { SwitchWithLabel };
