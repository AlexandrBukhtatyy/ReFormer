import { Download, Loader2, Settings } from 'lucide-react';
import { Button } from '@reformer/ui-kit';
import type { ComponentDocConfig, KnobValues } from '../types';

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
  description:
    'Кнопка на shadcn/Radix Slot. Варианты — формы по составу контента (только текст / иконка+текст / только иконка); цветовые variant, размеры size и состояния (disabled) — стилизация и состояния, живут в API/playground.',
  variants: [
    {
      id: 'text-only',
      title: 'Только текст',
      description:
        'Дефолтная форма: текстовая подпись без иконок. Базовая раскладка h-9 px-4 под сплошной текст.',
      render: function TextOnlyButton() {
        return <Button>Сохранить</Button>;
      },
      code: `<Button>Сохранить</Button>`,
    },
    {
      id: 'icon-text',
      title: 'Иконка + текст',
      description:
        'Композиция иконка+подпись: svg-ребёнок авто-масштабируется (size-4) и отбивается gap-2, паддинг сжимается через has-[>svg].',
      render: function IconTextButton() {
        return (
          <Button>
            <Download />
            Скачать
          </Button>
        );
      },
      code: `import { Download } from 'lucide-react';

<Button>
  <Download />
  Скачать
</Button>`,
    },
    {
      id: 'icon-only',
      title: 'Только иконка',
      description:
        'Icon-only форма без текстовой подписи (тулбары, компактные действия): квадрат size-9 под иконку через size="icon" + aria-label для доступности.',
      render: function IconOnlyButton() {
        return (
          <Button size="icon" aria-label="Настройки">
            <Settings />
          </Button>
        );
      },
      code: `import { Settings } from 'lucide-react';

<Button size="icon" aria-label="Настройки">
  <Settings />
</Button>`,
    },
  ],
  examples: [
    {
      id: 'submit',
      title: 'Submit внутри формы',
      description:
        'Рецепт функционального режима type="submit": помещённая в <form> кнопка инициирует нативную отправку (и срабатывает по Enter в полях).',
      render: function SubmitExample() {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              window.alert('Форма отправлена');
            }}
          >
            <Button type="submit">Отправить</Button>
          </form>
        );
      },
      code: `<form onSubmit={handleSubmit}>
  {/* поля формы */}
  <Button type="submit">Отправить</Button>
</form>`,
    },
    {
      id: 'as-child',
      title: 'asChild — стили кнопки на другом элементе',
      description:
        'Slot переносит классы Button на дочерний элемент (Link роутера или <a>), сохраняя семантику ссылки вместо <button>.',
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
    {
      id: 'native-props',
      title: 'Проброс нативных атрибутов button',
      description:
        'Любые атрибуты React.ComponentProps<"button"> уходят на реальный <button>: обработчик onClick, form/name/value для сабмита, aria-label.',
      render: function NativePropsExample() {
        return (
          <Button
            name="action"
            value="save"
            aria-label="Сохранить черновик"
            onClick={() => window.alert('Сохранено')}
          >
            Сохранить черновик
          </Button>
        );
      },
      code: `<Button
  name="action"
  value="save"
  aria-label="Сохранить черновик"
  onClick={() => save()}
>
  Сохранить черновик
</Button>`,
    },
    {
      id: 'loading',
      title: 'Loading / busy паттерн',
      description:
        'Занятое состояние собирается из disabled=true и спиннера-ребёнка: демонстрирует авто-размер иконки (size-4) и блокировку одновременно.',
      render: function LoadingExample() {
        return (
          <Button disabled>
            <Loader2 className="animate-spin" />
            Загрузка…
          </Button>
        );
      },
      code: `import { Loader2 } from 'lucide-react';

<Button disabled>
  <Loader2 className="animate-spin" />
  Загрузка…
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
      description: 'Визуальный вариант (стилизация).',
    },
    {
      name: 'size',
      type: `'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'`,
      default: `'default'`,
      description: 'Размер (стилизация); icon* — квадрат под иконку.',
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
      description: 'Все нативные атрибуты button (onClick, type, name, value, …).',
    },
  ],
};
