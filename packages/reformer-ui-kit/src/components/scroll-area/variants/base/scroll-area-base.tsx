import * as React from 'react';
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

// Дословный порт shadcn/ui (new-york-v4) scroll-area. Правки только: unified `radix-ui`
// (ScrollArea.Root/Viewport/ScrollAreaScrollbar/ScrollAreaThumb/Corner), `@/lib/utils`,
// снят 'use client'. data-slot уже в апстриме. Compound-набор поверх Radix ScrollArea —
// презентационный (не form-control). Стили — Tailwind внутри реализации.
//
// Сверх апстрима — `size`: у shadcn толщина полосы одна (10px), и в плотных рядах она спорит
// с содержимым — в ряду вкладок высотой 34px это почти треть высоты. `xs` даёт 6px, как полосы
// в редакторах кода. Толщина полосы — решение раскладки конкретного места, а не темы, поэтому
// это проп, а не токен; `data-size` на полосе оставлен для стилей вызывающего и для тестов.

/** Ступени толщины полос прокрутки: `default` — 10px апстрима, `xs` — 6px для плотных рядов. */
type ScrollAreaSize = 'default' | 'xs';

function ScrollArea({
  className,
  children,
  size = 'default',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /** Толщина полос прокрутки: `xs` — тонкие (6px) для плотных рядов вроде вкладок. */
  size?: ScrollAreaSize;
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {/* Собственная вертикальная полоса области наследует её размерность: иначе вызывающий
          задал бы `size` дважды — на области и на каждой полосе, которую добавил сам. */}
      <ScrollBar size={size} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = 'vertical',
  size = 'default',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> & {
  /** Толщина полосы: `xs` — тонкая (6px) для плотных рядов вроде вкладок. */
  size?: ScrollAreaSize;
}) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      data-size={size}
      orientation={orientation}
      className={cn(
        'flex touch-none p-px transition-colors select-none',
        orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent',
        orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent',
        // `xs` сужает полосу вдвое и снимает внутренний отступ: с ним от ползунка в 6px полосе
        // остаётся 3px (пиксель отступа с каждой стороны плюс рамка-разделитель), и он теряется
        // на фоне. Рамка остаётся — она отделяет полосу от содержимого, по которому та идёт.
        size === 'xs' && 'p-0',
        size === 'xs' && orientation === 'vertical' && 'w-1.5',
        size === 'xs' && orientation === 'horizontal' && 'h-1.5',
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
export type { ScrollAreaSize };
