import { Separator } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Separator — не поле формы: тонкая линия на Radix Separator. Variants — горизонтальная и
 * вертикальная линии, Examples — линия между частями карточки и смысловой разделитель.
 * Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */
export const separatorDocConfig: ComponentDocConfig = {
  name: 'Separator',
  importFrom: '@reformer/ui-kit',
  description: 'Тонкая линия между блоками — горизонтальная или вертикальная.',
  variants: [
    {
      id: 'horizontal',
      title: 'Горизонтальная линия',
      description: 'По умолчанию линия во всю ширину родителя, высотой 1px, цветом рамок темы.',
      render: () => (
        <div style={{ maxWidth: 320 }}>
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Профиль</h4>
            <p className="text-sm text-muted-foreground">Имя, почта и телефон.</p>
          </div>
          <Separator className="my-4" />
          <p className="text-sm">Последний вход — вчера, 18:40.</p>
        </div>
      ),
      code: `<div className="space-y-1">
  <h4 className="text-sm font-medium">Профиль</h4>
  <p className="text-sm text-muted-foreground">Имя, почта и телефон.</p>
</div>
<Separator className="my-4" />
<p className="text-sm">Последний вход — вчера, 18:40.</p>`,
    },
    {
      id: 'vertical',
      title: 'Вертикальная линия (orientation)',
      description:
        'orientation="vertical" — линия на всю высоту родителя. У родителя-строки должна быть высота.',
      render: () => (
        <div className="flex h-5 items-center gap-4 text-sm">
          <span>Блог</span>
          <Separator orientation="vertical" />
          <span>Документация</span>
          <Separator orientation="vertical" />
          <span>Исходники</span>
        </div>
      ),
      code: `<div className="flex h-5 items-center gap-4 text-sm">
  <span>Блог</span>
  <Separator orientation="vertical" />
  <span>Документация</span>
  <Separator orientation="vertical" />
  <span>Исходники</span>
</div>`,
    },
  ],
  examples: [
    {
      id: 'semantic',
      title: 'Смысловой разделитель (decorative={false})',
      description:
        'По умолчанию линия — украшение, скринридер её не видит. decorative={false} делает её role="separator": скринридер сообщит о границе разделов.',
      render: () => (
        <div style={{ maxWidth: 320 }} className="text-sm">
          <p>Основные настройки</p>
          <Separator decorative={false} className="my-3" />
          <p>Опасная зона</p>
        </div>
      ),
      code: `<p>Основные настройки</p>
<Separator decorative={false} className="my-3" />
<p>Опасная зона</p>`,
    },
  ],
  props: [
    {
      name: 'orientation',
      type: "'horizontal' | 'vertical'",
      default: "'horizontal'",
      description:
        'Направление. Горизонтальная — на всю ширину, вертикальная — на всю высоту родителя.',
    },
    {
      name: 'decorative',
      type: 'boolean',
      default: 'true',
      description:
        'true — украшение, скрыто от скринридера (role="none"). false — role="separator", у вертикальной ещё aria-orientation.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Отступы (my-4, mx-2), цвет, толщина. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
