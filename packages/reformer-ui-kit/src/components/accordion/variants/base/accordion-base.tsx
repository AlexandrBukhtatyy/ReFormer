import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Accordion as AccordionPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

// Порт shadcn/ui (new-york-v4) accordion. Правки: unified `radix-ui`
// (Accordion.Root/Item/Header/Trigger/Content), `@/lib/utils`, снят 'use client'.
// data-slot сохранён на всех под-частях. Compound-набор поверх Radix Accordion —
// презентационный (не form-control). Стили — Tailwind внутри реализации.
/** Уровень заголовка секции: `h1`–`h6`. */
type AccordionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

// Расхождение с апстримом: уровень заголовка секции настраивается. Radix Header жёстко рисует
// `h3`, и аккордеон под заголовком `h3` (или прямо под `h1`) ломал структуру заголовков
// страницы, по которой ходит скринридер.
const AccordionHeadingLevelContext = React.createContext<AccordionHeadingLevel>(3);

function Accordion({
  headingLevel = 3,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root> & {
  /** Уровень заголовков секций (`h1`–`h6`) для всех `AccordionTrigger` внутри. По умолчанию 3. */
  headingLevel?: AccordionHeadingLevel;
}) {
  return (
    <AccordionHeadingLevelContext.Provider value={headingLevel}>
      <AccordionPrimitive.Root data-slot="accordion" {...props} />
    </AccordionHeadingLevelContext.Provider>
  );
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('border-b last:border-b-0', className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  headingLevel,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
  /** Уровень заголовка этой секции; не задан — берётся из `Accordion` (по умолчанию 3). */
  headingLevel?: AccordionHeadingLevel;
}) {
  const inheritedLevel = React.useContext(AccordionHeadingLevelContext);
  const level = headingLevel ?? inheritedLevel;
  const Heading = `h${level}` as const;
  return (
    <AccordionPrimitive.Header asChild className="flex">
      <Heading>
        <AccordionPrimitive.Trigger
          data-slot="accordion-trigger"
          className={cn(
            'flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180',
            className
          )}
          {...props}
        >
          {children}
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200" />
        </AccordionPrimitive.Trigger>
      </Heading>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn('pt-0 pb-4', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
export type { AccordionHeadingLevel };
