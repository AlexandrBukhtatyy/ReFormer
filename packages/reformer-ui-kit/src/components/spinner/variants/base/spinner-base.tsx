import * as React from 'react';
import { Loader2Icon } from 'lucide-react';

import { cn } from '@/lib/utils';

// Дословный порт shadcn/ui (new-york-v4) spinner. Правки только: `@/lib/utils`,
// снят 'use client', явный импорт React, добавлен `data-slot`. Презентационный
// (не form-control) — индикатор загрузки поверх lucide `Loader2Icon` с spin-анимацией.
// Доступность: `role="status"` + `aria-label="Loading"`. Размер — через className (size-*).
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      data-slot="spinner"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
