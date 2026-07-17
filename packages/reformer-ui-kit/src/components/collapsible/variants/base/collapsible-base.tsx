import * as React from 'react';
import { Collapsible as CollapsiblePrimitive } from 'radix-ui';

// Дословный порт shadcn/ui (new-york-v4) collapsible. Правки только: unified `radix-ui`
// (Collapsible.Root/CollapsibleTrigger/CollapsibleContent), снят 'use client', добавлен
// import React для `React.ComponentProps`. data-slot сохранён на всех под-частях.
// Compound-набор поверх Radix Collapsible — презентационный (не form-control).
function Collapsible({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return <CollapsiblePrimitive.CollapsibleTrigger data-slot="collapsible-trigger" {...props} />;
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return <CollapsiblePrimitive.CollapsibleContent data-slot="collapsible-content" {...props} />;
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
