import { Button, Spinner } from '@reformer/ui-kit';
import { Plus, Trash2 } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Button — не поле формы: вкладка Variants показывает пресеты `variant` / `size`, Examples —
 * приёмы (иконки, загрузка, asChild, disabled), API — таблица props. Обёртка `<div style>` в render —
 * рамка демо, в `code` её нет.
 */
export const buttonDocConfig: ComponentDocConfig = {
  name: 'Button',
  importFrom: '@reformer/ui-kit',
  description: 'Кнопка действия. Вид — variant, размер — size, asChild — стиль кнопки на ссылке.',
  variants: [
    {
      id: 'variants',
      title: 'Вид (variant)',
      description:
        'default — основное действие, secondary / outline — второстепенное, ghost — тулбар и меню, destructive — опасное, link — текстовая ссылка.',
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
      title: 'Размер (size)',
      description: 'xs / sm / default / lg — кнопки с текстом; icon-* — квадратные, только иконка.',
      render: () => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" variant="outline" aria-label="Добавить">
            <Plus />
          </Button>
        </div>
      ),
      code: `import { Plus } from 'lucide-react';

<Button size="xs">Extra small</Button>
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon" variant="outline" aria-label="Добавить">
  <Plus />
</Button>`,
    },
  ],
  examples: [
    {
      id: 'with-icon',
      title: 'Иконка в кнопке',
      description:
        'SVG-иконка внутри кнопки получает размер 16px и отступ от текста сама. Кнопке без текста нужен aria-label.',
      render: () => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button size="sm">
            <Plus /> Добавить
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Удалить">
            <Trash2 />
          </Button>
        </div>
      ),
      code: `import { Plus, Trash2 } from 'lucide-react';

<Button size="sm">
  <Plus /> Добавить
</Button>
<Button size="icon-sm" variant="ghost" aria-label="Удалить">
  <Trash2 />
</Button>`,
    },
    {
      id: 'loading',
      title: 'Кнопка в ожидании',
      description:
        'Пока идёт запрос, кнопку блокируют и ставят Spinner перед текстом. Spinner объявляет себя скринридеру (role="status").',
      render: () => (
        <Button disabled>
          <Spinner /> Сохраняем…
        </Button>
      ),
      code: `<Button disabled>
  <Spinner /> Сохраняем…
</Button>`,
    },
    {
      id: 'as-child',
      title: 'Ссылка с видом кнопки (asChild)',
      description:
        'asChild передаёт стили и пропсы единственному дочернему элементу вместо <button>: ссылка остаётся ссылкой.',
      render: () => (
        <Button asChild variant="outline">
          <a href="#as-child">Открыть дашборд</a>
        </Button>
      ),
      code: `<Button asChild variant="outline">
  <a href="#as-child">Открыть дашборд</a>
</Button>`,
    },
    {
      id: 'disabled',
      title: 'Недоступная кнопка',
      description: 'disabled блокирует нажатие и приглушает вид.',
      render: () => <Button disabled>Недоступно</Button>,
      code: `<Button disabled>Недоступно</Button>`,
    },
  ],
  props: [
    {
      name: 'variant',
      type: "'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'",
      default: "'default'",
      description: 'Вид кнопки.',
    },
    {
      name: 'size',
      type: "'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'",
      default: "'default'",
      description: 'Размер. icon-* — квадратная кнопка под одну иконку.',
    },
    {
      name: 'asChild',
      type: 'boolean',
      default: 'false',
      description:
        'Отрисовать вместо <button> единственный дочерний элемент (Radix Slot) — например, <a> или Link роутера.',
    },
    {
      name: 'type',
      type: "'button' | 'submit' | 'reset'",
      default: "'submit' (как у <button>)",
      description:
        'HTML-тип. Внутри <form> у кнопок, которые не отправляют форму, ставьте "button".',
    },
    {
      name: 'disabled',
      type: 'boolean',
      default: 'false',
      description: 'Заблокировать кнопку.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Дополнительные классы. При конфликте Tailwind-классов побеждает ваш.',
    },
    {
      name: '...props',
      type: "React.ComponentProps<'button'>",
      description: 'Остальные атрибуты <button>: onClick, aria-*, data-* и т. д.',
    },
  ],
};
