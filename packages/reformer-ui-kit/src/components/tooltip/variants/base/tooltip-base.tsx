import * as React from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

// Порт shadcn/ui (new-york-v4) tooltip. Правки: unified `radix-ui`
// (Tooltip.Provider/Root/Trigger/Content/Portal/Arrow), `@/lib/utils`, снят 'use client'.
// data-slot уже в апстриме. Compound-набор поверх Radix Tooltip; Content рендерится в Portal.
//
// Расхождение с апстримом: `Tooltip` без `TooltipProvider` выше по дереву ставит провайдер сам.
// Radix Root без провайдера бросает исключение, а в renderer-json/билдере `Tooltip` приходит из
// реестра в чужое дерево — форма падала целиком. Свой провайдер ставится только при отсутствии
// внешнего: вложенный провайдер перебил бы настройки приложения (`delayDuration`,
// `skipDelayDuration`) и разорвал бы общую группу подсказок.

/** Есть ли выше по дереву `TooltipProvider` кита. Провайдер Radix напрямую сюда не пишет. */
const HasTooltipProviderContext = React.createContext(false);

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <HasTooltipProviderContext.Provider value={true}>
      <TooltipPrimitive.Provider
        data-slot="tooltip-provider"
        delayDuration={delayDuration}
        {...props}
      />
    </HasTooltipProviderContext.Provider>
  );
}

/**
 * Подсказка: Radix `Tooltip.Root`. Работает и без `TooltipProvider` — тогда ставит его сам, с
 * задержкой показа кита (0 мс). Общий `TooltipProvider` в корне приложения нужен, чтобы задать
 * задержку один раз и чтобы соседние подсказки показывались без повторной задержки.
 */
function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const hasProvider = React.useContext(HasTooltipProviderContext);
  const root = <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
  return hasProvider ? root : <TooltipProvider>{root}</TooltipProvider>;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
