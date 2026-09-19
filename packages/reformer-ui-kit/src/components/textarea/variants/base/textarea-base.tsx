import * as React from 'react';

import { cn } from '@/lib/utils';
import { defineFieldControl } from '@/fields/field-control';
import { nativeInputAdapter } from '@/fields/adapters';
import { withFieldTooltip, INSIDE_TEXTAREA } from '@/fields/field-tooltip';

// Дословный порт shadcn/ui (new-york-v4) textarea. Правки только: `@/lib/utils`.
function TextareaPrimitive({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40',
        className
      )}
      {...props}
    />
  );
}

/**
 * Textarea кита: порт shadcn + проп `tooltip` (иконка в правом верхнем углу). Диалект формы —
 * {@link nativeInputAdapter} (статика; связывает обёртка поля).
 */
const Textarea = defineFieldControl(withFieldTooltip(TextareaPrimitive, INSIDE_TEXTAREA), {
  adapter: nativeInputAdapter,
});
Textarea.displayName = 'Textarea';

export { Textarea };
