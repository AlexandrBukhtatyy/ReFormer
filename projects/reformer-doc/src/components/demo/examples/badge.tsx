import { Badge } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Badge — не поле формы: вкладка Variants показывает пресеты `variant`, Examples — приёмы (счётчик,
 * статус, ссылка через asChild), API — таблица props. Обёртка `<div style>` в render — рамка демо,
 * в `code` её нет.
 */
export const badgeDocConfig: ComponentDocConfig = {
  name: 'Badge',
  importFrom: '@reformer/ui-kit',
  description: 'Короткая метка: статус, счётчик, тег. Вид — variant, asChild — метка-ссылка.',
  variants: [
    {
      id: 'variants',
      title: 'Вид (variant)',
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
      title: 'Метка-ссылка (asChild)',
      description:
        'asChild отдаёт стили единственному дочернему элементу вместо <span> — например, <a> или Link роутера. Подсветка при наведении включается только на ссылке.',
      render: () => (
        <Badge asChild variant="secondary">
          <a href="#as-child">Новинки</a>
        </Badge>
      ),
      code: `<Badge asChild variant="secondary">
  <a href="#as-child">Новинки</a>
</Badge>`,
    },
    {
      id: 'counter',
      title: 'Счётчик и статус',
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
      default: "'default'",
      description: 'Вид метки.',
    },
    {
      name: 'asChild',
      type: 'boolean',
      default: 'false',
      description:
        'Отрисовать вместо <span> единственный дочерний элемент (Radix Slot) — например, <a>.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Дополнительные классы. При конфликте Tailwind-классов побеждает ваш.',
    },
    {
      name: '...props',
      type: "React.ComponentProps<'span'>",
      description: 'Остальные атрибуты <span>: title, aria-*, data-* и т. д.',
    },
  ],
};
