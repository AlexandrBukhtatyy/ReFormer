import * as React from 'react';
import { AspectRatio as AspectRatioPrimitive } from 'radix-ui';

// Дословный порт shadcn/ui (new-york-v4) aspect-ratio. Правки только: unified `radix-ui`
// (AspectRatio.Root), явный импорт React, снят 'use client'. data-slot сохранён.
// Презентационный (не form-control) — обёртка над Radix AspectRatio, держит контент
// в заданной пропорции (ratio). Стилей у примитива нет — размеры задаёт caller.
function AspectRatio({ ...props }: React.ComponentProps<typeof AspectRatioPrimitive.Root>) {
  return <AspectRatioPrimitive.Root data-slot="aspect-ratio" {...props} />;
}

export { AspectRatio };
