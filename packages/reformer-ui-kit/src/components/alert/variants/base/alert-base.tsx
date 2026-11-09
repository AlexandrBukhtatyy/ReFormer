import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Порт shadcn/ui (new-york-v4) alert. Правки: `@/lib/utils`, снят 'use client', роль по тону
// (см. JSDoc `Alert`). data-slot уже в апстриме. cva-стили (variant) — обычная стилизация
// внутри реализации, не «варианты» в смысле нашего концепта.
const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * Плашка: пояснение (`variant="default"`) или ошибка (`variant="destructive"`).
 *
 * Роль зависит от тона. `destructive` — `role="alert"`: появившись, ошибка сразу зачитывается
 * скринридером. У `default` живой роли нет: постоянное пояснение не должно объявляться как
 * срочное при каждом показе шага или экрана. Сообщение, которое появляется в ответ на действие
 * («Сохранено»), получает роль явно — `role="status"`; проп `role` перекрывает умолчание.
 */
function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  // Расхождение с апстримом: там `role="alert"` у любого тона, и статичное пояснение формы
  // скринридер объявлял срочным сообщением.
  return (
    <div
      data-slot="alert"
      role={variant === 'destructive' ? 'alert' : undefined}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed',
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
