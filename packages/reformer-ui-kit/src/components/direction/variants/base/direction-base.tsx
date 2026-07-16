import * as React from 'react';
import { Direction } from 'radix-ui';

// Дословный порт shadcn/ui (new-york-v4) direction. Правки только: unified `radix-ui`
// (Direction.DirectionProvider/useDirection), снят 'use client'. data-slot/cn в апстриме
// отсутствуют (провайдер не рендерит DOM-обёртку, только React-контекст для Radix-примитивов).
function DirectionProvider({
  dir,
  direction,
  children,
}: React.ComponentProps<typeof Direction.DirectionProvider> & {
  direction?: React.ComponentProps<typeof Direction.DirectionProvider>['dir'];
}) {
  return (
    <Direction.DirectionProvider dir={direction ?? dir}>{children}</Direction.DirectionProvider>
  );
}

const useDirection = Direction.useDirection;

export { DirectionProvider, useDirection };
