import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Объединяет CSS-классы (`clsx` + `tailwind-merge`). Удобно для условных классов
 * с разрешением конфликтов Tailwind.
 *
 * @example
 * ```typescript
 * import { cn } from '@reformer/ui-kit';
 *
 * cn('px-2 py-1', isActive && 'bg-blue-500', 'px-4');
 * // → 'py-1 bg-blue-500 px-4'
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
