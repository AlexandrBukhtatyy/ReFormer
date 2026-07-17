import { Badge } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Badge — не form-control: таб Variants показывает cva-пресеты стиля (variant), Examples — приёмы
 * (asChild-полиморфизм, счётчик/статус), API — таблица props. Form-bound таба (api) нет.
 */
export const badgeDocConfig: ComponentDocConfig = {
  name: 'Badge',
  importFrom: '@reformer/ui-kit',
  description:
    'Метка/значок на shadcn / Radix Slot. Вариант стиля через variant, asChild для полиморфизма (напр. ссылка).',
  variants: [
    {
      id: 'variants',
      title: 'Варианты стиля',
      description: 'variant: default / secondary / destructive / outline / ghost / link.',
      render: () => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="ghost">Ghost</Badge>
          <Badge variant="link">Link</Badge>
        </div>
      ),
      code: `<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="ghost">Ghost</Badge>
<Badge variant="link">Link</Badge>`,
    },
  ],
  examples: [
    {
      id: 'as-child',
      title: 'asChild — полиморфизм (кликабельная метка-ссылка)',
      description:
        'asChild сливает props на единственный дочерний элемент вместо <span> — напр. <a> или роутер-Link. Ховер-стили ([a&]) активируются на ссылке.',
      render: () => (
        <Badge asChild variant="secondary">
          <a href="#as-child">Открыть тег</a>
        </Badge>
      ),
      code: `import { Link } from 'react-router-dom';

<Badge asChild variant="secondary">
  <Link to="/tags/new">Новинки</Link>
</Badge>`,
    },
    {
      id: 'counter',
      title: 'Счётчик / статус',
      description: 'Метка рядом с текстом — количество, статус или короткий ярлык.',
      render: () => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>Входящие</span>
          <Badge variant="destructive">12</Badge>
          <Badge variant="outline">черновик</Badge>
        </div>
      ),
      code: `<span>Входящие</span>
<Badge variant="destructive">12</Badge>
<Badge variant="outline">черновик</Badge>`,
    },
  ],
  props: [
    {
      name: 'variant',
      type: "'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'",
      default: 'default',
      description: 'Вариант стиля.',
    },
    {
      name: 'asChild',
      type: 'boolean',
      default: 'false',
      description: 'Слить props на дочерний элемент (Radix Slot) вместо рендера <span>.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы (tailwind-merge — класс вызывающего перекрывает).',
    },
  ],
};
