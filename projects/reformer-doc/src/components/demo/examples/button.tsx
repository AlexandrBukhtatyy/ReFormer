import { Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Button — не form-control: таб Variants показывает cva-пресеты стиля/размера (готовые конфигурации),
 * Examples — приёмы (asChild-полиморфизм, disabled), API — таблица props.
 */
export const buttonDocConfig: ComponentDocConfig = {
  name: 'Button',
  importFrom: '@reformer/ui-kit',
  description:
    'Кнопка на shadcn / Radix Slot. Варианты стиля (variant), размеры (size), asChild для полиморфизма.',
  variants: [
    {
      id: 'variants',
      title: 'Варианты стиля',
      description: 'variant: default / secondary / outline / ghost / destructive / link.',
      render: () => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
      ),
      code: `<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="link">Link</Button>`,
    },
    {
      id: 'sizes',
      title: 'Размеры',
      description: 'size: sm / default / lg (+ icon-* для квадратных кнопок).',
      render: () => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </div>
      ),
      code: `<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>`,
    },
  ],
  examples: [
    {
      id: 'as-child',
      title: 'asChild — полиморфизм (ссылка со стилем кнопки)',
      description:
        'asChild сливает props на единственный дочерний элемент вместо <button> — напр. <a> или роутер-Link.',
      render: () => (
        <Button asChild variant="outline">
          <a href="#as-child">Открыть ссылку</a>
        </Button>
      ),
      code: `import { Link } from 'react-router-dom';

<Button asChild variant="outline">
  <Link to="/dashboard">Открыть дашборд</Link>
</Button>`,
    },
    {
      id: 'disabled',
      title: 'Отключённая кнопка',
      description: 'disabled блокирует клики и приглушает стиль (pointer-events-none + opacity).',
      render: () => <Button disabled>Недоступно</Button>,
      code: `<Button disabled>Недоступно</Button>`,
    },
  ],
  props: [
    {
      name: 'variant',
      type: "'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'",
      default: 'default',
      description: 'Вариант стиля.',
    },
    {
      name: 'size',
      type: "'default' | 'sm' | 'lg' | 'xs' | 'icon' | 'icon-sm' | 'icon-lg' | 'icon-xs'",
      default: 'default',
      description: 'Размер (icon-* — квадратные).',
    },
    {
      name: 'asChild',
      type: 'boolean',
      default: 'false',
      description: 'Слить props на дочерний элемент (Radix Slot) вместо рендера <button>.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      default: 'false',
      description: 'Отключить кнопку.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы (tailwind-merge — класс вызывающего перекрывает).',
    },
  ],
};
