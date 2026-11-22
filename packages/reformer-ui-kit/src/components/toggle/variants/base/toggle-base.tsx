import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Toggle as TogglePrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';
import { defineFieldControl } from '@/fields/field-control';
import { pressedAdapter } from '@/fields/adapters';
import { withFieldTooltip, OUTSIDE_CENTER } from '@/fields/field-tooltip';

// Дословный порт shadcn/ui (new-york-v4) toggle. Правки только: снят 'use client'
// (unified `radix-ui` — Toggle.Root — и `@/lib/utils` уже в upstream-исходнике). data-slot сохранён.
// cva-стили (variant/size) — обычная стилизация внутри реализации, НЕ «варианты» нашего концепта.
const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-9 min-w-9 px-2',
        sm: 'h-8 min-w-8 px-1.5',
        lg: 'h-10 min-w-10 px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function TogglePrimitiveBase({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

/**
 * Value-based контракт Toggle в форме. Значение — `boolean` (нажат/pressed); форма резолвит
 * `value`/`onChange`/`onBlur`/`disabled`, автор задаёт `variant`/`size`/`className` в
 * `componentProps`, а контент (иконка/текст) — через `children`. Служит типом для стража
 * props-схемы (сам компонент — Radix `pressed`/`onPressedChange`, не `value`).
 */
export interface ToggleFormProps {
  value?: boolean;
  onChange?: (value: boolean) => void;
  onBlur?: () => void;
  disabled?: boolean;
  /** Стиль cva: `default` (заливка при нажатии) | `outline` (граница). */
  variant?: 'default' | 'outline';
  /** Размер cva: `default` | `sm` | `lg`. */
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  /** Контент внутри toggle (иконка/текст). Рендерится в кнопке; НЕ является подписью поля. */
  children?: React.ReactNode;
}

/**
 * Toggle кита: порт shadcn + проп `tooltip` (иконка справа). В форме — `value: boolean` через
 * {@link pressedAdapter} (статика). НЕ inline-label: подпись поля рисует FormField сверху, а
 * `children` — контент кнопки.
 */
const Toggle = defineFieldControl(withFieldTooltip(TogglePrimitiveBase, OUTSIDE_CENTER), {
  adapter: pressedAdapter,
});
Toggle.displayName = 'Toggle';

export { Toggle, toggleVariants };
