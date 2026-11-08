import { Skeleton } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Skeleton — не поле формы: плейсхолдер загрузки с пульсацией. Форма и размер — классами через
 * className. Variants — типовые формы, Examples — композиции. Обёртка `<div style>` в render —
 * рамка демо, в `code` её нет.
 */
export const skeletonDocConfig: ComponentDocConfig = {
  name: 'Skeleton',
  importFrom: '@reformer/ui-kit',
  description:
    'Серый пульсирующий блок на месте ещё не загруженного содержимого. Размер и форма — классами h-*, w-*, rounded-*.',
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
      title: 'Профиль: аватар и две строки',
      description:
        'Круг и две строки — скелет карточки пользователя. aria-busy и скрытая подпись сообщают скринридеру, что идёт загрузка: сам Skeleton для него пуст.',
      render: () => (
        <div aria-busy="true" className="flex items-center gap-3">
          <span className="sr-only">Загружаем профиль…</span>
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      ),
      code: `<div aria-busy="true" className="flex items-center gap-3">
  <span className="sr-only">Загружаем профиль…</span>
  <Skeleton className="h-12 w-12 rounded-full" />
  <div className="flex flex-col gap-2">
    <Skeleton className="h-4 w-40" />
    <Skeleton className="h-4 w-28" />
  </div>
</div>`,
    },
    {
      id: 'card',
      title: 'Карточка: превью, заголовок, текст',
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
        'Размер и форма: h-*, w-*, rounded-*. Ваш класс перекрывает базовый (rounded-md → rounded-full).',
    },
    {
      name: '...props',
      type: "React.ComponentProps<'div'>",
      description: 'Остальные атрибуты <div>: style, data-*, aria-* и т. д.',
    },
  ],
};
