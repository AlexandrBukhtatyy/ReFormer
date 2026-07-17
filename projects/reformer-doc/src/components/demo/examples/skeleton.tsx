import { Skeleton } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Skeleton — не form-control: презентационный плейсхолдер загрузки (pulse-анимация).
 * Форма и размер задаются классами (width/height/rounded) через className.
 * Variants — типовые формы (строка/круг/блок), Examples — композиции (карточка, профиль).
 */
export const skeletonDocConfig: ComponentDocConfig = {
  name: 'Skeleton',
  importFrom: '@reformer/ui-kit',
  description:
    'Плейсхолдер загрузки на shadcn. Div с pulse-анимацией; форму и размер задаёшь классами (h-*, w-*, rounded-*) через className.',
  variants: [
    {
      id: 'shapes',
      title: 'Базовые формы',
      description: 'Размер и скругление — через className: строка текста, круг (аватар), блок.',
      render: () => (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-24 w-40 rounded-xl" />
        </div>
      ),
      code: `<Skeleton className="h-4 w-48" />
<Skeleton className="h-12 w-12 rounded-full" />
<Skeleton className="h-24 w-40 rounded-xl" />`,
    },
    {
      id: 'text-lines',
      title: 'Строки текста',
      description: 'Несколько строк разной ширины — имитация абзаца во время загрузки.',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 320 }}>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ),
      code: `<div className="flex flex-col gap-2">
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-3/4" />
</div>`,
    },
  ],
  examples: [
    {
      id: 'avatar-row',
      title: 'Профиль (аватар + две строки)',
      description: 'Круглый аватар и две строки текста — типовой скелет пользователя/автора.',
      render: () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton className="h-12 w-12 rounded-full" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      ),
      code: `<div className="flex items-center gap-3">
  <Skeleton className="h-12 w-12 rounded-full" />
  <div className="flex flex-col gap-2">
    <Skeleton className="h-4 w-40" />
    <Skeleton className="h-4 w-28" />
  </div>
</div>`,
    },
    {
      id: 'card',
      title: 'Карточка (превью + заголовок + текст)',
      description: 'Крупный блок-превью сверху, под ним заголовок и строки описания.',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-5 w-2/3" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      ),
      code: `<div className="flex flex-col gap-3 w-70">
  <Skeleton className="h-40 w-full rounded-xl" />
  <Skeleton className="h-5 w-2/3" />
  <div className="flex flex-col gap-2">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
  </div>
</div>`,
    },
  ],
  props: [
    {
      name: 'className',
      type: 'string',
      description:
        'Классы формы/размера (h-*, w-*, rounded-*) — мёржатся поверх базовых (animate-pulse rounded-md bg-accent) через tailwind-merge.',
    },
    {
      name: '...props',
      type: "React.ComponentProps<'div'>",
      description:
        'Любые атрибуты <div> (напр. style, data-*, aria-hidden) прокидываются на корень.',
    },
  ],
};
