import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  Button,
} from '@reformer/ui-kit';
import { Inbox, Search, FolderPlus } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Empty — не поле формы: набор блоков пустого состояния (Empty / EmptyHeader / EmptyMedia /
 * EmptyTitle / EmptyDescription / EmptyContent). Variants — вид медиа-слота и рамка, Examples —
 * пустой список с действием и пустой поиск, API — таблица props.
 * Обёртка `<div style>` в render — рамка демо (ширина), в `code` её нет.
 */
export const emptyDocConfig: ComponentDocConfig = {
  name: 'Empty',
  importFrom: '@reformer/ui-kit',
  description: 'Пустое состояние: иконка, заголовок, пояснение и действие по центру блока.',
  variants: [
    {
      id: 'media-default',
      title: 'Иллюстрация (EmptyMedia)',
      description: 'variant="default" — слот без фона: размер иконки или картинки задаёте сами.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Inbox size={40} strokeWidth={1.5} />
              </EmptyMedia>
              <EmptyTitle>Входящих нет</EmptyTitle>
              <EmptyDescription>Новые сообщения появятся здесь.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ),
      code: `<Empty>
  <EmptyHeader>
    <EmptyMedia>
      <Inbox size={40} strokeWidth={1.5} />
    </EmptyMedia>
    <EmptyTitle>Входящих нет</EmptyTitle>
    <EmptyDescription>Новые сообщения появятся здесь.</EmptyDescription>
  </EmptyHeader>
</Empty>`,
    },
    {
      id: 'media-icon',
      title: 'Иконка в плашке (variant="icon")',
      description: 'variant="icon" — квадрат с серым фоном, иконка внутри получает размер 24px.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>Входящих нет</EmptyTitle>
              <EmptyDescription>Новые сообщения появятся здесь.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ),
      code: `<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <Inbox />
    </EmptyMedia>
    <EmptyTitle>Входящих нет</EmptyTitle>
    <EmptyDescription>Новые сообщения появятся здесь.</EmptyDescription>
  </EmptyHeader>
</Empty>`,
    },
    {
      id: 'bordered',
      title: 'С пунктирной рамкой (className="border")',
      description:
        'Стиль рамки у Empty пунктирный, но толщины нет. Класс border включает рамку — так блок читается как место под содержимое.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>Входящих нет</EmptyTitle>
              <EmptyDescription>Новые сообщения появятся здесь.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ),
      code: `<Empty className="border">
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <Inbox />
    </EmptyMedia>
    <EmptyTitle>Входящих нет</EmptyTitle>
    <EmptyDescription>Новые сообщения появятся здесь.</EmptyDescription>
  </EmptyHeader>
</Empty>`,
    },
  ],
  examples: [
    {
      id: 'with-action',
      title: 'Пустой список с действием',
      description:
        'Иконка, заголовок и пояснение в EmptyHeader, кнопка первого шага — в EmptyContent.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderPlus />
              </EmptyMedia>
              <EmptyTitle>Проектов пока нет</EmptyTitle>
              <EmptyDescription>Создайте первый проект, чтобы начать работу.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button>Создать проект</Button>
            </EmptyContent>
          </Empty>
        </div>
      ),
      code: `import { FolderPlus } from 'lucide-react';

<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <FolderPlus />
    </EmptyMedia>
    <EmptyTitle>Проектов пока нет</EmptyTitle>
    <EmptyDescription>Создайте первый проект, чтобы начать работу.</EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button>Создать проект</Button>
  </EmptyContent>
</Empty>`,
    },
    {
      id: 'empty-search',
      title: 'Ничего не найдено',
      description:
        'Пустой результат поиска. Ссылка внутри EmptyDescription получает подчёркивание сама.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>Ничего не найдено</EmptyTitle>
              <EmptyDescription>
                По запросу нет результатов. <a href="#reset">Сбросить фильтры</a>.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ),
      code: `import { Search } from 'lucide-react';

<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <Search />
    </EmptyMedia>
    <EmptyTitle>Ничего не найдено</EmptyTitle>
    <EmptyDescription>
      По запросу нет результатов. <a href="#reset">Сбросить фильтры</a>.
    </EmptyDescription>
  </EmptyHeader>
</Empty>`,
    },
  ],
  props: [
    {
      name: 'Empty',
      type: 'div',
      description:
        'Корень: содержимое по центру столбцом, отступ p-6. Рамка пунктирная, но без толщины — включается классом border.',
    },
    {
      name: 'EmptyHeader',
      type: 'div',
      description: 'Группа медиа, заголовка и описания, не шире max-w-sm.',
    },
    {
      name: 'EmptyMedia.variant',
      type: "'default' | 'icon'",
      default: "'default'",
      description:
        'Слот над заголовком: default — без фона, icon — квадрат 40px с серым фоном, иконка 24px.',
    },
    {
      name: 'EmptyTitle',
      type: 'div',
      description: 'Заголовок. Это div, а не h1–h6.',
    },
    {
      name: 'EmptyDescription',
      type: 'div',
      description: 'Пояснение приглушённым цветом. Ссылки внутри подчёркиваются.',
    },
    {
      name: 'EmptyContent',
      type: 'div',
      description: 'Действия под текстом: кнопки, поле ввода. Столбец по центру, не шире max-w-sm.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
