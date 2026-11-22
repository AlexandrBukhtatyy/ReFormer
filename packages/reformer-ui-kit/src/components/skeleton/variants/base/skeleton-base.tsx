import * as React from 'react';

import { cn } from '@/lib/utils';

// Дословный порт shadcn/ui (new-york-v4) skeleton. Правки только: `@/lib/utils`,
// снят 'use client', явный импорт React. Презентационный (не form-control) —
// плейсхолдер загрузки с pulse-анимацией. Стили — Tailwind внутри реализации.
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-accent', className)}
      {...props}
    />
  );
}

export { Skeleton };
