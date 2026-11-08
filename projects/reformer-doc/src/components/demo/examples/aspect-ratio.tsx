import { AspectRatio } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * AspectRatio — не поле формы: обёртка над Radix AspectRatio. Держит содержимое в пропорции
 * `ratio`, ширину берёт у родителя. Variants — типовые пропорции, Examples — карточка с обложкой,
 * API — таблица props. Обёртка `<div style>` в render — рамка демо (задаёт ширину), в `code` её нет.
 */

export const aspectRatioDocConfig: ComponentDocConfig = {
  name: 'AspectRatio',
  importFrom: '@reformer/ui-kit',
  description:
    'Держит содержимое в заданной пропорции ширины к высоте. Ширину задаёт родитель, высота считается сама.',
  variants: [
    {
      id: 'widescreen',
      title: 'Широкий формат (16 / 9)',
      description: 'ratio={16 / 9} — превью видео и обложки. Ширину задаёт родитель (здесь 320px).',
      render: () => (
        <div style={{ width: 320 }}>
          <AspectRatio ratio={16 / 9} className="rounded-md bg-muted">
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              16 : 9
            </div>
          </AspectRatio>
        </div>
      ),
      code: `<AspectRatio ratio={16 / 9} className="rounded-md bg-muted">
  <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
    16 : 9
  </div>
</AspectRatio>`,
    },
    {
      id: 'square',
      title: 'Квадрат (1 / 1)',
      description: 'ratio={1} — миниатюры товаров и плитки. Значение по умолчанию.',
      render: () => (
        <div style={{ width: 200 }}>
          <AspectRatio ratio={1} className="rounded-md bg-muted">
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              1 : 1
            </div>
          </AspectRatio>
        </div>
      ),
      code: `<AspectRatio ratio={1} className="rounded-md bg-muted">
  <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
    1 : 1
  </div>
</AspectRatio>`,
    },
  ],
  examples: [
    {
      id: 'media-card',
      title: 'Карточка с обложкой',
      description:
        'Место под обложку зарезервировано пропорцией: текст под ней не сдвигается, пока картинка грузится.',
      render: () => (
        <div style={{ width: 280 }}>
          <div className="flex flex-col gap-2">
            <AspectRatio ratio={16 / 9} className="rounded-md bg-muted" />
            <div className="font-medium">Заголовок статьи</div>
            <div className="text-sm text-muted-foreground">
              Короткое описание материала в две строки для примера.
            </div>
          </div>
        </div>
      ),
      code: `<div className="flex flex-col gap-2">
  <AspectRatio ratio={16 / 9} className="rounded-md bg-muted" />
  <div className="font-medium">Заголовок статьи</div>
  <div className="text-sm text-muted-foreground">
    Короткое описание материала в две строки для примера.
  </div>
</div>`,
    },
  ],
  props: [
    {
      name: 'ratio',
      type: 'number',
      default: '1',
      description:
        'Отношение ширины к высоте: 16 / 9, 4 / 3, 1. Высота считается от ширины родителя.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description:
        'Содержимое: img, video, iframe. Растягивайте его на всю область — классы h-full w-full, для картинок ещё object-cover.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Классы внутренней области, которая держит пропорцию: фон, скругление, overflow-hidden.',
    },
    {
      name: 'style',
      type: 'CSSProperties',
      description:
        'Стили внутренней области. position и отступы до краёв компонент задаёт сам — их не перекрыть.',
    },
    {
      name: '...props',
      type: "ComponentProps<'div'>",
      description: 'Остальные атрибуты (data-*, aria-*, id) попадают на внутреннюю область.',
    },
  ],
};
