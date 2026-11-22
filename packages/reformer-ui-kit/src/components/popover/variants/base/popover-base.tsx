import * as React from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

// Порт shadcn/ui (new-york-v4) popover. Правки: unified `radix-ui`
// (Popover as PopoverPrimitive), `@/lib/utils`, снят 'use client'. data-slot уже в апстриме.
// Compound-набор поверх Radix Popover: Root / Trigger / Content (в Portal) / Anchor
// + презентационные Header / Title / Description. Стили — Tailwind внутри реализации.
//
// Расхождение с апстримом: у Radix Popover нет своего Title, и панель (`role="dialog"`) оставалась
// без имени. Здесь `PopoverTitle` сообщает свой id панели, и та получает `aria-labelledby`; явные
// `aria-label`/`aria-labelledby` у `PopoverContent` важнее. `PopoverTitle` в апстриме типизирован
// как `h2`, а рисует `div` — тип выровнен по разметке.

/** Канал от `PopoverTitle` к `PopoverContent`: id заголовка, который называет панель. */
const PopoverTitleIdContext = React.createContext<((id: string | undefined) => void) | null>(null);

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const [titleId, setTitleId] = React.useState<string | undefined>(undefined);
  const named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined;
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        aria-labelledby={named ? undefined : titleId}
        className={cn(
          'z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
        {...props}
      >
        <PopoverTitleIdContext.Provider value={setTitleId}>
          {children}
        </PopoverTitleIdContext.Provider>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="popover-header"
      className={cn('flex flex-col gap-1 text-sm', className)}
      {...props}
    />
  );
}

/**
 * Заголовок панели: им называется `PopoverContent` (`aria-labelledby`), если у панели нет своих
 * `aria-label`/`aria-labelledby`. Рисуется `div`, а не заголовком `h*`: панель не должна ломать
 * структуру заголовков страницы.
 */
function PopoverTitle({ className, id: idProp, ...props }: React.ComponentProps<'div'>) {
  const generatedId = React.useId();
  const id = idProp ?? generatedId;
  const setTitleId = React.useContext(PopoverTitleIdContext);
  React.useLayoutEffect(() => {
    if (!setTitleId) return;
    setTitleId(id);
    return () => setTitleId(undefined);
  }, [id, setTitleId]);
  return (
    <div data-slot="popover-title" id={id} className={cn('font-medium', className)} {...props} />
  );
}

function PopoverDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="popover-description"
      className={cn('text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
};
