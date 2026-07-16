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
 * Avatar — не form-control: compound-набор на Radix Avatar-примитиве (Avatar / AvatarImage /
 * AvatarFallback + презентационные AvatarBadge / AvatarGroup / AvatarGroupCount). Изображение
 * подменяется на fallback (инициалы), пока грузится или если ссылка битая. Таб Variants показывает
 * готовые композиции, Examples — приёмы (статус-бейдж, группа), API — таблицу частей и props.
 */
export const avatarDocConfig: ComponentDocConfig = {
  name: 'Avatar',
  importFrom: '@reformer/ui-kit',
  description:
    'Аватар на shadcn / Radix Avatar. AvatarImage показывает картинку, AvatarFallback — инициалы (пока грузится или при битой ссылке). Размер задаётся через size (sm / default / lg).',
  variants: [
    {
      id: 'basic',
      title: 'Изображение и fallback',
      description:
        'AvatarImage грузит картинку; при валидной ссылке видно фото, при битой — AvatarFallback с инициалами.',
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
      title: 'Размеры',
      description: 'size: sm / default / lg.',
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
      title: 'Статус-бейдж (индикатор онлайна)',
      description:
        'AvatarBadge позиционируется в углу аватара — удобно для индикатора статуса. Здесь зелёная точка «онлайн».',
      render: () => (
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
          <AvatarFallback>SC</AvatarFallback>
          <AvatarBadge className="bg-green-500" />
        </Avatar>
      ),
      code: `<Avatar>
  <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
  <AvatarFallback>SC</AvatarFallback>
  <AvatarBadge className="bg-green-500" />
</Avatar>`,
    },
    {
      id: 'group',
      title: 'Группа аватаров с остатком',
      description:
        'AvatarGroup накладывает аватары друг на друга; AvatarGroupCount показывает «сколько ещё».',
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
          <AvatarGroupCount>+5</AvatarGroupCount>
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
  <AvatarGroupCount>+5</AvatarGroupCount>
</AvatarGroup>`,
    },
  ],
  props: [
    {
      name: 'size',
      type: "'default' | 'sm' | 'lg'",
      default: 'default',
      description: 'Размер аватара (Avatar). Маппится в data-size + классы.',
    },
    {
      name: 'AvatarImage.src',
      type: 'string',
      description:
        'URL изображения. При ошибке загрузки автоматически показывается AvatarFallback.',
    },
    {
      name: 'AvatarImage.alt',
      type: 'string',
      description: 'Альтернативный текст изображения (доступность).',
    },
    {
      name: 'AvatarFallback.delayMs',
      type: 'number',
      description:
        'Задержка перед показом fallback (чтобы не мигал при быстрой загрузке картинки).',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает).',
    },
  ],
};
