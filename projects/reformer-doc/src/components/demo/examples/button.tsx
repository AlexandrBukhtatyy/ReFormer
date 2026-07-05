import type { ComponentType } from 'react';
import { Button } from '@reformer/ui-kit';
import type { ComponentDocConfig, KnobValues } from '../types';

function makeButton(variant: string, label: string): ComponentType {
  return function ButtonVariant() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Button variant={variant as any}>{label}</Button>;
  };
}

function ButtonKnobDemo(values: KnobValues) {
  return (
    <Button
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      variant={values.variant as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      size={values.size as any}
      disabled={Boolean(values.disabled)}
    >
      {String(values.text)}
    </Button>
  );
}

export const buttonDocConfig: ComponentDocConfig = {
  name: 'Button',
  importFrom: '@reformer/ui-kit',
  description: 'Кнопка на shadcn/Radix Slot: 6 вариантов, 6 размеров, asChild.',
  variants: [
    {
      id: 'default',
      title: 'Default',
      render: makeButton('default', 'Сохранить'),
      code: `<Button>Сохранить</Button>`,
    },
    {
      id: 'secondary',
      title: 'Secondary',
      render: makeButton('secondary', 'Отмена'),
      code: `<Button variant="secondary">Отмена</Button>`,
    },
    {
      id: 'outline',
      title: 'Outline',
      render: makeButton('outline', 'Подробнее'),
      code: `<Button variant="outline">Подробнее</Button>`,
    },
    {
      id: 'destructive',
      title: 'Destructive',
      render: makeButton('destructive', 'Удалить'),
      code: `<Button variant="destructive">Удалить</Button>`,
    },
    {
      id: 'ghost',
      title: 'Ghost',
      render: makeButton('ghost', 'Ещё'),
      code: `<Button variant="ghost">Ещё</Button>`,
    },
    {
      id: 'link',
      title: 'Link',
      render: makeButton('link', 'Открыть'),
      code: `<Button variant="link">Открыть</Button>`,
    },
  ],
  examples: [
    {
      id: 'as-child',
      title: 'asChild — стили кнопки на другом элементе',
      description: 'Slot переносит стили Button на дочерний элемент (например, ссылку роутера).',
      render: function AsChildExample() {
        return (
          <Button asChild variant="outline">
            <a href="#api">Перейти к API</a>
          </Button>
        );
      },
      code: `import { Link } from 'react-router-dom';

<Button asChild variant="outline" size="lg">
  <Link to="/dashboard">Открыть дашборд</Link>
</Button>`,
    },
  ],
  playground: {
    knobs: [
      {
        name: 'variant',
        label: 'variant',
        type: 'select',
        options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
        default: 'default',
      },
      {
        name: 'size',
        label: 'size',
        type: 'select',
        options: ['default', 'sm', 'lg'],
        default: 'default',
      },
      { name: 'text', label: 'текст', type: 'text', default: 'Кнопка' },
      { name: 'disabled', label: 'disabled', type: 'boolean', default: false },
    ],
    render: ButtonKnobDemo,
    code: (v) =>
      `<Button\n  variant="${v.variant}"\n  size="${v.size}"${v.disabled ? '\n  disabled' : ''}\n>\n  ${v.text}\n</Button>`,
  },
  props: [
    {
      name: 'variant',
      type: `'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'`,
      default: `'default'`,
      description: 'Визуальный вариант.',
    },
    {
      name: 'size',
      type: `'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'`,
      default: `'default'`,
      description: 'Размер.',
    },
    {
      name: 'asChild',
      type: 'boolean',
      default: 'false',
      description: 'Заменить корневой <button> на дочерний элемент через Slot.',
    },
    { name: 'disabled', type: 'boolean', description: 'Блокирует кнопку.' },
    {
      name: '...props',
      type: `React.ComponentProps<'button'>`,
      description: 'Все нативные атрибуты button (onClick, type, …).',
    },
  ],
};
