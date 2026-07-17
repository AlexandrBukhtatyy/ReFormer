import { AspectRatio } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * AspectRatio — не form-control: обёртка над Radix AspectRatio. Держит вложенный контент
 * (картинка, видео, плейсхолдер) в заданной пропорции `ratio` при resize контейнера.
 * Variants — типовые пропорции (16/9, 1/1), Examples — рецепты (медиа-карточка).
 */

// Плейсхолдер «картинки» — блок с CSS-градиентом (в доке нет реальных ассетов).
const placeholderStyle = {
  height: '100%',
  width: '100%',
  borderRadius: 8,
  background: 'linear-gradient(135deg, hsl(220 70% 60%), hsl(280 65% 55%))',
} as const;

export const aspectRatioDocConfig: ComponentDocConfig = {
  name: 'AspectRatio',
  importFrom: '@reformer/ui-kit',
  description:
    'Обёртка над Radix AspectRatio: держит вложенный контент в фиксированной пропорции (ratio) независимо от ширины контейнера. Ширину задаёт родитель; высота считается автоматически.',
  variants: [
    {
      id: 'widescreen',
      title: 'Широкий формат (16 / 9)',
      description:
        'ratio={16 / 9} — типовая пропорция для превью видео и обложек. Ширину задаёт контейнер.',
      render: () => (
        <div style={{ width: 320 }}>
          <AspectRatio ratio={16 / 9}>
            <div style={placeholderStyle} />
          </AspectRatio>
        </div>
      ),
      code: `<div style={{ width: 320 }}>
  <AspectRatio ratio={16 / 9}>
    <img src="/cover.jpg" alt="Обложка" className="h-full w-full rounded-md object-cover" />
  </AspectRatio>
</div>`,
    },
    {
      id: 'square',
      title: 'Квадрат (1 / 1)',
      description: 'ratio={1} — квадрат: аватары, миниатюры товаров, иконки-плитки.',
      render: () => (
        <div style={{ width: 200 }}>
          <AspectRatio ratio={1}>
            <div style={placeholderStyle} />
          </AspectRatio>
        </div>
      ),
      code: `<div style={{ width: 200 }}>
  <AspectRatio ratio={1}>
    <img src="/thumb.jpg" alt="Миниатюра" className="h-full w-full rounded-md object-cover" />
  </AspectRatio>
</div>`,
    },
  ],
  examples: [
    {
      id: 'media-card',
      title: 'Медиа-карточка (превью + подпись)',
      description:
        'Обложка в пропорции 16/9 сверху, под ней заголовок и описание — контент не «прыгает» при загрузке картинки.',
      render: () => (
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AspectRatio ratio={16 / 9}>
            <div style={placeholderStyle} />
          </AspectRatio>
          <div style={{ fontWeight: 600 }}>Заголовок статьи</div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            Короткое описание материала в две строки для примера.
          </div>
        </div>
      ),
      code: `<div className="flex flex-col gap-2 w-70">
  <AspectRatio ratio={16 / 9}>
    <img src="/cover.jpg" alt="" className="h-full w-full rounded-md object-cover" />
  </AspectRatio>
  <div className="font-semibold">Заголовок статьи</div>
  <div className="text-sm text-muted-foreground">Короткое описание материала.</div>
</div>`,
    },
  ],
  props: [
    {
      name: 'ratio',
      type: 'number',
      default: '1',
      description:
        'Пропорция ширина/высота (напр. 16 / 9, 4 / 3, 1). Высота контейнера считается от ширины через padding.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      description:
        'Контент (img / video / div). Растягивается на весь контейнер — обычно h-full w-full object-cover.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы на корне примитива (tailwind-merge — класс вызывающего перекрывает).',
    },
    {
      name: '...props',
      type: 'React.ComponentProps<typeof AspectRatioPrimitive.Root>',
      description: 'Любые атрибуты (style, data-*, aria-*) прокидываются на корень AspectRatio.',
    },
  ],
};
