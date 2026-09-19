import * as React from 'react';

import { cn } from '@/lib/utils';
import { defineFieldControl } from '@/fields/field-control';
import { nativeInputAdapter } from '@/fields/adapters';
import { withFieldTooltip, INSIDE_INPUT } from '@/fields/field-tooltip';

// Дословный порт shadcn/ui (new-york-v4) input. Правки только: `@/lib/utils`. Чистый native input —
// number-буфер живёт в варианте `number` (variants/number/input-number.tsx), примитив остаётся pure.
function InputPrimitive({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        // Осознанное отклонение от upstream: shadcn для дат предлагает DatePicker и native
        // `type="date"` не стилизует. У нас он используется в боевых формах, а при `display: flex`
        // (класс `flex` выше) Chrome сжимает внутренний контейнер даты по содержимому, и иконка
        // `::-webkit-calendar-picker-indicator` встаёт вплотную к дате, посреди поля. С `display: block`
        // контейнер растягивается на всю ширину, иконка прижимается к правому краю (`ml-auto` на
        // самой иконке не помогает — у неё нет свободного места в родителе).
        '[&:is([type=date],[type=datetime-local],[type=month],[type=week],[type=time])]:block',
        className
      )}
      {...props}
    />
  );
}

/**
 * Input кита: порт shadcn + проп `tooltip` (иконка-подсказка у правого края). Без подсказки DOM
 * побайтно как у порта. В форме кладётся в `component` как есть: диалект (`onChange(event)` →
 * `e.target.value || null`) объявлен статикой, связывает поле обёртка (`FormField.Control` /
 * рендерер). Числовое поле — {@link import('../number/input-number').InputNumber}.
 */
const Input = defineFieldControl(withFieldTooltip(InputPrimitive, INSIDE_INPUT), {
  adapter: nativeInputAdapter,
});
Input.displayName = 'Input';

export { Input };
