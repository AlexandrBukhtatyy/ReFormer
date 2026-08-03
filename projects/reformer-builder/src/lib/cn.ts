/**
 * `cn` — стандартный shadcn-хелпер: clsx + tailwind-merge (разруливает конфликтующие
 * tailwind-классы). Используется во всей оболочке билдера.
 *
 * @module reformer-builder/lib/cn
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
