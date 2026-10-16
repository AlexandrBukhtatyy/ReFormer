import { useKitMessages } from '@/i18n/messages';
import * as React from 'react';
import { Loader2Icon } from 'lucide-react';

import { cn } from '@/lib/utils';

// Дословный порт shadcn/ui (new-york-v4) spinner. Правки только: `@/lib/utils`,
// снят 'use client', явный импорт React, добавлен `data-slot`. Презентационный
// (не form-control) — индикатор загрузки поверх lucide `Loader2Icon` с spin-анимацией.
// Доступность: `role="status"` + `aria-label={t('kit.spinner.label')}`. Размер — через className (size-*).
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  const t = useKitMessages();
  return (
    <Loader2Icon
      role="status"
      aria-label={t('kit.spinner.label')}
      data-slot="spinner"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
