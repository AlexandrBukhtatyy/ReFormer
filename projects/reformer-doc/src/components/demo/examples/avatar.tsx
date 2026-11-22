import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Avatar — не поле формы: части на Radix Avatar (Avatar / AvatarImage / AvatarFallback) и
 * презентационные AvatarBadge / AvatarGroup / AvatarGroupCount. Пока картинка грузится или если
 * ссылка битая, показывается AvatarFallback. Variants — готовые композиции, Examples — приёмы,
 * API — таблица частей. Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */
export const avatarDocConfig: ComponentDocConfig = {
  name: 'Avatar',
  importFrom: '@reformer/ui-kit',
  description:
    'Круглое фото пользователя с запасным вариантом — инициалами. Размер — size (sm / default / lg).',
  variants: [
    {
      id: 'basic',
      title: 'Фото и инициалы',
      description:
        'AvatarImage грузит картинку. Пока она грузится или если ссылка битая, виден AvatarFallback с инициалами.',
      render: () => (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
            <AvatarFallback>SC</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarImage src="/broken-link.png" alt="Иван Петров" />
            <AvatarFallback>ИП</AvatarFallback>
          </Avatar>
        </div>
      ),
      code: `<Avatar>
  <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
  <AvatarFallback>SC</AvatarFallback>
</Avatar>

{/* Битая ссылка → показываются инициалы */}
<Avatar>
  <AvatarImage src="/broken-link.png" alt="Иван Петров" />
  <AvatarFallback>ИП</AvatarFallback>
</Avatar>`,
    },
    {
      id: 'sizes',
      title: 'Размер (size)',
      description: 'sm — 24px, default — 32px, lg — 40px.',
      render: () => (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Avatar size="sm">
            <AvatarFallback>SM</AvatarFallback>
          </Avatar>
          <Avatar size="default">
            <AvatarFallback>MD</AvatarFallback>
          </Avatar>
          <Avatar size="lg">
            <AvatarFallback>LG</AvatarFallback>
          </Avatar>
        </div>
      ),
      code: `<Avatar size="sm">
  <AvatarFallback>SM</AvatarFallback>
</Avatar>
<Avatar size="default">
  <AvatarFallback>MD</AvatarFallback>
</Avatar>
<Avatar size="lg">
  <AvatarFallback>LG</AvatarFallback>
</Avatar>`,
    },
  ],
  examples: [
    {
      id: 'status-badge',
      title: 'Точка статуса (AvatarBadge)',
      description:
        'AvatarBadge встаёт в правый нижний угол, цвет — классом. Точку скринридер не видит: role="img" и aria-label называют человека и статус словами.',
      render: () => (
        <Avatar role="img" aria-label="shadcn, в сети">
          <AvatarImage src="https://github.com/shadcn.png" alt="" />
          <AvatarFallback>SC</AvatarFallback>
          <AvatarBadge className="bg-green-500" />
        </Avatar>
      ),
      code: `<Avatar role="img" aria-label="shadcn, в сети">
  <AvatarImage src="https://github.com/shadcn.png" alt="" />
  <AvatarFallback>SC</AvatarFallback>
  <AvatarBadge className="bg-green-500" />
</Avatar>`,
    },
    {
      id: 'group',
      title: 'Группа с остатком',
      description:
        'AvatarGroup накладывает аватары друг на друга, AvatarGroupCount показывает, сколько ещё не уместилось.',
      render: () => (
        <AvatarGroup>
          <Avatar>
            <AvatarFallback>АБ</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>ВГ</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>ДЕ</AvatarFallback>
          </Avatar>
          <AvatarGroupCount>
            +5<span className="sr-only"> участников</span>
          </AvatarGroupCount>
        </AvatarGroup>
      ),
      code: `<AvatarGroup>
  <Avatar>
    <AvatarFallback>АБ</AvatarFallback>
  </Avatar>
  <Avatar>
    <AvatarFallback>ВГ</AvatarFallback>
  </Avatar>
  <Avatar>
    <AvatarFallback>ДЕ</AvatarFallback>
  </Avatar>
  <AvatarGroupCount>
    +5<span className="sr-only"> участников</span>
  </AvatarGroupCount>
</AvatarGroup>`,
    },
  ],
  props: [
    {
      name: 'Avatar.size',
      type: "'default' | 'sm' | 'lg'",
      default: "'default'",
      description:
        'Размер: sm — 24px, default — 32px, lg — 40px. От него зависят шрифт инициалов и точка статуса.',
    },
    {
      name: 'AvatarImage.src',
      type: 'string',
      description: 'Адрес картинки. Пока она грузится или при ошибке виден AvatarFallback.',
    },
    {
      name: 'AvatarImage.alt',
      type: 'string',
      description:
        'Текст для скринридера — обычно имя человека. Пустая строка, если имя написано рядом.',
    },
    {
      name: 'AvatarFallback.delayMs',
      type: 'number',
      description:
        'Показать инициалы не сразу, а через N мс — чтобы они не мелькали при быстрой загрузке.',
    },
    {
      name: 'AvatarBadge',
      type: 'span',
      description: 'Точка или значок в правом нижнем углу. Размер подстраивается под size аватара.',
    },
    {
      name: 'AvatarGroup',
      type: 'div',
      description: 'Ряд аватаров внахлёст с обводкой цветом фона.',
    },
    {
      name: 'AvatarGroupCount',
      type: 'div',
      description: 'Кружок «+N» в конце группы. Размер следует за size аватаров группы.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой части. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
