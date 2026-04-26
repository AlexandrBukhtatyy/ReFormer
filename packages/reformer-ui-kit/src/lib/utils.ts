import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Объединяет CSS-классы (`clsx` + `tailwind-merge`). Удобно для условных
 * классов с разрешением конфликтов Tailwind: при конфликтующих классах из
 * одной семьи (`px-2` и `px-4`) побеждает последний.
 *
 * @example Условные классы (последний `px-*` побеждает)
 * ```typescript
 * import { cn } from '@reformer/ui-kit';
 *
 * cn('px-2 py-1', isActive && 'bg-blue-500', 'px-4');
 * // → 'py-1 bg-blue-500 px-4'
 * ```
 *
 * @example Override дефолтных стилей в forwardRef-компоненте
 * ```tsx
 * import * as React from 'react';
 * import { cn } from '@reformer/ui-kit';
 *
 * const Card = React.forwardRef<HTMLDivElement, { className?: string }>(
 *   ({ className, ...props }, ref) => (
 *     <div ref={ref} className={cn('rounded-lg border p-4', className)} {...props} />
 *   )
 * );
 *
 * <Card className="p-8" />   // p-4 затёрт пользовательским p-8
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
