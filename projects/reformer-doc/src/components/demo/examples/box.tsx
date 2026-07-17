import type { ReactNode } from 'react';
import { Box } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Box — не form-control, а DSL-контейнер: простой `<div>` для группировки полей в `RenderSchema`.
 * Layout полностью задаётся `className` (atomic CSS / Tailwind). Таб Variants — готовые layout-пресеты,
 * Examples — приёмы компоновки в схеме рендера, API — единственный проп `className`.
 */

/** Наглядный плейсхолдер дочерней ноды (в реальной форме здесь были бы поля). */
function Slot({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export const boxDocConfig: ComponentDocConfig = {
  name: 'Box',
  importFrom: '@reformer/ui-kit',
  description:
    'DSL-контейнер: простой <div>-обёртка для группировки элементов в RenderSchema. Layout задаётся через className (Tailwind).',
  variants: [
    {
      id: 'stack',
      title: 'Вертикальный стек',
      description: 'flex flex-col gap-4 — колонка полей с равными отступами.',
      render: () => (
        <Box className="flex flex-col gap-4">
          <Slot>email</Slot>
          <Slot>password</Slot>
        </Box>
      ),
      code: `<Box className="flex flex-col gap-4">
  {/* children */}
</Box>`,
    },
    {
      id: 'grid',
      title: 'Двухколоночная сетка',
      description: 'grid grid-cols-2 gap-4 — два поля в ряд.',
      render: () => (
        <Box className="grid grid-cols-2 gap-4">
          <Slot>firstName</Slot>
          <Slot>lastName</Slot>
        </Box>
      ),
      code: `<Box className="grid grid-cols-2 gap-4">
  {/* children */}
</Box>`,
    },
    {
      id: 'row',
      title: 'Горизонтальный ряд',
      description: 'flex items-center gap-2 — элементы в строку.',
      render: () => (
        <Box className="flex items-center gap-2">
          <Slot>city</Slot>
          <Slot>zip</Slot>
        </Box>
      ),
      code: `<Box className="flex items-center gap-2">
  {/* children */}
</Box>`,
    },
  ],
  examples: [
    {
      id: 'render-schema',
      title: 'Группировка полей в RenderSchema (M1: лист = value + component)',
      description:
        'В схеме рендера Box — контейнерная нода: componentProps.className задаёт layout, а поля перечисляются в children[].',
      render: () => (
        <Box className="flex flex-col gap-4">
          <Slot>value: model.$.email → Input</Slot>
          <Slot>value: model.$.password → InputPassword</Slot>
        </Box>
      ),
      code: `import { Box, Input, InputPassword } from '@reformer/ui-kit';

{
  component: Box,
  componentProps: { className: 'flex flex-col gap-4' },
  children: [
    { value: model.$.email, component: Input },
    { value: model.$.password, component: InputPassword },
  ],
}`,
    },
    {
      id: 'nested',
      title: 'Вложенные контейнеры (секция внутри сетки)',
      description: 'Box можно вкладывать: внешний задаёт сетку, внутренний — свой стек.',
      render: () => (
        <Box className="grid grid-cols-2 gap-4">
          <Box className="flex flex-col gap-2">
            <Slot>firstName</Slot>
            <Slot>lastName</Slot>
          </Box>
          <Box className="flex flex-col gap-2">
            <Slot>city</Slot>
            <Slot>zip</Slot>
          </Box>
        </Box>
      ),
      code: `{
  component: Box,
  componentProps: { className: 'grid grid-cols-2 gap-4' },
  children: [
    {
      component: Box,
      componentProps: { className: 'flex flex-col gap-2' },
      children: [
        { value: model.$.firstName, component: Input },
        { value: model.$.lastName, component: Input },
      ],
    },
    {
      component: Box,
      componentProps: { className: 'flex flex-col gap-2' },
      children: [
        { value: model.$.city, component: Input },
        { value: model.$.zip, component: Input },
      ],
    },
  ],
}`,
    },
  ],
  props: [
    {
      name: 'className',
      type: 'string',
      description:
        'CSS-класс layout-контейнера (atomic CSS / Tailwind: flex, grid, gap-*). Единственный сериализуемый проп.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description:
        'Дочерние элементы. В RenderSchema приходят из children[] схемы, а не из componentProps.',
    },
  ],
};
