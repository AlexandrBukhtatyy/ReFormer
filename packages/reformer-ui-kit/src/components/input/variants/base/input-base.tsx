import * as React from 'react';

import { cn } from '@/lib/utils';

// Дословный порт shadcn/ui (new-york-v4) input. Правки только: `@/lib/utils`. Чистый native input —
// number-буфер живёт в варианте `number` (variants/number/input-number.field.tsx), примитив остаётся pure.
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        // Осознанное отклонение от upstream: shadcn для дат предлагает DatePicker и native
        // `type="date"` не стилизует. У нас он используется в боевых формах, а Chrome рисует
        // `::-webkit-calendar-picker-indicator` вплотную к дате (margin-left: 0) — прижимаем к
        // правому краю поля. На остальных типах input этого псевдоэлемента нет, класс безвреден.
        '[&::-webkit-calendar-picker-indicator]:ml-auto',
        className
      )}
      {...props}
    />
  );
}

export { Input };
