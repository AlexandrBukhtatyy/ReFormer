import * as React from 'react';
import { Progress as ProgressPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

// Порт shadcn/ui (new-york-v4) progress. Правки: unified `radix-ui`, `@/lib/utils`, снят 'use client'.
// data-slot уже в апстриме (progress / progress-indicator). Радикс-примитив Root+Indicator.
//
// Расхождение с апстримом: там `value` вынимается из пропсов и до Radix Root не доходит, поэтому
// у полосы нет `aria-valuenow`, `data-state` всегда `indeterminate`, а `max` не влияет на заливку
// (сдвиг считается от 100). Здесь `value` и `max` отдаются Root, а доля заливки считается от `max`.

/** Шкала Radix по умолчанию: невалидный `max` (не число, ≤ 0) он заменяет на 100. */
const DEFAULT_MAX = 100;

function Progress({
  className,
  value,
  max,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  // Повторяем проверки Radix: значение вне [0, max] он считает неопределённым (полоса пустая),
  // и заливка не должна расходиться с тем, что объявлено скринридеру.
  const scale = typeof max === 'number' && max > 0 ? max : DEFAULT_MAX;
  const percent =
    typeof value === 'number' && value >= 0 && value <= scale ? (value / scale) * 100 : 0;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)}
      value={value}
      max={max}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
